import { useState } from 'react';
import * as api from '../lib/api.js';

export default function Categories({ categories, reload }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#64748b');
  const [deleting, setDeleting] = useState(null); // 삭제할 분류

  async function run(fn) {
    try {
      await fn();
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= categories.length) return;
    const ids = categories.map((c) => c.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.reorderCategories(ids));
  }

  return (
    <section>
      <header className="page-head"><h1>분류 관리</h1></header>

      <ul className="cat-list">
        {categories.map((c, i) => (
          <li key={c.id}>
            <input
              type="color"
              value={c.color}
              onChange={(e) => run(() => api.updateCategory(c.id, { color: e.target.value }))}
            />
            <CategoryName category={c} onSave={(n) => run(() => api.updateCategory(c.id, { name: n }))} />
            <span className="step-tools">
              <button onClick={() => move(i, -1)} aria-label="위로">↑</button>
              <button onClick={() => move(i, 1)} aria-label="아래로">↓</button>
              <button
                onClick={() => setDeleting(c)}
                disabled={categories.length <= 1}
                aria-label="삭제"
              >✕</button>
            </span>
          </li>
        ))}
      </ul>

      {deleting && (
        <DeleteDialog
          category={deleting}
          others={categories.filter((c) => c.id !== deleting.id)}
          onCancel={() => setDeleting(null)}
          onConfirm={(moveToId) => run(async () => {
            await api.deleteCategory(deleting.id, moveToId);
            setDeleting(null);
          })}
        />
      )}

      <form
        className="row block"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(async () => { await api.createCategory({ name, color }, categories.length); setName(''); });
        }}
      >
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input className="grow" placeholder="새 분류 이름 (예: 연구회)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!name.trim()}>추가</button>
      </form>
    </section>
  );
}

function CategoryName({ category, onSave }) {
  const [value, setValue] = useState(category.name);
  return (
    <input
      className="grow"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== category.name && onSave(value.trim())}
    />
  );
}

function DeleteDialog({ category, others, onCancel, onConfirm }) {
  const [target, setTarget] = useState(others[0]?.id);
  return (
    <div className="dialog">
      <p><b>{category.name}</b> 분류를 삭제합니다. 이 분류의 업무는 어디로 옮길까요?</p>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="actions">
        <button className="danger" onClick={() => onConfirm(target)}>옮기고 삭제</button>
        <button className="link" onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
