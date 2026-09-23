// 오늘의 브리핑: 정렬·경고 판단 (순수 함수, 테스트 가능)
import { diffDays, toDateKST } from './date.js';

export const DUE_SOON_DAYS = 3;

// 이 업무의 가장 가까운 마감 (업무 마감과 남은 단계 마감 중 이른 것)
export function nearestDue(task) {
  const dates = [task.due_date, ...(task.steps ?? []).filter((s) => !s.done).map((s) => s.due_date)]
    .filter(Boolean)
    .sort();
  return dates[0] ?? null;
}

export function idleDays(task, today) {
  return diffDays(toDateKST(task.last_activity_at), today);
}

export function assess(task, today, neglectDays) {
  const due = nearestDue(task);
  const daysLeft = due ? diffDays(today, due) : null;
  const idle = idleDays(task, today);
  return {
    due,
    daysLeft,
    idle,
    overdue: daysLeft !== null && daysLeft < 0,
    dueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    neglected: idle >= neglectDays,
  };
}

// 위험도 순위: 마감 지남 → 마감 임박 → 방치 → 나머지
function rank(a) {
  if (a.overdue) return 0;
  if (a.dueSoon) return 1;
  if (a.neglected) return 2;
  return 3;
}

export function sortForBriefing(tasks, today, neglectDays) {
  return tasks
    .map((task) => ({ task, info: assess(task, today, neglectDays) }))
    .sort((x, y) => {
      const r = rank(x.info) - rank(y.info);
      if (r !== 0) return r;
      // 같은 순위 안에서는 마감 이른 순, 마감 없으면 오래 방치된 순
      const dx = x.info.due ?? '9999-12-31';
      const dy = y.info.due ?? '9999-12-31';
      if (dx !== dy) return dx < dy ? -1 : 1;
      return y.info.idle - x.info.idle;
    });
}

// 단계 목록에서 다음 행동 결정: 남은 첫 단계. 모두 끝났으면 null
export function nextActionFromSteps(steps) {
  const next = [...steps].sort((a, b) => a.position - b.position).find((s) => !s.done);
  return next ? next.title : null;
}
