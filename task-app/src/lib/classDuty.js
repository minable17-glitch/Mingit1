// 1인 1역 · 청소 당번 · 자리배치표 (순수 함수, 테스트 가능). 자리 배치 기록(class_seating.data)에 같이 저장.
// roles:    { 이름: { role: '급식', detail: '급식 담당' } }  — role 은 자리배치표에서 이름 아래 작게
// cleaning: { days, zones: [{ id, name, slots }], cells: { 구역id: [ [요일별 칸 이름...], ... ] }, rules: [{ title, body }], footer, base, weeks }

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
  weeks: 2,
};

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
    base: /^\d{4}-\d{2}-\d{2}$/.test(v.base ?? '') ? v.base : '',
    weeks: clampInt(v.weeks, 1, 8, 2),
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
export function rotateCleaning(cleaning, today = '') {
  const c = normalizeCleaning(cleaning);
  const cells = cloneCells(c);
  c.days.forEach((_, d) => {
    const flat = flatDay(c, d);
    if (flat.length > 1) setFlatDay(cells, c, d, [flat.at(-1), ...flat.slice(0, -1)]);
  });
  return { ...c, cells, base: today || c.base };
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

const addDays = (date, k) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
};
// 다음 순환일: 기준일 + N주. 지났으면 due=true
export function nextRotation(base, weeks, today) {
  if (!base) return null;
  const next = addDays(base, weeks * 7);
  return { next, due: today >= next };
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
