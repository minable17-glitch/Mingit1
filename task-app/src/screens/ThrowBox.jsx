// 던져넣기: 떠오른 걸 적고 Enter → 바로 '📥 나중에 분류'에 보관 (단계·분류 고르기 없음).
// 시간이 적혀 있으면("3시", "점심 전") 알림만 같이 맞춰 둠. 분류는 나중에 한꺼번에.
import { useState } from 'react';
import * as api from '../lib/api.js';
import { todayKST } from '../lib/date.js';
import { triageText } from '../lib/rules.js';
import { extractFromLongText, isLongText } from '../lib/notice.js';
import { localToISO, parseRemindTime, remindLabel } from '../lib/remindTime.js';
import { looksClassRelated } from '../lib/planner.js';

export function ThrowIn({ settings, onAdded }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function save(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setBusy(true);
    setMsg('');
    try {
      await api.addThrow(content);
      const remind = parseRemindTime(content, Date.now(), settings?.bell_schedule);
      if (remind) {
        await api.addReminder({ taskId: null, title: content, remindAt: localToISO(remind.at) }).catch(() => null);
        setMsg(`📥 던져 뒀어요. 🔔 ${remindLabel(localToISO(remind.at))}에 알림도 맞췄어요.`);
      } else {
        setMsg('📥 던져 뒀어요. 아래 “나중에 분류”에서 정리하세요.');
      }
      setText('');
      await onAdded();
    } catch (err) {
      setMsg(err.message.includes('throw_items') ? '잠시 뒤 다시 해 주세요. (던져넣기 보관함을 준비하는 중이에요)' : `저장하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="quick-add" onSubmit={save}>
        <input className="grow" placeholder="떠오른 걸 그냥 던져 두세요 (분류는 나중에)" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={busy || !text.trim()}>던지기</button>
      </form>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

const KST = 9 * 3600e3;
function ago(iso) {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}시간 전`;
  const d = new Date(Date.parse(iso) + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// 📥 나중에 분류: 던져 둔 것 목록과 하나씩 정리하기
export function ThrowBox({ items, tasks, categories, todayItems, showClass, reload, onOpenScreen }) {
  const [open, setOpen] = useState(null);
  if (!items?.length) return null;
  return (
    <details className="throw-box block" open>
      <summary><b>📥 나중에 분류</b> <span className="small muted">{items.length}개 · 하나씩 눌러 어디에 둘지 정하세요</span></summary>
      <ul className="throw-list">
        {items.map((it) => (
          <li key={it.id} className={open === it.id ? 'open' : ''}>
            <button className="throw-row" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>
              <span className="grow throw-text">{it.content}</span>
              <span className="small muted">{ago(it.created_at)}</span>
            </button>
            {open === it.id && (
              <SortPanel item={it} tasks={tasks} categories={categories} todayItems={todayItems} showClass={showClass} reload={reload} onOpenScreen={onOpenScreen} onDone={() => setOpen(null)} />
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const ATTACH_OPTIONS = [
  { key: 'step', label: '할 일(단계)로 추가' },
  { key: 'note', label: '메모로 남기기' },
  { key: 'next_action', label: '다음 행동으로' },
];

function SortPanel({ item, tasks, categories, todayItems, showClass, reload, onOpenScreen, onDone }) {
  const today = todayKST();
  const etc = categories.find((c) => c.name.trim() === api.ETC_CATEGORY)?.id ?? categories[0]?.id;
  const [mode, setMode] = useState(null); // null | 'task' | 'class'
  const [students, setStudents] = useState(null);
  const [studentId, setStudentId] = useState('');
  const classy = showClass && looksClassRelated(item.content);
  async function openClass() {
    setMode('class');
    if (students === null) setStudents(await api.loadStudents());
  }
  const [proposal, setProposal] = useState(() => ({ ...triageText(item.content, tasks, categories, today), category_id: etc }));
  const [busy, setBusy] = useState(false);
  const set = (patch) => setProposal((p) => ({ ...p, ...patch }));
  const isNew = proposal.attach_as === 'new';
  const rankOf = (id) => { const i = proposal.candidates?.indexOf(id) ?? -1; return i === -1 ? 99 : i; };
  const ordered = [...tasks].sort((a, b) => rankOf(a.id) - rankOf(b.id));

  const finish = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await api.deleteThrow(item.id);
      onDone();
      await reload();
    } catch (e) {
      alert(`정리하지 못했어요: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  async function toNewTaskQuick() {
    let cat = etc;
    if (!cat) cat = (await api.ensureEtcCategory(categories)).category.id;
    await api.createTask({ title: item.content.slice(0, 80), categoryId: cat });
  }

  function longDraft() {
    const { draft, source } = extractFromLongText(item.content, categories, today);
    draft.category_id = etc ?? draft.category_id;
    onOpenScreen({ type: 'draft', draft, source, sourceText: item.content, throwId: item.id });
  }

  const mine = (todayItems ?? []).filter((i) => i.day === today);

  return (
    <div className="sort-panel stack">
      {mode === 'class' ? (
        <div className="proposal stack">
          <p className="small muted">🏫 학급으로 보내기 ({Number(today.slice(5, 7))}/{Number(today.slice(8))} 기준)</p>
          <div className="sort-actions">
            <button disabled={busy} onClick={() => finish(() => api.addNotice({ day: today, kind: 'morning', body: item.content, position: Date.now() % 100000 }))}>☀️ 조회 전달사항</button>
            <button disabled={busy} onClick={() => finish(() => api.addNotice({ day: today, kind: 'closing', body: item.content, position: Date.now() % 100000 }))}>🌙 종례 전달사항</button>
            <button disabled={busy} onClick={() => finish(() => api.appendPlannerMemo(today, item.content))}>📒 오늘 일지 메모</button>
          </div>
          <div className="row wrap">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="학생">
              <option value="">{students === null ? '명렬표 불러오는 중…' : students.length ? '학생 고르기' : '명렬표 없음'}</option>
              {(students ?? []).map((st) => <option key={st.id} value={st.id}>{st.number}번 {st.name}</option>)}
            </select>
            <button disabled={busy || !studentId} onClick={() => finish(() => api.addClassNote({ studentId, day: today, body: item.content }))}>📝 학생 특이사항으로</button>
          </div>
          <button className="link" onClick={() => setMode(null)}>뒤로</button>
        </div>
      ) : mode !== 'task' ? (
        <div className="sort-actions">
          {classy && <button className="primary" disabled={busy} onClick={openClass}>🏫 학급으로</button>}
          {isLongText(item.content)
            ? <button className="primary" disabled={busy} onClick={longDraft}>📄 업무로 정리하기</button>
            : <button className={classy ? '' : 'primary'} disabled={busy} onClick={() => setMode('task')}>📂 업무로 · 업무에 넣기</button>}
          {!isLongText(item.content) && <button disabled={busy} onClick={() => finish(toNewTaskQuick)}>➕ 그대로 새 업무(기타)</button>}
          {todayItems !== null && <button disabled={busy} onClick={() => finish(() => api.addTodayItem({ day: today, title: item.content, position: mine.reduce((m, i) => Math.max(m, i.position + 1), 0) }))}>☀️ 오늘 할 일로</button>}
          <button disabled={busy} onClick={() => finish(() => api.addThought({ body: item.content, kind: 'thought' }))}>💭 생각 노트로</button>
          {showClass && !classy && <button disabled={busy} onClick={openClass}>🏫 학급으로</button>}
          <button className="link" disabled={busy} onClick={() => finish(async () => {})}>🗑 지우기</button>
        </div>
      ) : (
        <div className="proposal stack">
          <label className="row wrap">
            <span className="small muted">어디에</span>
            <select
              className="grow"
              value={isNew ? '' : proposal.task_id}
              onChange={(e) => set(e.target.value
                ? { task_id: e.target.value, attach_as: isNew ? 'note' : proposal.attach_as }
                : { task_id: '', attach_as: 'new', category_id: proposal.category_id || etc })}
            >
              <option value="">➕ 새 업무로 만들기</option>
              {ordered.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          {isNew ? (
            <div className="row wrap">
              <select value={proposal.category_id ?? ''} onChange={(e) => set({ category_id: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={proposal.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value })} title="마감(선택)" />
            </div>
          ) : (
            <div className="row wrap">
              <select value={proposal.attach_as} onChange={(e) => set({ attach_as: e.target.value })}>
                {ATTACH_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {proposal.attach_as === 'step' && (
                <input type="date" value={proposal.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value })} title="단계 마감(선택)" />
              )}
            </div>
          )}
          <input value={proposal.content} onChange={(e) => set({ content: e.target.value })} />
          <div className="row">
            <button className="primary" disabled={busy || !proposal.content.trim() || (isNew && !proposal.category_id)} onClick={() => finish(() => api.applyTriage(proposal, tasks))}>반영</button>
            <button className="link" onClick={() => setMode(null)}>뒤로</button>
          </div>
        </div>
      )}
    </div>
  );
}
