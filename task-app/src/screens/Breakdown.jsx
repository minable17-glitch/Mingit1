// 업무 쪼개기. 기본은 직접 적기(템플릿·기본 단계로 시작 가능),
// AI가 켜진 사용자는 AI와 대화하며 쪼갤 수 있음. 어느 쪽이든 "확정해서 저장"을 눌러야 저장됩니다.
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { todayKST } from '../lib/date.js';
import { defaultSteps } from '../lib/rules.js';
import { stepsFromTemplate } from '../lib/templates.js';

export default function Breakdown({ task, categoryName, templates = [], useAi = false, onCancel, onSaved }) {
  const [history, setHistory] = useState([]); // [{ role, content }]
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  // { steps: [{title, due_date}], next_action } — AI를 안 쓰면 바로 직접 적기로 시작
  const [draft, setDraft] = useState(() => (useAi ? null : {
    steps: task.steps.length
      ? task.steps.map((s) => ({ title: s.title, due_date: s.due_date ?? '' }))
      : [{ title: '', due_date: '' }],
    next_action: '',
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  async function ask(nextHistory) {
    setHistory(nextHistory); // 실패해도 방금 한 답이 사라지지 않게 먼저 기록
    setLoading(true);
    setError('');
    try {
      const res = await api.askBreakdown(task, categoryName, nextHistory);
      if (res.kind === 'question') {
        setQuestion(res.question);
        setHistory([...nextHistory, { role: 'assistant', content: res.question }]);
      } else {
        setQuestion('');
        setDraft({ steps: res.steps, next_action: res.next_action });
      }
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (started.current || !useAi) return;
    started.current = true;
    ask([]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function sendAnswer(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    const next = [...history, { role: 'user', content: answer.trim() }];
    setAnswer('');
    ask(next);
  }

  function skipToProposal() {
    ask([...history, { role: 'user', content: '더 묻지 말고 지금 정보로 바로 제안해 주세요.' }]);
  }

  function startManual() {
    setDraft({
      steps: task.steps.length
        ? task.steps.map((s) => ({ title: s.title, due_date: s.due_date ?? '' }))
        : [{ title: '', due_date: '' }],
      next_action: '',
    });
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

  const asked = history.filter((t) => t.role === 'assistant');

  return (
    <section className="detail">
      <header className="page-head">
        <button className="link" onClick={onCancel}>← 취소</button>
        <span className="muted small">{useAi ? 'AI와 쪼개기' : '단계 정하기'}</span>
      </header>
      <h1 className="title-plain">{task.title}</h1>

      {!draft && (
        <div className="chat">
          {history.map((t, i) => (
            <div key={i} className={`bubble ${t.role}`}>{t.content}</div>
          ))}
          {loading && <div className="bubble assistant muted">생각하는 중…</div>}
          {error && (
            <div className="error">
              AI 호출에 실패했어요 ({error}).{' '}
              <button className="link" onClick={() => ask(history)}>다시 시도</button>
              {' 또는 '}
              <button className="link" onClick={startManual}>직접 적기</button>
            </div>
          )}
          {question && !loading && history.at(-1)?.role === 'assistant' && (
            <form className="row" onSubmit={sendAnswer}>
              <input className="grow" autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="답하기" />
              <button className="primary" disabled={!answer.trim()}>보내기</button>
            </form>
          )}
          {question && !loading && history.at(-1)?.role === 'assistant' && (
            <div className="row small">
              <span className="muted">질문 {asked.length}/3</span>
              <button className="link" onClick={skipToProposal}>그만 묻고 제안 받기</button>
              <button className="link" onClick={startManual}>직접 적기</button>
            </div>
          )}
        </div>
      )}

      {draft && (
        <StepStarters
          templates={templates}
          dueDate={task.due_date}
          onPick={(steps, nextAction) => {
            const hasContent = draft.steps.some((s) => s.title.trim());
            if (hasContent && !confirm('지금 적은 단계를 바꿀까요?')) return;
            setDraft({ steps, next_action: nextAction ?? draft.next_action });
          }}
        />
      )}
      {draft && (
        <DraftEditor
          draft={draft}
          onChange={setDraft}
          onSave={save}
          saving={saving}
          onRestart={useAi ? () => { setDraft(null); setHistory([]); setQuestion(''); ask([]); } : undefined}
        />
      )}
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

export function DraftEditor({ draft, onChange, onSave, saving, onRestart }) {
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
        {onRestart && <button className="link" onClick={onRestart}>AI와 처음부터 다시</button>}
      </div>
    </div>
  );
}
