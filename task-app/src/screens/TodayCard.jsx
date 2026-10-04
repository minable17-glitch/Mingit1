// ☀️ 오늘 할 일: 오늘·지난 마감과 오늘 알림은 자동으로 모으고, '내 오늘 목록'은 직접 추가·순서 바꾸기·체크.
// 어제까지 못 끝낸 내 목록은 한 번에 오늘로 가져올 수 있어요.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { dueLabel } from '../lib/date.js';
import { remindLabel } from '../lib/remindTime.js';
import { buildToday, moveItem } from '../lib/today.js';

export default function TodayCard({ tasks, reminders, items, today, reload, onOpen }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (items === null) {
    return (
      <div className="today-card block">
        <h2>☀️ 오늘 할 일</h2>
        <p className="small muted">잠시 뒤 다시 열어 주세요. (오늘 목록 표를 준비하는 중이에요)</p>
      </div>
    );
  }

  const t = buildToday(tasks, reminders, items, today);
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  const nextPos = () => t.mine.reduce((m, i) => Math.max(m, i.position + 1), 0);

  function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const title = text;
    setText('');
    run(() => api.addTodayItem({ day: today, title, position: nextPos() }));
  }

  const pct = t.total ? Math.round(((t.doneCount) / t.total) * 100) : 0;
  const empty = !t.due.length && !t.reminders.length && !t.mine.length;

  return (
    <details className="today-card block" open>
      <summary>
        <span className="today-title">☀️ 오늘 할 일</span>
        <span className="small muted">
          {t.total ? `${t.total}개 중 ${t.doneCount}개 끝` : '아직 없어요'}
          {t.reminders.length > 0 && ` · 🔔 ${t.reminders.length}`}
        </span>
        {t.total > 0 && <span className="today-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
      </summary>

      {t.carry.length > 0 && (
        <div className="carry small">
          <span className="grow">어제까지 못 끝낸 내 할 일 {t.carry.length}개</span>
          <button className="link" disabled={busy} onClick={() => run(() => api.updateTodayItems(t.carry.map((i, k) => ({ id: i.id, day: today, position: nextPos() + k }))))}>오늘로 가져오기</button>
          <button className="link muted" disabled={busy} onClick={() => run(() => Promise.all(t.carry.map((i) => api.deleteTodayItem(i.id))))}>버리기</button>
        </div>
      )}

      {t.due.length > 0 && (
        <div className="today-group">
          <h3>🔥 오늘 마감 · 지난 마감</h3>
          <ul>
            {t.due.map((d) => (
              <li key={d.key}>
                {d.step ? (
                  <label className="grow">
                    <input type="checkbox" disabled={busy} onChange={() => run(async () => {
                      const { completed } = await api.toggleStep(d.task, d.step);
                      if (completed) alert(`“${d.task.title}”의 마지막 단계를 마쳐서 보관함으로 옮겼어요. 수고하셨어요!`);
                    })} />
                    <span>{d.step.title} <span className="muted small">· {d.task.title}</span></span>
                  </label>
                ) : (
                  <button className="link grow left" onClick={() => onOpen(d.task.id)}>📄 {d.task.title} <span className="muted small">· {d.task.next_action}</span></button>
                )}
                <span className={d.overdue ? 'badge danger' : 'badge warn'}>{dueLabel(d.date, today)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.reminders.length > 0 && (
        <div className="today-group">
          <h3>🔔 오늘 알림</h3>
          <ul>
            {t.reminders.map((r) => (
              <li key={r.id}>
                <b className="remind-time">{remindLabel(r.remind_at).replace('오늘 ', '')}</b>
                {r.task_id ? <button className="link grow left" onClick={() => onOpen(r.task_id)}>{r.title}</button> : <span className="grow">{r.title}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="today-group">
        <h3>✅ 내 오늘 목록</h3>
        {t.mine.length > 0 && (
          <ul className="mine">
            {t.mine.map((i, k) => (
              <li key={i.id} className={i.done ? 'done' : ''}>
                <input type="checkbox" checked={i.done} disabled={busy} onChange={() => run(() => api.updateTodayItem(i.id, { done: !i.done }))} aria-label={`${i.title} 끝냄`} />
                {i.task_id
                  ? <button className="link grow left" onClick={() => onOpen(i.task_id)}>{i.title}</button>
                  : <span className="grow">{i.title}</span>}
                {!i.done && (
                  <span className="order">
                    <button className="icon" disabled={busy || k === 0} onClick={() => run(() => api.updateTodayItems(moveItem(t.mine, i.id, -1)))} aria-label="위로">↑</button>
                    <button className="icon" disabled={busy || !t.mine[k + 1] || t.mine[k + 1].done} onClick={() => run(() => api.updateTodayItems(moveItem(t.mine, i.id, 1)))} aria-label="아래로">↓</button>
                  </span>
                )}
                <button className="icon" disabled={busy} onClick={() => run(() => api.deleteTodayItem(i.id))} aria-label="빼기">×</button>
              </li>
            ))}
          </ul>
        )}
        <form className="row" onSubmit={add}>
          <input className="grow" placeholder="오늘 할 일 추가 (예: 3교시 후 복사하기)" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="primary" disabled={busy || !text.trim()}>추가</button>
        </form>
        {empty && <p className="small muted">오늘 마감도 알림도 없어요. 오늘 꼭 할 것만 골라 적거나, 아래 업무를 펼쳐 “☀️ 오늘 할 일에”를 눌러 보세요.</p>}
      </div>
    </details>
  );
}
