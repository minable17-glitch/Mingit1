// 도서관 3D 장면 엔진 — 그리기, 카메라, 터치, 걷기, 앉기, 친구 표시
// React와 분리된 순수 클래스. 화면(Library3D.jsx)이 만들고, 이벤트로만 소통함.
import * as THREE from 'three';
import { Avatar, LOOKS } from './avatar.js';
import { buildLibrary, GRID, CELL } from './library.js';
import { planPath, clampToAisle, entryPoint } from './paths.js';

const SIT_Y = 0.05, WALK_SPEED = 1.9, PITCH = THREE.MathUtils.degToRad(44), FOV = 30;
const lookOf = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % LOOKS.length; };

export { lookOf };
export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

export function nameTag(text, mine) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80; const g = c.getContext('2d');
  g.font = "600 34px 'Jua', 'Gowun Dodum', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  const label = text.length > 7 ? text.slice(0, 6) + '…' : text, w = Math.min(240, g.measureText(label).width + 44);
  const x = (256 - w) / 2; g.beginPath(); if (g.roundRect) g.roundRect(x, 12, w, 56, 28); else g.rect(x, 12, w, 56); g.fillStyle = mine ? '#FFFFFF' : '#FFFFFFD9'; g.fill();
  if (mine) { g.lineWidth = 6; g.strokeStyle = '#EDA83A'; g.stroke(); }
  g.fillStyle = '#3F7E4E'; g.fillText(label, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(0.92, 0.29, 1); s.position.y = 1.2; s.renderOrder = 10; return s;
}

export class LibraryWorld {
  // opts: { me: { id, nick } | null, lastSeat, onEvent(type, payload) }
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.opts = opts; this.emit = opts.onEvent || (() => {});
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#9FD3F0');
    this.lib = buildLibrary(this.scene);
    this.lib.faceBackdrop(PITCH);
    this.seats = new Map(this.lib.seats.map((s) => [s.id, s]));
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
    this.camZ = 0; this.camX = 0; this.panZ = 0; this.panX = 0; this.near = true; this.dist = 20;
    this.people = new Map();            // id → { avatar, tag, seat, state, walk, anchor }
    this.paused = false; this.disposed = false; this.reading = false;
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.clock = new THREE.Clock();

    // 내 자리 표시(금색 고리)
    this.seatRing = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 40), new THREE.MeshBasicMaterial({ color: '#EDA83A', transparent: true, opacity: 0.9, depthWrite: false }));
    this.seatRing.rotation.x = -Math.PI / 2; this.seatRing.position.y = 0.02; this.seatRing.visible = false; this.seatRing.renderOrder = 3; this.scene.add(this.seatRing);

    if (opts.me) {
      const e = entryPoint();
      this.me = this._addPerson(opts.me.id, opts.me.nick, true);
      this.me.avatar.root.position.set(e.x, 0, e.z); this.me.avatar.root.rotation.y = -Math.PI / 2; this.me.anchor = { x: e.x, z: e.z };
    }
    this._bind(); this.resize();
    this._raf = requestAnimationFrame(() => this._frame());
    // 지난번 자리가 비어 있으면 그 자리로 걸어감(친구 정보가 도착한 뒤에 판단)
    this._wantSeat = opts.lastSeat || null;
  }

  // ── 사람 추가/삭제
  _addPerson(id, nick, mine = false) {
    const avatar = new Avatar(LOOKS[lookOf(id)]);
    avatar.lookUp = 0.3; avatar.setState('idle'); avatar.update(0);
    const tag = nameTag(nick || '친구', mine); avatar.root.add(tag);
    this.scene.add(avatar.root);
    const p = { id, nick, avatar, tag, seat: null, state: 'stand', walk: null, anchor: null, mine, seatAt: 0 };
    this.people.set(id, p); return p;
  }
  _removePerson(id) { const p = this.people.get(id); if (!p) return; this.scene.remove(p.avatar.root); p.tag.material.map.dispose(); p.tag.material.dispose(); this.people.delete(id); }

  _poseFor(p) { return p.seat ? (p.state === 'read' ? 'read' : 'sit') : 'idle'; }
  _placeSeated(p) {
    const s = this.seats.get(p.seat); if (!s) return;
    p.avatar.root.position.set(s.x - Math.sin(s.rotY) * 0.05, SIT_Y, s.z - Math.cos(s.rotY) * 0.05);
    p.avatar.root.rotation.y = s.rotY; p.avatar.setState(this._poseFor(p)); p.avatar.update(0);
  }
  _stand(p, x, z) { p.avatar.root.position.set(x, 0, z); p.avatar.setState('idle'); p.avatar.update(0); p.anchor = { x, z }; }

  // 걷기 시작: 점들을 차례로 지나고, 끝나면 done()
  _walk(p, points, done) {
    if (!points.length) { done?.(); return; }
    p.avatar.root.position.y = 0; p.avatar.setState('walk'); p.walk = { points, i: 0, done };
    if (p.mine) { this.panZ = 0; this.panX = 0; }
  }
  _stepWalk(p, dt) {
    const w = p.walk, pos = p.avatar.root.position; let left = WALK_SPEED * dt;
    while (left > 0 && w.i < w.points.length) {
      const t = w.points[w.i], dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) { const target = Math.atan2(dx, dz); let diff = target - p.avatar.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.avatar.root.rotation.y += diff * Math.min(1, dt * 14); }
      if (d <= left) { pos.x = t.x; pos.z = t.z; left -= d; w.i += 1; } else { pos.x += (dx / d) * left; pos.z += (dz / d) * left; left = 0; }
    }
    p.avatar.update(dt);
    if (w.i >= w.points.length) { p.walk = null; const done = w.done; done?.(); }
  }

  // ── 자리 이동(나·친구 공통)
  _moveToSeat(p, seatId, instant = false) {
    const from = p.seat && this.seats.get(p.seat) ? { seat: this.seats.get(p.seat) } : (p.anchor || { x: 0, z: p.avatar.root.position.z });
    p.seat = seatId; p.anchor = null;
    const seat = this.seats.get(seatId); if (!seat) return;
    if (instant) { p.walk = null; this._placeSeated(p); return; }
    this._walk(p, planPath(from, { seat }), () => this._placeSeated(p));
  }
  _leaveSeat(p, to) {
    const from = p.seat && this.seats.get(p.seat) ? { seat: this.seats.get(p.seat) } : (p.anchor || { x: 0, z: p.avatar.root.position.z });
    p.seat = null; p.state = 'stand';
    this._walk(p, planPath(from, to), () => this._stand(p, to.x, to.z));
  }
  occupantOf(seatId) { for (const p of this.people.values()) if (p.seat === seatId) return p; return null; }

  // ── 밖에서 부르는 것들
  // 친구 목록 갱신: [{ id, nick, seat, state, seatAt }]
  setOthers(list) {
    const first = !this._synced; this._synced = true;
    const ids = new Set(list.map((o) => o.id));
    for (const id of [...this.people.keys()]) if (!ids.has(id) && !(this.me && id === this.me.id)) this._removePerson(id);
    let lobby = 0;
    for (const o of list) {
      if (this.me && o.id === this.me.id) continue;
      let p = this.people.get(o.id); const isNew = !p;
      if (isNew) p = this._addPerson(o.id, o.nick);
      p.seatAt = o.seatAt || 0;
      const seat = o.seat && this.seats.has(o.seat) ? o.seat : null;
      if (seat !== p.seat) {
        if (seat) this._moveToSeat(p, seat, isNew);
        else { const e = entryPoint(), to = { x: e.x - 0.5 - (lobby % 4) * 0.5, z: e.z - 0.9 - Math.floor(lobby / 4) * 0.6 }; lobby += 1; if (isNew) { p.seat = null; this._stand(p, to.x, to.z); } else this._leaveSeat(p, to); }
      } else if (!seat && isNew) { const e = entryPoint(); this._stand(p, e.x - 0.5 - (lobby % 4) * 0.5, e.z - 0.9); lobby += 1; }
      if (p.state !== o.state) { p.state = o.state || 'stand'; if (p.seat && !p.walk) this._placeSeated(p); }
    }
    // 같은 자리를 둘이 골랐으면 먼저 고른 사람이 앉고, 내가 늦었으면 일어남
    if (this.me && this.me.seat) {
      for (const o of list) if (o.id !== this.me.id && o.seat === this.me.seat && ((o.seatAt || 0) < this.me.seatAt || ((o.seatAt || 0) === this.me.seatAt && String(o.id) < String(this.me.id)))) { this._bumped(); break; }
    }
    if (first && this.me && this._wantSeat && !this.me.seat) { const s = this._wantSeat; this._wantSeat = null; if (this.seats.has(s) && !this.occupantOf(s)) this.sitAt(s); }
    this._dirty = true;
  }
  _bumped() {
    const z = this.me.avatar.root.position.z; const to = clampToAisle(0, z);
    this._leaveSeat(this.me, to); this.seatRing.visible = false;
    this.emit('bumped'); this._announce();
  }
  _announce() { if (this.me) this.emit('me', { seat: this.me.seat, state: this.me.seat ? (this.reading ? 'read' : 'sit') : 'stand', seatAt: this.me.seatAt }); }

  sitAt(seatId) {
    if (!this.me || this.me.seat === seatId) return false;
    const occ = this.occupantOf(seatId); if (occ && occ !== this.me) return false;
    this.me.seatAt = Date.now(); this.me.state = this.reading ? 'read' : 'sit';
    this._moveToSeat(this.me, seatId);
    const s = this.seats.get(seatId); this.seatRing.position.set(s.x, 0.02, s.z); this.seatRing.visible = true;
    this.panZ = 0; this.panX = 0; this._announce(); return true;
  }
  // 가장 가까운 빈자리에 앉기(읽기 시작을 눌렀는데 아직 서 있을 때)
  autoSeat() {
    if (!this.me || this.me.seat) return;
    const pos = this.me.avatar.root.position; let best = null, bd = 1e9;
    for (const s of this.seats.values()) { if (this.occupantOf(s.id)) continue; const d = Math.hypot(s.x - pos.x, s.z - pos.z); if (d < bd) { bd = d; best = s; } }
    if (best) this.sitAt(best.id);
  }
  setReading(on) {
    this.reading = on; if (!this.me) return;
    if (on && !this.me.seat) this.autoSeat();
    this.me.state = this.me.seat ? (on ? 'read' : 'sit') : 'stand';
    if (this.me.seat && !this.me.walk) this._placeSeated(this.me);
    this._announce();
  }
  focusMe() { this.panZ = 0; this.panX = 0; this._dirty = true; }
  // 가까이 보기(내 캐릭터를 따라감) ↔ 전체 보기(방 폭이 화면에 꼭 맞음)
  setZoom(near) { this.near = near; this.panZ = 0; this.panX = 0; this.resize(); }
  setPaused(p) { this.paused = p; if (!p) { this.clock.getDelta(); this._dirty = true; } }

  // ── 터치
  _bind() {
    const el = this.canvas; let start = null, moved = false;
    this._down = (e) => { start = { x: e.clientX, y: e.clientY, pan: this.panZ, panX: this.panX }; moved = false; };
    this._move = (e) => {
      if (!start) return; const dy = e.clientY - start.y;
      if (Math.abs(dy) > 8 || Math.abs(e.clientX - start.x) > 8) moved = true;
      if (moved) { this.panZ = THREE.MathUtils.clamp(start.pan - dy * this._unitsPerPx, -22, 22); this.panX = THREE.MathUtils.clamp(start.panX - (e.clientX - start.x) * this._unitsPerPxX, -8, 8); this._dirty = true; }
    };
    this._up = (e) => { if (start && !moved) this._tap(e.clientX, e.clientY); start = null; };
    el.addEventListener('pointerdown', this._down); el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up); el.addEventListener('pointercancel', this._up);
    this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
    this._vis = () => { if (document.visibilityState === 'visible') { this.clock.getDelta(); this._dirty = true; } };
    document.addEventListener('visibilitychange', this._vis);
  }
  _tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return;
    // 누른 곳에서 가장 가까운 좌석(의자나 책상)
    let best = null, bd = 0.62;
    for (const s of this.seats.values()) { const d = Math.min(Math.hypot(s.x - hit.x, s.z - hit.z), Math.hypot(s.deskX - hit.x, s.deskZ - hit.z) + 0.12); if (d < bd) { bd = d; best = s; } }
    if (best) {
      const occ = this.occupantOf(best.id);
      if (occ && !occ.mine) { this.emit('tapFriend', { id: occ.id, nick: occ.nick, state: occ.state }); return; }
      if (!this.me) return;
      if (occ && occ.mine) { this.emit('tapMySeat', { seat: best.id }); return; }
      if (this.reading) { this.emit('hint', '읽는 중에는 자리를 옮길 수 없어요.'); return; }
      this.sitAt(best.id); return;
    }
    // 서 있는 친구를 눌렀는지
    for (const p of this.people.values()) { if (p.mine || p.seat) continue; const q = p.avatar.root.position; if (Math.hypot(q.x - hit.x, q.z - hit.z) < 0.45) { this.emit('tapFriend', { id: p.id, nick: p.nick, state: p.state }); return; } }
    // 바닥: 통로로 걸어 나옴
    if (!this.me || this.reading) return;
    const to = clampToAisle(hit.x, hit.z);
    this._leaveSeat(this.me, to); this.seatRing.visible = false; this.me.seatAt = 0; this._announce();
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    // 전체 보기: 방 폭(통창 포함)이 화면에 꼭 맞는 거리. 가까이 보기: 화면 폭에 약 4.6칸 너비가 보이는 거리
    const full = (GRID.w * CELL) / 2 + 0.55, half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfW = this.near ? Math.min(full, 2.3) : full;
    this.distTarget = Math.max(10, halfW / (half * this.camera.aspect));
    const depth = (2 * this.distTarget * half) / Math.sin(PITCH);     // 화면에 보이는 바닥 깊이
    this._unitsPerPx = depth / h; this._unitsPerPxX = (2 * halfW) / w;
    const D = GRID.d * CELL;
    this.xLimit = Math.max(0, full - halfW); this.zMin = -D / 2 + depth * 0.2; this.zMax = D / 2 - depth * 0.12;
    if (this.zMin > this.zMax) this.zMin = this.zMax = (this.zMin + this.zMax) / 2;
    this._dirty = true;
  }
  _updateCamera(dt) {
    const me = this.me ? this.me.avatar.root.position : { x: 0, z: 0 };
    const wantZ = THREE.MathUtils.clamp(me.z - (this.near ? 0.5 : 1.2) + this.panZ, this.zMin, this.zMax);
    const wantX = THREE.MathUtils.clamp((this.near ? me.x : 0) + this.panX, -this.xLimit, this.xLimit);
    const k = dt > 0 ? Math.min(1, dt * 4) : 1, pz = this.camZ, px = this.camX, pd = this.dist;
    this.camZ += (wantZ - this.camZ) * k; this.camX += (wantX - this.camX) * k; this.dist += (this.distTarget - this.dist) * k;
    const t = new THREE.Vector3(this.camX, 0.4, this.camZ);
    this.camera.position.set(t.x, t.y + Math.sin(PITCH) * this.dist, t.z + Math.cos(PITCH) * this.dist); this.camera.lookAt(t);
    return Math.abs(this.camZ - pz) + Math.abs(this.camX - px) + Math.abs(this.dist - pd) > 1e-4;
  }

  _frame() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(() => this._frame());
    if (this.paused || document.visibilityState !== 'visible') return;
    const dt = Math.min(0.12, this.clock.getDelta());   // 느린 기기에서도 걷는 속도가 느려지지 않게 넉넉히
    let active = false;
    for (const p of this.people.values()) if (p.walk) { this._stepWalk(p, dt); active = true; }
    if (this._updateCamera(dt)) active = true;
    // 걷는 사람이 없을 때는 1초에 10번만 그림(책장 넘기기·숨쉬기 같은 잔잔한 움직임용, 배터리 절약)
    this._idle = (this._idle || 0) + dt;
    if (!active && this._idle >= 0.1) {
      for (const p of this.people.values()) if (!p.walk && (p.mine || p.state === 'read')) p.avatar.update(this._idle);
      this._dirty = true;
    }
    if (active || this._dirty) { this.renderer.render(this.scene, this.camera); this._dirty = false; this._idle = 0; }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this._raf);
    const el = this.canvas;
    el.removeEventListener('pointerdown', this._down); el.removeEventListener('pointermove', this._move);
    el.removeEventListener('pointerup', this._up); el.removeEventListener('pointercancel', this._up);
    window.removeEventListener('resize', this._resize); document.removeEventListener('visibilitychange', this._vis);
    // 도서관 장면의 도형·재질·그림은 이 화면 전용이라 정리함. 캐릭터 재질은 다음에 다시 쓰므로 도형만 정리
    this.lib.root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } });
    for (const p of this.people.values()) { p.avatar.root.traverse((o) => o.geometry?.dispose?.()); p.tag.material.map.dispose(); p.tag.material.dispose(); }
    this.renderer.dispose();
  }
}
