import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoToLocal, localToISO, parseRemindTime, remindLabel } from './remindTime.js';

// 2026-10-01(목) 오전 9:00 (한국 시간)
const NOW = Date.parse('2026-10-01T09:00:00+09:00');
const bell = [
  { period: 1, start: '09:00', end: '09:45' }, { period: 2, start: '09:55', end: '10:40' },
  { period: 3, start: '10:50', end: '11:35' }, { period: 4, start: '11:45', end: '12:30' },
  { period: 5, start: '13:30', end: '14:15' }, { period: 6, start: '14:25', end: '15:10' },
];
const at = (text, b = bell, now = NOW) => parseRemindTime(text, now, b)?.at;

test('점심·밥 → 시정표의 점심 시작 10분 전', () => {
  assert.equal(at('행정실에서 등록부 사인 후 밥먹기'), '2026-10-01T12:20');
  assert.equal(at('점심 먹고 사인', []), '2026-10-01T12:00'); // 시정표 없으면 12:10 기준
});

test('시각 표현', () => {
  assert.equal(at('3시에 행정실'), '2026-10-01T15:00'); // 학교 시간: 3시 = 오후
  assert.equal(at('오전 10시 반 회의'), '2026-10-01T10:30');
  assert.equal(at('오후 2시 15분 상담'), '2026-10-01T14:15');
  assert.equal(at('14:40 회의'), '2026-10-01T14:40');
  assert.equal(at('5교시 전 교실 정리'), '2026-10-01T13:25');
  assert.equal(at('6교시 끝나고 회의'), '2026-10-01T15:10');
  assert.equal(at('퇴근 전에 출장 신청'), '2026-10-01T15:10');
});

test('날짜 표현과 지난 시간', () => {
  assert.equal(at('내일 아침 출결 확인'), '2026-10-02T08:30');
  assert.equal(at('10월 5일 3시 회의'), '2026-10-05T15:00');
  assert.equal(at('금요일 4시 동아리'), '2026-10-02T16:00');
  const r = parseRemindTime('8시 반 조회', NOW, bell); // 이미 지남 → 내일
  assert.equal(r.at, '2026-10-02T08:30');
  assert.equal(r.tomorrow, true);
});

test('시간 표현이 없으면 null', () => {
  assert.equal(parseRemindTime('운영비 영수증 정리', NOW, bell), null);
});

test('변환과 표시', () => {
  assert.equal(localToISO('2026-10-01T12:20'), '2026-10-01T03:20:00.000Z');
  assert.equal(isoToLocal('2026-10-01T03:20:00.000Z'), '2026-10-01T12:20');
  assert.equal(remindLabel('2026-10-01T03:20:00.000Z', NOW), '오늘 12:20');
  assert.equal(remindLabel('2026-10-01T23:30:00.000Z', NOW), '내일 08:30');
  assert.equal(remindLabel('2026-10-05T06:00:00.000Z', NOW), '10/5(월) 15:00');
});
