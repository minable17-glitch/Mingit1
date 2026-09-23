import { useState } from 'react';
import * as api from '../lib/api.js';
import { sortForBriefing } from '../lib/briefing.js';
import { dueLabel, formatShort, todayKST } from '../lib/date.js';
import { freeSlotNow, kstClock } from '../lib/timetable.js';

export default function Briefing({
  tasks, categories, categoryById, settings, templates, inboxCount, reload, onOpen, onOpenScreen,
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
        <SpareTime slot={slot} tasks={tasks} categoryById={categoryById} settings={settings} onOpen={onOpen} />
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
                <TaskList rows={items} categoryById={categoryById} today={today} onOpen={onOpen} />
              </div>
            ))
        : <TaskList rows={rows} categoryById={categoryById} today={today} onOpen={onOpen} />}
    </section>
  );
}

function TaskList({ rows, categoryById, today, onOpen }) {
  return (
    <ul className="task-list">
      {rows.map(({ task, info }) => {
        const cat = categoryById[task.category_id];
        const total = task.steps?.length ?? 0;
        const done = task.steps?.filter((s) => s.done).length ?? 0;
        return (
          <li key={task.id} className="task-row" style={{ '--c': cat?.color }} onClick={() => onOpen(task.id)}>
            <div className="row-top">
              <span className="title">{task.title}</span>
              {info.due && (
                <span className={info.overdue ? 'badge danger' : info.dueSoon ? 'badge warn' : 'badge'}>
                  {dueLabel(info.due, today)}
                </span>
              )}
              {info.noReply && <span className="badge stale">{info.waitDays}일 무응답</span>}
              {info.neglected && <span className="badge stale">{info.idle}일 방치</span>}
            </div>
            {task.waiting_on
              ? <div className="next waiting">⏳ {task.waiting_on} 기다리는 중</div>
              : <div className="next">→ {task.next_action}</div>}
            {task.latest_note && <div className="note">📝 {task.latest_note}</div>}
            {total > 0 && (
              <div className="progress"><span style={{ width: `${(done / total) * 100}%` }} /></div>
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
  { key: 'doc', label: '공문 붙여넣기' },
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
      if (template) await api.createFromTemplate(template, { title, categoryId: catId, dueDate });
      else await api.createTask({ title, categoryId: catId, dueDate });
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

const ATTACH_LABEL = { step: '단계로 추가', note: '메모로 남기기', next_action: '다음 행동으로' };

function ThrowIn({ tasks, categories, categoryById, settings, onAdded }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState(null);

  async function ask(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const briefs = tasks.map((t) => api.briefTask(t, categoryById, settings));
      setProposal(await api.triage(text.trim(), briefs, categories));
    } catch (err) {
      alert(`AI가 판단하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      await api.applyTriage(proposal, tasks, categories);
      setProposal(null);
      setText('');
      await onAdded();
    } catch (err) {
      alert(`반영하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const target = proposal?.kind === 'attach' ? tasks.find((t) => t.id === proposal.task_id) : null;

  return (
    <div className="stack">
      <form className="quick-add" onSubmit={ask}>
        <input
          className="grow"
          placeholder="떠오른 걸 그냥 적으세요 (예: 교감샘이 운영비 영수증 금요일까지 달래)"
          value={text}
          onChange={(e) => { setText(e.target.value); setProposal(null); }}
        />
        <button className="primary" disabled={busy || !text.trim()}>{busy && !proposal ? '생각 중…' : 'AI에게 맡기기'}</button>
      </form>
      {proposal && (
        <div className="proposal">
          {target ? (
            <p>
              <b>{target.title}</b>에 <b>{ATTACH_LABEL[proposal.attach_as] ?? '메모로 남기기'}</b>:
              <br />“{proposal.content}”
            </p>
          ) : (
            <p>
              새 업무 <b>{proposal.new_title || proposal.content}</b>
              {proposal.category_name && ` · ${proposal.category_name}`}
              {proposal.due_date && ` · 마감 ${proposal.due_date}`}
              {proposal.content && <><br />→ {proposal.content}</>}
            </p>
          )}
          <p className="muted small">{proposal.reason}</p>
          <div className="row">
            <button className="primary" disabled={busy} onClick={confirm}>이대로 반영</button>
            <button className="link" onClick={() => setProposal(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasteDocument({ categories, onOpenScreen }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function analyze() {
    setBusy(true);
    try {
      const ex = await api.extractDocument(text, categories);
      if (!ex.is_task) {
        alert('이 문서에서는 할 일을 찾지 못했어요. 필요하면 “새 업무”로 직접 등록하세요.');
        return;
      }
      onOpenScreen({ type: 'draft', draft: api.draftFromExtraction(ex, categories), source: '공문' });
      setText('');
    } catch (err) {
      alert(`분석하지 못했어요: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <textarea
        rows={5}
        placeholder="공문 본문을 그대로 붙여넣으세요. AI가 기한·제출물·단계를 뽑아 업무 초안을 만들어요."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="primary" disabled={busy || text.trim().length < 20} onClick={analyze}>
        {busy ? '읽는 중…' : '업무로 만들기'}
      </button>
    </div>
  );
}

// ── 짜투리 모드 ─────────────────────────────

function SpareTime({ slot, tasks, categoryById, settings, onOpen }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));

  async function recommend() {
    setBusy(true);
    try {
      const briefs = tasks.map((t) => api.briefTask(t, categoryById, settings));
      const res = await api.smallActions(slot.minutesLeft, briefs);
      setItems(res.items.filter((i) => byId[i.task_id]));
    } catch {
      // AI가 안 되면 급한 업무의 다음 행동을 그대로 보여줌
      setItems(tasks.slice(0, 3).map((t) => ({ task_id: t.id, action: t.next_action, minutes: null })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="banner static">
      <div className="row">
        <span className="grow">☕ 지금 {slot.period}교시 공강 · <b>{slot.minutesLeft}분</b> 남음</span>
        {!items && <button disabled={busy} onClick={recommend}>{busy ? '고르는 중…' : '작은 행동 추천'}</button>}
      </div>
      {items && (
        <ul className="spare-list">
          {items.map((i, n) => (
            <li key={n} onClick={() => onOpen(i.task_id)}>
              <span>{i.action}</span>
              <span className="muted small"> · {byId[i.task_id]?.title}{i.minutes ? ` · ${i.minutes}분` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
