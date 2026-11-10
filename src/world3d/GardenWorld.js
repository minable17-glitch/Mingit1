// 정원 3D 장면 엔진 — 나무 표시, 내 캐릭터, 물주기 연출, 터치
// 가까이 보기(내 나무 둘레)와 전체 보기를 오감. 화면을 끌어 옮기는 기능은 없음(페이지 스크롤을 막지 않기 위해).
import * as THREE from 'three';
import { Avatar, LOOKS } from './avatar.js';
import { buildGarden, CENTER } from './garden.js';
import { nameTag, lookOf } from './LibraryWorld.js';

const PITCH = THREE.MathUtils.degToRad(50), FOV = 30;
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
    this._bind(); this.resize();
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
    // 내 캐릭터는 내 나무 옆에 서 있음
    if (this.opts.me) {
      const i = this.slots.findIndex((s) => s && s.me);
      if (i >= 0) { const me = this._person(this.opts.me.id); this._standBy(me, i); }
    }
    this._dirty = true;
  }
  setClassStage(stage) { if (this.garden.setClassStage(stage)) this._dirty = true; }

  _person(id) {
    let p = this.people.get(id);
    if (!p) { const avatar = new Avatar(LOOKS[lookOf(id)]); avatar.lookUp = 0.3; avatar.setState('idle'); avatar.update(0); this.scene.add(avatar.root); p = { avatar, until: 0, slot: -1 }; this.people.set(id, p); }
    return p;
  }
  _standBy(p, slot) {
    if (p.slot === slot) return; p.slot = slot;
    const t = this.garden.trees[slot], side = t.x < 0 ? -1 : 1;      // 화면 가장자리 쪽이 아니라 바깥쪽에서 나무를 바라봄
    p.avatar.root.position.set(t.x - side * 0.6, 0, t.z + 0.14); p.avatar.root.rotation.y = side * Math.PI / 2 * 0.86;
  }
  // 정원에 있는 친구들: [{ id, state }] — 자기 나무 옆에 서 있고, 물 주는 중이면 물주기 자세
  setOthers(list) {
    const ids = new Set(list.map((o) => o.id)); if (this.opts.me) ids.add(this.opts.me.id);
    for (const [id, p] of [...this.people]) if (!ids.has(id)) { this.scene.remove(p.avatar.root); p.avatar.root.traverse((o) => o.geometry?.dispose?.()); this.people.delete(id); }
    for (const o of list) {
      if (this.opts.me && o.id === this.opts.me.id) continue;
      const slot = this.slots.findIndex((s) => s && s.id === o.id); if (slot < 0) continue;
      const p = this._person(o.id); this._standBy(p, slot);
      if (o.state === 'water' && p.avatar.state !== 'water') { p.avatar.setState('water'); p.until = performance.now() + 2200; }
    }
    this._dirty = true;
  }
  // 내 캐릭터가 물 주는 연출(약 2초). 끝나면 resolve
  water() {
    const me = this.opts.me && this.people.get(this.opts.me.id);
    if (!me) return Promise.resolve();
    me.avatar.setState('water'); me.until = performance.now() + 2000;
    return new Promise((res) => setTimeout(res, 2000));
  }
  _sparkle(x, y, z) {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? '#FFE58A' : '#FFFFFF', transparent: true }));
      const a = (i / 9) * Math.PI * 2; m.position.set(x, y, z); m.userData = { vx: Math.cos(a) * 0.5, vz: Math.sin(a) * 0.3, vy: 0.9 + (i % 3) * 0.25, t: 0 };
      this.scene.add(m); this.sparkles.push(m);
    }
  }

  _bind() {
    const el = this.canvas; let start = null;
    this._down = (e) => { start = { x: e.clientX, y: e.clientY }; };
    this._up = (e) => { if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) this._tap(e.clientX, e.clientY); start = null; };
    el.addEventListener('pointerdown', this._down); el.addEventListener('pointerup', this._up);
    this._resize = () => this.resize(); window.addEventListener('resize', this._resize);
    this._vis = () => { if (document.visibilityState === 'visible') { this.clock.getDelta(); this._dirty = true; } };
    document.addEventListener('visibilitychange', this._vis);
  }
  _tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
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

  _frame() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(() => this._frame());
    if (document.visibilityState !== 'visible') return;
    const dt = Math.min(0.12, this.clock.getDelta()), now = performance.now();
    let active = false;
    for (const p of this.people.values()) {
      if (p.avatar.state === 'water') { if (now > p.until) { p.avatar.setState('idle'); p.avatar.update(0); this._dirty = true; } else { p.avatar.update(dt); active = true; } }
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const m = this.sparkles[i], u = m.userData; u.t += dt; m.position.x += u.vx * dt; m.position.z += u.vz * dt; m.position.y += (u.vy - u.t * 1.6) * dt; m.material.opacity = Math.max(0, 1 - u.t / 1.1); active = true;
      if (u.t > 1.1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.sparkles.splice(i, 1); }
    }
    if (this._updateCamera(dt)) active = true;
    this._idle += dt;
    if (!active && this._idle >= 0.12 && this.people.size) { for (const p of this.people.values()) p.avatar.update(this._idle); this._dirty = true; }
    if (active || this._dirty) { this.renderer.render(this.scene, this.camera); this._dirty = false; this._idle = 0; }
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this._raf);
    this.canvas.removeEventListener('pointerdown', this._down); this.canvas.removeEventListener('pointerup', this._up);
    window.removeEventListener('resize', this._resize); document.removeEventListener('visibilitychange', this._vis);
    for (const s of this.slots) if (s && s.tag) { s.tag.material.map.dispose(); s.tag.material.dispose(); }
    for (const m of EMOJI.values()) { m.map.dispose(); m.dispose(); } EMOJI.clear();
    for (const p of this.people.values()) p.avatar.root.traverse((o) => o.geometry?.dispose?.());
    this.garden.dispose(); this.renderer.dispose();
  }
}
