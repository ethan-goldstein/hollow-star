// First-person controller with visible hands and staff; V swaps to a third-person Mage.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound } from './audio.js';

const EYE = 1.62, RADIUS = 0.35, SPEED = 4.2, RUN = 6.8;
let G, rig, cam, hands, staff, crystal, staffLight, sleeveL, handR, mage, mixer, actions = {}, current = null, thirdPerson = false;
const tmp = new THREE.Vector3();

export const Player = {
  init(g) {
    G = g; cam = G.camera; rig = new THREE.Group(); G.scene.add(rig); rig.add(cam);
    const p = { pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(), yaw: Math.PI, pitch: 0, grounded: true, hp: 100, maxHp: 100, flasks: 2, spell: 0, boltT: 0, novaT: 0, novaCd: 6, blinkT: 0, blinkCd: 2.5, inv: 0, bob: 0, bobAmt: 0, cast: 0, moving: false, running: false, stepT: 0, lastY: 0, land: 0 };
    this.p = p; this.buildHands(); this.loadMage(); return p;
  },
  buildHands() {
    hands = new THREE.Group(); cam.add(hands);
    const robe = new THREE.MeshStandardMaterial({ color: 0xe9e4ff, roughness: 0.85, map: starTexture() });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7 });
    // right hand holds the staff, left sleeve rests at the edge of view
    staff = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 1.25, 10), new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 })); shaft.position.y = -0.2; staff.add(shaft);
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.05, 0.016, 48, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.6 })); knot.position.y = 0.46; staff.add(knot);
    crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0xb79bff, emissive: 0xb79bff, emissiveIntensity: 1.6, roughness: 0.2 })); crystal.position.y = 0.52; staff.add(crystal);
    staffLight = new THREE.PointLight(0xb79bff, 0.8, 3, 2); staffLight.position.y = 0.55; staff.add(staffLight);
    handR = new THREE.Group(); const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); palm.scale.set(1, 0.8, 1.3); handR.add(palm);
    const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.42, 10), robe); sleeveR.rotation.x = Math.PI / 2 - 0.5; sleeveR.position.set(0.02, -0.05, 0.22); handR.add(sleeveR);
    handR.add(staff); staff.position.set(0, 0.06, 0); staff.rotation.set(-0.15, 0, 0.12);
    handR.position.set(0.32, -0.34, -0.55); handR.rotation.set(0.1, -0.2, 0); hands.add(handR);
    sleeveL = new THREE.Group(); const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin); palmL.scale.set(1, 0.8, 1.3); sleeveL.add(palmL);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.42, 10), robe); sl.rotation.x = Math.PI / 2 - 0.5; sl.position.set(-0.02, -0.05, 0.22); sleeveL.add(sl);
    sleeveL.position.set(-0.34, -0.38, -0.6); sleeveL.rotation.set(0.2, 0.3, 0); hands.add(sleeveL);
    hands.scale.setScalar(0.62); hands.position.z = -0.1;
    hands.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 10; } });
  },
  async loadMage() {
    const g = await Assets.gltf('assets/models/hero_mage.glb'); if (!g) return;
    mage = Assets.instance(g); Assets.fitHeight(mage, 1.75); mage.visible = false; G.scene.add(mage);
    mixer = new THREE.AnimationMixer(mage); for (const c of g.animations) actions[c.name] = mixer.clipAction(c);
    mage.traverse((o) => { if (o.isMesh && o.material && o.material.map) { o.material = o.material.clone(); o.material.color.set(0xd8d4ff); } });
    this.play('Idle');
  },
  play(name, fade = 0.25, once = false) {
    const a = actions[name]; if (!a || current === a) return; if (current) current.fadeOut(fade); a.reset().fadeIn(fade); if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat); a.play(); current = a;
  },
  forward() { return new THREE.Vector3(-Math.sin(this.p.yaw), 0, -Math.cos(this.p.yaw)); },
  aimDir() { const p = this.p; return new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)); },
  staffTip() { return crystal.getWorldPosition(new THREE.Vector3()); },
  setSpellColor(hex) { crystal.material.color.set(hex); crystal.material.emissive.set(hex); staffLight.color.set(hex); },
  update(dt) {
    const p = this.p, k = G.keys;
    if (G.locked && !G.sleeping) { p.yaw -= G.mouse.dx * 0.0022; p.pitch = THREE.MathUtils.clamp(p.pitch - G.mouse.dy * 0.0022, -1.45, 1.45); }
    if (G.pressed.KeyV && !G.sleeping && !p.dancing) this.setThird(!thirdPerson);
    if (this.held) { this.held.t -= dt; if (this.held.t <= 0) { hands.remove(this.held.obj); this.held = null; } }
    if (G.pressed.Digit1) p.spell = 0; if (G.pressed.Digit2) p.spell = 1; if (G.pressed.Digit3) p.spell = 2;
    p.boltT -= dt; p.novaT = Math.max(0, p.novaT - dt); p.blinkT = Math.max(0, p.blinkT - dt); p.inv = Math.max(0, p.inv - dt); p.cast = Math.max(0, p.cast - dt * 3);
    if (G.sleeping) return;
    if (G.sitLow) { p.vel.set(0, 0, 0); p.moving = false; p.bobAmt = 0; if (mage) { mage.position.copy(p.pos); mage.rotation.y = p.yaw + Math.PI; mixer.update(dt); this.play(actions[G.sitClip] ? G.sitClip : 'Sit_Floor_Idle'); } return; }
    // dancing: B toggles, any step ends it
    if (G.pressed.KeyB && !G.riding && G.area !== 'road') this.setDance(!p.dancing);
    if (p.dancing) { if (k.KeyW || k.KeyA || k.KeyS || k.KeyD || G.pressed.Space) this.setDance(false); else { p.vel.set(0, 0, 0); p.moving = false; p.bobAmt = 0; p.danceT += dt; if (mage) { const sway = Math.sin(p.danceT * 4.2) * 0.5, ph = p.danceT % 6, spin = ph < 1 ? ph * Math.PI * 2 : 0; mage.position.set(p.pos.x, p.pos.y + Math.abs(Math.sin(p.danceT * 8.4)) * 0.07, p.pos.z); mage.rotation.y = p.yaw + Math.PI + sway + spin; mixer.update(dt); this.play('Cheer', 0.3); } return; } }
    // riding: the stag carries you; WASD steers him
    if (G.riding) { const a = G.riding.a; let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0); const l = Math.hypot(mx, mz); if (l) { mx /= l; mz /= l; }
      const sp = (k.ShiftLeft || k.ShiftRight) ? 11 : 6.5; const f = this.forward(), r = new THREE.Vector3(f.z, 0, -f.x); const wish = new THREE.Vector3().addScaledVector(f, -mz).addScaledVector(r, mx).multiplyScalar(sp);
      p.vel.x += (wish.x - p.vel.x) * Math.min(1, dt * 5); p.vel.z += (wish.z - p.vel.z) * Math.min(1, dt * 5); p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; G.boundsClamp(p.pos); G.collide(p.pos, 0.7);
      const gy = G.heightAt(p.pos.x, p.pos.z); p.pos.y += (gy - p.pos.y) * Math.min(1, dt * 10); const speed = Math.hypot(p.vel.x, p.vel.z); p.moving = speed > 0.5;
      a.base.copy(p.pos); a.obj.position.copy(p.pos); a.yaw = p.yaw + Math.PI; a.obj.rotation.y = a.yaw; G.riding.play(speed > 7 ? 'Gallop' : speed > 0.5 ? 'Walk' : 'Idle');
      p.bobAmt += ((speed > 0.5 ? 1 : 0) - p.bobAmt) * Math.min(1, dt * 6); p.bob += dt * speed * 1.15;
      if (speed > 0.8 && !p.hoofOn) { Sound.loop('hoof', 0.45); p.hoofOn = true; } else if (speed <= 0.8 && p.hoofOn) { Sound.stopLoop('hoof'); p.hoofOn = false; }
      if (mage) { mage.position.set(p.pos.x, p.pos.y + 1.25, p.pos.z); mage.rotation.y = p.yaw + Math.PI; mixer.update(dt); this.play('Sit_Floor_Idle'); } return; }
    // movement relative to yaw
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0); const l = Math.hypot(mx, mz); if (l) { mx /= l; mz /= l; }
    p.running = !!k.ShiftLeft || !!k.ShiftRight; const sp = (p.running ? RUN : SPEED) * (G.speedMul || 1);
    const f = this.forward(), r = new THREE.Vector3(f.z, 0, -f.x);
    const wish = new THREE.Vector3().addScaledVector(f, -mz).addScaledVector(r, mx).multiplyScalar(sp);
    p.vel.x += (wish.x - p.vel.x) * Math.min(1, dt * 12); p.vel.z += (wish.z - p.vel.z) * Math.min(1, dt * 12);
    p.moving = l > 0;
    // blink: a short dash along the move direction (or where you look)
    if (G.pressed.Space && p.blinkT <= 0 && G.area !== 'lair' && G.area !== 'chamber') { const dir = l ? wish.clone().normalize() : f.clone(); const from = p.pos.clone(); for (let d = 5.5; d > 0; d -= 0.3) { const q = from.clone().addScaledVector(dir, d); G.boundsClamp(q); G.collide(q, RADIUS); if (q.distanceTo(from.clone().addScaledVector(dir, d)) < 0.05) { p.pos.copy(q); break; } } p.blinkT = p.blinkCd; p.inv = Math.max(p.inv, 0.3); Sound.play('blink', 0.7); G.spellsFX && G.spellsFX.blinkTrail(from, p.pos); }
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    G.boundsClamp(p.pos); G.collide(p.pos, RADIUS);
    const gy = G.heightAt(p.pos.x, p.pos.z); p.pos.y += (gy - p.pos.y) * Math.min(1, dt * 14);
    // flask
    if (G.pressed.KeyQ && p.flasks > 0 && p.hp < p.maxHp) { p.flasks--; p.hp = Math.min(p.maxHp, p.hp + 50); Sound.play('flask', 0.8); }
    // head bob and footsteps
    const speed = Math.hypot(p.vel.x, p.vel.z); p.bobAmt += ((speed > 0.5 ? 1 : 0) - p.bobAmt) * Math.min(1, dt * 8); p.bob += dt * (p.running ? 11 : 8) * (speed > 0.5 ? 1 : 0);
    p.stepT -= dt * speed; if (p.stepT <= 0 && speed > 0.5) { p.stepT = 2.1; Sound.play(G.surfaceAt ? G.surfaceAt(p.pos) : 'step_grass', 0.22, 0.92 + Math.random() * 0.16); }
    if (mage) { mage.position.copy(p.pos); mage.rotation.y = p.yaw + Math.PI; mixer.update(dt); if (p.cast > 0.2) this.play('Spellcast_Shoot', 0.1, true); else this.play(speed > 5 ? 'Running_A' : speed > 0.5 ? 'Walking_A' : 'Idle'); }
  },
  hurt(dmg) {
    const p = this.p; if (p.inv > 0 || p.hp <= 0 || G.sleeping) return; p.hp = Math.max(0, p.hp - dmg); p.inv = 0.8; p.hurtFlash = 1; Sound.play('hurt', 0.9); G.shake = 0.35;
    if (p.hp <= 0 && G.onDeath) G.onDeath();
  },
  render() {
    const p = this.p; const t = G.t;
    cam.rotation.set(p.pitch, p.yaw, 0);
    if (G.sleeping && G.sleepCam) { rig.position.copy(G.sleepCam.pos); cam.rotation.set(G.sleepCam.pitch, G.sleepCam.yaw, G.sleepCam.roll || 0); hands.visible = false; return; }
    hands.visible = !thirdPerson;
    const bs = G.bobScale === undefined ? 1 : G.bobScale; const bob = p.bobAmt * bs; const by = Math.abs(Math.sin(p.bob)) * 0.055 * bob, bx = Math.sin(p.bob * 0.5) * 0.03 * bob; const low = G.sitLow || 0;
    const shake = G.shake || 0; G.shake = Math.max(0, shake - 0.02);
    if (thirdPerson) { const back = new THREE.Vector3(Math.sin(p.yaw) * 3.2, 1.6 + 1.2 * Math.max(0, -p.pitch) + (G.riding ? 1.2 : 0), Math.cos(p.yaw) * 3.2); rig.position.copy(p.pos).add(back); rig.position.y = Math.max(rig.position.y, G.heightAt(rig.position.x, rig.position.z) + 0.6); cam.position.set(0, 0, 0); }
    else { rig.position.set(p.pos.x + bx, p.pos.y + EYE + by + low + (G.riding ? 1.3 : 0), p.pos.z); cam.position.set((Math.random() - 0.5) * shake * 0.1, (Math.random() - 0.5) * shake * 0.1, 0); }
    // hands sway with motion, punch forward on a cast
    const c = p.cast; hands.position.set(Math.sin(p.bob * 0.5) * 0.012 * bob, -Math.abs(Math.sin(p.bob)) * 0.015 * bob - c * 0.03 - 0.02, -0.1 + c * -0.12);
    hands.rotation.set(-c * 0.3 + Math.sin(t * 1.2) * 0.005, Math.sin(p.bob * 0.5) * 0.01 * bob, 0);
    crystal.material.emissiveIntensity = 1.3 + Math.sin(t * 4) * 0.3 + c * 3; staffLight.intensity = 1 + c * 6; crystal.rotation.y = t * 1.5;
    if (p.hurtFlash > 0) { p.hurtFlash = Math.max(0, p.hurtFlash - 0.03); G.grade.uniforms.uVig.value = 0.55 + p.hurtFlash * 1.2; } else G.grade.uniforms.uVig.value = 0.55;
  },
  isThird() { return thirdPerson; },
  setThird(v) { thirdPerson = v; hands.visible = !v; if (mage) mage.visible = v; },
  setDance(on) { const p = this.p; if (!!p.dancing === on) return; p.dancing = on; p.danceT = 0; if (on) { this.danceFirst = !thirdPerson; if (!thirdPerson) this.setThird(true); } else if (this.danceFirst) this.setThird(false); if (G.onDance) G.onDance(on); },
  hold(kind, secs = 3) {
    if (this.held) { hands.remove(this.held.obj); this.held = null; }
    const make = (obj) => { obj.position.set(0.16, -0.16, -0.34); obj.rotation.set(0.2, -0.4, 0); hands.add(obj); this.held = { obj, t: secs }; if (mage) this.play('Use_Item', 0.2, true); };
    if (kind === 'mug') Assets.gltf('assets/models/kk/ad_mug_full.gltf').then((g) => { if (!g) return; const o = Assets.instance(g); Assets.fitHeight(o, 0.11); make(o); });
    else { const o = new THREE.Group(); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.8 })); o.add(bowl); const stew = new THREE.Mesh(new THREE.CircleGeometry(0.068, 14), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 0.6 })); stew.rotation.x = -Math.PI / 2; stew.position.y = 0.026; o.add(stew); make(o); }
  },
  get rig() { return rig; },
};
function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#e9e4ff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#9fb0ff';
  for (let i = 0; i < 18; i++) { const px = Math.random() * 128, py = Math.random() * 128; x.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283, rr = k % 2 ? 2 : 5; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}
