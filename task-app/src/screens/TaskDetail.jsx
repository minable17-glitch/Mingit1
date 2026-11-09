import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { diffDays, dueLabel, formatShort, toDateKST, todayKST } from '../lib/date.js';
import Breakdown from './Breakdown.jsx';
import Attachments from './Attachments.jsx';
import { extractFromLongText } from '../lib/notice.js';
import { isoToLocal, localToISO, parseRemindTime, remindLabel } from '../lib/remindTime.js';

// 긴 글이 통째로 업무 이름이 된 경우: 짧은 이름 + (비어 있으면) 기한·단계 + 원문은 메모
async function tidyLongTitle(task, categories, today) {
  const { draft } = extractFromLongText(task.title, categories, today);
  const patch = { title: draft.title };
  if (!task.due_date && draft.due_date) patch.due_date = draft.due_date;
  const updated = await api.updateTask(task, patch);
  const steps = draft.steps.filter((s) => s.title.trim());
  if (!task.steps?.length && steps.length) await api.saveBreakdown({ ...task, ...updated }, steps, draft.next_action);
  await api.addNote(task, draft.note || `[원문] ${task.title}`);
}

const KIND_LABEL = { create: '등록', check: '체크', note: '메모', edit: '수정', complete: '완료', wait: '공 넘김', reply: '응답 받음' };

export default function TaskDetail({ taskId, categories, categoryById, templates, features, links = [], tasks = [], reminders = [], settings, reload, onOpen, onOpenScreen, onClose }) {
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [breaking, setBreaking] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false); // ⋯ → 공 넘기기
  const [workOpen, setWorkOpen] = useState(false); // ⋯ → 캘린더 작업 시간
  const [busy, setBusy] = useState(false);
  const today = todayKST();

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([api.loadTask(taskId), api.loadActivity(taskId)]);
    setTask(t);
    setActivity(a);
  }, [taskId]);

  useEffect(() => {
    Promise.all([api.loadTask(taskId), api.loadActivity(taskId)]).then(([t, a]) => {
      setTask(t);
      setActivity(a);
    });
  }, [taskId]);

  if (!task) return <div className="center muted">불러오는 중…</div>;

  const category = categoryById[task.category_id];
  const active = task.status === 'active';

  async function run(fn) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (breaking) {
    return (
      <Breakdown
        task={task}
        categoryName={category?.name}
        templates={templates}
        onCancel={() => setBreaking(false)}
        onSaved={async () => { setBreaking(false); await load(); }}
      />
    );
  }

  const doneSteps = task.steps.filter((x) => x.done).length;
  const overdue = active && task.due_date && task.due_date < today;
  const myReminders = reminders.filter((r) => r.task_id === task.id);
  const toggle = (st) => run(async () => {
    const { completed } = await api.toggleStep(task, st);
    if (completed) alert('체크리스트를 다 마쳐서 업무를 보관함으로 옮겼어요. 수고하셨어요!');
  });

  return (
    <section className="detail note-page">
      <header className="note-top">
        <button className="link back" onClick={onClose}>‹ 뒤로</button>
        <MoreMenu
          items={[
            active && !task.waiting_on && ['공 넘기기 (결재·회신 기다림)', () => setWaitOpen(true)],
            active && ['체크리스트를 템플릿·AI로 만들기', () => setBreaking(true)],
            task.steps.length > 0 && ['템플릿으로 저장', () => {
              const name = prompt('템플릿 이름', task.title);
              if (name?.trim()) run(async () => { await api.saveTaskAsTemplate(task, name.trim()); alert('템플릿으로 저장했어요.'); });
            }],
            (task.due_date || task.steps.some((st) => st.due_date)) && onOpenScreen && ['달력으로 보기', () => onOpenScreen({ type: 'calendar', taskId: task.id })],
            active && features?.google_advanced && ['캘린더에 작업 시간 잡기', () => setWorkOpen(true)],
            !active && ['다시 진행', () => run(() => api.reopenTask(task))],
            ['삭제', async () => {
              if (!confirm(`“${task.title}” 업무를 완전히 지울까요? 캘린더 일정도 함께 지워집니다.`)) return;
              await api.deleteTask(task);
              onClose();
            }, 'danger'],
          ].filter(Boolean)}
        />
      </header>

      <EditableTitle key={task.title} task={task} onSave={(title) => run(() => api.updateTask(task, { title }))} />
      <div className="note-meta">
        <select className="plain-select" value={task.category_id} onChange={(e) => run(() => api.updateTask(task, { category_id: e.target.value }))} aria-label="영역">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span aria-hidden="true">·</span>
        <label className="plain-date">
          <span className="sr-only">마감</span>
          <input type="date" value={task.due_date ?? ''} onChange={(e) => run(() => api.updateTask(task, { due_date: e.target.value }))} />
        </label>
        {task.due_date && <span className={overdue ? 'hot' : ''}>{dueLabel(task.due_date, today).replace(' 마감', '')}</span>}
        {!active && <span>완료됨</span>}
      </div>
      {active && task.title.length > 40 && (
        <button className="link small tidy-link" disabled={busy} onClick={() => run(() => tidyLongTitle(task, categories, today))}>이름이 길어요 — 짧은 이름 + 체크리스트로 정리하기</button>
      )}

      {active && (task.waiting_on || waitOpen) && (
        <Waiting task={task} today={today} onCancel={() => setWaitOpen(false)}
          onWait={(who) => run(async () => { await api.setWaiting(task, who); setWaitOpen(false); })}
          onReply={(note) => run(() => api.clearWaiting(task, note))} />
      )}

      {active && !task.waiting_on && (
        <section className="note-sec">
          <h2 className="note-label">다음 행동</h2>
          <NextAction key={task.next_action} value={task.next_action} onSave={(next_action) => run(() => api.updateTask(task, { next_action }))} />
        </section>
      )}

      <section className="note-sec">
        <h2 className="note-label">체크리스트 {task.steps.length > 0 && <span>{doneSteps}/{task.steps.length}</span>}</h2>
        <ul className="check-list">
          {task.steps.map((st) => (
            <li key={st.id} className={st.done ? 'done' : ''}>
              <label className="grow">
                <input type="checkbox" checked={st.done} disabled={busy || !active} onChange={() => toggle(st)} />
                <span>{st.title}</span>
              </label>
              {st.due_date && <span className={`check-due${!st.done && st.due_date < today ? ' hot' : ''}`}>{formatShort(st.due_date)}</span>}
              {active && <button className="icon" disabled={busy} onClick={() => { if (confirm(`‘${st.title}’을(를) 체크리스트에서 뺄까요?`)) run(() => api.deleteStep(task, st)); }} aria-label={`${st.title} 빼기`}>×</button>}
            </li>
          ))}
        </ul>
        {active && <AddLine placeholder="+ 항목 추가" onAdd={(t) => run(() => api.addStep(task, t))} />}
      </section>

      <section className="note-sec">
        <h2 className="note-label">메모</h2>
        {task.latest_note && <p className="note-text">{task.latest_note}</p>}
        {active && <AddLine placeholder="어디까지 했고, 다음엔 뭐부터?" button="남기기" onAdd={(t) => run(() => api.addNote(task, t))} />}
      </section>

      <Links task={task} links={links} tasks={tasks} onOpen={onOpen} />

      {workOpen && <WorkBlockForm onClose={() => setWorkOpen(false)} onSave={(v) => run(async () => {
        await api.addWorkBlock(task, v);
        setWorkOpen(false);
        alert('구글 캘린더에 작업 시간을 넣었어요.');
      })} />}

      <div className="fold-rows">
        <details className="fold-row">
          <summary><span className="grow">첨부</span><span className="muted">사진·파일</span></summary>
          <Attachments taskId={task.id} pasteAnywhere title="" />
        </details>
        {active && (
          <details className="fold-row">
            <summary><span className="grow">시간 알림</span><span className="muted">{myReminders.length ? `${myReminders.length}개 · ${remindLabel(myReminders[0].remind_at)}` : '없음'}</span></summary>
            <Reminders task={task} reminders={myReminders} bell={settings?.bell_schedule} reload={reload} />
          </details>
        )}
        <details className="fold-row">
          <summary><span className="grow">활동 기록</span><span className="muted">{activity.length}</span></summary>
          <ul className="activity">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="muted small">{new Date(a.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                {' '}<b>{KIND_LABEL[a.kind]}</b> {a.content}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {active && <button className="done-wide" disabled={busy} onClick={() => run(() => api.completeTask(task))}>완료</button>}
    </section>
  );
}

// 오른쪽 위 ⋯ 메뉴 (자주 안 쓰는 것들)
function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="more-menu">
      <button className="icon more-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="더 보기">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor"><circle cx="5" cy="11" r="1.7" /><circle cx="11" cy="11" r="1.7" /><circle cx="17" cy="11" r="1.7" /></svg>
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <ul className="menu-pop" role="menu">
            {items.map(([label, fn, kind]) => (
              <li key={label}><button role="menuitem" className={kind === 'danger' ? 'danger-text' : ''} onClick={() => { setOpen(false); fn(); }}>{label}</button></li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// 한 줄 입력: Enter 로 추가
function AddLine({ placeholder, button = '추가', onAdd }) {
  const [v, setV] = useState('');
  return (
    <form className="add-line" onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; onAdd(v.trim()); setV(''); }}>
      <input className="grow" value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} />
      {v.trim() && <button className="link">{button}</button>}
    </form>
  );
}

// 이 업무와 연결된 앞·뒤 업무 (연결 만들기는 연결도 탭에서)
function Links({ task, links, tasks, onOpen }) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const before = links.filter((l) => l.to_task_id === task.id).map((l) => byId[l.from_task_id]).filter(Boolean);
  const after = links.filter((l) => l.from_task_id === task.id).map((l) => byId[l.to_task_id]).filter(Boolean);
  if (!before.length && !after.length) return null;
  const item = (t) => <button key={t.id} className="link" onClick={() => onOpen?.(t.id)}>{t.title}</button>;
  return (
    <div className="note-sec small">
      <h2 className="note-label">연결된 업무</h2>
      {before.length > 0 && <div>먼저 끝내야 할 업무: {before.map(item)}</div>}
      {after.length > 0 && <div>이 업무 다음에 할 업무: {after.map(item)}</div>}
      <p className="muted">연결을 바꾸려면 하단 “연결도” 탭에서.</p>
    </div>
  );
}

// 공 넘겨놓은 일: 결재·회신을 기다리는 동안은 '방치' 대신 'N일 무응답'으로 알려줌
function Waiting({ task, today, onWait, onReply, onCancel }) {
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');

  if (task.waiting_on) {
    const since = toDateKST(task.waiting_since ?? task.last_activity_at);
    const days = diffDays(since, today);
    return (
      <div className="wait-line">
        <span className="grow"><b>{task.waiting_on}</b> 기다리는 중 · {days}일째</span>
        <input placeholder="받은 답 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => onReply(note)}>답 받음</button>
      </div>
    );
  }
  return (
    <form className="wait-line" onSubmit={(e) => { e.preventDefault(); if (who.trim()) onWait(who); }}>
      <input className="grow" autoFocus placeholder="누구·무엇을 기다리나요? (예: 교감 결재)" value={who} onChange={(e) => setWho(e.target.value)} />
      <button className="primary" disabled={!who.trim()}>표시</button>
      <button type="button" className="link" onClick={onCancel}>취소</button>
    </form>
  );
}

function EditableTitle({ task, onSave }) {
  const [value, setValue] = useState(task.title);
  return (
    <input
      className="title-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== task.title && onSave(value.trim())}
    />
  );
}

function NextAction({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  const changed = draft.trim() && draft.trim() !== value;
  return (
    <form className="add-line next-line" onSubmit={(e) => { e.preventDefault(); if (changed) onSave(draft.trim()); }}>
      <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => changed && onSave(draft.trim())} aria-label="다음 행동" />
    </form>
  );
}

// 시간 알림: 정한 시간에 폰·컴퓨터로 알림 (설정 → 시간 알림에서 기기마다 켜야 함)
function Reminders({ task, reminders, bell, reload }) {
  const [at, setAt] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pushOn, setPushOn] = useState(true);
  useEffect(() => { api.pushState().then((st) => setPushOn(st === 'on')).catch(() => {}); }, []);

  // 빠른 선택: 30분 뒤, 점심 전, 퇴근 전, 내일 아침 (화면을 열 때 한 번 계산)
  const [quick] = useState(() => {
    const now = Date.now();
    return [
      { label: '30분 뒤', value: isoToLocal(new Date(now + 30 * 60e3).toISOString()) },
      { label: '점심 전', value: parseRemindTime('점심', now, bell)?.at },
      { label: '퇴근 전', value: parseRemindTime('퇴근', now, bell)?.at },
      { label: '내일 아침', value: parseRemindTime('내일 아침', now, bell)?.at },
    ].filter((q) => q.value);
  });

  async function add() {
    if (!at) return;
    setBusy(true);
    try {
      await api.addReminder({ taskId: task.id, title: text.trim() || task.next_action || task.title, remindAt: localToISO(at) });
      setAt('');
      setText('');
      await reload?.();
    } catch (e) {
      alert(e.message.includes('reminders') ? '관리자가 schema_push.sql(또는 install_all.sql)을 한 번 더 실행해야 쓸 수 있어요.' : `알림을 저장하지 못했어요: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack fold-body">
      {reminders.length > 0 && (
        <ul className="reminder-list">
          {reminders.map((r) => (
            <li key={r.id}>
              <b>{remindLabel(r.remind_at)}</b> <span className="grow">{r.title}</span>
              <button className="link small" onClick={async () => { await api.removeReminder(r.id); await reload?.(); }}>지우기</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row wrap">
        {quick.map((q) => <button key={q.label} type="button" className={at === q.value ? 'chip on' : 'chip'} onClick={() => setAt(q.value)}>{q.label}</button>)}
      </div>
      <div className="row wrap">
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        <input className="grow" placeholder={`알림 내용 (비우면: ${task.next_action})`} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!at || busy} onClick={add}>알림 추가</button>
      </div>
      {!pushOn && <p className="small warn">이 기기에서 알림 받기가 꺼져 있어요. 설정 → 시간 알림에서 켜 주세요.</p>}
    </div>
  );
}

function WorkBlockForm({ onSave, onClose }) {
  const [date, setDate] = useState(todayKST());
  const [start, setStart] = useState('15:00');
  const [minutes, setMinutes] = useState(50);
  return (
    <form className="wait-line" onSubmit={(e) => { e.preventDefault(); onSave({ date, start, minutes: Number(minutes) }); }}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
      <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
        {[25, 50, 90, 120].map((m) => <option key={m} value={m}>{m}분</option>)}
      </select>
      <button className="primary">캘린더에 넣기</button>
      <button type="button" className="link" onClick={onClose}>취소</button>
    </form>
  );
}
