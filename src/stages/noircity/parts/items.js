import * as THREE from 'three';
import { lathe } from '../../../world/geom.js';
import { KINDS, RESPAWN, ONCE, spotKey, newsOf, money, rounds, roundsLine, pockets } from '../../../world/items.js';
import { vhash } from '../../../world/streets.js';

// NOIR CITY's items (lane O1b, brief §3; the rules: world/items.js). The
// spots the generator laid (C.itemSpots) and the guns men drop, each drawn
// when the eye is near; looked at within reach, the kit's prompt `E  take`
// with its tick at the thing; E takes it on the press: what it is and its
// count said low in the frame, the thing flying to the hand in 0.2 s, my feet
// never held. A taken thing is back after RESPAWN s where nobody is looking.
// The paper at a newsstand stays: E shows its front page - the city's own
// news of what I did last (news.say) - a few seconds, walking on.
//   api (stage.part('items')): { list, drop(kind, x, z, opts), glovebox(car), target, taken: [{ kind, t, said }], paper }
// [O1b] after the critic (B1: the box of rounds and the bottle unseen at 4 m,
// the cash a two-pixel glint; walking at them with a man's gaze the prompt
// never came): each thing has a paper-white part that prints in the dark (a
// roll's band, the box's label, the bottle's label and its highlight, the
// matchbook) and a GLINT - a four-pointed white star that flashes on it every
// couple of seconds, seen within GLINT_R - and it is 'looked at' by where it
// lies in front of my feet, not by the eye's line: within REACH (on the
// ground), in a corridor that widens ahead, anywhere from the frame's middle
// down to just under its bottom edge (a thing at my feet as I walk on it).
const SHOW = 48, HIDE = 58, REACH = 2.8, GLINT_R = 24, VHALF = 0.593;
// the usable things of the pavement (the critic's M4: a phone booth and a
// mailbox looked usable and answered nothing): E at them, a sound and a line
const USE = {
  booth: { prompt: 'use the phone', sound: 'c5_phoneDead', line: 'a nickel in, a dial tone  -  nobody to call', y: 1.3 },
  mailbox: { prompt: 'try the mailbox', sound: 'tail_click', line: 'u.s. mail  -  last collection 6 a.m.', y: 0.9 },
};

function geos() {
  const G = {};
  // (a part's [geo, grey, emissive, white]: white parts print paper white in the dark - the item's tell)
  // a roll of bills, its paper band (a third bigger than life: a thing to find)
  G.cash = [[new THREE.CylinderGeometry(0.05, 0.05, 0.17, 12).rotateZ(Math.PI / 2).translate(0, 0.05, 0), 0xa8a8a8, 0x202020], [new THREE.CylinderGeometry(0.053, 0.053, 0.05, 12).rotateZ(Math.PI / 2).translate(0, 0.05, 0), 0xffffff, 0, true]];
  // a box of rounds: pale card, a white label round it, its lid dark
  G.rounds = [[new THREE.BoxGeometry(0.19, 0.095, 0.13).translate(0, 0.048, 0), 0x9a9a9a, 0x1c1c1c], [new THREE.BoxGeometry(0.192, 0.04, 0.132).translate(0, 0.05, 0), 0xffffff, 0, true], [new THREE.BoxGeometry(0.194, 0.018, 0.134).translate(0, 0.096, 0), 0x2a2a2a, 0]];
  // a revolver lying on its side, a Tommy gun
  G.revolver = [[new THREE.BoxGeometry(0.2, 0.03, 0.035).translate(0.08, 0.02, 0), 0x151515, 0x111111], [new THREE.BoxGeometry(0.06, 0.03, 0.12).rotateY(0.3).translate(-0.06, 0.02, 0.05), 0x151515, 0x111111], [new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8).rotateX(Math.PI / 2).translate(0.0, 0.025, 0), 0x202020, 0]];
  G.tommy = [[new THREE.BoxGeometry(0.62, 0.04, 0.05).translate(0.1, 0.025, 0), 0x151515, 0x111111], [new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14).translate(0.05, 0.03, 0.07), 0x151515, 0], [new THREE.BoxGeometry(0.22, 0.05, 0.06).translate(-0.3, 0.03, 0), 0x2a2a2a, 0]];
  // a bottle (lying or standing): dark glass, a white label, a highlight down its side
  G.bottle = [[lathe([[0.001, 0], [0.046, 0], [0.048, 0.195], [0.034, 0.24], [0.016, 0.29], [0.017, 0.335], [0.001, 0.345]], 10), 0x3a3a3a, 0x080808],
    [new THREE.CylinderGeometry(0.0495, 0.0495, 0.08, 10, 1, true).translate(0, 0.1, 0), 0xffffff, 0, true],
    [new THREE.BoxGeometry(0.012, 0.13, 0.01).translate(0.02, 0.17, 0.043), 0xffffff, 0, true]];
  // a matchbook (paper white, its strike strip dark)
  G.matchbook = [[new THREE.BoxGeometry(0.1, 0.018, 0.068).translate(0, 0.009, 0), 0xffffff, 0, true], [new THREE.BoxGeometry(0.102, 0.019, 0.016).translate(0, 0.01, 0.022), 0x151515, 0]];
  // a fold of papers on the stand's ledge
  G.paper = [[new THREE.BoxGeometry(0.42, 0.05, 0.3).rotateX(-0.25), 0xbdbdbd, 0x2e2e2e]];
  return G;
}
// the glint: a four-pointed star (two long thin diamonds), faced to the eye
function glintGeo() {
  const s = new THREE.Shape();
  const P = [[0, 1], [0.13, 0.13], [1, 0], [0.13, -0.13], [0, -1], [-0.13, -0.13], [-1, 0], [-0.13, 0.13]];
  s.moveTo(P[0][0], P[0][1]); for (const [x, y] of P.slice(1)) s.lineTo(x, y); s.lineTo(P[0][0], P[0][1]);
  return new THREE.ShapeGeometry(s);
}

export default {
  name: 'items', order: 64, tick: 33,
  build(stage) {
    const { scene } = stage;
    const city = stage.part('city'), C = city.C;
    const group = new THREE.Group();
    group.name = 'items';
    scene.add(group);
    const GE = geos();
    const parts = {};
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const [k, list] of Object.entries(GE)) parts[k] = list.map(([g, c, e, w]) => ({ g, m: w ? white : new THREE.MeshStandardMaterial({ color: c, emissive: e, roughness: k === 'bottle' ? 0.15 : 0.6, metalness: k === 'revolver' || k === 'tommy' ? 0.5 : 0, envMap: stage.M.envSoft, envMapIntensity: 0.5 }) }));
    const idBase = city.idFor('7,7', 60);
    const kinds = Object.keys(GE);
    const GLINT = glintGeo();
    const meshOf = (it) => {
      const k = it.kind === 'weapon' ? it.gun : it.kind;
      const o = new THREE.Group();
      for (const p of parts[k] || parts.cash) { const m = new THREE.Mesh(p.g, p.m); m.userData.noRay = true; m.userData.inkId = idBase + kinds.indexOf(k); o.add(m); }
      o.position.set(it.x, it.y, it.z);
      o.rotation.y = it.yaw || 0;
      if (it.kind === 'bottle' && vhash(it.x, it.z, 3) < 0.5) o.rotation.z = Math.PI / 2, o.position.y += 0.05;
      if (it.kind === 'paper') o.position.y = it.y + 0.15;
      // (its glint: in the world, not under the thing's turn)
      if (it.kind !== 'paper') {
        const g = new THREE.Mesh(GLINT, white);
        g.userData.noRay = true; g.userData.inkId = idBase + 20; g.visible = false;
        it.glint = g; group.add(g);
      }
      return o;
    };
    const unGlint = (it) => { if (it.glint) { group.remove(it.glint); it.glint = null; } };
    // the items: every spot, and what is dropped
    const list = (C.itemSpots || []).map((s, i) => ({ ...s, n: i, taken: false, t: 0, mesh: null }));
    // the pavement's usable things (a booth, a mailbox), bucketed as the items are
    const uses = [], ub = new Map();
    for (const r of C.dress || []) if (USE[r.kind]) { uses.push(r); const k = Math.floor(r.x / 16) * 8192 + Math.floor(r.z / 16); if (!ub.has(k)) ub.set(k, []); ub.get(k).push(r); }
    const usesNear = (x, z) => { const out = []; for (let i = Math.floor((x - 4) / 16); i <= Math.floor((x + 4) / 16); i++) for (let j = Math.floor((z - 4) / 16); j <= Math.floor((z + 4) / 16); j++) for (const r of ub.get(i * 8192 + j) || []) out.push(r); return out; };
    const B = 16, buckets = new Map();
    const bk = (x, z) => Math.floor(x / B) * 8192 + Math.floor(z / B);
    const index = (it) => { const k = bk(it.x, it.z); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); };
    for (const it of list) index(it);
    const nearList = (x, z, r) => { const out = []; for (let i = Math.floor((x - r) / B); i <= Math.floor((x + r) / B); i++) for (let j = Math.floor((z - r) / B); j <= Math.floor((z + r) / B); j++) for (const it of buckets.get(i * 8192 + j) || []) out.push(it); return out; };
    const shown = new Set(), flying = [];
    const _f = new THREE.Vector3(), _p = new THREE.Vector3();
    const of = (C.itemSpots || []).filter((s) => s.kind === 'matchbook').length;
    for (const it of list) if (it.kind === 'matchbook') it.of = of;
    // ---- the paper's front page (a card on the HUD, a few seconds) ------------------------------
    let paperEl = null, paperT = 0;
    const showPaper = (G, line) => {
      const root = G.hud && G.hud.root;
      if (!root) return;
      if (!paperEl) {
        paperEl = document.createElement('div');
        paperEl.id = 'o1bpaper';
        paperEl.style.cssText = 'position:absolute;left:50%;top:14%;transform:translateX(-50%) rotate(-1.2deg);width:340px;padding:10px 16px 12px;background:#d2d2d0;color:#111;box-shadow:0 0 0 1px #222,6px 8px 0 rgba(0,0,0,0.55);font-family:"Didot","Georgia",serif;text-align:center;opacity:0;transition:opacity 0.25s;pointer-events:none;z-index:6';
        paperEl.innerHTML = '<div style="font-size:26px;font-weight:700;letter-spacing:0.04em;border-bottom:3px double #111;padding-bottom:2px">THE EVENING STAR</div><div class="ed" style="font-size:9px;letter-spacing:0.3em;margin:3px 0 6px;font-family:Futura,sans-serif">LATE CITY EDITION &middot; THREE CENTS</div><div class="hl" style="font-family:Impact,\'Arial Black\',sans-serif;font-size:30px;line-height:1.02;text-transform:uppercase"></div>';
        root.appendChild(paperEl);
      }
      paperEl.querySelector('.hl').textContent = line;
      paperEl.style.opacity = '1';
      paperT = 4.2;
    };
    // ---- [O1b] Tab: what I carry, for a moment (the rulebook's Tab: 'the heat and
    // the money for a moment' - the critic's M5: the money and the matchbooks
    // were said once and then shown nowhere). O7's HUD takes it over; the heat is O3's.
    let pocketEl = null, pocketT = 0;
    const showPockets = (G) => {
      const root = G.hud && G.hud.root;
      if (!root) return;
      if (!pocketEl) {
        pocketEl = document.createElement('div');
        pocketEl.id = 'o1bpockets';
        pocketEl.style.cssText = 'position:absolute;right:26px;top:22px;min-width:170px;padding:8px 14px 9px;background:rgba(8,8,8,0.82);color:#ddd;box-shadow:0 0 0 1px #555;font-family:Futura,"Helvetica Neue",sans-serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;opacity:0;transition:opacity 0.2s;pointer-events:none;z-index:6;line-height:1.75';
        root.appendChild(pocketEl);
      }
      pocketEl.innerHTML = pockets(G).map(([k, v]) => (k === '$' ? `<div style="font-size:20px;letter-spacing:0.08em;color:#f2f2f2">$ ${v}</div>` : `<div><span style="color:#888">${k}</span>&nbsp;&nbsp;${v}</div>`)).join('');
      pocketEl.style.opacity = '1';
      pocketT = 3.2;
    };
    // the street's name at a point (the news says where)
    const streetName = (x, z) => { const S = city.graph.streetAt(x, z); return S && S.d < 40 ? S.edge.name : 'THE CITY'; };
    let bound = false;
    const bind = (G) => {
      bound = true;
      const N = newsOf(G);
      // (what was found once a save stays found: [O1b] after the critic, the cheat of the endless alley)
      const T = G.save.flags.o1bTaken || (G.save.flags.o1bTaken = {});
      for (const it of list) if (ONCE[it.kind] && T[spotKey(it)]) { it.taken = true; it.gone = true; }
      // the city's events into the news (O3's police feed it too: news.say)
      G.on('hood:down', (e) => {
        const h = e && e.hood;
        if (!h || !h.pos || G.stage !== stage) return;
        N.say(`MAN SHOT DEAD ON ${streetName(h.pos.x, h.pos.z)}`, 3, { x: h.pos.x, z: h.pos.z });
        // his gun lies where he fell
        const gun = h.gunKind === 'tommy' || h.gunKind === 'rusher' ? 'tommy' : 'revolver';
        const d = e.dir || null;
        api.drop('weapon', h.pos.x + (d ? d.x * 0.6 : 0.4), h.pos.z + (d ? d.z * 0.6 : 0.2), { gun });
      });
      G.on('car:exploded', (e) => { if (e && e.at && G.stage === stage) N.say(`CAR BURNS ON ${streetName(e.at.x, e.at.z)}`, 2, { x: e.at.x, z: e.at.z }); });
      G.on('shot', () => { if (G.stage !== stage) return; const last = N.lines[N.lines.length - 1]; if (last && G.time - last.t < 45) return; N.say(`SHOTS FIRED ON ${streetName(G.eye.x, G.eye.z)}`, 1, { x: G.eye.x, z: G.eye.z }); });
      G.on('smash', (e) => { if (!e || !e.pos || e.by !== 'car' || G.stage !== stage) return; const last = N.lines[N.lines.length - 1]; if (last && G.time - last.t < 30) return; N.say(`CAR RUNS WILD ON ${streetName(e.pos.x, e.pos.z)}`, 1, { x: e.pos.x, z: e.pos.z }); });
      G.on('city:in', (e) => api.glovebox(e && e.car));
    };
    const api = {
      group, list, shown, uses, glintAt: null, target: null, taken: [], used: [], pockets: () => (pocketEl && pocketEl.style.opacity === '1' ? pocketEl.textContent : null), paper: () => (paperEl && paperEl.style.opacity === '1' ? paperEl.querySelector('.hl').textContent : null),
      // a thing put down at a place (a gun where a man fell): { kind, gun?, x, z }
      drop(kind, x, z, opts = {}) {
        const y = stage.surfaceY ? stage.surfaceY(x, z) : 0.15;
        const it = { kind, x, y: y + 0.005, z, yaw: vhash(x, z, 9) * 6.28, n: list.length, taken: false, t: 0, mesh: null, dropped: true, born: stage.game ? stage.game.time : 0, ...opts };
        list.push(it); index(it);
        return it;
      },
      // a car taken: what is in its glovebox (once a car): a police car's box of rounds, a roll of cash in one car in three
      glovebox(car) {
        const G = stage.game;
        if (!car || car._glove || !G) return null;
        car._glove = true;
        const police = car.kind === 'police' || car.police || (car.spec && car.spec.kind === 'police');
        const h = vhash(car.pos.x, car.pos.z, car.id || 1);
        let said = null;
        if (police) said = 'in the glovebox: ' + roundsLine(G, 12, rounds(G, 12));
        else if (h < 0.34) { const n = 8 + Math.floor(h * 90); said = `$${n} in the glovebox  -  $${money(G, n)}`; }
        if (said) { setTimeout(() => G.hud.message(said, 2.6), 650); this.taken.push({ kind: police ? 'rounds' : 'cash', t: G.time, said, glovebox: true }); }
        return said;
      },
      update(dt, t, camera) {
        const G = stage.game;
        if (!G) return;
        if (!bound) bind(G);
        const p = camera.position;
        // what is near is drawn; what is far is not
        for (const it of nearList(p.x, p.z, SHOW)) {
          if (it.taken || it.mesh) continue;
          if (Math.hypot(it.x - p.x, it.z - p.z) > SHOW) continue;
          it.mesh = meshOf(it); group.add(it.mesh); shown.add(it);
        }
        for (const it of [...shown]) {
          if (it.flying) continue;
          if (it.taken || Math.hypot(it.x - p.x, it.z - p.z) > HIDE) { group.remove(it.mesh); it.mesh = null; unGlint(it); shown.delete(it); }
        }
        // the taken come back where nobody looks; the dropped go when long left
        camera.getWorldDirection(_f);
        for (const it of list) {
          if (!it.taken || it.dropped || it.gone || ONCE[it.kind] || it.kind === 'paper') continue;
          it.t += dt;
          if (it.t < RESPAWN) continue;
          const dx = it.x - p.x, dz = it.z - p.z, d = Math.hypot(dx, dz);
          if (d > 30 && (dx * _f.x + dz * _f.z) / d < 0.3) { it.taken = false; it.t = 0; }
        }
        // the take: 0.2 s to the hand, then gone
        for (let i = flying.length - 1; i >= 0; i--) {
          const f = flying[i];
          f.k += dt / 0.2;
          const m = f.it.mesh;
          if (!m) { flying.splice(i, 1); continue; }
          _p.copy(camera.position).addScaledVector(_f, 0.35); _p.y -= 0.35;
          m.position.lerpVectors(f.from, _p, Math.min(1, f.k));
          m.scale.setScalar(Math.max(0.01, 1 - f.k * 0.85));
          if (f.k >= 1) { f.it.flying = false; group.remove(m); f.it.mesh = null; unGlint(f.it); shown.delete(f.it); flying.splice(i, 1); }
        }
        if (paperT > 0) { paperT -= dt; if (paperT <= 0 && paperEl) paperEl.style.opacity = '0'; }
        if (pocketT > 0) { pocketT -= dt; if (pocketT <= 0 && pocketEl) pocketEl.style.opacity = '0'; }
        if (G.pressed('Tab') && G.state === 'playing' && !(G.night && G.night.inCity)) showPockets(G);   // [O7] (the night's Tab shows the pockets with the heat and the money)
        // the glints: a flash every couple of seconds on each thing near enough, kept a
        // dozen pixels across at any distance; never on the thing I am looking at
        for (const it of shown) {
          const g = it.glint;
          if (!g) continue;
          const d = Math.hypot(it.x - p.x, it.y - p.y, it.z - p.z);
          const ph = this.glintAt != null ? this.glintAt : (t + vhash(it.x, it.z, 41) * 2.2) % 2.2;
          const on = !it.taken && !it.flying && it !== this.target && d < GLINT_R && ph < 0.5;
          g.visible = on;
          if (!on) continue;
          const k = Math.sin((ph / 0.5) * Math.PI);
          g.position.set(it.x, it.y + (it.kind === 'bottle' ? 0.26 : 0.14), it.z);
          g.quaternion.copy(camera.quaternion);
          g.rotateZ(ph * 0.9);
          g.scale.setScalar(Math.max(0.1, d * 0.024) * (0.3 + 0.7 * k));
        }
        // the one looked at, within reach (on foot, playing)
        const hud = G.hud;
        const ok = G.state === 'playing' && !G.failing && !(G.city && G.city.inCar) && (!G.controller.mode || G.controller.mode === 'walk');
        // (where a thing lies in front of my feet: ahead, in a corridor that widens
        // as it goes, from the frame's middle down to just under its bottom edge)
        const fl = Math.max(1e-3, Math.hypot(_f.x, _f.z)), fx = _f.x / fl, fz = _f.z / fl, pitch = Math.asin(Math.max(-1, Math.min(1, _f.y)));
        const lookAt = (x, y, z, reach) => {
          const dx = x - p.x, dz = z - p.z, fwd = dx * fx + dz * fz, lat = dx * fz - dz * fx, dh = Math.hypot(dx, dz);
          if (dh > reach || fwd < -0.1 || Math.abs(lat) > 0.6 + Math.max(0, fwd) * 0.5) return -1;
          const below = Math.atan2(p.y - y, Math.max(fwd, 0.05)) + pitch;
          if (below < -0.6 || below > (dh < 1.6 ? 1.05 : VHALF + 0.06)) return -1;
          return Math.abs(lat) / (Math.max(0, fwd) + 0.3) + 0.15 * dh;
        };
        let best = null, bs = Infinity;
        if (ok) for (const it of shown) {
          if (it.taken || it.flying) continue;
          const sc = lookAt(it.x, it.y + 0.05, it.z, it.kind === 'paper' ? 2.4 : REACH);
          if (sc >= 0 && sc < bs) { bs = sc; best = it; }
        }
        // (a booth or a mailbox nearer the middle than any thing: its own prompt)
        let use = null;
        if (ok) for (const r of usesNear(p.x, p.z)) {
          const sm = stage.smash && stage.smash.itemOf ? stage.smash.itemOf(r) : null;
          if (sm && sm.state && sm.state !== 'stand') continue;
          const sc = lookAt(r.x, USE[r.kind].y + 0.15, r.z, 2.4 + (r.r ?? Math.max(r.hx || 0, r.hz || 0)));
          if (sc >= 0 && sc < bs) { bs = sc; use = r; best = null; }
        }
        const free = !hud.promptOwner || hud.promptOwner === 'item' || hud.el.prompt.style.display === 'none';
        if (best && !free) best = null;
        if (use && !free) use = null;
        const tick = (x, y, z) => { const sp = G.screenOf(_p.set(x, y, z)); if (sp) sp.y = Math.min(sp.y, innerHeight - 70); return sp; };
        if (use) {
          if (this.target && hud.promptOwner === 'item') hud.clearPrompt('item');
          this.target = use;
          const U = USE[use.kind];
          hud.prompt(`E  ${U.prompt}`, tick(use.x, U.y, use.z), 'item');
          if (G.pressed('KeyE')) {
            G.keysDown.delete('KeyE'); G.vin.down.delete('KeyE');
            G.sfx.play(U.sound, new THREE.Vector3(use.x, U.y, use.z));
            hud.message(U.line, 2.6);
            G.emit('city:use', { kind: use.kind, rec: use });
            this.used.push({ kind: use.kind, t: G.time, said: U.line });
          }
          return;
        }
        if (best !== this.target) { if (this.target && hud.promptOwner === 'item') hud.clearPrompt('item'); this.target = best; }
        if (!best) return;
        hud.prompt(`E  ${KINDS[best.kind].prompt}`, tick(best.x, best.y + 0.08, best.z), 'item');
        if (G.pressed('KeyE')) {
          // (the press is the take's: the car's door or a street door does not get it too)
          G.keysDown.delete('KeyE'); G.vin.down.delete('KeyE');
          const K = KINDS[best.kind];
          const said = K.take(G, best);
          G.sfx.play(K.sound, new THREE.Vector3(best.x, best.y, best.z));
          G.emit('item:take', { kind: best.kind, item: best, said });
          this.taken.push({ kind: best.kind, t: G.time, said, place: best.place || null });
          if (best.kind === 'paper') showPaper(G, newsOf(G).latest());
          else {
            best.taken = true; best.t = 0; best.flying = true;
            if (ONCE[best.kind] && !best.dropped) { best.gone = true; (G.save.flags.o1bTaken || (G.save.flags.o1bTaken = {}))[spotKey(best)] = 1; }   // [O5b] (BEGIN's new flags have none yet: a TypeError at the first matchbook taken)
            if (best.glint) best.glint.visible = false;
            flying.push({ it: best, k: 0, from: best.mesh.position.clone() });
            if (said) hud.message(said, 3.0);
          }
          hud.clearPrompt('item');
          this.target = null;
        }
      },
    };
    return api;
  },
  update: (s, dt, t, camera) => s.update(dt, t, camera),
};
