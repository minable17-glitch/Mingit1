import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { sortForBriefing } from '../lib/briefing.js';
import { dueLabel, todayKST } from '../lib/date.js';
import { freeSlotNow, kstClock } from '../lib/timetable.js';
import { pickDeadline } from '../lib/rules.js';
import { extractFromLongText, isLongText } from '../lib/notice.js';
import { principleOfDay } from '../lib/thoughts.js';
import TodayCard from './TodayCard.jsx';
import { buildToday, isDayItem } from '../lib/today.js';
import { ThrowBox, ThrowIn } from './ThrowBox.jsx';
import DropOverlay from './DropOverlay.jsx';
import { nameCapture } from '../lib/files.js';

// 브리핑(첫 화면): "오늘 뭘 해야 하지?"에만 집중.
//  위에서부터 ① 오늘·지난 마감(최대 5개) ② 오늘 할 일(+다음 공강) — 그 위엔 한 줄 숫자와 한 줄 알림만.
//  새 업무·던져넣기는 + 버튼 시트로, 진행 중인 업무 전체와 업무 밸런스는 '한눈에' 탭으로.
const DUE_SHOWN = 5;

export default function Briefing({
  tasks, categories, categoryById, settings, templates, inboxCount, reload, onOpen, onOpenScreen, onTab, reminders = [], thoughts = [], todayItems = [], throwItems = [], showClass = true,
}) {
  const today = todayKST();
  const [sheet, setSheet] = useState(null); // null | 'new' | 'throw' : + 버튼으로 여는 입력 시트
  const [files, setFiles] = useState([]); // 던져넣기에 같이 담을 파일
  const [allDue, setAllDue] = useState(false);

  const all = sortForBriefing(tasks, today, settings.neglect_days, settings.waiting_days);
  const counts = all.reduce(
    (acc, { info }) => {
      if (info.overdue || info.dueSoon) acc.due += 1;
      if (info.neglected) acc.neglected += 1;
      if (info.noReply) acc.noReply += 1;
      return acc;
    },
    { due: 0, neglected: 0, noReply: 0 },
  );
  const due = buildToday(tasks, reminders, (todayItems ?? []).filter(isDayItem), today).due;

  const isFriday = kstClock().weekday === 5;
  const slot = freeSlotNow(settings.bell_schedule, settings.timetable);
  // 지금 공강에 하기로 계획해 둔 오늘 할 일
  const plannedNow = slot ? (todayItems ?? []).filter((i) => i.day === today && isDayItem(i) && Number(i.period) === Number(slot.period)) : [];
  const principle = principleOfDay(thoughts ?? [], today);

  // 화면 어디에든 파일을 끌어다 놓으면 던져넣기 시트를 열고 파일을 담아 둠
  const dropIn = (list) => { setFiles((f) => [...f, ...list.map((x) => nameCapture(x))]); setSheet('throw'); };

  return (
    <section className="briefing">
      <DropOverlay label="놓으면 던져넣기에 담겨요" hint="글을 덧붙인 뒤 ‘던지기’를 누르세요" onFiles={dropIn} />
      <header className="brief-head">
        <div className="grow">
          <span className="hero-date">{longDate(today)}</span>
          <h1>오늘</h1>
        </div>
        <button className="primary add-btn" onClick={() => setSheet('new')} aria-label="새 업무·던져넣기">＋ 추가</button>
      </header>
      {principle && <p className="brief-principle">{principle.body}</p>}

      <button className="stat-line" onClick={() => onTab?.('balance')} aria-label="업무 숫자 자세히 (한눈에)">
        <span>진행 <b>{tasks.length}</b></span>
        <span className={counts.due ? 'hot' : ''}>임박 <b>{counts.due}</b></span>
        <span>방치 <b>{counts.neglected}</b></span>
        {counts.noReply > 0 && <span>무응답 <b>{counts.noReply}</b></span>}
        <span className="grow" />
        <span className="muted">전체 보기 ›</span>
      </button>

      <PrivacyNotice />
      {inboxCount > 0 && <button className="line-note" onClick={() => onOpenScreen({ type: 'inbox' })}><span className="grow">메일에서 온 업무 제안 {inboxCount}건</span><span aria-hidden="true">›</span></button>}
      {isFriday && <button className="line-note" onClick={() => onOpenScreen({ type: 'review' })}><span className="grow">금요일이에요. 5분 주간 회고 하기</span><span aria-hidden="true">›</span></button>}
      {slot && (tasks.length > 0 || plannedNow.length > 0) && (
        <SpareTime slot={slot} tasks={tasks} settings={settings} onOpen={onOpen} planned={plannedNow} reload={reload} />
      )}
      <ThrowBox items={throwItems} tasks={tasks} categories={categories} todayItems={todayItems} showClass={showClass} reload={reload} onOpenScreen={onOpenScreen} />

      <section className="block due-card">
        <div className="card-head">
          <h2>마감</h2>
          <span className="small muted">오늘 · 지난 마감</span>
        </div>
        {due.length === 0 ? <p className="small muted">오늘 마감이나 지난 마감이 없어요.</p> : (
          <ul className="due-list">
            {(allDue ? due : due.slice(0, DUE_SHOWN)).map((d) => (
              <li key={d.key}>
                <button className="due-row" onClick={() => onOpen(d.task.id)}>
                  <span className="grow">
                    <b>{d.step ? d.step.title : d.task.title}</b>
                    <span className="small muted">{d.step ? d.task.title : (d.task.waiting_on ? `${d.task.waiting_on} 기다리는 중` : d.task.next_action)}</span>
                  </span>
                  <span className={d.overdue ? 'due-label hot' : 'due-label'}>{dueLabel(d.date, today).replace(' 마감', '')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {due.length > DUE_SHOWN && <button className="link small" onClick={() => setAllDue(!allDue)}>{allDue ? '접기' : `${due.length - DUE_SHOWN}개 더 보기`}</button>}
      </section>

      <TodayCard tasks={tasks} reminders={reminders} items={todayItems} today={today} settings={settings} reload={reload} onOpen={onOpen} onOpenTimetable={() => onOpenScreen({ type: 'timetable' })} showDue={false} />

      <button className="link more-link" onClick={() => onTab?.('balance')}>진행 중인 업무 {tasks.length}개 모두 보기 ›</button>

      {sheet && (
        <AddSheet onClose={() => setSheet(null)}>
          <InputArea
            mode={sheet} setMode={setSheet} files={files} setFiles={setFiles}
            tasks={tasks} categories={categories} categoryById={categoryById} settings={settings} templates={templates}
            onAdded={async () => { await reload(); setSheet(null); }}
            onOpenScreen={(o) => { setSheet(null); onOpenScreen(o); }}
          />
        </AddSheet>
      )}
    </section>
  );
}

// 아래에서 올라오는 입력 시트 (바깥 누르거나 Esc 로 닫기)
function AddSheet({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="새로 넣기" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        {children}
        <button className="link sheet-close" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}

// "11월 2일 월요일"
function longDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  const wd = '일월화수목금토'[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}월 ${day}일 ${wd}요일`;
}

// ── 입력: 새 업무 / 던져넣기 (긴 공문을 새 업무 칸에 붙여넣으면 초안 화면으로) ─────────────

const MODES = [
  { key: 'new', label: '새 업무' },
  { key: 'throw', label: '던져넣기' },
];

function InputArea({ mode, setMode, files, setFiles, ...props }) {
  return (
    <div className="input-area">
      <div className="seg" role="tablist">
        {MODES.map((m) => (
          <button key={m.key} role="tab" aria-selected={mode === m.key} className={mode === m.key ? 'on' : ''} onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
      </div>
      {mode === 'new' && <QuickAdd {...props} />}
      {mode === 'throw' && <ThrowIn settings={props.settings} onAdded={props.onAdded} files={files} setFiles={setFiles} />}
    </div>
  );
}

function QuickAdd({ categories, templates, onAdded, onOpenScreen }) {
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
    // 안내문 등 긴 글을 붙여넣었으면 통째로 이름이 되지 않게 정리 화면으로
    if (isLongText(title) && !template) {
      openLongText(title, categories, onOpenScreen);
      setTitle('');
      return;
    }
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

// 긴 글 → 업무 초안 화면 (짧은 이름·기한·단계, 원문은 메모)
function openLongText(text, categories, onOpenScreen, options, categoryId) {
  const { draft, source } = extractFromLongText(text, categories, todayKST(), options);
  if (categoryId) draft.category_id = categoryId;
  onOpenScreen({ type: 'draft', draft, source, sourceText: text });
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

function SpareTime({ slot, tasks, settings, onOpen, planned = [], reload }) {
  const [items, setItems] = useState(null);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const toggle = async (i) => {
    try { await api.updateTodayItem(i.id, { done: !i.done }); await reload(); } catch (e) { alert(`저장하지 못했어요: ${e.message}`); }
  };

  return (
    <div className="line-note now-note">
      <div className="row">
        <span className="grow">지금 <b>{slot.period}교시 공강</b> · {slot.minutesLeft}분 남음</span>
        {!items && tasks.length > 0 && <button className="link" onClick={() => setItems(spareSuggestions(tasks, settings))}>{planned.length ? '다른 할 일' : '할 일 추천'}</button>}
      </div>
      {planned.length > 0 && (
        <ul className="spare-planned">
          <li className="small muted">이 시간에 하기로 한 일</li>
          {planned.map((i) => (
            <li key={i.id} className={i.done ? 'done' : ''}>
              <label><input type="checkbox" checked={i.done} onChange={() => toggle(i)} /> {i.title}</label>
            </li>
          ))}
        </ul>
      )}
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

// 처음 쓸 때 한 번: 학생 개인정보 입력 금지 안내 (확인하면 이 기기에서 다시 안 보임 · 설정 → 계정에서 다시 볼 수 있음)
function PrivacyNotice() {
  const KEY = 'tk-privacy-notice-dismissed';
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <div className="line-note warn-note">
      <span className="grow">업무에는 학생 개인정보를 적지 마세요. 학생 기록은 학급 탭(본인만)에.</span>
      <button className="link" onClick={() => { try { localStorage.setItem(KEY, '1'); } catch { /* 저장 안 돼도 이번엔 닫기 */ } setHidden(true); }}>확인</button>
    </div>
  );
}

