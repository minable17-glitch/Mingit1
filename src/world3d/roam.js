// 자유롭게 걸어 다니기 부품 — 도서관·정원이 함께 씀
//  · NavGrid: 바닥을 작은 칸으로 나눠 가구가 있는 칸을 막고, 막히지 않은 길을 찾음(A*)
//  · CameraRig: 위에서 보기 / 뒤에서 보기(3인칭) / 1인칭 카메라
//  · stepJoystick: 조이스틱 방향으로 한 걸음(가구에 부딪히면 미끄러지듯 비켜감)
import * as THREE from 'three';

export class NavGrid {
  // bounds: { x0, x1, z0, z1 } 걸을 수 있는 바깥 경계. inside(x, z): 경계 안쪽 모양을 더 좁히고 싶을 때(타원 마당 등)
  constructor(bounds, cell = 0.14, inside = null) {
    this.b = bounds; this.cell = cell; this.inside = inside;
    this.w = Math.ceil((bounds.x1 - bounds.x0) / cell); this.h = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.block = new Uint8Array(this.w * this.h);
    if (inside) for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { const [x, z] = this.center(i, j); if (!inside(x, z)) this.block[j * this.w + i] = 1; }
  }
  center(i, j) { return [this.b.x0 + (i + 0.5) * this.cell, this.b.z0 + (j + 0.5) * this.cell]; }
  idx(x, z) { const i = Math.floor((x - this.b.x0) / this.cell), j = Math.floor((z - this.b.z0) / this.cell); return i < 0 || j < 0 || i >= this.w || j >= this.h ? -1 : j * this.w + i; }
  walkable(x, z) { const k = this.idx(x, z); return k >= 0 && !this.block[k]; }
  // 원 모양 장애물(반지름 r, 캐릭터 몸 두께 pad 만큼 넓힘)
  circle(x, z, r, pad = 0.17) { this._fill(x - r - pad, x + r + pad, z - r - pad, z + r + pad, (px, pz) => Math.hypot(px - x, pz - z) <= r + pad); }
  // 회전된 사각형 장애물(가로 w, 세로 d, 회전 ry)
  rect(x, z, w, d, ry = 0, pad = 0.17) {
    const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2 + pad, hd = d / 2 + pad, R = Math.hypot(hw, hd);
    this._fill(x - R, x + R, z - R, z + R, (px, pz) => { const dx = px - x, dz = pz - z; const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= hw && Math.abs(lz) <= hd; });
  }
  _fill(x0, x1, z0, z1, test) {
    const i0 = Math.max(0, Math.floor((x0 - this.b.x0) / this.cell)), i1 = Math.min(this.w - 1, Math.floor((x1 - this.b.x0) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - this.b.z0) / this.cell)), j1 = Math.min(this.h - 1, Math.floor((z1 - this.b.z0) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [px, pz] = this.center(i, j); if (test(px, pz)) this.block[j * this.w + i] = 1; }
  }
  nearest(x, z) {
    if (this.walkable(x, z)) return { x, z };
    for (let r = 1; r < 40; r++) for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2, px = x + Math.cos(t) * r * this.cell, pz = z + Math.sin(t) * r * this.cell; if (this.walkable(px, pz)) return { x: px, z: pz }; }
    return { x, z };
  }
  // 두 점 사이를 막힘 없이 곧게 갈 수 있는지
  clear(a, b) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / (this.cell * 0.5)); for (let k = 1; k < n; k++) { const t = k / n; if (!this.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false; } return true; }
  // 길찾기: 점 배열(시작점 제외). 못 찾으면 null
  path(from, to) {
    const s = this.nearest(from.x, from.z), g = this.nearest(to.x, to.z);
    const si = this.idx(s.x, s.z), gi = this.idx(g.x, g.z); if (si < 0 || gi < 0) return null;
    if (this.clear(s, g)) return [g];
    const W = this.w, n = W * this.h, cost = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
    const gx = gi % W, gz = (gi / W) | 0, hfn = (k) => { const dx = Math.abs((k % W) - gx), dz = Math.abs(((k / W) | 0) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const heap = [[hfn(si), si]]; cost[si] = 0;
    const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    let found = false;
    while (heap.length) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === gi) { found = true; break; }
      const ci = k % W, cj = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= this.h) continue;
        const nk = nj * W + ni; if (this.block[nk] || closed[nk]) continue;
        if (di && dj && (this.block[cj * W + ni] || this.block[nj * W + ci])) continue;   // 모서리 깎아 지나가지 않기
        const c = cost[k] + (di && dj ? 1.414 : 1); if (c < cost[nk]) { cost[nk] = c; prev[nk] = k; push(c + hfn(nk), nk); }
      }
    }
    if (!found) return null;
    const raw = []; for (let k = gi; k !== si && k >= 0; k = prev[k]) { const [x, z] = this.center(k % W, (k / W) | 0); raw.push({ x, z }); } raw.reverse();
    raw[raw.length - 1] = g;
    // 줄 당기기: 곧게 갈 수 있는 점은 건너뜀
    const out = []; let cur = s, i = 0;
    while (i < raw.length) { let j = raw.length - 1; while (j > i && !this.clear(cur, raw[j])) j--; out.push(raw[j]); cur = raw[j]; i = j + 1; }
    return out;
  }
}

// 조이스틱 한 걸음: input {x, y}(-1~1, 위가 -y), camYaw 기준으로 움직임. 움직였으면 true
export function stepJoystick(root, nav, input, camYaw, speed, dt) {
  const mag = Math.min(1, Math.hypot(input.x, input.y)); if (mag < 0.12) return false;
  // 화면 위쪽(-y)이 카메라가 보는 방향
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const mx = (fx * -input.y + rx * input.x) / Math.max(mag, 1e-6), mz = (fz * -input.y + rz * input.x) / Math.max(mag, 1e-6);
  const step = speed * mag * dt, p = root.position;
  const tryMove = (nx, nz) => { if (nav.walkable(nx, nz)) { p.x = nx; p.z = nz; return true; } return false; };
  // 막히면 조금씩 비스듬히 비켜 가 봄(둥근 의자·화분을 스치듯 돌아감)
  if (!tryMove(p.x + mx * step, p.z + mz * step)) {
    let moved = false;
    for (const a of [0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
      const c = Math.cos(a), s = Math.sin(a), k = step * Math.cos(a);
      if (tryMove(p.x + (mx * c + mz * s) * k, p.z + (-mx * s + mz * c) * k)) { moved = true; break; }
    }
    if (!moved) return false;
  }
  const target = Math.atan2(mx, mz); let diff = target - root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); root.rotation.y += diff * Math.min(1, dt * 12);
  return true;
}

// 카메라: mode = 'top'(위에서) | 'third'(뒤에서) | 'first'(1인칭)
export class CameraRig {
  // solid(x, z): 카메라가 들어가면 안 되는 곳(큰 나무·건물 등). 그 앞에서 멈추고 대신 위로 올라감
  constructor(camera, { box, solid = null, topPitch = THREE.MathUtils.degToRad(44) }) {
    this.camera = camera; this.box = box; this.solid = solid;          // box: 카메라가 벗어나지 않을 방 안쪽 경계 { x0, x1, z0, z1, y1 } (없으면 제한 없음)
    this.mode = 'third'; this.yaw = 0; this.pitch = 0.36; this.dist = 3.0; this.topPitch = topPitch;
    this.focus = new THREE.Vector3(); this._init = false;
  }
  // 부드럽게 이 방향으로 돌기(앉았을 때 책상 쪽을 보게 할 때). 화면을 끌면 취소됨
  faceTo(yaw) { this.goalYaw = yaw; }
  snapTo(yaw) { this.yaw = yaw; this.goalYaw = null; }
  drag(dx, dy) {
    this.goalYaw = null;
    this.yaw -= dx * 0.0065;
    if (this.mode === 'first') this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, -0.6, 0.9);
    else this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.05);
  }
  zoom(k) { this.dist = THREE.MathUtils.clamp(this.dist * k, 1.6, 6); }
  setMode(m) { this.mode = m; if (m === 'first') this.pitch = 0.12; else if (m === 'third') this.pitch = 0.36; }
  // pos: 캐릭터 발 위치. 돌려주는 값: 카메라가 움직였는지
  update(dt, pos, seated = false) {
    const k = this._init ? Math.min(1, dt * 8) : 1; this._init = true;
    const before = this.camera.position.clone(), beforeQ = this.camera.quaternion.clone();
    if (this.goalYaw != null) {
      let d = this.goalYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 0.005) { this.yaw = this.goalYaw; this.goalYaw = null; } else this.yaw += d * Math.min(1, dt * 4);
    }
    const eye = this.mode === 'first' ? (seated ? 0.66 : 0.82) : (seated ? 0.85 : 1.0);
    this.focus.lerp(new THREE.Vector3(pos.x, pos.y + eye, pos.z), k);
    if (this.mode === 'first') {
      const look = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.position.copy(this.focus).addScaledVector(look, -0.08);
      this.camera.lookAt(this.focus.clone().add(look));
    } else {
      // 벽(통창) 밖으로 나가지 않게: 뒤로 물러날 자리가 모자라면 그만큼 위로 올라가서 내려다봄
      const hx = Math.sin(this.yaw), hz = Math.cos(this.yaw), f = this.focus;
      let dh = this.dist * Math.cos(this.pitch), h = this.dist * Math.sin(this.pitch);
      if (this.box) {
        const b = this.box; let lim = dh;
        if (hx > 1e-4) lim = Math.min(lim, (b.x1 - f.x) / hx); else if (hx < -1e-4) lim = Math.min(lim, (b.x0 - f.x) / hx);
        if (hz > 1e-4) lim = Math.min(lim, (b.z1 - f.z) / hz); else if (hz < -1e-4) lim = Math.min(lim, (b.z0 - f.z) / hz);
        if (this.solid) for (let t = 0.3; t < lim; t += 0.1) if (this.solid(f.x + hx * t, f.z + hz * t)) { lim = t - 0.15; break; }
        lim = Math.max(0.25, lim);
        if (lim < dh) { h = Math.sqrt(Math.max(0, this.dist * this.dist - lim * lim)); dh = lim; }
        h = Math.min(h, b.y1 - f.y);
      }
      this.camera.position.set(f.x + hx * dh, f.y + h, f.z + hz * dh);
      this.camera.lookAt(this.focus);
    }
    return this.camera.position.distanceToSquared(before) > 1e-8 || 1 - Math.abs(this.camera.quaternion.dot(beforeQ)) > 1e-9;
  }
  // 카메라가 보는 수평 방향의 각도(조이스틱 기준)
  get viewYaw() { return this.yaw; }
}
