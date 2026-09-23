// Supabase 호출 모음. 화면 코드는 이 파일의 함수만 부릅니다.
import { supabase } from './supabaseClient.js';
import { nextActionFromSteps } from './briefing.js';
import { todayKST } from './date.js';

export const DEFAULT_CATEGORIES = [
  { name: '담임', color: '#f59e0b' },
  { name: '수업', color: '#4f7cff' },
  { name: '행정업무', color: '#10b981' },
  { name: '개인 일정', color: '#a855f7' },
];

export const PLACEHOLDER_NEXT_ACTION = '첫 단계 정하기 (AI와 쪼개기)';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ── 로그인 ───────────────────────────────────

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      // 갱신 토큰을 받으려면 offline + consent 가 필요
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}

// 구글 로그인 직후에만 세션에 갱신 토큰이 들어 있으므로 그때 저장해 둠
export async function saveGoogleRefreshToken(session) {
  const refresh = session?.provider_refresh_token;
  if (!refresh) return;
  check(await supabase.from('google_tokens').upsert({
    user_id: session.user.id,
    refresh_token: refresh,
    updated_at: new Date().toISOString(),
  }));
}

export async function isAllowed() {
  return check(await supabase.rpc('is_allowed'));
}

// ── 처음 실행 시 기본값 ─────────────────────────

export async function ensureDefaults(userId) {
  const cats = check(await supabase.from('categories').select('id').limit(1));
  if (cats.length === 0) {
    check(await supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i })),
    ));
  }
  check(await supabase.from('settings').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }));
}

// ── 읽기 ────────────────────────────────────

export async function loadCategories() {
  return check(await supabase.from('categories').select('*').order('sort_order').order('created_at'));
}

export async function loadActiveTasks() {
  return check(await supabase
    .from('tasks')
    .select('*, steps(*)')
    .eq('status', 'active')
    .order('position', { referencedTable: 'steps' }));
}

export async function loadArchivedTasks() {
  return check(await supabase
    .from('tasks')
    .select('*, steps(*)')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(200));
}

export async function loadTask(id) {
  return check(await supabase
    .from('tasks')
    .select('*, steps(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'steps' })
    .single());
}

export async function loadActivity(taskId) {
  return check(await supabase
    .from('activity_log')
    .select('*')
    .eq('task_id', taskId)
    .order('at', { ascending: false })
    .limit(30));
}

export async function loadSettings() {
  return check(await supabase.from('settings').select('*').maybeSingle());
}

export async function hasGoogleToken() {
  const row = check(await supabase.from('google_tokens').select('user_id').maybeSingle());
  return Boolean(row);
}

// ── 활동 기록 ────────────────────────────────

async function logActivity(taskId, kind, content) {
  check(await supabase.from('activity_log').insert({ task_id: taskId, kind, content }));
}

const now = () => new Date().toISOString();

// ── 업무 ────────────────────────────────────

export async function createTask({ title, categoryId, dueDate }) {
  const task = check(await supabase.from('tasks').insert({
    title: title.trim(),
    category_id: categoryId,
    due_date: dueDate || null,
    next_action: PLACEHOLDER_NEXT_ACTION,
    calendar_dirty: Boolean(dueDate),
  }).select().single());
  await logActivity(task.id, 'create', task.title);
  if (dueDate) syncCalendar(task.id);
  return task;
}

// 업무명·분류·마감·다음 행동 수정
export async function updateTask(task, patch) {
  const dueChanged = 'due_date' in patch && (patch.due_date || null) !== (task.due_date || null);
  const titleChanged = 'title' in patch && patch.title !== task.title;
  const needsSync = dueChanged || (titleChanged && (task.due_date || task.steps?.some((s) => s.due_date)));
  const updated = check(await supabase.from('tasks').update({
    ...patch,
    ...(dueChanged ? { due_date: patch.due_date || null } : {}),
    last_activity_at: now(),
    ...(needsSync ? { calendar_dirty: true } : {}),
  }).eq('id', task.id).select().single());
  const changes = Object.keys(patch).join(', ');
  await logActivity(task.id, 'edit', changes);
  if (needsSync) syncCalendar(task.id);
  return updated;
}

// AI 제안(또는 직접 입력)을 확정: 기존 단계를 새 단계로 바꾸고 다음 행동을 정함
export async function saveBreakdown(task, steps, nextAction) {
  const oldEventIds = (task.steps ?? []).map((s) => s.calendar_event_id).filter(Boolean);
  if (oldEventIds.length) await deleteCalendarEvents(oldEventIds);
  check(await supabase.from('steps').delete().eq('task_id', task.id));
  if (steps.length) {
    check(await supabase.from('steps').insert(steps.map((s, i) => ({
      task_id: task.id,
      position: i,
      title: s.title.trim(),
      due_date: s.due_date || null,
    }))));
  }
  const action = nextAction?.trim() || nextActionFromSteps(steps.map((s, i) => ({ ...s, position: i, done: false })));
  check(await supabase.from('tasks').update({
    next_action: action || PLACEHOLDER_NEXT_ACTION,
    last_activity_at: now(),
    calendar_dirty: true,
  }).eq('id', task.id));
  await logActivity(task.id, 'edit', `단계 ${steps.length}개 확정`);
  syncCalendar(task.id);
}

// 단계 체크/해제. 다음 행동을 남은 첫 단계로 갱신하고, 모두 끝나면 완료 처리.
// 돌려주는 값: { completed: boolean }
export async function toggleStep(task, step) {
  const done = !step.done;
  check(await supabase.from('steps').update({ done, done_at: done ? now() : null }).eq('id', step.id));
  await logActivity(task.id, 'check', `${done ? '완료' : '되돌림'}: ${step.title}`);

  const steps = task.steps.map((s) => (s.id === step.id ? { ...s, done } : s));
  const next = nextActionFromSteps(steps);
  if (next === null) {
    await completeTask(task);
    return { completed: true };
  }
  check(await supabase.from('tasks').update({ next_action: next, last_activity_at: now() }).eq('id', task.id));
  return { completed: false };
}

// 맥락 메모: "어디까지 했고 다음엔 뭐부터"
export async function addNote(task, note, nextAction) {
  const patch = { latest_note: note.trim(), last_activity_at: now() };
  if (nextAction?.trim()) patch.next_action = nextAction.trim();
  check(await supabase.from('tasks').update(patch).eq('id', task.id));
  await logActivity(task.id, 'note', note.trim());
}

export async function completeTask(task) {
  check(await supabase.from('tasks').update({
    status: 'done', completed_at: now(), last_activity_at: now(),
  }).eq('id', task.id));
  await logActivity(task.id, 'complete', null);
}

export async function reopenTask(task) {
  const next = nextActionFromSteps(task.steps ?? []);
  check(await supabase.from('tasks').update({
    status: 'active',
    completed_at: null,
    last_activity_at: now(),
    next_action: next || task.next_action || PLACEHOLDER_NEXT_ACTION,
  }).eq('id', task.id));
  await logActivity(task.id, 'edit', '다시 진행');
}

export async function deleteTask(task) {
  const ids = [task.calendar_event_id, ...(task.steps ?? []).map((s) => s.calendar_event_id)].filter(Boolean);
  if (ids.length) await deleteCalendarEvents(ids);
  check(await supabase.from('tasks').delete().eq('id', task.id));
}

// ── 분류 ────────────────────────────────────

export async function createCategory({ name, color }, sortOrder) {
  return check(await supabase.from('categories').insert({ name: name.trim(), color, sort_order: sortOrder }).select().single());
}

export async function updateCategory(id, patch) {
  check(await supabase.from('categories').update(patch).eq('id', id));
}

export async function reorderCategories(orderedIds) {
  await Promise.all(orderedIds.map((id, i) => updateCategory(id, { sort_order: i })));
}

// 분류 삭제: 그 분류의 업무(완료 포함)를 먼저 다른 분류로 옮김
export async function deleteCategory(id, moveToId) {
  check(await supabase.from('tasks').update({ category_id: moveToId }).eq('category_id', id));
  check(await supabase.from('categories').delete().eq('id', id));
}

// ── 설정 ────────────────────────────────────

export async function updateSettings(userId, patch) {
  check(await supabase.from('settings').upsert({ user_id: userId, ...patch }));
}

// ── AI 쪼개기 ────────────────────────────────

// history: [{ role: 'assistant' | 'user', content }]
export async function askBreakdown(task, categoryName, history) {
  const { data, error } = await supabase.functions.invoke('ai-breakdown', {
    body: {
      task: { title: task.title, due_date: task.due_date, category: categoryName },
      history,
      today: todayKST(),
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── 구글 캘린더 ──────────────────────────────

// 실패해도 앱 사용은 막지 않음. calendar_dirty 가 남아 다음 실행 때 다시 시도함.
export async function syncCalendar(taskId) {
  const { data, error } = await supabase.functions.invoke('calendar-sync', {
    body: { action: 'sync', task_id: taskId },
  });
  if (error || data?.error) {
    console.warn('캘린더 반영 실패', error ?? data.error);
    return false;
  }
  return true;
}

export async function retryDirtyCalendar(tasks) {
  for (const t of tasks.filter((x) => x.calendar_dirty)) await syncCalendar(t.id);
}

async function deleteCalendarEvents(eventIds) {
  const { error } = await supabase.functions.invoke('calendar-sync', {
    body: { action: 'delete', event_ids: eventIds },
  });
  if (error) console.warn('캘린더 일정 삭제 실패', error);
}

export async function addWorkBlock(task, { date, start, minutes }) {
  const { data, error } = await supabase.functions.invoke('calendar-sync', {
    body: { action: 'block', task_id: task.id, date, start, minutes },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  check(await supabase.from('tasks').update({ last_activity_at: now() }).eq('id', task.id));
}
