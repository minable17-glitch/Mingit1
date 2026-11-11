// 정원 3D 장면 엔진 — 나무 표시, 내 캐릭터, 물주기 연출, 터치
// 보는 방법: 위에서(전체·내 나무 가까이) / 내 캐릭터 뒤에서(3인칭) / 내 눈으로(1인칭). 캐릭터 시점에서는 조이스틱으로 걸어 다님.
import * as THREE from 'three';
import { Avatar, LOOKS } from './avatar.js';
import { buildGarden, CENTER } from './garden.js';
import { nameTag, lookOf } from './LibraryWorld.js';
import { NavGrid, CameraRig, stepJoystick } from './roam.js';

const PITCH = THREE.MathUtils.degToRad(50), FOV = 30, WALK_SPEED = 1.9, POS_EVERY = 1.2;
const VIEW_FOV = { top: FOV, third: 55, first: 62 };
const TAG_Y = [0.42, 0.52, 0.78, 1.12, 1.14, 1.2];     // 단계별 이름표 높이
// 악세서리를 다는 자리(나무 기준, 단계별). 기존 2D 나무처럼 최대 4개: 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래
const ACC_SLOTS = (stage) => {
  if (stage <= 0) return [[-0.13, 0.12], [0.13, 0.12], [-0.17, 0.03], [0.17, 0.03]];
  if (stage === 1) return [[-0.17, 0.3], [0.17, 0.3], [-0.12, 0.13], [0.12, 0.13]];
  if (stage === 2) return [[-0.19, 0.5], [0.19, 0.5], [-0.19, 0.28], [0.19, 0.28]];
  return [[-0.23, 0.82], [0.23, 0.82], [-0.27, 0.55], [0.27, 0.55]];
};
// 이모지 악세서리 그림(같은 이모지는 한 번만 그림)
const EMOJI = new Map();
function emojiMat(e) {
  if (EMOJI.has(e)) return EMOJI.get(e);
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.font = "70px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }); EMOJI.set(e, m); return m;
}

export class GardenWorld {
  // opts: { students, me: { id, nick } | null, onEvent(type, payload) }
  constructor(canvas, opts = {}) {
    this.canvas = canvas; this.opts = opts; this.emit = opts.onEvent || (() => {});
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#9FD3F0');
    this.garden = buildGarden(this.scene, opts.students || 32);
    this.garden.faceBackdrop(PITCH); this.garden.setClassStage(0);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 300);
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.clock = new THREE.Clock(); this.disposed = false; this._dirty = true; this._idle = 0;
    this.slots = [];                    // 화분 순서대로: { id, nick, stage, me, tag }
    this.people = new Map();            // 정원에 있는 사람: id → { avatar, until }
    this.sparkles = [];
    this.near = !!opts.me; this.cam = { x: 0, z: 0.1, dist: 30 }; this._camInit = false;
    // 걸을 수 있는 마당 지도
    const g = this.garden;
    this.nav = new NavGrid({ x0: -4.6, x1: 4.6, z0: -7.4, z1: 8.2 }, 0.1, g.inside);
    for (const o of g.obstacles) { if (o.kind === 'rect') this.nav.rect(o.x, o.z, o.w, o.d, o.ry, 0.15); else this.nav.circle(o.x, o.z, o.r, 0.15); }
    this.rig = new CameraRig(this.camera, { box: { x0: -6, x1: 6, z0: -9, z1: 10, y1: 4 }, solid: g.cameraSolid });
    this.view = 'top'; this.input = { x: 0, y: 0 }; this.keys = new Set(); this._moving = false; this._posT = 0; this._atDoor = true; this.busy = false;
    if (opts.me) {
      // 도서관 문 앞에서 나타나, 탁 트인 가운데 길까지 걸어 들어와 우리 반 나무를 바라봄
      const me = this._person(opts.me.id, opts.me.nick, true), d = this.nav.nearest(g.doorSpot.x, g.doorSpot.z), st = this.nav.nearest((Math.random() - 0.5) * 0.6, 6.0 + Math.random() * 0.3);   // 학생이 32명을 넘으면 생기는 앞쪽 화단(z≈4.9)보다 앞
      me.avatar.root.position.set(d.x, 0, d.z); me.avatar.root.rotation.y = Math.atan2(st.x - d.x, st.z - d.z);
      this._walk(me, this.nav.path(d, st) || [st], () => { me.avatar.root.rotation.y = Math.PI; this._announce(); });
      this.me = me; me.goal = st; this.rig.snapTo(0);
    }
    this._bind(); this.setView(opts.me ? (opts.view || 'third') : 'top');
    this._raf = requestAnimationFrame(() => this._frame());
  }

  // 나무 목록(화분 순서): [{ id, nick, stage, me }]
  setTrees(list) {
    const n = this.garden.trees.length;
    for (let i = 0; i < n; i++) {
      const t = list[i], cur = this.slots[i];
      const stage = t ? Math.max(0, Math.min(5, t.stage)) : -1;
      const grew = cur && t && cur.id === t.id && stage > cur.stage;
      if (this.garden.setStage(i, stage)) this._dirty = true;
      const accKey = t && t.acc ? t.acc.join('') : '';
      if (!cur || cur.id !== (t && t.id) || cur.nick !== (t && t.nick) || cur.me !== !!(t && t.me)) {
        if (cur && cur.tag) { this.scene.remove(cur.tag); cur.tag.material.map.dispose(); cur.tag.material.dispose(); }
        let tag = null;
        if (t) { tag = nameTag(t.nick || '', !!t.me); tag.scale.multiplyScalar(0.8); this.scene.add(tag); }
        this.slots[i] = { id: t && t.id, nick: t && t.nick, me: !!(t && t.me), stage, tag, accKey: null, accs: [] };
      } else cur.stage = stage;
      const s = this.slots[i], p = this.garden.trees[i];
      if (s.tag) s.tag.position.set(p.x, TAG_Y[Math.max(0, stage)], p.z);
      // 악세서리: 바뀌었거나 단계가 바뀌면 다시 담
      if (s.accKey !== accKey + '|' + stage) {
        for (const a of s.accs) this.scene.remove(a); s.accs = [];
        if (t && t.acc && stage >= 0) {
          const slots = ACC_SLOTS(stage), size = stage <= 1 ? 0.17 : 0.22;
          t.acc.slice(0, 4).forEach((e, k) => { const sp = new THREE.Sprite(emojiMat(e)); sp.scale.set(size, size, 1); sp.position.set(p.x + slots[k][0], 0.07 + slots[k][1], p.z + 0.2); sp.renderOrder = 6; this.scene.add(sp); s.accs.push(sp); });
        }
        s.accKey = accKey + '|' + stage; this._dirty = true;
      }
      if (grew) this._sparkle(p.x, TAG_Y[stage] - 0.15, p.z);
    }
    this._dirty = true;
  }
  setClassStage(stage) { if (this.garden.setClassStage(stage)) this._dirty = true; }

  _person(id, nick, mine = false) {
    let p = this.people.get(id);
    if (!p) {
      const avatar = new Avatar(LOOKS[lookOf(id)]); avatar.lookUp = this.view === 'top' ? 0.3 : 0.04; avatar.setState('idle'); avatar.update(0); this.scene.add(avatar.root);
      avatar.root.userData.personId = id;
      let tag = null; if (!mine && nick) { tag = nameTag(nick, false); tag.scale.multiplyScalar(0.8); tag.position.y = 1.15; avatar.root.add(tag); }
      p = { id, nick, avatar, tag, until: 0, slot: -1, walk: null, goal: null, mine }; this.people.set(id, p);
    }
    return p;
  }
  // 나무 앞에 서는 곳: 마당 가운데 쪽에서 나무를 바라봄(막혀 있으면 둘레에서 찾음)
  _treeSpot(slot) {
    const t = this.garden.trees[slot], side = t.x < 0 ? -1 : 1, base = Math.atan2(-side, 0.2);
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6, 3.14]) { const a = base + da, x = t.x + Math.sin(a) * 0.62, z = t.z + Math.cos(a) * 0.62; if (this.nav.walkable(x, z)) return { x, z }; }
    return this.nav.nearest(t.x, t.z);
  }
  _standBy(p, slot) {
    if (p.slot === slot) return; p.slot = slot;
    const t = this.garden.trees[slot], s = this._treeSpot(slot);
    p.avatar.root.position.set(s.x, 0, s.z); p.avatar.root.rotation.y = Math.atan2(t.x - s.x, t.z - s.z);
  }
  _walk(p, pts, done) { if (!pts.length) { done?.(); return; } p.avatar.setState('walk'); p.walk = { points: pts, i: 0, done }; }
  _stepWalk(p, dt) {
    const w = p.walk, pos = p.avatar.root.position; let left = WALK_SPEED * dt;
    while (left > 0 && w.i < w.points.length) {
      const t = w.points[w.i], dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 1e-4) { let diff = Math.atan2(dx, dz) - p.avatar.root.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff)); p.avatar.root.rotation.y += diff * Math.min(1, dt * 14); }
      if (d <= left) { pos.x = t.x; pos.z = t.z; left -= d; w.i += 1; } else { pos.x += (dx / d) * left; pos.z += (dz / d) * left; left = 0; }
    }
    p.avatar.update(dt);
    if (w.i >= w.points.length) { p.walk = null; p.avatar.setState(p.until > performance.now() ? 'water' : 'idle'); p.avatar.update(0); w.done?.(); }
  }
  _route(p, to) { const q = p.avatar.root.position; return this.nav.path({ x: q.x, z: q.z }, to) || [to]; }
  // 정원에 있는 친구들: [{ id, nick, state, x, z }] — 알려 준 곳으로 걸어감(위치가 없으면 자기 나무 옆), 물 주는 중이면 물주기 자세
  setOthers(list) {
    const ids = new Set(list.map((o) => o.id)); if (this.opts.me) ids.add(this.opts.me.id);
    for (const [id, p] of [...this.people]) if (!ids.has(id)) { this.scene.remove(p.avatar.root); p.avatar.root.traverse((o) => o.geometry?.dispose?.()); if (p.tag) { p.tag.material.map.dispose(); p.tag.material.dispose(); } this.people.delete(id); }
    for (const o of list) {
      if (this.opts.me && o.id === this.opts.me.id) continue;
      const isNew = !this.people.has(o.id), p = this._person(o.id, o.nick);
      if (typeof o.x === 'number' && typeof o.z === 'number') {
        const to = this.nav.nearest(o.x, o.z);
        if (isNew) { p.avatar.root.position.set(to.x, 0, to.z); p.goal = to; }
        else if (!p.goal || Math.hypot(p.goal.x - to.x, p.goal.z - to.z) > 0.05) { p.goal = to; this._walk(p, this._route(p, to), () => this._faceTree(p)); }
      } else {
        const slot = this.slots.findIndex((s) => s && s.id === o.id); if (slot >= 0) this._standBy(p, slot);
      }
      if (o.state === 'water' && p.avatar.state !== 'water') { p.until = performance.now() + 2200; if (!p.walk) { this._faceTree(p); p.avatar.setState('water'); } }
    }
    this._dirty = true;
  }
  // 가까운 나무가 있으면 그쪽을 봄
  _faceTree(p) {
    const q = p.avatar.root.position; let best = null, bd = 0.9;
    for (const t of this.garden.trees) { const d = Math.hypot(t.x - q.x, t.z - q.z); if (d < bd) { bd = d; best = t; } }
    if (best) p.avatar.root.rotation.y = Math.atan2(best.x - q.x, best.z - q.z);
  }
  // 내 캐릭터가 내 나무 앞으로 걸어가서 물 주는 연출(물 주기 약 2초). 끝나면 resolve
  async water() {
    const me = this.me; if (!me) return;
    this.busy = true; const was = this.view; if (was === 'first') this.setView('third');
    const slot = this.slots.findIndex((s) => s && s.me);
    if (slot >= 0) {
      const spot = this._treeSpot(slot), t = this.garden.trees[slot];
      this._announce(spot); this._moving = false;
      await new Promise((res) => { const tm = setTimeout(res, 7000); this._walk(me, this._route(me, spot), () => { clearTimeout(tm); res(); }); });
      me.walk = null; me.avatar.root.position.set(spot.x, 0, spot.z);
      me.avatar.root.rotation.y = Math.atan2(t.x - spot.x, t.z - spot.z);
      if (this.view !== 'top') this.rig.faceTo(me.avatar.root.rotation.y + Math.PI + 0.5);
    }
    me.avatar.setState('water'); me.until = performance.now() + 2000; this._dirty = true;
    await new Promise((res) => setTimeout(res, 2000));
    this.busy = false; if (was === 'first' && this.view === 'third') this.setView('first');
  }
  _announce(at) {
    if (!this.me) return; this._posT = 0;
    const q = at || this.me.goal || this.me.avatar.root.position, r = (v) => Math.round(v * 100) / 100;
    this.emit('me', { x: r(q.x), z: r(q.z) });
  }
  setView(v) {
    if (!this.me) v = 'top';
    this.view = v; if (v !== 'top') this.rig.setMode(v);
    this.camera.fov = VIEW_FOV[v]; this.camera.near = v === 'top' ? 1 : 0.15; this.camera.updateProjectionMatrix();   // 가까운 면을 멀리 둘수록 깊이 정밀도가 좋아져 얼굴 그림이 덜 가려짐
    this.garden.faceBackdrop(v === 'top' ? THREE.MathUtils.degToRad(48) : 0);
    this.garden.front.visible = v !== 'top';
    for (const p of this.people.values()) { p.avatar.lookUp = v === 'top' ? 0.3 : 0.04; if (!p.walk) p.avatar.update(0); }
    if (this.me) this.me.avatar.root.visible = v !== 'first';
    this.rig._init = false; this._camInit = false; this.resize();
  }
  setMove(x, y) { this.input.x = x; this.input.y = y; }
  _sparkle(x, y, z) {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? '#FFE58A' : '#FFFFFF', transparent: true }));
      const a = (i / 9) * Math.PI * 2; m.position.set(x, y, z); m.userData = { vx: Math.cos(a) * 0.5, vz: Math.sin(a) * 0.3, vy: 0.9 + (i % 3) * 0.25, t: 0 };
      this.scene.add(m); this.sparkles.push(m);
    }
  }

  _bind() {
    const el = this.canvas, pts = new Map(); let start = null, moved = false, pinch = 0;
    this._down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); moved = true; return; }
      start = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }; moved = false;
    };
    this._move = (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2) { const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0 && d > 0 && this.view === 'third') { this.rig.zoom(pinch / d); this._dirty = true; } pinch = d; return; }
      if (!start) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) moved = true;
      if (moved && this.view !== 'top') { this.rig.drag(e.clientX - start.lx, e.clientY - start.ly); this._dirty = true; }
      start.lx = e.clientX; start.ly = e.clientY;
    };
    this._up = (e) => {
      const had = pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
      if (had && start && !moved && pts.size === 0 && e.type === 'pointerup') this._queueTap(e.clientX, e.clientY);
      if (pts.size === 0) start = null;
    };
    this._wheel = (e) => { if (this.view !== 'third') return; e.preventDefault(); this.rig.zoom(e.deltaY > 0 ? 1.1 : 0.9); this._dirty = true; };
    el.addEventListener('pointerdown', this._down); el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up); el.addEventListener('pointercancel', this._up); el.addEventListener('wheel', this._wheel, { passive: false });
    // 폰에서는 손을 뗀 뒤 '클릭'이 한 번 더 옴. 손을 떼자마자 창을 열면 그 클릭이 방금 연 창의 바깥을 눌러 바로 닫혀 버림
    // → 클릭이 온 다음(안 오면 0.35초 뒤)에 누른 것을 처리
    this._click = () => { const t = this._pendingTap; if (!t) return; this._pendingTap = null; clearTimeout(t.timer); this._tap(t.x, t.y); };
    el.addEventListener('click', this._click);
    const KEY = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    this._key = (e) => {
      const k = KEY[e.code]; if (!k || this.view === 'top') return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
      if (this.me) e.preventDefault();
    };
    this._blur = () => this.keys.clear();
    window.addEventListener('keydown', this._key); window.addEventListener('keyup', this._key); window.addEventListener('blur', this._blur);
    this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
    this._vis = () => { if (document.visibilityState === 'visible') { this.clock.getDelta(); this._dirty = true; } else this.keys.clear(); };
    document.addEventListener('visibilitychange', this._vis);
  }
  _queueTap(x, y) {
    if (this._pendingTap) clearTimeout(this._pendingTap.timer);
    const t = { x, y }; t.timer = setTimeout(() => { if (this._pendingTap === t) { this._pendingTap = null; this._tap(x, y); } }, 350);
    this._pendingTap = t;
  }
  _tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    const ray = this.raycaster.ray;
    // 친구 캐릭터를 눌렀는지
    for (const h of this.raycaster.intersectObjects([...this.people.values()].filter((p) => !p.mine).map((p) => p.avatar.root), true)) {
      let o = h.object; while (o && o.userData.personId == null) o = o.parent;
      const sl = o && this.slots.findIndex((s) => s && s.id === o.userData.personId); if (sl >= 0) { this.emit('tapTree', { id: this.slots[sl].id }); return; }
    }
    // 손가락 아래 가장 앞에 있는 나무(잎·줄기)·이름표·악세서리 (모든 보기 공통)
    { const targets = [], owner = new Map();
      this.garden.trees.forEach((t, i) => { const s = this.slots[i]; if (!s || !s.id) return; for (const o of [t.group, s.tag, ...(s.accs || [])]) if (o) { owner.set(o, i); targets.push(o); } });
      for (const h of this.raycaster.intersectObjects(targets, true)) {
        const pill = h.object.userData.pill;     // 이름표는 투명한 테두리 말고 글자 칸을 눌렀을 때만
        if (pill && h.uv && (Math.abs(h.uv.x - 0.5) > pill.hw || h.uv.y < 1 - pill.y1 || h.uv.y > 1 - pill.y0)) continue;
        let o = h.object; while (o && !owner.has(o)) o = o.parent;
        if (o) { this.emit('tapTree', { id: this.slots[owner.get(o)].id }); return; }
      } }
    if (this.view !== 'top') {
      // 조금 빗나가도: 나무 높이만큼의 세로 막대에서 가장 가까운 나무(손가락 굵기만큼 너그럽게)
      let bi = -1, bd = 0.26 * 0.26;
      const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
      this.garden.trees.forEach((t, i) => { const s = this.slots[i]; if (!s || !s.id) return; v0.set(t.x, 0.05, t.z); v1.set(t.x, TAG_Y[Math.max(0, s.stage)], t.z); const d = ray.distanceSqToSegment(v0, v1); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) { this.emit('tapTree', { id: this.slots[bi].id }); return; }
      if (ray.distanceToPoint(new THREE.Vector3(CENTER[0], 0.9, CENTER[1])) < 1.0) { this.emit('tapClassTree'); return; }
      const hit = new THREE.Vector3(); if (!ray.intersectPlane(this.ground, hit) || !this.me || this.busy) return;
      const to = this.nav.nearest(hit.x, hit.z); if (Math.hypot(to.x - hit.x, to.z - hit.z) > 1.5) return;
      this.me.goal = to; this._walk(this.me, this._route(this.me, to), () => { this.me.goal = null; }); this._announce(to); return;
    }
    const hit = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return;
    // 나무는 키가 있어서, 누른 곳이 나무 위쪽이면 바닥 좌표가 뒤로 밀림 → 화분 조금 뒤까지 넉넉히 인정
    let best = -1, bd = 0.55;
    this.garden.trees.forEach((t, i) => { const s = this.slots[i]; if (!s || !s.id) return; const d = Math.min(Math.hypot(t.x - hit.x, t.z - hit.z), Math.hypot(t.x - hit.x, t.z - 0.45 - hit.z)); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { this.emit('tapTree', { id: this.slots[best].id }); return; }
    if (Math.hypot(CENTER[0] - hit.x, CENTER[1] - hit.z) < 1.4 || Math.hypot(CENTER[0] - hit.x, CENTER[1] - 1.6 - hit.z) < 1.3) this.emit('tapClassTree');
  }

  // 가까이 보기 ↔ 전체 보기
  setZoom(near) { this.near = near; this._dirty = true; }
  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // 전체 보기: 정원 전체(폭 약 9, 깊이 약 15.5)가 들어오는 거리. 가까이 보기: 폭 약 5가 보이는 거리
    this.distFar = Math.max(4.6 / (half * this.camera.aspect), (15.5 * Math.sin(PITCH)) / (2 * half));
    this.distNear = Math.max(9, 2.5 / (half * this.camera.aspect));
    this._dirty = true;
  }
  _updateCamera(dt) {
    const mine = this.slots.findIndex((s) => s && s.me), t = mine >= 0 ? this.garden.trees[mine] : null;
    const near = this.near && t;
    const want = near ? { x: THREE.MathUtils.clamp(t.x * 0.8, -2.0, 2.0), z: t.z + 0.5, dist: this.distNear } : { x: 0, z: 0.1, dist: this.distFar };
    const k = this._camInit ? Math.min(1, dt * 4) : 1; this._camInit = true;
    const c = this.cam, before = c.x + c.z + c.dist;
    c.x += (want.x - c.x) * k; c.z += (want.z - c.z) * k; c.dist += (want.dist - c.dist) * k;
    const target = new THREE.Vector3(c.x, 0.4, c.z);
    this.camera.position.set(target.x, target.y + Math.sin(PITCH) * c.dist, target.z + Math.cos(PITCH) * c.dist); this.camera.lookAt(target);
    return Math.abs(c.x + c.z + c.dist - before) > 1e-4;
  }

  _stepMe(dt) {
    const me = this.me; if (!me || this.busy) { this._moving = false; return false; }
    const k = this.keys, ix = THREE.MathUtils.clamp(this.input.x + (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0), -1, 1), iy = THREE.MathUtils.clamp(this.input.y + (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0), -1, 1);
    if (Math.hypot(ix, iy) < 0.12) {
      if (this._moving) { this._moving = false; if (!me.walk) { me.avatar.setState('idle'); me.avatar.update(0); } this._announce(); }
      return false;
    }
    me.walk = null; me.goal = null;
    if (!this._moving) { this._moving = true; me.avatar.setState('walk'); }
    stepJoystick(me.avatar.root, this.nav, { x: ix, y: iy }, this.view === 'top' ? 0 : this.rig.yaw, WALK_SPEED, dt);
    me.avatar.update(dt);
    this._posT += dt; if (this._posT >= POS_EVERY) this._announce();
    return true;
  }
  // 도서관 문 앞까지 걸어가면 도서관으로
  _checkDoor() {
    const q = this.me.avatar.root.position, d = this.garden.doorSpot.door;
    const at = Math.hypot(q.x - d.x, q.z - d.z) < 0.5;
    if (at && !this._atDoor && !this.busy) this.emit('door', 'library');
    this._atDoor = at;
  }

  _frame() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(() => this._frame());
    if (document.visibilityState !== 'visible') return;
    const dt = Math.min(0.12, this.clock.getDelta()), now = performance.now();
    let active = false;
    for (const p of this.people.values()) {
      if (p.walk) continue;
      if (p.avatar.state === 'water') { if (now > p.until) { p.avatar.setState('idle'); p.avatar.update(0); this._dirty = true; } else { p.avatar.update(dt); active = true; } }
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const m = this.sparkles[i], u = m.userData; u.t += dt; m.position.x += u.vx * dt; m.position.z += u.vz * dt; m.position.y += (u.vy - u.t * 1.6) * dt; m.material.opacity = Math.max(0, 1 - u.t / 1.1); active = true;
      if (u.t > 1.1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.sparkles.splice(i, 1); }
    }
    if (this._stepMe(dt)) active = true;
    for (const p of this.people.values()) if (p.walk) { this._stepWalk(p, dt); active = true; }
    if (this.view === 'top' ? this._updateCamera(dt) : this.rig.update(dt, this.me.avatar.root.position)) active = true;
    if (this.me) this._checkDoor();
    this._idle += dt;
    if (!active && this._idle >= 0.12 && this.people.size) { for (const p of this.people.values()) p.avatar.update(this._idle); this._dirty = true; }
    if (active || this._dirty) { this.renderer.render(this.scene, this.camera); this._dirty = false; this._idle = 0; }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this._raf);
    const el = this.canvas;
    el.removeEventListener('pointerdown', this._down); el.removeEventListener('pointermove', this._move); el.removeEventListener('pointerup', this._up); el.removeEventListener('pointercancel', this._up); el.removeEventListener('wheel', this._wheel); el.removeEventListener('click', this._click); if (this._pendingTap) clearTimeout(this._pendingTap.timer);
    window.removeEventListener('keydown', this._key); window.removeEventListener('keyup', this._key); window.removeEventListener('blur', this._blur);
    window.removeEventListener('resize', this._resize); document.removeEventListener('visibilitychange', this._vis);
    for (const s of this.slots) if (s && s.tag) { s.tag.material.map.dispose(); s.tag.material.dispose(); }
    for (const m of EMOJI.values()) { m.map.dispose(); m.dispose(); } EMOJI.clear();
    for (const p of this.people.values()) { p.avatar.root.traverse((o) => o.geometry?.dispose?.()); if (p.tag) { p.tag.material.map.dispose(); p.tag.material.dispose(); } }
    this.garden.dispose(); this.renderer.dispose();
  }
}
