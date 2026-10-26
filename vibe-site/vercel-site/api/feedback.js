// AI 러닝 코치 피드백 — 파라런(running-journal) src/lib/feedback.ts 와 같은 방식.
// 화면은 숫자(1km 구간 시간, 지난 최고 페이스)만 보내고, 이 함수가 AI 에 프롬프트를 보낸다.
// Gemini(GEMINI_API_KEY)가 있으면 Gemini, 없으면 Groq(GROQ_API_KEY). 키는 Vercel 환경 변수에만 있다.
// 키가 없거나 AI 가 실패하면 규칙으로 만든 피드백을 돌려준다(앱과 같음).
// 받는 값은 숫자뿐이라 아무 글이나 AI 에게 시키는 통로로 쓸 수 없다.

const WALK_PACE = 600; // 10'00"/km 보다 느리면 걷기 (파라런 학생 기준)
const { askGroq, limited, cors, bodyOf } = require('./_groq');
const { askGemini } = require('./_gemini');
const askAI = (p) => (process.env.GEMINI_API_KEY ? askGemini(p, { temperature: 0.7, maxTokens: 700 }) : askGroq(p));

function pace(sec) {
  const t = Math.round(sec), m = Math.floor(t / 60), s = t % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

function pacingComment(laps) {
  if (laps.length < 2) return '';
  const half = Math.ceil(laps.length / 2);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const diff = avg(laps.slice(half)) - avg(laps.slice(0, half));
  if (diff > 5) return ' 다음엔 초반 페이스를 지금보다 조금 늦춰서 힘을 아꼈다가, 그 힘을 후반부에 써보는 걸 목표로 해봐요.';
  if (diff < -5) return ' 후반부에 힘을 잘 아꼈다가 쓴 점이 좋았어요. 다음엔 그 여유를 초반부터 조금씩 당겨써 보는 것도 시도해봐요.';
  return ' 페이스를 고르게 유지하는 능력이 좋으니, 다음엔 이 페이스에서 아주 조금만 더 속도를 올려보는 걸 목표로 삼아도 좋겠어요.';
}

function ruleFeedback(cur, best, laps) {
  if (cur > WALK_PACE) return "이번엔 페이스 기준을 넘지 못해 '걷기'로 기록됐어요. 다음엔 목표 페이스를 조금 낮게 잡고, 그 페이스를 끝까지 유지하는 데 집중해보는 걸 목표로 해봐요!";
  if (!best) return `완주 성공! 첫 기록이 쌓였어요. 다음번엔 오늘 페이스를 기준 삼아 아주 조금씩 거리나 속도를 늘려가 보는 걸 목표로 해봐요.${pacingComment(laps)}`;
  const diff = best - cur;
  if (diff > 5) return `이전 최고 페이스보다 ${Math.round(diff)}초/km 더 빨라졌어요! 이 성장세를 이어가려면, 다음에도 오늘과 비슷한 강도로 무리하지 않게 달려보는 걸 목표로 해봐요.${pacingComment(laps)}`;
  if (diff < -5) return `오늘은 이전 최고 기록보다 페이스가 조금 아쉬웠어요. 다음엔 처음 1km만이라도 오늘보다 살짝 여유 있게 시작해보는 걸 목표로 해봐요.${pacingComment(laps)}`;
  return `지난 기록과 비슷한 페이스를 안정적으로 유지했어요. 다음엔 지금 페이스에 익숙해진 만큼, 마지막 1km에서만 살짝 속도를 올려보는 걸 목표로 해봐요.${pacingComment(laps)}`;
}

function makePrompt(cur, best, laps) {
  const lapsSummary = laps.map((s, i) => `${i + 1}km 지점 페이스 ${pace(s)}`).join(', ');
  return `너는 중고생 러닝 코치야. 학생의 이번 기록과 과거 기록을 보고 3~4문장으로 한국어 피드백을 작성해줘.

중요한 규칙:
- 기록을 그대로 설명하거나 숫자를 나열하지 마 (예: "페이스가 5분에서 6분으로 느려졌어요" 같은 서술 금지).
- 반드시 "다음번엔 이렇게 해보자"는 식의 구체적이고 실천 가능한 개선 방향을 제안하는 문장으로 끝내.
- 다정하고 격려하는 톤을 유지해.
${laps.length > 1 ? '- 구간별 페이스 데이터를 참고해서, 페이스 배분(초반에 오버페이스였는지, 후반에 처졌는지, 꾸준했는지)에 대한 개선 제안을 반드시 포함해.\n' : ''}
이번 기록: 거리 ${laps.length}km, 페이스 ${Math.round(cur)}초/km, ${cur > WALK_PACE ? '페이스 기준 미달(걷기)' : '달리기'}
구간별 페이스: ${lapsSummary}

과거 기록:
${best ? `1. 최고 페이스 ${Math.round(best)}초/km, 달리기` : '없음 (첫 기록)'}`;
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const body = bodyOf(req);
  const laps = body && Array.isArray(body.laps) ? body.laps.map(Number) : [];
  if (laps.length < 1 || laps.length > 10 || !laps.every((s) => Number.isFinite(s) && s >= 120 && s <= 1800)) {
    return res.status(400).json({ error: '1km 구간 기록을 1~10개, 한 구간 2분~30분 사이로 넣어 주세요.' });
  }
  let best = Number(body.best) || 0;
  if (best && (best < 120 || best > 1800)) best = 0;
  const cur = laps.reduce((s, x) => s + x, 0) / laps.length;
  const prompt = makePrompt(cur, best, laps);

  const isLimited = limited(req);

  let out = { source: 'rule', feedback: ruleFeedback(cur, best, laps), reason: isLimited ? '한 시간에 30번까지만 AI에게 물어봐요' : '' };
  if (!isLimited) {
    try { const a = await askAI(prompt); out = { source: 'ai', model: a.model, feedback: a.text }; }
    catch (e) { out.reason = e.message === 'no key' ? 'AI 열쇠(GEMINI_API_KEY)가 아직 없어요' : 'AI가 답하지 못했어요'; }
  }
  return res.status(200).json(Object.assign(out, { prompt, pace: Math.round(cur) }));
};
