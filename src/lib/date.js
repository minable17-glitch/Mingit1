// 한국 시간(KST, UTC+9) 기준 오늘 날짜 문자열(YYYY-MM-DD)을 돌려줌.
// 자정을 넘겨서도 앱을 계속 쓰는 경우가 많아서, 브라우저 로컬 시간대나 서버(DB)의
// UTC 기준 날짜와 어긋나지 않도록 항상 한국 기준으로 "오늘"을 계산해야 함.
export function todayKST() {
  const kstMs = Date.now() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" 문자열끼리 순수하게 날짜 계산만 함 (실제 시각·시간대와 무관하게
// 달력 날짜로만 다루기 위해 항상 UTC 기준 정수로 변환해서 계산함)
export function addDaysToDateString(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenDateStrings(startStr, endStr) {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.round((end - start) / 86400000) + 1;
}
