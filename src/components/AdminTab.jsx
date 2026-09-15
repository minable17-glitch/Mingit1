import { useEffect, useState } from 'react';
import {
  teacherSignup, teacherLogin, teacherFindUsername, teacherResetPassword,
  createClass, getMyClasses, logout as apiLogout,
} from '../lib/api';
import { getTeacherSession, setTeacherSession, clearTeacherSession } from '../lib/session';
import AdminContentEditor from './AdminContentEditor';
import AdminRecords from './AdminRecords';

const SUB_TABS = [
  { key: 'records', label: '학생·기록' },
  { key: 'read', label: '읽어보기 관리' },
  { key: 'learn', label: '배워보기 관리' },
];

function AuthScreen({ onLoggedIn, onExit }) {
  const [view, setView] = useState('login'); // login | signup | find-username | reset-password
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function resetFields() {
    setPassword('');
    setNewPassword('');
    setError('');
    setNotice('');
  }
  function switchView(v) {
    resetFields();
    setView(v);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const teacher = await teacherLogin({ username: username.trim(), password });
      setTeacherSession(teacher);
      onLoggedIn(teacher);
    } catch (err) {
      setError(err.message || '로그인에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!username.trim() || password.length < 4 || !email.trim()) {
      setError('아이디, 4자 이상 비밀번호, 이메일을 모두 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const teacher = await teacherSignup({ username: username.trim(), password, email: email.trim() });
      setTeacherSession(teacher);
      onLoggedIn(teacher);
    } catch (err) {
      setError(err.message || '계정 만들기에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleFindUsername(e) {
    e.preventDefault();
    setPending(true);
    setError('');
    setNotice('');
    try {
      const found = await teacherFindUsername({ email: email.trim() });
      setNotice(found ? `아이디는 "${found}" 입니다.` : '해당 이메일로 등록된 계정을 찾을 수 없어요.');
    } catch (err) {
      setError(err.message || '조회에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError('새 비밀번호는 4자 이상으로 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    setNotice('');
    try {
      await teacherResetPassword({ username: username.trim(), email: email.trim(), newPassword });
      setNotice('비밀번호를 바꿨어요. 이제 로그인해주세요.');
      setTimeout(() => switchView('login'), 1200);
    } catch (err) {
      setError(err.message || '비밀번호 변경에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 관리자</h1>
        <div className="sub">교사용 학급 관리</div>
      </div>
      <div className="app-main">
        {view === 'login' && (
          <div className="card">
            <h2>로그인</h2>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>아이디</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="field">
                <label>비밀번호</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <div className="msg msg-error">{error}</div>}
              <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
                {pending ? '확인 중...' : '로그인'}
              </button>
            </form>
            <div className="row center" style={{ justifyContent: 'center', marginTop: 12, fontSize: 13 }}>
              <button className="btn btn-outline" type="button" onClick={() => switchView('signup')}>계정 만들기</button>
              <button className="btn btn-outline" type="button" onClick={() => switchView('find-username')}>아이디 찾기</button>
              <button className="btn btn-outline" type="button" onClick={() => switchView('reset-password')}>비밀번호 찾기</button>
            </div>
          </div>
        )}

        {view === 'signup' && (
          <div className="card">
            <h2>계정 만들기</h2>
            <form onSubmit={handleSignup}>
              <div className="field">
                <label>아이디</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="field">
                <label>비밀번호 (4자 이상)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="field">
                <label>이메일 (아이디·비밀번호 찾기에 필요해요)</label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              {error && <div className="msg msg-error">{error}</div>}
              <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
                {pending ? '만드는 중...' : '계정 만들기'}
              </button>
            </form>
            <div className="center" style={{ marginTop: 12 }}>
              <button className="btn btn-outline" type="button" onClick={() => switchView('login')}>← 로그인으로</button>
            </div>
          </div>
        )}

        {view === 'find-username' && (
          <div className="card">
            <h2>아이디 찾기</h2>
            <form onSubmit={handleFindUsername}>
              <div className="field">
                <label>가입할 때 등록한 이메일</label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <div className="msg msg-error">{error}</div>}
              {notice && <div className="msg msg-ok">{notice}</div>}
              <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
                {pending ? '찾는 중...' : '아이디 찾기'}
              </button>
            </form>
            <div className="center" style={{ marginTop: 12 }}>
              <button className="btn btn-outline" type="button" onClick={() => switchView('login')}>← 로그인으로</button>
            </div>
          </div>
        )}

        {view === 'reset-password' && (
          <div className="card">
            <h2>비밀번호 찾기</h2>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              아이디와 가입할 때 등록한 이메일이 맞으면 바로 새 비밀번호로 바꿀 수 있어요.
            </p>
            <form onSubmit={handleResetPassword}>
              <div className="field">
                <label>아이디</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="field">
                <label>가입할 때 등록한 이메일</label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>새 비밀번호 (4자 이상)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              {error && <div className="msg msg-error">{error}</div>}
              {notice && <div className="msg msg-ok">{notice}</div>}
              <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
                {pending ? '바꾸는 중...' : '비밀번호 바꾸기'}
              </button>
            </form>
            <div className="center" style={{ marginTop: 12 }}>
              <button className="btn btn-outline" type="button" onClick={() => switchView('login')}>← 로그인으로</button>
            </div>
          </div>
        )}

        <div className="center" style={{ marginTop: 8 }}>
          <button className="btn btn-outline" type="button" onClick={onExit}>학생 화면으로 돌아가기</button>
        </div>
      </div>
    </div>
  );
}

function ClassPicker({ onSelect, onLogout }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState(false);
  const [createdCode, setCreatedCode] = useState('');

  async function refresh() {
    try {
      setClasses(await getMyClasses());
    } catch (err) {
      setError(err.message || '학급 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) {
      setError('학급 이름을 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const cls = await createClass({ name: newName.trim() });
      setCreatedCode(cls.code);
      setNewName('');
      await refresh();
    } catch (err) {
      setError(err.message || '학급 생성에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 내 학급</h1>
        <div className="sub">관리할 학급을 골라주세요</div>
      </div>
      <div className="app-main">
        <div className="card">
          <h2>내 학급 목록</h2>
          {loading && <p className="muted">불러오는 중...</p>}
          {!loading && classes.length === 0 && <p className="muted">아직 만든 학급이 없어요. 아래에서 새로 만들어보세요.</p>}
          {classes.map((c) => (
            <div key={c.id} className="content-card" onClick={() => onSelect(c)}>
              <div className="meta">
                <div className="title">{c.name}</div>
                <span className="tag">코드 {c.code}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>새 학급 만들기</h2>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>학급 이름</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 2학년 3반" />
            </div>
            {error && <div className="msg msg-error">{error}</div>}
            <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
              {pending ? '만드는 중...' : '학급 만들기'}
            </button>
          </form>
          {createdCode && (
            <div className="msg msg-ok">학급이 만들어졌어요! 학생들에게 학급 코드 <b>{createdCode}</b> 를 알려주세요.</div>
          )}
        </div>

        <div className="center">
          <button className="btn btn-outline" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminTab({ onExit }) {
  const [teacher, setTeacher] = useState(() => getTeacherSession());
  const [selectedClass, setSelectedClass] = useState(null);
  const [subTab, setSubTab] = useState('records');

  async function handleLogout() {
    await apiLogout();
    clearTeacherSession();
    setTeacher(null);
    setSelectedClass(null);
  }

  if (!teacher) {
    return <AuthScreen onLoggedIn={setTeacher} onExit={onExit} />;
  }

  if (!selectedClass) {
    return <ClassPicker onSelect={setSelectedClass} onLogout={handleLogout} />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 {selectedClass.name}</h1>
        <div className="sub">학급 코드 {selectedClass.code} · {teacher.username}</div>
      </div>
      <div className="app-main">
        <button className="btn btn-outline" type="button" onClick={() => setSelectedClass(null)} style={{ marginBottom: 12 }}>
          ← 학급 목록
        </button>
        <div className="pill-row">
          {SUB_TABS.map((t) => (
            <button key={t.key} className={`pill ${subTab === t.key ? 'active' : ''}`} onClick={() => setSubTab(t.key)} type="button">
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'records' && <AdminRecords classId={selectedClass.id} />}
        {subTab === 'read' && <AdminContentEditor kind="read" classId={selectedClass.id} />}
        {subTab === 'learn' && <AdminContentEditor kind="learn" classId={selectedClass.id} />}

        <div className="center" style={{ marginTop: 8 }}>
          <button className="btn btn-outline" type="button" onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </div>
  );
}
