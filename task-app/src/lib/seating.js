// 🪑 자리 배치 (순수 함수, 테스트 가능) — 선생님이 쓰던 '스마트 자리 배치 프로그램'과 같은 규칙.
// 자리 표: grid[행][열] = 이름 또는 null. 1행이 맨 뒤, 마지막 행이 칠판(교탁) 쪽 = 앞자리.
// 자리 이름은 "c열 r행" (예전 프로그램 백업과 그대로 맞음).

export const DEFAULT_SEATING = {
  rows: 5, cols: 5, fillFront: true, useHistory: false,
  students: '', avoid: '', current: null, secret: null, records: [],
};

export const seatKey = (r, c) => `${c + 1}열 ${r + 1}행`;

// "김민석, 이철수 박영희" → ['김민석','이철수','박영희'] (같은 이름 두 번은 한 번만)
export function parseNames(text) {
  return [...new Set(String(text ?? '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean))];
}

// 한 줄에 한 묶음: "김민석, 이철수" → [['김민석','이철수']] (2명 이상인 줄만)
export function parseAvoid(text) {
  return String(text ?? '').split('\n').map(parseNames).filter((g) => g.length > 1);
}

// 저장 기록들에서 학생마다 어느 자리에 몇 번 앉았는지 { 이름: { "1열 2행": 3 } }
export function seatHistory(records) {
  const h = {};
  for (const rec of Array.isArray(records) ? records : []) {
    (Array.isArray(rec?.grid) ? rec.grid : []).forEach((row, r) => (Array.isArray(row) ? row : []).forEach((name, c) => {
      if (!name || typeof name !== 'string') return;
      h[name] ??= {};
      h[name][seatKey(r, c)] = (h[name][seatKey(r, c)] ?? 0) + 1;
    }));
  }
  return h;
}

const emptyGrid = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(null));

// 자리 배치: 떨어트릴 학생은 앞뒤·옆·대각선(8칸)에 앉지 않게, 앞자리부터(선택), 많이 앉았던 자리 피하기(선택).
// 여러 번(기본 500번) 섞어 보고 처음 성공한 배치를 돌려줌. 실패하면 null. rand 는 시험용.
export function arrangeSeats({ students, rows, cols, avoid = [], fillFront = true, history = null, tries = 500, rand = Math.random }) {
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const enemiesOf = (name) => [...new Set(avoid.filter((g) => g.includes(name)).flat())].filter((x) => x !== name);

  for (let t = 0; t < tries; t += 1) {
    const grid = emptyGrid(rows, cols);
    let ok = true;
    for (const name of shuffle([...students])) {
      const enemies = enemiesOf(name);
      let seats = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (grid[r][c] !== null) continue;
          let near = false;
          for (let dr = -1; dr <= 1 && !near; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (!dr && !dc) continue;
              const v = grid[r + dr]?.[c + dc];
              if (v && enemies.includes(v)) { near = true; break; }
            }
          }
          if (!near) seats.push({ r, c });
        }
      }
      if (!seats.length) { ok = false; break; }
      if (fillFront) {
        const front = Math.max(...seats.map((s) => s.r)); // 칠판에 가장 가까운 빈 줄
        seats = seats.filter((s) => s.r === front);
      }
      if (history) {
        const mine = history[name] ?? {};
        const counted = seats.map((s) => ({ ...s, n: mine[seatKey(s.r, s.c)] ?? 0 }));
        const least = Math.min(...counted.map((s) => s.n));
        seats = counted.filter((s) => s.n === least);
      }
      const seat = seats[Math.floor(rand() * seats.length)];
      grid[seat.r][seat.c] = name;
    }
    if (ok) return grid;
  }
  return null;
}

// 두 자리 맞바꾸기 (새 표를 돌려줌)
export function swapSeats(grid, a, b) {
  const g = grid.map((row) => [...row]);
  [g[a.r][a.c], g[b.r][b.c]] = [g[b.r][b.c], g[a.r][a.c]];
  return g;
}

// 구글 시트 붙여넣기용: 예전 프로그램과 같게 이름 사이 빈 칸 하나, 줄 사이 빈 줄 둘
export function toSheetText(grid) {
  return (grid ?? []).map((row) => (row ?? []).map((n) => n || '').join('\t\t')).join('\n\n\n');
}

// 표 모양이 맞는지 (행·열 수, 칸은 이름 또는 빈칸)
const isGrid = (g) => Array.isArray(g) && g.every((row) => Array.isArray(row) && row.every((v) => v === null || typeof v === 'string'));

// 저장된 값·예전 프로그램 백업(JSON)을 안전하게 읽기. 모르는 값은 기본값으로.
export function normalizeSeating(d) {
  const v = d && typeof d === 'object' ? d : {};
  const num = (x, def) => Math.min(15, Math.max(1, Number.parseInt(x, 10) || def));
  return {
    rows: num(v.rows, DEFAULT_SEATING.rows),
    cols: num(v.cols, DEFAULT_SEATING.cols),
    fillFront: v.fillFront ?? v.fillFrontFirst ?? DEFAULT_SEATING.fillFront,
    useHistory: Boolean(v.useHistory),
    students: String(v.students ?? v.studentInput ?? ''),
    avoid: String(v.avoid ?? v.avoidInput ?? ''),
    current: isGrid(v.current ?? v.currentGrid) ? (v.current ?? v.currentGrid) : null,
    secret: isGrid(v.secret ?? v.secretGrid) ? (v.secret ?? v.secretGrid) : null,
    records: (Array.isArray(v.records ?? v.savedRecords) ? (v.records ?? v.savedRecords) : [])
      .filter((r) => r && isGrid(r.grid))
      .map((r) => ({ id: r.id ?? Date.now() + Math.random(), title: r.title ? String(r.title) : '', date: String(r.date ?? ''), rows: r.rows ?? r.grid.length, cols: r.cols ?? (r.grid[0]?.length ?? 0), grid: r.grid })),
  };
}

// 예전 백업과 같은 모양으로 내보내기(다른 PC·예전 프로그램에서도 열림)
export function toBackup(s) {
  return {
    rows: s.rows, cols: s.cols, fillFrontFirst: s.fillFront, useHistory: s.useHistory,
    studentInput: s.students, avoidInput: s.avoid, currentGrid: s.current, savedRecords: s.records, secretGrid: s.secret,
  };
}
