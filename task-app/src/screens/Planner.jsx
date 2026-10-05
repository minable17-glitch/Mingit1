// 📒 일지: 종이 플래너처럼 날짜마다 메모 · 교시별 기록(0~7교시) · 체크리스트 · 하루 기록.
// 일 / 주 / 월로 보기. 체크리스트는 '오늘 할 일'과 같은 목록(그 날짜 것)이라 브리핑과 이어져요.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { todayKST } from '../lib/date.js';
import { monthGrid, weekDays } from '../lib/calendar.js';
import { daySummaryLine, isEmptyDay, periodRows, PERIODS } from '../lib/planner.js';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

export default function Planner({ day, setDay, bell = [] }) {
  const today = todayKST();
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('task-keeper.planner-mode') || 'day'; } catch { return 'day'; } });
  const [data, setData] = useState(undefined);
  const [tick, setTick] = useState(0);
  const pickMode = (m) => { setMode(m); try { localStorage.setItem('task-keeper.planner-mode', m); } catch { /* 괜찮음 */ } };

  const ym = { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) };
  const grid = monthGrid(ym.year, ym.month);
  const week = weekDays(day);
  const [from, to] = mode === 'day' ? [day, day] : mode === 'week' ? [week[0], week[6]] : [grid[0][0].date, grid.at(-1)[6].date];

  useEffect(() => {
    let alive = true;
    api.loadPlannerRange(from, to).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [from, to, tick]);
  const reload = () => setTick((t) => t + 1);

  const dayOf = (d) => data?.days.find((x) => x.day === d) ?? null;
  const itemsOf = (d) => (data?.items ?? []).filter((i) => i.day === d);
  const bellOf = (n) => bell.find((b) => Number(b.period) === n);

  return (
    <div className="planner">
      <div className="cal-modes" role="tablist">
        {[['day', '일'], ['week', '주'], ['month', '월']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => pickMode(k)}>{l}</button>
        ))}
      </div>
      {data === undefined && <p className="muted">불러오는 중…</p>}
      {data === null && <p className="notice">일지를 준비하는 중이에요. 잠시 뒤 다시 열어 주세요.</p>}

      {data && mode === 'day' && (
        <DayPage key={day} day={day} saved={dayOf(day)} items={itemsOf(day)} bellOf={bellOf} reload={reload} />
      )}

      {data && mode === 'week' && (
        <ul className="pl-week">
          {week.map((d) => {
            const s = daySummaryLine(dayOf(d), itemsOf(d));
            const rows = periodRows(dayOf(d)?.periods).map((p, i) => ({ ...p, i })).filter((p) => p.a.trim() || p.b.trim());
            const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
            return (
              <li key={d} className={`${d === today ? 'today' : ''} dow-${dow}`}>
                <button className="pl-week-day" onClick={() => { setDay(d); pickMode('day'); }}>
                  <span className="cal-num">{DOW[dow]} {md(d)}</span>
                  {s.total > 0 && <span className="small muted">✅ {s.done}/{s.total}</span>}
                  <span className="grow" />
                  <span className="small link">열기 →</span>
                </button>
                {isEmptyDay(dayOf(d), itemsOf(d)) ? <span className="small muted">—</span> : (
                  <div className="small pl-week-body">
                    {s.memo && <p>📝 {s.memo}</p>}
                    {rows.map((p) => <p key={p.i}><b>{p.i}교시</b> {p.a} {p.b && <span className="muted">· {p.b}</span>}</p>)}
                    {itemsOf(d).filter((i) => !i.done).slice(0, 3).map((i) => <p key={i.id}>☐ {i.title}</p>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data && mode === 'month' && (
        <div className="cal-grid">
          {DOW.map((d, i) => <div key={d} className={`cal-dow dow-${i}`}>{d}</div>)}
          {grid.flat().map((c) => {
            const s = daySummaryLine(dayOf(c.date), itemsOf(c.date));
            const empty = isEmptyDay(dayOf(c.date), itemsOf(c.date));
            return (
              <button key={c.date} className={`cal-cell${c.inMonth ? '' : ' out'}${c.date === today ? ' today' : ''}${c.date === day ? ' sel' : ''} dow-${c.dow}`}
                onClick={() => { setDay(c.date); pickMode('day'); }} aria-label={`${c.date} 일지`}>
                <span className="cal-num">{Number(c.date.slice(8))}</span>
                {!empty && (
                  <>
                    {s.memo && <span className="cal-chip step" style={{ '--c': '#7c9a6d' }}>{s.memo}</span>}
                    {s.filled > 0 && <span className="pl-mini">📚 {s.filled}</span>}
                    {s.total > 0 && <span className="pl-mini">✅ {s.done}/{s.total}</span>}
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 하루 쪽: 메모 · 교시 표 · 체크리스트 · 하루 기록. 칸에서 나가면 저장
function DayPage({ day, saved, items, bellOf, reload }) {
  const [memo, setMemo] = useState(saved?.memo ?? '');
  const [rows, setRows] = useState(() => periodRows(saved?.periods));
  const [reflection, setReflection] = useState(saved?.reflection ?? '');
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');

  async function save(patch = {}) {
    setStatus('저장 중…');
    try {
      await api.savePlannerDay(day, { memo, periods: rows, reflection, ...patch });
      setStatus('저장됨 ✓');
      setTimeout(() => setStatus(''), 1200);
    } catch (e) {
      setStatus(`저장하지 못했어요: ${e.message}`);
    }
  }
  const setRow = (i, k, v) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const run = async (fn) => {
    try { await fn(); reload(); } catch (e) { alert(`저장하지 못했어요: ${e.message}`); }
  };

  return (
    <div className="pl-day">
      <div className="pl-status small muted">{status}</div>
      <label className="pl-box">
        <span className="pl-label">📝 메모</span>
        <textarea rows={4} placeholder="오늘 기억할 것, 일정, 생각…" value={memo} onChange={(e) => setMemo(e.target.value)} onBlur={() => save()} />
      </label>

      <div className="pl-box">
        <span className="pl-label">📚 교시별</span>
        <table className="pl-periods">
          <tbody>
            {PERIODS.map((n, i) => {
              const b = bellOf(n);
              return (
                <tr key={n}>
                  <th scope="row"><b>{n}</b>{b && <span>{b.start}</span>}</th>
                  <td className="pl-a"><input value={rows[i].a} placeholder={n === 0 ? '아침' : '반·과목'} onChange={(e) => setRow(i, 'a', e.target.value)} onBlur={() => save()} aria-label={`${n}교시 반·과목`} /></td>
                  <td><input value={rows[i].b} placeholder="내용·메모" onChange={(e) => setRow(i, 'b', e.target.value)} onBlur={() => save()} aria-label={`${n}교시 내용`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pl-box">
        <span className="pl-label">✅ 할 일 <span className="small muted">(이 날짜의 ‘오늘 할 일’과 같은 목록)</span></span>
        <ul className="pl-checks">
          {items.map((i) => (
            <li key={i.id} className={i.done ? 'done' : ''}>
              <input type="checkbox" checked={i.done} onChange={() => run(() => api.updateTodayItem(i.id, { done: !i.done }))} aria-label={`${i.title} 끝냄`} />
              <span className="grow">{i.title}</span>
              <button className="icon" onClick={() => run(() => api.deleteTodayItem(i.id))} aria-label="빼기">×</button>
            </li>
          ))}
        </ul>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; const t = text; setText(''); run(() => api.addTodayItem({ day, title: t, position: items.reduce((m, x) => Math.max(m, x.position + 1), 0) })); }}>
          <input className="grow" placeholder="할 일 추가" value={text} onChange={(e) => setText(e.target.value)} />
          <button disabled={!text.trim()}>추가</button>
        </form>
      </div>

      <label className="pl-box">
        <span className="pl-label">🌙 하루 기록</span>
        <textarea rows={3} placeholder="오늘 있었던 일, 잘된 점, 내일 챙길 것…" value={reflection} onChange={(e) => setReflection(e.target.value)} onBlur={() => save()} />
      </label>
    </div>
  );
}
