// 주간 회고 (금요일 5분)
//  - 기본: 이번 주 숫자 + 멈춘 업무 바로 손보기 + 질문 3개 → 요약 저장 (AI 없이)
//  - AI가 켜진 사용자: AI와 대화하며 회고할 수도 있음
// 무엇이든 "저장"·"반영"을 눌러야 남습니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { assess } from '../lib/briefing.js';
import { dueLabel, formatShort, todayKST } from '../lib/date.js';

const CHANGE_LABEL = { next_action: '다음 행동', due_date: '마감', complete: '완료 처리' };

export default function Review(props) {
  const { features, onClose } = props;
  const [mode, setMode] = useState(null); // null | 'form' | 'ai'
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
          {features?.ai_enabled && <button onClick={() => setMode('ai')}>AI와 대화하며 회고</button>}
        </div>
      )}
      {mode === 'form' && <ReviewForm {...props} onSavedReview={loadPast} />}
      {mode === 'ai' && <ReviewChat {...props} onSavedReview={loadPast} />}

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
        <button className="primary" disabled={saved} onClick={save}>{saved ? '저장됨 ✓' : '회고 저장'}</button>
      </div>
    </>
  );
}

function ReviewChat({ tasks, categoryById, settings, reload, onSavedReview }) {
  const [started, setStarted] = useState(false);
  const [week, setWeek] = useState(null);
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState([]); // { ...s, state: 'new'|'applied'|'skipped' }
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  async function ask(nextHistory, weekData = week) {
    setHistory(nextHistory); // 실패해도 방금 한 답이 사라지지 않게 먼저 기록
    setLoading(true);
    setError('');
    try {
      const res = await api.askReview(nextHistory, weekData);
      setHistory([...nextHistory, { role: 'assistant', content: res.message }]);
      setSuggestions((prev) => [
        ...prev,
        ...res.suggestions.filter((s) => byId[s.task_id]).map((s) => ({ ...s, state: 'new' })),
      ]);
      if (res.finished) setSummary(res.summary);
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    setStarted(true);
    setLoading(true);
    try {
      const w = await api.loadWeekData(tasks, categoryById, settings);
      setWeek(w);
      await ask([], w);
    } catch (e) {
      setError(e.message ?? String(e));
      setLoading(false);
    }
  }

  function send(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    const next = [...history, { role: 'user', content: answer.trim() }];
    setAnswer('');
    ask(next);
  }

  async function apply(i) {
    const s = suggestions[i];
    try {
      await api.applySuggestion(byId[s.task_id], s);
      setSuggestions(suggestions.map((x, j) => (j === i ? { ...x, state: 'applied' } : x)));
      await reload();
    } catch (e) {
      alert(`반영하지 못했어요: ${e.message}`);
    }
  }

  async function save() {
    try {
      await api.saveReview(summary);
      setSaved(true);
      onSavedReview();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  return (
    <>
      {!started && (
        <div className="block stack">
          <p>이번 주 활동 기록을 AI가 정리하고, 다음 주를 위해 몇 가지 물어봐요.</p>
          <button className="primary" onClick={start}>회고 시작</button>
        </div>
      )}

      {started && (
        <div className="chat block">
          {history.map((t, i) => <div key={i} className={`bubble ${t.role}`}>{t.content}</div>)}
          {loading && <div className="bubble assistant muted">정리하는 중…</div>}
          {error && (
            <div className="error">
              AI 호출에 실패했어요 ({error}).{' '}
              <button className="link" onClick={() => (week ? ask(history) : start())}>다시 시도</button>
            </div>
          )}
          {!summary && !loading && history.at(-1)?.role === 'assistant' && (
            <form className="row" onSubmit={send}>
              <input className="grow" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="답하기" />
              <button className="primary" disabled={!answer.trim()}>보내기</button>
            </form>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="block">
          <h2>다음 주를 위한 제안</h2>
          <ul className="suggestions">
            {suggestions.map((s, i) => (
              <li key={i} className={s.state}>
                <div>
                  <b>{byId[s.task_id]?.title}</b> — {CHANGE_LABEL[s.change]}
                  {s.value && <>: {s.change === 'due_date' ? formatShort(s.value) : s.value}</>}
                </div>
                <div className="muted small">{s.reason}</div>
                {s.state === 'new' && (
                  <div className="row">
                    <button onClick={() => apply(i)}>반영</button>
                    <button className="link" onClick={() => setSuggestions(suggestions.map((x, j) => (j === i ? { ...x, state: 'skipped' } : x)))}>넘기기</button>
                  </div>
                )}
                {s.state === 'applied' && <span className="small">반영됨 ✓</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <div className="block stack">
          <h2>이번 주 요약</h2>
          <textarea rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} />
          <button className="primary" disabled={saved} onClick={save}>{saved ? '저장됨 ✓' : '회고 저장'}</button>
        </div>
      )}

    </>
  );
}
