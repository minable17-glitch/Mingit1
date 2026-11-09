import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangeSeats, normalizeSeating, parseAvoid, parseNames, seatHistory, swapSeats, toBackup, toSheetText } from './seating.js';

// 매번 같은 결과가 나오는 가짜 난수
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const names = Array.from({ length: 20 }, (_, i) => `학생${i + 1}`);
const cells = (g) => g.flat().filter(Boolean);
const posOf = (g, n) => { for (let r = 0; r < g.length; r += 1) for (let c = 0; c < g[r].length; c += 1) if (g[r][c] === n) return { r, c }; return null; };

test('명단·떨어트릴 학생 읽기', () => {
  assert.deepEqual(parseNames('가, 나  다\n가'), ['가', '나', '다']);
  assert.deepEqual(parseAvoid('가, 나\n다\n라 마 바'), [['가', '나'], ['라', '마', '바']]);
});

test('모두 한 번씩 앉고, 앞자리부터 채움', () => {
  const g = arrangeSeats({ students: names, rows: 5, cols: 5, rand: seeded(7) });
  assert.equal(cells(g).length, 20);
  assert.deepEqual([...cells(g)].sort(), [...names].sort());
  assert.deepEqual(g[0], [null, null, null, null, null]); // 25자리에 20명 → 맨 뒤(1행)가 비어 있음
});

test('떨어트릴 학생은 8방향으로 붙지 않음', () => {
  const avoid = [['학생1', '학생2'], ['학생3', '학생4', '학생5']];
  for (let s = 1; s <= 30; s += 1) {
    const g = arrangeSeats({ students: names, rows: 5, cols: 5, avoid, rand: seeded(s) });
    for (const group of avoid) {
      for (const a of group) for (const b of group) {
        if (a === b) continue;
        const p = posOf(g, a); const q = posOf(g, b);
        assert.ok(Math.max(Math.abs(p.r - q.r), Math.abs(p.c - q.c)) > 1, `${a}-${b} 붙음 (seed ${s})`);
      }
    }
  }
});

test('불가능한 조건이면 null, 자리보다 학생이 많으면 앉힐 수 없음', () => {
  // 1×2 자리에 서로 떨어져야 하는 두 명 → 불가능
  assert.equal(arrangeSeats({ students: ['가', '나'], rows: 1, cols: 2, avoid: [['가', '나']], tries: 20 }), null);
});

test('과거 기록 반영: 앉았던 자리를 피함', () => {
  const history = { 가: { '1열 1행': 3 } };
  for (let s = 1; s <= 10; s += 1) {
    const g = arrangeSeats({ students: ['가'], rows: 1, cols: 2, fillFront: false, history, rand: seeded(s) });
    assert.deepEqual(g, [[null, '가']]);
  }
});

test('기록 통계·자리 바꾸기·시트 복사', () => {
  const records = [{ grid: [['가', '나'], [null, '다']] }, { grid: [['가', null], ['나', '다']] }];
  assert.deepEqual(seatHistory(records), { 가: { '1열 1행': 2 }, 나: { '2열 1행': 1, '1열 2행': 1 }, 다: { '2열 2행': 2 } });
  assert.deepEqual(swapSeats([['가', '나'], [null, '다']], { r: 0, c: 0 }, { r: 1, c: 0 }), [[null, '나'], ['가', '다']]);
  assert.equal(toSheetText([['가', null], ['나', '다']]), '가\t\t\n\n\n나\t\t다');
});

test('예전 프로그램 백업(JSON) 읽기·내보내기', () => {
  const old = { rows: '4', cols: 6, fillFrontFirst: false, useHistory: true, studentInput: '가, 나', avoidInput: '가, 나', currentGrid: [['가', null]], secretGrid: 'x', savedRecords: [{ id: 1, date: '10월 1일', grid: [['가']], rows: 1, cols: 1 }, { id: 2, grid: 'bad' }] };
  const s = normalizeSeating(old);
  assert.equal(s.rows, 4); assert.equal(s.fillFront, false); assert.equal(s.students, '가, 나');
  assert.deepEqual(s.current, [['가', null]]); assert.equal(s.secret, null); assert.equal(s.records.length, 1);
  assert.equal(normalizeSeating({ rows: 99 }).rows, 15);
  assert.deepEqual(normalizeSeating(toBackup(s)), s);
});
