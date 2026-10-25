// Admin API for the site editor. Saving commits public/site-data.json to GitHub;
// Vercel redeploys on that commit, and the commit log doubles as version history.
// Env: GITHUB_TOKEN (fine-grained, Contents read/write on the repo),
//      GOOGLE_CLIENT_ID + ADMIN_EMAILS (comma separated) for Google sign-in,
//      ADMIN_PASSWORD (optional fallback login).
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'minable17-glitch/Mingit1';
const BRANCH = process.env.GITHUB_BRANCH || 'claude/new-session-f7zx6a';
const DIR = 'vibe-site/vercel-site/public/';
const DATA = DIR + 'site-data.json';
const PW = process.env.ADMIN_PASSWORD || '';
const GH = process.env.GITHUB_TOKEN || '';
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const ADMINS = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const TOKEN_HOURS = 12;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

function sign(exp) {
  return crypto.createHmac('sha256', PW + '|' + GH).update(String(exp)).digest('hex');
}
function makeToken() {
  const exp = Date.now() + TOKEN_HOURS * 3600e3;
  return exp + '.' + sign(exp);
}
function validToken(t) {
  if (typeof t !== 'string') return false;
  const [exp, mac] = t.split('.');
  if (!exp || !mac || !(+exp > Date.now())) return false;
  const a = Buffer.from(mac), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function samePassword(x) {
  if (!PW) return false;
  const h = (v) => crypto.createHash('sha256').update(String(v || '')).digest();
  return crypto.timingSafeEqual(h(x), h(PW));
}
// Verifies a Google Identity Services ID token and returns the admin email, or null.
async function googleAdmin(credential) {
  if (!GOOGLE_ID || typeof credential !== 'string') return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) return null;
  const t = await r.json();
  const email = String(t.email || '').toLowerCase();
  const fresh = +t.exp * 1000 > Date.now();
  const issuer = t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com';
  return t.aud === GOOGLE_ID && issuer && fresh && String(t.email_verified) === 'true' && ADMINS.includes(email) ? email : null;
}

function gh(path, opts = {}) {
  return fetch('https://api.github.com/repos/' + REPO + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + GH,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'pevibecode-admin',
      ...(opts.headers || {}),
    },
  });
}
async function readFile(path, ref) {
  const url = '/contents/' + path + '?ref=' + encodeURIComponent(ref);
  const r = await gh(url);
  if (!r.ok) throw fail('github', 'GitHub에서 파일을 읽지 못했어요 (' + r.status + ')');
  const meta = await r.json();
  let text;
  if (meta.content && meta.encoding === 'base64') text = Buffer.from(meta.content, 'base64').toString('utf8');
  else text = await (await gh(url, { headers: { Accept: 'application/vnd.github.raw' } })).text(); // files over 1MB
  return { sha: meta.sha, text };
}
async function writeFile(path, buf, message, sha) {
  const body = { message, content: buf.toString('base64'), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await gh('/contents/' + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (r.status === 409 || r.status === 422) throw fail('conflict', '다른 곳에서 먼저 저장한 내용이 있어요.', 409);
  if (!r.ok) throw fail('github', 'GitHub에 저장하지 못했어요 (' + r.status + ')');
}
function fail(code, message, status = 502) {
  const e = new Error(message);
  e.code = code; e.status = status;
  return e;
}
function checkSite(d) {
  if (!d || !Array.isArray(d.pages) || !d.pages.length) throw fail('bad_data', '저장할 내용이 비어 있어요.', 400);
  const ids = new Set();
  for (const p of d.pages) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || !Array.isArray(p.blocks)) throw fail('bad_data', '페이지 정보가 올바르지 않아요.', 400);
    ids.add(p.id);
  }
  if (!ids.has('home')) throw fail('bad_data', '홈 페이지가 없어요.', 400);
}
async function commitSite(d, message) {
  const cur = await readFile(DATA, BRANCH);
  const now = JSON.parse(cur.text);
  d.rev = (now.rev || 0) + 1;
  d.updated = new Date().toISOString();
  await writeFile(DATA, Buffer.from(JSON.stringify(d, null, 1) + '\n'), message, cur.sha);
  return { now, rev: d.rev, updated: d.updated };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method', message: 'POST only' });
  if (!GH || !((GOOGLE_ID && ADMINS.length) || PW)) return res.status(500).json({ error: 'setup', message: '관리자 설정(환경 변수)이 아직 없어요.' });
  const b = req.body || {};
  try {
    if (b.action === 'config') return res.json({ google: GOOGLE_ID && ADMINS.length ? GOOGLE_ID : null, password: !!PW });
    if (b.action === 'google') {
      const email = await googleAdmin(b.credential);
      if (!email) return res.status(401).json({ error: 'not_admin', message: '관리자로 등록된 구글 계정이 아니에요.' });
      return res.json({ token: makeToken(), email });
    }
    if (b.action === 'login') {
      if (!samePassword(b.password)) {
        await new Promise((r) => setTimeout(r, 800)); // slow down guessing
        return res.status(401).json({ error: 'bad_password', message: '비밀번호가 맞지 않아요.' });
      }
      return res.json({ token: makeToken() });
    }
    if (!validToken(b.token)) return res.status(401).json({ error: 'auth', message: '다시 로그인해 주세요.' });

    switch (b.action) {
      case 'load': {
        const f = await readFile(DATA, BRANCH);
        return res.json({ data: JSON.parse(f.text) });
      }
      case 'save': {
        checkSite(b.data);
        const cur = JSON.parse((await readFile(DATA, BRANCH)).text);
        if ((cur.rev || 0) !== (b.baseRev || 0)) throw fail('conflict', '다른 곳에서 먼저 저장한 내용이 있어요.', 409);
        const r = await commitSite(b.data, '사이트 편집 (관리자 화면)');
        return res.json({ rev: r.rev, updated: r.updated });
      }
      case 'history': {
        const r = await gh('/commits?path=' + encodeURIComponent(DATA) + '&sha=' + encodeURIComponent(BRANCH) + '&per_page=30');
        if (!r.ok) throw fail('github', '기록을 불러오지 못했어요 (' + r.status + ')');
        const items = (await r.json()).map((c) => ({
          sha: c.sha,
          date: c.commit.committer.date,
          message: c.commit.message.split('\n')[0],
        }));
        return res.json({ items });
      }
      case 'restore': {
        if (!/^[0-9a-f]{40}$/.test(b.sha || '')) throw fail('bad_data', '버전 정보가 올바르지 않아요.', 400);
        const old = JSON.parse((await readFile(DATA, b.sha)).text);
        checkSite(old);
        await commitSite(old, '예전 버전으로 되돌리기 (' + b.sha.slice(0, 7) + ')');
        return res.json({ data: old });
      }
      case 'upload': {
        const ext = IMAGE_TYPES[b.type];
        if (!ext || typeof b.base64 !== 'string') throw fail('bad_image', 'PNG, JPG, GIF, WEBP 사진만 올릴 수 있어요.', 400);
        const buf = Buffer.from(b.base64, 'base64');
        if (!buf.length || buf.length > 3.2e6) throw fail('bad_image', '사진이 너무 커요. 3MB 이하로 줄여 주세요.', 400);
        const name = new Date().toISOString().slice(0, 10) + '-' + crypto.randomBytes(4).toString('hex') + '.' + ext;
        await writeFile(DIR + 'images/' + name, buf, '사진 올리기 (' + name + ')');
        return res.json({ src: 'images/' + name });
      }
      default:
        return res.status(400).json({ error: 'action', message: '알 수 없는 요청이에요.' });
    }
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.code || 'error', message: e.message || '서버 오류가 났어요.' });
  }
};
