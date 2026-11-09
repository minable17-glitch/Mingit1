import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docsText, periodText, schoolDaysBetween, schoolDaysList, schoolReportRows } from './schoolAttendance.js';

const students = [
  { id: 'a', number: 5, name: '가학생', student_code: '10305' },
  { id: 'b', number: 26, name: '나학생', student_code: null },
];

test('학교 가는 날 세기: 주말·공휴일·학교 쉬는 날 빼기', () => {
  assert.equal(schoolDaysBetween('2026-10-02', '2026-10-06'), 2); // 금, (토·일), 월=대체공휴일? 10/5 대체공휴일 → 10/2, 10/6
  assert.deepEqual(schoolDaysList('2026-10-07', '2026-10-13'), ['2026-10-07', '2026-10-08', '2026-10-12', '2026-10-13']); // 10/9 한글날
  assert.equal(schoolDaysBetween('2026-10-07', '2026-10-08', new Set(['2026-10-08'])), 1);
});

test('이어진 결석은 한 줄, 기간은 실제 결석 일수', () => {
  const rows = schoolReportRows([
    { student_id: 'b', day: '2026-10-08', type: 'absent', reason: 'sick', memo: '복통', docs: '진료확인서' },
    { student_id: 'b', day: '2026-10-12', type: 'absent', reason: 'sick', memo: '복통', docs: null }, // 금(한글날)·주말 건너 이어짐
    { student_id: 'b', day: '2026-10-14', type: 'absent', reason: 'sick', memo: '복통', docs: null }, // 13일 출석 → 끊김
    { student_id: 'a', day: '2026-10-08', type: 'absent', reason: 'approved', memo: '현장체험학습', docs: null },
  ], students);
  assert.deepEqual(rows[0], ['2026.10.08.', '2026.10.08.', '1일간', '', '인정', '결석', '10305', '가학생', '현장체험학습', '체험학습신청서, 보고서']);
  assert.deepEqual(rows[1], ['2026.10.08.', '2026.10.12.', '2일간', '', '질병', '결석', '26', '나학생', '복통', '진료확인서']);
  assert.deepEqual(rows[2], ['2026.10.14.', '2026.10.14.', '1일간', '', '질병', '결석', '26', '나학생', '복통', '']);
});

test('지각·조퇴·결과: 교시, 종료일자·기간 비움, 학부모와연락', () => {
  const rows = schoolReportRows([
    { student_id: 'a', day: '2026-10-06', type: 'early', reason: 'sick', memo: '병원진료', periods: '5' },
    { student_id: 'a', day: '2026-10-07', type: 'late', reason: 'unexcused', memo: '', periods: '조회' },
    { student_id: 'b', day: '2026-10-07', type: 'late', reason: 'sick', memo: '감기', periods: '1' },
    { student_id: 'b', day: '2026-10-08', type: 'result', reason: 'sick', memo: '몸살', periods: '3,4' },
    { student_id: 'zz', day: '2026-10-08', type: 'early', reason: 'sick', memo: '', periods: '' },
  ], students);
  assert.deepEqual(rows[0], ['2026.10.06.', '', '', '5교시~', '질병', '조퇴', '10305', '가학생', '병원진료', '학부모와연락']);
  assert.deepEqual(rows[1], ['2026.10.07.', '', '', '~조회', '미인정', '지각', '10305', '가학생', '', '학부모와연락']);
  assert.equal(rows[2][3], '~1교시');
  assert.equal(rows[3][3], '3,4교시');
  assert.deepEqual(rows[4].slice(3, 8), ['(누락)', '질병', '조퇴', '(누락)', '(누락)']);
  assert.equal(periodText('early', '종례'), '종례~');
  assert.equal(docsText('absent', 'sick', '감기', ''), '');
});

test('이어진 결석: 같은 분류면 사유가 달라도 한 줄(사유 이어 붙임), 서류는 모아서', () => {
  const st = [{ id: 'a', number: 11, name: '학생', student_code: '11' }];
  const ab = (day, memo, docs) => ({ student_id: 'a', day, type: 'absent', reason: 'sick', memo, docs, periods: null });
  // 목·금(빈 사유+진료확인서) → 한 줄 2일간
  let rows = schoolReportRows([ab('2026-10-22', '기저질환', null), ab('2026-10-23', null, '진료확인서')], st);
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[2], r[8], r[9]]), [['2026.10.22.', '2026.10.23.', '2일간', '기저질환', '진료확인서']]);
  // 띄어쓰기만 다르면 같은 사유, 금→월(주말 건너뜀)도 이어짐
  rows = schoolReportRows([ab('2026-10-23', '기저 질환', '진료확인서'), ab('2026-10-26', '기저질환', '진료확인서')], st);
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[2], r[9]]), [['2026.10.23.', '2026.10.26.', '2일간', '진료확인서']]);
  // 사유가 달라도 같은 분류(질병)로 이어지면 한 줄, 사유는 쉼표로 이어 붙임
  rows = schoolReportRows([ab('2026-10-22', '구토 및 어지러움', null), ab('2026-10-23', '병원진료', '진료확인서'), ab('2026-10-26', '병원 진료', null)], st);
  assert.deepEqual(rows.map((r) => [r[0], r[1], r[2], r[8], r[9]]), [['2026.10.22.', '2026.10.26.', '3일간', '구토 및 어지러움, 병원진료', '진료확인서']]);
  // 분류가 다르면(질병 → 미인정) 따로
  rows = schoolReportRows([ab('2026-10-22', '감기', null), { ...ab('2026-10-23', '무단', null), reason: 'unexcused' }], st);
  assert.equal(rows.length, 2);
  // 사이에 조퇴(다른 날 등교)가 있으면 이어지지 않음
  rows = schoolReportRows([ab('2026-10-23', '기저질환', null), { ...ab('2026-10-26', '컨디션난조', null), type: 'early', periods: '2' }, ab('2026-10-27', '기저질환', null)], st);
  assert.deepEqual(rows.filter((r) => r[5] === '결석').map((r) => r[2]), ['1일간', '1일간']);
});
