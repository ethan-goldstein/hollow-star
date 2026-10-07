// Animals you can talk to, with head-turning, idle clips, and the night wolves at the tree line.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound } from './audio.js';
import { UI, STR } from './ui.js';
import { World, toW } from './world.js';
import { burst } from './spells.js';

let G; const list = []; let wolves = [], wolvesOut = false, wolfT = 0;
const DEFS = [
  { id: 'fox_npc', skip: true },
  { id: 'cat', who: 'the tower cat', name: 'THE TOWER CAT', model: 'gen/cat', h: 0.5, at: toW(1000, 2290), sfx: 'cat', face: Math.PI, lines: ['...', 'The tower is warmer than the woods and you are warmer than the tower. Acceptable.', 'I have watched the road. Nothing has come down it. Yet.', 'The dog is loud. The fox is sly. I am correct. We all have our roles.'] },
  { id: 'raven', who: 'the raven', name: 'THE RAVEN', model: 'gen/raven', h: 0.9, at: toW(540, 1690), sfx: 'raven', face: 0.6, lines: ['Caw. I mean: good evening.', 'The dog adores you. It is embarrassing for everyone.', 'Three shards, a gate, a king with his eyes on fire. I have seen it before. It ends well, mostly.', 'Shiny things. Bring me shiny things and I will bring you useful ones. That is the whole arrangement.'] },
  { id: 'owl', who: 'the owl', name: 'THE OWL', model: 'gen/owl', h: 0.7, at: toW(300, 940), sfx: 'owl', face: 0.9, lines: ['Who? You. Always you.', 'The stag remembers winters before your tower had a roof. Ask him nicely.', 'Frost on the pond would let you cross it. Frost is the third finger.', 'When the clock turns past midnight the wolves come to the tree line. They only watch. Mostly.'] },
  { id: 'stag', who: 'the frost stag', name: 'THE FROST STAG', model: 'stag', h: 2.1, at: toW(1320, 430), sfx: 'stag', face: -0.8, clips: { idle: 'Idle', eat: 'Eating', alt: 'Idle_2' }, lines: ['The snow is old here. It does not mind being walked on.', 'Once, a star fell past these pines and did not stop falling. You carry a piece of its dark.', 'Breathe. The road will still be there when you are ready.', 'Frost on my antlers makes them sing. Try it, if you like. The crystals are yours.'] },
  { id: 'hare', who: 'the snow hare', name: 'THE SNOW HARE', model: 'rat', h: 0.45, tint: 0xf4f6ff, at: toW(1480, 970), sfx: null, face: -1, clips: { idle: 'Rat_Idle', eat: 'Rat_Idle', alt: 'Rat_Jump' }, lines: ['(the hare looks at you, then at your pockets, then at you)', '(it thumps the snow once and sits very still)', '(it is not afraid of you, which is either trust or poor judgement)'] },
  { id: 'deer', who: 'the doe', name: 'THE DOE', model: 'deer', h: 1.5, at: toW(1650, 1150), sfx: null, face: -1.6, clips: { idle: 'Idle', eat: 'Eating', alt: 'Idle_Headlow' }, lines: ['(she keeps eating, one ear turned toward you)', 'The stag says you are kind. The stag is usually right about people.', '(she steps closer, then thinks better of it)'] },
];

export const Animals = {
  list,
  async init(g) {
    G = g;
    for (const d of DEFS) { if (d.skip) continue; const gl = await Assets.gltf(`assets/models/${d.model}.glb`); if (!gl) continue;
      const obj = Assets.instance(gl); Assets.fitHeight(obj, d.h); if (d.tint) obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(d.tint); } });
      const [x, z] = d.at; const y = World.terrainHeight(x, z); obj.position.set(x, y, z); obj.rotation.y = d.face; World.group.add(obj);
      const a = { ...d, obj, base: new THREE.Vector3(x, y, z), li: 0, hop: 0, yaw: d.face, mixer: null, acts: {}, idleT: 5 + Math.random() * 6, crystalT: 0 };
      if (gl.animations.length) { a.mixer = new THREE.AnimationMixer(obj); for (const c of gl.animations) a.acts[c.name] = a.mixer.clipAction(c); const first = a.acts[d.clips.idle]; if (first) { first.play(); a.cur = first; } }
      const col = { x, z, r: d.h > 1.5 ? 0.9 : 0.5 }; World.colliders.push(col); a.col = col; list.push(a);
      World.interact.push({ pos: a.base, r: 3, prompt: STR.pTalkTo(d.who), cond: () => !G.riding, act: () => { UI.say(d.name, d.lines[a.li++ % d.lines.length]); a.hop = 1; if (d.sfx) Sound.play(d.sfx, 0.6); a.talk = 1; if (d.id === 'stag') G.flags.stagFriend = true; } });
      if (d.id === 'stag') World.interact.push({ pos: a.base, r: 3.2, prompt: 'E - Climb onto the stag', cond: () => G.flags.stagFriend && !G.riding && !G.sitLow && !G.player.dancing, act: () => this.mount(a) });
    }
    await this.makeWolves(); G.frostHit = (q) => this.frostStag(q);
  },
  async makeWolves() {
    const gl = await Assets.gltf('assets/models/wolf.glb'); if (!gl) return;
    for (let i = 0; i < 4; i++) { const obj = Assets.instance(gl); Assets.fitHeight(obj, 1.0); obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.55); } }); obj.visible = false; World.group.add(obj);
      const mixer = new THREE.AnimationMixer(obj); const idle = mixer.clipAction(gl.animations.find((c) => c.name === 'Idle')); idle.play();
      const eyes = new THREE.PointLight(0xffd040, 0, 2, 2); eyes.position.set(0, 0.8, 0.5); obj.add(eyes);
      wolves.push({ obj, mixer, eyes, spot: new THREE.Vector3(-17 + i * 3.5 + Math.random(), 0, -26 - Math.random() * 1.5) }); }
  },
  mount(a) { const p = G.player; if (G.riding) return; G.riding = { a, play: (n) => this.play(a, n, false) }; a.ridden = true; a.col.r = 0; p.pos.copy(a.base); p.yaw = a.yaw + Math.PI; Sound.play('stag', 0.6); UI.toast('You swing up onto the stag. He does not seem to mind. (E to climb down, Shift to gallop)', 4); },
  dismount() { if (!G.riding) return; const a = G.riding.a; const p = G.player; a.ridden = false; a.base.copy(p.pos); a.face = a.yaw; a.col.x = a.base.x; a.col.z = a.base.z; a.col.r = 0.9; G.riding = null; Sound.stopLoop('hoof'); p.hoofOn = false; p.pos.x += Math.cos(p.yaw) * 1.4; p.pos.z -= Math.sin(p.yaw) * 1.4; p.vel.set(0, 0, 0); UI.toast('You slide down. The stag shakes his antlers and goes back to looking wise.', 3); },
  play(a, name, once) { const act = a.acts[name]; if (!act || a.cur === act) return; if (a.cur) a.cur.fadeOut(0.3); act.reset().fadeIn(0.3); act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); act.clampWhenFinished = once; act.play(); a.cur = act; },
  frostStag(pos) { const s = list.find((a) => a.id === 'stag'); if (!s || s.crystalT > 0 || pos.distanceTo(s.base) > 2.5) return false; s.crystalT = 20; burst(s.base.x, s.base.y + 2, s.base.z, 0xbfe8ff, 30, 2, 1); G.inv.crystal = (G.inv.crystal || 0) + 1; UI.toast(STR.frostStag, 3.5); Sound.play('freeze', 0.5, 1.4); this.play(s, 'Idle_HitReact_Left', true); return true; },
  update(dt) {
    if (G.riding && G.pressed.KeyE) { this.dismount(); delete G.pressed.KeyE; }
    if (G.area !== 'vale') return; const p = G.player; const t = G.t;
    for (const a of list) {
      if (a.ridden) { if (a.mixer) a.mixer.update(dt); continue; }
      if (a.mixer) a.mixer.update(dt); a.hop = Math.max(0, a.hop - dt * 2); a.crystalT = Math.max(0, a.crystalT - dt); a.idleT -= dt;
      const d = p.pos.distanceTo(a.base);
      if (d < 6) { const want = Math.atan2(p.pos.x - a.base.x, p.pos.z - a.base.z); a.yaw += (((want - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2.5); } else a.yaw += (((a.face - a.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt);
      a.obj.rotation.y = a.yaw; a.obj.position.y = a.base.y + (a.hop > 0 ? Math.sin(a.hop * Math.PI) * 0.25 : 0) + (a.mixer ? 0 : Math.sin(t * 2 + a.base.x) * 0.012);
      if (!a.mixer) a.obj.scale.y = a.obj.scale.x * (1 + Math.sin(t * 2.2 + a.base.z) * 0.02);
      else if (a.idleT <= 0 && a.clips) { a.idleT = 6 + Math.random() * 8; const which = a.cur === a.acts[a.clips.idle] ? (Math.random() < 0.5 ? a.clips.eat : a.clips.alt) : a.clips.idle; this.play(a, which, false); }
    }
    // wolves gather at the tree line after midnight and leave before dawn
    const c = G.clock; const want = c > 0.02 && c < 0.2 && p.pos.z < World.SPLIT_Z + 6;
    if (want !== wolvesOut) { wolvesOut = want; for (const w of wolves) { w.obj.visible = want; w.obj.position.copy(w.spot); w.obj.position.y = World.terrainHeight(w.spot.x, w.spot.z); w.obj.lookAt(p.pos.x, w.obj.position.y, p.pos.z); } UI.toast(want ? STR.wolves : STR.wolvesGone, 3.5); if (want) Sound.play('wind', 0.3, 0.6); }
    if (wolvesOut) for (const w of wolves) { w.mixer.update(dt); w.eyes.intensity = 0.6 + Math.sin(t * 3 + w.spot.x) * 0.3; const dx = p.pos.x - w.obj.position.x, dz = p.pos.z - w.obj.position.z; w.obj.rotation.y = Math.atan2(dx, dz); if (Math.hypot(dx, dz) < 7) { w.obj.position.x -= (dx / Math.hypot(dx, dz)) * dt * 1.5; w.obj.position.z -= (dz / Math.hypot(dx, dz)) * dt * 1.5; } }
  },
};
