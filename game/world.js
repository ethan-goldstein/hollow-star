// The Vale: terrain, splat ground, sky, time of day, weather, props, lanterns, pond.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { Assets } from './assets.js';
import { Sound, Music } from './audio.js';
import { UI, STR } from './ui.js';

const noise = new ImprovedNoise();
export const toW = (x, y) => [(x - 900) / 40, (y - 1230) / 40];   // 2D layout px -> metres (origin at the map centre)
const SPLIT_Z = (1200 - 1230) / 40;                                 // north of this is the Winterwood
export const VALE = { w: 45, h: 61.5, minX: -20.75, maxX: 20.75, minZ: -29.25, maxZ: 30.75,
  tower: toW(900, 2260), door: toW(900, 2315), gate: toW(1540, 2440), pond: { x: -9.5, z: -17.75, rx: 6.3, rz: 4.1 }, doghouse: toW(400, 1700), campfire: toW(600, 1960),
  paths: [[850, 300, 110, 2000], [850, 1960, 700, 110], [420, 1900, 500, 100]].map(([x, y, w, h]) => ({ x0: (x - 900) / 40, z0: (y - 1230) / 40, x1: (x + w - 900) / 40, z1: (y + h - 1230) / 40 })) };

let G, group, ground, groundMat, sky, skyMat, hemi, moon, moonTarget, lanternLights = [], particles = {}, campfireLight, fireSprites, pondMesh, pondMat, iceMesh, moonDisc, genTrees = {};
function moonTexture() { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.18, 'rgba(230,235,255,0.9)'); g.addColorStop(0.3, 'rgba(160,180,255,0.25)'); g.addColorStop(1, 'rgba(120,140,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); }
const colliders = [];       // {x,z,r}
const props = [];           // {obj, kind, lit, light, ...}
const interact = [];

function pathDist(x, z) { let d = 1e9; for (const p of VALE.paths) { const dx = Math.max(p.x0 - x, 0, x - p.x1), dz = Math.max(p.z0 - z, 0, z - p.z1); d = Math.min(d, Math.hypot(dx, dz)); } return d; }
function inPond(x, z) { const q = VALE.pond; return ((x - q.x) / q.rx) ** 2 + ((z - q.z) / q.rz) ** 2 < 1; }
export function terrainHeight(x, z) {
  let h = noise.noise(x * 0.07, z * 0.07, 0.5) * 0.9 + noise.noise(x * 0.23, z * 0.23, 3.1) * 0.25 + 0.3;
  const flat = Math.min(1, pathDist(x, z) / 1.5) * Math.min(1, Math.max(0, Math.hypot(x - VALE.tower[0], z - VALE.tower[1]) - 4) / 3) * Math.min(1, Math.max(0, Math.hypot(x - VALE.campfire[0], z - VALE.campfire[1]) - 2.5) / 2);
  h *= flat;
  const q = VALE.pond; const e = ((x - q.x) / q.rx) ** 2 + ((z - q.z) / q.rz) ** 2; if (e < 1.6) h = h * Math.min(1, (e - 1) / 0.6) - (e < 1 ? 0.5 * (1 - e) : 0);
  const edge = Math.max(0, -VALE.minX + x < 2 ? 0 : 0); return h + edge;
}

function buildGround() {
  const W = 110, H = 140, SEG = 220;
  const geo = new THREE.PlaneGeometry(W, H, SEG, (SEG * H / W) | 0); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i))); geo.computeVertexNormals();
  // splat map painted in world space: R = dirt path, G = snow, B = ice / pond
  const S = 512, cvs = document.createElement('canvas'); cvs.width = cvs.height = S; const c = cvs.getContext('2d'); const img = c.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = (i / S - 0.5) * W, z = (j / S - 0.5) * H; const k = (j * S + i) * 4;
    const pd = pathDist(x, z); img.data[k] = 255 * THREE.MathUtils.clamp(1 - (pd - 0.4) / 0.8 + noise.noise(x * 0.9, z * 0.9, 7) * 0.25, 0, 1);
    img.data[k + 1] = 255 * THREE.MathUtils.clamp((SPLIT_Z + 2.5 - z) / 5 + noise.noise(x * 0.35, z * 0.35, 11) * 0.5, 0, 1);
    img.data[k + 2] = inPond(x, z) ? 255 : 0; img.data[k + 3] = 255; }
  c.putImageData(img, 0, 0); const splat = new THREE.CanvasTexture(cvs); splat.colorSpace = THREE.NoColorSpace; splat.flipY = false;
  const T = (n, l) => Assets.tex(`assets/tex/${n}.jpg`, { linear: l });
  groundMat = new THREE.MeshStandardMaterial({ map: T('leaves'), normalMap: T('leaves_n', true), roughness: 0.95, metalness: 0 });
  groundMat.userData.u = { tDirt: { value: T('dirt') }, tDirtN: { value: T('dirt_n', true) }, tSnow: { value: T('snow') }, tSnowN: { value: T('snow_n', true) }, tIce: { value: T('ice') }, tIceN: { value: T('ice_n', true) }, tSplat: { value: splat }, uWorld: { value: new THREE.Vector2(W, H) }, uSnowDepth: { value: 0 }, uFrozen: { value: 0 } };
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundMat.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWp; uniform sampler2D tDirt, tDirtN, tSnow, tSnowN, tIce, tIceN, tSplat; uniform vec2 uWorld; uniform float uSnowDepth, uFrozen;`)
      .replace('#include <map_fragment>', `vec2 wuv = vWp.xz * 0.5; vec3 sp = texture2D(tSplat, vWp.xz / uWorld + 0.5).rgb;
        vec4 cL = texture2D(map, wuv), cD = texture2D(tDirt, wuv), cS = texture2D(tSnow, wuv * 0.7), cI = texture2D(tIce, wuv * 0.6);
        float snow = clamp(sp.g + uSnowDepth * 0.4, 0.0, 1.0); float ice = sp.b * uFrozen;
        vec4 tc = mix(mix(cL, cD, sp.r), cS * vec4(1.0 + uSnowDepth * 0.15), snow); tc = mix(tc, cI, ice);
        diffuseColor *= tc;`)
      .replace('#include <normal_fragment_maps>', `vec2 wuv2 = vWp.xz * 0.5; vec3 sp2 = texture2D(tSplat, vWp.xz / uWorld + 0.5).rgb;
        vec3 nL = texture2D(normalMap, wuv2).xyz, nD = texture2D(tDirtN, wuv2).xyz, nS = texture2D(tSnowN, wuv2 * 0.7).xyz, nI = texture2D(tIceN, wuv2 * 0.6).xyz;
        float snow2 = clamp(sp2.g + uSnowDepth * 0.4, 0.0, 1.0); vec3 mapN = mix(mix(mix(nL, nD, sp2.r), nS, snow2), nI, sp2.b * uFrozen) * 2.0 - 1.0; mapN.xy *= normalScale;
        mat3 tbn2 = getTangentFrame(-vViewPosition, normal, wuv2); normal = normalize(tbn2 * mapN);`);
  };
  ground = new THREE.Mesh(geo, groundMat); ground.receiveShadow = true; group.add(ground);
}

function buildSky() {
  skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { tNight: { value: Assets.tex('assets/tex/sky_night.jpg', { clamp: true }) }, tDusk: { value: Assets.tex('assets/tex/sky_dusk.jpg', { clamp: true }) }, tAurora: { value: Assets.tex('assets/tex/sky_aurora.jpg', { clamp: true }) }, uNight: { value: 1 }, uAurora: { value: 0 }, uSpin: { value: 0 }, uDim: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tNight, tDusk, tAurora; uniform float uNight, uAurora, uSpin, uDim; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float u = atan(d.z, d.x) / 6.2831853 + 0.5 + uSpin; float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.14159265;
        vec2 uv = vec2(fract(u), clamp(v * 1.9 - 0.9 * 0.0, 0.0, 1.0)); uv.y = clamp((d.y + 0.08) * 1.1, 0.0, 1.0);
        vec3 c = mix(texture2D(tDusk, uv).rgb, texture2D(tNight, uv).rgb, uNight); c = mix(c, texture2D(tAurora, uv).rgb, uAurora * uNight); gl_FragColor = vec4(c * uDim, 1.0); }` });
  sky = new THREE.Mesh(new THREE.SphereGeometry(480, 48, 24), skyMat); G.scene.add(sky);
  moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); moonDisc.scale.set(60, 60, 1); G.scene.add(moonDisc);
}

function lights() {
  hemi = new THREE.HemisphereLight(0x4a4a90, 0x2a1a10, 0.55); G.scene.add(hemi);
  moon = new THREE.DirectionalLight(0x9fb4ff, 0.7); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0008; moon.shadow.normalBias = 0.02;
  const sc = moon.shadow.camera; sc.left = sc.bottom = -28; sc.right = sc.top = 28; sc.near = 1; sc.far = 120; moonTarget = new THREE.Object3D(); G.scene.add(moonTarget); moon.target = moonTarget; G.scene.add(moon);
  G.scene.fog = new THREE.FogExp2(0x151030, 0.018);
}

// ── props ──────────────────────────────────────────────────────────────────
const KK = (n) => Assets.gltf(`assets/models/kk/${n}.gltf`);
async function place(name, x, z, { h, rot = Math.random() * 6.283, col = 0, kind, tint, emissive, scale } = {}) {
  const g = await KK(name); const obj = Assets.instance(g); if (h) Assets.fitHeight(obj, h); if (scale) obj.scale.multiplyScalar(scale);
  if (tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
  obj.position.set(x, terrainHeight(x, z), z); obj.rotation.y = rot; group.add(obj);
  const p = { obj, kind, x, z, lit: false }; props.push(p); if (col) colliders.push({ x, z, r: col, prop: p }); return p;
}
function procTree(x, z, kind) {
  if (genTrees[kind]) { const o = Assets.instance(genTrees[kind]); const s = (kind === 'pine' ? 6.5 : 5.2) * (0.85 + Math.random() * 0.4); Assets.fitHeight(o, s); o.position.set(x, terrainHeight(x, z) - 0.05, z); o.rotation.y = Math.random() * 6.283; group.add(o); props.push({ obj: o, kind: 'tree', x, z, tree: kind, pine: kind === 'pine' }); colliders.push({ x, z, r: 0.55 }); return o; }
  // low-poly stand-in tree: maple (orange crown) or snow pine (dark cones with snow caps)
  const t = new THREE.Group(); const r = (a, b) => a + Math.random() * (b - a);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, kind === 'pine' ? 1.6 : 1.3, 7), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 })); trunk.position.y = 0.7; trunk.castShadow = true; t.add(trunk);
  if (kind === 'pine') { for (let i = 0; i < 3; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * 0.35, 1.9, 8), new THREE.MeshStandardMaterial({ color: 0x1f4a2e, roughness: 0.9 })); cone.position.y = 1.9 + i * 1.1; cone.castShadow = true; t.add(cone);
      const snow = new THREE.Mesh(new THREE.ConeGeometry(1.52 - i * 0.35, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xe8f0ff, roughness: 0.95 })); snow.position.y = 2.6 + i * 1.1; t.add(snow); } }
  else { const cols = [0xd8541c, 0xf08a1a, 0xc8381a, 0xffb02a]; for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r(0.9, 1.4), 1), new THREE.MeshStandardMaterial({ color: cols[(Math.random() * 4) | 0], roughness: 0.9, flatShading: true })); s.position.set(r(-0.6, 0.6), r(1.8, 2.8), r(-0.6, 0.6)); s.castShadow = true; t.add(s); } }
  const s = r(0.9, 1.35); t.scale.setScalar(s); t.position.set(x, terrainHeight(x, z), z); t.rotation.y = Math.random() * 6.283; group.add(t); props.push({ obj: t, kind: 'tree', x, z, tree: kind }); colliders.push({ x, z, r: 0.45 });
  return t;
}
function makeCampfire() {
  const [x, z] = VALE.campfire; const y = terrainHeight(x, z); const fire = new THREE.Group(); fire.position.set(x, y, z);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283; const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0x5a5560, roughness: 1 })); st.position.set(Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8); st.castShadow = true; fire.add(st); }
  for (let i = 0; i < 3; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x3a2214 })); lg.rotation.set(0.3, i * 2.1, 1.2); lg.position.y = 0.25; fire.add(lg); }
  for (const [dx, dz] of [[1.6, 0.4], [-1.5, 0.6]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 7), new THREE.MeshStandardMaterial({ color: 0x4a3020 })); b.rotation.z = Math.PI / 2; b.position.set(dx, 0.16, dz); b.castShadow = true; fire.add(b); colliders.push({ x: x + dx, z: z + dz, r: 0.5 }); }
  const tex = flameTexture(); const geo = new THREE.BufferGeometry(); const N = 60; const pos = new Float32Array(N * 3), life = new Float32Array(N); for (let i = 0; i < N; i++) life[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fireSprites = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: 0xffa040, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fireSprites.userData.life = life; fire.add(fireSprites);
  campfireLight = new THREE.PointLight(0xff9a40, 50, 18, 1.6); campfireLight.position.y = 0.9; fire.add(campfireLight);
  group.add(fire); colliders.push({ x, z, r: 1.0 }); return fire;
}
function flameTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,200,120,0.6)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; }
function leafTexture(snow) { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.fillStyle = snow ? '#ffffff' : '#ff8a2a'; x.beginPath(); if (snow) x.arc(16, 16, 9, 0, 6.283); else x.ellipse(16, 16, 12, 6, 0.6, 0, 6.283); x.fill(); return new THREE.CanvasTexture(c); }
function makeParticles(kind, n, color) {
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 40; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; vel[i * 3] = Math.random() * 6.28; vel[i * 3 + 1] = 0.6 + Math.random() * 0.9; vel[i * 3 + 2] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: leafTexture(kind === 'snow'), color, size: kind === 'snow' ? 0.16 : 0.22, transparent: true, depthWrite: false, opacity: 0.95, sizeAttenuation: true })); pts.userData.vel = vel; pts.frustumCulled = false; G.scene.add(pts); particles[kind] = pts;
}
async function makeLantern(x, z, i) {
  const p = await place('hw_lantern_standing', x, z, { h: 2.4, col: 0.25, kind: 'lantern', rot: 0 }); p.index = i;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0 })); flame.position.set(x, terrainHeight(x, z) + 1.85, z); group.add(flame); p.flame = flame;
  const l = new THREE.PointLight(0xffa850, 0, 11, 1.7); l.position.copy(flame.position); group.add(l); p.light = l; lanternLights.push(p);
  interact.push({ pos: flame.position.clone().setY(terrainHeight(x, z) + 1), r: 2.2, prompt: () => p.lit ? '' : 'The lantern is dark. Ember would light it.', act: () => {}, cond: () => !p.lit });
  if (G.lanternsLit[i]) setLit(p, true, true);
}
export function setLit(p, on, silent) {
  p.lit = on; G.lanternsLit[p.index] = on; if (p.flame) p.flame.material.opacity = on ? 1 : 0;
  if (p.kind === 'pumpkin' && p.obj) p.obj.traverse((o) => { if (o.isMesh) { if (!o.userData.m) { o.material = o.material.clone(); o.userData.m = 1; } o.material.emissive = new THREE.Color(on ? 0xff7a1a : 0x000000); o.material.emissiveIntensity = on ? 1.4 : 0; } });
  if (!silent) { Sound.play('ember', 0.5, 0.8); if (lanternLights.every((q) => q.lit) && props.filter((q) => q.kind === 'pumpkin').every((q) => q.lit)) UI.toast(STR.allLit, 3.5); }
}
export function lightAll() { for (const p of props) if (p.kind === 'lantern' || p.kind === 'pumpkin') setLit(p, true, true); }
function makePond() {
  const q = VALE.pond; const geo = new THREE.CircleGeometry(1, 48); geo.rotateX(-Math.PI / 2);
  pondMat = new THREE.MeshStandardMaterial({ color: 0x14244c, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.92, emissive: 0x0a1a4a, emissiveIntensity: 0.5 });
  pondMesh = new THREE.Mesh(geo, pondMat); pondMesh.scale.set(q.rx, 1, q.rz); pondMesh.position.set(q.x, -0.08, q.z); pondMesh.receiveShadow = true; group.add(pondMesh);
  iceMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: Assets.tex('assets/tex/ice.jpg'), normalMap: Assets.tex('assets/tex/ice_n.jpg', { linear: true }), roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0 })); iceMesh.scale.set(q.rx, 1, q.rz); iceMesh.position.set(q.x, -0.04, q.z); group.add(iceMesh);
  for (const dx of [-3, 0, 3]) colliders.push({ x: q.x + dx, z: q.z, r: 4.0, pond: true });
  if (G.pondFrozen) freeze(true);
}
export function freeze(silent) {
  G.pondFrozen = true; for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i].pond) colliders.splice(i, 1);
  iceMesh.material.opacity = 1; pondMat.opacity = 0; groundMat.userData.u.uFrozen.value = 1;
  if (!silent) { Sound.play('freeze', 0.9); UI.toast(STR.frozen, 3); }
}
export function ringBurst(x, y, z, color, n = 30, speed = 3) { return Spells_burst && Spells_burst(x, y, z, color, n, speed); }
let Spells_burst = null; export function setBurst(fn) { Spells_burst = fn; }

// ── build ──────────────────────────────────────────────────────────────────
async function buildVale() {
  genTrees.maple = await Assets.gltf('assets/models/gen/maple.glb'); genTrees.pine = await Assets.gltf('assets/models/gen/pine.glb');
  buildGround(); makePond(); makeCampfire();
  makeParticles('leaves', 500, 0xffffff); makeParticles('snow', 700, 0xffffff);
  const [tx, tz] = VALE.tower; const r = mulberry(2027);
  { const g = await Assets.gltf('assets/models/gen/tower.glb'); const tower = g ? Assets.instance(g) : new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 12, 16), new THREE.MeshStandardMaterial({ color: 0x5a5a70 }));
    Assets.fitHeight(tower, 15); tower.position.set(tx, terrainHeight(tx, tz) - 0.1, tz); tower.rotation.y = Math.PI; group.add(tower); colliders.push({ x: tx, z: tz, r: 3.6 });
    const wl = new THREE.PointLight(0xffc070, 20, 12, 1.8); wl.position.set(tx, 5.5, tz + 3.2); group.add(wl); props.push({ obj: wl, kind: 'towerlight' });
    const dl = new THREE.PointLight(0xffb060, 14, 8, 1.8); dl.position.set(VALE.door[0], terrainHeight(...VALE.door) + 2.2, VALE.door[1] + 0.8); group.add(dl);
    interact.push({ pos: new THREE.Vector3(VALE.door[0], terrainHeight(...VALE.door), VALE.door[1] + 0.6), r: 2.8, prompt: STR.pDoorIn, act: () => { Sound.play('door', 0.9); G.enterLair(); } });
    interact.push({ pos: new THREE.Vector3(VALE.gate[0], terrainHeight(...VALE.gate), VALE.gate[1] - 0.5), r: 3, prompt: STR.pRoad, act: () => G.enterRoad() }); }
  // village props
  await place('mh_building_well_blue', ...toW(1250, 1800), { h: 2.6, col: 1.1, kind: 'well', rot: 0.4 });
  await place('hw_post', ...toW(965, 1925), { h: 2.2, col: 0.2, kind: 'signpost' });
  for (const [x, y] of [[760, 2160], [1130, 2080], [1620, 2300], [300, 2220], [1480, 1740]]) await place('hw_pumpkin_orange_jackolantern', ...toW(x, y), { h: 0.75, col: 0.5, kind: 'pumpkin' });
  for (const [x, y] of [[700, 2120], [1180, 2120], [360, 2260]]) await place('hw_pumpkin_orange_small', ...toW(x, y), { h: 0.4, kind: 'deco' });
  const lanternSpots = [[815, 1520], [1000, 1520], [815, 1780], [1000, 1780], [815, 2190], [1000, 2190], [1300, 1930], [560, 1860]];
  for (const [i, [x, y]] of lanternSpots.entries()) await makeLantern(...toW(x, y), i);
  for (const [x, y, rot] of [[330, 1770, 0], [470, 1770, 0], [1500, 1700, 0.5]]) await place('mh_fence_wood_straight', ...toW(x, y), { h: 1.1, col: 0.9, kind: 'fence', rot });
  await place('hw_arch_gate', ...toW(1540, 2440), { h: 4.2, kind: 'gate', rot: 0 });
  await place('hw_bench', ...toW(640, 2050), { h: 0.8, col: 0.6, kind: 'bench', rot: 0.3 });
  await place('hw_crypt', ...toW(1650, 1450), { h: 3.2, col: 1.8, kind: 'crypt', rot: -0.6 });
  await place('fb_table_small', ...toW(1380, 2180), { h: 0.9, col: 0.6, kind: 'cart' });
  for (const [x, y] of [[1430, 2140], [1340, 2210]]) await place('hw_pumpkin_yellow', ...toW(x, y), { h: 0.5, kind: 'deco' });
  // doghouse: a small wooden hut
  { const [x, z] = VALE.doghouse; const hut = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 })); body.position.y = 0.5; body.castShadow = true; hut.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.8 })); roof.position.y = 1.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; hut.add(roof);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), new THREE.MeshBasicMaterial({ color: 0x120a06 })); hole.position.set(0, 0.45, 0.81); hut.add(hole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xb0b8c8, metalness: 0.6, roughness: 0.4 })); bowl.position.set(1.0, 0.06, 0.9); hut.add(bowl);
    hut.position.set(x, terrainHeight(x, z), z); group.add(hut); colliders.push({ x, z, r: 1.0 }); props.push({ obj: hut, kind: 'doghouse', x, z }); }
  // snowman, logs, rune, frost stones in the Winterwood
  { const [x, z] = toW(1120, 1080); const sm = new THREE.Group(); const wm = new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.95 }); for (const [y, rr] of [[0.5, 0.55], [1.25, 0.42], [1.85, 0.3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 12), wm); b.position.y = y; b.castShadow = true; sm.add(b); }
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x241a60 })); hat.position.y = 2.4; sm.add(hat); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xff7a1a })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.85, 0.32); sm.add(nose);
    sm.position.set(x, terrainHeight(x, z), z); group.add(sm); colliders.push({ x, z, r: 0.7 }); props.push({ obj: sm, kind: 'snowman', x, z }); }
  for (const [x, y] of [[700, 330], [1500, 720]]) { const [wx, wz] = toW(x, y); const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 })); lg.rotation.z = Math.PI / 2; lg.rotation.y = Math.random() * 3; lg.position.set(wx, terrainHeight(wx, wz) + 0.28, wz); lg.castShadow = true; group.add(lg); colliders.push({ x: wx, z: wz, r: 1.1 }); }
  { const [x, z] = toW(790, 730); const rune = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0x5a6a80, roughness: 0.8 })); rune.position.set(x, terrainHeight(x, z) + 0.09, z); group.add(rune);
    const glyph = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: Assets.tex('assets/img/rune.webp'), transparent: true })); glyph.rotation.x = -Math.PI / 2; glyph.position.set(x, terrainHeight(x, z) + 0.19, z); group.add(glyph); props.push({ obj: glyph, kind: 'rune', x, z });
    const rl = new THREE.PointLight(0x8ac8ff, 8, 5, 1.8); rl.position.set(x, terrainHeight(x, z) + 0.6, z); group.add(rl); props.push({ obj: rl, kind: 'runelight' });
    interact.push({ pos: rune.position.clone(), r: 2.2, prompt: STR.pRune, act: () => UI.say(...STR.rune) }); }
  // trees: autumn pines + maples around the village, snow pines north; a ring beyond the bounds hides the edge
  const busy = (x, z) => pathDist(x, z) < 1.6 || inPond(x, z) || Math.hypot(x - VALE.pond.x, z - VALE.pond.z) < 7.5 || Math.hypot(x - tx, z - tz) < 6 || colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 2.2) || Math.hypot(x - VALE.gate[0], z - VALE.gate[1]) < 4 || Math.hypot(x - VALE.campfire[0], z - VALE.campfire[1]) < 4.5;
  let tries = 0;
  for (let n = 0; n < 26 && tries < 900; tries++) { const x = VALE.minX + 1 + r() * (VALE.w - 2), z = SPLIT_Z + 1.5 + r() * (VALE.maxZ - SPLIT_Z - 3); if (busy(x, z)) continue; if (r() < 0.5) await place(r() < 0.5 ? 'hw_tree_pine_orange_large' : 'hw_tree_pine_yellow_large', x, z, { h: 5 + r() * 2, col: 0.5, kind: 'tree' }); else procTree(x, z, 'maple'); n++; }
  for (let n = 0; n < 30 && tries < 2200; tries++) { const x = VALE.minX + 1 + r() * (VALE.w - 2), z = VALE.minZ + 1 + r() * (SPLIT_Z - VALE.minZ - 3); if (busy(x, z)) continue; procTree(x, z, 'pine'); n++; }
  for (let i = 0; i < 70; i++) { const a = (i / 70) * 6.283; const x = Math.cos(a) * 25 + (r() - 0.5) * 3, z = 0.75 + Math.sin(a) * 33 + (r() - 0.5) * 3; if (Math.hypot(x - VALE.gate[0], z - VALE.gate[1]) < 3) continue; procTree(x, z, z < SPLIT_Z ? 'pine' : 'maple'); }
  // the secret birch by the well
  { const [x, z] = toW(1150, 1690); await place('hw_tree_pine_yellow_medium', x, z, { h: 4.2, col: 0.5, kind: 'tree', rot: 1 }); interact.push({ pos: new THREE.Vector3(x, terrainHeight(x, z), z), r: 2.4, prompt: STR.pDig, act: () => { UI.toast(G.flags.dug ? STR.dugAgain : STR.dug, 3.5); if (!G.flags.dug) { G.flags.dug = true; G.inv.stone = (G.inv.stone || 0) + 1; Sound.play('shard', 0.8, 0.8); } } }); }
  // shinies scattered about
  const shinies = [['acorn', 1000, 2300], ['acorn', 450, 1400], ['button', 1620, 2060], ['feather', 300, 980], ['stone', 1300, 600], ['acorn', 1700, 1900]];
  for (const [i, [kind, x, y]] of shinies.entries()) { if (G.flags['shiny' + i]) continue; const [wx, wz] = toW(x, y); const m = new THREE.Mesh(kind === 'acorn' ? new THREE.SphereGeometry(0.12, 10, 8) : kind === 'button' ? new THREE.CylinderGeometry(0.1, 0.1, 0.04, 14) : kind === 'feather' ? new THREE.PlaneGeometry(0.3, 0.1) : new THREE.DodecahedronGeometry(0.11, 0), new THREE.MeshStandardMaterial({ color: kind === 'acorn' ? 0xd0a040 : kind === 'button' ? 0xe0b050 : kind === 'feather' ? 0xf0f0ff : 0x8a9aa8, metalness: kind === 'button' ? 0.8 : 0.1, roughness: 0.5, emissive: 0x332200, side: THREE.DoubleSide }));
    m.position.set(wx, terrainHeight(wx, wz) + 0.15, wz); group.add(m); const sp = m.position.clone(); props.push({ obj: m, kind: 'shiny', shiny: true });
    interact.push({ pos: sp, r: 2, prompt: STR.pShiny(STR.shinies[kind]), act: () => { G.flags['shiny' + i] = true; G.inv[kind] = (G.inv[kind] || 0) + 1; group.remove(m); Sound.play('shard', 0.7, 1.3); UI.toast(`You pocket ${STR.shinies[kind]}.`); }, cond: () => !G.flags['shiny' + i] }); }
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── public API ─────────────────────────────────────────────────────────────
export const World = {
  props, colliders, interact, group: null, SPLIT_Z, snowDepth: 0, zone: null, wolvesOut: false,
  async init(g) {
    G = g; group = new THREE.Group(); this.group = group; G.scene.add(group); buildSky(); lights(); await buildVale();
    G.surfaceAt = (pos) => this.surface(pos);
    G.areas.vale = { group, interact, colliders, spawn: () => ({ pos: new THREE.Vector3(VALE.door[0], terrainHeight(...VALE.door), VALE.door[1] + 1.2), yaw: Math.PI }),
      heightAt: terrainHeight, clamp: (p) => { p.x = THREE.MathUtils.clamp(p.x, VALE.minX, VALE.maxX); p.z = THREE.MathUtils.clamp(p.z, VALE.minZ, VALE.maxZ); },
      collide: (p, r) => { for (const c of colliders) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); } } },
      onEnter: () => { this.zone = null; Sound.stopLoop('hearth'); Sound.stopLoop('night'); G.scene.fog.density = 0.016; } };
  },
  towerDoor() { return new THREE.Vector3(VALE.door[0], terrainHeight(...VALE.door), VALE.door[1]); },
  allLit() { return props.filter((q) => q.kind === 'lantern' || q.kind === 'pumpkin').every((q) => q.lit); },
  setAurora(a) { skyMat.uniforms.uAurora.value = a; },
  surface(pos) { if (G.area === 'lair' || G.area === 'chamber' || G.area.startsWith('room_')) return 'step_wood'; if (G.area === 'town') return Math.hypot(pos.x, pos.z - 620) < 13.5 ? 'step_stone' : 'step_grass'; if (G.area === 'road') return pos.z - -600 > -70 ? 'step_grass' : 'step_stone'; if (G.pondFrozen && inPond(pos.x, pos.z)) return 'step_ice'; return pos.z < SPLIT_Z ? 'step_snow' : (pathDist(pos.x, pos.z) < 0.9 ? 'step_stone' : 'step_grass'); },
  update(dt) {
    const p = G.player; const inVale = G.area === 'vale' || G.area === 'town';
    // time of day drives sky, lights and fog
    const n = night(G), d = dusk(G); skyMat.uniforms.uNight.value = n; skyMat.uniforms.uSpin.value = G.clock * 0.25; skyMat.uniforms.uDim.value = inVale ? 1 : 0.35;
    const moonA = (G.clock - 0.5) * 6.283; moon.position.set(Math.sin(moonA) * 60, 25 + 30 * Math.cos(moonA) * -1, Math.cos(moonA) * 40).add(p.pos); moonTarget.position.copy(p.pos);
    moon.intensity = (inVale ? 0.35 + 0.55 * n + 0.6 * (1 - n) * (1 - d) : 0.05) * (this.moonBoost || 1); moon.color.setHSL(0.62 - d * 0.55, 0.5, 0.75 - d * 0.1);
    if (moonDisc) { moonDisc.position.copy(moon.position).sub(p.pos).normalize().multiplyScalar(420).add(G.camera.getWorldPosition(new THREE.Vector3())); moonDisc.material.opacity = inVale ? n * 0.9 : 0; moonDisc.material.color.setHSL(0.62, 0.3, this.moonBoost > 1 ? 1 : 0.9); }
    hemi.intensity = inVale ? 0.35 + 0.25 * (1 - n) : 0.45; hemi.color.setHSL(0.68 - d * 0.6, 0.5, 0.35 + d * 0.15); hemi.groundColor.setHSL(0.07, 0.5, 0.12);
    G.scene.fog.color.setHSL(0.68 - d * 0.6, 0.45, inVale ? 0.08 + 0.06 * (1 - n) + d * 0.06 : 0.03);
    G.grade.uniforms.uWarm.value = inVale ? d * 0.8 : 0.4;
    if (!inVale) return;
    // zones + ambience
    const winter = p.pos.z < SPLIT_Z; if (G.area === 'vale' && this.zone !== winter) { this.zone = winter; UI.banner(winter ? STR.zoneWinter : STR.zoneVale); Music.play(winter ? 'winter' : 'vale'); Sound.stopLoop(winter ? 'autumn' : 'wind'); Sound.loop(winter ? 'wind' : 'autumn', 0.35); }
    if (winter) this.snowDepth = Math.min(1, this.snowDepth + dt / 240); else this.snowDepth = Math.max(0, this.snowDepth - dt / 600); groundMat.userData.u.uSnowDepth.value = this.snowDepth;
    // lanterns breathe, fire flickers
    const t = G.t; for (const l of lanternLights) { const want = l.lit ? (22 + Math.sin(t * 9 + l.index) * 2 + Math.sin(t * 23 + l.index * 2) * 1.2) * (this.lanternBoost || 1) : 0; l.light.intensity += (want - l.light.intensity) * 0.2; }
    campfireLight.intensity = 48 + Math.sin(t * 11) * 6 + Math.sin(t * 29) * 3.5;
    const life = fireSprites.userData.life, pos = fireSprites.geometry.attributes.position; for (let i = 0; i < life.length; i++) { life[i] += dt * (0.9 + (i % 5) * 0.12); if (life[i] > 1) life[i] -= 1; const k = life[i]; pos.setXYZ(i, Math.sin(i * 7.1 + t * 3) * 0.25 * (1 - k), 0.3 + k * 1.6, Math.cos(i * 3.7 + t * 2.5) * 0.25 * (1 - k)); } pos.needsUpdate = true; fireSprites.material.opacity = 0.9; fireSprites.material.size = 0.55;
    // falling leaves and snow follow the player
    const warm = THREE.MathUtils.clamp((p.pos.z - SPLIT_Z + 4) / 8, 0, 1);
    for (const [kind, pts] of Object.entries(particles)) { const amt = kind === 'snow' ? (1 - warm) * (0.5 + 0.5 * n) : warm; pts.material.opacity = amt * 0.95; if (amt <= 0.01) { pts.visible = false; continue; } pts.visible = true;
      const a = pts.geometry.attributes.position, v = pts.userData.vel; for (let i = 0; i < a.count; i++) { let x = a.getX(i), y = a.getY(i), z = a.getZ(i); y -= v[i * 3 + 1] * dt * (kind === 'snow' ? 0.8 : 1); x += Math.sin(t * 1.3 + v[i * 3]) * dt * 0.6 + dt * 0.3; z += Math.cos(t * 0.9 + v[i * 3]) * dt * 0.4;
        if (y < terrainHeight(x, z) - 0.2 || Math.abs(x - p.pos.x) > 22 || Math.abs(z - p.pos.z) > 22) { x = p.pos.x + (Math.random() - 0.5) * 40; z = p.pos.z + (Math.random() - 0.5) * 40; y = p.pos.y + 6 + Math.random() * 8; } a.setXYZ(i, x, y, z); } a.needsUpdate = true; }
    if (iceMesh.material.opacity > 0 && iceMesh.material.opacity < 1) iceMesh.material.opacity = Math.min(1, iceMesh.material.opacity + dt);
  },
  render() { G.camera.getWorldPosition(sky.position); },
  hitProp(pos, kind) {
    // a spell reached `pos`: light lanterns, shake trees, freeze the pond
    if (G.area !== 'vale') return false;
    if (kind === 'frost' && !G.pondFrozen && inPond(pos.x, pos.z) && pos.y < 1.2) { freeze(); return true; }
    for (const p of props) {
      if (!p.obj || typeof p.x !== 'number' || p.kind === 'runelight') continue; const dx = pos.x - p.x, dz = pos.z - p.z; const r = p.kind === 'tree' ? 1.6 : p.kind === 'lantern' ? 0.7 : p.kind === 'pumpkin' ? 0.8 : 0;
      if (!r || dx * dx + dz * dz > r * r) continue;
      if ((p.kind === 'lantern' || p.kind === 'pumpkin') && kind === 'ember' && !p.lit) { setLit(p, true); return true; }
      if (p.kind === 'tree') { Spells_burst && Spells_burst(p.x, terrainHeight(p.x, p.z) + 2.6, p.z, kind === 'frost' || p.tree === 'pine' ? 0xffffff : 0xff8a2a, 26, 2.2, 1.8); return true; }
      return true;
    }
    return false;
  },
  terrainHeight, inPond, setLit, lightAll, freeze, VALE, toW,
};
// time helpers imported lazily to avoid a cycle with main.js
function night(G) { const c = G.clock; return THREE.MathUtils.smoothstep(c, 0.72, 0.88) * (1 - THREE.MathUtils.smoothstep(c, 0.2, 0.32)); }
function dusk(G) { return Math.max(0, 1 - Math.abs(G.clock - 0.76) / 0.1) + Math.max(0, 1 - Math.abs(G.clock - 0.27) / 0.08); }
