// 주간 회고: 금요일 5분 대화. AI가 이번 주를 정리하고 질문(최대 3개)하며 다음 주 조정을 제안합니다.
// 제안은 하나씩 "반영"을 눌러야 적용되고, 회고 요약도 "저장"을 눌러야 남습니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { formatShort } from '../lib/date.js';

const CHANGE_LABEL = { next_action: '다음 행동', due_date: '마감', complete: '완료 처리' };

export default function Review({ tasks, categoryById, settings, reload, onClose }) {
  const [past, setPast] = useState([]);
  const [started, setStarted] = useState(false);
  const [week, setWeek] = useState(null);
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState([]); // { ...s, state: 'new'|'applied'|'skipped' }
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.loadReviews().then(setPast).catch(() => {}); }, []);

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
      setPast(await api.loadReviews());
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  return (
    <section>
      <header className="page-head">
        {onClose ? <button className="link" onClick={onClose}>← 브리핑</button> : <span />}
        <span className="muted small">금요일 5분</span>
      </header>
      <h1>주간 회고</h1>

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
