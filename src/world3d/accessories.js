// 나무 꾸미기 악세서리 18종 — GPT "나무 꾸미기 악세서리 18종·제작 표" 시안을 기본 도형으로 조립(이모지 그림 대신)
// 단위: m, 기준점 = 악세서리 가운데, 앞면 = +z. 다 자란 나무 기준 지름 약 0.11~0.14
import * as THREE from 'three';

export const ACC = [
  { key: 'apple', name: '사과', tier: 0 }, { key: 'ribbon', name: '리본', tier: 1 }, { key: 'star', name: '별', tier: 1 },
  { key: 'butterfly', name: '나비', tier: 0 }, { key: 'maple', name: '단풍잎', tier: 1 }, { key: 'crown', name: '왕관', tier: 2 },
  { key: 'balloon', name: '풍선', tier: 1 }, { key: 'rainbow', name: '무지개', tier: 2 }, { key: 'bell', name: '방울', tier: 0 },
  { key: 'heart', name: '하트', tier: 0 }, { key: 'sun', name: '햇님', tier: 1 }, { key: 'moon', name: '달님', tier: 1 },
  { key: 'snowflake', name: '눈꽃', tier: 2 }, { key: 'blossom', name: '벚꽃', tier: 0 }, { key: 'ladybug', name: '무당벌레', tier: 1 },
  { key: 'clover', name: '클로버', tier: 0 }, { key: 'acorn', name: '도토리', tier: 1 }, { key: 'bird', name: '작은 새', tier: 2 },
];
export const isAcc = (key) => ACC.some((a) => a.key === key);

const deg = THREE.MathUtils.degToRad;
const G = { ball: new THREE.SphereGeometry(1, 14, 10), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2) };
const cone = (rt, rb, seg = 12) => new THREE.CylinderGeometry(rt, rb, 1, seg);
const torus = (r, t, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 8, 24, arc);
const EYE = '#4A2B1B', CHEEK = '#FF9FB0';

export function accParts(key) {
  const out = [];
  const P = (color, geo, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, kind = 's') => out.push({ color, geo, kind,
    m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)) });
  const face = (y, z, s = 1) => { for (const sd of [-1, 1]) { P(EYE, G.ball, sd * 0.012 * s, y + 0.004 * s, z, 0.0045 * s, 0.0055 * s, 0.003); P(CHEEK, G.ball, sd * 0.02 * s, y - 0.006 * s, z - 0.001, 0.007 * s, 0.0045 * s, 0.002); } };
  switch (key) {
    case 'apple':
      P('#F2726B', G.ball, 0, 0, 0, 0.05, 0.046, 0.05); P('#FF9A93', G.ball, -0.018, 0.016, 0.034, 0.012, 0.01, 0.006);
      P('#8A5A3A', G.cyl, 0, 0.052, 0, 0.005, 0.022, 0.005); P('#7ED957', G.ball, 0.016, 0.058, 0, 0.022, 0.008, 0.012, 0, 0, deg(-30)); break;
    case 'ribbon':
      for (const s of [-1, 1]) { P('#FF9FB0', G.ball, s * 0.034, 0.006, 0, 0.034, 0.024, 0.014, 0, 0, s * deg(-18)); P('#FF9FB0', G.ball, s * 0.016, -0.03, 0, 0.011, 0.03, 0.006, 0, 0, s * deg(-22)); }
      P('#F78CA0', G.ball, 0, 0.003, 0.005, 0.016, 0.016, 0.012); break;
    case 'star':
      P('#FFE073', G.ball, 0, 0, 0, 0.032, 0.032, 0.02);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P('#FFD34D', cone(0.003, 0.022, 10), Math.sin(a) * 0.035, Math.cos(a) * 0.035, 0, 1, 0.04, 0.8, 0, 0, -a); } break;
    case 'butterfly':
      for (const s of [-1, 1]) {
        P('#FF9FB0', G.ball, s * 0.032, 0.014, -0.003, 0.034, 0.028, 0.007, 0, 0, s * deg(-15)); P('#FFD87A', G.ball, s * 0.031, 0.014, 0.002, 0.026, 0.021, 0.007, 0, 0, s * deg(-15));
        P('#FF9FB0', G.ball, s * 0.024, -0.017, -0.003, 0.022, 0.018, 0.007, 0, 0, s * deg(20)); P('#FFD87A', G.ball, s * 0.023, -0.017, 0.002, 0.016, 0.013, 0.007, 0, 0, s * deg(20));
        P('#9D6B4A', G.cyl, s * 0.008, 0.04, 0, 0.002, 0.03, 0.002, 0, 0, s * deg(-22)); P('#9D6B4A', G.ball, s * 0.013, 0.054, 0, 0.005, 0.005, 0.005);
      }
      P('#9D6B4A', G.cyl, 0, 0, 0.004, 0.006, 0.05, 0.006); break;
    case 'maple':
      for (const a of [-80, -40, 0, 40, 80]) { const r = deg(a), l = a === 0 ? 0.034 : Math.abs(a) === 40 ? 0.03 : 0.022; P('#FF8E6A', G.ball, Math.sin(r) * l, Math.cos(r) * l, 0, 0.016, 0.024, 0.007, 0, 0, -r); }
      P('#FF8E6A', G.ball, 0, 0.006, 0, 0.026, 0.024, 0.008); P('#F4A34B', G.cyl, 0, -0.03, 0.002, 0.003, 0.03, 0.003); break;
    case 'crown':
      P('#FFD55E', G.cyl, 0, -0.012, 0, 0.045, 0.026, 0.038);
      for (const [x, h] of [[-0.03, 0.03], [0, 0.038], [0.03, 0.03]]) { P('#FFD55E', cone(0.003, 0.014, 8), x, -0.001 + h / 2, 0.026, 1, h, 0.8); P('#FFF7C8', G.ball, x, h, 0.026, 0.008, 0.008, 0.008); }
      P('#FF8FB1', G.ball, 0, -0.012, 0.038, 0.01, 0.01, 0.005); break;
    case 'balloon':
      for (const [x, y, c] of [[-0.02, 0.022, '#FFD55E'], [0.005, 0.038, '#FF9FB0'], [0.026, 0.018, '#7CD2F6']]) { P(c, G.ball, x, y, 0, 0.02, 0.024, 0.02); P('#C9C0B5', G.cyl, x * 0.5, (y - 0.03) / 2 - 0.012, 0, 0.0012, Math.max(0.01, y + 0.012), 0.0012, 0, 0, Math.atan2(x, y + 0.03) * 0.8); }
      for (const s of [-1, 1]) P('#FF9FB0', G.ball, s * 0.008, -0.03, 0.004, 0.009, 0.006, 0.004, 0, 0, s * deg(-20)); break;
    case 'rainbow':
      for (const [r, c] of [[0.045, '#FF8BB3'], [0.036, '#FFD86A'], [0.027, '#7FD6FF']]) P(c, torus(r, 0.0055, Math.PI), 0, -0.012, 0, 1, 1, 1.4);
      for (const s of [-1, 1]) { P('#FFF8E8', G.ball, s * 0.038, -0.014, 0.006, 0.016, 0.012, 0.012); P('#FFF8E8', G.ball, s * 0.026, -0.018, 0.009, 0.011, 0.009, 0.01); } break;
    case 'bell':
      P('#FFD55E', cone(0.018, 0.036, 16), 0, -0.006, 0, 1, 0.04, 1); P('#FFD55E', G.ball, 0, 0.014, 0, 0.019, 0.014, 0.019);
      P('#F2C24A', torus(0.035, 0.005), 0, -0.026, 0, 1, 1, 1, Math.PI / 2); P('#C68B5B', G.ball, 0, -0.032, 0.006, 0.008, 0.008, 0.008);
      for (const s of [-1, 1]) P('#FF9FB0', G.ball, s * 0.014, 0.032, 0.008, 0.013, 0.009, 0.005, 0, 0, s * deg(-15));
      P('#C68B5B', torus(0.008, 0.002), 0, 0.042, 0); break;
    case 'heart':
      for (const s of [-1, 1]) P('#FF8FA8', G.ball, s * 0.02, 0.01, 0, 0.026, 0.026, 0.018);
      P('#FF8FA8', cone(0.042, 0.002, 16), 0, -0.018, 0, 1, 0.04, 0.42); P('#FFB8C6', G.ball, -0.016, 0.02, 0.016, 0.008, 0.006, 0.003); break;
    case 'sun':
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P('#FFA94D', cone(0.002, 0.012, 8), Math.sin(a) * 0.04, Math.cos(a) * 0.04, -0.002, 1, 0.02, 0.6, 0, 0, -a); }
      P('#FFD55E', G.ball, 0, 0, 0, 0.034, 0.034, 0.022); face(0.002, 0.021, 1.1); break;
    case 'moon':
      P('#FFE073', torus(0.026, 0.014, Math.PI * 1.15), 0, 0, 0, 1, 1, 0.8, 0, 0, deg(110));
      P(EYE, torus(0.005, 0.0015, Math.PI), -0.018, 0.004, 0.012, 1, 1, 1, 0, 0, Math.PI); P(CHEEK, G.ball, -0.022, -0.006, 0.011, 0.006, 0.004, 0.002); break;
    case 'snowflake':
      P('#8FD3F4', G.ball, 0, 0, 0, 0.012, 0.012, 0.008);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P('#8FD3F4', G.cyl, Math.sin(a) * 0.022, Math.cos(a) * 0.022, 0, 0.0045, 0.04, 0.0045, 0, 0, -a); P('#CFEFFF', G.ball, Math.sin(a) * 0.044, Math.cos(a) * 0.044, 0, 0.008, 0.008, 0.006);
        for (const s of [-1, 1]) P('#BDE8FB', G.cyl, Math.sin(a) * 0.03 + Math.sin(a + s * 1.2) * 0.006, Math.cos(a) * 0.03 + Math.cos(a + s * 1.2) * 0.006, 0, 0.003, 0.014, 0.003, 0, 0, -(a + s * 0.9)); } break;
    case 'blossom':
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P('#FFB1C8', G.ball, Math.sin(a) * 0.022, Math.cos(a) * 0.022, 0, 0.018, 0.022, 0.007, 0, 0, -a); }
      P('#FFF6C9', G.ball, 0, 0, 0.004, 0.011, 0.011, 0.006);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.6; P('#FFD86A', G.ball, Math.sin(a) * 0.01, Math.cos(a) * 0.01, 0.009, 0.003, 0.003, 0.003); } break;
    case 'ladybug':   // 위에서 내려다보는 모습을 앞으로 세움: 빨간 등 + 위쪽 검은 머리 + 등의 점
      P('#FF8B86', G.ball, 0, -0.006, 0, 0.034, 0.036, 0.022); P('#4A3B3A', G.cyl, 0, -0.006, 0.021, 0.0016, 0.064, 0.0016);
      P('#4A3B3A', G.ball, 0, 0.03, 0.004, 0.017, 0.012, 0.015);
      for (const [x, y] of [[-0.016, 0.006], [0.016, 0.006], [-0.02, -0.018], [0.02, -0.018], [0, -0.03]]) P('#2F2F2F', G.ball, x, y, 0.02, 0.0065, 0.0065, 0.004);
      for (const sd of [-1, 1]) { P('#4A3B3A', G.cyl, sd * 0.008, 0.045, 0.004, 0.0015, 0.016, 0.0015, 0, 0, sd * deg(-28)); P('#4A3B3A', G.ball, sd * 0.012, 0.053, 0.004, 0.0035, 0.0035, 0.0035); }
      P('#FFFFFF', G.ball, -0.007, 0.033, 0.017, 0.003, 0.003, 0.002); P('#FFFFFF', G.ball, 0.007, 0.033, 0.017, 0.003, 0.003, 0.002); break;
    case 'clover':
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        for (const s of [-1, 1]) P(k % 2 ? '#8ED957' : '#7FCB4C', G.ball, Math.sin(a) * 0.02 + Math.cos(a) * s * 0.008, Math.cos(a) * 0.02 - Math.sin(a) * s * 0.008 + 0.006, 0, 0.012, 0.014, 0.006, 0, 0, -a); }
      P('#B7EB8A', G.ball, 0, 0.006, 0.004, 0.006, 0.006, 0.004); P('#7FCB4C', G.cyl, 0.006, -0.026, 0, 0.0025, 0.03, 0.0025, 0, 0, deg(15)); break;
    case 'acorn':
      P('#F7C47A', G.ball, 0, -0.008, 0, 0.026, 0.032, 0.026); P('#D9975E', G.half, 0, 0.008, 0, 0.03, 0.02, 0.03);
      P('#D9975E', G.cyl, 0, 0.008, 0, 0.03, 0.006, 0.03); P('#9D6B4A', G.cyl, 0, 0.032, 0, 0.004, 0.012, 0.004); break;
    case 'bird':
      P('#FFF5D6', G.ball, 0, 0, 0, 0.034, 0.028, 0.03); P('#FFF5D6', G.ball, 0.014, 0.024, 0.014, 0.021, 0.02, 0.02);
      P('#FFD55E', G.ball, -0.012, 0.002, 0.018, 0.02, 0.013, 0.008, 0, deg(-20), deg(-15));
      P('#FFB74D', cone(0.0, 0.007, 8), 0.024, 0.024, 0.034, 1, 0.014, 1, deg(90)); P(EYE, G.ball, 0.02, 0.03, 0.03, 0.0045, 0.0055, 0.003);
      P(CHEEK, G.ball, 0.027, 0.02, 0.026, 0.005, 0.0035, 0.002); P('#FFD55E', G.ball, -0.032, 0.008, -0.004, 0.012, 0.008, 0.008, 0, 0, deg(25)); break;
    default: break;
  }
  return out;
}
