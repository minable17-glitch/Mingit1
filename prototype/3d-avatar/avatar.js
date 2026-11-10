// 새싹책방 2.0 아바타 시제품 — ChatGPT 삼면도를 보고 도형으로 조립
// 키 1.0 기준(발바닥 y=0). 정면 = +z.
import * as THREE from 'three';

const deg = THREE.MathUtils.degToRad;
export const DEFAULT_LOOK = {
  skin: '#FFD0A6', hair: '#96563A', shirt: '#AAC45E', collar: '#FBEBC6',
  shorts: '#FBE8C0', shoe: '#B9703F', sole: '#FBE9C4', eye: '#4A2C1A', cheek: '#FFA98C',
};
export const LOOKS = [
  {},
  { hair: '#3E2C25', shirt: '#F6C96B', shorts: '#8FB8A8' },
  { hair: '#D9A25A', shirt: '#F3A6B4', shorts: '#FBE8C0' },
  { hair: '#5B3A2A', shirt: '#8EC3E0', shorts: '#F3E1B6' },
];

const HEAD_R = 0.24;
const FACE = { span: 0.46, W: 512, H: 512, alpha: deg(66), t0: deg(40), tLen: deg(108) };

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });
}

// 얼굴 그림: 정면에서 본 좌표 그대로 그림 (x 오른쪽 +, y 위쪽 +, 머리 중심 기준)
export function drawFace(look, mood = 'smile') {
  const c = document.createElement('canvas');
  c.width = FACE.W; c.height = FACE.H;
  const g = c.getContext('2d');
  const k = FACE.W / FACE.span;
  const X = (x) => (x / FACE.span + 0.5) * FACE.W, Y = (y) => (0.5 - y / FACE.span) * FACE.H;
  const ell = (x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(X(x), Y(y), rx * k, ry * k, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    if (mood === 'read') {
      g.strokeStyle = look.eye; g.lineWidth = 0.011 * k;
      g.beginPath(); g.ellipse(X(s * 0.086), Y(-0.085), 0.03 * k, 0.022 * k, 0, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    }
    g.strokeStyle = look.eye; g.lineWidth = 0.008 * k;
    g.beginPath(); g.ellipse(X(s * 0.094), Y(-0.03), 0.034 * k, 0.022 * k, 0, Math.PI * 1.2, Math.PI * 1.8); g.stroke();
  }
  ell(0, -0.127, 0.015, 0.011, '#FFA78E');
  g.lineWidth = 0.009 * k; g.strokeStyle = '#7A4A32';
  g.beginPath();
  if (mood === 'read') g.ellipse(X(0), Y(-0.168), 0.011 * k, 0.006 * k, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  else g.ellipse(X(0), Y(-0.148), 0.032 * k, 0.022 * k, 0, 0.14 * Math.PI, 0.86 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function smooth(pts) { return new THREE.SplineCurve(pts).getPoints(36); }

function sproutTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = color;
  g.beginPath(); g.ellipse(42, 52, 26, 17, -0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(86, 52, 26, 17, 0.5, 0, Math.PI * 2); g.fill();
  g.fillRect(59, 56, 10, 52); g.beginPath(); g.arc(64, 108, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 머리 표면의 한 방향(yaw, pitch)에 납작한 타원체(머리카락 덩어리)를 붙임
function lobe(parent, material, yaw, pitch, sx, sy, sz, roll = 0, r = HEAD_R * 0.985) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), material);
  const dir = new THREE.Vector3(Math.sin(deg(yaw)) * Math.cos(deg(pitch)), Math.sin(deg(pitch)), Math.cos(deg(yaw)) * Math.cos(deg(pitch)));
  m.position.copy(dir).multiplyScalar(r);
  m.lookAt(dir.clone().multiplyScalar(2));
  m.rotateZ(deg(roll));
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}

export class Avatar {
  constructor(lookIn = {}) {
    const look = (this.look = { ...DEFAULT_LOOK, ...lookIn });
    const root = (this.root = new THREE.Group());
    const M = {
      skin: mat(look.skin), shirt: mat(look.shirt),
      collar: mat(look.collar), shorts: mat(look.shorts), shoe: mat(look.shoe), sole: mat(look.sole),
    };

    // 몸 전체(걷기 때 통통 튐)
    const body = (this.body = new THREE.Group()); root.add(body);

    // ── 다리(골반 관절) + 신발
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.066, 0.215, 0); body.add(hip);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.039, 0.13, 16), M.skin); leg.position.y = -0.075; hip.add(leg);
      const sole = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M.sole); sole.scale.set(0.071, 0.03, 0.106); sole.position.set(s * 0.006, -0.187, 0.03); hip.add(sole);
      const up = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M.shoe); up.scale.set(0.066, 0.068, 0.098); up.position.set(s * 0.006, -0.182, 0.03); hip.add(up);
      this.legs.push(hip);
    }

    // ── 반바지
    const shortsPts = [[0, 0.17], [0.11, 0.17], [0.138, 0.178], [0.144, 0.2], [0.14, 0.27], [0.12, 0.296], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y));
    const shorts = new THREE.Mesh(new THREE.LatheGeometry(smooth(shortsPts), 32), M.shorts); shorts.scale.z = 0.78; body.add(shorts);

    // ── 상체(티셔츠)
    const torso = (this.torso = new THREE.Group()); body.add(torso);
    const shirtPts = [[0, 0.266], [0.12, 0.266], [0.146, 0.276], [0.15, 0.3], [0.142, 0.37], [0.124, 0.44], [0.098, 0.492], [0.06, 0.52], [0, 0.526]].map(([x, y]) => new THREE.Vector2(x, y));
    const shirt = new THREE.Mesh(new THREE.LatheGeometry(smooth(shirtPts), 32), M.shirt); shirt.scale.z = 0.8; torso.add(shirt);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: sproutTexture('#E4EBA6'), transparent: true, depthWrite: false }));
    logo.position.set(0, 0.39, 0.116); logo.rotation.x = deg(-6); torso.add(logo);
    // 둥근 칼라(납작한 두 장 + 뒷목 띠)
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M.collar);
      col.scale.set(0.066, 0.013, 0.05); col.position.set(s * 0.05, 0.512, 0.052); col.rotation.set(deg(30), 0, s * deg(-16)); torso.add(col);
    }
    const colBack = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.014, 10, 28), M.collar); colBack.rotation.x = Math.PI / 2; colBack.scale.set(1.05, 0.86, 1); colBack.position.set(0, 0.516, -0.008); torso.add(colBack);

    // ── 팔(어깨 관절): 소매 + 팔 + 손
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.098, 0.472, 0); torso.add(sh);
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.05, 6, 16), M.shirt); sleeve.position.y = -0.052; sh.add(sleeve);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07, 6, 14), M.skin); arm.position.y = -0.128; sh.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.049, 18, 14), M.skin); hand.position.y = -0.2; sh.add(hand);
      sh.rotation.z = s * deg(33);
      sh.userData = { side: s, hand };
      this.arms.push(sh);
    }

    // ── 머리
    const head = (this.head = new THREE.Group()); head.position.set(0, 0.762, 0); torso.add(head);
    head.scale.set(1.04, 0.985, 1);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 56, 44), M.skin));
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.043, 16, 12), M.skin); ear.scale.z = 0.62; ear.position.set(s * 0.226, -0.118, -0.005); head.add(ear);
    }
    // 얼굴 그림(표정 교체 가능)
    this.faceMat = new THREE.MeshBasicMaterial({ map: drawFace(look, 'smile'), transparent: true, depthWrite: false });
    const faceGeo = new THREE.SphereGeometry(HEAD_R * 1.006, 40, 30, Math.PI / 2 - FACE.alpha, FACE.alpha * 2, FACE.t0, FACE.tLen);
    { const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / FACE.span + 0.5, p.getY(i) / FACE.span + 0.5); }
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.renderOrder = 3; head.add(face);
    // 눈·볼터치: 머리 표면에 붙인 납작한 조각(옆에서 봐도 모양 유지)
    const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const onFace = (x, y) => { const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y)); return [THREE.MathUtils.radToDeg(Math.atan2(x, z)), THREE.MathUtils.radToDeg(Math.asin(y / HEAD_R))]; };
    this.eyes = [];
    for (const s of [-1, 1]) {
      const [yw, pt] = onFace(s * 0.086, -0.092);
      const white = lobe(head, flat('#FFF1D8'), yw + s * 1.2, pt - 1.2, 0.036, 0.05, 0.006, 0, HEAD_R * 1.002); white.renderOrder = 1;
      const pupil = lobe(head, flat(look.eye), yw, pt, 0.031, 0.047, 0.008, 0, HEAD_R * 1.004); pupil.renderOrder = 2;
      const [hy, hp] = onFace(s * 0.086 + 0.011, -0.073);
      const glint = lobe(head, flat('#ffffff'), hy, hp, 0.009, 0.01, 0.004, 0, HEAD_R * 1.012); glint.renderOrder = 3;
      this.eyes.push(white, pupil, glint);
      const [cy, cp] = onFace(s * 0.132, -0.158);
      const cheek = lobe(head, flat(look.cheek, 0.78), cy, cp, 0.04, 0.036, 0.004, 0, HEAD_R * 1.003); cheek.renderOrder = 1;
    }
    // 머리카락: 머리보다 조금 큰 공을 뒤·위로 물려 씌우면 얼굴만 둥글게 드러남 + 앞머리 덩어리
    const hairSolid = mat(look.hair);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.256, 56, 44), hairSolid);
    cap.scale.set(1.03, 0.94, 1.0); cap.position.set(0, 0.022, -0.045); head.add(cap);
    lobe(head, hairSolid, -20, 38, 0.172, 0.104, 0.046, 16);   // 큰 앞머리(화면 왼쪽)
    lobe(head, hairSolid, -58, 23, 0.104, 0.1, 0.046, 42);     // 왼쪽 끝자락
    lobe(head, hairSolid, 8, 56, 0.13, 0.09, 0.046, 0);        // 정수리 앞
    lobe(head, hairSolid, 43, 33, 0.114, 0.098, 0.046, -36);   // 오른쪽 앞머리
    lobe(head, hairSolid, 69, 15, 0.074, 0.096, 0.042, -52);   // 오른쪽 끝자락
    lobe(head, hairSolid, -86, -6, 0.048, 0.088, 0.034, 6);    // 귀 앞 옆머리
    lobe(head, hairSolid, 86, -6, 0.048, 0.088, 0.034, -6);

    // 바닥 그림자(가벼운 원판)
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: '#5a4630', transparent: true, opacity: 0.16, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.004; sh.scale.y = 0.72; root.add(sh); this.shadow = sh;

    // 책(읽을 때만 보임)
    const book = (this.book = new THREE.Group());
    for (const s of [-1, 1]) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.13), mat('#E98F6B')); cover.position.x = s * 0.05; cover.rotation.z = s * deg(14); book.add(cover);
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.118), mat('#FFF8E8')); page.position.set(s * 0.048, 0.008, 0); page.rotation.z = s * deg(14); book.add(page);
    }
    book.visible = false; torso.add(book);

    this.t = Math.random() * 10;
    this.state = 'idle';
  }

  setMood(mood) { this.faceMat.map.dispose(); this.faceMat.map = drawFace(this.look, mood); }

  setState(state) {
    this.state = state;
    this.book.visible = state === 'read';
    this.eyes.forEach((e) => { e.visible = state !== 'read'; });
    this.setMood(state === 'read' ? 'read' : 'smile');
  }

  update(dt) {
    this.t += dt;
    const t = this.t, [la, ra] = this.arms, [ll, rl] = this.legs;
    const rest = (a) => { a.rotation.set(0, 0, a.userData.side * deg(33)); };
    this.body.position.y = 0; this.torso.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    ll.rotation.set(0, 0, 0); rl.rotation.set(0, 0, 0); rest(la); rest(ra);
    this.torso.position.set(0, 0, 0);
    if (this.state === 'idle') {
      this.torso.position.y = Math.sin(t * 2.2) * 0.004;
      this.head.rotation.z = Math.sin(t * 1.1) * 0.03;
    } else if (this.state === 'walk') {
      const w = Math.sin(t * 9);
      ll.rotation.x = w * 0.75; rl.rotation.x = -w * 0.75;
      la.rotation.x = -w * 0.7; ra.rotation.x = w * 0.7;
      this.body.position.y = Math.abs(Math.cos(t * 9)) * 0.022;
      this.torso.rotation.z = w * 0.035; this.head.rotation.z = -w * 0.03;
    } else if (this.state === 'sit' || this.state === 'read') {
      ll.rotation.x = deg(-86); rl.rotation.x = deg(-86);
      if (this.state === 'read') {
        la.rotation.set(deg(-58), 0, deg(14)); ra.rotation.set(deg(-58), 0, deg(-14));
        this.head.rotation.x = deg(9) + Math.sin(t * 0.9) * 0.02;
        this.torso.rotation.x = deg(5);
        this.book.position.set(0, 0.385, 0.2); this.book.rotation.set(deg(38), 0, 0);
      } else {
        la.rotation.set(deg(-30), 0, deg(-12)); ra.rotation.set(deg(-30), 0, deg(12));
        this.head.rotation.z = Math.sin(t * 1.1) * 0.03;
      }
    } else if (this.state === 'wave') {
      ra.rotation.set(0, 0, deg(112) + Math.sin(t * 8) * 0.28);
      this.head.rotation.z = deg(5);
    }
  }
}
