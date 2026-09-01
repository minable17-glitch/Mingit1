// 한국 시간(KST, UTC+9) 기준 오늘 날짜 문자열(YYYY-MM-DD)을 돌려줌.
// 자정을 넘겨서도 앱을 계속 쓰는 경우가 많아서, 브라우저 로컬 시간대나 서버(DB)의
// UTC 기준 날짜와 어긋나지 않도록 항상 한국 기준으로 "오늘"을 계산해야 함.
export function todayKST() {
  const kstMs = Date.now() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}
