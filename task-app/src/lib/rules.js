// AI 없이 동작하는 규칙 기반 도우미 (공문 읽기, 던져넣기 분류, 기본 단계, 짜투리 추천)
// 모두 "제안"만 하고, 사용자가 화면에서 고친 뒤 확정합니다.
import { addDays, diffDays } from './date.js';
import { toWeekday } from './templates.js';

// ── 날짜 찾기 ────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 연도가 없는 날짜: 오늘 기준 한 달 이상 지난 날짜면 내년으로 봄
function inferYear(m, d, today) {
  const y = Number(today.slice(0, 4));
  const date = validDate(y, m, d);
  if (!date) return null;
  return diffDays(date, today) > 30 ? validDate(y + 1, m, d) : date;
}

const DATE_PATTERNS = [
  // 2026. 10. 15. / 2026.10.15 / 2026-10-15 / 2026/10/15
  { re: /(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/g, full: true },
  // 2026년 10월 15일
  { re: /(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, full: true },
  // 10월 15일
  { re: /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g },
  // 10/15 (앞뒤로 다른 숫자·슬래시가 없을 때만)
  { re: /(?<![\d/.])(\d{1,2})\/(\d{1,2})(?![\d/])/g },
  // 10. 15.(수) / 10.15.(수) / 10. 15.까지
  { re: /(?<![\d.])(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*(?=\(|까지|한|\s*[월화수목금토일]요일)/g },
];

const DEADLINE_WORDS = /(까지|기한|마감|제출|회신|보고|완료)/;

// 본문의 모든 날짜 후보와, 그 날짜가 '기한'처럼 보이는 정도(점수)
export function findDates(text, today) {
  const found = [];
  const taken = [];
  for (const { re, full } of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue; // 이미 찾은 날짜의 일부
      const date = full ? validDate(+m[1], +m[2], +m[3]) : inferYear(+m[1], +m[2], today);
      if (!date) continue;
      taken.push([start, end]);
      const around = text.slice(Math.max(0, start - 25), end + 25);
      const lineStart = text.lastIndexOf('\n', start) + 1;
      const line = text.slice(lineStart, text.indexOf('\n', end) === -1 ? undefined : text.indexOf('\n', end));
      let score = 0;
      if (DEADLINE_WORDS.test(around)) score += 3;
      if (/까지/.test(text.slice(end, end + 8))) score += 3;
      if (/(기한|마감)/.test(line)) score += 2;
      if (/(시행|발송|접수|작성일)/.test(line)) score -= 3; // 공문 시행일자 등은 기한이 아님
      if (date < today) score -= 2;
      found.push({ date, score, index: start });
    }
  }
  return found;
}

// 가장 기한다운 날짜 하나 (없으면 '')
export function pickDeadline(text, today) {
  const dates = findDates(text, today);
  if (!dates.length) return '';
  // '~' 로 이어진 기간(10.1.~10.15.)이면 뒤 날짜를 기한으로
  dates.sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : -1));
  return dates[0].score > 0 ? dates[0].date : [...dates].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date;
}

// ── 분류 추측 ────────────────────────────────

const CATEGORY_HINTS = [
  { match: /담임|학급/, words: ['학생', '학부모', '상담', '생활', '출결', '학급', '가정통신문', '생활기록부', '학교폭력', '진로'] },
  { match: /수업|교과/, words: ['수업', '평가', '수행', '교육과정', '성적', '시험', '교과', '진도', '채점', '교과서'] },
  { match: /행정/, words: ['예산', '품의', '정산', '출장', '구입', '계약', '보고', '공문', '회계', '결재', '물품', '연수', '제출'] },
  { match: /개인/, words: ['병원', '개인', '가족', '휴가', '은행'] },
];

export function guessCategoryId(text, categories) {
  let best = null;
  let bestScore = 0;
  for (const c of categories) {
    // 분류 이름 자체가 본문에 나오면 가산점
    let score = text.includes(c.name) ? 2 : 0;
    const hint = CATEGORY_HINTS.find((h) => h.match.test(c.name));
    if (hint) score += hint.words.filter((w) => text.includes(w)).length;
    if (score > bestScore) {
      best = c.id;
      bestScore = score;
    }
  }
  return best ?? categories[0]?.id ?? '';
}

// ── 기본 단계 ───────────────────────────────

// 마감 기준 일반적인 처리 단계 (공문·새 업무에 기본으로 제안)
export function defaultSteps(dueDate, today) {
  const base = [
    { title: '내용 확인하고 필요한 자료 정리하기', offset: -5 },
    { title: '초안·제출물 작성하기', offset: -3 },
    { title: '결재 올리기', offset: -2 },
    { title: '제출·마무리하기', offset: 0 },
  ];
  return base.map((s) => {
    if (!dueDate) return { title: s.title, due_date: '' };
    let date = s.offset === 0 ? dueDate : toWeekday(addDays(dueDate, s.offset));
    if (date < today) date = today; // 이미 지난 날짜면 오늘로
    return { title: s.title, due_date: date };
  });
}

// ── 공문 붙여넣기 ─────────────────────────────

const clean = (s) => s.replace(/\s+/g, ' ').trim();

export function extractFromDocument(text, categories, today) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 제목: "제목 …" 줄 → 없으면 첫 줄
  const titleLine = lines.find((l) => /^제\s*목\s*[:：]?/.test(l));
  let title = titleLine ? titleLine.replace(/^제\s*목\s*[:：]?\s*/, '') : lines[0] ?? '';
  title = clean(title.replace(/^[「『"'[]|[」』"'\]]$/g, '')).slice(0, 60);

  const dueDate = pickDeadline(text, today);

  // 제출물: "붙임" 항목과 "제출" 이 들어간 짧은 줄
  const deliverables = [];
  for (const l of lines) {
    const att = l.match(/^붙\s*임\s*[:：]?\s*(?:\d+\.)?\s*(.+)/);
    if (att) deliverables.push(clean(att[1]).replace(/\s*\d+\s*부\.?\s*끝?\.?$/, '').replace(/\s*끝\.?$/, ''));
    else if (/^\d+\.\s*.+\s*\d+\s*부\.?/.test(l)) deliverables.push(clean(l.replace(/^\d+\.\s*/, '').replace(/\s*\d+\s*부\.?\s*끝?\.?$/, '')));
  }
  const submitLine = lines.find((l) => /제출/.test(l) && l.length <= 80 && !deliverables.includes(l));

  const note = [
    submitLine && clean(submitLine),
    deliverables.length ? `제출물: ${deliverables.join(', ')}` : '',
  ].filter(Boolean).join(' / ');

  return {
    found: Boolean(title),
    title,
    category_id: guessCategoryId(text, categories),
    due_date: dueDate,
    steps: defaultSteps(dueDate, today),
    next_action: '공문 다시 읽고 제출물·기한 확인하기',
    note,
  };
}

// ── 던져넣기: 어느 업무와 관련 있는지 ────────────────

// 두 글자씩 끊은 조각(바이그램)으로 비슷한 정도를 계산 (띄어쓰기·조사 차이에 강함)
// 어느 업무에나 흔히 들어가서 관련성 판단에 방해되는 조각
const COMMON = new Set(['하기', '해야', '제출', '확인', '준비', '까지', '학년', '학기', '안내', '계획', '관련', '보고', '작성']);

function bigrams(s) {
  const t = s.replace(/[^가-힣a-zA-Z0-9]/g, '');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    if (!COMMON.has(g)) set.add(g);
  }
  return set;
}

export function similarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / Math.min(A.size, B.size);
}

const TODO_WORDS = /(해야|하기|할 것|필요|까지|챙기|준비|보내|올리|제출|확인)/;

// 한 줄 → { task_id | '', attach_as, content, new_title, category_id, due_date }
export function triageText(text, tasks, categories, today) {
  const scored = tasks
    .map((t) => ({ t, s: Math.max(similarity(text, t.title), similarity(text, t.next_action ?? '') * 0.8) }))
    .sort((x, y) => y.s - x.s);
  const best = scored[0];
  const due = pickDeadline(text, today);
  if (best && best.s >= 0.3) {
    return {
      task_id: best.t.id,
      attach_as: TODO_WORDS.test(text) ? 'step' : 'note',
      content: text.trim(),
      due_date: due,
      candidates: scored.slice(0, 3).filter((x) => x.s > 0).map((x) => x.t.id),
    };
  }
  return {
    task_id: '',
    attach_as: 'new',
    content: text.trim(),
    due_date: due,
    category_id: guessCategoryId(text, categories),
    candidates: scored.slice(0, 3).filter((x) => x.s > 0).map((x) => x.t.id),
  };
}
