// 퀴즈 AI 피드백 — API 실습 페이지의 "완성 모습" 예시.
// 화면은 고른 보기 번호만 보낸다. 문제·정답·해설은 이 파일에 있고, 여기서 프롬프트를 만들어 Groq 에 보낸다.
// 키가 없거나 AI 가 실패하면 틀린 문제 해설로 만든 규칙 피드백을 돌려준다.

const { askGroq, limited, cors, bodyOf } = require('./_groq');

const QUIZZES = {
  basketball: {
    title: '농구 규칙 퀴즈',
    items: [
      { q: '공을 든 채로 세 걸음 이상 걸었어요. 어떤 반칙일까요?', opts: ['트래블링', '더블 드리블', '푸싱', '반칙 아님'], a: 0,
        why: '공을 잡고 두 걸음까지는 괜찮지만, 세 걸음부터는 트래블링(워킹)이에요.' },
      { q: '드리블을 멈추고 공을 잡았다가 다시 드리블했어요.', opts: ['정상 플레이', '트래블링', '더블 드리블', '3초 바이올레이션'], a: 2,
        why: '드리블을 한 번 끝내면 다시 시작할 수 없어요. 패스하거나 슛해야 해요.' },
      { q: '3점 슛 라인 밖에서 던진 슛이 들어갔어요. 몇 점일까요?', opts: ['1점', '2점', '3점', '4점'], a: 2,
        why: '3점 라인 밖에서 발을 떼고 던진 슛은 3점이에요. 라인을 밟으면 2점이에요.' },
      { q: '공격하는 선수가 상대 골대 밑 제한 구역(페인트존)에 계속 서 있을 수 있는 시간은?', opts: ['3초', '5초', '8초', '제한 없음'], a: 0,
        why: '공격 팀 선수는 제한 구역에 3초 넘게 머물 수 없어요(3초 바이올레이션).' },
      { q: '공을 잡은 공격 팀이 슛을 던져야 하는 제한 시간(샷 클락)은?', opts: ['14초', '24초', '30초', '60초'], a: 1,
        why: '공격 팀은 24초 안에 슛을 던져 림에 맞혀야 해요. 공격 리바운드를 잡으면 14초로 다시 시작해요.' },
    ],
  },
};

function makePrompt(quiz, picks) {
  const lines = quiz.items.map((it, i) =>
    `${i + 1}. ${it.q}\n   고른 답: ${it.opts[picks[i]]} / 정답: ${it.opts[it.a]} / ${picks[i] === it.a ? '맞음' : '틀림'}`).join('\n');
  const score = quiz.items.filter((it, i) => picks[i] === it.a).length;
  return `너는 중학교 체육 선생님이야. 학생이 '${quiz.title}'를 풀었어. 결과를 보고 학생에게 직접 말하듯 한국어로 피드백을 써줘.

규칙:
- 4~6문장, 다정하고 격려하는 말투
- 맞힌 개념은 한 문장으로 짧게 칭찬해
- 틀린 문제는 왜 틀렸는지, 실제 경기 장면을 떠올리게 쉽게 설명해 (정답을 외우라고만 하지 마)
- 마지막 문장은 "다음 체육 시간에 ○○를 직접 해 보자"처럼 몸으로 확인해 볼 활동 하나를 제안해
- 점수를 다시 읽어 주지 마

결과: ${quiz.items.length}문제 중 ${score}개 맞음
${lines}`;
}

function ruleFeedback(quiz, picks) {
  const wrong = quiz.items.map((it, i) => ({ it, i })).filter((x) => picks[x.i] !== x.it.a);
  const n = quiz.items.length, score = n - wrong.length;
  if (!wrong.length) return `${n}문제를 모두 맞혔어요! 규칙을 정확히 알고 있으니, 다음 체육 시간에는 친구들 경기에서 심판을 맡아 직접 판정해 보세요.`;
  return (score >= n - 1 ? '거의 다 맞혔어요! ' : '좋은 도전이었어요! ') + '다시 볼 규칙만 짚어 볼게요.\n' +
    wrong.map((x) => `- ${x.i + 1}번: ${x.it.why}`).join('\n') +
    '\n다음 체육 시간에 이 장면을 직접 해 보면서 몸으로 확인해 봐요.';
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  const body = bodyOf(req);
  const quiz = QUIZZES[body.quiz];
  const picks = Array.isArray(body.picks) ? body.picks.map(Number) : [];
  if (!quiz || picks.length !== quiz.items.length || !picks.every((p, i) => Number.isInteger(p) && p >= 0 && p < quiz.items[i].opts.length)) {
    return res.status(400).json({ error: '퀴즈 번호와 고른 보기가 맞지 않아요.' });
  }
  const prompt = makePrompt(quiz, picks);
  const isLimited = limited(req);
  let out = { source: 'rule', feedback: ruleFeedback(quiz, picks), reason: isLimited ? '한 시간에 30번까지만 AI에게 물어봐요' : '' };
  if (!isLimited) {
    try { const a = await askGroq(prompt); out = { source: 'ai', model: a.model, feedback: a.text }; }
    catch (e) { out.reason = e.message === 'no key' ? 'AI 열쇠(GROQ_API_KEY)가 아직 없어요' : 'AI가 답하지 못했어요'; }
  }
  return res.status(200).json(Object.assign(out, { prompt, score: quiz.items.filter((it, i) => picks[i] === it.a).length }));
};
