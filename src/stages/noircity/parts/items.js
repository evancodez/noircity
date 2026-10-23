import * as THREE from 'three';
import { lathe } from '../../../world/geom.js';
import { KINDS, RESPAWN, newsOf, money, rounds } from '../../../world/items.js';
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
const SHOW = 48, HIDE = 58, REACH = 2.7, CONE = 0.55;

function geos() {
  const G = {};
  // a roll of bills, its band
  G.cash = [[new THREE.CylinderGeometry(0.038, 0.038, 0.13, 12).rotateZ(Math.PI / 2).translate(0, 0.038, 0), 0xb8b8b8, 0x2a2a2a], [new THREE.CylinderGeometry(0.041, 0.041, 0.03, 12).rotateZ(Math.PI / 2).translate(0, 0.038, 0), 0x202020, 0]];
  // a box of rounds
  G.rounds = [[new THREE.BoxGeometry(0.15, 0.075, 0.1).translate(0, 0.038, 0), 0x8c8c8c, 0x1c1c1c], [new THREE.BoxGeometry(0.152, 0.02, 0.102).translate(0, 0.06, 0), 0x2a2a2a, 0]];
  // a revolver lying on its side, a Tommy gun
  G.revolver = [[new THREE.BoxGeometry(0.2, 0.03, 0.035).translate(0.08, 0.02, 0), 0x151515, 0x111111], [new THREE.BoxGeometry(0.06, 0.03, 0.12).rotateY(0.3).translate(-0.06, 0.02, 0.05), 0x151515, 0x111111], [new THREE.CylinderGeometry(0.022, 0.022, 0.04, 8).rotateX(Math.PI / 2).translate(0.0, 0.025, 0), 0x202020, 0]];
  G.tommy = [[new THREE.BoxGeometry(0.62, 0.04, 0.05).translate(0.1, 0.025, 0), 0x151515, 0x111111], [new THREE.CylinderGeometry(0.08, 0.08, 0.05, 14).translate(0.05, 0.03, 0.07), 0x151515, 0], [new THREE.BoxGeometry(0.22, 0.05, 0.06).translate(-0.3, 0.03, 0), 0x2a2a2a, 0]];
  // a bottle (lying or standing)
  G.bottle = [[lathe([[0.001, 0], [0.04, 0], [0.042, 0.17], [0.03, 0.21], [0.014, 0.25], [0.015, 0.29], [0.001, 0.3]], 10), 0x3a3a3a, 0x080808]];
  // a matchbook
  G.matchbook = [[new THREE.BoxGeometry(0.075, 0.014, 0.05).translate(0, 0.007, 0), 0xd0d0d0, 0x3a3a3a], [new THREE.BoxGeometry(0.077, 0.015, 0.012).translate(0, 0.008, 0.016), 0x151515, 0]];
  // a fold of papers on the stand's ledge
  G.paper = [[new THREE.BoxGeometry(0.42, 0.05, 0.3).rotateX(-0.25), 0xbdbdbd, 0x2e2e2e]];
  return G;
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
    for (const [k, list] of Object.entries(GE)) parts[k] = list.map(([g, c, e]) => ({ g, m: new THREE.MeshStandardMaterial({ color: c, emissive: e, roughness: k === 'bottle' ? 0.15 : 0.6, metalness: k === 'revolver' || k === 'tommy' ? 0.5 : 0, envMap: stage.M.envSoft, envMapIntensity: 0.5 }) }));
    const idBase = city.idFor('7,7', 60);
    const kinds = Object.keys(GE);
    const meshOf = (it) => {
      const k = it.kind === 'weapon' ? it.gun : it.kind;
      const o = new THREE.Group();
      for (const p of parts[k] || parts.cash) { const m = new THREE.Mesh(p.g, p.m); m.userData.noRay = true; m.userData.inkId = idBase + kinds.indexOf(k); o.add(m); }
      o.position.set(it.x, it.y, it.z);
      o.rotation.y = it.yaw || 0;
      if (it.kind === 'bottle' && vhash(it.x, it.z, 3) < 0.5) o.rotation.z = Math.PI / 2, o.position.y += 0.04;
      if (it.kind === 'paper') o.position.y = it.y + 0.15;
      return o;
    };
    // the items: every spot, and what is dropped
    const list = (C.itemSpots || []).map((s, i) => ({ ...s, n: i, taken: false, t: 0, mesh: null }));
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
    // the street's name at a point (the news says where)
    const streetName = (x, z) => { const S = city.graph.streetAt(x, z); return S && S.d < 40 ? S.edge.name : 'THE CITY'; };
    let bound = false;
    const bind = (G) => {
      bound = true;
      const N = newsOf(G);
      // the city's events into the news (O3's police feed it too: news.say)
      G.on('hood:down', (e) => {
        const h = e && e.hood;
        if (!h || !h.pos || G.stage !== stage) return;
        N.say(`MAN SHOT DEAD ON ${streetName(h.pos.x, h.pos.z)}`, { x: h.pos.x, z: h.pos.z });
        // his gun lies where he fell
        const gun = h.gunKind === 'tommy' || h.gunKind === 'rusher' ? 'tommy' : 'revolver';
        const d = e.dir || null;
        api.drop('weapon', h.pos.x + (d ? d.x * 0.6 : 0.4), h.pos.z + (d ? d.z * 0.6 : 0.2), { gun });
      });
      G.on('car:exploded', (e) => { if (e && e.at && G.stage === stage) N.say(`CAR BURNS ON ${streetName(e.at.x, e.at.z)}`, { x: e.at.x, z: e.at.z }); });
      G.on('shot', () => { if (G.stage !== stage) return; const last = N.lines[N.lines.length - 1]; if (last && G.time - last.t < 45) return; N.say(`SHOTS FIRED ON ${streetName(G.eye.x, G.eye.z)}`, { x: G.eye.x, z: G.eye.z }); });
      G.on('smash', (e) => { if (!e || !e.pos || e.by !== 'car' || G.stage !== stage) return; const last = N.lines[N.lines.length - 1]; if (last && G.time - last.t < 30) return; N.say(`CAR RUNS WILD ON ${streetName(e.pos.x, e.pos.z)}`, { x: e.pos.x, z: e.pos.z }); });
      G.on('city:in', (e) => api.glovebox(e && e.car));
    };
    const api = {
      group, list, shown, target: null, taken: [], paper: () => (paperEl && paperEl.style.opacity === '1' ? paperEl.querySelector('.hl').textContent : null),
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
        if (police) said = `a box of rounds in the glovebox  -  ${rounds(G, 12)} in the pocket`;
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
          if (it.taken || Math.hypot(it.x - p.x, it.z - p.z) > HIDE) { group.remove(it.mesh); it.mesh = null; shown.delete(it); }
        }
        // the taken come back where nobody looks; the dropped go when long left
        camera.getWorldDirection(_f);
        for (const it of list) {
          if (!it.taken || it.dropped || it.kind === 'paper') continue;
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
          if (f.k >= 1) { f.it.flying = false; group.remove(m); f.it.mesh = null; shown.delete(f.it); flying.splice(i, 1); }
        }
        if (paperT > 0) { paperT -= dt; if (paperT <= 0 && paperEl) paperEl.style.opacity = '0'; }
        // the one looked at, within reach (on foot, playing)
        const hud = G.hud;
        const ok = G.state === 'playing' && !G.failing && !(G.city && G.city.inCar) && (!G.controller.mode || G.controller.mode === 'walk');
        let best = null, bs = CONE;
        if (ok) for (const it of shown) {
          if (it.taken || it.flying) continue;
          const tx = it.x - p.x, ty = it.y + 0.05 - p.y, tz = it.z - p.z, d = Math.hypot(tx, ty, tz);
          if (d > REACH) continue;
          const a = Math.acos(Math.max(-1, Math.min(1, (tx * _f.x + ty * _f.y + tz * _f.z) / Math.max(d, 1e-3))));
          if (a < bs) { bs = a; best = it; }
        }
        const free = !hud.promptOwner || hud.promptOwner === 'item' || hud.el.prompt.style.display === 'none';
        if (best && !free) best = null;
        if (best !== this.target) { if (this.target && hud.promptOwner === 'item') hud.clearPrompt('item'); this.target = best; }
        if (!best) return;
        hud.prompt(`E  ${KINDS[best.kind].prompt}`, G.screenOf(_p.set(best.x, best.y + 0.08, best.z)), 'item');
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
            flying.push({ it: best, k: 0, from: best.mesh.position.clone() });
            if (said) hud.message(said, 2.4);
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
