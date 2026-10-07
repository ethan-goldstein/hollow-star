// Your crew: Marigold the golden retriever and the Fox. They follow, sit by fires, and help on the Road.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, store } from './audio.js';
import { UI, STR } from './ui.js';
import { World, VALE } from './world.js';
import { burst } from './spells.js';

let G; const members = {};
const DEF = {
  dog: { name: 'Marigold', model: 'husky', height: 0.85, color: 0xd9a85a, idle: 'Idle', walk: 'Walk', run: 'Gallop', sit: 'Idle_2_HeadLow', eat: 'Eating', attack: 'Attack', sfx: 'bark', happy: 'pant', pet: STR.petDog, home: () => new THREE.Vector3(VALE.doghouse[0] + 1.6, 0, VALE.doghouse[1] + 0.8), bite: 6 },
  fox: { name: 'the Fox', model: 'fox', height: 0.6, color: null, idle: 'Idle', walk: 'Walk', run: 'Gallop', sit: 'Idle_2_HeadLow', eat: 'Eating', attack: 'Attack', sfx: 'fox', happy: 'fox', pet: STR.petFox, home: () => new THREE.Vector3(VALE.campfire[0] + 2.2, 0, VALE.campfire[1] + 1.4), bite: 0 },
};

async function make(id, saved) {
  const d = DEF[id]; const g = await Assets.gltf(`assets/models/${d.model}.glb`); if (!g) return null;
  const obj = Assets.instance(g); Assets.fitHeight(obj, d.height);
  if (d.color) obj.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); const c = o.material.color; if (c.r > 0.4 && c.g > 0.4) c.set(d.color); else if (c.r > 0.25) c.set(0xf0e0c0); } });
  obj.visible = false; G.scene.add(obj);
  const mixer = new THREE.AnimationMixer(obj); const acts = {}; for (const c of g.animations) acts[c.name] = mixer.clipAction(c);
  const m = { id, d, obj, mixer, acts, cur: null, mode: saved ? saved.mode : 'home', pos: d.home(), yaw: 0, idle: 3, bite: 0, hearts: 0, stuck: 0, trick: 0, sfxT: 8 + Math.random() * 8, treats: saved ? saved.treats : false };
  m.pos.y = World.terrainHeight(m.pos.x, m.pos.z); members[id] = m; play(m, d.idle); return m;
}
function play(m, name, fade = 0.25, once = false) { const a = m.acts[name]; if (!a || m.cur === a) return; if (m.cur) m.cur.fadeOut(fade); a.reset().fadeIn(fade); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play(); m.cur = a; }

export const Crew = {
  members,
  async init(g, saved) { G = g; await make('dog', saved && saved.dog); await make('fox', saved && saved.fox); this.registerInteract(); },
  saveState() { const s = {}; for (const id in members) s[id] = { mode: members[id].mode, treats: members[id].treats }; return s; },
  registerInteract() {
    const it = G.areas.vale.interact;
    for (const id in members) { const m = members[id];
      // doghouse / campfire spot: call, stay, come
      it.push({ pos: m.d.home().setY(World.terrainHeight(m.d.home().x, m.d.home().z)), r: 3, prompt: () => m.mode === 'home' ? STR.pCall(m.d.name) : m.mode === 'follow' ? STR.pStay(m.d.name) : STR.pCome(m.d.name), act: () => {
        if (m.mode === 'home') { m.mode = 'follow'; store.set('dog', true); Sound.play(m.d.sfx, 0.8); Sound.play(m.d.happy, 0.5); UI.toast(STR.joined(m.d.name), 3.5); burst(m.pos.x, m.pos.y + 0.8, m.pos.z, 0xff7aa8, 14, 1.5, 0.9); }
        else if (m.mode === 'follow') { m.mode = 'home'; UI.toast(STR.stay(m.d.name), 3); Sound.play(m.d.happy, 0.4); }
        else { m.mode = 'follow'; Sound.play(m.d.sfx, 0.8); UI.toast(STR.come(m.d.name), 3); } } });
      // the animal itself: pet, or ask Marigold for her trick
      it.push({ pos: m.pos, r: 2.2, cond: () => m.obj.visible && !(m.mode === 'home' && m.pos.distanceTo(m.d.home()) < 3), prompt: () => (id === 'dog' && m.treats && G.keys.ShiftLeft) ? STR.pTrick : STR.pPet(m.d.name), act: () => {
        if (id === 'dog' && m.treats && G.keys.ShiftLeft) { m.trick = 3; play(m, 'Gallop_Jump', 0.1, true); UI.toast(STR.trick, 3.5); Sound.play('bark', 0.7); return; }
        m.hearts = 1.5; m.idle = 2; Sound.play(m.d.happy, 0.6); UI.toast(m.d.pet[(m.petIdx = ((m.petIdx || 0) + 1)) % m.d.pet.length], 3); burst(m.pos.x, m.pos.y + 0.9, m.pos.z, 0xff7aa8, 10, 1, 1); if (id === 'dog' && !m.treats) setTimeout(() => UI.toast(STR.trickLocked, 3), 3200); } });
    }
  },
  onArea(name, prev) {
    for (const id in members) { const m = members[id]; const here = m.mode === 'follow' && name !== 'chamber' && name !== 'end'; m.obj.visible = here || (name === 'vale');
      if (here) { const p = G.player.pos; m.pos.set(p.x - Math.sin(G.player.yaw) * -1.2 + 0.6, p.y, p.z - Math.cos(G.player.yaw) * -1.2); }
      else if (name === 'vale') { m.pos.copy(m.d.home()); m.pos.y = World.terrainHeight(m.pos.x, m.pos.z); } }
  },
  whistle() { let any = false; for (const id in members) { const m = members[id]; if (m.mode === 'follow') { any = true; m.pos.copy(G.player.pos).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2)); Sound.play(m.d.sfx, 0.7); } } if (!any) UI.toast('Nobody is following you yet.'); },
  nearestEnemy(from, range) { if (!G.road || !G.road.enemies) return null; let best = null, bd = range; for (const e of G.road.enemies) { if (e.dead) continue; const d = e.pos.distanceTo(from); if (d < bd) { bd = d; best = e; } } return best; },
  update(dt) {
    if (G.pressed.KeyG) this.whistle();
    const p = G.player;
    for (const id in members) {
      const m = members[id]; if (!m.obj.visible) continue; m.mixer.update(dt); m.bite -= dt; m.hearts = Math.max(0, m.hearts - dt); m.trick = Math.max(0, m.trick - dt); m.sfxT -= dt;
      let target = null;
      if (m.target) target = m.target.clone();
      else if (m.mode === 'follow') {
        const back = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)); target = p.pos.clone().addScaledVector(back, id === 'dog' ? 1.3 : 2.0).add(new THREE.Vector3(Math.cos(p.yaw) * (id === 'dog' ? 0.8 : -0.9), 0, -Math.sin(p.yaw) * (id === 'dog' ? 0.8 : -0.9)));
        if (G.area === 'road') { const e = this.nearestEnemy(p.pos, 9); if (e) { target = e.pos.clone(); if (m.pos.distanceTo(e.pos) < e.r + 0.7 && m.bite <= 0) { m.bite = 0.8; if (m.d.bite) { e.hurt && e.hurt(m.d.bite, m.pos); Sound.play('bark', 0.45, 1.1); play(m, m.d.attack, 0.1, true); } else { Sound.play('fox', 0.4); } } } }
        // the fox knocks enemy shots out of the air
        if (id === 'fox' && G.spellsFX) for (const s of G.spellsFX.shots) if (s.foe && s.mesh.position.distanceTo(m.pos) < 1.4) { s.life = 0; burst(s.mesh.position.x, s.mesh.position.y, s.mesh.position.z, 0xffb060, 10, 2, 0.4); }
      } else if (G.area === 'vale') { target = m.d.home(); target.y = World.terrainHeight(target.x, target.z); }
      else continue;
      const dx = target.x - m.pos.x, dz = target.z - m.pos.z, dist = Math.hypot(dx, dz);
      if (dist > (m.target ? 0.35 : 1.1) && m.trick <= 0) {
        const sp = Math.min(id === 'dog' ? 7.5 : 8, 1.5 + dist * 1.4); const nx = dx / dist, nz = dz / dist; const ox = m.pos.x, oz = m.pos.z;
        m.pos.x += nx * sp * dt; m.pos.z += nz * sp * dt; G.boundsClamp(m.pos); G.collide(m.pos, 0.3);
        if (Math.hypot(m.pos.x - ox, m.pos.z - oz) < sp * dt * 0.2) { m.stuck += dt; if (m.stuck > 1.5 || dist > 25) { m.pos.copy(target); m.stuck = 0; } } else m.stuck = 0;
        m.yaw = Math.atan2(nx, nz); m.idle = 0; play(m, sp > 4 ? m.d.run : m.d.walk);
      } else { m.idle += dt; if (m.trick <= 0) play(m, m.idle > 6 && G.area === 'vale' ? (m.idle % 20 < 8 ? m.d.eat : m.d.sit) : m.d.idle); if (m.mode === 'follow' && dist < 3) { const want = Math.atan2(p.pos.x - m.pos.x, p.pos.z - m.pos.z); m.yaw += (((want - m.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 4); } }
      m.pos.y += (G.heightAt(m.pos.x, m.pos.z) - m.pos.y) * Math.min(1, dt * 12);
      m.obj.position.copy(m.pos); m.obj.rotation.y = m.yaw;
      if (m.hearts > 0 && Math.random() < 0.15) burst(m.pos.x, m.pos.y + 0.9, m.pos.z, 0xff7aa8, 1, 0.3, 0.8);
      if (m.sfxT <= 0) { m.sfxT = 14 + Math.random() * 14; if (m.pos.distanceTo(p.pos) < 12) Sound.play(m.d.sfx, 0.25); }
    }
  },
};
