// 시간표 연동 짜투리 모드: 지금이 공강 시간인지 계산 (순수 함수)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// 한국 시간 기준 요일(1=월 … 7=일)과 자정 이후 분
export function kstClock(now = Date.now()) {
  const d = new Date(now + KST_OFFSET_MS);
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return { weekday, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// bell: [{ period, start: "09:00", end: "09:45" }], timetable: { "1": [1, 3], ... } (수업 있는 교시)
// 지금이 수업 없는 교시(공강) 안이면 { period, minutesLeft } 를, 아니면 null
export function freeSlotNow(bell, timetable, now = Date.now()) {
  const { weekday, minutes } = kstClock(now);
  if (weekday > 5 || !bell?.length) return null;
  const busy = new Set((timetable?.[String(weekday)] ?? []).map(Number));
  const slot = bell.find((b) => minutes >= toMinutes(b.start) && minutes < toMinutes(b.end));
  if (!slot || busy.has(Number(slot.period))) return null;
  return { period: slot.period, minutesLeft: toMinutes(slot.end) - minutes };
}
