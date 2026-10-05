// 📅 마감 달력: 업무·단계 마감과 알림을 달력으로. 전체 / 분류 하나 / 업무 하나로 골라 보기.
// 날짜를 누르면 그날 일정이 아래에, 업무 하나를 고르면 단계 일정표도 함께.
import { useMemo, useState } from 'react';
import { dueLabel, todayKST } from '../lib/date.js';
import { calendarEvents, monthGrid, monthKey, shiftMonth, taskTimeline } from '../lib/calendar.js';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const parseFilter = (v) => {
  if (!v || v === 'all') return { kind: 'all' };
  const [kind, id] = v.split(':');
  return { kind: kind === 'c' ? 'category' : 'task', id };
};

export default function Calendar({ tasks, categories, reminders = [], onOpen, initialTaskId = '' }) {
  const today = todayKST();
  const [ym, setYm] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }));
  const [filterValue, setFilterValue] = useState(initialTaskId ? `t:${initialTaskId}` : 'all');
  const [selected, setSelected] = useState(today);
  const filter = parseFilter(filterValue);

  const events = useMemo(() => calendarEvents(tasks, categories, filter, reminders, today), [tasks, categories, filterValue, reminders, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const weeks = monthGrid(ym.year, ym.month);
  const inMonth = Object.entries(events).filter(([d]) => d.startsWith(monthKey(ym)));
  const monthCount = inMonth.reduce((n, [, list]) => n + list.filter((e) => e.kind !== 'reminder').length, 0);
  const dayList = events[selected] ?? [];
  const task = filter.kind === 'task' ? tasks.find((t) => t.id === filter.id) : null;

  const goto = (d) => setYm((cur) => shiftMonth(cur, d));
  const goToday = () => { setYm({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }); setSelected(today); };

  return (
    <div className="cal">
      <div className="row wrap cal-tools">
        <select className="grow" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} aria-label="무엇을 볼까요">
          <option value="all">📅 전체 업무</option>
          <optgroup label="분류별">
            {categories.filter((c) => tasks.some((t) => t.category_id === c.id)).map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
          </optgroup>
          <optgroup label="업무 하나">
            {tasks.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.title}</option>)}
          </optgroup>
        </select>
      </div>

      <div className="cal-head">
        <button className="icon big" onClick={() => goto(-1)} aria-label="지난달">‹</button>
        <b>{ym.year}년 {ym.month}월</b>
        <button className="icon big" onClick={() => goto(1)} aria-label="다음 달">›</button>
        <span className="grow" />
        <span className="small muted">마감 {monthCount}개</span>
        <button className="small" onClick={goToday}>오늘</button>
      </div>

      <div className="cal-grid" role="grid" aria-label={`${ym.year}년 ${ym.month}월 마감 달력`}>
        {DOW.map((d, i) => <div key={d} className={`cal-dow dow-${i}`} role="columnheader">{d}</div>)}
        {weeks.flat().map((c) => {
          const list = events[c.date] ?? [];
          const shown = list.slice(0, 2);
          return (
            <button
              key={c.date}
              role="gridcell"
              className={`cal-cell${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}${c.date === selected ? ' sel' : ''} dow-${c.dow}`}
              onClick={() => setSelected(c.date)}
              aria-label={`${c.date} 일정 ${list.length}개`}
            >
              <span className="cal-num">{Number(c.date.slice(8))}</span>
              {shown.map((e) => (
                <span key={e.key} className={`cal-chip ${e.kind}${e.done ? ' done' : ''}${e.overdue ? ' overdue' : ''}`} style={{ '--c': e.color }}>
                  {e.kind === 'reminder' ? '🔔' : e.done ? '✓' : ''}{e.title}
                </span>
              ))}
              {list.length > 2 && <span className="cal-more">+{list.length - 2}</span>}
            </button>
          );
        })}
      </div>
      <ul className="bal-legend small" aria-label="범례">
        <li><span className="cal-chip task" style={{ '--c': '#9aa5b8' }}>업무 마감</span></li>
        <li><span className="cal-chip step" style={{ '--c': '#9aa5b8' }}>단계</span></li>
        <li><span className="cal-chip step overdue" style={{ '--c': '#9aa5b8' }}>지난 마감</span></li>
        <li>🔔 알림 · 색 = 분류</li>
      </ul>

      <div className="block cal-day">
        <h2>{Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일 ({DOW[new Date(`${selected}T00:00:00Z`).getUTCDay()]}) <span className="muted small">{selected === today ? '오늘' : dueLabel(selected, today).replace(' 마감', '').replace('일 지남', '일 전')}</span></h2>
        {dayList.length === 0 ? <p className="small muted">이날은 마감이 없어요.</p> : (
          <ul className="cal-list">
            {dayList.map((e) => (
              <li key={e.key} style={{ '--c': e.color }} className={e.done ? 'done' : ''}>
                <span className="cal-dot" aria-hidden="true" />
                <button className="link left grow" onClick={() => e.taskId && onOpen(e.taskId)}>
                  <b>{e.kind === 'reminder' ? '🔔 ' : e.done ? '✓ ' : ''}{e.title}</b>
                  <span className="small muted"> · {e.sub}</span>
                </button>
                {e.overdue && <span className="badge danger">지남</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {task && (
        <div className="block">
          <h2>🗂 {task.title} 일정표</h2>
          <ol className="timeline">
            {taskTimeline(task).map((s) => (
              <li key={s.key} className={s.done ? 'done' : s.date && s.date < today ? 'late' : ''}>
                <span className="tl-date">{s.date ? `${Number(s.date.slice(5, 7))}/${Number(s.date.slice(8))}` : '날짜 없음'}</span>
                <span className="grow">{s.done ? '✓ ' : ''}{s.title}</span>
              </li>
            ))}
            <li className="tl-end">
              <span className="tl-date">{task.due_date ? `${Number(task.due_date.slice(5, 7))}/${Number(task.due_date.slice(8))}` : '—'}</span>
              <b className="grow">🏁 업무 마감{task.due_date ? ` (${dueLabel(task.due_date, today)})` : ' 없음'}</b>
            </li>
          </ol>
          <button className="link" onClick={() => onOpen(task.id)}>업무 열기 →</button>
        </div>
      )}
    </div>
  );
}
