// ☀️ 오늘 · 📆 이번 주 · 🗓 이번 달 할 일: 기간 안 마감과 알림은 자동으로 모으고, '내 목록'은 직접 추가·순서 바꾸기·체크.
// 오늘 목록은 시간표의 공강(자투리 시간)마다 나눠 넣어 계획할 수 있어요.
// 지난 기간에 못 끝낸 내 목록은 한 번에 이번 기간으로 가져올 수 있어요.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { dueLabel, formatShort } from '../lib/date.js';
import { remindLabel } from '../lib/remindTime.js';
import { freePeriodsOn } from '../lib/timetable.js';
import { autoPlan, buildToday, moveItem, scopeRange } from '../lib/today.js';

const SCOPES = [
  { key: 'day', tab: '☀️ 오늘', due: '🔥 오늘 마감 · 지난 마감', mine: '✅ 내 오늘 목록', carry: '어제까지 못 끝낸 내 할 일', bring: '오늘로 가져오기', ph: '오늘 할 일 추가' },
  { key: 'week', tab: '📆 이번 주', due: '🔥 이번 주 마감', mine: '✅ 이번 주에 할 일', carry: '지난주에 못 끝낸 주간 할 일', bring: '이번 주로 가져오기', ph: '이번 주 할 일 추가 (예: 학부모 상담 일정 잡기)' },
  { key: 'month', tab: '🗓 이번 달', due: '🔥 이번 달 마감', mine: '✅ 이번 달에 할 일', carry: '지난달에 못 끝낸 월간 할 일', bring: '이번 달로 가져오기', ph: '이번 달 할 일 추가 (예: 학급 문집 원고 모으기)' },
];
const SCOPE_KEY = 'task-keeper.today-scope';

export default function TodayCard({ tasks, reminders, items, today, settings = {}, reload, onOpen, onOpenTimetable }) {
  const [text, setText] = useState('');
  const [addPeriod, setAddPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState(() => { try { return localStorage.getItem(SCOPE_KEY) || 'day'; } catch { return 'day'; } });
  const pickScope = (e, s) => {
    e.preventDefault(); // 접기/펼치기 대신 탭만 바꿈
    setScope(s);
    try { localStorage.setItem(SCOPE_KEY, s); } catch { /* 괜찮음 */ }
  };
  const S = SCOPES.find((x) => x.key === scope) ?? SCOPES[0];

  if (items === null) {
    return (
      <div className="today-card block">
        <h2>☀️ 오늘 할 일</h2>
        <p className="small muted">잠시 뒤 다시 열어 주세요. (오늘 목록 표를 준비하는 중이에요)</p>
      </div>
    );
  }

  const key = scopeRange(S.key, today).key;
  const t = buildToday(tasks, reminders, items, today, S.key);
  const free = S.key === 'day' ? freePeriodsOn(settings.bell_schedule, settings.timetable, today) : [];
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
    const period = addPeriod === '' ? null : Number(addPeriod);
    setText('');
    run(() => api.addTodayItem({ day: key, title, position: nextPos(), scope: S.key, period }));
  }

  const pct = t.total ? Math.round(((t.doneCount) / t.total) * 100) : 0;
  const empty = !t.due.length && !t.reminders.length && !t.mine.length;

  // 공강 계획: 공강 교시마다 묶고, 나머지는 '시간 미정'
  const freeSet = new Set(free.map((p) => p.period));
  const slotOf = (i) => (i.period != null && freeSet.has(Number(i.period)) ? Number(i.period) : null);
  const loose = t.mine.filter((i) => slotOf(i) === null);
  const planned = autoPlan(t.mine.map((i) => ({ ...i, period: slotOf(i) })), free);
  const rowProps = { busy, run, onOpen, free };

  return (
    <details className="today-card block" open>
      <summary>
        <span className="today-tabs" role="tablist">
          {SCOPES.map((x) => (
            <button key={x.key} role="tab" aria-selected={x.key === S.key} className={x.key === S.key ? 'on' : ''} onClick={(e) => pickScope(e, x.key)}>{x.tab}</button>
          ))}
        </span>
        <span className="small muted">
          {t.total ? `${t.total}개 중 ${t.doneCount}개 끝` : '아직 없어요'}
          {t.reminders.length > 0 && ` · 🔔 ${t.reminders.length}`}
        </span>
        {t.total > 0 && <span className="today-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
      </summary>

      {t.carry.length > 0 && (
        <div className="carry small">
          <span className="grow">{S.carry} {t.carry.length}개</span>
          <button className="link" disabled={busy} onClick={() => run(() => api.updateTodayItems(t.carry.map((i, k) => ({ id: i.id, day: key, position: nextPos() + k, ...(S.key === 'day' ? { period: null } : {}) }))))}>{S.bring}</button>
          <button className="link muted" disabled={busy} onClick={() => run(() => Promise.all(t.carry.map((i) => api.deleteTodayItem(i.id))))}>버리기</button>
        </div>
      )}

      {t.due.length > 0 && (
        <div className="today-group">
          <h3>{S.due}</h3>
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
                <span className={d.overdue ? 'badge danger' : 'badge warn'}>{S.key === 'day' ? dueLabel(d.date, today) : `${formatShort(d.date)} · ${dueLabel(d.date, today).replace(' 마감', '')}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.reminders.length > 0 && (
        <div className="today-group">
          <h3>🔔 {S.key === 'day' ? '오늘' : S.key === 'week' ? '이번 주' : '이번 달'} 알림</h3>
          <ul>
            {t.reminders.map((r) => (
              <li key={r.id}>
                <b className="remind-time">{S.key === 'day' ? remindLabel(r.remind_at).replace('오늘 ', '') : remindLabel(r.remind_at)}</b>
                {r.task_id ? <button className="link grow left" onClick={() => onOpen(r.task_id)}>{r.title}</button> : <span className="grow">{r.title}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {free.length > 0 && (
        <div className="today-group spare-plan">
          <h3>☕ 자투리 시간 계획 <span className="muted">· 공강마다 할 일을 나눠 넣어요</span></h3>
          <ol>
            {free.map((p) => {
              const here = t.mine.filter((i) => slotOf(i) === p.period);
              return (
                <li key={p.period} className={`${p.now ? 'now' : ''}${p.past ? ' past' : ''}`}>
                  <div className="spare-slot-head">
                    <b>{p.period}교시</b>
                    <span className="small muted">{p.start}~{p.end}</span>
                    {p.now && <span className="badge">지금</span>}
                  </div>
                  {here.length === 0
                    ? <p className="small muted spare-empty">{p.past ? '지나간 공강' : '비어 있어요 — 아래 할 일의 ⏰에서 이 교시를 고르세요'}</p>
                    : <ul className="mine">{here.map((i, k) => <ItemRow key={i.id} i={i} list={here} k={k} {...rowProps} />)}</ul>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="today-group">
        <h3>{free.length > 0 ? '⏳ 시간 미정' : S.mine}</h3>
        {loose.length > 0 && (
          <ul className="mine">
            {loose.map((i, k) => <ItemRow key={i.id} i={i} list={loose} k={k} {...rowProps} />)}
          </ul>
        )}
        {planned.length > 0 && (
          <button className="link small" disabled={busy} onClick={() => run(() => api.updateTodayItems(planned))}>✨ 남은 공강에 차례로 하나씩 넣기 ({planned.length}개)</button>
        )}
        <form className="row" onSubmit={add}>
          <input className="grow" placeholder={S.ph} value={text} onChange={(e) => setText(e.target.value)} />
          {free.length > 0 && (
            <select value={addPeriod} onChange={(e) => setAddPeriod(e.target.value)} aria-label="언제 할까요">
              <option value="">⏰ 언제든</option>
              {free.filter((p) => !p.past).map((p) => <option key={p.period} value={p.period}>{p.period}교시 공강</option>)}
            </select>
          )}
          <button className="primary" disabled={busy || !text.trim()}>추가</button>
        </form>
        {S.key === 'day' && free.length === 0 && !settings.bell_schedule?.length && onOpenTimetable && (
          <p className="small muted">🕘 <button className="link" onClick={onOpenTimetable}>시간표</button>에 수업 시간을 표시하면 공강(자투리 시간)마다 할 일을 나눠 계획할 수 있어요.</p>
        )}
        {empty && S.key === 'day' && <p className="small muted">오늘 마감도 알림도 없어요. 오늘 꼭 할 것만 골라 적거나, 아래 업무를 펼쳐 “☀️ 오늘 할 일에”를 눌러 보세요.</p>}
        {empty && S.key !== 'day' && <p className="small muted">{S.key === 'week' ? '이번 주' : '이번 달'} 마감이 없어요. 이 기간 안에 끝낼 큰 일을 적어 두세요. 하루 단위로 할 일은 ☀️ 오늘에 적으면 돼요.</p>}
      </div>
    </details>
  );
}

// 내 목록 한 줄: 체크 · 이름 · (오늘이면) 공강 고르기 · 순서 · 빼기
function ItemRow({ i, list, k, busy, run, onOpen, free }) {
  return (
    <li className={i.done ? 'done' : ''}>
      <input type="checkbox" checked={i.done} disabled={busy} onChange={() => run(() => api.updateTodayItem(i.id, { done: !i.done }))} aria-label={`${i.title} 끝냄`} />
      {i.task_id
        ? <button className="link grow left" onClick={() => onOpen(i.task_id)}>{i.title}</button>
        : <span className="grow">{i.title}</span>}
      {free.length > 0 && !i.done && (
        <select className="period-pick" value={free.some((p) => p.period === Number(i.period)) ? i.period : ''} disabled={busy}
          onChange={(e) => run(() => api.updateTodayItem(i.id, { period: e.target.value === '' ? null : Number(e.target.value) }))} aria-label={`${i.title} 언제 할까요`}>
          <option value="">⏰ 언제?</option>
          {free.map((p) => <option key={p.period} value={p.period}>{p.period}교시{p.past ? ' (지남)' : ''}</option>)}
        </select>
      )}
      {!i.done && (
        <span className="order">
          <button className="icon" disabled={busy || k === 0} onClick={() => run(() => api.updateTodayItems(moveItem(list, i.id, -1)))} aria-label="위로">↑</button>
          <button className="icon" disabled={busy || !list[k + 1] || list[k + 1].done} onClick={() => run(() => api.updateTodayItems(moveItem(list, i.id, 1)))} aria-label="아래로">↓</button>
        </span>
      )}
      <button className="icon" disabled={busy} onClick={() => run(() => api.deleteTodayItem(i.id))} aria-label="빼기">×</button>
    </li>
  );
}
