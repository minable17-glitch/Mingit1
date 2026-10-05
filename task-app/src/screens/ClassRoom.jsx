// 학급(담임): 조회·종례 전달사항, 출결, 학생 특이사항, 명렬표(구글 시트에서 복사해 붙여넣기).
// 학생 정보는 본인만 볼 수 있고 AI 채팅 커넥터로는 내보내지 않음.
import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { addDays, dueLabel, todayKST } from '../lib/date.js';
import Planner from './Planner.jsx';
import { ATT_REASONS, ATT_TYPES, daySummary, monthSummary, monthSummaryText, noticesText, parseRoster, reasonLabel, typeLabel } from '../lib/classroom.js';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const SECTIONS = [
  { key: 'planner', label: '📒 일지' },
  { key: 'morning', label: '☀️ 조회' },
  { key: 'closing', label: '🌙 종례' },
  { key: 'attendance', label: '✅ 출결' },
  { key: 'notes', label: '📝 특이사항' },
  { key: 'roster', label: '👥 명렬표' },
];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('아래 내용을 복사하세요', text);
    return false;
  }
}

export default function ClassRoom({ tasks, categories, settings }) {
  const today = todayKST();
  const [day, setDay] = useState(today);
  const [section, setSection] = useState(() => { try { return localStorage.getItem('task-keeper.class-section') || 'planner'; } catch { return 'morning'; } });
  const [data, setData] = useState(undefined); // undefined = 불러오는 중, null = 표 준비 전
  const month = day.slice(0, 7);

  const load = useCallback(async () => setData(await api.loadClassMonth(month)), [month]);
  useEffect(() => {
    let alive = true;
    api.loadClassMonth(month).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, [month]);
  const pick = (k) => { setSection(k); try { localStorage.setItem('task-keeper.class-section', k); } catch { /* 괜찮음 */ } };

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
    }
  };

  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  const students = data?.students ?? [];
  const needRoster = !students.length && (section === 'attendance' || section === 'notes');

  return (
    <section className="classroom">
      <header className="page-head"><h1>학급</h1></header>

      <div className="class-date">
        <button className="icon big" onClick={() => setDay(addDays(day, -1))} aria-label="전날">‹</button>
        <b>{Number(day.slice(5, 7))}월 {Number(day.slice(8))}일 ({DOW[dow]})</b>
        <button className="icon big" onClick={() => setDay(addDays(day, 1))} aria-label="다음 날">›</button>
        {day !== today && <button className="small" onClick={() => setDay(today)}>오늘</button>}
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="날짜 고르기" />
      </div>

      <div className="class-tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button key={s.key} role="tab" aria-selected={section === s.key} className={section === s.key ? 'on' : ''} onClick={() => pick(s.key)}>{s.label}</button>
        ))}
      </div>

      {data === undefined && <p className="muted">불러오는 중…</p>}
      {data === null && <p className="notice">학급 기능을 준비하는 중이에요. 잠시 뒤 다시 열어 주세요.</p>}
      {data && needRoster && (
        <div className="block">
          <p>먼저 <b>👥 명렬표</b>를 넣어 주세요. 구글 시트에서 번호·이름 칸을 복사해 붙여넣으면 돼요.</p>
          <button className="primary" onClick={() => pick('roster')}>명렬표 넣으러 가기</button>
        </div>
      )}
      {section === 'planner' && <Planner day={day} setDay={setDay} bell={settings?.bell_schedule ?? []} />}
      {data && !needRoster && (section === 'morning' || section === 'closing') && (
        <Notices kind={section} day={day} today={today} notices={data.notices} tasks={tasks} categories={categories} run={run} />
      )}
      {data && !needRoster && section === 'attendance' && <Attendance day={day} month={month} students={students} records={data.attendance} run={run} />}
      {data && !needRoster && section === 'notes' && <Notes day={day} students={students} notes={data.notes} run={run} />}
      {data && section === 'roster' && <Roster students={students} run={run} />}

      <p className="small muted privacy-line">🔒 학급 기록은 선생님 본인만 볼 수 있어요. 건강·가정사 같은 민감한 내용은 적지 말고, 학교의 개인정보 지침을 따라 주세요.</p>
    </section>
  );
}

// ── 조회·종례 전달사항 ─────────────────────
function Notices({ kind, day, today, notices, tasks, categories, run }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const list = notices.filter((n) => n.kind === kind && n.day === day).sort((a, b) => a.position - b.position);
  const nextPos = list.reduce((m, n) => Math.max(m, n.position + 1), 0);
  const label = kind === 'morning' ? '조회' : '종례';

  // 지난번(같은 달 안에서 가장 최근 날짜) 전달사항
  const earlier = [...new Set(notices.filter((n) => n.kind === kind && n.day < day).map((n) => n.day))].sort().at(-1);
  const prev = earlier ? notices.filter((n) => n.kind === kind && n.day === earlier) : [];

  // 담임 분류 업무 중 1주 안에 마감인 것 → 학생에게 전달할 거리 추천
  const homeroom = new Set(categories.filter((c) => /담임|학급/.test(c.name)).map((c) => c.id));
  const suggestions = tasks
    .filter((t) => homeroom.has(t.category_id) && t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7))
    .filter((t) => !list.some((n) => n.body.includes(t.title)))
    .slice(0, 5);

  const add = (body) => run(() => api.addNotice({ day, kind, body, position: nextPos }));

  return (
    <div className="block stack">
      <div className="row">
        <h2 className="grow">{label} 전달사항</h2>
        {list.length > 0 && <button className="small" onClick={async () => { await copyText(noticesText(notices, kind, day)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '복사됨 ✓' : '📋 복사'}</button>}
      </div>
      {list.length > 0 ? (
        <ol className="notice-list">
          {list.map((n) => (
            <li key={n.id} className={n.done ? 'done' : ''}>
              <input type="checkbox" checked={n.done} onChange={() => run(() => api.updateNotice(n.id, { done: !n.done }))} aria-label="전달함" />
              <span className="grow">{n.body}</span>
              <button className="icon" onClick={() => run(() => api.deleteNotice(n.id))} aria-label="지우기">×</button>
            </li>
          ))}
        </ol>
      ) : <p className="small muted">아직 {label} 전달사항이 없어요.</p>}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { add(text); setText(''); } }}>
        <input className="grow" placeholder={`${label}에 전할 말 (예: 체험학습 신청서 금요일까지)`} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!text.trim()}>추가</button>
      </form>
      {prev.length > 0 && list.length === 0 && (
        <button className="link small" onClick={() => run(() => Promise.all(prev.map((n, i) => api.addNotice({ day, kind, body: n.body, position: i }))))}>
          ↩ {Number(earlier.slice(5, 7))}/{Number(earlier.slice(8))} {label} 전달사항 {prev.length}개 가져오기
        </button>
      )}
      {suggestions.length > 0 && (
        <div className="suggest">
          <p className="small muted">담임 업무 중 곧 마감인 것 — 눌러서 전달사항에 넣기</p>
          <div className="row wrap">
            {suggestions.map((t) => (
              <button key={t.id} className="chip" onClick={() => add(`${t.title} (${dueLabel(t.due_date, today)})`)}>＋ {t.title} <span className="muted small">{dueLabel(t.due_date, today)}</span></button>
            ))}
          </div>
        </div>
      )}
      <p className="small muted">체크 = 학생들에게 전달함. 📋 복사로 칠판·메신저에 붙여넣을 수 있어요.</p>
    </div>
  );
}

// ── 출결 ──────────────────────────────
function Attendance({ day, month, students, records, run }) {
  const [editing, setEditing] = useState(null); // student id
  const [form, setForm] = useState({ type: 'absent', reason: 'sick', memo: '' });
  const [copied, setCopied] = useState(false);
  const active = students.filter((s) => s.active);
  const sum = daySummary(students, records, day);
  const monthly = monthSummary(students, records, month);

  function open(s) {
    setEditing(editing === s.id ? null : s.id);
    setForm({ type: 'absent', reason: 'sick', memo: '' });
  }

  return (
    <>
      <div className="block stack">
        <div className="att-summary">
          <span>재적 <b>{sum.enrolled}</b></span>
          <span>출석 <b>{sum.enrolled - sum.absent}</b></span>
          {ATT_TYPES.map((t) => <span key={t.key} className={sum[t.key] ? 'has' : ''}>{t.label} <b>{sum[t.key]}</b></span>)}
        </div>
        <ul className="att-list">
          {active.map((s) => {
            const mine = records.filter((r) => r.student_id === s.id && r.day === day);
            return (
              <li key={s.id} className={mine.length ? 'marked' : ''}>
                <button className="att-row" onClick={() => open(s)} aria-expanded={editing === s.id}>
                  <span className="att-num">{s.number}</span>
                  <span className="grow">{s.name}</span>
                  {mine.map((r) => <span key={r.id} className={`att-tag t-${r.type}`}>{reasonLabel(r.reason)}{typeLabel(r.type)}</span>)}
                  {!mine.length && <span className="small muted">출석</span>}
                </button>
                {editing === s.id && (
                  <div className="att-edit stack">
                    {mine.map((r) => (
                      <div key={r.id} className="row small">
                        <span className="grow">{reasonLabel(r.reason)}{typeLabel(r.type)}{r.memo ? ` · ${r.memo}` : ''}</span>
                        <button className="link" onClick={() => run(() => api.clearAttendance(r.id))}>지우기</button>
                      </div>
                    ))}
                    <div className="row wrap">
                      {ATT_TYPES.map((t) => <button key={t.key} type="button" className={form.type === t.key ? 'chip on' : 'chip'} onClick={() => setForm({ ...form, type: t.key })}>{t.label}</button>)}
                    </div>
                    <div className="row wrap">
                      {ATT_REASONS.map((r) => <button key={r.key} type="button" className={form.reason === r.key ? 'chip on' : 'chip'} onClick={() => setForm({ ...form, reason: r.key })}>{r.label}</button>)}
                    </div>
                    <div className="row">
                      <input className="grow" placeholder="메모 (선택, 예: 체험학습)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
                      <button className="primary" onClick={() => run(async () => { await api.setAttendance({ studentId: s.id, day, ...form }); setEditing(null); })}>저장</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="small muted">이름을 누르면 결석·지각·조퇴·결과와 사유를 적을 수 있어요. 아무것도 없으면 출석이에요.</p>
      </div>

      <details className="block">
        <summary><b>📊 {Number(month.slice(5))}월 출결 요약</b> <span className="small muted">{monthly.length ? `${monthly.length}명 기록 있음` : '특이 없음'}</span></summary>
        {monthly.length > 0 && (
          <ul className="month-att">
            {monthly.map(({ student, list }) => (
              <li key={student.id}>
                <b>{student.number}번 {student.name}</b>
                <span className="small"> {list.map((r) => `${Number(r.day.slice(8))}일 ${reasonLabel(r.reason)}${typeLabel(r.type)}${r.memo ? `(${r.memo})` : ''}`).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
        <button className="small" onClick={async () => { await copyText(monthSummaryText(monthly, month)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? '복사됨 ✓' : '📋 요약 복사'}</button>
        <p className="small muted">월말 출결 마감 때 나이스 입력 내용과 맞춰 보세요.</p>
      </details>
    </>
  );
}

// ── 학생 특이사항 ───────────────────────────
function Notes({ day, students, notes, run }) {
  const [studentId, setStudentId] = useState('');
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const shown = notes.filter((n) => !filter || n.student_id === filter);

  return (
    <div className="block stack">
      <h2>학생 특이사항</h2>
      <div className="row wrap">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="학생">
          <option value="">학생 고르기</option>
          {students.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.number}번 {s.name}</option>)}
        </select>
        <input className="grow" placeholder="관찰·상담·칭찬 등 (예: 모둠활동에서 친구를 잘 도움)" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary" disabled={!studentId || !text.trim()} onClick={() => run(async () => { await api.addClassNote({ studentId, day, body: text }); setText(''); })}>저장</button>
      </div>
      <p className="small muted">고른 날짜({Number(day.slice(5, 7))}/{Number(day.slice(8))})로 저장돼요. 학생부·상담 기록 쓸 때 모아 볼 수 있어요.</p>

      <div className="row wrap">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="학생별 보기">
          <option value="">전체 학생</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.number}번 {s.name}{s.active ? '' : ' (전출)'}</option>)}
        </select>
        <span className="small muted">{shown.length}개</span>
      </div>
      {shown.length === 0 ? <p className="small muted">아직 적은 특이사항이 없어요.</p> : (
        <ul className="note-list">
          {shown.map((n) => (
            <li key={n.id}>
              <span className="note-date">{Number(n.day.slice(5, 7))}/{Number(n.day.slice(8))}</span>
              <span className="grow"><b>{byId[n.student_id] ? `${byId[n.student_id].number}번 ${byId[n.student_id].name}` : '—'}</b> {n.body}</span>
              <button className="icon" onClick={() => confirm('이 특이사항을 지울까요?') && run(() => api.deleteClassNote(n.id))} aria-label="지우기">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 명렬표 ───────────────────────────────
function Roster({ students, run }) {
  const [paste, setPaste] = useState('');
  const [adding, setAdding] = useState({ number: '', name: '' });
  const parsed = paste.trim() ? parseRoster(paste) : [];

  return (
    <>
      <div className="block stack">
        <h2>명렬표 넣기</h2>
        <ol className="small howto">
          <li>구글 시트(또는 엑셀)에서 <b>번호와 이름 칸</b>을 드래그해 선택하고 복사(Ctrl+C)</li>
          <li>아래 칸에 붙여넣기(Ctrl+V). 학번(10203)이어도 끝 두 자리를 번호로 읽어요.</li>
        </ol>
        <textarea rows={5} placeholder={'번호\t이름\n1\t김하늘\n2\t이바다'} value={paste} onChange={(e) => setPaste(e.target.value)} />
        {parsed.length > 0 && (
          <>
            <p className="small"><b>{parsed.length}명</b>을 읽었어요: {parsed.slice(0, 5).map((s) => `${s.number}번 ${s.name}`).join(', ')}{parsed.length > 5 ? ' …' : ''}</p>
            <div className="row wrap">
              <button className="primary" onClick={() => {
                if (students.length && !confirm(`지금 명렬표(${students.length}명)와 그 학생들의 출결·특이사항을 지우고 새 명렬표로 바꿀까요?`)) return;
                run(async () => { await api.saveRoster(parsed, { replace: true }); setPaste(''); });
              }}>{students.length ? '새 명렬표로 바꾸기' : '명렬표 저장'}</button>
              {students.length > 0 && <button onClick={() => run(async () => { await api.saveRoster(parsed); setPaste(''); })}>지금 명렬표에 추가</button>}
            </div>
          </>
        )}
        {paste.trim() && !parsed.length && <p className="small warn">이름을 찾지 못했어요. 번호와 이름 칸을 같이 복사했는지 확인해 주세요.</p>}
      </div>

      {students.length > 0 && (
        <div className="block stack">
          <h2>우리 반 {students.filter((s) => s.active).length}명</h2>
          <ul className="roster-list">
            {students.map((s) => (
              <li key={s.id} className={s.active ? '' : 'inactive'}>
                <span className="att-num">{s.number}</span>
                <span className="grow">{s.name}{s.active ? '' : ' (전출)'}</span>
                <button className="link small" onClick={() => {
                  const name = prompt('이름 고치기', s.name);
                  if (name?.trim()) run(() => api.updateStudent(s.id, { name: name.trim() }));
                }}>고치기</button>
                <button className="link small" onClick={() => run(() => api.updateStudent(s.id, { active: !s.active }))}>{s.active ? '전출' : '되돌리기'}</button>
              </li>
            ))}
          </ul>
          <div className="row">
            <input style={{ width: '4.5em' }} inputMode="numeric" placeholder="번호" value={adding.number} onChange={(e) => setAdding({ ...adding, number: e.target.value.replace(/\D/g, '') })} />
            <input className="grow" placeholder="전입생 이름" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
            <button disabled={!adding.number || !adding.name.trim()} onClick={() => run(async () => { await api.saveRoster([{ number: Number(adding.number), name: adding.name }]); setAdding({ number: '', name: '' }); })}>추가</button>
          </div>
          <button className="link small danger-text" onClick={() => {
            if (!confirm('학급 기록(명렬표·출결·특이사항·전달사항)을 모두 지울까요? 되돌릴 수 없어요. 학년이 바뀔 때 쓰세요.')) return;
            run(() => api.clearClassData());
          }}>학년말 정리: 학급 기록 모두 지우기</button>
        </div>
      )}
    </>
  );
}
