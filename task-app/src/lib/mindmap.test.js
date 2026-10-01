import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, layoutTree } from './mindmap.js';
import { groupThoughts, principleOfDay, titleFromThought } from './thoughts.js';

const cats = [{ id: 'c0', name: '담임', color: '#f59e0b' }, { id: 'c1', name: '수업', color: '#4f7cff' }, { id: 'c2', name: '빈 분류' }];
const tasks = [
  { id: 'a', title: '상담 주간 준비', category_id: 'c0', steps: [{ id: 's1', title: '안내문', position: 0, done: true }, { id: 's2', title: '일정표', position: 1, done: false }] },
  { id: 'b', title: '출결 정리', category_id: 'c0', steps: [] },
  { id: 'c', title: '평가계획', category_id: 'c1', steps: [] },
];
const thoughts = [
  { id: 'p1', body: '요청은 바로 메모', kind: 'principle', pinned: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 't1', body: '회의 줄이기', kind: 'thought', pinned: false, created_at: '2026-10-01T01:00:00Z' },
];

test('나무 만들기: 업무 없는 분류는 빼고, 원칙 묶음 추가', () => {
  const root = buildTree(tasks, cats, thoughts);
  assert.deepEqual(root.children.map((c) => c.label), ['담임', '수업', '📌 나의 원칙']);
  assert.equal(root.children[0].children[0].children[0].label, '☑ 안내문');
});

test('배치: 단계는 펼친 업무만, 접은 분류는 숨김, 부모는 자식 가운데', () => {
  const root = buildTree(tasks, cats, thoughts);
  const closedAll = layoutTree(root);
  assert.equal(closedAll.nodes.filter((n) => n.kind === 'step').length, 0);
  const opened = layoutTree(root, { open: new Set(['t:a']) });
  assert.equal(opened.nodes.filter((n) => n.kind === 'step').length, 2);
  const cat = opened.nodes.find((n) => n.id === 'c:c0');
  const kids = opened.nodes.filter((n) => n.kind === 'task' && ['t:a', 't:b'].includes(n.id));
  assert.equal(cat.y, (kids[0].y + kids[1].y) / 2);
  assert.ok(kids[0].x > cat.x + cat.w);
  const closed = layoutTree(root, { closed: new Set(['c:c0']) });
  assert.equal(closed.nodes.some((n) => n.id === 't:a'), false);
  assert.ok(closed.height < closedAll.height);
});

test('생각 노트 묶기·오늘의 원칙·업무 이름', () => {
  const g = groupThoughts(thoughts, {}, '2026-10-01');
  assert.deepEqual(g.map((x) => x.label), ['오늘', '9월 1일']);
  assert.equal(groupThoughts(thoughts, { query: '회의' }, '2026-10-01')[0].items.length, 1);
  assert.equal(principleOfDay(thoughts, '2026-10-01').id, 'p1');
  assert.equal(principleOfDay([], '2026-10-01'), null);
  assert.equal(titleFromThought('- 학부모 안내문 템플릿 만들기\n자세히'), '학부모 안내문 템플릿 만들기');
});
