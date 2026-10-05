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
  { name: '기타', color: '#94a3b8' },
];

export const ETC_CATEGORY = '기타';

export const PLACEHOLDER_NEXT_ACTION = '첫 단계 정하기';

// 로그인한 사용자가 쓸 수 있는 부가 기능 (관리자가 켜 줌). App 이 로그인 후 채움.
let features = { is_admin: false, google_advanced: false };
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

// 가입 처리 + 내 권한: { allowed, is_admin, google_advanced }
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

// 던져넣기에서 분류를 고르지 않으면 들어가는 '기타' 분류 (없으면 맨 뒤에 만듦)
// 돌려주는 값: { category, created }
export async function ensureEtcCategory(categories) {
  const found = categories.find((c) => c.name.trim() === ETC_CATEGORY);
  if (found) return { category: found, created: false };
  const sortOrder = categories.reduce((m, c) => Math.max(m, c.sort_order ?? 0), -1) + 1;
  return { category: await createCategory({ name: ETC_CATEGORY, color: '#94a3b8' }, sortOrder), created: true };
}

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

// ── 업무 요약·초안 ──────────────────────────

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

// 던져넣기 제안을 확정해서 반영
// proposal: { task_id, attach_as: 'step'|'note'|'next_action'|'new', content, due_date, category_id }
// 돌려주는 값: 붙이거나 새로 만든 업무의 id
export async function applyTriage(proposal, tasks) {
  if (proposal.attach_as !== 'new') {
    const task = tasks.find((t) => t.id === proposal.task_id);
    if (!task) throw new Error('붙일 업무를 찾지 못했어요');
    if (proposal.attach_as === 'step') await addStep(task, proposal.content, proposal.due_date);
    else if (proposal.attach_as === 'next_action') await updateTask(task, { next_action: proposal.content });
    else await addNote(task, proposal.content);
    return task.id;
  }
  const task = await createTask({
    title: proposal.new_title || proposal.content,
    categoryId: proposal.category_id,
    dueDate: proposal.due_date,
    nextAction: proposal.next_action,
  });
  return task.id;
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

// ── AI 채팅 커넥터 (MCP) ─────────────────────
// Claude 등 AI 채팅의 "커넥터"에 이 주소를 넣으면, 대화 중에 AI가 업무를 읽고 등록할 수 있음

export async function createMcpToken(userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await updateSettings(userId, { mcp_token: token });
  return token;
}

export async function clearMcpToken(userId) {
  await updateSettings(userId, { mcp_token: null });
}

export function mcpUrl(token) {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp?token=${token}`;
}

// ── 시간 알림 (웹 푸시) ─────────────────────────
// 기기마다 '알림 받기'를 켜면 서버가 정해 둔 시간에 알림을 보냄 (앱을 닫아 둬도 옴)

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// 아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있음
export function needsHomeScreen() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

// 'unsupported' | 'denied' | 'on' | 'off'
export async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (await currentSubscription()) ? 'on' : 'off';
}

const b64ToBytes = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return '아이폰·아이패드';
  if (/Android/.test(ua)) return '안드로이드';
  if (/Windows/.test(ua)) return '윈도우 PC';
  if (/Mac/.test(ua)) return '맥';
  return '기기';
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('이 브라우저는 알림을 지원하지 않아요. 크롬을 써 주세요.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('알림이 허용되지 않았어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.');
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const { data, error } = await supabase.functions.invoke('push', { method: 'GET' });
  if (error || !data?.publicKey) throw new Error('알림 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.');
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) });
  const j = sub.toJSON();
  await supabase.from('push_subscriptions').delete().eq('endpoint', j.endpoint);
  check(await supabase.from('push_subscriptions').insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceName() }));
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'test' } });
  if (error) throw new Error('시험 알림을 보내지 못했어요. 알림 받기를 다시 켜 보세요.');
  return data;
}

export async function loadReminders() {
  const { data, error } = await supabase.from('reminders').select('*').is('sent_at', null).order('remind_at');
  if (error) return []; // schema_push.sql 실행 전
  return data;
}

export async function addReminder({ taskId, title, remindAt }) {
  return check(await supabase.from('reminders').insert({ task_id: taskId || null, title: title.trim().slice(0, 120), remind_at: remindAt }).select().single());
}

export async function removeReminder(id) {
  check(await supabase.from('reminders').delete().eq('id', id));
}

// ── 생각 노트 (업무에 관한 생각·원칙·아이디어·배운 점) ─────

export async function loadThoughts() {
  const { data, error } = await supabase.from('thoughts').select('*').order('created_at', { ascending: false });
  if (error) return null; // schema_notes.sql 실행 전
  return data;
}

export async function addThought({ body, kind, categoryId, taskId }) {
  return check(await supabase.from('thoughts').insert({
    body: body.trim(), kind, category_id: categoryId || null, task_id: taskId || null, pinned: kind === 'principle',
  }).select().single());
}

export async function updateThought(id, patch) {
  return check(await supabase.from('thoughts').update({ ...patch, updated_at: now() }).eq('id', id).select().single());
}

export async function deleteThought(id) {
  check(await supabase.from('thoughts').delete().eq('id', id));
}

// ── 오늘 할 일 (내가 따로 정리하는 오늘 목록) ──────────

export async function loadTodayItems(sinceDay) {
  const { data, error } = await supabase.from('today_items').select('*').gte('day', sinceDay).order('position');
  if (error) return null; // schema_today.sql 실행 전
  return data;
}

// scope: 'day'(오늘) | 'week'(그 주 월요일 day) | 'month'(그 달 1일 day), period: 공강 교시(선택)
export async function addTodayItem({ day, title, taskId, position, scope = 'day', period = null }) {
  const row = { day, title: title.trim().slice(0, 200), task_id: taskId || null, position };
  if (scope !== 'day') row.scope = scope; // 예전 표(scope 칸 없음)에서도 오늘 목록은 그대로 저장되게
  if (period != null) row.period = period;
  return check(await supabase.from('today_items').insert(row).select().single());
}

export async function updateTodayItem(id, patch) {
  check(await supabase.from('today_items').update(patch).eq('id', id));
}

export async function deleteTodayItem(id) {
  check(await supabase.from('today_items').delete().eq('id', id));
}

// 순서 바꾸기·어제 것 가져오기처럼 여러 줄을 한 번에
export async function updateTodayItems(rows) {
  await Promise.all(rows.map(({ id, ...patch }) => updateTodayItem(id, patch)));
}

// ── 던져 둔 것 (나중에 분류) ──────────────────

export async function loadThrows() {
  const { data, error } = await supabase.from('throw_items').select('*').order('created_at', { ascending: false });
  if (error) return null; // schema_throw.sql 실행 전
  return data;
}

export async function addThrow(content) {
  return check(await supabase.from('throw_items').insert({ content: content.trim() }).select().single());
}

export async function deleteThrow(id) {
  check(await supabase.from('throw_items').delete().eq('id', id));
}

// ── 학급(담임): 명렬표·전달사항·출결·특이사항 ─────────
// 학생 정보는 본인만 볼 수 있음(행 단위 보안). AI 커넥터로는 내보내지 않음.

// 한 달(YYYY-MM) 치 학급 기록. 표가 아직 없으면 null
export async function loadClassMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const [students, notices, attendance, notes] = await Promise.all([
    supabase.from('class_students').select('*').order('number'),
    supabase.from('class_notices').select('*').gte('day', from).lt('day', to).order('position'),
    supabase.from('class_attendance').select('*').gte('day', from).lt('day', to),
    supabase.from('class_notes').select('*').order('day', { ascending: false }).limit(500),
  ]);
  if (students.error) return null;
  return { students: students.data, notices: notices.data ?? [], attendance: attendance.data ?? [], notes: notes.data ?? [] };
}

// 명렬표 저장: replace=true 면 기존 학생(과 그 기록)을 지우고 새로
// 기간(from~to, 포함) 학급 기록 전부: 내보내기·인쇄용
export async function loadClassRange(from, to) {
  const q = (t, col = 'day') => supabase.from(t).select('*').gte(col, from).lte(col, to);
  const [students, notices, attendance, notes, days, items] = await Promise.all([
    supabase.from('class_students').select('*').order('number'),
    q('class_notices'), q('class_attendance'), q('class_notes'), q('planner_days'), q('today_items'),
  ]);
  if (students.error) return null;
  return {
    students: students.data, notices: notices.data ?? [], attendance: attendance.data ?? [],
    notes: notes.data ?? [], days: days.data ?? [], items: items.data ?? [],
  };
}

// 던져 둔 것을 학급으로 보낼 때 쓰는 명렬표 (표가 없으면 [])
export async function loadStudents() {
  const { data, error } = await supabase.from('class_students').select('*').eq('active', true).order('number');
  return error ? [] : data;
}

// 일지 메모 끝에 한 줄 덧붙이기
export async function appendPlannerMemo(day, line) {
  const { data } = await supabase.from('planner_days').select('memo').eq('day', day).maybeSingle();
  const memo = data?.memo?.trim() ? `${data.memo.trim()}\n${line.trim()}` : line.trim();
  check(await supabase.from('planner_days').upsert({ day, memo, updated_at: now() }, { onConflict: 'user_id,day' }));
}

export async function saveRoster(rows, { replace = false } = {}) {
  if (replace) check(await supabase.from('class_students').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  if (rows.length) check(await supabase.from('class_students').insert(rows.map((r) => ({ number: r.number, name: r.name.trim(), student_code: r.code || null }))));
}

export async function updateStudent(id, patch) {
  check(await supabase.from('class_students').update(patch).eq('id', id));
}

export async function deleteStudent(id) {
  check(await supabase.from('class_students').delete().eq('id', id));
}

export async function addNotice({ day, kind, body, position }) {
  return check(await supabase.from('class_notices').insert({ day, kind, body: body.trim(), position }).select().single());
}

export async function updateNotice(id, patch) {
  check(await supabase.from('class_notices').update(patch).eq('id', id));
}

export async function deleteNotice(id) {
  check(await supabase.from('class_notices').delete().eq('id', id));
}

// 출결: 같은 학생·날짜·종류면 사유·메모만 바꿈
// days 를 주면 그 날들 모두(기간 결석) 같은 내용으로
export async function setAttendance({ studentId, day, days, type, reason, memo, periods, docs }) {
  const list = days?.length ? days : [day];
  check(await supabase.from('class_attendance').upsert(
    list.map((d) => ({ student_id: studentId, day: d, type, reason, memo: memo?.trim() || null, periods: periods || null, docs: docs?.trim() || null })),
    { onConflict: 'student_id,day,type' },
  ));
}

export async function clearAttendance(id) {
  check(await supabase.from('class_attendance').delete().eq('id', id));
}

export async function addClassNote({ studentId, day, body }) {
  check(await supabase.from('class_notes').insert({ student_id: studentId, day, body: body.trim() }));
}

export async function deleteClassNote(id) {
  check(await supabase.from('class_notes').delete().eq('id', id));
}

// 학년말 정리: 학급 기록 모두 지우기
export async function clearClassData() {
  check(await supabase.from('class_students').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
  check(await supabase.from('class_notices').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
}

// ── 일지(플래너): 날짜마다 메모·교시별 기록·하루 기록 ──────
// 표가 아직 없으면 null
export async function loadPlannerRange(from, to) {
  const [days, items, notices] = await Promise.all([
    supabase.from('planner_days').select('*').gte('day', from).lte('day', to),
    supabase.from('today_items').select('*').gte('day', from).lte('day', to).order('position'),
    supabase.from('class_notices').select('*').gte('day', from).lte('day', to).order('position'),
  ]);
  if (days.error) return null;
  return { days: days.data, items: (items.data ?? []).filter((i) => (i.scope ?? 'day') === 'day'), notices: notices.data ?? [] };
}

export async function savePlannerDay(day, patch) {
  check(await supabase.from('planner_days').upsert({ day, ...patch, updated_at: now() }, { onConflict: 'user_id,day' }));
}

// ── 관리자 ──────────────────────────────────

export async function adminOverview() {
  return check(await supabase.rpc('admin_overview'));
}

export async function adminSetSignupOpen(open) {
  check(await supabase.rpc('admin_set_signup_open', { open }));
}

export async function adminSetUserFlags(email, { advanced }) {
  check(await supabase.rpc('admin_set_user_flags', { target_email: email, advanced }));
}

// ── 업무 연결(선후 관계) ─────────────────────────

export async function loadLinks() {
  return check(await supabase.from('task_links').select('*'));
}

export async function addLink(fromTask, toTask) {
  check(await supabase.from('task_links').insert({ from_task_id: fromTask.id, to_task_id: toTask.id }));
  await logActivity(toTask.id, 'edit', `앞 업무 연결: ${fromTask.title}`);
}

export async function removeLink(linkId) {
  check(await supabase.from('task_links').delete().eq('id', linkId));
}
