// 새싹책방 2.0 도서관 — ChatGPT 세로형 평면도(가로 24칸 × 세로 72칸)와 색상표를 그대로 옮김
// 좌표: x 오른쪽 +, z 화면 앞쪽(입구 쪽) +. 뒤쪽 벽이 z 음수 방향.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CELL = 0.3;                 // 평면도 1칸 = 0.3 (캐릭터 키 = 1)
export const GRID = { w: 24, d: 72 };
export const PALETTE = {
  floor: '#F7D3AC', floorLine: '#EBC193', sofaSage: '#B4BE88', sofaSageDk: '#9EAA74', sofaCream: '#F3E4CB', sofaCreamDk: '#E3CFAE',
  rugCream: '#F2E5CB', rugRim: '#E8D6B4', lamp: '#FFF4D6', curtain: '#FBEBD3', wall: '#F7DFC0', frame: '#DFA466', shelf: '#E3A762',
  books: ['#A9BC78', '#E7C96F', '#8FAEB5', '#DFA7A0', '#EAD9B5'],
  desk: '#F0BE80', chair: '#ACC76C', rug: '#DDD8A5', shadow: '#B39473',
  leaf: '#8FBF5A', leafDark: '#6FA64C', pot: '#F3E6CC', grass: '#A6D27C', grassDark: '#A8D282', sky: '#CDEBFA', path: '#F3E3C2', trunk: '#C79562',
};
export const gx = (c) => (c - GRID.w / 2) * CELL, gz = (c) => (c - GRID.d / 2) * CELL;
const deg = THREE.MathUtils.degToRad;

// 세로형 평면도에서 읽은 좌석 배치 (칸 단위). 사방에서 마주 앉는 4인 모둠 6곳 + 창가 8석 = 32석
// 모둠 가운데에서 책상은 2.5칸, 의자는 4칸 떨어져 있고, 모두 가운데를 보고 앉음
const CLUSTER_CENTERS = [[5, 14], [19, 14], [5, 34], [19, 34], [5, 54], [19, 54]];
const WINDOW_ROWS = [2.5, 23.5, 43.5, 64.5];
export const SHELVES = CLUSTER_CENTERS.map(([cx, cy]) => [cx - 3, cx + 3, cy - 6.5]);   // 모둠 뒤 낮은 책장 [x0, x1, y]
export const RUGS = CLUSTER_CENTERS.map(([cx, cy]) => [cx, cy, 4.7]);                    // 둥근 카펫 [x, y, 반지름]

export function seatLayout() {
  const seats = [];
  let n = 1;
  // 평면도 번호 순서: 위 → 오른쪽 → 아래 → 왼쪽
  for (const [cx, cy] of CLUSTER_CENTERS) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      seats.push({ id: n++, kind: 'cluster', chair: [cx + dx * 4, cy + dy * 4], desk: [cx + dx * 2.5, cy + dy * 2.5], face: [-dx, -dy], vertical: dx !== 0 });
    }
  }
  for (const cy of WINDOW_ROWS) seats.push({ id: n++, kind: 'window', chair: [2.5, cy], desk: [1, cy], face: [-1, 0], vertical: true });
  for (const cy of WINDOW_ROWS) seats.push({ id: n++, kind: 'window', chair: [21.5, cy], desk: [23, cy], face: [1, 0], vertical: true });
  return seats.map((s) => ({
    ...s,
    x: gx(s.chair[0]), z: gz(s.chair[1]),
    rotY: Math.atan2(s.face[0], s.face[1]),
    deskX: gx(s.desk[0]), deskZ: gz(s.desk[1]),
  }));
}

// 같은 색 도형을 모아 한 번에 그리기 위한 수집기
export class Batch {
  constructor() { this.bins = new Map(); }
  add(color, geo, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    const g = geo.clone();
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const gi = g.index ? g.toNonIndexed() : g;
    if (!this.bins.has(color)) this.bins.set(color, []);
    this.bins.get(color).push(gi);
  }
  addM(color, geo, matrix) {   // 행렬을 직접 줘서 추가
    const g = geo.clone(); g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const gi = g.index ? g.toNonIndexed() : g;
    if (!this.bins.has(color)) this.bins.set(color, []);
    this.bins.get(color).push(gi);
  }
  merged() { const out = new Map(); for (const [c, geos] of this.bins) out.set(c, mergeGeometries(geos, false)); return out; }
  build(parent, matOpts = {}) {
    for (const [color, geos] of this.bins) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, side: THREE.DoubleSide, ...matOpts }));
      parent.add(mesh);
    }
  }
}

// 창밖 숲 풍경: 아래쪽 띠(LAND_FRAC)가 통창 너머로 보이는 부분. 큰 나무는 그 위 하늘까지 솟음
export function landscapeTexture(aspect) {
  const W = 4096, H = Math.round(W / aspect), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const strip = H * LAND_FRAC, y0 = H - strip;       // y0: 보이는 띠의 위쪽 끝
  let sd = 23; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // 하늘
  const sky = g.createLinearGradient(0, 0, 0, y0 + strip * 0.3);
  sky.addColorStop(0, '#9FD3F0'); sky.addColorStop(0.7, '#D4EDF2'); sky.addColorStop(1, '#FFEBC8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.14, y0 - strip * 0.2, 0, W * 0.14, y0 - strip * 0.2, strip * 1.6);
  sun.addColorStop(0, '#FFF7DCff'); sun.addColorStop(0.15, '#FFECBBcc'); sun.addColorStop(0.5, '#FFE3A833'); sun.addColorStop(1, '#FFE3A800');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffffffd9';
  for (const [x, y, k] of [[0.4, -0.55, 1], [0.66, -0.35, 0.8], [0.86, -0.7, 0.7], [0.27, -0.25, 0.55]]) for (const [dx, dy, r] of [[0, 0, 0.1], [0.09, -0.03, 0.12], [0.19, 0, 0.09], [-0.08, 0.02, 0.075]]) { g.beginPath(); g.arc(x * W + dx * strip * k * 1.6, y0 + y * strip + dy * strip * k, r * strip * k * 1.3, 0, 7); g.fill(); }
  // 숲 위로 살짝 보이는 먼 산
  const ridge = (base, amp, n, wMin, wMax, color) => {
    const pk = Array.from({ length: n }, (_, i) => [(i + rnd() * 0.7) / n, wMin + rnd() * (wMax - wMin), 0.55 + rnd() * 0.45]);
    g.fillStyle = color; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) { let y = base; for (const [px, w, h] of pk) y -= h * amp * Math.exp(-Math.pow((x / W - px) / w, 2)); g.lineTo(x, y); }
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  ridge(y0 + strip * 0.32, strip * 0.55, 12, 0.025, 0.04, '#B8D2D8');
  ridge(y0 + strip * 0.38, strip * 0.38, 10, 0.03, 0.045, '#A5C9B8');
  // 둥근 나무 한 그루 (줄기 + 뭉게뭉게 잎)
  const tree = (x, base, r, leaf, dark, light, trunkH = 1.1) => {
    g.fillStyle = '#B98455'; g.fillRect(x - r * 0.11, base - r * trunkH, r * 0.22, r * trunkH + 2);
    const cy = base - r * trunkH - r * 0.55;
    g.fillStyle = dark; for (const [dx, dy, k] of [[-0.55, 0.25, 0.62], [0.55, 0.25, 0.62], [0, 0.35, 0.7]]) { g.beginPath(); g.arc(x + dx * r, cy + dy * r, r * k, 0, 7); g.fill(); }
    g.fillStyle = leaf; for (const [dx, dy, k] of [[0, -0.1, 0.78], [-0.38, 0.05, 0.55], [0.4, 0.02, 0.55]]) { g.beginPath(); g.arc(x + dx * r, cy + dy * r, r * k, 0, 7); g.fill(); }
    g.fillStyle = light; g.beginPath(); g.arc(x - r * 0.28, cy - r * 0.38, r * 0.3, 0, 7); g.fill();
  };
  // 먼 숲 → 중간 숲 → 가까운 큰 나무 순서로 겹침
  g.fillStyle = '#8DB98A'; g.fillRect(0, y0 + strip * 0.42, W, H);
  for (let x = -20; x < W + 40; x += strip * (0.06 + rnd() * 0.04)) { const r = strip * (0.07 + rnd() * 0.04); g.fillStyle = rnd() > 0.5 ? '#8DB98A' : '#82B080'; g.beginPath(); g.arc(x, y0 + strip * (0.4 + rnd() * 0.05), r, 0, 7); g.fill(); }
  for (let x = -40; x < W + 80; x += strip * (0.13 + rnd() * 0.08)) tree(x, y0 + strip * (0.72 + rnd() * 0.06), strip * (0.13 + rnd() * 0.05), '#86BE62', '#70A852', '#A2D27A', 0.9);
  // 나무 사이로 비스듬히 내려오는 햇살
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = W * (0.02 + i * 0.12 + rnd() * 0.04), w = strip * (0.12 + rnd() * 0.12);
    const gr = g.createLinearGradient(0, y0 - strip * 0.2, 0, H); gr.addColorStop(0, '#FFE6A800'); gr.addColorStop(0.35, '#FFE6A838'); gr.addColorStop(1, '#FFE6A800');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y0 - strip * 0.2); g.lineTo(x + w, y0 - strip * 0.2); g.lineTo(x + w + strip * 0.7, H); g.lineTo(x + strip * 0.7, H); g.closePath(); g.fill();
  }
  g.restore();
  // 가까운 큰 나무(위로 하늘까지 솟음, 사이사이 틈으로 뒤 숲이 보임)
  for (let x = strip * 0.1; x < W; x += strip * (0.55 + rnd() * 0.35)) tree(x, H - strip * (0.06 + rnd() * 0.08), strip * (0.32 + rnd() * 0.14), '#93C964', '#7CB556', '#B2DC88', 1.5);
  // 앞쪽 덤불과 풀밭, 작은 꽃
  g.fillStyle = '#A6D27C'; g.fillRect(0, H - strip * 0.12, W, strip * 0.12);
  for (let x = -20; x < W + 40; x += strip * (0.1 + rnd() * 0.06)) { const r = strip * (0.06 + rnd() * 0.05); g.fillStyle = rnd() > 0.5 ? '#8BC463' : '#7AB656'; g.beginPath(); g.arc(x, H - strip * 0.08, r, Math.PI, 0); g.fill(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = ['#FFFFFF', '#FFD6E0', '#FFE58A'][i % 3]; g.beginPath(); g.arc(rnd() * W, H - strip * (0.02 + rnd() * 0.1), strip * 0.012, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
export const LAND_FRAC = 0.26;   // 풍경판에서 통창 너머로 보이는 아래쪽 띠의 비율

// 나무 마루: 따뜻한 밝은 나무 판자 (판자마다 살짝 다른 색 + 가는 이음선)
function woodFloorTexture(P) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const base = new THREE.Color(P.floor);
  const rows = 8, rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 300;
    while (x < 512) {
      const len = 220 + rnd() * 200, col = base.clone().offsetHSL((rnd() - 0.5) * 0.012, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.045);
      g.fillStyle = '#' + col.getHexString(); g.fillRect(x, r * rh, len, rh);
      g.fillStyle = P.floorLine; g.fillRect(x, r * rh, 2, rh);
      x += len;
    }
    g.fillStyle = P.floorLine; g.fillRect(0, r * rh, 512, 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
// 둥근 조명 주변의 따뜻한 빛 번짐
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#FFE9B8ff'); gr.addColorStop(0.3, '#FFE2A888'); gr.addColorStop(1, '#FFE2A800');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 햇빛 자국: 가장자리가 부드럽게 번지는 따뜻한 빛 조각
export function softRectTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const e = (v) => Math.min(1, Math.min(v, 127 - v) / 22);
    const a = Math.pow(e(x) * e(y), 0.9) * (0.75 + 0.25 * (1 - y / 127));
    const i = (y * 128 + x) * 4; img.data[i] = 255; img.data[i + 1] = 226; img.data[i + 2] = 168; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function beamTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, '#FFE6B0cc'); v.addColorStop(0.6, '#FFE6B055'); v.addColorStop(1, '#FFE6B000');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, '#0000'); h.addColorStop(0.25, '#000f'); h.addColorStop(0.75, '#000f'); h.addColorStop(1, '#0000');
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 바닥에 놓이는 평행사변형(햇빛이 비스듬히 들어와 생기는 모양)
function quadGeo(p) { // p: 4개의 [x,z] (반시계)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([p[0][0], 0, p[0][1], p[1][0], 0, p[1][1], p[2][0], 0, p[2][1], p[3][0], 0, p[3][1]], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]); return g;
}

export function buildLibrary(scene) {
  const P = PALETTE, W = GRID.w * CELL, D = GRID.d * CELL, WALL_H = 3.4;
  const root = new THREE.Group(); scene.add(root);
  scene.add(new THREE.AmbientLight('#FFEBD6', 0.62));
  scene.add(new THREE.HemisphereLight('#FFF3E2', '#F7CFA6', 1.3));
  const sunLight = new THREE.DirectionalLight('#FFD8A0', 1.35); sunLight.position.set(-7, 6.5, -4); scene.add(sunLight);
  const bounce = new THREE.DirectionalLight('#FFE4CF', 0.28); bounce.position.set(5, 2, 4); scene.add(bounce);
  scene.fog = new THREE.Fog('#F4EAD6', 60, 140);
  const solid = new Batch(), flat = new Batch();
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 10), ball = new THREE.SphereGeometry(1, 14, 10);
  const ballFar = new THREE.SphereGeometry(1, 8, 6);   // 창밖 숲처럼 멀리 있는 것은 거칠게 (삼각형 수를 크게 줄임)
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);

  // ── 바닥과 바깥 정원
  const floorTex = woodFloorTexture(P); floorTex.center.set(0.5, 0.5); floorTex.rotation = Math.PI / 2; floorTex.repeat.set(D / 2.4, W / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; root.add(floor);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: P.grass, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.03; root.add(lawn);

  // ── 가구 부품: 둥근 나무 책상 + 폭신한 소파 의자(연두·크림 섞어서)
  const deskTop = rbox(3 * CELL - 0.06, 0.075, 2 * CELL - 0.06, 0.035);
  const DESK_Y = 0.385, shadowDisc = new THREE.CircleGeometry(1, 20);
  const cushion = new THREE.CylinderGeometry(1, 0.94, 1, 18);
  // 앞쪽(+z)만 트인 등받이 벽과, 그 위를 두르는 도톰한 테두리
  const backShell = new THREE.CylinderGeometry(1, 0.9, 1, 18, 1, true, Math.PI * 0.14, Math.PI * 1.72);
  const rim = new THREE.TorusGeometry(0.235, 0.068, 8, 20, Math.PI * 1.72); rim.rotateZ(Math.PI * 0.64); rim.rotateX(Math.PI / 2);
  const rimEnd = new THREE.SphereGeometry(0.068, 8, 6);
  const seats = seatLayout();
  const obstacles = [];   // 걸어 다닐 때 부딪히는 것들: { kind: 'rect', x, z, w, d, ry } | { kind: 'circle', x, z, r }
  const sofa = (x, z, ry, i) => {
    const sage = i % 3 !== 1, main = sage ? P.sofaSage : P.sofaCream, dark = sage ? P.sofaSageDk : P.sofaCreamDk;
    const at = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
    const [cx, cz] = at(0, -0.05);
    obstacles.push({ kind: 'circle', x: cx, z: cz, r: 0.27 });
    solid.add(dark, cushion, cx, 0.13, cz, ry, 0.27, 0.1, 0.26);          // 받침
    solid.add(main, ball, cx, 0.2, cz, ry, 0.25, 0.065, 0.23);                   // 방석(봉긋)
    solid.add(main, backShell, cx, 0.31, cz, ry, 0.27, 0.26, 0.26);           // 등받이·팔걸이 감싸는 벽
    solid.add(main, rim, cx, 0.44, cz, ry);                                     // 위쪽 둥근 테두리(폭신)
    for (const sd of [-1, 1]) { const a = Math.PI * 0.14 * sd; const [ex, ez] = at(Math.sin(a) * 0.235, Math.cos(a) * 0.235 - 0.03); solid.add(main, rimEnd, ex, 0.44, ez, 0); }   // 팔걸이 끝
    for (const [lx, lz] of [[-0.17, -0.18], [0.17, -0.18], [-0.17, 0.12], [0.17, 0.12]]) { const [wx, wz] = at(lx, lz - 0.05); solid.add(P.shelf, cyl, wx, 0.04, wz, 0, 0.022, 0.08, 0.022); }
    flat.add(P.shadow, shadowDisc, cx, 0.012, cz, 0, 0.31, 0.31, 1, -Math.PI / 2);
  };
  seats.forEach((s, i) => {
    const ry = s.rotY;
    solid.add(P.desk, deskTop, s.deskX, DESK_Y, s.deskZ, ry);
    obstacles.push({ kind: 'rect', x: s.deskX, z: s.deskZ, w: 3 * CELL - 0.06, d: 2 * CELL - 0.06, ry });
    for (const [lx, lz] of [[-0.36, -0.21], [0.36, -0.21], [-0.36, 0.21], [0.36, 0.21]]) {
      const wx = s.deskX + lx * Math.cos(ry) + lz * Math.sin(ry), wz = s.deskZ - lx * Math.sin(ry) + lz * Math.cos(ry);
      solid.add(P.shelf, cyl, wx, DESK_Y / 2, wz, 0, 0.03, DESK_Y, 0.03);
    }
    flat.add(P.shadow, shadowDisc, s.deskX, 0.012, s.deskZ, ry, 0.5, 0.34, 1, -Math.PI / 2);
    sofa(s.x, s.z, ry, i);
  });

  // ── 책장 한 칸(나무 틀 + 2단 책) — 곡선·직선 책장 모두 이 칸을 이어 붙여 만듦
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const SH = { w: 0.56, h: 0.74, d: 0.3 };
  const shelfUnit = (x, z, ry) => {
    obstacles.push({ kind: 'rect', x, z, w: SH.w + 0.02, d: SH.d + 0.02, ry });
    const put = (color, geo, lx, ly, lz, sx, sy, sz) => solid.add(color, geo, x + lx * Math.cos(ry) + lz * Math.sin(ry), ly, z - lx * Math.sin(ry) + lz * Math.cos(ry), ry, sx, sy, sz);
    put(P.shelf, box, 0, SH.h / 2, -0.03, SH.w, SH.h, SH.d - 0.06);          // 뒤판 겸 몸통
    put(P.shelf, box, 0, SH.h - 0.025, 0, SH.w + 0.02, 0.05, SH.d + 0.02);    // 윗판
    put(P.shelf, box, 0, 0.03, 0, SH.w + 0.02, 0.06, SH.d + 0.02);            // 밑판
    put(P.shelf, box, 0, SH.h / 2, 0.02, SH.w, 0.035, SH.d - 0.02);           // 가운데 선반
    for (const row of [0, 1]) {
      let bxp = -SH.w / 2 + 0.04;
      while (bxp < SH.w / 2 - 0.07) {
        const bw = 0.05 + rnd() * 0.035, bh = 0.24 + rnd() * 0.07;
        put(P.books[Math.floor(rnd() * 5)], box, bxp + bw / 2, (row ? SH.h / 2 + 0.02 : 0.06) + bh / 2, SH.d / 2 - 0.07, bw - 0.008, bh, 0.11);
        bxp += bw;
      }
    }
  };
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
  const lampMat = new THREE.MeshBasicMaterial({ color: P.lamp });
  const floorGlowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamp = (x, y, z) => {
    solid.add(P.shelf, cyl, x, y + 0.03, z, 0, 0.045, 0.06, 0.045);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), lampMat); bulb.position.set(x, y + 0.15, z); root.add(bulb);
    const halo = new THREE.Sprite(glowMat); halo.scale.set(0.75, 0.75, 1); halo.position.set(x, y + 0.15, z); halo.renderOrder = 4; root.add(halo);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), floorGlowMat); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.016, z + 0.3); pool.renderOrder = 2; root.add(pool);   // 바닥의 은은한 빛
  };
  const plant = (x, y, z, k = 1) => {
    if (y === 0) obstacles.push({ kind: 'circle', x, z, r: 0.11 * k });
    solid.add(P.pot, cyl, x, y + 0.07 * k, z, 0, 0.085 * k, 0.14 * k, 0.085 * k);
    for (const [dx, dy, dz, r] of [[0, 0.24, 0, 0.1], [-0.08, 0.19, 0.02, 0.075], [0.08, 0.19, -0.02, 0.075], [0, 0.18, 0.07, 0.065]]) solid.add(rnd() > 0.5 ? P.leaf : P.leafDark, ball, x + dx * k, y + dy * k, z + dz * k, 0, r * k, r * k, r * k);
  };

  // 모둠마다: 폭신한 크림색 둥근 카펫 + 뒤를 감싸는 곡선 책장 + 위에 둥근 조명과 화분
  RUGS.forEach(([x, y, r]) => {
    flat.add(P.rugRim, new THREE.CircleGeometry(1, 64), gx(x), 0.006, gz(y), 0, r * CELL, r * CELL, 1, -Math.PI / 2);
    flat.add(P.rugCream, new THREE.CircleGeometry(1, 64), gx(x), 0.008, gz(y), 0, r * CELL - 0.09, r * CELL - 0.09, 1, -Math.PI / 2);
  });
  CLUSTER_CENTERS.forEach(([cx, cy], i) => {
    const x = gx(cx), z = gz(cy), R = 6.4 * CELL;
    for (let k = -2; k <= 2; k++) {
      const a = deg(k * 17), sx = x + Math.sin(a) * R, sz = z - Math.cos(a) * R;
      shelfUnit(sx, sz, -a);
      flat.add(P.shadow, shadowDisc, sx, 0.012, sz + 0.05, -a, 0.34, 0.22, 1, -Math.PI / 2);
    }
    const s1 = i % 2 ? 1 : -1, a1 = deg(17 * s1), a2 = deg(-17 * s1);
    lamp(x + Math.sin(a1) * R, SH.h, z - Math.cos(a1) * R);
    plant(x + Math.sin(a2) * R, SH.h, z - Math.cos(a2) * R, 0.95);
  });
  plant(gx(19.4), 0, gz(70.6), 2.1);   // 입구 옆 큰 화분(들어오는 길은 비워 둠)
  plant(gx(2.2), 0, gz(70.4), 1.6);    // 앞쪽 모서리 화분

  // ── 벽: 뒤쪽은 살구색 벽 + 창문 2개, 양옆은 나무 틀 통유리
  const zBack = gz(0), xL = gx(0), xR = gx(GRID.w), zFront = gz(GRID.d);
  // 뒤쪽 통창: 나무 기둥 + 가로 창살
  for (let c = 0; c <= GRID.w; c += 6) solid.add(P.frame, box, gx(c), WALL_H / 2, zBack, 0, 0.1, WALL_H, 0.1);
  solid.add(P.frame, box, 0, WALL_H, zBack, 0, W + 0.1, 0.12, 0.12); solid.add(P.frame, box, 0, 0.05, zBack, 0, W + 0.1, 0.1, 0.1);
  solid.add(P.frame, box, 0, 2.05, zBack, 0, W, 0.06, 0.06);
  const doorGarden = { z0: gz(4), z1: gz(7) }, doorEntry = { z0: gz(68), z1: gz(71) };
  for (const [x, door] of [[xL, doorGarden], [xR, doorEntry]]) {
    for (let c = 0; c <= GRID.d; c += 8) {                                   // 세로 기둥
      const z = Math.min(gz(c), zFront);
      solid.add(P.frame, box, x, WALL_H / 2, z, 0, 0.09, WALL_H, 0.09);
    }
    solid.add(P.frame, box, x, WALL_H, 0, 0, 0.1, 0.1, D); solid.add(P.frame, box, x, 0.05, 0, 0, 0.1, 0.1, D);
    solid.add(P.frame, box, x, 2.05, 0, 0, 0.06, 0.06, D);
    // 문틀과 살짝 열린 문
    solid.add(P.frame, box, x, 1.0, door.z0, 0, 0.11, 2.0, 0.11); solid.add(P.frame, box, x, 1.0, door.z1, 0, 0.11, 2.0, 0.11);
    const s = x < 0 ? -1 : 1, dw = door.z1 - door.z0;
    solid.add(P.frame, box, x + s * dw * 0.34, 1.0, door.z0 + dw * 0.14, deg(s * 62), 0.06, 1.92, dw, 0, 0);
  }
  // 앞쪽 통창: 위에서 내려다볼 때는 화면을 가리므로 숨기고, 캐릭터 시점에서만 보임
  const front = new THREE.Group(); front.visible = false; root.add(front);
  { const fb = new Batch();
    for (let c = 0; c <= GRID.w; c += 6) fb.add(P.frame, box, gx(c), WALL_H / 2, zFront, 0, 0.09, WALL_H, 0.09);
    for (const y of [0.05, 2.05, WALL_H]) fb.add(P.frame, box, 0, y, zFront, 0, W + 0.1, y === 2.05 ? 0.06 : 0.1, 0.1);
    fb.build(front); }
  const glass = new THREE.MeshBasicMaterial({ color: '#EAF7FF', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [xL, xR]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(D, WALL_H), glass); g.rotation.y = Math.PI / 2; g.position.set(x, WALL_H / 2, 0); root.add(g); }
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(W, WALL_H), glass); g.position.set(0, WALL_H / 2, zBack); root.add(g); }
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(W, WALL_H), glass); g.position.set(0, WALL_H / 2, zFront); front.add(g); }

  // ── 커튼: 옆 통창 위·뒤쪽 모서리에 드리운 반투명 크림색 커튼(주름진 면)
  const curtainGeo = (() => { const g = new THREE.PlaneGeometry(1.1, 3.0, 24, 8); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const pinch = 1 - 0.55 * Math.exp(-Math.pow((y + 0.35) / 0.35, 2));
      p.setX(i, x * pinch); p.setZ(i, Math.sin(x * 17) * 0.05 * pinch); } g.computeVertexNormals(); return g; })();
  const curtainMat = new THREE.MeshStandardMaterial({ color: P.curtain, roughness: 1, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  for (const [x, z] of [[xL + 0.12, zBack + 0.75], [xR - 0.12, zBack + 0.75], [xL + 0.12, zFront - 0.9], [xR - 0.12, zFront - 2.0]]) {
    const m = new THREE.Mesh(curtainGeo, curtainMat); m.position.set(x, WALL_H - 1.55, z); m.rotation.y = Math.PI / 2; root.add(m);
    solid.add(P.frame, box, x, WALL_H - 0.04, z, 0, 0.06, 0.06, 1.3);   // 커튼 봉
  }

  // ── 햇빛: 왼쪽·뒤쪽 통창으로 비스듬히 들어와 바닥에 생기는 따뜻한 빛 자국 + 은은한 빛줄기
  const sunMat = new THREE.MeshBasicMaterial({ map: softRectTexture(), transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const SUN_DX = 2.6, SUN_DZ = 1.1;              // 창 아래 기준으로 빛이 바닥에 닿는 거리(오른쪽 앞 방향)
  const addPatch = (pts) => { const m = new THREE.Mesh(quadGeo(pts), sunMat); m.position.y = 0.015; m.renderOrder = 2; root.add(m); };
  const addBeam = (a, b, c, d) => {  // a,b: 창 위 두 점, c,d: 바닥 두 점
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, beamMat); m.renderOrder = 3; root.add(m);
  };
  for (let c = 0; c < GRID.d; c += 8) {           // 왼쪽 통창 칸마다
    const z0 = gz(c) + 0.12, z1 = Math.min(gz(c + 8), zFront) - 0.12;
    if (z1 - z0 < 0.5) continue;
    addPatch([[xL, z0], [xL, z1], [xL + SUN_DX, Math.min(z1 + SUN_DZ, zFront)], [xL + SUN_DX, Math.min(z0 + SUN_DZ, zFront - 0.2)]]);
    if ((c / 8) % 2 === 0 && z1 + SUN_DZ < zFront) addBeam([xL, 2.9, z0 + 0.3], [xL, 2.9, z1 - 0.3], [xL + SUN_DX, 0.02, z1 + SUN_DZ - 0.3], [xL + SUN_DX, 0.02, z0 + SUN_DZ + 0.3]);
  }
  for (let c = 0; c < GRID.w; c += 6) {           // 뒤쪽 통창 칸마다
    const x0 = gx(c) + 0.12, x1 = gx(c + 6) - 0.12;
    addPatch([[x0, zBack], [x0 + SUN_DZ * 0.8, zBack + SUN_DX * 0.8], [x1 + SUN_DZ * 0.8, zBack + SUN_DX * 0.8], [x1, zBack]]);
  }

  // ── 창밖 풍경판: 카메라를 똑바로 바라보도록 기울여 세운 큰 그림(산·나무·하늘)
  const BD_H = 2.3 / LAND_FRAC;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W + 26, BD_H), new THREE.MeshBasicMaterial({ map: landscapeTexture((W + 26) / BD_H), fog: false }));
  backdrop.position.set(0, 0, zBack - 0.8); root.add(backdrop);
  const faceBackdrop = (pitchRad) => {
    backdrop.rotation.set(-pitchRad, 0, 0);
    // 아래 끝이 땅에 닿도록: 판 중심을 판 높이의 절반만큼 판 방향으로 올림
    backdrop.position.set(0, Math.cos(pitchRad) * BD_H / 2 - 0.15, zBack - 0.8 - Math.sin(pitchRad) * BD_H / 2);
  };
  faceBackdrop(deg(44));

  // ── 바깥 정원: 둥근 나무와 길
  const tree = (x, z, k) => {
    solid.add(P.trunk, cyl, x, 0.55 * k, z, 0, 0.13 * k, 1.1 * k, 0.13 * k);
    for (const [dx, dy, dz, r] of [[0, 1.75, 0, 0.75], [-0.5, 1.45, 0.1, 0.52], [0.5, 1.45, -0.1, 0.52], [0, 1.4, 0.45, 0.48]]) solid.add(dy > 1.6 ? P.leaf : P.leafDark, ballFar, x + dx * k, dy * k, z + dz * k, 0, r * k, r * k, r * k);
  };
  for (let z = -D / 2 - 2; z < D / 2 + 3; z += 1.7) {
    for (const side of [-1, 1]) {
      for (const [dist, kMin, kMax] of [[1.9, 0.85, 1.2], [3.6, 1.0, 1.5], [5.6, 1.2, 1.8], [8, 1.3, 2.0]]) {
        const tz = z + rnd() * 1.5, tx = side * (W / 2 + dist + rnd() * 1.1), tk = kMin + rnd() * (kMax - kMin);
        const doorZ = side < 0 ? (doorGarden.z0 + doorGarden.z1) / 2 : (doorEntry.z0 + doorEntry.z1) / 2;
        if (Math.abs(tz - doorZ) < 1.6 && dist < 5) continue;   // 문 앞 길은 비워 둠
        if (tz > zFront - 3 && dist < 3) continue;              // 앞쪽 모서리는 화면을 가리지 않게 비움
        tree(tx, tz, tk);
      }
      solid.add(rnd() > 0.5 ? P.leafDark : P.leaf, ballFar, side * (W / 2 + 0.75 + rnd() * 0.35), 0.22, z + rnd(), 0, 0.34, 0.28, 0.34);
    }
  }
  // 앞쪽 숲: 입구 쪽 화면을 가리지 않도록 멀리, 그리고 가까운 줄은 낮은 덤불로
  for (let x = -W / 2 - 9; x < W / 2 + 9; x += 1.8) for (const dz of [6.5, 8.5]) tree(x + rnd(), zFront + dz + rnd(), 1.0 + rnd() * 0.5);
  for (let x = -W / 2 - 3; x < W / 2 + 3; x += 0.9) solid.add(rnd() > 0.5 ? P.leafDark : P.leaf, ballFar, x + rnd() * 0.4, 0.2, zFront + 0.8 + rnd() * 1.2, 0, 0.34, 0.26, 0.34);
  flat.add(P.path, new THREE.CircleGeometry(1, 40), xL - 1.6, -0.02, gz(5.5), 0, 1.8, 0.55, 1, -Math.PI / 2);
  flat.add(P.path, new THREE.CircleGeometry(1, 40), xR + 1.6, -0.02, gz(69.5), 0, 1.8, 0.55, 1, -Math.PI / 2);

  solid.build(root);
  // 카펫·그림자·길: 조명 영향 없이 납작하게, 그림자는 반투명
  for (const [color, geos] of flat.bins) {
    const isShadow = color === P.shadow;
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), isShadow
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    mesh.renderOrder = isShadow ? 1 : 0; root.add(mesh);
  }
  return { root, seats, obstacles, front, faceBackdrop, size: { W, D }, doors: { garden: [xL, (doorGarden.z0 + doorGarden.z1) / 2], entry: [xR, (doorEntry.z0 + doorEntry.z1) / 2] }, aisle: { x0: gx(10), x1: gx(14) } };
}
