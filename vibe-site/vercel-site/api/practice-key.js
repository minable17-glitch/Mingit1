// 연수용 공용 실습 키 — 선생님이 Vercel 환경 변수 PRACTICE_API_KEY 에 넣어 둔 값을 API 실습 페이지에 보여 준다.
// 키를 저장소(코드)에 적지 않으려고 이렇게 한다. 변수를 지우면 바로 안 보인다.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const key = (process.env.PRACTICE_API_KEY || '').trim();
  if (!key) return res.status(404).json({ error: '아직 연수용 키가 없어요.' });
  return res.status(200).json({ key });
};
