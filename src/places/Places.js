import * as THREE from 'three';
import { styleFor } from '../cast/style.js';   // [O8] the rooms' figures varied as the street's
import { carry } from '../cast/o8extras.js';
import { allocInkId } from '../render/layers.js';
import { lotTiers, lotWindows } from '../city/kits/facade.js';
import { RoomKit, FLOOR, WALL_T } from '../city/kits/interior/kit.js';
import { cutRun, heal, boxRun } from '../city/kits/interior/surgery.js';
import { sites } from './sites.js';
import { shellGeo } from '../city/kits/interior/shell.js';
import { earn, pay } from '../combat/money.js';
import { crowdOf } from '../combat/brawl/Crowd.js';

// The places (lane O5, OPEN_WORLD §3 Places, brief O5): the dozen buildings a
// player can go into, each with its use. A place is LOADED when I come near
// its door (its room built, its pieces cut out of the city's merged masses,
// its lamps in the city's deal, its people spawned) and DROPPED when I am
// well away (everything freed): no room costs the street a frame. While it
// is loaded and I am outside with its door shut, its room is not drawn.
//   const P = placesOf(game, stage)    (one per stage; the city scene steps it)
//   P.step(dt)                 every step of the city (before its own doors)
//   P.enter(id, { at })        put me inside (a CONTINUE at the hotel, look development)
//   P.wake(id)                 the police's: on the cell's bench at headquarters
//   P.inside                   the site I am in (or null)   P.list, P.byId
//   P.owns(door)               a street door of O1's that is a place's (city.js leaves it to me)
//   P.buy(s, price, why, free) pay O4's purse (src/combat/money.js); broke: one on the house a place a night
//   P.earn(n, why)             O4's earn (a purse, a safe)
// Events: places:enter { id }, places:leave { id }, places:load / places:drop { id },
// crime { kind, pos, level, place } (the stand-in for O3's crime.emit: a shot,
// a man hurt, a theft in a place - O3 listens and raises the heat).
const LOAD = 34, DROP = 62;
// a fist at a room's people (OPEN_WORLD's havoc: the room answers): who fights back, as O4's
// kind of man; everyone else flinches, says his word and cowers, and the room turns
const FIGHTS = { drunkA: 'drunk', drunkB: 'drunk', trainer: 'driver', sitter: 'driver', mechanic: 'driver', grocer: 'driver', supper: 'drunk' };
const OUCH = { pianist: 'Not the hands!', nurse: 'Not in my hospital!', barman: 'Out. Now.', waitress: 'Hey!', cashier: 'Hey! Somebody!', usher: 'Out you go.', clerk: 'Mister!', promoter: 'In the ring. Not out here.',
  gunman: 'Wrong shop for that.', cook: 'Hey!', sergeant: 'You want a cell? Keep going.', drunk: 'Whassat for?' };
const ROOMS = {};
for (const m of Object.values(import.meta.glob('./rooms/*.js', { eager: true }))) if (m.default && m.default.kind) ROOMS[m.default.kind] = m.default;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _f = new THREE.Vector3();

export function placesOf(game, stage) {
  if (!stage._places) stage._places = new Places(game, stage);
  stage._places.game = game;
  return stage._places;
}

export class Places {
  constructor(game, stage) {
    this.game = game; this.stage = stage;
    this.C = stage.part('city').C;
    this.list = sites(this.C);
    this.byId = new Map(this.list.map((s) => [s.id, s]));
    // (ink ids allocated when a place is first loaded, once: a city that never
    // loads one allocates nothing - the city's frames are the city's)
    for (const s of this.list) { s.live = null; s.state = s.state || {}; }
    this.lampsApi = stage.part('lamps');
    this.inside = null; this.level = 0; this.seat = null; this.insideT = 0;
    this.lots = new Set(this.list.map((s) => s.lot));
    // (look development and the frames: ?place=<id> loads that one even in shot mode)
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    this.only = q && q.get('place');
    // the walking surface of every loaded room (floors, stairs, landings),
    // chosen by the floor I am on where they stack
    stage.addSurface((x, z) => this.surfaceAt(x, z));
    // (a street door of O1's that is a place's: opened here, never rattled)
    game.on('city:door', (e) => { if (this.owns(e.door)) e.handled = true; });
    // (a shot in a room that is not a hideout: everyone down, the room is sore, the crime)
    game.on('shot', () => this.shotIn());
  }

  // ---- what is whose ------------------------------------------------------------------------------
  // (only a place's own street doors: the lot's other doors stay O1's, and rattle)
  owns(door) { return !!door && this.list.some((s) => [s.door, ...s.doors].some((d) => Math.hypot(d.x - door.x, d.z - door.z) < 0.4)); }
  get loaded() { return this.list.filter((s) => s.live); }

  // ---- the walking surface ----------------------------------------------------------------------------
  // (hint: the floor the asker stands on - the player's by default; a figure
  // of a place asks with its own, so a man at the desk below never rises to
  // the floor I am on)
  surfaceAt(x, z, hint0 = null) {
    let best, bd = Infinity, lvlAt = 0;
    const G = this.game, hint = hint0 ?? (G && G.controller ? G.controller.groundY : 0);
    for (const s of this.list) {
      const K = s.live && s.live.K;
      if (!K) continue;
      const L = s.lot;
      if (x < L.x0 - 1 || x > L.x1 + 1 || z < L.z0 - 1 || z > L.z1 + 1) continue;
      const p = s.frame.l(x, z);
      // (the nearest to the floor I am on; a flight of stairs within a step
      // of it wins over the floor its foot stands on - I go up it)
      const consider = (y, lvl, ramp) => { const d0 = Math.abs(y - hint); const d = d0 + (y > hint + 0.75 ? 50 : 0) - (ramp && d0 < 0.6 ? 10 : 0); if (d < bd) { bd = d; best = y; lvlAt = lvl; } };
      for (const f of K.floors) if (p.x >= f.x0 && p.x <= f.x1 && p.z >= f.z0 && p.z <= f.z1) consider(f.y, f.lvl, f.prefer);
      for (const r of K.ramps) {
        if (p.x < r.x0 || p.x > r.x1 || p.z < r.z0 || p.z > r.z1) continue;
        const t = r.dir === 'n' ? (r.z1 - p.z) / (r.z1 - r.z0) : r.dir === 's' ? (p.z - r.z0) / (r.z1 - r.z0) : r.dir === 'w' ? (r.x1 - p.x) / (r.x1 - r.x0) : (p.x - r.x0) / (r.x1 - r.x0);
        consider(r.y0 + (r.y1 - r.y0) * Math.max(0, Math.min(1, t)), r.lvl, true);
      }
    }
    if (hint0 == null && best !== undefined) this._lvlAt = lvlAt;
    return best;
  }
  // a figure's own floor (it keeps to the floor it was put on)
  figSurface(fig, y0) {
    let y = y0;
    return (x, z) => { const v = this.surfaceAt(x, z, y); if (v !== undefined) { y = v; return v; } return this.C.groundAt(x, z); };
  }

  // ---- loading and dropping ----------------------------------------------------------------------------
  load(s) {
    if (s.live) return s.live;
    const t0 = performance.now();
    const G = this.game, stage = this.stage;
    const def = ROOMS[s.kind];
    if (s.ids == null) s.ids = allocInkId(4);
    const K = new RoomKit(this, s);
    s.live = { K, t0 };
    // the street doors' frames in the room's frame (the room cuts their holes)
    s.ldoors = [s.door, ...s.doors].map((d, i) => {
      const p = s.frame.l(d.x, d.z), n = s.frame.dir(0, 0);
      // (the door's normal in the frame: world n turned back)
      const nl = { x: d.nx * s.frame.c - d.nz * s.frame.s, z: d.nx * s.frame.s + d.nz * s.frame.c };
      void n;
      return { i, x: p.x, z: p.z, nx: Math.round(nl.x), nz: Math.round(nl.z), w: d.w, back: !!d.back, world: d };
    });
    if (def && def.build) def.build(K, s, this);
    else bareRoom(K, s);
    // the street doors' leaves (in each one's wall, 0.18 in from the face)
    s.live.street = s.ldoors.map((d) => {
      const axis = d.nz ? 'x' : 'z';
      const cx = d.x - d.nx * 0.18, cz = d.z - d.nz * 0.18;
      const D = K.door({ x: axis === 'x' ? cx - d.w / 2 : cx, z: axis === 'z' ? cz - d.w / 2 : cz, axis, w: d.w, h: 2.05, double: d.w > 1.5, glass: s.kind === 'diner' || s.kind === 'theatre' || s.kind === 'gunshop', name: 'street' + d.i, outer: true, locked: !!(s.state.locked && s.state.locked[d.i]) });
      D.street = true; D.ld = d;
      // (the threshold: a floor through the wall's thickness)
      K.surface(Math.min(d.x - (axis === 'x' ? d.w / 2 : 0.35), d.x + (axis === 'x' ? d.w / 2 : 0.35)), Math.max(d.x - (axis === 'x' ? d.w / 2 : 0.35), d.x + (axis === 'x' ? d.w / 2 : 0.35)),
        Math.min(d.z - (axis === 'z' ? d.w / 2 : 0.35), d.z + (axis === 'z' ? d.w / 2 : 0.35)), Math.max(d.z - (axis === 'z' ? d.w / 2 : 0.35), d.z + (axis === 'z' ? d.w / 2 : 0.35)), FLOOR, 0);
      K.box('concrete', axis === 'x' ? d.x - d.w / 2 : d.x - 0.32, axis === 'x' ? d.x + d.w / 2 : d.x + 0.02, FLOOR - 0.15, FLOOR, axis === 'z' ? d.z - d.w / 2 : d.z - 0.32, axis === 'z' ? d.z + d.w / 2 : d.z + 0.02, 0);
      return D;
    });
    // the windows' glass (the base's Glass: a round cracks it, more break it;
    // broken, it is a way in - its collider goes - and a crime)
    s.live.panes2 = [];
    for (const w of K.windows || []) {
      // (the window's floor: the one under its sill)
      let wl = 0, wy = -9; for (const f of K.floors) if (f.y <= w.y - w.h / 2 + 0.05 && f.y > wy) { wy = f.y; wl = f.lvl; }
      const c = K.solid(w.lx - w.w / 2, w.lx + w.w / 2, -0.3, -0.06, { tag: 'window', lvl: wl });
      const pane = stage.glass.addPane({ centre: V(w.x - w.nx * 0.16, w.y, w.z - w.nz * 0.16), normal: V(w.nx, 0, w.nz), w: w.w - 0.06, h: w.h - 0.06, tag: `${s.id}_win${s.live.panes2.length}` });
      pane.on('state', (p, st) => { if (st === 'gone') { c.gone = true; c.lvl = -99; this.crime('glass', p.c, 1); } });
      s.live.panes2.push(pane);
    }
    K.finish();
    stage.scene.add(K.group, K.outer);
    // the bullets' world: the room's solids
    s.live.solids = [];
    for (const g of [K.group, K.outer]) g.traverse((o) => { if (o.isMesh && !o.userData.noRay) { stage.addSolid(o); s.live.solids.push(o); } });
    // the lot's mass cut out of its far tile (its base tier), the panes at its doors and windows out of its chunk
    s.live.cuts = [];
    this.cutLot(s);
    this.shell(s);
    // the lot's collider: its box gone, a wall round its edge with the doors' gaps
    s.live.lotCols = [];
    // (its box: matched by its extents - a lot's cx / cz are not always its box's middle)
    const Lb = s.lot, mx = (Lb.x0 + Lb.x1) / 2, mz = (Lb.z0 + Lb.z1) / 2;
    for (const c of stage.colliders.near(mx, mz, 2)) if (c.hx != null && c.tag === 'wall' && Math.abs(c.cx - mx) < 0.05 && Math.abs(c.cz - mz) < 0.05 && Math.abs(c.hx - (Lb.x1 - Lb.x0) / 2) < 0.05) { c.gone = true; s.live.lotCols.push(c); }
    this.rim(K, s);
    // its lamps in the city's deal; its look and its dry volume
    if (this.lampsApi && this.lampsApi.addExtra) this.lampsApi.addExtra(K.lamps);
    s.live.looks = K.vols.map((v) => ({ box: v.box, look: { ...stage.look, ...v.look }, site: s }));
    stage.lookVolumes.unshift(...s.live.looks);
    s.live.dry = new THREE.Box3(V(s.lot.x0 + 0.05, -1, s.lot.z0 + 0.05), V(s.lot.x1 - 0.05, s.lot.h - 0.05, s.lot.z1 - 0.05));
    stage.dry.unshift(s.live.dry);
    // its people
    s.live.cast = [];
    for (const f of K.figs) this.spawnFig(s, f);
    // what can be used: its doors, its seats, its things
    s.live.ix = [];
    this.wire(s);
    // the room's own life (a bout, a fight breaking out, the men of a hideout)
    s.live.run = def && def.live ? def.live(K, s, this) : null;
    s.live.ms = performance.now() - t0;
    // [O5b] the first open one frame like the second (brief O5b §4): the room's programs compiled now (in
    // parallel where the GPU can) with the street's lights, then - a step later - one draw of it into a
    // scrap target (its buffers and its lettering's textures on the GPU): nothing of it is new at the door
    this.warm(s);
    this.game.emit('places:load', { id: s.id, ms: s.live.ms });
    return s.live;
  }

  // [O5b] the warm-up: compileAsync of the room (and its outside) against the stage's lights, then one
  // scrap draw of it (warmDraw, from step, once the programs are ready)
  lightScene() {
    const LS = new THREE.Scene(), sc = this.stage.scene;
    LS.fog = sc.fog; LS.environment = sc.environment;
    sc.traverseVisible((o) => { if (o.isLight) { const c = o.clone(false); c.layers.mask = o.layers.mask; LS.add(c); } });
    return LS;
  }
  warm(s) {
    const G = this.game, r = G.pipeline && G.pipeline.renderer, L = s.live;
    if (!r || !r.compileAsync || G.shotMode) { L.warm = 'skip'; return; }
    const K = L.K, vis = K.group.visible, P = G.pipeline, prev = r.getRenderTarget();
    L.warm = 'compiling';
    K.group.visible = true;
    try {
      const LS = this.lightScene();
      r.setRenderTarget((P && P.rtScene) || prev);
      const a = r.compileAsync(K.group, G.camera, LS), b = r.compileAsync(K.outer, G.camera, LS);
      Promise.all([a, b]).then(() => { if (s.live === L) L.warm = 'draw'; }, () => { if (s.live === L) L.warm = 'draw'; });
    } catch (e) { L.warm = 'draw'; }
    r.setRenderTarget(prev);
    K.group.visible = vis;
  }
  warmDraw(s) {
    const G = this.game, r = G.pipeline && G.pipeline.renderer, L = s.live, K = L.K;
    L.warm = 'done';
    if (!r) return;
    const t0 = performance.now();
    const LS = this.lightScene(), parent = K.group.parent, vis = K.group.visible;
    const culled = [];
    LS.add(K.group);
    K.group.visible = true;
    K.group.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite) && o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    const rt = new THREE.WebGLRenderTarget(16, 16), prev = r.getRenderTarget(), cam = G.camera, mask = cam.layers.mask;
    const sm = r.shadowMap.autoUpdate; r.shadowMap.autoUpdate = false;
    cam.layers.enableAll();
    r.setRenderTarget(rt);
    try { r.render(LS, cam); } catch (e) { /* its first frame will */ }
    cam.layers.mask = mask;
    r.shadowMap.autoUpdate = sm;
    r.setRenderTarget(prev);
    rt.dispose();
    for (const o of culled) o.frustumCulled = true;
    if (parent) parent.add(K.group);
    K.group.visible = vis;
    L.warmMs = performance.now() - t0;
  }

  drop(s) {
    const L = s.live;
    if (!L) return;
    const stage = this.stage, G = this.game;
    if (L.run && L.run.dispose) L.run.dispose();
    for (const p of L.panes2 || []) { try { stage.glass.removePane(p); if (p.mesh) { p.mesh.geometry.dispose(); if (p.mesh.material.dispose) p.mesh.material.dispose(); } } catch (e) { /* gone */ } }
    for (const h of L.ix) G.interact.remove(h);
    for (const c of L.cast) { try { stage.cast.remove(c); } catch (e) { /* gone */ } }
    for (const m of L.solids) stage.removeSolid(m);
    if (this.lampsApi && this.lampsApi.removeExtra) this.lampsApi.removeExtra(L.K.lamps);
    for (const v of L.looks) { const i = stage.lookVolumes.indexOf(v); if (i >= 0) stage.lookVolumes.splice(i, 1); }
    { const i = stage.dry.indexOf(L.dry); if (i >= 0) stage.dry.splice(i, 1); }
    for (const c of L.lotCols) c.gone = false;
    for (const c of L.cuts) { heal(c); if (c.rayT) c.rayT.set(c.raySaved, c.rayAt); }
    if (L.shell) { stage.removeSolid(L.shell); stage.scene.remove(L.shell); L.shell.geometry.dispose(); }
    L.K.dispose();
    s.live = null;
    if (this.inside === s) this.inside = null;
    G.emit('places:drop', { id: s.id });
  }

  // the lot's base tier out of its far tile; the dark panes at the doors and
  // the room's windows out of its near chunk
  cutLot(s) {
    const L = s.lot, far = this.stage.part('far');
    const T0 = lotTiers(L)[0];
    if (far && T0 && T0.x0 != null) {
      const test = boxRun(T0.x0, T0.x1, T0.y0, T0.y1, T0.z0, T0.z1, 36);
      for (const t of far.tiles) {
        if (Math.abs(t.mid.x - L.cx) > 200 || Math.abs(t.mid.z - L.cz) > 200) continue;
        let done = false;
        for (const m of t.meshes) {
          const c = cutRun(m, test, 36);
          if (c) { s.live.cuts.push(c); this.cutRays(c); done = true; break; }
        }
        if (done) break;
      }
    }
    this.cutPanes(s);
  }
  // the lot as the street sees it (its base tier, cut from the far tile),
  // drawn again with holes at its doors and the room's windows
  shell(s) {
    const c = s.live.cuts.find((x) => x.n === 36);
    if (!c) return;
    const T = lotTiers(s.lot)[0];
    const faceOf = (nx, nz) => (nz > 0 ? 's' : nz < 0 ? 'n' : nx > 0 ? 'e' : 'w');
    const holes = [];
    for (const d of [s.door, ...s.doors]) { const f = faceOf(d.nx, d.nz), a = f === 's' || f === 'n' ? d.x : d.z; holes.push({ face: f, a0: a - d.w / 2 - 0.02, a1: a + d.w / 2 + 0.02, y0: 0, y1: FLOOR + 2.07 }); }
    for (const w of s.live.K.windows || []) { const f = faceOf(w.nx, w.nz), a = f === 's' || f === 'n' ? w.x : w.z; holes.push({ face: f, a0: a - w.w / 2, a1: a + w.w / 2, y0: w.y - w.h / 2, y1: w.y + w.h / 2 }); }
    const m = new THREE.Mesh(shellGeo(T, holes, 0.07), c.mesh.material);
    m.userData.inkId = c.mesh.userData.inkId; m.receiveShadow = true; m.name = 'shell ' + s.id;
    this.stage.scene.add(m);
    this.stage.addSolid(m);
    s.live.shell = m;
  }
  // the panes to take out: at each street door (a shop front made a door),
  // and the windows the room looks out of (K.windows: lotWindows entries)
  cutPanes(s) {
    const st = this.stage.part('stream');
    if (!st) return;
    const want = [];
    for (const d of [s.door, ...s.doors]) if (d.shop) want.push(d.shop);
    for (const w of s.live.K.windows || []) want.push(w);
    s.live.panes = want;
    for (const w of want) {
      const ch = st.loaded.get(this.C.chunkOf(w.x, w.z)) || null;
      if (!ch) continue;
      s.live.paneChunk = ch;
      const cx = w.x + w.nx * 0.04, cz = w.z + w.nz * 0.04;
      const test = boxRun(Math.min(cx - Math.abs(w.nz) * w.w / 2, cx + Math.abs(w.nz) * w.w / 2), Math.max(cx - Math.abs(w.nz) * w.w / 2, cx + Math.abs(w.nz) * w.w / 2), w.y - w.h / 2, w.y + w.h / 2,
        Math.min(cz - Math.abs(w.nx) * w.w / 2, cz + Math.abs(w.nx) * w.w / 2), Math.max(cz - Math.abs(w.nx) * w.w / 2, cz + Math.abs(w.nx) * w.w / 2), 6, 4e-3);
      for (const m of ch.meshes) {
        if (m.userData.bucket !== 'dark') continue;
        const c = cutRun(m, test, 6);
        if (c) { s.live.cuts.push(c); break; }
      }
      // (a lit shop front's light quad in the far tile, a hair further out)
      if (w.lit) {
        const lx = w.x + w.nx * 0.07, lz = w.z + w.nz * 0.07;
        const t2 = boxRun(Math.min(lx - Math.abs(w.nz) * w.w / 2, lx + Math.abs(w.nz) * w.w / 2), Math.max(lx - Math.abs(w.nz) * w.w / 2, lx + Math.abs(w.nz) * w.w / 2), w.y - w.h / 2, w.y + w.h / 2,
          Math.min(lz - Math.abs(w.nx) * w.w / 2, lz + Math.abs(w.nx) * w.w / 2), Math.max(lz - Math.abs(w.nx) * w.w / 2, lz + Math.abs(w.nx) * w.w / 2), 6, 4e-3);
        for (const t of this.stage.part('far').tiles) { if (Math.abs(t.mid.x - w.x) > 200 || Math.abs(t.mid.z - w.z) > 200) continue; for (const m of t.meshes) { const c = cutRun(m, t2, 6); if (c) { s.live.cuts.push(c); break; } } }
      }
    }
  }
  // (the bullets' copy of the tile: the same triangles made nothing)
  cutRays(c) {
    const R = this.stage.rays;
    const e = R && R.entries.find((x) => x.mesh === c.mesh);
    if (!e) return;
    const T = e.bvh.tri, t0 = c.at / 3, t1 = (c.at + c.n) / 3;
    c.raySaved = T.slice(t0 * 9, t1 * 9);
    c.rayT = T; c.rayAt = t0 * 9;
    for (let t = t0; t < t1; t++) for (let k = 3; k < 9; k++) T[t * 9 + k] = T[t * 9 + (k % 3)];
  }
  // a wall round the lot's edge, inside it (its box is gone while the room
  // stands), with a gap at each street door
  rim(K, s) {
    const b = s.lb, t = 0.3;
    const gaps = { s: [], n: [], w: [], e: [] };
    for (const d of s.ldoors) {
      const side = d.nz > 0 ? 's' : d.nz < 0 ? 'n' : d.nx > 0 ? 'e' : 'w';
      gaps[side].push(d.nz ? [d.x - d.w / 2, d.x + d.w / 2] : [d.z - d.w / 2, d.z + d.w / 2]);
    }
    const run = (axis, c, a0, a1, G) => {
      let a = a0;
      for (const [g0, g1] of G.sort((p, q) => p[0] - q[0])) { if (g0 > a) seg(axis, c, a, g0); a = Math.max(a, g1); }
      if (a1 > a) seg(axis, c, a, a1);
    };
    const seg = (axis, c, a, bb) => { if (axis === 'x') K.solid(a, bb, c - t / 2, c + t / 2, { tag: 'wall' }); else K.solid(c - t / 2, c + t / 2, a, bb, { tag: 'wall' }); };
    run('x', b.z1 - t / 2, b.x0, b.x1, gaps.s);
    run('x', b.z0 + t / 2, b.x0, b.x1, gaps.n);
    run('z', b.x0 + t / 2, b.z0, b.z1, gaps.w);
    run('z', b.x1 - t / 2, b.z0, b.z1, gaps.e);
  }

  spawnFig(s, f) {
    const stage = this.stage;
    try {
      const p = s.frame.w(f.x, f.z);
      const c = stage.cast.spawn(f.kind, { at: { x: p.x, z: p.z }, yaw: s.frame.figYaw(f.yaw), name: f.name ? `${s.id}_${f.name}` : null, variant: f.variant || null });
      // [O8] after the critic (the same barman and boxer in every bar and gym): the street's variety
      // for the rooms' figures too - a build, a carriage, the hat's set, the idle he keeps, by where he stands
      if (c.fig && c.fig.setStyle) {
        const S = styleFor(f.kind, p.x, p.z, { role: 'room', sex: /woman|waitress|nurse|_her|singer|girl/.test(f.kind) ? 'f' : 'm', work: /cook|barman|boxer|docker|dockhand|trucker/.test(f.kind) });
        c.fig.setStyle(S);
        if (S.smoke) carry(c.fig, 'cigarette');
      }
      if (f.seat) c.sit({ pos: V(p.x, f.seat.y, p.z), yaw: s.frame.figYaw(f.yaw) - Math.PI, name: f.seat.name || 'stool' });
      if (f.state && f.state !== 'idle') c.setState(f.state, 0);
      c.place2 = s; c.spec = f;
      // (its own floor: the one it stands on - never the floor I am on)
      if (c.fig) c.fig.surface = this.figSurface(c.fig, f.y ?? FLOOR);
      s.live.cast.push(c);
      if (f.onSpawn) f.onSpawn(c);
      return c;
    } catch (e) { (this.misses || (this.misses = [])).push(`${s.id} ${f.kind}: ${e.message}`); return null; }
  }

  // ---- what E reaches: the doors, the seats, the things -------------------------------------------------
  wireLate(s) { if (s.live) this.wire(s); }
  wire(s) {
    const G = this.game, K = s.live.K, F = s.frame;
    const add = (h) => { const x = G.interact.add({ scope: 'o5', ...h, id: `o5_${s.id}_${s.live.ix.length}` }); s.live.ix.push(x); return x; };
    for (const D of K.doors) {
      if (D._wired) continue; D._wired = true;
      // (a street door is met from the pavement: its prompt comes at 3 m)
      const h = add({ at: D.centre.clone().setY(D.centre.y + 0.35), range: D.street ? 3.3 : 2.4, cone: 0.62, prompt: '', when: () => this.canUse(D.lvl), onUse: () => this.useDoor(s, D) });
      Object.defineProperty(h, 'prompt', { get: () => (D.locked ? 'try the door' : D.shut || D.target === 0 ? (D.street && !this.inSite(s) ? 'go in' : 'open') : 'close') });
    }
    for (const S of K.seats) {
      if (S._wired) continue; S._wired = true;
      const at = S.at ? F.v(S.at[0], S.at[1], S.at[2]) : F.v(S.x, S.eyeY - 0.5, S.z);
      // (not in the half second after I got up: the press that stood me up never sits me again)
      add({ at, range: S.range, cone: S.cone, prompt: S.prompt, when: () => !this.seat && G.time - (this.upT ?? -9) > 0.5 && this.canUse(S.lvl) && (!S.when || S.when()), onUse: () => this.sit(s, S) });
    }
    for (const U of K.uses) {
      if (U._wired) continue; U._wired = true;
      const at = U.at && U.at.isVector3 ? U.at : U.atFn ? null : F.v(U.at[0], U.at[1], U.at[2]);
      const h = add({ at: U.atFn || at, range: U.range, cone: U.cone, prompt: '', when: () => this.canUse(U.lvl) && (U.seated ? this.seat === U.seated : !U.seatOnly || !!this.seat) && (!U.when || U.when()), onUse: (ctx) => U.onUse(ctx, s, this) });
      if (typeof U.prompt === 'function') Object.defineProperty(h, 'prompt', { get: U.prompt }); else h.prompt = U.prompt;
    }
  }
  // (nothing is offered under a sleep's black)
  canUse(lvl) { return !this.sleeping && (lvl == null || lvl === this.level); }
  inSite(s) { return this.inside === s; }

  useDoor(s, D) {
    const G = this.game;
    if (D.locked) {
      D.rattle();
      G.hud.message('locked', 1.2);
      if (s.live && s.live.run && s.live.run.locked) s.live.run.locked(D);
      return;
    }
    if (D.shut || D.target === 0) {
      D.open(G.controller.pos);
      // [O5b] (the leaf starts in the frame E was pressed, not the next: GAME_TWO §1 A1)
      D.update(1 / 60);
      if (D.street) { this.lastDoorT = performance.now(); if (s.live.run && s.live.run.door) s.live.run.door(D); }
    } else D.close();
  }

  // ---- seats ----------------------------------------------------------------------------------------
  sit(s, S) {
    const G = this.game, C = G.controller, F = s.frame;
    const pos = F.v(S.x, 0, S.z);
    this.seat = S; this.seatSite = s;
    C.setMode('seated', { anchor: { pos, yaw: F.yaw(S.yaw), eyeY: S.eyeY }, ease: 0.35, pitch: S.pitch ?? -0.12, yawRange: S.yawRange || [-1.6, 1.6], pitchRange: [-0.95, 0.6] });
    G.sfx.play('stoolSqueak', pos.clone().setY(S.eyeY - 0.8), {}, { ref: 2 });
    if (S.onSit) S.onSit(s, this);
    // (a seat with a use in front of it - the bar, the counter - has E for that use: S gets me up, taught once;
    // a seat without one says 'E  get up' on the prompt line, never a card saying the same)
    if (K_USES(s, S)) G.hud.teach('o5_up', '[S] get up', { until: () => this.seat !== S, secs: 3.5 });
  }
  stand() {
    const G = this.game, S = this.seat, s = this.seatSite, F = s.frame;
    if (!S) return;
    this.upT = G.time;
    // (the press that got me up is spent: the stool in front of me never takes it - the critic's trap)
    G.keysDown.delete('KeyE'); if (G.vin && G.vin.down) G.vin.down.delete('KeyE');
    const st = S.standAt || { x: S.x + Math.sin(S.yaw) * 0.6, z: S.z + Math.cos(S.yaw) * 0.6, yaw: S.yaw };
    const p = F.w(st.x, st.z);
    this.seat = null;
    G.controller.setMode('walk', { pose: { x: p.x, z: p.z, y: S.floorY != null ? S.floorY + 1.65 : null, yaw: F.yaw(st.yaw), pitch: -0.05 }, ease: 0.35 });
    G.hud.clearPrompt('o5seat');
    if (S.onStand) S.onStand(s, this);
  }

  // ---- in, out, wake ---------------------------------------------------------------------------------------
  // put me inside a place (loaded now) at its spawn: { x, z, yaw } in its frame (or the room's own `spawn`)
  enter(id, { at = null, seat = null } = {}) {
    const s = this.byId.get(id);
    if (!s) return null;
    this.load(s);
    const def = ROOMS[s.kind] || {};
    const p0 = at || (s.live.K.spawn) || def.spawn || { x: 0, z: -2.5, yaw: 0 };
    const p = s.frame.w(p0.x, p0.z);
    const C = this.game.controller;
    C.setPose(p.x, p.z, s.frame.yaw(p0.yaw || 0), p0.pitch ?? -0.05, (p0.y ?? FLOOR));
    this.inside = s; this.level = p0.lvl || 0;
    if (seat) { const S = s.live.K.seats.find((x) => x.name === seat); if (S) this.sit(s, S); }
    return s;
  }
  // the police's (O3): after an arrest I wake at headquarters, on the cell's bench
  wake(id = 'police', how = null) {
    // [O5b] (woken from anywhere in the city: the street round its door built first)
    { const s0 = this.byId.get(id), st = this.stage.part('stream'); if (s0 && st && st.warmAround) st.warmAround(s0.door.x, s0.door.z); }
    const s = this.enter(id);
    if (!s) return null;
    const def = ROOMS[s.kind];
    if (def && def.wake) def.wake(s.live.K, s, this, how);
    return s;
  }

  // the city's beat `wake` (after a fall in a place): the place built again as it was - every
  // man of a hideout back, the bout's ring empty - and me outside its street door ('door'),
  // or where its room puts me (def.wakeAt(K, where): the gym's 'ring')
  wakeAfter({ id, where = 'door' } = {}) {
    const s = this.byId.get(id);
    if (!s) return null;
    if (s.live) this.drop(s);
    s.state.dead = [];
    const def = ROOMS[s.kind] || {};
    this.load(s);
    const at = where !== 'door' && def.wakeAt ? def.wakeAt(where, s.live.K) : null;
    if (at) return this.enter(id, { at });
    this.inside = null; this.level = 0;
    return s;
  }

  // ---- the purse: O4's (src/combat/money.js, save.money) ------------------------------------------------------
  earn(n, why = '') { return earn(this.game, n, why); }
  // a thing bought: paid if I have it; broke, one on the house a place a night (the line says
  // so), then he waits - never free for ever
  buy(s, price, why = '', free = 'On the house. Once.') {
    const G = this.game;
    if (s.state.sore) { G.hud.message('Not to you. Not tonight.', 1.6); return false; }
    if (pay(G, price, why)) return true;
    if (!s.state.onHouse) { s.state.onHouse = true; G.hud.message(free, 1.8); return true; }
    G.hud.message(`$${price}. He waits.`, 1.6);
    return false;
  }
  crime(kind, pos, level = 1) { this.game.emit('crime', { kind, pos, level, place: this.inside ? this.inside.id : null }); }

  // ---- havoc in a room: the fist, the shot -------------------------------------------------------------
  // LMB / RMB with nothing drawn, at one of the room's people within reach: my fist swings at
  // once; a man who fights (FIGHTS) answers with O4's crowd brawl (the room's men of his kind
  // join, the room's things in reach; down: thrown out on the pavement - the city's beat
  // `wake`); anyone else takes it (the flinch, his word), cowers, and the room turns and will
  // not serve me tonight (s.state.sore)
  fist(arm) {
    const G = this.game, s = this.inside, L = s && s.live;
    if (!L) return false;
    const e = G.eye, f = new THREE.Vector3(0, 0, -1).transformDirection(G.camera.matrixWorld);
    let best = null, bs = 0.42;
    for (const c of L.cast) {
      if (!c.alive || c.down || c.dead) continue;
      const dx = c.pos.x - e.x, dz = c.pos.z - e.z, d = Math.hypot(dx, dz);
      if (d > 1.9 || Math.abs((c.pos.y || 0) + 1.3 - e.y) > 1.4) continue;
      const a = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / (d * Math.hypot(f.x, f.z) || 1))));
      if (a < bs) { bs = a; best = c; }
    }
    if (!best) return false;
    const name = (best.spec && best.spec.name) || '';
    const kind = FIGHTS[name];
    this.crime('assault', best.pos.clone(), 1);
    s.state.sore = true;
    if (kind && !best.seat && !(best.spec && best.spec.seat)) {
      // (he and the men of his kind standing within 5 m: two at most)
      const men = [best, ...L.cast.filter((c) => c !== best && c.alive && !c.down && FIGHTS[(c.spec && c.spec.name) || ''] && !(c.spec && c.spec.seat) && Math.hypot(c.pos.x - best.pos.x, c.pos.z - best.pos.z) < 5)].slice(0, 2);
      this.brawl(s, men);
      return true;
    }
    // (the swing, and him taking it at its contact)
    const H = G.player.hands;
    G.setViewmodelVisible(true);
    H.equip('fists');
    H.play(arm === 'L' ? 'jabL' : 'jabR', { onMark: { contact: () => {
      try { best.play(arm === 'L' ? 'br_hitHeadR' : 'br_hitHeadL', { fade: 0.05 }); } catch (err) { /* */ }
      G.sfx.play('f_heavy', best.pos.clone().setY((best.pos.y || 0) + 1.6), { k: 0.6 }, { ref: 3 });
      G.controller.kick && G.controller.kick(0.6, 0.8, 0.08);
    } } });
    const line = OUCH[name] || OUCH[best.spec && best.spec.kind] || 'Hey!';
    this.laterT(0.25, () => G.hud.say ? G.hud.say(line, 1.8, { always: true }) : G.hud.message(line, 1.8));
    this.laterT(0.55, () => { try { best.setState('cower', 0.25); } catch (err) { /* */ } });
    this.turn(s, best);
    this.laterT(0.9, () => { if (!crowdOf(G).active && !drawn(G)) { H.equip('empty'); G.setViewmodelVisible(false); } });
    return true;
  }
  // (the room turns to look: everyone else startles)
  turn(s, not = null) {
    const L = s.live;
    if (!L) return;
    for (const c of L.cast) if (c !== not && c.alive && !c.down) { try { c.lookAt(this.game.eye.clone()); if (!c.seat) c.play('startle', { fade: 0.12 }); } catch (e) { /* */ } }
  }
  // O4's crowd brawl with the room's men (the room's things offered: s.live.things)
  brawl(s, men) {
    const G = this.game, F = crowdOf(G);
    if (F.active || !men.length) return null;
    this.turn(s, null);
    F.start({ men: men.map((c) => ({ kind: FIGHTS[c.spec.name] || 'drunk', c, name: c.spec.name === 'drunkA' || c.spec.name === 'drunkB' ? 'DRUNK' : null })), leave: true,
      things: (s.live.things || []).filter((t) => !t.available || t.available()), seed: 6100 + (s.state.brawls = (s.state.brawls || 0) + 1),
      onEnd: (r) => { G.emit('places:brawl', { id: s.id, result: r }); },
      onDown: () => { G.city && (G.city.wake = { id: s.id, where: 'door' }); return { why: 'Thrown out.', to: 'wake' }; } });
    // (the press that started it is my first jab: it lands now, not on the next click)
    F.inputStep(0);
    this.crime('brawl', men[0].pos.clone(), 1);
    return F;
  }
  shotIn() {
    const G = this.game, s = this.inside;
    if (!s || !s.live || s.kind === 'hideout' || s.state.shotT === G.time) return;
    s.state.shotT = G.time; s.state.sore = true;
    for (const c of s.live.cast) if (c.alive && !c.down && !c.seat) { try { c.setState('cower', 0.2); } catch (e) { /* */ } }
    if (!s.state.shotSaid) { s.state.shotSaid = true; this.laterT(0.4, () => G.hud.say ? G.hud.say('Everybody down.', 1.8, { always: true }) : null); }
    this.crime('shot', G.eye.clone(), 2);
  }
  laterT(secs, fn) { let t = 0; this.later((dt) => { t += dt; if (t < secs) return false; try { fn(); } catch (e) { /* */ } return true; }); }

  // [O5b] a bed's sleep (the hotel's room, a ward's bed: OPEN_WORLD's 'a bed for a man with no
  // room'): the black, health whole, the heat dies, the night on an hour, the save written at the
  // city's beat `beat` (CONTINUE wakes me there), 'Slept. Saved.', up again in under 4 s
  sleepAt(beat, why = 'sleep') {
    const G = this.game;
    if (this.sleeping) return;
    this.sleeping = { t: 0 };
    const T = { t: 0 };
    const C = G.controller;
    C.frozen = true;
    this.later((dt) => {
      T.t += dt;
      if (T.t < 1.0) { G.hud.fade(T.t / 1.0); return false; }
      if (!T.done) {
        T.done = true;
        G.health.reset();
        if (G.police && G.police.clear) G.police.clear(why);
        G.emit('heat:clear', { why });
        G.emit('night:hour', { hours: 1, why });
        const S = G.scenes, was = S.beat;
        S.beat = beat;
        const d = G.save.write();
        S.beat = was;
        G.emit('saved', { at: beat, ok: !!d });
        G.hud.kit.failLine && G.hud.kit.failLine('Slept. Saved.');
        G.hud.kit.failK && G.hud.kit.failK(1);
      }
      if (T.t < 3.0) return false;
      if (T.t < 3.8) { G.hud.kit.failK && G.hud.kit.failK(0); G.hud.fade(1 - (T.t - 3.0) / 0.8); return false; }
      G.hud.fade(0); G.hud.kit.failLine && G.hud.kit.failLine(null);
      C.frozen = false;
      this.sleeping = null;
      return true;
    });
  }

  // a step function run every step until it returns true (a sleep's black, a cut)
  later(fn) { (this.laters || (this.laters = [])).push(fn); }

  // ---- per step ------------------------------------------------------------------------------------------
  step(dt) {
    const G = this.game, eye = G.eye;
    if (this.laters && this.laters.length) for (const fn of [...this.laters]) if (fn(dt)) this.laters.splice(this.laters.indexOf(fn), 1);
    // load what I come near; drop what I leave well behind (one a step)
    let loads = 0;
    for (const s of this.list) {
      const d = Math.hypot(s.door.x - eye.x, s.door.z - eye.z, ...(s.doors.length ? [] : []));
      const dm = Math.min(d, ...s.doors.map((q) => Math.hypot(q.x - eye.x, q.z - eye.z)));
      // [O5b] (a place seen from down the street - the hospital's globe - loads further out: s.loadR / s.dropR)
      if (!s.live && loads === 0 && (G.shotMode ? this.only === s.id : dm < (s.loadR || LOAD))) { this.load(s); loads++; }
      else if (s.live && dm > (s.dropR || DROP) && this.inside !== s && !(G.shotMode && this.only === s.id)) this.drop(s);
    }
    // [O5b] (the hospital found: within 40 m of its door - the map marks it, as O7's places)
    { const h = this.byId.get('hospital'); if (h && G.save && G.save.found && !G.save.found.hospital && Math.hypot(h.door.x - eye.x, h.door.z - eye.z) < 40) { G.save.found.hospital = true; G.emit('place:found', { id: 'hospital' }); } }
    // the panes of a chunk built after its place was loaded
    for (const s of this.list) if (s.live && s.live.panes && s.live.panes.length && !s.live.paneChunk) this.cutPanes(s);
    // where I am: inside which place, on which floor
    const was = this.inside;
    this.inside = null;
    for (const s of this.list) {
      if (!s.live) continue;
      for (const v of s.live.looks) if (v.box.containsPoint(eye)) { this.inside = s; break; }
      if (this.inside) break;
    }
    if (was !== this.inside) {
      if (was) { G.emit('places:leave', { id: was.id }); if (was.live && was.live.run && was.live.run.leave) was.live.run.leave(); }
      if (this.inside) { this.insideT = 0; G.emit('places:enter', { id: this.inside.id }); if (this.inside.live.run && this.inside.live.run.enter) this.inside.live.run.enter(); }
    }
    // (the floor I am on: of a place's surfaces under me - its roof too, out of its rooms)
    this._lvlAt = 0;
    const ys = this.surfaceAt(G.controller.pos.x, G.controller.pos.z);
    this.level = ys !== undefined ? (this._lvlAt || 0) : 0;
    if (this.inside) {
      this.insideT += dt;
      // (the police lose me inside after a while: O3's)
      // ([O7] after the critic: lost() begins the search - the badges go one by one while nobody sees me - it cleared all five at once)
      if (this.insideT > 20 && !this.lostSaid) { this.lostSaid = true; if (G.police && G.police.lost) G.police.lost(); }
    } else this.lostSaid = false;
    for (const s of this.list) {
      const L = s.live;
      if (!L) continue;
      // the floors' own colliders: only the floor I am on
      for (const c of L.K.cols) if (c.lvl != null) c.gone = c.lvl !== this.level;
      const C = G.controller, vx = C.vel ? C.vel.x : 0, vz = C.vel ? C.vel.z : 0, sp = Math.hypot(vx, vz);
      for (const D of L.K.doors) {
        // (a push door is pushed: walked into, shut and not locked, it swings open before me)
        if (D.shut && !D.moving && !D.locked && sp > 0.8 && this.canUse(D.lvl) && Math.abs(C.groundY + 1.0 - D.centre.y) < 1.2) {
          const dx = D.centre.x - C.pos.x, dz = D.centre.z - C.pos.z, d = Math.hypot(dx, dz);
          if (d < 0.75 && (dx * vx + dz * vz) / (d * sp) > 0.6) D.open(C.pos);
        }
        D.update(dt);
        // (a street door has a closer: it swings shut behind me once I am clear)
        if (D.street && !D.shut && !D.moving && D.openT > 3.5 && Math.hypot(G.eye.x - D.centre.x, G.eye.z - D.centre.z) > 1.8) D.close(1.6);
      }
      // [O5b] (its warm draw, once its programs are ready)
      if (L.warm === 'draw') this.warmDraw(s);
      // drawn only when it can be seen: I am in it, a door of it is open, or it has windows
      const see = this.inside === s || L.K.doors.some((D) => D.street && !D.shut) || !!(L.K.windows && L.K.windows.length);
      if (L.K.group.visible !== see) L.K.group.visible = see;
      if (L.run && L.run.step) L.run.step(dt);
    }
    // a fist at one of the room's people (nothing drawn, no fight on, on my feet)
    if (this.inside && !this.seat && !G.crowd.active && !G.brawl.active && !G.failing && !drawn(G)
      && (G.pressed('Mouse0') || G.pressed('Mouse2'))) { if (this.fist(G.pressed('Mouse0') ? 'L' : 'R')) this.fistAt = G.time; }   // [O7] (taken: the street's jab - night/fist.js - leaves it)
    // seated: S or SPACE gets me up always (the stick back, cross on the pad); E too when nothing
    // in reach takes it (then the prompt says so - but not under the card that says it)
    if (this.seat) {
      const cur = G.interact.current, T = G.hud.kit && G.hud.kit.teachCur;
      if (!cur && !this.seatLock && !(T && T.id === 'o5_up')) G.hud.prompt('E  get up', null, 'o5seat'); else G.hud.clearPrompt('o5seat');
      if (!this.seatLock && G.controller.modeT > 0.3 && (G.pressed('KeyS') || G.pressed('Space') || (!cur && G.pressed('KeyE')))) this.stand();
    }
  }
}

// (a gun in hand: LMB is its)
function drawn(G) { const c = G.player.weapons.current, h = G.player.hands.set; return !!c && c !== 'fists' && !!h && h !== 'empty' && h !== 'fists'; }
// (the city's hands are empty with the base's Tommy gun still 'current' underneath: that is nothing drawn)
// (a seat with a use of its own in front of it: the bar's whiskey, the counter's coffee)
function K_USES(s, S) { return !!(s.live && s.live.K.uses.some((U) => U.seated === S)); }

// a place without a room of its own yet: one bare room behind its door
function bareRoom(K, s) {
  const b = s.lb;
  const x0 = Math.max(b.x0 + 0.5, -4), x1 = Math.min(b.x1 - 0.5, 4), z0 = Math.max(b.z0 + 0.5, -8);
  K.room(x0, x1, z0, -0.3, { h: 3.4, sides: { s: { holes: K.P.doorHoles(s, 's') } } });
  K.lamp((x0 + x1) / 2, FLOOR + 2.9, (z0 - 0.3) / 2, { kind: 'bare', ceilY: FLOOR + 3.4 });
}
void lotWindows; void WALL_T; void _f;

// the lot's own windows on its street face (lotWindows: the far build's lit
// panes and the near build's dark ones), of a kind and within a floor's
// height, with their place along the face in the room's frame (lx) - a room
// that looks out of them sets K.windows to them (their panes are taken out
// of the city's meshes, the shell is cut at them, a pane of glass is set in)
Places.prototype.faceWindows = function faceWindows(s, { kinds = ['shop'], y0 = 0, y1 = 4, x0 = -1e9, x1 = 1e9, skipDoor = true } = {}) {
  const out = [];
  for (const w of lotWindows(s.lot)) {
    if (w.nx !== s.door.nx || w.nz !== s.door.nz || !kinds.includes(w.kind) || w.y < y0 || w.y > y1) continue;
    const p = s.frame.l(w.x, w.z);
    if (p.x < x0 || p.x > x1) continue;
    if (skipDoor && Math.hypot(w.x - s.door.x, w.z - s.door.z) < 0.3) continue;
    out.push({ ...w, lx: p.x });
  }
  return out;
};
// the holes a room's wall on the street face needs for those windows (solid to walk)
Places.prototype.windowHoles = function windowHoles(list) {
  return list.map((w) => ({ a: w.lx - w.w / 2, b: w.lx + w.w / 2, bottom: w.y - w.h / 2, top: w.y + w.h / 2, win: true, own: true }));
};
// the holes the street doors need in a room's wall on a side ('s' the street face, ...)
Places.prototype.doorHoles = function doorHoles(s, side) {
  const out = [];
  for (const d of s.ldoors || []) {
    const sd = d.nz > 0 ? 's' : d.nz < 0 ? 'n' : d.nx > 0 ? 'e' : 'w';
    if (sd !== side) continue;
    const c = d.nz ? d.x : d.z;
    out.push({ a: c - d.w / 2 - 0.02, b: c + d.w / 2 + 0.02, top: FLOOR + 2.07 });
  }
  return out;
};
