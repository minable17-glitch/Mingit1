import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, sortForBriefing } from './briefing.js';
import { freeSlotNow, kstClock } from './timetable.js';
import { stepsFromTemplate, templateStepsFromTask } from './templates.js';
import { weekStart } from './date.js';

const today = '2026-09-23';
const at = (date) => `${date}T03:00:00Z`;

test('대기 중 업무는 방치가 아니라 무응답으로 판단', () => {
  const task = { last_activity_at: at('2026-09-15'), waiting_on: '교감 결재', waiting_since: at('2026-09-19'), steps: [] };
  const info = assess(task, today, 3, 3);
  assert.equal(info.neglected, false);
  assert.equal(info.noReply, true);
  assert.equal(info.waitDays, 4);
  assert.equal(assess({ ...task, waiting_since: at('2026-09-22') }, today, 3, 3).noReply, false);
});

test('무응답 업무는 마감 임박 다음 순위', () => {
  const tasks = [
    { id: 'plain', last_activity_at: at(today), steps: [] },
    { id: 'wait', last_activity_at: at(today), waiting_on: 'x', waiting_since: at('2026-09-10'), steps: [] },
    { id: 'soon', last_activity_at: at(today), due_date: '2026-09-24', steps: [] },
  ];
  assert.deepEqual(sortForBriefing(tasks, today, 3, 3).map((r) => r.task.id), ['soon', 'wait', 'plain']);
});

test('KST 시계와 공강 판단', () => {
  // 2026-09-23(수) 10:00 KST = 01:00 UTC
  const now = Date.parse('2026-09-23T01:00:00Z');
  assert.deepEqual(kstClock(now), { weekday: 3, minutes: 600 });
  const bell = [{ period: 1, start: '09:00', end: '09:45' }, { period: 2, start: '09:55', end: '10:40' }];
  assert.deepEqual(freeSlotNow(bell, { 3: [1] }, now), { period: 2, minutesLeft: 40 });
  assert.equal(freeSlotNow(bell, { 3: [2] }, now), null); // 수업 있음
  assert.equal(freeSlotNow(bell, {}, Date.parse('2026-09-23T00:47:00Z')), null); // 쉬는 시간
  assert.equal(freeSlotNow(bell, {}, Date.parse('2026-09-26T01:00:00Z')), null); // 토요일
});

test('템플릿 날짜 계산 왕복', () => {
  const task = {
    due_date: '2026-10-10',
    steps: [
      { position: 1, title: '결재', due_date: '2026-10-08' },
      { position: 0, title: '견적', due_date: '2026-10-03' },
    ],
  };
  const steps = templateStepsFromTask(task);
  assert.deepEqual(steps, [{ title: '견적', offset_days: -7 }, { title: '결재', offset_days: -2 }]);
  assert.deepEqual(stepsFromTemplate({ steps }, '2026-11-20').map((s) => s.due_date), ['2026-11-13', '2026-11-18']);
  // 2026-10-20(화) 기준 -10일 = 10/10(토) → 10/9(금), -2일 = 10/18(일) → 10/16(금)
  const weekend = stepsFromTemplate({ steps: [{ title: 'a', offset_days: -10 }, { title: 'b', offset_days: -2 }] }, '2026-10-20');
  assert.deepEqual(weekend.map((s) => s.due_date), ['2026-10-09', '2026-10-16']);
  assert.deepEqual(stepsFromTemplate({ steps }, '').map((s) => s.due_date), ['', '']);
});

test('이번 주 월요일', () => {
  assert.equal(weekStart('2026-09-23'), '2026-09-21');
  assert.equal(weekStart('2026-09-27'), '2026-09-21'); // 일요일
  assert.equal(weekStart('2026-09-21'), '2026-09-21');
});
