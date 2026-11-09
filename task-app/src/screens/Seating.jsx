// 🪑 자리 배치 (학급): 선생님이 쓰던 '스마트 자리 배치 프로그램'을 옮겨 옴.
// - 배치: 행·열, 앞자리부터 채우기, 과거 기록 반영(많이 앉았던 자리 피하기), 떨어트릴 학생(앞뒤·옆·대각선),
//         두 자리 눌러 맞바꾸기, 저장 및 기록, 구글 시트로 복사, 인쇄
// - 학생별 기록: 저장된 배치에서 어느 자리에 몇 번 앉았는지
// - 저장된 기록: 이름 바꾸기·지우기·다시 쓰기
// - 선생님만: Alt+S(폰은 제목을 세 번 톡톡)로 설정 감추기/보이기, Ctrl+‘자리 배치하기’로 비밀 지정석 불러오기, 백업 내보내기·열기
// 계정에 저장(본인만 보기)되어 어느 기기에서나 같고, AI 커넥터로는 나가지 않음.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { CleaningView, RolesView, SeatSheetView } from './ClassDuty.jsx';
import { arrangeSeats, normalizeSeating, parseAvoid, parseNames, seatHistory, seatKey, swapSeats, toBackup, toSheetText } from '../lib/seating.js';

const VIEWS = [['make', '🔄 배치'], ['sheet', '📄 자리배치표'], ['roles', '🙋 1인 1역'], ['clean', '🧹 청소 당번'], ['history', '📊 학생별 기록'], ['saved', '🔖 저장된 기록']];
const nowLabel = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Seating({ students: roster = [] }) {
  const [s, setS] = useState(null); // null = 불러오는 중, false = 표 준비 전
  // 마지막으로 연 칸(배치·자리배치표·1인 1역·청소 당번 …)을 이 기기에 기억
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('task-keeper.seat-view') || 'make'; } catch { return 'make'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem('task-keeper.seat-view', v); } catch { /* 괜찮음 */ } };
  const [teacher, setTeacher] = useState(false); // 선생님 설정(떨어트릴 학생·비밀 지정석·백업) 보이기
  const [swapFrom, setSwapFrom] = useState(null);
  const [toast, setToast] = useState(null);
  const taps = useRef([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    api.loadSeating().then((d) => { if (alive) setS(d === null ? false : normalizeSeating(d)); });
    return () => { alive = false; };
  }, []);

  // 바꿀 때마다 잠깐 뒤 계정에 저장 (연달아 바꾸면 마지막 것만)
  const update = (patch) => setS((prev) => {
    const next = { ...prev, ...patch };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api.saveSeating(next).catch((e) => say(`저장하지 못했어요: ${e.message}`, true)), 500);
    return next;
  });
  const say = (msg, err = false) => { setToast({ msg, err }); setTimeout(() => setToast(null), 2600); };

  // Alt+S: 선생님 설정 감추기/보이기
  useEffect(() => {
    const onKey = (e) => { if (e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); setTeacher((t) => !t); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 폰: 제목을 1초 안에 세 번 누르면
  const tapTitle = () => {
    const t = Date.now();
    taps.current = [...taps.current.filter((x) => t - x < 1000), t];
    if (taps.current.length >= 3) { taps.current = []; setTeacher((v) => !v); }
  };

  const history = useMemo(() => (s ? seatHistory(s.records) : {}), [s]);

  if (s === null) return <p className="muted">불러오는 중…</p>;
  if (s === false) return <p className="notice">자리 배치를 준비하는 중이에요. 잠시 뒤 다시 열어 주세요.</p>;

  const names = parseNames(s.students);
  const rosterNames = roster.filter((x) => x.active !== false).sort((a, b) => a.number - b.number).map((x) => x.name);

  function generate(e) {
    if ((e?.ctrlKey || e?.metaKey) && s.secret) {
      update({ current: s.secret.map((row) => [...row]) });
      setSwapFrom(null);
      say('자리 배치가 완료되었습니다.'); // 비밀 지정석이라도 화면엔 똑같이
      return;
    }
    if (!names.length) return say('학생 이름을 넣어 주세요. (명렬표에서 불러오기)', true);
    if (names.length > s.rows * s.cols) return say(`학생(${names.length}명)이 자리(${s.rows * s.cols}개)보다 많아요.`, true);
    const grid = arrangeSeats({ students: names, rows: s.rows, cols: s.cols, avoid: parseAvoid(s.avoid), fillFront: s.fillFront, history: s.useHistory ? history : null });
    if (!grid) return say('조건(떨어트리기·과거 기록)이 너무 까다로워 배치를 못 했어요. 조건을 줄여 보세요.', true);
    update({ current: grid });
    setSwapFrom(null);
    say('자리 배치가 완료되었습니다.');
  }

  function clickSeat(r, c) {
    if (!s.current) return;
    if (!swapFrom) return setSwapFrom({ r, c });
    if (swapFrom.r === r && swapFrom.c === c) return setSwapFrom(null);
    update({ current: swapSeats(s.current, swapFrom, { r, c }) });
    setSwapFrom(null);
  }

  function saveRecord() {
    if (!s.current) return;
    const rec = { id: Date.now(), title: '', date: nowLabel(), rows: s.current.length, cols: s.current[0]?.length ?? 0, grid: s.current };
    update({ records: [rec, ...s.records] });
    say('현재 배치를 저장했어요. 다음 배치 때 기록으로 쓰여요.');
  }

  async function copySheet(grid) {
    try { await navigator.clipboard.writeText(toSheetText(grid)); say('복사했어요. 구글 시트에서 칸 하나 누르고 Ctrl+V'); } catch { window.prompt('아래 내용을 복사하세요', toSheetText(grid)); }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(toBackup(s), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `자리배치_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackup(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = normalizeSeating(JSON.parse(String(reader.result).replace(/^﻿/, '')));
        if (!confirm(`백업을 불러올까요? 저장된 기록 ${d.records.length}개가 들어 있어요. 지금 내용은 이걸로 바뀌어요.`)) return;
        update(d);
        say('백업을 불러왔어요.');
      } catch (err) { say(`백업 파일을 읽지 못했어요 (${err.message})`, true); }
    };
    reader.readAsText(file);
  }

  return (
    <div className="seating">
      {toast && <div className={`seat-toast${toast.err ? ' err' : ''}`} role="status">{toast.err ? '⚠️' : '✅'} {toast.msg}</div>}
      <div className="chips scroll-x seat-views" role="tablist">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'chip on' : 'chip'} onClick={() => setView(k)}>{l}</button>)}
      </div>

      {view === 'sheet' && <SeatSheetView s={s} update={update} roster={roster} say={say} />}
      {view === 'roles' && <RolesView s={s} update={update} roster={roster} say={say} />}
      {view === 'clean' && <CleaningView s={s} update={update} roster={roster} say={say} />}

      {view === 'make' && (
        <div className="seat-layout">
          <div className="block seat-settings">
            <h2 onClick={tapTitle}>배치 설정</h2>
            <div className="row">
              <NumField label="행(세로 줄)" value={s.rows} onChange={(rows) => update({ rows })} />
              <NumField label="열(가로 줄)" value={s.cols} onChange={(cols) => update({ cols })} />
            </div>
            <label className="row"><input type="checkbox" checked={s.fillFront} onChange={(e) => update({ fillFront: e.target.checked })} /> 앞자리(칠판 쪽)부터 채우기</label>
            <label className="row"><input type="checkbox" checked={s.useHistory} onChange={(e) => update({ useHistory: e.target.checked })} /> 과거 기록 반영 (많이 앉았던 자리 피하기)</label>
            <div className="row seat-names-head">
              <b className="grow">학생 명단 <span className="muted small">{names.length}명 · 자리 {s.rows * s.cols}개</span></b>
              {rosterNames.length > 0 && <button className="small" onClick={() => update({ students: rosterNames.join(', ') })}>👥 명렬표에서 불러오기</button>}
            </div>
            <textarea rows={4} value={s.students} onChange={(e) => update({ students: e.target.value })} placeholder="쉼표(,)나 띄어쓰기로 구분. 결석한 학생은 빼고 배치할 수 있어요." />
            {teacher && (
              <div className="seat-teacher">
                <b>🚫 떨어트려야 하는 학생 <span className="muted small">(한 줄에 한 묶음)</span></b>
                <textarea rows={3} value={s.avoid} onChange={(e) => update({ avoid: e.target.value })} placeholder={'김민석, 이철수\n박영희, 홍길동'} />
                <p className="small muted">💡 <kbd>Alt+S</kbd>(폰은 ‘배치 설정’ 제목 세 번 톡톡)로 이 칸을 감추고 보여요. <kbd>Ctrl</kbd>을 누른 채 ‘자리 배치하기’를 누르면 비밀 지정석이 나와요.</p>
              </div>
            )}
            <div className="stack seat-actions">
              <button className="primary" onClick={generate}>🔲 자리 배치하기</button>
              <button className="primary success" disabled={!s.current} onClick={saveRecord}>💾 현재 배치 저장 및 기록</button>
              {teacher && (
                <>
                  <button disabled={!s.current} onClick={() => { update({ secret: s.current.map((row) => [...row]) }); say('비밀 지정석으로 숨겨 두었어요.'); }}>🙈 비밀 지정석으로 몰래 저장</button>
                  {s.secret && <button className="link small" onClick={() => generate({ ctrlKey: true })}>비밀 지정석 불러오기</button>}
                  <div className="row">
                    <button className="grow small" onClick={exportBackup}>📥 백업 내보내기</button>
                    <label className="grow small button-like">📤 백업 열기<input type="file" accept=".json,application/json" hidden onChange={importBackup} /></label>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="block seat-board">
            {s.current && (
              <div className="seat-bar">
                <span className="small muted grow">↔️ 학생을 누른 뒤 바꿀 자리를 누르세요.</span>
                {swapFrom && <button className="small" onClick={() => setSwapFrom(null)}>선택 취소</button>}
                <button className="small" onClick={() => copySheet(s.current)}>📋 시트로 복사</button>
                <button className="small primary" onClick={() => setView('sheet')}>📄 자리배치표 만들기</button>
              </div>
            )}
            <div className="print-area">
              <h2 className="seat-print-title">학급 자리 배치도</h2>
              <Desks grid={s.current} onSeat={clickSeat} swapFrom={swapFrom} />
            </div>
          </div>
        </div>
      )}

      {view === 'history' && <HistoryView history={history} rows={s.rows} cols={s.cols} />}
      {view === 'saved' && <SavedView records={s.records} update={update} copySheet={copySheet} reuse={(g) => { update({ current: g.map((row) => [...row]), rows: g.length, cols: g[0]?.length ?? s.cols }); setView('make'); say('이 배치를 현재 배치로 가져왔어요.'); }} />}
    </div>
  );
}

// 1~15 숫자 칸: 지우고 새로 칠 수 있게 입력 중엔 빈칸도 허용하고, 칸을 벗어날 때 맞춤. 폰용 −/+ 버튼
function NumField({ label, value, onChange }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setText(String(value)); } // 백업 열기 등으로 바뀌면 따라감
  const clamp = (n) => Math.min(15, Math.max(1, n));
  const set = (n) => { const v = clamp(n); setText(String(v)); if (v !== value) onChange(v); };
  return (
    <label className="seat-num">{label}
      <span className="num-field">
        <button type="button" onClick={() => set(value - 1)} disabled={value <= 1} aria-label={`${label} 줄이기`}>−</button>
        <input type="text" inputMode="numeric" pattern="[0-9]*" value={text}
          onChange={(e) => {
            const t = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
            setText(t);
            const n = Number.parseInt(t, 10);
            if (n >= 1 && n <= 15 && n !== value) onChange(n);
          }}
          onBlur={() => set(Number.parseInt(text, 10) || value)} />
        <button type="button" onClick={() => set(value + 1)} disabled={value >= 15} aria-label={`${label} 늘리기`}>+</button>
      </span>
    </label>
  );
}

// 교실 모양: 왼쪽 복도, 오른쪽 창문, 아래 칠판·교탁. heat 가 있으면 앉은 횟수로 칠함
function Desks({ grid, onSeat, swapFrom, heat }) {
  if (!grid) return <p className="empty">아직 배치가 없어요. ‘자리 배치하기’를 눌러 보세요.</p>;
  const cols = grid[0]?.length ?? 1;
  return (
    <div className="room">
      <div className="room-mid">
        <span className="room-side">복도</span>
        <div className="desks" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {grid.map((row, r) => row.map((name, c) => {
            const n = heat ? (heat[seatKey(r, c)] ?? 0) : 0;
            const picked = swapFrom && swapFrom.r === r && swapFrom.c === c;
            const cls = heat ? (n ? 'desk heat' : 'desk off') : picked ? 'desk picked' : name ? 'desk' : 'desk empty';
            return (
              <button key={`${r}-${c}`} type="button" className={cls} onClick={onSeat ? () => onSeat(r, c) : undefined} disabled={!onSeat} aria-label={`${seatKey(r, c)} ${name || '빈 자리'}`}>
                <span className="desk-pos">{c + 1}열 {r + 1}행</span>
                <b>{heat ? (n ? `${n}번` : '') : (name || '빈 자리')}</b>
              </button>
            );
          }))}
        </div>
        <span className="room-side window">운동장 창문</span>
      </div>
      <div className="room-board">칠판 / 교탁</div>
    </div>
  );
}

function HistoryView({ history, rows, cols }) {
  const [who, setWho] = useState('');
  const list = Object.keys(history).sort((a, b) => a.localeCompare(b, 'ko'));
  const mine = history[who];
  return (
    <div className="block">
      {!list.length ? <p className="empty">저장된 배치가 아직 없어요. 배치 후 ‘저장 및 기록’을 누르면 쌓여요.</p> : (
        <>
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="학생 고르기">
            <option value="">학생을 고르세요</option>
            {list.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {mine && (
            <>
              <ul className="seat-stats">
                {Object.entries(mine).sort((a, b) => b[1] - a[1]).map(([k, n]) => <li key={k}><span>{k}</span><span className="badge remind">{n}번 앉음</span></li>)}
              </ul>
              <div className="print-area">
                <h2 className="seat-print-title">{who} 학생 자리 분포도</h2>
                <Desks grid={Array.from({ length: rows }, () => Array(cols).fill(null))} heat={mine} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SavedView({ records, update, copySheet, reuse }) {
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const cur = records.find((r) => r.id === sel);
  const rename = (id) => { update({ records: records.map((r) => (r.id === id ? { ...r, title: title.trim() } : r)) }); setEditing(null); };
  const remove = (id) => { if (!confirm('이 기록을 지울까요? 학생별 기록에서도 빠져요.')) return; update({ records: records.filter((r) => r.id !== id) }); if (sel === id) setSel(null); };
  if (!records.length) return <div className="block"><p className="empty">저장된 기록이 없어요.</p></div>;
  return (
    <div className="seat-layout">
      <ul className="block seat-records">
        {records.map((r) => (
          <li key={r.id} className={sel === r.id ? 'on' : ''}>
            {editing === r.id ? (
              <form className="row grow" onSubmit={(e) => { e.preventDefault(); rename(r.id); }}>
                <input className="grow" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
                <button className="small primary">저장</button>
              </form>
            ) : (
              <>
                <button className="link left grow" onClick={() => setSel(r.id)}><b>{r.title || r.date} 배치</b><span className="small muted"> · {r.rows}행×{r.cols}열</span></button>
                <button className="icon" onClick={() => { setEditing(r.id); setTitle(r.title || r.date); }} aria-label="이름 바꾸기">✏️</button>
                <button className="icon" onClick={() => remove(r.id)} aria-label="지우기">🗑</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="block seat-board">
        {!cur ? <p className="empty">왼쪽에서 기록을 고르세요.</p> : (
          <>
            <div className="seat-bar">
              <b className="grow">{cur.title || cur.date}</b>
              <button className="small" onClick={() => reuse(cur.grid)}>이 배치 다시 쓰기</button>
              <button className="small" onClick={() => copySheet(cur.grid)}>📋 시트로 복사</button>
              <button className="small" onClick={() => window.print()}>🖨 인쇄</button>
            </div>
            <div className="print-area">
              <h2 className="seat-print-title">{cur.title || cur.date} 자리 배치도</h2>
              <Desks grid={cur.grid} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
