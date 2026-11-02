// 길찾기: 층마다 격자를 만들어 장애물(책상·벽·나무…)을 피하고,
// 다른 층으로 갈 때는 가까운 계단을 골라 오르내립니다.
import { NAV_BOUNDS, STAIRS, LEVELS, levelY, levelOfY } from './world.js';

const CELL = 0.5;
const RADIUS = 0.2; // 아바타 몸 두께

function makeGrid(bounds, rects) {
  const W = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
  const D = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
  const cells = new Uint8Array(W * D);
  const ci = (x) => Math.round((x - bounds.minX) / CELL);
  const cj = (z) => Math.round((z - bounds.minZ) / CELL);
  // 가장자리 막기
  for (let i = 0; i < W; i++) {
    cells[i] = 1;
    cells[(D - 1) * W + i] = 1;
  }
  for (let j = 0; j < D; j++) {
    cells[j * W] = 1;
    cells[j * W + W - 1] = 1;
  }
  for (const r of rects) {
    const i0 = Math.max(0, Math.ceil((r.minX - RADIUS - bounds.minX) / CELL));
    const i1 = Math.min(W - 1, Math.floor((r.maxX + RADIUS - bounds.minX) / CELL));
    const j0 = Math.max(0, Math.ceil((r.minZ - RADIUS - bounds.minZ) / CELL));
    const j1 = Math.min(D - 1, Math.floor((r.maxZ + RADIUS - bounds.minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * W + i] = 1;
  }
  const blocked = (x, z) => {
    const i = ci(x);
    const j = cj(z);
    if (i < 0 || j < 0 || i >= W || j >= D) return true;
    return cells[j * W + i] === 1;
  };
  return { W, D, cells, bounds, ci, cj, blocked };
}

// 작은 최소 힙 (A* 용)
class Heap {
  constructor() {
    this.a = [];
  }
  push(f, v) {
    const a = this.a;
    a.push([f, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

export function createNavigator(blocksPerLevel) {
  const grids = NAV_BOUNDS.map((b, k) => makeGrid(b, blocksPerLevel[k]));

  const clearLine = (g, a, b) => {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.ceil(dist / 0.2);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (g.blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  };

  function nearestFree(g, i, j, maxR = 6) {
    if (!g.cells[j * g.W + i]) return [i, j];
    for (let r = 1; r <= maxR; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni > 0 && nj > 0 && ni < g.W && nj < g.D && !g.cells[nj * g.W + ni]) return [ni, nj];
        }
      }
    }
    return null;
  }

  // 같은 층 안에서 길 찾기 → [{x,z}] (마지막은 정확히 to)
  function planar(k, from, to) {
    const g = grids[k];
    if (clearLine(g, from, to)) return [{ x: to.x, z: to.z }];
    const clampI = (v) => Math.max(0, Math.min(g.W - 1, v));
    const clampJ = (v) => Math.max(0, Math.min(g.D - 1, v));
    const s = nearestFree(g, clampI(g.ci(from.x)), clampJ(g.cj(from.z)));
    const t = nearestFree(g, clampI(g.ci(to.x)), clampJ(g.cj(to.z)));
    if (!s || !t) return null;
    const W = g.W;
    const start = s[1] * W + s[0];
    const goal = t[1] * W + t[0];
    const gScore = new Float32Array(W * g.D).fill(Infinity);
    const came = new Int32Array(W * g.D).fill(-1);
    const closed = new Uint8Array(W * g.D);
    const h = (idx) => {
      const dx = Math.abs((idx % W) - t[0]);
      const dz = Math.abs(((idx / W) | 0) - t[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    const heap = new Heap();
    gScore[start] = 0;
    heap.push(h(start), start);
    const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = start === goal;
    while (heap.size && !found) {
      const [, cur] = heap.pop();
      if (closed[cur]) continue;
      if (cur === goal) {
        found = true;
        break;
      }
      closed[cur] = 1;
      const ci = cur % W;
      const cj = (cur / W) | 0;
      for (const [di, dj, cost] of nb) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= g.D) continue;
        const n = nj * W + ni;
        if (g.cells[n] || closed[n]) continue;
        if (di && dj && (g.cells[cj * W + ni] || g.cells[nj * W + ci])) continue;
        const ng = gScore[cur] + cost;
        if (ng < gScore[n]) {
          gScore[n] = ng;
          came[n] = cur;
          heap.push(ng + h(n), n);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = came[c]) cells.push({ x: g.bounds.minX + (c % W) * CELL, z: g.bounds.minZ + ((c / W) | 0) * CELL });
    cells.reverse();
    cells.push({ x: to.x, z: to.z });
    // 지름길로 다듬기
    const out = [];
    let anchor = { x: from.x, z: from.z };
    let i = 0;
    while (i < cells.length) {
      let far = i;
      for (let m = cells.length - 1; m > i; m--) {
        if (clearLine(g, anchor, cells[m])) {
          far = m;
          break;
        }
      }
      out.push(cells[far]);
      anchor = cells[far];
      i = far + 1;
    }
    return out;
  }

  // 계단 한 번 오르기(k → k+1) 경로점. 내려갈 땐 거꾸로.
  function stairPoints(st, k, up) {
    const L = levelY(k);
    const pts = [
      { x: st.xA, z: st.zCorr, y: L },
      { x: st.xA, z: st.zFlightEnd, y: L + 1.8 },
      { x: st.xA, z: st.zLanding, y: L + 1.8 },
      { x: st.xB, z: st.zLanding, y: L + 1.8 },
      { x: st.xB, z: st.zFlightEnd, y: L + 1.8 },
      { x: st.xB, z: st.zCorr, y: L + 3.6 },
    ].map((p) => ({ ...p, stair: true }));
    const entry = up ? { x: st.xA, z: st.zEntry } : { x: st.xB, z: st.zEntry };
    const exit = up ? { x: st.xB, z: st.zEntry } : { x: st.xA, z: st.zEntry };
    return { entry, pts: up ? pts : pts.reverse(), exit };
  }

  const length = (from, pts) => {
    let d = 0;
    let p = from;
    for (const q of pts) {
      d += Math.hypot(q.x - p.x, q.z - p.z);
      p = q;
    }
    return d;
  };

  // from{x,y,z} → to{x,y,z}. 경로점 목록 또는 null
  function findPath(from, to) {
    const la = levelOfY(from.y ?? 0);
    const lb = levelOfY(to.y ?? 0);
    if (grids[lb].blocked(to.x, to.z) && !to.allowBlocked) return null;
    if (la === lb) return planar(la, from, to);
    let best = null;
    for (const st of STAIRS) {
      const out = [];
      let cur = from;
      let ok = true;
      const up = lb > la;
      for (let k = la; k !== lb; k += up ? 1 : -1) {
        const s = stairPoints(st, up ? k : k - 1, up);
        const seg = planar(k, cur, s.entry);
        if (!seg) {
          ok = false;
          break;
        }
        out.push(...seg, ...s.pts, s.exit);
        cur = s.exit;
      }
      if (!ok) continue;
      const last = planar(lb, cur, to);
      if (!last) continue;
      out.push(...last);
      const len = length(from, out);
      if (!best || len < best.len) best = { len, out };
    }
    return best ? best.out : null;
  }

  return {
    findPath,
    blockedAt: (x, z, y) => grids[levelOfY(y ?? 0)].blocked(x, z),
    levels: LEVELS,
  };
}
