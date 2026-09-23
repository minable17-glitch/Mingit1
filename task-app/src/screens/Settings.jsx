import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

export default function Settings({ settings, userId, onSaved }) {
  const [neglectDays, setNeglectDays] = useState(settings.neglect_days);
  const [calendarSteps, setCalendarSteps] = useState(settings.calendar_steps);
  const [google, setGoogle] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.hasGoogleToken().then(setGoogle).catch(() => setGoogle(false)); }, []);

  async function save(e) {
    e.preventDefault();
    const patch = { neglect_days: Number(neglectDays), calendar_steps: calendarSteps };
    try {
      await api.updateSettings(userId, patch);
      onSaved({ ...settings, ...patch });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      alert(`저장하지 못했어요: ${err.message}`);
    }
  }

  return (
    <section>
      <header className="page-head"><h1>설정</h1></header>

      <form className="block stack" onSubmit={save}>
        <label className="row">
          <span className="grow">방치 경고 기준 (마지막 활동 후)</span>
          <input type="number" min={1} max={60} value={neglectDays} onChange={(e) => setNeglectDays(e.target.value)} style={{ width: 70 }} />
          일
        </label>
        <label className="row">
          <input type="checkbox" checked={calendarSteps} onChange={(e) => setCalendarSteps(e.target.checked)} />
          <span>단계별 마감도 구글 캘린더에 넣기</span>
        </label>
        <p className="muted small">끄면 업무 최종 마감만 캘린더에 들어갑니다. 바꾼 뒤 업무를 수정하면 반영돼요.</p>
        <button className="primary">{saved ? '저장됨 ✓' : '저장'}</button>
      </form>

      <div className="block stack">
        <h2>구글 캘린더</h2>
        {google === null && <p className="muted">확인 중…</p>}
        {google === true && <p>연결됨 ✓</p>}
        {google === false && (
          <>
            <p className="warn">연결되지 않았어요. 마감이 캘린더에 들어가지 않습니다.</p>
            <button onClick={api.signInWithGoogle}>구글 캘린더 다시 연결</button>
          </>
        )}
      </div>

      <div className="block">
        <button onClick={api.signOut}>로그아웃</button>
      </div>
    </section>
  );
}
