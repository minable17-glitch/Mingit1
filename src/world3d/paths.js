// 도서관 안에서 걷는 길 계산 (평면도 칸 좌표 → 장면 좌표)
// 모든 이동은 가운데 통로를 거침: [현재 자리 옆] → 통로 → [목표 자리 옆] → 의자
import { GRID, gx, gz } from './library.js';

export const AISLE_X = GRID.w / 2;                 // 가운데 통로의 x(칸)
export const ENTRY_CELL = [22.0, 68.4];            // 입구 문 바로 안쪽
export const GARDEN_DOOR_CELL = [1.6, 5.5];        // 정원 문 바로 안쪽
const toWorld = ([cx, cy]) => ({ x: gx(cx), z: gz(cy) });

// 통로에서 좌석 옆(앉기 직전에 서는 곳)까지의 길. 칸 좌표 배열, 첫 점은 통로 위
export function seatRouteCells(seat) {
  const [chx, chy] = seat.chair;
  if (seat.kind === 'window') return [[AISLE_X, chy + 1.4], [chx, chy + 1.4]];
  const ox = -seat.face[0], oy = -seat.face[1];           // 모둠 가운데에서 의자 쪽(바깥) 방향
  const cx = chx - ox * 4, cy = chy - oy * 4;             // 모둠 가운데
  const a = cx < AISLE_X ? 1 : -1;                        // 통로가 있는 쪽
  if (ox === a) return [[AISLE_X, cy - 1.5], [cx + 4.2 * a, cy - 1.5]];                               // 통로 쪽 자리
  if (oy === -1) return [[AISLE_X, cy - 2.9], [cx + 2.9 * a, cy - 3.3], [cx + 1.7 * a, cy - 4.4]];    // 위쪽 자리
  if (oy === 1) return [[AISLE_X, cy + 2.9], [cx + 2.9 * a, cy + 3.3], [cx + 1.7 * a, cy + 4.4]];     // 아래쪽 자리
  return [[AISLE_X, cy + 2.9], [cx + 2.9 * a, cy + 3.3], [cx, cy + 5.6], [cx - 2.9 * a, cy + 3.6], [cx - 4.1 * a, cy + 1.6]];   // 창 쪽 자리(아래로 돌아감)
}
export const seatRoute = (seat) => seatRouteCells(seat).map(toWorld);

// from: { seat } 또는 { x, z }(통로·입구 등 자유 위치) → to: { seat } 또는 { x, z }
// 돌려주는 값: 걸어갈 점들의 배열(장면 좌표). 마지막 점이 좌석이면 그 자리 옆
export function planPath(from, to) {
  const pts = [];
  if (from.seat) pts.push(...seatRoute(from.seat).reverse());
  else pts.push({ x: gx(AISLE_X), z: from.z });           // 일단 통로로
  if (to.seat) pts.push(...seatRoute(to.seat));
  else pts.push({ x: gx(AISLE_X), z: to.z }, { x: to.x, z: to.z });
  // 거의 같은 점이 이어지면 하나로
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.02);
}

// 통로 안에서만 자유롭게 걸을 수 있음: 바닥을 누른 곳을 통로 위의 점으로 바꿈
export function clampToAisle(x, z) {
  const half = 1.7 * 0.3;
  return { x: Math.max(gx(AISLE_X) - half, Math.min(gx(AISLE_X) + half, x)), z: Math.max(gz(3), Math.min(gz(GRID.d - 1.5), z)) };
}
export const entryPoint = () => toWorld(ENTRY_CELL);
