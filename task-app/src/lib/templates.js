// 자주 하는 업무 템플릿: 최종 마감 기준 상대 날짜로 저장하고, 쓸 때 실제 날짜로 바꿈
import { addDays, diffDays } from './date.js';

// 주말이면 바로 앞 금요일로 (학교 업무는 평일에 처리하므로)
export function toWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 6) return addDays(dateStr, -1);
  if (wd === 0) return addDays(dateStr, -2);
  return dateStr;
}

// 템플릿 → 단계 목록 (마감이 없으면 단계 날짜도 비움). 최종 마감일 당일 단계는 그대로 둠.
export function stepsFromTemplate(template, dueDate) {
  return (template.steps ?? []).map((s) => {
    if (!dueDate || !Number.isInteger(s.offset_days)) return { title: s.title, due_date: '' };
    const date = addDays(dueDate, s.offset_days);
    return { title: s.title, due_date: s.offset_days === 0 ? date : toWeekday(date) };
  });
}

// 진행 중/완료 업무 → 템플릿 단계 (최종 마감 기준 며칠 전인지)
export function templateStepsFromTask(task) {
  return [...(task.steps ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      title: s.title,
      offset_days: task.due_date && s.due_date ? diffDays(task.due_date, s.due_date) : null,
    }));
}

export const DEFAULT_TEMPLATES = [
  {
    name: '품의',
    category: '행정업무',
    next_action: '품의할 물품·금액 목록 정리하기',
    steps: [
      { title: '필요 물품·수량 정리하기', offset_days: -10 },
      { title: '견적 2곳 이상 받기', offset_days: -7 },
      { title: '품의서 작성해 K-에듀파인 기안하기', offset_days: -5 },
      { title: '결재 확인하기', offset_days: -2 },
      { title: '구매·검수하기', offset_days: 0 },
    ],
  },
  {
    name: '출장',
    category: '행정업무',
    next_action: '출장 공문·일정 확인하기',
    steps: [
      { title: '출장 신청(복무) 올리기', offset_days: -3 },
      { title: '수업 교체·보강 요청하기', offset_days: -2 },
      { title: '출장 다녀오기', offset_days: 0 },
      { title: '여비 정산·결과 보고하기', offset_days: 3 },
    ],
  },
  {
    name: '평가계획',
    category: '수업',
    next_action: '작년 평가계획 파일 찾아 열기',
    steps: [
      { title: '성취기준·평가 요소 정하기', offset_days: -14 },
      { title: '수행평가 과제·채점 기준표 만들기', offset_days: -10 },
      { title: '교과협의회 협의하기', offset_days: -7 },
      { title: '평가계획서 작성해 기안하기', offset_days: -3 },
      { title: '학업성적관리위원회 심의 확인하기', offset_days: 0 },
    ],
  },
];
