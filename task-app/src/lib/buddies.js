// 업무 친구: 업무마다 캐릭터 하나. 최근에 챙길수록 크고, 오래 안 챙기면 작아지고 졸아요.
// 급하면 땀을 흘리고, 남은 단계 수는 캐릭터 왼쪽 위 숫자로. (순수 함수, 테스트 가능)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MOODS = {
  happy: { label: '신남', emoji: '😊' },
  calm: { label: '괜찮음', emoji: '🙂' },
  sleepy: { label: '시들함', emoji: '😪' },
  waiting: { label: '기다림', emoji: '⏳' },
  worried: { label: '조마조마', emoji: '😰' },
  panic: { label: '비상', emoji: '😱' },
};

// point: analyzeBalance().points 의 한 항목
export function buddyOf(point, neglectDays) {
  const { info, task, load, unknownSize } = point;
  const mood = info.overdue ? 'panic'
    : info.dueSoon ? 'worried'
      : info.noReply ? 'waiting'
        : info.neglected ? 'sleepy'
          : info.idle <= 1 ? 'happy' : 'calm';
  // 챙긴 정도: 오늘 손댔으면 1, 방치 기준일의 2.5배가 지나면 0
  const care = clamp(1 - info.idle / (Math.max(1, neglectDays) * 2.5), 0, 1);
  const steps = task.steps ?? [];
  const progress = steps.length ? steps.filter((s) => s.done).length / steps.length : 0;
  const size = Math.round((0.55 + 0.5 * care + 0.15 * progress) * 100) / 100; // 0.55 ~ 1.2
  return { mood, size, care, progress, boxes: unknownSize ? 0 : load, message: messageOf(mood, point) };
}

function messageOf(mood, { info, task, load, unknownSize }) {
  const parts = [];
  if (mood === 'panic') parts.push(`마감이 ${-info.daysLeft}일 지났어요! 도와주세요.`);
  if (mood === 'worried') parts.push(info.daysLeft === 0 ? '오늘이 마감이에요!' : `마감까지 ${info.daysLeft}일 남았어요.`);
  if (mood === 'waiting') parts.push(`${info.waitDays}일째 ${task.waiting_on ?? '회신'}을(를) 기다리고 있어요.`);
  if (mood === 'sleepy') parts.push(`${info.idle}일째 못 챙겨서 작아졌어요. 한 단계만 해도 다시 커져요.`);
  if (mood === 'happy') parts.push('최근에 챙겨서 쑥쑥 크고 있어요.');
  if (mood === 'calm') parts.push(`${info.idle}일 전에 마지막으로 챙겼어요.`);
  if (unknownSize) parts.push('아직 단계가 없어요. 단계를 정하면 왼쪽 위에 남은 단계 수가 보여요.');
  else parts.push(`왼쪽 위 숫자 = 남은 단계 ${load}개.`);
  return parts.join(' ');
}

// 정원 요약: 기분별 수
export function moodCounts(buddies) {
  const out = Object.fromEntries(Object.keys(MOODS).map((k) => [k, 0]));
  for (const b of buddies) out[b.mood] += 1;
  return out;
}
