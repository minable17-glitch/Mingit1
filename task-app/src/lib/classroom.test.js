import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySummary, monthSummary, monthSummaryText, noticesText, parseRoster } from './classroom.js';

test('구글 시트에서 복사한 명렬표 읽기', () => {
  assert.deepEqual(parseRoster('번호\t이름\n1\t김하늘\n2\t이바다\n3\t박구름'), [
    { number: 1, name: '김하늘' }, { number: 2, name: '이바다' }, { number: 3, name: '박구름' },
  ]);
  assert.deepEqual(parseRoster('학번,성명,성별\n10201,최별,여\n10202,정달,남'), [{ number: 1, name: '최별' }, { number: 2, name: '정달' }]);
  assert.deepEqual(parseRoster('김하늘\n이바다'), [{ number: 1, name: '김하늘' }, { number: 2, name: '이바다' }]);
  assert.deepEqual(parseRoster('1 김하늘\n2 이바다\n'), [{ number: 1, name: '김하늘' }, { number: 2, name: '이바다' }]);
});

const students = [{ id: 'a', number: 1, name: '김하늘', active: true }, { id: 'b', number: 2, name: '이바다', active: true }, { id: 'c', number: 3, name: '전출생', active: false }];
const records = [
  { student_id: 'a', day: '2026-10-05', type: 'absent', reason: 'sick', memo: '감기' },
  { student_id: 'b', day: '2026-10-05', type: 'late', reason: 'unexcused', memo: null },
  { student_id: 'b', day: '2026-10-07', type: 'early', reason: 'sick', memo: null },
  { student_id: 'a', day: '2026-09-30', type: 'absent', reason: 'etc', memo: null },
];

test('출결 요약', () => {
  assert.deepEqual(daySummary(students, records, '2026-10-05'), { enrolled: 2, absent: 1, late: 1, early: 0, result: 0 });
  const m = monthSummary(students, records, '2026-10');
  assert.equal(m.length, 2);
  assert.equal(m[1].counts['early:sick'], 1);
  assert.equal(monthSummaryText(m, '2026-10'), '2026년 10월 출결\n1번 김하늘: 5일 질병결석(감기)\n2번 이바다: 5일 미인정지각, 7일 질병조퇴');
  assert.equal(monthSummaryText([], '2026-11'), '2026년 11월 출결: 특이 없음');
});

test('전달사항 글', () => {
  const n = [
    { kind: 'morning', day: '2026-10-05', body: '체험학습 신청서 제출', position: 1 },
    { kind: 'morning', day: '2026-10-05', body: '우유 급식 신청', position: 0 },
    { kind: 'closing', day: '2026-10-05', body: '청소 당번', position: 0 },
  ];
  assert.equal(noticesText(n, 'morning', '2026-10-05'), '10/5 조회 전달사항\n1. 우유 급식 신청\n2. 체험학습 신청서 제출');
});
