import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';

const $app = document.getElementById('app');
const $logout = document.getElementById('logout');
const $toast = document.getElementById('toast');

const emptyDraft = () => ({ url: '', video: null, info: null, remindAt: '', category: '', categoryTouched: false });

const state = {
  user: null,
  items: [],
  categories: [],
  channelMap: {}, // 채널 → 카테고리 id (사용자가 옮긴 기록으로 학습)
  tab: 'todo', // 'todo' | 'done'
  filter: 'all', // 'all' | 'none'(미분류) | 카테고리 id
  manageOpen: false,
  draft: emptyDraft(),
  editingId: null,
  push: { status: 'checking', busy: false }, // checking | ios-install | unsupported | denied | off | on
};

// 유튜브 기본 분류(categoryId) → 처음 넣을 카테고리 이름
const YT_CATEGORIES = {
  1: '영화·애니',
  2: '자동차',
  10: '음악',
  15: '동물',
  17: '스포츠',
  19: '여행',
  20: '게임',
  22: '일상·브이로그',
  23: '코미디',
  24: '엔터테인먼트',
  25: '뉴스·시사',
  26: '노하우·스타일',
  27: '교육',
  28: '과학기술',
  29: '사회공헌',
};

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ───────────── 유틸 ─────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

// 공유된 글/링크에서 유튜브 영상 주소를 찾아냄
function parseYouTube(input) {
  const found = String(input || '').match(/https?:\/\/\S+/);
  const raw = (found ? found[0] : String(input || '')).trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com') {
    id = u.searchParams.get('v');
    if (!id) {
      const m = u.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{11})/);
      if (m) id = m[2];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  u.searchParams.delete('si');
  u.searchParams.delete('feature');
  return { id, url: u.toString(), thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Date → <input type="datetime-local"> 값 (내 기기 시간 기준)
function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((day(d) - day(now)) / 86400000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (diffDays === 0) return `오늘 ${time}`;
  if (diffDays === 1) return `내일 ${time}`;
  if (diffDays === -1) return `어제 ${time}`;
  const weekday = '일월화수목금토'[d.getDay()];
  const year = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}년 ` : '';
  return `${year}${d.getMonth() + 1}월 ${d.getDate()}일(${weekday}) ${time}`;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ───────────── 공유로 들어온 링크 ─────────────
// 안드로이드에서 유튜브 앱 공유 → 이 앱을 고르면 ?text=...&url=... 로 열림.
// 로그인 화면을 거쳐도 잃어버리지 않게 sessionStorage 에 잠시 보관.

function takeSharedLink() {
  const params = new URLSearchParams(location.search);
  const shared = ['url', 'text', 'title'].map((k) => params.get(k)).filter(Boolean).join(' ');
  if (shared) {
    const video = parseYouTube(shared);
    if (video) sessionStorage.setItem('pendingShare', video.url);
    ['url', 'text', 'title'].forEach((k) => params.delete(k));
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
  const pending = sessionStorage.getItem('pendingShare');
  if (pending && state.user) {
    sessionStorage.removeItem('pendingShare');
    setDraftUrl(pending);
    toast('공유한 영상을 불러왔어요. 알림 시간을 골라 주세요.');
  }
}

// ───────────── 데이터 ─────────────

async function loadItems() {
  const [items, cats, map] = await Promise.all([
    supabase.from('watch_items').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('channel_categories').select('channel_key, category_id'),
  ]);
  const error = items.error || cats.error || map.error;
  if (error) {
    toast('목록을 불러오지 못했어요');
    console.error(error);
    return;
  }
  state.items = items.data;
  state.categories = cats.data;
  state.channelMap = Object.fromEntries(map.data.map((m) => [m.channel_key, m.category_id]));
  if (state.filter !== 'all' && state.filter !== 'none' && !cats.data.some((c) => c.id === state.filter)) {
    state.filter = 'all';
  }
}

function categoryName(id) {
  return state.categories.find((c) => c.id === id)?.name ?? '미분류';
}

// 자동 분류: ① 이 채널을 전에 옮긴 적 있으면 그 카테고리 ② 같은 채널의 최근 영상이 있는 카테고리
// ③ 아니면 유튜브 기본 분류
// 돌려주는 값: 카테고리 id, 아직 없는 카테고리면 'new:이름', 모르면 ''(미분류)
function suggestCategory(info) {
  const key = info?.channel_key;
  const learned = key && state.channelMap[key];
  if (learned && state.categories.some((c) => c.id === learned)) return learned;
  const sameChannel = key && state.items.find((i) => i.channel_key === key && i.category_id); // 최신순 정렬
  if (sameChannel) return sameChannel.category_id;
  const name = YT_CATEGORIES[info?.yt_category_id];
  if (!name) return '';
  return state.categories.find((c) => c.name === name)?.id ?? `new:${name}`;
}

// 이름으로 카테고리를 찾고, 없으면 만듦
async function ensureCategory(name) {
  name = name.trim().slice(0, 30);
  const existing = state.categories.find((c) => c.name === name);
  if (existing) return existing.id;
  const { data, error } = await supabase.from('categories').insert({ name }).select('id, name').single();
  if (error) {
    // 다른 기기에서 같은 이름을 먼저 만든 경우
    const { data: found } = await supabase.from('categories').select('id, name').eq('name', name).maybeSingle();
    if (!found) throw error;
    state.categories.push(found);
    return found.id;
  }
  state.categories.push(data);
  state.categories.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return data.id;
}

async function resolveCategory(value) {
  if (!value) return null;
  if (value.startsWith('new:')) return ensureCategory(value.slice(4));
  return value;
}

// 사용자가 직접 고른 카테고리를 채널 단위로 기억
async function learnChannel(channelKey, categoryId) {
  if (!channelKey) return;
  if (!categoryId) {
    delete state.channelMap[channelKey];
    await supabase.from('channel_categories').delete().eq('channel_key', channelKey);
    return;
  }
  state.channelMap[channelKey] = categoryId;
  await supabase
    .from('channel_categories')
    .upsert({ channel_key: channelKey, category_id: categoryId, updated_at: new Date().toISOString() }, { onConflict: 'user_id,channel_key' });
}

let infoRequest = 0;
async function setDraftUrl(value) {
  const video = parseYouTube(value);
  state.draft.url = value;
  state.draft.video = video;
  state.draft.info = null;
  state.draft.category = '';
  state.draft.categoryTouched = false;
  render();
  if (!video) return;

  const req = ++infoRequest;
  const { data } = await supabase.functions.invoke('youtube-info', { body: { id: video.id } });
  if (req !== infoRequest) return; // 그 사이 다른 링크로 바뀐 경우
  state.draft.info = data && !data.error ? data : { title: null };
  if (!state.draft.categoryTouched) state.draft.category = suggestCategory(state.draft.info);
  render();
}

async function addItem() {
  const { video, info, remindAt, category, categoryTouched } = state.draft;
  if (!video) return toast('유튜브 영상 링크를 넣어 주세요');
  if (!remindAt) return toast('알림 받을 날짜와 시각을 골라 주세요');
  const when = new Date(remindAt);
  if (when.getTime() < Date.now() - 60000) return toast('지난 시각이에요. 앞으로의 시각을 골라 주세요');

  let categoryId = null;
  try {
    categoryId = await resolveCategory(category);
  } catch (e) {
    console.error(e);
  }
  const { error } = await supabase.from('watch_items').insert({
    url: video.url,
    video_id: video.id,
    title: info?.title || null,
    thumbnail_url: info?.thumbnail_url || video.thumbnail,
    channel_key: info?.channel_key || null,
    channel_title: info?.author || null,
    category_id: categoryId,
    remind_at: when.toISOString(),
  });
  if (error) {
    console.error(error);
    return toast('저장하지 못했어요. 잠시 후 다시 해 주세요');
  }
  if (categoryTouched) await learnChannel(info?.channel_key, categoryId);
  state.draft = emptyDraft();
  state.tab = 'todo';
  await loadItems();
  render();
  toast(`${formatWhen(when.toISOString())}에 알려 드릴게요`);
}

async function moveItem(item, value) {
  let categoryId;
  try {
    categoryId = await resolveCategory(value);
  } catch {
    return toast('카테고리를 만들지 못했어요');
  }
  const { error } = await supabase.from('watch_items').update({ category_id: categoryId }).eq('id', item.id);
  if (error) return toast('옮기지 못했어요');
  await learnChannel(item.channel_key, categoryId);
  await loadItems();
  render();
  toast(
    item.channel_title && categoryId
      ? `앞으로 '${item.channel_title}' 영상은 '${categoryName(categoryId)}'에 넣을게요`
      : `'${categoryName(categoryId)}'(으)로 옮겼어요`,
  );
}

async function addCategory() {
  const name = prompt('새 카테고리 이름')?.trim();
  if (!name) return;
  try {
    await ensureCategory(name);
  } catch {
    return toast('만들지 못했어요');
  }
  render();
}

async function renameCategory(id) {
  const name = prompt('카테고리 이름 바꾸기', categoryName(id))?.trim();
  if (!name || name === categoryName(id)) return;
  const { error } = await supabase.from('categories').update({ name: name.slice(0, 30) }).eq('id', id);
  if (error) return toast(error.code === '23505' ? '같은 이름의 카테고리가 이미 있어요' : '바꾸지 못했어요');
  await loadItems();
  render();
}

async function deleteCategory(id) {
  if (!confirm(`'${categoryName(id)}' 카테고리를 지울까요? 안에 있던 영상은 '미분류'로 옮겨져요.`)) return;
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) return toast('지우지 못했어요');
  await loadItems();
  render();
}

async function updateItem(id, patch, message) {
  const { error } = await supabase.from('watch_items').update(patch).eq('id', id);
  if (error) {
    console.error(error);
    return toast('바꾸지 못했어요. 잠시 후 다시 해 주세요');
  }
  await loadItems();
  render();
  if (message) toast(message);
}

async function deleteItem(id) {
  if (!confirm('이 영상을 목록에서 지울까요?')) return;
  const { error } = await supabase.from('watch_items').delete().eq('id', id);
  if (error) return toast('지우지 못했어요');
  await loadItems();
  render();
}

// ───────────── 푸시 알림 ─────────────

async function checkPush() {
  if (isIOS && !isStandalone) return (state.push.status = 'ios-install');
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return (state.push.status = 'unsupported');
  }
  if (Notification.permission === 'denied') return (state.push.status = 'denied');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') {
    // 서버 목록에 이 기기가 빠져 있을 수도 있어서 다시 저장
    await saveSubscription(sub).catch(() => {});
    state.push.status = 'on';
  } else {
    state.push.status = 'off';
  }
}

async function saveSubscription(sub) {
  const { endpoint, keys } = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent.slice(0, 300) },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

async function enablePush() {
  state.push.busy = true;
  render();
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      state.push.status = permission === 'denied' ? 'denied' : 'off';
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
    await saveSubscription(sub);
    state.push.status = 'on';
    toast('이 기기에서 알림을 받아요');
  } catch (e) {
    console.error(e);
    toast('알림을 켜지 못했어요. 잠시 후 다시 해 주세요');
  } finally {
    state.push.busy = false;
    render();
  }
}

// 이 기기의 알림을 끄고 서버 목록에서도 지움 (로그아웃할 때도 사용)
async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
  state.push.status = 'off';
}

async function testPush() {
  state.push.busy = true;
  render();
  const { data, error } = await supabase.functions.invoke('send-due-reminders', { body: { test: true } });
  state.push.busy = false;
  render();
  if (error || data?.error) return toast('테스트 알림을 보내지 못했어요');
  toast(data.sent > 0 ? `테스트 알림을 보냈어요 (기기 ${data.sent}대)` : '알림 받을 기기가 없어요. 알림을 다시 켜 주세요');
}

// ───────────── 화면 ─────────────

function renderSetupNeeded() {
  $app.innerHTML = `
    <div class="card">
      <h2>설정이 필요해요</h2>
      <p class="muted">config.js 에 Supabase 주소와 키, 알림용 공개 키를 넣어 주세요. 자세한 방법은 README.md 에 있어요.</p>
    </div>`;
}

function renderLogin() {
  $logout.hidden = true;
  $app.innerHTML = `
    <div class="card center">
      <p style="font-size:40px;margin:8px 0">🔔</p>
      <h2>보고 싶은 영상, 잊지 말고 보세요</h2>
      <p class="muted">유튜브 링크와 시간을 저장해 두면<br />그 시간에 휴대폰으로 알려 드려요.</p>
      <button class="btn primary block" data-action="login">구글 계정으로 시작하기</button>
      ${sessionStorage.getItem('pendingShare') ? '<p class="small muted">로그인하면 공유한 영상을 바로 저장할 수 있어요.</p>' : ''}
    </div>`;
}

function renderPushNotice() {
  const { status, busy } = state.push;
  switch (status) {
    case 'ios-install':
      return `
        <div class="notice">
          <p><b>아이폰은 홈 화면에 추가해야 알림이 와요.</b></p>
          <ol>
            <li>사파리 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 누르고</li>
            <li><b>홈 화면에 추가</b>를 누른 뒤</li>
            <li>홈 화면에 생긴 아이콘으로 앱을 열어 알림을 켜 주세요.</li>
          </ol>
          <p class="small muted">iOS 16.4 이상에서만 돼요.</p>
        </div>`;
    case 'unsupported':
      return `<div class="notice"><p>이 브라우저는 알림을 지원하지 않아요. 안드로이드는 크롬, 아이폰은 사파리에서 열어 주세요.</p></div>`;
    case 'denied':
      return `<div class="notice"><p><b>알림이 차단되어 있어요.</b> 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용한 뒤 새로고침해 주세요.</p></div>`;
    case 'off':
      return `
        <div class="notice">
          <p>이 기기에서 알림을 받으려면 알림을 켜 주세요.</p>
          <button class="btn primary" data-action="push-on" ${busy ? 'disabled' : ''}>🔔 이 기기에서 알림 받기</button>
        </div>`;
    case 'on':
      return `
        <div class="notice row" style="align-items:center;justify-content:space-between;flex-wrap:wrap">
          <span>🔔 이 기기에서 알림을 받고 있어요</span>
          <span class="row">
            <button class="btn sm" data-action="push-test" ${busy ? 'disabled' : ''}>테스트</button>
            <button class="btn sm" data-action="push-off">끄기</button>
          </span>
        </div>`;
    default:
      return '';
  }
}

// 카테고리 고르는 <select> 의 선택지. value 가 'new:이름'이면 새로 만들 카테고리로 보여 줌
function categoryOptions(value) {
  const pendingNew = value?.startsWith('new:') ? value.slice(4) : null;
  return [
    `<option value="" ${!value ? 'selected' : ''}>미분류</option>`,
    ...state.categories.map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`),
    pendingNew ? `<option value="${esc(value)}" selected>${esc(pendingNew)} (새로 만들기)</option>` : '',
    '<option value="__new">+ 새 카테고리…</option>',
  ].join('');
}

function renderAddForm() {
  const { url, video, info, remindAt, category } = state.draft;
  const min = toLocalInput(new Date());
  let preview = '';
  if (url && !video) {
    preview = `<p class="small" style="color:var(--danger);margin:8px 0 0">유튜브 영상 링크가 아닌 것 같아요.</p>`;
  } else if (video) {
    const title = info ? info.title || '(제목을 가져오지 못했어요)' : '제목 가져오는 중…';
    preview = `
      <div class="preview">
        <img src="${esc(info?.thumbnail_url || video.thumbnail)}" alt="" />
        <div>
          <div class="title">${esc(title)}</div>
          ${info?.author ? `<div class="small muted">${esc(info.author)}</div>` : ''}
        </div>
      </div>`;
  }

  return `
    <form class="card" data-form="add">
      <h2>영상 추가</h2>
      <div class="row">
        <input type="url" name="url" placeholder="유튜브 링크 붙여넣기" value="${esc(url)}" autocomplete="off" inputmode="url" />
        ${navigator.clipboard?.readText ? '<button type="button" class="btn" data-action="paste">붙여넣기</button>' : ''}
      </div>
      ${preview}
      ${
        video
          ? `<label class="label" for="draft-category">카테고리 ${info && !state.draft.categoryTouched && category ? '<span class="small">· 자동으로 골랐어요</span>' : ''}</label>
             <select id="draft-category" name="category">${categoryOptions(category)}</select>`
          : ''
      }
      <label class="label" for="remind-at">알림 받을 날짜·시각</label>
      <input type="datetime-local" id="remind-at" name="remindAt" min="${min}" value="${esc(remindAt)}" />
      <button type="submit" class="btn primary block" style="margin-top:12px">저장하기</button>
    </form>`;
}

function itemStatus(item) {
  if (item.watched_at) return `<span class="done">✓ ${formatWhen(item.watched_at)} 시청 완료</span>`;
  if (!item.remind_at) return '알림 없음';
  const when = formatWhen(item.remind_at);
  if (!item.notified_at) {
    return new Date(item.remind_at) > new Date() ? `🔔 ${when} 알림 예정` : `🔔 곧 알림이 가요 (${when})`;
  }
  if (item.notify_status === 'no_device') return `<span class="warn">⚠ ${when} · 알림 받을 기기가 없었어요</span>`;
  if (item.notify_status === 'failed') return `<span class="warn">⚠ ${when} · 알림을 보내지 못했어요</span>`;
  return `${when} 알림 보냄`;
}

function renderItem(item) {
  const editing = state.editingId === item.id;
  const title = item.title || item.url;
  return `
    <div class="item">
      <a class="thumb" href="${esc(item.url)}" target="_blank" rel="noopener">
        ${item.thumbnail_url ? `<img src="${esc(item.thumbnail_url)}" alt="" loading="lazy" />` : ''}
      </a>
      <div class="body">
        <a class="title" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(title)}</a>
        <div class="meta">
          ${item.channel_title ? `${esc(item.channel_title)}<br />` : ''}${itemStatus(item)}
        </div>
        <select class="cat-select" data-item-category="${item.id}" aria-label="카테고리">${categoryOptions(item.category_id ?? '')}</select>
        <div class="actions">
          ${
            item.watched_at
              ? `<button class="btn sm" data-action="unwatch" data-id="${item.id}">다시 볼래요</button>`
              : `<button class="btn sm" data-action="watched" data-id="${item.id}">✓ 다 봤어요</button>
                 <button class="btn sm" data-action="edit" data-id="${item.id}">시간 변경</button>`
          }
          <button class="btn sm danger" data-action="delete" data-id="${item.id}">삭제</button>
        </div>
        ${
          editing
            ? `<form class="edit row" data-form="reschedule" data-id="${item.id}">
                 <input type="datetime-local" name="remindAt" min="${toLocalInput(new Date())}"
                   value="${item.remind_at ? toLocalInput(new Date(item.remind_at)) : ''}" required />
                 <button class="btn sm primary">저장</button>
               </form>`
            : ''
        }
      </div>
    </div>`;
}

function renderList() {
  const todo = state.items
    .filter((i) => !i.watched_at)
    .sort((a, b) => (a.remind_at || '9999').localeCompare(b.remind_at || '9999'));
  const done = state.items
    .filter((i) => i.watched_at)
    .sort((a, b) => b.watched_at.localeCompare(a.watched_at));
  const tabList = state.tab === 'todo' ? todo : done;
  const inFilter = (i) =>
    state.filter === 'all' || (state.filter === 'none' ? !i.category_id : i.category_id === state.filter);
  const list = tabList.filter(inFilter);
  const empty = state.filter !== 'all'
    ? '이 카테고리에는 영상이 없어요.'
    : state.tab === 'todo' ? '아직 저장한 영상이 없어요.' : '다 본 영상이 여기에 모여요.';

  const count = (pred) => tabList.filter(pred).length;
  const chip = (value, label, n) =>
    `<button class="chip" data-action="filter" data-filter="${value}" aria-pressed="${state.filter === value}">${esc(label)} ${n}</button>`;
  const uncategorized = count((i) => !i.category_id);
  const chips = [
    chip('all', '전체', tabList.length),
    ...state.categories.map((c) => chip(c.id, c.name, count((i) => i.category_id === c.id))),
    uncategorized || state.filter === 'none' ? chip('none', '미분류', uncategorized) : '',
  ].join('');

  return `
    <div class="card">
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" data-action="tab" data-tab="todo" aria-selected="${state.tab === 'todo'}">볼 영상 ${todo.length}</button>
        <button class="tab" role="tab" data-action="tab" data-tab="done" aria-selected="${state.tab === 'done'}">다 본 영상 ${done.length}</button>
      </div>
      <div class="chips filter-chips">
        ${chips}
        <button class="chip ghost" data-action="manage" aria-pressed="${state.manageOpen}">⚙ 카테고리 관리</button>
      </div>
      ${state.manageOpen ? renderCategoryManager() : ''}
      ${list.length ? list.map(renderItem).join('') : `<div class="empty">${empty}</div>`}
    </div>`;
}

function renderCategoryManager() {
  const rows = state.categories
    .map(
      (c) => `
        <div class="cat-row">
          <span>${esc(c.name)} <span class="muted small">${state.items.filter((i) => i.category_id === c.id).length}</span></span>
          <span class="row">
            <button class="btn sm" data-action="cat-rename" data-id="${c.id}">이름 바꾸기</button>
            <button class="btn sm danger" data-action="cat-delete" data-id="${c.id}">삭제</button>
          </span>
        </div>`,
    )
    .join('');
  return `
    <div class="cat-manager">
      ${rows || '<p class="muted small">아직 카테고리가 없어요. 영상을 저장하면 자동으로 만들어져요.</p>'}
      <button class="btn sm" data-action="cat-add">+ 새 카테고리</button>
      <p class="muted small">영상의 카테고리를 바꾸면, 같은 채널의 다음 영상부터는 바꾼 카테고리로 자동으로 들어가요.</p>
    </div>`;
}

function render() {
  if (!supabase) return renderSetupNeeded();
  if (!state.user) return renderLogin();

  $logout.hidden = false;
  // 입력 중인 칸의 커서 위치를 지키기 위해, 다시 그린 뒤 포커스를 되돌림
  const active = document.activeElement;
  const focusName = active && $app.contains(active) ? active.name : null;

  $app.innerHTML = `
    ${renderPushNotice()}
    ${renderAddForm()}
    ${renderList()}
    <p class="small muted center">
      ${esc(state.user.email)} 로 로그인됨 ·
      <button class="link small" data-action="delete-account">회원 탈퇴</button>
    </p>`;

  if (focusName === 'url') {
    const input = $app.querySelector('input[name="url"]');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

// ───────────── 이벤트 ─────────────

$app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;

  switch (action) {
    case 'login':
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
      break;
    case 'paste':
      try {
        setDraftUrl(await navigator.clipboard.readText());
      } catch {
        toast('붙여넣기를 할 수 없어요. 입력칸을 길게 눌러 붙여넣어 주세요');
      }
      break;
    case 'tab':
      state.tab = el.dataset.tab;
      render();
      break;
    case 'filter':
      state.filter = el.dataset.filter;
      render();
      break;
    case 'manage':
      state.manageOpen = !state.manageOpen;
      render();
      break;
    case 'cat-add':
      addCategory();
      break;
    case 'cat-rename':
      renameCategory(id);
      break;
    case 'cat-delete':
      deleteCategory(id);
      break;
    case 'watched':
      updateItem(id, { watched_at: new Date().toISOString() }, '다 본 영상으로 옮겼어요');
      break;
    case 'unwatch':
      updateItem(id, { watched_at: null }, '볼 영상으로 되돌렸어요');
      break;
    case 'edit':
      state.editingId = state.editingId === id ? null : id;
      render();
      break;
    case 'delete':
      deleteItem(id);
      break;
    case 'push-on':
      enablePush();
      break;
    case 'push-off':
      await disablePush();
      render();
      toast('이 기기의 알림을 껐어요');
      break;
    case 'push-test':
      testPush();
      break;
    case 'delete-account':
      if (!confirm('정말 탈퇴할까요? 저장한 영상과 알림 설정이 모두 지워지고 되돌릴 수 없어요.')) return;
      await disablePush().catch(() => {});
      {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) return toast('탈퇴하지 못했어요. 잠시 후 다시 해 주세요');
      }
      await supabase.auth.signOut();
      toast('탈퇴했어요. 그동안 고마웠어요');
      break;
  }
});

let urlTimer;
$app.addEventListener('input', (e) => {
  if (e.target.name === 'url') {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => setDraftUrl(e.target.value), 400);
  } else if (e.target.id === 'remind-at') {
    state.draft.remindAt = e.target.value;
  }
});

$app.addEventListener('change', (e) => {
  const select = e.target;
  if (select.tagName !== 'SELECT') return;
  let value = select.value;
  if (value === '__new') {
    const name = prompt('새 카테고리 이름')?.trim();
    if (!name) return render(); // 취소하면 원래 선택으로 되돌림
    value = state.categories.find((c) => c.name === name)?.id ?? `new:${name}`;
  }
  if (select.name === 'category') {
    state.draft.category = value;
    state.draft.categoryTouched = true;
    render();
  } else if (select.dataset.itemCategory) {
    const item = state.items.find((i) => i.id === select.dataset.itemCategory);
    if (item) moveItem(item, value);
  }
});

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  if (form.dataset.form === 'add') {
    clearTimeout(urlTimer);
    const url = form.url.value;
    state.draft.remindAt = form.remindAt.value;
    // 붙여넣고 바로 저장을 누른 경우도 처리
    if (url !== state.draft.url) {
      state.draft.url = url;
      state.draft.video = parseYouTube(url);
    }
    addItem();
  } else if (form.dataset.form === 'reschedule') {
    const when = new Date(form.remindAt.value);
    if (when.getTime() < Date.now() - 60000) return toast('앞으로의 시각을 골라 주세요');
    state.editingId = null;
    updateItem(
      form.dataset.id,
      { remind_at: when.toISOString(), notified_at: null, notify_status: null },
      `${formatWhen(when.toISOString())}에 알려 드릴게요`,
    );
  }
});

$logout.addEventListener('click', async () => {
  await disablePush().catch(() => {});
  await supabase.auth.signOut();
});

// 앱으로 돌아왔을 때 목록 새로고침 (알림 상태 반영)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && state.user) {
    await loadItems();
    render();
  }
});

// ───────────── 시작 ─────────────

async function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  if (!supabase) return render();

  takeSharedLink();

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (user?.id === state.user?.id) return;
    state.user = user;
    if (!user) {
      state.items = [];
      return render();
    }
    // onAuthStateChange 안에서 바로 await 하면 supabase-js 가 멈출 수 있어 다음 틱에서 실행
    setTimeout(async () => {
      takeSharedLink();
      render();
      await Promise.all([loadItems(), checkPush()]);
      render();
    }, 0);
  });

  const { data } = await supabase.auth.getSession();
  if (!data.session) render();
}

start();
