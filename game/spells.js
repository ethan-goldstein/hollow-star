// Spells: projectiles with light and trails, Nova, impacts, and a small particle system shared by everything.
import * as THREE from 'three';
import { Sound } from './audio.js';
import { Player } from './player.js';
import { World, setBurst } from './world.js';

export const SPELLS = [
  { id: 'bolt', name: 'BOLT', dmg: 10, color: 0xb79bff, sfx: 'bolt', speed: 26 },
  { id: 'ember', name: 'EMBER', dmg: 8, color: 0xff9a3a, sfx: 'ember', speed: 22, burn: 1.5 },
  { id: 'frost', name: 'FROST', dmg: 6, color: 0x9fe8ff, sfx: 'frost', speed: 24, slow: 2 },
];
const NOVA = { dmg: 40, r: 5 };
let G, scene, shots = [], parts, partPos, partVel, partLife, partCol, N = 1200, cursor = 0, lights = [], ringGeo, rings = [];

function spark() { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 1, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }

export function burst(x, y, z, color, n = 24, speed = 3, life = 0.7, size = 1) {
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i++) { const k = cursor; cursor = (cursor + 1) % N; const a = Math.random() * 6.283, b = (Math.random() - 0.5) * 3.14, v = speed * (0.3 + Math.random() * 0.7);
    partPos[k * 3] = x; partPos[k * 3 + 1] = y; partPos[k * 3 + 2] = z; partVel[k * 3] = Math.cos(a) * Math.cos(b) * v; partVel[k * 3 + 1] = Math.sin(b) * v + 0.5; partVel[k * 3 + 2] = Math.sin(a) * Math.cos(b) * v;
    partLife[k * 2] = life * (0.5 + Math.random() * 0.5); partLife[k * 2 + 1] = partLife[k * 2]; partCol[k * 3] = c.r; partCol[k * 3 + 1] = c.g; partCol[k * 3 + 2] = c.b; }
  parts.geometry.attributes.color.needsUpdate = true;
}
export function ring(x, y, z, r, color, life = 0.5) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.set(x, y + 0.05, z); m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.2); m.userData = { r, life, max: life }; scene.add(m); rings.push(m);
}

export const Spells = {
  shots, burst, ring,
  init(g) {
    G = g; scene = G.scene; setBurst(burst); G.spellsFX = this;
    const geo = new THREE.BufferGeometry(); partPos = new Float32Array(N * 3); partVel = new Float32Array(N * 3); partLife = new Float32Array(N * 2); partCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) partPos[i * 3 + 1] = -100;
    geo.setAttribute('position', new THREE.BufferAttribute(partPos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
    parts = new THREE.Points(geo, new THREE.PointsMaterial({ map: spark(), size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); parts.frustumCulled = false; scene.add(parts);
    ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 2); scene.add(l); lights.push(l); }
  },
  blinkTrail(a, b) { for (let i = 0; i <= 10; i++) { const q = a.clone().lerp(b, i / 10); burst(q.x, q.y + 1, q.z, 0x9fd0ff, 4, 0.8, 0.5); } },
  cast() {
    const p = G.player; const sp = SPELLS[p.spell]; if (p.boltT > 0) return; p.boltT = 0.25; p.cast = 1; Sound.play(sp.sfx, 0.4); Player.setSpellColor(sp.color);
    const dir = Player.aimDir(); const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const from = Player.isThird() ? p.pos.clone().add(new THREE.Vector3(0, 1.4, 0)).addScaledVector(dir, 0.6) : p.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(right, 0.28).addScaledVector(dir, 0.7);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: sp.color })); m.position.copy(from); scene.add(m);
    const light = lights.find((l) => !l.userData.busy); if (light) { light.userData.busy = true; light.color.set(sp.color); light.intensity = 6; }
    shots.push({ mesh: m, vel: dir.clone().multiplyScalar(sp.speed), life: 1.6, sp, light, foe: false });
    burst(from.x, from.y, from.z, sp.color, 8, 1.5, 0.3);
  },
  nova() {
    const p = G.player; if (p.novaT > 0) return; p.novaT = p.novaCd; p.cast = 1; Sound.play('nova', 0.9); G.shake = 0.6;
    ring(p.pos.x, p.pos.y, p.pos.z, NOVA.r, 0xc9a0ff, 0.6); ring(p.pos.x, p.pos.y, p.pos.z, NOVA.r * 0.6, 0xffffff, 0.4); burst(p.pos.x, p.pos.y + 1, p.pos.z, 0xc9a0ff, 80, 9, 0.6);
    if (G.onNova) G.onNova(NOVA);
    for (const s of shots) if (s.foe && s.mesh.position.distanceTo(p.pos) < NOVA.r) s.life = 0;
  },
  foeShot(from, dir, speed, dmg, color = 0xff3a3a, r = 0.18) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color })); m.position.copy(from); scene.add(m); shots.push({ mesh: m, vel: dir.clone().normalize().multiplyScalar(speed), life: 5, dmg, foe: true, color, r }); },
  update(dt) {
    const p = G.player;
    if (G.mouse.l && !G.sleeping && G.locked) this.cast(); if (G.pressed.Mouse2 && !G.sleeping && G.locked) this.nova();
    for (const s of shots) {
      s.mesh.position.addScaledVector(s.vel, dt); s.life -= dt; const q = s.mesh.position;
      if (s.light) s.light.position.copy(q);
      if (s.foe) { if (q.distanceTo(p.pos.clone().setY(p.pos.y + 1)) < s.r + 0.45) { Player.hurt(s.dmg); s.life = 0; } if (q.y < G.heightAt(q.x, q.z)) s.life = 0; continue; }
      burst(q.x, q.y, q.z, s.sp.color, 1, 0.3, 0.35, 0.6);
      if (q.y < G.heightAt(q.x, q.z) + 0.05) { s.life = 0; }
      if (s.life > 0 && World.hitProp(q, s.sp.id)) s.life = 0;
      if (s.life > 0 && s.sp.id === 'frost' && G.frostHit && G.frostHit(q)) s.life = 0;
      if (s.life > 0 && G.onShot && G.onShot(s)) s.life = 0;
      if (s.life <= 0) { burst(q.x, q.y, q.z, s.sp.color, 14, 2.5, 0.45); }
    }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (s.life <= 0) { scene.remove(s.mesh); if (s.light) { s.light.intensity = 0; s.light.userData.busy = false; } shots.splice(i, 1); } }
    // particles
    for (let i = 0; i < N; i++) { if (partLife[i * 2] <= 0) continue; partLife[i * 2] -= dt; partPos[i * 3] += partVel[i * 3] * dt; partPos[i * 3 + 1] += partVel[i * 3 + 1] * dt; partPos[i * 3 + 2] += partVel[i * 3 + 2] * dt; partVel[i * 3 + 1] -= 2.5 * dt; partVel[i * 3] *= 0.97; partVel[i * 3 + 2] *= 0.97; if (partLife[i * 2] <= 0) partPos[i * 3 + 1] = -100; }
    parts.geometry.attributes.position.needsUpdate = true;
    for (let i = rings.length - 1; i >= 0; i--) { const m = rings[i]; m.userData.life -= dt; const k = 1 - m.userData.life / m.userData.max; m.scale.setScalar(0.2 + m.userData.r * k); m.material.opacity = 0.9 * (1 - k); if (m.userData.life <= 0) { scene.remove(m); rings.splice(i, 1); } }
  },
};
