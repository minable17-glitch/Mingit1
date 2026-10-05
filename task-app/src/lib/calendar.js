// 마감 달력: 업무·단계 마감(과 알림)을 날짜별로 모으기 (순수 함수, 테스트 가능)
import { isoToLocal } from './remindTime.js';

const pad = (n) => String(n).padStart(2, '0');

// 일요일부터 시작하는 달력 칸: [[{ date, inMonth }, ×7], …]
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const weeks = [];
  const cur = new Date(start);
  do {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cur.toISOString().slice(0, 10), inMonth: cur.getUTCMonth() === month - 1, dow: i });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cur.getUTCMonth() === month - 1);
  return weeks;
}

export function shiftMonth({ year, month }, d) {
  const m = month - 1 + d;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 };
}

export const monthKey = ({ year, month }) => `${year}-${pad(month)}`;

// filter: { kind: 'all' } | { kind: 'category', id } | { kind: 'task', id }
// 돌려주는 값: { 'YYYY-MM-DD': [{ key, kind: 'task'|'step'|'reminder', title, sub, taskId, color, done, overdue }] }
export function calendarEvents(tasks, categories, filter = { kind: 'all' }, reminders = [], today = '') {
  const colorOf = Object.fromEntries(categories.map((c) => [c.id, c.color]));
  const picked = tasks.filter((t) => filter.kind === 'all'
    || (filter.kind === 'category' && t.category_id === filter.id)
    || (filter.kind === 'task' && t.id === filter.id));
  const single = filter.kind === 'task';
  const byDate = {};
  const push = (date, ev) => { (byDate[date] ??= []).push(ev); };
  for (const t of picked) {
    const color = colorOf[t.category_id] ?? '#9aa5b8';
    if (t.due_date) push(t.due_date, { key: `t:${t.id}`, kind: 'task', title: t.title, sub: '업무 마감', taskId: t.id, color, done: false, overdue: t.due_date < today });
    for (const s of t.steps ?? []) {
      if (!s.due_date || (s.done && !single)) continue; // 전체 보기에서는 끝낸 단계는 빼고, 업무 하나만 볼 때는 끝낸 것도 ✓로
      push(s.due_date, { key: `s:${s.id}`, kind: 'step', title: s.title, sub: t.title, taskId: t.id, color, done: s.done, overdue: !s.done && s.due_date < today });
    }
  }
  const ids = new Set(picked.map((t) => t.id));
  for (const r of reminders) {
    if (filter.kind !== 'all' && !ids.has(r.task_id)) continue;
    const local = isoToLocal(r.remind_at);
    push(local.slice(0, 10), { key: `r:${r.id}`, kind: 'reminder', title: r.title, sub: local.slice(11), taskId: r.task_id, color: '#4f7cff', done: false, overdue: false });
  }
  // 하루 안에서: 업무 마감 → 단계 → 알림
  const order = { task: 0, step: 1, reminder: 2 };
  for (const d of Object.keys(byDate)) byDate[d].sort((a, b) => order[a.kind] - order[b.kind] || a.done - b.done);
  return byDate;
}

// 업무 하나의 일정표: 단계 순서대로 날짜·완료 + 업무 마감
export function taskTimeline(task) {
  return [...(task.steps ?? [])].sort((a, b) => a.position - b.position)
    .map((s) => ({ key: s.id, title: s.title, date: s.due_date, done: s.done }));
}

// 그 날짜가 들어 있는 주(일요일 시작)의 7일
export function weekDays(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}
