// 귀여운 학생 아바타 (큰 머리 + 교복) 와 이름표·말풍선
import * as THREE from 'three';

// ── 꾸미기 선택지 ──
export const OUTFITS = [
  { id: 'navy', name: '남색 교복', top: '#2f4a7a', pants: '#3b3f4a', tie: '#c0453f' },
  { id: 'wine', name: '자주 교복', top: '#7a2f3f', pants: '#3b3f4a', tie: '#2f4a7a' },
  { id: 'green', name: '초록 교복', top: '#2f6a55', pants: '#3b3f4a', tie: '#c0453f' },
  { id: 'beige', name: '베이지 조끼', top: '#b89a6a', pants: '#4a4440', tie: '#7a2f3f' },
  { id: 'gym', name: '초록 체육복', top: '#2f7a52', pants: '#2f7a52', gym: true },
  { id: 'gymblue', name: '파란 체육복', top: '#2f58a8', pants: '#2f58a8', gym: true },
  { id: 'suit', name: '선생님 정장', top: '#6b5444', pants: '#3d3a37', tie: '#2f4a7a' },
];
export const HAIRS = [
  { id: 'short', name: '짧은 머리' },
  { id: 'buzz', name: '까까머리' },
  { id: 'bob', name: '단발' },
  { id: 'long', name: '긴 머리' },
  { id: 'pigtail', name: '양갈래' },
  { id: 'bun', name: '똥머리' },
];
export const HAIR_COLORS = [
  { id: 'black', name: '검정', color: '#1f1f24' },
  { id: 'dark', name: '흑갈색', color: '#3b2a20' },
  { id: 'brown', name: '갈색', color: '#6b4a32' },
  { id: 'gold', name: '노랑', color: '#c9a04a' },
];
export const ACCS = [
  { id: 'none', name: '없음' },
  { id: 'glasses', name: '안경' },
  { id: 'cap', name: '야구모자' },
  { id: 'ribbon', name: '리본' },
];

export function defaultLook(id, isTeacher) {
  const h = hashCode(id);
  return {
    outfit: isTeacher ? 'suit' : OUTFITS[h % 4].id,
    hair: HAIRS[h % 3].id,
    hairColor: HAIR_COLORS[h % 2].id,
    acc: 'none',
  };
}

// 친구에게서 받은 값도 안전하게 정리
export function cleanLook(look, fallback) {
  const pick = (list, v, d) => (list.some((o) => o.id === v) ? v : d);
  const l = look && typeof look === 'object' ? look : {};
  return {
    outfit: pick(OUTFITS, l.outfit, fallback.outfit),
    hair: pick(HAIRS, l.hair, fallback.hair),
    hairColor: pick(HAIR_COLORS, l.hairColor, fallback.hairColor),
    acc: pick(ACCS, l.acc, fallback.acc),
  };
}
const FONT = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function spriteFromCanvas(c, worldH) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.set((worldH * c.width) / c.height, worldH, 1);
  s.renderOrder = 10;
  return s;
}

// 참고 이미지처럼 "나 | 편안한 나무" 모양의 이름표
function makeNameTag(name, { isMe, isTeacher }) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `600 40px ${FONT}`;
  g.font = font;
  const badge = isMe ? '나' : isTeacher ? '선생님' : '';
  const badgeW = badge ? (badge.length > 1 ? 112 : 60) : 0;
  const textW = Math.min(g.measureText(name).width, 360);
  c.width = Math.ceil(textW + badgeW + (badge ? 52 : 44));
  c.height = 72;
  g.font = font;
  g.fillStyle = 'rgba(255,253,244,0.92)';
  roundRect(g, 0, 0, c.width, c.height, 36);
  g.fill();
  let x = 22;
  if (badge) {
    g.fillStyle = isTeacher && !isMe ? '#3f7e4e' : '#6d7466';
    roundRect(g, 8, 8, badgeW, 56, 28);
    g.fill();
    g.fillStyle = '#fff';
    g.font = `600 32px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(badge, 8 + badgeW / 2, 37);
    x = badgeW + 22;
  }
  g.font = font;
  g.fillStyle = '#2b2b2b';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(name, x, 38, 360);
  return spriteFromCanvas(c, 0.34);
}

function makeBubble(text) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `500 36px ${FONT}`;
  g.font = font;
  // 줄바꿈 (한 줄 최대 약 14자)
  const lines = [];
  let cur = '';
  for (const ch of String(text)) {
    if (g.measureText(cur + ch).width > 440) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  const w = Math.max(...lines.map((l) => g.measureText(l).width));
  c.width = Math.ceil(w + 48);
  c.height = lines.length * 46 + 40;
  g.font = font;
  g.fillStyle = '#ffffff';
  roundRect(g, 0, 0, c.width, c.height - 14, 22);
  g.fill();
  g.beginPath();
  g.moveTo(c.width / 2 - 12, c.height - 15);
  g.lineTo(c.width / 2 + 12, c.height - 15);
  g.lineTo(c.width / 2, c.height);
  g.fill();
  g.fillStyle = '#222';
  g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 24, 14 + i * 46));
  return spriteFromCanvas(c, (c.height / 100) * 0.42);
}

function makeEmoji(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.font = `72px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 48, 54);
  return spriteFromCanvas(c, 0.5);
}

function hashCode(str) {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) | 0;
  return Math.abs(h);
}

export class Avatar {
  constructor({ id, name, color, look, isMe = false, isTeacher = false }) {
    this.id = id;
    this.isMe = isMe;
    this.isTeacher = isTeacher;
    const mat = (c, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...extra });
    this.mat = mat;
    const skin = mat('#f1c79a');
    const cloth = mat(color || '#2f4a7a');
    const shirt = mat('#f6f4ee');
    const pants = mat('#3b3f4a');
    const hair = mat('#1f1f24');
    this.mats = { cloth, pants, hair, tie: mat('#c0453f') };
    this.fixedColor = color;

    const root = new THREE.Group();
    this.root = root;

    // 몸통(엉덩이 기준으로 숙일 수 있게)
    const body = new THREE.Group();
    body.position.y = 0.5;
    root.add(body);
    this.body = body;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.55, 16), cloth);
    torso.position.y = 0.27;
    body.add(torso);
    // 셔츠 깃 + 넥타이
    const collar = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 3), shirt);
    collar.rotation.x = Math.PI;
    collar.position.set(0, 0.46, 0.2);
    body.add(collar);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.03), this.mats.tie);
    tie.position.set(0, 0.32, 0.29);
    tie.rotation.x = -0.12;
    body.add(tie);
    this.collar = collar;
    this.tie = tie;
    // 체육복 흰 줄
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.305, 0.06, 16, 1, true), shirt);
    stripe.position.y = 0.3;
    body.add(stripe);
    this.stripe = stripe;

    // 머리
    const head = new THREE.Group();
    head.position.y = 0.92;
    body.add(head);
    this.head = head;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), skin));
    this.hairGroup = new THREE.Group();
    this.accGroup = new THREE.Group();
    head.add(this.hairGroup, this.accGroup);
    const eyeMat = mat('#2a2522');
    for (const ex of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeMat);
      eye.position.set(ex, -0.02, 0.37);
      eye.scale.set(1, 1.3, 0.6);
      head.add(eye);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat('#f4a2a0'));
      cheek.position.set(ex * 1.55, -0.12, 0.33);
      cheek.scale.set(1, 0.6, 0.4);
      head.add(cheek);
    }

    // 팔 (어깨 기준 회전)
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.3 * side, 0.48, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), cloth);
      arm.position.y = -0.2;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
      hand.position.y = -0.42;
      pivot.add(arm, hand);
      pivot.rotation.z = 0.12 * side;
      body.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // 다리
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(0.13 * side, 0.5, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), pants);
      leg.position.y = -0.24;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), mat('#f7f7f2'));
      shoe.position.set(0, -0.46, 0.04);
      pivot.add(leg, shoe);
      root.add(pivot);
      return pivot;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    this.setLook(look || defaultLook(id, isTeacher));

    // 이름표
    this.tagHolder = new THREE.Group();
    this.tagHolder.position.y = 1.95;
    root.add(this.tagHolder);
    this.setName(name);

    // 상태
    this.pos = new THREE.Vector3();
    this.target = null;
    this.path = [];
    this.walkPhase = 0;
    this.speed = 0;
    this.sitChair = null;
    this.action = null; // { type, t }
    this.bubble = null;
    this.bubbleT = 0;
    this.emoji = null;
    this.emojiT = 0;
  }

  // 옷·머리·장식 바꾸기
  setLook(look) {
    const l = cleanLook(look, defaultLook(this.id, this.isTeacher));
    this.look = l;
    const o = OUTFITS.find((x) => x.id === l.outfit);
    this.mats.cloth.color.set(this.fixedColor || o.top);
    this.mats.pants.color.set(o.pants);
    if (o.tie) this.mats.tie.color.set(o.tie);
    this.tie.visible = !o.gym;
    this.collar.visible = !o.gym;
    this.stripe.visible = !!o.gym;
    this.mats.hair.color.set(HAIR_COLORS.find((x) => x.id === l.hairColor).color);

    const clear = (g) => {
      for (const c of [...g.children]) {
        g.remove(c);
        c.traverse((m) => m.isMesh && m.geometry.dispose());
      }
    };
    clear(this.hairGroup);
    clear(this.accGroup);
    const hm = this.mats.hair;
    const add = (g, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.x = rx;
      g.add(m);
      return m;
    };
    const cap = (theta) => add(this.hairGroup, new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI * theta), hm, 0, 0.02, -0.03, 1, 1, 1, -0.35);
    switch (l.hair) {
      case 'buzz':
        add(this.hairGroup, new THREE.SphereGeometry(0.405, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), hm, 0, 0.01, -0.02, 1, 1, 1, -0.4);
        break;
      case 'bob':
        cap(0.42);
        add(this.hairGroup, new THREE.SphereGeometry(0.44, 24, 12, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.25, Math.PI * 0.45), hm, 0, 0, 0);
        break;
      case 'long':
        cap(0.42);
        add(this.hairGroup, new THREE.SphereGeometry(0.44, 24, 12, Math.PI * 0.6, Math.PI * 0.8, Math.PI * 0.25, Math.PI * 0.45), hm, 0, 0, 0);
        add(this.hairGroup, new THREE.CapsuleGeometry(0.3, 0.35, 4, 12), hm, 0, -0.35, -0.2, 1.1, 1, 0.45);
        break;
      case 'pigtail':
        cap(0.42);
        for (const sx of [-1, 1]) add(this.hairGroup, new THREE.SphereGeometry(0.13, 12, 10), hm, 0.42 * sx, -0.05, -0.12, 0.9, 1.5, 0.9);
        break;
      case 'bun':
        cap(0.45);
        add(this.hairGroup, new THREE.SphereGeometry(0.16, 14, 12), hm, 0, 0.42, -0.12);
        break;
      default:
        cap(0.42);
    }
    const accMat = (c) => this.mat(c);
    if (l.acc === 'glasses') {
      const frame = accMat('#2a2a2e');
      for (const ex of [-0.13, 0.13]) add(this.accGroup, new THREE.TorusGeometry(0.075, 0.012, 6, 18), frame, ex, -0.02, 0.385);
      add(this.accGroup, new THREE.BoxGeometry(0.1, 0.015, 0.015), frame, 0, -0.01, 0.39);
    } else if (l.acc === 'cap') {
      const red = accMat('#c8473d');
      add(this.accGroup, new THREE.SphereGeometry(0.435, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), red, 0, 0.04, -0.02, 1, 1, 1, -0.2);
      add(this.accGroup, new THREE.CylinderGeometry(0.26, 0.26, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), red, 0, 0.17, 0.3, 1, 1, 1.1, 0.12);
    } else if (l.acc === 'ribbon') {
      const pink = accMat('#ee7fa6');
      for (const sx of [-1, 1]) {
        const m = add(this.accGroup, new THREE.ConeGeometry(0.09, 0.16, 12), pink, 0.2 + sx * 0.09, 0.36, 0.05);
        m.rotation.z = (sx * Math.PI) / 2;
      }
      add(this.accGroup, new THREE.SphereGeometry(0.045, 10, 8), pink, 0.2, 0.36, 0.05);
    }
    this.root.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
  }

  setName(name) {
    this.name = name;
    if (this.tag) {
      this.tagHolder.remove(this.tag);
      this.tag.material.map.dispose();
      this.tag.material.dispose();
    }
    this.tag = makeNameTag(name, { isMe: this.isMe, isTeacher: this.isTeacher });
    this.tagHolder.add(this.tag);
  }

  say(text) {
    this.clearBubble();
    this.bubble = makeBubble(text);
    this.bubble.position.y = 0.32 + this.bubble.scale.y / 2;
    this.tagHolder.add(this.bubble);
    this.bubbleT = 6;
  }

  clearBubble() {
    if (!this.bubble) return;
    this.tagHolder.remove(this.bubble);
    this.bubble.material.map.dispose();
    this.bubble.material.dispose();
    this.bubble = null;
  }

  showEmoji(e, secs) {
    if (this.emoji) {
      this.root.remove(this.emoji);
      this.emoji.material.map.dispose();
    }
    this.emoji = makeEmoji(e);
    this.emoji.position.set(0.55, 1.6, 0);
    this.root.add(this.emoji);
    this.emojiT = secs;
  }

  play(type) {
    const dur = { hand: 4, bow: 1.8, clap: 2.2 }[type] || 2;
    this.action = { type, t: 0, dur };
    if (type === 'hand') this.showEmoji('✋', dur);
    if (type === 'clap') this.showEmoji('👏', dur);
  }

  update(dt, heightAt) {
    const r = this.root;
    // 이동
    let moving = false;
    if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) {
        this.pos.x = this.target.x;
        this.pos.z = this.target.z;
        const reached = this.target;
        if (this.reroute && !reached.stair) {
          // 계단을 다 내려온/올라온 뒤에 새 목적지로 출발
          const r = this.reroute;
          this.reroute = null;
          this.target = null;
          this.path = [];
          r();
        } else if (this.path?.length) {
          this.target = this.path.shift();
        } else {
          this.target = null;
          this.onArrive?.();
        }
      } else {
        const step = Math.min(dist, 4 * dt);
        this.pos.x += (dx / dist) * step;
        this.pos.z += (dz / dist) * step;
        this.faceAngle(Math.atan2(dx, dz), dt);
        moving = true;
      }
    }

    const groundY = this.sitChair ? this.sitChair.seatY - 0.5 + 0.02 : heightAt(this.pos.x, this.pos.z, this.pos.y);
    // 계단에서는 바로 따라가고, 평지에서는 부드럽게
    const onStair = this.target?.stair;
    this.pos.y = onStair ? groundY : this.pos.y + (groundY - this.pos.y) * Math.min(1, dt * 12);
    r.position.copy(this.pos);
    if (this.sitChair) this.faceAngle(this.sitChair.ry, dt);

    // 걷는 동작
    this.speed += ((moving ? 1 : 0) - this.speed) * Math.min(1, dt * 8);
    this.walkPhase += dt * 9 * this.speed;
    const swing = Math.sin(this.walkPhase) * 0.6 * this.speed;
    let legL = swing;
    let legR = -swing;
    let armLx = -swing * 0.8;
    let armRx = swing * 0.8;
    let armLz = -0.12;
    let armRz = 0.12;
    let bodyX = 0;
    let bob = Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.speed;

    if (this.sitChair) {
      legL = legR = -Math.PI / 2;
      bob = 0;
    }

    // 동작(손들기/인사/박수)
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const k = Math.min(1, a.t / 0.3, (a.dur - a.t) / 0.3); // 부드럽게 시작/끝
      if (a.type === 'hand') {
        armRx = -Math.PI * 0.95 * k + armRx * (1 - k);
        armRz = 0.12 + 0.15 * k;
        if (a.t > 0.3 && a.t < a.dur - 0.3) armRz += Math.sin(a.t * 6) * 0.08;
      } else if (a.type === 'bow') {
        const p = Math.sin(Math.min(1, a.t / a.dur) * Math.PI);
        bodyX = 0.75 * p;
        armLx = armRx = -0.15 * p;
      } else if (a.type === 'clap') {
        const c = Math.abs(Math.sin(a.t * 11));
        armLx = armRx = -1.25 * k;
        armLz = -(0.12 + 0.45 * c) * k + 0.6 * k;
        armRz = (0.12 + 0.45 * c) * k - 0.6 * k;
      }
      if (a.t >= a.dur) this.action = null;
    }

    const ease = Math.min(1, dt * 14);
    const lerp = (o, key, v) => (o[key] += (v - o[key]) * ease);
    lerp(this.legL.rotation, 'x', legL);
    lerp(this.legR.rotation, 'x', legR);
    lerp(this.armL.rotation, 'x', armLx);
    lerp(this.armR.rotation, 'x', armRx);
    lerp(this.armL.rotation, 'z', armLz);
    lerp(this.armR.rotation, 'z', armRz);
    lerp(this.body.rotation, 'x', bodyX);
    this.body.position.y = 0.5 + bob;
    this.legL.position.y = this.legR.position.y = 0.5;

    // 말풍선/이모지 타이머
    if (this.bubble && (this.bubbleT -= dt) <= 0) this.clearBubble();
    if (this.emoji) {
      this.emojiT -= dt;
      this.emoji.position.y = 1.6 + Math.sin(this.emojiT * 4) * 0.05;
      if (this.emojiT <= 0) {
        this.root.remove(this.emoji);
        this.emoji.material.map.dispose();
        this.emoji = null;
      }
    }
  }

  faceAngle(target, dt) {
    let d = target - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 10);
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
