import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoPlan, buildToday, loadSince, moveItem, scopeRange } from './today.js';

const today = '2026-10-04';
const tasks = [
  { id: 'a', title: '평가계획', due_date: '2026-10-04', steps: [{ id: 's1', title: '초안', position: 0, done: false, due_date: '2026-10-03' }, { id: 's2', title: '제출', position: 1, done: false, due_date: '2026-10-04' }] },
  { id: 'b', title: '출장 보고', due_date: '2026-10-01', steps: [] },
  { id: 'c', title: '상담 준비', due_date: '2026-10-20', steps: [{ id: 's3', title: '안내문', position: 0, done: true, due_date: '2026-10-02' }] },
];
const reminders = [
  { id: 'r1', title: '행정실', remind_at: '2026-10-04T03:20:00.000Z' }, // 오늘 12:20
  { id: 'r2', title: '내일', remind_at: '2026-10-05T00:00:00.000Z' },
];
const items = [
  { id: 'i1', day: today, title: '교무수첩 정리', position: 1, done: false },
  { id: 'i2', day: today, title: '복사', position: 0, done: true },
  { id: 'i3', day: today, title: '전화', position: 2, done: false },
  { id: 'i4', day: '2026-10-03', title: '어제 못 한 일', position: 0, done: false },
  { id: 'i5', day: '2026-10-03', title: '어제 한 일', position: 1, done: true },
];

test('오늘 할 일 묶기', () => {
  const t = buildToday(tasks, reminders, items, today);
  assert.deepEqual(t.due.map((d) => d.key), ['t:b', 's:s1', 's:s2']); // 지난 것부터, 끝낸 단계·먼 마감 제외, 같은 날 단계가 있으면 업무는 빼고
  assert.equal(t.due[0].overdue, true);
  assert.deepEqual(t.reminders.map((r) => r.id), ['r1']);
  assert.deepEqual(t.mine.map((i) => i.id), ['i1', 'i3', 'i2']); // 안 한 것 위, 끝낸 것 아래
  assert.deepEqual(t.carry.map((i) => i.id), ['i4']);
  assert.equal(t.doneCount, 1);
});

test('순서 바꾸기', () => {
  const { mine } = buildToday([], [], items, today);
  assert.deepEqual(moveItem(mine, 'i3', -1), [{ id: 'i3', position: 0 }, { id: 'i1', position: 1 }]);
  assert.deepEqual(moveItem(mine, 'i1', -1), []); // 맨 위
});

test('주간·월간 목록과 기간 마감', () => {
  const all = [
    ...items,
    { id: 'w1', scope: 'week', day: '2026-09-28', title: '주간 회의 준비', position: 0, done: false },
    { id: 'w0', scope: 'week', day: '2026-09-21', title: '지난주 못 한 일', position: 0, done: false },
    { id: 'm1', scope: 'month', day: '2026-10-01', title: '월말 통계', position: 0, done: false },
    { id: 'wd', scope: 'week', day: today, title: '오늘 목록에 섞이면 안 됨', position: 9, done: false },
  ];
  assert.ok(!buildToday(tasks, reminders, all, today).mine.some((i) => i.id === 'wd'));
  const w = buildToday(tasks, reminders, all, today, 'week'); // 10/4(일) → 9/28~10/4
  assert.deepEqual(w.mine.map((i) => i.id), ['w1']);
  assert.deepEqual(w.carry.map((i) => i.id), ['w0']);
  assert.deepEqual(w.due.map((d) => d.key), ['t:b', 's:s1', 's:s2']);
  const m = buildToday(tasks, reminders, all, today, 'month');
  assert.deepEqual(m.mine.map((i) => i.id), ['m1']);
  assert.deepEqual(m.due.map((d) => d.key), ['t:b', 's:s1', 's:s2', 't:c']); // 10/20 마감도 이번 달
  assert.deepEqual(m.reminders.map((r) => r.id), ['r1', 'r2']);
  assert.deepEqual(scopeRange('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28', key: '2026-02-01' });
  assert.equal(loadSince('2026-01-15'), '2025-12-01');
});

test('남은 공강에 차례로 넣기', () => {
  const mine = [
    { id: 'a', done: false, period: null }, { id: 'b', done: false, period: 3 },
    { id: 'c', done: true, period: null }, { id: 'd', done: false, period: null }, { id: 'e', done: false },
  ];
  const free = [{ period: 2, past: true }, { period: 3 }, { period: 5 }, { period: 6 }];
  assert.deepEqual(autoPlan(mine, free), [{ id: 'a', period: 5 }, { id: 'd', period: 6 }]);
});
