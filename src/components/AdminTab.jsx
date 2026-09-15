import { useState } from 'react';
import { createClass, teacherLogin } from '../lib/api';
import AdminContentEditor from './AdminContentEditor';
import AdminRecords from './AdminRecords';

const SUB_TABS = [
  { key: 'records', label: '학생·기록' },
  { key: 'read', label: '읽어보기 관리' },
  { key: 'learn', label: '배워보기 관리' },
];

export default function AdminTab({ onExit }) {
  const [session, setSessionState] = useState(null); // { id, name, code, adminPin }
  const [subTab, setSubTab] = useState('records');

  const [name, setName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [classCode, setClassCode] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !/^[0-9]{4,}$/.test(newPin)) {
      setError('학급 이름과 숫자 4자리 이상의 관리자 코드를 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const cls = await createClass({ name: name.trim(), adminPin: newPin });
      setCreatedCode(cls.code);
      setSessionState({ id: cls.id, name: cls.name, code: cls.code, adminPin: newPin });
    } catch (err) {
      setError(err.message || '학급 생성에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!classCode.trim() || !loginPin) {
      setError('학급 코드와 관리자 코드를 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const cls = await teacherLogin({ classCode: classCode.trim(), adminPin: loginPin });
      setSessionState({ id: cls.id, name: cls.name, code: cls.code, adminPin: loginPin });
    } catch (err) {
      setError(err.message || '로그인에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  if (!session) {
    return (
      <div className="app-shell">
        <div className="app-header">
          <h1>🎯 관리자</h1>
          <div className="sub">교사용 학급 관리</div>
        </div>
        <div className="app-main">
          <div className="card">
            <h2>기존 학급으로 로그인</h2>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label>학급 코드</label>
                <input type="text" value={classCode} onChange={(e) => setClassCode(e.target.value.toUpperCase())} />
              </div>
              <div className="field">
                <label>관리자 코드</label>
                <input type="password" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
                {pending ? '확인 중...' : '로그인'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>새 학급 만들기</h2>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>학급 이름</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2학년 3반" />
              </div>
              <div className="field">
                <label>관리자 코드 (숫자 4자리 이상, 직접 정하기)</label>
                <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} />
              </div>
              <button className="btn btn-accent btn-block" type="submit" disabled={pending}>
                {pending ? '만드는 중...' : '학급 만들기'}
              </button>
            </form>
            {createdCode && (
              <div className="msg msg-ok">
                학급이 만들어졌어요! 학생들에게 학급 코드 <b>{createdCode}</b> 를 알려주세요.
              </div>
            )}
          </div>

          {error && <div className="card msg msg-error">{error}</div>}

          <div className="center">
            <button className="btn btn-outline" type="button" onClick={onExit}>
              학생 화면으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 {session.name}</h1>
        <div className="sub">학급 코드 {session.code} · 관리자</div>
      </div>
      <div className="app-main">
        <div className="pill-row">
          {SUB_TABS.map((t) => (
            <button key={t.key} className={`pill ${subTab === t.key ? 'active' : ''}`} onClick={() => setSubTab(t.key)} type="button">
              {t.label}
            </button>
          ))}
        </div>

        {subTab === 'records' && <AdminRecords classId={session.id} adminPin={session.adminPin} />}
        {subTab === 'read' && <AdminContentEditor kind="read" classId={session.id} adminPin={session.adminPin} />}
        {subTab === 'learn' && <AdminContentEditor kind="learn" classId={session.id} adminPin={session.adminPin} />}

        <div className="center" style={{ marginTop: 8 }}>
          <button className="btn btn-outline" type="button" onClick={() => { setSessionState(null); onExit(); }}>
            학생 화면으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
