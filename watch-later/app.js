import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';
import { renderInsights } from './insights.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');
const $profile = document.getElementById('profile');
const $searchBtn = document.getElementById('search-btn');
const $pageTitle = document.getElementById('page-title');
const $toast = document.getElementById('toast');
const $sheet = document.getElementById('sheet');

// 보기 방식은 기기마다 기억 (저장이 막힌 브라우저면 기본값)
const VIEWS = [
  ['big', '큰 카드', '유튜브처럼 썸네일을 크게'],
  ['grid', '2열 그리드', '한 화면에 더 많이'],
  ['frame', '액자', '썸네일을 액자처럼 걸어 두기'],
  ['list', '목록', '작은 썸네일 + 제목, 빠르게 훑어보기'],
];
function loadView() {
  try {
    const v = localStorage.getItem('view');
    return VIEWS.some(([k]) => k === v) ? v : 'big';
  } catch {
    return 'big';
  }
}

function loadPlatform() {
  try {
    return localStorage.getItem('platform') === 'instagram' ? 'instagram' : 'youtube';
  } catch {
    return 'youtube';
  }
}
function setPlatform(p) {
  if (state.platform !== p) {
    state.filter = 'all';
    state.minutes = 0;
    state.selected = new Set();
  }
  state.platform = p;
  try {
    localStorage.setItem('platform', p);
  } catch {
    // 저장이 막힌 브라우저
  }
}
const inPlatform = (i) => platformOf(i) === state.platform;

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
  accountOpen: false, // 내 계정 창이 열려 있는지
  importing: null, // 좋아요 가져오는 중 진행 상황
  importOpt: { period: 'install', cleanup: false }, // 좋아요 가져올 기간
  view: loadView(), // 내 영상 보기 방식: big | grid | frame | list
  platform: loadPlatform(), // 내 영상·관심사: youtube | instagram
  selecting: false, // 내 영상: 여러 개 선택해서 지우기
  selected: new Set(),
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
function toast(msg, ms = 2600) {
  // 상세 창이 열려 있으면 창 위에 보이도록 창 안으로 옮김
  ($sheet.open ? $sheet : document.body).append($toast);
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), ms);
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

// 인스타 릴스·게시물 링크 → { platform, id(shortcode), kind, url }
function parseInstagram(input) {
  const m = String(input || '').match(/https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i);
  if (!m) return null;
  const kind = m[1].toLowerCase().startsWith('reel') ? 'reel' : m[1].toLowerCase();
  return { platform: 'instagram', id: m[2], kind, url: `https://www.instagram.com/${kind}/${m[2]}/`, thumbnail: null };
}

// 유튜브 또는 인스타 링크
function parseLink(input) {
  const yt = parseYouTube(input);
  return yt ? { ...yt, platform: 'youtube' } : parseInstagram(input);
}

// platform 칸이 아직 없던 예전 영상은 주소로 판단
function platformOf(item) {
  return item.platform || (/instagram\.com/.test(item.url) ? 'instagram' : 'youtube');
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
      inPlatform(i) &&
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
  state.selecting = false;
  state.selected = new Set();
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
    const video = parseLink(shared);
    if (video) sessionStorage.setItem('pendingShare', video.url);
    else setTimeout(() => toast('유튜브 영상이나 인스타 게시물에서 눌러 주세요'), 500);
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
  const video = parseLink(input);
  if (!video) return toast('유튜브나 인스타 링크를 넣어 주세요');
  const ig = video.platform === 'instagram';

  const dup = state.items.find((i) => i.video_id === video.id && !i.watched_at);
  if (dup) {
    state.lastAddedId = dup.id;
    render();
    return toast('이미 저장한 영상이에요');
  }

  state.adding = true;
  render();
  try {
    const { data } = await supabase.functions.invoke('youtube-info', {
      body: ig ? { instagram: video.url } : { id: video.id },
    });
    const info = data && !data.error ? data : {};
    const kindName = video.kind === 'reel' ? '릴스' : '게시물';
    if (ig && !info.title) info.title = info.author ? `${info.author}의 ${kindName}` : `인스타그램 ${kindName}`;
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
        // 유튜브는 기본값(youtube)을 쓰므로 인스타일 때만 보냄
        ...(ig ? { platform: 'instagram' } : {}),
      })
      .select('id')
      .single();
    if (error) {
      if (ig && /platform/.test(error.message || '')) {
        toast('인스타 저장을 쓰려면 Supabase 에서 SQL 한 줄을 먼저 실행해 주세요', 6000);
        return;
      }
      throw error;
    }
    state.lastAddedId = row.id;
    setPlatform(video.platform);
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

// ───────────── 유튜브 좋아요 가져오기 ─────────────
// 구글 로그인을 "유튜브 읽기 권한"과 함께 한 번 더 해서 받은 토큰으로
// YouTube Data API 의 videos.list?myRating=like 를 불러와 저장 (이미 있는 영상은 건너뜀)

const YT_READONLY = 'https://www.googleapis.com/auth/youtube.readonly';
const IMPORT_MAX = 500; // 한 번에 가져오는 최대 개수

// 가져올 기간: 앱 가입 이후(기본) / 최근 N일 / 전체
const IMPORT_PERIODS = [
  ['install', '앱 가입 이후'],
  ['7', '최근 1주'],
  ['30', '최근 1달'],
  ['90', '최근 3달'],
  ['all', '전체'],
];

function periodSince(period) {
  if (period === 'all') return null;
  if (period === 'install') return state.user?.created_at ?? null;
  return new Date(Date.now() - Number(period) * DAY).toISOString();
}

// 가져오기 전에 기간을 고르는 창
function renderImportOptions() {
  const opt = state.importOpt;
  $sheet.innerHTML = `
    <div class="sheet-body">
      <div class="handle" tabindex="-1" autofocus></div>
      <h2 class="sheet-title">👍 유튜브 좋아요 영상 가져오기</h2>
      <p class="muted small" style="margin:0">언제부터 좋아요 누른 영상을 가져올까요?</p>
      <div class="chip-row wrap">
        ${IMPORT_PERIODS.map(
          ([v, label]) => `<button class="chip" data-action="import-period" data-period="${v}" aria-pressed="${opt.period === v}">${label}</button>`,
        ).join('')}
      </div>
      <p class="small muted" style="margin:0">${
        opt.period === 'install'
          ? `이 앱에 처음 가입한 ${esc(formatWhen(state.user.created_at))} 이후에 누른 좋아요만 가져와요.`
          : opt.period === 'all'
            ? `최근 좋아요부터 최대 ${IMPORT_MAX}개까지 가져와요.`
            : `${esc(formatWhen(periodSince(opt.period)))} 이후에 누른 좋아요만 가져와요.`
      }</p>
      ${
        opt.period !== 'all'
          ? `<label class="check-row">
               <input type="checkbox" name="import-cleanup" ${opt.cleanup ? 'checked' : ''} />
               <span>이 기간보다 <b>예전에 좋아요 한 영상</b>이 목록에 있으면 지우기<br />
                 <span class="small muted">알림을 정했거나, 다 봤거나, 메모를 단 영상은 지우지 않아요</span></span>
             </label>`
          : ''
      }
      <button class="btn-red" data-action="import-go">가져오기</button>
    </div>`;
  state.accountOpen = false;
  if (!$sheet.open) $sheet.showModal();
}

async function startImportLikes() {
  sessionStorage.setItem('importLikes', JSON.stringify(state.importOpt));
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname,
      scopes: YT_READONLY,
      queryParams: { prompt: 'consent', include_granted_scopes: 'true' },
    },
  });
}

function isoDurationToSec(iso) {
  const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, min, sec] = m.map((x) => Number(x) || 0);
  return d * 86400 + h * 3600 + min * 60 + sec || null;
}

async function ytGet(path, token) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw Object.assign(new Error(`YouTube ${res.status}`), { status: res.status });
  return res.json();
}

// 좋아요 재생목록을 최신순으로 읽음: [{id, likedAt}]
// keepGoingPast 가 있으면 기간이 지나도 계속 읽음 (예전 좋아요 정리용), 최대 IMPORT_MAX 개
async function fetchLikes(token, since, keepGoingPast) {
  const ch = await ytGet('channels?part=contentDetails&mine=true', token);
  const playlistId = ch.items?.[0]?.contentDetails?.relatedPlaylists?.likes || 'LL';
  const likes = [];
  let pageToken = '';
  do {
    const data = await ytGet(
      `playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ''}`,
      token,
    );
    for (const it of data.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) likes.push({ id, likedAt: it.snippet?.publishedAt ?? null });
    }
    pageToken = data.nextPageToken ?? '';
    state.importing = { phase: '불러오는 중', count: likes.length };
    render();
    const oldest = likes[likes.length - 1]?.likedAt;
    if (since && !keepGoingPast && oldest && oldest < since) break;
  } while (pageToken && likes.length < IMPORT_MAX);
  return likes.slice(0, IMPORT_MAX);
}

// 영상 ID 목록 → 제목·채널·분류·길이 (50개씩)
async function fetchVideoDetails(ids, token) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await ytGet(`videos?part=snippet,contentDetails&id=${ids.slice(i, i + 50).join(',')}`, token);
    for (const v of data.items ?? []) {
      const s = v.snippet ?? {};
      out.push({
        id: v.id,
        title: s.title ?? null,
        author: s.channelTitle ?? null,
        channel_key: s.channelId ?? null,
        yt_category_id: s.categoryId ?? null,
        thumbnail_url: s.thumbnails?.high?.url ?? s.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        duration_sec: isoDurationToSec(v.contentDetails?.duration),
      });
    }
  }
  return out;
}

// 알림·시청·별점·메모 등 손댄 적 없는 영상인지
const untouched = (i) => !i.remind_at && !i.watched_at && !i.rating && !i.memo && !i.kept_at;

async function runImportLikes(token, opt) {
  if (!token) return toast('유튜브 권한을 받지 못했어요. 다시 시도해 주세요');
  const since = periodSince(opt.period);
  const cleanup = Boolean(opt.cleanup && since);
  state.importing = { phase: '불러오는 중', count: 0 };
  render();
  try {
    const likes = await fetchLikes(token, since, cleanup);
    const inPeriod = since ? likes.filter((l) => !l.likedAt || l.likedAt >= since) : likes;
    const have = new Set(state.items.map((i) => i.video_id));
    const freshIds = inPeriod.map((l) => l.id).filter((id) => !have.has(id));
    const details = await fetchVideoDetails(freshIds, token);
    const byId = new Map(details.map((d) => [d.id, d]));
    const likedAt = new Map(likes.map((l) => [l.id, l.likedAt]));
    const fresh = freshIds.map((id) => byId.get(id)).filter(Boolean); // 지워졌거나 비공개인 영상은 빠짐

    // 카테고리를 미리 정하고, 새 카테고리는 이름별로 한 번만 만듦
    const suggestions = fresh.map((v) => suggestCategory(v));
    const resolved = new Map();
    for (const value of new Set(suggestions)) {
      try {
        resolved.set(value, await resolveCategory(value));
      } catch {
        resolved.set(value, null);
      }
    }

    // 저장 시각 = 좋아요 누른 시각 (목록이 좋아요 순서대로 보이게)
    const now = Date.now();
    const rows = fresh.map((v, i) => ({
      url: `https://www.youtube.com/watch?v=${v.id}`,
      video_id: v.id,
      title: v.title,
      thumbnail_url: v.thumbnail_url,
      channel_key: v.channel_key,
      channel_title: v.author,
      category_id: resolved.get(suggestions[i]) ?? null,
      duration_sec: v.duration_sec,
      created_at: likedAt.get(v.id) ?? new Date(now - i * 1000).toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      state.importing = { phase: '저장하는 중', count: Math.min(i + 100, rows.length), total: rows.length };
      render();
      const { error } = await supabase.from('watch_items').insert(rows.slice(i, i + 100));
      if (error) throw error;
    }

    // 기간보다 예전에 좋아요 한 영상 정리 (손대지 않은 것만)
    let removed = 0;
    if (cleanup) {
      const oldIds = new Set(likes.filter((l) => l.likedAt && l.likedAt < since).map((l) => l.id));
      const targets = state.items.filter((i) => oldIds.has(i.video_id) && untouched(i)).map((i) => i.id);
      for (let i = 0; i < targets.length; i += 100) {
        const { error } = await supabase.from('watch_items').delete().in('id', targets.slice(i, i + 100));
        if (error) throw error;
      }
      removed = targets.length;
    }

    state.importing = null;
    await loadItems();
    state.tab = 'todo';
    state.filter = 'all';
    go('my');
    render();
    const parts = [rows.length ? `좋아요 영상 ${rows.length}개를 가져왔어요` : '새로 가져올 좋아요 영상이 없어요'];
    if (cleanup) parts.push(removed ? `예전 좋아요 ${removed}개는 정리했어요` : `정리할 예전 좋아요가 없었어요 (좋아요 ${likes.length}개 확인)`);
    toast(parts.join(' · '), 6000);
  } catch (e) {
    console.error(e);
    state.importing = null;
    render();
    toast(e.status === 401 || e.status === 403 ? '유튜브 권한을 허용해야 가져올 수 있어요' : '가져오지 못했어요. 잠시 후 다시 해 주세요');
  }
}

function renderImportCard() {
  if (state.importing) {
    const { phase, count, total } = state.importing;
    return `<div class="notice row import-card"><span>👍 좋아요 영상 ${phase}… ${total ? `${count}/${total}` : `${count}개`}</span></div>`;
  }
  return `
    <div class="notice row import-card">
      <span><b>유튜브 좋아요 영상 가져오기</b><br /><span class="small muted">기간을 골라 좋아요 누른 영상을 한 번에 저장해요</span></span>
      <button class="chip white" data-action="import-likes">가져오기</button>
    </div>`;
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

const ICON = {
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17V11a6 6 0 1 1 12 0v6l2 2H4l2-2z"/><path d="M10 21h4"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="#FF0033"/><path d="M10 8.8v6.4l5.6-3.2z" fill="#fff"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
  google: '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
};

// 채널 이름 → 동그란 아바타 (첫 글자 + 이름마다 고정된 색)
const AVATAR_COLORS = ['#E9A23B', '#5C6BC0', '#26A69A', '#EF5350', '#AB47BC', '#42A5F5', '#8D6E63', '#66BB6A'];
function channelAvatar(name) {
  const s = String(name || '?').replace(/^@/, '') || '?';
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `<span class="ch-avatar" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${esc([...s][0].toUpperCase())}</span>`;
}

function savedAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '방금 저장';
  if (min < 60) return `${min}분 전 저장`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전 저장`;
  return `${Math.floor(min / 60 / 24)}일 전 저장`;
}

function thumbSrc(item) {
  if (platformOf(item) === 'instagram') return item.thumbnail_url || '';
  return item.thumbnail_url || `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`;
}

function renderSetupNeeded() {
  $app.innerHTML = `
    <div class="notice">
      <p><b>설정이 필요해요</b></p>
      <p class="muted">config.js 에 Supabase 주소와 키, 알림용 공개 키를 넣어 주세요. 자세한 방법은 README.md 에 있어요.</p>
    </div>`;
}

function renderLogin() {
  $app.innerHTML = `
    <section class="login">
      <img class="big-logo" src="icons/icon.svg" alt="" />
      <h2>보고 싶은 영상,<br />잊지 말고 보세요</h2>
      <p>유튜브 링크를 저장해 두면<br />원하는 시간에 휴대폰으로 알려 드려요.</p>
      <button class="google-btn" data-action="login">${ICON.google} 구글 계정으로 시작하기</button>
      ${sessionStorage.getItem('pendingShare') ? '<p class="small">로그인하면 공유한 영상이 바로 저장돼요.</p>' : ''}
      <a class="small muted" href="privacy.html">개인정보처리방침</a>
    </section>`;
}

// 알림이 아직 안 켜진 경우에만 위쪽에 안내 (켜진 뒤 관리는 프로필 → 내 계정)
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
        <div class="notice row">
          <span>🔔 알림을 켜야 정한 시간에 알려 드려요</span>
          <button class="chip white" data-action="push-on" ${busy ? 'disabled' : ''}>알림 켜기</button>
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

// 카드 아래 회색 한 줄: 채널 · 카테고리 · 알림/시청 상태
function statusText(item) {
  if (item.watched_at) return `✓ 봤어요${item.rating ? ` ${'★'.repeat(item.rating)}` : ''}`;
  if (item.remind_at && !item.notified_at) return `🔔 ${formatWhen(item.remind_at)}`;
  if (item.remind_at && item.notify_status && item.notify_status !== 'sent') return '<span class="warn">⚠ 알림 실패</span>';
  return savedAgo(item.created_at);
}

// 썸네일: 길이(오른쪽 아래), 알림 예정(왼쪽 아래), 빨간 줄(알림 예정 · 다 봄)
function renderThumb(item, { play = false } = {}) {
  const pending = item.remind_at && !item.notified_at && !item.watched_at;
  const pos = getPosition(item);
  const pct = pos && item.duration_sec ? Math.min(100, Math.max(3, (pos / item.duration_sec) * 100)) : 0;
  const bar = item.watched_at
    ? '<span class="progress done"></span>'
    : pct
      ? `<span class="progress partial" style="width:${pct.toFixed(1)}%"></span>`
      : pending
        ? '<span class="progress"></span>'
        : '';
  const src = thumbSrc(item);
  // 인스타 썸네일은 없거나 시간이 지나면 막히는 경우가 있어 인스타 색 카드를 밑에 깔아 둠
  const igBack =
    platformOf(item) === 'instagram'
      ? `<span class="ig-fallback">${ICON.ig}<span>${esc(item.title || '인스타그램')}</span></span>`
      : '';
  return `
    ${igBack}
    ${src ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'" />` : ''}
    ${play ? `<span class="play">${ICON.play}</span>` : ''}
    ${play && pos ? `<span class="badge resume">▶ ${formatDuration(pos)}부터 이어보기</span>` : ''}
    ${pending && !(play && pos) ? `<span class="badge status">🔔 ${esc(formatWhen(item.remind_at))}</span>` : ''}
    ${item.duration_sec ? `<span class="badge dur">${formatDuration(item.duration_sec)}</span>` : ''}
    ${bar}`;
}

function renderCard(item) {
  if (state.selecting) return renderSelectCard(item);
  const sub = [item.channel_title && esc(item.channel_title), esc(categoryName(item.category_id)), statusText(item)]
    .filter(Boolean)
    .join(' · ');
  return `
    <article class="vcard ${platformOf(item) === 'instagram' ? 'ig' : ''}" data-action="open" data-id="${item.id}">
      <div class="thumb">${renderThumb(item)}</div>
      <div class="vmeta">
        ${channelAvatar(item.channel_title || categoryName(item.category_id))}
        <div class="vtexts">
          <h3 class="vtitle">${esc(item.title || item.url)}</h3>
          <p class="vsub">${sub}</p>
        </div>
        <button class="icon-btn kebab" data-action="open" data-id="${item.id}" aria-label="자세히">${ICON.more}</button>
      </div>
    </article>`;
}

// 선택 모드: 누르면 고르기/빼기, 썸네일 위에 동그란 체크
function renderSelectCard(item) {
  const on = state.selected.has(item.id);
  return `
    <article class="vcard selectable ${on ? 'on' : ''} ${platformOf(item) === 'instagram' ? 'ig' : ''}" data-action="select" data-id="${item.id}" aria-pressed="${on}">
      <div class="thumb">${renderThumb(item)}<span class="check">${on ? '✓' : ''}</span></div>
      <div class="vmeta">
        <div class="vtexts">
          <h3 class="vtitle">${esc(item.title || item.url)}</h3>
          <p class="vsub">${[item.channel_title && esc(item.channel_title), esc(categoryName(item.category_id)), statusText(item)].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    </article>`;
}

// ───────────── 페이지: 영상 추가 ─────────────

function renderAddPage() {
  const last = state.items.find((i) => i.id === state.lastAddedId);
  return `
    ${renderPushNotice()}
    <form class="add-hero" data-form="add">
      <h2>보고 싶은 영상,<br />링크만 넣으면 끝</h2>
      <label class="link-input">
        ${ICON.link}
        <input type="url" name="url" placeholder="유튜브·인스타 링크 붙여넣기" autocomplete="off" inputmode="url" ${state.adding ? 'disabled' : ''} />
        ${navigator.clipboard?.readText ? `<button type="button" class="chip" data-action="paste" ${state.adding ? 'disabled' : ''}>붙여넣기</button>` : ''}
      </label>
      <button type="submit" class="btn-red" ${state.adding ? 'disabled' : ''}>${state.adding ? '저장하는 중…' : '저장'}</button>
      <p class="hint">유튜브·인스타 링크 모두 돼요. 제목·카테고리는 알아서 정리되고, 알림 시간은 내 영상에서 정할 수 있어요.</p>
    </form>
    ${
      last
        ? `<section class="section-block">
             <div class="section-head">
               <h3>방금 저장한 ${platformOf(last) === 'instagram' ? '게시물' : '영상'}</h3>
               <button class="text-btn" data-action="open" data-id="${last.id}">🔔 알림 정하기</button>
             </div>
             ${renderCard(last)}
             ${
               platformOf(last) === 'instagram' && !last.category_id
                 ? `<div class="quick-cat">
                      <span class="small muted">인스타는 분류 정보가 없어요. 카테고리를 골라 주세요 (이 계정은 다음부터 자동)</span>
                      <div class="chip-row wrap">
                        ${state.categories.map((c) => `<button class="chip" data-action="quick-cat" data-id="${last.id}" data-cat="${c.id}">${esc(c.name)}</button>`).join('')}
                        <button class="chip ghost" data-action="quick-cat" data-id="${last.id}" data-cat="__new">+ 새 카테고리</button>
                      </div>
                    </div>`
                 : ''
             }
           </section>`
        : ''
    }
    <div class="section-block">${renderImportCard()}</div>
    ${renderBookmarklet()}`;
}

// PC 크롬 즐겨찾기 줄에 끌어다 놓는 버튼(북마클릿).
// 유튜브 영상을 보다가 누르면 새 탭에서 이 앱을 ?url=영상주소 로 열고 → 공유 받기와 같은 길로 자동 저장.
function bookmarkletHref() {
  const app = location.origin + location.pathname;
  return `javascript:(()=>{window.open(${JSON.stringify(app)}+'?url='+encodeURIComponent(location.href),'_blank')})()`;
}

function renderBookmarklet() {
  if (!matchMedia('(pointer: fine)').matches) return ''; // 마우스가 있는 PC 에서만
  return `
    <details class="bookmarklet-card">
      <summary>💻 PC에서 더 빠르게 저장하기</summary>
      <ol>
        <li>아래 버튼을 마우스로 끌어서 크롬 <b>즐겨찾기 줄</b>에 놓아 주세요.<br />
          <span class="small muted">즐겨찾기 줄이 안 보이면 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd></span></li>
        <li>유튜브에서 영상을 보다가 즐겨찾기 줄의 버튼을 누르면 바로 저장돼요.</li>
      </ol>
      <a class="bookmarklet" href="${esc(bookmarkletHref())}" data-action="bookmarklet" draggable="true">📌 나중에 볼 영상</a>
    </details>`;
}

// ───────────── 페이지: 내 영상 (유튜브 피드) ─────────────

function renderPlatformSwitch() {
  const n = (p) => state.items.filter((i) => platformOf(i) === p && !i.watched_at).length;
  return `
    <div class="platform-switch" role="tablist">
      <button role="tab" data-action="platform" data-platform="youtube" aria-selected="${state.platform === 'youtube'}">${ICON.yt} 유튜브 <b>${n('youtube')}</b></button>
      <button role="tab" data-action="platform" data-platform="instagram" aria-selected="${state.platform === 'instagram'}">${ICON.ig} 인스타 <b>${n('instagram')}</b></button>
    </div>`;
}

function renderMyPage() {
  const ig = state.platform === 'instagram';
  const unit = ig ? '게시물' : '영상';
  const todo = state.items
    .filter((i) => inPlatform(i) && !i.watched_at)
    .sort((a, b) => (a.remind_at || '9999').localeCompare(b.remind_at || '9999') || b.created_at.localeCompare(a.created_at));
  const done = state.items.filter((i) => inPlatform(i) && i.watched_at).sort((a, b) => b.watched_at.localeCompare(a.watched_at));
  const q = state.search.trim().toLowerCase();
  const matches = (i) =>
    !q || [i.title, i.channel_title, i.memo].some((t) => String(t || '').toLowerCase().includes(q));
  const fitsTime = (i) => ig || state.tab !== 'todo' || !state.minutes || (i.duration_sec && i.duration_sec <= state.minutes * 60);
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
              ? ig
                ? '아직 저장한 인스타 게시물이 없어요.<br /><span class="small">인스타 앱에서 공유 → "나중에 볼 영상"을 눌러 보세요</span>'
                : '아직 저장한 영상이 없어요.<br /><a href="#/">영상 추가하러 가기 →</a>'
              : `다 본 ${unit}이 여기에 모여요.`;

  const count = (pred) => tabList.filter(pred).length;
  const chip = (value, label, n) =>
    `<button class="chip" data-action="filter" data-filter="${value}" aria-pressed="${state.filter === value}">${esc(label)} ${n}</button>`;
  const uncategorized = count((i) => !i.category_id);
  const chips = [
    chip('all', '전체', tabList.length),
    ...state.categories
      .map((c) => [c, count((i) => i.category_id === c.id)])
      .filter(([c, n]) => n > 0 || state.filter === c.id)
      .map(([c, n]) => chip(c.id, c.name, n)),
    uncategorized || state.filter === 'none' ? chip('none', '미분류', uncategorized) : '',
  ].join('');
  const minuteChip = (m, label) =>
    `<button class="chip red" data-action="minutes" data-minutes="${m}" aria-pressed="${state.minutes === m}">${label}</button>`;

  return `
    ${renderPlatformSwitch()}
    <label class="search-pill">
      ${ICON.search}
      <input type="search" name="search" placeholder="제목·채널·메모로 찾기" value="${esc(state.search)}" autocomplete="off" />
    </label>
    <div class="tabs" role="tablist">
      <button class="tab" role="tab" data-action="tab" data-tab="todo" aria-selected="${state.tab === 'todo'}">볼 ${unit} ${todo.length}</button>
      <button class="tab" role="tab" data-action="tab" data-tab="done" aria-selected="${state.tab === 'done'}">다 본 ${unit} ${done.length}</button>
      <span class="tab-tools">
        <button class="text-btn" data-action="view-menu" aria-label="보기 방식">${{ big: '▣', grid: '▦', frame: '🖼', list: '☰' }[state.view]} 보기</button>
        <button class="text-btn" data-action="select-mode">${state.selecting ? '취소' : '선택'}</button>
      </span>
    </div>
    <div class="filters">
      <div class="chip-row">
        ${chips}
        <button class="chip ghost" data-action="manage" aria-pressed="${state.manageOpen}" aria-label="카테고리 관리">⚙ 관리</button>
      </div>
      ${
        state.tab === 'todo' && ig
          ? ''
          : state.tab === 'todo'
          ? `<div class="chip-row"><span class="label">지금 몇 분?</span>
               ${minuteChip(5, '5분')}${minuteChip(15, '15분')}${minuteChip(30, '30분')}${minuteChip(60, '1시간')}
             </div>`
          : `<div class="chip-row"><button class="chip red" data-action="good" aria-pressed="${state.goodOnly}">⭐ 좋았던 영상만</button></div>`
      }
    </div>
    ${state.manageOpen ? renderCategoryManager() : ''}
    ${
      stale.length && !q
        ? `<div class="notice row cleanup-notice">
             <span>한 달 넘게 안 본 영상 <b>${stale.length}개</b></span>
             <button class="chip white" data-action="cleanup-start">정리하기</button>
           </div>`
        : ''
    }
    ${
      state.selecting
        ? `<div class="select-bar">
             <span><b>${state.selected.size}</b>개 선택</span>
             <button class="chip" data-action="select-all" data-ids="${list.map((i) => i.id).join(',')}">${list.length && list.every((i) => state.selected.has(i.id)) ? '모두 해제' : `보이는 ${list.length}개 모두 선택`}</button>
             <button class="chip white" data-action="select-delete" ${state.selected.size ? '' : 'disabled'}>삭제</button>
           </div>`
        : ''
    }
    ${list.length ? `<div class="feed view-${state.view} ${ig ? 'is-ig' : ''}">${list.map(renderCard).join('')}</div>` : `<div class="empty">${empty}</div>`}`;
}

function renderCategoryManager() {
  const rows = state.categories
    .map(
      (c) => `
        <div class="cat-row">
          <span>${esc(c.name)} <span class="muted small">${state.items.filter((i) => i.category_id === c.id).length}</span></span>
          <span class="actions">
            <button class="chip" data-action="cat-rename" data-id="${c.id}">이름 바꾸기</button>
            <button class="chip" data-action="cat-delete" data-id="${c.id}">삭제</button>
          </span>
        </div>`,
    )
    .join('');
  return `
    <div class="cat-manager">
      ${rows || '<p class="muted small">아직 카테고리가 없어요. 영상을 저장하면 자동으로 만들어져요.</p>'}
      <button class="chip white" data-action="cat-add">+ 새 카테고리</button>
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
          <b>주간 정리 알림</b><br />
          <span class="small muted">${s.digest_enabled ? `매주 ${WEEKDAY_NAMES[s.digest_dow]}요일 ${hourLabel(s.digest_hour)}` : '일주일에 한 번, 안 본 영상과 이번 주 기록을 알려 드려요'}</span>
        </span>
        <input type="checkbox" class="switch" name="digest_enabled" ${s.digest_enabled ? 'checked' : ''} />
      </label>
      ${
        s.digest_enabled
          ? `<div class="row">
               <select name="digest_dow" aria-label="요일">
                 ${WEEKDAY_NAMES.map((d, i) => `<option value="${i}" ${i === s.digest_dow ? 'selected' : ''}>매주 ${d}요일</option>`).join('')}
               </select>
               <select name="digest_hour" aria-label="시각">
                 ${hours.map((h) => `<option value="${h}" ${h === s.digest_hour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}
               </select>
             </div>
             ${state.push.status !== 'on' ? '<p class="small warn" style="margin:8px 0 0">이 기기에서 알림을 켜야 받을 수 있어요.</p>' : ''}`
          : ''
      }
    </section>`;
}

// ───────────── 아래에서 올라오는 창: 영상 상세 ─────────────

function remindStatus(item) {
  if (!item.remind_at) return '알림 시간을 골라 주세요';
  const when = formatWhen(item.remind_at);
  if (!item.notified_at) return new Date(item.remind_at) > new Date() ? `${when}에 알려 드려요` : '곧 알림이 가요';
  if (item.notify_status === 'no_device') return `⚠ ${when} · 알림 받을 기기가 없었어요`;
  if (item.notify_status === 'failed') return `⚠ ${when} · 알림을 보내지 못했어요`;
  return `${when}에 알림을 보냈어요`;
}

// 자주 쓰는 알림 시각 두 개 (오늘/내일 저녁 9시, 내일 아침 7시 반)
function quickTimes() {
  const at = (days, h, m) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const tonight = at(0, 21, 0);
  const evening = tonight.getTime() - Date.now() > 10 * 60000 ? tonight : at(1, 21, 0);
  return [evening, at(1, 7, 30)];
}

function renderDetail() {
  const item = state.items.find((i) => i.id === state.detailId);
  if (!item) return closeDetail();
  const pendingRemind = item.remind_at && !item.notified_at;
  const current = pendingRemind ? new Date(item.remind_at).getTime() : null;
  const playing = state.playingId === item.id;
  const ig = platformOf(item) === 'instagram';
  const rest = `
      <h2 class="sheet-title">${esc(item.title || item.url)}</h2>
      <div class="ch-row">
        ${channelAvatar(item.channel_title || categoryName(item.category_id))}
        <b>${esc(item.channel_title || '채널 정보 없음')}</b>
        <span class="muted small">· ${savedAgo(item.created_at)}</span>
      </div>
      <div class="pill-row">
        ${
          playing
            ? ''
            : ig
              ? `<button class="pill white" data-action="play">${ICON.play} 앱에서 보기</button>`
            : getPosition(item)
              ? `<button class="pill white" data-action="play">${ICON.play} 이어보기</button><button class="pill" data-action="restart">처음부터</button>`
              : `<button class="pill white" data-action="play">${ICON.play} 재생</button>`
        }
        <a class="pill" href="${esc(item.url)}" target="_blank" rel="noopener">${ig ? '인스타에서 열기' : '유튜브에서 열기'}</a>
        ${
          item.watched_at
            ? '<button class="pill" data-action="unwatch">↺ 다시 볼래요</button>'
            : '<button class="pill" data-action="watched">✓ 다 봤어요</button>'
        }
        <button class="pill" data-action="delete">삭제</button>
      </div>
      ${
        item.watched_at
          ? `<div class="review">
               <span class="label">어땠어요?</span>
               <div class="stars" role="group" aria-label="별점">
                 ${[1, 2, 3, 4, 5]
                   .map((n) => `<button class="star ${item.rating >= n ? 'on' : ''}" data-action="rate" data-value="${n}" aria-label="${n}점">★</button>`)
                   .join('')}
               </div>
               <form data-form="memo">
                 <input type="text" name="memo" maxlength="500" placeholder="한 줄 메모 (기억하고 싶은 내용)" value="${esc(item.memo)}" />
                 <button class="chip white">저장</button>
               </form>
             </div>`
          : `<form class="rcard" data-form="remind">
               <div class="rrow">
                 ${ICON.bell}
                 <div class="texts"><b>알림</b><span class="${item.notify_status && item.notify_status !== 'sent' ? 'warn' : ''}">${esc(remindStatus(item))}</span></div>
                 ${pendingRemind ? '<button type="button" class="chip" data-action="remind-off">끄기</button>' : ''}
               </div>
               <div class="chip-row">
                 ${quickTimes()
                   .map(
                     (d) =>
                       `<button type="button" class="chip" data-action="remind-quick" data-at="${d.toISOString()}" aria-pressed="${current === d.getTime()}">${esc(formatWhen(d.toISOString()))}</button>`,
                   )
                   .join('')}
               </div>
               <div class="rinput">
                 <input type="datetime-local" name="remindAt" aria-label="직접 선택" min="${toLocalInput(new Date())}"
                   value="${pendingRemind ? toLocalInput(new Date(item.remind_at)) : ''}" required />
                 <button class="chip white">${pendingRemind ? '변경' : '설정'}</button>
               </div>
             </form>`
      }
      <div class="cat-line">
        <span>카테고리</span>
        <select class="chip-select" data-item-category="${item.id}" aria-label="카테고리">${categoryOptions(item.category_id ?? '')}</select>
      </div>`;

  // 재생 중이면 플레이어는 그대로 두고 아래 내용만 바꿈 (다시 그리면 영상이 끊김)
  const body = $sheet.querySelector(`.sheet-body[data-detail="${item.id}"]`);
  if (playing && body?.querySelector('.player')) {
    body.querySelector('.detail-rest').innerHTML = rest;
    return;
  }
  $sheet.innerHTML = `
    <div class="sheet-body" data-detail="${item.id}">
      <div class="handle" tabindex="-1" autofocus></div>
      ${
        playing
          ? ig
            ? `<div class="player ig"><iframe src="${esc(item.url)}embed/captioned/" title="인스타그램" loading="lazy" allow="encrypted-media; picture-in-picture"></iframe></div>`
            : '<div class="player"><div id="yt-player"></div></div>'
          : `<button class="thumb" data-action="play" aria-label="앱에서 재생">${renderThumb(item, { play: true })}</button>`
      }
      <div class="detail-rest">${rest}</div>
    </div>`;
  if (!$sheet.open) $sheet.showModal();
  if (playing && !ig) mountPlayer(item);
}

// ───────────── 앱 안에서 바로 재생 (유튜브 퍼가기 플레이어) ─────────────

let ytApi;
function loadYouTubeApi() {
  ytApi ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return ytApi;
}

// ── 이어보기: 마지막으로 본 위치(초)를 서버(position_sec)와 이 기기에 저장 ──
function getPosition(item) {
  let local = null;
  try {
    local = Number(localStorage.getItem(`pos:${item.id}`)) || null;
  } catch {
    // 저장이 막힌 브라우저
  }
  return item.position_sec ?? local;
}

function savePosition(itemId, sec) {
  const value = sec && sec > 3 ? Math.floor(sec) : null;
  const item = state.items.find((i) => i.id === itemId);
  if (item) item.position_sec = value;
  try {
    if (value) localStorage.setItem(`pos:${itemId}`, String(value));
    else localStorage.removeItem(`pos:${itemId}`);
  } catch {
    // 저장이 막힌 브라우저
  }
  // 서버에도 저장 (position_sec 칼럼이 아직 없으면 조용히 이 기기에만)
  supabase.from('watch_items').update({ position_sec: value }).eq('id', itemId).then(() => {});
}

function currentTime() {
  try {
    return state.player?.getCurrentTime?.() ?? null;
  } catch {
    return null;
  }
}

async function mountPlayer(item) {
  const YT = await loadYouTubeApi();
  if (state.playingId !== item.id || !document.getElementById('yt-player')) return;
  const pos = getPosition(item);
  // 거의 끝까지 봤던 영상은 처음부터
  const start = pos && (!item.duration_sec || pos < item.duration_sec - 10) ? pos : 0;
  state.player = new YT.Player('yt-player', {
    videoId: item.video_id,
    host: 'https://www.youtube-nocookie.com',
    playerVars: { autoplay: 1, playsinline: 1, rel: 0, start },
    events: {
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PAUSED) savePosition(item.id, currentTime());
        // 끝까지 보면 자동으로 "다 봤어요" → 별점 칸이 나옴, 이어보기 위치는 지움
        if (e.data === YT.PlayerState.ENDED) {
          savePosition(item.id, null);
          if (!state.items.find((i) => i.id === item.id)?.watched_at) {
            updateItem(item.id, { watched_at: new Date().toISOString() }, '다 봤어요! 별점을 남겨 보세요');
          }
        }
      },
      onReady: () => {
        // 보는 동안 5초마다 위치 저장
        clearInterval(state.posTimer);
        state.posTimer = setInterval(() => {
          if (state.player?.getPlayerState?.() === YT.PlayerState.PLAYING) savePosition(item.id, currentTime());
        }, 5000);
      },
      onError: () => {
        const box = $sheet.querySelector('.player');
        if (box) {
          box.innerHTML = `<div class="player-error">이 영상은 앱 안에서 재생할 수 없어요.<br />
            <a class="pill white" href="${esc(item.url)}" target="_blank" rel="noopener">유튜브에서 열기</a></div>`;
        }
      },
    },
  });
}

function stopPlayer() {
  clearInterval(state.posTimer);
  // 창을 닫는 순간의 위치를 저장 (끝까지 본 경우는 이미 지워짐)
  const sec = currentTime();
  if (state.playingId && sec) {
    const item = state.items.find((i) => i.id === state.playingId);
    if (!item?.duration_sec || sec < item.duration_sec - 3) savePosition(state.playingId, sec);
  }
  try {
    state.player?.destroy();
  } catch {
    // 이미 사라진 플레이어
  }
  state.player = null;
  state.playingId = null;
}

// 보기 방식 고르기
function renderViewMenu() {
  $sheet.innerHTML = `
    <div class="sheet-body">
      <div class="handle" tabindex="-1" autofocus></div>
      <h2 class="sheet-title">보기 방식</h2>
      <div class="view-options">
        ${VIEWS.map(
          ([k, name, desc]) => `
          <button class="view-option" data-action="set-view" data-view="${k}" aria-pressed="${state.view === k}">
            <span class="mini mini-${k}"><i></i><i></i><i></i><i></i></span>
            <b>${name}</b><span class="small muted">${desc}</span>
          </button>`,
        ).join('')}
      </div>
    </div>`;
  state.accountOpen = false;
  if (!$sheet.open) $sheet.showModal();
}

// 프로필 버튼 → 내 계정 (알림 관리, 로그아웃, 탈퇴)
function renderAccount() {
  const { status, busy } = state.push;
  const pushRow =
    status === 'on'
      ? `<div><span>🔔 이 기기 알림 켜짐</span><span class="pill-row">
           <button class="chip" data-action="push-test" ${busy ? 'disabled' : ''}>테스트</button>
           <button class="chip" data-action="push-off">끄기</button></span></div>`
      : status === 'off'
        ? `<button data-action="push-on" ${busy ? 'disabled' : ''}><span>🔔 이 기기에서 알림 받기</span><span class="muted">켜기</span></button>`
        : `<div><span class="muted">🔔 ${status === 'denied' ? '알림이 차단되어 있어요' : status === 'ios-install' ? '홈 화면에 추가하면 알림을 켤 수 있어요' : '이 브라우저는 알림을 지원하지 않아요'}</span></div>`;
  $sheet.innerHTML = `
    <div class="sheet-body account">
      <div class="handle" tabindex="-1" autofocus></div>
      <div class="me">
        ${profileAvatar()}
        <div><b>${esc(state.user.user_metadata?.full_name || '내 계정')}</b><div class="small muted">${esc(state.user.email)}</div></div>
      </div>
      <div class="list">
        ${pushRow}
        <button data-action="import-likes"><span>👍 유튜브 좋아요 가져오기</span><span class="muted">›</span></button>
        <a href="privacy.html"><span>개인정보처리방침</span><span class="muted">›</span></a>
        <button data-action="logout"><span>로그아웃</span></button>
        <button class="danger" data-action="delete-account"><span>회원 탈퇴</span></button>
      </div>
    </div>`;
  state.accountOpen = true;
  if (!$sheet.open) $sheet.showModal();
}

function profileAvatar() {
  const pic = state.user?.user_metadata?.avatar_url;
  const name = state.user?.user_metadata?.full_name || state.user?.email || '?';
  return `<span class="avatar-btn">${pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer" />` : esc([...name][0].toUpperCase())}</span>`;
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
      <div class="handle" tabindex="-1" autofocus></div>
      <div class="sheet-head"><span class="muted">정리 도우미 · 남은 영상 ${left}개</span>
        <button class="text-btn" data-action="cleanup-stop">그만하기</button></div>
      <a class="thumb" href="${esc(item.url)}" target="_blank" rel="noopener">${renderThumb(item, { play: true })}</a>
      <h2 class="sheet-title">${esc(item.title || item.url)}</h2>
      <p class="muted" style="margin:0">${days}일 전에 저장한 영상이에요. 아직 볼 거예요?</p>
      <div class="pill-row">
        <button class="pill white" data-action="cleanup-keep">👀 아직 볼래요</button>
        <button class="pill" data-action="cleanup-delete">🗑 지울래요</button>
      </div>
    </div>`;
  if (!$sheet.open) $sheet.showModal();
}

function openDetail(id) {
  state.detailId = id;
  renderDetail();
}

function closeDetail() {
  stopPlayer();
  state.detailId = null;
  state.accountOpen = false;
  if ($sheet.open) $sheet.close();
}

// ───────────── 그리기 ─────────────

function render() {
  if (!supabase) return renderSetupNeeded();
  if (!state.user) {
    $profile.hidden = $searchBtn.hidden = $nav.hidden = true;
    $pageTitle.textContent = '나중에 볼 영상';
    return renderLogin();
  }

  $profile.hidden = $nav.hidden = false;
  $profile.innerHTML = profileAvatar().replace(/^<span class="avatar-btn">|<\/span>$/g, '');
  $searchBtn.hidden = state.page === 'my';
  $pageTitle.textContent = { add: '나중에 볼 영상', my: '내 영상', insights: '내 관심사' }[state.page];
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
        ? `${renderPlatformSwitch()}<div class="insights">${renderInsights(state.items.filter(inPlatform), categoryName)}${renderDigestSettings()}</div>`
        : renderAddPage();
  const newInput = $app.querySelector('input[name="url"]');
  if (newInput && typed) newInput.value = typed;
  if (searching) {
    const search = $app.querySelector('input[name="search"]');
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }

  if (state.detailId) renderDetail();
  else if (state.accountOpen && $sheet.open) renderAccount();
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
    case 'bookmarklet':
      toast('누르지 말고, 즐겨찾기 줄로 끌어다 놓아 주세요');
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
    case 'remind-quick':
      updateItem(
        id,
        { remind_at: el.dataset.at, notified_at: null, notify_status: null },
        `${formatWhen(el.dataset.at)}에 알려 드릴게요`,
      );
      break;
    case 'play':
      state.playingId = state.detailId;
      renderDetail();
      break;
    case 'restart':
      savePosition(state.detailId, null);
      state.playingId = state.detailId;
      renderDetail();
      break;
    case 'platform':
      setPlatform(el.dataset.platform);
      render();
      break;
    case 'quick-cat': {
      let value = el.dataset.cat;
      if (value === '__new') {
        const name = prompt('새 카테고리 이름')?.trim();
        if (!name) return;
        value = state.categories.find((c) => c.name === name)?.id ?? `new:${name}`;
      }
      if (item) moveItem(item, value);
      break;
    }
    case 'view-menu':
      renderViewMenu();
      break;
    case 'set-view':
      state.view = el.dataset.view;
      try {
        localStorage.setItem('view', state.view);
      } catch {
        // 저장이 막힌 브라우저: 이번만 적용
      }
      closeDetail();
      render();
      break;
    case 'select-mode':
      state.selecting = !state.selecting;
      state.selected = new Set();
      render();
      break;
    case 'select': {
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      render();
      break;
    }
    case 'select-all': {
      const ids = el.dataset.ids ? el.dataset.ids.split(',') : [];
      const all = ids.length && ids.every((x) => state.selected.has(x));
      for (const x of ids) {
        if (all) state.selected.delete(x);
        else state.selected.add(x);
      }
      render();
      break;
    }
    case 'select-delete': {
      const ids = [...state.selected];
      if (!ids.length || !confirm(`선택한 영상 ${ids.length}개를 지울까요? 되돌릴 수 없어요.`)) return;
      for (let i = 0; i < ids.length; i += 100) {
        const { error } = await supabase.from('watch_items').delete().in('id', ids.slice(i, i + 100));
        if (error) return toast('지우지 못했어요. 잠시 후 다시 해 주세요');
      }
      state.selecting = false;
      state.selected = new Set();
      await loadItems();
      render();
      toast(`${ids.length}개를 지웠어요`);
      break;
    }
    case 'import-likes':
      renderImportOptions();
      break;
    case 'import-period':
      state.importOpt.period = el.dataset.period;
      renderImportOptions();
      break;
    case 'import-go':
      closeDetail();
      startImportLikes();
      break;
    case 'logout':
      closeDetail();
      await disablePush().catch(() => {});
      await supabase.auth.signOut();
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
      closeDetail();
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
  const wasPlaying = Boolean(state.playingId);
  stopPlayer();
  if (wasPlaying) setTimeout(render, 0); // 목록 썸네일에 이어보기 막대 반영
  state.detailId = null;
  state.accountOpen = false;
  state.cleanup = null;
});

$sheet.addEventListener('change', (e) => {
  if (e.target.name === 'import-cleanup') {
    state.importOpt.cleanup = e.target.checked;
    return;
  }
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

$profile.addEventListener('click', () => renderAccount());

// 위쪽 돋보기 → 내 영상 화면의 검색칸으로
$searchBtn.addEventListener('click', () => {
  go('my');
  setTimeout(() => $app.querySelector('input[name="search"]')?.focus(), 50);
});

// 앱으로 돌아왔을 때 목록 새로고침 (알림 상태 반영)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && state.user) {
    await loadItems();
    render();
  }
});

// ───────────── 시작 ─────────────

let itemsReady;
const itemsLoaded = new Promise((resolve) => (itemsReady = resolve));

async function start() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  state.page = pageFromHash();
  if (!supabase) return render();

  takeSharedLink();

  // 좋아요 가져오기: 유튜브 권한과 함께 로그인하고 돌아오면 토큰이 담긴 세션이 들어옴
  supabase.auth.onAuthStateChange((_event, session) => {
    const token = session?.provider_token;
    const saved = sessionStorage.getItem('importLikes');
    if (!token || !saved) return;
    sessionStorage.removeItem('importLikes');
    let opt;
    try {
      opt = JSON.parse(saved);
    } catch {
      opt = null;
    }
    if (!opt?.period) opt = { period: 'all', cleanup: false };
    setTimeout(async () => {
      await itemsLoaded; // 이미 저장한 영상을 건너뛰려면 목록이 먼저 있어야 함
      runImportLikes(token, opt);
    }, 0);
  });
  if (sessionStorage.getItem('importLikes')) {
    setTimeout(() => {
      if (!sessionStorage.getItem('importLikes')) return;
      sessionStorage.removeItem('importLikes');
      toast('유튜브 권한을 받지 못했어요. 다시 시도해 주세요');
    }, 15000);
  }

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
      const push = checkPush().catch(() => {});
      await loadItems();
      itemsReady();
      render();
      await push;
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
