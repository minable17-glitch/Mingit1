import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

export default function Settings({ settings, userId, onSaved, onOpenScreen }) {
  const [form, setForm] = useState({
    neglect_days: settings.neglect_days,
    waiting_days: settings.waiting_days,
    calendar_steps: settings.calendar_steps,
    gmail_label: settings.gmail_label ?? '업무',
  });
  const [google, setGoogle] = useState(null);
  const [saved, setSaved] = useState(false);
  const set = (patch) => setForm({ ...form, ...patch });

  useEffect(() => { api.hasGoogleToken().then(setGoogle).catch(() => setGoogle(false)); }, []);

  async function save(e) {
    e.preventDefault();
    const patch = {
      neglect_days: Number(form.neglect_days),
      waiting_days: Number(form.waiting_days),
      calendar_steps: form.calendar_steps,
      gmail_label: form.gmail_label.trim() || '업무',
    };
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

      <div className="block menu">
        <button onClick={() => onOpenScreen({ type: 'categories' })}>🏷️ 분류 관리</button>
        <button onClick={() => onOpenScreen({ type: 'templates' })}>📋 업무 템플릿</button>
        <button onClick={() => onOpenScreen({ type: 'timetable' })}>🕘 시간표 (짜투리 모드)</button>
        <button onClick={() => onOpenScreen({ type: 'inbox' })}>📬 받은 제안함 (Gmail)</button>
      </div>

      <form className="block stack" onSubmit={save}>
        <label className="row">
          <span className="grow">방치 경고 기준 (마지막 활동 후)</span>
          <input type="number" min={1} max={60} value={form.neglect_days} onChange={(e) => set({ neglect_days: e.target.value })} style={{ width: 70 }} />
          일
        </label>
        <label className="row">
          <span className="grow">무응답 알림 기준 (공 넘긴 후)</span>
          <input type="number" min={1} max={60} value={form.waiting_days} onChange={(e) => set({ waiting_days: e.target.value })} style={{ width: 70 }} />
          일
        </label>
        <label className="row">
          <input type="checkbox" checked={form.calendar_steps} onChange={(e) => set({ calendar_steps: e.target.checked })} />
          <span>단계별 마감도 구글 캘린더에 넣기</span>
        </label>
        <label className="row">
          <span className="grow">업무로 가져올 Gmail 라벨</span>
          <input value={form.gmail_label} onChange={(e) => set({ gmail_label: e.target.value })} style={{ width: 120 }} />
        </label>
        <button className="primary">{saved ? '저장됨 ✓' : '저장'}</button>
      </form>

      <Widget settings={settings} userId={userId} onSaved={onSaved} />

      <div className="block stack">
        <h2>구글 연결 (캘린더·Gmail)</h2>
        {google === null && <p className="muted">확인 중…</p>}
        {google === true && (
          <>
            <p>연결됨 ✓</p>
            <p className="muted small">Gmail 가져오기를 처음 쓰신다면 아래 버튼으로 한 번 다시 연결해 Gmail 읽기 권한을 허용하세요.</p>
            <button onClick={api.signInWithGoogle}>다시 연결</button>
          </>
        )}
        {google === false && (
          <>
            <p className="warn">연결되지 않았어요. 마감이 캘린더에 들어가지 않습니다.</p>
            <button onClick={api.signInWithGoogle}>구글 다시 연결</button>
          </>
        )}
      </div>

      <div className="block">
        <button onClick={api.signOut}>로그아웃</button>
      </div>
    </section>
  );
}

function Widget({ settings, userId, onSaved }) {
  const [copied, setCopied] = useState('');
  const token = settings.widget_token;

  async function make() {
    if (token && !confirm('새 주소를 만들면 기존 위젯 주소는 더 이상 동작하지 않아요. 계속할까요?')) return;
    try {
      const t = await api.createWidgetToken(userId);
      onSaved({ ...settings, widget_token: t });
    } catch (e) {
      alert(`만들지 못했어요: ${e.message}`);
    }
  }

  async function copy(format) {
    await navigator.clipboard.writeText(api.widgetUrl(token, format));
    setCopied(format);
    setTimeout(() => setCopied(''), 1500);
  }

  return (
    <div className="block stack">
      <h2>바탕화면·홈 화면 위젯</h2>
      <p className="muted small">
        오늘의 다음 행동과 경고만 보여주는 읽기 전용 주소예요. PC는 Lively Wallpaper(윈도우)·Plash(맥)에 HTML 주소를,
        아이폰 Scriptable·갤럭시 KWGT에는 JSON 주소를 넣으세요. 주소를 아는 사람은 요약을 볼 수 있으니 공유하지 마세요.
      </p>
      {token ? (
        <div className="row wrap">
          <button onClick={() => copy('html')}>{copied === 'html' ? '복사됨 ✓' : 'HTML 주소 복사 (PC)'}</button>
          <button onClick={() => copy('json')}>{copied === 'json' ? '복사됨 ✓' : 'JSON 주소 복사 (폰)'}</button>
          <button className="link" onClick={make}>주소 새로 만들기</button>
        </div>
      ) : (
        <button onClick={make}>위젯 주소 만들기</button>
      )}
    </div>
  );
}
