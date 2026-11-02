// 온라인 학교 — 3층 학교 건물과 운동장을 아바타로 걸어 다니고, 의자에 앉고,
// 손들기/인사/박수/말하기를 같은 방에 들어온 친구들과 실시간으로 함께 하는 페이지.
//
// 주소 예시:  school.html?room=우리학교            → "우리학교" 방에 입장 (운동장에서 시작)
//            school.html?room=우리학교&class=2-3  → 2학년 3반 교실에서 시작
//            school.html?room=우리학교&teacher=1  → 선생님으로 입장 (칠판 쓰기 가능)
import * as THREE from 'three';
import './school.css';
import { buildWorld, roomAt, CLASSROOMS, levelY, levelOfY } from './world.js';
import { Avatar } from './avatar.js';
import { createNavigator } from './pathfind.js';
import { connectRoom } from './net.js';
import { playSchoolBell, playClap, playPop, unlockAudio } from './audio.js';
import { createAmbience } from './ambience.js';

const params = new URLSearchParams(location.search);
const room = (params.get('room') || '우리학교').slice(0, 30);
const isTeacher = params.get('teacher') === '1';
const startClass = CLASSROOMS.find((c) => c.id === params.get('class'));

// ── 내 정보 (이 기기에 기억) ──
const ADJ = ['씩씩한', '반짝이는', '포근한', '즐거운', '용감한', '느긋한', '다정한', '호기심 많은', '상냥한', '튼튼한'];
const NOUN = ['연필', '지우개', '새싹', '도토리', '공책', '나무', '구름', '별빛', '책갈피', '크레파스'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 저장 불가 환경 무시 */
    }
  },
};
let myId = store.get('school.id');
if (!myId) {
  myId = Math.random().toString(36).slice(2, 10);
  store.set('school.id', myId);
}
// 같은 기기에서 탭을 여러 개 열어도 서로 다른 사람으로 보이도록 탭마다 꼬리표를 붙임
myId = `${myId}-${Math.random().toString(36).slice(2, 5)}`;
let myName = store.get('school.name') || (isTeacher ? '선생님' : `${pick(ADJ)} ${pick(NOUN)}`);

// ── 렌더러 / 장면 ──
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 260);
const world = buildWorld(scene);
const nav = createNavigator(world.blocks);

// 칠판 내용 (반 id → 글). 선생님이 쓰면 모두에게 전달됨
const boards = {};
function setBoard(id, text) {
  if (!CLASSROOMS.some((c) => c.id === id)) return;
  boards[id] = String(text).slice(0, 120);
  world.writeBoard(id, boards[id]);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 아바타들 ──
const me = new Avatar({ id: myId, name: myName, isMe: true, isTeacher });
if (startClass) {
  // 교실 앞쪽 통로에서 칠판을 보며 시작
  const L = levelY(startClass.level);
  me.pos.set(startClass.xs + 2.3, L, -3.15 + (Math.random() - 0.5) * 0.3);
  me.root.rotation.y = -Math.PI / 2;
} else {
  me.pos.set((Math.random() - 0.5) * 6, 0, 22 + Math.random() * 2);
  me.root.rotation.y = Math.PI;
}
scene.add(me.root);

const others = new Map(); // id → { avatar, lastSeen }

function chairTakenBy(index) {
  if (me.sitChairIndex === index) return me;
  for (const { avatar } of others.values()) if (avatar.sitChairIndex === index) return avatar;
  return null;
}

function sitOn(avatar, index) {
  const chair = world.chairs[index];
  if (!chair) return;
  avatar.sitChair = chair;
  avatar.sitChairIndex = index;
  avatar.pos.x = chair.x;
  avatar.pos.z = chair.z;
}
function standUp(avatar) {
  if (avatar.sitChair) avatar.pos.y = avatar.sitChair.seatY - 0.45;
  avatar.sitChair = null;
  avatar.sitChairIndex = null;
}

// dest: {x, y, z}
function walkTo(avatar, dest, chairIndex = null) {
  // 계단을 오르내리는 중이면 계단을 다 지난 뒤에 새로 출발
  if (avatar.target?.stair) {
    avatar.reroute = () => walkTo(avatar, dest, chairIndex);
    return true;
  }
  standUp(avatar);
  const path = nav.findPath(avatar.pos, { ...dest, allowBlocked: chairIndex != null });
  if (!path || !path.length) return false;
  avatar.target = path.shift();
  avatar.path = path;
  avatar.onArrive = chairIndex == null ? null : () => sitOn(avatar, chairIndex);
  return true;
}

// ── 카메라 (내 아바타 뒤를 따라감, 끌어서 회전) ──
const cam = { yaw: 0, pitch: 0.42, dist: 7.5, cur: 7.5, focus: new THREE.Vector3() };
if (startClass) cam.yaw = Math.PI / 2;
const camRay = new THREE.Raycaster();
function updateCamera(dt) {
  const target = new THREE.Vector3(me.pos.x, me.pos.y + 1.3, me.pos.z);
  cam.focus.lerp(target, Math.min(1, dt * 8));
  const dir = new THREE.Vector3(
    Math.sin(cam.yaw) * Math.cos(cam.pitch),
    Math.sin(cam.pitch),
    Math.cos(cam.yaw) * Math.cos(cam.pitch),
  );
  // 벽·천장·기둥이 가리면 카메라를 그 앞으로 당김
  camRay.set(cam.focus, dir);
  camRay.far = cam.dist;
  const hit = camRay.intersectObjects(world.occluders, false)[0];
  const d = hit ? Math.max(0.6, hit.distance - 0.35) : cam.dist;
  cam.cur += (d - cam.cur) * Math.min(1, dt * (d < cam.cur ? 25 : 4));
  camera.position.copy(cam.focus).addScaledVector(dir, cam.cur);
  camera.lookAt(cam.focus);
  // 너무 가까우면 내 이름표가 화면을 가리지 않게 숨김
  me.tagHolder.visible = cam.cur > 2.2;
}

// ── 안내 문구 ──
const hintEl = document.getElementById('hint');
let hintTimer = null;
function hint(text, ms = 1800) {
  hintEl.textContent = text;
  hintEl.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.remove('show'), ms);
}

// ── 네트워크 ──
let net = { send() {}, updateMe() {}, close() {} };
let peopleCount = 1;
const roomLabel = document.getElementById('roomLabel');
const netDot = document.getElementById('netDot');
let netStatus = 'connecting';
let whereText = '';
function renderRoomLabel() {
  const who = netStatus === 'solo' && peopleCount < 2 ? '혼자 모드' : `${peopleCount}명`;
  roomLabel.textContent = `${room} · ${who}${whereText ? ` · ${whereText}` : ''}`;
  netDot.classList.toggle('on', netStatus === 'online');
}

let pendingChair = null;
function myState() {
  const t = me.path?.length ? me.path[me.path.length - 1] : me.target;
  const fin = me.finalDest || t;
  return {
    name: myName,
    teacher: isTeacher,
    x: +me.pos.x.toFixed(2),
    y: +me.pos.y.toFixed(2),
    z: +me.pos.z.toFixed(2),
    tx: fin && (me.target || me.reroute) ? +fin.x.toFixed(2) : null,
    ty: fin && (me.target || me.reroute) ? +(fin.y ?? me.pos.y).toFixed(2) : null,
    tz: fin && (me.target || me.reroute) ? +fin.z.toFixed(2) : null,
    sit: me.sitChairIndex ?? (me.onArrive ? pendingChair : null),
    boards: isTeacher ? boards : undefined,
  };
}
const announce = () => net.send('state', myState());

function getOther(id, name, teacher) {
  let o = others.get(id);
  if (!o) {
    const avatar = new Avatar({ id, name: name || '친구', isTeacher: !!teacher });
    scene.add(avatar.root);
    o = { avatar, lastSeen: performance.now() };
    others.set(id, o);
  }
  o.lastSeen = performance.now();
  if (name && name !== o.avatar.name) o.avatar.setName(name);
  return o;
}

function onState(s) {
  if (!s?.id || s.id === myId) return;
  const isNew = !others.has(s.id);
  const { avatar } = getOther(s.id, s.name, s.teacher);
  const sy = Number.isFinite(s.y) ? s.y : 0;
  // 많이 어긋나 있거나 다른 층이면 순간이동, 아니면 자연스럽게 걸어감
  if (isNew || Math.hypot(avatar.pos.x - s.x, avatar.pos.z - s.z) > 4 || Math.abs(avatar.pos.y - sy) > 1.5) {
    avatar.pos.set(s.x, sy, s.z);
    avatar.target = null;
    avatar.path = [];
    avatar.reroute = null;
  }
  if (s.sit != null && s.tx == null) {
    sitOn(avatar, s.sit);
  } else if (s.tx != null) {
    walkTo(avatar, { x: s.tx, y: s.ty ?? sy, z: s.tz }, s.sit ?? null);
  } else if (!avatar.target) {
    standUp(avatar);
    if (Math.hypot(avatar.pos.x - s.x, avatar.pos.z - s.z) > 0.3) walkTo(avatar, { x: s.x, y: sy, z: s.z });
  }
  if (s.teacher && s.boards && typeof s.boards === 'object') {
    for (const [id, text] of Object.entries(s.boards)) if (typeof text === 'string' && boards[id] !== text) setBoard(id, text);
  }
}

function distVolume(avatar) {
  const d = avatar.pos.distanceTo(me.pos);
  return Math.max(0, 1 - d / 25);
}

function onAction(a) {
  if (!a?.id || a.id === myId) return;
  const o = others.get(a.id);
  if (!o) return;
  o.lastSeen = performance.now();
  if (a.type === 'talk') {
    o.avatar.say(String(a.text || '').slice(0, 60));
    playPop(distVolume(o.avatar));
  } else if (['hand', 'bow', 'clap'].includes(a.type)) {
    o.avatar.play(a.type);
    if (a.type === 'clap') playClap(distVolume(o.avatar));
  }
}

function onBoard(b) {
  if (typeof b?.text === 'string' && typeof b?.room === 'string') setBoard(b.room, b.text);
}

function onLeave(id) {
  const o = others.get(id);
  if (!o) return;
  o.avatar.dispose();
  others.delete(id);
}

// ── 입력: 탭하면 이동 / 끌면 회전 / 두 손가락으로 확대 ──
const raycaster = new THREE.Raycaster();
const pointers = new Map();
let dragMoved = false;
let pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (pointers.size === 1) dragMoved = false;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    dragMoved = true;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) cam.dist = THREE.MathUtils.clamp(cam.dist * (pinchDist / d), 3, 16);
    pinchDist = d;
    return;
  }
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) dragMoved = true;
  if (dragMoved) {
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, 0.08, 1.3);
  }
});

const endPointer = (e) => {
  const had = pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  if (had && pointers.size === 0 && !dragMoved && e.type === 'pointerup') handleTap(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    cam.dist = THREE.MathUtils.clamp(cam.dist * (1 + e.deltaY * 0.001), 3, 16);
  },
  { passive: false },
);

const tapTargets = [...world.walkables, ...world.tapBlockers, ...world.chairMeshes];
const tmpN = new THREE.Vector3();

function handleTap(cx, cy) {
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(tapTargets, false)[0];
  if (!hit) return hint('가까운 빈 바닥을 눌러주세요');

  // 의자를 눌렀나?
  if (hit.object.userData.role === 'chair') {
    let idx = -1;
    let bestD = 0.8;
    world.chairs.forEach((c, i) => {
      const d = Math.hypot(c.x - hit.point.x, c.z - hit.point.z) + Math.abs(c.seatY - hit.point.y) * 0.5;
      if (d < bestD) {
        bestD = d;
        idx = i;
      }
    });
    if (idx < 0) return;
    const taker = chairTakenBy(idx);
    if (taker && taker !== me) return hint('이미 친구가 앉아 있어요');
    if (taker === me) return;
    const c = world.chairs[idx];
    pendingChair = idx;
    const dest = { x: c.x, y: c.seatY - 0.45, z: c.z };
    me.finalDest = dest;
    if (walkTo(me, dest, idx)) {
      const done = me.onArrive;
      if (done) {
        me.onArrive = () => {
          done();
          pendingChair = null;
          me.finalDest = null;
          announce();
        };
      }
      announce();
    } else hint('그 자리로 갈 수 없어요');
    return;
  }

  // 바닥인가? (위를 향한 면만)
  tmpN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  if (hit.object.userData.role === 'wall' || tmpN.y < 0.5) return hint('가까운 빈 바닥을 눌러주세요');
  const p = hit.point;
  if (nav.blockedAt(p.x, p.z, p.y)) return hint('가까운 빈 바닥을 눌러주세요');
  pendingChair = null;
  const dest = { x: p.x, y: p.y, z: p.z };
  me.finalDest = dest;
  if (!walkTo(me, dest)) return hint('가까운 빈 바닥을 눌러주세요');
  me.onArrive = () => {
    me.finalDest = null;
  };
  if (levelOfY(p.y) !== levelOfY(me.pos.y)) hint(`${levelOfY(p.y) + 1}층으로 계단을 이용해요`, 1600);
  showMarker(p);
  announce();
}

// 누른 곳 표시 (작은 동그라미)
const marker = new THREE.Mesh(
  new THREE.RingGeometry(0.18, 0.28, 24),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
);
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);
let markerT = 0;
function showMarker(p) {
  marker.position.set(p.x, p.y + 0.03, p.z);
  marker.visible = true;
  markerT = 0;
}

// ── 아래 버튼들 ──
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const talkBtn = document.querySelector('[data-act="talk"]');
let lastAct = 0;

document.querySelectorAll('.actions button').forEach((btn) => {
  btn.addEventListener('click', () => {
    unlockAudio();
    const type = btn.dataset.act;
    if (type === 'talk') {
      const open = chatForm.classList.toggle('hidden') === false;
      talkBtn.classList.toggle('active', open);
      if (open) chatInput.focus();
      return;
    }
    if (performance.now() - lastAct < 700) return; // 연타 방지
    lastAct = performance.now();
    me.play(type);
    if (type === 'clap') playClap(1);
    net.send('act', { type });
  });
});

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim().slice(0, 60);
  if (!text) return;
  me.say(text);
  playPop(0.6);
  net.send('act', { type: 'talk', text });
  chatInput.value = '';
  chatInput.blur();
  chatForm.classList.add('hidden');
  talkBtn.classList.remove('active');
});

// 종소리
const bellBtn = document.getElementById('bellBtn');
let stopBell = null;
bellBtn.addEventListener('click', () => {
  if (stopBell) {
    stopBell();
    stopBell = null;
    bellBtn.textContent = '종소리 듣기';
  } else {
    stopBell = playSchoolBell(true);
    bellBtn.textContent = '종소리 멈추기';
  }
});

// 주변 소리 켜기/끄기
const soundBtn = document.getElementById('soundBtn');
let ambience = null;
let muted = store.get('school.muted') === '1';
function renderSoundBtn() {
  soundBtn.textContent = muted ? '🔇 주변 소리 꺼짐' : '🔊 주변 소리';
}
renderSoundBtn();
soundBtn.addEventListener('click', () => {
  unlockAudio();
  muted = !muted;
  store.set('school.muted', muted ? '1' : '0');
  ambience?.setMuted(muted);
  renderSoundBtn();
});

// 장소에 따라 들리는 소리 섞기
const FIELD = { minX: -46, maxX: 46, minZ: 16, maxZ: 66 };
function soundMix() {
  const { x, y, z } = me.pos;
  const inBuilding = Math.abs(x) < 56.5 && z < 0 && z > -12;
  const k = levelOfY(y);
  const room = roomAt(x, z, y);
  const inHallRoom = inBuilding && Math.abs(x) < 4.5 && z > -9;
  const dx = Math.max(FIELD.minX - x, 0, x - FIELD.maxX);
  const dz = Math.max(FIELD.minZ - z, 0, z - FIELD.maxZ);
  const near = Math.max(0, 1 - Math.hypot(dx, dz) / 70);
  const open = 16000;
  const muffled = 650;
  const mix = {};
  if (!inBuilding) {
    mix.field = [0.25 + 0.75 * near, open];
    mix.outdoor = [1, open];
    mix.corridor = [0.12, muffled];
    mix.classroom = [0.1, muffled];
  } else {
    // 건물 안: 운동장 소리는 창문 너머로 작고 먹먹하게
    mix.field = [room ? 0.35 : 0.22, room ? 1200 : muffled];
    mix.outdoor = [0.12, muffled];
    if (room) {
      mix.classroom = [1, open];
      mix.corridor = [0.25, 900];
    } else if (inHallRoom && k === 1) {
      mix.office = [1, open];
      mix.corridor = [0.2, 900];
    } else if (inHallRoom && k === 2) {
      mix.library = [1, open];
      mix.corridor = [0.15, 900];
    } else {
      mix.corridor = [1, open];
      mix.classroom = [0.3, 900]; // 복도에서 들리는 옆 교실 소리
      if (k === 1 && Math.abs(x) < 14) mix.office = [0.3, 900];
    }
  }
  return mix;
}

// 칠판 쓰기 (선생님만, 지금 있는 교실의 칠판)
const boardBtn = document.getElementById('boardBtn');
if (isTeacher) {
  boardBtn.classList.remove('hidden');
  boardBtn.addEventListener('click', () => {
    const r = roomAt(me.pos.x, me.pos.z, me.pos.y);
    if (!r) return hint('교실 안에서 칠판을 쓸 수 있어요');
    const cur = boards[r.id] ?? world.boardDefault(r.id);
    const v = window.prompt(`${r.name} 칠판에 쓸 내용 (줄바꿈은 / 로 구분, 최대 5줄)`, cur.replace(/\n/g, ' / '));
    if (v == null) return;
    const text = v.split('/').map((s) => s.trim()).filter(Boolean).slice(0, 5).join('\n').slice(0, 120) || world.boardDefault(r.id);
    setBoard(r.id, text);
    net.send('board', { room: r.id, text });
  });
}

// 이름 바꾸기 (왼쪽 위 방 이름 누르기)
document.getElementById('roomBadge').addEventListener('click', () => {
  const v = window.prompt('내 이름을 바꿀까요? (12자까지)', myName);
  if (!v || !v.trim()) return;
  myName = v.trim().slice(0, 12);
  store.set('school.name', myName);
  me.setName(myName);
  net.updateMe();
  announce();
});

// ── 입장 화면 ──
const intro = document.getElementById('intro');
const nameInput = document.getElementById('nameInput');
document.getElementById('introRoom').textContent = `${room}${startClass ? ` · ${startClass.name}` : ''}${isTeacher ? ' · 선생님으로 입장' : ''}`;
nameInput.value = myName;
document.getElementById('introForm').addEventListener('submit', (e) => {
  e.preventDefault();
  unlockAudio();
  const v = nameInput.value.trim().slice(0, 12);
  if (v) {
    myName = v;
    store.set('school.name', myName);
    me.setName(myName);
  }
  intro.remove();
  start();
});

function start() {
  const meRef = {
    id: myId,
    get name() {
      return myName;
    },
    teacher: isTeacher,
    announce,
  };
  net = connectRoom({
    room,
    me: meRef,
    onState,
    onAction,
    onBoard,
    onLeave,
    onCount(n) {
      peopleCount = Math.max(1, n);
      renderRoomLabel();
    },
    onStatus(s) {
      netStatus = s;
      renderRoomLabel();
    },
  });
  renderRoomLabel();
  setTimeout(() => hint('가까운 빈 바닥을 눌러주세요', 2600), 400);

  ambience = createAmbience();
  ambience.setMuted(muted);
  ambience.setMix(soundMix());
  ambience.start();
  // 5분마다 학교 종이 울림 (주변 소리를 켰을 때만)
  setInterval(() => {
    if (!muted && !stopBell) playSchoolBell(false);
  }, 5 * 60 * 1000);

  // 주기적으로 내 위치 알림 + 오래 소식 없는 친구 정리
  setInterval(() => {
    announce();
    const now = performance.now();
    for (const [id, o] of others) if (now - o.lastSeen > 30000) onLeave(id);
  }, 5000);
  window.addEventListener('pagehide', () => net.close());
}
renderRoomLabel();

// 지금 어디에 있는지 (교실 이름 / 층)
let lastWhere = '';
function updateWhere() {
  const r = roomAt(me.pos.x, me.pos.z, me.pos.y);
  const inBuilding = Math.abs(me.pos.x) < 56.5 && me.pos.z < 0 && me.pos.z > -12;
  const w = r ? r.name : inBuilding ? `${levelOfY(me.pos.y) + 1}층` : '운동장';
  if (w !== lastWhere) {
    if (r && lastWhere) hint(r.name, 1500);
    lastWhere = w;
    whereText = w;
    renderRoomLabel();
  }
}

// ── 매 프레임 ──
const clock = new THREE.Clock();
let whereT = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  me.update(dt, world.heightAt);
  for (const { avatar } of others.values()) avatar.update(dt, world.heightAt);
  world.update(clock.elapsedTime);
  if (marker.visible) {
    markerT += dt;
    marker.scale.setScalar(1 + markerT * 1.5);
    marker.material.opacity = Math.max(0, 0.9 - markerT * 1.2);
    if (markerT > 0.8) marker.visible = false;
  }
  if ((whereT += dt) > 0.3) {
    whereT = 0;
    updateWhere();
    ambience?.setMix(soundMix());
  }
  // 그림자 영역이 내 주변을 따라오도록
  world.sun.position.set(me.pos.x + 18, me.pos.y + 30, me.pos.z + 22);
  world.sun.target.position.set(me.pos.x, me.pos.y, me.pos.z);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
cam.focus.set(me.pos.x, me.pos.y + 1.3, me.pos.z);
frame();

// 자동 점검용 (주소에 debug=1 이 있을 때만)
if (params.get('debug') === '1') window.__school = { me, walkTo, world, nav, others };
