// Supabase 호출 모음. 화면 코드는 이 파일의 함수만 부릅니다.
import { supabase } from './supabaseClient.js';
import { assess, nextActionFromSteps } from './briefing.js';
import { toDateKST, todayKST, weekStart } from './date.js';
import { DEFAULT_TEMPLATES, stepsFromTemplate, templateStepsFromTask } from './templates.js';

export const DEFAULT_CATEGORIES = [
  { name: '담임', color: '#f59e0b' },
  { name: '수업', color: '#4f7cff' },
  { name: '행정업무', color: '#10b981' },
  { name: '개인 일정', color: '#a855f7' },
];

export const PLACEHOLDER_NEXT_ACTION = '첫 단계 정하기';

// 로그인한 사용자가 쓸 수 있는 부가 기능 (관리자가 켜 줌). App 이 로그인 후 채움.
let features = { is_admin: false, ai_enabled: false, google_advanced: false };
export function setFeatures(f) {
  features = { ...features, ...f };
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ── 로그인 ───────────────────────────────────

// 기본 로그인: 이름·이메일만 요청 (구글 심사가 필요 없는 기본 권한)
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

// 고급 구글 연동: 캘린더 즉시 반영·Gmail 가져오기. 관리자가 허락한 사용자만 화면에 버튼이 보임.
export function connectGoogleAdvanced() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.readonly',
      ].join(' '),
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

// 가입 처리 + 내 권한: { allowed, is_admin, ai_enabled, google_advanced }
export async function myProfile() {
  return check(await supabase.rpc('my_profile'));
}

export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: '탈퇴' } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await supabase.auth.signOut();
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

// sync: false 이면 캘린더 반영을 호출한 쪽에 맡김 (곧바로 단계까지 저장할 때 두 번 부르지 않도록)
export async function createTask({ title, categoryId, dueDate, nextAction }, { sync = true } = {}) {
  const task = check(await supabase.from('tasks').insert({
    title: title.trim(),
    category_id: categoryId,
    due_date: dueDate || null,
    next_action: nextAction?.trim() || PLACEHOLDER_NEXT_ACTION,
    calendar_dirty: Boolean(dueDate),
  }).select().single());
  await logActivity(task.id, 'create', task.title);
  if (dueDate && sync) syncCalendar(task.id);
  return { ...task, steps: [] };
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

// 단계 하나 추가 (던져넣기 등). 다음 행동이 임시 문구였으면 이 단계로 바꿈
export async function addStep(task, title, dueDate) {
  const steps = task.steps ?? [];
  const position = steps.reduce((m, s) => Math.max(m, s.position + 1), 0);
  check(await supabase.from('steps').insert({ task_id: task.id, position, title: title.trim(), due_date: dueDate || null }));
  const patch = { last_activity_at: now() };
  if (task.next_action === PLACEHOLDER_NEXT_ACTION || steps.every((s) => s.done)) patch.next_action = title.trim();
  if (dueDate) patch.calendar_dirty = true;
  check(await supabase.from('tasks').update(patch).eq('id', task.id));
  await logActivity(task.id, 'edit', `단계 추가: ${title.trim()}`);
  if (dueDate) syncCalendar(task.id);
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

// ── 공 넘겨놓은 일 (결재·회신 대기) ──────────────

export async function setWaiting(task, waitingOn) {
  check(await supabase.from('tasks').update({
    waiting_on: waitingOn.trim(), waiting_since: now(), last_activity_at: now(),
  }).eq('id', task.id));
  await logActivity(task.id, 'wait', waitingOn.trim());
}

export async function clearWaiting(task, note) {
  const patch = { waiting_on: null, waiting_since: null, last_activity_at: now() };
  if (note?.trim()) patch.latest_note = note.trim();
  check(await supabase.from('tasks').update(patch).eq('id', task.id));
  await logActivity(task.id, 'reply', `${task.waiting_on} 응답${note?.trim() ? `: ${note.trim()}` : ''}`);
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
  if (!features.google_advanced) return false; // 일반 사용자는 캘린더 구독 링크로 보임
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
  if (!features.google_advanced) return;
  for (const t of tasks.filter((x) => x.calendar_dirty)) await syncCalendar(t.id);
}

async function deleteCalendarEvents(eventIds) {
  if (!features.google_advanced) return;
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

// ── 2단계: AI 도움 (던져넣기·공문·회고·짜투리) ─────────

async function assist(mode, body) {
  const { data, error } = await supabase.functions.invoke('ai-assist', {
    body: { mode, today: todayKST(), ...body },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// AI에게 넘길 업무 요약 한 줄
export function briefTask(task, categoryById, settings, today = todayKST()) {
  const info = assess(task, today, settings.neglect_days, settings.waiting_days);
  return {
    id: task.id,
    title: task.title,
    category: categoryById[task.category_id]?.name,
    next_action: task.next_action,
    due: info.due,
    idle: info.idle,
    waiting_on: task.waiting_on ?? null,
  };
}

export function triage(text, briefs, categories) {
  return assist('triage', { text, tasks: briefs, categories: categories.map((c) => c.name) });
}

const categoryIdByName = (categories, name) =>
  categories.find((c) => c.name === name)?.id ?? categories[0]?.id;

// 던져넣기 제안을 확정해서 반영
// proposal: { task_id, attach_as: 'step'|'note'|'next_action'|'new', content, due_date, category_id }
export async function applyTriage(proposal, tasks) {
  if (proposal.attach_as !== 'new') {
    const task = tasks.find((t) => t.id === proposal.task_id);
    if (!task) throw new Error('붙일 업무를 찾지 못했어요');
    if (proposal.attach_as === 'step') return addStep(task, proposal.content, proposal.due_date);
    if (proposal.attach_as === 'next_action') return updateTask(task, { next_action: proposal.content });
    return addNote(task, proposal.content);
  }
  return createTask({
    title: proposal.new_title || proposal.content,
    categoryId: proposal.category_id,
    dueDate: proposal.due_date,
    nextAction: proposal.next_action,
  });
}

// AI 던져넣기 결과 → 공통 형태
export function proposalFromAi(r, categories) {
  if (r.kind === 'attach') return { task_id: r.task_id, attach_as: r.attach_as || 'note', content: r.content, due_date: '', reason: r.reason };
  return {
    task_id: '',
    attach_as: 'new',
    content: r.content,
    new_title: r.new_title || r.content,
    next_action: r.content,
    category_id: categoryIdByName(categories, r.category_name),
    due_date: r.due_date,
    reason: r.reason,
  };
}

export function extractDocument(text, categories) {
  return assist('extract', { text, categories: categories.map((c) => c.name) });
}

// 공문·메일 제안(사용자가 고친 것)을 업무로 만들기
// draft: { title, category_id, due_date, steps: [{title, due_date}], next_action, note }
export async function createFromDraft(draft) {
  const task = await createTask(
    { title: draft.title, categoryId: draft.category_id, dueDate: draft.due_date },
    { sync: false },
  );
  const steps = draft.steps.filter((s) => s.title.trim());
  if (steps.length) {
    await saveBreakdown(task, steps, draft.next_action);
  } else {
    if (draft.next_action?.trim()) await updateTask(task, { next_action: draft.next_action });
    if (draft.due_date) syncCalendar(task.id);
  }
  if (draft.note?.trim()) await addNote(task, draft.note);
  return task;
}

// AI 추출 결과 → 편집용 초안
export function draftFromExtraction(ex, categories) {
  const deliverables = ex.deliverables?.length ? `제출물: ${ex.deliverables.join(', ')}` : '';
  return {
    title: ex.title,
    category_id: categoryIdByName(categories, ex.category_name),
    due_date: ex.due_date || '',
    steps: ex.steps ?? [],
    next_action: ex.next_action ?? '',
    note: [ex.summary, deliverables].filter(Boolean).join(' / '),
  };
}

export function askReview(history, week) {
  return assist('review', { history, week });
}

export function smallActions(minutes, briefs) {
  return assist('small', { minutes, tasks: briefs });
}

// ── 주간 회고 ────────────────────────────────

export async function loadWeekData(activeTasks, categoryById, settings) {
  const today = todayKST();
  const start = weekStart(today);
  const since = new Date(`${start}T00:00:00+09:00`).toISOString();
  const [activity, completed] = await Promise.all([
    supabase.from('activity_log').select('at, kind, content, tasks(title)').gte('at', since).order('at').then(check),
    supabase.from('tasks').select('title').eq('status', 'done').gte('completed_at', since).then(check),
  ]);
  const KIND = { create: '등록', check: '체크', note: '메모', edit: '수정', complete: '완료', wait: '공 넘김', reply: '응답 받음' };
  return {
    start,
    completed: completed.map((t) => t.title),
    activity: activity.slice(-80).map((a) =>
      `${toDateKST(a.at).slice(5)} ${a.tasks?.title ?? ''} — ${KIND[a.kind] ?? a.kind}${a.content ? `: ${a.content}` : ''}`),
    active: activeTasks.map((t) => briefTask(t, categoryById, settings, today)),
  };
}

export async function saveReview(summary) {
  check(await supabase.from('weekly_reviews').upsert(
    { week_start: weekStart(todayKST()), summary, user_id: (await supabase.auth.getUser()).data.user.id },
    { onConflict: 'user_id,week_start' },
  ));
}

export async function loadReviews() {
  return check(await supabase.from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(20));
}

export async function applySuggestion(task, suggestion) {
  if (suggestion.change === 'complete') return completeTask(task);
  if (suggestion.change === 'due_date') return updateTask(task, { due_date: suggestion.value });
  return updateTask(task, { next_action: suggestion.value });
}

// ── 템플릿 ───────────────────────────────────

export async function loadTemplates() {
  return check(await supabase.from('templates').select('*').order('created_at'));
}

// 처음 한 번만 기본 템플릿(품의·출장·평가계획)을 넣음. 사용자가 지운 뒤에는 다시 넣지 않음.
// '아직 안 넣음 → 넣음'으로 바꾸는 데 성공한 쪽만 넣으므로 동시에 두 번 불려도 한 번만 들어감.
export async function ensureDefaultTemplates(userId, categories) {
  const claimed = check(await supabase.from('settings')
    .update({ templates_seeded: true })
    .eq('user_id', userId)
    .eq('templates_seeded', false)
    .select('user_id'));
  if (!claimed.length) return;
  check(await supabase.from('templates').insert(DEFAULT_TEMPLATES.map((t) => ({
    name: t.name,
    category_id: categories.find((c) => c.name === t.category)?.id ?? null,
    steps: t.steps,
    next_action: t.next_action,
  }))));
}

export async function createTemplate({ name, categoryId, steps, nextAction }) {
  return check(await supabase.from('templates').insert({
    name: name.trim(), category_id: categoryId || null, steps, next_action: nextAction || null,
  }).select().single());
}

export async function updateTemplate(id, patch) {
  check(await supabase.from('templates').update(patch).eq('id', id));
}

export async function deleteTemplate(id) {
  check(await supabase.from('templates').delete().eq('id', id));
}

export async function saveTaskAsTemplate(task, name) {
  return createTemplate({
    name,
    categoryId: task.category_id,
    steps: templateStepsFromTask(task),
    nextAction: [...(task.steps ?? [])].sort((a, b) => a.position - b.position)[0]?.title,
  });
}

export async function createFromTemplate(template, { title, categoryId, dueDate }) {
  return createFromDraft({
    title,
    category_id: categoryId,
    due_date: dueDate,
    steps: stepsFromTemplate(template, dueDate),
    next_action: template.next_action ?? '',
  });
}

// ── 받은 제안함 (Gmail) ─────────────────────────

export async function loadInbox() {
  return check(await supabase.from('inbox').select('*').eq('status', 'pending').order('received_at', { ascending: false }));
}

export async function checkGmail() {
  const { data, error } = await supabase.functions.invoke('gmail-import', { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error === 'label_not_found' ? `Gmail에 '${data.label}' 라벨이 없어요` : data.error);
  return data;
}

export async function acceptInbox(item, draft) {
  const task = await createFromDraft(draft);
  check(await supabase.from('inbox').update({ status: 'accepted' }).eq('id', item.id));
  return task;
}

export async function dismissInbox(item) {
  check(await supabase.from('inbox').update({ status: 'dismissed' }).eq('id', item.id));
}

// ── 위젯 ────────────────────────────────────

export async function createWidgetToken(userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await updateSettings(userId, { widget_token: token });
  return token;
}

export function widgetUrl(token, format = 'html') {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-summary?key=${token}&format=${format}`;
}

// ── 캘린더 구독 링크 (모든 사용자) ─────────────────

export async function createCalendarToken(userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await updateSettings(userId, { calendar_token: token });
  return token;
}

export function calendarFeedUrl(token) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${token}`;
}

// ── 관리자 ──────────────────────────────────

export async function adminOverview() {
  return check(await supabase.rpc('admin_overview'));
}

export async function adminSetSignupOpen(open) {
  check(await supabase.rpc('admin_set_signup_open', { open }));
}

export async function adminSetUserFlags(email, { ai, advanced }) {
  check(await supabase.rpc('admin_set_user_flags', { target_email: email, ai, advanced }));
}
