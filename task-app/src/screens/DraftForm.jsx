// 공문·메일에서 뽑은 업무 초안을 확인하고 고쳐서 확정하는 화면.
// 원문(sourceText)이 있으면 AI 도움받기로 더 정확한 초안을 받아 채울 수 있음.
import { useState } from 'react';
import { DraftEditor } from './Breakdown.jsx';
import AiHelper from './AiHelper.jsx';
import { documentPrompt, parsePlan } from '../lib/aiPrompts.js';
import { todayKST } from '../lib/date.js';

export default function DraftForm({ initial, categories, source, sourceText, header, onCancel, onConfirm }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setDraft({ ...draft, ...patch });

  async function save() {
    if (!draft.title.trim()) return alert('업무 이름을 적어 주세요.');
    setSaving(true);
    try {
      await onConfirm(draft);
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
      setSaving(false);
    }
  }

  function applyAi(text) {
    const plan = parsePlan(text, todayKST());
    if (!plan.steps.length && !plan.title) return '답에서 내용을 찾지 못했어요. [업무] [단계] 형식인지 확인해 주세요.';
    const cat = categories.find((c) => c.name === plan.category.trim());
    setDraft({
      ...draft,
      title: plan.title || draft.title,
      due_date: plan.due_date || draft.due_date,
      category_id: cat?.id ?? draft.category_id,
      steps: plan.steps.length ? plan.steps : draft.steps,
      next_action: plan.next_action || draft.next_action,
      note: plan.note || draft.note,
    });
    return null;
  }

  return (
    <section className="detail">
      <header className="page-head">
        <button className="link" onClick={onCancel}>← 취소</button>
        <span className="muted small">{source}에서 만든 업무 초안</span>
      </header>
      {header}

      {sourceText && (
        <AiHelper
          title="AI로 더 정확하게 정리하기"
          buildPrompt={() => documentPrompt(sourceText, categories, todayKST())}
          onAnswer={applyAi}
        />
      )}

      <input className="title-input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="업무 이름" />
      <div className="fields">
        <label>
          분류
          <select value={draft.category_id} onChange={(e) => set({ category_id: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          마감
          <input type="date" value={draft.due_date} onChange={(e) => set({ due_date: e.target.value })} />
        </label>
      </div>

      <label className="stack block">
        <span className="small muted">메모 (요약·제출물) — 업무 맨 위에 보여요</span>
        <textarea rows={3} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </label>

      <DraftEditor draft={draft} onChange={setDraft} onSave={save} saving={saving} />
    </section>
  );
}
