// The people of Thistledown: five townsfolk with homes, jobs, bedtimes, opinions, and a slowly growing friendship with you.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound } from './audio.js';
import { UI, STR } from './ui.js';
import { Town } from './town.js';
import { burst } from './spells.js';

let G; const list = [];
const TZ = () => Town.TZ;

const NPCS = [
  { id: 'bram', name: 'BRAMWELL', who: 'Bramwell', model: 'npc_knight', tint: 0xcfa070, h: 1.8, home: 'tavern', bed: 0,
    work: { room: 'tavern', dx: 0, dz: -3.9, yaw: 0, clip: 'Idle' }, evening: { room: 'tavern', dx: 0.4, dz: -3.9, yaw: 0, clip: 'Idle' }, likes: ['acorn', 'button', 'fish'],
    lines: { hello: ['Welcome to the Lantern and Mug. Stew is on, fire is lit, and nobody here will ask you about the King.', 'Sit anywhere. The stools by the bar are the warm ones.', 'The scrying screen only gets two channels. Both are better than the news.', 'Marigold is welcome inside. Most dogs are. Most people, too.'],
      friend: ['You again. Good. The place is quieter without you.', 'I kept the stool by the fire. Nobody sits there but you now.', 'Tobin says you dance like a lantern in a wind. He means it kindly.'],
      best: ['Between us: I have never once seen the Hollow King. I just like the stories. Mostly I like that you come back.', 'If you ever want to stay the night, the beds by the window are yours. No charge. Never was.'],
      gift: ['A golden acorn. I will put it behind the bar with the others. There are no others. It is the first.', 'A brass button! My coat has been missing one since the thaw. Ha.', 'A pondfish! Tonight the stew has a secret ingredient and the secret is you.'],
      sleep: '(Bramwell is asleep in the inn room, boots still on.)' } },
  { id: 'hesper', name: 'HESPER', who: 'Hesper', model: 'npc_barbarian', tint: 0xe8c8a0, h: 1.8, home: 'bakery', bed: 0,
    work: { room: 'bakery', dx: 0, dz: -3.1, yaw: 0, clip: 'Idle' }, evening: { room: 'tavern', dx: -4.5, dz: 1.0, yaw: Math.PI / 2, clip: 'Sit_Chair_Idle', seat: true }, likes: ['acorn', 'stone'],
    lines: { hello: ['Coffee is hot, pastries are hotter. Mind the pumpkin ones, they bite back.', 'I bake before the sun gets up. The sun is lazy here. So I bake a lot.', 'If you smell cinnamon in the Winterwood, that is my chimney. It carries.', 'The owl comes by for crusts. Do not tell him I know.'],
      friend: ['There you are. I saved you the corner table. The one that wobbles. It is the best one.', 'You take your coffee like a wizard: too fast and then surprised.', 'Marigold has eaten three pastries today. I am counting. I am not stopping her.'],
      best: ['I will tell you my secret: there is no secret. Butter, and getting up early, and someone to bake for. That is you now, I suppose.', 'When you go walking the Road, I bake anyway. Someone has to be glad when you come back.'],
      gift: ['A river stone! Smooth as a scone. I will use it to keep the recipe book open.', 'An acorn. I will plant it behind the oven. Give it sixty years.'],
      sleep: '(Hesper sleeps curled toward the warm oven wall.)' } },
  { id: 'wren', name: 'WREN', who: 'Wren', model: 'npc_rogue', tint: 0xb8a8d8, h: 1.72, home: 'library', bed: 0,
    work: { room: 'library', dx: 0, dz: -2.3, yaw: 0, clip: 'Idle' }, evening: { room: 'library', dx: 2.4, dz: 1.8, yaw: -1.2, clip: 'Sit_Chair_Idle', seat: true }, likes: ['feather', 'crystal'],
    lines: { hello: ['Shh. Not because it is a library. Because the books are listening.', 'The star fell before any of these were written. We have been catching up ever since.', 'The lectern has the town pages. Read them slowly. They were written slowly.', 'The raven trades in shiny things. I trade in true ones. Similar prices.'],
      friend: ['I found a page about your tower. It says a wizard lives there who talks to dogs. I have corrected it: a wizard who listens to dogs.', 'You can borrow anything. Bring it back before the snow melts, or do not. I will know where it is.', 'Sit by the window. The violet light is good for reading and better for thinking.'],
      best: ['I am writing a page about you. It is short so far. Kind, stubborn, late for dinner. Give me time.', 'Nobody has ever asked me to dance. I expect you to fix that.'],
      gift: ['An owl feather. Perfect for a quill, and I will never use it, because look at it.', 'A frost crystal! I will set it in the window and the whole room will be a winter afternoon.'],
      sleep: '(Wren is asleep with a book open on her face.)' } },
  { id: 'tobin', name: 'TOBIN', who: 'Tobin', model: 'npc_rogue_hooded', tint: 0xd8b088, h: 1.72, home: 'house_a', bed: 0,
    work: [{ area: 'town', x: 3.2, z: 3.4, yaw: -0.8, clip: 'Interact' }, { area: 'town', x: 5.66, z: -5.66, yaw: -Math.PI / 4, clip: 'Sit_Chair_Idle', seat: true }, { area: 'town', x: -9.6, z: 2.0, yaw: 1.5, clip: 'Interact' }], evening: { room: 'tavern', dx: 1.6, dz: 3.5, yaw: Math.PI, clip: 'Interact' }, likes: ['button', 'crystal'],
    lines: { hello: ['Tobin. Fiddler. Hooded for the drama, not the weather.', 'The well sings a low note if you drop a stone in. I tune to it.', 'Every evening at the Lantern and Mug I play until Bramwell says stop. He has never said stop.', 'If you hear music in the square and start dancing, that is allowed. Encouraged. Required, honestly.'],
      friend: ['My favourite audience arrives. Marigold counts too. She howls in key.', 'I wrote a tune called The Wizard Comes Down The Lane. It is mostly the sound of boots. You will like it.', 'Press that B of yours and I will keep up. I always keep up.'],
      best: ['I used to play for the King, in the stories I tell. In the truth I play for you lot, and it is a better room.', 'Here is the honest thing: the town was quiet before you started visiting. Now it has a rhythm.'],
      gift: ['A brass button, for my coat. Now I am dressed for a proper audience.', 'A frost crystal. Hold it to your ear. Hear that? That is a song I have not written yet.'],
      sleep: '(Tobin sleeps with his fiddle on the pillow beside him.)' } },
  { id: 'juniper', name: 'JUNIPER', who: 'Juniper', model: 'hero_mage', tint: 0x9fd08a, h: 1.72, home: 'house_b', bed: 0,
    work: [{ area: 'town', x: 9.6, z: 4.6, yaw: -2.2, clip: 'Idle' }, { area: 'town', x: 9.6, z: 4.6, yaw: -2.2, clip: 'Idle' }, { area: 'town', x: 1.9, z: -1.6, yaw: 2.3, clip: 'Idle' }], evening: { room: 'tavern', dx: 4.5, dz: 1.0, yaw: -Math.PI / 2, clip: 'Sit_Chair_Idle', seat: true }, likes: ['acorn', 'feather'],
    lines: { hello: ['Herbs, teas, and a tonic for whatever the Road did to you. Mostly teas.', 'Marigold has a good nose. She found my lost thyme twice. Both times she ate it.', 'The hot spring in the Winterwood is medicine. So is sitting by a fire. So is a dog.', 'I sell nothing. I trade in favours, and I am owed none, which is how I like it.'],
      friend: ['Come to the stall. I have a tea that tastes like the first cold morning. You will hate it, then want more.', 'The hare follows you? She follows nobody. You are either very kind or carrying acorns.', 'When the lanterns all come on and the sky ones go up, I stand right here. Stand with me next time.'],
      best: ['I have a small garden behind the house. Nobody has seen it. Come by after dark, the moonflowers only open then.', 'You are the only person in this town who talks to the stag. He talks about you too, in his way.'],
      gift: ['An acorn! The oak that comes from this will outlive us both. I find that comforting.', 'An owl feather. Luck, in the old books. I will wear it and see.'],
      sleep: '(Juniper is asleep. The whole room smells of mint.)' } },
];

function friends() { G.flags.friends = G.flags.friends || {}; return G.flags.friends; }
function rec(n) { const f = friends(); f[n.id] = f[n.id] || { lvl: 0, talked: 0, gifted: 0, danced: 0 }; return f[n.id]; }
function resolve(spot) {
  if (!spot) return null;
  if (spot.room) { const r = Town.rooms[spot.room]; if (!r) return null; return { area: r.area, x: r.ox + spot.dx, z: r.oz + spot.dz, yaw: spot.yaw || 0, clip: spot.clip || 'Idle', seat: spot.seat }; }
  if (spot.area === 'town') return { area: 'town', x: spot.x, z: spot.z + TZ(), yaw: spot.yaw || 0, clip: spot.clip || 'Idle' };
  return { area: spot.area, x: spot.x, z: spot.z, yaw: spot.yaw || 0, clip: spot.clip || 'Idle' };
}
function schedule(n) {
  const c = G.clock; const f = rec(n);
  if (c < 0.3 || c > 0.965) { const r = Town.rooms[n.home]; const b = r.beds[n.bed] || r.beds[0]; return { area: r.area, x: b.x, z: b.z, yaw: b.yaw, clip: 'Lie_Idle', sleep: true, lie: b }; }
  if (c > 0.78) { if (f.lvl >= 4 && (G.day + n.id.length) % 2 === 0) return { area: 'lair', x: 302.2, z: -0.8, yaw: -2.2, clip: 'Sit_Chair_Idle', seat: true, visiting: true }; return resolve(n.evening); }
  const w = Array.isArray(n.work) ? n.work[Math.floor(G.t / 40) % n.work.length] : n.work; return resolve(w);
}
function play(n, name, once) { const a = n.acts[name] || n.acts.Idle; if (!a || n.cur === a) return; if (n.cur) n.cur.fadeOut(0.3); a.reset().fadeIn(0.3); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play(); n.cur = a; }
function setArea(n, area) { if (n.area === area) return; if (n.obj.parent) n.obj.parent.remove(n.obj); const g = G.areas[area]; if (g) g.group.add(n.obj); n.area = area; n.greeted = false; }

function talk(n) {
  const f = rec(n); const want = schedule(n);
  if (want.sleep) { UI.say(n.name, n.lines.sleep); return; }
  const gift = n.likes.find((k) => (G.inv[k] || 0) > 0);
  if (gift && f.gifted !== G.day) { G.inv[gift]--; f.gifted = G.day; f.lvl = Math.min(6, f.lvl + 1); const line = n.lines.gift[n.likes.indexOf(gift) % n.lines.gift.length]; UI.say(n.name, line); Sound.play('cheer', 0.4, 1.1); burst(n.pos.x, n.pos.y + 1.4, n.pos.z, 0xff7aa8, 18, 1.5, 1); n.wave = 1.6; announce(n, f); return; }
  if (f.talked !== G.day) { f.talked = G.day; f.lvl = Math.min(6, f.lvl + 1); announce(n, f); }
  const pool = f.lvl >= 4 && Math.random() < 0.5 ? n.lines.best : f.lvl >= 2 && Math.random() < 0.6 ? n.lines.friend : n.lines.hello;
  n.li = (n.li || 0) + 1; UI.say(n.name, pool[n.li % pool.length]); n.talkT = 1.2;
}
function announce(n, f) { if (f.lvl === 2 && !f.a2) { f.a2 = 1; UI.toast(`${n.who} counts you as a friend now.`, 3.5); } if (f.lvl === 4 && !f.a4) { f.a4 = 1; UI.toast(`${n.who} is one of your best friends. Expect visits.`, 4); } }

export const People = {
  list, NPCS,
  async init(g) {
    G = g;
    for (const d of NPCS) {
      const gl = await Assets.gltf(`assets/models/${d.model}.glb`); if (!gl) continue;
      const obj = Assets.instance(gl); Assets.fitHeight(obj, d.h);
      obj.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(d.tint)); } });
      const mixer = new THREE.AnimationMixer(obj); const acts = {}; for (const c of gl.animations) acts[c.name] = mixer.clipAction(c);
      const n = { ...d, obj, mixer, acts, cur: null, pos: new THREE.Vector3(), yaw: 0, area: null, greeted: false, wave: 0, dance: 0, talkT: 0 };
      const want = schedule(n); setArea(n, want.area); n.pos.set(want.x, 0, want.z); n.yaw = want.yaw; obj.position.copy(n.pos); play(n, want.clip);
      list.push(n);
      // one talk prompt per area the person can be found in; the prompt follows their live position
      const areas = new Set(['town', 'lair', Town.rooms[d.home].area, resolve(Array.isArray(d.work) ? d.work[0] : d.work).area, resolve(d.evening).area]);
      for (const a of areas) { const area = G.areas[a]; if (!area) continue; area.interact.push({ pos: n.pos, r: 2.8, prompt: () => `E - Talk to ${n.who}`, cond: () => n.area === a && !G.riding, act: () => talk(n) }); }
    }
    G.friendsLine = () => this.summary();
  },
  summary() { const f = friends(); const names = list.filter((n) => (f[n.id] || {}).lvl >= 2).map((n) => `${n.who}${f[n.id].lvl >= 4 ? ' (best friend)' : ''}`); return names.length ? 'Friends: ' + names.join(', ') : 'No friends in town yet. Go talk to people.'; },
  nearby(r = 9) { return list.filter((n) => n.area === G.area && n.pos.distanceTo(G.player.pos) < r); },
  update(dt) {
    const p = G.player; const t = G.t;
    for (const n of list) {
      const want = schedule(n);
      if (n.area !== want.area) { setArea(n, want.area); n.pos.set(want.x, 0, want.z); n.yaw = want.yaw; }
      if (n.area !== G.area) continue; // off stage: nothing to animate
      n.mixer.update(dt); n.wave = Math.max(0, n.wave - dt); n.talkT = Math.max(0, n.talkT - dt);
      const dx = want.x - n.pos.x, dz = want.z - n.pos.z, dist = Math.hypot(dx, dz);
      const pd = n.pos.distanceTo(p.pos);
      const dancing = p.dancing && pd < 9 && !want.sleep;
      if (dancing !== !!n.dancing) { n.dancing = dancing; if (dancing) { const f = rec(n); if (f.danced !== G.day) { f.danced = G.day; f.lvl = Math.min(6, f.lvl + 1); announce(n, f); UI.toast(`${n.who} joins the dance.`, 2.5); } } }
      if (dancing) { n.dance += dt; play(n, 'Cheer'); n.yaw += (((Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z) - n.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3); n.obj.rotation.y = n.yaw + Math.sin(n.dance * 4) * 0.5; n.obj.position.set(n.pos.x, Math.abs(Math.sin(n.dance * 8)) * 0.06, n.pos.z); continue; }
      if (dist > 0.25) { const sp = Math.min(1.8, 0.6 + dist); n.pos.x += (dx / dist) * sp * dt; n.pos.z += (dz / dist) * sp * dt; n.yaw = Math.atan2(dx, dz); play(n, 'Walking_A'); }
      else {
        n.pos.set(want.x, 0, want.z);
        if (n.wave > 0) play(n, 'Cheer');
        else play(n, want.clip);
        if (want.sleep) n.yaw = want.yaw;
        else if (pd < 4 && !want.seat) n.yaw += (((Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z) - n.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
        else n.yaw += (((want.yaw - n.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 2);
      }
      // friends wave when you come in
      const f = rec(n); if (f.lvl >= 2 && pd < 7 && !n.greeted && !want.sleep && !want.seat) { n.greeted = true; n.wave = 1.6; UI.toast(`${n.who} waves.`, 2); } if (pd > 14) n.greeted = false;
      // lying down: the clip lies along the floor, so offset to the bed
      if (want.lie) { n.obj.position.set(n.pos.x, want.lie.y, n.pos.z); n.obj.rotation.y = n.yaw; }
      else { n.obj.position.copy(n.pos); n.obj.rotation.y = n.yaw; }
      // soft push so you do not walk through people
      if (pd < 0.75 && pd > 1e-3) { const k = (0.75 - pd) / pd; p.pos.x += (p.pos.x - n.pos.x) * k; p.pos.z += (p.pos.z - n.pos.z) * k; }
    }
  },
};
