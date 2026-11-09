import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFillCleaning, cleaningCounts, nextRotation, normalizeCleaning, parseRolesPaste, rotateCleaning, seatSheetModel } from './classDuty.js';

const seeded = (seed = 3) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const small = { days: ['월', '화'], zones: [{ id: 'a', name: '쓸기', slots: 2 }, { id: 'b', name: '닦기', slots: 1 }], cells: { a: [['가', '나'], ['라', '']], b: [['다'], ['마']] } };

test('청소 표 모양 맞추기: 칸 수가 늘고 줄어도', () => {
  const c = normalizeCleaning({ ...small, zones: [{ id: 'a', name: '쓸기', slots: 3 }, { id: 'b', name: '닦기', slots: 1 }] });
  assert.deepEqual(c.cells.a, [['가', '나', ''], ['라', '', '']]);
  assert.deepEqual(normalizeCleaning({ ...small, zones: [{ id: 'a', name: '쓸기', slots: 1 }] }).cells, { a: [['가'], ['라']] });
  assert.equal(normalizeCleaning(null).zones.length, 4); // 기본 구역
});

test('순환: 요일마다 위에서 아래로 한 칸, 맨 아래는 맨 위로', () => {
  const r = rotateCleaning(small, '2026-11-09');
  assert.deepEqual(r.cells.a, [['다', '가'], ['마', '라']]);
  assert.deepEqual(r.cells.b, [['나'], ['']]);
  assert.equal(r.base, '2026-11-09');
});

test('빈칸 자동 채우기: 이미 맡은 학생은 빼고 한 주 한 번씩', () => {
  const f = autoFillCleaning(small, ['가', '나', '다', '라', '마', '바', '사'], seeded());
  const counts = cleaningCounts(f);
  assert.equal(Object.values(counts).every((n) => n === 1), true);
  assert.ok(['바', '사'].includes(f.cells.a[1][1]));
});

test('다음 순환일', () => {
  assert.deepEqual(nextRotation('2026-08-17', 2, '2026-08-20'), { next: '2026-08-31', due: false });
  assert.deepEqual(nextRotation('2026-08-17', 2, '2026-08-31'), { next: '2026-08-31', due: true });
  assert.equal(nextRotation('', 2, '2026-08-31'), null);
});

test('1인 1역 붙여넣기: 번호 칸·머리글은 건너뜀', () => {
  const text = '번호\t이름\t\t1인 1역할\n1\t가\t질서 지도\t질서도우미\n2\t나\t급식\t\n\t\t\t\n3\t없는학생\t급식\t급식 담당';
  assert.deepEqual(parseRolesPaste(text, ['가', '나']), { 가: { role: '질서 지도', detail: '질서도우미' }, 나: { role: '급식', detail: '급식' } });
});

test('자리배치표 내용: 이름 아래 역할, 청소 줄, 번호순 역할 목록', () => {
  const m = seatSheetModel({
    grid: [[null, '나'], ['가', null]],
    roles: { 가: { role: '급식', detail: '급식 담당' } },
    cleaning: small,
    roster: [{ name: '나', number: 2 }, { name: '가', number: 1 }],
  });
  assert.deepEqual(m.seats, [[null, { name: '나', role: '' }], [{ name: '가', role: '급식' }, null]]);
  assert.deepEqual(m.cleanRows.map((r) => [r.zone, r.first, r.span, r.cells]), [['쓸기', true, 2, ['가', '라']], ['쓸기', false, 2, ['나', '']], ['닦기', true, 1, ['다', '마']]]);
  assert.deepEqual(m.roleList.map((r) => [r.number, r.name, r.role]), [[1, '가', '급식'], [2, '나', '']]);
});
