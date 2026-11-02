// 게임 속 짧은 시간표: 1시간에 하루 (매시 정각에 1교시 시작, 끝나면 다시 1교시부터)
// 수업 6분 · 쉬는 시간 2분 · 점심 8분
// 실제 시계를 기준으로 계산하므로 모든 친구 화면에서 같은 교시가 됨 (서버 필요 없음)

const PLAN = [
  ['1교시', 'class', 6],
  ['쉬는 시간', 'break', 2],
  ['2교시', 'class', 6],
  ['쉬는 시간', 'break', 2],
  ['3교시', 'class', 6],
  ['쉬는 시간', 'break', 2],
  ['4교시', 'class', 6],
  ['점심시간', 'lunch', 8],
  ['5교시', 'class', 6],
  ['쉬는 시간', 'break', 2],
  ['6교시', 'class', 6],
  ['쉬는 시간', 'break', 2],
  ['7교시', 'class', 6],
];

const CYCLE_SEC = PLAN.reduce((s, p) => s + p[2] * 60, 0); // 3600초 = 1시간

export const TIMETABLE = (() => {
  let t = 0;
  return PLAN.map(([name, kind, min]) => {
    const p = { name, kind, s: t, e: t + min * 60 };
    t = p.e;
    return p;
  });
})();

// 점검용: 주소에 ?debug=1&time=24 처럼 주면 '하루 중 24분째'인 것처럼 동작
let offsetMs = 0;
export function setTestTime(v) {
  const m = Number(v);
  if (!Number.isFinite(m)) return;
  const pos = Math.floor(Date.now() / 1000) % CYCLE_SEC;
  offsetMs = (m * 60 - pos) * 1000;
}

const nowMs = () => Date.now() + offsetMs;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// 지금 상태: { key, icon, text, sub, kind }
export function schoolNow(ms = nowMs()) {
  const total = Math.floor(ms / 1000);
  const day = Math.floor(total / CYCLE_SEC); // 몇 번째 '하루'인지
  const pos = total % CYCLE_SEC;
  const i = TIMETABLE.findIndex((p) => pos >= p.s && pos < p.e);
  const cur = TIMETABLE[i];
  const left = cur.e - pos;
  const key = `${day}-${i}`;
  if (cur.kind === 'class') return { key, kind: 'class', icon: '📚', text: cur.name, sub: `수업 중 · ${mmss(left)} 남음` };
  if (cur.kind === 'lunch') return { key, kind: 'lunch', icon: '🍱', text: '점심시간', sub: `${mmss(left)} 남음` };
  const next = TIMETABLE[i + 1];
  return { key, kind: 'break', icon: '☕', text: '쉬는 시간', sub: `${next.name}까지 ${mmss(left)}` };
}

// 급식 메뉴: 게임 속 하루(1시간)마다 바뀜. 수요일 특식 느낌 메뉴도 섞여 있음
const MENUS = [
  ['백미밥', '쇠고기미역국', '돈까스', '배추김치', '요구르트'],
  ['카레라이스', '계란국', '군만두', '깍두기', '바나나'],
  ['짜장밥', '짬뽕국', '탕수육', '단무지', '오렌지주스'],
  ['잡곡밥', '된장찌개', '제육볶음', '콩나물무침', '배추김치'],
  ['비빔밥', '북엇국', '떡볶이', '총각김치', '요구르트'],
];
export function todayMenu(ms = nowMs()) {
  const day = Math.floor(Math.floor(ms / 1000) / CYCLE_SEC);
  return MENUS[day % MENUS.length];
}
