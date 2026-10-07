// The Vesper Road: Gravehill, the Nebula River, the Star Causeway and the Hollow Keep, in first person.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, Music, store, $ } from './audio.js';
import { UI, STR } from './ui.js';
import { Player } from './player.js';
import { Spells, burst, ring } from './spells.js';
import { enterArea, transition, save } from './main.js';

const OZ = -600;                               // the road lives far south of the Vale; z runs from 0 (start) to -236 (the King)
const Z = (v) => OZ + v;
const ZONES = [{ id: 'grave', name: 'GRAVEHILL', z0: 0, z1: -70 }, { id: 'river', name: 'THE NEBULA RIVER', z0: -70, z1: -130 }, { id: 'causeway', name: 'THE STAR CAUSEWAY', z0: -130, z1: -200 }, { id: 'keep', name: 'THE HOLLOW KEEP', z0: -200, z1: -245 }];
const WAYSTONES = [[3, -6], [3, -66], [3, -128], [3, -192]];
const GATE_Z = -200, KING = { x: 0, z: -228, hp: 900, r: 2.6 };
const ET = {
  wisp: { hp: 20, sp: 3.6, r: 0.5, dmg: 10, fly: 1 },
  thrall: { hp: 40, sp: 2.3, r: 0.55, dmg: 15, model: 'skel_minion', h: 1.75, clips: { idle: 'Idle', walk: 'Walking_A', attack: 'Unarmed_Melee_Attack_Punch_A', hit: 'Hit_A', death: 'Death_A' } },
  bat: { hp: 15, sp: 4.2, r: 0.45, dmg: 8, fly: 1, model: 'bat', h: 0.9, clips: { idle: 'Bat_Flying', walk: 'Bat_Flying', attack: 'Bat_Attack', hit: 'Bat_Hit', death: 'Bat_Death' } },
  knight: { hp: 150, sp: 2.0, r: 0.9, dmg: 25, elite: 1, model: 'gen/knight', h: 2.6, clips: { idle: 'Idle', walk: 'Idle', attack: 'Attack', hit: 'Idle', death: 'Idle' } },
  wraith: { hp: 220, sp: 2.8, r: 1.1, dmg: 25, elite: 1, fly: 1, model: 'gen/wraith', h: 2.4, hover: 1.2 },
  sentinel: { hp: 200, sp: 0.6, r: 1.2, dmg: 20, elite: 1, fly: 1, model: 'gen/sentinel', h: 2.2, hover: 1.8 },
};
const SPAWNS = [ // [trigger z, [type, x, z]...] trigger fires when the player passes z (going north = more negative)
  [-8, [['wisp', -3, -17], ['wisp', 3, -18], ['wisp', 0, -21]]],
  [-20, [['thrall', -4, -30], ['thrall', 4, -31], ['wisp', 0, -33]]],
  [-33, [['thrall', -6, -43], ['thrall', 0, -44], ['thrall', 6, -43], ['wisp', -9, -41], ['wisp', 9, -41]]],
  [-48, [['knight', 0, -60], ['thrall', -5, -58], ['thrall', 5, -58]]],
  [-72, [['bat', -5, -80], ['bat', 5, -80], ['thrall', -2, -82], ['thrall', 2, -82]]],
  [-86, [['wisp', -1, -96], ['wisp', 1, -100], ['wisp', -1, -104], ['wisp', 1, -108], ['bat', -4, -100], ['bat', 4, -104]]],
  [-114, [['wraith', 0, -124], ['bat', -6, -122], ['bat', 6, -122]]],
  [-134, [['thrall', -2, -144], ['thrall', 2, -144], ['thrall', 0, -147], ['bat', -7, -142]]],
  [-150, [['wisp', -3, -158], ['wisp', 3, -158], ['bat', 9, -160], ['bat', -9, -160]]],
  [-160, [['sentinel', 0, -170], ['thrall', -8, -166], ['thrall', 8, -166]]],
  [-182, [['thrall', -2, -190], ['thrall', 2, -190], ['bat', -6, -188], ['bat', 6, -188], ['wisp', 0, -193]]],
];
let G, group, lights = [], enemies = [], pickups = [], marks = [], waystoneObjs = [], gate, gateBars, king, kingMixer, kingActs = {}, kingCur, riverMat, cloudMat, zoneId, spawned = [], dead = false, deadT = 0, beamMesh, bossBeam;
const state = { shards: 0, boss: null, enemies, lit: [], respawn: -1, gateOpen: false, timing: false, time: 0, bossSeen: false };
const KK = (n) => Assets.gltf(`assets/models/kk/${n}.gltf`);

function xRange(z) { // walkable half-width along the road
  const v = z - OZ; if (v > -70) return 14; if (v > -130) return v > -76 || v < -124 ? 12 : 3.6; if (v > -200) return v > -176 && v < -160 ? 12 : 5; return 13;
}
async function put(name, x, z, { h, rot = Math.random() * 6.283, col = 0, tint } = {}) {
  const g = await KK(name); const obj = Assets.instance(g); if (h) Assets.fitHeight(obj, h); if (tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
  obj.position.set(x, 0, Z(z)); obj.rotation.y = rot; group.add(obj); if (col) colliders.push({ x, z: Z(z), r: col }); return obj;
}
const colliders = [];

async function build() {
  const T = (n, l) => Assets.tex(`assets/tex/${n}.jpg`, { linear: l });
  const mat = (n, extra = {}) => { const m = new THREE.MeshStandardMaterial({ map: T(n), normalMap: T(n + '_n', true), roughness: 0.95, ...extra }); m.map.repeat.set(16, 40); m.normalMap.repeat.set(16, 40); return m; };
  const slab = (w, len, zc, m, y = 0) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(w, len), m); g.rotation.x = -Math.PI / 2; g.position.set(0, y, Z(zc)); g.receiveShadow = true; group.add(g); return g; };
  slab(40, 76, -35, mat('moss')); slab(40, 16, -73, mat('moss')); slab(40, 16, -127, mat('moss'));
  const path = slab(3.2, 76, -35, mat('dirt'), 0.02); path.material.map.repeat.set(2, 30); path.material.normalMap.repeat.set(2, 30);
  // the river and its bridge
  riverMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: { value: 0 }, tex: { value: T('river') } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uT; uniform sampler2D tex; varying vec2 vUv; void main(){ vec2 uv = vUv * vec2(6.0, 4.0); vec3 a = texture2D(tex, uv + vec2(uT * 0.05, uT * 0.02)).rgb; vec3 b = texture2D(tex, uv * 1.7 - vec2(uT * 0.03, 0.0)).rgb; vec3 c = mix(a, b, 0.5) * vec3(0.9, 0.8, 1.6); float glow = pow(max(c.b, 0.0), 2.0); gl_FragColor = vec4(c + glow * 0.5, 1.0); }` });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(120, 44), riverMat); river.rotation.x = -Math.PI / 2; river.position.set(0, -3, Z(-100)); group.add(river);
  const rl = new THREE.PointLight(0x9a60ff, 40, 50, 1.3); rl.position.set(0, 1, Z(-100)); group.add(rl);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 50), mat('cobble', {})); bridge.material.map.repeat.set(3, 18); bridge.material.normalMap.repeat.set(3, 18); bridge.position.set(0, -0.6, Z(-100)); bridge.receiveShadow = true; bridge.castShadow = true; group.add(bridge);
  for (const sx of [-3.6, 3.6]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 50), new THREE.MeshStandardMaterial({ color: 0x24183a, roughness: 0.9 })); rail.position.set(sx, 0.5, Z(-100)); group.add(rail); }
  for (const [x, z] of [[-4.5, -75], [4.5, -75], [-4.5, -125], [4.5, -125]]) await put('hw_pillar', x, z, { h: 2.6, col: 0.6, rot: 0 });
  // the causeway over the cloud sea
  cloudMat = new THREE.MeshStandardMaterial({ map: T('clouds'), roughness: 1, color: 0x9090c0, emissive: 0x202040, emissiveIntensity: 0.4 }); cloudMat.map.repeat.set(8, 8);
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(200, 130), cloudMat); clouds.rotation.x = -Math.PI / 2; clouds.position.set(0, -4, Z(-180)); group.add(clouds);
  const cause = new THREE.Mesh(new THREE.BoxGeometry(11, 1.5, 70), mat('cobble')); cause.material.map.repeat.set(4, 24); cause.material.normalMap.repeat.set(4, 24); cause.position.set(0, -0.75, Z(-165)); cause.receiveShadow = true; group.add(cause);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.5, 32), mat('cobble')); plaza.material.map.repeat.set(6, 6); plaza.position.set(0, -0.75, Z(-168)); plaza.receiveShadow = true; group.add(plaza);
  for (let z = -136; z > -198; z -= 7) for (const side of [-1, 1]) spire(side * (z < -160 && z > -176 ? 14.5 : 7.5), z, 9 + Math.random() * 5);
  // the keep courtyard
  const court = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 1.5, 40), mat('court')); court.material.map.repeat.set(6, 6); court.position.set(0, -0.75, Z(-222)); court.receiveShadow = true; group.add(court);
  const connector = new THREE.Mesh(new THREE.BoxGeometry(11, 1.5, 12), mat('cobble')); connector.position.set(0, -0.75, Z(-203)); group.add(connector);
  for (let i = 0; i < 14; i++) { const a = Math.PI * 0.15 + (i / 13) * Math.PI * 1.7; spire(Math.cos(a) * 19, -222 + Math.sin(a) * 19, 12 + (i % 3) * 3); }
  // graves and dead trees on Gravehill, a fence line, lantern posts along the path
  const r = mulberry(77);
  for (let i = 0; i < 26; i++) { const x = (r() - 0.5) * 26, z = -6 - r() * 58; if (Math.abs(x) < 2.2) continue; await put(['hw_grave_A', 'hw_grave_B', 'hw_gravestone', 'hw_gravemarker_A'][i % 4], x, z, { h: 1.2 + r() * 0.5, col: 0.5 }); }
  for (let i = 0; i < 12; i++) { const x = (r() - 0.5) * 30, z = -4 - r() * 62; if (Math.abs(x) < 4) continue; await put(r() < 0.6 ? 'hw_tree_dead_large' : 'hw_tree_dead_medium', x, z, { h: 5 + r() * 3, col: 0.5 }); }
  for (let z = -3; z > -66; z -= 9) for (const sx of [-2.4, 2.4]) { const p = await put('hw_post_lantern', sx, z, { h: 2.4, rot: 0 }); const l = new THREE.PointLight(0xffa850, 16, 9, 1.8); l.position.set(sx, 2.0, Z(z)); group.add(l); lights.push(l); }
  for (const [x, z] of [[-10, -10], [10, -10], [-10, -40], [10, -40]]) await put('hw_fence', x, z, { h: 1.1, rot: 0 });
  await put('hw_crypt', -11, -24, { h: 3.4, col: 1.8, rot: 0.8 }); await put('hw_shrine_candles', 9, -50, { h: 1.8, col: 0.8, rot: -0.5 });
  interact.push({ pos: new THREE.Vector3(-9.5, 0, Z(-24)), r: 3, prompt: STR.pLore, cond: () => !(G.flags.lore || []).includes('shards'), act: () => G.cozyRef && G.cozyRef.readLore('shards') });
  interact.push({ pos: new THREE.Vector3(6, 0, Z(-212)), r: 3, prompt: STR.pLore, cond: () => !(G.flags.lore || []).includes('wolves'), act: () => G.cozyRef && G.cozyRef.readLore('wolves') });
  // the gravekeeper (a hooded skeleton mage standing in for the old man, lantern in hand)
  { const g = await Assets.gltf('assets/models/skel_mage.glb'); if (g) { const keeper = Assets.instance(g); Assets.fitHeight(keeper, 1.8); keeper.position.set(-3.2, 0, Z(-4)); keeper.rotation.y = 1.2; group.add(keeper); const mx = new THREE.AnimationMixer(keeper); const idle = mx.clipAction(g.animations.find((c) => c.name === 'Idle')); idle.play(); state.keeperMixer = mx;
      const kl = new THREE.PointLight(0xff9a3a, 10, 6, 1.8); kl.position.set(-2.6, 1.2, Z(-4)); group.add(kl); colliders.push({ x: -3.2, z: Z(-4), r: 0.6 });
      interact.push({ pos: new THREE.Vector3(-3.2, 0, Z(-4)), r: 3, prompt: STR.pTalk, act: () => UI.say(...STR.keeper) }); } }
  // waystones
  for (const [i, [x, z]] of WAYSTONES.entries()) { const w = new THREE.Group(); const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a50, roughness: 0.8 })); stone.position.y = 1.1; stone.castShadow = true; w.add(stone);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 24), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x9fd0ff, emissiveIntensity: 0.2 })); rune.position.set(0, 1.5, 0.4); w.add(rune);
    const l = new THREE.PointLight(0x9fd0ff, 0, 9, 1.8); l.position.y = 1.8; w.add(l); w.position.set(x, 0, Z(z)); group.add(w); colliders.push({ x, z: Z(z), r: 0.7 }); waystoneObjs.push({ obj: w, rune, light: l, x, z: Z(z) }); }
  // the gate into the keep
  gate = await put('hw_arch_gate', 0, GATE_Z, { h: 7, rot: 0 }); gateBars = new THREE.Group(); for (let i = -4; i <= 4; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.5, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8, roughness: 0.4 })); bar.position.set(i * 0.55, 2.75, 0); gateBars.add(bar); }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 })); eye.position.set(0, 6.3, 0); gateBars.add(eye); gateBars.position.set(0, 0, Z(GATE_Z)); group.add(gateBars);
  interact.push({ pos: new THREE.Vector3(0, 0, Z(GATE_Z + 2)), r: 4, prompt: () => STR.gate(state.shards), act: () => {}, cond: () => !state.gateOpen });
  // the King
  { const g = await Assets.gltf('assets/models/gen/king.glb'); if (g) { king = Assets.instance(g); Assets.fitHeight(king, 7.5); king.position.set(KING.x, 0, Z(KING.z)); king.visible = false; group.add(king); kingMixer = new THREE.AnimationMixer(king); for (const c of g.animations) kingActs[c.name] = kingMixer.clipAction(c);
      const eyes = new THREE.PointLight(0xff2020, 0, 26, 1.3); eyes.position.set(0, 6, 1.5); king.add(eyes); king.userData.eyes = eyes; } }
  beamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); beamMesh.visible = false; group.add(beamMesh);
  bossBeam = beamMesh.clone(); bossBeam.material = beamMesh.material.clone(); group.add(bossBeam);
  group.add(new THREE.HemisphereLight(0x6060c0, 0x100818, 0.7));
  // violet star-lamps along the causeway and braziers around the courtyard so the back half of the road is not pitch dark
  for (const z of [-140, -152, -164, -176, -188]) for (const sx of [-4.2, 4.2]) { const l = new THREE.PointLight(0xa070ff, 10, 12, 1.8); l.position.set(sx, 2.2, Z(z)); group.add(l); const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xc8a0ff })); o.position.copy(l.position); group.add(o); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x1a1430 })); post.position.set(sx, 1.1, Z(z)); group.add(post); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; const x = Math.cos(a) * 11, z = -222 + Math.sin(a) * 11; const l = new THREE.PointLight(0xff6030, 6, 10, 1.8); l.position.set(x, 2.2, Z(z)); group.add(l); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x2a2030, metalness: 0.6 })); bowl.position.set(x, 1.1, Z(z)); group.add(bowl); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xff8040 })); fl.position.set(x, 1.7, Z(z)); group.add(fl); colliders.push({ x, z: Z(z), r: 0.6 }); }
}
function spire(x, z, h) { const s = new THREE.Mesh(new THREE.ConeGeometry(1.1, h, 7), new THREE.MeshStandardMaterial({ color: 0x120c22, roughness: 0.9 })); s.position.set(x, h / 2 - 1, Z(z)); s.castShadow = true; group.add(s); const w = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc060ff })); w.position.set(x, h * 0.55, Z(z) + 1.05); group.add(w); }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const interact = [];

// ── enemies ────────────────────────────────────────────────────────────────
async function spawn(type, x, z) {
  const d = ET[type]; const e = { type, d, pos: new THREE.Vector3(x, 0, Z(z)), home: new THREE.Vector3(x, 0, Z(z)), hp: d.hp, max: d.hp, r: d.r, t: 0.6 + Math.random(), st: 'idle', yaw: 0, ph: Math.random() * 6.28, dead: false, burn: 0, slow: 0, flash: 0, hover: d.hover || 0, obj: null, mixer: null, acts: {} };
  e.hurt = (dmg, from) => hurtEnemy(e, dmg, from);
  if (type === 'wisp') { e.obj = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd0d0 })); e.obj.add(core); const l = new THREE.PointLight(0xff3030, 12, 7, 1.8); e.obj.add(l); e.light = l; }
  else { const g = await Assets.gltf(`assets/models/${d.model}.glb`); e.obj = Assets.instance(g); Assets.fitHeight(e.obj, d.h); if (g && g.animations.length) { e.mixer = new THREE.AnimationMixer(e.obj); for (const c of g.animations) e.acts[c.name] = e.mixer.clipAction(c); if (d.clips) play(e, d.clips.idle); } }
  if (d.elite) { const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3a3a, depthTest: false })); bar.position.y = d.h + 0.4; e.obj.add(bar); e.bar = bar; }
  group.add(e.obj); enemies.push(e); ring(x, 0, Z(z), 1.4, 0xff4040, 0.5); return e;
}
function play(e, name, once) { const a = e.acts[name]; if (!a || e.cur === a) return; if (e.cur) e.cur.fadeOut(0.2); a.reset().fadeIn(0.2); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play(); e.cur = a; }
function hurtEnemy(e, dmg, from) {
  if (e.dead) return; e.hp -= dmg; e.flash = 0.15; Sound.play('hit', 0.45); burst(e.pos.x, e.pos.y + e.hover + e.d.h * 0.5 || 0.6, e.pos.z, 0xc8b8ff, 6, 2.5, 0.35);
  if (e.d.clips && e.hp > 0) play(e, e.d.clips.hit, true);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; e.deadT = e.d.clips ? 1.6 : 0.01; Sound.play('death', e.d.elite ? 0.9 : 0.5, e.d.elite ? 0.8 : 1.2);
  burst(e.pos.x, e.pos.y + 0.8, e.pos.z, e.type === 'wisp' ? 0xff4040 : 0xb9a8ff, e.d.elite ? 60 : 18, e.d.elite ? 5 : 3, 0.9); ring(e.pos.x, 0, e.pos.z, e.d.elite ? 4 : 1.6, 0xc8b8ff, 0.6);
  if (e.d.clips) play(e, e.d.clips.death, true); else { e.obj.visible = false; }
  if (e.d.elite) { const k = new THREE.Group(); const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc8b8ff, emissiveIntensity: 1.5 })); shard.position.y = 1; k.add(shard); const l = new THREE.PointLight(0xc8b8ff, 14, 7, 1.8); l.position.y = 1.2; k.add(l);
    const x = THREE.MathUtils.clamp(e.pos.x, -xRange(e.pos.z) + 1, xRange(e.pos.z) - 1); k.position.set(x, 0, e.pos.z); group.add(k); const pk = { obj: k, pos: k.position.clone(), got: false }; pickups.push(pk);
    interact.push({ pos: pk.pos, r: 2.6, prompt: STR.pShard, cond: () => !pk.got, act: () => { pk.got = true; state.shards++; group.remove(k); Sound.play('shard', 1); UI.toast(STR.shard); ring(k.position.x, 0, k.position.z, 4, 0xffffff, 0.7); burst(k.position.x, 1, k.position.z, 0xffffff, 40, 4, 0.9); } }); G.shake = 0.5; }
}
function updateEnemy(e, dt) {
  const p = G.player; const d = e.d; const pp = p.pos; const dx = pp.x - e.pos.x, dz = pp.z - e.pos.z; const dd = Math.hypot(dx, dz) || 1; const nx = dx / dd, nz = dz / dd;
  if (e.mixer) e.mixer.update(dt); e.flash = Math.max(0, e.flash - dt); e.ph += dt; e.t -= dt;
  if (e.dead) { e.deadT -= dt; if (e.deadT <= 0) { group.remove(e.obj); e.gone = true; } return; }
  if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; burst(e.pos.x, e.pos.y + 1, e.pos.z, 0xff9a3a, 4, 1.5, 0.4); hurtEnemy(e, 3); if (e.dead) return; } }
  if (e.slow > 0) e.slow -= dt; const slow = e.slow > 0 ? 0.5 : 1;
  if (dd > 24 && e.st === 'idle') return;
  const go = (sx, sz, sp) => { e.pos.x += sx * sp * slow * dt; e.pos.z += sz * sp * slow * dt; const hw = xRange(e.pos.z) + (d.fly ? 6 : -0.3); e.pos.x = THREE.MathUtils.clamp(e.pos.x, -hw, hw); for (const c of colliders) { const cx = e.pos.x - c.x, cz = e.pos.z - c.z, cd = Math.hypot(cx, cz), m = c.r + e.r; if (cd < m && cd > 1e-4 && !d.fly) { e.pos.x += (cx / cd) * (m - cd); e.pos.z += (cz / cd) * (m - cd); } } if (Math.abs(sx) + Math.abs(sz) > 0.1) e.yaw = Math.atan2(sx, sz); };
  const near = dd < e.r + 0.5 + 0.4;
  if (e.type === 'wisp') { go(nx + Math.sin(e.ph * 3) * 0.5 * -nz, nz + Math.sin(e.ph * 3) * 0.5 * nx, d.sp); e.hover = 1 + Math.sin(e.ph * 4) * 0.2; if (near) { Player.hurt(d.dmg); killEnemy(e); } }
  else if (e.type === 'thrall') { if (e.st === 'wind') { if (e.t <= 0) { if (dd < 2.2) Player.hurt(d.dmg); e.st = 'idle'; e.t = 1.1; } } else if (dd < 1.6 && e.t <= 0) { e.st = 'wind'; e.t = 0.5; play(e, d.clips.attack, true); } else if (dd > 1.3) { go(nx, nz, d.sp); play(e, d.clips.walk); } else { e.yaw = Math.atan2(nx, nz); play(e, d.clips.idle); } }
  else if (e.type === 'bat') { const want = 7; const rad = dd > want + 1 ? 1 : dd < want - 1 ? -1 : 0; go(nx * rad + -nz * 0.8, nz * rad + nx * 0.8, d.sp); e.hover = 2.2 + Math.sin(e.ph * 3) * 0.4; e.yaw = Math.atan2(nx, nz);
    if (e.t <= 0 && dd < 16) { e.t = 2.1; Spells.foeShot(e.pos.clone().add(new THREE.Vector3(0, e.hover, 0)), pp.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(e.pos.clone().add(new THREE.Vector3(0, e.hover, 0))), 6, d.dmg, 0x5aa0ff, 0.16); play(e, d.clips.attack, true); } }
  else if (e.type === 'knight') { if (e.st === 'wind') { e.yaw = e.ang; if (e.t <= 0) { e.st = 'dash'; e.t = 0.6; } } else if (e.st === 'dash') { go(Math.sin(e.ang), Math.cos(e.ang), 16); if (dd < e.r + 0.7) Player.hurt(d.dmg); if (e.t <= 0) { e.st = 'idle'; e.t = 2.2; } } else { go(nx, nz, d.sp); if (near) Player.hurt(12); if (e.t <= 0 && dd < 14) { e.st = 'wind'; e.t = 0.7; e.ang = Math.atan2(nx, nz); play(e, d.clips.attack, true); } } }
  else if (e.type === 'wraith') { if (e.st === 'wind') { if (e.t <= 0) { ring(e.pos.x, 0, e.pos.z, 4.2, 0xff5aa0, 0.5); burst(e.pos.x, 1, e.pos.z, 0xff5aa0, 40, 6, 0.5); G.shake = 0.4; if (dd < 4.4) Player.hurt(d.dmg); e.st = 'idle'; e.t = 1.9; } } else { go(nx + -nz * 0.5 * Math.sin(e.ph), nz + nx * 0.5 * Math.sin(e.ph), d.sp); if (dd < 3.4 && e.t <= 0) { e.st = 'wind'; e.t = 0.65; } } e.hover = 1.2 + Math.sin(e.ph * 2) * 0.3; e.yaw = Math.atan2(nx, nz); }
  else if (e.type === 'sentinel') { go(Math.cos(e.ph * 0.5), Math.sin(e.ph * 0.7), d.sp); e.hover = 1.8 + Math.sin(e.ph * 1.5) * 0.3; e.obj.rotation.y += dt * 0.6;
    if (e.st === 'idle' && e.t <= 0) { e.st = 'warn'; e.t = 0.9; e.ang = Math.atan2(nx, nz) + 1.2; } else if (e.st === 'warn') { if (e.t <= 0) { e.st = 'beam'; e.t = 3.2; e.dir = Math.sin(Math.atan2(nx, nz) - e.ang) >= 0 ? 1 : -1; } } else if (e.st === 'beam') { e.ang += e.dir * 0.85 * dt; if (beamHits(e.pos.x, e.pos.z, e.ang, 20, 0.7)) Player.hurt(d.dmg); if (e.t <= 0) { e.st = 'idle'; e.t = 1.8; } }
    beamMesh.visible = e.st === 'beam' || e.st === 'warn'; if (beamMesh.visible) { const len = 20; beamMesh.scale.set(e.st === 'warn' ? 0.25 : 1, len, e.st === 'warn' ? 0.25 : 1); beamMesh.position.set(e.pos.x + Math.sin(e.ang) * len / 2, e.hover + 0.4, e.pos.z + Math.cos(e.ang) * len / 2); beamMesh.rotation.set(Math.PI / 2, 0, -e.ang); beamMesh.material.opacity = e.st === 'warn' ? 0.35 : 0.8; } }
  if (e.type !== 'sentinel') e.obj.rotation.y = e.yaw + (e.type === 'wisp' ? 0 : Math.PI);
  e.obj.position.set(e.pos.x, e.pos.y + e.hover, e.pos.z); if (e.bar) { e.bar.scale.x = Math.max(0.02, e.hp / e.max); e.bar.lookAt(G.camera.position); }
  if (e.flash > 0) e.obj.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) { o.material.emissive.setHex(0xffffff); o.material.emissiveIntensity = e.flash * 2; } }); else e.obj.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0 && !o.userData.keepEm) o.material.emissiveIntensity = 0; });
}
function beamHits(ox, oz, ang, len, half) { const p = G.player.pos; const px = p.x - ox, pz = p.z - oz; const along = px * Math.sin(ang) + pz * Math.cos(ang); const off = Math.abs(px * Math.cos(ang) - pz * Math.sin(ang)); return along > 0 && along < len && off < half + 0.4; }

// ── the King ───────────────────────────────────────────────────────────────
function startBoss() {
  state.boss = { hp: KING.hp, maxHp: KING.hp, phase: 1, active: false, dead: false, fanT: 1.2, starT: 1.5, beam: Math.PI / 2 + 1.3, beamDir: -1, ph: 0, dieT: 0 }; G.road = Object.assign(G.road, state);
  king.visible = true; king.userData.eyes.intensity = 40; kingPlay('Idle'); colliders.push({ x: KING.x, z: Z(KING.z), r: KING.r, king: 1 });
  if (!state.bossSeen) { state.bossSeen = true; $('card').classList.remove('hidden'); state.cardT = 2.8; } else { state.boss.active = true; $('boss').classList.remove('hidden'); }
  Sound.play('roar', 1); Music.play('boss');
}
function kingPlay(name, once) { const a = kingActs[name]; if (!a || kingCur === a) return; if (kingCur) kingCur.fadeOut(0.3); a.reset().fadeIn(0.3); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play(); kingCur = a; }
export function hurtKing(dmg) {
  const b = state.boss; if (!b || b.dead || !b.active) return; b.hp = Math.max(0, b.hp - dmg); Sound.play('hit', 0.4, 0.7); burst(KING.x + (Math.random() - 0.5) * 2, 4, Z(KING.z) + 1, 0xc8b8ff, 6, 3, 0.4);
  const ph = b.hp > KING.hp * 0.66 ? 1 : b.hp > KING.hp * 0.33 ? 2 : 3;
  if (ph !== b.phase) { b.phase = ph; Sound.play('roar', 1); G.shake = 1; ring(KING.x, 0, Z(KING.z), 14, 0xff3030, 1); for (const s of Spells.shots) if (s.foe) s.life = 0; b.fanT = 1.4; b.starT = 1; kingPlay('Cast', true); }
  if (b.hp <= 0) { b.dead = true; b.dieT = 4; state.timing = false; for (const s of Spells.shots) s.life = 0; marks.length = 0; Sound.play('roar', 1, 0.6); Music.play('victory'); kingPlay('Death', true); bossBeam.visible = false; G.won = true; store.set('won', true); }
}
function updateKing(dt) {
  const b = state.boss; if (!b) return; b.ph += dt; if (kingMixer) kingMixer.update(dt); const p = G.player.pos;
  king.userData.eyes.intensity = b.dead ? Math.max(0, 40 * (b.dieT / 4)) : 35 + Math.sin(G.t * 5) * 8 + b.phase * 6;
  if (b.dead) { b.dieT -= dt; if (Math.random() < 0.7) burst(KING.x + (Math.random() - 0.5) * 5, Math.random() * 7, Z(KING.z) + (Math.random() - 0.5) * 3, 0xffffff, 2, 1.5, 1.6); king.traverse((o) => { if (o.isMesh && o.material && o.material.transparent !== undefined) { o.material.transparent = true; o.material.opacity = Math.max(0, b.dieT / 4); } }); if (b.dieT <= 0) win(); return; }
  if (!b.active) return;
  const from = new THREE.Vector3(KING.x, 5.2, Z(KING.z) + 1.2); const dir = p.clone().add(new THREE.Vector3(0, 1, 0)).sub(from);
  b.fanT -= dt; b.starT -= dt; king.rotation.y = Math.atan2(p.x - KING.x, p.z - Z(KING.z)) + Math.PI + Math.sin(b.ph * 0.9) * 0.05;
  if (b.fanT <= 0) { b.fanT = b.phase === 1 ? 1.8 : b.phase === 2 ? 2.1 : 2.5; const base = Math.atan2(dir.x, dir.z); for (let i = -2; i <= 2; i++) { const a = base + i * 0.2; const d2 = new THREE.Vector3(Math.sin(a), dir.y / dir.length() * 0.9, Math.cos(a)); Spells.foeShot(from, d2, 7, 9, 0xff3a3a, 0.22); } Sound.play('bolt', 0.5, 0.6); kingPlay('Cast', true); setTimeout(() => kingPlay('Idle'), 1200); }
  if (b.phase >= 2 && b.starT <= 0) { b.starT = b.phase === 2 ? 1.6 : 2.2; marks.push({ x: p.x + (Math.random() - 0.5) * 2, z: p.z + (Math.random() - 0.5) * 2, r: 2.2, t: 1.2, dmg: 18, ring: ring(p.x, 0, p.z, 2.4, 0xffd0ff, 1) }); }
  if (b.phase === 3) { b.beam += 0.62 * dt * b.beamDir; if (beamHits(KING.x, Z(KING.z), b.beam, 30, 0.8)) Player.hurt(10); bossBeam.visible = true; bossBeam.scale.set(1.3, 30, 1.3); bossBeam.position.set(KING.x + Math.sin(b.beam) * 15, 1.2, Z(KING.z) + Math.cos(b.beam) * 15); bossBeam.rotation.set(Math.PI / 2, 0, -b.beam); } else bossBeam.visible = false;
}
function win() {
  state.boss = null; G.scene_ = 'end'; const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60); $('endTime').textContent = `Time: ${m}:${String(s).padStart(2, '0')}`;
  const best = store.get('best3d', null); if (best === null || state.time < best) store.set('best3d', state.time);
  $('hud').classList.add('hidden'); $('boss').classList.add('hidden'); $('ending').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); save();
}

// ── death and respawn ──────────────────────────────────────────────────────
function onDeath() { if (G.area !== 'road' || dead) return; dead = true; deadT = 2.4; $('death').classList.remove('hidden'); Sound.play('death', 0.7, 0.7); }
function respawn() {
  dead = false; $('death').classList.add('hidden'); const p = G.player; const w = state.respawn >= 0 ? WAYSTONES[state.respawn] : null;
  p.pos.set(w ? w[0] - 2 : 0, 0, w ? Z(w[1]) + 1.5 : Z(-1)); p.hp = p.maxHp; p.vel.set(0, 0, 0);
  for (const s of Spells.shots) s.life = 0; marks.length = 0;
  for (const e of enemies) if (!e.dead) { e.pos.copy(e.home); e.hp = e.max; e.st = 'idle'; e.t = 1; }
  if (state.boss && !state.boss.dead) { state.boss.active = false; state.boss.dormant = true; bossBeam.visible = false; $('boss').classList.add('hidden'); Music.play('road'); kingPlay('Idle'); }
}

export const Road = {
  state,
  async init(g) {
    G = g; G.road = state; group = new THREE.Group(); group.visible = false; G.scene.add(group); await build();
    G.areas.road = { group, interact, colliders, spawn: () => ({ pos: new THREE.Vector3(0, 0, Z(-1)), yaw: 0 }), heightAt: (x, z) => 0,
      clamp: (p) => { p.z = THREE.MathUtils.clamp(p.z, Z(-240), Z(3)); const hw = xRange(p.z) - 0.3; p.x = THREE.MathUtils.clamp(p.x, -hw, hw); if (!state.gateOpen && p.z < Z(GATE_Z) + 1.5) p.z = Z(GATE_Z) + 1.5; if (state.boss && state.boss.active && !state.boss.dead && p.z > Z(GATE_Z) - 1.5) p.z = Z(GATE_Z) - 1.5; if (state.boss && !state.boss.dead && p.z < Z(KING.z) + 5) p.z = Z(KING.z) + 5; },
      collide: (p, r) => { for (const c of colliders) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); } } },
      onEnter: () => { zoneId = null; Sound.stopLoop('wind'); Sound.stopLoop('autumn'); Sound.stopLoop('hearth'); Sound.loop('night', 0.3); G.scene.fog.density = 0.012; G.onDeath = onDeath; G.onShot = (s) => this.onShot(s); G.onNova = (n) => this.onNova(n); } };
  },
  enter() {
    // a fresh run each time you leave the village gate
    for (const e of enemies) group.remove(e.obj); enemies.length = 0; for (const k of pickups) group.remove(k.obj); pickups.length = 0; marks.length = 0; spawned = []; state.shards = 0; state.lit = []; state.respawn = -1; state.gateOpen = false; gateBars.position.y = 0; state.boss = null; if (king) king.visible = false; state.timing = true; state.time = 0; state.bossSeen = false;
    for (const w of waystoneObjs) { w.light.intensity = 0; w.rune.material.emissiveIntensity = 0.2; }
    for (let i = interact.length - 1; i >= 0; i--) if (interact[i].cond && interact[i].prompt === STR.pShard) interact.splice(i, 1);
    transition(() => { enterArea('road', G.areas.road.spawn()); Music.play('road'); }, 900);
  },
  onShot(s) { const q = s.mesh.position; for (const e of enemies) { if (e.dead) continue; const h = e.d.h || 1; if (Math.abs(q.x - e.pos.x) < e.r + 0.3 && Math.abs(q.z - e.pos.z) < e.r + 0.3 && q.y > e.pos.y + e.hover - 0.4 && q.y < e.pos.y + e.hover + h + 0.4) { hurtEnemy(e, s.sp.dmg); if (s.sp.burn) e.burn = s.sp.burn; if (s.sp.slow) e.slow = s.sp.slow; return true; } }
    const b = state.boss; if (b && b.active && !b.dead && Math.abs(q.x - KING.x) < KING.r + 0.5 && Math.abs(q.z - Z(KING.z)) < KING.r + 1 && q.y < 8) { hurtKing(s.sp.dmg); return true; } return false; },
  onNova(n) { const p = G.player.pos; for (const e of enemies) if (!e.dead && e.pos.distanceTo(p) < n.r + e.r) hurtEnemy(e, n.dmg); const b = state.boss; if (b && b.active && !b.dead && p.distanceTo(new THREE.Vector3(KING.x, 0, Z(KING.z))) < n.r + KING.r) hurtKing(n.dmg); },
  update(dt) {
    const p = G.player; const t = G.t; riverMat.uniforms.uT.value = t; cloudMat.map.offset.set(t * 0.004, t * 0.002);
    if (state.keeperMixer) state.keeperMixer.update(dt);
    if (state.cardT > 0) { state.cardT -= dt; if (state.cardT <= 0) { $('card').classList.add('hidden'); state.boss.active = true; $('boss').classList.remove('hidden'); } return; }
    if (dead) { deadT -= dt; if (deadT <= 0) respawn(); return; }
    if (state.timing) state.time += dt;
    const v = p.pos.z - OZ; const z = ZONES.find((q) => v <= q.z0 && v > q.z1); if (z && z.id !== zoneId) { zoneId = z.id; UI.banner(z.name); }
    for (const [i, [tz, list]] of SPAWNS.entries()) if (!spawned[i] && v < tz) { spawned[i] = true; for (const [type, x, zz] of list) spawn(type, x, zz); }
    for (const e of enemies) updateEnemy(e, dt); for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].gone) enemies.splice(i, 1);
    for (const [i, w] of waystoneObjs.entries()) if (!state.lit[i] && Math.hypot(p.pos.x - w.x, p.pos.z - w.z) < 3.2) { state.lit[i] = true; state.respawn = i; p.hp = p.maxHp; p.flasks = 2; UI.toast(STR.waystone); Sound.play('shard', 0.6, 0.7); ring(w.x, 0, w.z, 4, 0x9fd0ff, 0.8); w.light.intensity = 18; w.rune.material.emissiveIntensity = 2; }
    for (const w of waystoneObjs) if (w.light.intensity > 0) w.light.intensity = 16 + Math.sin(t * 3) * 2.5;
    for (const k of pickups) if (!k.got) { k.obj.children[0].rotation.y = t * 1.5; k.obj.children[0].position.y = 1 + Math.sin(t * 3) * 0.15; }
    if (!state.gateOpen && v < GATE_Z + 7 && state.shards >= 3) { state.gateOpen = true; Sound.play('gate', 1); G.shake = 0.6; }
    if (state.gateOpen && gateBars.position.y < 5.6) gateBars.position.y = Math.min(5.6, gateBars.position.y + dt * 2.5);
    if (state.gateOpen && !state.boss && v < GATE_Z - 4) startBoss();
    if (state.boss && state.boss.dormant && v < GATE_Z - 4) { state.boss.dormant = false; state.boss.active = true; $('boss').classList.remove('hidden'); Sound.play('roar', 0.8); Music.play('boss'); }
    for (const m of marks) { m.t -= dt; if (m.t <= 0) { ring(m.x, 0, m.z, m.r, 0xffffff, 0.4); burst(m.x, 0.5, m.z, 0xffd0ff, 30, 6, 0.5); G.shake = 0.3; Sound.play('nova', 0.5, 1.5); if (Math.hypot(m.x - p.pos.x, m.z - p.pos.z) < m.r + 0.4) Player.hurt(m.dmg); } }
    for (let i = marks.length - 1; i >= 0; i--) if (marks[i].t <= 0) marks.splice(i, 1);
    updateKing(dt);
    for (const l of lights) l.intensity = 15 + Math.sin(t * 9 + l.position.x) * 1.5;
  },
};
