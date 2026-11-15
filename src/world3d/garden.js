// 새싹책방 2.0 정원 — ChatGPT 정원 콘셉트와 나무 6단계 그림을 보고 도형으로 조립
// 가운데 우리 반 나무 + 화단 8곳 × 4그루 = 학생 나무 32그루. 좌표: x 오른쪽 +, z 화면 앞쪽 +
import * as THREE from 'three';
import { Batch, landscapeTexture, LAND_FRAC, glowTexture } from './library.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const deg = THREE.MathUtils.degToRad;
export const G = {
  path: '#F7DCAE', pathEdge: '#EFCF9C', grass: '#C3D96C', grassDk: '#B2CC5E', forestFloor: '#A9D07A',
  stone: '#F1E2C5', stoneDk: '#E4D2B0', soil: '#B9814F', soilDk: '#A56F40', seed: '#C37639',
  sprout: '#9CCB33', sproutL: '#B5DC45', leafD: '#86BE3C', leafL: '#B9DE4A', trunk: '#D38F4A', trunkDk: '#BC7A3C',
  bud: '#F58E97', petalP: '#F7909C', petalW: '#FFF0E4', petalM: '#F4A6CF', center: '#FFD85A', fruit: '#FFD23F',
  wood: '#E6B06C', woodDk: '#CF9550', water: '#9FDCE2', faucet: '#D99A3C', wall: '#F8EAD2', roof: '#EDB98F', frame: '#DFA466',
};
export const STAGE_NAMES = ['씨앗', '새싹', '줄기', '잎', '꽃봉오리', '활짝 핀 꽃'];

// ── 마당과 학생 화단 배치: 학생마다 동그란 화단 하나. 우리 반 나무를 둘러 타원 고리 모양으로 안쪽부터 채움
export const YARD = { rx: 6.6, rz: 8.8, cz: 0.4 };       // 마당(타원). GPT 배치 시안 '추천안 C(중앙 큰 나무 + 방사형)'
export const CENTER = [0, -0.45];
export const WELL = [3.4, 6.6];
export const DOOR = [-4.0, 7.6];
const BED_GAP = 0.3, FRONT_Z = 3.9;                       // 화단 사이 간격, 앞마당(도서관 문·우물 쪽)은 비움
export const SPOKES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];   // 가운데에서 앞·오른쪽·뒤·왼쪽으로 뻗는 오솔길
const SPOKE_HW = 0.3;                                     // 오솔길 반 폭
// 가운데에서 뻗는 오솔길 위(또는 가까이)인지
export function nearSpoke(x, z, pad = 0) {
  for (const a of SPOKES) {
    const ux = Math.sin(a), uz = Math.cos(a), t = (x - CENTER[0]) * ux + (z - CENTER[1]) * uz;
    if (t < 0) continue;
    if (Math.hypot(x - CENTER[0] - t * ux, z - CENTER[1] - t * uz) < SPOKE_HW + pad) return true;
  }
  return false;
}
function ringBeds(bed) {
  const d = 2 * bed + BED_GAP, spots = [];
  let r = 1.6 + bed + 0.45;
  const teacher = { x: CENTER[0], z: CENTER[1] + r * 1.12 };   // 첫 고리 맨 앞 = 선생님 화단
  while (r < Math.max(YARD.rx, YARD.rz) + 1) {
    const rx = r, rz = r * 1.12, n = Math.floor((2 * Math.PI * Math.sqrt((rx * rx + rz * rz) / 2)) / d);
    let best = null;
    for (let o = 0; o < 8; o++) {
      const off = (o * Math.PI) / (4 * Math.max(n, 1)), cand = [];
      for (let i = 0; i < n * 2; i++) {
        const a = off + (2 * Math.PI * i) / (n * 2), x = CENTER[0] + Math.sin(a) * rx, z = CENTER[1] + Math.cos(a) * rz;
        if (nearSpoke(x, z, bed)) continue;
        if ((x / (YARD.rx - bed - 0.1)) ** 2 + ((z - YARD.cz) / (YARD.rz - bed - 0.1)) ** 2 > 1 || z > FRONT_Z) continue;
        if (Math.hypot(x - teacher.x, z - teacher.z) < d) continue;
        if ([...spots, ...cand].some((q) => Math.hypot(x - q.x, z - q.z) < d)) continue;
        cand.push({ x, z });
      }
      if (!best || cand.length > best.length) best = cand;
    }
    if (best && best.length) { spots.push(...best); r += d * 0.98; } else r += 0.05;
  }
  return { spots, teacher };
}
// 학생 수만큼 화단 자리(모자라면 화단을 조금씩 줄여서 모두 들어가게)
export function bedLayout(count) {
  for (let bed = 0.6; ; bed -= 0.04) {
    const { spots, teacher } = ringBeds(bed);
    if (spots.length >= count || bed <= 0.44) return { bed, teacher, spots: spots.slice(0, count) };
  }
}
// ux, uz: 꾸미기 소품을 놓는 앞쪽 방향, bedR: 화단 반지름
export function planterLayout(students = 32) {
  const L = bedLayout(students);
  return L.spots.map((p, i) => ({ id: i + 1, x: p.x, z: p.z, ux: 0, uz: 1, bedR: L.bed }));
}

const ballFar = new THREE.SphereGeometry(1, 8, 6);
const cone = (rt, rb, seg = 12) => new THREE.CylinderGeometry(rt, rb, 1, seg);
const ball = new THREE.SphereGeometry(1, 18, 14), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), box = new THREE.BoxGeometry(1, 1, 1);
const M4 = (x, y, z, sx, sy, sz, q) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q || new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
const qEuler = (rx, ry, rz) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
const qTo = (dir) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
// 공 위에 고르게 퍼진 방향들(꽃·봉오리 자리)
const spread = (n, yMin = -0.25, seed = 1) => { const out = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * (1 - yMin); const r = Math.sqrt(Math.max(0, 1 - y * y)); const th = ga * i + seed; out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r)); }
  return out; };

// 여러 공으로 된 잎 뭉치에서, 가운데 c에서 d 방향으로 가장 바깥 겉면의 점
function onSurface(blobs, c, d) {
  let best = 0;
  for (const [x, y, z, rx, ry, rz] of blobs) {
    // 타원체를 단위 공으로 바꿔 계산
    const o = new THREE.Vector3((c.x - x) / rx, (c.y - y) / ry, (c.z - z) / rz), dd = new THREE.Vector3(d.x / rx, d.y / ry, d.z / rz);
    const A = dd.dot(dd), B = 2 * o.dot(dd), C = o.dot(o) - 1, disc = B * B - 4 * A * C;
    if (disc > 0) best = Math.max(best, (-B + Math.sqrt(disc)) / (2 * A));
  }
  return c.clone().add(d.clone().multiplyScalar(best));
}

// 꽃 한 송이(꽃잎 5장 + 노란 가운데), 바깥쪽(dir)을 향함
function flower(b, pos, dir, size, color) {
  const q = qTo(dir);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const off = new THREE.Vector3(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62, 0).applyQuaternion(q);
    b.addM(color, ball, M4(pos.x + off.x, pos.y + off.y, pos.z + off.z, size * 0.5, size * 0.5, size * 0.26, q)); }
  const c = new THREE.Vector3(0, 0, size * 0.16).applyQuaternion(q);
  b.addM(G.center, ball, M4(pos.x + c.x, pos.y + c.y, pos.z + c.z, size * 0.3, size * 0.3, size * 0.22, q));
}
// 뭉게뭉게한 잎 뭉치
const CANOPY = [[0, 0.7, 0, 0.21, 0], [-0.18, 0.61, 0.04, 0.165, 0], [0.18, 0.61, 0.04, 0.165, 0], [0, 0.6, 0.17, 0.16, 1], [-0.11, 0.76, 0.08, 0.13, 1], [0.12, 0.75, -0.02, 0.14, 1], [0, 0.61, -0.16, 0.16, 0], [-0.21, 0.5, -0.04, 0.12, 0], [0.21, 0.5, -0.03, 0.12, 1], [0.1, 0.56, 0.14, 0.13, 1], [-0.12, 0.55, 0.15, 0.12, 0]];
function canopy(b, k = 1, y0 = 0) { for (const [x, y, z, r, light] of CANOPY) b.addM(light ? G.leafL : G.leafD, ball, M4(x * k, y0 + y * k, z * k, r * k, r * k * 0.95, r * k)); }
function trunkY(b, k = 1) {
  b.addM(G.trunk, new THREE.CylinderGeometry(0.045, 0.07, 0.36, 12), M4(0, 0.2 * k, 0, k, k, k));
  for (const s of [-1, 1]) b.addM(G.trunk, new THREE.CylinderGeometry(0.028, 0.04, 0.2, 10), M4(s * 0.07 * k, 0.42 * k, 0, k, k, k, qEuler(0, 0, -s * deg(38))));
  b.addM(G.trunkDk, ball, M4(0, 0.02 * k, 0, 0.1 * k, 0.03 * k, 0.1 * k));
}

// 학생 나무 6단계: 0 씨앗, 1 새싹, 2 줄기, 3 잎, 4 꽃봉오리, 5 활짝 핀 꽃
function buildStage(stage) {
  const b = new Batch();
  const leaf = (x, y, ang, len, color) => b.addM(color, ball, M4(x, y, 0, len, len * 0.4, len * 0.62, qEuler(0, 0, ang)));
  if (stage === 0) {
    b.addM(G.soilDk, ball, M4(0, 0.03, 0, 0.17, 0.05, 0.17));
    b.addM(G.seed, ball, M4(0, 0.09, 0, 0.07, 0.08, 0.07));
  } else if (stage === 1) {
    b.addM(G.sprout, new THREE.CylinderGeometry(0.02, 0.024, 0.2, 10), M4(0, 0.1, 0, 1, 1, 1));
    leaf(-0.1, 0.23, deg(-28), 0.115, G.sproutL); leaf(0.1, 0.23, deg(28), 0.115, G.sprout);
  } else if (stage === 2) {
    b.addM(G.sprout, new THREE.CylinderGeometry(0.026, 0.032, 0.46, 10), M4(0, 0.23, 0, 1, 1, 1));
    leaf(-0.12, 0.26, deg(-24), 0.125, G.sproutL); leaf(0.12, 0.26, deg(24), 0.125, G.sprout);
    leaf(-0.11, 0.47, deg(-32), 0.115, G.sprout); leaf(0.11, 0.47, deg(32), 0.115, G.sproutL);
  } else {
    trunkY(b); canopy(b);
    const c = new THREE.Vector3(0, 0.64, 0), surf = CANOPY.map(([x, y, z, r]) => [x, y, z, r, r * 0.95, r]);
    if (stage === 4) {
      spread(16, -0.2, 2).forEach((d) => { const p = onSurface(surf, c, d), q = qTo(d);
        b.addM(G.leafD, ball, M4(p.x, p.y, p.z, 0.042, 0.042, 0.03, q));
        const t = d.clone().multiplyScalar(0.035); b.addM(G.bud, ball, M4(p.x + t.x, p.y + t.y, p.z + t.z, 0.036, 0.036, 0.05, q)); });
    }
    if (stage === 5) {
      spread(34, -0.3, 4).forEach((d, i) => { const p = onSurface(surf, c, d).add(d.clone().multiplyScalar(0.012));
        flower(b, p, d, i % 4 === 0 ? 0.105 : 0.08, [G.petalP, G.petalW, G.petalP, G.petalM][i % 4]); });
    }
  }
  return b.merged();
}

// 우리 반 나무: 0~2단계는 큰 씨앗·새싹·줄기, 3단계부터 얼굴이 있는 굵은 나무. 4단계는 꽃 조금, 5단계는 꽃 가득 + 열매
function buildClassTree(stage, mats, stageGeo) {
  const g = new THREE.Group();
  if (stage <= 2) {
    for (const [color, geo] of stageGeo[stage]) g.add(new THREE.Mesh(geo, mats(color)));
    g.scale.setScalar(2.6); return g;
  }
  const b = new Batch();
  const prof = [[0.56, 0], [0.44, 0.14], [0.33, 0.45], [0.28, 1.0], [0.27, 1.6], [0.32, 2.05]].map(([r, y]) => new THREE.Vector2(r, y));
  b.addM(G.trunk, new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(24), 22), M4(0, 0, 0, 1, 1, 1));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; b.addM(G.trunk, ball, M4(Math.sin(a) * 0.42, 0.07, Math.cos(a) * 0.42, 0.2, 0.11, 0.3, qEuler(0, a, 0))); }
  for (const [s, a] of [[-1, 40], [1, 36]]) b.addM(G.trunk, new THREE.CylinderGeometry(0.11, 0.17, 0.8, 12), M4(s * 0.36, 2.2, 0, 1, 1, 1, qEuler(0, 0, -s * deg(a))));
  const blobs = [[0, 2.75, 0, 0.78, 1], [-0.85, 2.3, 0.1, 0.7, 0], [0.9, 2.3, 0.05, 0.72, 0], [0, 2.2, 0.75, 0.68, 1], [0, 2.25, -0.75, 0.7, 0], [-0.5, 2.95, 0.3, 0.52, 1], [0.55, 2.95, -0.1, 0.55, 0], [-1.25, 1.9, -0.1, 0.5, 1], [1.3, 1.9, 0.15, 0.5, 1], [-0.65, 1.85, 0.7, 0.52, 0], [0.7, 1.85, 0.7, 0.52, 1], [0, 3.3, 0, 0.5, 1], [-0.7, 1.95, -0.65, 0.5, 0], [0.7, 1.95, -0.65, 0.5, 0], [0.1, 1.75, 0.95, 0.4, 0]];
  const grow = stage === 3 ? 0.84 : stage === 4 ? 0.93 : 1;      // 단계가 오를수록 잎 뭉치가 커짐
  const surf = blobs.map(([x, y, z, r]) => [x * 0.92 * grow, (y + 0.75) * (0.9 + 0.1 * grow), z * 0.86 * grow, r * 0.92 * grow, r * 0.88 * grow, r * 0.9 * grow]);
  blobs.forEach(([, , , , light], i) => { const [x, y, z, rx, ry, rz] = surf[i]; b.addM(light ? G.leafL : G.leafD, ball, M4(x, y, z, rx, ry, rz)); });
  const c = new THREE.Vector3(0, 3.0 * (0.9 + 0.1 * grow), 0);
  if (stage >= 4) spread(stage === 5 ? 15 : 7, -0.1, 2.4).forEach((d, i) => flower(b, onSurface(surf, c, d).add(d.clone().multiplyScalar(0.03)), d, stage === 5 ? (i % 3 === 0 ? 0.24 : 0.19) : 0.14, i % 2 ? G.petalP : '#FBC5C9'));
  if (stage === 5) for (const [x, y, z] of [[-1.0, 2.2, 0.5], [1.05, 2.25, 0.45], [0.35, 2.12, 0.95], [-0.45, 2.3, 0.9], [0.75, 2.5, 0.85]]) { b.addM(G.fruit, ball, M4(x, y, z, 0.1, 0.1, 0.1)); b.addM(G.leafD, cyl, M4(x, y + 0.13, z, 0.012, 0.08, 0.012)); }
  for (const [color, geo] of b.merged()) g.add(new THREE.Mesh(geo, mats(color)));
  // 줄기 위 웃는 얼굴
  const fc = document.createElement('canvas'); fc.width = 256; fc.height = 160; const fg = fc.getContext('2d');
  fg.strokeStyle = '#7A4A26'; fg.lineWidth = 9; fg.lineCap = 'round';
  for (const x of [78, 178]) { fg.beginPath(); fg.arc(x, 72, 20, Math.PI * 1.15, Math.PI * 1.85); fg.stroke(); }
  fg.beginPath(); fg.arc(128, 86, 30, Math.PI * 0.2, Math.PI * 0.8); fg.stroke();
  fg.fillStyle = '#F7909C66'; for (const x of [44, 212]) { fg.beginPath(); fg.arc(x, 100, 18, 0, 7); fg.fill(); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.35), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
  face.position.set(0, 1.05, 0.292); face.rotation.x = deg(-14); g.add(face);
  return g;
}

// students: 학생 수(화분 개수를 정함). 나무는 처음엔 비어 있고 setStage / setClassStage 로 채움
export function buildGarden(scene, students = 32) {
  const root = new THREE.Group(); scene.add(root);
  scene.add(new THREE.AmbientLight('#FFF1DC', 0.62));
  scene.add(new THREE.HemisphereLight('#FFF9EA', '#E6DBA0', 1.3));
  const sun = new THREE.DirectionalLight('#FFE2A8', 1.35); sun.position.set(-5, 8, 3); scene.add(sun);
  const bounce = new THREE.DirectionalLight('#FFE9D2', 0.3); bounce.position.set(4, 2, 5); scene.add(bounce);
  const matCache = new Map();
  const mats = (color) => { if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 })); return matCache.get(color); };
  const solid = new Batch();
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#8E7A3E', transparent: true, opacity: 0.2, depthWrite: false });
  const shadowGeos = [];
  const shadow = (x, z, rx, rz = rx) => { const g = new THREE.CircleGeometry(1, 20); g.applyMatrix4(M4(x, 0.03, z, rx, rz, 1, qEuler(-Math.PI / 2, 0, 0))); shadowGeos.push(g); };
  const flatShape = (pts, y, color) => { const sh = new THREE.Shape(new THREE.SplineCurve([...pts, pts[0]].map(([x, z]) => new THREE.Vector2(x, -z))).getPoints(90)); solid.addM(color, new THREE.ShapeGeometry(sh), M4(0, y, 0, 1, 1, 1, qEuler(-Math.PI / 2, 0, 0))); };
  const blob = (cx, cz, rx, rz, wob, ph) => Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; const r = 1 + wob * Math.sin(a * 2 + ph) + wob * 0.6 * Math.sin(a * 3 + ph * 1.7); return [cx + Math.cos(a) * rx * r, cz + Math.sin(a) * rz * r]; });

  // ── 바닥: 숲 바닥(풀) → 모래 오솔길 마당 → 풀밭 섬
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mats(G.forestFloor)); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.02; root.add(lawn);
  // 마당: 연한 풀밭 + 모래 오솔길(가운데 둥근 길, 네 갈래 길, 앞마당)
  flatShape(blob(0, YARD.cz, YARD.rx + 0.1, YARD.rz + 0.1, 0.03, 1), 0.0, '#D3E38E');
  flatShape(blob(CENTER[0], CENTER[1], 2.15, 2.3, 0.03, 3), 0.004, G.path);
  flatShape(blob(0, YARD.cz + YARD.rz - 2.0, 3.8, 2.5, 0.05, 5), 0.004, G.path);
  for (const a of SPOKES) {
    const ux = Math.sin(a), uz = Math.cos(a);
    let len = 2.0; while (((CENTER[0] + ux * len) / (YARD.rx + 0.1)) ** 2 + ((CENTER[1] + uz * len - YARD.cz) / (YARD.rz + 0.1)) ** 2 < 1) len += 0.1;
    const mid = (1.9 + len) / 2, l = len - 1.9;
    solid.addM(G.path, box, M4(CENTER[0] + ux * mid, 0.003, CENTER[1] + uz * mid, SPOKE_HW * 2, 0.006, l, qEuler(0, a, 0)));
  }
  flatShape(blob(WELL[0] - 0.5, WELL[1] + 0.1, 1.6, 1.15, 0.08, 2), 0.012, G.grass);        // 우물 옆 풀밭
  flatShape(blob(DOOR[0] + 1.7, DOOR[1] + 0.6, 0.9, 0.7, 0.08, 4), 0.012, G.grassDk);         // 도서관 문 옆 풀밭

  // ── 화분(돌 테두리 + 흙)과 학생 나무
  const stageGeo = [0, 1, 2, 3, 4, 5].map(buildStage);
  const layout = bedLayout(students), BED = layout.bed;
  const planters = planterLayout(students);
  const ringStone = new THREE.SphereGeometry(1, 10, 8);
  const bedDisc = new THREE.CylinderGeometry(1, 1, 1, 30), bedStone = new RoundedBoxGeometry(1, 1, 1, 1, 0.3);
  // 학생 화단: 동그란 풀밭 + 둥근 돌 테두리(고리마다 색을 조금씩 달리함)
  const BORDERS = [[G.stone, G.stoneDk], ['#E6B06C', '#CF9550'], ['#F3DCC8', '#E8C9B0']];
  const bedAt = (x, z, colors, grass, batch = solid) => {
    batch.addM(grass, bedDisc, M4(x, 0.014, z, BED - 0.03, 0.026, BED - 0.03));
    const nStone = Math.round(BED * 24);
    for (let k = 0; k < nStone; k++) { const a = (k / nStone) * Math.PI * 2; batch.addM(colors[k % 2], bedStone, M4(x + Math.cos(a) * (BED - 0.05), 0.04, z + Math.sin(a) * (BED - 0.05), 0.15 * (BED / 0.6), 0.08, 0.1, qEuler(0, -a + Math.PI / 2, 0))); }
  };
  const treeShadowGeo = new THREE.CircleGeometry(1, 20);
  const trees = [], obstacles = [];   // 걸을 때 부딪히는 것: { kind: 'circle', x, z, r } | { kind: 'rect', x, z, w, d, ry }
  planters.forEach((p, i) => {
    const ring = Math.hypot(p.x - CENTER[0], (p.z - CENTER[1]) / 1.12) < 3.3 ? 0 : Math.hypot(p.x - CENTER[0], (p.z - CENTER[1]) / 1.12) < 4.7 ? 1 : 2;
    bedAt(p.x, p.z, BORDERS[ring], i % 2 ? G.grass : G.grassDk);
    obstacles.push({ kind: 'circle', x: p.x, z: p.z, r: 0.33 });
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; solid.addM(k % 2 ? G.stone : G.stoneDk, ringStone, M4(p.x + Math.cos(a) * 0.25, 0.05, p.z + Math.sin(a) * 0.25, 0.1, 0.06, 0.075, qEuler(0, -a + Math.PI / 2, 0))); }
    solid.addM(G.soil, cyl, M4(p.x, 0.045, p.z, 0.23, 0.05, 0.23));
    solid.addM(G.soilDk, ball, M4(p.x, 0.07, p.z, 0.17, 0.035, 0.17));
    const g = new THREE.Group(); g.position.set(p.x, 0.07, p.z); g.rotation.y = rnd() * 6.28; root.add(g);
    const sh = new THREE.Mesh(treeShadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.set(0.34, 0.26, 1); sh.position.set(p.x + 0.08, 0.035, p.z + 0.12); sh.visible = false; sh.renderOrder = 1; root.add(sh);
    trees.push({ ...p, stage: -1, group: g, shadow: sh });
  });
  // 선생님 화분: 금빛이 도는 돌 테두리. 학생 화분 목록 맨 끝에 붙여 같은 방식으로 나무를 그림(bed 는 숨기기·보이기용)
  {
    const tx = layout.teacher.x, tz = layout.teacher.z, bed = new Batch(), bedGroup = new THREE.Group(); bedGroup.visible = false;
    bedAt(tx, tz, ['#F3D58A', '#EBC26A'], G.grass, bed);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; bed.addM(k % 2 ? '#F3D58A' : G.stone, ringStone, M4(tx + Math.cos(a) * 0.25, 0.05, tz + Math.sin(a) * 0.25, 0.1, 0.06, 0.075, qEuler(0, -a + Math.PI / 2, 0))); }
    bed.addM(G.soil, cyl, M4(tx, 0.045, tz, 0.23, 0.05, 0.23)); bed.addM(G.soilDk, ball, M4(tx, 0.07, tz, 0.17, 0.035, 0.17));
    for (const [color, geo] of bed.merged()) bedGroup.add(new THREE.Mesh(geo, mats(color)));
    root.add(bedGroup);
    const g = new THREE.Group(); g.position.set(tx, 0.07, tz); root.add(g);
    const sh = new THREE.Mesh(treeShadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.set(0.34, 0.26, 1); sh.position.set(tx + 0.08, 0.035, tz + 0.12); sh.visible = false; sh.renderOrder = 1; root.add(sh);
    trees.push({ id: 'teacher', x: tx, z: tz, ux: 0, uz: 1, bedR: BED, stage: -1, group: g, shadow: sh, teacher: true, bed: bedGroup });
  }
  // 화분 하나의 나무 단계를 바꿈(-1 이면 빈 화분). 도형은 단계별로 한 번만 만든 것을 함께 씀
  const setStage = (index, stage) => {
    const t = trees[index]; if (!t || t.stage === stage) return false;
    t.stage = stage; t.group.clear();
    if (stage >= 0) for (const [color, geo] of stageGeo[Math.min(5, stage)]) t.group.add(new THREE.Mesh(geo, mats(color)));
    t.shadow.visible = stage >= 3; return true;
  };

  // ── 가운데: 돌 테두리 둥근 화단 + 우리 반 나무
  const [cx, cz] = CENTER, RING = 1.36;
  obstacles.push({ kind: 'circle', x: cx, z: cz, r: RING + 0.12 });
  solid.addM(G.grass, cyl, M4(cx, 0.03, cz, RING, 0.06, RING));
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; solid.addM(k % 2 ? G.stone : G.stoneDk, new THREE.BoxGeometry(1, 1, 1), M4(cx + Math.cos(a) * RING, 0.09, cz + Math.sin(a) * RING, 0.36, 0.18, 0.2, qEuler(0, -a + Math.PI / 2, 0))); }
  let classTree = null, classStage = -1;
  const setClassStage = (stage) => {
    const st = Math.max(0, Math.min(5, stage)); if (st === classStage) return false;
    if (classTree) { root.remove(classTree); classTree.traverse((o) => { if (o.isMesh && o.material.map) { o.geometry.dispose(); o.material.map.dispose(); o.material.dispose(); } }); }
    classStage = st; classTree = buildClassTree(st, mats, stageGeo); classTree.position.set(cx, 0.05, cz); root.add(classTree); return true;
  };
  shadow(cx + 0.3, cz + 0.4, 1.7, 1.35);
  const bush = (x, z, k = 1) => { for (const [dx, dy, dz, r] of [[0, 0.16, 0, 0.2], [-0.17, 0.12, 0.04, 0.15], [0.17, 0.12, -0.03, 0.15], [0.04, 0.1, 0.15, 0.13]]) solid.addM(rnd() > 0.5 ? G.leafD : G.leafL, ball, M4(x + dx * k, dy * k + 0.04, z + dz * k, r * k, r * k * 0.85, r * k)); };
  const daisy = (x, z, k = 1) => { const b2 = solid; const p = new THREE.Vector3(x, 0.1 * k + 0.03, z); b2.addM(G.leafD, cyl, M4(x, 0.05 * k, z, 0.008, 0.1 * k, 0.008)); flower(b2, p, new THREE.Vector3(0.1, 1, 0.35), 0.06 * k, rnd() > 0.35 ? '#FFFFFF' : G.petalP); };
  for (const a of [0.6, 1.5, 2.5, 3.9, 5.2]) bush(cx + Math.cos(a) * 0.95, cz + Math.sin(a) * 0.95, 0.85);
  for (const a of [0.2, 1.1, 2.0, 3.2, 4.4, 5.7]) daisy(cx + Math.cos(a) * (0.75 + rnd() * 0.4), cz + Math.sin(a) * (0.75 + rnd() * 0.4));

  // ── 우물과 수도꼭지, 디딤돌
  const [wx, wz] = WELL;
  obstacles.push({ kind: 'circle', x: wx, z: wz, r: 0.55 }, { kind: 'circle', x: wx + 0.42, z: wz - 0.3, r: 0.1 },
    { kind: 'circle', x: wx - 1.5, z: wz - 0.55, r: 0.3 }, { kind: 'circle', x: wx + 0.95, z: wz + 0.55, r: 0.3 });
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; for (const [yy, off] of [[0.1, 0], [0.27, 0.22]]) solid.addM((k + (off ? 1 : 0)) % 2 ? G.stone : G.stoneDk, box, M4(wx + Math.cos(a + off) * 0.5, yy, wz + Math.sin(a + off) * 0.5, 0.23, 0.17, 0.13, qEuler(0, -(a + off) + Math.PI / 2, 0))); }
  solid.addM(G.water, cyl, M4(wx, 0.3, wz, 0.45, 0.04, 0.45));
  solid.addM(G.faucet, cyl, M4(wx + 0.42, 0.55, wz - 0.3, 0.04, 1.0, 0.04));
  solid.addM(G.faucet, cyl, M4(wx + 0.27, 1.02, wz - 0.19, 0.04, 0.4, 0.04, qEuler(0, Math.atan2(-0.3, 0.42) + Math.PI, Math.PI / 2)));
  solid.addM(G.faucet, cyl, M4(wx + 0.12, 0.93, wz - 0.085, 0.04, 0.2, 0.04));
  solid.addM(G.faucet, box, M4(wx + 0.42, 1.12, wz - 0.3, 0.22, 0.05, 0.05)); solid.addM(G.faucet, box, M4(wx + 0.42, 1.12, wz - 0.3, 0.05, 0.05, 0.22));
  solid.addM('#BFEAF0', cyl, M4(wx + 0.12, 0.58, wz - 0.085, 0.022, 0.52, 0.022));
  for (const [dx, dz, r] of [[-0.95, 0.15, 0.2], [-1.3, -0.1, 0.17], [-0.85, 0.6, 0.18], [-1.4, 0.45, 0.16], [-0.3, 0.85, 0.19], [-1.75, 0.2, 0.15]]) solid.addM(G.stoneDk, cyl, M4(wx + dx, 0.03, wz + dz, r, 0.03, r * 0.85));
  bush(wx - 1.5, wz - 0.55, 1.2); bush(wx + 0.95, wz + 0.55, 1.2);

  // ── 벤치 2개, 도서관 모퉁이(문·통창·지붕), 디딤돌
  let doorSpot = null, libSpot = null;
  const bench = (x, z, ry, w = 1.2) => { obstacles.push({ kind: 'rect', x, z, w, d: 0.36, ry }); const q = qEuler(0, ry, 0); solid.addM(G.wood, box, M4(x, 0.3, z, w, 0.08, 0.36, q)); for (const s of [-1, 1]) { const o = new THREE.Vector3(s * w * 0.35, 0, 0).applyQuaternion(q); solid.addM(G.woodDk, box, M4(x + o.x, 0.14, z + o.z, 0.1, 0.28, 0.3, q)); } shadow(x, z + 0.08, 0.7, 0.3); };
  // 우리 반 나무 둘레 벤치 4개(대각선, 나무를 바라봄)
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) bench(CENTER[0] + Math.sin(a) * 1.85, CENTER[1] + Math.cos(a) * 1.95, a, 0.75);
  {
    // 정원 쪽 도서관 건물: 크림색 벽 + 삼각 지붕 + 앞면 나무틀 통창(안에 책장·불빛) + 둥근 나무 문 + 책 간판 + 랜턴
    // 건물 기준 좌표: +x 쪽이 앞면(문). 캐릭터 키 1 기준으로 문 높이 약 1.4
    const L = new Batch(), BD = 2.8, BW = 3.4, BH = 1.9, Y0 = 0.16, CREAM = '#F8EAD2', WOOD = '#C98A55', ROOF = '#D9895F', ROOF_DK = '#C47450';
    L.addM('#E3D3BA', box, M4(0, Y0 / 2, 0, BD + 0.18, Y0, BW + 0.18));                       // 돌 기초
    L.addM('#F6CFA2', box, M4(0, Y0 + 0.01, 0, BD - 0.1, 0.02, BW - 0.1));                    // 마루
    L.addM(CREAM, box, M4(-BD / 2 + 0.06, Y0 + BH / 2, 0, 0.12, BH, BW));                     // 뒷벽
    for (const sd of [-1, 1]) L.addM(CREAM, box, M4(0, Y0 + BH / 2, sd * (BW / 2 - 0.06), BD, BH, 0.12));   // 옆벽
    for (const [x, z] of [[BD / 2, BW / 2], [BD / 2, -BW / 2], [-BD / 2, BW / 2], [-BD / 2, -BW / 2]]) L.addM(G.frame, box, M4(x - Math.sign(x) * 0.07, Y0 + BH / 2, z - Math.sign(z) * 0.07, 0.17, BH + 0.02, 0.17));   // 모서리 기둥
    // 앞면: 나무 기둥·가로대 + (유리는 아래에서 따로) + 가운데 문
    const FX = BD / 2 - 0.04;
    for (const z of [-1.05, -0.4, 0.4, 1.05]) L.addM(G.frame, box, M4(FX, Y0 + BH / 2, z, 0.12, BH, 0.1));
    L.addM(G.frame, box, M4(FX, Y0 + BH - 0.05, 0, 0.14, 0.12, BW));                          // 위 가로대
    for (const sd of [-1, 1]) { L.addM(G.frame, box, M4(FX, Y0 + 0.42, sd * 1.06, 0.12, 0.08, 1.3)); L.addM(G.frame, box, M4(FX, Y0 + 1.15, sd * 1.06, 0.06, 0.05, 1.3)); }   // 창틀
    L.addM(WOOD, box, M4(FX + 0.03, Y0 + 0.62, 0, 0.06, 1.24, 0.66));                          // 문
    L.addM(WOOD, cyl, M4(FX + 0.03, Y0 + 1.24, 0, 0.33, 0.06, 0.33, qEuler(0, 0, Math.PI / 2))); // 문 위 둥근 부분
    for (const z of [-0.16, 0, 0.16]) L.addM('#B87A47', box, M4(FX + 0.065, Y0 + 0.7, z, 0.01, 1.1, 0.02));   // 문 판자 줄
    L.addM('#F2C24A', ball, M4(FX + 0.08, Y0 + 0.65, 0.2, 0.035, 0.035, 0.035));              // 손잡이
    L.addM(G.stoneDk, box, M4(FX + 0.32, 0.05, 0, 0.42, 0.1, 0.9));                            // 문 앞 디딤판
    // 문 위 간판: 나무판 + 펼친 책 그림(글자 없음)
    L.addM('#E6B06C', box, M4(FX + 0.09, Y0 + 1.7, 0, 0.05, 0.28, 0.66)); L.addM('#CF9550', box, M4(FX + 0.07, Y0 + 1.7, 0, 0.05, 0.32, 0.72));
    for (const sd of [-1, 1]) { L.addM('#FFF4E0', box, M4(FX + 0.12, Y0 + 1.7, sd * 0.09, 0.02, 0.14, 0.17, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sd * -0.25))); L.addM('#57A365', box, M4(FX + 0.11, Y0 + 1.7, sd * 0.09, 0.015, 0.16, 0.19, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sd * -0.25))); }
    // 옆벽 둥근 창(나무 테두리 + 따뜻한 유리는 아래에서)
    for (const sd of [-1, 1]) L.addM(G.frame, new THREE.TorusGeometry(0.32, 0.05, 8, 24), M4(0, Y0 + 1.15, sd * (BW / 2 + 0.005), 1, 1, 1));
    // 삼각 지붕(용마루는 앞뒤 방향) + 처마 + 박공벽 + 굴뚝
    const pitch = deg(34), half = BW / 2 + 0.32, slope = half / Math.cos(pitch), rise = half * Math.tan(pitch), ry0 = Y0 + BH;
    for (const sd of [-1, 1]) L.addM(ROOF, box, M4(0, ry0 + rise / 2, sd * half / 2, BD + 0.55, 0.12, slope, qEuler(sd * pitch, 0, 0)));
    L.addM(ROOF_DK, cyl, M4(0, ry0 + rise + 0.03, 0, 0.09, BD + 0.62, 0.09, qEuler(0, 0, Math.PI / 2)));
    { const tri = new THREE.Shape([new THREE.Vector2(-BW / 2, 0), new THREE.Vector2(BW / 2, 0), new THREE.Vector2(0, (BW / 2) * Math.tan(pitch))]);
      const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
      for (const x of [BD / 2 - 0.06, -BD / 2 + 0.06]) L.addM(CREAM, gable, M4(x - 0.06, ry0, 0, 1, 1, 1, qEuler(0, Math.PI / 2, 0))); }
    L.addM(G.frame, new THREE.TorusGeometry(0.2, 0.04, 8, 20), M4(BD / 2 + 0.01, ry0 + 0.45, 0, 1, 1, 1, qEuler(0, Math.PI / 2, 0)));   // 박공 둥근 창
    L.addM('#C98A6A', box, M4(-0.6, ry0 + rise * 0.75, -0.75, 0.3, 0.75, 0.3)); L.addM('#B87458', box, M4(-0.6, ry0 + rise * 0.75 + 0.4, -0.75, 0.36, 0.08, 0.36));
    // 안: 뒷벽 책장 + 소파 + 탁자
    L.addM(G.wood, box, M4(-BD / 2 + 0.3, Y0 + 0.65, 0, 0.36, 1.25, 2.4));
    const BOOKC = ['#F2A08E', '#9DC9E8', '#F6D27A', '#A8D29A', '#D9A6E0'];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 14; k++) L.addM(BOOKC[(k + r * 2) % 5], box, M4(-BD / 2 + 0.5, Y0 + 0.28 + r * 0.38, -1.05 + k * 0.16, 0.05, 0.26 + ((k * 7 + r) % 3) * 0.03, 0.12));
    L.addM('#B4BE88', ball, M4(0.3, Y0 + 0.28, -0.85, 0.32, 0.22, 0.28)); L.addM('#F3E4CB', ball, M4(0.3, Y0 + 0.28, 0.85, 0.32, 0.22, 0.28));
    L.addM(G.wood, cyl, M4(0.1, Y0 + 0.36, 0, 0.3, 0.06, 0.3));
    const lg = new THREE.Group(); for (const [color, geo] of L.merged()) lg.add(new THREE.Mesh(geo, mats(color)));
    // 따뜻한 유리(앞면 통창 4칸 + 옆 둥근 창 + 박공 창)와 안쪽 불빛
    const warmGlass = new THREE.MeshStandardMaterial({ color: '#FFF1CC', emissive: '#FFD58A', emissiveIntensity: 0.35, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide, roughness: 0.2 });
    for (const [z0, z1] of [[-1.62, -1.1], [-1.0, -0.45], [0.45, 1.0], [1.1, 1.62]]) for (const [y0, y1] of [[Y0 + 0.46, Y0 + 1.12], [Y0 + 1.18, Y0 + BH - 0.11]]) {
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, y1 - y0), warmGlass); gm.position.set(FX, (y0 + y1) / 2, (z0 + z1) / 2); gm.rotation.y = Math.PI / 2; lg.add(gm); }
    for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), warmGlass); c.position.set(0, Y0 + 1.15, sd * (BW / 2 + 0.01)); lg.add(c); }
    { const c = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), warmGlass); c.position.set(BD / 2 + 0.015, ry0 + 0.45, 0); c.rotation.y = Math.PI / 2; lg.add(c); }
    const glowMatB = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
    for (const z of [-0.8, 0.8]) { const glow = new THREE.Sprite(glowMatB); glow.scale.set(1.3, 1.3, 1); glow.position.set(0.5, Y0 + 1.3, z); lg.add(glow); }
    // 문 옆 랜턴
    { const lb = new Batch(); lb.addM(G.frame, cyl, M4(BD / 2 + 0.32, 0.45, 0.62, 0.025, 0.9, 0.025)); lb.addM('#B97A56', box, M4(BD / 2 + 0.32, 0.95, 0.62, 0.14, 0.03, 0.14)); lb.addM('#B97A56', cone(0.02, 0.1, 4), M4(BD / 2 + 0.32, 1.12, 0.62, 1, 0.06, 1, qEuler(0, Math.PI / 4, 0)));
      for (const [color, geo] of lb.merged()) lg.add(new THREE.Mesh(geo, mats(color)));
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: '#FFF3B0' })); bulb.position.set(BD / 2 + 0.32, 1.03, 0.62); lg.add(bulb);
      const lglow = new THREE.Sprite(glowMatB); lglow.scale.set(0.6, 0.6, 1); lglow.position.copy(bulb.position); lg.add(lglow); }
    const ang = deg(-38), [dx0, dz0] = DOOR;
    // 문(건물 기준 +x 앞면)이 DOOR 자리에 오도록 건물 위치를 잡음
    const off = new THREE.Vector3(BD / 2 + 0.1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    lg.rotation.y = ang; lg.position.set(dx0 - off.x, 0, dz0 - off.z); root.add(lg);
    libSpot = { x: dx0 - off.x, z: dz0 - off.z };
    obstacles.push({ kind: 'rect', x: dx0 - off.x, z: dz0 - off.z, w: BD + 0.3, d: BW + 0.3, ry: ang, tall: true }, { kind: 'circle', x: dx0 + 0.3, z: dz0 + 1.25, r: 0.25 });
    // 정원에 들어올 때 서는 곳(문 바로 앞)과 문으로 나가는 방향
    const out = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    doorSpot = { x: dx0 + out.x * 0.9, z: dz0 + out.z * 0.9, door: { x: dx0 + out.x * 0.15, z: dz0 + out.z * 0.15 } };
    for (const [ax, az, r] of [[0.25, 0.1, 0.27], [0.75, 0.3, 0.23], [0.45, 0.6, 0.21], [1.05, -0.05, 0.19], [0.95, 0.7, 0.18]]) solid.addM(G.stone, cyl, M4(dx0 + ax, 0.03, dz0 + az, r, 0.03, r * 0.85));
    bush(dx0 + 0.3, dz0 + 1.25, 1.0); daisy(dx0 + 0.9, dz0 + 1.3, 1.2); daisy(dx0 + 0.6, dz0 + 1.7, 1.1);
  }

  // ── 숲: 마당 둘레의 큰 나무와 덤불, 들꽃
  const front = new THREE.Group(); front.visible = false; root.add(front);
  const frontB = new Batch(); let fseed = 101; const frnd = () => (fseed = (fseed * 16807) % 2147483647) / 2147483647;   // 앞쪽 숲은 따로 뽑아 기존 배치가 바뀌지 않게
  const bigTree = (x, z, k, b = solid) => {
    if (libSpot && Math.hypot(x - libSpot.x, z - libSpot.z) < 2.6 + k * 0.6) return;   // 도서관 건물과 겹치지 않게
    if (b !== solid) { b.addM(G.trunk, new THREE.CylinderGeometry(0.16, 0.26, 1.5, 8), M4(x, 0.75 * k, z, k, k, k)); for (const [bx, by, bz, r, light] of [[0, 2.15, 0, 0.9, 1], [-0.7, 1.8, 0.1, 0.65, 0], [0.7, 1.8, -0.1, 0.68, 0], [0, 1.75, 0.6, 0.62, 1]]) b.addM(light ? '#9FCF52' : '#86BD48', ballFar, M4(x + bx * k, by * k, z + bz * k, r * k, r * k * 0.9, r * k)); return; }
    solid.addM(G.trunk, new THREE.CylinderGeometry(0.16, 0.26, 1.5, 12), M4(x, 0.75 * k, z, k, k, k));
    for (const [bx, by, bz, r, light] of [[0, 2.15, 0, 0.9, 1], [-0.7, 1.8, 0.1, 0.65, 0], [0.7, 1.8, -0.1, 0.68, 0], [0, 1.75, 0.6, 0.62, 1], [0.1, 1.8, -0.6, 0.6, 0], [-0.35, 2.5, 0.2, 0.5, 1]]) solid.addM(light ? '#9FCF52' : '#86BD48', ball, M4(x + bx * k, by * k, z + bz * k, r * k, r * k * 0.9, r * k));
    shadow(x + 0.2, z + 0.25, 1.1 * k, 0.9 * k);
  };
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const ex = Math.cos(a) * (YARD.rx + 0.1), ez = YARD.cz + Math.sin(a) * (YARD.rz + 0.1);
    if (ex < DOOR[0] + 1.1 && ez > DOOR[1] - 2.3) continue;     // 도서관 자리
    if (ez < YARD.cz + YARD.rz * 0.6) for (const [d, kMin, kMax] of [[1.5, 0.6, 0.85], [3.2, 0.8, 1.1], [5.0, 0.95, 1.3]]) bigTree(ex + Math.cos(a) * (d + rnd() * 0.6), ez + Math.sin(a) * (d + rnd() * 0.6), kMin + rnd() * (kMax - kMin));
    else for (const [d, kMin, kMax] of [[1.5, 0.6, 0.85], [3.2, 0.8, 1.1], [5.0, 0.95, 1.3]]) bigTree(ex + Math.cos(a) * (d + frnd() * 0.6), ez + Math.sin(a) * (d + frnd() * 0.6), kMin + frnd() * (kMax - kMin), frontB);
    bush(ex + Math.cos(a) * 0.25, ez + Math.sin(a) * 0.25, 1.1 + rnd() * 0.5);
    if (rnd() > 0.35) daisy(ex - Math.cos(a) * (0.25 + rnd() * 0.3), ez - Math.sin(a) * (0.25 + rnd() * 0.3), 1.3);
  }
  // 화단 사이 길가 들꽃(화단 안은 소품 자리라 비움)
  for (let k = 0; k < 40; k++) {
    const a = rnd() * 6.28, rr = 0.3 + rnd() * 0.65, x = Math.sin(a) * YARD.rx * rr, z = YARD.cz + Math.cos(a) * YARD.rz * rr;
    if (z > FRONT_Z + 0.3 || nearSpoke(x, z, 0.1) || Math.hypot(x - CENTER[0], z - CENTER[1]) < 2.3 || planters.some((p) => Math.hypot(p.x - x, p.z - z) < BED + 0.06) || Math.hypot(layout.teacher.x - x, layout.teacher.z - z) < BED + 0.06) continue;
    daisy(x, z, 0.9);
  }

  // 앞쪽(화면 아래쪽) 숲: 위에서 볼 때는 마당을 가리므로, 캐릭터 시점에서만 보임
  for (let x = -16; x <= 16; x += 2.2) for (const dz of [YARD.cz + YARD.rz + 5, YARD.cz + YARD.rz + 7.5]) frontB.addM(frnd() > 0.5 ? '#9FCF52' : '#86BD48', ballFar, M4(x + frnd(), 1.6, dz + frnd() * 2, 1.4, 1.5, 1.3));
  for (const [color, geo] of frontB.merged()) front.add(new THREE.Mesh(geo, mats(color)));
  solid.build(root);
  { const m = new THREE.Mesh(new THREE.BufferGeometry(), shadowMat); const pos = []; for (const g of shadowGeos) { const gi = g.toNonIndexed(); pos.push(...gi.attributes.position.array); } m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.renderOrder = 1; root.add(m); }

  // ── 나뭇잎 사이로 떨어지는 햇살 얼룩
  const dapple = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 30; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.7, 20), dapple); m.rotation.x = -Math.PI / 2; m.scale.y = 0.6 + rnd() * 0.5; m.rotation.z = rnd() * 3; m.position.set((rnd() - 0.5) * YARD.rx * 1.8, 0.04, YARD.cz + (rnd() - 0.5) * YARD.rz * 1.8); m.renderOrder = 2; root.add(m); }

  // ── 먼 숲 풍경판(카메라를 향해 기울여 세움)
  const BD_W = 58, BD_H = 2.6 / LAND_FRAC, zB = YARD.cz - YARD.rz - 6.5;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H), new THREE.MeshBasicMaterial({ map: landscapeTexture(BD_W / BD_H), fog: false })); root.add(backdrop);
  const faceBackdrop = (p) => { backdrop.rotation.set(-p, 0, 0); backdrop.position.set(0, Math.cos(p) * BD_H / 2 - 0.15, zB - Math.sin(p) * BD_H / 2); };
  faceBackdrop(deg(48));
  // 걸을 수 있는 마당: 모래 오솔길 타원 + 도서관 문 앞
  const inside = (x, z) => (x / (YARD.rx - 0.1)) ** 2 + ((z - YARD.cz) / (YARD.rz - 0.1)) ** 2 <= 1 || Math.hypot(x - doorSpot.x, z - doorSpot.z) < 1.0;
  // 카메라가 못 들어가는 곳: 마당 둘레의 큰 나무 숲, 도서관 건물
  const tallRects = obstacles.filter((o) => o.tall);
  const cameraSolid = (x, z) => (x / (YARD.rx + 1.1)) ** 2 + ((z - YARD.cz) / (YARD.rz + 0.9)) ** 2 > 1 || tallRects.some((o) => { const dx = x - o.x, dz = z - o.z, c = Math.cos(o.ry), s = Math.sin(o.ry); return Math.abs(dx * c - dz * s) < o.w / 2 + 0.3 && Math.abs(dx * s + dz * c) < o.d / 2 + 0.3; });
  return { root, trees, planters, obstacles, inside, cameraSolid, doorSpot, front, setStage, setClassStage, faceBackdrop, dispose() { root.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose?.(); } }); for (const m of matCache.values()) m.dispose(); } };
}
