// 업무 밸런스: 소홀(못 챙김)·급함·과중을 한눈에 (순수 함수, 테스트 가능)
// 업무량 = 남은 단계 수 (단계를 아직 안 정한 업무는 1로 셈)
import { addDays, diffDays } from './date.js';
import { assess } from './briefing.js';
import { blockerDelayed } from './links.js';

export const HEAVY_LOAD = 4; // 남은 단계가 이만큼이면 '많은' 업무
const HORIZON_DAYS = 14;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export function taskLoad(task) {
  const steps = task.steps ?? [];
  if (!steps.length) return { load: 1, unknownSize: true };
  return { load: Math.max(1, steps.filter((s) => !s.done).length), unknownSize: false };
}

// 위험(마감 지남·임박) / 주의(방치·무응답·앞 업무 지연) / 순조
export function taskState(task, info, links, tasksById, today, settings) {
  if (info.overdue || info.dueSoon) return 'critical';
  if (info.neglected || info.noReply || blockerDelayed(task.id, links, tasksById, today, settings)) return 'warning';
  return 'good';
}

// 급한 정도 0(여유)~1(마감 지남)
export function urgencyOf(info) {
  if (info.daysLeft === null) return 0.04;
  if (info.daysLeft < 0) return 1;
  return Math.max(0.12, 0.92 - Math.min(info.daysLeft, 20) * 0.04);
}

const label = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}(${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
};

export function analyzeBalance(tasks, categories, settings, links = [], today) {
  const tasksById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const points = tasks.map((task) => {
    const info = assess(task, today, settings.neglect_days, settings.waiting_days);
    const { load, unknownSize } = taskLoad(task);
    return {
      task, info, load, unknownSize,
      state: taskState(task, info, links, tasksById, today, settings),
      urgency: urgencyOf(info),
      forgotten: info.neglected || info.noReply,
      heavy: load >= HEAVY_LOAD,
      urgent: info.overdue || info.dueSoon,
    };
  });

  const total = points.reduce((s, p) => s + p.load, 0) || 1;
  const sum = (pred, w = () => 1) => points.filter(pred).reduce((s, p) => s + p.load * w(p), 0);
  const forgottenLoad = sum((p) => p.forgotten);
  const urgentLoad = sum((p) => p.urgent, (p) => (p.info.overdue ? 1 : 0.6));
  const heavyUrgentLoad = sum((p) => p.heavy && p.urgent);
  const ratios = { forgotten: forgottenLoad / total, urgent: urgentLoad / total, heavyUrgent: heavyUrgentLoad / total };
  const score = points.length
    ? Math.max(0, Math.min(100, Math.round(100 - 45 * ratios.forgotten - 35 * ratios.urgent - 20 * ratios.heavyUrgent)))
    : 100;

  // 분류별: 업무량을 상태별로 나눔
  const byCategory = categories.map((c) => {
    const mine = points.filter((p) => p.task.category_id === c.id);
    const load = { critical: 0, warning: 0, good: 0 };
    for (const p of mine) load[p.state] += p.load;
    return {
      category: c,
      tasks: mine.length,
      load,
      total: load.critical + load.warning + load.good,
      forgotten: mine.filter((p) => p.forgotten),
    };
  }).filter((r) => r.tasks > 0);

  // 앞으로 2주 동안 날짜별 마감 수 (업무 마감 + 남은 단계 마감)
  const dueDates = [];
  for (const t of tasks) {
    if (t.due_date) dueDates.push(t.due_date);
    for (const s of t.steps ?? []) if (!s.done && s.due_date) dueDates.push(s.due_date);
  }
  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, label: label(date), weekday: WEEKDAY[dow], weekend: dow === 0 || dow === 6, count: dueDates.filter((d) => d === date).length };
  });
  const overdueItems = dueDates.filter((d) => diffDays(today, d) < 0).length;
  const peak = [...days].sort((a, b) => b.count - a.count)[0];

  // 한 줄씩 짚어 주기 (가장 기울게 만드는 것부터)
  const notes = [];
  const worstCat = [...byCategory].sort((a, b) => b.forgotten.length - a.forgotten.length)[0];
  if (worstCat?.forgotten.length) {
    notes.push({ kind: 'forgotten', text: `${worstCat.category.name}: ${settings.neglect_days}일 넘게 못 챙긴 업무 ${worstCat.forgotten.length}개` });
  }
  const heavyUrgent = points.filter((p) => p.heavy && p.urgent).sort((a, b) => b.urgency - a.urgency)[0];
  if (heavyUrgent) notes.push({ kind: 'heavy', text: `급한데 남은 단계가 많아요: ${heavyUrgent.task.title} (단계 ${heavyUrgent.load}개)` });
  if (peak && peak.count >= 3) notes.push({ kind: 'peak', text: `${peak.label}에 마감 ${peak.count}개가 몰려 있어요` });
  const overdue = points.filter((p) => p.info.overdue).length;
  if (overdue) notes.push({ kind: 'overdue', text: `마감이 지난 업무 ${overdue}개` });

  return {
    points, score, ratios, byCategory, days, overdueItems, notes,
    level: score >= 80 ? '균형 잡힘' : score >= 60 ? '조금 기울어짐' : '많이 기울어짐',
    counts: {
      forgotten: points.filter((p) => p.forgotten).length,
      urgent: points.filter((p) => p.urgent).length,
      heavy: points.filter((p) => p.heavy).length,
      total: points.length,
    },
    // 저울: 왼쪽 = 챙기고 있는 업무량, 오른쪽 = 밀린 업무량(못 챙김·마감 지남)
    scale: {
      cared: points.filter((p) => !p.forgotten && !p.info.overdue).length,
      behind: points.filter((p) => p.forgotten || p.info.overdue).length,
      tilt: Math.round(((100 - score) / 100) * 16), // 기울기(도)
    },
  };
}

// 업무 지도의 네 칸
export function quadrantOf(point) {
  if (point.urgent) return point.heavy ? 'focus' : 'quick';
  return point.heavy ? 'split' : 'later';
}

export const QUADRANTS = {
  focus: { label: '지금 집중', hint: '급하고 남은 일이 많아요' },
  quick: { label: '빨리 끝내기', hint: '급하지만 금방 끝나요' },
  split: { label: '미리 쪼개 두기', hint: '여유 있지만 일이 많아요' },
  later: { label: '틈날 때', hint: '여유 있고 가벼워요' },
};
