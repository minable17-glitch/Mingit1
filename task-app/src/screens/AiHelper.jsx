// AI 도움받기 상자: ① 질문 복사 → ② 쓰는 AI에 붙여넣기 → ③ 답을 여기 붙여넣기
// 자기 API 키를 넣어 둔 기기에서는 "바로 받기" 버튼으로 ①~③을 한 번에.
import { useState } from 'react';
import { askWithOwnKey, loadAiSettings, siteOf } from '../lib/ai.js';

export default function AiHelper({ title = 'AI 도움받기', buildPrompt, onAnswer, answerPlaceholder, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ai = loadAiSettings();
  const site = siteOf(ai);

  if (!open) {
    return <button type="button" className="link" onClick={() => setOpen(true)}>🤖 {title}</button>;
  }

  async function copy() {
    const prompt = buildPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      window.prompt('아래 내용을 전체 선택해 복사하세요', prompt);
    }
  }

  function apply(text) {
    const err = onAnswer(text);
    setMessage(err || '답을 반영했어요. 아래에서 확인하고 고쳐 주세요.');
  }

  async function askDirect() {
    setBusy(true);
    setMessage('');
    try {
      const text = await askWithOwnKey(buildPrompt(), ai);
      setAnswer(text);
      apply(text);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-helper block stack">
      <div className="row">
        <b className="grow">🤖 {title}</b>
        <button type="button" className="link" onClick={() => setOpen(false)}>닫기</button>
      </div>
      <p className="muted small">⚠️ 학생 개인정보·비공개 내용은 질문에서 지우고 보내세요. AI 사이트에는 선생님 계정으로 직접 보내게 됩니다.</p>

      {ai.apiKey && (
        <button type="button" className="primary" disabled={busy} onClick={askDirect}>
          {busy ? 'AI가 생각하는 중…' : '내 API 키로 바로 받기'}
        </button>
      )}

      <ol className="ai-steps">
        <li>
          <button type="button" onClick={copy}>{copied ? '복사됨 ✓ 다시 복사' : '질문 복사하기'}</button>
        </li>
        <li>
          <a className="button-link" href={site.url} target="_blank" rel="noreferrer">{site.name} 열어서 붙여넣기 ↗</a>
          <span className="muted small"> (다른 AI를 써도 돼요)</span>
        </li>
        <li className="stack">
          <textarea
            rows={5}
            placeholder={answerPlaceholder ?? 'AI의 답을 통째로 복사해 여기에 붙여넣으세요'}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <button type="button" disabled={!answer.trim()} onClick={() => apply(answer)}>답 반영하기</button>
        </li>
      </ol>
      {message && <p className="small">{message}</p>}
    </div>
  );
}
