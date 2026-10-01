// 생각 노트: 그때그때 떠오른 업무 생각·원칙·아이디어·배운 점을 모아 두는 곳.
// 원칙은 위에 고정되고, 브리핑에 '오늘의 원칙'으로 하나씩 보여요. 아이디어는 바로 업무로 만들 수 있어요.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { todayKST } from '../lib/date.js';
import { groupThoughts, KINDS, kindOf, titleFromThought } from '../lib/thoughts.js';

export default function Thoughts({ thoughts, categories, categoryById, tasks, reload, onOpen, onOpenScreen }) {
  const [filter, setFilter] = useState('');
  const [query, setQuery] = useState('');
  const today = todayKST();

  if (thoughts === null) {
    return (
      <section>
        <header className="page-head"><h1>생각 노트</h1></header>
        <p className="notice">생각 노트를 쓰려면 관리자가 Supabase에서 <b>install_all.sql</b>(또는 schema_notes.sql)을 한 번 더 실행해야 해요.</p>
      </section>
    );
  }

  const principles = thoughts.filter((t) => t.kind === 'principle' || t.pinned);
  const groups = groupThoughts(thoughts, { kind: filter, query }, today);

  return (
    <section className="thoughts">
      <header className="page-head">
        <h1>생각 노트</h1>
        <button className="link" onClick={() => onOpenScreen({ type: 'review' })}>📝 주간 회고 →</button>
      </header>

      <Composer categories={categories} reload={reload} />

      {principles.length > 0 && (
        <div className="block principles">
          <h2>📌 나의 업무 원칙</h2>
          <ol>
            {principles.map((t) => <li key={t.id}>{t.body}</li>)}
          </ol>
          <p className="small muted">브리핑 화면 위에 하루에 하나씩 보여 드려요.</p>
        </div>
      )}

      <div className="chips">
        <button className={filter === '' ? 'chip on' : 'chip'} onClick={() => setFilter('')}>전체 {thoughts.length}</button>
        {KINDS.map((k) => {
          const n = thoughts.filter((t) => t.kind === k.key).length;
          return n > 0 && <button key={k.key} className={filter === k.key ? 'chip on' : 'chip'} onClick={() => setFilter(filter === k.key ? '' : k.key)}>{k.icon} {k.label} {n}</button>;
        })}
      </div>
      {thoughts.length > 4 && <input className="search" placeholder="🔍 생각 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />}

      {thoughts.length === 0 && (
        <p className="muted">아직 적은 생각이 없어요. “업무 요청은 바로 메모부터”, “금요일 오후엔 다음 주 계획”처럼 나만의 원칙이나 떠오른 생각을 적어 보세요.</p>
      )}
      {groups.map((g) => (
        <div key={g.date} className="thought-group">
          <h3 className="small muted">{g.label}</h3>
          <ul className="thought-list">
            {g.items.map((t) => (
              <ThoughtCard key={t.id} t={t} categoryById={categoryById} tasks={tasks} categories={categories} reload={reload} onOpen={onOpen} onOpenScreen={onOpenScreen} />
            ))}
          </ul>
        </div>
      ))}
      {thoughts.length > 0 && groups.length === 0 && <p className="muted small">찾는 생각이 없어요.</p>}
    </section>
  );
}

function Composer({ categories, reload }) {
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('thought');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.addThought({ body, kind, categoryId });
      setBody('');
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="block stack composer">
      <textarea
        rows={3}
        placeholder="지금 떠오른 업무 생각, 지키고 싶은 원칙, 아이디어, 배운 점을 적어 두세요"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }}
      />
      <div className="row wrap">
        <div className="kind-pick" role="radiogroup" aria-label="종류">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={kind === k.key ? 'chip on' : 'chip'} onClick={() => setKind(k.key)}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="분류">
          <option value="">분류 없음</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="primary" disabled={busy || !body.trim()} onClick={save}>저장</button>
      </div>
    </div>
  );
}

function ThoughtCard({ t, categoryById, tasks, categories, reload, onOpen, onOpenScreen }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body);
  const k = kindOf(t.kind);
  const cat = categoryById[t.category_id];
  const task = tasks.find((x) => x.id === t.task_id);

  const run = async (fn) => {
    try {
      await fn();
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  };

  function toTask() {
    const catId = t.category_id || categories.find((c) => c.name === api.ETC_CATEGORY)?.id || categories[0]?.id;
    onOpenScreen({
      type: 'draft',
      source: '생각 노트',
      draft: { title: titleFromThought(t.body), category_id: catId, due_date: '', steps: [{ title: '', due_date: '' }], next_action: '', note: t.body },
    });
  }

  return (
    <li className={`thought-card kind-${t.kind}`}>
      <div className="thought-meta small">
        <span className="kind-badge">{k.icon} {k.label}</span>
        {cat && <span className="cat-tag" style={{ '--c': cat.color }}>{cat.name}</span>}
        {task && <button className="link small" onClick={() => onOpen(task.id)}>↗ {task.title}</button>}
      </div>
      {editing ? (
        <div className="stack">
          <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="row">
            <button className="primary" disabled={!draft.trim()} onClick={() => run(async () => { await api.updateThought(t.id, { body: draft.trim() }); setEditing(false); })}>저장</button>
            <button className="link" onClick={() => { setDraft(t.body); setEditing(false); }}>취소</button>
          </div>
        </div>
      ) : (
        <p className="thought-body">{t.body}</p>
      )}
      {!editing && (
        <div className="thought-actions small">
          <button className="link" onClick={() => setEditing(true)}>고치기</button>
          {t.kind !== 'principle'
            ? <button className="link" onClick={() => run(() => api.updateThought(t.id, { kind: 'principle', pinned: true }))}>📌 원칙으로</button>
            : <button className="link" onClick={() => run(() => api.updateThought(t.id, { kind: 'thought', pinned: false }))}>원칙에서 빼기</button>}
          {t.kind !== 'principle' && <button className="link" onClick={toTask}>➕ 업무로 만들기</button>}
          <button className="link" onClick={() => confirm('이 생각을 지울까요?') && run(() => api.deleteThought(t.id))}>지우기</button>
        </div>
      )}
    </li>
  );
}
