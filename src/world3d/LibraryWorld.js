// 도서관 3D 장면 엔진 — 그리기, 카메라, 터치, 걷기, 앉기, 친구 표시
// React와 분리된 순수 클래스. 화면(Library3D.jsx)이 만들고, 이벤트로만 소통함.
import * as THREE from 'three';
import { Avatar, LOOKS, snapshotParts } from './avatar.js';
import { buildLibrary, GRID, CELL } from './library.js';
import { entryPoint, GARDEN_DOOR_CELL } from './paths.js';
import { gx, gz } from './library.js';
import { NavGrid, CameraRig, stepJoystick } from './roam.js';

const SIT_Y = 0.05, WALK_SPEED = 1.9, PITCH = THREE.MathUtils.degToRad(44), FOV = 30;
const VIEW_FOV = { top: FOV, third: 55, first: 62 };
const POS_EVERY = 1.2;     // 걸어 다니는 동안 내 위치를 친구들에게 알리는 간격(초) — 메시지 수 절약

// 걸을 수 있는 바닥 지도: 방 안쪽 + 책상·소파·책장·화분은 막힘
function buildNav(lib) {
  const { W, D } = lib.size, m = 0.2;
  const nav = new NavGrid({ x0: -W / 2 + m, x1: W / 2 - m, z0: -D / 2 + m, z1: D / 2 - m }, 0.12);
  for (const o of lib.obstacles) { if (o.kind === 'rect') nav.rect(o.x, o.z, o.w, o.d, o.ry, 0.15); else nav.circle(o.x, o.z, o.r, 0.15); }
  return nav;
}
// 자리에 앉기 직전에 서는 곳: 의자 뒤쪽(책상 반대쪽)부터 옆쪽까지 차례로 찾아봄
function standPoint(nav, s, from) {
  const back = s.rotY + Math.PI;
  for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, 2.0, -2.0]) for (const r of [0.55, 0.68, 0.82]) {
    const a = back + da, x = s.x + Math.sin(a) * r, z = s.z + Math.cos(a) * r;
    if (nav.walkable(x, z) && (!from || nav.path(from, { x, z }))) return { x, z };
  }
  return nav.nearest(s.x, s.z);
}
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
    this.nav = buildNav(this.lib);
    { const e = entryPoint(); for (const st of this.lib.seats) st.stand = standPoint(this.nav, st, this.nav.nearest(e.x, e.z)); }
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
    { const { W, D } = this.lib.size; this.rig = new CameraRig(this.camera, { box: { x0: -W / 2 + 0.15, x1: W / 2 - 0.15, z0: -D / 2 + 0.15, z1: D / 2 - 0.15, y1: 3.2 } }); }
    this.view = 'top'; this.input = { x: 0, y: 0 }; this.keys = new Set(); this._moving = false; this._posT = 0; this._atDoor = false;
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
      // 입구로 들어와서 도서관 안쪽(뒤쪽 통창)을 바라보며 시작
      const st = this.nav.nearest((Math.random() - 0.5) * 0.7, e.z - 2.2 - Math.random() * 0.8);   // 여럿이 같은 곳에 겹쳐 서지 않게 조금씩 흩어짐       // 가운데 통로에서 시작(앞이 탁 트여 있음)
      this.me.avatar.root.position.set(st.x, 0, st.z); this.me.avatar.root.rotation.y = Math.PI; this.me.anchor = { x: st.x, z: st.z };
      this.rig.snapTo(0);
    }
    this._bind(); this.setView(opts.me ? (opts.view || 'third') : 'top');
    this._raf = requestAnimationFrame(() => this._frame());
    // 지난번 자리가 비어 있으면 그 자리로 걸어감(친구 정보가 도착한 뒤에 판단)
    this._wantSeat = opts.lastSeat || null;
  }

  // ── 사람 추가/삭제
  _addPerson(id, nick, mine = false) {
    const avatar = new Avatar(LOOKS[lookOf(id)]);
    avatar.lookUp = this.view === 'top' ? 0.3 : 0.04; avatar.setState('idle'); avatar.update(0);
    const tag = nameTag(nick || '친구', mine); avatar.root.add(tag);
    this.scene.add(avatar.root);
    const p = { id, nick, avatar, tag, seat: null, state: 'stand', walk: null, anchor: null, mine, seatAt: 0, goal: null };
    avatar.root.userData.personId = id;
    if (mine && this.view === 'first') avatar.root.visible = false;
    this.people.set(id, p); return p;
  }
  // 가만히 있는 친구는 굳힌 모습으로 그림(읽는 친구는 가까이 있을 때만 움직이는 모습)
  _lod() {
    const cam = this.camera.position;
    for (const p of this.people.values()) {
      if (p.mine) continue;
      const st = p.avatar.state, q = p.avatar.root.position;
      const want = !p.walk && (st === 'sit' || st === 'idle' || (st === 'read' && cam.distanceTo(q) > 5));
      this._setSnap(p, want);
      // 카메라 바로 앞을 막는 친구는 잠깐 숨김(캐릭터 시점에서만)
      const block = this.view !== 'top' && Math.hypot(cam.x - q.x, cam.z - q.z) < 0.55 && cam.y < q.y + 1.4;
      if (p.avatar.root.visible === block) { p.avatar.root.visible = !block; this._dirty = true; }
    }
  }
  _setSnap(p, on) {
    const root = p.avatar.root, key = `${lookOf(p.id)}|${p.avatar.state}|${p.avatar.lookUp}`;
    if (on && p.snapKey !== key) {
      if (p.snap) { root.remove(p.snap); p.snap = null; }
      for (const c of root.children) if (c !== p.tag) c.visible = true;
      const g = new THREE.Group(); g.userData.snap = true;
      for (const part of snapshotParts(p.avatar, key)) { const m = new THREE.Mesh(part.geo, part.mat); m.renderOrder = part.order; m.userData.snap = true; g.add(m); }
      root.add(g); p.snap = g; p.snapKey = key; p.snapOn = null;
    }
    if (p.snapOn === on) return;
    p.snapOn = on;
    for (const c of root.children) { if (c === p.tag) continue; c.visible = c === p.snap ? on : !on; }
    this._dirty = true;
  }
  _removePerson(id) { const p = this.people.get(id); if (!p) return; this.scene.remove(p.avatar.root); p.tag.material.map.dispose(); p.tag.material.dispose(); this.people.delete(id); }

  _poseFor(p) { return p.seat ? (p.state === 'read' ? 'read' : 'sit') : 'idle'; }
  _placeSeated(p) {
    const s = this.seats.get(p.seat); if (!s) return;
    p.avatar.root.position.set(s.x - Math.sin(s.rotY) * 0.05, SIT_Y, s.z - Math.cos(s.rotY) * 0.05);
    p.avatar.root.rotation.y = s.rotY; p.avatar.setState(this._poseFor(p)); p.avatar.update(0);
    if (p.mine && this.view !== 'top') this.rig.faceTo(s.rotY + Math.PI);
    this._dirty = true;
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

  // ── 자리 이동(나·친구 공통): 바닥 지도로 길을 찾아 걸음
  // 지금 앉아 있으면 먼저 의자 뒤로 일어나는 점부터
  _startPts(p) {
    const s = p.seat && this.seats.get(p.seat);
    if (s && !p.walk) return [s.stand];
    return [];
  }
  _route(from, to) { return this.nav.path(from, to) || [to]; }
  _moveToSeat(p, seatId, instant = false) {
    const seat = this.seats.get(seatId); if (!seat) return;
    const pre = this._startPts(p), pos = p.avatar.root.position;
    p.seat = seatId; p.anchor = null; p.goal = null;
    if (instant) { p.walk = null; this._placeSeated(p); return; }
    const from = pre.length ? pre[0] : { x: pos.x, z: pos.z };
    this._walk(p, [...pre, ...this._route(from, seat.stand), { x: seat.x, z: seat.z }], () => this._placeSeated(p));
  }
  _leaveSeat(p, to) {
    const pre = this._startPts(p), pos = p.avatar.root.position;
    p.seat = null; p.state = 'stand'; p.goal = { x: to.x, z: to.z };
    const from = pre.length ? pre[0] : { x: pos.x, z: pos.z };
    this._walk(p, [...pre, ...this._route(from, to)], () => this._stand(p, to.x, to.z));
  }
  // 앉아 있던 사람이 바로 일어서기(조이스틱을 밀었을 때)
  _standUp(p) {
    const s = p.seat && !p.walk && this.seats.get(p.seat);     // 걸어가던 중이면 그 자리에서 멈춤
    p.seat = null; p.seatAt = 0; p.state = 'stand'; p.walk = null; p.goal = null;
    if (s) this._stand(p, s.stand.x, s.stand.z); else p.avatar.root.position.y = 0;
    if (p.mine) this.seatRing.visible = false;
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
      if (seat) { if (seat !== p.seat) this._moveToSeat(p, seat, isNew); }
      else {
        // 서 있는 친구: 알려 준 위치로 걸어감(위치를 안 보내는 예전 화면이면 입구 근처에 섬)
        let to;
        if (typeof o.x === 'number' && typeof o.z === 'number') to = this.nav.nearest(o.x, o.z);
        else { const e = entryPoint(); to = { x: e.x - 0.5 - (lobby % 4) * 0.5, z: e.z - 0.9 - Math.floor(lobby / 4) * 0.6 }; lobby += 1; }
        if (isNew) { p.seat = null; this._stand(p, to.x, to.z); p.goal = to; }
        else if (p.seat || !p.goal || Math.hypot(p.goal.x - to.x, p.goal.z - to.z) > 0.05) {
          if (p.seat) this._leaveSeat(p, to);
          else { p.goal = to; const q = p.avatar.root.position; this._walk(p, this._route({ x: q.x, z: q.z }, to), () => this._stand(p, to.x, to.z)); }
        }
      }
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
    const s = this.seats.get(this.me.seat); const to = s ? s.stand : this.nav.nearest(this.me.avatar.root.position.x, this.me.avatar.root.position.z);
    this._leaveSeat(this.me, to); this.seatRing.visible = false;
    this.emit('bumped'); this._announce();
  }
  // 내 상태 알리기. 서 있을 때는 위치(가는 곳)도 함께 — 소수 둘째 자리까지만
  _announce(at) {
    if (!this.me) return; this._posT = 0;
    const q = at || this.me.goal || this.me.avatar.root.position, r = (v) => Math.round(v * 100) / 100;
    this.emit('me', { seat: this.me.seat, state: this.me.seat ? (this.reading ? 'read' : 'sit') : 'stand', seatAt: this.me.seatAt,
      x: this.me.seat ? null : r(q.x), z: this.me.seat ? null : r(q.z) });
  }

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
  // 정원 문으로 걸어가서 나감. 다 걸으면(또는 길어도 5초 뒤) done()
  goGarden(done) {
    if (!this.me || this.reading) { done?.(); return; }
    let fired = false; const finish = () => { if (!fired) { fired = true; done?.(); } };
    const door = this.nav.nearest(gx(GARDEN_DOOR_CELL[0]) - 0.6, gz(GARDEN_DOOR_CELL[1]));
    this._atDoor = true;     // 걸어가는 도중에 문 앞 감지가 또 불리지 않게
    this.me.seatAt = 0; this.seatRing.visible = false;
    this._leaveSeat(this.me, door); this._announce();
    if (this.me.walk) { const w = this.me.walk, d0 = w.done; w.done = () => { d0?.(); finish(); }; } else finish();
    if (this.view === 'top') this.setZoom(false);
    setTimeout(finish, 5000);
  }
  focusMe() { this.panZ = 0; this.panX = 0; this._dirty = true; }
  // 보는 방법: 'top'(위에서 전체) | 'third'(내 캐릭터 뒤에서) | 'first'(내 눈으로)
  setView(v) {
    if (!this.me) v = 'top';
    this.view = v; if (v !== 'top') this.rig.setMode(v);
    this.camera.fov = VIEW_FOV[v]; this.camera.near = v === 'top' ? 1 : 0.15; this.camera.updateProjectionMatrix();   // 가까운 면을 멀리 둘수록 깊이 정밀도가 좋아져 얼굴 그림이 덜 가려짐
    this.lib.faceBackdrop(v === 'top' ? PITCH : 0);
    this.lib.front.visible = v !== 'top';
    for (const p of this.people.values()) { p.avatar.lookUp = v === 'top' ? 0.3 : 0.04; if (!p.walk) p.avatar.update(0); }
    if (this.me) { this.me.avatar.root.visible = v !== 'first'; this.me.tag.visible = v === 'top'; if (v !== 'top' && this.me.seat) this.rig.snapTo(this.seats.get(this.me.seat).rotY + Math.PI); }
    this.rig._init = false; this.resize();
  }
  // 조이스틱: x(오른쪽 +), y(아래 +), 각각 -1~1
  setMove(x, y) { this.input.x = x; this.input.y = y; }
  // 가까이 보기(내 캐릭터를 따라감) ↔ 전체 보기(방 폭이 화면에 꼭 맞음)
  setZoom(near) { this.near = near; this.panZ = 0; this.panX = 0; this.resize(); }
  setPaused(p) { this.paused = p; if (!p) { this.clock.getDelta(); this._dirty = true; } }

  // ── 터치: 한 손가락으로 끌면 둘러보기(위에서 보기에서는 옮겨 보기), 두 손가락은 확대·축소, 짧게 누르면 선택
  _bind() {
    const el = this.canvas, pts = new Map(); let start = null, moved = false, pinch = 0;
    this._down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true; return; }
      start = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, pan: this.panZ, panX: this.panX }; moved = false;
      try { el.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    };
    this._move = (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0 && this.view === 'third') { this.rig.zoom(pinch / d); this._dirty = true; }
        pinch = d; return;
      }
      if (!start) return; const dy = e.clientY - start.y;
      if (Math.abs(dy) > 8 || Math.abs(e.clientX - start.x) > 8) moved = true;
      if (!moved) return;
      if (this.view === 'top') { this.panZ = THREE.MathUtils.clamp(start.pan - dy * this._unitsPerPx, -22, 22); this.panX = THREE.MathUtils.clamp(start.panX - (e.clientX - start.x) * this._unitsPerPxX, -8, 8); }
      else this.rig.drag(e.clientX - start.lx, e.clientY - start.ly);
      start.lx = e.clientX; start.ly = e.clientY; this._dirty = true;
    };
    this._up = (e) => {
      const had = pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
      if (had && start && !moved && pts.size === 0 && e.type === 'pointerup') this._tap(e.clientX, e.clientY);
      if (pts.size === 0) start = null;
    };
    this._wheel = (e) => { if (this.view !== 'third') return; e.preventDefault(); this.rig.zoom(e.deltaY > 0 ? 1.1 : 0.9); this._dirty = true; };
    el.addEventListener('pointerdown', this._down); el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up); el.addEventListener('pointercancel', this._up);
    el.addEventListener('wheel', this._wheel, { passive: false });
    // 키보드(컴퓨터): 방향키·WASD로 걷기
    const KEY = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    this._key = (e) => {
      const k = KEY[e.code]; if (!k) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
      if (this.view !== 'top' && this.me) e.preventDefault();
    };
    this._blur = () => this.keys.clear();
    window.addEventListener('keydown', this._key); window.addEventListener('keyup', this._key); window.addEventListener('blur', this._blur);
    this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
    this._vis = () => { if (document.visibilityState === 'visible') { this.clock.getDelta(); this._dirty = true; } else this.keys.clear(); };
    document.addEventListener('visibilitychange', this._vis);
  }
  _tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // 캐릭터를 직접 눌렀는지 먼저 확인(옆에서 볼 때는 바닥보다 몸이 먼저 보임)
    const roots = [...this.people.values()].filter((p) => !p.mine).map((p) => p.avatar.root);
    for (const h of this.raycaster.intersectObjects(roots, true)) {
      let o = h.object; while (o && o.userData.personId == null) o = o.parent;
      const p = o && this.people.get(o.userData.personId); if (p) { this.emit('tapFriend', { id: p.id, nick: p.nick, state: p.state }); return; }
    }
    const hit = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return;
    if (this.view !== 'top' && hit.distanceTo(this.camera.position) > 40) return;
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
    // 바닥: 그곳으로 걸어감(가구는 돌아서)
    if (!this.me || this.reading) return;
    const { W, D } = this.lib.size; if (Math.abs(hit.x) > W / 2 || Math.abs(hit.z) > D / 2) return;
    const to = this.nav.nearest(hit.x, hit.z);
    this.seatRing.visible = false; this.me.seatAt = 0; this._leaveSeat(this.me, to); this._announce(to);
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

  // 조이스틱·키보드로 내 캐릭터 걷기. 걸었으면 true
  _stepMe(dt) {
    const me = this.me; if (!me || this.reading) { this._moving = false; return false; }
    const k = this.keys, ix = THREE.MathUtils.clamp(this.input.x + (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), -1, 1), iy = THREE.MathUtils.clamp(this.input.y + (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), -1, 1);
    const yaw = this.view === 'top' ? 0 : this.rig.yaw;
    if (Math.hypot(ix, iy) < 0.12) {
      if (this._moving) { this._moving = false; if (!me.walk) { me.avatar.setState('idle'); me.avatar.update(0); } me.goal = null; this._announce(); }
      return false;
    }
    if (me.seat || me.walk) { const was = me.seat; this._standUp(me); if (was) this._announce(); }
    me.goal = null;
    if (!this._moving) { this._moving = true; me.avatar.setState('walk'); }
    stepJoystick(me.avatar.root, this.nav, { x: ix, y: iy }, yaw, WALK_SPEED, dt);
    me.avatar.update(dt); me.anchor = { x: me.avatar.root.position.x, z: me.avatar.root.position.z };
    this._posT += dt; if (this._posT >= POS_EVERY) this._announce();
    return true;
  }
  // 정원 문 앞까지 걸어가면 정원으로 나감
  _checkDoor() {
    const q = this.me.avatar.root.position, { W } = this.lib.size;
    const at = q.x < -W / 2 + 0.5 && q.z > gz(4.2) && q.z < gz(6.8);
    if (at && !this._atDoor && !this.reading) this.emit('door', 'garden');
    this._atDoor = at;
  }

  _frame() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(() => this._frame());
    if (this.paused || document.visibilityState !== 'visible') return;
    const dt = Math.min(0.12, this.clock.getDelta());   // 느린 기기에서도 걷는 속도가 느려지지 않게 넉넉히
    let active = false;
    if (this._stepMe(dt)) active = true;
    for (const p of this.people.values()) if (p.walk) { this._stepWalk(p, dt); active = true; }
    if (this.view === 'top' ? this._updateCamera(dt) : this.rig.update(dt, this.me.avatar.root.position, !!this.me.seat && !this.me.walk)) active = true;
    if (this.me && !this.me.seat) this._checkDoor();
    this._lodT = (this._lodT || 0) + dt; if (this._lodT > 0.25 || active) { this._lodT = 0; this._lod(); }
    // 걷는 사람이 없을 때는 1초에 10번만 그림(책장 넘기기·숨쉬기 같은 잔잔한 움직임용, 배터리 절약)
    this._idle = (this._idle || 0) + dt;
    if (!active && this._idle >= 0.1) {
      for (const p of this.people.values()) if (!p.walk && !p.snapOn && (p.mine || p.state === 'read')) p.avatar.update(this._idle);
      this._dirty = true;
    }
    if (active || this._dirty) { this.renderer.render(this.scene, this.camera); this._dirty = false; this._idle = 0; }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this._raf);
    const el = this.canvas;
    el.removeEventListener('pointerdown', this._down); el.removeEventListener('pointermove', this._move);
    el.removeEventListener('pointerup', this._up); el.removeEventListener('pointercancel', this._up); el.removeEventListener('wheel', this._wheel);
    window.removeEventListener('keydown', this._key); window.removeEventListener('keyup', this._key); window.removeEventListener('blur', this._blur);
    window.removeEventListener('resize', this._resize); document.removeEventListener('visibilitychange', this._vis);
    // 도서관 장면의 도형·재질·그림은 이 화면 전용이라 정리함. 캐릭터 재질은 다음에 다시 쓰므로 도형만 정리
    this.lib.root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } });
    for (const p of this.people.values()) { p.avatar.root.traverse((o) => o.geometry?.dispose?.()); p.tag.material.map.dispose(); p.tag.material.dispose(); }
    this.renderer.dispose();
  }
}
