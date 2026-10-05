import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvents, monthGrid, shiftMonth } from './calendar.js';

test('달력 칸: 2026년 10월은 목요일 시작, 일요일부터 5주', () => {
  const g = monthGrid(2026, 10);
  assert.equal(g.length, 5);
  assert.equal(g[0][0].date, '2026-09-27');
  assert.equal(g[0][4].date, '2026-10-01');
  assert.equal(g[0][0].inMonth, false);
  assert.equal(g.at(-1).at(-1).date, '2026-10-31');
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
});

test('마감 모으기: 전체·분류·업무 하나', () => {
  const cats = [{ id: 'c0', color: '#f00' }, { id: 'c1', color: '#00f' }];
  const tasks = [
    { id: 'a', title: '평가계획', category_id: 'c0', due_date: '2026-10-10', steps: [
      { id: 's1', title: '초안', due_date: '2026-10-03', done: false, position: 0 },
      { id: 's2', title: '검토', due_date: '2026-10-06', done: true, position: 1 },
      { id: 's3', title: '제출', due_date: '2026-10-10', done: false, position: 2 },
    ] },
    { id: 'b', title: '출장 보고', category_id: 'c1', due_date: '2026-10-10', steps: [] },
  ];
  const reminders = [{ id: 'r', task_id: 'a', title: '행정실', remind_at: '2026-10-07T03:00:00.000Z' }];
  const all = calendarEvents(tasks, cats, { kind: 'all' }, reminders, '2026-10-05');
  assert.deepEqual(all['2026-10-10'].map((e) => e.key), ['t:a', 't:b', 's:s3']);
  assert.equal(all['2026-10-06'], undefined); // 끝낸 단계는 전체 보기에서 뺌
  assert.equal(all['2026-10-03'][0].overdue, true);
  assert.equal(all['2026-10-07'][0].sub, '12:00');
  const cat = calendarEvents(tasks, cats, { kind: 'category', id: 'c1' }, reminders);
  assert.deepEqual(Object.keys(cat), ['2026-10-10']);
  const one = calendarEvents(tasks, cats, { kind: 'task', id: 'a' }, reminders);
  assert.equal(one['2026-10-06'][0].done, true); // 업무 하나만 볼 때는 끝낸 단계도
});
