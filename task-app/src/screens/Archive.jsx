import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { formatShort, toDateKST } from '../lib/date.js';

export default function Archive({ categoryById, onOpen }) {
  const [tasks, setTasks] = useState(null);

  useEffect(() => { api.loadArchivedTasks().then(setTasks); }, []);

  if (!tasks) return <div className="center muted">불러오는 중…</div>;

  return (
    <section>
      <header className="page-head"><h1>보관함</h1><span className="muted">완료 {tasks.length}</span></header>
      {tasks.length === 0 && <p className="empty">아직 완료한 업무가 없습니다.</p>}
      <ul className="task-list">
        {tasks.map((t) => {
          const cat = categoryById[t.category_id];
          return (
            <li key={t.id} className="task-row done" style={{ '--c': cat?.color }} onClick={() => onOpen(t.id)}>
              <div className="row-top">
                <span className="title">{t.title}</span>
                <span className="badge">{cat?.name}</span>
              </div>
              <div className="muted small">{t.completed_at && `${formatShort(toDateKST(t.completed_at))} 완료`}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
