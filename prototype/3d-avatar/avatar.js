// 새싹책방 2.0 아바타 시제품 — ChatGPT 삼면도를 보고 도형으로 조립
// 키 1.0 기준(발바닥 y=0). 정면 = +z.
import * as THREE from 'three';

const deg = THREE.MathUtils.degToRad;
export const DEFAULT_LOOK = {
  skin: '#FFD9B8', hair: '#96563A', shirt: '#AAC45E', collar: '#FBEBC6',
  shorts: '#FBE8C0', shoe: '#B9703F', sole: '#FBE9C4', eye: '#4A2B1B', cheek: '#FBA69B', eyeScale: 1.1, cheekScale: 1.0,
};
export const LOOKS = [
  {},
  { hair: '#3E2C25', shirt: '#F6C96B', shorts: '#8FB8A8' },
  { hair: '#D9A25A', shirt: '#F3A6B4', shorts: '#FBE8C0' },
  { hair: '#5B3A2A', shirt: '#8EC3E0', shorts: '#F3E1B6' },
];

const HEAD_R = 0.24;
const FACE = { span: 0.46, W: 1024, H: 1024, alpha: deg(66), t0: deg(40), tLen: deg(108) };

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
}

// 얼굴 그림: 정면에서 본 좌표 그대로 그림 (x 오른쪽 +, y 위쪽 +, 머리 중심 기준)
export function drawFace(look, mood = 'smile') {
  const c = document.createElement('canvas');
  c.width = FACE.W; c.height = FACE.H;
  const g = c.getContext('2d');
  const k = FACE.W / FACE.span;
  const X = (x) => (x / FACE.span + 0.5) * FACE.W, Y = (y) => (0.5 - y / FACE.span) * FACE.H;
  const ell = (x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(X(x), Y(y), rx * k, ry * k, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };
  { // 앞머리가 드리우는 부드러운 그늘
    const sh = g.createLinearGradient(0, Y(0.2), 0, Y(-0.01));
    sh.addColorStop(0, '#E8926A66'); sh.addColorStop(0.55, '#E8926A30'); sh.addColorStop(1, '#E8926A00');
    g.fillStyle = sh; g.fillRect(0, 0, FACE.W, Y(-0.01));
  }
  for (const s of [-1, 1]) {
    const px = X(s * 0.102), py = Y(-0.168), rx = 0.033 * k * look.cheekScale, ry = 0.037 * k * look.cheekScale;
    g.save(); g.translate(px, py); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, look.cheek + 'f5'); gr.addColorStop(0.78, look.cheek + 'e8'); gr.addColorStop(1, look.cheek + '00');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const es = look.eyeScale, ex = s * 0.09, ey = -0.09;
    const nx = 1 / 1.1;   // 볼살 변형으로 가로가 10% 늘어나므로 미리 좁혀 그림(정면에서 원본 비율이 되게)
    if (mood === 'read') {
      g.strokeStyle = look.eye; g.lineWidth = 0.011 * k;
      g.beginPath(); g.ellipse(X(ex), Y(ey + 0.008), 0.034 * es * k, 0.022 * es * k, 0, 0.12 * Math.PI, 0.88 * Math.PI); g.stroke();
    } else {
      const rx = 0.044 * es * k * nx, ry = 0.049 * es * k, cx = X(ex), cy = Y(ey);
      // 흰자(둥근 타원)
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = '#FFF3DA'; g.fill();
      // 눈동자: 코 쪽·아래로 붙은 큰 타원, 눈 모양 밖으로는 나가지 않게 잘라냄
      g.save(); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
      const pcx = X(ex - s * 0.0125 * es * nx), pcy = Y(ey - 0.008 * es);
      g.beginPath(); g.ellipse(pcx, pcy, 0.0315 * es * k * nx, 0.0415 * es * k, 0, 0, Math.PI * 2); g.fillStyle = look.eye; g.fill();
      g.restore();
      // 속눈썹 선: 굵기가 일정하고 끝이 둥근 선으로 위쪽과 바깥쪽을 감쌈
      g.strokeStyle = look.eye; g.lineWidth = 0.0105 * es * k;
      const d2r = Math.PI / 180, a0 = (s < 0 ? 158 : 212) * d2r, a1 = (s < 0 ? 328 : 382) * d2r;
      g.beginPath(); g.ellipse(cx, cy, rx + 0.002 * k, ry + 0.002 * k, 0, a0, a1); g.stroke();
      // 반짝임
      g.beginPath(); g.ellipse(X(ex - s * 0.0125 * es * nx + 0.006 * es), Y(ey - 0.008 * es + 0.019 * es), 0.0098 * es * k * nx, 0.0098 * es * k, 0, 0, Math.PI * 2); g.fillStyle = '#FFF6E2'; g.fill();
    }
    g.strokeStyle = '#5A3320'; g.lineWidth = 0.0095 * k;
    g.beginPath(); g.ellipse(X(s * 0.1), Y(-0.002), 0.032 * k, 0.019 * k, s * -0.12, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
  }
  g.lineWidth = 0.0088 * k; g.strokeStyle = '#6B3A22';
  g.beginPath();
  if (mood === 'read') g.ellipse(X(0), Y(-0.168), 0.012 * k, 0.006 * k, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  else g.ellipse(X(0), Y(-0.16), 0.036 * k, 0.018 * k, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function blushTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color + 'f0'); gr.addColorStop(0.72, color + 'e0'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
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

// 머리 표면의 dir 방향에 접하도록 놓는 회전값 (z=바깥쪽, y=위쪽, roll=표면 위에서 돌리기)
function surfaceQuat(dir, roll = 0) {
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(dir, x);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, dir));
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), deg(roll)));
}

// 볼살: 머리 아래쪽 절반을 옆으로 통통하게 부풀림 (원본 그림의 넓적한 볼)
function puff(v) {
  const t = v.y / HEAD_R;
  const w = Math.exp(-Math.pow((t + 0.58) / 0.5, 2));
  const f = THREE.MathUtils.smoothstep(v.z / HEAD_R, -0.3, 0.3);   // 얼굴 쪽(앞)만 부풀림, 뒤통수는 그대로
  v.x *= 1 + 0.12 * w * f;
  v.z *= 1 + 0.05 * w * f;             // 볼과 입가를 앞으로 도톰하게(옆모습이 평평한 얼굴)
  if (t < 0) v.y *= 1 - 0.1 * t * t;   // 턱을 살짝 올려 납작하고 넓은 턱선
  return v;
}
function puffGeometry(geo) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); puff(v); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}
// 얼굴 위 (x, y) 지점에 납작한 조각을 붙임. 정면에서 봤을 때 기울지 않도록 세로축을 화면 세로에 맞춤
function decal(parent, geo, material, x, y, sx, sy, sz, lift, order) {
  const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y));
  const n = new THREE.Vector3(x, y, z).normalize();
  const m = new THREE.Mesh(geo, material);
  m.position.copy(puff(n.clone().multiplyScalar(HEAD_R * lift)));
  const yA = new THREE.Vector3(0, n.z, -n.y).normalize(), xA = new THREE.Vector3().crossVectors(yA, n);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, n));
  m.scale.set(sx, sy, sz); m.renderOrder = order; parent.add(m);
  return m;
}

// 머리 표면의 한 방향(yaw, pitch)에 납작한 타원체(머리카락 덩어리)를 붙임
function lobe(parent, material, yaw, pitch, sx, sy, sz, roll = 0, r = HEAD_R * 0.985) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), material);
  const dir = new THREE.Vector3(Math.sin(deg(yaw)) * Math.cos(deg(pitch)), Math.sin(deg(pitch)), Math.cos(deg(yaw)) * Math.cos(deg(pitch)));
  m.position.copy(dir).multiplyScalar(r);
  m.quaternion.copy(surfaceQuat(dir, roll));
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}

// 머리카락 한 가닥: 위는 둥글고 아래 끝은 뾰족한 물방울 모양. 머리 곡면을 따라 휘어 붙음
function lock(parent, material, yaw, pitch, w, len, thick, roll = 0, r = HEAD_R * 1.0, tail = 1.2) {
  const geo = new THREE.SphereGeometry(1, 22, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) {
      const round = Math.sqrt(Math.max(1e-6, 1 - y * y)), taper = Math.pow(1 + y, 0.6);
      x *= taper / round; z *= taper / round; y *= tail;
    }
    x *= w; y *= len; z *= thick;
    z -= (x * x + y * y) / (2 * HEAD_R) * 0.9;   // 머리 곡면을 따라 휨
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  const dir = new THREE.Vector3(Math.sin(deg(yaw)) * Math.cos(deg(pitch)), Math.sin(deg(pitch)), Math.cos(deg(yaw)) * Math.cos(deg(pitch)));
  m.position.copy(dir).multiplyScalar(r);
  m.quaternion.copy(surfaceQuat(dir, roll));
  parent.add(m);
  return m;
}

export class Avatar {
  constructor(lookIn = {}) {
    const look = (this.look = { ...DEFAULT_LOOK, ...lookIn });
    const root = (this.root = new THREE.Group());
    const M = {
      skin: mat(look.skin, { emissive: '#FFA882', emissiveIntensity: 0.22 }), shirt: mat(look.shirt),
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

    // ── 반바지: 골반 덩어리 + 양쪽 통(통은 다리 관절에 붙어 걷기·앉기 때 함께 움직임)
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.shorts); pelvis.scale.set(0.118, 0.03, 0.094); pelvis.position.y = 0.29; body.add(pelvis);
    for (const hip of this.legs) {
      const s = Math.sign(hip.position.x);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.112, 20), M.shorts); tube.scale.z = 0.94; tube.position.set(s * 0.002, 0.022, 0); hip.add(tube);
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 10, 22), M.shorts); hem.rotation.x = Math.PI / 2; hem.scale.set(1, 0.94, 1); hem.position.set(s * 0.002, -0.032, 0); hip.add(hem);
    }

    // ── 상체(티셔츠)
    const torso = (this.torso = new THREE.Group()); body.add(torso);
    const shirtPts = [[0, 0.266], [0.12, 0.266], [0.146, 0.276], [0.15, 0.3], [0.142, 0.37], [0.124, 0.44], [0.098, 0.492], [0.06, 0.52], [0, 0.526]].map(([x, y]) => new THREE.Vector2(x, y));
    const shirt = new THREE.Mesh(new THREE.LatheGeometry(smooth(shirtPts), 32), M.shirt); shirt.scale.z = 0.8; torso.add(shirt);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.015, 10, 32), M.shirt); hem.rotation.x = Math.PI / 2; hem.scale.set(1, 0.8, 1); hem.position.y = 0.284; torso.add(hem);
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
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), M.shirt); cap.position.y = -0.012; sh.add(cap);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.045, 0.078, 18), M.shirt); sleeve.position.y = -0.055; sh.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.014, 10, 22), M.shirt); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.09; sh.add(cuff);
      const armPts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14, y = -0.05 - u * 0.15; armPts.push(new THREE.Vector2(0.037 + (0.053 - 0.037) * u * u * (3 - 2 * u), y)); }
      for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; armPts.push(new THREE.Vector2(0.053 * Math.cos(a), -0.2 - 0.053 * Math.sin(a))); }
      armPts.reverse();   // 아래에서 위 순서여야 겉면이 바깥을 향함
      const hand = new THREE.Mesh(new THREE.LatheGeometry(armPts, 22), M.skin); hand.scale.z = 0.94; sh.add(hand);
      sh.rotation.z = s * deg(33);
      sh.userData = { side: s, hand };
      this.arms.push(sh);
    }

    // ── 머리
    const head = (this.head = new THREE.Group()); head.position.set(0, 0.762, 0); torso.add(head);
    head.scale.set(1.0, 0.985, 1);
    head.add(new THREE.Mesh(puffGeometry(new THREE.SphereGeometry(HEAD_R, 56, 44)), M.skin));
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.043, 16, 12), M.skin); ear.scale.z = 0.62; ear.position.set(s * 0.236, -0.112, -0.02); head.add(ear);
    }
    // 얼굴 그림(표정 교체 가능)
    this.faceMat = new THREE.MeshBasicMaterial({ map: drawFace(look, 'smile'), transparent: true, depthWrite: false });
    const faceGeo = new THREE.SphereGeometry(HEAD_R * 1.006, 40, 30, Math.PI / 2 - FACE.alpha, FACE.alpha * 2, FACE.t0, FACE.tLen);
    { const p = faceGeo.attributes.position, uv = faceGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / FACE.span + 0.5, p.getY(i) / FACE.span + 0.5); }
    puffGeometry(faceGeo);
    const face = new THREE.Mesh(faceGeo, this.faceMat);
    face.renderOrder = 0; head.add(face);
    // 눈·볼터치: 머리 표면에 붙인 납작한 조각(옆에서 봐도 모양 유지)
    const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const onFace = (x, y) => { const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y)); return [THREE.MathUtils.radToDeg(Math.atan2(x, z)), THREE.MathUtils.radToDeg(Math.asin(y / HEAD_R))]; };
    // 원본 그림의 눈 구조: 둥근 크림색 흰자 + 안쪽·아래로 붙은 눈동자 + 위·바깥쪽을 감싸는 짙은 속눈썹 선
    this.eyes = [];
    const es = look.eyeScale, cs = look.cheekScale;
    const ball = new THREE.SphereGeometry(1, 24, 18);
    // 코: 살짝 튀어나온 둥근 코
    decal(head, ball, mat('#F9A88E', { emissive: '#F58F78', emissiveIntensity: 0.25 }), 0, -0.134, 0.0185, 0.0165, 0.014, 1.0, 0);
    // 머리카락: 머리보다 조금 큰 공을 뒤·위로 물려 씌우면 얼굴만 둥글게 드러남 + 앞머리 덩어리
    const hairSolid = mat(look.hair);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.256, 56, 44), hairSolid);
    cap.scale.set(1.045, 0.94, 1.02); cap.position.set(0, 0.024, -0.04); head.add(cap);
    lock(head, hairSolid, -60, 28, 0.085, 0.11, 0.046, -2);               // 왼쪽 관자놀이 가닥
    lock(head, hairSolid, -28, 38, 0.095, 0.13, 0.048, -8);               // 왼쪽 가닥
    lock(head, hairSolid, 10, 30, 0.112, 0.13, 0.052, -36);               // 가르마에서 왼쪽으로 넘어가는 큰 앞머리
    lock(head, hairSolid, 64, 30, 0.085, 0.12, 0.048, -16);               // 오른쪽 가닥
    lock(head, hairSolid, 78, 18, 0.07, 0.11, 0.044, -2);                 // 오른쪽 관자놀이 가닥
    lock(head, hairSolid, -72, -8, 0.034, 0.058, 0.024, -4, HEAD_R * 1.0);  // 귀 앞 옆머리(가늘고 뾰족)
    lock(head, hairSolid, 74, -8, 0.034, 0.058, 0.024, 6, HEAD_R * 1.0);
    lobe(head, hairSolid, 180, -36, 0.17, 0.085, 0.06, 0, HEAD_R * 0.94);   // 뒷목

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

    // 물조리개(물 줄 때만 보임): 몸통 + 앞으로 뻗은 주둥이 + 손잡이, 그리고 떨어지는 물방울
    const can = (this.can = new THREE.Group());
    const teal = mat('#63B792'), tealD = mat('#4FA27F');
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.11, 18), teal); can.add(cb);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 18), tealD); lip.rotation.x = Math.PI / 2; lip.position.y = 0.055; can.add(lip);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.16, 10), teal); spout.position.set(0, 0.03, 0.13); spout.rotation.x = deg(62); can.add(spout);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.016, 0.03, 12), tealD); rose.position.set(0, 0.068, 0.2); rose.rotation.x = deg(62); can.add(rose);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), tealD); handle.position.set(0, 0.02, -0.07); handle.rotation.set(0, Math.PI / 2, -Math.PI / 2); can.add(handle);
    can.visible = false; torso.add(can);
    this.drops = [];
    const dropMat = new THREE.MeshBasicMaterial({ color: '#CFF1F5', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dropMat); d.visible = false; torso.add(d); this.drops.push(d); }

    this.t = Math.random() * 10;
    this.state = 'idle';
    this.lookUp = 0;   // 고개 드는 각도(라디안). 내려다보는 카메라에서는 0.25 정도
  }

  setMood(mood) { this.faceMat.map.dispose(); this.faceMat.map = drawFace(this.look, mood); }

  setState(state) {
    this.state = state;
    this.book.visible = state === 'read';
    this.can.visible = state === 'water';
    this.drops.forEach((d) => { d.visible = state === 'water'; });
    this.eyes.forEach((e) => { e.visible = state !== 'read'; });
    this.setMood(state === 'read' ? 'read' : 'smile');
  }

  update(dt) {
    this.t += dt;
    const t = this.t, [la, ra] = this.arms, [ll, rl] = this.legs;
    const rest = (a) => { a.rotation.set(0, 0, a.userData.side * deg(33)); };
    this.body.position.y = 0; this.torso.rotation.set(0, 0, 0); this.head.rotation.set(-this.lookUp, 0, 0);
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
        this.head.rotation.x = deg(9) - this.lookUp * 0.5 + Math.sin(t * 0.9) * 0.02;
        this.torso.rotation.x = deg(5);
        this.book.position.set(0, 0.385, 0.2); this.book.rotation.set(deg(38), 0, 0);
      } else {
        la.rotation.set(deg(-30), 0, deg(-12)); ra.rotation.set(deg(-30), 0, deg(12));
        this.head.rotation.z = Math.sin(t * 1.1) * 0.03;
      }
    } else if (this.state === 'water') {
      // 두 손으로 물조리개를 앞으로 기울여 물을 줌
      la.rotation.set(deg(-52), 0, deg(20)); ra.rotation.set(deg(-52), 0, deg(-20));
      this.torso.rotation.x = deg(7); this.head.rotation.x = deg(8) - this.lookUp * 0.6;
      const tilt = deg(34) + Math.sin(t * 2.2) * 0.05;
      this.can.position.set(0, 0.34, 0.24); this.can.rotation.set(tilt, 0, 0);
      this.drops.forEach((d, i) => { const u = ((t * 1.6 + i / this.drops.length) % 1); d.position.set((i % 3 - 1) * 0.012, 0.3 - u * u * 0.3, 0.44 + u * 0.1); d.scale.setScalar(1 - u * 0.4); });
    } else if (this.state === 'wave') {
      ra.rotation.set(0, 0, deg(112) + Math.sin(t * 8) * 0.28);
      this.head.rotation.z = deg(5);
    }
  }
}
