import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBalance } from './balance.js';
import { buddyOf, moodCounts } from './buddies.js';

const today = '2026-09-30';
const settings = { neglect_days: 3, waiting_days: 3 };
const cats = [{ id: 'c0', name: '담임' }];
const ago = (d) => new Date(Date.parse('2026-09-30T03:00:00Z') - d * 864e5).toISOString();
const t = (id, patch) => ({ id, title: id, category_id: 'c0', due_date: null, last_activity_at: ago(0), steps: [], ...patch });

const buddies = (tasks) => analyzeBalance(tasks, cats, settings, [], today).points.map((p) => ({ id: p.task.id, ...buddyOf(p, settings.neglect_days) }));

test('챙길수록 크고, 오래 안 챙기면 작아지고 졸음', () => {
  const [fresh, old, older] = buddies([t('a', {}), t('b', { last_activity_at: ago(4) }), t('c', { last_activity_at: ago(20) })]);
  assert.equal(fresh.mood, 'happy');
  assert.equal(old.mood, 'sleepy');
  assert.ok(fresh.size > old.size && old.size > older.size);
  assert.equal(older.size, 0.55);
  assert.match(old.message, /4일째 못 챙겨서/);
});

test('급하면 땀, 지나면 비상, 기다리면 기다림 / 상자 = 남은 단계', () => {
  const steps = [{ done: true }, { done: false }, { done: false }];
  const [soon, over, wait] = buddies([
    t('a', { due_date: '2026-10-01', steps }),
    t('b', { due_date: '2026-09-28' }),
    t('c', { waiting_on: '행정실', waiting_since: ago(5), last_activity_at: ago(5) }),
  ]);
  assert.equal(soon.mood, 'worried');
  assert.equal(soon.boxes, 2);
  assert.equal(over.mood, 'panic');
  assert.equal(over.boxes, 0);
  assert.equal(wait.mood, 'waiting');
  assert.deepEqual(moodCounts([soon, over, wait]), { happy: 0, calm: 0, sleepy: 0, waiting: 1, worried: 1, panic: 1 });
});
