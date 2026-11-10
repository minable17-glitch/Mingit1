import * as THREE from 'three';
import { Avatar, LOOKS } from '../3d-avatar/avatar.js';
import { buildLibrary, PALETTE } from './library.js';
const q = new URLSearchParams(location.search);
const view = q.get('view') || 'lib';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9FD3F0');
const lib = buildLibrary(scene);
const avatars = [];
const SIT_Y = 0.05;
const looks = [LOOKS[0], LOOKS[1], LOOKS[2], LOOKS[3], { hair: '#6B4430', shirt: '#F2B880' }, { hair: '#2F241F', shirt: '#B9A6E0', shorts: '#F3E1B6' }];
const sitAt = (id, look, state = 'read') => {
  const s = lib.seats.find((x) => x.id === id);
  const av = new Avatar(look);
  av.root.position.set(s.x - Math.sin(s.rotY) * 0.04, SIT_Y, s.z - Math.cos(s.rotY) * 0.04);
  av.root.rotation.y = s.rotY; av.setState(state); av.lookUp = 0.3; scene.add(av.root); avatars.push(av);
};
sitAt(1, looks[0]); sitAt(7, looks[2]); sitAt(10, looks[1], 'sit'); sitAt(15, looks[3]); sitAt(17, looks[4]); sitAt(22, looks[5], 'sit'); sitAt(25, looks[3]); sitAt(30, looks[0]);
const walker = (x, z, ry, look, state = 'walk') => { const av = new Avatar(look); av.root.position.set(x, 0, z); av.root.rotation.y = ry; av.setState(state); av.lookUp = 0.36; scene.add(av.root); avatars.push(av); };
walker(-0.35, 1.2, 0.4, looks[3]);
walker(0.25, 4.3, -0.25, looks[1]);
const me = avatars[avatars.length - 1];

let camera;
const pitch = THREE.MathUtils.degToRad(view === 'lib' ? 56 : view === 'libwide' ? 50 : 44);
const aim = (cam, target, dist) => { cam.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist); cam.lookAt(target); };
if (view === 'lib') {
  // 전체 조망: 방 전체 배치 확인용
  camera = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.1, 300);
  aim(camera, new THREE.Vector3(0, 0, -0.2), 37);
} else if (view === 'libwide') {
  // 폰 세로 화면에 방 폭 전체를 맞춘 경우(캐릭터가 작아짐)
  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
  aim(camera, new THREE.Vector3(0, 0.4, 0.4), 50);
} else {
  // 실제 게임 화면: 내 캐릭터를 따라가는 카메라. 폭 약 6.5칸이 보이고 세로로는 도서관 대부분이 보임
  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
  const p = me.root.position;
  aim(camera, new THREE.Vector3(p.x * 0.5, 0.4, p.z - 3.3), 23);
}
lib.faceBackdrop(pitch);
avatars.forEach((a, i) => { a.t = 0.4 + i * 0.37; a.update(0); });
renderer.render(scene, camera);
window.__ready = true;
