// 🙋 1인 1역 · 🧹 청소 당번 · 📄 자리배치표 (학급 → 자리 배치 안의 칸들)
// 모두 자리 배치 기록(class_seating)에 같이 저장되어 본인만 보고, 어느 기기에서나 같음.
import { useEffect, useRef, useState } from 'react';
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
// 디자인 세 가지: 기본 표 / 크림·남색 / 🦖 초록(GPT로 만든 캐릭터 그림을 자리에 붙임)
const THEMES = [['plain', '기본 표'], ['navy', '크림·남색'], ['green', '🦖 초록 + 그림']];
// 초록 디자인에서 그림을 붙일 자리
const STICKERS = [
  ['tl', '제목 왼쪽'], ['tr', '제목 오른쪽'], ['ml', '교탁 왼쪽'], ['mr', '교탁 오른쪽'], ['bl', '청소 표 왼쪽'], ['br', '오른쪽 아래'],
];

// 올린 그림을 360px 안으로 줄여 PNG(투명 배경 유지)로
function shrinkImage(file, max = 360) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('그림 파일을 읽지 못했어요'));
    img.src = URL.createObjectURL(file);
  });
}

// 제목에서 "3반"처럼 반 번호는 노랗게
function TitleText({ title }) {
  const parts = title.split(/(\d+\s*반)/);
  return <>{parts.map((x, i) => (/\d+\s*반/.test(x) ? <em key={i}>{x}</em> : x))}</>;
}

export function SeatSheetView({ s, update, roster, say }) {
  const [opt, setOpt] = useState(() => {
    const def = { roles: true, clean: true, list: true, theme: 'green' };
    try {
      const saved = JSON.parse(localStorage.getItem('task-keeper.seat-sheet') || '{}');
      if (!saved.theme && 'fancy' in saved) saved.theme = saved.fancy ? 'navy' : 'plain';
      return { ...def, ...saved };
    } catch { return def; }
  });
  const setO = (patch) => setOpt((o) => { const n = { ...o, ...patch }; try { localStorage.setItem('task-keeper.seat-sheet', JSON.stringify(n)); } catch { /* 괜찮음 */ } return n; });
  const [busy, setBusy] = useState(false);
  const sheet = useRef(null);

  // 인쇄할 때: 한 장(A4 가로)에 맞게 줄였다가 끝나면 되돌림
  useEffect(() => {
    const fit = () => {
      const el = sheet.current;
      if (!el) return;
      el.style.width = '1100px';
      el.style.minWidth = '1100px';
      const k = Math.min(1, 1040 / el.scrollWidth, 715 / el.scrollHeight);
      el.style.zoom = String(k);
    };
    const reset = () => { const el = sheet.current; if (el) { el.style.zoom = ''; el.style.width = ''; el.style.minWidth = ''; } };
    window.addEventListener('beforeprint', fit);
    window.addEventListener('afterprint', reset);
    return () => { window.removeEventListener('beforeprint', fit); window.removeEventListener('afterprint', reset); };
  }, []);

  if (!s.current) return <div className="block"><p className="empty">먼저 <b>🔄 배치</b>에서 자리를 배치해 주세요.</p></div>;
  const m = seatSheetModel({ grid: s.current, roles: s.roles, cleaning: s.cleaning, roster });
  const title = s.title || '자리배치표';
  const theme = opt.theme;
  const stickers = s.stickers ?? {};

  async function copyPrompt() {
    if (!confirm('프롬프트에 학생 이름이 들어가요. 외부 AI 서비스에 보내도 되는지 학교 지침을 확인했나요?\n(이름 없이 그림만 받으려면 아래 ‘그림 붙이기’의 캐릭터 프롬프트를 쓰세요)')) return;
    const text = buildImagePrompt({ title, model: m });
    try { await navigator.clipboard.writeText(text); say('그림 프롬프트를 복사했어요. ChatGPT에 붙여넣으세요.'); } catch { window.prompt('아래 내용을 복사하세요', text); }
  }
  async function copyStickerPrompt() {
    try { await navigator.clipboard.writeText(STICKER_PROMPT); say('캐릭터 그림 프롬프트를 복사했어요. (학생 이름 없음)'); } catch { window.prompt('아래 내용을 복사하세요', STICKER_PROMPT); }
  }
  async function putSticker(slot, file) {
    if (!file) return;
    try { update({ stickers: { ...stickers, [slot]: await shrinkImage(file) } }); } catch (e) { say(e.message, true); }
  }
  async function excel() {
    setBusy(true);
    try {
      const { downloadSeatSheetXlsx } = await import('../lib/xlsxExport.js');
      await downloadSeatSheetXlsx({ title, model: m, opt, fileName: `${title.replace(/[\\/:*?"<>|]/g, '')}.xlsx` });
    } catch (e) { say(`엑셀을 만들지 못했어요: ${e.message}`, true); } finally { setBusy(false); }
  }
  const sticker = (slot) => (theme === 'green' && stickers[slot] ? <img className={`sticker st-${slot}`} src={stickers[slot]} alt="" /> : null);
  // 청소 방법을 "① 쓸기(…) → ② 닦기(…)" 한 줄로 (초록 디자인)
  const steps = m.rules.map((r, i) => `${'①②③④⑤'[i] ?? `${i + 1}.`} ${r.title}${r.body ? `(${r.body.split('\n')[0]})` : ''}`).join('  →  ');

  return (
    <>
      <div className="block stack">
        <label className="stack"><span className="small muted">제목</span>
          <input value={s.title} onChange={(e) => update({ title: e.target.value })} placeholder="예: 1학년 3반 자리배치표" />
        </label>
        <div className="seg">
          {THEMES.map(([k, l]) => <button key={k} type="button" className={theme === k ? 'on' : ''} onClick={() => setO({ theme: k })}>{l}</button>)}
        </div>
        <div className="row wrap sheet-opts">
          <label className="row"><input type="checkbox" checked={opt.roles} onChange={() => setO({ roles: !opt.roles })} /> 이름 아래 역할</label>
          <label className="row"><input type="checkbox" checked={opt.clean} onChange={() => setO({ clean: !opt.clean })} /> 청소 당번 표</label>
          <label className="row"><input type="checkbox" checked={opt.list} onChange={() => setO({ list: !opt.list })} /> 1인 1역 목록</label>
        </div>
        {theme === 'green' && (
          <details className="sticker-box" open={!Object.keys(stickers).length}>
            <summary><b>🖼 그림 붙이기</b> <span className="small muted">{Object.keys(stickers).length}/6 · GPT로 만든 캐릭터 그림을 자리마다</span></summary>
            <ol className="small sticker-how">
              <li><button type="button" className="link" onClick={copyStickerPrompt}>캐릭터 그림 프롬프트 복사</button> → ChatGPT에 붙여넣기 (학생 이름은 안 들어가요)</li>
              <li>나온 그림을 내려받아, 아래 자리에 하나씩 넣기 (투명 배경이면 더 예뻐요)</li>
            </ol>
            <div className="sticker-slots">
              {STICKERS.map(([k, l]) => (
                <div key={k} className="sticker-slot">
                  <label className="sticker-pick">
                    {stickers[k] ? <img src={stickers[k]} alt="" /> : <span>＋</span>}
                    <input type="file" accept="image/*" hidden onChange={(e) => { putSticker(k, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <span className="small">{l}</span>
                  {stickers[k] && <button type="button" className="link small danger-text" onClick={() => { const n = { ...stickers }; delete n[k]; update({ stickers: n }); }}>빼기</button>}
                </div>
              ))}
            </div>
          </details>
        )}
        <div className="row wrap">
          <button className="primary" onClick={() => window.print()}>🖨 인쇄 (A4 가로 한 장)</button>
          <button disabled={busy} onClick={excel}>📗 엑셀로 내려받기</button>
          <button onClick={copyPrompt}>🤖 GPT 포스터 프롬프트 복사</button>
        </div>
      </div>

      {/* 이 화면을 연 동안만 인쇄 용지를 A4 가로로 */}
      {/* 그리고 앱의 나머지(안 보이게 숨긴 것)가 빈 2쪽을 만들지 않게 아예 빼 버림 */}
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } body *:not(:has(.print-area)):not(.print-area):not(.print-area *) { display: none !important; } }'}</style>
      <div className="block sheet-wrap">
        <div ref={sheet} className={`print-area seat-sheet theme-${theme}`}>
          <header className="sheet-head">
            {sticker('tl')}
            <h2 className="sheet-title">{theme === 'plain' ? title : <TitleText title={title} />}</h2>
            {sticker('tr')}
          </header>
          <div className="sheet-body">
            <div className="sheet-left">
              <div className="sheet-room">
                <div className="sheet-desks" style={{ gridTemplateColumns: `repeat(${m.seats[0]?.length ?? 1}, minmax(0, 1fr))` }}>
                  {m.seats.flatMap((row, r) => row.map((x, c) => (
                    <div key={`${r}-${c}`} className={x ? 'sheet-desk' : 'sheet-desk empty'}>
                      {x && <><b>{x.name}</b>{opt.roles && <span>{theme === 'navy' && x.role && <i aria-hidden="true">{roleIcon(x.role)} </i>}{x.role || ' '}</span>}</>}
                    </div>
                  )))}
                </div>
                {theme !== 'navy' && <div className="sheet-window">창문<br />운동장</div>}
              </div>
              <div className="sheet-board-row">
                {sticker('ml')}
                <div className="sheet-board">교탁</div>
                {sticker('mr')}
              </div>
              {opt.clean && (
                <div className="sheet-clean-wrap">
                  {theme !== 'plain' && <div className="sheet-clean-badge">{sticker('bl')}<span>{theme === 'green' ? <>청소<br />당번</> : '🧹 청소·정리 구역'}</span></div>}
                  <div className="grow">
                    <table className="sheet-clean">
                      <thead><tr><th>구역</th>{m.days.map((d) => <th key={d}>{d}</th>)}</tr></thead>
                      <tbody>
                        {m.cleanRows.map((r, i) => (
                          <tr key={i}>
                            {r.first && <th rowSpan={r.span}>{r.zone}</th>}
                            {r.cells.map((n, j) => <td key={j}>{n}</td>)}
                          </tr>
                        ))}
                        {theme !== 'green' && m.rules.map((r, i) => (
                          <tr key={`r${i}`} className="rule"><th>{r.title}</th><td colSpan={m.days.length} className="pre">{r.body}</td></tr>
                        ))}
                        {theme !== 'green' && m.footer && <tr className="rule"><td colSpan={m.days.length + 1}>{m.footer}</td></tr>}
                      </tbody>
                    </table>
                    {theme === 'green' && (steps || m.footer) && (
                      <p className="sheet-steps"><b>정리 순서</b> {steps}{m.footer && <>  →  {m.footer}</>}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {opt.list && (
              <div className="sheet-right">
                <div className="sheet-roles-box">
                  {theme !== 'plain' && <h3 className="sheet-sub">{theme === 'green' ? '👑 1인 1역할' : '📋 1인 1역할'}</h3>}
                  <table className="sheet-roles">
                    <thead><tr><th>번호</th><th>이름</th><th>역할</th>{theme === 'plain' && <th>1인 1역할</th>}</tr></thead>
                    <tbody>
                      {m.roleList.map((r) => <tr key={r.name}><td>{r.number ?? ''}</td><td>{r.name}</td><td>{r.role}</td>{theme === 'plain' && <td>{r.detail}</td>}</tr>)}
                    </tbody>
                  </table>
                </div>
                {sticker('br')}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// GPT에 줄 캐릭터 그림 프롬프트 (학생 이름·글자 없이 꾸밈 그림만)
const STICKER_PROMPT = `교실 자리배치표를 꾸밀 스티커 그림을 만들어 줘. 글자는 하나도 넣지 마.

공통: 귀여운 한국 초등·중학생 아이 캐릭터, 초록 공룡 옷(후드에 노란 뿔·눈) 입음, 밝은 파스텔 플랫 일러스트, 굵은 갈색 외곽선, 배경은 투명(PNG). 그림마다 따로 한 장씩.

1. 공룡 옷 입은 남자아이와 여자아이가 나란히, 엄지척·브이 (가로로 긴 그림)
2. 공룡 옷 입은 남자아이가 주먹 불끈, 여자아이가 확성기 들고 신난 모습
3. 공룡 옷 입은 아이가 엎드려 턱 괴고 웃는 모습, 옆에 쌓인 책
4. 작은 초록 아기 공룡과 브이 하는 공룡 옷 여자아이
5. 빗자루와 쓰레받기 (청소 도구), 반짝이 몇 개
6. 공룡 옷 아이 셋이 깃발 아래에서 "화이팅" 하듯 만세 (깃발은 비워 둠)`;
