// 🙋 1인 1역 · 🧹 청소 당번 · 📄 자리배치표 (학급 → 자리 배치 안의 칸들)
// 모두 자리 배치 기록(class_seating)에 같이 저장되어 본인만 보고, 어느 기기에서나 같음.
import { useState } from 'react';
import { todayKST, formatShort } from '../lib/date.js';
import { autoFillCleaning, buildImagePrompt, classNames, roleIcon, cleaningCounts, normalizeCleaning, rotationPlan, parseRolesPaste, rotateCleaning, seatSheetModel } from '../lib/classDuty.js';

// ── 🙋 1인 1역 ─────────────────────────
export function RolesView({ s, update, roster, say }) {
  const names = classNames(s, roster);
  const number = Object.fromEntries(roster.map((x) => [x.name, x.number]));
  const [paste, setPaste] = useState(null);
  const setRole = (name, patch) => update({ roles: { ...s.roles, [name]: { role: '', detail: '', ...s.roles[name], ...patch } } });
  const filled = names.filter((n) => s.roles[n]?.role || s.roles[n]?.detail).length;

  function applyPaste() {
    const got = parseRolesPaste(paste, names);
    const n = Object.keys(got).length;
    if (!n) return say('읽을 수 있는 줄이 없어요. 번호·이름·역할·하는 일 칸을 함께 복사해 주세요.', true);
    update({ roles: { ...s.roles, ...got } });
    setPaste(null);
    say(`${n}명의 역할을 넣었어요.`);
  }

  if (!names.length) return <div className="block"><p className="empty">먼저 <b>👥 명렬표</b>를 넣거나 배치 칸에 학생 명단을 적어 주세요.</p></div>;
  return (
    <div className="block">
      <div className="block-head">
        <h2>🙋 1인 1역 <span className="muted small">{filled}/{names.length}명</span></h2>
        <button className="small" onClick={() => setPaste(paste === null ? '' : null)}>📋 시트에서 붙여넣기</button>
      </div>
      {paste !== null && (
        <div className="stack duty-paste">
          <p className="small muted">구글 시트에서 <b>번호 · 이름 · 역할 · 하는 일</b> 칸을 함께 복사해 붙여넣으세요. 명단에 있는 이름만 넣어요.</p>
          <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'1\t홍길동\t급식\t급식 담당\n2\t…'} />
          <div className="row"><button className="primary" disabled={!paste.trim()} onClick={applyPaste}>넣기</button><button className="link" onClick={() => setPaste(null)}>닫기</button></div>
        </div>
      )}
      <p className="small muted">‘역할’은 자리배치표에서 이름 아래 작게 보여요. ‘하는 일’은 오른쪽 1인 1역 목록에 나와요.</p>
      <div className="table-wrap">
        <table className="duty-table">
          <thead><tr><th>번호</th><th>이름</th><th>역할 (짧게)</th><th>하는 일</th></tr></thead>
          <tbody>
            {names.map((n) => (
              <tr key={n}>
                <td className="num">{number[n] ?? ''}</td>
                <td className="nm">{n}</td>
                <td><input value={s.roles[n]?.role ?? ''} onChange={(e) => setRole(n, { role: e.target.value })} placeholder="예: 급식" aria-label={`${n} 역할`} /></td>
                <td><input value={s.roles[n]?.detail ?? ''} onChange={(e) => setRole(n, { detail: e.target.value })} placeholder="예: 급식 담당" aria-label={`${n} 하는 일`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 🧹 청소 당번 ─────────────────────────
export function CleaningView({ s, update, roster, say }) {
  const c = normalizeCleaning(s.cleaning);
  const names = classNames(s, roster);
  const today = todayKST();
  const set = (next) => update({ cleaning: normalizeCleaning(next) });
  const setCell = (zid, d, k, v) => {
    const cells = structuredClone(c.cells);
    cells[zid][d][k] = v;
    set({ ...c, cells });
  };
  const setZone = (i, patch) => set({ ...c, zones: c.zones.map((z, j) => (j === i ? { ...z, ...patch } : z)) });
  const moveZone = (i, dir) => { const z = [...c.zones]; [z[i], z[i + dir]] = [z[i + dir], z[i]]; set({ ...c, zones: z }); };
  const counts = cleaningCounts(c);
  const missing = names.filter((n) => !counts[n]);
  const twice = Object.entries(counts).filter(([, n]) => n > 1).map(([x]) => x);
  const plan = rotationPlan(c, today);

  return (
    <>
      <div className="block">
        <div className="block-head"><h2>🧹 청소 당번</h2></div>
        <div className="row wrap duty-tools">
          <button onClick={() => { set(autoFillCleaning(c, names)); say('빈칸을 아직 안 맡은 학생으로 채웠어요.'); }}>✨ 빈칸 자동 채우기</button>
          <button onClick={() => { if (confirm('요일마다 위에서 아래로 한 칸씩 돌릴까요? (맨 아래 → 맨 위)')) { set(rotateCleaning(c, today)); say('청소 역할을 순환했어요.'); } }}>🔄 순환 (위 → 아래)</button>
          <button className="link danger-text" onClick={() => { if (confirm('청소 표의 이름을 모두 지울까요?')) set({ ...c, cells: {} }); }}>모두 비우기</button>
        </div>
        <div className="table-wrap">
          <table className="duty-table clean">
            <thead><tr><th>구역</th>{c.days.map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {c.zones.flatMap((z) => Array.from({ length: z.slots }, (_, k) => (
                <tr key={`${z.id}-${k}`} className={k === 0 ? 'zone-first' : ''}>
                  {k === 0 && <th rowSpan={z.slots} className="zone">{z.name || '(구역)'}</th>}
                  {c.days.map((d, di) => (
                    <td key={d}>
                      <select value={c.cells[z.id][di][k]} onChange={(e) => setCell(z.id, di, k, e.target.value)} aria-label={`${z.name} ${d}요일 ${k + 1}번째`}>
                        <option value="">　</option>
                        <option value="-">-</option>
                        {names.map((n) => <option key={n} value={n}>{n}{counts[n] ? '' : ' ·'}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        {(missing.length > 0 || twice.length > 0) && (
          <p className="small muted duty-check">
            {missing.length > 0 && <>아직 안 맡은 학생 <b>{missing.length}명</b>: {missing.join(', ')}. </>}
            {twice.length > 0 && <>두 번 이상: {twice.join(', ')}</>}
          </p>
        )}
        <div className="duty-rot">
          <label className="row"><input type="checkbox" checked={c.auto} onChange={(e) => set({ ...c, auto: e.target.checked })} /> <b>정해진 날에 자동으로 순환</b> <span className="small muted">(위 → 아래)</span></label>
          <div className="row wrap">
            <span className="small muted">다음 순환일</span>
            <input type="date" value={c.next} min={today} onChange={(e) => set({ ...c, next: e.target.value })} aria-label="다음 순환일" />
            <select value={c.weeks} onChange={(e) => set({ ...c, weeks: Number(e.target.value) })} aria-label="순환 주기">
              {[1, 2, 3, 4].map((w) => <option key={w} value={w}>{w}주마다</option>)}
            </select>
          </div>
          {plan ? (
            <p className="small muted">
              {c.auto ? '🔄 자동 순환: ' : '순환 예정(자동 꺼짐): '}
              {plan.upcoming.map((d) => formatShort(d)).join(' → ')} …
              {c.base && <> · 마지막 순환 {formatShort(c.base)}</>}
            </p>
          ) : <p className="small muted">다음 순환일을 정하면 그날 앱을 열 때 자동으로 한 칸씩 돌려요.</p>}
        </div>
      </div>

      <details className="block duty-setup">
        <summary><h2>구역·인원·청소 방법 고치기</h2></summary>
        <ul className="zone-list">
          {c.zones.map((z, i) => (
            <li key={z.id}>
              <input className="grow" value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} placeholder="구역 이름" />
              <span className="num-field small-num">
                <button type="button" disabled={z.slots <= 1} onClick={() => setZone(i, { slots: z.slots - 1 })} aria-label="인원 줄이기">−</button>
                <b>{z.slots}명</b>
                <button type="button" disabled={z.slots >= 6} onClick={() => setZone(i, { slots: z.slots + 1 })} aria-label="인원 늘리기">+</button>
              </span>
              <button className="icon" disabled={i === 0} onClick={() => moveZone(i, -1)} aria-label="위로">↑</button>
              <button className="icon" disabled={i === c.zones.length - 1} onClick={() => moveZone(i, 1)} aria-label="아래로">↓</button>
              <button className="icon" onClick={() => { if (confirm(`'${z.name}' 구역을 뺄까요?`)) set({ ...c, zones: c.zones.filter((_, j) => j !== i) }); }} aria-label="빼기">×</button>
            </li>
          ))}
        </ul>
        <button className="small" onClick={() => set({ ...c, zones: [...c.zones, { id: `z${Date.now()}`, name: '', slots: 1 }] })}>+ 구역 추가</button>
        <h3 className="duty-sub">청소 방법</h3>
        {c.rules.map((r, i) => (
          <div key={i} className="rule-row">
            <input value={r.title} onChange={(e) => set({ ...c, rules: c.rules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="예: 쓸기" />
            <textarea rows={2} value={r.body} onChange={(e) => set({ ...c, rules: c.rules.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
            <button className="icon" onClick={() => set({ ...c, rules: c.rules.filter((_, j) => j !== i) })} aria-label="빼기">×</button>
          </div>
        ))}
        <button className="small" onClick={() => set({ ...c, rules: [...c.rules, { title: '', body: '' }] })}>+ 방법 추가</button>
        <label className="stack duty-footer"><span className="small muted">맨 아래 한 줄 (예: 끝나고 검사 받은 후 귀가)</span>
          <input value={c.footer} onChange={(e) => set({ ...c, footer: e.target.value })} />
        </label>
      </details>
    </>
  );
}

// ── 📄 자리배치표 (한 장: 자리 + 역할, 교탁, 청소 표, 1인 1역 목록) ─────────
export function SeatSheetView({ s, update, roster, say }) {
  const [opt, setOpt] = useState(() => {
    const def = { roles: true, clean: true, list: true, fancy: true };
    try { return { ...def, ...JSON.parse(localStorage.getItem('task-keeper.seat-sheet') || '{}') }; } catch { return def; }
  });
  const toggle = (k) => setOpt((o) => { const n = { ...o, [k]: !o[k] }; try { localStorage.setItem('task-keeper.seat-sheet', JSON.stringify(n)); } catch { /* 괜찮음 */ } return n; });
  const [busy, setBusy] = useState(false);
  if (!s.current) return <div className="block"><p className="empty">먼저 <b>🔄 배치</b>에서 자리를 배치해 주세요.</p></div>;
  const m = seatSheetModel({ grid: s.current, roles: s.roles, cleaning: s.cleaning, roster });
  const title = s.title || '자리배치표';

  // 그림 AI(GPT 등)에 줄 프롬프트 복사 — 학생 이름이 들어가므로 한 번 확인
  async function copyPrompt() {
    if (!confirm('프롬프트에 학생 이름이 들어가요. 외부 AI 서비스에 보내도 되는지 학교 지침을 확인했나요?\n(이름을 빼고 싶으면 복사한 뒤 지워서 쓰세요)')) return;
    const text = buildImagePrompt({ title, model: m });
    try { await navigator.clipboard.writeText(text); say('그림 프롬프트를 복사했어요. ChatGPT에 붙여넣으세요.'); } catch { window.prompt('아래 내용을 복사하세요', text); }
  }
  // 제목에서 '자리배치표'만 주황색으로 (꾸민 디자인)
  const tm = title.match(/^(.*?)(자리\s*배치\s*표)$/);

  async function excel() {
    setBusy(true);
    try {
      const { downloadSeatSheetXlsx } = await import('../lib/xlsxExport.js');
      await downloadSeatSheetXlsx({ title, model: m, opt, fileName: `${title.replace(/[\\/:*?"<>|]/g, '')}.xlsx` });
    } catch (e) { say(`엑셀을 만들지 못했어요: ${e.message}`, true); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="block stack">
        <label className="stack"><span className="small muted">제목</span>
          <input value={s.title} onChange={(e) => update({ title: e.target.value })} placeholder="예: 1-3반 자리배치표" />
        </label>
        <div className="row wrap sheet-opts">
          <label className="row"><input type="checkbox" checked={opt.roles} onChange={() => toggle('roles')} /> 이름 아래 역할</label>
          <label className="row"><input type="checkbox" checked={opt.clean} onChange={() => toggle('clean')} /> 청소 당번 표</label>
          <label className="row"><input type="checkbox" checked={opt.list} onChange={() => toggle('list')} /> 1인 1역 목록</label>
          <label className="row"><input type="checkbox" checked={opt.fancy} onChange={() => toggle('fancy')} /> 🎨 꾸민 디자인</label>
        </div>
        <div className="row wrap">
          <button className="primary" onClick={() => window.print()}>🖨 인쇄 (A4 가로)</button>
          <button disabled={busy} onClick={excel}>📗 엑셀로 내려받기</button>
          <button onClick={copyPrompt}>🤖 GPT 그림 프롬프트 복사</button>
        </div>
      </div>
      {/* 이 화면을 연 동안만 인쇄 용지를 A4 가로로 */}
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <div className="block sheet-wrap">
        <div className={`print-area seat-sheet${opt.fancy ? ' fancy' : ''}`}>
          <div className="sheet-left">
            {opt.fancy && <span className="deco deco-window" aria-hidden="true">🪟</span>}
            {opt.fancy && <span className="deco deco-shelf" aria-hidden="true">📚🪴</span>}
            <h2 className="sheet-title">{opt.fancy && tm ? <>{tm[1]}<em>{tm[2]}</em></> : title}</h2>
            <div className="sheet-desks" style={{ gridTemplateColumns: `repeat(${m.seats[0]?.length ?? 1}, minmax(0, 1fr))` }}>
              {m.seats.flatMap((row, r) => row.map((x, c) => (
                <div key={`${r}-${c}`} className={x ? 'sheet-desk' : 'sheet-desk empty'}>
                  {x && <><b>{x.name}</b>{opt.roles && <span>{opt.fancy && x.role && <i aria-hidden="true">{roleIcon(x.role)} </i>}{x.role || ' '}</span>}</>}
                </div>
              )))}
            </div>
            <div className="sheet-board">교탁</div>
            {opt.clean && (
              <>
                {opt.fancy && <h3 className="sheet-sub">🧹 청소·정리 구역</h3>}
                <table className="sheet-clean">
                  <thead><tr><th>구역</th>{m.days.map((d) => <th key={d}>{d}</th>)}</tr></thead>
                  <tbody>
                    {m.cleanRows.map((r, i) => (
                      <tr key={i}>
                        {r.first && <th rowSpan={r.span}>{r.zone}</th>}
                        {r.cells.map((n, j) => <td key={j}>{n}</td>)}
                      </tr>
                    ))}
                    {m.rules.map((r, i) => (
                      <tr key={`r${i}`} className="rule"><th>{r.title}</th><td colSpan={m.days.length} className="pre">{r.body}</td></tr>
                    ))}
                    {m.footer && <tr className="rule"><td colSpan={m.days.length + 1}>{m.footer}</td></tr>}
                  </tbody>
                </table>
              </>
            )}
          </div>
          {opt.list && (
            <div className="sheet-right">
              {!opt.fancy && <div className="sheet-window">운동장<br />창문</div>}
              <div className="sheet-roles-box">
              {opt.fancy && <h3 className="sheet-sub">📋 1인 1역할</h3>}
              <table className="sheet-roles">
                <thead><tr><th>번호</th><th>이름</th><th>역할</th><th>1인 1역할</th></tr></thead>
                <tbody>
                  {m.roleList.map((r) => <tr key={r.name}><td>{r.number ?? ''}</td><td>{r.name}</td><td>{r.role}</td><td>{r.detail}</td></tr>)}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
