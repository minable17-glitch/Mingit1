// 받은 제안함: Gmail 라벨 메일을 모아 두고, 열면 규칙으로 업무 초안을 만듦(원하면 AI 도움받기). 확정해야 업무가 됩니다.
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { formatShort, toDateKST, todayKST } from '../lib/date.js';
import { extractFromDocument } from '../lib/rules.js';
import DraftForm from './DraftForm.jsx';

const mailText = (it) => `제목 ${it.subject ?? ''}\n보낸 사람: ${it.sender ?? ''}\n\n${it.body ?? ''}`;

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
        initial={extractFromDocument(mailText(open), categories, todayKST())}
        categories={categories}
        source="메일"
        sourceText={mailText(open)}
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
      <p className="muted small">Gmail에서 <b>{settings.gmail_label || '업무'}</b> 라벨을 붙인 메일을 모아 둡니다. 열면 제목·기한·붙임을 찾아 업무 초안을 만들어요.</p>

      {items === null && <p className="muted">불러오는 중…</p>}
      {items?.length === 0 && <p className="empty">확인할 제안이 없어요.</p>}
      <ul className="task-list">
        {items?.map((it) => (
          <li key={it.id} className="task-row">
            <div className="row-top" onClick={() => setOpen(it)}>
              <span className="title">{it.subject || '(제목 없음)'}</span>
            </div>
            <div className="note" onClick={() => setOpen(it)}>
              ✉️ {it.sender} · {it.received_at && formatShort(toDateKST(it.received_at))}
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
