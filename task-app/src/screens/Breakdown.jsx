// 단계 정하기: 템플릿·기본 단계로 시작하거나, AI 도움받기(질문 복사 → 답 붙여넣기)로 채운 뒤 고쳐서 확정.
// "확정해서 저장"을 눌러야 저장됩니다.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { todayKST } from '../lib/date.js';
import { defaultSteps } from '../lib/rules.js';
import { stepsFromTemplate } from '../lib/templates.js';
import { breakdownPrompt, parsePlan } from '../lib/aiPrompts.js';
import AiHelper from './AiHelper.jsx';

export default function Breakdown({ task, categoryName, templates = [], onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    steps: task.steps.length
      ? task.steps.map((s) => ({ title: s.title, due_date: s.due_date ?? '' }))
      : [{ title: '', due_date: '' }],
    next_action: '',
  }));
  const [saving, setSaving] = useState(false);
  const today = todayKST();

  function replaceSteps(steps, nextAction) {
    const hasContent = draft.steps.some((s) => s.title.trim());
    if (hasContent && !confirm('지금 적은 단계를 바꿀까요?')) return false;
    setDraft({ steps, next_action: nextAction ?? draft.next_action });
    return true;
  }

  async function save() {
    const steps = draft.steps.filter((s) => s.title.trim());
    if (!steps.length) return alert('단계를 하나 이상 적어 주세요.');
    if (task.steps.some((s) => s.done) && !confirm('이미 체크한 단계도 새 목록으로 바뀝니다. 계속할까요?')) return;
    setSaving(true);
    try {
      await api.saveBreakdown(task, steps, draft.next_action);
      await onSaved();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
      setSaving(false);
    }
  }

  return (
    <section className="detail">
      <header className="page-head">
        <button className="link" onClick={onCancel}>← 취소</button>
        <span className="muted small">단계 정하기</span>
      </header>
      <h1 className="title-plain">{task.title}</h1>

      <StepStarters templates={templates} dueDate={task.due_date} onPick={replaceSteps} />
      <AiHelper
        title="AI에게 단계 쪼개기 도움받기"
        buildPrompt={() => breakdownPrompt(task, categoryName, today)}
        onAnswer={(text) => {
          const plan = parsePlan(text, today);
          if (!plan.steps.length) return '답에서 단계를 찾지 못했어요. “1. 단계 / 날짜” 형식인지 확인하거나 직접 적어 주세요.';
          if (!replaceSteps(plan.steps, plan.next_action)) return '바꾸지 않았어요.';
          return null;
        }}
      />

      <DraftEditor draft={draft} onChange={setDraft} onSave={save} saving={saving} />
    </section>
  );
}

// 빈칸에서 시작하기 어려울 때: 템플릿이나 기본 단계로 채우기
function StepStarters({ templates, dueDate, onPick }) {
  return (
    <div className="row wrap starters">
      <span className="small muted">빠르게 시작:</span>
      {templates.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) onPick(stepsFromTemplate(t, dueDate), t.next_action);
          }}
        >
          <option value="">📋 템플릿에서 가져오기</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
      <button type="button" onClick={() => onPick(defaultSteps(dueDate, todayKST()))}>기본 단계 넣기</button>
    </div>
  );
}

export function DraftEditor({ draft, onChange, onSave, saving }) {
  const setStep = (i, patch) =>
    onChange({ ...draft, steps: draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i, d) => {
    const steps = [...draft.steps];
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    onChange({ ...draft, steps });
  };
  const remove = (i) => onChange({ ...draft, steps: draft.steps.filter((_, j) => j !== i) });
  const add = () => onChange({ ...draft, steps: [...draft.steps, { title: '', due_date: '' }] });

  return (
    <div className="block">
      <p className="muted small">단계를 고친 뒤 확정하세요. 확정 전에는 아무것도 저장되지 않습니다.</p>
      <ol className="draft-steps">
        {draft.steps.map((s, i) => (
          <li key={i}>
            <input className="grow" value={s.title} placeholder="단계 이름" onChange={(e) => setStep(i, { title: e.target.value })} />
            <input type="date" value={s.due_date ?? ''} onChange={(e) => setStep(i, { due_date: e.target.value })} />
            <span className="step-tools">
              <button type="button" onClick={() => move(i, -1)} aria-label="위로">↑</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="아래로">↓</button>
              <button type="button" onClick={() => remove(i)} aria-label="삭제">✕</button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="link" onClick={add}>+ 단계 추가</button>

      <label className="stack">
        <span className="small muted">첫 다음 행동 (비우면 첫 단계 이름을 씁니다)</span>
        <input value={draft.next_action} onChange={(e) => onChange({ ...draft, next_action: e.target.value })} />
      </label>

      <div className="actions">
        <button className="primary" disabled={saving} onClick={onSave}>{saving ? '저장 중…' : '확정해서 저장'}</button>
      </div>
    </div>
  );
}
