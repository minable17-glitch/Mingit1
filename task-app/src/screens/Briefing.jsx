import { useState } from 'react';
import * as api from '../lib/api.js';
import { sortForBriefing } from '../lib/briefing.js';
import { dueLabel, formatShort, todayKST } from '../lib/date.js';

export default function Briefing({ tasks, categories, categoryById, settings, reload, onOpen }) {
  const today = todayKST();
  const [filter, setFilter] = useState(null); // 분류 ID 또는 null(전체)
  const [grouped, setGrouped] = useState(false);

  const all = sortForBriefing(tasks, today, settings.neglect_days);
  const rows = all.filter((r) => !filter || r.task.category_id === filter);

  const counts = all.reduce(
    (acc, { info }) => {
      if (info.overdue || info.dueSoon) acc.due += 1;
      if (info.neglected) acc.neglected += 1;
      return acc;
    },
    { due: 0, neglected: 0 },
  );

  return (
    <section>
      <header className="page-head">
        <h1>오늘의 브리핑</h1>
        <span className="muted">{formatShort(today)}</span>
      </header>

      <p className="summary">
        진행 중 <b>{tasks.length}</b>
        {counts.due > 0 && <> · 마감 임박 <b className="warn">{counts.due}</b></>}
        {counts.neglected > 0 && <> · 방치 <b className="warn">{counts.neglected}</b></>}
      </p>

      <QuickAdd categories={categories} onAdded={reload} />

      <div className="chips">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter(null)}>전체</button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={filter === c.id ? 'chip on' : 'chip'}
            style={{ '--c': c.color }}
            onClick={() => setFilter(filter === c.id ? null : c.id)}
          >
            {c.name}
          </button>
        ))}
        <label className="toggle">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          분류별로 묶기
        </label>
      </div>

      {rows.length === 0 && <p className="empty">진행 중인 업무가 없습니다. 위에서 한 줄로 등록해 보세요.</p>}

      {grouped
        ? categories
            .map((c) => ({ c, items: rows.filter((r) => r.task.category_id === c.id) }))
            .filter((g) => g.items.length)
            .map(({ c, items }) => (
              <div key={c.id} className="group">
                <h2 style={{ '--c': c.color }} className="group-title">{c.name}</h2>
                <TaskList rows={items} categoryById={categoryById} today={today} onOpen={onOpen} />
              </div>
            ))
        : <TaskList rows={rows} categoryById={categoryById} today={today} onOpen={onOpen} />}
    </section>
  );
}

function TaskList({ rows, categoryById, today, onOpen }) {
  return (
    <ul className="task-list">
      {rows.map(({ task, info }) => {
        const cat = categoryById[task.category_id];
        const total = task.steps?.length ?? 0;
        const done = task.steps?.filter((s) => s.done).length ?? 0;
        return (
          <li key={task.id} className="task-row" style={{ '--c': cat?.color }} onClick={() => onOpen(task.id)}>
            <div className="row-top">
              <span className="title">{task.title}</span>
              {info.due && (
                <span className={info.overdue ? 'badge danger' : info.dueSoon ? 'badge warn' : 'badge'}>
                  {dueLabel(info.due, today)}
                </span>
              )}
              {info.neglected && <span className="badge stale">{info.idle}일 방치</span>}
            </div>
            <div className="next">→ {task.next_action}</div>
            {task.latest_note && <div className="note">📝 {task.latest_note}</div>}
            {total > 0 && (
              <div className="progress"><span style={{ width: `${(done / total) * 100}%` }} /></div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function QuickAdd({ categories, onAdded }) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const catId = categoryId || categories[0]?.id;

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !catId) return;
    setBusy(true);
    try {
      await api.createTask({ title, categoryId: catId, dueDate });
      setTitle('');
      setDueDate('');
      await onAdded();
    } catch (err) {
      alert(`등록하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="grow"
        placeholder="새 업무 한 줄 (예: 2학기 평가계획 제출)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <select value={catId ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="마감일(선택)" />
      <button className="primary" disabled={busy || !title.trim()}>등록</button>
    </form>
  );
}
