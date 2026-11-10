import * as THREE from 'three';
import { Avatar, LOOKS } from '../3d-avatar/avatar.js';
import { buildGarden, buildStageRow, WELL } from './garden.js';
const q = new URLSearchParams(location.search);
const view = q.get('view') || 'garden';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
let camera; const avatars = [];
if (view === 'gardenstages') {
  scene.background = new THREE.Color('#ffffff');
  buildStageRow(scene);
  const a = innerWidth / innerHeight, h = 1.5;
  camera = new THREE.OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, 0.1, 30);
  camera.position.set(0, 0.9, 6); camera.lookAt(0, 0.42, 0);
} else {
  scene.background = new THREE.Color('#9FD3F0');
  const garden = buildGarden(scene);
  const pitch = THREE.MathUtils.degToRad(50);
  const put = (look, x, z, ry, state) => { const av = new Avatar(look); av.root.position.set(x, 0, z); av.root.rotation.y = ry; av.setState(state); av.lookUp = 0.3; scene.add(av.root); avatars.push(av); return av; };
  const water = (look, id, side = -1) => { const t = garden.trees.find((p) => p.id === id); put(look, t.x + side * 0.62, t.z + 0.12, side < 0 ? Math.PI / 2 : -Math.PI / 2, 'water'); };
  water(LOOKS[0], 8, 1); water(LOOKS[2], 17, -1); water(LOOKS[3], 24, 1);
  put(LOOKS[1], WELL[0] - 0.75, WELL[1] + 0.05, Math.PI / 2, 'water');
  put({ hair: '#6B4430', shirt: '#F2B880' }, 0.2, 4.6, 0.3, 'walk');
  camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);
  const target = new THREE.Vector3(0, 0.4, -0.1), dist = 35;
  camera.position.set(target.x, target.y + Math.sin(pitch) * dist, target.z + Math.cos(pitch) * dist); camera.lookAt(target);
  garden.faceBackdrop(pitch);
}
avatars.forEach((a, i) => { a.t = 0.3 + i * 0.41; a.update(0); });
renderer.render(scene, camera);
window.__ready = true;
