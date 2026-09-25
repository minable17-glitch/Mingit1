// 주간 회고 (금요일 5분)
//  - 기본: 이번 주 숫자 + 멈춘 업무 바로 손보기 + 질문 3개 → 요약 저장 (AI 없이)
//  - 원하면 AI 도움받기(질문 복사 → 답 붙여넣기)로 다음 주 조언을 받아 함께 저장
// 무엇이든 "저장"·"반영"을 눌러야 남습니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { assess } from '../lib/briefing.js';
import { dueLabel, formatShort, todayKST } from '../lib/date.js';
import { reviewPrompt } from '../lib/aiPrompts.js';
import AiHelper from './AiHelper.jsx';

export default function Review(props) {
  const { onClose } = props;
  const [mode, setMode] = useState(null); // null | 'form'
  const [past, setPast] = useState([]);

  const loadPast = () => api.loadReviews().then(setPast).catch(() => {});
  useEffect(() => { api.loadReviews().then(setPast).catch(() => {}); }, []);

  return (
    <section>
      <header className="page-head">
        {onClose ? <button className="link" onClick={onClose}>← 브리핑</button> : <span />}
        <span className="muted small">금요일 5분</span>
      </header>
      <h1>주간 회고</h1>

      {!mode && (
        <div className="block stack">
          <p>이번 주를 돌아보고, 멈춰 있는 업무를 다음 주에 다시 굴러가게 만들어요.</p>
          <button className="primary" onClick={() => setMode('form')}>회고 시작</button>
        </div>
      )}
      {mode === 'form' && <ReviewForm {...props} onSavedReview={loadPast} />}

      {past.length > 0 && (
        <div className="block">
          <h2>지난 회고</h2>
          {past.map((r) => (
            <details key={r.id}>
              <summary>{formatShort(r.week_start)} 주</summary>
              <p className="pre">{r.summary}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

const QUESTIONS = [
  '이번 주 잘 된 일 한 가지',
  '멈춘 업무가 멈춘 이유 (막힌 곳·기다리는 것)',
  '다음 주 가장 중요한 일 한 가지',
];

function ReviewForm({ tasks, categoryById, settings, reload, onSavedReview }) {
  const [week, setWeek] = useState(null);
  const [answers, setAnswers] = useState(['', '', '']);
  const [edits, setEdits] = useState({}); // task_id → { next_action, due_date }
  const [done, setDone] = useState({}); // task_id → '반영됨' 등
  const [saved, setSaved] = useState(false);
  const [advice, setAdvice] = useState('');
  const today = todayKST();

  useEffect(() => { api.loadWeekData(tasks, categoryById, settings).then(setWeek); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 멈춘 업무: 마감 지남·임박, 방치, 무응답
  const stuck = tasks
    .map((t) => ({ t, i: assess(t, today, settings.neglect_days, settings.waiting_days) }))
    .filter(({ i }) => i.overdue || i.dueSoon || i.neglected || i.noReply);

  async function apply(task, kind) {
    const e = edits[task.id] ?? {};
    try {
      if (kind === 'complete') await api.completeTask(task);
      else await api.updateTask(task, kind === 'due' ? { due_date: e.due_date } : { next_action: e.next_action });
      setDone({ ...done, [task.id]: kind === 'complete' ? '완료 처리됨' : '반영됨' });
      await reload();
    } catch (err) {
      alert(`반영하지 못했어요: ${err.message}`);
    }
  }

  async function save() {
    const lines = [
      week && `완료 ${week.completed.length}건 · 활동 ${week.activity.length}건 · 멈춘 업무 ${stuck.length}건`,
      ...QUESTIONS.map((q, n) => answers[n].trim() && `${q}: ${answers[n].trim()}`),
      advice.trim() && `AI 조언:\n${advice.trim()}`,
    ].filter(Boolean);
    try {
      await api.saveReview(lines.join('\n'));
      setSaved(true);
      onSavedReview();
    } catch (err) {
      alert(`저장하지 못했어요: ${err.message}`);
    }
  }

  const setEdit = (id, patch) => setEdits({ ...edits, [id]: { ...edits[id], ...patch } });

  return (
    <>
      <div className="block">
        <h2>이번 주</h2>
        {!week ? <p className="muted">불러오는 중…</p> : (
          <>
            <p>완료 <b>{week.completed.length}</b>건 · 활동 <b>{week.activity.length}</b>건</p>
            {week.completed.length > 0 && <p className="muted small">✔ {week.completed.join(', ')}</p>}
          </>
        )}
      </div>

      <div className="block">
        <h2>멈춘 업무 손보기</h2>
        {stuck.length === 0 && <p className="muted">멈춘 업무가 없어요. 훌륭해요! 🎉</p>}
        <ul className="suggestions">
          {stuck.map(({ t, i }) => (
            <li key={t.id}>
              <div className="row-top">
                <b className="grow">{t.title}</b>
                {i.due && <span className={i.overdue ? 'badge danger' : 'badge warn'}>{dueLabel(i.due, today)}</span>}
                {i.noReply && <span className="badge stale">{i.waitDays}일 무응답</span>}
                {i.neglected && <span className="badge stale">{i.idle}일 방치</span>}
              </div>
              {done[t.id] ? <span className="small">{done[t.id]} ✓</span> : (
                <div className="stack">
                  <div className="row">
                    <input
                      className="grow"
                      placeholder={`다음 행동: ${t.next_action}`}
                      value={edits[t.id]?.next_action ?? ''}
                      onChange={(e) => setEdit(t.id, { next_action: e.target.value })}
                    />
                    <button disabled={!edits[t.id]?.next_action?.trim()} onClick={() => apply(t, 'next')}>바꾸기</button>
                  </div>
                  <div className="row wrap">
                    <input type="date" value={edits[t.id]?.due_date ?? t.due_date ?? ''} onChange={(e) => setEdit(t.id, { due_date: e.target.value })} />
                    <button disabled={!edits[t.id]?.due_date} onClick={() => apply(t, 'due')}>마감 바꾸기</button>
                    <button className="link" onClick={() => apply(t, 'complete')}>완료 처리</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="block stack">
        <h2>한 줄씩 적어 보기</h2>
        {QUESTIONS.map((q, n) => (
          <label key={q} className="stack">
            <span className="small muted">{q}</span>
            <input value={answers[n]} onChange={(e) => setAnswers(answers.map((a, j) => (j === n ? e.target.value : a)))} />
          </label>
        ))}
        {week && (
          <AiHelper
            title="AI에게 다음 주 조언 받기"
            answerPlaceholder="AI의 답을 붙여넣으면 회고와 함께 저장돼요"
            buildPrompt={() => reviewPrompt(
              week,
              stuck.map(({ t }) => `${t.title} (다음 행동: ${t.next_action}${t.waiting_on ? `, ${t.waiting_on} 대기 중` : ''})`),
              QUESTIONS.map((q, n) => answers[n].trim() && `${q}: ${answers[n].trim()}`),
              today,
            )}
            onAnswer={(text) => { setAdvice(text.trim()); return 'AI 조언을 넣었어요. 아래에서 고친 뒤 저장하세요.'; }}
          />
        )}
        {advice && (
          <label className="stack">
            <span className="small muted">AI 조언 (고쳐도 돼요)</span>
            <textarea rows={6} value={advice} onChange={(e) => setAdvice(e.target.value)} />
          </label>
        )}
        <button className="primary" disabled={saved} onClick={save}>{saved ? '저장됨 ✓' : '회고 저장'}</button>
      </div>
    </>
  );
}
