// 업무 연결(선후 관계) 만들기·지우기 + 목록. "앞 업무를 끝내야 뒤 업무를 할 수 있다"
import { useState } from 'react';
import * as api from '../lib/api.js';
import { wouldCycle } from '../lib/links.js';

// 연결 만들기·지우기 + 표로 보기 (3D를 못 보는 경우에도 전부 할 수 있게)
export default function LinkEditor({ tasks, links, tasksById, reload }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  async function add() {
    setMsg('');
    if (!from || !to || from === to) return setMsg('서로 다른 두 업무를 골라 주세요.');
    if (links.some((l) => l.from_task_id === from && l.to_task_id === to)) return setMsg('이미 연결되어 있어요.');
    if (wouldCycle(from, to, links)) return setMsg('서로가 서로를 기다리는 고리가 생겨서 연결할 수 없어요.');
    try {
      await api.addLink(tasksById[from], tasksById[to]);
      setFrom('');
      setTo('');
      await reload();
    } catch (e) {
      setMsg(e.message.includes('task_links') ? '연결 기능을 쓰려면 schema_links.sql 을 한 번 실행해야 해요.' : `연결하지 못했어요: ${e.message}`);
    }
  }

  const visible = links.filter((l) => tasksById[l.from_task_id] && tasksById[l.to_task_id]);

  return (
    <div className="block stack">
      <h2>업무 연결하기</h2>
      <p className="muted small">“앞 업무”를 끝내야 “뒤 업무”를 할 수 있을 때 연결하세요. 앞 업무가 마감을 넘기면 뒤 업무에 주의 표시가 떠요.</p>
      <div className="row wrap">
        <select className="grow" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="앞 업무">
          <option value="">앞 업무 (먼저)</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <span aria-hidden="true">→</span>
        <select className="grow" value={to} onChange={(e) => setTo(e.target.value)} aria-label="뒤 업무">
          <option value="">뒤 업무 (나중)</option>
          {tasks.filter((t) => t.id !== from).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button className="primary" disabled={!from || !to} onClick={add}>연결</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      {visible.length > 0 && (
        <ul className="link-list">
          {visible.map((l) => (
            <li key={l.id}>
              <span className="grow">{tasksById[l.from_task_id].title} <b>→</b> {tasksById[l.to_task_id].title}</span>
              <button className="link" onClick={async () => { await api.removeLink(l.id); await reload(); }}>끊기</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
