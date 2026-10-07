// HUD, dialog, prompts and all player-visible copy for the 3D game.
import { $, Sound } from './audio.js';

export const STR = {
  keeper: ['THE GRAVEKEEPER', "The King's eyes have burned for a thousand nights. Three shards of the fallen star will open his gate. Bring him the dark."],
  tome: ['THE QUEST TOME', 'Three shards of the fallen star will open his gate. Bring him the dark. The road begins past the village gate.'],
  tomeDone: ['THE QUEST TOME', 'The eyes are dark. The road is quiet. Walk it again whenever you wish.'],
  rune: ['THE FROST RUNE', 'Water sleeps when the third finger speaks. The pond listens.'],
  gate: (n) => `The gate hungers. Shards: ${n} / 3`,
  waystone: 'Waystone lit', shard: 'A shard of the fallen star', frozen: 'The pond freezes over. You could walk across it.', allLit: 'Every lantern in Emberfall is lit.',
  boxEmpty: 'The music box is silent for now.', boxPlay: (n) => `The music box plays: ${n}`,
  pTalk: 'E - Talk', pTalkTo: (who) => `E - Talk to ${who}`, pShard: 'E - Take shard', pTome: 'E - Read the quest', pBox: 'E - Change song', pBed: 'E - Lie down',
  pDoorOut: 'E - Step outside', pDoorIn: 'E - Go inside', pStairsUp: 'E - Climb to the bedchamber', pStairsDown: 'E - Go back down', pRoad: 'E - Walk the Vesper Road',
  pRune: 'E - Read the rune', pDig: 'E - Dig here', pShop: 'E - Trade with the raven', pShiny: (n) => `E - Pick up ${n}`, pTrophy: 'E - Look at the eye',
  pCall: (n) => `E - Call ${n} over`, pStay: (n) => `E - ${n}, stay here`, pCome: (n) => `E - ${n}, come along`, pPet: (n) => `E - Pet ${n}`, pTrick: 'E - Ask for the trick',
  joined: (n) => `${n} bounds over, tail going like a windmill. ${n === 'Marigold' ? 'She' : 'He'} is coming with you.`,
  stay: (n) => `${n} flops down and watches you go.`, come: (n) => `${n} springs up. Finally.`,
  petDog: ['Marigold leans her whole weight into your leg.', 'Marigold rolls over. This was clearly the plan all along.', 'Marigold sneezes and looks pleased about it.', 'Marigold brings you a stick. It is a very good stick.'],
  petFox: ['The fox allows exactly three seconds of this.', 'The fox pretends not to enjoy it. The tail says otherwise.', 'The fox steals a glove. You get it back. Mostly.'],
  trick: 'Marigold sits, spins, and bows. The whole village should have seen that.', trickLocked: 'Marigold tilts her head. She would do a trick for a treat.',
  rest: 'You are not tired. The road is waiting.', trophy: 'His eye hangs dark above the hearth. It does not blink anymore.',
  dug: 'A smooth river stone with a star scratched into it. The fox was right.', dugAgain: 'Just roots and cold earth now.',
  sleep: 'You pull the blanket up. The canopy swims. The lanterns outside flicker and keep watch.', wake: 'Dawn. Frost on the window, smoke from the hearth. A new day in the Vale.',
  wolves: 'Yellow eyes at the tree line. The wolves are watching, not coming. Not yet.', wolvesGone: 'The wolves melt back into the pines.',
  oil: 'You pour lantern oil into the night. Every lantern in Emberfall flares awake.', treats: 'Marigold has learned a trick. Ask her when she is near.',
  hat: 'A new hat. Pointed, naturally. The stars on it are real.', globe: 'A snow globe of your own tower. You set it on the mantel. It snows inside, forever.',
  zoneVale: 'EMBERFALL', zoneWinter: 'THE WINTERWOOD', zoneLair: 'THE TOWER', zoneChamber: 'THE BEDCHAMBER',
  shinies: { stone: 'a river stone', acorn: 'a golden acorn', button: 'a lost brass button', crystal: 'a frost crystal', feather: 'an owl feather', fish: 'a silver pondfish' },
  frostStag: 'Frost rimes the antlers. A crystal drops into the snow. The stag does not seem to mind.',
  pSit: 'E - Sit by the fire', pSpring: 'E - Soak in the hot spring', pLore: 'E - Read the carved page', pGiveFeathers: 'E - Give the owl three feathers', pGiveAcorn: 'E - Offer the hare an acorn', pBrew: 'E - Brew something', pJournal: 'J - Journal',
  sitFire: 'You sit. The fire does the talking. Time slips by faster here. (E to stand)', sitSpring: 'The water is hot enough to hurt and then it is perfect. (E to climb out)',
  fetched: 'Marigold drops the stick at your feet and looks at you like you invented sticks.', snowmanHit: 'The snowman wobbles and giggles. It is a strange wood.',
  festival: 'Every lantern in Emberfall is lit. Paper lanterns lift from the rooftops and drift north, toward the stars.', aurora: 'Green light ripples over the pines. The Winterwood remembers the sky.',
  midnight: 'The shrine bell tolls once. Midnight in the Vale.', owlThanks: 'Three feathers. Who would have thought. Take the night eye: the dark will show you its small things now.',
  hareFollows: 'The hare takes the acorn and decides, provisionally, that you are a friend.', hareLeaves: 'The hare remembers it has somewhere to be.',
};

export const UI = {
  toastT: 0, dialog: null, prompt: '',
  toast(msg, secs = 2.6) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); this.toastT = secs; },
  banner(msg) { const z = $('zone'); z.textContent = msg; z.classList.add('show'); clearTimeout(this.bt); this.bt = setTimeout(() => z.classList.remove('show'), 2800); },
  say(who, text) { this.dialog = { who, text }; $('dlgWho').textContent = who; $('dlgText').textContent = text; $('dialog').classList.remove('hidden'); Sound.play('page', 0.8); },
  closeDialog() { this.dialog = null; $('dialog').classList.add('hidden'); },
  update(dt, G) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('show'); }
    const p = G.player;
    $('hp').style.width = (p.hp / p.maxHp) * 100 + '%'; $('flask').textContent = 'FLASK ' + p.flasks;
    $('cdNova').style.height = (p.novaT / p.novaCd) * 100 + '%'; $('cdBlink').style.height = (p.blinkT / p.blinkCd) * 100 + '%';
    document.querySelectorAll('#spells span').forEach((el, i) => el.classList.toggle('on', i === p.spell));
    $('prompt').textContent = this.dialog || G.paused || G.shopOpen ? '' : this.prompt || '';
    const h = Math.floor(G.clock * 24), m = Math.floor((G.clock * 24 - h) * 60);
    $('clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}  ·  DAY ${G.day}`;
    const inv = Object.entries(G.inv).filter(([, n]) => n > 0).map(([k, n]) => `${STR.shinies[k] ? STR.shinies[k].replace(/^an? /, '') : k} ×${n}`);
    const b = G.flags.buffs || {}; if (b.coffee === G.day) inv.push('coffee'); if (b.fed === G.day) inv.push('warm belly'); if (b.blessed === G.day) inv.push('blessed');
    $('inv').textContent = inv.join('  ·  ');
    $('shards').classList.toggle('hidden', G.area !== 'road');
    if (G.area === 'road') { $('shardText').textContent = `SHARDS ${G.road.shards} / 3`; document.querySelectorAll('#shards b').forEach((el, i) => el.classList.toggle('on', i < G.road.shards)); }
    if (G.road && G.road.boss) $('bossHp').style.width = (G.road.boss.hp / G.road.boss.maxHp) * 100 + '%';
    $('lockhint').classList.toggle('hidden', G.locked || G.paused || !!this.dialog || G.shopOpen || G.scene !== 'play');
  },
};
