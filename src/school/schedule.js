// 학교 시간표 (한국 시간 기준, 중학교 45분 수업 + 10분 쉬는 시간)
// 지금이 몇 교시인지 알려주고, 수업 시작·끝날 때 종이 울리도록 main.js 에서 사용합니다.

const T = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

export const TIMETABLE = [
  { name: '아침 조회', start: '08:40', end: '09:00', kind: 'homeroom' },
  { name: '1교시', start: '09:00', end: '09:45', kind: 'class' },
  { name: '2교시', start: '09:55', end: '10:40', kind: 'class' },
  { name: '3교시', start: '10:50', end: '11:35', kind: 'class' },
  { name: '4교시', start: '11:45', end: '12:30', kind: 'class' },
  { name: '점심시간', start: '12:30', end: '13:30', kind: 'lunch' },
  { name: '5교시', start: '13:30', end: '14:15', kind: 'class' },
  { name: '6교시', start: '14:25', end: '15:10', kind: 'class' },
  { name: '7교시', start: '15:20', end: '16:05', kind: 'class' },
  { name: '종례', start: '16:05', end: '16:20', kind: 'homeroom' },
].map((p) => ({ ...p, s: T(p.start), e: T(p.end) }));

// 점검용: 주소에 ?debug=1&time=10:00 처럼 주면 그 시각인 것처럼 동작
let offsetMs = 0;
export function setTestTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return;
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
  offsetMs = (Number(m[1]) * 60 + Number(m[2]) - cur) * 60000;
}

// 한국 시간 (기기 시간대와 관계없이)
function kstNow(ms = Date.now() + offsetMs) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// 지금 상태: { key, icon, text, sub }
export function schoolNow(ms) {
  const { day, min } = kstNow(ms);
  if (day === 0 || day === 6) return { key: 'weekend', icon: '🏖️', text: '주말', sub: '학교 쉬는 날' };
  const cur = TIMETABLE.find((p) => min >= p.s && min < p.e);
  if (cur) {
    const icon = cur.kind === 'class' ? '📚' : cur.kind === 'lunch' ? '🍱' : '📢';
    const sub = cur.kind === 'class' ? `수업 중 · ${cur.end} 끝` : `${cur.end}까지`;
    return { key: cur.name, icon, text: cur.name, sub, kind: cur.kind };
  }
  const next = TIMETABLE.find((p) => p.s > min);
  if (!next) return { key: 'after', icon: '🌙', text: '방과 후', sub: '내일 또 만나요' };
  if (min < TIMETABLE[0].s) return { key: 'before', icon: '🌅', text: '등교 시간', sub: `${next.name} ${next.start} 시작` };
  return { key: `break-${next.name}`, icon: '☕', text: '쉬는 시간', sub: `${next.name} ${next.start} 시작`, kind: 'break' };
}

// 요일별 급식 메뉴 (그 시절 급식 느낌, 수요일은 특식!)
const MENUS = {
  1: ['백미밥', '쇠고기미역국', '돈까스', '배추김치', '요구르트'],
  2: ['카레라이스', '계란국', '군만두', '깍두기', '바나나'],
  3: ['짜장밥', '짬뽕국', '탕수육', '단무지', '오렌지주스'],
  4: ['잡곡밥', '된장찌개', '제육볶음', '콩나물무침', '배추김치'],
  5: ['비빔밥', '북엇국', '떡볶이', '총각김치', '요구르트'],
};
export function todayMenu(ms) {
  return MENUS[kstNow(ms).day] || [];
}
