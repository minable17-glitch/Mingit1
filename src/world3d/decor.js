// 내 화단 꾸미기 소품 14종 — GPT 시안(정원 소품 시안 14종·제작 표)을 기본 도형으로 조립
// 단위: m(캐릭터 키 1.0). 소품 기준점은 바닥 가운데, 앞면 = +z
// 정원 전체 소품을 색깔별로 한 덩어리씩 합쳐 그려서(그리기 횟수 ≈ 색 수) 소품이 많아도 느려지지 않음
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DECOR = [
  { id: 'prop_wood_chair', name: '작은 나무 의자', tier: 0 },
  { id: 'prop_mushroom_stool', name: '버섯 의자', tier: 0 },
  { id: 'prop_name_sign', name: '이름 팻말', tier: 0 },
  { id: 'prop_stepping_stones', name: '돌멩이 디딤돌', tier: 0 },
  { id: 'prop_flower_pot', name: '작은 꽃 화분', tier: 0 },
  { id: 'prop_lantern', name: '랜턴', tier: 1 },
  { id: 'prop_birdhouse_pole', name: '새집 기둥', tier: 1 },
  { id: 'prop_low_fence', name: '낮은 나무 울타리', tier: 0 },
  { id: 'prop_bunny_doll', name: '토끼 인형', tier: 2 },
  { id: 'prop_watering_can', name: '물뿌리개', tier: 0 },
  { id: 'prop_book_stack', name: '작은 책 더미', tier: 0 },
  { id: 'prop_butterfly_light', name: '나비 정원등', tier: 1 },
  { id: 'prop_rainbow_pinwheel', name: '무지개 바람개비', tier: 1 },
  { id: 'prop_firefly_jar', name: '반딧불 병', tier: 2 },
];
export const TIER_NAMES = ['기본', '조금 귀함', '귀함'];
export const decorInfo = (id) => DECOR.find((d) => d.id === id) || null;
export const cleanPlaced = (arr) => [0, 1, 2].map((i) => { const v = Array.isArray(arr) ? arr[i] : null; return decorInfo(v) ? v : null; });

const deg = THREE.MathUtils.degToRad;
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(1, 14, 10), cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  half: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), rbox: new RoundedBoxGeometry(1, 1, 1, 2, 0.18),
};
const torus = (r, t, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 8, 20, arc);
const cone = (rt, rb, seg = 16) => new THREE.CylinderGeometry(rt, rb, 1, seg);

const PARTS = new Map();
// 소품 하나의 부품 목록: { color, geo, m(행렬), kind: 's'(보통) | 'glow'(빛나는 부분) | 'glass'(유리) }
export function decorParts(id) {
  if (PARTS.has(id)) return PARTS.get(id);
  const out = [];
  const P = (color, geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, kind = 's') => out.push({ color, geo, kind,
    m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const tufts = (pts) => { for (const [x, z] of pts) { P('#8DCB6A', G.ball, x, 0.012, z, 0.03, 0.022, 0.026); P('#7DBB5C', G.ball, x + 0.02, 0.01, z + 0.006, 0.022, 0.018, 0.02); } };
  const W = '#E8A15B', WD = '#D07A3E';
  switch (id) {
    case 'prop_wood_chair':
      P(W, G.rbox, 0, 0.13, 0.01, 0.3, 0.035, 0.14);                                         // 앉는 판
      P(W, G.rbox, 0, 0.245, -0.06, 0.3, 0.085, 0.03);                                       // 등받이
      for (const s of [-1, 1]) { P(WD, G.box, s * 0.12, 0.19, -0.06, 0.032, 0.12, 0.028); for (const z of [-0.045, 0.06]) P(WD, G.box, s * 0.12, 0.06, z, 0.034, 0.12, 0.034); }
      tufts([[-0.17, 0.07], [0.16, 0.06]]); break;
    case 'prop_mushroom_stool':
      P('#FFE7C2', cone(0.06, 0.075), 0, 0.055, 0, 1, 0.11, 1);                              // 기둥
      P('#FF7F7A', G.half, 0, 0.105, 0, 0.15, 0.11, 0.15);                                   // 갓
      P('#FFE7C2', G.cyl, 0, 0.106, 0, 0.14, 0.008, 0.14);                                   // 갓 아래
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.4; P('#FFE7C2', G.ball, Math.cos(a) * 0.095, 0.178, Math.sin(a) * 0.095, 0.024, 0.012, 0.024, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
      P('#FFE7C2', G.ball, 0, 0.214, 0, 0.026, 0.01, 0.026);
      tufts([[-0.1, 0.06], [0.09, 0.07]]); break;
    case 'prop_name_sign':
      P(WD, G.cyl, 0, 0.1, 0, 0.018, 0.2, 0.018);                                            // 기둥
      P(WD, G.rbox, 0, 0.235, 0, 0.23, 0.13, 0.032);                                          // 판 테두리
      P('#FFE5C4', G.rbox, 0, 0.235, 0.012, 0.19, 0.09, 0.014);                              // 판
      P('#8DCB6A', G.cyl, 0, 0.315, 0, 0.006, 0.04, 0.006);                                  // 새싹
      for (const s of [-1, 1]) P('#8DCB6A', G.ball, s * 0.022, 0.338, 0, 0.03, 0.012, 0.018, 0, 0, s * deg(25));
      tufts([[-0.07, 0.04], [0.06, 0.05]]); break;
    case 'prop_stepping_stones':
      P('#D8C1B6', G.cyl, -0.09, 0.012, 0.04, 0.075, 0.025, 0.065);
      P('#E7D8CD', G.cyl, 0.04, 0.014, -0.05, 0.1, 0.028, 0.085);
      P('#D8C1B6', G.cyl, 0.11, 0.011, 0.08, 0.06, 0.022, 0.052);
      tufts([[-0.02, 0.1]]); break;
    case 'prop_flower_pot':
      P(W, cone(0.07, 0.05), 0, 0.04, 0, 1, 0.08, 1);                                         // 화분
      P(WD, torus(0.068, 0.012), 0, 0.08, 0, 1, 1, 1, Math.PI / 2);                          // 테두리
      P('#B9814F', G.cyl, 0, 0.082, 0, 0.06, 0.01, 0.06);
      for (const [x, z] of [[-0.05, 0.02], [0.05, -0.01], [0, -0.05], [0.02, 0.05]]) P('#8DCB6A', G.ball, x, 0.1, z, 0.04, 0.02, 0.03, 0, Math.atan2(x, z));
      for (const [x, y, z, c] of [[0, 0.135, 0, '#FF7FA8'], [-0.045, 0.118, 0.025, '#FFF4E8'], [0.045, 0.12, -0.01, '#FF7FA8'], [0.005, 0.112, 0.048, '#FFB3CC']]) {
        P(c, G.ball, x, y + 0.01, z, 0.038, 0.028, 0.038); P('#FFE37A', G.ball, x, y + 0.03, z + 0.006, 0.013, 0.009, 0.013);
      }
      tufts([[-0.08, 0.05]]); break;
    case 'prop_lantern':
      P('#B97A56', G.rbox, 0, 0.014, 0, 0.12, 0.028, 0.12);                                  // 받침
      P('#FFF6B6', G.box, 0, 0.078, 0, 0.082, 0.1, 0.082, 0, 0, 0, 'glow');                  // 빛나는 유리
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P('#B97A56', G.box, x * 0.045, 0.078, z * 0.045, 0.016, 0.104, 0.016);
      P('#B97A56', cone(0.02, 0.088, 4), 0, 0.152, 0, 1, 0.05, 1, 0, Math.PI / 4);           // 지붕
      P('#B97A56', G.ball, 0, 0.18, 0, 0.016, 0.016, 0.016);
      P('#B97A56', torus(0.022, 0.006), 0, 0.2, 0, 1, 1, 1);                                  // 고리
      tufts([[-0.08, 0.06], [0.08, 0.05]]); break;
    case 'prop_birdhouse_pole':
      P(WD, G.cyl, 0, 0.11, 0, 0.016, 0.22, 0.016);                                          // 기둥
      P('#FFD6A8', G.rbox, 0, 0.27, 0, 0.11, 0.1, 0.1);                                       // 집
      for (const s of [-1, 1]) P('#F5888B', G.rbox, s * 0.032, 0.34, 0, 0.085, 0.016, 0.125, 0, 0, s * deg(-38));
      P('#7A4A30', G.cyl, 0, 0.28, 0.051, 0.021, 0.008, 0.021, Math.PI / 2);                 // 구멍
      P(WD, G.cyl, 0, 0.245, 0.06, 0.004, 0.035, 0.004, Math.PI / 2);                        // 횃대
      P('#FFF3A1', G.ball, 0.01, 0.372, 0.01, 0.026, 0.022, 0.032);                          // 작은 새
      P('#FFF3A1', G.ball, 0.01, 0.395, 0.03, 0.017, 0.017, 0.017);
      P('#F5A623', cone(0, 0.006, 6), 0.01, 0.395, 0.05, 1, 0.014, 1, Math.PI / 2);
      tufts([[-0.06, 0.04], [0.06, 0.05]]); break;
    case 'prop_low_fence':
      for (const x of [-0.13, 0, 0.13]) P(W, G.rbox, x, 0.075, 0, 0.045, 0.15, 0.04);
      for (const y of [0.055, 0.105]) P(WD, G.box, 0, y, 0.022, 0.3, 0.024, 0.014);
      tufts([[-0.17, 0.05], [0.07, 0.06], [0.17, 0.04]]); break;
    case 'prop_bunny_doll':
      P('#FFF1E6', G.ball, 0, 0.06, 0, 0.068, 0.062, 0.058);                                  // 몸
      for (const s of [-1, 1]) P('#FFF1E6', G.ball, s * 0.042, 0.018, 0.04, 0.026, 0.018, 0.03);   // 발
      P('#FFF1E6', G.ball, 0, 0.155, 0.005, 0.062, 0.056, 0.055);                             // 머리
      for (const s of [-1, 1]) {
        P('#FFF1E6', G.ball, s * 0.026, 0.235, -0.005, 0.019, 0.052, 0.013, 0, 0, s * deg(-10));
        P('#FFB8C1', G.ball, s * 0.026, 0.235, 0.005, 0.01, 0.036, 0.006, 0, 0, s * deg(-10));
        P('#4A2B1B', G.ball, s * 0.02, 0.162, 0.052, 0.008, 0.009, 0.005);                   // 눈
        P('#FFB8C1', G.ball, s * 0.034, 0.145, 0.047, 0.011, 0.007, 0.004);                  // 볼
      }
      P('#FF9EBB', G.box, 0, 0.075, 0.06, 0.075, 0.055, 0.012, deg(-40));                    // 책
      P('#FFF8E8', G.box, 0, 0.078, 0.066, 0.066, 0.046, 0.008, deg(-40));
      tufts([[-0.08, 0.05]]); break;
    case 'prop_watering_can':
      P('#7DC8E8', G.cyl, 0, 0.045, 0, 0.06, 0.085, 0.055);                                  // 통
      P('#6AB4D6', torus(0.058, 0.008), 0, 0.088, 0, 1, 0.92, 1, Math.PI / 2);
      P('#7DC8E8', cone(0.008, 0.013), 0.085, 0.07, 0, 1, 0.1, 1, 0, 0, deg(-55));          // 주둥이
      P('#9ED6FF', G.cyl, 0.125, 0.1, 0, 0.022, 0.014, 0.022, 0, 0, deg(-55));
      P('#6AB4D6', torus(0.04, 0.008, Math.PI), -0.03, 0.09, 0, 1, 1, 1, 0, 0, deg(10));    // 손잡이
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P('#FFFFFF', G.ball, Math.cos(a) * 0.012, 0.045 + Math.sin(a) * 0.012, 0.056, 0.01, 0.01, 0.004); }
      P('#FFE37A', G.ball, 0, 0.045, 0.059, 0.007, 0.007, 0.004);
      tufts([[-0.08, 0.05]]); break;
    case 'prop_book_stack':
      P('#9ED6FF', G.rbox, 0, 0.022, 0, 0.15, 0.044, 0.105);                                  // 아래 책 표지
      P('#FFF4E0', G.box, 0.006, 0.022, 0.004, 0.142, 0.032, 0.1);                            // 종이
      P('#FF9EBB', G.rbox, 0.005, 0.064, -0.004, 0.138, 0.04, 0.098, 0, deg(10));            // 위 책
      P('#FFF4E0', G.box, 0.011, 0.064, 0, 0.13, 0.028, 0.092, 0, deg(10));
      P('#FFE7A8', G.box, 0.02, 0.05, 0.052, 0.014, 0.04, 0.004, 0, deg(10));               // 책갈피
      tufts([[-0.09, 0.06]]); break;
    case 'prop_butterfly_light':
      P(WD, G.cyl, 0, 0.008, 0, 0.032, 0.016, 0.032); P(WD, G.cyl, 0, 0.09, 0, 0.011, 0.17, 0.011);
      for (const s of [-1, 1]) {
        P('#FF9FD8', G.ball, s * 0.047, 0.212, -0.004, 0.06, 0.05, 0.008, 0, 0, s * deg(-15));    // 큰 날개 테두리
        P('#FFE87A', G.ball, s * 0.046, 0.212, 0.002, 0.048, 0.04, 0.008, 0, 0, s * deg(-15), 'glow');
        P('#FF9FD8', G.ball, s * 0.034, 0.172, -0.004, 0.038, 0.032, 0.008, 0, 0, s * deg(20));
        P('#FFE87A', G.ball, s * 0.033, 0.172, 0.002, 0.029, 0.024, 0.008, 0, 0, s * deg(20), 'glow');
        P(WD, G.cyl, s * 0.012, 0.262, 0, 0.003, 0.045, 0.003, 0, 0, s * deg(-22));
        P(WD, G.ball, s * 0.02, 0.284, 0, 0.007, 0.007, 0.007);
      }
      P(WD, G.cyl, 0, 0.2, 0.004, 0.009, 0.075, 0.009);
      tufts([[-0.05, 0.03], [0.05, 0.035]]); break;
    case 'prop_rainbow_pinwheel': {
      P(WD, G.cyl, 0, 0.13, 0, 0.012, 0.26, 0.012);
      const cols = ['#FF7AA2', '#FFA06B', '#FFD663', '#9AE47D', '#7DD7FF', '#B79CFF'];
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P(cols[k], G.ball, Math.sin(a) * 0.045, 0.28 + Math.cos(a) * 0.045, 0.02, 0.026, 0.055, 0.008, 0, 0, -a + deg(25)); }
      P('#FFFFFF', G.ball, 0, 0.28, 0.03, 0.016, 0.016, 0.012);
      tufts([[-0.05, 0.03], [0.05, 0.04]]); break; }
    case 'prop_firefly_jar':
      P('#CFE8FF', G.cyl, 0, 0.05, 0, 0.056, 0.095, 0.056, 0, 0, 0, 'glass');                 // 유리병
      P(W, G.cyl, 0, 0.108, 0, 0.05, 0.025, 0.05);                                            // 뚜껑
      P('#FFE9A6', torus(0.052, 0.006), 0, 0.094, 0, 1, 1, 1, Math.PI / 2);                   // 끈
      for (const s of [-1, 1]) P('#FFE9A6', G.ball, s * 0.016, 0.094, 0.055, 0.016, 0.01, 0.006, 0, 0, s * deg(20));
      for (const [x, y, z] of [[-0.02, 0.035, 0.01], [0.022, 0.06, -0.012], [0.004, 0.08, 0.018]]) P('#FFF176', G.ball, x, y, z, 0.013, 0.013, 0.013, 0, 0, 0, 'glow');
      tufts([[-0.08, 0.04], [0.07, 0.05]]); break;
    default: break;
  }
  PARTS.set(id, out);
  return out;
}

const MATS = new Map();
function matFor(key) {
  if (MATS.has(key)) return MATS.get(key);
  const [kind, color] = key.split('|');
  const m = kind === 'glow' ? new THREE.MeshBasicMaterial({ color })
    : kind === 'glass' ? new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.45, depthWrite: false })
    : new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  MATS.set(key, m); return m;
}
// 놓을 소품들: [{ id, x, z, ry, s }] → 색깔별로 합친 메쉬 묶음
export function buildDecor(items) {
  const bins = new Map(), m4 = new THREE.Matrix4(), place = new THREE.Matrix4();
  for (const it of items) {
    place.compose(new THREE.Vector3(it.x, it.y || 0, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, it.ry || 0, 0)), new THREE.Vector3(it.s || 1, it.s || 1, it.s || 1));
    for (const p of decorParts(it.id)) {
      const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone()).applyMatrix4(m4.multiplyMatrices(place, p.m));
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      const key = p.kind + '|' + p.color;
      if (!bins.has(key)) bins.set(key, []); bins.get(key).push(g);
    }
  }
  const group = new THREE.Group();
  for (const [key, geos] of bins) { const mesh = new THREE.Mesh(mergeGeometries(geos, false), matFor(key)); if (key.startsWith('glass')) mesh.renderOrder = 3; group.add(mesh); }
  for (const geos of bins.values()) geos.forEach((g) => g.dispose());
  return group;
}
export function disposeDecor(group) { if (group) group.traverse((o) => o.geometry?.dispose?.()); }

// 고르는 창에 쓰는 작은 그림(한 번 그리면 기억)
const THUMBS = new Map();
let thumbR = null;
export function decorThumb(id) {
  if (THUMBS.has(id)) return THUMBS.get(id);
  try {
    if (!thumbR) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight('#FFF1DC', 0.7)); scene.add(new THREE.HemisphereLight('#FFF9EA', '#E6DBA0', 1.3));
      const sun = new THREE.DirectionalLight('#FFE2A8', 1.3); sun.position.set(-2, 4, 3); scene.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
      thumbR = { renderer, scene, cam };
    }
    const { renderer, scene, cam } = thumbR;
    const g = buildDecor([{ id, x: 0, z: 0, ry: deg(-28) }]); scene.add(g);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.62 + 0.02, dist = r / Math.tan(deg(15));
    cam.position.set(c.x, c.y + dist * 0.42, c.z + dist * 0.92); cam.lookAt(c);
    renderer.setClearColor(0x000000, 0); renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/png');
    scene.remove(g); disposeDecor(g); THUMBS.set(id, url); return url;
  } catch { return ''; }
}
