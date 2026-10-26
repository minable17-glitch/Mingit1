// Gemini 호출 공통 (이름이 _ 로 시작해서 Vercel 이 주소로 열지 않는다).
// 키는 Vercel 환경 변수 GEMINI_API_KEY, 모델은 GEMINI_MODEL(없으면 아래 후보를 차례로).
// 모델 이름은 자주 바뀌어서, 없는 모델(404)·붐빔(429/5xx)이면 다음 후보로 넘어간다.
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.8-flash'];

async function callOnce(model, key, body, ms) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) { const e = new Error('gemini ' + r.status); e.status = r.status; throw e; }
    const parts = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    const text = (parts || []).map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('empty');
    return text;
  } finally { clearTimeout(timer); }
}

// prompt 를 보내고 글을 돌려받는다. json:true 면 JSON 으로만 답하게 한다.
async function askGemini(prompt, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('no key');
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: Object.assign({ temperature: opts.temperature == null ? 0.4 : opts.temperature, maxOutputTokens: opts.maxTokens || 1200 },
      opts.json ? { responseMimeType: 'application/json' } : {}) };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  const list = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL].concat(MODELS) : MODELS;
  let last;
  for (const model of list) {
    try { return { text: await callOnce(model, key, body, opts.timeout || 25000), model }; }
    catch (e) {
      last = e;
      if (e.status === 400 || e.status === 401 || e.status === 403) break; // 요청·키 문제는 다른 모델로도 안 된다
    }
  }
  throw last || new Error('fail');
}

module.exports = { askGemini };
