// Friends: host a world or join one with a four-letter code. Peer-to-peer over PeerJS; the host relays everyone's positions,
// so you see each other's wizards walk, cast, sit, dance and ride in whichever area you share. Each player keeps their own save.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { Sound, store, $ } from './audio.js';
import { UI } from './ui.js';
import { burst } from './spells.js';

let G, peer = null, hostConn = null, isHost = false, code = null, myName = '', status = 'off', sendT = 0, pendingJoin = null, chatLog = [];
const conns = new Map();   // peerId -> DataConnection (host side)
const remote = new Map();  // peerId -> avatar record
const PREFIX = 'hollowstar-'; const RATE = 0.1; const COLORS = [0xff8aa8, 0x8ad0ff, 0xb8ff9a, 0xffd070, 0xd0a0ff, 0x7affd8, 0xffa070, 0xa0c0ff];
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 4 }, () => letters[(Math.random() * letters.length) | 0]).join('');
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function myState() {
  const p = G.player; let anim = 'idle';
  if (G.sleeping) anim = 'sleep'; else if (G.riding) anim = 'ride'; else if (p.dancing) anim = 'dance'; else if (G.sitLow) anim = G.sitClip === 'Sit_Chair_Idle' ? 'chair' : 'sit'; else if (p.cast > 0.2) anim = 'cast'; else { const sp = Math.hypot(p.vel.x, p.vel.z); anim = sp > 5 ? 'run' : sp > 0.5 ? 'walk' : 'idle'; }
  return { id: peer.id, name: myName || 'a wizard', area: G.area, x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), yaw: +p.yaw.toFixed(2), anim };
}
function setStatus(s, text) { status = s; const el = $('netStatus'); if (el) el.textContent = text; const hud = $('netHud'); if (hud) hud.textContent = status === 'off' ? '' : text; $('btnLeave').classList.toggle('hidden', status === 'off'); $('btnHost').classList.toggle('hidden', status !== 'off'); $('joinRow').classList.toggle('hidden', status !== 'off'); }
function link() { return `${location.origin}${location.pathname}?room=${code}`; }

async function avatar(st) {
  const g = await Assets.gltf('assets/models/hero_mage.glb'); if (!g) return null;
  const obj = Assets.instance(g); Assets.fitHeight(obj, 1.75); const color = COLORS[hash(st.id) % COLORS.length];
  obj.traverse((o) => { if (o.isMesh && o.material && o.material.map) { o.material = o.material.clone(); o.material.color.set(color); } });
  const mixer = new THREE.AnimationMixer(obj); const acts = {}; for (const c of g.animations) acts[c.name] = mixer.clipAction(c);
  const tag = makeTag(st.name, color); tag.position.y = 2.05; obj.add(tag); const bubble = makeTag('', 0xffffff, true); bubble.position.y = 2.45; bubble.visible = false; obj.add(bubble);
  G.scene.add(obj); const r = { obj, mixer, acts, cur: null, tag, bubble, bubbleT: 0, target: new THREE.Vector3(st.x, st.y, st.z), yaw: st.yaw, st, lastAnim: '' };
  obj.position.copy(r.target); play(r, 'Idle'); return r;
}
function makeTag(text, color, bubble = false) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sp.scale.set(2.4, 0.6, 1); sp.userData.canvas = c; sp.userData.color = color; sp.userData.bubble = bubble; drawTag(sp, text); return sp;
}
function drawTag(sp, text) {
  const c = sp.userData.canvas, x = c.getContext('2d'); x.clearRect(0, 0, 512, 128);
  if (sp.userData.bubble) { if (!text) { sp.material.map.needsUpdate = true; return; } x.fillStyle = 'rgba(12,8,40,0.85)'; x.beginPath(); x.roundRect(16, 24, 480, 80, 18); x.fill(); x.fillStyle = '#eee9ff'; x.font = 'italic 34px Georgia, serif'; }
  else { x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.roundRect(96, 30, 320, 68, 14); x.fill(); x.fillStyle = '#' + new THREE.Color(sp.userData.color).getHexString(); x.font = 'bold 40px Georgia, serif'; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.slice(0, 26), 256, 64); sp.material.map.needsUpdate = true;
}
function play(r, name, once = false) { const a = r.acts[name] || r.acts.Idle; if (!a || r.cur === a) return; if (r.cur) r.cur.fadeOut(0.25); a.reset().fadeIn(0.25); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.play(); r.cur = a; }
const CLIP = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', cast: 'Spellcast_Shoot', sit: 'Sit_Floor_Idle', chair: 'Sit_Chair_Idle', dance: 'Cheer', ride: 'Sit_Floor_Idle', sleep: 'Lie_Idle' };

async function applyState(st) {
  if (!peer || st.id === peer.id) return;
  let r = remote.get(st.id); if (!r) { if (remote.has(st.id)) return; remote.set(st.id, null); r = await avatar(st); if (!r) return; remote.set(st.id, r); UI.toast(`${st.name} is here.`, 2.5); Sound.play('cheer', 0.3, 1.2); }
  if (r.st.name !== st.name) drawTag(r.tag, st.name);
  r.st = st; r.target.set(st.x, st.y, st.z); r.yaw = st.yaw;
  if (st.anim === 'cast' && r.lastAnim !== 'cast') burst(st.x, st.y + 1.4, st.z, 0xb79bff, 10, 2, 0.4); r.lastAnim = st.anim;
}
function removePlayer(id) { const r = remote.get(id); if (r) { G.scene.remove(r.obj); UI.toast(`${r.st.name} left.`, 2.5); } remote.delete(id); }
function broadcast(msg, except) { const s = JSON.stringify(msg); for (const [id, c] of conns) if (id !== except && c.open) c.send(s); }
function onData(fromId, raw) {
  let m; try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; } if (!m || typeof m.t !== 'string') return;
  Net.stats[m.t] = (Net.stats[m.t] || 0) + 1;
  if (m.t === 'state' && m.p && typeof m.p === 'object') { m.p.id = fromId; m.p.name = String(m.p.name || 'a wizard').slice(0, 14); applyState(m.p); }
  else if (m.t === 'snap' && Array.isArray(m.players)) { const seen = new Set(); for (const p of m.players) { if (!p || typeof p !== 'object') continue; p.name = String(p.name || 'a wizard').slice(0, 14); seen.add(p.id); applyState(p); } for (const id of [...remote.keys()]) if (!seen.has(id) && id !== peer.id) removePlayer(id); if (typeof m.clock === 'number' && !G.sleeping) { if (Math.abs(m.clock - G.clock) > 0.003) G.clock = m.clock; if (m.day) G.day = m.day; } }
  else if (m.t === 'chat' && typeof m.text === 'string') { const text = m.text.slice(0, 120); const name = String(m.name || 'a wizard').slice(0, 14); showChat(fromId, name, text); if (isHost) broadcast({ t: 'chat', id: fromId, name, text }, fromId); }
}
function showChat(id, name, text) {
  chatLog.push(`${name}: ${text}`); if (chatLog.length > 6) chatLog.shift(); const log = $('chatlog'); if (log) { log.textContent = chatLog.join('\n'); log.classList.add('show'); clearTimeout(log._t); log._t = setTimeout(() => log.classList.remove('show'), 9000); }
  const r = remote.get(id); if (r) { drawTag(r.bubble, text); r.bubble.visible = true; r.bubbleT = 7; } Sound.play('page', 0.3, 1.6);
}

export const Net = {
  get status() { return status; }, remote, stats: {}, get peerId() { return peer && peer.id; }, get isHost() { return isHost; },
  init(g) {
    G = g; myName = store.get('name', ''); $('netName').value = myName;
    $('netName').addEventListener('input', () => { myName = $('netName').value.slice(0, 14); store.set('name', myName); });
    $('btnHost').addEventListener('click', () => this.host()); $('btnJoin').addEventListener('click', () => this.join($('joinCode').value)); $('btnLeave').addEventListener('click', () => this.leave());
    $('joinCode').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.join($('joinCode').value); });
    $('netName').addEventListener('keydown', (e) => e.stopPropagation());
    $('btnCopy').addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(link()).then(() => UI.toast('Invite link copied.', 2)); });
    const chat = $('chat'); chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const text = chat.value.trim(); if (text) this.say(text); this.closeChat(); } if (e.key === 'Escape') this.closeChat(); });
    const qs = new URLSearchParams(location.search).get('room'); if (qs && /^[A-Z0-9]{4}$/i.test(qs)) pendingJoin = qs.toUpperCase();
    setStatus('off', 'Not connected. Host a world or join a friend\'s.');
    setInterval(() => this.tick(), 100); // network sends run on a timer so a tabbed-out friend keeps sending
  },
  tick() {
    if (!peer || G.scene_ !== 'play') return; const me = myState();
    if (isHost) { const players = [me, ...[...remote.values()].filter(Boolean).map((r) => r.st)]; broadcast({ t: 'snap', players, clock: G.clock, day: G.day }); }
    else if (hostConn && hostConn.open) hostConn.send(JSON.stringify({ t: 'state', p: me }));
  },
  onPlay() { if (pendingJoin) { const c = pendingJoin; pendingJoin = null; this.join(c); } },
  host(fixed) {
    if (!window.Peer) { UI.toast('The friends module did not load. Check your connection.', 3); return; } if (peer) this.leave();
    code = fixed && /^[A-Z0-9]{4}$/.test(fixed) ? fixed : makeCode(); isHost = true; peer = new window.Peer(PREFIX + code, { debug: 0 }); setStatus('connecting', 'Opening a world…');
    peer.on('open', () => { setStatus('hosting', `Hosting world ${code}. Friends join with the code or the link.`); $('netCode').textContent = code; $('netLink').textContent = link(); $('netShare').classList.remove('hidden'); UI.toast(`Your world code is ${code}. Friends can join from the pause menu.`, 5); });
    peer.on('connection', (conn) => { conns.set(conn.peer, conn); conn.on('open', () => { conns.set(conn.peer, conn); }); conn.on('data', (d) => onData(conn.peer, d)); conn.on('close', () => { conns.delete(conn.peer); removePlayer(conn.peer); }); conn.on('error', () => { conns.delete(conn.peer); removePlayer(conn.peer); }); });
    peer.on('error', (e) => { if (e.type === 'unavailable-id') { peer.destroy(); peer = null; this.host(); return; } setStatus('error', `Could not host: ${e.type}`); });
    peer.on('disconnected', () => { if (peer && !peer.destroyed) peer.reconnect(); });
  },
  join(c) {
    c = String(c || '').trim().toUpperCase(); if (!/^[A-Z0-9]{4}$/.test(c)) { UI.toast('A world code is four letters.', 2.5); return; }
    if (!window.Peer) { UI.toast('The friends module did not load. Check your connection.', 3); return; } if (peer) this.leave();
    code = c; isHost = false; peer = new window.Peer({ debug: 0 }); setStatus('connecting', `Looking for world ${code}…`);
    peer.on('open', () => {
      hostConn = peer.connect(PREFIX + code, { reliable: true });
      hostConn.on('open', () => { setStatus('joined', `In world ${code} with friends.`); UI.toast(`You are in world ${code}.`, 3.5); hostConn.send(JSON.stringify({ t: 'state', p: myState() })); });
      hostConn.on('data', (d) => onData(PREFIX + code, d)); hostConn.on('close', () => { setStatus('error', 'The host closed the world.'); UI.toast('The host closed the world.', 3); this.leave(true); });
      hostConn.on('error', () => { setStatus('error', 'Could not reach that world.'); });
    });
    peer.on('error', (e) => { setStatus('error', e.type === 'peer-unavailable' ? `No world called ${code} is open right now.` : `Connection trouble: ${e.type}`); });
  },
  leave(keepStatus) {
    for (const id of [...remote.keys()]) { const r = remote.get(id); if (r) G.scene.remove(r.obj); } remote.clear(); conns.clear(); hostConn = null;
    if (peer) { try { peer.destroy(); } catch { } } peer = null; isHost = false; $('netShare').classList.add('hidden'); if (!keepStatus) setStatus('off', 'Not connected. Host a world or join a friend\'s.');
  },
  say(text) { if (!peer) return; const name = myName || 'a wizard'; showChat(peer.id, name, text); const msg = { t: 'chat', id: peer.id, name, text: text.slice(0, 120) }; if (isHost) broadcast(msg); else if (hostConn && hostConn.open) hostConn.send(JSON.stringify(msg)); },
  openChat() { if (!peer || G.chatting) return; G.chatting = true; const c = $('chat'); c.value = ''; c.classList.remove('hidden'); c.focus(); G.keys = {}; },
  closeChat() { G.chatting = false; const c = $('chat'); c.classList.add('hidden'); c.blur(); G.keys = {}; },
  update(dt) {
    if (G.pressed.Enter && peer && !G.chatting && G.scene_ === 'play' && !UI.dialog) this.openChat();
    for (const [, r] of remote) { if (!r) continue; r.obj.visible = r.st.area === G.area && G.scene_ === 'play'; if (!r.obj.visible) continue;
      const lift = r.st.anim === 'ride' ? 1.25 : 0; r.obj.position.lerp(new THREE.Vector3(r.target.x, r.target.y + lift, r.target.z), Math.min(1, dt * 10)); r.obj.rotation.y = r.yaw + Math.PI; r.mixer.update(dt);
      if (r.st.anim === 'dance') { r.danceT = (r.danceT || 0) + dt; r.obj.rotation.y += Math.sin(r.danceT * 4.2) * 0.5; r.obj.position.y += Math.abs(Math.sin(r.danceT * 8.4)) * 0.07; }
      play(r, CLIP[r.st.anim] || 'Idle', r.st.anim === 'cast'); if (r.bubble.visible) { r.bubbleT -= dt; if (r.bubbleT <= 0) r.bubble.visible = false; } }
  },
};
