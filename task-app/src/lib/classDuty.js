// 1인 1역 · 청소 당번 · 자리배치표 (순수 함수, 테스트 가능). 자리 배치 기록(class_seating.data)에 같이 저장.
// roles:    { 이름: { role: '급식', detail: '급식 담당' } }  — role 은 자리배치표에서 이름 아래 작게
// cleaning: { days, zones: [{ id, name, slots }], cells: { 구역id: [ [요일별 칸 이름...], ... ] }, rules: [{ title, body }], footer,
//             auto(자동 순환), next(다음 순환일 YYYY-MM-DD), weeks(몇 주마다), base(마지막 순환일) }

export const DAYS = ['월', '화', '수', '목', '금'];

// 반 학생 이름: 명렬표 번호순 + 자리 명단(쉼표·띄어쓰기 구분)에만 있는 이름
export function classNames(s, roster = []) {
  const fromRoster = roster.filter((x) => x.active !== false).sort((a, b) => a.number - b.number).map((x) => x.name);
  const typed = String(s?.students ?? '').split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  return [...new Set([...fromRoster, ...typed])];
}

export const DEFAULT_CLEANING = {
  days: DAYS,
  zones: [
    { id: 'z1', name: '왼쪽 쓸기(1,2,3분단)', slots: 2 },
    { id: 'z2', name: '오른쪽 쓸기(4,5,6분단)', slots: 2 },
    { id: 'z3', name: '앞뒤 쓸기', slots: 1 },
    { id: 'z4', name: '닦기', slots: 2 },
  ],
  cells: {},
  rules: [
    { title: '쓸기', body: '모서리까지 꼼꼼하게\n책상 줄 맞추기' },
    { title: '닦기', body: '쓸기가 끝난 후 쓸기 담당이 선생님께 통과 받고 닦기 시작\n닦기 끝난 후 걸레 빨아서 정리' },
  ],
  footer: '끝나고 검사 받은 후 귀가',
  base: '',
  next: '',
  weeks: 2,
  auto: true,
};

const isDate = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? '');
const clampInt = (v, lo, hi, def) => Math.min(hi, Math.max(lo, Number.parseInt(v, 10) || def));

// 저장된 값이 모자라거나 구역·인원이 바뀌어도 표 모양(구역 × 요일 × 칸)을 맞춰 줌
export function normalizeCleaning(c) {
  const v = c && typeof c === 'object' ? c : {};
  const days = Array.isArray(v.days) && v.days.length ? v.days.map(String) : DAYS;
  const zones = (Array.isArray(v.zones) ? v.zones : DEFAULT_CLEANING.zones)
    .filter((z) => z && typeof z === 'object')
    .map((z, i) => ({ id: String(z.id ?? `z${i + 1}`), name: String(z.name ?? ''), slots: clampInt(z.slots, 1, 6, 1) }));
  const cells = {};
  for (const z of zones) {
    const old = v.cells?.[z.id];
    cells[z.id] = days.map((_, d) => Array.from({ length: z.slots }, (__, k) => {
      const x = old?.[d]?.[k];
      return typeof x === 'string' ? x : '';
    }));
  }
  return {
    days, zones, cells,
    rules: (Array.isArray(v.rules) ? v.rules : DEFAULT_CLEANING.rules).map((r) => ({ title: String(r?.title ?? ''), body: String(r?.body ?? '') })),
    footer: String(v.footer ?? DEFAULT_CLEANING.footer),
    base: isDate(v.base) ? v.base : '',
    weeks: clampInt(v.weeks, 1, 8, 2),
    // 다음 순환일: 따로 정한 날이 없으면 예전 기준일 + N주
    next: isDate(v.next) ? v.next : (isDate(v.base) ? addDays(v.base, clampInt(v.weeks, 1, 8, 2) * 7) : ''),
    auto: v.auto !== false,
  };
}

// 하루치 칸을 위(첫 구역 첫 칸)에서 아래로 한 줄로
const flatDay = (c, d) => c.zones.flatMap((z) => c.cells[z.id][d]);
function setFlatDay(cells, c, d, list) {
  let i = 0;
  for (const z of c.zones) for (let k = 0; k < z.slots; k += 1) { cells[z.id][d][k] = list[i]; i += 1; }
}
const cloneCells = (c) => Object.fromEntries(Object.entries(c.cells).map(([k, days]) => [k, days.map((slots) => [...slots])]));

// 순환: 요일마다 위에서 아래로 한 칸씩(맨 아래는 맨 위로). today 를 새 기준일로
// today 를 주면 지금 손으로 돌린 것: 마지막 순환일 = today, 다음 순환일 = today + N주
export function rotateCleaning(cleaning, today = '') {
  const c = normalizeCleaning(cleaning);
  const cells = cloneCells(c);
  c.days.forEach((_, d) => {
    const flat = flatDay(c, d);
    if (flat.length > 1) setFlatDay(cells, c, d, [flat.at(-1), ...flat.slice(0, -1)]);
  });
  return { ...c, cells, base: today || c.base, next: today ? addDays(today, c.weeks * 7) : c.next };
}

// 이번 주에 아직 청소를 안 맡은 학생으로 빈칸을 채움(한 주에 한 번씩). rand 는 시험용
export function autoFillCleaning(cleaning, names, rand = Math.random) {
  const c = normalizeCleaning(cleaning);
  const cells = cloneCells(c);
  const used = new Set(c.days.flatMap((_, d) => flatDay(c, d)).filter(Boolean));
  const pool = names.filter((n) => !used.has(n));
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  c.days.forEach((_, d) => {
    const flat = flatDay({ ...c, cells }, d);
    setFlatDay(cells, c, d, flat.map((x) => x || pool.shift() || ''));
  });
  return { ...c, cells };
}

// 청소를 맡은 횟수 { 이름: n } — 빠진 학생·두 번 맡은 학생 확인용
export function cleaningCounts(cleaning) {
  const c = normalizeCleaning(cleaning);
  const n = {};
  for (const z of c.zones) for (const day of c.cells[z.id]) for (const x of day) if (x && x !== '-') n[x] = (n[x] ?? 0) + 1;
  return n;
}

function addDays(date, k) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
}
// 순환 일정 안내: 다음 순환일과 그 뒤 몇 번 (due=오늘이 순환일이거나 지남)
export function rotationPlan(cleaning, today, count = 3) {
  const c = normalizeCleaning(cleaning);
  if (!c.next) return null;
  const upcoming = Array.from({ length: count }, (_, i) => addDays(c.next, i * c.weeks * 7));
  return { next: c.next, due: today >= c.next, upcoming };
}

// 자동 순환: 다음 순환일이 지났으면 지난 횟수만큼 돌리고 다음 순환일을 앞으로. { cleaning, times }
// (앱을 며칠 안 열어도 밀린 만큼 한꺼번에 맞춤. 너무 오래돼도 최대 26번까지만)
export function autoRotate(cleaning, today) {
  let c = normalizeCleaning(cleaning);
  if (!c.auto || !c.next || today < c.next) return { cleaning: c, times: 0 };
  let times = 0;
  while (c.next <= today && times < 26) {
    const at = c.next;
    c = { ...rotateCleaning(c), base: at, next: addDays(at, c.weeks * 7) };
    times += 1;
  }
  return { cleaning: c, times };
}

// 구글 시트에서 [번호, 이름, 역할, 하는 일] 또는 [이름, 역할, 하는 일] 칸을 복사해 붙여넣은 것 읽기 → { 이름: { role, detail } }
export function parseRolesPaste(text, knownNames = []) {
  const known = new Set(knownNames);
  const out = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    let cells = line.split('\t').map((x) => x.trim());
    if (cells.length < 2) cells = line.trim().split(/\s{2,}|,\s*/).map((x) => x.trim());
    if (/^\d+$/.test(cells[0] ?? '')) cells = cells.slice(1); // 번호 칸 빼기
    const [name, role = '', detail = ''] = cells;
    if (!name || name === '이름' || /^(번호|역할)$/.test(name)) continue;
    if (known.size && !known.has(name)) continue; // 명단에 없는 이름(머리글·빈 줄)은 건너뜀
    if (!role && !detail) continue;
    out[name] = { role, detail: detail || role };
  }
  return out;
}

export function normalizeRoles(r) {
  const out = {};
  if (r && typeof r === 'object') {
    for (const [name, v] of Object.entries(r)) {
      if (!name || !v || typeof v !== 'object') continue;
      const role = String(v.role ?? '').trim();
      const detail = String(v.detail ?? '').trim();
      if (role || detail) out[name] = { role, detail };
    }
  }
  return out;
}

// 자리배치표 한 장에 들어갈 내용: 자리(이름+역할), 청소 표(구역마다 칸 수만큼 줄), 1인 1역 목록(번호순)
export function seatSheetModel({ grid, roles, cleaning, roster = [] }) {
  const r = normalizeRoles(roles);
  const seats = (grid ?? []).map((row) => row.map((name) => (name ? { name, role: r[name]?.role ?? '' } : null)));
  const c = normalizeCleaning(cleaning);
  const cleanRows = c.zones.flatMap((z) => Array.from({ length: z.slots }, (_, k) => ({
    zone: z.name, first: k === 0, span: z.slots, cells: c.days.map((__, d) => c.cells[z.id][d][k] || ''),
  })));
  const number = Object.fromEntries(roster.map((s) => [s.name, s.number]));
  const inGrid = new Set(seats.flat().filter(Boolean).map((x) => x.name));
  const names = [...new Set([...roster.filter((s) => s.active !== false).map((s) => s.name), ...inGrid])];
  const roleList = names
    .map((name) => ({ number: number[name] ?? null, name, role: r[name]?.role ?? '', detail: r[name]?.detail ?? '' }))
    .sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.name.localeCompare(b.name, 'ko'));
  return { seats, days: c.days, cleanRows, rules: c.rules.filter((x) => x.title || x.body), footer: c.footer, roleList };
}

// 역할 글자에 어울리는 그림 (꾸민 자리배치표용). 맞는 게 없으면 ⭐
const ROLE_ICONS = [
  [/급식|배식|우유/, '🍴'], [/촬영|사진/, '📷'], [/질서|줄/, '🚶'], [/행사/, '🎉'], [/보조|도우미/, '🙌'],
  [/분리|재활용|수거/, '♻️'], [/보건|건강/, '🩹'], [/칠판|분필|백묵|블랙/, '🧽'], [/명언/, '💬'], [/식단/, '🍱'],
  [/휴대폰|핸드폰/, '📱'], [/안전/, '🛡️'], [/시간표/, '⏰'], [/도서|책/, '📚'], [/출결|출석/, '✅'], [/배움|노트|공책/, '📝'],
  [/게시|알림판/, '📌'], [/기자재|컴퓨터|tv|티비/i, '💻'], [/흡수|물/, '💧'], [/화분|식물|칭찬/, '🌱'], [/창문|환기/, '🪟'],
  [/청소|쓸기|닦기/, '🧹'], [/우편|편지|전달/, '✉️'], [/에너지|전등|불/, '💡'], [/회장|반장/, '👑'],
];
export function roleIcon(role) {
  const r = String(role ?? '');
  if (!r.trim()) return '';
  return ROLE_ICONS.find(([re]) => re.test(r))?.[1] ?? '⭐';
}

// GPT 등 그림 AI에 줄 자리배치표 그림 프롬프트 (지금 배치·역할·청소 표를 글로 넣음)
export function buildImagePrompt({ title, model }) {
  const seatLines = model.seats.map((row, r) => `${r + 1}줄: ${row.map((x) => (x ? `${x.name}(${x.role || '역할 없음'})` : '빈 자리')).join(' | ')}`);
  const clean = model.cleanRows.map((r) => `${r.zone}: ${model.days.map((d, i) => `${d} ${r.cells[i] || '-'}`).join(', ')}`);
  const roles = model.roleList.map((r) => `${r.number ?? ''} ${r.name} - ${r.role || '-'}`.trim());
  return [
    `교실 게시용 "${title}" 포스터를 그려 줘. 가로(16:10), 한 장, 인쇄해서 교실 벽에 붙일 거야.`,
    '',
    '[디자인]',
    '- 밝고 따뜻한 크림·베이지 바탕, 왼쪽 위에 햇살 드는 창문, 오른쪽 위 선반에 책과 초록 화분 일러스트.',
    `- 맨 위 가운데 남색 둥근 리본 배너에 제목 "${title}" (학급 이름은 흰색, '자리배치표'는 주황색 굵은 글씨).`,
    '- 학생 자리는 둥근 모서리 카드: 위 칸에 이름(크고 굵게, 남색), 아래 연한 살구색 띠에 작은 아이콘 + 1인 1역 이름.',
    '- 카드 줄 아래 가운데에 나무 책상 모양 "교탁".',
    '- 왼쪽 아래에 빗자루 아이콘과 함께 "청소·정리 구역" 표: 구역 이름은 살구색 칸, 요일 머리글(월~금)은 남색 칸, 아래에 쓸기·닦기 방법을 체크 표시와 함께.',
    '- 오른쪽에 클립보드 아이콘과 "1인 1역할" 제목이 있는 세로 표(번호 · 이름 · 역할).',
    '- 귀엽고 깔끔한 플랫 일러스트 느낌, 글자는 모두 또렷하게 읽히게. 아래 내용의 이름·글자를 한 글자도 바꾸거나 빼지 말 것.',
    '',
    '[자리 배치] (1줄이 맨 뒤, 마지막 줄이 교탁 쪽. 왼쪽이 복도, 오른쪽이 창문)',
    ...seatLines,
    '',
    '[청소 당번]',
    ...clean,
    ...model.rules.map((r) => `${r.title}: ${r.body.replace(/\n/g, ', ')}`),
    model.footer ? `맨 아래: ${model.footer}` : '',
    '',
    '[1인 1역할 표]',
    ...roles,
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}
