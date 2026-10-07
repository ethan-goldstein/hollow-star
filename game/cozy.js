// The cozy layer: sitting, fetch and snowballs, the lantern festival, aurora, fireflies, embers, brewing, journal, quests, options.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, Music, store, $ } from './audio.js';
import { UI, STR } from './ui.js';
import { World, VALE } from './world.js';
import { Player } from './player.js';
import { Crew } from './crew.js';
import { Animals } from './animals.js';
import { burst, ring } from './spells.js';

let G, group;
const V = () => World.VALE;

// ── lore and quests ────────────────────────────────────────────────────────
export const LORE = [
  { id: 'star', title: 'The Hollow Star', text: 'Before the tower had a roof, a star came down through the pines. It did not burn. It did not stop. It fell past the roots of the world and kept falling, and where it had been there was only a hollow in the sky, and a man who had watched it too long.' },
  { id: 'king', title: 'The King Who Watched', text: 'He was a wizard once, like you, with a hat like yours and a kettle that whistled. He looked into the hollow until the hollow looked back, and his eyes have burned with its dark ever since. He is not cruel. He is only still looking.' },
  { id: 'shards', title: 'Of Shards', text: 'Three pieces of the star caught in the world on the way down: one in a graveyard, one in a river of light, one on a road above the clouds. Each is a little of the dark he wants. Bring them to his gate and it will open, because he has been waiting to be given back what he lost.' },
  { id: 'vale', title: 'Emberfall', text: 'The village lights its lanterns against the long autumn night. It is said that when every flame in Emberfall burns at once, the sky remembers how to be kind, and lanterns of paper rise to keep the stars company.' },
  { id: 'wolves', title: 'The Winterwood', text: 'The wolves at the tree line are not hungry. They are the old guard of a wood that has forgotten what it guards. They watch the one with the staff because the stag told them to. Be gentle with them and they will be gentle with you.' },
];
const QUESTS = [
  { id: 'stone', title: 'The fox buried something', done: () => !!G.flags.dug, hint: 'Dig under the birch by the well.' },
  { id: 'feathers', title: 'Three feathers for the owl', done: () => !!G.flags.owlDone, hint: () => `Owl feathers drift down under the pines at night. You have ${G.inv.feather || 0} / 3.` },
  { id: 'crystal', title: 'Frost the stag\'s antlers', done: () => (G.inv.crystal || 0) > 0 || !!G.flags.hadCrystal, hint: 'Cast Frost at the frost stag. He does not mind.' },
  { id: 'lanterns', title: 'Light every lantern in Emberfall', done: () => World.allLit(), hint: 'Ember, second finger. Lanterns and pumpkins both.' },
  { id: 'festival', title: 'See the sky lanterns rise', done: () => !!G.flags.festivalSeen, hint: 'When everything is lit after dusk, wait in the village.' },
  { id: 'road', title: 'Walk the Vesper Road', done: () => !!G.won, hint: 'The gate is at the south-east corner of the village.' },
  { id: 'lore', title: 'Read the five pages', done: () => (G.flags.lore || []).length >= 5, hint: () => `Pages so far: ${(G.flags.lore || []).length} / 5. Look on the shelves, at the shrine, in the crypt, at the keep.` },
];
const RECIPES = [
  { id: 'flask', name: 'Moonflask refill', cost: { acorn: 1, crystal: 1 }, desc: 'Both flasks full again.', act: () => { G.player.flasks = 2; } },
  { id: 'hearthglow', name: 'Hearthglow', cost: { acorn: 2 }, desc: 'Every lantern burns twice as bright until morning.', act: () => { G.flags.hearthglow = G.day; } },
  { id: 'starwater', name: 'Starwater', cost: { crystal: 1, stone: 1 }, desc: 'The pond freezes and stays frozen.', act: () => { if (!G.pondFrozen) World.freeze(); G.flags.starwater = true; } },
  { id: 'nightsight', name: 'Nightsight', cost: { feather: 1, acorn: 1 }, desc: 'A brighter, bluer moon tonight. Animals and shinies glimmer in the dark.', act: () => { G.flags.nightsight = G.day; } },
];

// ── state ──────────────────────────────────────────────────────────────────
const S = { sitting: null, sitT: 0, fireflies: null, embers: null, smoke: null, festival: null, lanterns: [], aurora: null, auroraOn: false, bellDay: 0, stick: null, snowballs: [], feathers: [], cozyT: 0, breathT: 0, hare: null };
const COZY_LINES = ['The fire pops. Marigold sighs in her sleep.', 'Somewhere north, an owl. Somewhere nearer, the fox pretending not to listen.', 'The leaves come down like slow sparks.', 'Your tea is gone. You do not remember drinking it.', 'The lanterns hum. The night is long and kind.', 'Snow settles on your hat and does not melt.'];

export const Cozy = {
  S, LORE, QUESTS,
  async init(g) {
    G = g; G.cozyRef = this; group = new THREE.Group(); World.group.add(group);
    this.makeParticles(); this.makeAurora(); await this.placeCozyProps(); this.registerInteract(); this.initOptions();
    G.timeScale = 1;
  },
  // ── props: cottages, stall, gazebo, dock, hot spring, firewood, grass tufts, leaf piles ──
  async placeCozyProps() {
    const th = World.terrainHeight; const [tx, tz] = V().tower;
    const put = async (file, x, z, h, rot, col) => { const g = await Assets.gltf(`assets/models/gen/${file}.glb`); if (!g) return null; const o = Assets.instance(g); Assets.fitHeight(o, h); o.position.set(x, th(x, z) - 0.05, z); o.rotation.y = rot; group.add(o); if (col) World.colliders.push({ x, z, r: col }); return o; };
    // cottages around the village edge, each with a window glow and a chimney
    const homes = [[-15, 24, 0.9], [15, 25, -1.0], [-16, 15, 1.4], [16, 10, -1.6]];
    S.homes = [];
    for (const [x, z, rot] of homes) { const o = await put('cottage', x, z, 5.5, rot, 2.8); if (!o) continue; const wl = new THREE.PointLight(0xffb060, 0, 9, 1.8); wl.position.set(x - Math.sin(rot) * 1.5, th(x, z) + 1.6, z - Math.cos(rot) * 1.5); group.add(wl); S.homes.push({ x, z, light: wl, chimney: new THREE.Vector3(x + Math.sin(rot + 1.2) * 1.4, th(x, z) + 5.2, z + Math.cos(rot + 1.2) * 1.4) }); }
    await put('stall', 7.5, 21.5, 3.2, 0.4, 1.8);
    const gz = await put('gazebo', -4.5, 8.5, 4.2, 0.2, 1.6); if (gz) { S.gazebo = new THREE.Vector3(-4.5, th(-4.5, 8.5), 8.5); const gl = new THREE.PointLight(0xffc080, 10, 9, 1.8); gl.position.set(-4.5, th(-4.5, 8.5) + 2.6, 8.5); group.add(gl); }
    const pond = V().pond; const dock = await put('dock', pond.x + pond.rx - 1.2, pond.z + 1.5, 1.6, Math.PI / 2, 0); if (dock) { const dl = new THREE.PointLight(0xffa850, 8, 8, 1.8); dl.position.set(pond.x + pond.rx - 4.5, 1.9, pond.z + 1.5); group.add(dl); }
    { const pond = V().pond; S.dock = new THREE.Vector3(pond.x + pond.rx - 3.2, 0.25, pond.z + 1.5); S.pondY = -0.08; }
    S.spring = new THREE.Vector3(-14, 0, -8); S.spring.y = th(-14, -8); const sp = await put('spring', -14, -8, 1.6, 0.3, 0); if (sp) { World.colliders.push({ x: -14, z: -8, r: 1.1 }); const sl = new THREE.PointLight(0x80b0ff, 6, 7, 1.8); sl.position.set(-14, th(-14, -8) + 1, -8); group.add(sl); }
    // firewood stacks, grass tufts, leaf piles as billboards
    const tex = (n) => { const t = Assets.tex(`assets/img/${n}.png`); return t; };
    const bill = (n, count, pick, size, flat) => {
      const geo = new THREE.PlaneGeometry(size, size); if (flat) geo.rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ map: tex(n), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
      const im = new THREE.InstancedMesh(geo, m, count); const d = new THREE.Object3D(); let n2 = 0;
      for (let i = 0; i < count * 4 && n2 < count; i++) { const p = pick(); if (!p) continue; d.position.set(p[0], th(p[0], p[1]) + (flat ? 0.03 : size * 0.42), p[1]); d.rotation.set(0, Math.random() * 6.28, 0); d.scale.setScalar(0.7 + Math.random() * 0.6); d.updateMatrix(); im.setMatrixAt(n2++, d.matrix); }
      im.count = n2; im.receiveShadow = true; group.add(im); return im;
    };
    const r = () => Math.random(); const inV = (x, z) => x > V().minX + 1 && x < V().maxX - 1 && z > V().minZ + 1 && z < V().maxZ - 1;
    const free = (x, z) => inV(x, z) && !World.inPond(x, z) && Math.hypot(x - tx, z - tz) > 5 && !World.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.6);
    bill('grass', 220, () => { const x = V().minX + r() * V().w, z = World.SPLIT_Z + 1 + r() * (V().maxZ - World.SPLIT_Z - 2); return free(x, z) ? [x, z] : null; }, 0.9, false);
    bill('leafpile', 70, () => { const x = V().minX + r() * V().w, z = World.SPLIT_Z + 1 + r() * (V().maxZ - World.SPLIT_Z - 2); return free(x, z) ? [x, z] : null; }, 1.4, true);
    for (const [x, z] of [[tx + 4.2, tz + 1.5], [-13.5, 22.5], [V().campfire[0] - 3, V().campfire[1] + 2.5]]) { const fw = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ map: tex('firewood'), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })); fw.position.set(x, th(x, z) + 0.36, z); fw.rotation.y = Math.random() * 3; group.add(fw); }
    // the campfire log bench spot
    const benchProp = World.props.find((pr) => pr.kind === 'bench' && Math.hypot(pr.x - V().campfire[0], pr.z - V().campfire[1]) < 4); const bx = benchProp ? benchProp.x : V().campfire[0] - 2.7, bz = benchProp ? benchProp.z : V().campfire[1]; S.bench = new THREE.Vector3(bx, th(bx, bz) + 0.3, bz);
  },
  registerInteract() {
    const it = World.interact;
    it.push({ pos: S.bench, r: 2.4, prompt: () => S.sitting ? '' : STR.pSit, cond: () => !S.sitting, act: () => this.sit('fire') });
    it.push({ pos: S.spring, r: 2.6, prompt: STR.pSpring, cond: () => !S.sitting, act: () => this.sit('spring') });
    it.push({ pos: S.dock, r: 2.6, prompt: 'E - Cast a line', cond: () => !S.sitting && !G.pondFrozen && !G.riding, act: () => this.fish() });
    it.push({ pos: new THREE.Vector3(V().campfire[0], 0, V().campfire[1]), r: 2.8, prompt: 'E - Grill a fish', cond: () => !S.sitting && (G.inv.fish || 0) > 0, act: () => { G.inv.fish--; Player.hold('bowl', 3.4); Sound.play('eat', 0.8); G.player.hp = G.player.maxHp; G.flags.buffs = G.flags.buffs || {}; G.flags.buffs.fed = G.day; UI.toast('Pondfish on a stick, charred at the edges. Marigold gets the tail. You feel like a whole person.', 4); } });
    if (S.gazebo) it.push({ pos: S.gazebo, r: 2.6, prompt: STR.pLore, cond: () => !(G.flags.lore || []).includes('vale'), act: () => this.readLore('vale') });
    // the owl's quest and the hare's acorn
    const owl = Animals.list.find((a) => a.id === 'owl'); if (owl) it.push({ pos: owl.base, r: 3, prompt: STR.pGiveFeathers, cond: () => !G.flags.owlDone && (G.inv.feather || 0) >= 3, act: () => { G.inv.feather -= 3; G.flags.owlDone = true; G.flags.nightEye = true; UI.say('THE OWL', STR.owlThanks); Sound.play('owl', 0.7); burst(owl.base.x, owl.base.y + 1, owl.base.z, 0xbfe8ff, 24, 2, 1); } });
    const hare = Animals.list.find((a) => a.id === 'hare'); if (hare) it.push({ pos: hare.base, r: 2.6, prompt: STR.pGiveAcorn, cond: () => (G.inv.acorn || 0) > 0 && !S.hare, act: () => { G.inv.acorn--; S.hare = { t: 60, a: hare }; UI.toast(STR.hareFollows, 3.5); Sound.play('shard', 0.5, 1.5); } });
  },
  // ── sitting: campfire bench or hot spring ────────────────────────────────
  sit(kind, spot, yaw, low) {
    if (S.sitting) return; const p = G.player; S.sitting = kind; S.sitT = 0; G.timeScale = kind === 'chair' ? 2 : 4; Sound.play(kind === 'chair' ? 'chair' : 'sit', 0.7);
    spot = spot || (kind === 'fire' ? S.bench : S.spring); S.sitFrom = p.pos.clone(); p.pos.copy(spot); if (kind === 'fire') p.pos.x += 0.3; if (kind === 'spring') p.pos.y = spot.y - 0.35; if (yaw !== undefined) { p.yaw = yaw; p.pitch = 0; }
    G.sitLow = low !== undefined ? low : (kind === 'spring' ? -0.95 : -0.55); G.sitClip = kind === 'chair' ? 'Sit_Chair_Idle' : 'Sit_Floor_Idle';
    if (kind === 'fire') UI.toast(STR.sitFire, 3.5); if (kind === 'spring') UI.toast(STR.sitSpring, 3.5);
    if (kind === 'spring') Sound.loop('spring', 0.5); else if (kind === 'fire') Sound.loop('campfire', 0.45);
    for (const id in Crew.members) { const m = Crew.members[id]; if (m.mode === 'follow') { m.idle = 10; } }
  },
  stand() { if (!S.sitting) return; const k = S.sitting; S.sitting = null; G.timeScale = 1; G.sitLow = 0; G.stoodT = 0.3; if (k === 'spring' || k === 'fire') Sound.stopLoop(k === 'spring' ? 'spring' : 'campfire'); if (S.sitFrom) G.player.pos.copy(S.sitFrom); if (G.onStand) G.onStand(k); },
  // ── fishing off the dock ─────────────────────────────────────────────────
  fish() {
    const pond = V().pond; const yaw = Math.atan2(-(pond.x - S.dock.x), -(pond.z - S.dock.z)); this.sit('fish', S.dock, yaw, -0.5); G.sitClip = 'Sit_Floor_Idle';
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); const bob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff4a3a, roughness: 0.6 })); bob.position.copy(S.dock).addScaledVector(dir, 3.2); bob.position.y = S.pondY + 0.05; group.add(bob);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(S.dock.x, 1.2, S.dock.z), bob.position.clone()]), new THREE.LineBasicMaterial({ color: 0xd8d4ff, transparent: true, opacity: 0.5 })); group.add(line);
    S.fish = { bob, line, t: 4 + Math.random() * 7, phase: 'wait', bite: 0, base: bob.position.y }; Sound.play('splash', 0.3, 1.4); UI.toast('You cast. The bobber settles. Nothing to do now but wait, which is the whole point.', 3.5);
    G.sitPrompt = 'Waiting for a bite  ·  W - Stand up';
    G.onSitE = () => { const f = S.fish; if (!f) return false; if (f.phase === 'bite') { G.inv.fish = (G.inv.fish || 0) + 1; Sound.play('splash', 0.8); burst(f.bob.position.x, f.bob.position.y + 0.3, f.bob.position.z, 0x9fd0ff, 24, 2.5, 0.8); UI.toast(['A silver pondfish. It looks offended.', 'A pondfish, fat from a summer of acorns. Into the pocket.', 'A pondfish! Somewhere, the raven is already negotiating.'][(Math.random() * 3) | 0], 3.5); f.phase = 'wait'; f.t = 5 + Math.random() * 8; G.sitPrompt = 'Waiting for a bite  ·  W - Stand up'; } return true; };
    G.onStand = () => { const f = S.fish; if (f) { group.remove(f.bob); group.remove(f.line); } S.fish = null; G.sitPrompt = null; G.onSitE = null; G.onStand = null; };
  },
  updateFish(dt) {
    const f = S.fish; if (!f) return; const t = G.t; f.t -= dt;
    if (f.phase === 'wait') { f.bob.position.y = f.base + Math.sin(t * 2.2) * 0.02; if (f.t <= 0) { f.phase = 'bite'; f.bite = 1.8; Sound.play('tug', 0.7); G.sitPrompt = 'E - Pull!'; UI.toast('Something tugs the line.', 1.6); } }
    else { f.bite -= dt; f.bob.position.y = f.base - 0.12 + Math.sin(t * 18) * 0.05; if (f.bite <= 0) { f.phase = 'wait'; f.t = 5 + Math.random() * 7; G.sitPrompt = 'Waiting for a bite  ·  W - Stand up'; UI.toast('It got away. It was probably enormous.', 2.5); } }
    f.line.geometry.setFromPoints([new THREE.Vector3(S.dock.x, 1.2, S.dock.z), f.bob.position]);
  },
  // ── fetch and snowballs ──────────────────────────────────────────────────
  throwThing() {
    const p = G.player; if (G.area !== 'vale') return; const winter = p.pos.z < World.SPLIT_Z; if (!winter && S.stick) return; const dir = Player.aimDir();
    const from = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(dir, 0.6); const vel = dir.clone().multiplyScalar(11).add(new THREE.Vector3(0, 4.5, 0));
    if (winter) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })); m.position.copy(from); group.add(m); S.snowballs.push({ m, vel, life: 4 }); Sound.play('snowball', 0.5, 1.2); p.cast = 0.6; return; }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 1 })); m.position.copy(from); m.rotation.z = 1.2; group.add(m);
    S.stick = { m, vel, life: 6, landed: false }; Sound.play('stick', 0.6); p.cast = 0.6;
    const dog = Crew.members.dog; if (dog && dog.mode === 'follow') { dog.fetch = { phase: 'chase' }; Sound.play('bark', 0.6, 1.2); }
  },
  // ── particles: fireflies, embers, chimney smoke, breath ──────────────────
  makeParticles() {
    const mk = (n, color, size, blend) => { const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) pos[i * 3 + 1] = -100; geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, depthWrite: false, opacity: 0.9, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending, map: dot() })); pts.frustumCulled = false; pts.userData.life = new Float32Array(n); pts.userData.vel = new Float32Array(n * 3); group.add(pts); return pts; };
    S.fireflies = mk(120, 0xffe08a, 0.12, true); S.embers = mk(90, 0xff8a30, 0.09, true); S.smoke = mk(160, 0x9a90a8, 0.6, false); S.smoke.material.opacity = 0.35;
  },
  spawnP(pts, i, x, y, z, vx, vy, vz, life) { const a = pts.geometry.attributes.position; a.setXYZ(i, x, y, z); pts.userData.vel.set([vx, vy, vz], i * 3); pts.userData.life[i] = life; },
  stepP(pts, dt, fn) { const a = pts.geometry.attributes.position, v = pts.userData.vel, l = pts.userData.life; for (let i = 0; i < a.count; i++) { if (l[i] <= 0) { if (fn && Math.random() < 0.08) fn(i); continue; } l[i] -= dt; if (l[i] <= 0) { a.setY(i, -100); continue; } a.setXYZ(i, a.getX(i) + v[i * 3] * dt, a.getY(i) + v[i * 3 + 1] * dt, a.getZ(i) + v[i * 3 + 2] * dt); } a.needsUpdate = true; },
  // ── aurora ribbons ───────────────────────────────────────────────────────
  makeAurora() {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec3 p = position; p.y += sin(uv.x * 9.0 + uT * 0.7) * 6.0 + sin(uv.x * 23.0 - uT * 1.3) * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float uT, uA; void main(){ float band = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)); float flick = 0.6 + 0.4 * sin(vUv.x * 40.0 + uT * 2.0) * sin(vUv.x * 7.0 - uT); vec3 c = mix(vec3(0.2, 1.0, 0.6), vec3(0.6, 0.3, 1.0), vUv.y + 0.2 * sin(vUv.x * 5.0 + uT * 0.4)); gl_FragColor = vec4(c, band * flick * uA * 0.55); }' });
    const geo = new THREE.PlaneGeometry(260, 60, 64, 8); const a1 = new THREE.Mesh(geo, mat); a1.position.set(0, 70, -120); a1.rotation.x = 0.4; const a2 = new THREE.Mesh(geo, mat); a2.position.set(30, 85, -160); a2.rotation.x = 0.5; a2.rotation.y = 0.3;
    G.scene.add(a1, a2); S.aurora = { mat, meshes: [a1, a2] };
  },
  // ── festival ─────────────────────────────────────────────────────────────
  startFestival() {
    S.festival = { t: 0 }; G.flags.festivalSeen = true; Music.play('festival', true); Sound.play('lantern_lift', 0.8); UI.banner('THE LANTERN NIGHT'); UI.toast(STR.festival, 5);
    const tex = Assets.tex('assets/img/skylantern.png'); const [tx, tz] = V().tower;
    for (let i = 0; i < 28; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(0.7, 0.95, 1); const x = tx + (Math.random() - 0.5) * 30, z = tz - 6 + (Math.random() - 0.5) * 24; sp.position.set(x, World.terrainHeight(x, z) + 0.8, z); group.add(sp);
      const l = i % 4 === 0 ? new THREE.PointLight(0xffb060, 6, 10, 1.8) : null; if (l) { l.position.copy(sp.position); group.add(l); }
      S.lanterns.push({ sp, l, delay: i * 0.6 + Math.random(), vy: 0.5 + Math.random() * 0.5, ph: Math.random() * 6.28 }); }
  },
  // ── lore, journal, brewing, options ──────────────────────────────────────
  readLore(id) { const L = LORE.find((l) => l.id === id); if (!L) return; G.flags.lore = G.flags.lore || []; if (!G.flags.lore.includes(id)) G.flags.lore.push(id); Sound.play('pages', 0.7); UI.say(L.title.toUpperCase(), L.text); },
  openJournal() {
    G.shopOpen = true; $('journal').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock();
    const q = $('jQuests'); q.innerHTML = ''; for (const Q of QUESTS) { const d = Q.done(); const row = document.createElement('div'); row.className = 'q' + (d ? ' done' : ''); const h = typeof Q.hint === 'function' ? Q.hint() : Q.hint; row.innerHTML = '<b></b><small></small>'; row.firstChild.textContent = (d ? '✓ ' : '○ ') + Q.title; row.lastChild.textContent = d ? 'Done.' : h; q.append(row); }
    const l = $('jLore'); l.innerHTML = ''; for (const L of LORE) { const got = (G.flags.lore || []).includes(L.id); const row = document.createElement('div'); row.className = 'q' + (got ? '' : ' dim'); row.innerHTML = '<b></b><small></small>'; row.firstChild.textContent = got ? L.title : '? ? ?'; row.lastChild.textContent = got ? L.text : 'A page you have not found.'; l.append(row); }
    const c = $('jCrew'); const names = Object.values(Crew.members).map((m) => `${m.d.name}: ${m.mode === 'follow' ? 'with you' : 'at home'}${m.treats ? ', knows a trick' : ''}`); c.textContent = names.join('  ·  ') + `  ·  Day ${G.day}` + (G.flags.nightEye ? '  ·  the owl\'s night eye' : '') + (G.friendsLine ? '\n' + G.friendsLine() : '');
  },
  closePanels() { G.shopOpen = false; $('journal').classList.add('hidden'); $('brew').classList.add('hidden'); G.lock && G.lock(); },
  openBrew() {
    G.shopOpen = true; $('brew').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); Sound.play('bubble', 0.6);
    const have = Object.entries(G.inv).filter(([, n]) => n > 0).map(([k, n]) => `${n} × ${STR.shinies[k].replace(/^an? /, '')}`).join(', '); $('brewHave').textContent = have ? `In your pockets: ${have}` : 'Your pockets are empty. The cauldron waits.';
    const box = $('brewItems'); box.innerHTML = '';
    for (const R of RECIPES) { const can = Object.entries(R.cost).every(([k, n]) => (G.inv[k] || 0) >= n); const row = document.createElement('div'); row.className = 'item'; const txt = document.createElement('div'); txt.innerHTML = '<b></b><small></small>'; txt.firstChild.textContent = R.name; txt.lastChild.textContent = `${R.desc} Needs ${Object.entries(R.cost).map(([k, n]) => `${n} ${STR.shinies[k].replace(/^an? /, '')}${n > 1 ? 's' : ''}`).join(' + ')}.`;
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'BREW'; btn.disabled = !can; btn.addEventListener('click', () => { if (!Object.entries(R.cost).every(([k, n]) => (G.inv[k] || 0) >= n)) return; for (const [k, n] of Object.entries(R.cost)) G.inv[k] -= n; R.act(); Sound.play('bubble', 0.9); UI.toast(`${R.name}. ${R.desc}`, 3.5); G.brewFlash = 1; this.openBrew(); }); row.append(txt, btn); box.append(row); }
  },
  initOptions() {
    const o = store.get('opts', { fov: 72, bob: 1, grain: 1 }); G.opts = o; this.applyOptions();
    for (const k of ['fov', 'bob', 'grain']) { const el = $('opt_' + k); if (!el) continue; el.value = o[k]; el.addEventListener('input', () => { o[k] = +el.value; store.set('opts', o); this.applyOptions(); }); }
  },
  applyOptions() { const o = G.opts; G.camera.fov = o.fov; G.camera.updateProjectionMatrix(); G.bobScale = o.bob; G.grade.uniforms.uGrain.value = 0.045 * o.grain; },
  // ── per frame ────────────────────────────────────────────────────────────
  update(dt) {
    const p = G.player; const t = G.t; const inVale = G.area === 'vale';
    if (G.pressed.KeyJ && !UI.dialog) { if ($('journal').classList.contains('hidden')) this.openJournal(); else this.closePanels(); }
    if (G.pressed.KeyF && inVale && !S.sitting) this.throwThing();
    if (S.sitting) { S.sitT += dt; if (G.pressed.KeyE && G.onSitE && G.onSitE()) { } else if (G.pressed.KeyE || G.pressed.Space || G.keys.KeyW || G.keys.KeyS) this.stand(); else { S.cozyT -= dt; if (S.cozyT <= 0) { S.cozyT = 9 + Math.random() * 7; UI.toast(COZY_LINES[(Math.random() * COZY_LINES.length) | 0], 4); } if (S.sitting === 'spring') p.hp = Math.min(p.maxHp, p.hp + dt * 4); } }
    if (G.brewFlash > 0) { G.brewFlash -= dt; } if (G.stoodT > 0) G.stoodT -= dt; this.updateFish(dt);
    // aurora: Winterwood, after midnight
    const night = G.clock > 0.02 && G.clock < 0.22; const wantA = inVale && night && p.pos.z < World.SPLIT_Z + 8;
    S.aurora.mat.uniforms.uT.value = t; S.aurora.mat.uniforms.uA.value += ((wantA ? 1 : 0) - S.aurora.mat.uniforms.uA.value) * Math.min(1, dt * 0.5);
    for (const m of S.aurora.meshes) { m.visible = S.aurora.mat.uniforms.uA.value > 0.01; m.position.x = p.pos.x * 0.3; }
    if (wantA !== S.auroraOn) { S.auroraOn = wantA; if (wantA) { Sound.loop('aurora', 0.25); UI.toast(STR.aurora, 4); } else Sound.stopLoop('aurora'); }
    World.setAurora && World.setAurora(S.aurora.mat.uniforms.uA.value);
    if (!inVale) return;
    // the bell at midnight, crows at dusk, a far howl at night
    if (G.clock > 0 && G.clock < 0.004 && S.bellDay !== G.day) { S.bellDay = G.day; Sound.play('bell', 0.8); UI.toast(STR.midnight, 4); }
    S.ambT = (S.ambT || 10) - dt; if (S.ambT <= 0) { S.ambT = 25 + Math.random() * 30; if (night && p.pos.z < World.SPLIT_Z) Sound.play('howl', 0.25); else if (G.clock > 0.7 && G.clock < 0.85) Sound.play('crows', 0.25); }
    // cottage windows glow at dusk and night; chimney smoke
    const glow = THREE.MathUtils.smoothstep(G.clock, 0.7, 0.8) + (1 - THREE.MathUtils.smoothstep(G.clock, 0.22, 0.3)) ; const gl = Math.min(1, glow);
    for (const h of S.homes) h.light.intensity = gl * (9 + Math.sin(t * 7 + h.x) * 0.8);
    this.stepP(S.smoke, dt, (i) => { const h = S.homes[(Math.random() * S.homes.length) | 0]; const c = h ? h.chimney : new THREE.Vector3(V().tower[0], 15, V().tower[1]); if (Math.random() < 0.25) { const [tx, tz] = V().tower; this.spawnP(S.smoke, i, tx + 1, 15.2, tz, 0.3, 0.9, 0.1, 6); } else this.spawnP(S.smoke, i, c.x, c.y, c.z, 0.2 + Math.random() * 0.3, 0.7 + Math.random() * 0.4, 0.1, 5); });
    S.smoke.material.size = 0.5 + 0.2 * Math.sin(t); S.smoke.material.opacity = 0.3;
    // embers from the campfire, fireflies in the dusk village
    const [cx, cz] = V().campfire; const cy = World.terrainHeight(cx, cz);
    this.stepP(S.embers, dt, (i) => this.spawnP(S.embers, i, cx + (Math.random() - 0.5) * 0.6, cy + 0.6, cz + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8, 1.2 + Math.random()));
    const dusky = G.clock > 0.68 && G.clock < 0.95;
    this.stepP(S.fireflies, dt, dusky && p.pos.z > World.SPLIT_Z ? (i) => this.spawnP(S.fireflies, i, p.pos.x + (Math.random() - 0.5) * 24, p.pos.y + 0.4 + Math.random() * 1.6, p.pos.z + (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 3 + Math.random() * 3) : null);
    S.fireflies.material.opacity = 0.5 + 0.5 * Math.sin(t * 3);
    // breath in the cold
    if (p.pos.z < World.SPLIT_Z) { S.breathT -= dt; if (S.breathT <= 0) { S.breathT = 3.5 + Math.random() * 2; const f = Player.aimDir(); const b = p.pos.clone().add(new THREE.Vector3(0, 1.5, 0)).addScaledVector(f, 0.5); burst(b.x, b.y, b.z, 0xdfe8ff, 6, 0.4, 0.9, 0.5); if (Math.random() < 0.3) Sound.play('breath', 0.15); } }
    // festival: everything lit, after dusk, once per night
    const allLit = World.allLit(); const nightish = G.clock > 0.74 || G.clock < 0.2;
    if (allLit && nightish && !S.festival && S.festivalDay !== G.day && p.pos.z > World.SPLIT_Z - 4) { S.festivalDay = G.day; this.startFestival(); }
    if (S.festival) { S.festival.t += dt; for (const L of S.lanterns) { if (S.festival.t < L.delay) continue; L.sp.position.y += L.vy * dt; L.sp.position.x += Math.sin(t * 0.5 + L.ph) * dt * 0.4; L.sp.position.z -= dt * 0.9; if (L.l) { L.l.position.copy(L.sp.position); L.l.intensity = 5 + Math.sin(t * 4 + L.ph); } L.sp.material.opacity = L.sp.position.y > 40 ? Math.max(0, 1 - (L.sp.position.y - 40) / 15) : 1; }
      if (S.festival.t > 75) { for (const L of S.lanterns) { group.remove(L.sp); if (L.l) group.remove(L.l); } S.lanterns.length = 0; S.festival = null; Music.play(p.pos.z < World.SPLIT_Z ? 'winter' : 'vale', true); } }
    // hearthglow / nightsight brews
    World.lanternBoost = G.flags.hearthglow === G.day ? 2 : 1; World.moonBoost = G.flags.nightsight === G.day ? 1.8 : 1;
    // stick and snowballs
    if (S.stick) { const s = S.stick; if (!s.landed) { s.vel.y -= 12 * dt; s.m.position.addScaledVector(s.vel, dt); s.m.rotation.x += dt * 9; const gy = World.terrainHeight(s.m.position.x, s.m.position.z); if (s.m.position.y <= gy + 0.05) { s.landed = true; s.m.position.y = gy + 0.05; s.m.rotation.set(0, Math.random() * 3, 1.5); } } s.life -= dt;
      const dog = Crew.members.dog; if (dog && dog.fetch) { if (dog.fetch.phase === 'chase') { dog.target = s.m.position.clone(); if (dog.pos.distanceTo(s.m.position) < 1.2 && s.landed) { dog.fetch.phase = 'return'; s.m.visible = false; Sound.play('fetch', 0.6); } } else if (dog.fetch.phase === 'return') { dog.target = null; if (dog.pos.distanceTo(p.pos) < 2.2) { dog.fetch = null; group.remove(s.m); S.stick = null; UI.toast(STR.fetched, 3); Sound.play('pant', 0.6); burst(dog.pos.x, dog.pos.y + 0.8, dog.pos.z, 0xff7aa8, 10, 1, 1); } } }
      if (s.life <= -14 || (s.life <= 0 && !(dog && dog.fetch))) { if (dog && dog.fetch) { dog.fetch = null; dog.target = null; } group.remove(s.m); S.stick = null; } }
    for (let i = S.snowballs.length - 1; i >= 0; i--) { const b = S.snowballs[i]; b.vel.y -= 12 * dt; b.m.position.addScaledVector(b.vel, dt); b.life -= dt; const q = b.m.position; let hit = q.y <= World.terrainHeight(q.x, q.z) + 0.1 || b.life <= 0;
      const sm = World.props.find((pr) => pr.kind === 'snowman'); if (sm && Math.hypot(q.x - sm.x, q.z - sm.z) < 0.8 && q.y < World.terrainHeight(sm.x, sm.z) + 2.6) { hit = true; sm.wobble = 1; Sound.play('giggle', 0.7); UI.toast(STR.snowmanHit, 2.5); }
      for (const id in Crew.members) { const m = Crew.members[id]; if (m.obj.visible && Math.hypot(q.x - m.pos.x, q.z - m.pos.z) < 0.9 && q.y < m.pos.y + 1.3) { hit = true; m.hearts = 1; Sound.play(id === 'dog' ? 'bark' : 'fox', 0.6); } }
      if (hit) { burst(q.x, q.y, q.z, 0xffffff, 16, 2.5, 0.5); Sound.play('snowball', 0.4, 0.8); group.remove(b.m); S.snowballs.splice(i, 1); } }
    const sm = World.props.find((pr) => pr.kind === 'snowman'); if (sm && sm.wobble > 0) { sm.wobble = Math.max(0, sm.wobble - dt); sm.obj.rotation.z = Math.sin(sm.wobble * 20) * 0.12 * sm.wobble; }
    // feathers drift down under the pines at night, for the owl
    if (night && p.pos.z < World.SPLIT_Z && S.feathers.length < 3 && Math.random() < dt * 0.15) { const trees = World.props.filter((pr) => pr.tree === 'pine' || pr.pine); const tr = trees[(Math.random() * trees.length) | 0]; if (tr) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xf0f0ff, side: THREE.DoubleSide, emissive: 0x334466 })); m.position.set(tr.x + (Math.random() - 0.5) * 2, World.terrainHeight(tr.x, tr.z) + 3.5, tr.z + (Math.random() - 0.5) * 2); group.add(m); const f = { m, y0: World.terrainHeight(m.position.x, m.position.z) + 0.1, taken: false }; S.feathers.push(f);
      World.interact.push({ pos: m.position, r: 2, prompt: STR.pShiny(STR.shinies.feather), cond: () => !f.taken && m.position.y < f.y0 + 0.2, act: () => { f.taken = true; G.inv.feather = (G.inv.feather || 0) + 1; group.remove(m); S.feathers.splice(S.feathers.indexOf(f), 1); Sound.play('shard', 0.6, 1.4); UI.toast(`You pocket ${STR.shinies.feather}.`); } }); } }
    for (const f of S.feathers) if (f.m.position.y > f.y0) { f.m.position.y -= dt * 0.35; f.m.position.x += Math.sin(t * 2 + f.y0) * dt * 0.3; f.m.rotation.z = Math.sin(t * 3) * 0.6; }
    // the hare follows for a while after an acorn
    if (S.hare) { S.hare.t -= dt; const a = S.hare.a; const target = p.pos.clone().add(new THREE.Vector3(Math.cos(t) * 1.2, 0, Math.sin(t) * 1.2)); a.base.lerp(target, Math.min(1, dt * 2)); a.base.y = World.terrainHeight(a.base.x, a.base.z); a.obj.position.copy(a.base); if (S.hare.t <= 0) { S.hare = null; UI.toast(STR.hareLeaves, 3); } }
  },
};
function dot() { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 1, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }
