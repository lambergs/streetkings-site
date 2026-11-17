// Loads the Civic Type R for the 3D showroom: the car is split into parts that share one origin, so they are loaded
// together and given materials by name (the files carry no textures of their own).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PARTS = [
  'SM_Body_201', 'SM_Roof_201', 'SM_Hood_201', 'SM_Trunk_201',
  'SM_Bumper_F_201', 'SM_Bumper_B_201', 'SM_Fender_F_201', 'SM_Fender_B_201',
  'SM_Door_FL_201', 'SM_Door_FR_201', 'SM_Door_BL_201', 'SM_Door_BR_201',
  'SM_SideSkirts_201', 'SM_FrontLip_201', 'SM_Diffuser_B_201',
  'SM_SideMirror_L_201', 'SM_SideMirror_R_201', 'SM_Light_F_201', 'SM_Light_B_201',
  'SK_Spoiler_201', 'SK_Exhaust_201', 'SK_Rim_101', 'SK_Tyre_101', 'SK_Brake_101', // wheels in full detail for the close-up
];

// wheel hubs in car space (x forward, y up, z right; metres). The files keep all four wheels at the origin.
const WHEELS = { FL: [1.345, 0.335, -0.79], FR: [1.345, 0.335, 0.79], BL: [-1.39, 0.335, -0.79], BR: [-1.39, 0.335, 0.79] };

export async function loadCar({ base = 'assets/car/', paint = 0xf3f3f1, onProgress } = {}) {
  const loader = new GLTFLoader();
  const tex = new THREE.TextureLoader();
  const map = (name, srgb = true) => {
    const t = tex.load(`${base}${name}.png`);
    t.flipY = false; // glTF texture orientation
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.15, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0c0c0c, metalness: 0.4, roughness: 0.55 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x101010, metalness: 0.5, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x05080a, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.82 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    light: new THREE.MeshStandardMaterial({ map: map('T_Light_D'), emissiveMap: map('T_Light_E'), emissive: 0xffffff, emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.4 }),
    logo: new THREE.MeshStandardMaterial({ map: map('T_Logo_D'), metalness: 0.6, roughness: 0.35 }),
    cabin: new THREE.MeshStandardMaterial({ map: map('T_LOD_D'), metalness: 0.1, roughness: 0.8 }),
    rim: new THREE.MeshStandardMaterial({ map: map('T_Rim_D'), metalness: 0.85, roughness: 0.3 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0, roughness: 0.92 }),
    brake: new THREE.MeshStandardMaterial({ map: map('T_Brake_D'), metalness: 0.5, roughness: 0.45 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xcfd6da, metalness: 1, roughness: 0.06 }),
  };
  const pick = (name = '') => {
    if (/^MI_\d+$/.test(name)) return M.paint;           // the body colour slot
    if (/Glass_Light/i.test(name)) return M.lens;
    if (/Glass/i.test(name)) return M.glass;
    if (/Light/i.test(name)) return M.light;
    if (/Logo/i.test(name)) return M.logo;
    if (/Cabin/i.test(name)) return M.cabin;
    if (/Rim/i.test(name)) return M.rim;
    if (/Tyre/i.test(name)) return M.tyre;
    if (/Brake/i.test(name)) return M.brake;
    if (/Mirror/i.test(name)) return M.mirror;
    if (/Carbon/i.test(name)) return M.carbon;
    return M.trim;                                       // exhaust, grille and other black trim
  };

  const car = new THREE.Group();
  let done = 0;
  const results = await Promise.allSettled(PARTS.map((p) => loader.loadAsync(`${base}${p}.glb`).then((g) => { done++; if (onProgress) onProgress(done / PARTS.length); return g; })));
  const failed = [];
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') { failed.push(PARTS[i]); return; }
    const root = r.value.scene;
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = Array.isArray(o.material) ? o.material.map((m) => pick(m.name)) : pick(o.material.name);
        o.frustumCulled = false; // skinned parts move with their bones
      }
      // put each wheel's bone on its hub
      const m = o.isBone && /^Ani_Wheel(_Caliper)?_(FL|FR|BL|BR)$/.exec(o.name);
      if (m && !(o.parent && /^Ani_Wheel/.test(o.parent.name))) o.position.fromArray(WHEELS[m[2]]);
    });
    car.add(root);
  });
  if (failed.length === PARTS.length) throw new Error('car parts missing');
  car.userData.failed = failed;
  car.userData.materials = M;
  car.userData.length = 4.55; // metres, bumper to bumper
  return car;
}
