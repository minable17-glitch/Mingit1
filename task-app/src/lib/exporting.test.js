import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceSummaryTable, attendanceTable, noticesTable, notesTable, plannerTable, toCSV, toTSV } from './exporting.js';

const students = [{ id: 'a', number: 1, name: '김하늘', active: true }, { id: 'b', number: 2, name: '이바다', active: false }];
const records = [
  { student_id: 'b', day: '2026-10-05', type: 'late', reason: 'unexcused', memo: null },
  { student_id: 'a', day: '2026-10-05', type: 'absent', reason: 'sick', memo: '감기' },
  { student_id: 'a', day: '2026-10-07', type: 'absent', reason: 'sick', memo: null },
];

test('출결 표·학생별 합계', () => {
  const t = attendanceTable(records, students);
  assert.deepEqual(t[1], ['2026-10-05', '월', 1, '김하늘', '결석', '질병', '감기']);
  const s = attendanceSummaryTable(records, students);
  assert.deepEqual(s[0], ['번호', '이름', '질병결석', '미인정지각', '합계']);
  assert.deepEqual(s[1], [1, '김하늘', 2, '', 2]);
  assert.deepEqual(s[2], [2, '이바다(전출)', '', 1, 1]);
});

test('전달사항·특이사항·일지 표', () => {
  const n = noticesTable([
    { day: '2026-10-05', kind: 'closing', body: '청소', position: 0, done: false },
    { day: '2026-10-05', kind: 'morning', body: '우유', position: 1, done: true },
    { day: '2026-10-05', kind: 'morning', body: '신청서', position: 0, done: false },
  ]);
  assert.deepEqual(n.slice(1).map((r) => `${r[2]}${r[3]}:${r[4]}${r[5]}`), ['조회1:신청서', '조회2:우유O', '종례1:청소']);
  assert.deepEqual(notesTable([{ student_id: 'a', day: '2026-10-06', body: '칭찬' }], students)[1], ['2026-10-06', '화', 1, '김하늘', '칭찬']);
  const p = plannerTable([{ day: '2026-10-05', memo: '공개수업', periods: [{ a: '', b: '' }, { a: '2-3', b: '국어' }], reflection: '' }],
    [{ day: '2026-10-05', kind: 'morning', body: '신청서', position: 0 }], [{ day: '2026-10-05', title: '복사', done: true }], ['2026-10-05', '2026-10-06']);
  assert.equal(p.length, 2); // 빈 날은 빼고
  assert.equal(p[1][3], '1. 신청서');
  assert.equal(p[1][5], '2-3 · 국어');
  assert.equal(p[1][13], '☑ 복사');
});

test('시트 붙여넣기용·CSV', () => {
  assert.equal(toTSV([['a', 'b\nc'], [1, '']]), 'a\t"b\nc"\n1\t');
  assert.equal(toCSV([['이름', '메모'], ['김', '가, 나']]), '이름,메모\r\n김,"가, 나"');
});
