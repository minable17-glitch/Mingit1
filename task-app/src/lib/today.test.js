import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildToday, moveItem } from './today.js';

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
