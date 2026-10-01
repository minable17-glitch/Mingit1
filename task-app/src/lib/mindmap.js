// 마인드맵 배치: 나의 업무 → 분류 → 업무 → 단계 (+ 나의 원칙). 왼쪽에서 오른쪽으로 뻗는 나무 모양.
// 순수 함수: 접힘 상태를 받아 보이는 노드의 위치와 연결선을 계산.

const CJK = /[ㄱ-힝一-鿿]/;
export function textWidth(s, size = 13) {
  let w = 0;
  for (const ch of s) w += CJK.test(ch) ? size * 1.02 : size * 0.6;
  return Math.ceil(w);
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const PAD = { root: 34, category: 28, task: 46, step: 22, group: 28, principle: 20 };
const FONT = { root: 15, category: 14, task: 13, step: 12, group: 13, principle: 12 };
const ROW = { category: 40, task: 40, step: 28, group: 40, principle: 28, root: 44 };
const GAP_X = 34;

// tasks: steps 포함. thoughts: 생각 노트 (원칙만 씀)
export function buildTree(tasks, categories, thoughts = []) {
  const root = { id: 'root', kind: 'root', label: '나의 업무', children: [] };
  for (const c of categories) {
    const mine = tasks.filter((t) => t.category_id === c.id);
    if (!mine.length) continue;
    root.children.push({
      id: `c:${c.id}`, kind: 'category', label: clip(c.name, 10), color: c.color,
      children: mine.map((t) => ({
        id: `t:${t.id}`, kind: 'task', label: clip(t.title, 16), fullLabel: t.title, taskId: t.id, color: c.color,
        children: [...(t.steps ?? [])].sort((a, b) => a.position - b.position).map((s) => ({
          id: `s:${s.id}`, kind: 'step', label: `${s.done ? '☑' : '☐'} ${clip(s.title, 18)}`, fullLabel: s.title, done: s.done, color: c.color, children: [],
        })),
      })),
    });
  }
  const principles = thoughts.filter((t) => t.kind === 'principle' || t.pinned);
  if (principles.length) {
    root.children.push({
      id: 'g:principles', kind: 'group', label: '📌 나의 원칙', color: '#e8b400',
      children: principles.map((p) => ({ id: `p:${p.id}`, kind: 'principle', label: clip(p.body.split('\n')[0], 20), fullLabel: p.body, color: '#e8b400', children: [] })),
    });
  }
  return root;
}

// open: 펼친 업무 id 집합(단계 보이기), closed: 접은 분류·묶음 id 집합
export function layoutTree(root, { open = new Set(), closed = new Set() } = {}) {
  const nodes = [];
  const edges = [];
  const visibleKids = (n) => {
    if (n.kind === 'task') return open.has(n.id) ? n.children : [];
    if (n.kind === 'category' || n.kind === 'group') return closed.has(n.id) ? [] : n.children;
    return n.children;
  };
  // 깊이별 가장 넓은 노드 → 열 위치
  const widthAt = [];
  const measure = (n, d) => {
    n.w = textWidth(n.label, FONT[n.kind]) + PAD[n.kind];
    n.h = n.kind === 'root' ? 40 : n.kind === 'step' || n.kind === 'principle' ? 24 : 32;
    widthAt[d] = Math.max(widthAt[d] ?? 0, n.w);
    for (const k of visibleKids(n)) measure(k, d + 1);
  };
  measure(root, 0);
  const colX = [16];
  for (let d = 1; d < widthAt.length; d++) colX[d] = colX[d - 1] + widthAt[d - 1] + GAP_X;

  let y = 16;
  const place = (n, d) => {
    const kids = visibleKids(n);
    const node = {
      id: n.id, kind: n.kind, label: n.label, fullLabel: n.fullLabel ?? n.label, color: n.color, taskId: n.taskId, done: n.done,
      x: colX[d], w: n.w, h: n.h, depth: d,
      hasKids: n.children.length > 0, expanded: kids.length > 0, childCount: n.children.length,
    };
    if (!kids.length) {
      const row = ROW[n.kind];
      node.y = y + row / 2;
      y += row;
    } else {
      const placed = kids.map((k) => place(k, d + 1));
      node.y = (placed[0].y + placed.at(-1).y) / 2;
      for (const c of placed) edges.push({ from: node, to: c, color: c.color ?? n.color });
    }
    nodes.push(node);
    return node;
  };
  place(root, 0);
  const width = Math.max(...nodes.map((n) => n.x + n.w)) + 70;
  const height = y + 16;
  return { nodes, edges, width, height };
}

// 부모 오른쪽 끝 → 자식 왼쪽 끝 곡선
export function edgePath(a, b) {
  const x1 = a.x + a.w;
  const x2 = b.x;
  const mx = (x1 + x2) / 2;
  return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
}

// 업무 연결(먼저 끝낼 업무 → 뒤 업무): 두 업무 노드 오른쪽으로 휘는 점선
export function dependencyPath(a, b) {
  const x1 = a.x + a.w;
  const x2 = b.x + b.w;
  const bend = Math.max(x1, x2) + 40 + Math.min(80, Math.abs(a.y - b.y) / 4);
  return `M${x1},${a.y} C${bend},${a.y} ${bend},${b.y} ${x2 + 6},${b.y}`;
}
