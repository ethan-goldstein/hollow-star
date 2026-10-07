// Audio for the 3D game: the same Sound / Music / Tube objects the 2D game uses.
const QS = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('hollowstar:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('hollowstar:' + k, JSON.stringify(v)); } catch { /* private mode */ } } };
const SOUNDS = ['bolt', 'nova', 'blink', 'flask', 'hit', 'death', 'shard', 'gate', 'hurt', 'roar', 'hearth', 'door', 'page', 'night', 'snore',
  'bark', 'pant', 'fox', 'owl', 'stag', 'cat', 'raven', 'wind', 'autumn', 'ember', 'frost', 'freeze',
  'step_grass', 'step_snow', 'step_wood', 'step_stone', 'step_ice', 'snowball', 'stick', 'bell', 'campfire', 'aurora', 'tea', 'lantern_lift', 'bubble', 'howl', 'crows', 'giggle', 'pages', 'spring', 'breath', 'fetch', 'sit', 'chatter', 'mug', 'eat', 'chair', 'screen', 'hoof', 'coffee', 'door', 'cheer', 'rain', 'splash', 'tug', 'shutter'];const TRACKS = [{ id: 'W2o_HupXq1g', name: 'Golden Brown' }, { id: 'bWMqgnrZL7U', name: 'Space II' }, { id: 'MAbSVYjobOc', name: 'Yamaha (slowed)' }];
const STREAM = { title: 2, loading: 2, lair: 1, chamber: 0, vale: 1, winter: 0 };
// the three spells on keys 1-3; Nova stays on the right mouse button
// ── audio ──────────────────────────────────────────────────────────────────
const Sound = {
  ctx: null, buf: {}, muted: QS.has('mute') || store.get('mute', false), loops: {},
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.55; this.out.connect(this.ctx.destination);
    for (const n of SOUNDS) fetch(`assets/sfx/${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => this.ctx.decodeAudioData(b)).then((d) => { this.buf[n] = d; if (this.wantLoop === n) this.loop(n, this.wantVol); }).catch(() => {});
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

/* Music comes from the player's own files, listed in assets/music/music.json.
   Any slot with no file is simply silent. */
const Music = {
  man: {}, el: null, slot: null, lairIdx: store.get('lairIdx', 0), vol: 0.4,
  load() { return fetch('assets/music/music.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((m) => { this.man = m || {}; }).catch(() => {}); },
  url(slot) {
    const m = this.man;
    if (slot === 'chamber' && m.chamber) return m.chamber;
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
    const a = new Audio('assets/music/' + encodeURIComponent(f)); a.loop = slot !== 'victory' && slot !== 'loading'; a.volume = Sound.muted ? 0 : this.vol;
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


export { Sound, Music, Tube, TRACKS, STREAM, SOUNDS, store, $, QS };
