// 업무 연결(선후 관계): from(앞 업무)을 끝내야 to(뒤 업무)를 할 수 있음
import { assess } from './briefing.js';

// 이 업무보다 먼저 끝내야 하는데 아직 진행 중인 앞 업무들
export function blockersOf(taskId, links, tasksById) {
  return links
    .filter((l) => l.to_task_id === taskId)
    .map((l) => tasksById[l.from_task_id])
    .filter((t) => t && t.status !== 'done');
}

// 앞 업무 중 마감을 넘긴 것이 있으면 뒤 업무도 위험
export function blockerDelayed(taskId, links, tasksById, today, settings) {
  return blockersOf(taskId, links, tasksById)
    .some((t) => assess(t, today, settings.neglect_days, settings.waiting_days).overdue);
}

// from → to 를 추가하면 고리(A→B→…→A)가 생기는지
export function wouldCycle(fromId, toId, links) {
  if (fromId === toId) return true;
  const next = {};
  for (const l of links) (next[l.from_task_id] ??= []).push(l.to_task_id);
  const stack = [toId];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === fromId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(next[cur] ?? []));
  }
  return false;
}
