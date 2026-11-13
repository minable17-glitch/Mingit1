// Gemini 호출 공통 (이름이 _ 로 시작해서 Vercel 이 주소로 열지 않는다).
// 키는 Vercel 환경 변수 GEMINI_API_KEY. 모델은 GEMINI_MODEL 이 있으면 그것부터,
// 없으면 이 키로 쓸 수 있는 모델 목록을 구글에 물어봐서 고른다(모델 이름이 자주 바뀌기 때문).
// 없는 모델(404)·붐빔(429/5xx)·시간 초과면 다음 모델로 넘어간다.
const FALLBACK = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

let cached = null, cachedAt = 0;   // 모델 목록 (서버가 살아 있는 동안 1시간 기억)
async function modelList(key) {
  if (cached && Date.now() - cachedAt < 3600e3) return cached;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${BASE}?pageSize=200`, { headers: { 'x-goog-api-key': key }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return FALLBACK;
    const j = await r.json();
    const names = (j.models || [])
      .filter((m) => /flash/.test(m.name) && !/image|tts|live|audio|embedding|thinking/.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));
    if (!names.length) return FALLBACK;
    cached = names; cachedAt = Date.now();
    return names;
  } catch (e) { return FALLBACK; }
}

// quality: 꼼꼼해야 하는 일(채점)은 Lite 가 아닌 Flash 먼저, 빠르기만 하면 되는 일은 Lite 먼저
function order(names, quality) {
  const rank = (n) => (/lite/.test(n) === !quality ? 0 : 2) + (/preview|exp/.test(n) ? 1 : 0) + (/latest/.test(n) ? 0 : 0.5);
  return names.slice().sort((a, b) => rank(a) - rank(b) || (a < b ? 1 : -1)).slice(0, 5);
}

function thinkingFor(model, level) {
  if (!level) return null;
  if (/gemini-3/.test(model)) return { thinkingLevel: level === 'off' ? 'minimal' : level };
  if (/2\.5/.test(model)) return { thinkingBudget: level === 'off' ? 0 : level === 'low' ? 1024 : 4096 };
  return null;
}

async function callOnce(model, key, body, ms) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const e = new Error('gemini ' + r.status); e.status = r.status;
      e.detail = j && j.error && j.error.message || '';
      throw e;
    }
    const parts = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    const text = (parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('empty');
    return text;
  } finally { clearTimeout(timer); }
}

// prompt 를 보내고 글을 돌려받는다.
// opts: json(JSON 으로만 답), temperature, maxTokens, system, timeout(전체 ms), quality(꼼꼼한 모델 먼저), thinking('off'|'low'|'high')
async function askGemini(prompt, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('no key');
  const deadline = Date.now() + (opts.timeout || 25000);
  let list = order(await modelList(key), !!opts.quality);
  if (process.env.GEMINI_MODEL) list = [process.env.GEMINI_MODEL].concat(list.filter((m) => m !== process.env.GEMINI_MODEL));
  let last;
  for (let i = 0; i < list.length; i++) {
    const model = list[i];
    const left = deadline - Date.now();
    if (left < 4000) break;
    const gen = Object.assign({ temperature: opts.temperature == null ? 0.4 : opts.temperature, maxOutputTokens: opts.maxTokens || 1200 },
      opts.json ? { responseMimeType: 'application/json' } : {});
    const think = thinkingFor(model, opts.thinking);
    if (think) gen.thinkingConfig = think;
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen };
    if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
    // 꼼꼼한 첫 모델에게는 시간을 넉넉히, 그래도 다음 모델 몫은 남긴다
    const ms = i < list.length - 1 ? Math.min(left - 6000, opts.quality ? 40000 : 20000) : left;
    try { return { text: await callOnce(model, key, body, Math.max(ms, 4000)), model }; }
    catch (e) {
      last = e;
      if (e.status === 400 && think) {   // 이 모델이 '생각 설정'을 모르면 빼고 한 번 더
        delete gen.thinkingConfig;
        try { return { text: await callOnce(model, key, body, Math.max(Math.min(deadline - Date.now(), 20000), 4000)), model }; } catch (e2) { last = e2; }
      }
      if (/API key|API_KEY/i.test(last.detail || '') || last.status === 401 || last.status === 403) { last.status = 401; break; }   // 키 문제는 모델을 바꿔도 안 된다
    }
  }
  throw last || new Error('fail');
}

module.exports = { askGemini };
