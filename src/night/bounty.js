import * as THREE from 'three';
import { RNG } from '../util/rng.js';
import { frayEdges, blob } from '../ui/inkArt.js';
import { LETTER_FONT } from '../ui/lettering.js';
import { tagInk, allocInkId } from '../render/layers.js';
import { DISTRICTS } from '../world/plan.js';

// The bounty board (lane O7, docs/seams/NIGHT.md §5) by the police
// headquarters' door: three names a night, each with a photo and the
// district under it, and nothing else - no arrow, no count, no line. E at
// the board: the card (the game held while it is read; E or ESC puts it
// away). A man on the board stands on a corner of his turf (O3's gang man
// when O3 merges; until then a figure of the base's cast with the photo's
// look, put on his corner as I come within 110 m); taken down (a fight, or
// a shot), his poster is crossed, and E at the board pays it ($ at the
// desk: O5's when the station's room merges).
export const BOUNTY = { reach: 2.2, near: 110, far: 220, rewards: [150, 250, 400] };
const FIRST = ['Sal', 'Vito', 'Eddie', 'Lou', 'Frankie', 'Mickey', 'Nate', 'Joey', 'Carmine', 'Duke', 'Rocco', 'Benny'];
const LAST = ['Moretti', 'Kane', 'Doyle', 'Russo', 'Malloy', 'Brandt', 'Costa', 'Quinn', 'Falco', 'Ricci', 'Shea', 'Varga'];
const NICK = ['the Knife', 'Two-Bits', 'the Ox', 'Lucky', 'the Priest', 'Spats', 'the Weasel', 'Blue'];
const TURF = ['docks', 'tenements'];

export class Bounty {
  constructor(night) {
    this.night = night;
    this.open = false;
    this.list = null;
    this.men = new Map();
    this.prompted = false;
    this.paid = 0;
    const G = night.game;
    G.on('night:start', () => { this.list = null; for (const h of this.men.values()) this.drop(h); this.men.clear(); });
    G.on('scene:enter', () => { this.men.clear(); this.boardMesh = null; this.place = null; });
  }
  get G() { return this.night.game; }

  // three names for this night (seeded by the night: the same three until
  // the night is begun again), kept in the save
  names() {
    const G = this.G;
    if (this.list) return this.list;
    if (G.save.bounty && Array.isArray(G.save.bounty.list)) { this.list = G.save.bounty.list; return this.list; }
    const g = this.night.graph();
    const seed = (G.save.flags.nightSeed = G.save.flags.nightSeed || (1 + Math.floor(Math.random() * 1e6)));
    const rng = new RNG(seed);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const turf = TURF[(seed + i) % 2];
      const D = DISTRICTS.find((d) => d.id === turf);
      const nodes = g ? [...g.pnodes.values()].filter((n) => { const [a, b, c, e] = D.rect; return n.x > a + 20 && n.x < Math.min(b, 440) - 20 && n.z > c + 20 && n.z < Math.min(e, 440) - 20; }) : [];
      const n = nodes.length ? nodes[Math.floor(rng.next() * nodes.length)] : { x: turf === 'docks' ? -60 : 260, z: turf === 'docks' ? 300 : 0 };
      out.push({
        id: 'b' + i, seed: Math.floor(rng.next() * 1e6),
        name: `${FIRST[Math.floor(rng.next() * FIRST.length)]} "${NICK[Math.floor(rng.next() * NICK.length)]}" ${LAST[Math.floor(rng.next() * LAST.length)]}`,
        district: D.name, turf, x: +n.x.toFixed(1), z: +n.z.toFixed(1), reward: BOUNTY.rewards[i], state: 'out',
      });
    }
    this.list = out;
    G.save.bounty = { list: out };
    return out;
  }

  // the board by the headquarters' door (built once the city is entered)
  board() {
    if (this.place) return this.place;
    const G = this.G, P = G.stage.part && G.stage.part('places');
    const door = P && P.doors && P.doors.find((d) => d.place === 'police');
    if (!door) return null;
    const tx = -door.nz, tz = door.nx;
    const x = door.x + tx * 3.2 + door.nx * 0.35, z = door.z + tz * 3.2 + door.nz * 0.35;
    this.place = { x, z, nx: door.nx, nz: door.nz, standX: x + door.nx * 1.3, standZ: z + door.nz * 1.3 };
    // a board on two posts, three notices pinned to it
    const M = G.stage.M;
    const grp = new THREE.Group();
    const wood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 0.08), M.wood || M.iron);
    wood.position.set(0, 1.55, 0);
    grp.add(wood);
    for (const sx of [-0.62, 0.62]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 0.08), M.iron); post.position.set(sx, 1.05, -0.02); grp.add(post); }
    const paper = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.42) });
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), paper); p.position.set(-0.45 + i * 0.45, 1.55 + (i === 1 ? 0.04 : -0.02), 0.045); p.rotation.z = (i - 1) * 0.04; grp.add(p); }
    grp.position.set(x, 0, z);
    grp.rotation.y = Math.atan2(door.nx, door.nz);
    tagInk(grp, allocInkId(1));
    G.stage.scene.add(grp);
    this.boardMesh = grp;
    return this.place;
  }

  step(dt) {
    const N = this.night, G = this.G;
    if (!N.inCity || G.failing || N.el.riding) { if (this.prompted) this.prompt(false); return; }
    const L = this.names();
    // the men on their corners: put there as I come near, taken away far off
    const e = G.eye;
    for (const b of L) {
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      let h = this.men.get(b.id);
      if (b.state === 'out' && !h && d < BOUNTY.near) h = this.spawn(b);
      if (h && h.alive === false && b.state === 'out') { b.state = 'down'; G.emit('bounty:down', { id: b.id, name: b.name }); if (G.news) G.news.say(`${b.name.replace(/"[^"]*" /, '')} TAKEN DOWN IN ${b.district}`); }
      if (h && d > BOUNTY.far) { this.drop(h); this.men.delete(b.id); }
    }
    const R = G.city;
    if (R && R.inCar) { if (this.prompted) this.prompt(false); return; }
    const B = this.board();
    if (!B) return;
    const p = G.controller.pos;
    const near = Math.hypot(p.x - B.standX, p.z - B.standZ) < BOUNTY.reach;
    const owed = L.filter((b) => b.state === 'down');
    this.prompt(near, owed.length ? `E  collect  $${owed.reduce((a, b) => a + b.reward, 0)}` : 'E  the wanted board');
    if (near && G.keysDown.has('KeyE')) { G.keysDown.delete('KeyE'); this.use(); }
  }

  prompt(on, text) {
    const H = this.G.hud;
    if (on && (!this.prompted || H.promptShown !== text)) H.prompt(text, null, 'nbounty');
    else if (!on && this.prompted) H.clearPrompt('nbounty');
    this.prompted = on;
  }

  spawn(b) {
    const G = this.G;
    const r = new RNG(b.seed);
    const h = G.spawnHood(b.x, b.z, { ai: false, variant: { coat: Math.floor(r.next() * 3), brim: Math.floor(r.next() * 2), tall: Math.floor(r.next() * 2), cig: r.next() < 0.5 }, state: 'idle' });
    h.bountyId = b.id;
    this.men.set(b.id, h);
    return h;
  }
  drop(h) { try { if (h.alive !== false) this.G.removeHood(h); } catch (e) { /* gone with the stage */ } }

  use() {
    const G = this.G, L = this.names();
    const owed = L.filter((b) => b.state === 'down');
    if (owed.length) {
      const sum = owed.reduce((a, b) => a + b.reward, 0);
      for (const b of owed) b.state = 'paid';
      this.paid += sum;
      G.save.money += sum;
    }
    this.openCard();
  }

  // ---- the card -----------------------------------------------------------------------
  openCard() {
    const G = this.G, H = G.hud;
    if (!this.el) {
      const st = document.createElement('style');
      st.textContent = `
        #nbounty { position: fixed; inset: 0; z-index: 18; display: none; align-items: center; justify-content: center; flex-direction: column; background: rgba(4,4,4,0.66); pointer-events: none; }
        #nbounty.up { display: flex; }
        #nbounty h2 { margin: 0 0 18px; font-family: "Bodoni 72", Didot, Georgia, serif; font-size: min(5vw, 64px); color: #f2f0ea; letter-spacing: 0.08em; transform: scaleX(0.82); text-shadow: 0 0 12px #000; }
        #nbounty .row { display: flex; gap: 2.4vw; }
        #nbounty .hint { margin-top: 22px; font-family: "American Typewriter", "Courier New", monospace; font-size: 12px; letter-spacing: 0.4em; color: #cfccc5; text-transform: uppercase; text-shadow: 0 0 4px #000; }
      `;
      document.head.appendChild(st);
      this.el = document.createElement('div');
      this.el.id = 'nbounty';
      document.body.appendChild(this.el);
    }
    this.el.innerHTML = '<h2>WANTED</h2><div class="row"></div><div class="hint">E  put it back</div>';
    const row = this.el.querySelector('.row');
    for (const b of this.names()) row.appendChild(poster(b));
    this.el.classList.add('up');
    this.open = true;
    this.night.holding = true;
    H.root.classList.add('titled');
    if (G.sfx) G.sfx.play('n_paper', null, {}, { send: false });
  }
  closeCard() {
    if (!this.open) return;
    this.open = false;
    this.night.holding = false;
    this.G.keysDown.clear();
    this.el.classList.remove('up');
    this.G.hud.retitle();
    if (this.G.sfx) this.G.sfx.play('n_paper', null, { k: 0.6 }, { send: false });
  }
  // per rendered frame: E (or the pause card) puts it away
  frame() {
    if (!this.open) return;
    const G = this.G;
    if (G.keysDown.has('KeyE') || G.keysDown.has('Escape') || G.hud.paused) { G.keysDown.delete('KeyE'); this.closeCard(); }
  }
}

// a wanted poster: the photo (a man under his hat brim, in ink), the name,
// the district, the reward; crossed through when he is down, PAID when paid
function poster(b) {
  const c = document.createElement('canvas');
  const w = 210, h = 300;
  c.width = w * 2; c.height = h * 2;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const g = c.getContext('2d');
  g.scale(2, 2);
  const rng = new RNG(b.seed);
  g.fillStyle = '#e4e0d6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rng.next() * 0.05})`; g.fillRect(rng.next() * w, rng.next() * h, 1 + rng.next() * 3, 1); }
  // the photo: grey ground, the man
  const px = 18, py = 18, pw = w - 36, ph = 170;
  g.fillStyle = '#8c8a85'; g.fillRect(px, py, pw, ph);
  const cx = px + pw / 2 + rng.gauss() * 5, top = py + 30 + rng.next() * 12;
  // each man his own: the jaw, the shoulders, the hat's tilt and brim, the tie or the bow, the moustache, the scar, the cigarette
  const jaw = 18 + rng.next() * 8, long = 26 + rng.next() * 8, sh = 60 + rng.next() * 22, tilt = rng.gauss() * 0.12;
  const brim = 40 + rng.next() * 20, crown = 20 + rng.next() * 7, collarUp = rng.next() < 0.4;
  g.fillStyle = '#0a0a0a';
  // the coat's shoulders and collar
  g.beginPath(); g.moveTo(px, py + ph); g.quadraticCurveTo(cx - sh, top + 92, cx - 28, top + 86); g.lineTo(cx + 28, top + 86); g.quadraticCurveTo(cx + sh, top + 92, px + pw, py + ph); g.closePath(); g.fill();
  if (collarUp) { g.beginPath(); g.moveTo(cx - 34, top + 92); g.lineTo(cx - 22, top + 62); g.lineTo(cx - 12, top + 92); g.closePath(); g.fill(); g.beginPath(); g.moveTo(cx + 34, top + 92); g.lineTo(cx + 22, top + 62); g.lineTo(cx + 12, top + 92); g.closePath(); g.fill(); }
  // the face: a pale shape mostly lost in the brim's shadow
  g.fillStyle = '#b9b5ad'; g.beginPath(); g.ellipse(cx, top + 58, jaw, long, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#141414'; g.beginPath(); g.ellipse(cx, top + 44, jaw + 4, 15 + rng.next() * 5, 0, 0, Math.PI * 2); g.fill();
  // the hat: crown and brim, tilted his way
  g.save(); g.translate(cx, top + 30); g.rotate(tilt);
  g.fillStyle = '#060606';
  g.beginPath(); g.ellipse(0, 0, brim, 8 + rng.next() * 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-crown, 0); g.quadraticCurveTo(-crown + 1, -34, 0, -31); g.quadraticCurveTo(crown - 1, -34, crown, 0); g.closePath(); g.fill();
  g.fillStyle = '#2c2c2c'; g.fillRect(-crown, -7, crown * 2, 4);
  g.restore();
  // the tie or the bow; the mouth; a moustache, a scar, a cigarette, now and then
  g.fillStyle = '#e4e0d6';
  if (rng.next() < 0.3) { g.beginPath(); g.moveTo(cx - 12, top + 86); g.lineTo(cx, top + 92); g.lineTo(cx - 12, top + 98); g.closePath(); g.moveTo(cx + 12, top + 86); g.lineTo(cx, top + 92); g.lineTo(cx + 12, top + 98); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(cx - 6, top + 88); g.lineTo(cx + 6, top + 88); g.lineTo(cx, top + 120); g.closePath(); g.fill(); }
  g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, top + 74); g.lineTo(cx + 8, top + 75 + rng.gauss()); g.stroke();
  if (rng.next() < 0.45) { g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(cx, top + 69, 10, 3, 0, 0, Math.PI * 2); g.fill(); }
  if (rng.next() < 0.5) { g.strokeStyle = '#f0ece4'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 9, top + 76); g.lineTo(cx + 26, top + 80); g.stroke(); }
  if (rng.next() < 0.4) { g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 14, top + 56); g.lineTo(cx - 6, top + 68); g.stroke(); }
  g.strokeStyle = '#0a0a0a'; g.lineWidth = 3; g.strokeRect(px, py, pw, ph);
  // the words
  g.fillStyle = '#080808'; g.textAlign = 'center';
  g.font = `700 15px ${LETTER_FONT}`; g.fillText(b.name.toUpperCase(), w / 2, py + ph + 26, w - 20);
  g.font = `600 12px ${LETTER_FONT}`; g.fillText(`SEEN IN ${b.district}`, w / 2, py + ph + 46);
  g.font = `700 22px ${LETTER_FONT}`; g.fillText(`$${b.reward}`, w / 2, py + ph + 80);
  frayEdges(c, [228, 224, 214], new RNG(b.seed + 3), 60);
  if (b.state !== 'out') {
    g.strokeStyle = '#060606'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(16, 24); g.lineTo(w - 16, h - 30); g.stroke();
    blob(g, 18, 26, 6, rng, 0.2);
    if (b.state === 'paid') { g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.25); g.font = `800 40px ${LETTER_FONT}`; g.lineWidth = 6; g.strokeStyle = '#e4e0d6'; g.strokeText('PAID', 0, 0); g.fillStyle = '#060606'; g.fillText('PAID', 0, 0); g.restore(); }
  }
  return c;
}
