// 오늘 할 일: 자동으로 모으는 것(오늘·지난 마감, 오늘 알림) + 내가 따로 정리하는 오늘 목록 (순수 함수, 테스트 가능)
import { isoToLocal } from './remindTime.js';
import { addDays, weekStart } from './date.js';

// 할 일 하나가 어느 목록(오늘 day / 주간 week / 월간 month)인지. 예전 항목은 scope 가 없으면 오늘 목록
export const scopeOf = (i) => i.scope ?? 'day';
export const isDayItem = (i) => scopeOf(i) === 'day';

// 목록별 기간: key 는 그 목록 항목의 day 값(오늘 / 그 주 월요일 / 그 달 1일)
export function scopeRange(scope, today) {
  if (scope === 'week') {
    const from = weekStart(today);
    return { from, to: addDays(from, 6), key: from };
  }
  if (scope === 'month') {
    const from = `${today.slice(0, 8)}01`;
    const [y, m] = today.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from, to: `${today.slice(0, 8)}${String(last).padStart(2, '0')}`, key: from };
  }
  return { from: '', to: today, key: today }; // 오늘: 지난 마감까지 모두
}

// 지난달 1일: 지난주·지난달에 못 끝낸 주간·월간 할 일까지 불러오려면 여기부터
export function loadSince(today) {
  const [y, m] = today.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}-01`;
}

// tasks: steps 포함, reminders: 보내기 전 알림, items: today_items 전체(보내기 전 날짜 포함)
// scope: 'day'(오늘·지난 마감) | 'week'(이번 주 마감) | 'month'(이번 달 마감)
export function buildToday(tasks, reminders, items, today, scope = 'day') {
  const { from, to, key } = scopeRange(scope, today);
  const inRange = (d) => d && d >= from && d <= to;
  const due = [];
  for (const t of tasks) {
    const steps = [...(t.steps ?? [])].sort((a, b) => a.position - b.position);
    const dueSteps = steps.filter((s) => !s.done && inRange(s.due_date));
    for (const s of dueSteps) due.push({ key: `s:${s.id}`, task: t, step: s, date: s.due_date, overdue: s.due_date < today });
    // 업무 마감이 기간 안인데 그날짜 단계가 따로 없으면 업무 자체를 보여 줌
    if (inRange(t.due_date) && !dueSteps.some((s) => s.due_date === t.due_date)) {
      due.push({ key: `t:${t.id}`, task: t, step: null, date: t.due_date, overdue: t.due_date < today });
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));

  const todayReminders = reminders
    .filter((r) => { const d = isoToLocal(r.remind_at).slice(0, 10); return scope === 'day' ? d === today : d >= today && d <= to; })
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at));

  const same = items.filter((i) => scopeOf(i) === scope);
  const mine = same.filter((i) => i.day === key).sort((a, b) => (a.done - b.done) || (a.position - b.position));
  const carry = same.filter((i) => i.day < key && !i.done);

  const total = due.length + mine.length;
  const doneCount = mine.filter((i) => i.done).length;
  return { due, reminders: todayReminders, mine, carry, total, doneCount };
}

// 위·아래로 옮긴 뒤 안 끝낸 항목들의 새 순서 [{ id, position }] (끝낸 것은 아래에 그대로)
export function moveItem(mine, id, dir) {
  const open = mine.filter((i) => !i.done);
  const idx = open.findIndex((i) => i.id === id);
  const to = idx + dir;
  if (idx < 0 || to < 0 || to >= open.length) return [];
  const next = [...open];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next.map((i, position) => ({ id: i.id, position }));
}

// 공강 계획: 아직 시간을 안 정한 안 끝낸 일을 남은 공강에 차례로 하나씩 [{ id, period }]
export function autoPlan(mine, freePeriods) {
  const used = new Set(mine.filter((i) => !i.done && i.period != null).map((i) => Number(i.period)));
  const open = freePeriods.filter((p) => !p.past && !used.has(Number(p.period)));
  const todo = mine.filter((i) => !i.done && i.period == null);
  return todo.slice(0, open.length).map((i, k) => ({ id: i.id, period: Number(open[k].period) }));
}
