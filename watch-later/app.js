import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';
import { renderInsights } from './insights.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $logout = document.getElementById('logout');
const $toast = document.getElementById('toast');
const $sheet = document.getElementById('sheet');

const state = {
  user: null,
  items: [],
  categories: [],
  channelMap: {}, // 채널 → 카테고리 id (사용자가 옮긴 기록으로 학습)
  page: 'add', // 'add'(영상 추가) | 'my'(내 영상) | 'insights'(내 관심사)
  tab: 'todo', // 'todo' | 'done'
  filter: 'all', // 'all' | 'none'(미분류) | 카테고리 id
  manageOpen: false,
  search: '',
  minutes: 0, // '지금 몇 분 있어요' 필터 (0 = 상관없음)
  goodOnly: false, // 다 본 영상 중 별점 4점 이상만
  settings: null, // user_settings (주간 정리 알림)
  cleanup: null, // 정리 도우미: 남은 영상 id 목록
  adding: false,
  lastAddedId: null,
  detailId: null,
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
  // 상세 창이 열려 있으면 창 위에 보이도록 창 안으로 옮김
  ($sheet.open ? $sheet : document.body).append($toast);
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

// 3750 → "1:02:30", 754 → "12:34"
function formatDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const DAY = 86400000;

// 한 달 넘게 안 본 영상 (앞으로 알림이 잡혀 있거나, 최근 한 달 안에 "아직 볼래요"를 누른 건 제외)
function staleItems() {
  const monthAgo = Date.now() - 30 * DAY;
  return state.items.filter(
    (i) =>
      !i.watched_at &&
      new Date(i.created_at).getTime() < monthAgo &&
      !(i.kept_at && new Date(i.kept_at).getTime() >= monthAgo) &&
      !(i.remind_at && !i.notified_at),
  );
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ───────────── 화면 이동 (#/ = 영상 추가, #/my = 내 영상, #/insights = 내 관심사) ─────────────

function pageFromHash() {
  if (location.hash.startsWith('#/my')) return 'my';
  if (location.hash.startsWith('#/insights')) return 'insights';
  return 'add';
}

function go(page) {
  location.hash = page === 'add' ? '#/' : `#/${page}`;
}

window.addEventListener('hashchange', () => {
  state.page = pageFromHash();
  render();
  scrollTo(0, 0);
});

// ───────────── 공유로 들어온 링크 ─────────────
// 안드로이드에서 유튜브 앱 공유 → 이 앱을 고르면 ?text=...&url=... 로 열림 → 바로 저장.
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
    return pending;
  }
  return null;
}

// ───────────── 데이터 ─────────────

async function loadItems() {
  const [items, cats, map, settings] = await Promise.all([
    supabase.from('watch_items').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('channel_categories').select('channel_key, category_id'),
    supabase.from('user_settings').select('*').maybeSingle(),
  ]);
  const error = items.error || cats.error || map.error || settings.error;
  if (error) {
    toast('목록을 불러오지 못했어요');
    console.error(error);
    return;
  }
  state.items = items.data;
  state.categories = cats.data;
  state.channelMap = Object.fromEntries(map.data.map((m) => [m.channel_key, m.category_id]));
  state.settings = settings.data;
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

// 링크 하나로 저장: 제목·채널·카테고리는 알아서 채움. 알림 시간은 나중에 내 영상에서.
async function addItem(input) {
  const video = parseYouTube(input);
  if (!video) return toast('유튜브 영상 링크를 넣어 주세요');

  const dup = state.items.find((i) => i.video_id === video.id && !i.watched_at);
  if (dup) {
    state.lastAddedId = dup.id;
    render();
    return toast('이미 저장한 영상이에요');
  }

  state.adding = true;
  render();
  try {
    const { data } = await supabase.functions.invoke('youtube-info', { body: { id: video.id } });
    const info = data && !data.error ? data : {};
    let categoryId = null;
    try {
      categoryId = await resolveCategory(suggestCategory(info));
    } catch (e) {
      console.error(e);
    }
    const { data: row, error } = await supabase
      .from('watch_items')
      .insert({
        url: video.url,
        video_id: video.id,
        title: info.title || null,
        thumbnail_url: info.thumbnail_url || video.thumbnail,
        channel_key: info.channel_key || null,
        channel_title: info.author || null,
        category_id: categoryId,
        duration_sec: info.duration_sec || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    state.lastAddedId = row.id;
    await loadItems();
    toast(categoryId ? `'${categoryName(categoryId)}'에 저장했어요` : '저장했어요');
  } catch (e) {
    console.error(e);
    toast('저장하지 못했어요. 잠시 후 다시 해 주세요');
  } finally {
    state.adding = false;
    render();
  }
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
  if (!confirm('이 영상을 지울까요?')) return;
  const { error } = await supabase.from('watch_items').delete().eq('id', id);
  if (error) return toast('지우지 못했어요');
  if (state.lastAddedId === id) state.lastAddedId = null;
  closeDetail();
  await loadItems();
  render();
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

async function saveSettings(patch) {
  const next = {
    digest_enabled: false,
    digest_dow: 0,
    digest_hour: 20,
    ...state.settings,
    ...patch,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
    app_url: location.origin + location.pathname,
    updated_at: new Date().toISOString(),
  };
  delete next.user_id;
  delete next.last_digest_at;
  const { data, error } = await supabase.from('user_settings').upsert(next, { onConflict: 'user_id' }).select().single();
  if (error) {
    console.error(error);
    return toast('설정을 저장하지 못했어요');
  }
  state.settings = data;
  render();
  toast(data.digest_enabled ? `매주 ${WEEKDAY_NAMES[data.digest_dow]}요일 ${data.digest_hour}시에 정리해 드릴게요` : '주간 정리 알림을 껐어요');
}

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

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

// ───────────── 화면 조각 ─────────────

function renderSetupNeeded() {
  $app.innerHTML = `
    <div class="card">
      <h2>설정이 필요해요</h2>
      <p class="muted">config.js 에 Supabase 주소와 키, 알림용 공개 키를 넣어 주세요. 자세한 방법은 README.md 에 있어요.</p>
    </div>`;
}

function renderLogin() {
  $app.innerHTML = `
    <div class="card center">
      <p style="font-size:40px;margin:8px 0">🔔</p>
      <h2>보고 싶은 영상, 잊지 말고 보세요</h2>
      <p class="muted">유튜브 링크를 저장해 두면<br />원하는 시간에 휴대폰으로 알려 드려요.</p>
      <button class="btn primary block" data-action="login">구글 계정으로 시작하기</button>
      ${sessionStorage.getItem('pendingShare') ? '<p class="small muted">로그인하면 공유한 영상이 바로 저장돼요.</p>' : ''}
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

// 카테고리 고르는 <select> 의 선택지
function categoryOptions(value) {
  return [
    `<option value="" ${!value ? 'selected' : ''}>미분류</option>`,
    ...state.categories.map((c) => `<option value="${c.id}" ${c.id === value ? 'selected' : ''}>${esc(c.name)}</option>`),
    '<option value="__new">+ 새 카테고리…</option>',
  ].join('');
}

// 썸네일 위 작은 표시 (알림 예정 / 시청 완료 / 알림 문제)
function badge(item) {
  const dur = item.duration_sec ? `<span class="badge dur">${formatDuration(item.duration_sec)}</span>` : '';
  return statusBadge(item) + dur;
}

function statusBadge(item) {
  if (item.watched_at) return `<span class="badge done">✓ 봤어요${item.rating ? ` · ${'★'.repeat(item.rating)}` : ''}</span>`;
  if (!item.remind_at) return '';
  if (item.notified_at && item.notify_status !== 'sent') return '<span class="badge warn">⚠ 알림 실패</span>';
  if (item.notified_at) return '';
  return `<span class="badge">🔔 ${esc(formatWhen(item.remind_at))}</span>`;
}

function renderFrame(item, { large = false } = {}) {
  const title = item.title || item.url;
  return `
    <figure class="frame ${large ? 'large' : ''}">
      <div class="mat">
        <img src="${esc(item.thumbnail_url || `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`)}" alt="" loading="lazy"
          onerror="this.style.visibility='hidden'" />
        ${badge(item)}
      </div>
      <figcaption>
        <span class="title">${esc(title)}</span>
        <span class="sub">${esc(categoryName(item.category_id))}${item.channel_title ? ` · ${esc(item.channel_title)}` : ''}</span>
      </figcaption>
    </figure>`;
}

// ───────────── 페이지: 영상 추가 ─────────────

function renderAddPage() {
  const last = state.items.find((i) => i.id === state.lastAddedId);
  return `
    ${renderPushNotice()}
    <form class="add-box" data-form="add">
      <h2>보고 싶은 영상 링크를 넣어 주세요</h2>
      <input type="url" name="url" placeholder="https://youtu.be/…" autocomplete="off" inputmode="url" ${state.adding ? 'disabled' : ''} />
      <div class="row">
        ${navigator.clipboard?.readText ? `<button type="button" class="btn" data-action="paste" ${state.adding ? 'disabled' : ''}>📋 붙여넣기</button>` : ''}
        <button type="submit" class="btn primary grow" ${state.adding ? 'disabled' : ''}>${state.adding ? '저장하는 중…' : '저장'}</button>
      </div>
      <p class="small muted">제목과 카테고리는 알아서 정리돼요. 알림 시간은 내 영상에서 정할 수 있어요.</p>
    </form>
    ${
      last
        ? `<div class="just-added">
             <p class="small muted">방금 저장한 영상</p>
             <button class="frame-btn" data-action="open" data-id="${last.id}">${renderFrame(last)}</button>
             <div class="row">
               <button class="btn grow" data-action="open" data-id="${last.id}">🔔 알림 시간 정하기</button>
               <button class="btn grow" data-action="go-my">내 영상 보기 →</button>
             </div>
           </div>`
        : ''
    }`;
}

// ───────────── 페이지: 내 영상 (액자 갤러리) ─────────────

function renderMyPage() {
  const todo = state.items
    .filter((i) => !i.watched_at)
    .sort((a, b) => (a.remind_at || '9999').localeCompare(b.remind_at || '9999') || b.created_at.localeCompare(a.created_at));
  const done = state.items.filter((i) => i.watched_at).sort((a, b) => b.watched_at.localeCompare(a.watched_at));
  const q = state.search.trim().toLowerCase();
  const matches = (i) =>
    !q || [i.title, i.channel_title, i.memo].some((t) => String(t || '').toLowerCase().includes(q));
  const fitsTime = (i) => state.tab !== 'todo' || !state.minutes || (i.duration_sec && i.duration_sec <= state.minutes * 60);
  const isGood = (i) => state.tab !== 'done' || !state.goodOnly || i.rating >= 4;
  const tabList = (state.tab === 'todo' ? todo : done).filter((i) => matches(i) && fitsTime(i) && isGood(i));
  const inFilter = (i) =>
    state.filter === 'all' || (state.filter === 'none' ? !i.category_id : i.category_id === state.filter);
  const list = tabList.filter(inFilter);
  // 시간 필터를 켜면 주어진 시간을 가장 알차게 채우는 긴 영상부터
  if (state.tab === 'todo' && state.minutes) list.sort((a, b) => b.duration_sec - a.duration_sec);
  const stale = state.tab === 'todo' ? staleItems() : [];
  const empty =
    q
      ? `'${esc(state.search)}'(으)로 찾은 영상이 없어요.`
      : state.tab === 'todo' && state.minutes
        ? `${state.minutes}분 안에 볼 수 있는 영상이 없어요.<br /><span class="small">(길이를 아는 영상만 골라져요)</span>`
        : state.tab === 'done' && state.goodOnly
          ? '별점 4점 이상인 영상이 아직 없어요.'
          : state.filter !== 'all'
      ? '이 카테고리에는 영상이 없어요.'
      : state.tab === 'todo'
        ? '아직 저장한 영상이 없어요.<br /><a href="#/">영상 추가하러 가기 →</a>'
        : '다 본 영상이 여기에 모여요.';

  const count = (pred) => tabList.filter(pred).length;
  const chip = (value, label, n) =>
    `<button class="chip" data-action="filter" data-filter="${value}" aria-pressed="${state.filter === value}">${esc(label)} ${n}</button>`;
  const uncategorized = count((i) => !i.category_id);
  const chips = [
    chip('all', '전체', tabList.length),
    ...state.categories.map((c) => chip(c.id, c.name, count((i) => i.category_id === c.id))),
    uncategorized || state.filter === 'none' ? chip('none', '미분류', uncategorized) : '',
  ].join('');

  const minuteChip = (m, label) =>
    `<button class="chip" data-action="minutes" data-minutes="${m}" aria-pressed="${state.minutes === m}">${label}</button>`;

  return `
    <input type="search" class="search" name="search" placeholder="🔍 제목·채널·메모로 찾기" value="${esc(state.search)}" autocomplete="off" />
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-action="tab" data-tab="todo" aria-selected="${state.tab === 'todo'}">볼 영상 ${todo.length}</button>
      <button class="tab" role="tab" data-action="tab" data-tab="done" aria-selected="${state.tab === 'done'}">다 본 영상 ${done.length}</button>
    </div>
    ${
      stale.length && !q
        ? `<div class="notice row cleanup-notice">
             <span>🧹 한 달 넘게 안 본 영상이 <b>${stale.length}개</b> 있어요.</span>
             <button class="btn sm" data-action="cleanup-start">정리하기</button>
           </div>`
        : ''
    }
    ${
      state.tab === 'todo'
        ? `<div class="chips time-chips">
             <span class="chips-label">⏱ 지금 몇 분 있어요?</span>
             ${minuteChip(5, '5분')}${minuteChip(15, '15분')}${minuteChip(30, '30분')}${minuteChip(60, '1시간')}
           </div>`
        : `<div class="chips time-chips">
             <button class="chip" data-action="good" aria-pressed="${state.goodOnly}">⭐ 좋았던 영상만</button>
           </div>`
    }
    <div class="chips filter-chips">
      ${chips}
      <button class="chip ghost" data-action="manage" aria-pressed="${state.manageOpen}">⚙ 관리</button>
    </div>
    ${state.manageOpen ? renderCategoryManager() : ''}
    ${
      list.length
        ? `<div class="gallery">${list
            .map((i) => `<button class="frame-btn" data-action="open" data-id="${i.id}">${renderFrame(i)}</button>`)
            .join('')}</div>`
        : `<div class="empty">${empty}</div>`
    }
    <p class="small muted center account">
      ${esc(state.user.email)} 로 로그인됨 ·
      <button class="link small" data-action="delete-account">회원 탈퇴</button>
    </p>`;
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

// ───────────── 주간 정리 알림 설정 (내 관심사 화면 아래) ─────────────

function renderDigestSettings() {
  const s = { digest_enabled: false, digest_dow: 0, digest_hour: 20, ...state.settings };
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hourLabel = (h) => (h === 0 ? '밤 12시' : h < 12 ? `오전 ${h}시` : h === 12 ? '낮 12시' : `오후 ${h - 12}시`);
  return `
    <section class="card digest">
      <label class="switch-row">
        <span>
          <b>📺 주간 정리 알림</b><br />
          <span class="small muted">일주일에 한 번, 안 본 영상과 이번 주 기록을 알려 드려요.</span>
        </span>
        <input type="checkbox" name="digest_enabled" ${s.digest_enabled ? 'checked' : ''} />
      </label>
      ${
        s.digest_enabled
          ? `<div class="row" style="margin-top:12px">
               <select name="digest_dow" aria-label="요일">
                 ${WEEKDAY_NAMES.map((d, i) => `<option value="${i}" ${i === s.digest_dow ? 'selected' : ''}>매주 ${d}요일</option>`).join('')}
               </select>
               <select name="digest_hour" aria-label="시각">
                 ${hours.map((h) => `<option value="${h}" ${h === s.digest_hour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}
               </select>
             </div>
             ${state.push.status !== 'on' ? '<p class="small warn" style="margin:8px 0 0">이 기기에서 알림을 켜야 받을 수 있어요. (영상 추가 화면에서 켜기)</p>' : ''}`
          : ''
      }
    </section>`;
}

// ───────────── 영상 상세 (아래에서 올라오는 창) ─────────────

function remindStatus(item) {
  if (!item.remind_at) return '알림 없음';
  const when = formatWhen(item.remind_at);
  if (!item.notified_at) return new Date(item.remind_at) > new Date() ? `${when}에 알려 드려요` : '곧 알림이 가요';
  if (item.notify_status === 'no_device') return `⚠ ${when} · 알림 받을 기기가 없었어요`;
  if (item.notify_status === 'failed') return `⚠ ${when} · 알림을 보내지 못했어요`;
  return `${when}에 알림을 보냈어요`;
}

function renderDetail() {
  const item = state.items.find((i) => i.id === state.detailId);
  if (!item) return closeDetail();
  const pendingRemind = item.remind_at && !item.notified_at;
  $sheet.innerHTML = `
    <div class="sheet-body">
      <button class="link sheet-close" data-action="close" aria-label="닫기">✕</button>
      ${renderFrame(item, { large: true })}
      <a class="btn primary block" href="${esc(item.url)}" target="_blank" rel="noopener">▶ 영상 보기</a>

      ${
        item.watched_at
          ? `<div class="section review">
               <span class="label">어땠어요?</span>
               <div class="stars" role="group" aria-label="별점">
                 ${[1, 2, 3, 4, 5]
                   .map(
                     (n) =>
                       `<button class="star ${item.rating >= n ? 'on' : ''}" data-action="rate" data-value="${n}" aria-label="${n}점">★</button>`,
                   )
                   .join('')}
               </div>
               <form class="row" data-form="memo">
                 <input type="text" name="memo" maxlength="500" placeholder="한 줄 메모 (기억하고 싶은 내용)" value="${esc(item.memo)}" />
                 <button class="btn">저장</button>
               </form>
             </div>`
          : ''
      }

      ${
        item.watched_at
          ? ''
          : `<form class="section" data-form="remind">
               <label class="label" for="remind-at">🔔 알림 · <span class="${item.notify_status && item.notify_status !== 'sent' ? 'warn' : ''}">${esc(remindStatus(item))}</span></label>
               <div class="row">
                 <input type="datetime-local" id="remind-at" name="remindAt" min="${toLocalInput(new Date())}"
                   value="${pendingRemind ? toLocalInput(new Date(item.remind_at)) : ''}" required />
                 <button class="btn primary">${pendingRemind ? '변경' : '설정'}</button>
               </div>
               ${pendingRemind ? '<button type="button" class="link small" data-action="remind-off">알림 끄기</button>' : ''}
             </form>`
      }

      <div class="section">
        <label class="label" for="detail-category">카테고리</label>
        <select id="detail-category" data-item-category="${item.id}">${categoryOptions(item.category_id ?? '')}</select>
      </div>

      <div class="row section">
        ${
          item.watched_at
            ? `<button class="btn grow" data-action="unwatch">↺ 다시 볼래요</button>`
            : `<button class="btn grow" data-action="watched">✓ 다 봤어요</button>`
        }
        <button class="btn danger" data-action="delete">삭제</button>
      </div>
    </div>`;
  if (!$sheet.open) $sheet.showModal();
}

// 정리 도우미: 오래된 영상을 하나씩 보여 주고 "아직 볼래요 / 지울래요"
function renderCleanup() {
  const item = state.items.find((i) => i.id === state.cleanup?.[0]);
  if (!item) {
    const done = state.cleanup !== null;
    state.cleanup = null;
    if ($sheet.open) $sheet.close();
    if (done) toast('정리 끝! 깔끔해졌어요 ✨');
    return;
  }
  const left = state.cleanup.length;
  const days = Math.floor((Date.now() - new Date(item.created_at).getTime()) / DAY);
  $sheet.innerHTML = `
    <div class="sheet-body">
      <button class="link sheet-close" data-action="cleanup-stop" aria-label="닫기">✕</button>
      <p class="muted small center" style="margin:0">🧹 정리 도우미 · 남은 영상 ${left}개</p>
      ${renderFrame(item, { large: true })}
      <p class="center" style="margin:0">${days}일 전에 저장한 영상이에요. 아직 볼 거예요?</p>
      <div class="row">
        <button class="btn grow" data-action="cleanup-keep">👀 아직 볼래요</button>
        <button class="btn grow danger" data-action="cleanup-delete">🗑 지울래요</button>
      </div>
      <a class="btn block" href="${esc(item.url)}" target="_blank" rel="noopener">▶ 잠깐 영상 확인하기</a>
    </div>`;
  if (!$sheet.open) $sheet.showModal();
}

function openDetail(id) {
  state.detailId = id;
  renderDetail();
}

function closeDetail() {
  state.detailId = null;
  if ($sheet.open) $sheet.close();
}

// ───────────── 그리기 ─────────────

function render() {
  if (!supabase) return renderSetupNeeded();
  if (!state.user) {
    $logout.hidden = true;
    $nav.hidden = true;
    return renderLogin();
  }

  $logout.hidden = false;
  $nav.hidden = false;
  $nav.querySelectorAll('a').forEach((a) => a.setAttribute('aria-current', a.dataset.page === state.page ? 'page' : 'false'));
  const todoCount = state.items.filter((i) => !i.watched_at).length;
  $nav.querySelector('[data-count]').textContent = todoCount ? todoCount : '';

  // 링크 입력 중에 다시 그려져도 입력값이 사라지지 않게 보관
  const urlInput = $app.querySelector('input[name="url"]');
  const typed = urlInput && !state.adding ? urlInput.value : '';
  const searching = document.activeElement?.name === 'search';
  $app.innerHTML =
    state.page === 'my'
      ? renderMyPage()
      : state.page === 'insights'
        ? renderInsights(state.items, categoryName) + renderDigestSettings()
        : renderAddPage();
  const newInput = $app.querySelector('input[name="url"]');
  if (newInput && typed) newInput.value = typed;
  if (searching) {
    const search = $app.querySelector('input[name="search"]');
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }

  if (state.detailId) renderDetail();
}

// ───────────── 이벤트 ─────────────

async function handleAction(el) {
  const { action } = el.dataset;
  const id = el.dataset.id ?? state.detailId;
  const item = state.items.find((i) => i.id === id);

  switch (action) {
    case 'login':
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
      break;
    case 'paste':
      try {
        const text = await navigator.clipboard.readText();
        $app.querySelector('input[name="url"]').value = text;
        addItem(text);
      } catch {
        toast('붙여넣기를 할 수 없어요. 입력칸을 길게 눌러 붙여넣어 주세요');
      }
      break;
    case 'go-my':
      go('my');
      break;
    case 'open':
      openDetail(id);
      break;
    case 'close':
      closeDetail();
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
      // 창을 닫지 않고 바로 별점·메모를 남길 수 있게 함
      updateItem(id, { watched_at: new Date().toISOString() }, '다 봤어요! 별점을 남겨 보세요');
      break;
    case 'rate': {
      const value = Number(el.dataset.value);
      updateItem(id, { rating: item?.rating === value ? null : value });
      break;
    }
    case 'minutes': {
      const m = Number(el.dataset.minutes);
      state.minutes = state.minutes === m ? 0 : m;
      render();
      break;
    }
    case 'good':
      state.goodOnly = !state.goodOnly;
      render();
      break;
    case 'cleanup-start':
      state.cleanup = staleItems().map((i) => i.id);
      renderCleanup();
      break;
    case 'cleanup-keep':
    case 'cleanup-delete': {
      const target = state.cleanup?.[0];
      if (!target) break;
      const { error } =
        action === 'cleanup-keep'
          ? await supabase.from('watch_items').update({ kept_at: new Date().toISOString() }).eq('id', target)
          : await supabase.from('watch_items').delete().eq('id', target);
      if (error) return toast('처리하지 못했어요');
      state.cleanup.shift();
      await loadItems();
      render();
      renderCleanup();
      break;
    }
    case 'cleanup-stop':
      state.cleanup = null;
      $sheet.close();
      break;
    case 'unwatch':
      closeDetail();
      updateItem(id, { watched_at: null }, '볼 영상으로 되돌렸어요');
      break;
    case 'remind-off':
      updateItem(id, { remind_at: null, notified_at: null, notify_status: null }, '알림을 껐어요');
      break;
    case 'delete':
      if (item) deleteItem(id);
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
}

for (const root of [$app, $sheet]) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) {
      e.preventDefault();
      handleAction(el);
    }
  });
}

// 창 바깥(어두운 부분)을 누르면 닫기
$sheet.addEventListener('click', (e) => {
  if (e.target === $sheet) closeDetail();
});
$sheet.addEventListener('close', () => {
  state.detailId = null;
  state.cleanup = null;
});

$sheet.addEventListener('change', (e) => {
  const select = e.target;
  if (!select.dataset.itemCategory) return;
  const item = state.items.find((i) => i.id === select.dataset.itemCategory);
  let value = select.value;
  if (value === '__new') {
    const name = prompt('새 카테고리 이름')?.trim();
    if (!name) return renderDetail(); // 취소하면 원래 선택으로 되돌림
    value = state.categories.find((c) => c.name === name)?.id ?? `new:${name}`;
  }
  if (item) moveItem(item, value);
});

$app.addEventListener('input', (e) => {
  if (e.target.name === 'search') {
    state.search = e.target.value;
    render();
  }
});

$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.name === 'digest_enabled') saveSettings({ digest_enabled: el.checked });
  else if (el.name === 'digest_dow') saveSettings({ digest_dow: Number(el.value) });
  else if (el.name === 'digest_hour') saveSettings({ digest_hour: Number(el.value) });
});

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form === 'add') addItem(e.target.url.value);
});

$sheet.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form === 'memo') {
    return updateItem(state.detailId, { memo: e.target.memo.value.trim() || null }, '메모를 저장했어요');
  }
  if (e.target.dataset.form !== 'remind') return;
  const when = new Date(e.target.remindAt.value);
  if (when.getTime() < Date.now() - 60000) return toast('앞으로의 시각을 골라 주세요');
  updateItem(
    state.detailId,
    { remind_at: when.toISOString(), notified_at: null, notify_status: null },
    `${formatWhen(when.toISOString())}에 알려 드릴게요`,
  );
});

$nav.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-page]');
  if (!a) return;
  e.preventDefault();
  go(a.dataset.page);
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
  state.page = pageFromHash();
  if (!supabase) return render();

  takeSharedLink();

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    if (user?.id === state.user?.id) return;
    state.user = user;
    if (!user) {
      state.items = [];
      closeDetail();
      return render();
    }
    // onAuthStateChange 안에서 바로 await 하면 supabase-js 가 멈출 수 있어 다음 틱에서 실행
    setTimeout(async () => {
      render();
      await Promise.all([loadItems(), checkPush()]);
      render();
      const shared = takeSharedLink();
      if (shared) {
        if (state.page !== 'add') go('add');
        addItem(shared);
      }
    }, 0);
  });

  const { data } = await supabase.auth.getSession();
  if (!data.session) render();
}

start();
