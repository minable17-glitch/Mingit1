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
  const [inboxCount, setInboxCount] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [cats, active, st, tpls, inbox] = await Promise.all([
        api.loadCategories(), api.loadActiveTasks(), api.loadSettings(),
        api.loadTemplates().catch(() => []),
        // 받은 제안함(Gmail)은 고급 구글 연동 사용자만
        features.google_advanced ? api.loadInbox().catch(() => []) : [],
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
    categories, categoryById, settings, reload, userId, tasks, templates, features,
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
        sourceText={overlay.sourceText}
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
