import * as THREE from 'three';
import { Steam } from '../../../fx/Steam.js';
import { lotWindows, KITS } from '../../../city/kits/facade.js';
import { vhash } from '../../../world/streets.js';
import { OVERPASS } from '../../../world/Overpass.js';
import { PAVE } from '../../../world/plan.js';

// NOIR CITY's small life (lane O1b, brief §2): steam out of the street grates
// and the laundries' vents, pigeons as ink on the ledges that go up when I
// pass (or a shot, or a car tears by), the el's drip under its track. All
// pooled round the eye: the city has hundreds of grates and ledges, the frame
// a few.
//   STEAM   six vents at once (the nearest within 90 m: the bathhouse's and
//           the laundry's pipes, a laundry's transom, one grate in five),
//           34 puffs each (fx/Steam.js), their origins moved as the eye moves
//   PIGEONS six flocks of up to eight on the ledges round the eye (a parapet,
//           a cornice, a sign's top over the pavement); within 8 m on foot, 14
//           m in a car going fast, or a shot within 40 m: up they go, wings
//           beating, away over the roofs; back after a minute, unseen
//   DRIP    under the el, drops off the girders into the wet street (rings)
//   api (stage.part('ambience')): { vents, flocks, steam, flushed (count) }
const N_VENT = 6, PER_VENT = 30, N_FLOCK = 6, PER_FLOCK = 8, N_DRIP = 26;

export default {
  name: 'ambience', order: 66, tick: 34,
  build(stage) {
    const { scene } = stage;
    const C = stage.part('city').C;
    const D = stage.part('dressing');
    // ---- the vents: every candidate in the city ---------------------------------------------------
    const vents = [];
    for (const v of (D && D.vents) || []) vents.push({ x: v.x, y: v.y, z: v.z, k: 1 });
    for (const L of C.lots) {
      if (!L.fc) continue;
      for (const w of lotWindows(L)) if (w.kind === 'shop' && w.trade === 'laundry' && vhash(w.x, w.z, 41) < 0.5) vents.push({ x: w.x + w.nx * 0.4, y: w.y + w.h / 2 + 0.2, z: w.z + w.nz * 0.4, k: 0.7 });
    }
    for (const p of C.props) if (p.kind === 'manhole' && vhash(p.x, p.z, 42) < 0.2) vents.push({ x: p.x, y: 0.02, z: p.z, k: 0.8 });
    const VB = 32, vb = new Map();
    for (const v of vents) { const k = Math.floor(v.x / VB) * 8192 + Math.floor(v.z / VB); if (!vb.has(k)) vb.set(k, []); vb.get(k).push(v); }
    const ventsNear = (x, z, r) => { const out = []; for (let i = Math.floor((x - r) / VB); i <= Math.floor((x + r) / VB); i++) for (let j = Math.floor((z - r) / VB); j <= Math.floor((z + r) / VB); j++) for (const v of vb.get(i * 8192 + j) || []) out.push(v); return out; };
    // the steam's pool: N_VENT slots, their puffs' origins rewritten as the slot moves
    const slots = Array.from({ length: N_VENT }, () => ({ x: 0, y: -80, z: 0 }));
    const steam = new Steam(stage, slots, PER_VENT);
    const org = steam.mesh.geometry.getAttribute('aOrigin');
    const jit = Array.from({ length: N_VENT * PER_VENT }, (_, i) => [((i * 0.618) % 1 - 0.5) * 0.7, ((i * 0.377) % 1 - 0.5) * 0.5]);
    const held = new Array(N_VENT).fill(null);
    const place = (s, v) => {
      held[s] = v;
      for (let k = 0; k < PER_VENT; k++) { const i = s * PER_VENT + k; org.setXYZ(i, v ? v.x + jit[i][0] : 0, v ? v.y : -80, v ? v.z + jit[i][1] : 0); }
      org.needsUpdate = true;
    };
    // ---- the pigeons: the ledges, the flocks ------------------------------------------------------------
    const ledges = [];
    for (const L of C.lots) {
      if (!L.fc || (L.district !== 'tenements' && L.district !== 'downtown' && L.district !== 'docks')) continue;
      const K = KITS[L.district === 'tenements' ? 'tenement' : L.district === 'docks' ? 'docks' : 'downtown'];
      for (const f of L.fc) {
        if (vhash(f.mid[0], f.mid[1], 43) > 0.35 || f.len < 6) continue;
        const ux = (f.b[0] - f.a[0]) / f.len, uz = (f.b[1] - f.a[1]) / f.len;
        // (the parapet's top, or the course over the shops: the ledge a pigeon sits on)
        const low = vhash(f.mid[0], f.mid[1], 44) < 0.5 && K.ground;
        const y = low ? K.ground - 0.15 : (L.tower ? L.h * 0.42 : L.h) + (K.parapet || 0);
        ledges.push({ x: f.mid[0] + f.n[0] * (low ? 0.2 : 0.18), y, z: f.mid[1] + f.n[1] * (low ? 0.2 : 0.18), ux, uz, nx: f.n[0], nz: f.n[1], len: f.len, low, gone: -999 });
      }
    }
    const LB = 48, lb = new Map();
    for (const l of ledges) { const k = Math.floor(l.x / LB) * 8192 + Math.floor(l.z / LB); if (!lb.has(k)) lb.set(k, []); lb.get(k).push(l); }
    const ledgesNear = (x, z, r) => { const out = []; for (let i = Math.floor((x - r) / LB); i <= Math.floor((x + r) / LB); i++) for (let j = Math.floor((z - r) / LB); j <= Math.floor((z + r) / LB); j++) for (const l of lb.get(i * 8192 + j) || []) out.push(l); return out; };
    // a pigeon: a body, a head, a tail, two wings (they beat when it flies)
    const body = new THREE.SphereGeometry(0.11, 8, 6).scale(1.45, 0.85, 0.9).translate(0, 0.1, 0);
    const head = new THREE.SphereGeometry(0.055, 6, 5).translate(0.15, 0.2, 0);
    const tail = new THREE.BoxGeometry(0.12, 0.02, 0.07).translate(-0.17, 0.09, 0);
    const bodyGeo = mergeSimple([body, head, tail]);
    const wingGeo = new THREE.PlaneGeometry(0.16, 0.24).translate(0, 0.12, 0).rotateX(Math.PI / 2);
    const inkMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8, side: THREE.DoubleSide });
    const NB = N_FLOCK * PER_FLOCK;
    const birds = new THREE.InstancedMesh(bodyGeo, inkMat, NB), wings = new THREE.InstancedMesh(wingGeo, inkMat, NB * 2);
    for (const m of [birds, wings]) { m.frustumCulled = false; m.userData.noRay = true; m.userData.inkId = stage.part('city').idFor('9,9', 70); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < NB; i++) birds.setMatrixAt(i, ZERO);
    for (let i = 0; i < NB * 2; i++) wings.setMatrixAt(i, ZERO);
    const flocks = Array.from({ length: N_FLOCK }, (_, i) => ({ i, ledge: null, n: 0, t: 0, up: false, upT: 0, birds: [] }));
    // ---- the el's drip ---------------------------------------------------------------------------------
    const el = stage.part('el');
    const dripGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 3).translate(0, 0.17, 0);
    const dripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(0.5), transparent: true, opacity: 0.7, depthWrite: false });
    const drips = new THREE.InstancedMesh(dripGeo, dripMat, N_DRIP);
    drips.frustumCulled = false; drips.userData.noRay = true; drips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(drips);
    const drop = Array.from({ length: N_DRIP }, (_, i) => ({ x: 0, y: -50, z: 0, vy: 0, wait: (i * 0.37) % 1.5 }));
    const street = stage.part('street');
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), F = {};
    let ventT = 0, flockT = 0, rs = 0x5A17;
    const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    const api = {
      vents, ledges, flocks, steam, flushed: 0, held,
      // a shot or a blast near: every flock within r goes up
      startle(x, z, r = 40) { for (const f of flocks) if (f.ledge && !f.up && Math.hypot(f.ledge.x - x, f.ledge.z - z) < r) this.flush(f); },
      flush(f) {
        f.up = true; f.upT = 0; this.flushed++;
        for (const b of f.birds) { const a = rnd() * Math.PI * 2; b.vx = f.ledge.nx * 2.5 + Math.cos(a) * 1.5; b.vz = f.ledge.nz * 2.5 + Math.sin(a) * 1.5; b.vy = 2.2 + rnd() * 1.8; b.ph = rnd() * 6; }
        const G = stage.game;
        if (G && G.sfx) G.sfx.play('kit_page', _p.set(f.ledge.x, f.ledge.y, f.ledge.z), { k: 0.8 });
        stage.game && stage.game.emit('pigeons', { x: f.ledge.x, z: f.ledge.z });
      },
      update(dt, t, camera) {
        const G = stage.game;
        const p = camera.position;
        if (!this._bound && G) { this._bound = true; G.on('shot', () => { if (G.stage === stage) this.startle(G.eye.x, G.eye.z, 45); }); G.on('car:exploded', (e) => { if (e && e.at) this.startle(e.at.x, e.at.z, 60); }); }
        // the steam: the nearest vents (a slot keeps its vent while it is still wanted)
        ventT -= dt;
        if (ventT <= 0) {
          ventT = 0.5;
          const want = ventsNear(p.x, p.z, 90).map((v) => [v, Math.hypot(v.x - p.x, v.z - p.z)]).filter(([, d]) => d < 90).sort((a, b) => a[1] - b[1]).slice(0, N_VENT).map(([v]) => v);
          const keep = new Set(want);
          for (let s = 0; s < N_VENT; s++) if (held[s] && !keep.has(held[s])) place(s, null);
          for (const v of want) if (!held.includes(v)) { const s = held.indexOf(null); if (s >= 0) place(s, v); }
        }
        // the flocks: on the nearest ledges ahead (a flock that flew is gone a minute)
        flockT -= dt;
        if (flockT <= 0) {
          flockT = 0.7;
          const cand = ledgesNear(p.x, p.z, 70).filter((l) => t - l.gone > 60 && Math.hypot(l.x - p.x, l.z - p.z) > 12 && Math.hypot(l.x - p.x, l.z - p.z) < 70);
          cand.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          for (const f of flocks) {
            if (f.up) continue;
            if (f.ledge && Math.hypot(f.ledge.x - p.x, f.ledge.z - p.z) < 85) continue;
            const l = cand.find((c) => !flocks.some((q) => q.ledge === c));
            if (!l) { f.ledge = null; f.n = 0; continue; }
            f.ledge = l; f.n = 3 + Math.floor(vhash(l.x, l.z, 45) * (PER_FLOCK - 2)); f.birds = [];
            for (let k = 0; k < f.n; k++) { const u = (vhash(l.x, l.z, 50 + k) - 0.5) * Math.min(l.len - 1, 6); f.birds.push({ x: l.x + l.ux * u, y: l.y, z: l.z + l.uz * u, yaw: Math.atan2(-l.nz, l.nx) + (vhash(l.x, k, 51) - 0.5) * 1.6, vx: 0, vy: 0, vz: 0, ph: 0 }); }
          }
        }
        // a man close by on foot, a car going fast close by: they go up
        const inCar = G && G.city && G.city.inCar, car = G && G.city && G.city.car;
        const fast = inCar && car && Math.abs(car.speed) > 9;
        for (const f of flocks) {
          if (!f.ledge || f.up) continue;
          const d = Math.hypot(f.ledge.x - p.x, f.ledge.z - p.z), dy = Math.abs(f.ledge.y - p.y);
          if ((!inCar && d < 8 + dy * 0.35) || (fast && d < 14 + dy * 0.3)) this.flush(f);
        }
        // draw them
        for (const f of flocks) {
          for (let k = 0; k < PER_FLOCK; k++) {
            const i = f.i * PER_FLOCK + k, b = f.birds[k];
            if (!f.ledge || !b || k >= f.n) { birds.setMatrixAt(i, ZERO); wings.setMatrixAt(i * 2, ZERO); wings.setMatrixAt(i * 2 + 1, ZERO); continue; }
            let flap = 0;
            if (f.up) {
              b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy += 1.2 * dt; b.ph += dt * 22;
              b.yaw = Math.atan2(-b.vz, b.vx); flap = Math.sin(b.ph) * 0.9;
            } else {
              // (a peck now and then: the head bobs - a small turn of the body)
              b.yaw += Math.sin(t * 1.3 + k * 2.1) * 0.002;
            }
            _q.setFromEuler(_e.set(0, b.yaw, 0)); _m.compose(_p.set(b.x, b.y, b.z), _q, _s.set(1, 1, 1));
            birds.setMatrixAt(i, _m);
            // (the wings: folded into the body while it sits; beating as it flies)
            for (const side of [-1, 1]) {
              if (!f.up) { wings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), ZERO); continue; }
              _q.setFromEuler(_e.set(side * (0.2 + flap), b.yaw, 0, 'YXZ'));
              _m.compose(_p.set(b.x, b.y + 0.12, b.z), _q, _s.set(1, 1, side)); wings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), _m);
            }
          }
          if (f.up) { f.upT += dt; if (f.upT > 5) { f.ledge.gone = t; f.ledge = null; f.up = false; f.n = 0; } }
        }
        birds.instanceMatrix.needsUpdate = true; wings.instanceMatrix.needsUpdate = true;
        // the el's drip: drops off the girders near the eye (when the eye is near the el)
        let k = 0;
        if (el && el.line) {
          for (const d of drop) {
            if (d.y < 0.05 && d.y > -40) {
              if (street && street.addImpact) street.addImpact(stage, d.x, d.z, 0.35);
              d.y = -50; d.wait = 0.2 + rnd() * 1.2;
            }
            if (d.y <= -40) {
              d.wait -= dt;
              if (d.wait <= 0) {
                // (a point of the girders near the eye: along the line, one rail or the other)
                const s0 = nearS(p.x, p.z);
                if (s0 != null) { el.line.at(s0 + (rnd() - 0.5) * 50, F); const side = rnd() < 0.5 ? -1 : 1; d.x = F.x + F.nx * OVERPASS.halfW * side * (0.6 + rnd() * 0.5); d.z = F.z + F.nz * OVERPASS.halfW * side; d.y = OVERPASS.deckY - 0.1; d.vy = 0; }
              }
            } else { d.vy -= 9.8 * dt; d.y += d.vy * dt; }
            if (d.y > -40) { _m.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s.set(1, 1 + Math.min(4, -d.vy * 0.25), 1)); drips.setMatrixAt(k, _m); } else drips.setMatrixAt(k, ZERO);
            k++;
          }
          drips.instanceMatrix.needsUpdate = true;
        }
      },
    };
    // the el's line nearest the eye, if the eye is within 40 m of it (sampled every 8 m; cached a second)
    let nsT = -1, nsV = null;
    function nearS(x, z) {
      const t = performance.now();
      if (t - nsT < 1000) return nsV;
      nsT = t; nsV = null;
      let bd = 40;
      for (let s = 0; s < el.line.len; s += 8) { el.line.at(s, F); const d = Math.hypot(F.x - x, F.z - z); if (d < bd) { bd = d; nsV = s; } }
      return nsV;
    }
    void PAVE;
    return api;
  },
  update: (s, dt, t, camera) => s.update(dt, t, camera),
};

function mergeSimple(list) {
  let n = 0; const L = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of L) n += g.getAttribute('position').count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of L) { pos.set(g.getAttribute('position').array, o * 3); nor.set(g.getAttribute('normal').array, o * 3); o += g.getAttribute('position').count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
