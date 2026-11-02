// 2000년대 감성의 3층 학교 (층마다 교실 10개 + 양쪽 계단 + 흙 운동장)
// 외부 3D 파일 없이 기본 도형 + 캔버스 무늬로 만들고, 같은 재질끼리 하나로 합쳐서
// 휴대폰에서도 가볍게 돌아가도록 했습니다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ── 건물 치수 ─────────────────────────────────────────────
export const LEVEL_H = 3.6; // 층 높이
export const LEVELS = 3;
export const levelY = (k) => 0.15 + k * LEVEL_H; // k층 바닥 높이 (0 = 1층)
export const levelOfY = (y) => Math.max(0, Math.min(LEVELS - 1, Math.round((y - 0.15) / LEVEL_H)));

const SLOT = 9; // 교실 가로
const STAIR_W = 7; // 계단실 가로
const HALL_W = 9; // 가운데(현관/교무실/도서실)
const Z_FRONT = 0; // 운동장 쪽 벽
const Z_CORR = -9; // 교실 / 복도 경계
const Z_BACK = -12; // 건물 뒤쪽 벽
const FLIGHT_END = -1.6; // 계단 층계참 시작
const BX = (2 * STAIR_W + 10 * SLOT + HALL_W) / 2; // 건물 반폭 = 56.5

// 가로 방향 칸 배치: 계단 | 1~5반 | 가운데 | 6~10반 | 계단
const SLOTS = [];
{
  let x = -BX;
  const push = (type, w, n) => {
    SLOTS.push({ type, xs: x, xe: x + w, n });
    x += w;
  };
  push('stair', STAIR_W);
  for (let i = 1; i <= 5; i++) push('class', SLOT, i);
  push('hall', HALL_W);
  for (let i = 6; i <= 10; i++) push('class', SLOT, i);
  push('stair', STAIR_W);
}

export const STAIRS = SLOTS.filter((s) => s.type === 'stair').map((s) => ({
  xs: s.xs,
  xe: s.xe,
  xA: s.xs + 1.75, // 복도에서 앞으로 올라가는 쪽
  xB: s.xs + 5.25, // 층계참에서 꺾여 뒤로 올라가는 쪽
  mid: s.xs + 3.5,
  zEntry: -10.5,
  zCorr: Z_CORR,
  zFlightEnd: FLIGHT_END,
  zLanding: -0.85,
}));

export const CLASSROOMS = [];
for (let k = 0; k < LEVELS; k++) {
  for (const s of SLOTS) {
    if (s.type !== 'class') continue;
    CLASSROOMS.push({ id: `${k + 1}-${s.n}`, name: `${k + 1}학년 ${s.n}반`, level: k, xs: s.xs, xe: s.xe });
  }
}

export function roomAt(x, z, y) {
  if (z < Z_CORR || z > Z_FRONT) return null;
  const k = levelOfY(y);
  return CLASSROOMS.find((c) => c.level === k && x > c.xs && x < c.xe) || null;
}

// 매점 위치 (운동장 옆)
export const STORE = { minX: 36, maxX: 46, minZ: 4, maxZ: 12.5, doorX1: 40, doorX2: 42 };
// 축구장 (공이 굴러다니는 범위)과 골대
export const PITCH = { minX: -46.8, maxX: 46.8, minZ: 15.3, maxZ: 66.7, goalX: 43, goalZ1: 37.6, goalZ2: 44.4, goalDepth: 44.3 };

// 층별 길찾기 범위
export const NAV_BOUNDS = [
  { minX: -68.5, maxX: 68.5, minZ: -15.5, maxZ: 72.5 }, // 1층 + 바깥(담장 안)
  { minX: -BX, maxX: BX, minZ: Z_BACK, maxZ: Z_FRONT },
  { minX: -BX, maxX: BX, minZ: Z_BACK, maxZ: Z_FRONT },
];

// ── 캔버스 무늬 ───────────────────────────────────────────
function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function canvasTex(w, h, draw, { repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const speckle = (base, colors, n, seed, sz = 3) => (g, w, h) => {
  const r = rand(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(r() * w, r() * h, 1 + r() * sz, 1 + r() * sz);
  }
};

const FONT = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif";

function textTex(w, h, bg, fg, lines, size, border) {
  return canvasTex(
    w,
    h,
    (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (border) {
        g.strokeStyle = border;
        g.lineWidth = Math.max(4, h * 0.06);
        g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
      }
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      lines.forEach((ln, i) => {
        g.font = `700 ${size}px ${FONT}`;
        g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.2, w - 20);
      });
    },
    { repeat: false },
  );
}

// 칠판 (반마다 따로)
export function drawBoardCanvas(c, text) {
  const g = c.getContext('2d');
  g.fillStyle = '#2e5040';
  g.fillRect(0, 0, c.width, c.height);
  const r = rand(3);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    g.fillRect(r() * c.width, r() * c.height, 10 + r() * 40, 2);
  }
  const lines = String(text || '').split('\n').slice(0, 5);
  const size = lines.length > 3 ? 30 : 38;
  g.font = `600 ${size}px ${FONT}`;
  g.fillStyle = '#f4f1e6';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const top = c.height / 2 - ((lines.length - 1) * size * 1.25) / 2;
  lines.forEach((ln, i) => g.fillText(ln, c.width / 2, top + i * size * 1.25, c.width - 30));
}

// ── 같은 재질끼리 합치는 도우미 (그리기 횟수를 줄여 휴대폰에서도 빠르게) ──
function createBatcher() {
  const groups = new Map();
  const v = new THREE.Vector3();
  function push(mat, role, g) {
    g = g.index ? g.toNonIndexed() : g;
    g.computeBoundingBox();
    g.boundingBox.getCenter(v);
    const chunk = Math.floor((v.x + 90) / 18);
    const key = `${mat}|${role}|${chunk}`;
    if (!groups.has(key)) groups.set(key, { mat, role, geos: [] });
    groups.get(key).geos.push(g);
  }
  return {
    box(mat, role, x1, x2, y1, y2, z1, z2) {
      const g = new THREE.BoxGeometry(Math.abs(x2 - x1) || 0.001, Math.abs(y2 - y1) || 0.001, Math.abs(z2 - z1) || 0.001);
      g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
      push(mat, role, g);
    },
    geo(mat, role, g, x, y, z) {
      g.translate(x, y, z);
      push(mat, role, g);
    },
    build(scene, mats) {
      const out = { floor: [], wall: [], glass: [], chair: [], deco: [] };
      for (const { mat, role, geos } of groups.values()) {
        const m = mats[mat];
        for (const g of geos) {
          // 어느 방향 면이든 실제 크기에 맞게 무늬가 반복되도록 UV 다시 계산
          const p = g.attributes.position;
          const n = g.attributes.normal;
          const uv = g.attributes.uv;
          const s = m.userData.uvScale || 1;
          for (let i = 0; i < p.count; i++) {
            const ax = Math.abs(n.getX(i));
            const ay = Math.abs(n.getY(i));
            const az = Math.abs(n.getZ(i));
            if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s);
            else if (ax >= az) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s);
            else uv.setXY(i, p.getX(i) * s, p.getY(i) * s);
          }
        }
        const merged = mergeGeometries(geos, false);
        geos.forEach((g) => g.dispose());
        const mesh = new THREE.Mesh(merged, m);
        mesh.castShadow = role !== 'glass' && role !== 'floor';
        mesh.receiveShadow = role !== 'glass';
        mesh.userData.role = role;
        scene.add(mesh);
        out[role].push(mesh);
      }
      return out;
    },
  };
}

// ── 공간 만들기 ───────────────────────────────────────────
export function buildWorld(scene) {
  const B = createBatcher();
  const blocks = [[], [], []]; // 층별 막힌 영역
  const block = (k, x1, x2, z1, z2) =>
    blocks[k].push({ minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) });
  const chairs = [];
  const boards = new Map(); // 반 id → { canvas, texture }
  const animated = [];

  // 재질
  const std = (color, extra = {}, uvScale = 1) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    m.userData.uvScale = uvScale;
    return m;
  };
  const tex = {
    wood: canvasTex(256, 256, (g, w) => {
      const r = rand(29);
      for (let i = 0; i < 8; i++) {
        const l = r() * 22;
        g.fillStyle = `rgb(${172 + l},${122 + l},${74 + l})`;
        g.fillRect(0, (i * w) / 8, w, w / 8);
        g.fillStyle = 'rgba(70,40,20,0.35)';
        g.fillRect(0, (i * w) / 8, w, 2);
        g.fillRect((i * 97) % w, (i * w) / 8, 2, w / 8);
      }
    }),
    terrazzo: canvasTex(256, 256, speckle('#b9b6aa', ['#8e8b80', '#d8d5ca', '#a49f90', '#6f6c64'], 2600, 5, 3)),
    dirt: canvasTex(256, 256, speckle('#c4a479', ['#b39066', '#d2b48b', '#a9875c', '#cbb08a'], 3000, 11, 3)),
    grass: canvasTex(256, 256, speckle('#7c9a4e', ['#6b8a42', '#8fae5c', '#97884f'], 2600, 7, 4)),
    concrete: canvasTex(256, 256, speckle('#c9c4b8', ['#bdb8ab', '#d3cfc4', '#b0ab9e'], 1800, 17, 2)),
    locker: canvasTex(128, 128, (g) => {
      g.fillStyle = '#b48552';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#7a5532';
      g.lineWidth = 4;
      g.strokeRect(4, 4, 120, 120);
      g.fillStyle = '#d8d8d8';
      g.fillRect(96, 54, 14, 20);
    }),
  };
  const mats = {
    floorWood: std('#ffffff', { map: tex.wood }, 0.5),
    terrazzo: std('#ffffff', { map: tex.terrazzo, roughness: 0.5 }, 0.5),
    cream: std('#efe4c8'),
    band: std('#b8745d'),
    green: std('#86a58d'),
    white: std('#f2f2ee'),
    roof: std('#a19f96'),
    concrete: std('#ffffff', { map: tex.concrete }, 0.3),
    glass: (() => {
      const m = new THREE.MeshStandardMaterial({ color: '#9cc3d8', transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.2, depthWrite: false });
      m.userData.uvScale = 1;
      return m;
    })(),
    frame: std('#dcdcd6', { metalness: 0.3, roughness: 0.5 }),
    deskTop: std('#d9b27c'),
    metal: std('#5c6770', { metalness: 0.4, roughness: 0.5 }),
    chair: std('#c08a55'),
    door: std('#8a5a3a'),
    locker: std('#ffffff', { map: tex.locker }, 2.5),
    lectern: std('#8a5a36'),
    tv: std('#26272a', { roughness: 0.4 }),
    lamp: std('#ffffff', { emissive: '#fff8e6', emissiveIntensity: 0.9 }),
    cork: std('#b98c5c'),
    shelf: std('#7a5434'),
    books: std('#9b4a3a'),
    trunk: std('#6b4a32'),
    leaf1: std('#4f7d3a'),
    leaf2: std('#6a9447'),
    ginkgo: std('#e0b93a'),
    shrub: std('#3f6e35'),
    pole: std('#d9dde0', { metalness: 0.6, roughness: 0.3 }),
    red: std('#c8473d', { metalness: 0.2 }),
    yellow: std('#e1b43a', { metalness: 0.2 }),
    blue: std('#3b6fb0', { metalness: 0.2 }),
    fence: std('#5b7d5a', { metalness: 0.3 }),
    blueRoof: std('#3d6fa8', { roughness: 0.6 }),
  };

  // 하늘/조명
  scene.background = new THREE.Color('#bcd5e8');
  scene.fog = new THREE.Fog('#cddde8', 60, 170);
  scene.add(new THREE.HemisphereLight('#eef4ff', '#7a7355', 1.25));
  const sun = new THREE.DirectionalLight('#fff2dc', 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // ── 땅 ──
  const walkables = [];
  const flat = (w, h, map, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    walkables.push(m);
    return m;
  };
  tex.grass.repeat.set(80, 80);
  flat(400, 400, tex.grass, 0, 0, 0);
  tex.dirt.repeat.set(30, 13);
  flat(137, 58, tex.dirt, 0, 0.01, 43.5); // 운동장 둘레 흙
  tex.concrete.repeat.set(30, 4);
  flat(137, 15, tex.concrete, 0, 0.015, 7.5); // 건물 앞 시멘트 마당
  // 흙 운동장 (트랙 선)
  const fieldTex = canvasTex(
    1024,
    576,
    (g, w, h) => {
      speckle('#c4a479', ['#b39066', '#d2b48b', '#a9875c', '#cbb08a'], 26000, 11, 3)(g, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 5;
      for (const inset of [40, 70]) {
        const rr = (h - inset * 2) / 2;
        g.beginPath();
        g.moveTo(inset + rr, inset);
        g.lineTo(w - inset - rr, inset);
        g.arc(w - inset - rr, h / 2, rr, -Math.PI / 2, Math.PI / 2);
        g.lineTo(inset + rr, h - inset);
        g.arc(inset + rr, h / 2, rr, Math.PI / 2, (Math.PI * 3) / 2);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(w / 2, 100);
      g.lineTo(w / 2, h - 100);
      g.stroke();
      g.beginPath();
      g.arc(w / 2, h / 2, 50, 0, Math.PI * 2);
      g.stroke();
    },
    { repeat: false },
  );
  flat(94, 52, fieldTex, 0, 0.02, 41);

  // ── 건물: 바닥판 ──
  const WALL_T = 0.2;
  for (let k = 0; k <= LEVELS; k++) {
    const L = levelY(k);
    const yb = k === 0 ? 0 : L - 0.2;
    for (const s of SLOTS) {
      if (k === LEVELS) {
        B.box('roof', 'floor', s.xs, s.xe, yb, L, Z_BACK, Z_FRONT); // 옥상
        continue;
      }
      if (s.type === 'class') B.box('floorWood', 'floor', s.xs, s.xe, yb, L, Z_CORR, Z_FRONT);
      else if (s.type === 'hall' || k === 0) B.box('terrazzo', 'floor', s.xs, s.xe, yb, L, Z_CORR, Z_FRONT);
      // 계단실 2·3층은 계단 자리 뚫림
      B.box('terrazzo', 'floor', s.xs, s.xe, yb, L, Z_BACK, Z_CORR); // 복도
    }
  }
  // 옥상 난간
  const roofY = levelY(LEVELS);
  B.box('cream', 'wall', -BX, BX, roofY, roofY + 1, Z_FRONT - 0.25, Z_FRONT);
  B.box('cream', 'wall', -BX, BX, roofY, roofY + 1, Z_BACK, Z_BACK + 0.25);
  B.box('cream', 'wall', -BX, -BX + 0.25, roofY, roofY + 1, Z_BACK, Z_FRONT);
  B.box('cream', 'wall', BX - 0.25, BX, roofY, roofY + 1, Z_BACK, Z_FRONT);

  // 창문 벽 (아래 벽돌색 띠 + 유리 + 위 크림색)
  function windowWall(k, x1, x2, z1, z2) {
    const L = levelY(k);
    const yb = k === 0 ? 0 : L - 0.2;
    B.box('band', 'wall', x1, x2, yb, L + 0.9, z1, z2);
    B.box('glass', 'glass', x1, x2, L + 0.9, L + 2.7, z1 + 0.06, z2 - 0.06);
    B.box('cream', 'wall', x1, x2, L + 2.7, L + LEVEL_H - 0.2, z1, z2);
    const n = Math.max(1, Math.round((x2 - x1) / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n;
      B.box('frame', 'deco', x - 0.04, x + 0.04, L + 0.9, L + 2.7, z1 - 0.02, z2 + 0.02);
    }
    B.box('frame', 'deco', x1, x2, L + 1.8, L + 1.86, z1 - 0.02, z2 + 0.02);
    block(k, x1, x2, z1, z2);
  }
  function solidWall(k, x1, x2, z1, z2, mat = 'cream') {
    const L = levelY(k);
    const yb = k === 0 ? 0 : L - 0.2;
    B.box(mat, 'wall', x1, x2, yb, L + LEVEL_H - 0.2, z1, z2);
    block(k, x1, x2, z1, z2);
  }
  // 문 있는 벽 (교실 앞문/뒷문)
  function wallWithDoors(k, x1, x2, z1, z2, doors) {
    const L = levelY(k);
    let cur = x1;
    for (const [d1, d2] of doors) {
      if (d1 > cur) solidWall(k, cur, d1, z1, z2);
      B.box('cream', 'wall', d1, d2, L + 2.25, L + LEVEL_H - 0.2, z1, z2);
      // 반쯤 열린 나무 미닫이문
      B.box('door', 'deco', d1 - 0.75, d1 + 0.05, L, L + 2.2, z1 - 0.06, z1 - 0.01);
      B.box('glass', 'glass', d1 - 0.55, d1 - 0.15, L + 1.2, L + 1.9, z1 - 0.08, z1 - 0.07);
      cur = d2;
    }
    if (x2 > cur) solidWall(k, cur, x2, z1, z2);
    // 복도 쪽 아래 절반 초록 페인트 (그 시절 학교 복도)
    B.box('green', 'deco', x1, x2, L, L + 1.1, z1 - 0.02, z1);
  }

  for (let k = 0; k < LEVELS; k++) {
    const L = levelY(k);
    for (const s of SLOTS) {
      // 앞벽 (운동장 쪽)
      if (s.type === 'hall') {
        if (k === 0) {
          solidWall(k, s.xs, -2.5, Z_FRONT - WALL_T, Z_FRONT);
          solidWall(k, 2.5, s.xe, Z_FRONT - WALL_T, Z_FRONT);
          B.box('cream', 'wall', -2.5, 2.5, L + 2.6, L + LEVEL_H - 0.2, Z_FRONT - WALL_T, Z_FRONT);
        } else solidWall(k, s.xs, s.xe, Z_FRONT - WALL_T, Z_FRONT);
      } else windowWall(k, s.xs, s.xe, Z_FRONT - WALL_T, Z_FRONT);
      // 뒷벽 (복도 창문)
      windowWall(k, s.xs, s.xe, Z_BACK, Z_BACK + WALL_T);
      // 교실/복도 경계 벽
      if (s.type === 'class') {
        wallWithDoors(k, s.xs, s.xe, Z_CORR - 0.1, Z_CORR + 0.1, [[s.xs + 0.7, s.xs + 2.1], [s.xe - 2.1, s.xe - 0.7]]);
      } else if (s.type === 'hall' && k > 0) {
        wallWithDoors(k, s.xs, s.xe, Z_CORR - 0.1, Z_CORR + 0.1, [[-0.8, 0.8]]);
      }
    }
    // 칸 사이 칸막이 벽
    for (let i = 1; i < SLOTS.length; i++) {
      const x = SLOTS[i].xs;
      solidWall(k, x - 0.1, x + 0.1, Z_CORR, Z_FRONT - WALL_T);
    }
    // 양 끝 벽 (1층은 계단실 옆문)
    for (const sx of [-BX, BX]) {
      const x1 = sx < 0 ? sx : sx - WALL_T;
      const x2 = x1 + WALL_T;
      if (k === 0) {
        solidWall(k, x1, x2, Z_BACK, -11.4);
        solidWall(k, x1, x2, -9.6, Z_FRONT);
        B.box('cream', 'wall', x1, x2, L + 2.25, L + LEVEL_H - 0.2, -11.4, -9.6);
      } else solidWall(k, x1, x2, Z_BACK, Z_FRONT);
    }
  }

  // ── 계단 (꺾인 계단: 복도 → 앞으로 반 층 → 층계참 → 뒤로 반 층) ──
  const STEPS = 12;
  const run = (FLIGHT_END - Z_CORR) / STEPS;
  for (const st of STAIRS) {
    B.box('cream', 'wall', st.mid - 0.1, st.mid + 0.1, 0, levelY(LEVELS) - 0.2, Z_CORR, FLIGHT_END);
    for (let k = 0; k < LEVELS; k++) block(k, st.xs, st.xe, Z_CORR, Z_FRONT); // 계단 구역은 평면 길찾기에서 제외
    for (let k = 0; k < LEVELS - 1; k++) {
      const L = levelY(k);
      for (let i = 0; i < STEPS; i++) {
        const topA = L + 0.15 * (i + 1);
        B.box('terrazzo', 'deco', st.xs + 0.2, st.mid - 0.1, Math.max(L, topA - 0.45), topA, Z_CORR + run * i, Z_CORR + run * (i + 1));
        const topB = L + 1.8 + 0.15 * (i + 1);
        B.box('terrazzo', 'deco', st.mid + 0.1, st.xe - 0.2, topB - 0.45, topB, FLIGHT_END - run * (i + 1), FLIGHT_END - run * i);
      }
      B.box('terrazzo', 'deco', st.xs + 0.2, st.xe - 0.2, L + 1.6, L + 1.8, FLIGHT_END, Z_FRONT - WALL_T); // 층계참
      // 난간
      const len = FLIGHT_END - Z_CORR;
      for (const [x, up] of [[st.mid - 0.15, true], [st.mid + 0.15, false]]) {
        const g = new THREE.BoxGeometry(0.05, 0.05, Math.hypot(len, 1.8));
        g.rotateX(Math.atan2(1.8, len) * (up ? -1 : 1));
        B.geo('metal', 'deco', g, x, L + (up ? 0 : 1.8) + 0.9 + 0.9, (Z_CORR + FLIGHT_END) / 2);
      }
    }
  }

  // ── 교실 안 ──
  const taegukTex = canvasTex(
    120,
    80,
    (g) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 120, 80);
      g.fillStyle = '#2f5aa8';
      g.beginPath();
      g.arc(60, 40, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#cd2e3a';
      g.beginPath();
      g.arc(60, 40, 18, Math.PI, 0);
      g.fill();
      g.beginPath();
      g.arc(51, 40, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2f5aa8';
      g.beginPath();
      g.arc(69, 40, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      for (const [x, y] of [[20, 14], [100, 14], [20, 66], [100, 66]]) for (let i = 0; i < 3; i++) g.fillRect(x - 9, y - 6 + i * 5, 18, 3);
    },
    { repeat: false },
  );
  const taegukMat = new THREE.MeshBasicMaterial({ map: taegukTex });
  const signGeo = new THREE.PlaneGeometry(0.9, 0.32);

  for (const room of CLASSROOMS) {
    const L = levelY(room.level);
    const { xs, xe } = room;
    const k = room.level;
    // 칠판 (서쪽 벽, 창문이 왼쪽에 오는 그 시절 배치)
    B.box('lectern', 'deco', xs + 0.1, xs + 0.16, L + 0.95, L + 2.45, -7.1, -1.9);
    B.box('frame', 'deco', xs + 0.1, xs + 0.3, L + 0.9, L + 0.95, -7.0, -2.0);
    const bc = document.createElement('canvas');
    bc.width = 640;
    bc.height = 256;
    drawBoardCanvas(bc, `${room.name}\n오늘도 즐겁게!`);
    const bt = new THREE.CanvasTexture(bc);
    bt.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.4), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95 }));
    board.rotation.y = Math.PI / 2;
    board.position.set(xs + 0.17, L + 1.7, -4.5);
    scene.add(board);
    boards.set(room.id, { canvas: bc, texture: bt, name: room.name });
    // 태극기
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), taegukMat);
    flag.rotation.y = Math.PI / 2;
    flag.position.set(xs + 0.12, L + 2.85, -4.5);
    scene.add(flag);
    // 교탁 + 선생님 책상
    B.box('lectern', 'deco', xs + 1.3, xs + 1.9, L, L + 1.05, -5, -4);
    block(k, xs + 1.3, xs + 1.9, -5, -4);
    B.box('lectern', 'deco', xs + 0.6, xs + 1.4, L + 0.72, L + 0.76, -1.9, -0.4);
    B.box('metal', 'deco', xs + 0.65, xs + 1.35, L, L + 0.72, -1.85, -1.75);
    B.box('metal', 'deco', xs + 0.65, xs + 1.35, L, L + 0.72, -0.55, -0.45);
    block(k, xs + 0.6, xs + 1.4, -1.9, -0.4);
    // 뚱뚱한 브라운관 TV
    B.box('tv', 'deco', xs + 0.35, xs + 0.95, L + 2.45, L + 3.0, -8.75, -8.05);
    B.box('metal', 'deco', xs + 0.6, xs + 0.7, L + 3.0, L + 3.4, -8.45, -8.35);
    // 사물함 + 게시판 (뒤쪽 벽)
    B.box('locker', 'deco', xe - 0.6, xe - 0.1, L, L + 1.2, -8.6, -0.5);
    block(k, xe - 0.6, xe - 0.1, -8.6, -0.5);
    B.box('cork', 'deco', xe - 0.13, xe - 0.1, L + 1.5, L + 2.6, -7.5, -1.5);
    // 형광등
    for (const lx of [xs + 2.5, xs + 6.5]) for (const lz of [-7, -4.5, -2]) B.box('lamp', 'deco', lx - 0.6, lx + 0.6, L + 3.32, L + 3.38, lz - 0.08, lz + 0.08);
    // 짝꿍 책상 5줄 × 3쌍 + 의자 30개
    for (let r = 0; r < 5; r++) {
      const dx = xs + 2.9 + r * 1.15;
      for (const cz of [-7.2, -4.5, -1.8]) {
        B.box('deskTop', 'deco', dx - 0.25, dx + 0.25, L + 0.72, L + 0.76, cz - 0.65, cz + 0.65);
        B.box('metal', 'deco', dx - 0.22, dx + 0.22, L + 0.55, L + 0.58, cz - 0.6, cz + 0.6);
        for (const lz of [cz - 0.6, cz, cz + 0.6]) B.box('metal', 'deco', dx - 0.2, dx + 0.2, L, L + 0.72, lz - 0.02, lz + 0.02);
        block(k, dx - 0.25, dx + 0.25, cz - 0.65, cz + 0.65);
        for (const sz of [cz - 0.33, cz + 0.33]) {
          const chx = dx + 0.55;
          B.box('chair', 'chair', chx - 0.2, chx + 0.2, L + 0.42, L + 0.46, sz - 0.19, sz + 0.19);
          B.box('chair', 'chair', chx + 0.17, chx + 0.21, L + 0.46, L + 0.86, sz - 0.19, sz + 0.19);
          B.box('metal', 'deco', chx - 0.17, chx + 0.17, L, L + 0.42, sz - 0.17, sz - 0.15);
          B.box('metal', 'deco', chx - 0.17, chx + 0.17, L, L + 0.42, sz + 0.15, sz + 0.17);
          chairs.push({ x: chx, z: sz, seatY: L + 0.45, ry: -Math.PI / 2, level: k, room: room.id });
        }
      }
    }
    // 반 팻말 (복도로 튀어나온)
    const sign = new THREE.Mesh(
      signGeo,
      new THREE.MeshBasicMaterial({ map: textTex(256, 92, '#f7f2e2', '#2b2b2b', [room.id.replace('-', ' - ')], 54, '#7a5532'), side: THREE.DoubleSide }),
    );
    sign.rotation.y = Math.PI / 2;
    sign.position.set(xs + 1.4, L + 2.7, Z_CORR - 0.55);
    scene.add(sign);
  }

  // 가운데 칸: 1층 중앙현관(신발장), 2층 교무실, 3층 도서실
  const hall = SLOTS.find((s) => s.type === 'hall');
  {
    const L = levelY(0);
    for (const [x1, x2] of [[hall.xs + 0.1, hall.xs + 0.6], [hall.xe - 0.6, hall.xe - 0.1]]) {
      B.box('locker', 'deco', x1, x2, L, L + 1.8, -8, -1);
      block(0, x1, x2, -8, -1);
    }
    // 현관 지붕(캐노피)
    B.box('concrete', 'wall', -3.2, 3.2, 3.25, 3.45, 0, 3.2);
    for (const px of [-2.9, 2.9]) {
      B.geo('concrete', 'deco', new THREE.CylinderGeometry(0.15, 0.15, 3.25, 10), px, 1.62, 2.9);
      block(0, px - 0.2, px + 0.2, 2.7, 3.1);
    }
  }
  const hallNames = ['', '교무실', '도서실'];
  for (let k = 1; k < LEVELS; k++) {
    const L = levelY(k);
    if (k === 1) {
      for (const [x, z] of [[-2.2, -6], [2.2, -6], [-2.2, -3], [2.2, -3]]) {
        B.box('deskTop', 'deco', x - 1.4, x + 1.4, L + 0.72, L + 0.76, z - 0.7, z + 0.7);
        B.box('metal', 'deco', x - 1.3, x + 1.3, L, L + 0.72, z - 0.05, z + 0.05);
        block(k, x - 1.4, x + 1.4, z - 0.7, z + 0.7);
      }
    } else {
      for (const x1 of [hall.xs + 0.1, hall.xe - 0.5]) {
        B.box('shelf', 'deco', x1, x1 + 0.4, L, L + 2.2, -8.6, -0.6);
        for (let i = 0; i < 4; i++) B.box('books', 'deco', x1 + 0.02, x1 + 0.38, L + 0.2 + i * 0.52, L + 0.5 + i * 0.52, -8.5, -0.7);
        block(k, x1, x1 + 0.4, -8.6, -0.6);
      }
      for (const z of [-6.5, -2.5]) {
        B.box('deskTop', 'deco', -1.8, 1.8, L + 0.72, L + 0.76, z - 0.8, z + 0.8);
        B.box('metal', 'deco', -1.7, 1.7, L, L + 0.72, z - 0.05, z + 0.05);
        block(k, -1.8, 1.8, z - 0.8, z + 0.8);
      }
    }
    const sign = new THREE.Mesh(
      signGeo,
      new THREE.MeshBasicMaterial({ map: textTex(256, 92, '#f7f2e2', '#2b2b2b', [hallNames[k]], 50, '#7a5532'), side: THREE.DoubleSide }),
    );
    sign.position.set(0, L + 2.7, Z_CORR - 0.12);
    scene.add(sign);
    for (const lx of [-2.5, 2.5]) for (const lz of [-7, -2]) B.box('lamp', 'deco', lx - 0.6, lx + 0.6, L + 3.32, L + 3.38, lz - 0.08, lz + 0.08);
  }
  // 복도 형광등
  for (let k = 0; k < LEVELS; k++) for (let x = -BX + 4; x < BX - 3; x += 6) B.box('lamp', 'deco', x - 0.6, x + 0.6, levelY(k) + 3.32, levelY(k) + 3.38, -10.6, -10.44);

  // 가운데 시계탑 + 학교 이름
  const towerTop = levelY(LEVELS) + 3.2;
  B.box('cream', 'wall', -4.6, 4.6, 3.6, towerTop, Z_FRONT, Z_FRONT + 0.5);
  B.box('band', 'wall', -4.8, 4.8, towerTop, towerTop + 0.3, Z_FRONT - 0.2, Z_FRONT + 0.7);
  const nameSign = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.5), new THREE.MeshBasicMaterial({ map: textTex(1024, 200, '#efe4c8', '#5a3a26', ['온라인중학교'], 150) }));
  nameSign.position.set(0, levelY(1) + 1.8, Z_FRONT + 0.52);
  scene.add(nameSign);
  const clockC = document.createElement('canvas');
  clockC.width = clockC.height = 256;
  const clockT = new THREE.CanvasTexture(clockC);
  clockT.colorSpace = THREE.SRGBColorSpace;
  const drawClock = () => {
    const g = clockC.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#fbfaf4';
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(128, 128, 118, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#333';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 4, 8, 8);
    }
    const d = new Date();
    const hand = (a, len, w) => {
      g.lineWidth = w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      g.stroke();
    };
    hand((((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2, 55, 10);
    hand((d.getMinutes() / 60) * Math.PI * 2, 85, 6);
    clockT.needsUpdate = true;
  };
  drawClock();
  setInterval(drawClock, 30000);
  const clockMesh = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshBasicMaterial({ map: clockT, transparent: true }));
  clockMesh.position.set(0, levelY(LEVELS) + 1.4, Z_FRONT + 0.52);
  scene.add(clockMesh);

  // ── 운동장 ──
  // 화단 (건물 앞)
  for (const [x1, x2] of [[-BX + 2, -6], [6, BX - 2]]) {
    B.box('band', 'deco', x1, x2, 0, 0.35, 1, 2.6);
    for (let x = x1 + 1; x < x2; x += 2.2) B.geo('shrub', 'deco', new THREE.IcosahedronGeometry(0.6, 1), x, 0.7, 1.8);
    block(0, x1, x2, 1, 2.6);
  }
  // 조회대
  B.box('concrete', 'wall', -4, 4, 0, 1.2, 12, 15);
  for (let i = 0; i < 3; i++) B.box('concrete', 'deco', -1.5, 1.5, 0, 0.4 * (i + 1), 15 + (2 - i) * 0.4, 15 + (3 - i) * 0.4);
  B.box('metal', 'deco', -4, 4, 2.0, 2.05, 12.05, 12.1);
  block(0, -4, 4, 12, 16.2);
  // 국기 게양대 3개
  [-8, -9.6, -11.2].forEach((x, i) => {
    B.geo('pole', 'deco', new THREE.CylinderGeometry(0.05, 0.08, i === 1 ? 9 : 8, 8), x, i === 1 ? 4.5 : 4, 13.5);
    block(0, x - 0.2, x + 0.2, 13.3, 13.7);
  });
  const flagBig = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshStandardMaterial({ map: taegukTex, side: THREE.DoubleSide }));
  flagBig.position.set(-8.8, 8.3, 13.5);
  scene.add(flagBig);
  animated.push((t) => {
    flagBig.rotation.y = Math.sin(t * 1.3) * 0.15;
  });

  // 축구 골대
  for (const gx of [-43, 43]) {
    const back = gx > 0 ? 1.5 : -1.5;
    for (const pz of [37.35, 44.65]) {
      B.geo('white', 'deco', new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), gx, 1.22, pz);
      B.box('white', 'deco', gx, gx + back, 0, 0.06, pz - 0.03, pz + 0.03);
    }
    B.box('white', 'deco', gx - 0.06, gx + 0.06, 2.4, 2.5, 37.35, 44.65);
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(7.3, 2.44),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    );
    net.rotation.y = Math.PI / 2;
    net.position.set(gx + back, 1.22, 41);
    scene.add(net);
    block(0, Math.min(gx, gx + back) - 0.1, Math.max(gx, gx + back) + 0.1, 37.2, 44.8);
  }
  // 스탠드 (서쪽 계단식 관람석)
  for (let i = 0; i < 4; i++) B.box('concrete', 'wall', -50 - 2 * (i + 1), -50 - 2 * i, 0, 0.45 * (i + 1), 18, 64);
  block(0, -60, -50, 18, 64);
  // 철봉 (동쪽)
  [1.2, 1.5, 1.8].forEach((h, i) => {
    const z = 21 + i * 2.2;
    for (const pz of [z - 0.9, z + 0.9]) B.geo('metal', 'deco', new THREE.CylinderGeometry(0.05, 0.05, h, 8), 53, h / 2, pz);
    const bar = new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8);
    bar.rotateX(Math.PI / 2);
    B.geo('pole', 'deco', bar, 53, h, z);
    block(0, 52.8, 53.2, z - 1, z + 1);
  });
  // 정글짐
  {
    const gx = 54;
    const gz = 32;
    const cols = ['red', 'yellow', 'blue'];
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 3; b++) {
        B.geo(cols[(a + b) % 3], 'deco', new THREE.CylinderGeometry(0.04, 0.04, 3, 6), gx + a, 1.5, gz + b);
        const hx = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
        hx.rotateZ(Math.PI / 2);
        B.geo(cols[(a + b + 1) % 3], 'deco', hx, gx + 1.5, a, gz + b);
        const hz = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
        hz.rotateX(Math.PI / 2);
        B.geo(cols[(a + b + 2) % 3], 'deco', hz, gx + b, a, gz + 1.5);
      }
    }
    block(0, gx - 0.2, gx + 3.2, gz - 0.2, gz + 3.2);
  }
  // 그네
  {
    const gx = 54;
    const gz = 44;
    for (const pz of [gz - 2, gz + 2]) {
      for (const dx of [-0.7, 0.7]) {
        const p = new THREE.CylinderGeometry(0.06, 0.06, 2.7, 8);
        p.rotateZ(dx > 0 ? -0.25 : 0.25);
        B.geo('red', 'deco', p, gx + dx * 0.5, 1.3, pz);
      }
    }
    const top = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8);
    top.rotateX(Math.PI / 2);
    B.geo('red', 'deco', top, gx, 2.6, gz);
    for (const sz of [gz - 0.9, gz + 0.9]) {
      B.box('metal', 'deco', gx - 0.01, gx + 0.01, 0.5, 2.6, sz - 0.25, sz - 0.23);
      B.box('metal', 'deco', gx - 0.01, gx + 0.01, 0.5, 2.6, sz + 0.23, sz + 0.25);
      B.box('yellow', 'deco', gx - 0.2, gx + 0.2, 0.46, 0.52, sz - 0.27, sz + 0.27);
    }
    block(0, gx - 1.2, gx + 1.2, gz - 2.2, gz + 2.2);
  }
  // 벤치
  for (const [bx, bz] of [[-20, 9], [20, 9], [-32, 9], [32, 9]]) {
    B.box('chair', 'deco', bx - 1.1, bx + 1.1, 0.45, 0.5, bz - 0.3, bz + 0.3);
    B.box('metal', 'deco', bx - 1, bx - 0.9, 0, 0.45, bz - 0.25, bz + 0.25);
    B.box('metal', 'deco', bx + 0.9, bx + 1, 0, 0.45, bz - 0.25, bz + 0.25);
    block(0, bx - 1.1, bx + 1.1, bz - 0.3, bz + 0.3);
  }
  // ── 매점 (운동장 옆 작은 가건물, 파란 지붕) ──
  {
    const S = STORE;
    const H = 3.6;
    B.box('cream', 'wall', S.minX, S.maxX, 0, H, S.minZ, S.minZ + 0.2);
    B.box('cream', 'wall', S.minX, S.minX + 0.2, 0, H, S.minZ, S.maxZ);
    B.box('cream', 'wall', S.maxX - 0.2, S.maxX, 0, H, S.minZ, S.maxZ);
    block(0, S.minX, S.maxX, S.minZ, S.minZ + 0.2);
    block(0, S.minX, S.minX + 0.2, S.minZ, S.maxZ);
    block(0, S.maxX - 0.2, S.maxX, S.minZ, S.maxZ);
    // 앞벽 (가운데 문, 양옆 큰 유리창)
    const z1 = S.maxZ - 0.2;
    for (const [x1, x2] of [[S.minX, S.doorX1], [S.doorX2, S.maxX]]) {
      B.box('band', 'wall', x1, x2, 0, 0.9, z1, S.maxZ);
      B.box('glass', 'glass', x1, x2, 0.9, 2.3, z1 + 0.05, S.maxZ - 0.05);
      B.box('frame', 'deco', x1, x2, 2.3, 2.36, z1 - 0.02, S.maxZ + 0.02);
      B.box('cream', 'wall', x1, x2, 2.3, H, z1, S.maxZ);
      block(0, x1, x2, z1, S.maxZ);
    }
    B.box('cream', 'wall', S.doorX1, S.doorX2, 2.3, H, z1, S.maxZ);
    // 파란 지붕 (처마)
    B.box('blueRoof', 'wall', S.minX - 0.5, S.maxX + 0.5, H, H + 0.2, S.minZ - 0.4, S.maxZ + 1.2);
    // 바닥
    B.box('terrazzo', 'deco', S.minX + 0.2, S.maxX - 0.2, 0, 0.03, S.minZ + 0.2, z1);
    // 계산대 + 금전등록기
    B.box('lectern', 'deco', S.minX + 1.5, S.maxX - 1.5, 0, 1.0, 5.6, 6.2);
    B.box('white', 'deco', S.minX + 1.4, S.maxX - 1.4, 1.0, 1.05, 5.5, 6.3);
    B.box('tv', 'deco', 40.3, 40.9, 1.05, 1.35, 5.6, 6.0);
    block(0, S.minX, S.maxX, S.minZ, 6.2);
    // 뒤쪽 진열장 (계산대 너머)
    B.box('shelf', 'deco', S.minX + 0.5, S.maxX - 0.5, 0, 2.2, S.minZ + 0.2, S.minZ + 0.6);
    // 왼쪽 과자 진열대
    B.box('shelf', 'deco', S.minX + 0.2, S.minX + 0.7, 0, 2.0, 6.7, 11.5);
    block(0, S.minX + 0.2, S.minX + 0.7, 6.7, 11.5);
    const snackCols = ['red', 'yellow', 'blue', 'leaf2', 'ginkgo', 'books'];
    let ci = 0;
    for (let row = 0; row < 4; row++) {
      for (let z = 6.85; z < 11.2; z += 0.42) {
        const h = 0.22 + ((ci * 7) % 5) * 0.03;
        const y = 0.15 + row * 0.48;
        B.box(snackCols[ci++ % snackCols.length], 'deco', S.minX + 0.25, S.minX + 0.62, y, y + h, z, z + 0.32);
        // 뒤쪽 진열장에도
        const bx = S.minX + 0.8 + ((z - 6.85) / 0.42) * 0.85;
        B.box(snackCols[(ci + 2) % snackCols.length], 'deco', bx, bx + 0.9, y, y + h, S.minZ + 0.25, S.minZ + 0.55);
      }
    }
    // 아이스크림 냉동고
    B.box('white', 'deco', S.maxX - 1.6, S.maxX - 0.25, 0, 0.9, 7, 9.6);
    B.box('glass', 'glass', S.maxX - 1.55, S.maxX - 0.3, 0.9, 0.95, 7.05, 9.55);
    block(0, S.maxX - 1.6, S.maxX - 0.25, 7, 9.6);
    const storeSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.6),
      new THREE.MeshBasicMaterial({ map: textTex(400, 100, '#2f5aa8', '#ffffff', ['매  점'], 64) }),
    );
    storeSign.position.set((S.doorX1 + S.doorX2) / 2, 2.95, S.maxZ + 0.03);
    scene.add(storeSign);
  }

  // 점수판 (운동장 동쪽 끝, 축구 점수 표시)
  const scoreC = document.createElement('canvas');
  scoreC.width = 512;
  scoreC.height = 200;
  const scoreT = new THREE.CanvasTexture(scoreC);
  scoreT.colorSpace = THREE.SRGBColorSpace;
  const drawScore = (blue, white) => {
    const g = scoreC.getContext('2d');
    g.fillStyle = '#1f2a24';
    g.fillRect(0, 0, 512, 200);
    g.font = `700 44px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#7fb4ff';
    g.fillText('청팀', 128, 50);
    g.fillStyle = '#ffffff';
    g.fillText('백팀', 384, 50);
    g.font = `700 100px ${FONT}`;
    g.fillStyle = '#ffd34d';
    g.fillText(String(blue), 128, 135);
    g.fillText(String(white), 384, 135);
    g.fillText(':', 256, 130);
    scoreT.needsUpdate = true;
  };
  drawScore(0, 0);
  const scoreBoard = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.56), new THREE.MeshBasicMaterial({ map: scoreT }));
  scoreBoard.position.set(0, 3.2, 67.6);
  scoreBoard.rotation.y = Math.PI;
  scene.add(scoreBoard);
  for (const px of [-1.8, 1.8]) {
    B.geo('metal', 'deco', new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), px, 1.25, 67.7);
    block(0, px - 0.2, px + 0.2, 67.5, 67.9);
  }

  // 나무 (플라타너스 + 노란 은행나무)
  const tree = (x, z, i) => {
    const s = 0.9 + ((i * 37) % 10) / 18;
    B.geo('trunk', 'deco', new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 2.6 * s, 8), x, 1.3 * s, z);
    const leaf = i % 3 === 0 ? 'ginkgo' : i % 2 ? 'leaf1' : 'leaf2';
    B.geo(leaf, 'deco', new THREE.IcosahedronGeometry(1.8 * s, 1), x, 3.3 * s, z);
    B.geo(leaf, 'deco', new THREE.IcosahedronGeometry(1.3 * s, 1), x + 0.6 * s, 4.3 * s, z - 0.4 * s);
    block(0, x - 0.45, x + 0.45, z - 0.45, z + 0.45);
  };
  let ti = 0;
  for (let x = -64; x <= 64; x += 8) if (Math.abs(x) > 8) tree(x, 69.5, ti++);
  for (let z = 6; z <= 64; z += 8) {
    tree(-66, z, ti++);
    tree(66, z, ti++);
  }
  // 담장 + 정문
  const wallSeg = (x1, x2, z1, z2) => {
    B.box('cream', 'deco', x1, x2, 0, 0.9, z1, z2);
    const thinX = x2 - x1 < 1;
    if (thinX) B.box('fence', 'deco', (x1 + x2) / 2 - 0.02, (x1 + x2) / 2 + 0.02, 0.9, 2.0, z1, z2);
    else B.box('fence', 'deco', x1, x2, 0.9, 2.0, (z1 + z2) / 2 - 0.02, (z1 + z2) / 2 + 0.02);
  };
  wallSeg(-69.5, -5.5, 73, 73.4);
  wallSeg(5.5, 69.5, 73, 73.4);
  wallSeg(-69.5, -69.1, -16, 73.4);
  wallSeg(69.1, 69.5, -16, 73.4);
  wallSeg(-69.5, 69.5, -16.4, -16);
  for (const gx of [-5.5, 5.5]) B.box('band', 'deco', gx - 0.5, gx + 0.5, 0, 2.8, 72.7, 73.7);
  const gateSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 2),
    new THREE.MeshBasicMaterial({ map: textTex(128, 320, '#f0ead8', '#2b2b2b', ['온', '라', '인', '중', '학', '교'], 44) }),
  );
  gateSign.position.set(-5.5, 1.5, 72.68);
  gateSign.rotation.y = Math.PI;
  scene.add(gateSign);

  const built = B.build(scene, mats);
  walkables.push(...built.floor);

  // ── 높이: 지금 높이(curY)와 가장 가까운 바닥/계단 면 ──
  function heightAt(x, z, curY = 0) {
    if (x < -BX || x > BX || z < Z_BACK || z > Z_FRONT) return 0;
    const st = STAIRS.find((s) => x >= s.xs && x <= s.xe);
    const cands = [];
    if (st && z > Z_CORR) {
      for (let k = 0; k < LEVELS - 1; k++) {
        const L = levelY(k);
        if (z >= FLIGHT_END) cands.push(L + 1.8);
        else if (x < st.mid) cands.push(L + (1.8 * (z - Z_CORR)) / (FLIGHT_END - Z_CORR));
        else cands.push(L + 1.8 + (1.8 * (FLIGHT_END - z)) / (FLIGHT_END - Z_CORR));
      }
    } else {
      for (let k = 0; k < LEVELS; k++) cands.push(levelY(k));
    }
    let best = cands[0];
    for (const c of cands) if (Math.abs(c - curY) < Math.abs(best - curY)) best = c;
    return best;
  }

  return {
    walkables,
    occluders: [...built.wall, ...built.floor, ...built.glass],
    tapBlockers: built.wall,
    chairMeshes: built.chair,
    chairs,
    blocks,
    heightAt,
    sun,
    drawScore,
    update(t) {
      animated.forEach((f) => f(t));
    },
  };
}
