import { useState } from 'react';
import * as api from '../lib/api.js';
import { assess, sortForBriefing } from '../lib/briefing.js';
import { dueLabel, formatShort, todayKST } from '../lib/date.js';
import { freeSlotNow, kstClock } from '../lib/timetable.js';
import { extractFromDocument, guessCategoryId, pickDeadline, triageText } from '../lib/rules.js';
import { blockerDelayed, blockersOf } from '../lib/links.js';
import { extractFromConversation, looksLikeOfficialDoc } from '../lib/conversation.js';

export default function Briefing({
  tasks, categories, categoryById, settings, templates, inboxCount, reload, onOpen, onOpenScreen, links = [],
}) {
  const today = todayKST();
  const [filter, setFilter] = useState(null); // 분류 ID 또는 null(전체)
  const [grouped, setGrouped] = useState(false);

  const all = sortForBriefing(tasks, today, settings.neglect_days, settings.waiting_days);
  const rows = all.filter((r) => !filter || r.task.category_id === filter);

  const counts = all.reduce(
    (acc, { info }) => {
      if (info.overdue || info.dueSoon) acc.due += 1;
      if (info.neglected) acc.neglected += 1;
      if (info.noReply) acc.noReply += 1;
      return acc;
    },
    { due: 0, neglected: 0, noReply: 0 },
  );

  const isFriday = kstClock().weekday === 5;
  const slot = freeSlotNow(settings.bell_schedule, settings.timetable);

  return (
    <section>
      <header className="page-head">
        <h1>오늘의 브리핑</h1>
        <span className="muted">{formatShort(today)}</span>
      </header>

      <PrivacyNotice />
      {tasks.length > 0 && <BalancePanel tasks={tasks} categories={categories} settings={settings} links={links} today={today} />}

      <p className="summary">
        진행 중 <b>{tasks.length}</b>
        {counts.due > 0 && <> · 마감 임박 <b className="warn">{counts.due}</b></>}
        {counts.noReply > 0 && <> · 무응답 <b className="warn">{counts.noReply}</b></>}
        {counts.neglected > 0 && <> · 방치 <b className="warn">{counts.neglected}</b></>}
      </p>

      {inboxCount > 0 && (
        <button className="banner" onClick={() => onOpenScreen({ type: 'inbox' })}>
          📬 메일에서 온 업무 제안 <b>{inboxCount}</b>건 확인하기
        </button>
      )}
      {isFriday && (
        <button className="banner" onClick={() => onOpenScreen({ type: 'review' })}>
          🗓️ 금요일이에요. 5분 주간 회고 하기
        </button>
      )}
      {slot && tasks.length > 0 && (
        <SpareTime slot={slot} tasks={tasks} settings={settings} onOpen={onOpen} />
      )}

      <InputArea
        tasks={tasks}
        categories={categories}
        categoryById={categoryById}
        settings={settings}
        templates={templates}
        onAdded={reload}
        onOpenScreen={onOpenScreen}
      />

      <div className="chips">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter(null)}>전체</button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={filter === c.id ? 'chip on' : 'chip'}
            style={{ '--c': c.color }}
            onClick={() => setFilter(filter === c.id ? null : c.id)}
          >
            {c.name}
          </button>
        ))}
        <label className="toggle">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          분류별로 묶기
        </label>
      </div>

      {rows.length === 0 && <p className="empty">진행 중인 업무가 없습니다. 위에서 한 줄로 등록해 보세요.</p>}

      {grouped
        ? categories
            .map((c) => ({ c, items: rows.filter((r) => r.task.category_id === c.id) }))
            .filter((g) => g.items.length)
            .map(({ c, items }) => (
              <div key={c.id} className="group">
                <h2 style={{ '--c': c.color }} className="group-title">{c.name}</h2>
                <TaskList rows={items} categoryById={categoryById} today={today} onOpen={onOpen} links={links} tasks={tasks} settings={settings} reload={reload} />
              </div>
            ))
        : <TaskList rows={rows} categoryById={categoryById} today={today} onOpen={onOpen} links={links} tasks={tasks} settings={settings} reload={reload} />}
    </section>
  );
}

// 업무 꼭지 목록: 누르면 그 자리에서 펼쳐져 세부 단계를 보고 바로 체크. "열기"로 업무 화면.
function TaskList({ rows, categoryById, today, onOpen, links, tasks, settings, reload }) {
  const [open, setOpen] = useState(() => new Set());
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function check(task, step) {
    try {
      const { completed } = await api.toggleStep(task, step);
      if (completed) alert(`“${task.title}”의 마지막 단계를 마쳐서 보관함으로 옮겼어요. 수고하셨어요!`);
      await reload();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  }

  return (
    <ul className="task-list">
      {rows.map(({ task, info }) => {
        const cat = categoryById[task.category_id];
        const total = task.steps?.length ?? 0;
        const done = task.steps?.filter((s) => s.done).length ?? 0;
        const blockers = blockersOf(task.id, links, tasksById);
        const delayed = blockers.length > 0 && blockerDelayed(task.id, links, tasksById, today, settings);
        const isOpen = open.has(task.id);
        return (
          <li key={task.id} className={isOpen ? 'task-row open' : 'task-row'} style={{ '--c': cat?.color }}>
            <button type="button" className="row-button" aria-expanded={isOpen} onClick={() => toggle(task.id)}>
              <div className="row-top">
                <span className="title">{task.title}</span>
                {info.due && (
                  <span className={info.overdue ? 'badge danger' : info.dueSoon ? 'badge warn' : 'badge'}>
                    {dueLabel(info.due, today)}
                  </span>
                )}
                {info.noReply && <span className="badge stale">{info.waitDays}일 무응답</span>}
                {info.neglected && <span className="badge stale">{info.idle}일 방치</span>}
                {blockers.length > 0 && (
                  <span className={delayed ? 'badge warn' : 'badge'} title={blockers.map((b) => b.title).join(', ')}>
                    🔗 앞 업무 {blockers.length}{delayed ? ' 지연' : ''}
                  </span>
                )}
                <span className="chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
              </div>
              {task.waiting_on
                ? <div className="next waiting">⏳ {task.waiting_on} 기다리는 중</div>
                : <div className="next">→ {task.next_action}</div>}
              {task.latest_note && <div className="note">📝 {task.latest_note}</div>}
              {total > 0 && (
                <div className="progress" aria-label={`단계 ${done}/${total}`}><span style={{ width: `${(done / total) * 100}%` }} /></div>
              )}
            </button>
            {isOpen && (
              <div className="row-detail">
                {total === 0 && <p className="muted small">아직 세부 단계가 없어요.</p>}
                <ul className="steps">
                  {[...(task.steps ?? [])].sort((a, b) => a.position - b.position).map((s) => (
                    <li key={s.id} className={s.done ? 'done' : ''}>
                      <label>
                        <input type="checkbox" checked={s.done} onChange={() => check(task, s)} />
                        <span>{s.title}</span>
                      </label>
                      {s.due_date && <span className={!s.done && s.due_date < today ? 'badge danger' : 'badge'}>{dueLabel(s.due_date, today)}</span>}
                    </li>
                  ))}
                </ul>
                {blockers.length > 0 && <p className="small muted">먼저 끝내야 할 업무: {blockers.map((b) => b.title).join(', ')}</p>}
                <div className="row">
                  <button className="primary" onClick={() => onOpen(task.id)}>{total === 0 ? '단계 정하러 열기 →' : '업무 열기 →'}</button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── 입력: 새 업무 / 던져넣기 / 공문 붙여넣기 ─────────────

const MODES = [
  { key: 'new', label: '새 업무' },
  { key: 'throw', label: '던져넣기' },
  { key: 'doc', label: '공문·대화 붙여넣기' },
];

function InputArea(props) {
  const [mode, setMode] = useState('new');
  return (
    <div className="input-area">
      <div className="seg">
        {MODES.map((m) => (
          <button key={m.key} className={mode === m.key ? 'on' : ''} onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
      </div>
      {mode === 'new' && <QuickAdd {...props} />}
      {mode === 'throw' && <ThrowIn {...props} />}
      {mode === 'doc' && <PasteDocument {...props} />}
    </div>
  );
}

function QuickAdd({ categories, templates, onAdded }) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);

  const catId = categoryId || categories[0]?.id;
  const template = templates.find((t) => t.id === templateId);

  function pickTemplate(id) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t?.category_id) setCategoryId(t.category_id);
    if (t && !title.trim()) setTitle(t.name);
  }

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !catId) return;
    setBusy(true);
    try {
      // 마감을 안 골랐는데 업무명에 날짜가 있으면(예: "공문작성(10월5일)") 그 날짜를 마감으로
      const due = dueDate || pickDeadline(title, todayKST());
      if (template) await api.createFromTemplate(template, { title, categoryId: catId, dueDate: due });
      else await api.createTask({ title, categoryId: catId, dueDate: due });
      setTitle('');
      setDueDate('');
      setTemplateId('');
      await onAdded();
    } catch (err) {
      alert(`등록하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        className="grow"
        placeholder="새 업무 한 줄 (예: 2학기 평가계획 제출)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {templates.length > 0 && (
        <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} title="템플릿">
          <option value="">템플릿 없이</option>
          {templates.map((t) => <option key={t.id} value={t.id}>📋 {t.name}</option>)}
        </select>
      )}
      <select value={catId ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="마감일(선택)" />
      <button className="primary" disabled={busy || !title.trim()}>등록</button>
      {template && (
        <p className="muted small full">
          단계 {template.steps.length}개가 함께 만들어져요{dueDate ? '' : ' (마감을 넣으면 단계 날짜도 자동 계산)'}.
        </p>
      )}
    </form>
  );
}

const ATTACH_OPTIONS = [
  { key: 'step', label: '할 일(단계)로 추가' },
  { key: 'note', label: '메모로 남기기' },
  { key: 'next_action', label: '다음 행동으로' },
];

// 던져넣기: 규칙으로 어느 업무 것인지 추측 → 사용자가 고쳐서 반영.
function ThrowIn({ tasks, categories, onAdded }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(null);

  function sortOut(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setProposal(triageText(text.trim(), tasks, categories, todayKST()));
  }

  async function confirm() {
    setBusy(true);
    try {
      await api.applyTriage(proposal, tasks);
      setProposal(null);
      setText('');
      await onAdded();
    } catch (err) {
      alert(`반영하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const set = (patch) => setProposal({ ...proposal, ...patch });
  const isNew = proposal?.attach_as === 'new';
  // 추측 후보를 목록 위쪽에
  const rankOf = (id) => {
    const i = proposal?.candidates?.indexOf(id) ?? -1;
    return i === -1 ? 99 : i;
  };
  const ordered = [...tasks].sort((a, b) => rankOf(a.id) - rankOf(b.id));

  return (
    <div className="stack">
      <form className="quick-add" onSubmit={sortOut}>
        <input
          className="grow"
          placeholder="떠오른 걸 그냥 적으세요 (예: 운영비 영수증 금요일까지 내야 함)"
          value={text}
          onChange={(e) => { setText(e.target.value); setProposal(null); }}
        />
        <button className="primary" disabled={!text.trim()}>정리하기</button>
      </form>
      {proposal && (
        <div className="proposal stack">
          <label className="row wrap">
            <span className="small muted">어디에</span>
            <select
              className="grow"
              value={isNew ? '' : proposal.task_id}
              onChange={(e) => set(e.target.value
                ? { task_id: e.target.value, attach_as: isNew ? 'note' : proposal.attach_as }
                : { task_id: '', attach_as: 'new', category_id: proposal.category_id || guessCategoryId(text, categories) })}
            >
              <option value="">➕ 새 업무로 만들기</option>
              {ordered.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </label>
          {isNew ? (
            <div className="row wrap">
              <select value={proposal.category_id} onChange={(e) => set({ category_id: e.target.value })}>
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
            <button className="primary" disabled={busy || !proposal.content.trim()} onClick={confirm}>반영</button>
            <button className="link" onClick={() => setProposal(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

// 붙여넣기: 공문이면 제목·기한·붙임을, AI와 나눈 대화면 할 일 목록을 이야기한 순서대로 뽑아 초안
// → 초안 화면에서 AI 도움받기로 다듬거나 직접 고쳐서 확정
function PasteDocument({ categories, onOpenScreen }) {
  const [text, setText] = useState('');

  function analyze() {
    const today = todayKST();
    const isDoc = looksLikeOfficialDoc(text);
    const draft = isDoc ? extractFromDocument(text, categories, today) : extractFromConversation(text, categories, today);
    onOpenScreen({ type: 'draft', draft, source: isDoc ? '공문' : 'AI 대화', sourceText: text });
    setText('');
  }

  return (
    <div className="stack">
      <textarea
        rows={5}
        placeholder={'공문 본문이나, ChatGPT·Claude 등과 나눈 대화를 통째로 붙여넣으세요.\n공문이면 제목·기한·붙임을, 대화면 할 일 목록을 이야기한 순서대로 뽑아 업무 초안을 만들어요.'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="muted small">⚠️ 학생 이름 등 개인정보가 들어 있으면 지우고 붙여넣어 주세요.</p>
      <button className="primary" disabled={text.trim().length < 10} onClick={analyze}>업무로 만들기</button>
    </div>
  );
}

// ── 짜투리 모드 ─────────────────────────────

// 규칙: 급한 순서대로 다음 행동 3개. 대기 중 업무는 확인 연락.
function spareSuggestions(tasks, settings) {
  return sortForBriefing(tasks, todayKST(), settings.neglect_days, settings.waiting_days)
    .slice(0, 3)
    .map(({ task }) => ({
      task_id: task.id,
      action: task.waiting_on ? `${task.waiting_on}에 진행 상황 확인하기` : task.next_action,
    }));
}

function SpareTime({ slot, tasks, settings, onOpen }) {
  const [items, setItems] = useState(null);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  return (
    <div className="banner static">
      <div className="row wrap">
        <span className="grow">☕ 지금 {slot.period}교시 공강 · <b>{slot.minutesLeft}분</b> 남음</span>
        {!items && <button onClick={() => setItems(spareSuggestions(tasks, settings))}>지금 할 일 보기</button>}
      </div>
      {items && (
        <ul className="spare-list">
          {items.map((i, n) => (
            <li key={n} onClick={() => onOpen(i.task_id)}>
              <span>{i.action}</span>
              <span className="muted small"> · {byId[i.task_id]?.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 처음 쓸 때 한 번: 학생 개인정보 입력 금지 안내 (닫으면 이 기기에서 다시 안 보임)
function PrivacyNotice() {
  const KEY = 'tk-privacy-notice-dismissed';
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <div className="notice row">
      <span className="grow">🔒 학생 이름·연락처·상담 내용 등 <b>학생 개인정보는 적지 말아 주세요.</b> 업무 제목은 “3반 상담 기록 정리”처럼 써 주세요.</span>
      <button className="link" onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* 저장 안 돼도 이번엔 닫기 */ } setHidden(true); }}>확인</button>
    </div>
  );
}

// ── 업무 밸런스: 분류마다 업무가 얼마나 몰려 있고, 그중 위험한 게 몇 개인지 ─────
// 색은 상태만 뜻함(아이콘+글자와 함께). 막대 길이는 모든 분류가 같은 기준(가장 많은 분류 = 전체 폭).
const BAL = [
  { key: 'critical', color: '#d03b3b', icon: '●', label: '위험', hint: '마감 지남·임박' },
  { key: 'warning', color: '#fab219', icon: '▲', label: '주의', hint: '방치·무응답·앞 업무 지연' },
  { key: 'good', color: '#0ca30c', icon: '■', label: '순조', hint: '' },
];

function BalancePanel({ tasks, categories, settings, links, today }) {
  const [picked, setPicked] = useState(null);
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const rows = categories.map((c) => {
    const mine = tasks.filter((t) => t.category_id === c.id);
    const count = { critical: 0, warning: 0, good: 0 };
    let steps = 0;
    let doneSteps = 0;
    for (const t of mine) {
      const i = assess(t, today, settings.neglect_days, settings.waiting_days);
      const k = i.overdue || i.dueSoon ? 'critical'
        : (i.neglected || i.noReply || blockerDelayed(t.id, links, tasksById, today, settings)) ? 'warning' : 'good';
      count[k] += 1;
      steps += t.steps?.length ?? 0;
      doneSteps += t.steps?.filter((x) => x.done).length ?? 0;
    }
    return { c, total: mine.length, count, progress: steps ? Math.round((doneSteps / steps) * 100) : null };
  }).filter((r) => r.total > 0);
  const max = Math.max(...rows.map((r) => r.total), 1);

  // 한 줄 요약: 위험이 가장 많은 분류, 없으면 가장 바쁜 분류
  const worst = [...rows].sort((a, b) => b.count.critical - a.count.critical || b.total - a.total)[0];
  const summary = worst.count.critical > 0
    ? `${worst.c.name}에 급한 업무가 몰려 있어요 (${worst.total}건 중 ${worst.count.critical}건 위험).`
    : rows.length > 1 && worst.total >= 2 * Math.min(...rows.map((r) => r.total))
      ? `${worst.c.name} 업무가 가장 많아요 (${worst.total}건). 급한 건 없어요.`
      : '업무가 고르게 나뉘어 있고, 급한 업무는 없어요.';

  return (
    <details className="balance block" open>
      <summary><b>업무 밸런스</b> <span className="muted small">{summary}</span></summary>
      <ul className="bal-legend" aria-label="범례">
        {BAL.map((b) => (
          <li key={b.key}><span style={{ color: b.color }} aria-hidden="true">{b.icon}</span> {b.label}{b.hint && <span className="muted"> ({b.hint})</span>}</li>
        ))}
      </ul>
      <ul className="bal-rows">
        {rows.map((r) => (
          <li key={r.c.id}>
            <button
              type="button"
              className="bal-row"
              aria-expanded={picked === r.c.id}
              onClick={() => setPicked(picked === r.c.id ? null : r.c.id)}
            >
              <span className="bal-name"><span className="dot" style={{ background: r.c.color }} aria-hidden="true" />{r.c.name}</span>
              <span className="bal-track">
                <span className="bal-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                  {BAL.filter((b) => r.count[b.key] > 0).map((b) => (
                    <span
                      key={b.key}
                      className="bal-seg"
                      style={{ flexGrow: r.count[b.key], background: b.color }}
                      title={`${r.c.name} · ${b.label} ${r.count[b.key]}건`}
                    />
                  ))}
                </span>
                <span className="bal-value">{r.total}건</span>
              </span>
            </button>
            {picked === r.c.id && (
              <p className="bal-detail small">
                {BAL.map((b) => `${b.icon} ${b.label} ${r.count[b.key]}`).join(' · ')}
                {r.progress !== null && ` · 단계 진척 ${r.progress}%`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
