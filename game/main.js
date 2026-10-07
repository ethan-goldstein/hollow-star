// The Hollow Star 3D - boot, fixed-step loop, areas, time of day, save/load.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sound, Music, Tube, store, $, QS } from './audio.js';
import { UI, STR } from './ui.js';
import { Assets } from './assets.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Spells } from './spells.js';
import { Crew } from './crew.js';
import { Animals } from './animals.js';
import { Interiors } from './interiors.js';
import { Shop } from './shop.js';
import { Road } from './road.js';
import { Cozy } from './cozy.js';
import { Town, Life } from './town.js';
import { People } from './people.js';
import { Net } from './net.js';

const DEV = QS.has('dev');
const DAY_SECONDS = 24 * 60; // one full day cycle in 24 real minutes

export const G = {
  THREE, renderer: null, scene: null, camera: null, composer: null, bloom: null,
  scene_: 'menu', area: 'vale', paused: false, locked: false, shopOpen: false, fading: false,
  t: 0, clock: 0.78, day: 1, time: 0,              // clock: 0..1 fraction of the day (0 = midnight)
  inv: {}, flags: {}, lanternsLit: {}, pondFrozen: false, won: store.get('won', false),
  player: null, world: null, areas: {}, systems: [], interact: [], road: null,
  keys: {}, pressed: {}, mouse: { l: false, r: false, dx: 0, dy: 0 },
  fps: 60, dev: {},
};
window.__game = G;

// ── input ──────────────────────────────────────────────────────────────────
addEventListener('keydown', (e) => { if (e.repeat || G.chatting) return; G.keys[e.code] = true; G.pressed[e.code] = true; if (['Space', 'Tab'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', (e) => { G.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in G.keys) G.keys[k] = false; G.mouse.l = G.mouse.r = false; });
const cv = $('c');
function lock() { const r = cv.requestPointerLock && cv.requestPointerLock(); if (r && r.catch) r.catch(() => { G.virtualLock = true; G.locked = true; }); }
G.lock = lock;
cv.addEventListener('mousedown', (e) => { if (G.scene_ !== 'play') return; if (!G.locked && !UI.dialog && !G.shopOpen && !G.paused) { lock(); return; } if (e.button === 0) { G.mouse.l = true; G.pressed.Mouse0 = true; } if (e.button === 2) { G.mouse.r = true; G.pressed.Mouse2 = true; } });
addEventListener('mouseup', (e) => { if (e.button === 0) G.mouse.l = false; if (e.button === 2) G.mouse.r = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { G.locked = document.pointerLockElement === cv; if (!G.locked && G.scene_ === 'play' && !UI.dialog && !G.shopOpen && !G.fading && !G.sleeping) setPause(true); });
document.addEventListener('mousemove', (e) => { if (G.locked && (document.pointerLockElement === cv || (G.virtualLock && e.buttons & 1))) { G.mouse.dx += e.movementX; G.mouse.dy += e.movementY; } });

export function setPause(on) { if (UI.dialog && on) return; G.paused = on; $('pause').classList.toggle('hidden', !on); if (!on && G.scene_ === 'play') lock(); else if (on && document.pointerLockElement) document.exitPointerLock(); }
export function transition(fn, ms = 700) {
  if (G.fading) return; G.fading = true; $('fade').classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => { $('fade').classList.remove('on'); G.fading = false; }, 60); }, ms);
}

// ── renderer ───────────────────────────────────────────────────────────────
function initRenderer() {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(1.5, devicePixelRatio)); r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.25; r.info.autoReset = false;
  G.renderer = r; G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 600); G.camera.rotation.order = 'YXZ';
  const composer = new EffectComposer(r); composer.addPass(new RenderPass(G.scene, G.camera));
  G.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.6, 0.82); composer.addPass(G.bloom);
  G.grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.55 }, uGrain: { value: 0.045 }, uWarm: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain, uWarm; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5; float v = 1.0 - uVig * dot(q, q) * 1.6; c.rgb *= v;
        c.rgb = mix(c.rgb, c.rgb * vec3(1.06, 0.98, 0.9), uWarm); c.rgb += (hash(vUv * 1000.0 + uTime) - 0.5) * uGrain; gl_FragColor = c; }`,
  }); composer.addPass(G.grade); composer.addPass(new OutputPass()); G.composer = composer;
  addEventListener('resize', () => { G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); r.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
}

// ── areas ──────────────────────────────────────────────────────────────────
export function enterArea(name, spawn) {
  const prev = G.area; const a = G.areas[name]; if (!a) return;
  if (G.riding && name !== 'vale') Animals.dismount(); if (G.player && G.player.dancing) Player.setDance(false);
  for (const k in G.areas) G.areas[k].group.visible = k === name;
  G.area = name; G.interact = a.interact; G.collide = a.collide; G.heightAt = a.heightAt; G.boundsClamp = a.clamp;
  if (name !== 'road') { G.onDeath = null; G.onShot = null; G.onNova = null; }
  if (a.onEnter) a.onEnter(spawn, prev);
  if (spawn) { G.player.pos.copy(spawn.pos); if (spawn.yaw !== undefined) { G.player.yaw = spawn.yaw; G.player.pitch = 0; } }
  G.player.vel.set(0, 0, 0);
  Crew.onArea(name, prev);
}

// ── save / load ────────────────────────────────────────────────────────────
export function save() {
  store.set('save3d', { clock: G.clock, day: G.day, inv: G.inv, flags: G.flags, lit: G.lanternsLit, pond: G.pondFrozen, won: G.won, crew: Crew.saveState(), pos: G.player ? G.player.pos.toArray() : null, area: G.area === 'road' ? 'vale' : G.area, hp: G.player ? G.player.hp : 100 });
}
function load() {
  const s = store.get('save3d', null); if (!s) return null;
  G.clock = s.clock ?? 0.78; G.day = s.day ?? 1; G.inv = s.inv || {}; G.flags = s.flags || {}; G.lanternsLit = s.lit || {}; G.pondFrozen = !!s.pond; G.won = !!s.won;
  return s;
}

// ── time of day ────────────────────────────────────────────────────────────
export function advanceClock(dt) { G.clock += (dt * (G.timeScale || 1)) / DAY_SECONDS; if (G.clock >= 1) { G.clock -= 1; G.day++; } }
export const night = () => { const c = G.clock; return Math.max(THREE.MathUtils.smoothstep(c, 0.72, 0.88), 1 - THREE.MathUtils.smoothstep(c, 0.2, 0.32)); }; // 1 at night (through midnight), 0 by day
export const dusk = () => Math.max(0, 1 - Math.abs(G.clock - 0.76) / 0.1) + Math.max(0, 1 - Math.abs(G.clock - 0.27) / 0.08); // warm horizon at sunset/sunrise

// ── loop ───────────────────────────────────────────────────────────────────
const STEP = 1 / 60; let acc = 0, last = 0;
function update(dt) {
  G.t += dt; UI.update(dt, G);
  if (G.scene_ !== 'play') return;
  if (G.pressed.KeyP && G.scene_ === 'play') { G.photo = !G.photo; document.body.classList.toggle('photo', G.photo); Sound.play('shutter', 0.6); }
  if (G.pressed.Escape) { if (G.shopOpen) { Shop.close(); Cozy.closePanels(); } else if (UI.dialog) UI.closeDialog(); else setPause(!G.paused); }
  if (G.pressed.KeyM) Sound.setMuted(!Sound.muted);
  if (UI.dialog) { if (G.pressed.KeyE || G.pressed.Enter) UI.closeDialog(); return; }
  if (G.shopOpen) { Shop.update(); if (G.pressed.KeyJ) Cozy.closePanels(); return; }
  if (G.paused || G.fading) return;
  if (!G.sleeping) advanceClock(dt);
  World.update(dt); Player.update(dt); Spells.update(dt); Crew.update(dt); Animals.update(dt); Interiors.update(dt); Cozy.update(dt); Town.update(dt); People.update(dt); Net.update(dt); if (G.area === 'road') Road.update(dt);
  for (const s of G.systems) s.update(dt);
  // interaction: nearest thing in front of the player
  UI.prompt = ''; G.hit = null;
  if (G.sitLow) UI.prompt = G.sitPrompt || 'E - Stand up';
  else if (G.riding) UI.prompt = 'E - Climb down';
  else if (!G.sleeping && !(G.stoodT > 0)) {
    const p = G.player, fwd = Player.forward(); let best = null, bd = 1e9;
    for (const it of G.interact) {
      if (it.cond && !it.cond()) continue;
      const d = it.pos.distanceTo(p.pos); if (d > (it.r || 2.6) || d > bd) continue;
      const dir = it.pos.clone().sub(p.pos).setY(0).normalize(); if (d > 1.2 && dir.dot(fwd) < 0.25) continue;
      bd = d; best = it;
    }
    if (best) { UI.prompt = typeof best.prompt === 'function' ? best.prompt() : best.prompt; G.hit = best; if (G.pressed.KeyE) best.act(); }
  }
}
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now; acc += dt; G.fps += ((1 / (dt || STEP)) - G.fps) * 0.05;
  while (acc >= STEP) { update(STEP); for (const k in G.pressed) delete G.pressed[k]; G.mouse.dx = G.mouse.dy = 0; acc -= STEP; }
  if (G.scene_ === 'play' || G.scene_ === 'end') { G.renderer.info.reset(); World.render(); Player.render(); G.grade.uniforms.uTime.value = G.t; G.composer.render(); }
  if (DEV) $('dev').textContent = `fps ${G.fps | 0}  calls ${G.renderer.info.render.calls}  tris ${(G.renderer.info.render.triangles / 1000) | 0}k\npos ${G.player.pos.x.toFixed(1)},${G.player.pos.y.toFixed(1)},${G.player.pos.z.toFixed(1)}  yaw ${G.player.yaw.toFixed(2)}  area ${G.area}  clock ${G.clock.toFixed(3)} night ${night().toFixed(2)}`;
  requestAnimationFrame(frame);
}

// ── boot ───────────────────────────────────────────────────────────────────
async function boot() {
  initRenderer();
  const bar = $('loadbar').firstElementChild, txt = $('loadtext');
  Assets.onProgress = (done, total, what) => { bar.style.width = (done / total) * 100 + '%'; txt.textContent = what.toUpperCase(); };
  const saved = load();
  await Music.load();
  G.player = Player.init(G);
  await World.init(G);
  Spells.init(G); await Crew.init(G, saved ? saved.crew : null); await Animals.init(G); await Interiors.init(G); Shop.init(G); await Road.init(G); await Cozy.init(G); await Town.init(G); await People.init(G); Net.init(G);
  await Assets.whenIdle();
  G.enterLair = () => transition(() => enterArea('lair', G.areas.lair.spawn()));
  G.enterRoad = () => Road.enter();
  G.systems.push({ update: (dt) => { G.saveT = (G.saveT || 0) + dt; if (G.saveT > 20) { G.saveT = 0; save(); } } });
  addEventListener('beforeunload', save);
  bar.style.width = '100%'; txt.textContent = 'READY'; const b = $('btnBegin'); b.disabled = false; b.textContent = saved ? 'CONTINUE' : 'BEGIN';
  b.addEventListener('click', () => {
    Sound.init(); Sound.play('page', 0.6);
    transition(() => {
      $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); G.scene_ = 'play';
      const area = saved && saved.area && G.areas[saved.area] ? saved.area : 'lair';
      const pos = saved && saved.pos && saved.area !== 'road' ? new THREE.Vector3().fromArray(saved.pos) : null;
      enterArea(area, pos ? { pos } : G.areas[area].spawn());
      if (saved && saved.hp) G.player.hp = saved.hp;
      lock(); Net.onPlay();
    });
  });
  $('btnResume').addEventListener('click', () => setPause(false));
  $('btnAgain').addEventListener('click', () => transition(() => { $('ending').classList.add('hidden'); $('hud').classList.remove('hidden'); G.scene_ = 'play'; enterArea('lair', G.areas.lair.spawn()); lock(); }));
  addEventListener('pointerdown', () => { if (G.scene_ === 'menu' && !Music.el) Music.play('title', true); }, { once: true });
  if (DEV) { $('dev').classList.remove('hidden'); G.dev = { enterArea, save, transition, World, Player, Crew, Animals, Spells, Interiors, Shop, Road, Cozy, Town, Life, People, Net, UI, Music, Tube, setClock: (c) => { G.clock = c; }, step: (n = 1) => { for (let i = 0; i < n; i++) { update(STEP); for (const k in G.pressed) delete G.pressed[k]; } } }; }
  requestAnimationFrame(frame);
}
boot();
