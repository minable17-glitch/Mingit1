// 📤 저장·인쇄: 기간을 골라 조회·종례 전달사항 / 출결 / 출결 합계 / 특이사항 / 일지를
// 📋 시트용 복사(구글 시트에 Ctrl+V) · ⬇ 파일 저장(CSV, 구글 시트·엑셀) · 🖨 인쇄
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { addDays, todayKST } from '../lib/date.js';
import { weekDays } from '../lib/calendar.js';
import { SCHOOL_HEADER, schoolReportRows } from '../lib/schoolAttendance.js';
import { downloadSchoolXlsx } from '../lib/xlsxExport.js';
import { attendanceSummaryTable, attendanceTable, noticesTable, notesTable, plannerTable, toCSV, toTSV } from '../lib/exporting.js';

const KINDS = [
  { key: 'school', label: '🧾 출결처리현황(학교 양식)' },
  { key: 'notices', label: '☀️🌙 조회·종례 전달사항' },
  { key: 'attendance', label: '✅ 출결 기록' },
  { key: 'attSummary', label: '📊 출결 학생별 합계' },
  { key: 'notes', label: '📝 학생 특이사항' },
  { key: 'planner', label: '📒 일지' },
];

function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function monthRange(day) {
  const [y, m] = day.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${day.slice(0, 7)}-01`, `${day.slice(0, 7)}-${String(last).padStart(2, '0')}`];
}

export default function ClassExport({ day, initialKind = 'school' }) {
  const [range, setRange] = useState('month');
  const [custom, setCustom] = useState(() => monthRange(day));
  const [kind, setKind] = useState(initialKind);
  const [offText, setOffText] = useState(() => { try { return localStorage.getItem('task-keeper.school-off') || ''; } catch { return ''; } });
  const extraOff = new Set((offText.match(/\d{4}-\d{2}-\d{2}/g) ?? []));
  const [className, setClassName] = useState(() => { try { return localStorage.getItem('task-keeper.class-name') || ''; } catch { return ''; } });
  const [loaded, setLoaded] = useState({ key: '', data: undefined });
  const [msg, setMsg] = useState('');

  const week = weekDays(day);
  const [from, to] = range === 'month' ? monthRange(day) : range === 'week' ? [week[0], week[6]] : range === 'day' ? [day, day] : custom;

  const key = `${from}|${to}`;
  useEffect(() => {
    let alive = true;
    api.loadClassRange(from, to).then((d) => { if (alive) setLoaded({ key: `${from}|${to}`, data: d }); });
    return () => { alive = false; };
  }, [from, to]);
  const data = loaded.key === key ? loaded.data : undefined; // 기간이 바뀌면 다시 불러오는 중

  const kindLabel = KINDS.find((k) => k.key === kind).label.replace(/^\S+\s/, '');
  const period = from === to ? from : `${from} ~ ${to}`;
  const wholeMonth = range === 'month';
  const schoolTitle = `${wholeMonth ? `${Number(from.slice(5, 7))}월  ` : ''}출결처리현황${className ? `(${className})` : ''}${wholeMonth ? '' : ` ${period}`}`;
  const title = kind === 'school' ? schoolTitle : `${className ? `${className} ` : ''}${kindLabel} (${period})`;
  const rows = !data ? [] : kind === 'school' ? [SCHOOL_HEADER, ...schoolReportRows(data.attendance, data.students, extraOff)]
    : kind === 'notices' ? noticesTable(data.notices)
    : kind === 'attendance' ? attendanceTable(data.attendance, data.students)
      : kind === 'attSummary' ? attendanceSummaryTable(data.attendance, data.students)
        : kind === 'notes' ? notesTable(data.notes, data.students)
          : plannerTable(data.days, data.notices, data.items, datesBetween(from, to));
  const empty = rows.length <= 1;

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  async function copy() {
    // 학교 양식은 머리글 빼고 내용만 → 이미 있는 월별 시트의 6행 A열에 바로 붙여넣기
    const tsv = toTSV(kind === 'school' ? rows.slice(1) : rows);
    try {
      await navigator.clipboard.writeText(tsv);
      flash(kind === 'school' ? '복사했어요. 학교 출결 시트에서 ‘시작일자’ 아래 첫 칸(A6)을 누르고 Ctrl+V 하세요.' : '복사했어요. 구글 시트의 빈 칸(A1)을 누르고 Ctrl+V 하세요.');
    } catch {
      window.prompt('아래 내용을 복사해 시트에 붙여넣으세요', tsv);
    }
  }
  function download() {
    const blob = new Blob(['﻿', toCSV([[title], [], ...rows])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash('파일을 저장했어요. 구글 드라이브에 올리면 시트로, 엑셀로도 열 수 있어요.');
  }

  return (
    <div className="block stack class-export">
      <h2>📤 시트로 저장 · 인쇄</h2>
      <label className="row wrap small">
        <span>학급 이름</span>
        <input placeholder="예: 2학년 3반 (제목에 들어가요)" value={className} onChange={(e) => { setClassName(e.target.value); try { localStorage.setItem('task-keeper.class-name', e.target.value); } catch { /* 괜찮음 */ } }} />
      </label>

      <div className="row wrap">
        {KINDS.map((k) => <button key={k.key} className={kind === k.key ? 'chip on' : 'chip'} onClick={() => setKind(k.key)}>{k.label}</button>)}
      </div>
      <div className="row wrap">
        {[['day', '그날'], ['week', '그 주'], ['month', '그 달'], ['custom', '기간 고르기']].map(([k, l]) => (
          <button key={k} className={range === k ? 'chip on' : 'chip'} onClick={() => setRange(k)}>{l}</button>
        ))}
        {range === 'custom' && (
          <span className="row">
            <input type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />~
            <input type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
          </span>
        )}
      </div>
      <p className="small muted">{period} · 위의 날짜(‹ ›)를 옮기면 그날·그 주·그 달이 바뀌어요.</p>
      {kind === 'school' && (
        <label className="stack small">
          <span className="muted">학교 쉬는 날(재량휴업일 등) — 이어진 결석·기간 계산에서 빼요. 주말·법정 공휴일은 자동으로 빠져요.</span>
          <input placeholder="예: 2026-10-02, 2026-11-20" value={offText} onChange={(e) => { setOffText(e.target.value); try { localStorage.setItem('task-keeper.school-off', e.target.value); } catch { /* 괜찮음 */ } }} />
        </label>
      )}

      <div className="row wrap">
        <button className="primary" disabled={empty} onClick={copy}>📋 시트용 복사</button>
        {kind === 'school'
          ? <button disabled={empty} onClick={async () => {
            try {
              await downloadSchoolXlsx({ title, sheetName: wholeMonth ? `${Number(from.slice(5, 7))}월` : '출결', header: SCHOOL_HEADER, rows: rows.slice(1), fileName: `${title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}.xlsx` });
              flash('엑셀 파일을 저장했어요. 구글 드라이브에 올리면 시트로도 열려요.');
            } catch (e) { flash(`엑셀 파일을 만들지 못했어요: ${e.message}`); }
          }}>📗 엑셀(.xlsx, 학교 양식)</button>
          : <button disabled={empty} onClick={download}>⬇ 파일 저장(CSV)</button>}
        <button disabled={empty} onClick={() => window.print()}>🖨 인쇄</button>
      </div>
      {msg && <p className="small">{msg}</p>}

      {data === undefined && <p className="muted small">불러오는 중…</p>}
      {data === null && <p className="notice">학급 기능을 준비하는 중이에요.</p>}
      {data && empty && <p className="small muted">이 기간에는 기록이 없어요.</p>}
      {data && !empty && (
        <div className="print-area">
          {kind === 'school' ? (
            <div className="school-head">
              <h3 className="print-title school-title">{title}</h3>
              <table className="approval"><tbody>
                <tr><th rowSpan={2}>결재</th><th>담임</th><th>부장</th><th>교감</th></tr>
                <tr><td /><td /><td /></tr>
              </tbody></table>
            </div>
          ) : <h3 className="print-title">{title}</h3>}
          <div className="export-scroll">
            <table className="export-table">
              <thead><tr>{rows[0].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="print-foot small muted">업무 챙김 · {todayKST()} 출력</p>
        </div>
      )}
    </div>
  );
}
