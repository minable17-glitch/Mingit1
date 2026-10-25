// Groq 호출 공통 (이름이 _ 로 시작해서 Vercel 이 주소로 열지 않는다).
// 키는 Vercel 환경 변수 GROQ_API_KEY, 모델은 GROQ_MODEL (기본 openai/gpt-oss-20b).
async function askGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('no key');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 700 }),
    });
    if (!r.ok) throw new Error('groq ' + r.status);
    const j = await r.json();
    const c = j && j.choices && j.choices[0];
    if (!c || !c.message || !c.message.content || c.finish_reason === 'length') throw new Error('empty');
    return { text: String(c.message.content).trim(), model };
  } finally { clearTimeout(timer); }
}

// 같은 서버 안에서만 세는 간단한 횟수 제한 (IP 당 한 시간 30번)
const hits = new Map();
function limited(req) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= 30) return true;
  list.push(now); hits.set(ip, list); return false;
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST 만 받아요' }); return true; }
  return false;
}

function bodyOf(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b || {};
}

module.exports = { askGroq, limited, cors, bodyOf };
