// 학교 '출결처리현황' 양식으로 바꾸기 (순수 함수, 테스트 가능)
// 머리글: 시작일자, 종료일자, 기간, 교시, 분류, 항목, 학번, 이름, 사유, 첨부서류
//  - 같은 학생이 같은 사유로 이어서 결석하면 한 줄로 합침(주말·공휴일·학교 쉬는 날은 건너뜀)
//  - 기간: 결석만, 주말·공휴일 뺀 실제 결석 일수 'N일간'
//  - 교시: 결석은 비움, 조퇴는 처음 빠진 교시 'N교시~', 지각은 마지막 빠진 교시 '~N교시', 결과는 'N,M교시'
//  - 종료일자: 결석만 / 분류: 출석인정 → '인정'
//  - 첨부서류: 지각·조퇴·결과 → '학부모와연락', 현장체험학습(인정결석) → '체험학습신청서, 보고서', 그 외 입력한 서류
//  - 알 수 없는 칸은 '(누락)', 사유가 없으면 빈칸
import { addDays } from './date.js';

export const SCHOOL_HEADER = ['시작일자', '종료일자', '기간', '교시', '분류', '항목', '학번', '이름', '사유', '첨부서류'];

// 법정 공휴일·대체공휴일 (2025~2027)
export const KR_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-03-03', '2025-05-05', '2025-05-06',
  '2025-06-03', '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-03-02', '2026-05-05', '2026-05-24', '2026-05-25', '2026-06-03',
  '2026-06-06', '2026-08-15', '2026-08-17', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25',
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-03-01', '2027-05-05', '2027-05-13', '2027-06-06', '2027-08-15',
  '2027-08-16', '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-03', '2027-10-04', '2027-10-09', '2027-10-11', '2027-12-25', '2027-12-27',
]);

const dowOf = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
export function isSchoolDay(d, extraOff = new Set()) {
  const w = dowOf(d);
  return w !== 0 && w !== 6 && !KR_HOLIDAYS.has(d) && !extraOff.has(d);
}
export function nextSchoolDay(d, extraOff) {
  let n = addDays(d, 1);
  for (let i = 0; i < 30 && !isSchoolDay(n, extraOff); i++) n = addDays(n, 1);
  return n;
}
export function schoolDaysBetween(from, to, extraOff) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d, extraOff)) n++;
  return n;
}
// 기간 결석을 한 번에 넣을 때: from~to 사이 학교 가는 날들
export function schoolDaysList(from, to, extraOff) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d, extraOff)) out.push(d);
  return out;
}

export const fmtSchoolDate = (d) => (d ? `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}.` : '');
const CLASS = { sick: '질병', unexcused: '미인정', etc: '기타', approved: '인정' };
const ITEM = { absent: '결석', late: '지각', early: '조퇴', result: '결과' };
const periodLabel = (p) => (/^\d+$/.test(p) ? `${p}교시` : p);

export function periodText(type, periods) {
  const p = (periods ?? '').trim();
  if (type === 'absent') return '';
  if (!p) return '(누락)';
  if (type === 'early') return `${periodLabel(p.split(',')[0].trim())}~`;
  if (type === 'late') return `~${periodLabel(p.split(',').at(-1).trim())}`;
  const list = p.split(',').map((x) => x.trim()).filter(Boolean);
  return list.every((x) => /^\d+$/.test(x)) ? `${list.join(',')}교시` : list.map(periodLabel).join(',');
}

export function docsText(type, reason, memo, docs) {
  if (type !== 'absent') return '학부모와연락';
  if (reason === 'approved' && /체험\s*학습/.test(memo ?? '')) return '체험학습신청서, 보고서';
  return (docs ?? '').trim();
}

// records: class_attendance 행들, students: class_students, extraOff: 학교 쉬는 날 Set
export function schoolReportRows(records, students, extraOff = new Set()) {
  const st = Object.fromEntries(students.map((s) => [s.id, s]));
  const code = (id) => (st[id] ? (st[id].student_code || String(st[id].number)) : '(누락)');
  const name = (id) => st[id]?.name ?? '(누락)';
  const rows = [];

  // 결석: 같은 학생·분류·사유·서류로 이어진 학교 가는 날은 한 줄로
  const absents = records.filter((r) => r.type === 'absent').sort((a, b) => a.student_id.localeCompare(b.student_id) || a.day.localeCompare(b.day));
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const days = Math.max(schoolDaysBetween(cur.start, cur.end, extraOff), cur.count);
    rows.push({ sort: cur.start, num: st[cur.r.student_id]?.number ?? 1e9, cells: [fmtSchoolDate(cur.start), fmtSchoolDate(cur.end), `${days}일간`, '', CLASS[cur.r.reason] ?? '(누락)', '결석', code(cur.r.student_id), name(cur.r.student_id), cur.r.memo?.trim() ?? '', docsText('absent', cur.r.reason, cur.r.memo, cur.docs)] });
    cur = null;
  };
  for (const r of absents) {
    const same = cur && cur.r.student_id === r.student_id && cur.r.reason === r.reason && (cur.r.memo ?? '').trim() === (r.memo ?? '').trim() && r.day === nextSchoolDay(cur.end, extraOff);
    if (same) {
      cur.end = r.day;
      cur.count += 1;
      if (!cur.docs && r.docs) cur.docs = r.docs;
    } else {
      flush();
      cur = { r, start: r.day, end: r.day, count: 1, docs: r.docs ?? '' };
    }
  }
  flush();

  for (const r of records.filter((x) => x.type !== 'absent')) {
    rows.push({ sort: r.day, num: st[r.student_id]?.number ?? 1e9, cells: [fmtSchoolDate(r.day), '', '', periodText(r.type, r.periods), CLASS[r.reason] ?? '(누락)', ITEM[r.type] ?? '(누락)', code(r.student_id), name(r.student_id), r.memo?.trim() ?? '', docsText(r.type, r.reason, r.memo, r.docs)] });
  }
  // 날짜순(1일이 위), 같은 날은 번호순
  return rows.sort((a, b) => a.sort.localeCompare(b.sort) || a.num - b.num).map((x) => x.cells);
}
