// 새싹책방 2.0 정원 시제품 — ChatGPT 정원 콘셉트와 나무 6단계 그림을 보고 도형으로 조립
// 가운데 우리 반 나무 + 화단 8곳 × 4그루 = 학생 나무 32그루. 좌표: x 오른쪽 +, z 화면 앞쪽 +
import * as THREE from 'three';
import { Batch, landscapeTexture, LAND_FRAC, glowTexture } from '../3d-library/library.js';

const deg = THREE.MathUtils.degToRad;
export const G = {
  path: '#F7DCAE', pathEdge: '#EFCF9C', grass: '#C3D96C', grassDk: '#B2CC5E', forestFloor: '#A9D07A',
  stone: '#F1E2C5', stoneDk: '#E4D2B0', soil: '#B9814F', soilDk: '#A56F40', seed: '#C37639',
  sprout: '#9CCB33', sproutL: '#B5DC45', leafD: '#86BE3C', leafL: '#B9DE4A', trunk: '#D38F4A', trunkDk: '#BC7A3C',
  bud: '#F58E97', petalP: '#F7909C', petalW: '#FFF0E4', petalM: '#F4A6CF', center: '#FFD85A', fruit: '#FFD23F',
  wood: '#E6B06C', woodDk: '#CF9550', water: '#9FDCE2', faucet: '#D99A3C', wall: '#F8EAD2', roof: '#EDB98F', frame: '#DFA466',
};
export const STAGE_NAMES = ['씨앗', '새싹', '줄기', '잎', '꽃봉오리', '활짝 핀 꽃'];

// 화단 8곳의 가운데와 그 안의 화분 4개 (콘셉트 그림 배치를 옮김)
const ISLANDS = [[-1.6, -4.85], [1.65, -4.85], [-2.55, -2.55], [2.55, -2.55], [-2.5, 0.45], [2.5, 0.45], [-1.4, 2.95], [1.5, 2.95]];
export const CENTER = [0, -0.45];
export const WELL = [2.45, 5.55];
export const DOOR = [-2.75, 6.05];
export function planterLayout() {
  const out = []; let n = 1;
  for (const [ix, iz] of ISLANDS) for (const [dx, dz] of [[-0.42, -0.4], [0.42, -0.4], [-0.42, 0.42], [0.42, 0.42]]) out.push({ id: n++, x: ix + dx, z: iz + dz });
  return out;
}

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

// 우리 반 나무: 얼굴이 있는 굵은 줄기 + 큰 잎 뭉치 + 꽃 + 열매
function buildClassTree(root, mats) {
  const b = new Batch();
  const prof = [[0.56, 0], [0.44, 0.14], [0.33, 0.45], [0.28, 1.0], [0.27, 1.6], [0.32, 2.05]].map(([r, y]) => new THREE.Vector2(r, y));
  b.addM(G.trunk, new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(24), 22), M4(0, 0, 0, 1, 1, 1));
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; b.addM(G.trunk, ball, M4(Math.sin(a) * 0.42, 0.07, Math.cos(a) * 0.42, 0.2, 0.11, 0.3, qEuler(0, a, 0))); }
  for (const [s, a] of [[-1, 40], [1, 36]]) b.addM(G.trunk, new THREE.CylinderGeometry(0.11, 0.17, 0.8, 12), M4(s * 0.36, 2.2, 0, 1, 1, 1, qEuler(0, 0, -s * deg(a))));
  const blobs = [[0, 2.75, 0, 0.78, 1], [-0.85, 2.3, 0.1, 0.7, 0], [0.9, 2.3, 0.05, 0.72, 0], [0, 2.2, 0.75, 0.68, 1], [0, 2.25, -0.75, 0.7, 0], [-0.5, 2.95, 0.3, 0.52, 1], [0.55, 2.95, -0.1, 0.55, 0], [-1.25, 1.9, -0.1, 0.5, 1], [1.3, 1.9, 0.15, 0.5, 1], [-0.65, 1.85, 0.7, 0.52, 0], [0.7, 1.85, 0.7, 0.52, 1], [0, 3.3, 0, 0.5, 1], [-0.7, 1.95, -0.65, 0.5, 0], [0.7, 1.95, -0.65, 0.5, 0], [0.1, 1.75, 0.95, 0.4, 0]];
  const surf = blobs.map(([x, y, z, r]) => [x * 0.92, y + 0.75, z * 0.86, r * 0.92, r * 0.88, r * 0.9]);
  blobs.forEach(([, , , , light], i) => { const [x, y, z, rx, ry, rz] = surf[i]; b.addM(light ? G.leafL : G.leafD, ball, M4(x, y, z, rx, ry, rz)); });
  const c = new THREE.Vector3(0, 3.0, 0);
  spread(15, -0.1, 2.4).forEach((d, i) => flower(b, onSurface(surf, c, d).add(d.clone().multiplyScalar(0.03)), d, i % 3 === 0 ? 0.24 : 0.19, i % 2 ? G.petalP : '#FBC5C9'));
  for (const [x, y, z] of [[-1.0, 2.2, 0.5], [1.05, 2.25, 0.45], [0.35, 2.12, 0.95], [-0.45, 2.3, 0.9], [0.75, 2.5, 0.85]]) { b.addM(G.fruit, ball, M4(x, y, z, 0.1, 0.1, 0.1)); b.addM(G.leafD, cyl, M4(x, y + 0.13, z, 0.012, 0.08, 0.012)); }
  const g = new THREE.Group();
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
  root.add(g); return g;
}

export function buildGarden(scene, stageOf = (id) => (id * 7) % 6) {
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
  flatShape(blob(0, 0.4, 4.3, 7.3, 0.035, 1), 0.0, G.path);
  ISLANDS.forEach(([x, z], i) => { flatShape(blob(x, z, 1.1, 1.1, 0.07, i * 1.3), 0.012, i % 2 ? G.grass : G.grassDk); });
  flatShape(blob(WELL[0] - 0.5, WELL[1] + 0.1, 1.6, 1.15, 0.08, 2), 0.012, G.grass);        // 우물 옆 풀밭
  flatShape(blob(-1.0, 6.7, 0.9, 0.7, 0.08, 4), 0.012, G.grassDk);                           // 도서관 문 옆 풀밭

  // ── 화분(돌 테두리 + 흙)과 학생 나무
  const stageGeo = [0, 1, 2, 3, 4, 5].map(buildStage);
  const planters = planterLayout();
  const ringStone = new THREE.SphereGeometry(1, 10, 8);
  const trees = [];
  for (const p of planters) {
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; solid.addM(k % 2 ? G.stone : G.stoneDk, ringStone, M4(p.x + Math.cos(a) * 0.3, 0.05, p.z + Math.sin(a) * 0.3, 0.115, 0.065, 0.085, qEuler(0, -a + Math.PI / 2, 0))); }
    solid.addM(G.soil, cyl, M4(p.x, 0.045, p.z, 0.27, 0.05, 0.27));
    solid.addM(G.soilDk, ball, M4(p.x, 0.07, p.z, 0.2, 0.035, 0.2));
    const st = stageOf(p.id), g = new THREE.Group();
    for (const [color, geo] of stageGeo[st]) g.add(new THREE.Mesh(geo, mats(color)));
    g.position.set(p.x, 0.07, p.z); g.rotation.y = rnd() * 6.28; root.add(g); trees.push({ ...p, stage: st, group: g });
    if (st >= 3) shadow(p.x + 0.08, p.z + 0.12, 0.34, 0.26);
  }

  // ── 가운데: 돌 테두리 둥근 화단 + 우리 반 나무
  const [cx, cz] = CENTER, RING = 1.36;
  solid.addM(G.grass, cyl, M4(cx, 0.03, cz, RING, 0.06, RING));
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; solid.addM(k % 2 ? G.stone : G.stoneDk, new THREE.BoxGeometry(1, 1, 1), M4(cx + Math.cos(a) * RING, 0.09, cz + Math.sin(a) * RING, 0.36, 0.18, 0.2, qEuler(0, -a + Math.PI / 2, 0))); }
  const classTree = buildClassTree(root, mats); classTree.position.set(cx, 0.05, cz);
  shadow(cx + 0.3, cz + 0.4, 1.7, 1.35);
  const bush = (x, z, k = 1) => { for (const [dx, dy, dz, r] of [[0, 0.16, 0, 0.2], [-0.17, 0.12, 0.04, 0.15], [0.17, 0.12, -0.03, 0.15], [0.04, 0.1, 0.15, 0.13]]) solid.addM(rnd() > 0.5 ? G.leafD : G.leafL, ball, M4(x + dx * k, dy * k + 0.04, z + dz * k, r * k, r * k * 0.85, r * k)); };
  const daisy = (x, z, k = 1) => { const b2 = solid; const p = new THREE.Vector3(x, 0.1 * k + 0.03, z); b2.addM(G.leafD, cyl, M4(x, 0.05 * k, z, 0.008, 0.1 * k, 0.008)); flower(b2, p, new THREE.Vector3(0.1, 1, 0.35), 0.06 * k, rnd() > 0.35 ? '#FFFFFF' : G.petalP); };
  for (const a of [0.6, 1.5, 2.5, 3.9, 5.2]) bush(cx + Math.cos(a) * 0.95, cz + Math.sin(a) * 0.95, 0.85);
  for (const a of [0.2, 1.1, 2.0, 3.2, 4.4, 5.7]) daisy(cx + Math.cos(a) * (0.75 + rnd() * 0.4), cz + Math.sin(a) * (0.75 + rnd() * 0.4));

  // ── 우물과 수도꼭지, 디딤돌
  const [wx, wz] = WELL;
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
  const bench = (x, z, ry) => { const q = qEuler(0, ry, 0); solid.addM(G.wood, box, M4(x, 0.3, z, 1.2, 0.08, 0.36, q)); for (const s of [-1, 1]) { const o = new THREE.Vector3(s * 0.42, 0, 0).applyQuaternion(q); solid.addM(G.woodDk, box, M4(x + o.x, 0.14, z + o.z, 0.1, 0.28, 0.3, q)); } shadow(x, z + 0.08, 0.7, 0.3); };
  bench(-2.4, -6.55, deg(8)); bench(3.0, -6.2, deg(-12));
  {
    const L = new Batch(), H = 1.7;                      // 건물 중심 기준 좌표. +x 벽에 문과 통창
    L.addM(G.wall, box, M4(0, 0.12, 0, 3.4, 0.24, 3.4));
    L.addM('#F6CFA2', box, M4(0, 0.25, 0, 3.2, 0.02, 3.2));
    for (const [x, z] of [[H, -H], [H, H], [-H, H], [-H, -H]]) L.addM(G.wall, box, M4(x, 1.35, z, 0.22, 2.3, 0.22));
    for (const yy of [0.3, 2.45]) { L.addM(G.frame, box, M4(H, yy, 0, 0.1, 0.1, 3.4)); L.addM(G.frame, box, M4(0, yy, H, 3.4, 0.1, 0.1)); }
    for (const zz of [-0.55, 0.55]) L.addM(G.frame, box, M4(H, 1.35, zz, 0.1, 2.2, 0.1));
    L.addM(G.frame, box, M4(H, 2.0, 1.1, 0.07, 0.07, 1.1)); L.addM(G.frame, box, M4(H, 2.0, -1.1, 0.07, 0.07, 1.1));
    L.addM(G.frame, box, M4(H + 0.4, 1.25, -0.55 + 0.32, 0.07, 2.05, 1.05, qEuler(0, deg(-52), 0)));     // 열린 문
    L.addM(G.wall, box, M4(-0.05, 2.56, 0.05, 3.75, 0.1, 3.75)); L.addM(G.roof, box, M4(-0.1, 2.68, 0.1, 3.95, 0.16, 3.95));
    for (const [sx, sz, c] of [[0.6, -0.9, '#B4BE88'], [0.5, 0.7, '#F3E4CB']]) L.addM(c, ball, M4(sx, 0.5, sz, 0.28, 0.24, 0.26));  // 안쪽 소파
    L.addM(G.wood, box, M4(-0.9, 0.75, -1.3, 1.4, 1.0, 0.3));                                             // 안쪽 책장
    const lg = new THREE.Group(); for (const [color, geo] of L.merged()) lg.add(new THREE.Mesh(geo, mats(color)));
    const glass = new THREE.MeshBasicMaterial({ color: '#FFF6E0', transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    for (const [px, pz, ry] of [[H, 0, Math.PI / 2], [0, H, 0]]) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.15), glass); gm.position.set(px, 1.38, pz); gm.rotation.y = ry; lg.add(gm); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); glow.scale.set(1.4, 1.4, 1); glow.position.set(0.9, 1.3, 0.2); lg.add(glow);
    const ang = deg(-38), [dx0, dz0] = DOOR;
    // 문(건물 기준 (H, -0.02))이 DOOR 자리에 오도록 건물 위치를 잡음
    const LS = 0.72, off = new THREE.Vector3((H + 0.25) * LS, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    lg.scale.setScalar(LS); lg.rotation.y = ang; lg.position.set(dx0 - off.x, 0, dz0 - off.z); root.add(lg);
    for (const [ax, az, r] of [[0.25, 0.1, 0.27], [0.75, 0.3, 0.23], [0.45, 0.6, 0.21], [1.05, -0.05, 0.19], [0.95, 0.7, 0.18]]) solid.addM(G.stone, cyl, M4(dx0 + ax, 0.03, dz0 + az, r, 0.03, r * 0.85));
    bush(dx0 + 0.3, dz0 + 1.25, 1.0); daisy(dx0 + 0.9, dz0 + 1.3, 1.2); daisy(dx0 + 0.6, dz0 + 1.7, 1.1);
  }

  // ── 숲: 마당 둘레의 큰 나무와 덤불, 들꽃
  const bigTree = (x, z, k) => {
    solid.addM(G.trunk, new THREE.CylinderGeometry(0.16, 0.26, 1.5, 12), M4(x, 0.75 * k, z, k, k, k));
    for (const [bx, by, bz, r, light] of [[0, 2.15, 0, 0.9, 1], [-0.7, 1.8, 0.1, 0.65, 0], [0.7, 1.8, -0.1, 0.68, 0], [0, 1.75, 0.6, 0.62, 1], [0.1, 1.8, -0.6, 0.6, 0], [-0.35, 2.5, 0.2, 0.5, 1]]) solid.addM(light ? '#9FCF52' : '#86BD48', ball, M4(x + bx * k, by * k, z + bz * k, r * k, r * k * 0.9, r * k));
    shadow(x + 0.2, z + 0.25, 1.1 * k, 0.9 * k);
  };
  for (let a = 0; a < Math.PI * 2; a += 0.3) {
    const ex = Math.cos(a) * 4.3, ez = 0.4 + Math.sin(a) * 7.3;
    if (ex < -2.4 && ez > 4.4) continue;                         // 도서관 자리
    if (ez < 4.6) for (const [d, kMin, kMax] of [[1.5, 0.6, 0.85], [3.2, 0.8, 1.1], [5.0, 0.95, 1.3]]) bigTree(ex + Math.cos(a) * (d + rnd() * 0.6), ez + Math.sin(a) * (d + rnd() * 0.6), kMin + rnd() * (kMax - kMin));
    bush(ex + Math.cos(a) * 0.25, ez + Math.sin(a) * 0.25, 1.1 + rnd() * 0.5);
    if (rnd() > 0.35) daisy(ex - Math.cos(a) * (0.25 + rnd() * 0.3), ez - Math.sin(a) * (0.25 + rnd() * 0.3), 1.3);
  }
  ISLANDS.forEach(([x, z]) => { for (let k = 0; k < 3; k++) { const a = rnd() * 6.28; daisy(x + Math.cos(a) * 0.95, z + Math.sin(a) * 0.9, 0.9); } });

  solid.build(root);
  { const m = new THREE.Mesh(new THREE.BufferGeometry(), shadowMat); const pos = []; for (const g of shadowGeos) { const gi = g.toNonIndexed(); pos.push(...gi.attributes.position.array); } m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.renderOrder = 1; root.add(m); }

  // ── 나뭇잎 사이로 떨어지는 햇살 얼룩
  const dapple = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.7, 20), dapple); m.rotation.x = -Math.PI / 2; m.scale.y = 0.6 + rnd() * 0.5; m.rotation.z = rnd() * 3; m.position.set((rnd() - 0.5) * 7.6, 0.04, 0.4 + (rnd() - 0.5) * 13.5); m.renderOrder = 2; root.add(m); }

  // ── 먼 숲 풍경판(카메라를 향해 기울여 세움)
  const BD_W = 44, BD_H = 2.6 / LAND_FRAC, zB = -10.5;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(BD_W, BD_H), new THREE.MeshBasicMaterial({ map: landscapeTexture(BD_W / BD_H), fog: false })); root.add(backdrop);
  const faceBackdrop = (p) => { backdrop.rotation.set(-p, 0, 0); backdrop.position.set(0, Math.cos(p) * BD_H / 2 - 0.15, zB - Math.sin(p) * BD_H / 2); };
  faceBackdrop(deg(48));
  return { root, trees, planters, classTree, faceBackdrop, stageGeo, mats };
}

// 나무 6단계를 나란히 세운 견본(비교용)
export function buildStageRow(scene) {
  scene.add(new THREE.AmbientLight('#FFF4E4', 0.75)); scene.add(new THREE.HemisphereLight('#ffffff', '#EFE2B8', 1.4));
  const sun = new THREE.DirectionalLight('#FFF0D8', 1.0); sun.position.set(-3, 5, 5); scene.add(sun);
  const mats = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
  [0, 1, 2, 3, 4, 5].forEach((st, i) => {
    const g = new THREE.Group();
    for (const [color, geo] of buildStage(st)) g.add(new THREE.Mesh(geo, mats(color)));
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mats(G.soil)); mound.scale.set(0.22, 0.03, 0.22); g.add(mound);
    g.position.x = (i - 2.5) * 0.95; scene.add(g);
  });
}
