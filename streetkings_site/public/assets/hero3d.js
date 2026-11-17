// 3D showroom for the hero: a ring of screens in a dark garage with a wet floor.
// Every picture on the screens is a real one handed in by app.js (the hero shot, staff-pinned builds, recent screenshots).
// Loaded on demand; if WebGL or this file is unavailable the hero keeps its photo.
import * as THREE from 'three';

const ACCENT = 0x10b981;
const BG = 0x050505;
const CARD_W = 4.4;
const CARD_ASPECT = 1.85;
const CARD_H = CARD_W / CARD_ASPECT;
const CARD_Y = CARD_H / 2 + 0.55;      // screens float a little above the floor
const MIRROR = 1.22;                   // reflections are stretched a touch, like on wet asphalt

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ShapeGeometry(s, 10);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  uv.needsUpdate = true;
  return g;
}

// crop the picture to fill the screen, like object-fit: cover
function fitCover(tex) {
  const a = tex.image.width / tex.image.height;
  tex.repeat.set(1, 1); tex.offset.set(0, 0);
  if (a > CARD_ASPECT) { tex.repeat.x = CARD_ASPECT / a; tex.offset.x = (1 - tex.repeat.x) / 2; }
  else { tex.repeat.y = a / CARD_ASPECT; tex.offset.y = (1 - tex.repeat.y) / 2; }
}

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// patchy alpha for the floor: darker patches are puddles that show more reflection
function puddles() {
  const t = canvasTexture(256, (g, s) => {
    g.fillStyle = 'rgb(158,158,158)'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 14 + Math.random() * 46;
      const v = Math.random() < 0.55 ? 62 + Math.random() * 50 : 208;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${v},${v},${v},0.85)`); grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = grad;
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  return t;
}

const glowTexture = () => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export async function createShowroom({ canvas, images, wordmark, reduced = false, onOpen, onFront, car = false }) {
  if (!images || !images.length) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch { return null; }

  const phone = matchMedia('(max-width: 760px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, 0.036);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  const slots = clamp(images.length, 7, phone ? 10 : 14);
  const step = (Math.PI * 2) / slots;
  const radius = (CARD_W * 1.27) / (2 * Math.sin(step / 2));
  const withCar = !!car && !phone;      // the 3D car is skipped on phones (about 7 MB of parts)
  const depth = withCar ? 4 : 0;        // with a car in front, the ring of screens stands further back

  // ── floor: see-through black, so the mirrored copies below it read as reflections ──
  const floor = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(160, 160)),
    keep(new THREE.MeshBasicMaterial({ color: BG, alphaMap: keep(puddles()), transparent: true, depthWrite: false, fog: false })),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = 10;
  scene.add(floor);

  // adds an object and its reflection under the floor
  function withMirror(parent, mesh, dim = 0.3) {
    parent.add(mesh);
    const m = mesh.clone();
    m.material = keep(mesh.material.clone());
    m.material.color.multiplyScalar(dim);
    m.position.y = -mesh.position.y * MIRROR;
    m.scale.y = -mesh.scale.y * MIRROR;
    m.renderOrder = 1;
    m.userData.mirror = true;
    parent.add(m);
    return m;
  }

  // ── wall lights: pairs of emerald ribs repeating into the dark, for depth ──
  const ribGeo = keep(new THREE.BoxGeometry(0.07, 3.4, 0.07));
  const ribMat = keep(new THREE.MeshBasicMaterial({ color: ACCENT }));
  for (let k = 0; k < 12; k++) {
    const z = 4 - k * 6.5;
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(ribGeo, ribMat); rib.position.set(side * 14.5, 2.3, z);
      withMirror(scene, rib, 0.5);
    }
  }

  // ── a soft shaft of light falling on the front screen ──
  const shaftTex = keep(canvasTexture(256, (g, s) => {
    const across = g.createLinearGradient(0, 0, s, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(0.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = across; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-in';
    const down = g.createLinearGradient(0, 0, 0, s);
    down.addColorStop(0, 'rgba(0,0,0,0.9)'); down.addColorStop(0.75, 'rgba(0,0,0,0.25)'); down.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = down; g.fillRect(0, 0, s, s);
  }));
  const shaft = new THREE.Mesh(keep(new THREE.PlaneGeometry(8.5, 10)),
    keep(new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xbff5e0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  shaft.position.set(0, 5, -0.8); shaft.renderOrder = 18;
  scene.add(shaft);

  // ── stage light on the floor where the front screen stands ──
  const glowTex = keep(glowTexture());
  const pool = new THREE.Mesh(keep(new THREE.PlaneGeometry(11, 6)),
    keep(new THREE.MeshBasicMaterial({ map: glowTex, color: ACCENT, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.02, 0.4); pool.renderOrder = 15;
  scene.add(pool);

  // ── dust in the light ──
  const dustCount = phone ? 90 : 220;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 22; dustPos[i * 3 + 1] = 0.3 + Math.random() * 6; dustPos[i * 3 + 2] = 8 - Math.random() * 30;
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, keep(new THREE.PointsMaterial({ map: glowTex, color: 0xcfeee2, size: 0.07, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false })));
  dust.renderOrder = 20;
  scene.add(dust);

  // ── the ring of screens ──
  const ring = new THREE.Group();
  ring.position.set(0, 0, -radius - depth);
  scene.add(ring);

  const screenGeo = keep(roundedRect(CARD_W, CARD_H, 0.14));
  const frameGeo = keep(roundedRect(CARD_W + 0.12, CARD_H + 0.12, 0.18));
  const stripGeo = keep(new THREE.BoxGeometry(CARD_W * 0.42, 0.035, 0.035));
  const frameMat = keep(new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide }));
  const stripMat = keep(new THREE.MeshBasicMaterial({ color: ACCENT }));
  const screens = [];

  for (let i = 0; i < slots; i++) {
    const g = new THREE.Group();
    const a = i * step;
    g.position.set(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    g.rotation.y = a;

    const frame = new THREE.Mesh(frameGeo, frameMat); frame.position.set(0, CARD_Y, -0.02);
    withMirror(g, frame, 0.5);
    const strip = new THREE.Mesh(stripGeo, stripMat); strip.position.set(0, CARD_Y - CARD_H / 2 - 0.2, 0);
    withMirror(g, strip, 0.6);

    const mat = keep(new THREE.MeshBasicMaterial({ color: 0x1b1b1b }));
    const screen = new THREE.Mesh(screenGeo, mat); screen.position.set(0, CARD_Y, 0);
    const reflection = withMirror(g, screen, 1);
    screen.userData = { slot: i, image: i % images.length };
    ring.add(g);
    screens.push({ screen, reflection, loaded: false });
  }

  // ── pictures ──
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const textures = new Map(); // image index -> promise of a texture (or null if it failed)
  function texture(index) {
    if (!textures.has(index)) {
      textures.set(index, new Promise((resolve) => {
        loader.load(images[index].texture || images[index].thumb || images[index].url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = maxAniso;
          fitCover(t);
          resolve(keep(t));
        }, undefined, () => resolve(null));
      }));
    }
    return textures.get(index);
  }
  async function fill(i) {
    const s = screens[i];
    const t = await texture(s.screen.userData.image);
    if (!t) return;
    for (const m of [s.screen.material, s.reflection.material]) { m.map = t; m.needsUpdate = true; }
    s.loaded = true;
  }

  // ── the wordmark as a lit sign above the ring ──
  const signW = Math.min(9.5, radius * 0.78);
  const sign = new THREE.Group();
  sign.position.set(0, CARD_Y + CARD_H / 2 + 2.35 + depth * 0.18, -radius - depth);
  scene.add(sign);
  const signReady = wordmark ? new Promise((resolve) => {
    loader.load(wordmark, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; keep(t);
      const h = signW * (t.image.height / t.image.width);
      const geo = keep(new THREE.PlaneGeometry(signW, h));
      const face = new THREE.Mesh(geo, keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false })));
      face.renderOrder = 20;
      sign.add(face);
      const halo = new THREE.Mesh(keep(new THREE.PlaneGeometry(signW * 1.5, h * 2.6)),
        keep(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x6fe9c0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
      halo.position.z = -0.2; halo.renderOrder = 19;
      sign.add(halo);
      // reflection of the sign, low and faint
      const refl = new THREE.Mesh(geo, keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.3, depthWrite: false, fog: false })));
      refl.position.set(0, -sign.position.y * (1 + MIRROR), 0);
      refl.scale.y = -MIRROR;
      refl.renderOrder = 1;
      sign.add(refl);
      resolve();
    }, undefined, () => resolve());
  }) : Promise.resolve();

  // ── camera ──
  const base = new THREE.Vector3(0, 2.1, 12.5);
  const look = new THREE.Vector3(0, 1.75, 0);
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const portrait = aspect < 0.85;
    const stacked = portrait || w <= 1080; // same breakpoint as the CSS: the copy sits under the scene instead of beside it
    camera.aspect = aspect;
    camera.fov = portrait ? 54 : stacked ? 42 : 38;
    base.set(0, portrait ? 2.5 : 2.1, portrait ? 17.5 : stacked ? 13.5 : 12.5);
    // slide the picture: right on wide screens (the copy sits on the left), up when stacked (the copy sits at the bottom)
    const sx = stacked ? 0 : -Math.round(w * 0.2);
    const sy = stacked ? Math.round(h * (portrait ? 0.17 : 0.14)) : Math.round(h * 0.03);
    camera.setViewOffset(w, h, sx, sy, w, h);
    camera.updateProjectionMatrix();
  }
  layout();
  const resizer = new ResizeObserver(layout);
  resizer.observe(canvas);

  // ── motion ──
  let rot = 0, rotTarget = 0;
  let intro = reduced ? 1 : 0;
  let pointerX = 0, pointerY = 0, camX = 0, camY = 0;
  let nextAuto = performance.now() + 5200;
  let dragging = false, dragStartX = 0, dragStartRot = 0, dragMoved = 0, hover = false;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hero = canvas.closest('section') || canvas;

  const frontSlot = () => ((Math.round(-rotTarget / step) % slots) + slots) % slots;
  const idle = (ms = 7000) => { nextAuto = performance.now() + ms; };

  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(screens.map((s) => s.screen), false)[0];
    return hit ? hit.object.userData : null;
  }
  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; dragMoved = 0; dragStartX = e.clientX; dragStartRot = rotTarget;
    canvas.classList.add('grabbing');
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    idle();
  }
  function onMove(e) {
    if (dragging) {
      const dx = e.clientX - dragStartX;
      dragMoved = Math.max(dragMoved, Math.abs(dx));
      rotTarget = dragStartRot + dx * 0.0032;
      idle();
    } else if (e.pointerType === 'mouse') {
      const now = performance.now();
      if (now - (onMove.last || 0) < 70) return;
      onMove.last = now;
      const h = !!pick(e);
      if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : ''; }
    }
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('grabbing');
    if (dragMoved < 6) {
      const hit = pick(e);
      if (hit) {
        if (hit.slot === frontSlot()) { if (onOpen) onOpen(hit.image); }
        else rotTarget += wrapAngle(-hit.slot * step - rotTarget); // bring the clicked screen to the front
      }
    }
    rotTarget = Math.round(rotTarget / step) * step;
    idle();
  }
  function onCancel() { dragging = false; canvas.classList.remove('grabbing'); rotTarget = Math.round(rotTarget / step) * step; }
  function onPointer(e) {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });

  // ── the car on a turntable in front of the screens (parts and materials in car3d.js) ──
  let carGroup = null;
  async function addCar() {
    const [{ loadCar }, { RoomEnvironment }] = await Promise.all([import('./car3d.js?v=7'), import('three/addons/environments/RoomEnvironment.js')]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = keep(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    pmrem.dispose();
    const model = await loadCar({ base: typeof car === 'string' ? car : 'assets/car/' });
    const stage = new THREE.Group();
    stage.position.set(0, 0, 3.1);
    const plinth = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.95, 3.05, 0.07, 72)), keep(new THREE.MeshStandardMaterial({ color: 0x060606, metalness: 0.3, roughness: 0.62 })));
    plinth.position.y = 0.035;
    const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(3.0, 0.018, 8, 96)), keep(new THREE.MeshBasicMaterial({ color: ACCENT })));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.075;
    carGroup = new THREE.Group();
    carGroup.position.y = 0.07;
    carGroup.rotation.y = -0.75;
    carGroup.add(model);
    stage.add(plinth, rim, carGroup);
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 7, 9);
    const back = new THREE.DirectionalLight(ACCENT, 1.1); back.position.set(-5, 3, -6);
    scene.add(stage, key, back);
    pool.position.z = 3.1;
  }

  let raf = 0, last = performance.now(), running = false, frames = 0, shownFront = -1;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    draw(now);
  }
  function draw(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (!reduced && !dragging && now > nextAuto) { rotTarget -= step; nextAuto = now + 5200; }
    rot += (rotTarget - rot) * (1 - Math.exp(-dt * 3.4));
    const front = frontSlot();
    if (front !== shownFront) { shownFront = front; if (onFront) onFront(front % images.length, front); }
    if (intro < 1) intro = Math.min(1, intro + dt / 2.4);
    const ease = 1 - Math.pow(1 - intro, 3);
    ring.rotation.y = rot - (1 - ease) * 1.15;

    // the front screen is brightest; the rest fall away into the dark
    for (let i = 0; i < slots; i++) {
      const s = screens[i];
      const off = Math.abs(wrapAngle(i * step + ring.rotation.y));
      const f = clamp(1 - off / (step * 2.7), 0, 1);
      const b = (s.loaded ? 0.24 : 0.07) + (s.loaded ? 0.76 : 0.05) * Math.pow(f, 1.15);
      s.screen.material.color.setScalar(b);
      s.reflection.material.color.setScalar(b * 0.5);
    }

    // camera: gentle parallax from the pointer, and it lifts away as the page scrolls on
    const p = clamp(window.scrollY / Math.max(hero.offsetHeight, 1), 0, 1);
    camX += (pointerX - camX) * (1 - Math.exp(-dt * 2.2));
    camY += (pointerY - camY) * (1 - Math.exp(-dt * 2.2));
    camera.position.set(base.x + camX * 0.85, base.y - camY * 0.3 + p * 1.9 + (1 - ease) * 3.2, base.z + p * 4 + (1 - ease) * 9);
    camera.lookAt(look.x + camX * 0.25, look.y + p * 0.9, look.z);

    if (carGroup && !reduced) carGroup.rotation.y = -0.75 + now * 0.00016;
    dust.position.y = (now * 0.00004) % 0.6;
    dust.rotation.y = now * 0.000012;
    pool.material.opacity = 0.17 + Math.sin(now * 0.0011) * 0.03;

    renderer.render(scene, camera);
    frames++;
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // only draw while the hero is on screen and the tab is visible
  let onScreen = true;
  const watcher = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen && !document.hidden) start(); else stop(); }, { threshold: 0.01 });
  watcher.observe(canvas);
  const onVisibility = () => { if (document.hidden) stop(); else if (onScreen) start(); };
  document.addEventListener('visibilitychange', onVisibility);

  // front screens first, then the rest; show the scene as soon as the first few are in
  const order = [...screens.keys()].sort((a, b) => Math.abs(wrapAngle(a * step)) - Math.abs(wrapAngle(b * step)));
  const firstFew = Promise.all(order.slice(0, 3).map(fill));
  order.slice(3).forEach(fill);
  await Promise.race([Promise.all([firstFew, signReady]), new Promise((r) => setTimeout(r, 2600))]);
  intro = reduced ? 1 : 0; // the fly-in starts when the scene is revealed, not while it was loading
  start();
  const carReady = withCar ? addCar().then(() => true).catch((err) => { console.warn('3D car not shown', err); return false; }) : Promise.resolve(false);

  return {
    slots,
    front: frontSlot,
    frames: () => frames,
    loaded: () => screens.filter((s) => s.loaded).length,
    turn: (n = 1) => { rotTarget -= step * n; idle(); },
    draw, // draws one frame at the given time (the loop calls it; also handy for checks)
    camera, ring, carReady,
    dispose() {
      stop();
      watcher.disconnect(); resizer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onCancel);
      disposables.forEach((d) => d.dispose && d.dispose());
      renderer.dispose();
    },
  };
}
