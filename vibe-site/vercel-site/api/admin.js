// Admin API for the site editor. Saving commits a site's data file to GitHub;
// Vercel redeploys on that commit, and the commit log doubles as version history.
// Several sites share this project: public/sites.json lists them; the main site ('' slug)
// lives in public/site-data.json and is served at /, others in public/sites/<slug>.json at /<slug>.
// Env: GITHUB_TOKEN (fine-grained, Contents read/write on the repo),
//      GOOGLE_CLIENT_ID + ADMIN_EMAILS (comma separated) for Google sign-in,
//      ADMIN_PASSWORD (optional fallback login).
const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'minable17-glitch/Mingit1';
const BRANCH = process.env.GITHUB_BRANCH || 'claude/new-session-f7zx6a';
const DIR = 'vibe-site/vercel-site/public/';
const SITES = DIR + 'sites.json';
const RESERVED = new Set(['admin', 'api', 'images', 'sites', 'index', 'favicon', 'site-data']);
function dataPath(slug) { return slug ? DIR + 'sites/' + slug + '.json' : DIR + 'site-data.json'; }
function validSlug(x) { return typeof x === 'string' && /^[a-z0-9][a-z0-9-]{0,29}$/.test(x) && !RESERVED.has(x); }
async function siteList() {
  try { return JSON.parse((await readFile(SITES, BRANCH)).text); }
  catch (e) { return [{ slug: '', title: '바이브 코딩 연수(체육)' }]; } // before the first extra site existed
}
async function slugOf(b) { // the site a request is about; must be a listed one
  const slug = b.site || '';
  if (slug && !(await siteList()).some((x) => x.slug === slug)) throw fail('no_site', '그런 사이트가 없어요.', 404);
  return slug;
}
// Several files in ONE commit (one Vercel deploy) through the Git Data API. content null = delete.
async function commitFiles(files, message) {
  const ref = await gh('/git/ref/heads/' + encodeURIComponent(BRANCH));
  if (!ref.ok) throw fail('github', 'GitHub 브랜치를 읽지 못했어요 (' + ref.status + ')');
  const head = (await ref.json()).object.sha;
  const base = (await (await gh('/git/commits/' + head)).json()).tree.sha;
  const tree = await gh('/git/trees', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: base, tree: files.map((f) => f.content === null
      ? { path: f.path, mode: '100644', type: 'blob', sha: null }
      : { path: f.path, mode: '100644', type: 'blob', content: f.content }) }) });
  if (!tree.ok) throw fail('github', 'GitHub에 저장하지 못했어요 (' + tree.status + ')');
  const commit = await gh('/git/commits', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: (await tree.json()).sha, parents: [head] }) });
  if (!commit.ok) throw fail('github', 'GitHub에 저장하지 못했어요 (' + commit.status + ')');
  const upd = await gh('/git/refs/heads/' + encodeURIComponent(BRANCH), { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: (await commit.json()).sha }) });
  if (upd.status === 409 || upd.status === 422) throw fail('conflict', '다른 곳에서 먼저 저장한 내용이 있어요. 잠시 뒤 다시 해 주세요.', 409);
  if (!upd.ok) throw fail('github', 'GitHub에 저장하지 못했어요 (' + upd.status + ')');
}
const json = (d) => JSON.stringify(d, null, 1) + '\n';
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
async function commitSite(DATA, d, message) {
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

    const DATA = b.action === 'upload' || b.action === 'sites' || b.action === 'createSite' ? null : dataPath(await slugOf(b));
    switch (b.action) {
      case 'sites':
        return res.json({ sites: await siteList() });
      case 'createSite': {
        const slug = b.slug, title = String(b.title || '').trim().slice(0, 60);
        if (!validSlug(slug)) throw fail('bad_slug', '주소 이름은 영어 소문자·숫자·- 로 30자까지 써 주세요. (admin, api, images, sites는 쓸 수 없어요)', 400);
        if (!title) throw fail('bad_data', '사이트 이름을 넣어 주세요.', 400);
        const list = await siteList();
        if (list.some((x) => x.slug === slug)) throw fail('dup_slug', '이미 있는 주소예요. 다른 이름을 써 주세요.', 409);
        let d;
        if (typeof b.copyFrom === 'string') {
          if (!list.some((x) => x.slug === b.copyFrom)) throw fail('no_site', '복사할 사이트가 없어요.', 404);
          d = JSON.parse((await readFile(dataPath(b.copyFrom), BRANCH)).text);
        } else {
          d = { v: 1, pages: [{ id: 'home', title: '홈', parent: null, tag: '', desc: '', blocks: [
            { t: 'h', text: title }, { t: 'p', text: '관리자 화면에서 "편집"을 눌러 내용을 채워 주세요.' }] }] };
        }
        d.site = { ...(d.site || {}), title }; d.rev = 0; d.updated = new Date().toISOString();
        const page = (await readFile(DIR + 'index.html', BRANCH)).text;
        await commitFiles([
          { path: dataPath(slug), content: json(d) },
          { path: DIR + slug + '.html', content: page }, // served at /<slug> (cleanUrls)
          { path: SITES, content: json(list.concat([{ slug, title }])) },
        ], '새 사이트 만들기: ' + title + ' (/' + slug + ')');
        return res.json({ slug, data: d });
      }
      case 'deleteSite': {
        const slug = await slugOf(b);
        if (!slug) throw fail('bad_data', '첫 사이트는 지울 수 없어요.', 400);
        const list = (await siteList()).filter((x) => x.slug !== slug);
        await commitFiles([
          { path: dataPath(slug), content: null }, { path: DIR + slug + '.html', content: null },
          { path: SITES, content: json(list) },
        ], '사이트 삭제: /' + slug);
        return res.json({ ok: true });
      }
      case 'load': {
        const f = await readFile(DATA, BRANCH);
        return res.json({ data: JSON.parse(f.text) });
      }
      case 'save': {
        checkSite(b.data);
        const cur = JSON.parse((await readFile(DATA, BRANCH)).text);
        if ((cur.rev || 0) !== (b.baseRev || 0)) throw fail('conflict', '다른 곳에서 먼저 저장한 내용이 있어요.', 409);
        const r = await commitSite(DATA, b.data, '사이트 편집 (관리자 화면)' + (b.site ? ' /' + b.site : ''));
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
        await commitSite(DATA, old, '예전 버전으로 되돌리기 (' + b.sha.slice(0, 7) + ')' + (b.site ? ' /' + b.site : ''));
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
