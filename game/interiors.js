// The tower: the Lair downstairs, the bedchamber upstairs, and the bed you can actually get into.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, Music } from './audio.js';
import { UI, STR } from './ui.js';
import { World, VALE } from './world.js';
import { enterArea, transition, save, advanceClock } from './main.js';
import { Road } from './road.js';

let G; const L = { ox: 300, oz: 0 }, C = { ox: 300, oz: 60 }; // interiors live far from the Vale
const KK = (n) => Assets.gltf(`assets/models/kk/${n}.gltf`);
const R = 5.2; // tower inner radius

function roomShell(group, ox, oz, radius, height, floorTex, wallColor) {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.3, 40), new THREE.MeshStandardMaterial({ map: Assets.tex(`assets/tex/${floorTex}.jpg`), normalMap: Assets.tex(`assets/tex/${floorTex}_n.jpg`, { linear: true }), roughness: 0.9 }));
  floor.material.map.repeat.set(3, 3); floor.rotation.x = -Math.PI / 2; floor.position.set(ox, 0, oz); floor.receiveShadow = true; group.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28, 1, true), new THREE.MeshStandardMaterial({ map: Assets.tex('assets/tex/cobble.jpg'), normalMap: Assets.tex('assets/tex/cobble_n.jpg', { linear: true }), color: wallColor, roughness: 0.95, side: THREE.BackSide }));
  wall.material.map.repeat.set(6, 2); wall.position.set(ox, height / 2, oz); wall.receiveShadow = true; group.add(wall);
  const ceil = new THREE.Mesh(new THREE.ConeGeometry(radius + 0.2, 2.6, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: 1, side: THREE.BackSide })); ceil.position.set(ox, height + 1.3, oz); group.add(ceil);
  const beams = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.1, 0.12, 6, 28), new THREE.MeshStandardMaterial({ color: 0x3a2618 })); beams.rotation.x = Math.PI / 2; beams.position.set(ox, height - 0.1, oz); group.add(beams);
}
async function put(group, name, x, z, { h, rot = 0, col = 0, cols, tint, emissive, light } = {}) {
  const g = await KK(name); const obj = Assets.instance(g); if (h) Assets.fitHeight(obj, h); obj.position.set(x, 0, z); obj.rotation.y = rot; group.add(obj);
  if (tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); } });
  if (col) cols.push({ x, z, r: col }); return obj;
}

export const Interiors = {
  sleeping: false,
  async init(g) {
    G = g; await this.buildLair(); await this.buildChamber();
  },
  async buildLair() {
    const group = new THREE.Group(); group.visible = false; G.scene.add(group); const cols = [], interact = []; const { ox, oz } = L;
    roomShell(group, ox, oz, R, 4.2, 'wood', 0x9a90b0);
    // hearth with a real fire, cauldron, shelves, lectern, music box, stair, door, window
    const hearth = new THREE.Group(); const stone = new THREE.MeshStandardMaterial({ map: Assets.tex('assets/tex/cobble.jpg'), roughness: 1, color: 0xb0a8c0 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.5), stone); back.position.set(0, 1.3, 0); hearth.add(back); const hole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.52), new THREE.MeshStandardMaterial({ color: 0x090406 })); hole.position.set(0, 0.6, 0.02); hearth.add(hole);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.7), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); mantel.position.set(0, 1.5, 0.1); hearth.add(mantel);
    const fl = new THREE.PointLight(0xff9a40, 45, 14, 1.6); fl.position.set(0, 0.7, 0.6); fl.castShadow = true; fl.shadow.mapSize.set(512, 512); hearth.add(fl); hearth.userData.fire = fl;
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), new THREE.MeshStandardMaterial({ color: 0x3a2214 })); logs.rotation.z = Math.PI / 2; logs.position.set(0, 0.15, 0.1); hearth.add(logs);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 })); flame.position.set(0, 0.6, 0.1); hearth.add(flame); hearth.userData.flame = flame;
    hearth.position.set(ox, 0, oz - R + 0.3); group.add(hearth); cols.push({ x: ox, z: oz - R + 0.5, r: 1.6 }); this.hearth = hearth;
    // trophy: the King's dark eye (visible once he is beaten) and the snow globe
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x0a0612, roughness: 0.3 })); eye.position.set(ox, 2.3, oz - R + 0.62); eye.visible = !!G.won; group.add(eye); this.eye = eye;
    interact.push({ pos: eye.position.clone().setY(0.5), r: 2.6, prompt: STR.pTrophy, act: () => UI.toast(STR.trophy, 3), cond: () => G.won });
    const globe = new THREE.Group(); const glass = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, roughness: 0.05, thickness: 0.2, transparent: true, opacity: 0.6 })); glass.position.y = 0.26; globe.add(glass);
    const tiny = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x5a6a90 })); tiny.position.y = 0.26; globe.add(tiny); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); base.position.y = 0.04; globe.add(base);
    globe.position.set(ox + 0.9, 1.6, oz - R + 0.65); globe.visible = !!G.flags.globe; group.add(globe); this.globe = globe;
    await put(group, 'fb_shelf_B_large_decorated', ox - 3.4, oz - 2.6, { h: 2.2, rot: 0.9, col: 0.9, cols });
    await put(group, 'fb_shelf_A_big', ox + 3.6, oz - 2.2, { h: 2.0, rot: -1.1, col: 0.9, cols });
    await put(group, 'fb_rug_oval_A', ox, oz + 0.4, { h: 0.05 });
    await put(group, 'fb_armchair_pillows', ox + 2.2, oz - 0.8, { h: 1.1, rot: -2.2, col: 0.6, cols });
    await put(group, 'fb_table_small', ox + 3.2, oz + 2.4, { h: 0.8, rot: 0.3, col: 0.6, cols });
    const lamp = await put(group, 'fb_lamp_table', ox + 3.2, oz + 2.4, { h: 1.3 }); const lampL = new THREE.PointLight(0xffd090, 14, 8, 1.8); lampL.position.set(ox + 3.2, 1.3, oz + 2.4); group.add(lampL);
    await put(group, 'fb_book_set', ox + 3.1, oz + 2.2, { h: 0.9 });
    // cauldron
    const caul = new THREE.Group(); const pot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12, 0, 6.283, 0.9, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.7, roughness: 0.5 })); pot.position.y = 0.55; caul.add(pot);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshStandardMaterial({ color: 0x8a40ff, emissive: 0x8a40ff, emissiveIntensity: 1.2 })); brew.rotation.x = -Math.PI / 2; brew.position.y = 0.82; caul.add(brew); const cl = new THREE.PointLight(0x9a50ff, 10, 5, 1.8); cl.position.y = 1.2; caul.add(cl);
    for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6), pot.material); const a = i * 2.1; leg.position.set(Math.cos(a) * 0.35, 0.25, Math.sin(a) * 0.35); caul.add(leg); }
    caul.position.set(ox - 2.6, 0, oz + 1.2); group.add(caul); cols.push({ x: ox - 2.6, z: oz + 1.2, r: 0.8 }); this.caul = caul;
    interact.push({ pos: new THREE.Vector3(ox - 2.6, 0, oz + 1.2), r: 2.4, prompt: STR.pBrew, act: () => G.cozyRef && G.cozyRef.openBrew() });
    interact.push({ pos: new THREE.Vector3(ox - 3.4, 0, oz - 2.6), r: 2.4, prompt: STR.pLore, cond: () => !(G.flags.lore || []).includes('star'), act: () => G.cozyRef && G.cozyRef.readLore('star') });
    interact.push({ pos: new THREE.Vector3(ox + 3.6, 0, oz - 2.2), r: 2.4, prompt: STR.pLore, cond: () => !(G.flags.lore || []).includes('king'), act: () => G.cozyRef && G.cozyRef.readLore('king') });
    // lectern with the quest tome
    const lect = new THREE.Group(); const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); post.position.y = 0.55; lect.add(post); const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), post.material); top.position.y = 1.12; top.rotation.x = -0.4; lect.add(top);
    const tome = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, emissive: 0x3060a0, emissiveIntensity: 0.6 })); tome.position.y = 1.2; tome.rotation.x = -0.4; lect.add(tome);
    lect.position.set(ox - 1.4, 0, oz + 3.2); lect.rotation.y = 0.5; group.add(lect); cols.push({ x: ox - 1.4, z: oz + 3.2, r: 0.5 });
    interact.push({ pos: new THREE.Vector3(ox - 1.4, 0, oz + 3.2), r: 2.4, prompt: STR.pTome, act: () => UI.say(...(G.won ? STR.tomeDone : STR.tome)) });
    // music box (gramophone)
    const box = new THREE.Group(); const bbase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); bbase.position.y = 0.95; box.add(bbase); const horn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc9a34a, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })); horn.rotation.x = -1.2; horn.position.set(0, 1.45, 0.1); box.add(horn);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); stand.position.y = 0.4; box.add(stand); box.position.set(ox + 2.2, 0, oz + 3.4); group.add(box); cols.push({ x: ox + 2.2, z: oz + 3.4, r: 0.5 });
    interact.push({ pos: new THREE.Vector3(ox + 2.2, 0, oz + 3.4), r: 2.4, prompt: STR.pBox, act: () => { const n = Music.next(); Sound.play('page', 0.5, 1.6); UI.toast(n ? STR.boxPlay(n) : STR.boxEmpty); } });
    // stair up (a spiral of wedge steps along the wall) and the front door
    const stair = new THREE.Group(); for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); const a = -0.9 - i * 0.3; s.position.set(Math.cos(a) * (R - 0.7), 0.2 + i * 0.32, Math.sin(a) * (R - 0.7)); s.rotation.y = -a; stair.add(s); }
    stair.position.set(ox, 0, oz); group.add(stair); const stairPos = new THREE.Vector3(ox + Math.cos(-0.9) * (R - 1.4), 0, oz + Math.sin(-0.9) * (R - 1.4));
    interact.push({ pos: stairPos, r: 2.4, prompt: STR.pStairsUp, act: () => { Sound.play('door', 0.5, 0.8); transition(() => enterArea('chamber', G.areas.chamber.spawn())); } });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 })); door.position.set(ox, 1.2, oz + R - 0.1); group.add(door);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.1, 6, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x6a6a7a })); frame.position.set(ox, 1.9, oz + R - 0.2); group.add(frame);
    interact.push({ pos: new THREE.Vector3(ox, 0, oz + R - 0.6), r: 2.4, prompt: STR.pDoorOut, act: () => { Sound.play('door', 0.9); transition(() => enterArea('vale', G.areas.vale.spawn())); } });
    // round window onto the stars
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ map: Assets.tex('assets/tex/sky_night.jpg', { clamp: true }), color: 0x8888aa })); win.position.set(ox + R - 0.15, 2.4, oz - 1.2); win.rotation.y = -Math.PI / 2; group.add(win); this.winLair = win;
    const wl = new THREE.PointLight(0x6a70ff, 6, 6, 1.8); wl.position.set(ox + R - 0.8, 2.4, oz - 1.2); group.add(wl);
    const amb = new THREE.PointLight(0xffd0a0, 30, 16, 1.4); amb.position.set(ox, 3.4, oz); group.add(amb);
    G.areas.lair = { group, interact, colliders: cols, spawn: () => ({ pos: new THREE.Vector3(ox, 0, oz + R - 1.6), yaw: 0 }), heightAt: () => 0,
      clamp: (p) => { const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz), m = R - 0.5; if (d > m) { p.x = ox + (dx / d) * m; p.z = oz + (dz / d) * m; } },
      collide: (p, r) => { for (const c of cols) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); } } },
      onEnter: () => { UI.banner(STR.zoneLair); Music.play('lair'); Sound.stopLoop('wind'); Sound.stopLoop('autumn'); Sound.stopLoop('night'); Sound.loop('hearth', 0.35); G.scene.fog.density = 0.004; eye.visible = !!G.won; globe.visible = !!G.flags.globe; } };
  },
  async buildChamber() {
    const group = new THREE.Group(); group.visible = false; G.scene.add(group); const cols = [], interact = []; const { ox, oz } = C;
    roomShell(group, ox, oz, R - 0.6, 3.6, 'wood', 0x8a7a90);
    // the four-poster bed with a red canopy
    const bed = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 }); const red = new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.9, side: THREE.DoubleSide });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 2.6), wood); frame.position.y = 0.25; bed.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.4), new THREE.MeshStandardMaterial({ color: 0xf0ece0, roughness: 1 })); mattress.position.y = 0.65; bed.add(mattress);
    const spread = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.12, 1.7), new THREE.MeshStandardMaterial({ color: 0xa83a22, roughness: 1 })); spread.position.set(0, 0.86, 0.3); bed.add(spread);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })); pillow.position.set(0, 0.9, -0.9); bed.add(pillow);
    for (const [x, z] of [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 10), wood); post.position.set(x, 1.3, z); bed.add(post); }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 2.8), red); canopy.position.y = 2.62; bed.add(canopy);
    for (const [x, z, ry] of [[-1.05, 0, 0], [1.05, 0, 0], [0, -1.35, Math.PI / 2]]) { const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.3), red); curtain.position.set(x, 1.45, z); curtain.rotation.y = ry; bed.add(curtain); }
    const canopyInner = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6), new THREE.MeshStandardMaterial({ color: 0x6a1414, roughness: 1, side: THREE.DoubleSide })); canopyInner.rotation.x = Math.PI / 2; canopyInner.position.y = 2.58; bed.add(canopyInner);
    bed.position.set(ox, 0, oz - 1.4); group.add(bed); cols.push({ x: ox, z: oz - 1.4, r: 1.6 }); this.bed = bed; this.bedPos = new THREE.Vector3(ox, 0, oz - 1.4);
    this.blanket = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshStandardMaterial({ color: 0xa83a22, roughness: 1, side: THREE.DoubleSide })); this.blanket.visible = false; group.add(this.blanket);
    const nightstand = await put(group, 'fb_table_small', ox + 1.5, oz - 2.2, { h: 0.7, col: 0.4, cols }); const lamp = await put(group, 'fb_lamp_table', ox + 1.5, oz - 2.2, { h: 1.1 });
    const lampL = new THREE.PointLight(0xffc070, 16, 9, 1.8); lampL.position.set(ox + 1.5, 1.2, oz - 2.2); group.add(lampL); this.lampL = lampL;
    await put(group, 'fb_shelf_B_large_decorated', ox - 3.2, oz + 1.2, { h: 2.0, rot: 1.3, col: 0.9, cols });
    await put(group, 'fb_rug_rectangle_B', ox, oz + 1.5, { h: 0.05 });
    await put(group, 'fb_book_set', ox - 1.5, oz + 2.5, { h: 0.5 }); await put(group, 'fb_book_single', ox + 1.2, oz + 2.1, { h: 0.2 });
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ map: Assets.tex('assets/tex/sky_night.jpg', { clamp: true }), color: 0x9090bb })); win.position.set(ox - R + 0.75, 2.0, oz - 0.5); win.rotation.y = Math.PI / 2; group.add(win); this.win = win;
    const moonL = new THREE.PointLight(0x7080ff, 9, 7, 1.8); moonL.position.set(ox - R + 1.5, 2.0, oz - 0.5); group.add(moonL);
    const amb2 = new THREE.PointLight(0xffd0a0, 22, 14, 1.4); amb2.position.set(ox, 3, oz); group.add(amb2);
    const stairPos = new THREE.Vector3(ox + R - 1.8, 0, oz + 2.2);
    interact.push({ pos: stairPos, r: 2.4, prompt: STR.pStairsDown, act: () => { Sound.play('door', 0.5, 0.8); transition(() => enterArea('lair', { pos: new THREE.Vector3(L.ox + Math.cos(-0.9) * (R - 1.4), 0, L.oz + Math.sin(-0.9) * (R - 1.4)), yaw: 2.2 })); } });
    interact.push({ pos: new THREE.Vector3(ox, 0, oz + 0.3), r: 2.6, prompt: STR.pBed, act: () => this.sleep(), cond: () => !G.sleeping });
    G.areas.chamber = { group, interact, colliders: cols, spawn: () => ({ pos: stairPos.clone().add(new THREE.Vector3(-0.6, 0, -0.4)), yaw: 0.8 }), heightAt: () => 0,
      clamp: (p) => { const dx = p.x - ox, dz = p.z - oz, d = Math.hypot(dx, dz), m = R - 1.1; if (d > m) { p.x = ox + (dx / d) * m; p.z = oz + (dz / d) * m; } },
      collide: (p, r) => { for (const c of cols) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x += (dx / d) * (m - d); p.z += (dz / d) * (m - d); } } },
      onEnter: () => { UI.banner(STR.zoneChamber); Music.play('chamber'); Sound.stopLoop('hearth'); Sound.loop('night', 0.35); G.scene.fog.density = 0.004; } };
  },
  /** The bed sequence: walk to the bedside, sit, swing in, lie back under the blanket, eyes close, night passes, wake at dawn. */
  sleep() {
    if (G.sleeping) return; G.sleeping = true; const p = G.player; const b = this.bedPos; const vign = document.getElementById('vign');
    const side = new THREE.Vector3(b.x + 1.35, 0, b.z + 0.2), sit = new THREE.Vector3(b.x + 0.75, 0, b.z + 0.2), lie = new THREE.Vector3(b.x, 0, b.z - 0.3);
    const yawToBed = Math.atan2(-(b.x - side.x), -(b.z - side.z));
    const start = { pos: p.pos.clone().setY(p.pos.y + 1.62), yaw: p.yaw, pitch: p.pitch };
    const keys = [ // time, position (eye), yaw, pitch, roll
      { t: 0, pos: start.pos, yaw: start.yaw, pitch: start.pitch },
      { t: 1.6, pos: side.clone().setY(1.62), yaw: yawToBed, pitch: -0.3 },
      { t: 2.8, pos: sit.clone().setY(1.25), yaw: yawToBed + Math.PI / 2, pitch: -0.15 },
      { t: 4.2, pos: lie.clone().setY(1.05), yaw: Math.PI, pitch: 1.3, roll: 0.15 },
      { t: 5.2, pos: lie.clone().setY(1.0), yaw: Math.PI, pitch: 1.45, roll: 0.05 },
    ];
    G.sleepCam = { pos: start.pos.clone(), yaw: start.yaw, pitch: start.pitch, roll: 0 }; this.seq = { t: 0, keys, phase: 'in' }; Sound.play('page', 0.5, 0.7);
    setTimeout(() => UI.toast(STR.sleep, 4), 4200);
    setTimeout(() => { vign.classList.add('sleep'); }, 6500);
    setTimeout(() => { vign.classList.add('closed'); this.seq.phase = 'night'; Sound.play('snore', 0.2); }, 8500);
    setTimeout(() => { // the night passes: jump the clock to dawn, save, wake
      G.clock = 0.27; G.day++; save(); Sound.play('snore', 0.15, 1.1); }, 10500);
    setTimeout(() => { vign.classList.remove('closed'); setTimeout(() => vign.classList.remove('sleep'), 600); this.seq = { t: 0, keys: [{ t: 0, pos: lie.clone().setY(1.0), yaw: Math.PI, pitch: 1.45 }, { t: 1.4, pos: sit.clone().setY(1.25), yaw: yawToBed + Math.PI / 2, pitch: -0.1 }, { t: 2.6, pos: side.clone().setY(1.62), yaw: yawToBed, pitch: 0 }], phase: 'out' }; UI.toast(STR.wake, 4); }, 12500);
    setTimeout(() => { G.sleeping = false; G.sleepCam = null; p.pos.copy(side); p.yaw = yawToBed; p.pitch = 0; this.blanket.visible = false; }, 15300);
  },
  update(dt) {
    const t = G.t;
    if (this.hearth && G.area === 'lair') { this.hearth.userData.fire.intensity = 42 + Math.sin(t * 11) * 5 + Math.sin(t * 29) * 3; const f = this.hearth.userData.flame; f.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 17) * 0.15, 1); f.rotation.y = t * 2; }
    if (this.caul && G.area === 'lair') { this.caul.children[1].material.emissiveIntensity = 1 + Math.sin(t * 3) * 0.3 + (G.brewFlash > 0 ? G.brewFlash * 4 : 0); this.caul.children[2].intensity = 10 + (G.brewFlash > 0 ? G.brewFlash * 40 : 0); }
    for (const w of [this.winLair, this.win]) if (w) { const n = THREE.MathUtils.smoothstep(G.clock, 0.72, 0.88) * (1 - THREE.MathUtils.smoothstep(G.clock, 0.2, 0.32)); w.material.color.setHSL(0.65, 0.4, 0.35 + 0.35 * (1 - n)); }
    if (this.seq && G.sleeping) {
      const s = this.seq; s.t += dt; const k = s.keys; let i = 0; while (i < k.length - 2 && s.t > k[i + 1].t) i++;
      const a = k[i], b = k[Math.min(i + 1, k.length - 1)]; const u = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((s.t - a.t) / Math.max(0.01, b.t - a.t), 0, 1), 0, 1);
      G.sleepCam.pos.lerpVectors(a.pos, b.pos, u); G.sleepCam.yaw = a.yaw + (b.yaw - a.yaw) * u; G.sleepCam.pitch = a.pitch + (b.pitch - a.pitch) * u; G.sleepCam.roll = (a.roll || 0) + ((b.roll || 0) - (a.roll || 0)) * u;
      if (s.phase === 'in' && s.t > 4.2) { this.blanket.visible = true; const bl = this.blanket; bl.position.set(this.bedPos.x, 1.0 + Math.sin(t * 1.5) * 0.01, this.bedPos.z + 0.35 - Math.min(1, (s.t - 4.2)) * 0.5); bl.rotation.x = -Math.PI / 2 + 0.55; }
      // gentle breathing sway while lying down
      if (s.phase === 'night') { G.sleepCam.pitch = 1.45 + Math.sin(t * 0.8) * 0.01; G.sleepCam.roll = Math.sin(t * 0.5) * 0.01; }
      this.lampL.intensity = 16 + Math.sin(t * 7) * 1.2;
    }
  },
};
