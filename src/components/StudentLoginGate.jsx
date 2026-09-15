import { useState } from 'react';
import { studentLogin } from '../lib/api';
import { setSession, getSavedClassCode, setSavedClassCode } from '../lib/session';

export default function StudentLoginGate({ onLoggedIn, onWantAdmin }) {
  const [classCode, setClassCode] = useState(getSavedClassCode());
  const [studentNumber, setStudentNumber] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!classCode.trim() || !studentNumber.trim() || !name.trim() || !/^[0-9]{4}$/.test(pin)) {
      setError('학급 코드, 학번, 이름을 입력하고 PIN 4자리 숫자를 입력해주세요.');
      return;
    }
    setPending(true);
    try {
      const student = await studentLogin({ classCode: classCode.trim(), studentNumber: studentNumber.trim(), name: name.trim(), pin });
      setSavedClassCode(classCode.trim().toUpperCase());
      setSession({ id: student.id, classId: student.class_id, studentNumber: student.student_number, name: student.name });
      onLoggedIn({ id: student.id, classId: student.class_id, studentNumber: student.student_number, name: student.name });
    } catch (err) {
      setError(err.message || '로그인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 LEVEL-UP ARCHERY</h1>
        <div className="sub">양궁 성장일지</div>
      </div>
      <div className="app-main">
        <div className="card">
          <h2>학생 로그인</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            선생님께 받은 학급 코드와 내 학번·이름·PIN(4자리)을 입력하세요.
            처음 로그인하면 입력한 PIN으로 자동 등록됩니다.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>학급 코드</label>
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="예: A1B2C3"
                autoCapitalize="characters"
              />
            </div>
            <div className="field">
              <label>학번</label>
              <input
                type="text"
                inputMode="numeric"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="예: 20214"
              />
            </div>
            <div className="field">
              <label>이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
            </div>
            <div className="field">
              <label>PIN (숫자 4자리)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="0000"
              />
            </div>
            {error && <div className="msg msg-error">{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
              {pending ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
        <div className="center">
          <button className="btn btn-outline" onClick={onWantAdmin} type="button">
            선생님이신가요? 관리자로 이동
          </button>
        </div>
      </div>
    </div>
  );
}
