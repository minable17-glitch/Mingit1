import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBalance, quadrantOf, taskLoad, urgencyOf } from './balance.js';

const today = '2026-09-30';
const settings = { neglect_days: 3, waiting_days: 3 };
const cats = [{ id: 'c0', name: '담임' }, { id: 'c1', name: '수업' }, { id: 'c2', name: '행정업무' }];
const fresh = '2026-09-30T01:00:00Z';
const old = '2026-09-20T01:00:00Z';
const steps = (n, done = 0) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: `단계${i}`, done: i < done, due_date: null }));

test('업무량 = 남은 단계 수, 단계 없으면 1(미정)', () => {
  assert.deepEqual(taskLoad({ steps: [] }), { load: 1, unknownSize: true });
  assert.deepEqual(taskLoad({ steps: steps(5, 2) }), { load: 3, unknownSize: false });
});

test('급한 정도: 지남 > 오늘 > 1주 > 마감 없음', () => {
  const u = (daysLeft) => urgencyOf({ daysLeft });
  assert.ok(u(-1) > u(0) && u(0) > u(7) && u(7) > u(null));
});

test('잘 챙기면 균형, 오래 안 챙기면 점수가 내려가고 저울이 기움', () => {
  const good = [
    { id: 'a', title: 'A', category_id: 'c0', due_date: '2026-10-20', last_activity_at: fresh, steps: steps(2) },
    { id: 'b', title: 'B', category_id: 'c1', due_date: null, last_activity_at: fresh, steps: [] },
  ];
  const g = analyzeBalance(good, cats, settings, [], today);
  assert.equal(g.score, 100);
  assert.equal(g.scale.tilt, 0);
  assert.equal(g.notes.length, 0);

  const bad = [
    ...good,
    { id: 'c', title: '출장 결과 보고', category_id: 'c2', due_date: null, last_activity_at: old, steps: steps(3) },
    { id: 'd', title: '예산 정산', category_id: 'c2', due_date: '2026-09-29', last_activity_at: old, steps: steps(5) },
  ];
  const r = analyzeBalance(bad, cats, settings, [], today);
  assert.ok(r.score < 60, `score ${r.score}`);
  assert.ok(r.scale.tilt > 0);
  assert.equal(r.scale.behind, 2);
  assert.equal(r.counts.forgotten, 2);
  assert.equal(r.counts.heavy, 1);
  assert.match(r.notes[0].text, /행정업무.*2개/);
  assert.ok(r.notes.some((n) => n.kind === 'heavy' && n.text.includes('예산 정산')));
  const admin = r.byCategory.find((x) => x.category.id === 'c2');
  assert.equal(admin.total, 8);
  assert.equal(admin.load.critical, 5); // 마감 지남 → 위험
  assert.equal(admin.load.warning, 3); // 못 챙김 → 주의
});

test('업무 지도 네 칸', () => {
  const r = analyzeBalance([
    { id: 'a', title: 'A', category_id: 'c0', due_date: '2026-10-01', last_activity_at: fresh, steps: steps(6) },
    { id: 'b', title: 'B', category_id: 'c0', due_date: '2026-10-01', last_activity_at: fresh, steps: [] },
    { id: 'c', title: 'C', category_id: 'c0', due_date: '2026-11-01', last_activity_at: fresh, steps: steps(6) },
    { id: 'd', title: 'D', category_id: 'c0', due_date: null, last_activity_at: fresh, steps: [] },
  ], cats, settings, [], today);
  assert.deepEqual(r.points.map(quadrantOf), ['focus', 'quick', 'split', 'later']);
});

test('2주 마감 몰림', () => {
  const t = (id, due) => ({ id, title: id, category_id: 'c0', due_date: due, last_activity_at: fresh, steps: [] });
  const r = analyzeBalance([t('a', '2026-10-08'), t('b', '2026-10-08'), t('c', '2026-10-08'), t('d', '2026-09-28')], cats, settings, [], today);
  assert.equal(r.days.length, 14);
  assert.equal(r.days.find((d) => d.date === '2026-10-08').count, 3);
  assert.equal(r.overdueItems, 1);
  assert.ok(r.notes.some((n) => n.kind === 'peak' && n.text.startsWith('10/8(목)')));
});
