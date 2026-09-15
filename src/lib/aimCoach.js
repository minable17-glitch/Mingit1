// 조준기(사이트) 보정 코치 — "Follow the arrow" 규칙
// 화살이 몰린 방향과 "같은" 방향으로 사이트를 옮기게 안내한다.
// (사이트를 그 방향으로 옮기면, 다시 조준하며 활 전체가 반대로 보정되어
//  다음 화살이 중앙으로 온다)

export const MIN_MARKERS_FOR_ADVICE = 3;
const CENTER_THRESHOLD_RATIO = 0.1; // 과녁 반지름의 10% 이내면 "중앙 양호"

// markers: [{x, y}], 과녁 중심이 (0,0), 반지름 1인 정규화 좌표.
// x: -1(왼쪽) ~ 1(오른쪽), y: -1(아래) ~ 1(위)
export function computeGroupCenter(markers) {
  if (!markers || markers.length === 0) return { x: 0, y: 0 };
  const sum = markers.reduce((acc, m) => ({ x: acc.x + m.x, y: acc.y + m.y }), { x: 0, y: 0 });
  return { x: sum.x / markers.length, y: sum.y / markers.length };
}

export function computeAimAdvice(markers, targetRadius = 1) {
  const center = computeGroupCenter(markers);
  const count = markers ? markers.length : 0;

  if (count < MIN_MARKERS_FOR_ADVICE) {
    return {
      center,
      ready: false,
      onTarget: null,
      message: `최소 ${MIN_MARKERS_FOR_ADVICE}발 이상 기록되면 조준 보정 안내를 받을 수 있어요. (현재 ${count}발)`,
    };
  }

  const threshold = targetRadius * CENTER_THRESHOLD_RATIO;
  const offX = Math.abs(center.x) > threshold;
  const offY = Math.abs(center.y) > threshold;

  if (!offX && !offY) {
    return {
      center,
      ready: true,
      onTarget: true,
      message: '탄착군이 중앙에 잘 모여 있어요. 지금 사이트 세팅을 그대로 유지하세요.',
    };
  }

  const groupParts = [];
  const sightParts = [];
  let xDir = null;
  let yDir = null;

  if (offX) {
    xDir = center.x < 0 ? 'left' : 'right';
    groupParts.push(xDir === 'left' ? '왼쪽' : '오른쪽');
    sightParts.push(xDir === 'left' ? '왼쪽으로' : '오른쪽으로');
  }
  if (offY) {
    yDir = center.y > 0 ? 'up' : 'down';
    groupParts.push(yDir === 'up' ? '위쪽' : '아래쪽');
    sightParts.push(yDir === 'up' ? '위로' : '아래로');
  }

  const message =
    `화살이 ${groupParts.join(' ')}에 몰렸어요. ` +
    `사이트를 ${sightParts.join(', ')} 조금씩 옮겨 보세요. ` +
    `한 번에 조금만 옮기고, 다시 쏴서 확인하세요.`;

  return { center, ready: true, onTarget: false, message, directions: { x: xDir, y: yDir } };
}
