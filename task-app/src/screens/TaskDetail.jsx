import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { diffDays, dueLabel, formatShort, toDateKST, todayKST } from '../lib/date.js';
import Breakdown from './Breakdown.jsx';
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

export default function TaskDetail({ taskId, categories, categoryById, templates, features, links = [], tasks = [], reminders = [], settings, reload, onOpen, onClose }) {
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [breaking, setBreaking] = useState(false);
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

  return (
    <section className="detail">
      <header className="page-head">
        <button className="link" onClick={onClose}>← 브리핑</button>
        <span className="cat-tag" style={{ '--c': category?.color }}>{category?.name}</span>
      </header>

      {task.latest_note && (
        <div className="latest-note">
          <div className="small muted">마지막 메모</div>
          {task.latest_note}
        </div>
      )}

      <EditableTitle key={task.title} task={task} onSave={(title) => run(() => api.updateTask(task, { title }))} />
      {active && task.title.length > 40 && (
        <div className="banner static small">
          업무 이름이 너무 길어요. 짧은 이름·기한·단계로 나누고 원문은 메모로 옮길까요?{' '}
          <button className="primary" disabled={busy} onClick={() => run(() => tidyLongTitle(task, categories, today))}>제목 정리하기</button>
        </div>
      )}

      <div className="fields">
        <label>
          분류
          <select
            value={task.category_id}
            onChange={(e) => run(() => api.updateTask(task, { category_id: e.target.value }))}
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          마감
          <input
            type="date"
            value={task.due_date ?? ''}
            onChange={(e) => run(() => api.updateTask(task, { due_date: e.target.value }))}
          />
          {task.due_date && <span className="muted small">{dueLabel(task.due_date, today)}</span>}
        </label>
      </div>

      {active && (
        <Waiting
          task={task}
          today={today}
          onWait={(who) => run(() => api.setWaiting(task, who))}
          onReply={(note) => run(() => api.clearWaiting(task, note))}
        />
      )}

      {active && !task.waiting_on && (
        <NextAction
          key={task.next_action}
          value={task.next_action}
          onSave={(next_action) => run(() => api.updateTask(task, { next_action }))}
        />
      )}

      <div className="block">
        <div className="block-head">
          <h2>단계</h2>
          {active && (
            <button onClick={() => setBreaking(true)}>{task.steps.length ? '단계 고치기' : '단계 정하기'}</button>
          )}
        </div>
        {task.steps.length === 0 && <p className="muted small">아직 단계가 없습니다. “단계 정하기”에서 템플릿·기본 단계·AI 도움받기로 쉽게 시작할 수 있어요.</p>}
        <ul className="steps">
          {task.steps.map((s) => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={busy || !active}
                  onChange={() => run(async () => {
                    const { completed } = await api.toggleStep(task, s);
                    if (completed) alert('마지막 단계를 마쳐서 업무를 보관함으로 옮겼어요. 수고하셨어요!');
                  })}
                />
                <span>{s.title}</span>
              </label>
              {s.due_date && (
                <span className={!s.done && s.due_date < today ? 'badge danger' : 'badge'}>{formatShort(s.due_date)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Links task={task} links={links} tasks={tasks} onOpen={onOpen} />

      {active && <NoteForm onSave={(note, next) => run(() => api.addNote(task, note, next))} />}

      {active && <Reminders task={task} reminders={reminders.filter((r) => r.task_id === task.id)} bell={settings?.bell_schedule} reload={reload} />}

      {active && features?.google_advanced && <WorkBlockForm onSave={(v) => run(async () => {
        await api.addWorkBlock(task, v);
        alert('구글 캘린더에 작업 시간을 넣었어요.');
      })} />}

      <div className="block">
        <h2>활동 기록</h2>
        <ul className="activity">
          {activity.map((a) => (
            <li key={a.id}>
              <span className="muted small">{new Date(a.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {' '}<b>{KIND_LABEL[a.kind]}</b> {a.content}
            </li>
          ))}
        </ul>
      </div>

      <div className="actions">
        {active ? (
          <button disabled={busy} onClick={() => run(() => api.completeTask(task))}>완료로 보관</button>
        ) : (
          <button disabled={busy} onClick={() => run(() => api.reopenTask(task))}>다시 진행</button>
        )}
        {task.steps.length > 0 && (
          <button
            disabled={busy}
            onClick={() => {
              const name = prompt('템플릿 이름', task.title);
              if (name?.trim()) run(async () => { await api.saveTaskAsTemplate(task, name.trim()); alert('템플릿으로 저장했어요.'); });
            }}
          >
            템플릿으로 저장
          </button>
        )}
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`“${task.title}” 업무를 완전히 지울까요? 캘린더 일정도 함께 지워집니다.`)) return;
            await api.deleteTask(task);
            onClose();
          }}
        >
          삭제
        </button>
      </div>
    </section>
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
    <div className="block stack small">
      <h2>🔗 연결된 업무</h2>
      {before.length > 0 && <div>먼저 끝내야 할 업무: {before.map(item)}</div>}
      {after.length > 0 && <div>이 업무 다음에 할 업무: {after.map(item)}</div>}
      <p className="muted">연결을 바꾸려면 하단 “연결도” 탭에서.</p>
    </div>
  );
}

// 공 넘겨놓은 일: 결재·회신을 기다리는 동안은 '방치' 대신 'N일 무응답'으로 알려줌
function Waiting({ task, today, onWait, onReply }) {
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  if (task.waiting_on) {
    const since = toDateKST(task.waiting_since ?? task.last_activity_at);
    const days = diffDays(since, today);
    return (
      <div className="waiting-box">
        <div>⏳ <b>{task.waiting_on}</b> 기다리는 중 · {formatShort(since)}부터 {days}일째</div>
        <div className="row">
          <input className="grow" placeholder="받은 답 메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" onClick={() => onReply(note)}>답 받음</button>
        </div>
      </div>
    );
  }
  if (!open) {
    return <button className="link" onClick={() => setOpen(true)}>⏳ 공 넘기기 (결재·회신 대기로 표시)</button>;
  }
  return (
    <form className="waiting-box row" onSubmit={(e) => { e.preventDefault(); if (who.trim()) onWait(who); }}>
      <input className="grow" autoFocus placeholder="누구/무엇을 기다리나요? (예: 교감 결재, 행정실 회신)" value={who} onChange={(e) => setWho(e.target.value)} />
      <button className="primary" disabled={!who.trim()}>표시</button>
      <button type="button" className="link" onClick={() => setOpen(false)}>취소</button>
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
    <div className="next-action">
      <div className="small muted">지금 할 다음 행동</div>
      <div className="row">
        <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} />
        {changed && <button onClick={() => onSave(draft.trim())}>저장</button>}
      </div>
    </div>
  );
}

function NoteForm({ onSave }) {
  const [note, setNote] = useState('');
  const [next, setNext] = useState('');
  return (
    <form
      className="block"
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        onSave(note, next);
        setNote('');
        setNext('');
      }}
    >
      <h2>멈추기 전에 한 줄</h2>
      <input
        placeholder="어디까지 했고, 다음엔 뭐부터? (예: 견적 1곳 받음, 나머지 1곳 전화부터)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <input
        placeholder="다음 행동도 바꾸려면 입력 (선택)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <button className="primary" disabled={!note.trim()}>메모 남기기</button>
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
    <div className="block stack">
      <h2>🔔 시간 알림</h2>
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

function WorkBlockForm({ onSave }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayKST());
  const [start, setStart] = useState('15:00');
  const [minutes, setMinutes] = useState(50);
  if (!open) {
    return <button className="link" onClick={() => setOpen(true)}>+ 캘린더에 작업 시간 잡기</button>;
  }
  return (
    <form
      className="block row wrap"
      onSubmit={(e) => { e.preventDefault(); onSave({ date, start, minutes: Number(minutes) }); setOpen(false); }}
    >
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
      <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
        {[25, 50, 90, 120].map((m) => <option key={m} value={m}>{m}분</option>)}
      </select>
      <button className="primary">캘린더에 넣기</button>
      <button type="button" className="link" onClick={() => setOpen(false)}>취소</button>
    </form>
  );
}
