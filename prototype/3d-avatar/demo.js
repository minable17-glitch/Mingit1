import * as THREE from 'three';
import { Avatar, LOOKS } from './avatar.js';
const q = new URLSearchParams(location.search);
const view = q.get('view') || 'turn';
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight('#fff6ec', 0.75));
scene.add(new THREE.HemisphereLight('#ffffff', '#ffe3d2', 1.6));
const sun = new THREE.DirectionalLight('#fff6ea', 0.7); sun.position.set(-2.5, 4, 3.5); scene.add(sun);
const avatars = [];
let camera;
if (view === 'faces') {
  scene.background = new THREE.Color('#ffffff');
  const a = innerWidth / innerHeight, h = 0.62;
  camera = new THREE.OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, 0.1, 20);
  camera.position.set(0, 0.74, 5); camera.lookAt(0, 0.74, 0);
  const opts = [{}];
  opts.forEach((o, i) => { const av = new Avatar(o); av.root.position.x = 0; av.shadow.visible = false; scene.add(av.root); avatars.push(av); });
} else if (view === 'turn') {
  scene.background = new THREE.Color('#ffffff');
  const a = innerWidth / innerHeight, h = 1.13;
  camera = new THREE.OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, 0.1, 20);
  camera.position.set(0, 0.5, 5); camera.lookAt(0, 0.5, 0);
  [[-0.563, 0], [0, 90], [0.563, 180]].forEach(([x, r]) => {
    const av = new Avatar(); av.root.position.x = x; av.root.rotation.y = THREE.MathUtils.degToRad(r); av.shadow.visible = false;
    scene.add(av.root); avatars.push(av);
  });
} else {
  scene.background = new THREE.Color('#F3E6C8');
  camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(0, 3.7, 6.0); camera.lookAt(0, 0.42, 0.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: '#E9CFA0', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wood = new THREE.MeshStandardMaterial({ color: '#D9A566', roughness: 0.9 }), woodD = new THREE.MeshStandardMaterial({ color: '#B98146', roughness: 0.9 });
  const rb = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const desk = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const top = rb(0.78, 0.05, 0.46, wood); top.position.set(0, 0.37, 0.36); g.add(top);
    for (const sx of [-0.33, 0.33]) for (const sz of [0.18, 0.54]) { const l = rb(0.05, 0.35, 0.05, woodD); l.position.set(sx, 0.175, sz); g.add(l); }
    const seat = rb(0.42, 0.05, 0.38, wood); seat.position.set(0, 0.2, -0.05); g.add(seat);
    const back = rb(0.42, 0.3, 0.05, wood); back.position.set(0, 0.42, -0.24); g.add(back);
    for (const sx of [-0.17, 0.17]) for (const sz of [-0.2, 0.1]) { const l = rb(0.04, 0.2, 0.04, woodD); l.position.set(sx, 0.1, sz); g.add(l); }
    scene.add(g); return g;
  };
  const place = (look, x, z, ry, state, sitY = 0) => { const av = new Avatar(look); av.root.position.set(x, sitY, z); av.root.rotation.y = THREE.MathUtils.degToRad(ry); av.setState(state); scene.add(av.root); avatars.push(av); return av; };
  desk(-0.75, -0.9); desk(0.75, -0.9); desk(-0.75, 0.5);
  place(LOOKS[0], -0.75, -0.9, 0, 'read', 0.05);
  place(LOOKS[2], 0.75, -0.9, 0, 'sit', 0.05);
  place(LOOKS[1], 0.55, 0.75, -55, 'walk');
  place(LOOKS[3], -0.05, 1.45, 15, 'wave');
  avatars.forEach((a) => { a.t = Number(q.get('t') || 0.5); });
}
function frame() { avatars.forEach((a) => a.update(0)); renderer.render(scene, camera); }
if (q.get('anim') === '1') { let last = performance.now(); (function loop(now) { const dt = (now - last) / 1000; last = now; avatars.forEach((a) => a.update(dt)); renderer.render(scene, camera); requestAnimationFrame(loop); })(last); }
else frame();
window.__ready = true;
