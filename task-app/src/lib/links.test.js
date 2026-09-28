import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockersOf, blockerDelayed, wouldCycle } from './links.js';

const today = '2026-09-28';
const at = (d) => `${d}T03:00:00Z`;
const tasks = {
  a: { id: 'a', status: 'active', due_date: '2026-09-25', last_activity_at: at(today), steps: [] },
  b: { id: 'b', status: 'active', due_date: '2026-10-10', last_activity_at: at(today), steps: [] },
  c: { id: 'c', status: 'done', last_activity_at: at(today), steps: [] },
};
const links = [
  { from_task_id: 'a', to_task_id: 'b' },
  { from_task_id: 'c', to_task_id: 'b' },
];

test('앞 업무 중 끝나지 않은 것만', () => {
  assert.deepEqual(blockersOf('b', links, tasks).map((t) => t.id), ['a']);
  assert.deepEqual(blockersOf('a', links, tasks), []);
});

test('앞 업무가 마감을 넘기면 뒤 업무 위험', () => {
  assert.equal(blockerDelayed('b', links, tasks, today, { neglect_days: 3, waiting_days: 3 }), true);
  assert.equal(blockerDelayed('a', links, tasks, today, { neglect_days: 3, waiting_days: 3 }), false);
});

test('고리 방지', () => {
  assert.equal(wouldCycle('b', 'a', links), true); // a→b 가 있으니 b→a 는 고리
  assert.equal(wouldCycle('a', 'c', links), false);
  assert.equal(wouldCycle('a', 'a', links), true);
});
