// The raven's trades: shiny things for useful things.
import { $, Sound } from './audio.js';
import { UI, STR } from './ui.js';
import { World, toW } from './world.js';
import { Crew } from './crew.js';

let G;
const GOODS = [
  { id: 'oil', name: 'Lantern oil', desc: 'Lights every lantern and pumpkin in Emberfall at once.', cost: { stone: 1, acorn: 2 }, once: false, act: () => { World.lightAll(); UI.toast(STR.oil, 3.5); } },
  { id: 'treats', name: 'Dog treats', desc: 'Marigold learns a trick. Hold SHIFT and press E near her to see it.', cost: { acorn: 3 }, once: true, act: () => { if (Crew.members.dog) Crew.members.dog.treats = true; UI.toast(STR.treats, 3.5); } },
  { id: 'hat', name: 'A new hat', desc: 'Pointed, with real stars on it. Your staff crystal glows brighter.', cost: { button: 1, feather: 1 }, once: true, act: () => { G.flags.hat = true; UI.toast(STR.hat, 3.5); } },
  { id: 'globe', name: 'Snow globe', desc: 'Your own tower inside glass. It goes on the mantel and snows forever.', cost: { crystal: 1, stone: 1 }, once: true, act: () => { G.flags.globe = true; UI.toast(STR.globe, 3.5); } },
];
const canPay = (cost) => Object.entries(cost).every(([k, n]) => (G.inv[k] || 0) >= n);
const label = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${STR.shinies[k].replace(/^an? /, '')}${n > 1 ? 's' : ''}`).join(' + ');

export const Shop = {
  init(g) { G = g; const [x, z] = toW(540, 1690); World.interact.push({ pos: new (G.THREE.Vector3)(x, World.terrainHeight(x, z), z), r: 3, prompt: STR.pShop, act: () => this.open(), cond: () => G.keys.ShiftLeft || Object.values(G.inv).some((n) => n > 0) }); },
  open() { G.shopOpen = true; $('shop').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); this.render(); Sound.play('raven', 0.5); },
  close() { G.shopOpen = false; $('shop').classList.add('hidden'); $('c').requestPointerLock(); },
  render() {
    const have = Object.entries(G.inv).filter(([, n]) => n > 0).map(([k, n]) => `${n} × ${STR.shinies[k].replace(/^an? /, '')}`).join(', ');
    $('shopHave').textContent = have ? `Your pockets: ${have}` : 'Your pockets are empty. Shiny things are lying around the Vale.';
    const box = $('shopItems'); box.innerHTML = '';
    for (const g of GOODS) { const bought = g.once && G.flags['bought_' + g.id]; const row = document.createElement('div'); row.className = 'item';
      const txt = document.createElement('div'); txt.innerHTML = `<b></b><small></small>`; txt.firstChild.textContent = g.name; txt.lastChild.textContent = bought ? 'Already traded.' : `${g.desc} Costs ${label(g.cost)}.`;
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = bought ? 'DONE' : 'TRADE'; btn.disabled = bought || !canPay(g.cost);
      btn.addEventListener('click', () => { if (!canPay(g.cost)) return; for (const [k, n] of Object.entries(g.cost)) G.inv[k] -= n; if (g.once) G.flags['bought_' + g.id] = true; Sound.play('shard', 0.8); g.act(); this.render(); });
      row.append(txt, btn); box.append(row); }
  },
  update() {},
};
