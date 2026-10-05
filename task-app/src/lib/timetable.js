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

// 그날(YYYY-MM-DD)의 공강 교시들 [{ period, start, end, now, past }] — 주말이거나 종 시간이 없으면 []
export function freePeriodsOn(bell, timetable, date, now = Date.now()) {
  if (!bell?.length) return [];
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || wd === 6) return [];
  const busy = new Set((timetable?.[String(wd)] ?? []).map(Number));
  const clock = kstClock(now);
  const todayStr = new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
  const isToday = todayStr === date;
  return bell
    .filter((b) => !busy.has(Number(b.period)))
    .map((b) => ({
      period: Number(b.period), start: b.start, end: b.end,
      now: isToday && clock.minutes >= toMinutes(b.start) && clock.minutes < toMinutes(b.end),
      past: date < todayStr || (isToday && clock.minutes >= toMinutes(b.end)),
    }));
}
