// Thistledown: a town square down the lane from Emberfall, six buildings you can walk into, and the small things people do inside.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, Music } from './audio.js';
import { UI, STR } from './ui.js';
import { World, VALE } from './world.js';
import { enterArea, transition, save, night } from './main.js';
import { Player } from './player.js';
import { Cozy } from './cozy.js';
import { burst } from './spells.js';

let G; const TZ = 620; let group, interact, colliders; const lamps = [], windows = [], cottages = []; let rain = null, rainOn = false;
const KK = (n) => Assets.gltf(`assets/models/kk/${n}.gltf`);
const GEN = (n) => Assets.gltf(`assets/models/gen/${n}.glb`);
const dir = (rot) => new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));

const BUILDINGS = [
  { key: 'tavern', model: 'tavern', x: 0, z: -17, rot: 0, h: 9.5, r: 4.6, name: 'THE LANTERN & MUG' },
  { key: 'bakery', model: 'bakery', x: -19, z: -6, rot: Math.PI / 2, h: 6.2, r: 3.4, name: "HESPER'S OVENS" },
  { key: 'library', model: 'library', x: 19, z: -6, rot: -Math.PI / 2, h: 10.5, r: 3.4, name: 'THE SCRIPTORIUM' },
  { key: 'house_a', model: 'house_a', x: -17, z: 12, rot: 0.75, h: 7.2, r: 3.2, name: "TOBIN'S HOUSE" },
  { key: 'house_b', model: 'house_b', x: 17, z: 12, rot: -0.75, h: 8.2, r: 3.0, name: "JUNIPER'S HOUSE" },
  { key: 'chapel', model: 'chapel', x: 0, z: 25, rot: Math.PI, h: 10, r: 3.6, name: 'THE QUIET CHAPEL' },
];
const ROOMS = {
  tavern: { w: 12, d: 10, template: 'tavern', music: 'tavern', ambience: 'chatter', floor: 'wood', wall: 0x6a5244 },
  bakery: { w: 8, d: 7, template: 'cafe', music: 'town', floor: 'wood', wall: 0x8a6a58 },
  library: { w: 8, d: 9, template: 'library', music: 'town', floor: 'wood', wall: 0x4a4260 },
  house_a: { w: 7, d: 6, template: 'home', owner: 'tobin', floor: 'wood', wall: 0x6a5a50 },
  house_b: { w: 7, d: 6, template: 'home', owner: 'juniper', floor: 'wood', wall: 0x56704a },
  chapel: { w: 7, d: 11, template: 'chapel', music: 'chamber', floor: 'cobble', wall: 0x3a3650 },
};
const LORE_TOWN = [
  { id: 'thistledown', title: 'Thistledown', text: 'The town was built where the lane ran out of hill. Nobody chose the spot; the carts simply stopped rolling. The well came first, then the tavern, then everything that needed a tavern nearby.' },
  { id: 'mug', title: 'The Lantern and Mug', text: 'The sign has a lantern on one side and a mug on the other. Travellers coming down the lane see the lantern. Travellers leaving see the mug. Bramwell says this is not an accident.' },
  { id: 'screen', title: 'On Scrying Screens', text: 'A scrying glass shows what is far away. A scrying screen, the newer kind, shows what somebody somewhere thought would be nice to look at. Wren considers this a step backwards and watches it every evening.' },
];
const CHAIR_LINES = ['The chair is the right amount of creaky.', 'Somebody has carved a tiny star into the armrest.', 'You sit. Outside, the town carries on without you, which is the point.', 'The cushion remembers someone else, then decides it remembers you.'];

function flagBuffs() { G.flags.buffs = G.flags.buffs || {}; return G.flags.buffs; }

async function put(g, name, x, z, { h, rot = 0, col = 0, cols, tint, y = 0 } = {}) {
  const gl = await KK(name); if (!gl) return null; const obj = Assets.instance(gl); if (h) Assets.fitHeight(obj, h); obj.position.set(x, y, z); obj.rotation.y = rot; g.add(obj);
  if (tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
  if (col && cols) cols.push({ x, z, r: col }); return obj;
}
async function putGen(g, name, x, z, { h, rot = 0, col = 0, cols } = {}) {
  const gl = await GEN(name); if (!gl) return null; const obj = Assets.instance(gl); Assets.fitHeight(obj, h); obj.position.set(x, -0.03, z); obj.rotation.y = rot; g.add(obj); if (col && cols) cols.push({ x, z, r: col }); return obj;
}
function makeHearth(g, x, z, rot, cols, scale = 1) {
  const hearth = new THREE.Group(); const stone = new THREE.MeshStandardMaterial({ map: Assets.tex('assets/tex/cobble.jpg'), roughness: 1, color: 0xb0a8c0 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.5), stone); back.position.set(0, 1.1, 0); hearth.add(back);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.52), new THREE.MeshStandardMaterial({ color: 0x090406 })); hole.position.set(0, 0.5, 0.02); hearth.add(hole);
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); mantel.position.set(0, 1.3, 0.1); hearth.add(mantel);
  const fl = new THREE.PointLight(0xff9a40, 36, 12, 1.6); fl.position.set(0, 0.6, 0.6); hearth.add(fl); hearth.userData.fire = fl;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 })); flame.position.set(0, 0.5, 0.1); hearth.add(flame); hearth.userData.flame = flame;
  hearth.position.set(x, 0, z); hearth.rotation.y = rot; hearth.scale.setScalar(scale); g.add(hearth); cols.push({ x, z, r: 1.2 * scale }); return hearth;
}
function makeWindow(g, x, y, z, rot, w = 1.1, h = 1.4, color = 0xffc080) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x334466, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }));
  m.position.set(x, y, z); m.rotation.y = rot; g.add(m); const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a2618 })); frame.position.copy(m.position); frame.rotation.y = rot; frame.position.addScaledVector(dir(rot), -0.05); g.add(frame);
  windows.push({ m, color }); return m;
}
function makePainting(g, x, y, z, rot, tex, w = 1.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.5625), new THREE.MeshStandardMaterial({ map: Assets.tex(`assets/tex/${tex}.jpg`), roughness: 0.8 })); m.position.set(x, y, z); m.rotation.y = rot; g.add(m);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, w * 0.5625 + 0.12, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a1a10 })); frame.position.copy(m.position).addScaledVector(dir(rot), -0.04); frame.rotation.y = rot; g.add(frame);
}

// ── the scrying screen: a wooden frame around a looping picture ───────────────
const CHANNELS = ['assets/video/ch1.mp4', 'assets/video/ch2.mp4']; const CH_NAMES = ['The Hearth Hour', 'Baking with Foxes']; const videos = [];
function video(i) { if (videos[i]) return videos[i]; const v = document.createElement('video'); v.src = CHANNELS[i]; v.loop = true; v.muted = true; v.playsInline = true; v.preload = 'none'; v.crossOrigin = 'anonymous'; const tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace; videos[i] = { v, tex }; return videos[i]; }
function makeScreen(g, x, y, z, rot) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.45, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.7 })); frame.position.set(x, y, z); frame.rotation.y = rot; frame.position.addScaledVector(dir(rot), -0.06); g.add(frame);
  const off = new THREE.MeshBasicMaterial({ color: 0x151826 }); const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), off); pane.position.set(x, y, z); pane.rotation.y = rot; g.add(pane);
  const light = new THREE.PointLight(0x8fa0ff, 0, 7, 1.8); light.position.set(x, y, z); light.position.addScaledVector(dir(rot), 0.8); g.add(light);
  const s = { pane, off, light, on: false, ch: 0, rot };
  return s;
}

export const Life = {
  screens: [], songIdx: 0, prevSlot: null,
  sitChair(spot, rot) { if (G.sitLow || G.riding) return; Cozy.sit('chair', spot, rot + Math.PI, -0.5); G.sitPrompt = null; UI.toast(CHAIR_LINES[(Math.random() * CHAIR_LINES.length) | 0], 3); },
  coffee(own = true) {
    const b = flagBuffs(); if (b.coffee === G.day) { UI.toast('You have had your coffee. Your hands are still humming a little.', 3); return; }
    b.coffee = G.day; Player.hold('mug', 3.6); Sound.play('coffee', 0.8); UI.toast(own ? 'Hot coffee. You feel quicker on your feet until tomorrow.' : 'Hot coffee, strong and sweet. Quicker on your feet until tomorrow.', 3.5);
  },
  eat(kind) {
    const p = G.player; const b = flagBuffs(); Player.hold('bowl', 3.4); Sound.play('eat', 0.8); p.hp = p.maxHp; b.fed = G.day;
    UI.toast(kind === 'stew' ? 'Bramwell\'s stew. Everything hurts a little less, and will keep not hurting all day.' : 'A pumpkin pastry, still hot. It does bite back. You feel wonderful.', 3.5);
  },
  nap(line) {
    if (G.sitLow || G.riding) return; Sound.play('chair', 0.5);
    transition(() => { G.clock = 0.27; G.day++; G.player.hp = G.player.maxHp; save(); UI.toast(line, 4); }, 1100);
  },
  pray() {
    const b = flagBuffs(); const p = G.player; if (b.blessed === G.day) { UI.toast('The candle is still burning from this morning. It remembers you.', 3); return; }
    b.blessed = G.day; p.flasks = Math.min(3, p.flasks + 1); Sound.play('bell', 0.5, 1.4); burst(p.pos.x, p.pos.y + 1.2, p.pos.z, 0xbfe8ff, 24, 1.5, 1.2); UI.toast('You light a candle for no one in particular. A flask fills itself. The chapel does not explain.', 4);
  },
  song() {
    const list = ['tavern', 'dance', 'town', 'lair', 'festival']; this.songIdx = (this.songIdx + 1) % list.length; const slot = list[this.songIdx]; Music.play(slot, true); Sound.play('page', 0.5, 1.3);
    UI.toast(`The gramophone plays: ${{ tavern: 'The Lantern and Mug', dance: 'Boots Down The Lane', town: 'Thistledown at Golden Hour', lair: 'your own music', festival: 'The Lantern Night' }[slot]}`, 3);
  },
  watch(s, spot, yaw) {
    if (G.sitLow || G.riding) return; Cozy.sit('chair', spot, yaw, -0.5);
    const on = (ch) => { s.ch = ch; const { v, tex } = video(ch); v.play().catch(() => {}); s.pane.material = new THREE.MeshBasicMaterial({ map: tex }); s.on = true; Sound.play('screen', 0.6); UI.toast(`Channel ${ch + 1}: ${CH_NAMES[ch]}`, 2.5); };
    on(0); G.sitPrompt = 'E - Change the channel  ·  W - Stand up';
    G.onSitE = () => { on((s.ch + 1) % CHANNELS.length); return true; };
    G.onStand = () => { s.on = false; s.pane.material = s.off; s.light.intensity = 0; for (const x of videos) if (x) x.v.pause(); G.sitPrompt = null; G.onSitE = null; G.onStand = null; };
  },
  onDance(on) { if (G.area === 'road') return; if (on) { this.prevSlot = Music.slot; if (Music.slot !== 'dance') Music.play('dance', true); Sound.play('cheer', 0.5); } else if (this.prevSlot && this.prevSlot !== 'dance') Music.play(this.prevSlot, true); },
};

export const Town = {
  TZ, rooms: {}, group: null,
  async init(g) {
    G = g; group = new THREE.Group(); group.visible = false; G.scene.add(group); interact = []; colliders = []; this.group = group;
    await this.buildSquare();
    for (const b of BUILDINGS) await this.buildRoom(b);
    this.lairExtras();
    G.areas.town = { group, interact, colliders, spawn: () => ({ pos: new THREE.Vector3(-30, 0, TZ + 2), yaw: -Math.PI / 2 }), heightAt: () => 0,
      clamp: (p) => { p.x = THREE.MathUtils.clamp(p.x, -33, 33); p.z = THREE.MathUtils.clamp(p.z, TZ - 33, TZ + 33); },
      collide: (p, r) => { for (const c of colliders) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); } } },
      onEnter: () => { Sound.stopLoop('chatter'); Sound.stopLoop('hearth'); Sound.stopLoop('wind'); Sound.stopLoop('autumn'); Sound.stopLoop('night'); G.scene.fog.density = 0.014; Music.play('town'); UI.banner('THISTLEDOWN'); } };
    G.onDance = (on) => Life.onDance(on);
    // the lane from Emberfall: at the east edge of the village
    const lx = VALE.maxX - 1.4, lz = VALE.tower[1] - 2; const lp = new THREE.Vector3(lx, World.terrainHeight(lx, lz), lz);
    World.interact.push({ pos: lp, r: 3, prompt: 'E - Take the lane to Thistledown', cond: () => !G.riding, act: () => transition(() => enterArea('town', G.areas.town.spawn()), 900) });
    const sign = await KK('hw_post'); if (sign) { const o = Assets.instance(sign); Assets.fitHeight(o, 1.8); o.position.copy(lp); o.position.x -= 0.8; World.group.add(o); }
    interact.push({ pos: new THREE.Vector3(-31.5, 0, TZ + 2), r: 3, prompt: 'E - Take the lane to Emberfall', act: () => transition(() => enterArea('vale', { pos: new THREE.Vector3(VALE.maxX - 3, World.terrainHeight(VALE.maxX - 3, lz), lz), yaw: Math.PI / 2 }), 900) });
  },
  async buildSquare() {
    const leaves = Assets.tex('assets/tex/leaves.jpg'); leaves.repeat.set(16, 16); const leavesN = Assets.tex('assets/tex/leaves_n.jpg', { linear: true }); leavesN.repeat.set(16, 16);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: leaves, normalMap: leavesN, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, TZ); ground.receiveShadow = true; group.add(ground);
    const cob = Assets.tex('assets/tex/cobble.jpg'); cob.repeat.set(9, 9); const cobN = Assets.tex('assets/tex/cobble_n.jpg', { linear: true }); cobN.repeat.set(9, 9);
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshStandardMaterial({ map: cob, normalMap: cobN, roughness: 0.9, color: 0xb8b0c8 })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.012, TZ); plaza.receiveShadow = true; group.add(plaza);
    const laneMat = plaza.material.clone();
    for (const b of BUILDINGS) { const d = dir(b.rot); const door = new THREE.Vector3(b.x, 0, b.z).addScaledVector(d, b.r + 0.6); const L = door.length(); const len = L - 12; if (len <= 0) continue; const phi = Math.atan2(door.x, door.z); const mid = door.clone().multiplyScalar((12 + len / 2) / L); const lane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, len + 1), laneMat); lane.rotation.set(-Math.PI / 2, 0, phi); lane.position.set(mid.x, 0.008, TZ + mid.z); group.add(lane); }
    const lane2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 21), laneMat); lane2.rotation.set(-Math.PI / 2, 0, Math.PI / 2); lane2.position.set(-22, 0.008, TZ + 2); group.add(lane2);
    // buildings and their doors
    for (const b of BUILDINGS) {
      const obj = await putGen(group, b.model, b.x, TZ + b.z, { h: b.h, rot: b.rot, col: b.r, cols: colliders }); b.obj = obj;
      colliders.push({ x: b.x + Math.cos(b.rot) * b.r * 0.7, z: TZ + b.z - Math.sin(b.rot) * b.r * 0.7, r: b.r * 0.6 }, { x: b.x - Math.cos(b.rot) * b.r * 0.7, z: TZ + b.z + Math.sin(b.rot) * b.r * 0.7, r: b.r * 0.6 });
      const d = dir(b.rot); b.door = new THREE.Vector3(b.x, 0, TZ + b.z).addScaledVector(d, b.r + 1.2);
      const dl = new THREE.PointLight(0xffb060, 0, 8, 1.8); dl.position.copy(b.door).add(new THREE.Vector3(0, 2.4, 0)).addScaledVector(d, -0.6); group.add(dl); lamps.push({ light: dl, max: 12 });
      interact.push({ pos: b.door, r: 2.8, prompt: `E - Go into ${b.name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`, cond: () => !G.riding, act: () => { Sound.play('door', 0.6); const r = this.rooms[b.key]; transition(() => enterArea(r.area, { pos: new THREE.Vector3(r.ox, 0, r.oz + r.d / 2 - 1.6), yaw: 0 }), 700); } });
    }
    // well, stall, benches, lantern posts, pumpkins, trees, far cottages, a windmill
    await putGen(group, 'well', 0, TZ, { h: 2.8, col: 1.5, cols: colliders });
    interact.push({ pos: new THREE.Vector3(0, 0, TZ), r: 3, prompt: 'E - Drop a stone in the well', cond: () => (G.inv.stone || 0) > 0, act: () => { G.inv.stone--; Sound.play('bell', 0.4, 0.5); UI.toast('A long fall, a low note. Tobin looks up from across the square and nods.', 3.5); } });
    await putGen(group, 'stall', 9.5, TZ + 6.5, { h: 3.2, rot: -2.2, col: 1.8, cols: colliders });
    interact.push({ pos: new THREE.Vector3(9.0, 0, TZ + 5.2), r: 2.6, prompt: 'E - Try one of Juniper\'s teas', cond: () => G.clock > 0.3 && G.clock < 0.78, act: () => { Player.hold('mug', 3); Sound.play('tea', 0.8); G.player.hp = Math.min(G.player.maxHp, G.player.hp + 30); UI.toast('Tea that tastes like the first cold morning. You hate it. You want more.', 3.5); } });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const x = Math.cos(a) * 8, z = Math.sin(a) * 8; const rot = Math.atan2(-Math.cos(a), -Math.sin(a)); await put(group, 'hw_bench', x, TZ + z, { h: 0.9, rot, col: 0.7, cols: colliders }); const spot = new THREE.Vector3(x, 0.25, TZ + z); interact.push({ pos: spot, r: 2.2, prompt: STR.pSit.replace('by the fire', 'on the bench'), cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(spot, rot) }); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const x = Math.cos(a) * 11.4, z = Math.sin(a) * 11.4; await put(group, 'hw_post_lantern', x, TZ + z, { h: 2.8, col: 0.3, cols: colliders }); const l = new THREE.PointLight(0xffb060, 0, 11, 1.8); l.position.set(x, 2.4, TZ + z); group.add(l); lamps.push({ light: l, max: 20 }); }
    for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283, r = 14 + Math.random() * 6; await put(group, i % 3 ? 'hw_pumpkin_orange' : 'hw_pumpkin_orange_jackolantern', Math.cos(a) * r, TZ + Math.sin(a) * r, { h: 0.5 + Math.random() * 0.3, rot: Math.random() * 6 }); }
    const maple = await GEN('maple'); const pine = await GEN('pine');
    for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.283 + Math.random() * 0.2, r = 23 + Math.random() * 9; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 3) || Math.hypot(x + 31, z - 2) < 5) continue; const o = Assets.instance(i % 4 === 0 ? pine : maple); Assets.fitHeight(o, 5 + Math.random() * 2); o.position.set(x, -0.05, TZ + z); o.rotation.y = Math.random() * 6; group.add(o); colliders.push({ x, z: TZ + z, r: 0.5 }); }
    for (const [x, z, rot] of [[-27, -24, 0.9], [27, -22, -1.1], [-28, 26, 1.8]]) { await putGen(group, 'cottage', x, TZ + z, { h: 5.5, rot, col: 2.6, cols: colliders }); const wl = new THREE.PointLight(0xffb060, 0, 9, 1.8); wl.position.set(x, 1.6, TZ + z); group.add(wl); lamps.push({ light: wl, max: 16 }); }
    await put(group, 'mh_building_windmill_red', 26, TZ + 26, { h: 12, rot: -0.6, col: 2.4, cols: colliders });
    await put(group, 'hw_post', -31.5, TZ + 3.2, { h: 1.8 });
  },
  async buildRoom(b) {
    const spec = ROOMS[b.key]; const idx = BUILDINGS.indexOf(b); const ox = 700 + idx * 40, oz = TZ; const g = new THREE.Group(); g.visible = false; G.scene.add(g); const cols = [], it = [];
    const r = { key: b.key, area: `room_${b.key}`, ox, oz, w: spec.w, d: spec.d, group: g, interact: it, colliders: cols, beds: [], name: b.name }; this.rooms[b.key] = r;
    const { w, d } = spec; const H = 3.4;
    const floorT = Assets.tex(`assets/tex/${spec.floor}.jpg`); floorT.repeat.set(w / 2.5, d / 2.5); const floorN = Assets.tex(`assets/tex/${spec.floor}_n.jpg`, { linear: true }); floorN.repeat.set(w / 2.5, d / 2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: floorT, normalMap: floorN, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0, oz); floor.receiveShadow = true; g.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: spec.wall, roughness: 1 }); const beamMat = new THREE.MeshStandardMaterial({ color: 0x2e1c10, roughness: 1 });
    const walls = [[ox, oz - d / 2, w, 0], [ox, oz + d / 2, w, 0], [ox - w / 2, oz, d, Math.PI / 2], [ox + w / 2, oz, d, Math.PI / 2]];
    for (const [x, z, len, rot] of walls) { const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, H, 0.3), wallMat); m.position.set(x, H / 2, z); m.rotation.y = rot; m.receiveShadow = true; g.add(m); const beam = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.18, 0.4), beamMat); beam.position.set(x, H - 0.1, z); beam.rotation.y = rot; g.add(beam); const skirt = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.3, 0.36), beamMat); skirt.position.set(x, 0.15, z); skirt.rotation.y = rot; g.add(skirt); }
    for (let i = 0; i < Math.floor(w / 2.5); i++) { const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, d), beamMat); beam.position.set(ox - w / 2 + 1.25 + i * 2.5, H - 0.1, oz); g.add(beam); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(ox, H, oz); g.add(ceil);
    // bounds as colliders: walls push you back (done by clamp), door at +z
    const doorPos = new THREE.Vector3(ox, 0, oz + d / 2 - 0.4); const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 0.12), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); doorMesh.position.set(ox, 1.15, oz + d / 2 - 0.1); g.add(doorMesh);
    it.push({ pos: doorPos, r: 2.4, prompt: STR.pDoorOut, act: () => { Sound.play('door', 0.6); transition(() => enterArea('town', { pos: b.door.clone().addScaledVector(dir(b.rot), 1.0), yaw: b.rot + Math.PI }), 700); } });
    const warm = new THREE.PointLight(0xffd0a0, 18, 12, 1.6); warm.position.set(ox, H - 0.6, oz); g.add(warm);
    await this.furnish(r, spec.template, g, cols, it);
    G.areas[r.area] = { group: g, interact: it, colliders: cols, spawn: () => ({ pos: new THREE.Vector3(ox, 0, oz + d / 2 - 1.6), yaw: 0 }), heightAt: () => 0,
      clamp: (p) => { p.x = THREE.MathUtils.clamp(p.x, ox - w / 2 + 0.5, ox + w / 2 - 0.5); p.z = THREE.MathUtils.clamp(p.z, oz - d / 2 + 0.5, oz + d / 2 - 0.5); },
      collide: (p, rad) => { for (const c of cols) { const dx = p.x - c.x, dz = p.z - c.z, dd = Math.hypot(dx, dz), m = c.r + rad; if (dd < m && dd > 1e-4) { p.x += (dx / dd) * (m - dd); p.z += (dz / dd) * (m - dd); } } },
      onEnter: () => { Sound.stopLoop('wind'); Sound.stopLoop('autumn'); Sound.stopLoop('night'); Sound.stopLoop('chatter'); G.scene.fog.density = 0.004; if (spec.ambience) Sound.loop(spec.ambience, 0.45); Music.play(spec.music || 'town'); UI.banner(b.name); } };
  },
  async furnish(r, template, g, cols, it) {
    const { ox, oz, w, d } = r; const X = (x) => ox + x, Z = (z) => oz + z;
    const chair = async (name, x, z, rot, h = 0.95) => { await put(g, name, X(x), Z(z), { h, rot, col: 0.3, cols }); const spot = new THREE.Vector3(X(x), 0.1, Z(z)); it.push({ pos: spot, r: 2.0, prompt: 'E - Sit down', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(spot, rot) }); };
    const bed = async (name, x, z, rot, line) => { await put(g, name, X(x), Z(z), { h: 0.75, rot, col: 0.9, cols }); r.beds.push({ x: X(x), z: Z(z), yaw: rot, y: 0.45 }); if (line) it.push({ pos: new THREE.Vector3(X(x), 0, Z(z)), r: 2.2, prompt: 'E - Take a nap', cond: () => !G.sitLow && !G.riding, act: () => Life.nap(line) }); };
    const lamp = async (x, z, h = 1.6) => { await put(g, 'fb_lamp_standing', X(x), Z(z), { h, col: 0.25, cols }); const l = new THREE.PointLight(0xffd090, 10, 7, 1.8); l.position.set(X(x), h - 0.2, Z(z)); g.add(l); };
    if (template === 'tavern') {
      for (const x of [-2, 0, 2]) await put(g, 'fb_cabinet_medium_decorated', X(x), Z(-4.3), { h: 1.1, col: 0.6, cols });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 1.05, 0.8), new THREE.MeshStandardMaterial({ map: Assets.tex('assets/tex/wood.jpg'), roughness: 0.6, color: 0x9a7a60 })); bar.position.set(X(0), 0.52, Z(-3.3)); g.add(bar); cols.push({ x: X(-2.5), z: Z(-3.3), r: 0.9 }, { x: X(0), z: Z(-3.3), r: 0.9 }, { x: X(2.5), z: Z(-3.3), r: 0.9 });
      await put(g, 'fb_shelf_B_large_decorated', X(-4.2), Z(-4.4), { h: 2.2, col: 0.6, cols }); await put(g, 'fb_shelf_B_large_decorated', X(4.2), Z(-4.4), { h: 2.2, col: 0.6, cols });
      for (const x of [-1.6, 1.6]) await chair('fb_chair_stool_wood', x, -2.4, Math.PI, 0.6);
      for (let i = 0; i < 3; i++) await put(g, 'ad_mug_full', X(-2.8 + i * 0.5), Z(-3.3), { h: 0.16, y: 1.05, rot: i });
      it.push({ pos: new THREE.Vector3(X(0), 0, Z(-2.4)), r: 1.8, prompt: 'E - Have the stew', cond: () => !G.sitLow && !G.riding, act: () => Life.eat('stew') });
      for (const [tx, rot] of [[-3.4, 0], [3.4, 0]]) { await put(g, 'fb_table_medium_long', X(tx), Z(1.0), { h: 0.85, rot: Math.PI / 2, col: 1.1, cols }); await chair('fb_chair_A_wood', tx - 1.1, 1.0, Math.PI / 2); await chair('fb_chair_A_wood', tx + 1.1, 1.0, -Math.PI / 2); await chair('fb_chair_A_wood', tx, 2.4, Math.PI); await chair('fb_chair_A_wood', tx, -0.4, 0); }
      makeHearth(g, X(-5.6), Z(-0.4), Math.PI / 2, cols);
      const scr = makeScreen(g, X(5.78), 1.85, Z(3.2), -Math.PI / 2); Life.screens.push(scr); await put(g, 'fb_couch_pillows', X(3.6), Z(3.2), { h: 0.9, rot: Math.PI / 2, col: 0.9, cols });
      const couch = new THREE.Vector3(X(3.6), 0.12, Z(3.2)); it.push({ pos: couch, r: 2.0, prompt: 'E - Watch the scrying screen', cond: () => !G.sitLow && !G.riding, act: () => Life.watch(scr, couch, -Math.PI / 2) });
      for (let i = 0; i < 3; i++) await put(g, 'mh_barrel', X(5.1), Z(-4.2 + i * 0.9), { h: 1.0, col: 0.45, cols });
      await bed('fb_bed_single_B', -4.6, 3.8, 0, 'You wake in the inn room with the window already pink. Bramwell has left a mug outside the door.'); await bed('fb_bed_single_B', -2.9, 3.8, 0);
      await put(g, 'fb_rug_rectangle_stripes_A', X(0), Z(0.4), { h: 0.04 }); await lamp(5.2, 0.6); await lamp(-5.0, 3.0);
      const gram = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); box.position.y = 1.0; gram.add(box); const horn = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9a04a, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide })); horn.position.set(0, 1.45, 0.1); horn.rotation.x = -0.9; gram.add(horn); const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2618 })); stand.position.y = 0.42; gram.add(stand); gram.position.set(X(0), 0, Z(4.3)); g.add(gram); cols.push({ x: X(0), z: Z(4.3), r: 0.5 });
      it.push({ pos: new THREE.Vector3(X(0), 0, Z(4.3)), r: 2.2, prompt: 'E - Wind the gramophone', act: () => Life.song() });
      makeWindow(g, X(-5.84), 2.0, Z(2.6), Math.PI / 2); makeWindow(g, X(5.84), 2.0, Z(-1.0), -Math.PI / 2); makePainting(g, X(-1.8), 2.1, Z(-4.84), 0, 'painting_sky', 1.3); makePainting(g, X(1.8), 2.1, Z(-4.84), 0, 'painting_dog', 1.3);
    } else if (template === 'cafe') {
      for (const x of [-1, 1]) await put(g, 'fb_cabinet_medium_decorated', X(x), Z(-2.7), { h: 1.05, col: 0.6, cols });
      await put(g, 'fb_shelf_B_small_decorated', X(2.9), Z(-3.1), { h: 1.6, col: 0.5, cols });
      for (let i = 0; i < 4; i++) await put(g, 'hw_pumpkin_orange_small', X(-1.2 + i * 0.5), Z(-2.7), { h: 0.16, y: 1.05, rot: i * 1.3 });
      await put(g, 'ad_mug_full', X(1.1), Z(-2.6), { h: 0.16, y: 1.05 }); await put(g, 'ad_mug_empty', X(1.4), Z(-2.75), { h: 0.14, y: 1.05 });
      it.push({ pos: new THREE.Vector3(X(-0.6), 0, Z(-1.8)), r: 1.6, prompt: 'E - Order a coffee', cond: () => !G.sitLow && !G.riding, act: () => Life.coffee(false) });
      it.push({ pos: new THREE.Vector3(X(1.2), 0, Z(-1.8)), r: 1.5, prompt: 'E - Have a pumpkin pastry', cond: () => !G.sitLow && !G.riding, act: () => Life.eat('pastry') });
      makeHearth(g, X(-3.6), Z(-0.2), Math.PI / 2, cols, 0.8);
      for (const tx of [-1.6, 1.8]) { await put(g, 'fb_table_small', X(tx), Z(1.2), { h: 0.8, col: 0.5, cols }); await chair('fb_chair_B_wood', tx - 0.9, 1.2, Math.PI / 2); await chair('fb_chair_B_wood', tx + 0.9, 1.2, -Math.PI / 2); }
      await put(g, 'fb_armchair', X(3.0), Z(2.4), { h: 1.0, rot: -2.3, col: 0.5, cols }); const arm = new THREE.Vector3(X(3.0), 0.12, Z(2.4)); it.push({ pos: arm, r: 1.8, prompt: 'E - Sink into the armchair', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(arm, -2.3) });
      await bed('fb_bed_single_A', -2.6, 2.6, Math.PI / 2, null); await put(g, 'fb_rug_oval_A', X(0), Z(1.0), { h: 0.04 }); await lamp(-3.2, -2.6, 1.5); makeWindow(g, X(3.84), 2.0, Z(-0.5), -Math.PI / 2); makeWindow(g, X(-2.0), 2.0, Z(-3.34), 0, 1.6, 1.0); makePainting(g, X(1.6), 2.2, Z(-3.34), 0, 'painting_dog', 1.1);
    } else if (template === 'library') {
      for (const x of [-2.6, 0, 2.6]) await put(g, 'fb_shelf_B_large_decorated', X(x), Z(-4.1), { h: 2.4, col: 0.7, cols });
      await put(g, 'fb_shelf_A_big', X(-3.6), Z(-1.2), { h: 2.2, rot: Math.PI / 2, col: 0.6, cols }); await put(g, 'fb_shelf_A_big', X(3.6), Z(-1.2), { h: 2.2, rot: -Math.PI / 2, col: 0.6, cols });
      const lect = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2618 })); lect.position.set(X(0), 0.55, Z(-1.6)); g.add(lect); cols.push({ x: X(0), z: Z(-1.6), r: 0.5 }); await put(g, 'ad_spellbook_open', X(0), Z(-1.6), { h: 0.12, y: 1.12 });
      for (const L of LORE_TOWN) it.push({ pos: new THREE.Vector3(X(0), 0, Z(-1.6)), r: 2.2, prompt: `E - Read: ${L.title}`, cond: () => !(G.flags.lore || []).includes(L.id), act: () => { G.flags.lore = G.flags.lore || []; G.flags.lore.push(L.id); Sound.play('pages', 0.7); UI.say(L.title.toUpperCase(), L.text); } });
      await put(g, 'fb_armchair_pillows', X(-2.4), Z(1.8), { h: 1.0, rot: 1.2, col: 0.5, cols }); const a1 = new THREE.Vector3(X(-2.4), 0.12, Z(1.8)); it.push({ pos: a1, r: 1.8, prompt: 'E - Sit and read', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(a1, 1.2) });
      await put(g, 'fb_armchair_pillows', X(2.4), Z(1.8), { h: 1.0, rot: -1.2, col: 0.5, cols }); const a2 = new THREE.Vector3(X(2.4), 0.12, Z(1.8)); it.push({ pos: a2, r: 1.8, prompt: 'E - Sit by the window', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(a2, -1.2) });
      await put(g, 'fb_table_small', X(0), Z(1.8), { h: 0.6, col: 0.5, cols }); await put(g, 'fb_book_set', X(0), Z(1.8), { h: 0.25, y: 0.6 }); await put(g, 'fb_rug_rectangle_B', X(0), Z(0.5), { h: 0.04 }); await lamp(3.2, 3.4); await bed('fb_bed_single_A', -2.6, 3.6, Math.PI / 2, null);
      makeWindow(g, X(3.84), 2.1, Z(1.8), -Math.PI / 2, 1.3, 1.9, 0x9a70ff); makeWindow(g, X(-3.84), 2.1, Z(1.8), Math.PI / 2, 1.3, 1.9, 0x9a70ff); makeHearth(g, X(0), Z(3.3), Math.PI, cols, 0.7);
    } else if (template === 'home') {
      const owner = { tobin: 'Tobin', juniper: 'Juniper' }[ROOMS[r.key].owner];
      await bed('fb_bed_single_A', -2.3, -1.6, 0, null); it.push({ pos: new THREE.Vector3(X(-2.3), 0, Z(-1.6)), r: 2.0, prompt: `E - Nap in ${owner}'s bed`, cond: () => !G.sitLow && !G.riding, act: () => { const f = (G.flags.friends || {})[ROOMS[r.key].owner]; if (!f || f.lvl < 3) { UI.toast(`That is ${owner}'s bed. You are not quite that kind of friend yet.`, 3); return; } Life.nap(`You wake on ${owner}'s bed under a borrowed blanket. The house is quiet and smells like home.`); } });
      makeHearth(g, X(0.6), Z(-2.75), 0, cols, 0.75);
      await put(g, 'fb_table_small', X(1.6), Z(0.6), { h: 0.8, col: 0.5, cols }); await chair('fb_chair_A_wood', 0.7, 0.6, Math.PI / 2); await chair('fb_chair_A_wood', 2.5, 0.6, -Math.PI / 2);
      await put(g, 'fb_shelf_B_small_decorated', X(2.6), Z(-2.6), { h: 1.6, col: 0.5, cols });
      await put(g, 'fb_cabinet_small_decorated', X(-2.7), Z(1.4), { h: 1.0, rot: Math.PI / 2, col: 0.5, cols }); await put(g, 'ad_mug_full', X(-2.7), Z(1.3), { h: 0.16, y: 1.0 });
      it.push({ pos: new THREE.Vector3(X(-2.7), 0, Z(1.4)), r: 1.8, prompt: 'E - Pour a coffee', cond: () => !G.sitLow && !G.riding, act: () => { const f = (G.flags.friends || {})[ROOMS[r.key].owner]; if (!f || f.lvl < 2) { UI.toast(`That is ${owner}'s kettle. Make a friend first.`, 3); return; } Life.coffee(false); } });
      await put(g, 'fb_rug_oval_A', X(0.4), Z(0.2), { h: 0.04 }); await put(g, 'fb_armchair', X(-2.2), Z(2.2), { h: 1.0, rot: 2.4, col: 0.5, cols }); const arm = new THREE.Vector3(X(-2.2), 0.12, Z(2.2)); it.push({ pos: arm, r: 1.8, prompt: 'E - Sit a while', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(arm, 2.4) });
      await lamp(2.9, 2.2, 1.5); makeWindow(g, X(3.34), 2.0, Z(0.4), -Math.PI / 2); makePainting(g, X(-1.2), 2.1, Z(-2.84), 0, ROOMS[r.key].owner === 'tobin' ? 'painting_sky' : 'painting_dog', 1.0);
    } else if (template === 'chapel') {
      for (const z of [-1.2, 0.8, 2.8]) for (const x of [-1.5, 1.5]) { await put(g, 'hw_bench', X(x), Z(z), { h: 0.85, rot: Math.PI, col: 0.6, cols }); const spot = new THREE.Vector3(X(x), 0.2, Z(z)); it.push({ pos: spot, r: 1.8, prompt: 'E - Sit in the quiet', cond: () => !G.sitLow && !G.riding, act: () => Life.sitChair(spot, Math.PI) }); }
      await put(g, 'hw_shrine_candles', X(0), Z(-4.4), { h: 1.7, col: 0.9, cols }); const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe8ff, emissiveIntensity: 1.6 })); orb.position.set(X(0), 2.1, Z(-4.4)); g.add(orb); r.orb = orb;
      const cl = new THREE.PointLight(0xbfd0ff, 14, 10, 1.8); cl.position.set(X(0), 1.8, Z(-4.0)); g.add(cl); for (const x of [-2.4, 2.4]) await put(g, 'hw_candle_triple', X(x), Z(-4.3), { h: 0.5, y: 0.0 });
      it.push({ pos: new THREE.Vector3(X(0), 0, Z(-3.4)), r: 2.4, prompt: 'E - Light a candle', cond: () => !G.sitLow && !G.riding, act: () => Life.pray() });
      makeWindow(g, X(0), 2.3, Z(-5.34), 0, 1.4, 1.8, 0x7fa0ff); makeWindow(g, X(-3.34), 2.1, Z(0.5), Math.PI / 2, 0.8, 1.8, 0x9a70ff); makeWindow(g, X(3.34), 2.1, Z(0.5), -Math.PI / 2, 0.8, 1.8, 0x9a70ff);
      await put(g, 'fb_rug_rectangle_B', X(0), Z(0.8), { h: 0.04 });
    }
  },
  lairExtras() {
    // your own scrying screen and kettle at home
    const lair = G.areas.lair; if (!lair) return; const g = lair.group; const ox = 300, oz = 0;
    const scr = makeScreen(g, ox - 4.75, 1.9, oz + 1.9, 1.81); Life.screens.push(scr);
    KK('fb_armchair').then((gl) => { if (!gl) return; const o = Assets.instance(gl); Assets.fitHeight(o, 1.0); o.position.set(ox - 1.9, 0, oz + 1.2); o.rotation.y = -1.33; g.add(o); lair.colliders.push({ x: ox - 1.9, z: oz + 1.2, r: 0.5 }); });
    const spot = new THREE.Vector3(ox - 1.9, 0.12, oz + 1.2); lair.interact.push({ pos: spot, r: 2.0, prompt: 'E - Watch the scrying screen', cond: () => !G.sitLow, act: () => Life.watch(scr, spot, 1.81) });
    lair.interact.push({ pos: new THREE.Vector3(ox + 3.2, 0, oz + 2.4), r: 1.8, prompt: 'E - Pour a coffee', cond: () => !G.sitLow, act: () => Life.coffee(true) });
    KK('ad_mug_full').then((gl) => { if (!gl) return; const o = Assets.instance(gl); Assets.fitHeight(o, 0.16); o.position.set(ox + 3.0, 0.8, oz + 2.6); g.add(o); });
  },
  rainy() { return G.day % 4 === 3; },
  makeRain() { const N = 1100; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 26; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 26; } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const c = document.createElement('canvas'); c.width = 8; c.height = 32; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(3, 0, 2, 32); rain = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: 0xbcc4e8, size: 0.5, transparent: true, opacity: 0.5, depthWrite: false })); rain.frustumCulled = false; rain.visible = false; G.scene.add(rain); },
  updateRain(dt) {
    const outdoors = G.area === 'town' || (G.area === 'vale' && G.player.pos.z > World.SPLIT_Z); const want = outdoors && this.rainy();
    if (want !== rainOn) { rainOn = want; if (!rain) this.makeRain(); rain.visible = want; if (want) { Sound.loop('rain', 0.35); if (!G.flags.rainSeen || G.flags.rainSeen !== G.day) { G.flags.rainSeen = G.day; UI.toast('Rain. The soft kind, the kind that makes a tavern feel like an idea.', 4); } } else Sound.stopLoop('rain'); }
    if (!rainOn) return; const p = G.player.pos; const a = rain.geometry.attributes.position; const arr = a.array;
    for (let i = 0; i < arr.length; i += 3) { arr[i + 1] -= dt * 9; if (arr[i + 1] < 0) { arr[i + 1] = 14; arr[i] = (Math.random() - 0.5) * 26; arr[i + 2] = (Math.random() - 0.5) * 26; } } a.needsUpdate = true; rain.position.set(p.x, p.y, p.z);
  },
  update(dt) {
    const b = flagBuffs(); const p = G.player; const n = night(); this.updateRain(dt);
    G.speedMul = b.coffee === G.day ? 1.15 : 1;
    if (b.fed === G.day && p.hp > 0 && p.hp < p.maxHp && G.area !== 'road') p.hp = Math.min(p.maxHp, p.hp + dt * 0.6);
    if (G.area === 'town') { for (const l of lamps) l.light.intensity += (l.max * (0.15 + 0.85 * n) * (1 + Math.sin(G.t * 7 + l.light.position.x) * 0.06) - l.light.intensity) * 0.1; }
    for (const w of windows) { const warm = 0.25 + 0.75 * n; w.m.material.emissiveIntensity = warm * 0.7; w.m.material.emissive.setHex(w.color).lerp(new THREE.Color(0x335588), 1 - n); }
    for (const s of Life.screens) if (s.on) { s.light.intensity = 5 + Math.sin(G.t * 13) * 1.5 + Math.sin(G.t * 31) * 0.8; const { tex } = video(s.ch); tex.needsUpdate = true; }
    for (const k in this.rooms) { const r = this.rooms[k]; if (r.orb && G.area === r.area) { r.orb.rotation.y = G.t; r.orb.position.y = 2.1 + Math.sin(G.t * 1.5) * 0.08; } }
    if (G.area !== 'town' && !G.area.startsWith('room_')) return;
    for (const o of G.areas[G.area].group.children) if (o.userData && o.userData.flame) { o.userData.flame.scale.set(1 + Math.sin(G.t * 9) * 0.08, 1 + Math.sin(G.t * 13) * 0.12, 1); o.userData.fire.intensity = 36 * o.scale.x + Math.sin(G.t * 11) * 3; }
  },
};
