// Scroll-driven car story for the hero: the Civic Type R stands in a dark studio and the camera travels around it
// as the page scrolls, one stop per chapter. Drag turns the car. Used on desktop and tablet; phones keep the showroom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadCar } from './car3d.js?v=8';

const ACCENT = 0x10b981;
const BG = 0x0a0a0b;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// One camera stop per chapter, around the car (x forward, z right, metres):
// angle in degrees around the car (0 = straight ahead of the nose, negative = the car's left side), distance, camera height,
// the point looked at, and how far the picture slides sideways (+ = car to the right of the screen, - = to the left).
const STOPS = [
  { angle: -43, dist: 7.7, y: 1.5, look: [0.1, 0.62, 0], shift: 0.17 },    // 0 hero: front three-quarter
  { angle: -90, dist: 8.6, y: 1.0, look: [0.1, 0.66, 0], shift: 0.1 },    // 1 side profile
  { angle: -40, dist: 4.9, y: 0.85, look: [1.2, 0.5, -0.5], shift: -0.2 }, // 2 front wheel, close
  { angle: -142, dist: 7.2, y: 1.7, look: [0, 0.62, 0], shift: 0.15 },     // 3 rear three-quarter
  { angle: -212, dist: 7.4, y: 1.45, look: [0, 0.6, 0], shift: 0.15 },     // 4 the other side: turn it, paint it
  { angle: -262, dist: 5.6, y: 6.6, look: [0.1, 0.3, 0], shift: 0.13 },    // 5 from above: closing
];

export async function createStory({ canvas, reduced = false, onChapter, onReady }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 16, 46);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

  // ── studio: a matt floor, tall dark pillars and one thin line of light on the back walls ──
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x38383b, metalness: 0, roughness: 0.82, envMapIntensity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x101012, metalness: 0, roughness: 0.95, envMapIntensity: 0.15, side: THREE.BackSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 16, 48, 1, true), wallMat);
  wall.position.y = 8;
  scene.add(wall);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(23.9, 23.9, 0.07, 96, 1, true), new THREE.MeshBasicMaterial({ color: 0xf2efe6, side: THREE.BackSide, fog: false }));
  line.position.y = 0.04;
  scene.add(line);
  const pillarGeo = new THREE.BoxGeometry(1.5, 16, 1.5);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0, roughness: 0.9, envMapIntensity: 0.2 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(Math.cos(a) * 17, 8, Math.sin(a) * 17);
    p.rotation.y = -a;
    scene.add(p);
  }
  // soft shadow under the car
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)'); grad.addColorStop(0.6, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012;
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 9, -4);
  const fill = new THREE.DirectionalLight(0xbfd9ff, 0.5); fill.position.set(-6, 4, 6);
  const edge = new THREE.DirectionalLight(ACCENT, 0.3); edge.position.set(-4, 2.5, -7);
  scene.add(key, fill, edge);

  // ── the car ──
  const carGroup = new THREE.Group();
  carGroup.add(shadow);
  scene.add(carGroup);
  const model = await loadCar({ base: 'assets/car/' });
  carGroup.add(model);
  const paint = model.userData.materials.paint;

  // ── camera ──
  let shiftNow = STOPS[0].shift;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 44 : 34;
    applyShift(w, h);
  }
  function applyShift(w = canvas.clientWidth, h = canvas.clientHeight) {
    const narrow = w <= 1080; // stacked layout: keep the car centred and a little high
    camera.setViewOffset(w, h, narrow ? 0 : -Math.round(w * shiftNow), narrow ? Math.round(h * 0.12) : Math.round(h * 0.02), w, h);
  }
  layout();
  const resizer = new ResizeObserver(layout);
  resizer.observe(canvas);

  const hero = canvas.closest('section') || canvas;
  function scrollProgress() {
    const travel = hero.offsetHeight - window.innerHeight;
    return travel > 0 ? clamp((window.scrollY - hero.offsetTop) / travel, 0, 1) : 0;
  }

  // ── motion ──
  let p = 0;                 // eased scroll progress 0..1
  let spin = 0, spinTarget = 0; // extra turn of the car from dragging
  let pointerX = 0, pointerY = 0, camX = 0, camY = 0;
  let dragging = false, dragX = 0, dragStart = 0;
  let chapter = -1, intro = reduced ? 1 : 0;
  const pos = new THREE.Vector3(), look = new THREE.Vector3();

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; dragX = e.clientX; dragStart = spinTarget;
    canvas.classList.add('grabbing');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  }
  function onMove(e) { if (dragging) spinTarget = dragStart + (e.clientX - dragX) * 0.006; }
  function onUp() { dragging = false; canvas.classList.remove('grabbing'); }
  function onPointer(e) { pointerX = (e.clientX / window.innerWidth) * 2 - 1; pointerY = (e.clientY / window.innerHeight) * 2 - 1; }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

  let raf = 0, last = performance.now(), running = false, frames = 0;
  function draw(now, force) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    const target = typeof force === 'number' ? force : scrollProgress();
    p = typeof force === 'number' || reduced ? target : p + (target - p) * (1 - Math.exp(-dt * 5));
    if (intro < 1) intro = Math.min(1, intro + dt / 2.6);
    const ease = 1 - Math.pow(1 - intro, 3);

    // where we are between two stops
    const f = p * (STOPS.length - 1);
    const i = Math.min(Math.floor(f), STOPS.length - 2);
    const t = smooth(clamp(f - i, 0, 1));
    const a = STOPS[i], b = STOPS[i + 1];
    const angle = THREE.MathUtils.degToRad(lerp(a.angle, b.angle, t)) - (1 - ease) * 0.9;
    const dist = lerp(a.dist, b.dist, t) + (1 - ease) * 5;
    const y = lerp(a.y, b.y, t) + (1 - ease) * 1.6;
    look.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    camX += (pointerX - camX) * (1 - Math.exp(-dt * 2.2));
    camY += (pointerY - camY) * (1 - Math.exp(-dt * 2.2));
    pos.set(look.x + Math.cos(angle + camX * 0.05) * dist, y - camY * 0.18, look.z + Math.sin(angle + camX * 0.05) * dist);
    camera.position.copy(pos);
    camera.lookAt(look);
    const s = lerp(a.shift, b.shift, t);
    if (Math.abs(s - shiftNow) > 0.0005) { shiftNow = s; applyShift(); }

    // the car eases back to straight once it is let go, unless it was turned on purpose in the "turn it" chapter
    spin += (spinTarget - spin) * (1 - Math.exp(-dt * 6));
    carGroup.rotation.y = spin;

    const near = Math.round(f);
    if (near !== chapter) { chapter = near; if (onChapter) onChapter(chapter, STOPS.length); }

    renderer.render(scene, camera);
    frames++;
  }
  function frame(now) { raf = requestAnimationFrame(frame); draw(now); }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  let onScreen = true;
  const watcher = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen && !document.hidden) start(); else stop(); }, { threshold: 0.01 });
  watcher.observe(canvas);
  const onVisibility = () => { if (document.hidden) stop(); else if (onScreen) start(); };
  document.addEventListener('visibilitychange', onVisibility);

  start();
  if (onReady) onReady();
  return {
    stops: STOPS.length,
    frames: () => frames,
    progress: () => p,
    chapter: () => chapter,
    setPaint: (hex) => paint.color.set(hex),
    resetTurn: () => { spinTarget = 0; },
    draw, camera, carGroup, scene,
    failed: model.userData.failed,
    dispose() {
      stop(); watcher.disconnect(); resizer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      renderer.dispose();
    },
  };
}
