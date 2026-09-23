import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './lib/supabaseClient.js';
import * as api from './lib/api.js';
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

const TABS = [
  { key: 'briefing', label: '브리핑' },
  { key: 'archive', label: '보관함' },
  { key: 'review', label: '회고' },
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
  const [allowed, setAllowed] = useState(null);

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
    api.isAllowed().then(setAllowed).catch(() => setAllowed(false));
  }, [userId]);

  if (session === undefined) return <div className="center muted">불러오는 중…</div>;
  if (!session) return <Login />;
  if (allowed === null) return <div className="center muted">확인 중…</div>;
  if (!allowed) {
    return (
      <div className="center stack">
        <p>이 계정({session.user.email})은 사용 허가가 없습니다.</p>
        <p className="muted small">README의 “본인 이메일 등록” 단계를 확인하세요.</p>
        <button onClick={api.signOut}>로그아웃</button>
      </div>
    );
  }
  return <Main userId={userId} />;
}

function Login() {
  return (
    <div className="center stack">
      <h1>업무 챙김</h1>
      <p className="muted">진행 중인 모든 업무를 하루 한 번 훑어보세요.</p>
      <button className="primary" onClick={api.signInWithGoogle}>구글 계정으로 로그인</button>
    </div>
  );
}

function Main({ userId }) {
  const [tab, setTab] = useState('briefing');
  // 탭 위에 겹쳐 여는 화면: { type: 'task', id } | { type: 'inbox' } | { type: 'draft', draft, source }
  //   | { type: 'review' } | { type: 'categories' } | { type: 'templates' } | { type: 'timetable' }
  const [overlay, setOverlay] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [cats, active, st, tpls, inbox] = await Promise.all([
        api.loadCategories(), api.loadActiveTasks(), api.loadSettings(),
        // 2단계 SQL을 아직 실행하지 않았어도 1단계 기능은 그대로 쓰이도록
        api.loadTemplates().catch(() => []), api.loadInbox().catch(() => []),
      ]);
      setCategories(cats);
      setTasks(active);
      setSettings({ ...DEFAULT_SETTINGS, ...st });
      setTemplates(tpls);
      setInboxCount(inbox.length);
      setError('');
      return active;
    } catch (e) {
      setError(e.message ?? String(e));
      return [];
    }
  }, []);

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
    categories, categoryById, settings, reload, userId, tasks, templates,
    onOpen: openTask, onOpenScreen: setOverlay, onSaved: setSettings,
  };

  const overlayView = overlay && {
    task: () => <TaskDetail {...shared} taskId={overlay.id} onClose={close} />,
    inbox: () => <Inbox {...shared} onClose={close} />,
    review: () => <Review {...shared} onClose={close} />,
    categories: () => <Categories {...shared} onClose={close} />,
    templates: () => <Templates {...shared} onClose={close} />,
    timetable: () => <Timetable {...shared} onClose={close} />,
    draft: () => (
      <DraftForm
        initial={overlay.draft}
        categories={categories}
        source={overlay.source}
        onCancel={close}
        onConfirm={async (draft) => {
          const task = await api.createFromDraft(draft);
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
            {tab === 'archive' && <Archive {...shared} />}
            {tab === 'review' && <Review {...shared} />}
            {tab === 'settings' && <Settings {...shared} />}
          </main>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
