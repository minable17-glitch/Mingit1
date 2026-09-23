// 한국 시간(KST, UTC+9) 기준 날짜 유틸.
// 브라우저 시간대나 UTC 날짜와 어긋나지 않도록 "오늘"은 항상 한국 기준으로 계산함.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function todayKST(now = Date.now()) {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 시각(ISO 문자열)을 한국 기준 날짜 문자열로
export function toDateKST(isoString) {
  return todayKST(new Date(isoString).getTime());
}

function toUTCDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// to - from (일). 같은 날이면 0
export function diffDays(fromStr, toStr) {
  return Math.round(toUTCDays(toStr) - toUTCDays(fromStr));
}

export function addDays(dateStr, days) {
  return new Date((toUTCDays(dateStr) + days) * 86400000).toISOString().slice(0, 10);
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "9/25(목)" 형태
export function formatShort(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAYS[wd]})`;
}

// 마감까지 남은 날을 사람이 읽기 쉬운 말로
export function dueLabel(dueStr, today) {
  const left = diffDays(today, dueStr);
  if (left < 0) return `${-left}일 지남`;
  if (left === 0) return '오늘 마감';
  if (left === 1) return '내일 마감';
  return `D-${left}`;
}

// 그 주의 월요일
export function weekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}
