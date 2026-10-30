import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';

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
  page: 'add', // 'add'(영상 추가) | 'my'(내 영상)
  tab: 'todo', // 'todo' | 'done'
  filter: 'all', // 'all' | 'none'(미분류) | 카테고리 id
  manageOpen: false,
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

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ───────────── 화면 이동 (#/ = 영상 추가, #/my = 내 영상) ─────────────

function pageFromHash() {
  return location.hash.startsWith('#/my') ? 'my' : 'add';
}

function go(page) {
  location.hash = page === 'my' ? '#/my' : '#/';
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
  if (item.watched_at) return '<span class="badge done">✓ 봤어요</span>';
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
  const tabList = state.tab === 'todo' ? todo : done;
  const inFilter = (i) =>
    state.filter === 'all' || (state.filter === 'none' ? !i.category_id : i.category_id === state.filter);
  const list = tabList.filter(inFilter);
  const empty =
    state.filter !== 'all'
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

  return `
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-action="tab" data-tab="todo" aria-selected="${state.tab === 'todo'}">볼 영상 ${todo.length}</button>
      <button class="tab" role="tab" data-action="tab" data-tab="done" aria-selected="${state.tab === 'done'}">다 본 영상 ${done.length}</button>
    </div>
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
  $app.innerHTML = state.page === 'my' ? renderMyPage() : renderAddPage();
  const newInput = $app.querySelector('input[name="url"]');
  if (newInput && typed) newInput.value = typed;

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
      closeDetail();
      updateItem(id, { watched_at: new Date().toISOString() }, '다 본 영상으로 옮겼어요');
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
$sheet.addEventListener('close', () => (state.detailId = null));

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

$app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.form === 'add') addItem(e.target.url.value);
});

$sheet.addEventListener('submit', (e) => {
  e.preventDefault();
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
