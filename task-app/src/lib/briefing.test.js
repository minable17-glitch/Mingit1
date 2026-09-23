import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortForBriefing, assess, nextActionFromSteps, nearestDue } from './briefing.js';
import { todayKST, diffDays, dueLabel } from './date.js';

const today = '2026-09-23';
const at = (date) => `${date}T03:00:00Z`; // KST 12:00

const t = (id, extra) => ({ id, last_activity_at: at(today), steps: [], ...extra });

test('KST 오늘 날짜는 UTC 15시 이후 다음 날로 넘어간다', () => {
  assert.equal(todayKST(Date.parse('2026-09-23T14:59:00Z')), '2026-09-23');
  assert.equal(todayKST(Date.parse('2026-09-23T15:00:00Z')), '2026-09-24');
});

test('diffDays / dueLabel', () => {
  assert.equal(diffDays('2026-09-23', '2026-09-26'), 3);
  assert.equal(dueLabel('2026-09-22', today), '1일 지남');
  assert.equal(dueLabel('2026-09-23', today), '오늘 마감');
  assert.equal(dueLabel('2026-09-30', today), 'D-7');
});

test('방치 판단은 마지막 활동일 기준', () => {
  assert.equal(assess(t('a', { last_activity_at: at('2026-09-20') }), today, 3).neglected, true);
  assert.equal(assess(t('a', { last_activity_at: at('2026-09-21') }), today, 3).neglected, false);
});

test('가장 가까운 마감은 남은 단계 마감까지 본다', () => {
  const task = t('a', {
    due_date: '2026-10-10',
    steps: [
      { due_date: '2026-09-24', done: true },
      { due_date: '2026-09-28', done: false },
    ],
  });
  assert.equal(nearestDue(task), '2026-09-28');
});

test('브리핑 정렬: 지남 → 임박 → 방치 → 나머지', () => {
  const tasks = [
    t('plain', { due_date: '2026-10-30' }),
    t('stale', { last_activity_at: at('2026-09-10') }),
    t('soon', { due_date: '2026-09-25' }),
    t('late', { due_date: '2026-09-20' }),
  ];
  assert.deepEqual(sortForBriefing(tasks, today, 3).map((x) => x.task.id), ['late', 'soon', 'stale', 'plain']);
});

test('다음 행동은 남은 첫 단계', () => {
  const steps = [
    { position: 1, title: '둘', done: false },
    { position: 0, title: '하나', done: true },
  ];
  assert.equal(nextActionFromSteps(steps), '둘');
  assert.equal(nextActionFromSteps([{ position: 0, title: 'x', done: true }]), null);
});
