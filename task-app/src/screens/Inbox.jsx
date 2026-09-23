// 받은 제안함: Gmail 라벨 메일에서 AI가 만든 업무 제안. 확정해야 업무가 됩니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { formatShort, toDateKST } from '../lib/date.js';
import DraftForm from './DraftForm.jsx';

export default function Inbox({ categories, settings, onClose }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const [checking, setChecking] = useState(false);

  const load = () => api.loadInbox().then(setItems);
  useEffect(() => { api.loadInbox().then(setItems); }, []);

  async function check() {
    setChecking(true);
    try {
      const { imported } = await api.checkGmail();
      await load();
      if (!imported) alert('새로 온 업무 메일이 없어요.');
    } catch (e) {
      alert(`메일을 확인하지 못했어요: ${e.message}`);
    } finally {
      setChecking(false);
    }
  }

  if (open) {
    return (
      <DraftForm
        initial={api.draftFromExtraction(open.proposal, categories)}
        categories={categories}
        source="메일"
        header={<p className="muted small">✉️ {open.subject} — {open.sender}</p>}
        onCancel={() => setOpen(null)}
        onConfirm={async (draft) => {
          await api.acceptInbox(open, draft);
          setOpen(null);
          await load();
        }}
      />
    );
  }

  return (
    <section>
      <header className="page-head">
        <button className="link" onClick={onClose}>← 브리핑</button>
        <button disabled={checking} onClick={check}>{checking ? '확인 중…' : '지금 메일 확인'}</button>
      </header>
      <h1>받은 제안함</h1>
      <p className="muted small">Gmail에서 <b>{settings.gmail_label || '업무'}</b> 라벨을 붙인 메일을 AI가 읽고 업무 초안을 만들어 둡니다.</p>

      {items === null && <p className="muted">불러오는 중…</p>}
      {items?.length === 0 && <p className="empty">확인할 제안이 없어요.</p>}
      <ul className="task-list">
        {items?.map((it) => (
          <li key={it.id} className="task-row">
            <div className="row-top" onClick={() => setOpen(it)}>
              <span className="title">{it.proposal?.title || it.subject}</span>
              {it.proposal?.due_date && <span className="badge warn">{formatShort(it.proposal.due_date)}</span>}
            </div>
            <div className="note" onClick={() => setOpen(it)}>
              ✉️ {it.subject} · {it.received_at && formatShort(toDateKST(it.received_at))}
            </div>
            <div className="row">
              <button className="primary" onClick={() => setOpen(it)}>확인하고 만들기</button>
              <button className="link" onClick={async () => { await api.dismissInbox(it); load(); }}>필요 없음</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
