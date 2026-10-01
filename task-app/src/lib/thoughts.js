// 생각 노트: 종류·날짜 묶기·오늘의 원칙 (순수 함수, 테스트 가능)
import { addDays } from './date.js';

export const KINDS = [
  { key: 'thought', icon: '💭', label: '생각' },
  { key: 'principle', icon: '📌', label: '원칙' },
  { key: 'idea', icon: '💡', label: '아이디어' },
  { key: 'lesson', icon: '📝', label: '배운 점' },
];
export const kindOf = (key) => KINDS.find((k) => k.key === key) ?? KINDS[0];

const KST = 9 * 3600e3;
const createdAt = (t) => t.created_at ?? new Date().toISOString();
const dateKST = (iso) => new Date(Date.parse(iso) + KST).toISOString().slice(0, 10);

// 검색어·종류로 거르고 날짜별로 묶기: [{ date, label, items }]
export function groupThoughts(thoughts, { kind = '', query = '' } = {}, today) {
  const q = query.trim().toLowerCase();
  const list = thoughts.filter((t) => (!kind || t.kind === kind) && (!q || t.body.toLowerCase().includes(q)))
    .sort((a, b) => createdAt(b).localeCompare(createdAt(a)));
  const groups = [];
  for (const t of list) {
    const date = dateKST(createdAt(t));
    let g = groups.find((x) => x.date === date);
    if (!g) {
      const [, m, d] = date.split('-').map(Number);
      const label = date === today ? '오늘' : date === addDays(today, -1) ? '어제' : `${m}월 ${d}일`;
      g = { date, label, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }
  return groups;
}

// 오늘의 원칙: 고정한 원칙 중 날짜마다 하나씩 돌아가며
export function principleOfDay(thoughts, today) {
  const ps = thoughts.filter((t) => t.kind === 'principle' || t.pinned).sort((a, b) => createdAt(a).localeCompare(createdAt(b)));
  if (!ps.length) return null;
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 864e5);
  return ps[day % ps.length];
}

// 아이디어 → 업무 초안 이름 (첫 줄, 40자)
export function titleFromThought(body) {
  const first = body.trim().split(/\n/)[0].replace(/^[-*•\s]+/, '');
  return first.length > 40 ? `${first.slice(0, 39)}…` : first;
}
