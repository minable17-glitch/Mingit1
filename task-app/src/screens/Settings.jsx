import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

export default function Settings({ settings, userId, features, onSaved, onOpenScreen }) {
  const [form, setForm] = useState({
    neglect_days: settings.neglect_days,
    waiting_days: settings.waiting_days,
    calendar_steps: settings.calendar_steps,
    gmail_label: settings.gmail_label ?? '업무',
  });
  const [saved, setSaved] = useState(false);
  const set = (patch) => setForm({ ...form, ...patch });

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
        {features?.google_advanced && <button onClick={() => onOpenScreen({ type: 'inbox' })}>📬 받은 제안함 (Gmail)</button>}
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
          <span>단계별 마감도 캘린더에 보이기</span>
        </label>
        {features?.google_advanced && (
          <label className="row">
            <span className="grow">업무로 가져올 Gmail 라벨</span>
            <input value={form.gmail_label} onChange={(e) => set({ gmail_label: e.target.value })} style={{ width: 120 }} />
          </label>
        )}
        <button className="primary">{saved ? '저장됨 ✓' : '저장'}</button>
      </form>

      <CalendarFeed settings={settings} userId={userId} onSaved={onSaved} />
      {features?.google_advanced && <GoogleAdvanced />}
      <Widget settings={settings} userId={userId} onSaved={onSaved} />
      {features?.is_admin && <Admin />}
      <Account />
    </section>
  );
}

function useCopy() {
  const [copied, setCopied] = useState('');
  return [copied, async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      prompt('아래 주소를 길게 눌러 복사하세요', text);
    }
  }];
}

async function makeToken(kind, token, userId, settings, onSaved) {
  if (token && !confirm('새 주소를 만들면 기존 주소는 더 이상 동작하지 않아요. 계속할까요?')) return;
  try {
    const t = kind === 'calendar' ? await api.createCalendarToken(userId) : await api.createWidgetToken(userId);
    onSaved({ ...settings, [kind === 'calendar' ? 'calendar_token' : 'widget_token']: t });
  } catch (e) {
    alert(`만들지 못했어요: ${e.message}`);
  }
}

// 모든 사용자: 구독 링크를 구글 캘린더에 한 번 추가하면 마감이 자동으로 보임 (구글 권한 불필요)
function CalendarFeed({ settings, userId, onSaved }) {
  const [copied, copy] = useCopy();
  const token = settings.calendar_token;
  return (
    <div className="block stack">
      <h2>구글 캘린더에 마감 보이기</h2>
      <p className="muted small">
        구독 주소를 한 번만 추가해 두면 업무·단계 마감이 구글 캘린더에 종일 일정으로 보여요.
        구글 캘린더가 몇 시간마다 새로 읽어 가서 바로 반영되지는 않을 수 있어요.
      </p>
      {token ? (
        <>
          <div className="row wrap">
            <button onClick={() => copy('cal', api.calendarFeedUrl(token))}>{copied === 'cal' ? '복사됨 ✓' : '구독 주소 복사'}</button>
            <a className="button-link" href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">구글 캘린더에 추가하러 가기 ↗</a>
          </div>
          <ol className="muted small howto">
            <li>“구독 주소 복사”를 누르고</li>
            <li>“구글 캘린더에 추가하러 가기”에서 <b>캘린더 URL</b> 칸에 붙여넣은 뒤 <b>캘린더 추가</b></li>
          </ol>
          <button className="link" onClick={() => makeToken('calendar', token, userId, settings, onSaved)}>주소 새로 만들기(기존 주소 끊기)</button>
        </>
      ) : (
        <button onClick={() => makeToken('calendar', token, userId, settings, onSaved)}>구독 주소 만들기</button>
      )}
    </div>
  );
}

// 관리자가 허락한 사용자만: 캘린더 즉시 반영·작업 시간 블록·Gmail 가져오기
function GoogleAdvanced() {
  const [google, setGoogle] = useState(null);
  useEffect(() => { api.hasGoogleToken().then(setGoogle).catch(() => setGoogle(false)); }, []);
  return (
    <div className="block stack">
      <h2>고급 구글 연동</h2>
      <p className="muted small">마감을 캘린더에 즉시 반영하고, 작업 시간 블록을 잡고, Gmail 라벨 메일을 가져와요.</p>
      {google === null && <p className="muted">확인 중…</p>}
      {google === true && <p>연결됨 ✓</p>}
      <button onClick={api.connectGoogleAdvanced}>{google ? '다시 연결' : '구글 캘린더·Gmail 연결'}</button>
    </div>
  );
}

function Widget({ settings, userId, onSaved }) {
  const [copied, copy] = useCopy();
  const token = settings.widget_token;
  return (
    <div className="block stack">
      <h2>바탕화면·홈 화면 위젯</h2>
      <p className="muted small">
        오늘의 다음 행동과 경고만 보여주는 읽기 전용 주소예요. PC는 Lively Wallpaper(윈도우)·Plash(맥)에 HTML 주소를,
        아이폰 Scriptable·갤럭시 KWGT에는 JSON 주소를 넣으세요. 주소를 아는 사람은 요약을 볼 수 있으니 공유하지 마세요.
      </p>
      {token ? (
        <div className="row wrap">
          <button onClick={() => copy('html', api.widgetUrl(token, 'html'))}>{copied === 'html' ? '복사됨 ✓' : 'HTML 주소 복사 (PC)'}</button>
          <button onClick={() => copy('json', api.widgetUrl(token, 'json'))}>{copied === 'json' ? '복사됨 ✓' : 'JSON 주소 복사 (폰)'}</button>
          <button className="link" onClick={() => makeToken('widget', token, userId, settings, onSaved)}>주소 새로 만들기</button>
        </div>
      ) : (
        <button onClick={() => makeToken('widget', token, userId, settings, onSaved)}>위젯 주소 만들기</button>
      )}
    </div>
  );
}

// 관리자: 가입 열기/닫기, 사용자별 AI·고급 구글 연동 켜기
function Admin() {
  const [data, setData] = useState(null);
  const load = () => api.adminOverview().then(setData).catch((e) => alert(e.message));
  useEffect(() => { api.adminOverview().then(setData).catch(() => {}); }, []);
  if (!data) return null;

  async function toggle(fn) {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(`바꾸지 못했어요: ${e.message}`);
    }
  }

  return (
    <div className="block stack admin">
      <h2>관리자</h2>
      <label className="row">
        <input
          type="checkbox"
          checked={data.signup_open}
          onChange={(e) => toggle(() => api.adminSetSignupOpen(e.target.checked))}
        />
        <span>새 가입 받기 (끄면 이미 가입한 사람만 사용)</span>
      </label>
      <p className="small muted">사용자 {data.users.length}명 · AI와 고급 구글 연동은 켜 준 사람만 쓸 수 있어요 (관리자는 항상 사용).</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>이메일</th><th>업무</th><th>AI</th><th>고급 연동</th></tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.email}>
                <td className="small">{u.email}</td>
                <td>{u.active_tasks}</td>
                <td>
                  <input type="checkbox" checked={u.ai_enabled}
                    onChange={(e) => toggle(() => api.adminSetUserFlags(u.email, { ai: e.target.checked, advanced: u.google_advanced }))} />
                </td>
                <td>
                  <input type="checkbox" checked={u.google_advanced}
                    onChange={(e) => toggle(() => api.adminSetUserFlags(u.email, { ai: u.ai_enabled, advanced: e.target.checked }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Account() {
  const [confirmText, setConfirmText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="block stack">
      <h2>계정</h2>
      <p className="small">
        <a href="/privacy.html" target="_blank">개인정보처리방침</a> · <a href="/terms.html" target="_blank">이용약관</a>
      </p>
      <div className="row"><button onClick={api.signOut}>로그아웃</button></div>
      {!open ? (
        <button className="link danger-text" onClick={() => setOpen(true)}>회원 탈퇴</button>
      ) : (
        <div className="dialog stack">
          <p>탈퇴하면 모든 업무·단계·기록·설정이 <b>즉시 영구 삭제</b>되고 되돌릴 수 없어요. 캘린더 구독·위젯 주소도 더 이상 동작하지 않아요.</p>
          <input placeholder="계속하려면 ‘탈퇴’라고 입력" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div className="row">
            <button
              className="danger"
              disabled={busy || confirmText.trim() !== '탈퇴'}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.deleteAccount();
                } catch (e) {
                  alert(`탈퇴하지 못했어요: ${e.message}`);
                  setBusy(false);
                }
              }}
            >
              모든 데이터 삭제하고 탈퇴
            </button>
            <button className="link" onClick={() => setOpen(false)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
