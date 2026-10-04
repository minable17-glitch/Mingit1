// 오늘 할 일: 자동으로 모으는 것(오늘·지난 마감, 오늘 알림) + 내가 따로 정리하는 오늘 목록 (순수 함수, 테스트 가능)
import { isoToLocal } from './remindTime.js';

// tasks: steps 포함, reminders: 보내기 전 알림, items: today_items 전체(보내기 전 날짜 포함)
export function buildToday(tasks, reminders, items, today) {
  const due = [];
  for (const t of tasks) {
    const steps = [...(t.steps ?? [])].sort((a, b) => a.position - b.position);
    const dueSteps = steps.filter((s) => !s.done && s.due_date && s.due_date <= today);
    for (const s of dueSteps) due.push({ key: `s:${s.id}`, task: t, step: s, date: s.due_date, overdue: s.due_date < today });
    // 업무 마감이 오늘·지났는데 그날짜 단계가 따로 없으면 업무 자체를 보여 줌
    if (t.due_date && t.due_date <= today && !dueSteps.some((s) => s.due_date === t.due_date)) {
      due.push({ key: `t:${t.id}`, task: t, step: null, date: t.due_date, overdue: t.due_date < today });
    }
  }
  due.sort((a, b) => a.date.localeCompare(b.date));

  const todayReminders = reminders
    .filter((r) => isoToLocal(r.remind_at).slice(0, 10) === today)
    .sort((a, b) => a.remind_at.localeCompare(b.remind_at));

  const mine = items.filter((i) => i.day === today).sort((a, b) => (a.done - b.done) || (a.position - b.position));
  const carry = items.filter((i) => i.day < today && !i.done);

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
