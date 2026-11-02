// 운동장 축구: 방 안 모두가 함께 차는 공 하나 + 청팀/백팀 점수
// - 내 아바타가 공에 부딪히면(걸어가다 닿으면) 공이 굴러감
// - 공을 차면 위치·속도를 친구들에게 보내고, 받은 쪽은 같은 물리로 굴림
// - 동쪽 골대에 들어가면 청팀, 서쪽 골대에 들어가면 백팀 득점
//   (점수는 마지막으로 찬 사람이 올리고 모두에게 알려서, 두 번 올라가지 않게 함)
import * as THREE from 'three';
import { PITCH } from './world.js';

const R = 0.22;
const CENTER = { x: 0, z: 41 };

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fafafa';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#222';
  const spots = [[32, 64], [96, 30], [96, 98], [160, 64], [224, 30], [224, 98], [0, 20], [256, 20], [64, 6], [192, 122]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSoccer({ scene, myId, send, drawScore, onGoal, onKickSound }) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.5 }));
  mesh.castShadow = true;
  mesh.userData.role = 'ball';
  scene.add(mesh);

  const b = { x: CENTER.x, z: CENTER.z, vx: 0, vz: 0, seq: 0, kicker: null };
  const score = { blue: 0, white: 0 };
  let goalUntil = 0; // 골 들어간 뒤 잠깐 멈춤 (이 시각까지, ms)
  const locked = () => goalUntil > 0;
  let lastKick = 0;
  const axis = new THREE.Vector3();

  const nextSeq = () => Math.max(Date.now(), b.seq + 1);

  function snapshot() {
    return { x: +b.x.toFixed(2), z: +b.z.toFixed(2), vx: +b.vx.toFixed(2), vz: +b.vz.toFixed(2), seq: b.seq, kicker: b.kicker, sb: score.blue, sw: score.white };
  }

  function apply(s) {
    if (!s || !Number.isFinite(s.seq) || s.seq <= b.seq) return;
    const wasKick = Math.hypot(s.vx, s.vz) > 0.5;
    b.x = THREE.MathUtils.clamp(+s.x || 0, PITCH.minX - 3, PITCH.maxX + 3);
    b.z = THREE.MathUtils.clamp(+s.z || 0, PITCH.minZ, PITCH.maxZ);
    b.vx = THREE.MathUtils.clamp(+s.vx || 0, -20, 20);
    b.vz = THREE.MathUtils.clamp(+s.vz || 0, -20, 20);
    b.seq = s.seq;
    b.kicker = s.kicker;
    // 골대 안 공이면 (점수 알림) 골 멈춤을 유지, 아직 축하 안 했으면 축하
    const inGoal = Math.abs(b.x) > PITCH.goalX && b.z > PITCH.goalZ1 && b.z < PITCH.goalZ2;
    if (inGoal) {
      if (!locked()) {
        goalUntil = performance.now() + 2500;
        onGoal(b.x > 0 ? 'blue' : 'white', b);
      }
    } else goalUntil = 0;
    const sb = Math.max(0, Math.min(999, s.sb | 0));
    const sw = Math.max(0, Math.min(999, s.sw | 0));
    if (sb !== score.blue || sw !== score.white) {
      score.blue = sb;
      score.white = sw;
      drawScore(sb, sw);
    }
    if (wasKick) onKickSound(b);
  }

  function kick(dx, dz, power) {
    b.vx = dx * power;
    b.vz = dz * power;
    b.seq = nextSeq();
    b.kicker = myId;
    lastKick = performance.now();
    onKickSound(b, true);
    send(snapshot());
  }

  function resetToCenter() {
    b.x = CENTER.x;
    b.z = CENTER.z;
    b.vx = b.vz = 0;
  }

  // me: 내 아바타, moving: 걷는 중인지
  function update(dt, me, moving) {
    if (locked() && performance.now() > goalUntil) {
      goalUntil = 0;
      {
        resetToCenter();
        // 골을 넣은 사람이 가운데로 옮긴 공을 모두에게 알림
        if (b.kicker === myId) {
          b.seq = nextSeq();
          send(snapshot());
        }
      }
    }

    // 굴러가기 + 마찰
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.02) {
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      const f = Math.exp(-0.85 * dt);
      b.vx *= f;
      b.vz *= f;
      axis.set(b.vz, 0, -b.vx).normalize();
      mesh.rotateOnWorldAxis(axis, (sp * dt) / R);
    } else {
      b.vx = b.vz = 0;
    }

    const inMouth = b.z > PITCH.goalZ1 && b.z < PITCH.goalZ2;
    if (Math.abs(b.x) > PITCH.goalX && inMouth) {
      // 골대 안
      if (Math.abs(b.x) > PITCH.goalDepth) {
        b.x = Math.sign(b.x) * PITCH.goalDepth;
        b.vx = b.vz = 0;
      }
      if (!locked()) {
        goalUntil = performance.now() + 2500;
        const side = b.x > 0 ? 'blue' : 'white';
        if (b.kicker === myId) {
          score[side]++;
          drawScore(score.blue, score.white);
          b.seq = nextSeq();
          send(snapshot());
        }
        onGoal(side, b);
      }
    } else {
      // 운동장 끝에서 튕기기
      if (b.x < PITCH.minX || b.x > PITCH.maxX) {
        b.x = THREE.MathUtils.clamp(b.x, PITCH.minX, PITCH.maxX);
        b.vx *= -0.6;
      }
      if (b.z < PITCH.minZ || b.z > PITCH.maxZ) {
        b.z = THREE.MathUtils.clamp(b.z, PITCH.minZ, PITCH.maxZ);
        b.vz *= -0.6;
      }
      // 골대 옆 그물에 막힘
      if (Math.abs(b.x) > PITCH.goalX && !inMouth && Math.abs(b.x) < PITCH.goalDepth + 0.3) {
        const nearZ = Math.abs(b.z - PITCH.goalZ1) < Math.abs(b.z - PITCH.goalZ2) ? PITCH.goalZ1 : PITCH.goalZ2;
        if (Math.abs(b.z - nearZ) < 0.3) b.vz *= -0.5;
      }
    }

    // 내가 공에 닿으면 차기
    if (!locked() && me.pos.y < 0.5) {
      const dx = b.x - me.pos.x;
      const dz = b.z - me.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6 && moving && performance.now() - lastKick > 350) {
        const nx = d > 0.01 ? dx / d : Math.sin(me.root.rotation.y);
        const nz = d > 0.01 ? dz / d : Math.cos(me.root.rotation.y);
        kick(nx, nz, 8 + Math.random() * 3);
      } else if (d < 0.45) {
        // 서 있는 사람에게 굴러오면 살짝 밀려남
        b.x = me.pos.x + (dx / (d || 1)) * 0.45;
        b.z = me.pos.z + (dz / (d || 1)) * 0.45;
      }
    }

    mesh.position.set(b.x, R + 0.02, b.z);
  }

  return {
    mesh,
    update,
    apply,
    snapshot,
    ball: b,
    score,
    get iKickedLast() {
      return b.kicker === myId && b.seq > 0;
    },
  };
}
