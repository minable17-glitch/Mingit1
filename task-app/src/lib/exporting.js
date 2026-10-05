// 학급 기록 내보내기: 표(2차원 배열) 만들기, 시트 붙여넣기용(TSV)·CSV 글 (순수 함수, 테스트 가능)
import { ATT_REASONS, ATT_TYPES, reasonLabel, typeLabel } from './classroom.js';
import { periodRows } from './planner.js';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dow = (d) => DOW[new Date(`${d}T00:00:00Z`).getUTCDay()];
const byDay = (a, b) => a.day.localeCompare(b.day);

export function noticesTable(notices) {
  const rows = [['날짜', '요일', '구분', '순서', '전달사항', '전달함']];
  const sorted = [...notices].sort((a, b) => byDay(a, b) || a.kind.localeCompare(b.kind) * -1 || a.position - b.position);
  const counter = {};
  for (const n of sorted) {
    const k = `${n.day}:${n.kind}`;
    counter[k] = (counter[k] ?? 0) + 1;
    rows.push([n.day, dow(n.day), n.kind === 'morning' ? '조회' : '종례', counter[k], n.body, n.done ? 'O' : '']);
  }
  return rows;
}

export function attendanceTable(records, students) {
  const st = Object.fromEntries(students.map((s) => [s.id, s]));
  const rows = [['날짜', '요일', '번호', '이름', '종류', '사유', '메모']];
  for (const r of [...records].sort((a, b) => byDay(a, b) || (st[a.student_id]?.number ?? 0) - (st[b.student_id]?.number ?? 0))) {
    rows.push([r.day, dow(r.day), st[r.student_id]?.number ?? '', st[r.student_id]?.name ?? '', typeLabel(r.type), reasonLabel(r.reason), r.memo ?? '']);
  }
  return rows;
}

// 학생별 출결 합계 (출결 마감용): 번호, 이름, 질병결석, 미인정결석, …, 합계
export function attendanceSummaryTable(records, students) {
  const cols = ATT_TYPES.flatMap((t) => ATT_REASONS.map((r) => ({ key: `${t.key}:${r.key}`, label: `${r.label}${t.label}` })));
  const used = cols.filter((c) => records.some((r) => `${r.type}:${r.reason}` === c.key));
  const rows = [['번호', '이름', ...used.map((c) => c.label), '합계']];
  for (const s of [...students].sort((a, b) => a.number - b.number)) {
    const mine = records.filter((r) => r.student_id === s.id);
    rows.push([s.number, s.name + (s.active ? '' : '(전출)'), ...used.map((c) => mine.filter((r) => `${r.type}:${r.reason}` === c.key).length || ''), mine.length || '']);
  }
  return rows;
}

export function notesTable(notes, students) {
  const st = Object.fromEntries(students.map((s) => [s.id, s]));
  const rows = [['날짜', '요일', '번호', '이름', '특이사항']];
  for (const n of [...notes].sort((a, b) => byDay(a, b) || (st[a.student_id]?.number ?? 0) - (st[b.student_id]?.number ?? 0))) {
    rows.push([n.day, dow(n.day), st[n.student_id]?.number ?? '', st[n.student_id]?.name ?? '', n.body]);
  }
  return rows;
}

// 일지: 날짜마다 한 줄 (메모, 조회, 0~7교시, 종례, 할 일, 하루 기록)
export function plannerTable(days, notices, items, dates) {
  const rows = [['날짜', '요일', '메모', '조회', ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `${i}교시`), '종례', '할 일', '하루 기록']];
  for (const d of dates) {
    const day = days.find((x) => x.day === d);
    const list = (kind) => notices.filter((n) => n.day === d && n.kind === kind).sort((a, b) => a.position - b.position).map((n, i) => `${i + 1}. ${n.body}`).join('\n');
    const todo = items.filter((i) => i.day === d).map((i) => `${i.done ? '☑' : '☐'} ${i.title}`).join('\n');
    const periods = periodRows(day?.periods).map((p) => [p.a, p.b].filter((x) => x.trim()).join(' · '));
    const row = [d, dow(d), day?.memo ?? '', list('morning'), ...periods, list('closing'), todo, day?.reflection ?? ''];
    if (row.slice(2).some((c) => String(c).trim())) rows.push(row);
  }
  return rows;
}

// 구글 시트에 그대로 붙여넣는 글 (칸 = 탭, 줄 = 줄바꿈, 칸 안 줄바꿈·탭은 따옴표로)
export function toTSV(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join('\t')).join('\n');
}

export function toCSV(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}
