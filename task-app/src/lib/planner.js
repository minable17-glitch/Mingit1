// 일지(플래너): 교시 칸, 비었는지, 주·월 보기 요약 (순수 함수, 테스트 가능)
export const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7];

// 저장된 periods(길이가 들쭉날쭉할 수 있음) → 0~7교시 8칸 [{ a: 반·과목, b: 내용 }]
export function periodRows(periods) {
  return PERIODS.map((i) => ({ a: periods?.[i]?.a ?? '', b: periods?.[i]?.b ?? '' }));
}

export function isEmptyDay(d, items = []) {
  return !d || (!d.memo?.trim() && !d.reflection?.trim() && !periodRows(d.periods).some((p) => p.a.trim() || p.b.trim()) && !items.length);
}

// 주·월 칸에 보일 짧은 요약: 메모 첫 줄, 채운 교시 수, 체크 n/m
export function daySummaryLine(d, items = []) {
  const memo = (d?.memo ?? '').trim().split('\n')[0];
  const filled = periodRows(d?.periods).filter((p) => p.a.trim() || p.b.trim()).length;
  const done = items.filter((i) => i.done).length;
  return { memo, filled, done, total: items.length };
}

// 학급 관련 글인지 (던져 둔 것에서 '학급으로'를 먼저 보여 줄지)
const CLASS_WORDS = /(학생|우리\s*반|반\s*아이|조회|종례|출결|결석|지각|조퇴|학부모|가정통신문|상담|청소|자리|모둠|급식|우유|체험학습|생활기록부|학생부)/;
export const looksClassRelated = (text) => CLASS_WORDS.test(text);
