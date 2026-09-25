import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { diffDays, dueLabel, formatShort, toDateKST, todayKST } from '../lib/date.js';
import Breakdown from './Breakdown.jsx';

const KIND_LABEL = { create: '등록', check: '체크', note: '메모', edit: '수정', complete: '완료', wait: '공 넘김', reply: '응답 받음' };

export default function TaskDetail({ taskId, categories, categoryById, templates, features, onClose }) {
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [breaking, setBreaking] = useState(null); // null | 'manual' | 'ai'
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
        useAi={breaking === 'ai'}
        onCancel={() => setBreaking(null)}
        onSaved={async () => { setBreaking(null); await load(); }}
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
            <span className="row">
              <button onClick={() => setBreaking('manual')}>{task.steps.length ? '단계 고치기' : '단계 정하기'}</button>
              {features?.ai_enabled && <button onClick={() => setBreaking('ai')}>AI와 쪼개기</button>}
            </span>
          )}
        </div>
        {task.steps.length === 0 && <p className="muted small">아직 단계가 없습니다. “단계 정하기”에서 템플릿이나 기본 단계로 쉽게 시작할 수 있어요.</p>}
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

      {active && <NoteForm onSave={(note, next) => run(() => api.addNote(task, note, next))} />}

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
