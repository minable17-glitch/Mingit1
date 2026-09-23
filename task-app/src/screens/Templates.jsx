// 자주 하는 업무 템플릿 관리. 단계 날짜는 "최종 마감 며칠 전"으로 저장됩니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

const blank = () => ({ name: '', category_id: '', next_action: '', steps: [{ title: '', offset_days: -3 }] });

export default function Templates({ categories, onClose }) {
  const [templates, setTemplates] = useState(null);
  const [editing, setEditing] = useState(null); // { id?, name, category_id, next_action, steps }

  const load = () => api.loadTemplates().then(setTemplates);
  useEffect(() => { api.loadTemplates().then(setTemplates); }, []);

  async function save() {
    const steps = editing.steps
      .filter((s) => s.title.trim())
      .map((s) => ({ title: s.title.trim(), offset_days: s.offset_days === '' || s.offset_days === null ? null : Number(s.offset_days) }));
    if (!editing.name.trim()) return alert('템플릿 이름을 적어 주세요.');
    try {
      if (editing.id) {
        await api.updateTemplate(editing.id, {
          name: editing.name.trim(), category_id: editing.category_id || null, next_action: editing.next_action || null, steps,
        });
      } else {
        await api.createTemplate({ name: editing.name, categoryId: editing.category_id, nextAction: editing.next_action, steps });
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  if (editing) {
    const setStep = (i, patch) => setEditing({ ...editing, steps: editing.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
    return (
      <section>
        <header className="page-head">
          <button className="link" onClick={() => setEditing(null)}>← 취소</button>
        </header>
        <div className="block stack">
          <input placeholder="템플릿 이름 (예: 품의)" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <select value={editing.category_id ?? ''} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
            <option value="">분류 지정 안 함</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="첫 다음 행동" value={editing.next_action ?? ''} onChange={(e) => setEditing({ ...editing, next_action: e.target.value })} />
          <p className="muted small">단계별 날짜: 최종 마감 기준 며칠 전(-) 또는 후(+). 비우면 날짜 없음.</p>
          <ol className="draft-steps">
            {editing.steps.map((s, i) => (
              <li key={i}>
                <input className="grow" placeholder="단계 이름" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
                <span className="row small">
                  마감
                  <input type="number" style={{ width: 70 }} value={s.offset_days ?? ''} onChange={(e) => setStep(i, { offset_days: e.target.value })} />
                  일
                </span>
                <button type="button" onClick={() => setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })} aria-label="삭제">✕</button>
              </li>
            ))}
          </ol>
          <button type="button" className="link" onClick={() => setEditing({ ...editing, steps: [...editing.steps, { title: '', offset_days: 0 }] })}>+ 단계 추가</button>
          <button className="primary" onClick={save}>저장</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <header className="page-head">
        <button className="link" onClick={onClose}>← 설정</button>
        <button onClick={() => setEditing(blank())}>+ 새 템플릿</button>
      </header>
      <h1>업무 템플릿</h1>
      <p className="muted small">새 업무를 등록할 때 템플릿을 고르면 단계와 날짜가 한 번에 만들어져요. 업무 화면의 “템플릿으로 저장”으로도 만들 수 있어요.</p>
      {templates === null && <p className="muted">불러오는 중…</p>}
      <ul className="task-list">
        {templates?.map((t) => (
          <li key={t.id} className="task-row">
            <div className="row-top">
              <span className="title">📋 {t.name}</span>
              <span className="badge">단계 {t.steps.length}</span>
            </div>
            <div className="note">{t.steps.map((s) => s.title).join(' → ')}</div>
            <div className="row">
              <button onClick={() => setEditing({ ...t, category_id: t.category_id ?? '', steps: t.steps.length ? t.steps : [{ title: '', offset_days: 0 }] })}>수정</button>
              <button
                className="link"
                onClick={async () => { if (confirm(`“${t.name}” 템플릿을 지울까요?`)) { await api.deleteTemplate(t.id); load(); } }}
              >삭제</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
