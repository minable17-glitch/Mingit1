// 새싹책방 2.0 도서관 시제품 — ChatGPT 평면도(가로 40칸 × 세로 46칸)와 색상표를 그대로 옮김
// 좌표: x 오른쪽 +, z 화면 앞쪽(입구 쪽) +. 뒤쪽 벽이 z 음수 방향.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CELL = 0.3;                 // 평면도 1칸 = 0.3 (캐릭터 키 = 1)
export const GRID = { w: 40, d: 46 };
export const PALETTE = {
  floor: '#F5DFC2', wall: '#F7DFC0', frame: '#DDA765', shelf: '#D7A064',
  books: ['#A9BC78', '#E7C96F', '#8FAEB5', '#DFA7A0', '#EAD9B5'],
  desk: '#E6B477', chair: '#ACC76C', rug: '#DDD8A5', shadow: '#B39473',
  leaf: '#8FBF5A', leafDark: '#6FA64C', pot: '#F3E6CC', grass: '#B8DE92', grassDark: '#A8D282', sky: '#CDEBFA', path: '#F3E3C2', trunk: '#C79562',
};
const gx = (c) => (c - GRID.w / 2) * CELL, gz = (c) => (c - GRID.d / 2) * CELL;
const deg = THREE.MathUtils.degToRad;

// 평면도에서 읽은 좌석 배치 (칸 단위). 모둠 6곳 × 4석 + 창가 8석 = 32석
const CLUSTERS = [[11, 11], [29, 13], [11, 24], [29, 26], [11, 37], [29, 39]];
const WINDOW_ROWS = [10, 19, 28, 37];

export function seatLayout() {
  const seats = [];
  let n = 1;
  // 모둠: 가운데를 보고 둘러앉음 (위, 오른쪽, 아래, 왼쪽 순 = 평면도 번호 순)
  for (const [cx, cy] of CLUSTERS) {
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      seats.push({ id: n++, kind: 'cluster', chair: [cx + dx * 4.5, cy + dy * 4.5], desk: [cx + dx * 3, cy + dy * 3], face: [-dx, -dy], vertical: dx !== 0 });
    }
  }
  // 창가: 창밖을 보고 앉음
  for (const cy of WINDOW_ROWS) seats.push({ id: n++, kind: 'window', chair: [3.5, cy], desk: [2, cy], face: [-1, 0], vertical: true });
  for (const cy of WINDOW_ROWS) seats.push({ id: n++, kind: 'window', chair: [36.5, cy], desk: [38, cy], face: [1, 0], vertical: true });
  return seats.map((s) => ({
    ...s,
    x: gx(s.chair[0]), z: gz(s.chair[1]),
    rotY: Math.atan2(s.face[0], s.face[1]),      // 캐릭터가 책상을 보는 방향
    deskX: gx(s.desk[0]), deskZ: gz(s.desk[1]),
  }));
}

// 같은 색 도형을 모아 한 번에 그리기 위한 수집기
class Batch {
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
  build(parent, matOpts = {}) {
    for (const [color, geos] of this.bins) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...matOpts }));
      parent.add(mesh);
    }
  }
}

function landscapeTexture() {
  const W = 4096, H = 320, k = H / 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  // 하늘: 위는 맑은 하늘색, 산 쪽으로 갈수록 따뜻한 햇살색
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#9FD3F0'); sky.addColorStop(0.55, '#D8EEF2'); sky.addColorStop(1, '#FFE9C6');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // 해와 햇무리(왼쪽 위)
  const sun = g.createRadialGradient(W * 0.2, H * 0.14, 0, W * 0.2, H * 0.14, H * 0.9);
  sun.addColorStop(0, '#FFF6D8ff'); sun.addColorStop(0.12, '#FFEBB8cc'); sun.addColorStop(0.45, '#FFE2A833'); sun.addColorStop(1, '#FFE2A800');
  g.fillStyle = sun; g.fillRect(0, 0, W, H);
  // 구름
  g.fillStyle = '#ffffffd9';
  for (const [x, y, ck] of [[0.42, 0.12, 1], [0.62, 0.2, 0.8], [0.8, 0.09, 0.65], [0.3, 0.24, 0.55], [0.12, 0.3, 0.6], [0.95, 0.22, 0.7]]) for (const [dx, dy, r] of [[0, 0, 46], [44, -12, 54], [92, 2, 42], [-36, 8, 34]]) { g.beginPath(); g.arc(x * W + dx * ck * 1.4 * k, y * H + dy * ck * k, r * ck * 1.3 * k, 0, 7); g.fill(); }
  // 산 능선: 부드러운 봉우리를 겹침
  const ridge = (base, amp, peaks, color, top = '#ffffff00') => {
    const grd = g.createLinearGradient(0, base - amp, 0, H); grd.addColorStop(0, color); grd.addColorStop(1, color);
    g.fillStyle = grd; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) {
      let y = base;
      for (const [px, w, h] of peaks) y -= h * amp * Math.exp(-Math.pow((x / W - px) / w, 2));
      g.lineTo(x, y);
    }
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  const peaks = (n, wMin, wMax, hMin, hMax, off = 0) => Array.from({ length: n }, (_, i) => [(i + off + rnd() * 0.6) / n, wMin + rnd() * (wMax - wMin), hMin + rnd() * (hMax - hMin)]);
  ridge(H * 0.6, H * 0.5, peaks(13, 0.022, 0.034, 0.55, 1), '#B7D0D8');    // 가장 먼 산(푸르스름)
  ridge(H * 0.65, H * 0.36, peaks(11, 0.026, 0.04, 0.5, 1), '#9DC2B0');    // 중간 산
  ridge(H * 0.71, H * 0.16, peaks(9, 0.04, 0.06, 0.6, 1), '#A6CF86');      // 가까운 언덕
  // 산 위 햇살 번짐
  const glow = g.createLinearGradient(0, H * 0.3, 0, H * 0.75); glow.addColorStop(0, '#FFE8B800'); glow.addColorStop(1, '#FFE8B840');
  g.fillStyle = glow; g.fillRect(0, H * 0.3, W, H * 0.45);
  // 들판
  g.fillStyle = '#B8DE92'; g.fillRect(0, H * 0.74, W, H);
  // 나무 숲(뒤 → 앞)
  const tree = (x, y, r, leaf, leafDark) => {
    g.fillStyle = '#C08A58'; g.fillRect(x - r * 0.12, y - r * 0.2, r * 0.24, r * 0.75);
    g.fillStyle = leafDark; for (const [dx, dy, k] of [[-0.5, 0.05, 0.62], [0.5, 0.05, 0.62]]) { g.beginPath(); g.arc(x + dx * r, y - r * 0.55 + dy * r, r * k, 0, 7); g.fill(); }
    g.fillStyle = leaf; g.beginPath(); g.arc(x, y - r * 0.85, r * 0.72, 0, 7); g.fill();
    g.fillStyle = '#ffffff30'; g.beginPath(); g.arc(x - r * 0.25, y - r * 1.05, r * 0.3, 0, 7); g.fill();
  };
  for (let i = 0; i < 90; i++) tree(rnd() * W, H * (0.73 + rnd() * 0.04), (16 + rnd() * 14) * k, '#8CC56A', '#76B05A');
  for (let i = 0; i < 60; i++) tree(rnd() * W, H * (0.8 + rnd() * 0.08), (34 + rnd() * 26) * k, '#93CB66', '#79B456');
  for (let i = 0; i < 34; i++) tree(rnd() * W, H * (0.92 + rnd() * 0.06), (60 + rnd() * 34) * k, '#9ACF6A', '#7FB85A');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// 햇빛 자국: 가장자리가 부드럽게 번지는 따뜻한 빛 조각
function softRectTexture() {
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
  scene.add(new THREE.AmbientLight('#FFF1E0', 0.5));
  scene.add(new THREE.HemisphereLight('#FFF6E8', '#F6D2AE', 1.35));
  const sunLight = new THREE.DirectionalLight('#FFDDA8', 1.45); sunLight.position.set(-7, 6.5, -4); scene.add(sunLight);
  const bounce = new THREE.DirectionalLight('#FFE4CF', 0.28); bounce.position.set(5, 2, 4); scene.add(bounce);
  scene.fog = new THREE.Fog('#F4EAD6', 60, 140);
  const solid = new Batch(), flat = new Batch();
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), ball = new THREE.SphereGeometry(1, 16, 12);
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);

  // ── 바닥과 바깥 정원
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: P.floor, roughness: 1 })); floor.rotation.x = -Math.PI / 2; root.add(floor);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: P.grass, roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.03; root.add(lawn);

  // ── 가구 부품
  const deskTop = rbox(3 * CELL, 0.07, 2 * CELL, 0.03), seatG = rbox(0.42, 0.07, 0.4, 0.03), backG = rbox(0.42, 0.34, 0.07, 0.03);
  const DESK_Y = 0.385, shadowDisc = new THREE.CircleGeometry(1, 20);
  const seats = seatLayout();
  for (const s of seats) {
    const ry = s.rotY;
    // 책상: 캐릭터가 보는 방향 기준으로 가로 3칸 × 세로 2칸
    solid.add(P.desk, deskTop, s.deskX, DESK_Y, s.deskZ, ry);
    for (const [lx, lz] of [[-0.38, -0.23], [0.38, -0.23], [-0.38, 0.23], [0.38, 0.23]]) {
      const wx = s.deskX + lx * Math.cos(ry) + lz * Math.sin(ry), wz = s.deskZ - lx * Math.sin(ry) + lz * Math.cos(ry);
      solid.add(P.shelf, cyl, wx, DESK_Y / 2, wz, 0, 0.032, DESK_Y, 0.032);
    }
    flat.add(P.shadow, shadowDisc, s.deskX, 0.012, s.deskZ, ry, 0.52, 0.36, 1, -Math.PI / 2);
    // 의자: 등받이가 캐릭터 뒤쪽
    const bx = s.x - Math.sin(ry) * 0.2, bz = s.z - Math.cos(ry) * 0.2;
    solid.add(P.chair, seatG, s.x - Math.sin(ry) * 0.03, 0.2, s.z - Math.cos(ry) * 0.03, ry);
    solid.add(P.chair, backG, bx, 0.4, bz, ry);
    for (const [lx, lz] of [[-0.16, -0.19], [0.16, -0.19], [-0.16, 0.13], [0.16, 0.13]]) {
      const wx = s.x + lx * Math.cos(ry) + lz * Math.sin(ry), wz = s.z - lx * Math.sin(ry) + lz * Math.cos(ry);
      solid.add(P.shelf, cyl, wx, 0.1, wz, 0, 0.026, 0.2, 0.026);
    }
    flat.add(P.shadow, shadowDisc, s.x, 0.012, s.z, 0, 0.27, 0.27, 1, -Math.PI / 2);
  }

  // ── 책장 한 칸(나무 틀 + 2단 책) — 곡선·직선 책장 모두 이 칸을 이어 붙여 만듦
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const SH = { w: 0.56, h: 0.78, d: 0.3 };
  const shelfUnit = (x, z, ry) => {
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
  const plant = (x, y, z, k = 1) => {
    solid.add(P.pot, cyl, x, y + 0.07 * k, z, 0, 0.085 * k, 0.14 * k, 0.085 * k);
    for (const [dx, dy, dz, r] of [[0, 0.24, 0, 0.1], [-0.08, 0.19, 0.02, 0.075], [0.08, 0.19, -0.02, 0.075], [0, 0.18, 0.07, 0.065]]) solid.add(rnd() > 0.5 ? P.leaf : P.leafDark, ball, x + dx * k, y + dy * k, z + dz * k, 0, r * k, r * k, r * k);
  };

  // 모둠마다: 둥근 카펫 + 뒤쪽을 감싸는 곡선 책장 + 화분
  CLUSTERS.forEach(([cx, cy], i) => {
    const x = gx(cx), z = gz(cy);
    flat.add(i % 2 ? '#E9E2BE' : P.rug, new THREE.CircleGeometry(1, 48), x, 0.006, z, 0, 5.6 * CELL, 5.6 * CELL, 1, -Math.PI / 2);
    const R = 7.1 * CELL;
    for (let k = -2; k <= 2; k++) {
      const a = deg(k * 17), sx = x + Math.sin(a) * R, sz = z - Math.cos(a) * R;
      shelfUnit(sx, sz, -a);
      flat.add(P.shadow, shadowDisc, sx, 0.012, sz + 0.05, -a, 0.34, 0.22, 1, -Math.PI / 2);
    }
    plant(x, SH.h, z - R, 1);
  });
  // 뒤쪽 벽 앞 낮은 책장 3개 (평면도: 4~12칸, 16~24칸, 28~36칸)
  for (const [a, b] of [[4, 12], [16, 24], [28, 36]]) {
    const n = 4, x0 = gx(a) + SH.w / 2 + 0.08;
    for (let k = 0; k < n; k++) shelfUnit(x0 + k * (SH.w + 0.02), gz(1.4), 0);
    plant(gx((a + b) / 2) + (a === 16 ? 0 : 0.7), SH.h, gz(1.4), 0.9);
  }
  plant(gx(37.5), 0, gz(42.5), 2.3);   // 입구 옆 큰 화분

  // ── 벽: 뒤쪽은 살구색 벽 + 창문 2개, 양옆은 나무 틀 통유리
  const zBack = gz(0), xL = gx(0), xR = gx(GRID.w), zFront = gz(GRID.d);
  // 뒤쪽 통창: 나무 기둥 + 가로 창살
  for (let c = 0; c <= GRID.w; c += 8) solid.add(P.frame, box, gx(c), WALL_H / 2, zBack, 0, 0.1, WALL_H, 0.1);
  solid.add(P.frame, box, 0, WALL_H, zBack, 0, W + 0.1, 0.12, 0.12); solid.add(P.frame, box, 0, 0.05, zBack, 0, W + 0.1, 0.1, 0.1);
  solid.add(P.frame, box, 0, 2.05, zBack, 0, W, 0.06, 0.06);
  const doorGarden = { z0: gz(4), z1: gz(7) }, doorEntry = { z0: gz(43), z1: gz(46) };
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
  const glass = new THREE.MeshBasicMaterial({ color: '#EAF7FF', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [xL, xR]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(D, WALL_H), glass); g.rotation.y = Math.PI / 2; g.position.set(x, WALL_H / 2, 0); root.add(g); }
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(W, WALL_H), glass); g.position.set(0, WALL_H / 2, zBack); root.add(g); }

  // ── 햇빛: 왼쪽·뒤쪽 통창으로 비스듬히 들어와 바닥에 생기는 따뜻한 빛 자국 + 은은한 빛줄기
  const sunMat = new THREE.MeshBasicMaterial({ map: softRectTexture(), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
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
    if ((c / 8) % 2 === 0) addBeam([xL, 2.9, z0 + 0.3], [xL, 2.9, z1 - 0.3], [xL + SUN_DX, 0.02, z1 + SUN_DZ - 0.3], [xL + SUN_DX, 0.02, z0 + SUN_DZ + 0.3]);
  }
  for (let c = 0; c < GRID.w; c += 8) {           // 뒤쪽 통창 칸마다
    const x0 = gx(c) + 0.12, x1 = gx(c + 8) - 0.12;
    addPatch([[x0, zBack], [x0 + SUN_DZ * 0.8, zBack + SUN_DX * 0.8], [x1 + SUN_DZ * 0.8, zBack + SUN_DX * 0.8], [x1, zBack]]);
  }

  // ── 창밖 풍경판: 카메라를 똑바로 바라보도록 기울여 세운 큰 그림(산·나무·하늘)
  const BD_H = 2.3;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W + 26, BD_H), new THREE.MeshBasicMaterial({ map: landscapeTexture(), fog: false }));
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
    for (const [dx, dy, dz, r] of [[0, 1.75, 0, 0.75], [-0.5, 1.45, 0.1, 0.52], [0.5, 1.45, -0.1, 0.52], [0, 1.4, 0.45, 0.48]]) solid.add(dy > 1.6 ? P.leaf : P.leafDark, ball, x + dx * k, dy * k, z + dz * k, 0, r * k, r * k, r * k);
  };
  for (const [x, z, k] of [[-9, -5, 1.5], [-11.5, -1, 1.2], [-8.6, 2.5, 1.0], [-12, 5, 1.4], [9.2, -4.5, 1.4], [11.8, -0.5, 1.6], [8.8, 3.5, 1.1], [12.5, 6.5, 1.3], [-9.5, -10, 1.3], [9.5, -10.5, 1.5]]) tree(x, z, k);
  for (const [x, z, r] of [[-7.6, -3.2, 0.34], [-7.9, 4.6, 0.3], [7.7, 0.8, 0.36], [8.1, -2.4, 0.3], [-10.4, 1.4, 0.4], [10.5, 4.4, 0.4]]) solid.add(P.leafDark, ball, x, r * 0.7, z, 0, r, r * 0.8, r);
  flat.add(P.path, new THREE.CircleGeometry(1, 40), -9.2, -0.02, gz(5.5), 0, 2.9, 1.0, 1, -Math.PI / 2);
  flat.add(P.path, new THREE.CircleGeometry(1, 40), 9.4, -0.02, gz(44.5), 0, 3.0, 1.0, 1, -Math.PI / 2);

  solid.build(root);
  // 카펫·그림자·길: 조명 영향 없이 납작하게, 그림자는 반투명
  for (const [color, geos] of flat.bins) {
    const isShadow = color === P.shadow;
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), isShadow
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    mesh.renderOrder = isShadow ? 1 : 0; root.add(mesh);
  }
  return { root, seats, faceBackdrop, doors: { garden: [xL, (doorGarden.z0 + doorGarden.z1) / 2], entry: [xR, (doorEntry.z0 + doorEntry.z1) / 2] }, aisle: { x0: gx(17), x1: gx(23) } };
}
