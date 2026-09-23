// 앱의 src/lib/briefing.js 와 같은 판단 규칙 (위젯 요약용 서버 사본)
const DUE_SOON_DAYS = 3;
const toUTCDays = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86400000;
};
export const todayKST = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);
const dateKST = (iso: string) => todayKST(new Date(iso).getTime());
const diffDays = (from: string, to: string) => Math.round(toUTCDays(to) - toUTCDays(from));

type Step = { due_date: string | null; done: boolean };
export type Task = {
  title: string;
  next_action: string;
  due_date: string | null;
  last_activity_at: string;
  waiting_on: string | null;
  waiting_since: string | null;
  steps?: Step[];
};

export function assess(task: Task, today: string, neglectDays: number, waitingDays: number) {
  const due = [task.due_date, ...(task.steps ?? []).filter((s) => !s.done).map((s) => s.due_date)]
    .filter(Boolean).sort()[0] as string | undefined;
  const daysLeft = due ? diffDays(today, due) : null;
  const idle = diffDays(dateKST(task.last_activity_at), today);
  const waiting = Boolean(task.waiting_on);
  const waitDays = waiting && task.waiting_since ? diffDays(dateKST(task.waiting_since), today) : 0;
  return {
    due: due ?? null,
    daysLeft,
    idle,
    waitDays,
    overdue: daysLeft !== null && daysLeft < 0,
    dueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    neglected: !waiting && idle >= neglectDays,
    noReply: waiting && waitDays >= waitingDays,
  };
}

export function rank(a: ReturnType<typeof assess>) {
  if (a.overdue) return 0;
  if (a.dueSoon) return 1;
  if (a.noReply || a.neglected) return 2;
  return 3;
}
