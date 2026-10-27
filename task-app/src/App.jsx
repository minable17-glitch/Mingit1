import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import * as api from './lib/api.js';
import { loadSince } from './lib/today.js';
import { todayKST } from './lib/date.js';
import Briefing from './screens/Briefing.jsx';
import TaskDetail from './screens/TaskDetail.jsx';
import Archive from './screens/Archive.jsx';
import Categories from './screens/Categories.jsx';
import Settings from './screens/Settings.jsx';
import Review from './screens/Review.jsx';
import Inbox from './screens/Inbox.jsx';
import DraftForm from './screens/DraftForm.jsx';
import Templates from './screens/Templates.jsx';
import Timetable from './screens/Timetable.jsx';
import Balance from './screens/Balance.jsx';
import Thoughts from './screens/Thoughts.jsx';
import Calendar from './screens/Calendar.jsx';
import ClassRoom from './screens/ClassRoom.jsx';

// 아래 탭: 선 아이콘(24×24, currentColor) + 이름
const ICON = {
  briefing: <><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /><circle cx="12" cy="12" r="4" /></>,
  balance: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  class: <><path d="M3 10l9-6 9 6" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></>,
  thoughts: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};
const TABS = [
  { key: 'briefing', label: '브리핑' },
  { key: 'balance', label: '한눈에' },
  { key: 'class', label: '학급' },
  { key: 'thoughts', label: '생각' },
  { key: 'archive', label: '보관함' },
  { key: 'settings', label: '설정' },
];

const DEFAULT_SETTINGS = {
  neglect_days: 3,
  waiting_days: 3,
  calendar_steps: true,
  gmail_label: '업무',
  bell_schedule: [],
  timetable: {},
};

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = 확인 중
  const [profile, setProfile] = useState(null); // { allowed, is_admin, google_advanced }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') api.saveGoogleRefreshToken(s).catch((e) => console.warn(e));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    api.myProfile()
      .then((p) => { api.setFeatures(p); setProfile(p); })
      .catch(() => setProfile({ allowed: false }));
  }, [userId]);

  if (session === undefined) return <div className="center muted">불러오는 중…</div>;
  if (!session) return <Login />;
  if (profile === null) return <div className="center muted">확인 중…</div>;
  if (!profile.allowed) {
    return (
      <div className="center stack">
        <p>지금은 새로 가입을 받지 않고 있어요.</p>
        <p className="muted small">({session.user.email}) 나중에 다시 시도해 주세요.</p>
        <button onClick={api.signOut}>로그아웃</button>
      </div>
    );
  }
  return <Main userId={userId} features={profile} />;
}

function Login() {
  return (
    <div className="center stack login">
      <h1>업무 챙김</h1>
      <p>여러 업무를 동시에 맡은 선생님을 위한 업무 놓침 방지 앱</p>
      <ul className="muted small intro">
        <li>매일 아침 모든 업무를 한 화면에서 훑어보기</li>
        <li>업무마다 “지금 할 다음 행동” 하나</li>
        <li>며칠 손대지 않은 업무·결재 대기 업무 알림</li>
      </ul>
      <button className="primary" onClick={api.signInWithGoogle}>구글 계정으로 시작하기</button>
      <p className="muted small">
        로그인에는 이름과 이메일만 사용합니다.<br />
        <a href="/privacy.html">개인정보처리방침</a> · <a href="/terms.html">이용약관</a>
      </p>
    </div>
  );
}

function Main({ userId, features }) {
  const [tab, setTab] = useState('briefing');
  // 탭 위에 겹쳐 여는 화면: { type: 'task', id } | { type: 'inbox' } | { type: 'draft', draft, source }
  //   | { type: 'review' } | { type: 'categories' } | { type: 'templates' } | { type: 'timetable' }
  const [overlay, setOverlay] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [links, setLinks] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [thoughts, setThoughts] = useState([]);
  const [todayItems, setTodayItems] = useState([]);
  const [throwItems, setThrowItems] = useState([]);
  // 학급 탭(담임용) 보이기: 기기마다 설정에서 끄고 켬
  const [showClass, setShowClassState] = useState(() => { try { return localStorage.getItem('task-keeper.show-class') !== 'off'; } catch { return true; } });
  const setShowClass = (on) => { setShowClassState(on); try { localStorage.setItem('task-keeper.show-class', on ? 'on' : 'off'); } catch { /* 괜찮음 */ } };
  const [inboxCount, setInboxCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [cats, active, st, tpls, inbox, lnks, rems, notes, todays, throws] = await Promise.all([
        api.loadCategories(), api.loadActiveTasks(), api.loadSettings(),
        api.loadTemplates().catch(() => []),
        // 받은 제안함(Gmail)은 고급 구글 연동 사용자만
        features.google_advanced ? api.loadInbox().catch(() => []) : [],
        api.loadLinks().catch(() => []), // 연결 표를 아직 안 만들었어도 앱은 동작
        api.loadReminders(),
        api.loadThoughts(),
        api.loadTodayItems(loadSince(todayKST())),
        api.loadThrows(),
      ]);
      setCategories(cats);
      setTasks(active);
      setSettings({ ...DEFAULT_SETTINGS, ...st });
      setTemplates(tpls);
      setInboxCount(inbox.length);
      setLinks(lnks);
      setReminders(rems);
      setThoughts(notes);
      setTodayItems(todays);
      setThrowItems(throws);
      setError('');
      return active;
    } catch (e) {
      setError(e.message ?? String(e));
      return [];
    }
  }, [features.google_advanced]);

  // 첫 실행 준비(기본 분류·템플릿)는 한 번만 (개발 모드에서 effect가 두 번 돌아도 중복 생성 없게)
  const initStarted = useRef(false);
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    (async () => {
      try {
        await api.ensureDefaults(userId);
        await api.ensureDefaultTemplates(userId, await api.loadCategories()).catch(() => {});
      } catch (e) {
        setError(e.message ?? String(e));
      }
      const active = await reload();
      setReady(true);
      // 지난번에 캘린더 반영이 실패한 업무가 있으면 조용히 다시 시도
      api.retryDirtyCalendar(active);
    })();
  }, [userId, reload]);

  // 알림을 눌러 들어오면(?task=…) 그 업무를 엶. 앱이 열려 있으면 서비스 워커가 메시지로 알려 줌
  useEffect(() => {
    if (!ready) return;
    const openFromUrl = (href) => {
      const id = new URL(href, location.origin).searchParams.get('task');
      if (id) setOverlay({ type: 'task', id });
      if (location.search) history.replaceState(null, '', location.pathname);
    };
    openFromUrl(location.href);
    const onMessage = (e) => { if (e.data?.type === 'open-url') { openFromUrl(e.data.url); reload(); } };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage);
  }, [ready, reload]);

  // 다른 탭/창에서 돌아오면 새로 불러옴 (날짜가 바뀌었을 수도 있음)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  if (!ready) return <div className="center muted">불러오는 중…</div>;

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const openTask = (id) => setOverlay({ type: 'task', id });
  const close = () => { setOverlay(null); reload(); };
  const shared = {
    categories, categoryById, settings, reload, userId, tasks, templates, features, links, reminders, thoughts, todayItems, throwItems, showClass, setShowClass,
    onOpen: openTask, onOpenScreen: setOverlay, onSaved: setSettings,
  };

  const overlayView = overlay && {
    task: () => <TaskDetail {...shared} taskId={overlay.id} onClose={close} />,
    inbox: () => <Inbox {...shared} onClose={close} />,
    review: () => <Review {...shared} onClose={close} />,
    categories: () => <Categories {...shared} onClose={close} />,
    templates: () => <Templates {...shared} onClose={close} />,
    timetable: () => <Timetable {...shared} onClose={close} />,
    calendar: () => (
      <section>
        <header className="page-head"><button className="link" onClick={close}>← 돌아가기</button><h1>📅 마감 달력</h1></header>
        <Calendar {...shared} initialTaskId={overlay.taskId} />
      </section>
    ),
    draft: () => (
      <DraftForm
        initial={overlay.draft}
        categories={categories}
        source={overlay.source}
        sourceText={overlay.sourceText}
        onCancel={close}
        onConfirm={async (draft) => {
          const task = await api.createFromDraft(draft);
          if (overlay.throwId) { // 던져 둔 것에서 만든 업무면 첨부는 그 업무로 옮기고 보관함에서 빼기
            await api.moveThrowAttachments(overlay.throwId, task.id).catch(() => {});
            await api.deleteThrow(overlay.throwId).catch(() => {});
          }
          await reload();
          setOverlay({ type: 'task', id: task.id });
        }}
      />
    ),
  }[overlay.type]();

  return (
    <div className="app">
      {error && <div className="error" onClick={() => setError('')}>문제가 생겼어요: {error}</div>}
      {overlayView ?? (
        <>
          <main>
            {tab === 'briefing' && <Briefing {...shared} inboxCount={inboxCount} />}
            {tab === 'balance' && <Balance {...shared} />}
            {tab === 'class' && <ClassRoom {...shared} />}
            {tab === 'archive' && <Archive {...shared} />}
            {tab === 'thoughts' && <Thoughts {...shared} />}
            {tab === 'settings' && <Settings {...shared} />}
          </main>
          <nav className="tabs" aria-label="화면">
            <div className="tabs-inner">
              {TABS.filter((t) => t.key !== 'class' || showClass).map((t) => (
                <button key={t.key} className={tab === t.key ? 'active' : ''} aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICON[t.key]}</svg>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
