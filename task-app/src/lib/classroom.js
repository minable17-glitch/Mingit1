// 학급(담임): 명렬표 붙여넣기 읽기, 출결 요약, 전달사항 글 만들기 (순수 함수, 테스트 가능)

export const ATT_TYPES = [
  { key: 'absent', label: '결석', short: '결' },
  { key: 'late', label: '지각', short: '지' },
  { key: 'early', label: '조퇴', short: '조' },
  { key: 'result', label: '결과', short: '과' },
];
export const ATT_REASONS = [
  { key: 'sick', label: '질병' },
  { key: 'unexcused', label: '미인정' },
  { key: 'etc', label: '기타' },
  { key: 'approved', label: '출석인정' },
];
export const typeLabel = (k) => ATT_TYPES.find((t) => t.key === k)?.label ?? k;
export const reasonLabel = (k) => ATT_REASONS.find((r) => r.key === k)?.label ?? k;

const NAME = /^[가-힣]{2,5}$|^[A-Za-z][A-Za-z .'-]{1,30}$/;
const HEADER = /번호|이름|성명|학번|name|no\.?$/i;

// 구글 시트·엑셀에서 복사한 칸(탭으로 구분), CSV, "1 김철수" 줄 모두 읽기 → [{ number, name }]
// 학번(10203)이면 끝 두 자리를 번호로. 번호가 없으면 순서대로.
export function parseRoster(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .map((l) => (l.includes('\t') ? l.split('\t') : l.includes(',') ? l.split(',') : l.split(/\s+/)).map((c) => c.trim().replace(/^"|"$/g, '')));
  const out = [];
  for (const cells of rows) {
    if (cells.some((c) => HEADER.test(c)) && !cells.some((c) => /^\d{1,6}$/.test(c))) continue; // 머리글 줄 (번호·이름·성명…)
    const name = cells.find((c) => NAME.test(c) && !HEADER.test(c));
    if (!name) continue;
    const numCell = cells.find((c) => /^\d{1,6}$/.test(c));
    let number = numCell ? Number(numCell) : out.length + 1;
    const row = { number, name };
    if (number > 99) { row.number = number % 100; row.code = numCell; } // 학번(10203) → 번호 3, 학번은 따로 보관
    out.push(row);
  }
  // 같은 번호가 겹치면 순서대로 다시 매김
  if (new Set(out.map((s) => s.number)).size !== out.length) return out.map((s, i) => ({ ...s, number: i + 1 }));
  return out.sort((a, b) => a.number - b.number);
}

// 하루 출결 요약: { 재적, 결석, 지각, 조퇴, 결과 }
export function daySummary(students, records, day) {
  const active = students.filter((s) => s.active);
  const today = records.filter((r) => r.day === day);
  const count = (type) => new Set(today.filter((r) => r.type === type).map((r) => r.student_id)).size;
  return { enrolled: active.length, absent: count('absent'), late: count('late'), early: count('early'), result: count('result') };
}

// 한 달 출결 요약: 학생마다 { student, counts: { 'absent:sick': n, … }, total, list }
export function monthSummary(students, records, month) {
  const inMonth = records.filter((r) => r.day.startsWith(month));
  return students
    .map((s) => {
      const mine = inMonth.filter((r) => r.student_id === s.id).sort((a, b) => a.day.localeCompare(b.day));
      const counts = {};
      for (const r of mine) counts[`${r.type}:${r.reason}`] = (counts[`${r.type}:${r.reason}`] ?? 0) + 1;
      return { student: s, counts, total: mine.length, list: mine };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => a.student.number - b.student.number);
}

// 출결 요약 글 (메신저·나이스 확인용)
export function monthSummaryText(summary, month) {
  const [y, m] = month.split('-');
  if (!summary.length) return `${y}년 ${Number(m)}월 출결: 특이 없음`;
  const lines = summary.map(({ student, list }) => {
    const items = list.map((r) => `${Number(r.day.slice(8))}일 ${reasonLabel(r.reason)}${typeLabel(r.type)}${r.memo ? `(${r.memo})` : ''}`);
    return `${student.number}번 ${student.name}: ${items.join(', ')}`;
  });
  return `${y}년 ${Number(m)}월 출결\n${lines.join('\n')}`;
}

// 조회·종례 전달사항 글 (칠판·메신저에 붙여넣기)
export function noticesText(notices, kind, day) {
  const [, m, d] = day.split('-').map(Number);
  const title = `${m}/${d} ${kind === 'morning' ? '조회' : '종례'} 전달사항`;
  const items = notices.filter((n) => n.kind === kind && n.day === day).sort((a, b) => a.position - b.position);
  return [title, ...items.map((n, i) => `${i + 1}. ${n.body}`)].join('\n');
}
