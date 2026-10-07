'use strict';
/* The Hollow Star - a single-player top-down quest. Everything runs in the browser. */

const QS = new URLSearchParams(location.search);
const DEV = QS.has('dev');
const $ = (id) => document.getElementById(id);

// ── strings (all player-visible copy lives here) ───────────────────────────
const STR = {
  keeper: ['THE GRAVEKEEPER', "The King's eyes have burned for a thousand nights. Three shards of the fallen star will open his gate. Bring him the dark."],
  tome: ['THE QUEST TOME', 'Three shards of the fallen star will open his gate. Bring him the dark.'],
  tomeDone: ['THE QUEST TOME', 'The eyes are dark. The road is quiet. Walk it again whenever you wish.'],
  gate: (n) => `The gate hungers. Shards: ${n} / 3`,
  waystone: 'Waystone lit',
  shard: 'A shard of the fallen star',
  boxEmpty: 'The music box is silent for now.',
  boxPlay: (n) => `The music box plays: ${n}`,
  pTalk: 'E - Talk', pShard: 'E - Take shard', pTome: 'E - Read the quest', pBox: 'E - Change song',
  pDoor: 'E - Step outside', pStairs: 'E - Climb to the bedchamber',
  chill: 'E - Get up     SPACE - Next song     M - Mute', chillSong: (n) => `Now playing: ${n}`,
  trophy: 'His eye hangs dark above the hearth.',
  pOut: 'E - Step outside', pIn: 'E - Go inside', pRoad: 'E - Walk the Vesper Road', pTalkTo: (who) => `E - Talk to ${who}`,
  pCall: 'E - Call Marigold over', pStay: 'E - Marigold, stay here', pCome: 'E - Marigold, come along', pPet: 'E - Pet Marigold',
  pRune: 'E - Read the rune', pDig: 'E - Dig here',
  joined: 'Marigold bounds over, tail going like a windmill. She is coming with you.', stay: 'Marigold flops down by her house and watches you go.', come: 'Marigold springs up. Finally.',
  pet: ['Marigold leans her whole weight into your leg.', 'Marigold rolls over. This was clearly the plan all along.', 'Marigold sneezes and looks pleased about it.'],
  frozen: 'The pond freezes over. You could walk across it.', allLit: 'Every lantern in Emberfall is lit.',
  rune: ['THE FROST RUNE', 'Water sleeps when the third finger speaks. The pond listens.'],
  dug: 'A smooth river stone with a star scratched into it. The fox was right.', dugAgain: 'Just roots and cold earth now.',
  zoneVale: 'EMBERFALL', zoneWinter: 'THE WINTERWOOD',
};

// ── tuning (all balance numbers live here) ─────────────────────────────────
const P = { speed: 270, r: 16, hp: 100, bolt: 10, boltRate: 0.25, boltSpeed: 760, boltLife: 0.85,
  nova: 40, novaR: 200, novaCd: 6, blink: 230, blinkCd: 2.5, flask: 50, flasks: 2, inv: 0.6 };
const ET = {
  wisp: { hp: 20, sp: 150, r: 18, fly: 1, dmg: 10 },
  thrall: { hp: 40, sp: 95, r: 22, img: 'thrall', h: 104, dmg: 15 },
  moth: { hp: 15, sp: 170, r: 20, img: 'moth', h: 84, fly: 1, hover: 46, dmg: 8 },
  knight: { hp: 150, sp: 80, r: 34, img: 'knight', h: 164, dmg: 25, elite: 1 },
  wraith: { hp: 220, sp: 115, r: 44, img: 'wraith', h: 200, fly: 1, hover: 28, dmg: 25, elite: 1 },
  sentinel: { hp: 200, sp: 26, r: 46, img: 'sentinel', h: 160, fly: 1, hover: 50, dmg: 20, elite: 1 },
};
// streamed songs (YouTube embeds, nothing is hosted here) and the scene each one opens
const TRACKS = [{ id: 'W2o_HupXq1g', name: 'Golden Brown' }, { id: 'bWMqgnrZL7U', name: 'Space II' }, { id: 'MAbSVYjobOc', name: 'Yamaha (slowed)' }];
const STREAM = { title: 2, loading: 2, lair: 1, chamber: 0, vale: 1, winter: 0 };
// the three spells on keys 1-3; Nova stays on the right mouse button
const SPELLS = [
  { id: 'bolt', name: 'BOLT', dmg: 10, color: '#b79bff', sfx: 'bolt' },
  { id: 'ember', name: 'EMBER', dmg: 8, color: '#ff9a3a', sfx: 'ember', burn: 1.5 },
  { id: 'frost', name: 'FROST', dmg: 6, color: '#9fe8ff', sfx: 'frost', slow: 2 },
];
const KING = { hp: 900, x: 700, y: 330, r: 105, h: 430 };

// ── world layout (y grows south; the road runs from y=9150 north to the keep) ─
const ZONES = [
  { id: 'keep', name: 'THE HOLLOW KEEP', y0: -400, y1: 1100, base: 'clouds' },
  { id: 'causeway', name: 'THE STAR CAUSEWAY', y0: 1100, y1: 3900, base: 'clouds' },
  { id: 'river', name: 'THE NEBULA RIVER', y0: 3900, y1: 6500, base: 'moss' },
  { id: 'gravehill', name: 'GRAVEHILL', y0: 6500, y1: 9900, base: 'moss' },
];
const WALK = [
  { x: 150, y: 6480, w: 1100, h: 2920 },                     // gravehill
  { x: 150, y: 5880, w: 1100, h: 620 },                      // south bank
  { x: 540, y: 4480, w: 320, h: 1420, tile: 'cobble' },      // bridge
  { x: 150, y: 3880, w: 1100, h: 620 },                      // north bank
  { x: 480, y: 2880, w: 440, h: 1020, tile: 'cobble' },      // causeway south
  { x: 220, y: 2080, w: 960, h: 820, tile: 'cobble' },       // sentinel plaza
  { x: 480, y: 1080, w: 440, h: 1020, tile: 'cobble' },      // causeway north
  { x: 200, y: 90, w: 1000, h: 1010, tile: 'court' },        // keep courtyard
];
const PATHS = [{ x: 630, y: 5880, w: 140, h: 3600 }, { x: 630, y: 3880, w: 140, h: 620 }];
const RIVER = { y: 4500, h: 1380 };
const GATE_Y = 1100;
const WAYSTONES = [{ x: 820, y: 9020 }, { x: 820, y: 6380 }, { x: 820, y: 3790 }, { x: 820, y: 1330 }];
const START = { x: 700, y: 9180 };
const KEEPER = { x: 540, y: 9010 };
// enemy groups wake when the wizard crosses `at` heading north
const SPAWNS = [
  { at: 8750, list: [['wisp', 560, 8380], ['wisp', 840, 8330], ['wisp', 700, 8250]] },
  { at: 8250, list: [['thrall', 520, 7880], ['thrall', 880, 7850], ['wisp', 700, 7780]] },
  { at: 7750, list: [['thrall', 430, 7380], ['thrall', 700, 7330], ['thrall', 970, 7380], ['wisp', 320, 7450], ['wisp', 1080, 7450]] },
  { at: 7150, list: [['knight', 700, 6740], ['thrall', 470, 6800], ['thrall', 930, 6800]] },
  { at: 6280, list: [['moth', 480, 5950], ['moth', 920, 5950], ['thrall', 620, 6000], ['thrall', 790, 6000]] },
  { at: 5800, list: [['wisp', 640, 5400], ['wisp', 760, 5250], ['wisp', 640, 5100], ['wisp', 760, 4950], ['moth', 420, 5200], ['moth', 980, 5000]] },
  { at: 4470, list: [['wraith', 700, 4080], ['moth', 380, 4120], ['moth', 1020, 4120]] },
  { at: 3700, list: [['thrall', 600, 3330], ['thrall', 800, 3330], ['thrall', 700, 3250], ['moth', 300, 3400]] },
  { at: 3200, list: [['wisp', 560, 2960], ['wisp', 840, 2960], ['moth', 1150, 3000], ['moth', 250, 3000]] },
  { at: 2860, list: [['sentinel', 700, 2440], ['thrall', 380, 2300], ['thrall', 1020, 2300]] },
  { at: 1950, list: [['thrall', 620, 1620], ['thrall', 780, 1620], ['moth', 330, 1700], ['moth', 1070, 1700], ['wisp', 700, 1520]] },
];
const LAIR = {
  walk: { x: 150, y: 250, w: 700, h: 400 },
  spawn: { x: 500, y: 520 },
  props: [
    { id: 'stairs', img: 'stairs', x: 250, y: 264, h: 210, r: 0, prompt: 'pStairs' },
    { id: 'shelf', img: 'bookshelf', x: 215, y: 500, h: 200, r: 46 },
    { id: 'hearth', img: 'hearth', x: 500, y: 268, h: 215, r: 0 },
    { id: 'door', img: 'door', x: 760, y: 262, h: 205, r: 0, prompt: 'pDoor' },
    { id: 'cauldron', img: 'cauldron', x: 640, y: 380, h: 105, r: 40 },
    { id: 'tome', img: 'lectern', x: 330, y: 620, h: 125, r: 30, prompt: 'pTome' },
    { id: 'box', img: 'musicbox', x: 760, y: 590, h: 130, r: 36, prompt: 'pBox' },
  ],
};

const IMAGES = ['leaves', 'snow', 'dirt', 'ice', 'tower', 'maple', 'birch', 'pine', 'pumpkin', 'lantern', 'campfire', 'doghouse', 'fence', 'well', 'cart',
  'signpost', 'vgate', 'snowman', 'log', 'haybale', 'dog', 'fox', 'owl', 'stag', 'cat', 'raven', 'hare', 'rune', 'moss', 'river', 'cobble', 'clouds', 'court', 'wood', 'hero', 'keeper', 'thrall', 'knight', 'moth',
  'wraith', 'sentinel', 'king', 'gravestone', 'spire', 'waystone', 'gate', 'gargoyle', 'hearth', 'cauldron',
  'bookshelf', 'musicbox', 'lectern', 'door', 'stairs', 'chamber'];
const SOUNDS = ['bolt', 'nova', 'blink', 'flask', 'hit', 'death', 'shard', 'gate', 'hurt', 'roar', 'hearth', 'door', 'page', 'night', 'snore',
  'bark', 'pant', 'fox', 'owl', 'stag', 'cat', 'raven', 'wind', 'autumn', 'ember', 'frost', 'freeze'];

// ── helpers ────────────────────────────────────────────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function rng(seed) { let s = seed >>> 0; return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const store = { get(k, d) { try { const v = localStorage.getItem('hollowstar:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('hollowstar:' + k, JSON.stringify(v)); } catch { /* private mode */ } } };

// ── assets ─────────────────────────────────────────────────────────────────
const IMG = {};
const PAT = {};
function loadImages() {
  return Promise.all(IMAGES.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; res(); };
    im.onerror = () => res();
    im.src = `../assets/img/${n}.webp`;
  })));
}

// ── audio ──────────────────────────────────────────────────────────────────
const Sound = {
  ctx: null, buf: {}, muted: QS.has('mute') || store.get('mute', false), loops: {},
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.55; this.out.connect(this.ctx.destination);
    for (const n of SOUNDS) fetch(`../assets/sfx/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => this.ctx.decodeAudioData(b)).then((d) => { this.buf[n] = d; if (this.wantLoop === n) this.loop(n, this.wantVol); }).catch(() => {});
  },
  play(n, vol = 1, rate = 1) {
    if (!this.ctx || !this.buf[n]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[n]; s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.out); s.start();
  },
  loop(n, vol = 0.5) {
    this.wantLoop = n; this.wantVol = vol;
    if (!this.ctx || !this.buf[n] || this.loops[n]) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.buf[n]; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol; s.connect(g).connect(this.out); s.start(); this.loops[n] = s;
  },
  stopLoop(n) { if (this.wantLoop === n) this.wantLoop = null; if (this.loops[n]) { try { this.loops[n].stop(); } catch { /* already stopped */ } delete this.loops[n]; } },
  setMuted(m) { this.muted = m; store.set('mute', m); if (this.out) this.out.gain.value = m ? 0 : 0.55; Music.apply(); },
};

/* Music comes from the player's own files, listed in ../assets/music/music.json.
   Any slot with no file is simply silent. */
const Music = {
  man: {}, el: null, slot: null, lairIdx: store.get('lairIdx', 0), vol: 0.4,
  load() { return fetch('../assets/music/music.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((m) => { this.man = m || {}; }).catch(() => {}); },
  url(slot) {
    const m = this.man;
    if (slot === 'lair' || slot === 'chamber') { const l = m.lair || []; return l.length ? l[this.lairIdx % l.length] : null; }
    if (slot.startsWith('road')) return m[slot] || m.road || null;
    return m[slot] || null;
  },
  play(slot, force) {
    if (slot === this.slot && !force) return;
    this.slot = slot;
    const f = slot ? this.url(slot) : null;
    const old = this.el; this.el = null;
    if (old) { const t = setInterval(() => { old.volume = Math.max(0, old.volume - 0.05); if (old.volume <= 0.01) { old.pause(); clearInterval(t); } }, 40); }
    if (!f) { if (slot && slot in STREAM) Tube.play(STREAM[slot]); else Tube.pause(); return; }
    Tube.pause();
    const a = new Audio('../assets/music/' + encodeURIComponent(f)); a.loop = slot !== 'victory' && slot !== 'loading'; a.volume = Sound.muted ? 0 : this.vol;
    a.play().catch(() => {}); this.el = a;
  },
  apply() { if (this.el) this.el.volume = Sound.muted ? 0 : this.vol; Tube.setMuted(Sound.muted); },
  next() {
    const l = this.man.lair || [];
    if (!l.length) return Tube.next();
    this.lairIdx = (this.lairIdx + 1) % l.length; store.set('lairIdx', this.lairIdx);
    this.play('lair', true);
    return l[this.lairIdx].replace(/\.[^.]+$/, '').replace(/_/g, ' ');
  },
};

/* The streamed songs play through a small visible YouTube player (the tile must
   stay on screen while a song plays). A local file for a slot always wins. */
const Tube = {
  player: null, ready: false, loading: false, idx: -1, want: -1, fails: 0,
  init() {
    if (this.loading) return; this.loading = true;
    window.onYouTubeIframeAPIReady = () => {
      this.player = new YT.Player('ytplayer', {
        width: 220, height: 200, host: 'https://www.youtube-nocookie.com', playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => { this.ready = true; this.player.setVolume(40); this.setMuted(Sound.muted); if (this.want >= 0) this.play(this.want); },
          onStateChange: (e) => { if (e.data === 1) this.fails = 0; if (e.data === 0 && this.want >= 0) this.next(); },
          onError: () => { if (++this.fails >= TRACKS.length) this.pause(); else if (this.want >= 0) this.next(); }, // blocked or removed video: skip it
        },
      });
    };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { this.loading = false; $('ytbox').classList.add('hidden'); }; document.head.appendChild(s);
  },
  play(i) {
    this.want = i; $('ytbox').classList.remove('hidden'); $('ytname').textContent = TRACKS[i].name;
    if (!this.ready) { this.init(); return; }
    if (i !== this.idx) { this.idx = i; this.player.loadVideoById(TRACKS[i].id); } else this.player.playVideo();
    // a load right after the player wakes can sit unstarted; nudge it once
    setTimeout(() => { if (this.want === i && ![1, 3].includes(this.player.getPlayerState())) this.player.playVideo(); }, 1500);
  },
  next() { const i = ((this.want >= 0 ? this.want : this.idx) + 1) % TRACKS.length; this.play(i); return TRACKS[i].name; },
  pause() { this.want = -1; $('ytbox').classList.add('hidden'); if (this.ready) this.player.pauseVideo(); },
  setMuted(m) { if (this.ready) { if (m) this.player.mute(); else this.player.unMute(); } },
};

// ── input (physical key codes) ─────────────────────────────────────────────
const keys = {}; const pressed = {};
const mouse = { x: 0, y: 0, l: false, r: false };
addEventListener('keydown', (e) => { if (e.repeat) return; keys[e.code] = true; pressed[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; if (S.scene === 'road' || S.scene === 'lair' || S.scene === 'vale') setPause(true); });
const cv = $('c'); const ctx = cv.getContext('2d');
cv.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) mouse.l = true; if (e.button === 2) { mouse.r = true; pressed.Mouse2 = true; } });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', (e) => e.preventDefault());

// ── state ──────────────────────────────────────────────────────────────────
const S = {
  scene: 'menu', paused: false, t: 0, dialog: null, cam: { x: 700, y: 9000, shake: 0 }, zoom: 1,
  p: null, enemies: [], shots: [], parts: [], pickups: [], marks: [], decor: [], colliders: [],
  shards: 0, spawned: [], lit: [], respawn: 0, gate: 0, gateOpen: false, boss: null, bossSeen: false,
  runTime: 0, timing: false, deadT: 0, cardT: 0, endT: 0, zoneId: '', won: store.get('won', false), best: store.get('best', null),
  toastT: 0, hearthSeed: 0,
  spell: 0, vale: null, dog: null, pondFrozen: false, litCount: 0, dug: false, ambT: 6, valeZone: null, petIdx: 0,
};
window.__game = S;
const rand = rng(20261004);

function newPlayer(x, y) { return { x, y, hp: P.hp, flasks: P.flasks, boltT: 0, novaT: 0, blinkT: 0, inv: 0, face: 1, aim: -Math.PI / 2, moving: false, walk: 0, flash: 0 }; }

function buildRoad() {
  const d = []; const col = []; const r = rng(77);
  for (let i = 0; i < 34; i++) { // gravestones, kept off the path and away from the start
    const x = 190 + r() * 1020; const y = 6560 + r() * 2500;
    if (Math.abs(x - 700) < 130 || dist(x, y, KEEPER.x, KEEPER.y) < 120) continue;
    if (col.some((c) => dist(c.x, c.y, x, y) < 110)) continue;
    d.push({ img: 'gravestone', x, y, h: 96 + r() * 26, glow: ['#ff2a2a', '#ff7a1a'][i % 2], gy: 0.8 }); col.push({ x, y: y - 10, r: 24 });
  }
  for (let y = 1180; y < 3900; y += 250) { // spires line the causeway
    const plaza = y > 2040 && y < 2940;
    for (const side of [-1, 1]) d.push({ img: 'spire', x: 700 + side * (plaza ? 560 : 300), y: y + (side > 0 ? 60 : 0), h: 300 + r() * 80 });
  }
  for (const [x, y] of [[505, 5900], [895, 5900], [505, 4500], [895, 4500]]) { d.push({ img: 'gargoyle', x, y, h: 130 }); }
  for (let a = 0; a < 9; a++) { const x = 130 + a * 142; if (Math.abs(x - 700) > 300) d.push({ img: 'spire', x, y: 60, h: 360 + (a % 2) * 60 }); }
  for (const [i, w] of WAYSTONES.entries()) { d.push({ img: 'waystone', x: w.x, y: w.y, h: 118, way: i }); col.push({ x: w.x, y: w.y - 8, r: 24 }); }
  d.push({ img: 'keeper', x: KEEPER.x, y: KEEPER.y, h: 112, glow: '#ff9a3a', gy: 0.45, idle: 1 }); col.push({ x: KEEPER.x, y: KEEPER.y - 8, r: 24 });
  S.decor = d; S.colliders = col;
}

function startRun() {
  S.enemies = []; S.shots = []; S.parts = []; S.pickups = []; S.marks = [];
  S.shards = 0; S.spawned = []; S.lit = []; S.respawn = 0; S.gate = 0; S.gateOpen = false; S.boss = null; S.bossSeen = false;
  S.runTime = 0; S.timing = true; S.zoneId = '';
  buildRoad();
  S.p = newPlayer(START.x, START.y); S.cam.x = START.x; S.cam.y = START.y - 80;
}
function enterLair() {
  S.scene = 'lair'; S.enemies = []; S.shots = []; S.parts = []; S.pickups = []; S.marks = []; S.boss = null; S.timing = false;
  S.p = newPlayer(LAIR.spawn.x, LAIR.spawn.y); S.cam.x = 500; S.cam.y = 400;
  if (!S.dog) S.dog = newDog(); if (S.dog.mode === 'follow') placeDog(640, 340);
  S.decor = LAIR.props.map((p) => ({ ...p })); S.colliders = LAIR.props.filter((p) => p.r).map((p) => ({ x: p.x, y: p.y - p.r * 0.5, r: p.r }));
  $('hud').classList.remove('hidden'); $('boss').classList.add('hidden'); $('shards').classList.add('hidden');
  Sound.loop('hearth', 0.35); Music.play('lair');
}
// The bedchamber: a still, side-on room to lie down in and listen to the music box songs.
const CHAMBER = { moon: [0.279, 0.343], lantern: [0.191, 0.38], lamp: [0.887, 0.558], head: [0.664, 0.56] };
function enterChamber() {
  S.scene = 'chamber'; S.chillT = 0; S.snoreT = 3; S.prompt = ''; S.interact = null;
  $('hud').classList.add('hidden'); $('chill').classList.remove('hidden'); $('chillHint').textContent = STR.chill; $('chillSong').textContent = '';
  Sound.stopLoop('hearth'); Sound.loop('night', 0.4); Music.play('chamber');
}
function leaveChamber() {
  transition(() => { $('chill').classList.add('hidden'); Sound.stopLoop('night'); enterLair(); S.p.x = 250; S.p.y = 320; });
}
function updateChamber(dt) {
  if (S.fading) return;
  S.chillT += dt; S.snoreT -= dt;
  if (S.snoreT <= 0) { S.snoreT = 7 + Math.random() * 4; Sound.play('snore', 0.16); }
  if (pressed.KeyM) Sound.setMuted(!Sound.muted);
  if (pressed.Space || pressed.ArrowRight) { const n = Music.next(); $('chillSong').textContent = n ? STR.chillSong(n) : STR.boxEmpty; S.chillT = 0; }
  if (pressed.KeyE || pressed.Escape || pressed.Enter) leaveChamber();
  $('chill').classList.toggle('dim', S.chillT > 6);
}
function drawChamber() {
  const im = IMG.chamber; const t = S.t; if (!im) return;
  const k = Math.max(W / im.width, H / im.height) * (1.035 + Math.sin(t * 0.13) * 0.012);
  const w = im.width * k, h = im.height * k, y = (H - h) / 2;
  const x = clamp(W / 2 - CHAMBER.head[0] * w, W - w, 0) * (w > W * 1.3 ? 1 : 0) + (w > W * 1.3 ? 0 : (W - w) / 2 + Math.sin(t * 0.09) * 6); // narrow screens keep the sleeper in view
  ctx.drawImage(im, x, y, w, h);
  const at = (q) => [x + q[0] * w, y + q[1] * h]; const u = h / 1080;
  ctx.globalCompositeOperation = 'lighter';
  let [gx, gy] = at(CHAMBER.moon); glow(gx, gy, 150 * u, 'rgba(170,150,255,0.5)', 0.6 + Math.sin(t * 0.8) * 0.2);
  [gx, gy] = at(CHAMBER.lamp); glow(gx, gy, 300 * u, 'rgba(255,170,70,0.45)', 0.55 + Math.sin(t * 7) * 0.05 + Math.sin(t * 17) * 0.04);
  [gx, gy] = at(CHAMBER.lantern); glow(gx, gy, 140 * u, 'rgba(255,170,70,0.4)', 0.5 + Math.sin(t * 5 + 2) * 0.08);
  const r = rng(31); ctx.fillStyle = '#ffe9c0'; // dust motes drifting in the lamplight
  for (let i = 0; i < 40; i++) { const mx = (r() * W + t * (4 + r() * 8)) % W; const my = (r() * H + Math.sin(t * (0.2 + r() * 0.3) + i) * 30 + H) % H; ctx.globalAlpha = 0.08 + 0.22 * Math.abs(Math.sin(t * (0.3 + r()) + i)); const sz = 1 + r() * 2; ctx.fillRect(mx, my, sz, sz); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  [gx, gy] = at(CHAMBER.head); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) { const q = (t * 0.28 + i / 3) % 1; ctx.globalAlpha = Math.sin(q * Math.PI) * 0.8; ctx.font = `italic ${(18 + q * 26) * u}px "IM Fell English", Georgia, serif`; ctx.fillText('z', gx + (20 + q * 70 + Math.sin(q * 6 + i) * 10) * u, gy - (40 + q * 150) * u); }
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(7,5,26,0)'); v.addColorStop(1, 'rgba(7,5,26,0.8)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ── the Vale: Emberfall village around the tower, the Winterwood north of it ──
const VALE = { w: 1800, h: 2460, split: 1200, walk: { x: 70, y: 60, w: 1660, h: 2400 },
  paths: [{ x: 850, y: 300, w: 110, h: 2000 }, { x: 850, y: 1960, w: 700, h: 110 }, { x: 420, y: 1900, w: 500, h: 100 }],
  tower: { x: 900, y: 2260 }, door: { x: 900, y: 2300 }, gate: { x: 1540, y: 2440 }, pond: { x: 520, y: 520, rx: 250, ry: 160 }, doghouse: { x: 400, y: 1700 } };
const ANIMALS = [
  { id: 'fox', who: 'the fox', name: 'THE FOX', img: 'fox', x: 690, y: 1965, h: 70, sfx: 'fox', face: -1, li: 0, hop: 0, lines: ['Cold night. Good night. Sit by the fire a while, wizard.', 'The lanterns have been dark since the leaves turned. Ember. Second finger. You know the one.', 'I buried something under the birch by the well. If you find it, it was never mine.'] },
  { id: 'cat', who: 'the tower cat', name: 'THE TOWER CAT', img: 'cat', x: 1000, y: 2290, h: 64, sfx: 'cat', face: -1, li: 0, hop: 0, lines: ['...', 'The tower is warmer than the woods and you are warmer than the tower. Acceptable.', 'I have watched the road. Nothing has come down it. Yet.'] },
  { id: 'raven', who: 'the raven', name: 'THE RAVEN', img: 'raven', x: 540, y: 1690, h: 80, sfx: 'raven', face: -1, li: 0, hop: 0, lines: ['Caw. I mean: good evening.', 'The dog adores you. It is embarrassing for everyone.', 'Three shards, a gate, a king with his eyes on fire. I have seen it before. It ends well, mostly.'] },
  { id: 'owl', who: 'the owl', name: 'THE OWL', img: 'owl', x: 300, y: 940, h: 86, sfx: 'owl', face: 1, li: 0, hop: 0, lines: ['Who? You. Always you.', 'The stag remembers winters before your tower had a roof. Ask him nicely.', 'Frost on the pond would let you cross it. Frost is the third finger.'] },
  { id: 'stag', who: 'the frost stag', name: 'THE FROST STAG', img: 'stag', x: 1320, y: 430, h: 170, sfx: 'stag', face: -1, li: 0, hop: 0, lines: ['The snow is old here. It does not mind being walked on.', 'Once, a star fell past these pines and did not stop falling. You carry a piece of its dark.', 'Breathe. The road will still be there when you are ready.'] },
  { id: 'hare', who: 'the snow hare', name: 'THE SNOW HARE', img: 'hare', x: 1480, y: 970, h: 56, sfx: null, face: -1, li: 0, hop: 0, lines: ['(the hare looks at you, then at your pockets, then at you)', '(it thumps the snow once and sits very still)', '(it is not afraid of you, which is either trust or poor judgement)'] },
];
const inPond = (x, y) => { const q = VALE.pond; return ((x - q.x) / q.rx) ** 2 + ((y - q.y) / q.ry) ** 2 < 1; };

function buildVale() {
  const d = [], col = []; const r = rng(2027);
  const put = (o, cr) => { d.push(o); if (cr) { o.r = cr; col.push({ x: o.x, y: o.y - 6, r: cr }); } };
  put({ img: 'tower', x: VALE.tower.x, y: VALE.tower.y, h: 560, glow: '#ffb060', gy: 0.5 }, 120);
  put({ img: 'campfire', x: 600, y: 1960, h: 110, fire: 1, hr: 40 }, 44);
  put({ img: 'doghouse', id: 'doghouse', x: VALE.doghouse.x, y: VALE.doghouse.y, h: 120 }, 52);
  put({ img: 'fence', x: 330, y: 1770, h: 70 }, 44); put({ img: 'fence', x: 470, y: 1770, h: 70 }, 44);
  put({ img: 'well', x: 1250, y: 1800, h: 150, hr: 40 }, 48);
  put({ img: 'cart', x: 1380, y: 2180, h: 140, hr: 50 }, 60);
  put({ img: 'haybale', x: 1520, y: 1700, h: 110, hr: 40 }, 50);
  put({ img: 'signpost', x: 965, y: 1925, h: 120 }, 16);
  put({ img: 'vgate', x: VALE.gate.x, y: VALE.gate.y + 10, h: 300 }, 0);
  put({ img: 'snowman', x: 1120, y: 1080, h: 130, hr: 40 }, 36);
  put({ img: 'rune', id: 'rune', x: 790, y: 730, h: 50 }, 0);
  put({ img: 'birch', id: 'secret', x: 1150, y: 1690, h: 240, tree: 1, hr: 36 }, 28);
  for (const [x, y] of [[760, 2160], [1130, 2080], [1620, 2300], [300, 2220]]) put({ img: 'pumpkin', x, y, h: 70, lightable: 1, hr: 34 }, 30);
  for (const [x, y] of [[815, 1520], [1000, 1520], [815, 1780], [1000, 1780], [815, 2190], [1000, 2190], [1300, 1930], [560, 1860]]) put({ img: 'lantern', x, y, h: 150, lightable: 1, hr: 26 }, 14);
  for (const [x, y] of [[700, 330], [1500, 720]]) put({ img: 'log', x, y, h: 60, hr: 40 }, 40);
  const busy = (x, y) => d.some((o) => o.r && dist(x, y, o.x, o.y) < o.r + 70) || VALE.paths.some((q) => x > q.x - 60 && x < q.x + q.w + 60 && y > q.y - 60 && y < q.y + q.h + 60) || inPond(x, y) || dist(x, y, VALE.pond.x, VALE.pond.y) < 330 || ANIMALS.some((a) => dist(x, y, a.x, a.y) < 90) || dist(x, y, VALE.gate.x, VALE.gate.y) < 160;
  let tries = 0;
  for (let n = 0; n < 20 && tries < 600; tries++) { const x = 110 + r() * 1580, y = 1260 + r() * 1150; if (busy(x, y)) continue; put({ img: r() < 0.65 ? 'maple' : 'birch', x, y, h: 190 + r() * 80, tree: 1, hr: 36 }, 28); n++; }
  for (let n = 0; n < 18 && tries < 1400; tries++) { const x = 110 + r() * 1580, y = 100 + r() * 1080; if (busy(x, y)) continue; put({ img: 'pine', x, y, h: 220 + r() * 90, tree: 1, pine: 1, hr: 36 }, 28); n++; }
  for (let i = 0; i < 46; i++) { const a = (i / 46) * 6.283; const x = 900 + Math.cos(a) * 960, y = 1260 + Math.sin(a) * 1330; if (x < 60 || x > 1740 || y < 50 || y > 2470) continue; if (busy(x, y)) continue; put({ img: y < VALE.split ? 'pine' : 'maple', x, y, h: 260, tree: 1, pine: y < VALE.split, hr: 36 }, 28); }
  for (const dx of [-120, 0, 120]) col.push({ x: VALE.pond.x + dx, y: VALE.pond.y, r: 160, pond: 1 });
  for (const a of ANIMALS) col.push({ x: a.x, y: a.y - 6, r: 24 });
  S.vale = { decor: d, cols: col, lightables: d.filter((o) => o.lightable).length };
}
function enterVale(from) {
  S.scene = 'vale'; S.enemies = []; S.shots = []; S.parts = []; S.pickups = []; S.marks = []; S.boss = null; S.timing = false; S.valeZone = null;
  if (!S.vale) buildVale(); S.decor = S.vale.decor; S.colliders = S.vale.cols.filter((c) => !(c.pond && S.pondFrozen));
  S.p = newPlayer(VALE.door.x, VALE.door.y + 40); S.cam.x = S.p.x; S.cam.y = S.p.y - 60;
  if (!S.dog) S.dog = newDog(); if (S.dog.mode === 'follow') placeDog(S.p.x - 60, S.p.y + 10); else placeDog(VALE.doghouse.x + 70, VALE.doghouse.y - 10);
  $('hud').classList.remove('hidden'); $('boss').classList.add('hidden'); $('shards').classList.add('hidden');
  Sound.stopLoop('hearth'); if (from === 'lair') Sound.play('door', 0.6);
}
function freezePond() {
  S.pondFrozen = true; S.colliders = S.colliders.filter((c) => !c.pond); Sound.play('freeze', 0.9); S.cam.shake = 4;
  ring(VALE.pond.x, VALE.pond.y, 270, '#bfe8ff', 1.2); burst(VALE.pond.x, VALE.pond.y, '#ffffff', 40, 260, 1, 3); toast(STR.frozen, 3);
}
function updateVale(dt) {
  const p = S.p; S.interact = null;
  const winter = p.y < VALE.split;
  if (S.valeZone !== winter) { S.valeZone = winter; banner(winter ? STR.zoneWinter : STR.zoneVale); Music.play(winter ? 'winter' : 'vale'); Sound.stopLoop(winter ? 'autumn' : 'wind'); Sound.loop(winter ? 'wind' : 'autumn', 0.35); }
  for (const a of ANIMALS) a.hop = Math.max(0, a.hop - dt * 2);
  // nearest thing worth pressing E on
  let best = null, bd = 1e9; const cand = (dd, lim, prompt, fn) => { if (dd < lim && dd < bd) { bd = dd; best = { prompt, fn }; } };
  cand(dist(p.x, p.y, VALE.door.x, VALE.door.y + 30), 80, STR.pIn, () => { Sound.play('door', 0.9); transition(() => { enterLair(); S.p.x = 760; S.p.y = 330; }); });
  cand(dist(p.x, p.y, VALE.gate.x, VALE.gate.y - 40), 120, STR.pRoad, () => transition(enterRoad, true));
  for (const a of ANIMALS) cand(dist(p.x, p.y, a.x, a.y), 95, STR.pTalkTo(a.who), () => { say(a.name, a.lines[a.li % a.lines.length]); a.li++; a.hop = 1; a.face = p.x < a.x ? -1 : 1; if (a.sfx) Sound.play(a.sfx, 0.6); });
  const dh = dist(p.x, p.y, VALE.doghouse.x, VALE.doghouse.y + 10);
  const dog = S.dog;
  if (dog.mode === 'home') cand(dh, 110, STR.pCall, () => { dog.mode = 'follow'; store.set('dog', true); Sound.play('bark', 0.8); Sound.play('pant', 0.5); toast(STR.joined, 3.5); burst(dog.x, dog.y - 40, '#ff7aa8', 14, 120, 0.8, 5); });
  else if (dog.mode === 'follow') cand(dh, 110, STR.pStay, () => { dog.mode = 'home'; store.set('dog', false); Sound.play('pant', 0.5); toast(STR.stay, 3); });
  else cand(dh, 110, STR.pCome, () => { dog.mode = 'follow'; store.set('dog', true); Sound.play('bark', 0.8); toast(STR.come, 3); });
  cand(dist(p.x, p.y, 790, 730), 70, STR.pRune, () => say(...STR.rune));
  cand(dist(p.x, p.y, 1150, 1700), 80, STR.pDig, () => { toast(S.dug ? STR.dugAgain : STR.dug, 3.5); if (!S.dug) { S.dug = true; Sound.play('shard', 0.8, 0.8); burst(1150, 1690, '#ffffff', 20, 160, 0.8); } });
  if (!best) { const dd = dist(p.x, p.y, dog.x, dog.y); if (dd < 90) { best = { prompt: STR.pPet, fn: () => { dog.hearts = 1.5; dog.idle = 2; Sound.play('pant', 0.6); toast(STR.pet[S.petIdx++ % STR.pet.length], 3); burst(dog.x, dog.y - 50, '#ff7aa8', 10, 90, 0.9, 5); } }; } }
  if (best) { S.prompt = best.prompt; S.interact = best.fn; }
  // spells meet the world
  for (const s of S.shots) {
    if (s.foe || s.life <= 0) continue;
    if (!S.pondFrozen && s.kind === 'frost' && inPond(s.x, s.y)) { freezePond(); s.life = 0; continue; }
    for (const d of S.decor) {
      if (!d.hr || dist(s.x, s.y, d.x, d.y - d.h * 0.45) > d.hr + s.r) continue;
      s.life = 0;
      if (d.lightable) { if (s.kind === 'ember' && !d.lit) { d.lit = true; S.litCount++; Sound.play('ember', 0.5, 0.8); burst(d.x, d.y - d.h * 0.7, '#ffb060', 18, 160, 0.6); if (S.litCount === S.vale.lightables) toast(STR.allLit, 3.5); } else burst(s.x, s.y, s.color, 6, 120, 0.3, 3); }
      else if (d.tree) { const c = s.kind === 'frost' || d.pine ? '#ffffff' : ['#ff7a2a', '#ffb02a', '#d83a1a'][(d.x | 0) % 3]; for (let i = 0; i < 14; i++) S.parts.push({ x: d.x + (Math.random() - 0.5) * d.h * 0.5, y: d.y - d.h * (0.4 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 50, life: 1.6, max: 1.6, color: c, size: 4 + Math.random() * 3, drift: 1 }); }
      else burst(s.x, s.y, s.color, 6, 120, 0.3, 3);
      break;
    }
  }
  S.ambT -= dt;
  if (S.ambT <= 0) { S.ambT = 9 + Math.random() * 8; const near = ANIMALS.filter((a) => a.sfx && dist(p.x, p.y, a.x, a.y) < 650); if (near.length) Sound.play(near[(Math.random() * near.length) | 0].sfx, 0.25); }
}

// ── Marigold, the golden retriever ─────────────────────────────────────────
function newDog() { return { x: VALE.doghouse.x + 70, y: VALE.doghouse.y - 10, mode: store.get('dog', false) ? 'follow' : 'home', face: 1, walk: 0, idle: 3, bite: 0, hearts: 0 }; }
function placeDog(x, y) { S.dog.x = x; S.dog.y = y; S.dog.idle = 0; }
function updateDog(dt) {
  const d = S.dog, p = S.p; if (!d) return;
  d.bite -= dt; d.hearts = Math.max(0, d.hearts - dt);
  let tx, ty;
  if (d.mode === 'follow') {
    tx = p.x - p.face * 46; ty = p.y + 26;
    if (S.scene === 'road') {
      let best = null, bd = 300; for (const e of S.enemies) { const q = dist(p.x, p.y, e.x, e.y); if (!e.dead && q < bd) { bd = q; best = e; } }
      if (best) { tx = best.x; ty = best.y + 10; if (dist(d.x, d.y, best.x, best.y) < best.r + 36 && d.bite <= 0) { d.bite = 0.7; hurtEnemy(best, 6, (best.x - d.x) * 3, (best.y - d.y) * 3); Sound.play('bark', 0.45, 1.1); } }
    }
  } else if (S.scene === 'vale') { tx = VALE.doghouse.x + 70; ty = VALE.doghouse.y - 10; } else return;
  const q = dist(d.x, d.y, tx, ty);
  if (q > 70) { // she walks through props and people, but stays on walkable ground; if she snags for long she catches up
    const sp = Math.min(340, 120 + q * 1.6); const nx = (tx - d.x) / q, ny = (ty - d.y) / q; const ox = d.x, oy = d.y;
    d.x += nx * sp * dt; d.y += ny * sp * dt; if (!inWalk(d.x, d.y, 14)) { d.x = ox; d.y = oy; d.stuck = (d.stuck || 0) + dt; if (d.stuck > 1.5) placeDog(tx, ty); } else d.stuck = 0;
    d.walk += dt * 12; d.idle = 0; if (Math.abs(nx) > 0.2) d.face = nx > 0 ? 1 : -1; }
  else { d.idle += dt; if (d.mode === 'follow' && Math.abs(p.x - d.x) > 10) d.face = p.x > d.x ? 1 : -1; }
  if (q > 900) placeDog(tx, ty);
}

function drawValeGround(vx0, vy0, vx1, vy1) {
  const t = S.t, sp = VALE.split, w = VALE.walk;
  ctx.fillStyle = '#0a0814'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  ctx.save(); ctx.beginPath(); ctx.rect(w.x - 40, w.y - 40, w.w + 80, w.h + 80); ctx.clip();
  ctx.fillStyle = pat('snow', 0.5); ctx.fillRect(vx0, vy0, vx1 - vx0, Math.max(0, sp + 20 - vy0));
  if (vy1 > sp - 100) { ctx.fillStyle = pat('leaves', 0.5); ctx.fillRect(vx0, Math.max(vy0, sp - 100), vx1 - vx0, vy1 - Math.max(vy0, sp - 100)); ctx.fillStyle = pat('snow', 0.5); for (let i = 0; i < 8; i++) { ctx.globalAlpha = 1 - i / 8; ctx.fillRect(vx0, sp - 100 + i * 15, vx1 - vx0, 15); } ctx.globalAlpha = 1; }
  ctx.fillStyle = pat('dirt', 0.45); // a trodden trail through the snow, a proper dirt road in the village
  for (const q of VALE.paths) { const ys = Math.max(q.y, sp - 100); if (ys < q.y + q.h) { ctx.globalAlpha = 0.9; ctx.fillRect(q.x, ys, q.w, q.y + q.h - ys); } if (q.y < sp - 100) { ctx.globalAlpha = 0.38; ctx.fillRect(q.x + 20, q.y, q.w - 40, Math.min(q.h, sp - 100 - q.y)); } } ctx.globalAlpha = 1;
  const pd = VALE.pond; ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.ellipse(pd.x, pd.y + 8, pd.rx + 14, pd.ry + 12, 0, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0, 6.283);
  if (S.pondFrozen) { ctx.fillStyle = pat('ice', 0.5); ctx.fill(); }
  else { ctx.fillStyle = '#16244c'; ctx.fill(); ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(180,210,255,0.35)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = pd.y - pd.ry + ((i * 53 + t * 18) % (pd.ry * 2)); ctx.beginPath(); ctx.moveTo(pd.x - pd.rx, y); ctx.bezierCurveTo(pd.x - 80, y + 8, pd.x + 80, y - 8, pd.x + pd.rx, y); ctx.stroke(); } ctx.restore(); glow(pd.x + 60, pd.y - 40, 120, 'rgba(170,190,255,0.25)'); }
  ctx.restore();
}

function enterRoad() {
  S.scene = 'road'; startRun(); Sound.stopLoop('hearth'); Sound.stopLoop('wind'); Sound.stopLoop('autumn'); $('shards').classList.remove('hidden'); Music.play('road_1');
  if (S.dog && S.dog.mode === 'follow') placeDog(START.x - 70, START.y + 20);
}
function transition(fn, loading) {
  if (S.fading) return; S.fading = true;
  $('fade').classList.add('on'); if (loading) Music.play('loading');
  setTimeout(() => { fn(); $('fade').classList.remove('on'); S.fading = false; }, loading && Music.url('loading') ? 1800 : 700);
}

// ── walkability ────────────────────────────────────────────────────────────
function inWalk(x, y, r) {
  if (S.scene === 'lair') { const w = LAIR.walk; return x - r >= w.x && x + r <= w.x + w.w && y >= w.y && y <= w.y + w.h; }
  if (!S.gateOpen && y < GATE_Y + 60) return false;
  if (S.boss && !S.boss.dead && y > GATE_Y - 70) return false;
  for (const w of WALK) if (x - r >= w.x && x + r <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  return false;
}
function moveBody(b, dx, dy, r, free) {
  if (free || inWalk(b.x + dx, b.y + dy, r)) { b.x += dx; b.y += dy; } else if (inWalk(b.x + dx, b.y, r)) b.x += dx; else if (inWalk(b.x, b.y + dy, r)) b.y += dy;
  if (!free) for (const c of S.colliders) { const d = dist(b.x, b.y, c.x, c.y); const m = c.r + r; if (d < m && d > 0.01) { const nx = b.x + ((b.x - c.x) / d) * (m - d); const ny = b.y + ((b.y - c.y) / d) * (m - d); if (inWalk(nx, ny, r)) { b.x = nx; b.y = ny; } } }
}

// ── effects ────────────────────────────────────────────────────────────────
function burst(x, y, color, n, sp = 220, life = 0.5, size = 4) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283; const v = sp * (0.3 + Math.random() * 0.7); S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.5 + Math.random() * 0.5), max: life, color, size: size * (0.5 + Math.random()) }); } }
function ring(x, y, r, color, life = 0.45) { S.parts.push({ ring: 1, x, y, r, life, max: life, color }); }
function toast(msg, secs = 2.4) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); S.toastT = secs; }
function banner(msg) { const z = $('zone'); z.textContent = msg; z.classList.add('show'); clearTimeout(banner.t); banner.t = setTimeout(() => z.classList.remove('show'), 2600); }
function say(who, text) { S.dialog = { who, text }; $('dlgWho').textContent = who; $('dlgText').textContent = text; $('dialog').classList.remove('hidden'); Sound.play('page', 0.8); }
function closeDialog() { S.dialog = null; $('dialog').classList.add('hidden'); }
function setPause(on) { if (S.dialog && on) return; S.paused = on; $('pause').classList.toggle('hidden', !on); }

// ── combat ─────────────────────────────────────────────────────────────────
function spawn(type, x, y) { const d = ET[type]; const e = { type, x, y, sx: x, sy: y, hp: d.hp, max: d.hp, r: d.r, t: 0.6 + Math.random(), st: 'idle', flash: 0, face: 1, ph: Math.random() * 6.28, vx: 0, vy: 0, ang: 0 }; S.enemies.push(e); return e; }
function hurtPlayer(dmg) {
  const p = S.p; if (p.inv > 0 || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - dmg); p.inv = P.inv; p.flash = 0.25; S.cam.shake = 10; Sound.play('hurt', 0.9); burst(p.x, p.y - 40, '#ff4466', 10);
  if (p.hp <= 0) { S.deadT = 2.2; $('death').classList.remove('hidden'); Sound.play('death', 0.7, 0.7); }
}
function hurtEnemy(e, dmg, kx = 0, ky = 0) {
  if (e.dead) return; e.hp -= dmg; e.flash = 0.12; e.vx += kx; e.vy += ky; Sound.play('hit', 0.45);
  burst(e.x, e.y - (ET[e.type].h || 30) * 0.5, '#c8b8ff', 5, 160, 0.35, 3);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; const d = ET[e.type]; Sound.play('death', d.elite ? 0.9 : 0.5, d.elite ? 0.8 : 1.2);
  burst(e.x, e.y - 30, e.type === 'wisp' ? '#ff4040' : '#b9a8ff', d.elite ? 50 : 16, d.elite ? 380 : 240, d.elite ? 1 : 0.6, 5); ring(e.x, e.y, d.elite ? 160 : 60, '#c8b8ff');
  if (d.elite) { let x = e.x, y = e.y; if (!inWalk(x, y, 20)) { x = S.p.x; y = S.p.y - 50; } S.pickups.push({ x, y, t: 0 }); S.cam.shake = 14; }
}
function castNova() {
  const p = S.p; p.novaT = P.novaCd; Sound.play('nova', 0.9); S.cam.shake = 8; ring(p.x, p.y, P.novaR, '#c9a0ff', 0.5); ring(p.x, p.y, P.novaR * 0.6, '#ffffff', 0.35); burst(p.x, p.y - 30, '#c9a0ff', 40, 520, 0.5, 5);
  for (const e of S.enemies) { const d = dist(p.x, p.y, e.x, e.y); if (!e.dead && d < P.novaR + e.r) hurtEnemy(e, P.nova, ((e.x - p.x) / (d || 1)) * 520, ((e.y - p.y) / (d || 1)) * 520); }
  for (const s of S.shots) if (s.foe && dist(p.x, p.y, s.x, s.y) < P.novaR) s.life = 0;
  const b = S.boss; if (b && b.active && !b.dead && dist(p.x, p.y, KING.x, KING.y) < P.novaR + KING.r) hurtKing(P.nova);
}
function hurtKing(dmg) {
  const b = S.boss; if (!b || b.dead || !b.active) return; b.hp = Math.max(0, b.hp - dmg); b.flash = 0.1; Sound.play('hit', 0.4, 0.7);
  const ph = b.hp > KING.hp * 0.66 ? 1 : b.hp > KING.hp * 0.33 ? 2 : 3;
  if (ph !== b.phase) { b.phase = ph; Sound.play('roar', 1); S.cam.shake = 18; ring(KING.x, KING.y - 150, 420, '#ff3030', 0.8); S.shots = S.shots.filter((s) => !s.foe); b.fanT = 1.4; b.starT = 1; }
  if (b.hp <= 0) { b.dead = true; b.dieT = 3; S.timing = false; S.shots = []; S.marks = []; Sound.play('roar', 1, 0.6); Music.play('victory'); }
}
function foeShot(x, y, ang, sp, dmg, r = 12, color = '#ff3a3a') { S.shots.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 4.5, dmg, r, foe: 1, color }); }

function updatePlayer(dt) {
  const p = S.p; const lair = S.scene === 'lair';
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  const ml = Math.hypot(mx, my); if (ml) { mx /= ml; my /= ml; }
  p.moving = ml > 0; if (p.moving) p.walk += dt * 11;
  moveBody(p, mx * P.speed * dt, my * P.speed * dt, P.r);
  const w = toWorld(mouse.x, mouse.y); p.aim = Math.atan2(w.y - (p.y - 44), w.x - p.x); p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
  p.boltT -= dt; p.novaT = Math.max(0, p.novaT - dt); p.blinkT = Math.max(0, p.blinkT - dt); p.inv = Math.max(0, p.inv - dt); p.flash = Math.max(0, p.flash - dt);
  if (lair) return;
  if (pressed.Digit1) S.spell = 0; if (pressed.Digit2) S.spell = 1; if (pressed.Digit3) S.spell = 2;
  if (mouse.l && p.boltT <= 0) { const sp = SPELLS[S.spell]; p.boltT = P.boltRate; Sound.play(sp.sfx, 0.4); S.shots.push({ x: p.x + Math.cos(p.aim) * 26, y: p.y - 44 + Math.sin(p.aim) * 26, vx: Math.cos(p.aim) * P.boltSpeed, vy: Math.sin(p.aim) * P.boltSpeed, life: P.boltLife, dmg: sp.dmg, r: 9, color: sp.color, kind: sp.id }); }
  if (pressed.Mouse2 && p.novaT <= 0) castNova();
  if (pressed.Space && p.blinkT <= 0) {
    const ax = ml ? mx : Math.cos(p.aim); const ay = ml ? my : Math.sin(p.aim); const ox = p.x, oy = p.y;
    for (let d = P.blink; d > 0; d -= 12) if (inWalk(ox + ax * d, oy + ay * d, P.r)) { p.x = ox + ax * d; p.y = oy + ay * d; break; }
    p.blinkT = P.blinkCd; p.inv = Math.max(p.inv, 0.3); Sound.play('blink', 0.7);
    for (let i = 0; i <= 8; i++) burst(lerp(ox, p.x, i / 8), lerp(oy, p.y, i / 8) - 40, '#9fd0ff', 3, 60, 0.4, 3);
  }
  if (pressed.KeyQ && p.flasks > 0 && p.hp < P.hp) { p.flasks--; p.hp = Math.min(P.hp, p.hp + P.flask); Sound.play('flask', 0.8); burst(p.x, p.y - 40, '#9fffd0', 18, 120, 0.7); }
}

function updateEnemy(e, dt) {
  const p = S.p; const d = ET[e.type]; const dx = p.x - e.x, dy = p.y - e.y; const dd = Math.hypot(dx, dy) || 1; const nx = dx / dd, ny = dy / dd;
  e.flash = Math.max(0, e.flash - dt); e.ph += dt; e.t -= dt;
  if (e.burn > 0) { e.burn -= dt; e.burnT = (e.burnT || 0) - dt; if (e.burnT <= 0) { e.burnT = 0.5; burst(e.x, e.y - 40, '#ff9a3a', 4, 80, 0.4, 3); hurtEnemy(e, 3); if (e.dead) return; } }
  if (e.slow > 0) e.slow -= dt;
  // knockback bleeds off
  if (e.vx || e.vy) { moveBody(e, e.vx * dt, e.vy * dt, e.r, d.fly); e.vx *= 0.86; e.vy *= 0.86; if (Math.abs(e.vx) + Math.abs(e.vy) < 8) e.vx = e.vy = 0; }
  if (dd > 820 && e.st === 'idle') return;
  if (Math.abs(dx) > 6) e.face = dx > 0 ? 1 : -1;
  const go = (sx, sy, sp) => { const m = e.slow > 0 ? 0.5 : 1; moveBody(e, sx * sp * m * dt, sy * sp * m * dt, e.r, d.fly); };
  if (e.type === 'wisp') {
    go(nx + Math.sin(e.ph * 3) * 0.5 * -ny, ny + Math.sin(e.ph * 3) * 0.5 * nx, d.sp);
    if (dd < e.r + P.r + 6) { hurtPlayer(d.dmg); killEnemy(e); }
  } else if (e.type === 'thrall') {
    if (e.st === 'wind') { if (e.t <= 0) { if (dd < 84) hurtPlayer(d.dmg); ring(e.x, e.y, 70, '#ff5050', 0.25); e.st = 'idle'; e.t = 1.1; } }
    else if (dd < 58 && e.t <= 0) { e.st = 'wind'; e.t = 0.42; }
    else if (dd > 46) go(nx, ny, d.sp);
  } else if (e.type === 'moth') {
    const want = 290; const rad = dd > want + 40 ? 1 : dd < want - 40 ? -1 : 0;
    go(nx * rad + -ny * 0.8, ny * rad + nx * 0.8, d.sp);
    if (e.t <= 0 && dd < 620) { e.t = 2.1; foeShot(e.x, e.y - 40, Math.atan2(p.y - 30 - (e.y - 40), dx), 230, d.dmg, 11, '#5aa0ff'); }
  } else if (e.type === 'knight') {
    if (e.st === 'wind') { if (e.t <= 0) { e.st = 'dash'; e.t = 0.6; } }
    else if (e.st === 'dash') { go(Math.cos(e.ang), Math.sin(e.ang), 640); if (dd < e.r + P.r + 8) hurtPlayer(d.dmg); if (e.t <= 0) { e.st = 'idle'; e.t = 2.2; } }
    else { go(nx, ny, d.sp); if (dd < e.r + P.r) hurtPlayer(12); if (e.t <= 0 && dd < 560) { e.st = 'wind'; e.t = 0.7; e.ang = Math.atan2(dy, dx); } }
  } else if (e.type === 'wraith') {
    if (e.st === 'wind') { if (e.t <= 0) { ring(e.x, e.y, 165, '#ff5aa0', 0.4); burst(e.x, e.y - 40, '#ff5aa0', 30, 420, 0.4); S.cam.shake = 8; if (dd < 165 + P.r) hurtPlayer(d.dmg); e.st = 'idle'; e.t = 1.9; } }
    else { go(nx + -ny * 0.5 * Math.sin(e.ph), ny + nx * 0.5 * Math.sin(e.ph), d.sp); if (dd < 130 && e.t <= 0) { e.st = 'wind'; e.t = 0.65; } }
  } else if (e.type === 'sentinel') {
    go(Math.cos(e.ph * 0.5), Math.sin(e.ph * 0.7), d.sp);
    if (e.st === 'idle' && e.t <= 0) { e.st = 'warn'; e.t = 0.9; e.ang = Math.atan2(dy, dx) + 1.2; }
    else if (e.st === 'warn') { if (e.t <= 0) { e.st = 'beam'; e.t = 3.2; e.dir = Math.sin(Math.atan2(dy, dx) - e.ang) >= 0 ? 1 : -1; } }
    else if (e.st === 'beam') { e.ang += e.dir * 0.85 * dt; if (beamHits(e.x, e.y - 20, e.ang, 760, 26)) hurtPlayer(d.dmg); if (e.t <= 0) { e.st = 'idle'; e.t = 1.8; } }
  }
}
function beamHits(ox, oy, ang, len, half) { const p = S.p; const px = p.x - ox, py = p.y - 30 - oy; const along = px * Math.cos(ang) + py * Math.sin(ang); const off = Math.abs(-px * Math.sin(ang) + py * Math.cos(ang)); return along > 0 && along < len && off < half + P.r; }

function updateKing(dt) {
  const b = S.boss; const p = S.p; if (!b) return;
  b.flash = Math.max(0, b.flash - dt); b.ph += dt;
  if (b.dead) { b.dieT -= dt; if (Math.random() < 0.7) burst(KING.x + (Math.random() - 0.5) * 240, KING.y - Math.random() * KING.h, '#ffffff', 2, 90, 1.4, 4); if (b.dieT <= 0 && S.scene === 'road') win(); return; }
  if (!b.active) return;
  const ey = KING.y - KING.h * 0.62; const ang = Math.atan2(p.y - 30 - ey, p.x - KING.x);
  b.fanT -= dt; b.starT -= dt;
  if (b.fanT <= 0) { b.fanT = b.phase === 1 ? 1.6 : b.phase === 2 ? 1.9 : 2.3; for (let i = -2; i <= 2; i++) foeShot(KING.x, ey + 40, ang + i * 0.2, 235, 12, 13); Sound.play('bolt', 0.5, 0.6); }
  if (b.phase >= 2 && b.starT <= 0) { b.starT = b.phase === 2 ? 1.25 : 1.9; S.marks.push({ x: p.x + (Math.random() - 0.5) * 90, y: p.y + (Math.random() - 0.5) * 90, r: 92, t: 1, dmg: 30 }); }
  if (b.phase === 3) { b.beam += 0.62 * dt * b.beamDir; if (beamHits(KING.x, KING.y - 60, b.beam, 1300, 24)) hurtPlayer(20); }
}

function update(dt) {
  S.t += dt;
  if (S.toastT > 0) { S.toastT -= dt; if (S.toastT <= 0) $('toast').classList.remove('show'); }
  if (S.scene === 'chamber') { updateChamber(dt); return; }
  if (S.scene !== 'lair' && S.scene !== 'road' && S.scene !== 'vale') return;
  if (pressed.Escape) { if (S.dialog) closeDialog(); else setPause(!S.paused); }
  if (pressed.KeyM) Sound.setMuted(!Sound.muted);
  if (S.dialog) { if (pressed.KeyE || pressed.Enter || pressed.Space) closeDialog(); return; }
  if (S.paused || S.fading) return;
  if (S.cardT > 0) { S.cardT -= dt; if (S.cardT <= 0) { $('card').classList.add('hidden'); S.boss.active = true; $('boss').classList.remove('hidden'); } return; }
  const p = S.p;
  if (S.deadT > 0) { S.deadT -= dt; if (S.deadT <= 0) respawn(); return; }
  if (S.timing) S.runTime += dt;
  updatePlayer(dt);
  S.prompt = '';
  if (S.scene === 'lair') updateLair(); else if (S.scene === 'vale') updateVale(dt); else updateRoad(dt);
  updateDog(dt);
  for (const s of S.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.foe) { if (dist(s.x, s.y, p.x, p.y - 30) < s.r + P.r) { hurtPlayer(s.dmg); s.life = 0; } continue; }
    for (const e of S.enemies) if (!e.dead && dist(s.x, s.y, e.x, e.y - (ET[e.type].h || 40) * 0.4) < s.r + e.r + 6) { hurtEnemy(e, s.dmg, s.vx * 0.12, s.vy * 0.12); if (s.kind === 'ember') e.burn = 1.5; if (s.kind === 'frost') e.slow = 2; s.life = 0; break; }
    const b = S.boss; if (s.life > 0 && b && b.active && !b.dead && Math.abs(s.x - KING.x) < KING.r && s.y < KING.y && s.y > KING.y - KING.h * 0.9) { hurtKing(s.dmg); s.life = 0; }
    if (s.life <= 0) burst(s.x, s.y, s.color, 5, 140, 0.25, 3);
  }
  S.shots = S.shots.filter((s) => s.life > 0);
  for (const m of S.marks) { m.t -= dt; if (m.t <= 0) { ring(m.x, m.y, m.r, '#ffffff', 0.4); burst(m.x, m.y, '#ffd0ff', 26, 380, 0.5, 5); S.cam.shake = 7; Sound.play('nova', 0.5, 1.5); if (dist(m.x, m.y, p.x, p.y) < m.r + P.r) hurtPlayer(m.dmg); } }
  S.marks = S.marks.filter((m) => m.t > 0);
  for (const q of S.parts) { q.life -= dt; if (!q.ring) { q.x += q.vx * dt; q.y += q.vy * dt; if (q.drift) q.vx = Math.sin(q.life * 5) * 40; else { q.vx *= 0.95; q.vy *= 0.95; } } }
  S.parts = S.parts.filter((q) => q.life > 0);
  S.enemies = S.enemies.filter((e) => !e.dead);
  if (pressed.KeyE && S.interact) S.interact();
}

function updateLair() {
  const p = S.p; let best = null, bd = 95; S.interact = null;
  for (const pr of S.decor) { if (!pr.prompt) continue; const d = dist(p.x, p.y, pr.x, pr.y + (pr.r ? 0 : 20)); if (d < bd) { bd = d; best = pr; } }
  if (S.won && dist(p.x, p.y, 500, 290) < 80 && !best) S.prompt = STR.trophy;
  if (!best) return;
  S.prompt = STR[best.prompt];
  S.interact = () => {
    if (best.id === 'tome') say(...(S.won ? STR.tomeDone : STR.tome));
    else if (best.id === 'stairs') { Sound.play('door', 0.5, 0.8); transition(enterChamber); }
    else if (best.id === 'box') { const n = Music.next(); Sound.play('page', 0.5, 1.6); toast(n ? STR.boxPlay(n) : STR.boxEmpty); }
    else if (best.id === 'door') { Sound.play('door', 0.9); transition(() => enterVale('lair')); }
  };
}

function updateRoad(dt) {
  const p = S.p; S.interact = null;
  const z = ZONES.find((q) => p.y >= q.y0 && p.y < q.y1);
  if (z && z.id !== S.zoneId) { S.zoneId = z.id; banner(z.name); if (z.id !== 'keep') Music.play('road_' + (4 - ZONES.indexOf(z))); }
  for (const [i, g] of SPAWNS.entries()) if (!S.spawned[i] && p.y < g.at) { S.spawned[i] = true; for (const [t, x, y] of g.list) { spawn(t, x, y); ring(x, y, 50, '#ff4040', 0.5); } }
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
  for (const [i, w] of WAYSTONES.entries()) if (!S.lit[i] && dist(p.x, p.y, w.x, w.y) < 150) { S.lit[i] = true; S.respawn = i; p.hp = P.hp; p.flasks = P.flasks; toast(STR.waystone); Sound.play('shard', 0.6, 0.7); ring(w.x, w.y, 120, '#9fd0ff', 0.7); }
  if (dist(p.x, p.y, KEEPER.x, KEEPER.y) < 90) { S.prompt = STR.pTalk; S.interact = () => say(...STR.keeper); }
  for (const k of S.pickups) { k.t += dt; if (!k.got && dist(p.x, p.y, k.x, k.y) < 75) { S.prompt = STR.pShard; S.interact = () => { k.got = true; S.shards++; Sound.play('shard', 1); toast(STR.shard); ring(k.x, k.y, 140, '#ffffff', 0.7); burst(k.x, k.y - 30, '#ffffff', 30, 260, 0.8); }; } }
  S.pickups = S.pickups.filter((k) => !k.got);
  if (!S.gateOpen && p.y < GATE_Y + 260) { if (S.shards >= 3) { S.gateOpen = true; Sound.play('gate', 1); S.cam.shake = 10; } else S.prompt = S.prompt || STR.gate(S.shards); }
  if (S.gateOpen && S.gate < 1) S.gate = Math.min(1, S.gate + dt / 1.6);
  if (S.gateOpen && !S.boss && p.y < GATE_Y - 110) {
    S.boss = { hp: KING.hp, phase: 1, active: false, dead: false, fanT: 1.2, starT: 1.5, beam: Math.PI / 2 + 1.3, beamDir: -1, flash: 0, ph: 0 };
    S.colliders.push({ x: KING.x, y: KING.y - 20, r: KING.r, king: 1 });
    if (!S.bossSeen) { S.bossSeen = true; S.cardT = 2.8; $('card').classList.remove('hidden'); } else { S.boss.active = true; $('boss').classList.remove('hidden'); }
    Sound.play('roar', 1); Music.play('boss');
  }
  updateKing(dt);
}

function respawn() {
  $('death').classList.add('hidden'); const w = WAYSTONES[S.respawn]; const lit = S.lit[S.respawn];
  S.p = newPlayer(lit ? w.x - 70 : START.x, lit ? w.y + 30 : START.y);
  if (S.dog && S.dog.mode === 'follow') placeDog(S.p.x - 60, S.p.y + 20);
  S.shots = []; S.marks = [];
  for (const e of S.enemies) { e.x = e.sx; e.y = e.sy; e.hp = e.max; e.st = 'idle'; e.t = 1; e.vx = e.vy = 0; }
  if (S.boss) { S.boss = null; S.colliders = S.colliders.filter((c) => !c.king); $('boss').classList.add('hidden'); Music.play('road_3'); }
}
function win() {
  S.scene = 'end'; S.won = true; store.set('won', true);
  if (S.best === null || S.runTime < S.best) { S.best = S.runTime; store.set('best', S.best); }
  const m = Math.floor(S.runTime / 60), s = Math.floor(S.runTime % 60);
  $('endTime').textContent = `Time: ${m}:${String(s).padStart(2, '0')}`;
  $('hud').classList.add('hidden'); $('ending').classList.remove('hidden');
}

// ── rendering ──────────────────────────────────────────────────────────────
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; S.zoom = H / 780; }
addEventListener('resize', resize);
function toWorld(sx, sy) { return { x: (sx - W / 2) / S.zoom + S.cam.x, y: (sy - H / 2) / S.zoom + S.cam.y }; }
function pat(name, scale, ox = 0, oy = 0) {
  if (!IMG[name]) return '#140c34';
  if (!PAT[name]) PAT[name] = ctx.createPattern(IMG[name], 'repeat');
  PAT[name].setTransform(new DOMMatrix().translate(ox, oy).scale(scale)); return PAT[name];
}
function glow(x, y, r, color, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
function shadow(x, y, r) { ctx.fillStyle = 'rgba(4,2,16,0.45)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, 6.283); ctx.fill(); }
function sprite(name, x, y, h, o = {}) {
  const im = IMG[name]; if (!im) { glow(x, y - h / 2, h / 2, '#6a4cff'); return; }
  const w = h * (im.width / im.height) * (o.sx || 1); const hh = h * (o.sy || 1);
  ctx.save(); ctx.translate(x, y - (o.lift || 0)); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.drawImage(im, -w / 2, -hh, w, hh);
  if (o.flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(im, -w / 2, -hh, w, hh); }
  ctx.restore();
}

function drawRoadGround(vx0, vy0, vx1, vy1) {
  const t = S.t;
  for (const z of ZONES) { const y0 = Math.max(z.y0, vy0), y1 = Math.min(z.y1, vy1); if (y1 <= y0) continue; ctx.fillStyle = z.base === 'clouds' ? pat('clouds', 0.6, t * 9, t * 4) : pat('moss', 0.5); ctx.fillRect(vx0, y0, vx1 - vx0, y1 - y0); }
  if (vy1 > RIVER.y && vy0 < RIVER.y + RIVER.h) {
    ctx.fillStyle = pat('river', 0.6, t * 26, Math.sin(t * 0.4) * 14); ctx.fillRect(vx0, RIVER.y, vx1 - vx0, RIVER.h);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 + Math.sin(t * 1.3) * 0.06; ctx.fillStyle = pat('river', 0.9, -t * 40, 0); ctx.fillRect(vx0, RIVER.y, vx1 - vx0, RIVER.h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    for (const y of [RIVER.y, RIVER.y + RIVER.h]) { const g = ctx.createLinearGradient(0, y - 26, 0, y + 26); g.addColorStop(0, 'rgba(10,6,30,0)'); g.addColorStop(0.5, 'rgba(10,6,30,0.75)'); g.addColorStop(1, 'rgba(10,6,30,0)'); ctx.fillStyle = g; ctx.fillRect(vx0, y - 26, vx1 - vx0, 52); }
  }
  ctx.globalAlpha = 0.55; ctx.fillStyle = pat('cobble', 0.42); for (const q of PATHS) ctx.fillRect(q.x, q.y, q.w, q.h); ctx.globalAlpha = 1;
  for (const w of WALK) {
    if (!w.tile || w.y > vy1 || w.y + w.h < vy0) continue;
    ctx.fillStyle = 'rgba(4,2,16,0.6)'; ctx.fillRect(w.x - 14, w.y + 10, w.w + 28, w.h + 14);
    ctx.fillStyle = pat(w.tile, w.tile === 'court' ? 0.55 : 0.45); ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = '#0b0724'; ctx.lineWidth = 10; ctx.strokeRect(w.x, w.y, w.w, w.h); ctx.strokeStyle = 'rgba(140,120,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(w.x + 7, w.y + 7, w.w - 14, w.h - 14);
  }
  if (S.boss && S.boss.active) { ctx.strokeStyle = 'rgba(255,40,40,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(KING.x, KING.y, 250, 0, 6.283); ctx.stroke(); }
}
function drawLairGround() {
  const w = LAIR.walk; ctx.fillStyle = '#05030f'; ctx.fillRect(-2000, -2000, 5000, 5000);
  ctx.fillStyle = '#17102f'; ctx.fillRect(w.x - 40, w.y - 190, w.w + 80, w.h + 250);                 // stone walls
  ctx.fillStyle = pat('cobble', 0.4); ctx.globalAlpha = 0.5; ctx.fillRect(w.x - 20, w.y - 170, w.w + 40, 170); ctx.globalAlpha = 1;
  ctx.fillStyle = pat('wood', 0.45); ctx.fillRect(w.x - 20, w.y, w.w + 40, w.h + 40);
  const g = ctx.createLinearGradient(0, w.y, 0, w.y + 60); g.addColorStop(0, 'rgba(4,2,16,0.7)'); g.addColorStop(1, 'rgba(4,2,16,0)'); ctx.fillStyle = g; ctx.fillRect(w.x - 20, w.y, w.w + 40, 60);
  ctx.fillStyle = '#3a1d5c'; ctx.beginPath(); ctx.ellipse(500, 500, 190, 86, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#c9a34a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(500, 500, 172, 74, 0, 0, 6.283); ctx.stroke(); // rug
  // round window onto the starfield
  ctx.save(); ctx.beginPath(); ctx.arc(630, 150, 46, 0, 6.283); ctx.clip(); ctx.fillStyle = '#0a0630'; ctx.fillRect(580, 100, 100, 100); const r = rng(5); for (let i = 0; i < 26; i++) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(S.t * (0.5 + r()) + i)); ctx.fillStyle = '#fff'; ctx.fillRect(584 + r() * 92, 104 + r() * 92, 2, 2); } ctx.globalAlpha = 1; glow(650, 135, 34, 'rgba(160,120,255,0.8)'); ctx.restore();
  ctx.strokeStyle = '#2a1c58'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(630, 150, 46, 0, 6.283); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(584, 150); ctx.lineTo(676, 150); ctx.moveTo(630, 104); ctx.lineTo(630, 196); ctx.stroke();
  if (S.won) { ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.arc(500, 62, 24, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#5a4a8a'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#241a3a'; ctx.beginPath(); ctx.ellipse(500, 62, 14, 7, 0, 0, 6.283); ctx.fill(); }
}

function drawEntity(o) {
  const t = S.t;
  if (o.kind === 'decor') {
    const d = o.d;
    if (d.way !== undefined) { sprite('waystone', d.x, d.y, d.h); if (S.lit[d.way]) { ctx.globalCompositeOperation = 'lighter'; glow(d.x, d.y - d.h * 0.55, 90, 'rgba(140,200,255,0.55)', 0.7 + Math.sin(t * 3) * 0.2); ctx.globalCompositeOperation = 'source-over'; } return; }
    if (d.r || d.idle) shadow(d.x, d.y, (d.h || 100) * 0.3);
    sprite(d.img, d.x, d.y, d.h, d.idle ? { sy: 1 + Math.sin(t * 2) * 0.012 } : {});
    ctx.globalCompositeOperation = 'lighter';
    if (d.glow) glow(d.x, d.y - d.h * d.gy, d.h * 0.55, d.glow, 0.35 + Math.sin(t * 2 + d.x) * 0.12);
    if (d.id === 'hearth') glow(d.x, d.y - 40, 330, 'rgba(255,140,50,0.5)', 0.55 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04);
    if (d.id === 'cauldron') glow(d.x, d.y - 70, 90, 'rgba(170,90,255,0.6)', 0.6 + Math.sin(t * 4) * 0.15);
    if (d.id === 'tome') glow(d.x, d.y - 95, 70, 'rgba(150,200,255,0.5)', 0.6);
    if (d.lightable && d.lit) glow(d.x, d.y - d.h * 0.72, d.img === 'lantern' ? 130 : 90, 'rgba(255,170,70,0.55)', 0.55 + Math.sin(t * 8 + d.x) * 0.07);
    if (d.fire) glow(d.x, d.y - 36, 280, 'rgba(255,140,50,0.5)', 0.55 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.04);
    if (d.id === 'rune') glow(d.x, d.y - 24, 70, 'rgba(140,200,255,0.55)', 0.6 + Math.sin(t * 2) * 0.2);
    ctx.globalCompositeOperation = 'source-over'; return;
  }
  if (o.kind === 'animal') { const a = o.d; shadow(a.x, a.y, a.h * 0.32); const hop = a.hop > 0 ? Math.sin(a.hop * Math.PI) * 14 : 0; sprite(a.img, a.x, a.y, a.h, { flip: a.face < 0, lift: hop, sy: 1 + Math.sin(t * 2 + a.x) * 0.015 }); return; }
  if (o.kind === 'dog') {
    const d = o.d; const sit = d.idle > 1.2; shadow(d.x, d.y, 26);
    sprite('dog', d.x, d.y, 78, { flip: d.face < 0, lift: sit ? 0 : Math.abs(Math.sin(d.walk)) * 6, sy: sit ? 0.94 + Math.sin(t * 3) * 0.01 : 1, rot: sit ? 0 : Math.sin(d.walk) * 0.06 });
    if (d.hearts > 0) { ctx.globalAlpha = Math.min(1, d.hearts); ctx.fillStyle = '#ff7aa8'; ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.fillText('\u2665', d.x + 14, d.y - 86 - (1.5 - d.hearts) * 30); ctx.globalAlpha = 1; }
    return;
  }
  if (o.kind === 'gate') { const a = 1 - S.gate; if (a > 0.02) sprite('gate', 700, GATE_Y + 30 - S.gate * 60, 420, { alpha: a }); return; }
  if (o.kind === 'pickup') { const k = o.d; const y = k.y - 34 + Math.sin(k.t * 3) * 8; ctx.globalCompositeOperation = 'lighter'; glow(k.x, y, 70, 'rgba(180,150,255,0.8)'); ctx.globalCompositeOperation = 'source-over'; ctx.save(); ctx.translate(k.x, y); ctx.rotate(k.t * 1.5); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(9, 0); ctx.lineTo(0, 20); ctx.lineTo(-9, 0); ctx.fill(); ctx.restore(); return; }
  if (o.kind === 'player') {
    const p = o.d; const bob = p.moving ? Math.abs(Math.sin(p.walk)) * 7 : Math.sin(t * 2.4) * 1.5; shadow(p.x, p.y, 28);
    if (p.inv > 0 && p.hp > 0 && Math.floor(t * 24) % 2) ctx.globalAlpha = 0.55;
    sprite('hero', p.x, p.y, 104, { flip: p.face < 0, lift: bob, rot: p.moving ? Math.sin(p.walk) * 0.05 : 0, flash: p.flash > 0, alpha: S.deadT > 0 ? Math.max(0, S.deadT / 2.2) : ctx.globalAlpha }); ctx.globalAlpha = 1;
    if (S.scene === 'road') { ctx.globalCompositeOperation = 'lighter'; glow(p.x + Math.cos(p.aim) * 30, p.y - 44 + Math.sin(p.aim) * 30, 22, 'rgba(180,150,255,0.9)'); ctx.globalCompositeOperation = 'source-over'; }
    return;
  }
  if (o.kind === 'king') {
    const b = S.boss; const a = b.dead ? Math.max(0, b.dieT / 3) : 1; const sway = Math.sin(b.ph * 0.9) * 8; shadow(KING.x, KING.y + 6, 150);
    sprite('king', KING.x + sway, KING.y, KING.h, { alpha: a, flash: b.flash > 0, sy: 1 + Math.sin(b.ph * 1.4) * 0.015 });
    if (!b.dead) { ctx.globalCompositeOperation = 'lighter'; glow(KING.x + sway, KING.y - KING.h * 0.66, 120 + b.phase * 30, 'rgba(255,30,30,0.7)', 0.5 + Math.sin(t * 5) * 0.15); ctx.globalCompositeOperation = 'source-over'; }
    return;
  }
  const e = o.d; const d = ET[e.type];
  if (e.type === 'wisp') { const y = e.y - 34 + Math.sin(e.ph * 4) * 6; ctx.globalCompositeOperation = 'lighter'; glow(e.x, y, 46, 'rgba(255,40,40,0.9)'); ctx.fillStyle = '#ffd0c0'; ctx.fillRect(e.x - 3, y - 15, 6, 30); ctx.fillRect(e.x - 11, y - 7, 22, 6); ctx.globalCompositeOperation = 'source-over'; return; }
  const hover = d.hover ? d.hover + Math.sin(e.ph * 3) * 6 : 0; const walk = d.fly ? 0 : Math.abs(Math.sin(e.ph * 6)) * 5;
  shadow(e.x, e.y, e.r * 1.2);
  const wind = e.st === 'wind' || e.st === 'warn';
  sprite(d.img, e.x + (wind ? Math.sin(t * 60) * 3 : 0), e.y, d.h, { flip: e.face < 0, lift: hover + walk, flash: e.flash > 0 || (wind && Math.floor(t * 14) % 2), rot: e.type === 'moth' ? Math.sin(e.ph * 9) * 0.08 : e.st === 'dash' ? e.face * 0.2 : 0, sx: e.type === 'moth' ? 1 + Math.sin(e.ph * 22) * 0.12 : 1 });
  if (d.elite) { const w = 90; ctx.fillStyle = 'rgba(7,5,26,0.8)'; ctx.fillRect(e.x - w / 2, e.y - d.h - hover - 16, w, 6); ctx.fillStyle = '#ff3a3a'; ctx.fillRect(e.x - w / 2, e.y - d.h - hover - 16, w * clamp(e.hp / e.max, 0, 1), 6); }
}

function drawBeam(ox, oy, ang, len, half, a) {
  ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, -half * 2, 0, half * 2); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(0.5, `rgba(255,70,70,${a})`); g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, -half * 2, len, half * 4); ctx.fillStyle = `rgba(255,235,235,${a})`; ctx.fillRect(0, -half * 0.3, len, half * 0.6); ctx.restore();
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#07051a'; ctx.fillRect(0, 0, W, H);
  if (S.scene === 'chamber') { drawChamber(); return; }
  if (!S.p || (S.scene !== 'lair' && S.scene !== 'road' && S.scene !== 'vale' && S.scene !== 'end')) return;
  const p = S.p; const lair = S.scene === 'lair'; const vale = S.scene === 'vale'; const cam = S.cam;
  const hw = W / 2 / S.zoom, hh = H / 2 / S.zoom;
  const tx = lair ? 500 : vale ? (hw * 2 > VALE.w ? VALE.w / 2 : clamp(p.x, hw, VALE.w - hw)) : clamp(p.x, 520, 880);
  const ty = lair ? 400 : vale ? (hh * 2 > VALE.h ? VALE.h / 2 : clamp(p.y - 60, hh, VALE.h - hh)) : p.y - 90;
  cam.x = lerp(cam.x, tx, 0.12); cam.y = lerp(cam.y, ty, 0.12); cam.shake *= 0.86;
  const shx = (Math.random() - 0.5) * cam.shake, shy = (Math.random() - 0.5) * cam.shake;
  const z = S.zoom; ctx.translate(W / 2 + shx, H / 2 + shy); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / z - 20, vx1 = cam.x + W / 2 / z + 20, vy0 = cam.y - H / 2 / z - 20, vy1 = cam.y + H / 2 / z + 20;
  if (lair) drawLairGround(); else if (vale) drawValeGround(vx0, vy0, vx1, vy1); else drawRoadGround(vx0, vy0, vx1, vy1);

  // ground decals: telegraphs
  for (const m of S.marks) { ctx.strokeStyle = 'rgba(255,200,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.stroke(); ctx.fillStyle = 'rgba(255,120,255,0.25)'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1 - m.t), 0, 6.283); ctx.fill(); }
  for (const e of S.enemies) {
    if (e.type === 'knight' && e.st === 'wind') { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang); ctx.fillStyle = 'rgba(255,50,50,0.28)'; ctx.fillRect(0, -30, 400, 60); ctx.restore(); }
    if (e.type === 'wraith' && e.st === 'wind') { ctx.fillStyle = 'rgba(255,60,140,0.25)'; ctx.strokeStyle = 'rgba(255,120,180,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, 165, 0, 6.283); ctx.fill(); ctx.stroke(); }
    if (e.type === 'thrall' && e.st === 'wind') { ctx.fillStyle = 'rgba(255,60,60,0.22)'; ctx.beginPath(); ctx.arc(e.x, e.y, 80, 0, 6.283); ctx.fill(); }
  }

  // y-sorted world
  const list = [];
  for (const d of S.decor) if (d.y > vy0 - 40 && d.y < vy1 + 420) list.push({ kind: 'decor', y: d.y, d });
  if (vale) for (const a of ANIMALS) list.push({ kind: 'animal', y: a.y, d: a });
  if (S.dog && (S.dog.mode === 'follow' || vale)) list.push({ kind: 'dog', y: S.dog.y, d: S.dog });
  if (S.scene === 'road') { list.push({ kind: 'gate', y: GATE_Y + 30 }); for (const k of S.pickups) list.push({ kind: 'pickup', y: k.y, d: k }); for (const e of S.enemies) list.push({ kind: 'enemy', y: e.y, d: e }); if (S.boss) list.push({ kind: 'king', y: KING.y }); }
  list.push({ kind: 'player', y: p.y, d: p });
  list.sort((a, b) => a.y - b.y); for (const o of list) drawEntity(o);

  // beams, shots, particles (additive)
  for (const e of S.enemies) if (e.type === 'sentinel') { if (e.st === 'warn') drawBeam(e.x, e.y - 20 - 50, e.ang, 760, 5, 0.5); if (e.st === 'beam') drawBeam(e.x, e.y - 20, e.ang, 760, 26, 0.9); }
  const b = S.boss; if (b && b.active && !b.dead && b.phase === 3) drawBeam(KING.x, KING.y - 60, b.beam, 1300, 24, 0.9);
  ctx.globalCompositeOperation = 'lighter';
  for (const s of S.shots) { glow(s.x, s.y, s.r * 3.2, s.color); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.45, 0, 6.283); ctx.fill(); }
  for (const q of S.parts) { const a = clamp(q.life / q.max, 0, 1); ctx.globalAlpha = a; if (q.ring) { ctx.strokeStyle = q.color; ctx.lineWidth = 6 * a + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - a * 0.7), 0, 6.283); ctx.stroke(); } else { ctx.fillStyle = q.color; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); } }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // screen space: drifting star motes and vignette
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (vale) { // falling leaves in Emberfall, snow in the Winterwood
    const warm = clamp((p.y - VALE.split + 150) / 300, 0, 1); const r = rng(13);
    for (let i = 0; i < 70; i++) { const spd = 20 + r() * 40, sw = r() * 6.28, sz = 2 + r() * 4; const x = (((r() * W + S.t * (10 + r() * 20) + Math.sin(S.t * 0.8 + sw) * 30) % W) + W) % W; const y = (((r() * H + S.t * spd) % H) + H) % H; const leaf = r() < warm;
      if (leaf) { ctx.fillStyle = ['#ff7a2a', '#ffb02a', '#c8381a', '#ffd27a'][i % 4]; ctx.globalAlpha = 0.85 * warm; ctx.save(); ctx.translate(x, y); ctx.rotate(S.t * (1 + (i % 3)) + i); ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66); ctx.restore(); }
      else { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.75 * (1 - warm); ctx.beginPath(); ctx.arc(x, y, sz * 0.4, 0, 6.283); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  if (!lair && !vale) { const r = rng(9); ctx.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { const sx = (r() * W + cam.x * -0.25 * (0.4 + r())) % W; const sy = (r() * H - cam.y * 0.25 * (0.4 + r()) + 90000) % H; ctx.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(S.t * (0.6 + r()) + i)); const s = 1 + r() * 2; ctx.fillRect((sx + W) % W, sy, s, s); } ctx.globalAlpha = 1; }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(7,5,26,0)'); v.addColorStop(1, lair ? 'rgba(7,5,26,0.92)' : vale ? 'rgba(14,8,28,0.72)' : 'rgba(7,5,26,0.78)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  if (p.flash > 0) { ctx.fillStyle = `rgba(255,0,40,${p.flash * 0.7})`; ctx.fillRect(0, 0, W, H); }
}

function hud() {
  if (!S.p) return; const p = S.p;
  $('hp').style.width = (p.hp / P.hp) * 100 + '%'; $('flask').textContent = 'FLASK ' + p.flasks;
  $('cdNova').style.height = (p.novaT / P.novaCd) * 100 + '%'; $('cdBlink').style.height = (p.blinkT / P.blinkCd) * 100 + '%';
  $('shardText').textContent = `SHARDS ${S.shards} / 3`; document.querySelectorAll('#shards b').forEach((el, i) => el.classList.toggle('on', i < S.shards));
  const m = Math.floor(S.runTime / 60), s = Math.floor(S.runTime % 60); $('clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('prompt').textContent = S.dialog || S.paused ? '' : S.prompt || '';
  document.querySelectorAll('#spells span').forEach((el, i) => el.classList.toggle('on', i === S.spell));
  if (S.boss) $('bossHp').style.width = (S.boss.hp / KING.hp) * 100 + '%';
  if (DEV) $('dev').textContent = `fps ${S.fps | 0}  ents ${S.enemies.length}  shots ${S.shots.length}  parts ${S.parts.length}\npos ${p.x | 0},${p.y | 0}  scene ${S.scene}`;
}

// ── loop (fixed 60 Hz simulation, render every frame) ──────────────────────
let last = 0, acc = 0; const STEP = 1 / 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now; acc += dt; S.fps = lerp(S.fps || 60, 1 / (dt || STEP), 0.05);
  while (acc >= STEP) { update(STEP); for (const k in pressed) delete pressed[k]; acc -= STEP; }
  render(); hud(); requestAnimationFrame(frame);
}

// ── boot ───────────────────────────────────────────────────────────────────
$('btnBegin').addEventListener('click', () => { Sound.init(); Sound.play('page', 0.6); transition(() => { $('menu').classList.add('hidden'); enterLair(); }); });
$('btnResume').addEventListener('click', () => setPause(false));
$('btnAgain').addEventListener('click', () => transition(() => { $('ending').classList.add('hidden'); enterLair(); }));
addEventListener('pointerdown', () => { if (S.scene === 'menu' && !Music.el) Music.play('title', true); }, { once: true });
addEventListener('keydown', () => { if (S.scene === 'menu' && !Music.slot) Music.play('title', true); }, { once: true });
if (DEV) {
  $('dev').classList.remove('hidden');
  S.dev = { Tube, Music, render, enterLair, enterChamber, enterVale, freezePond, VALE, ANIMALS, enterRoad, spawn, win, hurtKing, tp(y, shards) { S.p.y = y; S.p.x = 700; if (shards !== undefined) S.shards = shards; }, step(n = 1) { for (let i = 0; i < n; i++) update(STEP); } };
}
resize();
Promise.all([loadImages(), Music.load()]).then(() => { S.ready = true; requestAnimationFrame(frame); });
