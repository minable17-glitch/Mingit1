// 진행 중인 업무 전체 목록(마감·급한 순) + 업무 밸런스. '한눈에' 탭의 '목록' 보기에서 씀.
// 카드를 누르면 그 자리에서 펼쳐져 단계 체크·오늘 할 일에·완료.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { assess, sortForBriefing } from '../lib/briefing.js';
import { dueLabel, todayKST } from '../lib/date.js';
import { blockerDelayed, blockersOf } from '../lib/links.js';
import { taskState } from '../lib/balance.js';
import { remindLabel } from '../lib/remindTime.js';
import { isDayItem } from '../lib/today.js';

// 목록 보기: 분류 고르기(드롭다운 하나) + 분류별 묶기
export function AllTasks({ tasks, categories, categoryById, settings, links = [], reminders = [], todayItems = [], reload, onOpen }) {
  const today = todayKST();
  const [filter, setFilter] = useState('');
  const [grouped, setGrouped] = useState(false);
  const all = sortForBriefing(tasks, today, settings.neglect_days, settings.waiting_days);
  const rows = all.filter((r) => !filter || r.task.category_id === filter);
  const used = categories.filter((c) => tasks.some((t) => t.category_id === c.id));
  const listProps = { categoryById, today, onOpen, links, tasks, settings, reload, reminders, todayItems };
  return (
    <>
      <div className="list-tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="분류">
          <option value="">분류: 전체 ({tasks.length})</option>
          {used.map((c) => <option key={c.id} value={c.id}>{c.name} ({tasks.filter((t) => t.category_id === c.id).length})</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> 분류별</label>
      </div>
      {rows.length === 0 && <p className="empty">진행 중인 업무가 없어요. 브리핑의 + 버튼으로 등록해 보세요.</p>}
      {grouped
        ? used.map((c) => ({ c, items: rows.filter((r) => r.task.category_id === c.id) })).filter((g) => g.items.length).map(({ c, items }) => (
          <div key={c.id} className="group">
            <h2 style={{ '--c': c.color }} className="group-title">{c.name}</h2>
            <TaskList rows={items} {...listProps} />
          </div>
        ))
        : <TaskList rows={rows} {...listProps} />}
      {tasks.length > 0 && <BalancePanel tasks={tasks} categories={categories} settings={settings} links={links} today={today} />}
    </>
  );
}

// 업무 꼭지 목록: 누르면 그 자리에서 펼쳐져 세부 단계를 보고 바로 체크. "열기"로 업무 화면.
export function TaskList({ rows, categoryById, today, onOpen, links, tasks, settings, reload, reminders = [], todayItems = [] }) {
  const [open, setOpen] = useState(() => new Set());
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // 펼친 자리에서 바로 완료 → 보관함으로. 잘못 눌렀으면 잠깐 뜨는 '되돌리기'로 복구
  const [justDone, setJustDone] = useState(null);
  async function complete(task) {
    try {
      await api.completeTask(task);
      setJustDone(task);
      setTimeout(() => setJustDone((cur) => (cur?.id === task.id ? null : cur)), 8000);
      await reload();
    } catch (e) {
      alert(`완료하지 못했어요: ${e.message}`);
    }
  }
  async function undo() {
    const task = justDone;
    setJustDone(null);
    try {
      await api.reopenTask(task);
      await reload();
    } catch (e) {
      alert(`되돌리지 못했어요: ${e.message}`);
    }
  }

  // 펼친 업무의 다음 행동을 '내 오늘 목록'에
  async function addToToday(task) {
    try {
      const mine = (todayItems ?? []).filter((i) => i.day === today && isDayItem(i));
      await api.addTodayItem({ day: today, title: task.waiting_on ? `${task.waiting_on} 확인` : task.next_action, taskId: task.id, position: mine.reduce((m, i) => Math.max(m, i.position + 1), 0) });
      await reload();
    } catch (e) {
      alert(`오늘 목록에 넣지 못했어요: ${e.message}`);
    }
  }

  async function check(task, step) {
    try {
      const { completed } = await api.toggleStep(task, step);
      if (completed) alert(`“${task.title}”의 마지막 단계를 마쳐서 보관함으로 옮겼어요. 수고하셨어요!`);
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  return (
    <>
    {justDone && (
      <div className="undo-bar" role="status">
        <span className="grow">✓ “{justDone.title}” 완료! 보관함으로 옮겼어요.</span>
        <button className="link" onClick={undo}>되돌리기</button>
      </div>
    )}
    <ul className="task-list">
      {rows.map(({ task, info }) => {
        const cat = categoryById[task.category_id];
        const total = task.steps?.length ?? 0;
        const done = task.steps?.filter((s) => s.done).length ?? 0;
        const blockers = blockersOf(task.id, links, tasksById);
        const delayed = blockers.length > 0 && blockerDelayed(task.id, links, tasksById, today, settings);
        const isOpen = open.has(task.id);
        const reminder = reminders.find((r) => r.task_id === task.id);
        return (
          <li key={task.id} className={isOpen ? 'task-row open' : 'task-row'} style={{ '--c': cat?.color }}>
            <button type="button" className="row-button" aria-expanded={isOpen} onClick={() => toggle(task.id)}>
              <div className="row-top">
                <span className="title">{task.title}</span>
                <span className="chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
              </div>
              {task.waiting_on
                ? <div className="next waiting">⏳ {task.waiting_on} 기다리는 중</div>
                : <div className="next">→ {task.next_action}</div>}
              <div className="row-meta">
                {cat && <span className="row-cat"><span className="dot" style={{ background: cat.color }} aria-hidden="true" />{cat.name}</span>}
                {info.due && (
                  <span className={info.overdue ? 'badge danger' : info.dueSoon ? 'badge warn' : 'badge'}>
                    {dueLabel(info.due, today)}
                  </span>
                )}
                {info.noReply && <span className="badge stale">{info.waitDays}일 무응답</span>}
                {info.neglected && <span className="badge stale">{info.idle}일 방치</span>}
                {blockers.length > 0 && (
                  <span className={delayed ? 'badge warn' : 'badge'} title={blockers.map((b) => b.title).join(', ')}>
                    🔗 앞 업무 {blockers.length}{delayed ? ' 지연' : ''}
                  </span>
                )}
                {reminder && <span className="badge remind">🔔 {remindLabel(reminder.remind_at)}</span>}
                {total > 0 && <span className="row-steps">체크 {done}/{total}</span>}
              </div>
              {task.latest_note && <div className="note">📝 {task.latest_note}</div>}
              {total > 0 && (
                <div className="progress" aria-label={`단계 ${done}/${total}`}><span style={{ width: `${(done / total) * 100}%` }} /></div>
              )}
            </button>
            {isOpen && (
              <div className="row-detail">
                {total === 0 && <p className="muted small">아직 체크리스트가 없어요.</p>}
                <ul className="steps">
                  {[...(task.steps ?? [])].sort((a, b) => a.position - b.position).map((s) => (
                    <li key={s.id} className={s.done ? 'done' : ''}>
                      <label>
                        <input type="checkbox" checked={s.done} onChange={() => check(task, s)} />
                        <span>{s.title}</span>
                      </label>
                      {s.due_date && <span className={!s.done && s.due_date < today ? 'badge danger' : 'badge'}>{dueLabel(s.due_date, today)}</span>}
                    </li>
                  ))}
                </ul>
                {blockers.length > 0 && <p className="small muted">먼저 끝내야 할 업무: {blockers.map((b) => b.title).join(', ')}</p>}
                <div className="row wrap">
                  <button className="primary" onClick={() => onOpen(task.id)}>{total === 0 ? '체크리스트 만들러 열기 →' : '업무 열기 →'}</button>
                  {todayItems !== null && ((todayItems ?? []).some((i) => i.day === today && isDayItem(i) && i.task_id === task.id && !i.done)
                    ? <span className="small muted">☀️ 오늘 목록에 있음</span>
                    : <button onClick={() => addToToday(task)}>☀️ 오늘 할 일에</button>)}
                  <button className="done-btn" onClick={() => complete(task)}>✓ 완료</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
    </>
  );
}


// ── 업무 밸런스: 분류마다 업무가 얼마나 몰려 있고, 그중 위험한 게 몇 개인지 ─────
// 색은 상태만 뜻함(아이콘+글자와 함께). 막대 길이는 모든 분류가 같은 기준(가장 많은 분류 = 전체 폭).
const BAL = [
  { key: 'critical', color: '#e5484d', icon: '●', label: '위험', hint: '마감 지남·임박' },
  { key: 'warning', color: '#f5a524', icon: '▲', label: '주의', hint: '방치·무응답·지연' },
  { key: 'good', color: '#30a46c', icon: '■', label: '순조', hint: '' },
];

const BAL_SHOWN = 6; // 처음엔 급한 분류부터 6개만, 나머지는 '모두 보기'

export function BalancePanel({ tasks, categories, settings, links, today }) {
  const [picked, setPicked] = useState(null);
  const [all, setAll] = useState(false);
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const rows = categories.map((c) => {
    const mine = tasks.filter((t) => t.category_id === c.id);
    const count = { critical: 0, warning: 0, good: 0 };
    let steps = 0;
    let doneSteps = 0;
    for (const t of mine) {
      const k = taskState(t, assess(t, today, settings.neglect_days, settings.waiting_days), links, tasksById, today, settings);
      count[k] += 1;
      steps += t.steps?.length ?? 0;
      doneSteps += t.steps?.filter((x) => x.done).length ?? 0;
    }
    return { c, total: mine.length, count, progress: steps ? Math.round((doneSteps / steps) * 100) : null };
  }).filter((r) => r.total > 0)
    .sort((a, b) => b.count.critical - a.count.critical || b.count.warning - a.count.warning || b.total - a.total);
  const max = Math.max(...rows.map((r) => r.total), 1);

  // 한 줄 요약: 위험이 가장 많은 분류, 없으면 가장 바쁜 분류
  const worst = [...rows].sort((a, b) => b.count.critical - a.count.critical || b.total - a.total)[0];
  const summary = worst.count.critical > 0
    ? `${worst.c.name}에 급한 업무가 몰려 있어요 (${worst.total}건 중 ${worst.count.critical}건 위험).`
    : rows.length > 1 && worst.total >= 2 * Math.min(...rows.map((r) => r.total))
      ? `${worst.c.name} 업무가 가장 많아요 (${worst.total}건). 급한 건 없어요.`
      : '업무가 고르게 나뉘어 있고, 급한 업무는 없어요.';

  return (
    <details className="balance block">
      <summary>
        <span className="bal-title">업무 밸런스</span>
        <span className="bal-summary">{summary}</span>
      </summary>
      <ul className="bal-legend" aria-label="범례">
        {BAL.map((b) => (
          <li key={b.key} title={b.hint}><span className="bal-key" style={{ background: b.color }} aria-hidden="true" />{b.label}{b.hint && <span className="muted"> · {b.hint}</span>}</li>
        ))}
      </ul>
      <ul className="bal-rows">
        {(all ? rows : rows.slice(0, BAL_SHOWN)).map((r) => (
          <li key={r.c.id}>
            <button
              type="button"
              className="bal-row"
              aria-expanded={picked === r.c.id}
              onClick={() => setPicked(picked === r.c.id ? null : r.c.id)}
            >
              <span className="bal-name" title={r.c.name}><span className="dot" style={{ background: r.c.color }} aria-hidden="true" /><span className="bal-name-text">{r.c.name}</span></span>
              <span className="bal-track">
                <span className="bal-rail"><span className="bal-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                  {BAL.filter((b) => r.count[b.key] > 0).map((b) => (
                    <span
                      key={b.key}
                      className="bal-seg"
                      style={{ flexGrow: r.count[b.key], background: b.color }}
                      title={`${r.c.name} · ${b.label} ${r.count[b.key]}건`}
                    />
                  ))}
                </span></span>
                <span className="bal-value">{r.total}건</span>
              </span>
            </button>
            {picked === r.c.id && (
              <p className="bal-detail small">
                {BAL.map((b) => `${b.icon} ${b.label} ${r.count[b.key]}`).join(' · ')}
                {r.progress !== null && ` · 단계 진척 ${r.progress}%`}
              </p>
            )}
          </li>
        ))}
      </ul>
      {rows.length > BAL_SHOWN && (
        <button type="button" className="link small bal-more" onClick={() => setAll(!all)}>{all ? '접기' : `분류 ${rows.length}개 모두 보기`}</button>
      )}
    </details>
  );
}
