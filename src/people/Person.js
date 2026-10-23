import * as THREE from 'three';
import { Figure } from '../cast/Figure.js';
import { Character } from '../cast/Character.js';
import { makeUmbrella } from '../scenes/watcher/umbrella.js';

// [O3] One of the city's people (lane O3, NOIR CITY): a figure of the cast
// (src/cast/: Figure on the Hood's skeleton, the costume's outline, its
// clips) with a small brain of its own. The crowd, the beat cops, the
// response's men on foot and the gangs' corner men are all Persons; what
// they do is their `mode` (below) and their role's brain (People, Police,
// Gangs) sets it. One step: the brain's wish (a heading and a gait), the
// figure's own locomotion (Hood.update), then the colliders (walls, posts,
// cars, the others) and the eye pushed out of him.
//   new Person(people, { kind, x, z, yaw, role, umbrella })
//   p.mode  walk stand flee cower watch gather report dash down dead hold ...
//   p.goTo(pts | {x, z}, { run, then })   p.flee(from, secs)   p.cower(from, secs)
//   p.knock(dir, { dead })   p.face(x, z)   p.say(sound)
// Modes are data the plays read (p.mode, p.t); the figure is p.c (a Character).
const _v = new THREE.Vector3();
let SEQ = 0;
export const GAIT = { walk: 1.25, stroll: 1.05, hurry: 1.7, run: 4.3, sprint: 5.2 };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Person {
  constructor(P, { kind, x, z, yaw = 0, role = 'walker', umbrella = false } = {}) {
    this.P = P;
    this.G = P.G;
    this.stage = P.stage;
    this.kind = kind;
    this.role = role;
    this.id = ++SEQ;
    const fig = new Figure(this.stage, { kind, pos: new THREE.Vector3(x, 0, z), yaw });
    this.fig = fig;
    this.c = new Character(this.stage.cast, fig, { kind, name: `${role}${this.id}`, own: true, brain: 'none' });
    this.c.person = this;
    fig.person = this;
    // (the cast's figures carry their props as part of who they are; in the
    // street an open umbrella over some, held in the right fist)
    this.umb = umbrella ? makeUmbrella(this.stage) : null;
    if (this.umb) this.umb.hold(fig);
    const rm = fig.onMove;
    fig.onMove = (h) => { if (rm) rm(h); this.resolve(); };
    this.r = (fig.collider ? fig.collider.r : 0.3);
    this.reset(x, z, yaw);
  }

  get pos() { return this.fig.pos; }
  get yaw() { return this.fig.yaw; }
  get alive() { return !this.dead; }
  get standing() { return !this.down && !this.dead; }
  get object() { return this.fig.object; }

  // (a pooled figure used again: as new where it is put)
  reset(x, z, yaw = 0) {
    const F = this.fig;
    F.pos.set(x, this.stage.surfaceY(x, z), z); F._prevPos.copy(F.pos); F.yaw = yaw; F._prevYaw = yaw;
    F.object.visible = true;
    this.mode = 'stand'; this.t = 0; this.life = 0;
    this.path = null; this.pi = 0; this.then = null; this.gait = 'walk';
    this.down = false; this.dead = false; this.hurt = 0; this.hits = 0;
    this.from = null; this.until = 0; this.watchAt = null; this.wantYaw = yaw;
    this.side = (Math.random() < 0.5 ? 0.35 : 0.75);
    this.fear = 0; this.calmT = 0; this.reportOf = null; this.box = null;
    this.speed = 0; this.blocked = 0; this.lastPos = { x, z }; this.stuckT = 0;
    this.seenBy = 0; this.outT = 0;
    this.c.down = false; this.c.hp = 100; this.c.state = 'idle'; this.c.base = 'idle'; this.c.clipH = null; this.c._koFall = null; this.gaitNow = null;
    if (F.collider && this.stage.colliders.circles.indexOf(F.collider) < 0) { this.stage.colliders.circles.push(F.collider); if (this.stage.colliders.moving) this.stage.colliders.moving.push(F.collider); }
    if (F.collider) { F.collider.x = x; F.collider.z = z; F.collider.person = this; }
    if (this.umb) { this.umb.hold(F); this.umb.group.visible = true; }
    this.setGait('idle', 0);
    F.update(0, 0);
  }

  // out of the world (back to the pool, or gone): hidden, no collider
  hide() {
    const F = this.fig, col = this.stage.colliders;
    F.object.visible = false;
    if (F.collider) { const i = col.circles.indexOf(F.collider); if (i >= 0) col.circles.splice(i, 1); }
    if (this.umb) this.umb.group.visible = false;
    this.mode = 'gone';
  }
  dispose() {
    this.hide();
    if (this.umb) { const g = this.umb.group; if (g.parent) g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.umb = null; }
    this.fig.dispose();
  }

  // ---- what the brain asks -------------------------------------------------------------------
  setGait(g, fade = 0.25) {
    const c = this.c, F = this.fig;
    if (this.gaitNow === g) return;
    this.gaitNow = g;
    const run = g === 'run' || g === 'sprint';
    if (g === 'idle') { F.speed = 0; c.clipH = null; c.setState('idle', fade); }
    else { F.speed = GAIT[g] || GAIT.walk; c.clipH = null; c.setState(run ? 'run' : 'walk', fade); }
    // (an umbrella is carried up in the right fist while it is held)
    if (this.umb && this.umb.state === 'held' && c.costumed && F.anim.setOverlay) F.anim.setOverlay(run ? null : 'carry', 0.25);
  }
  // follow a list of points [[x, z], ...] (or one {x, z}); then(): when there
  goTo(pts, { gait = 'walk', then = null } = {}) {
    if (!pts) return this;
    if (!Array.isArray(pts)) pts = [[pts.x, pts.z]];
    this.path = pts; this.pi = 0; this.gait = gait; this.then = then;
    this.mode = this.mode === 'report' || this.mode === 'flee' || this.mode === 'gather' || this.mode === 'chase' ? this.mode : 'walk';
    return this;
  }
  stop() { this.path = null; this.setGait('idle', 0.25); }
  face(x, z) { this.wantYaw = Math.atan2(x - this.pos.x, z - this.pos.z); }
  look(p) { if (p) this.c.lookAt(_v.set(p.x, (p.y ?? 0) + 1.55, p.z).clone()); else this.c.lookAt(null); }
  say(name, p = {}) { const S = this.G.sfx; if (S) S.play(name, _v.set(this.pos.x, this.pos.y + 1.6, this.pos.z).clone(), p, { ref: 4 }); }

  // run from a point for secs (a gun, a shot), along the pavement if it goes away
  flee(from, secs = 7, { cry = true } = {}) {
    if (!this.standing) return;
    const first = this.mode !== 'flee';
    this.mode = 'flee'; this.t = 0; this.until = secs; this.from = { x: from.x, z: from.z };
    if (first && cry && Math.random() < 0.55) this.say('o3_cry', { f0: this.kind === 'couple_her' ? 330 + Math.random() * 60 : 190 + Math.random() * 50 });
    // (the umbrella goes: dropped in the run)
    if (first && this.umb && this.umb.state === 'held') { this.umb.drop(_v.set(Math.sin(this.yaw) * 2, 1, Math.cos(this.yaw) * 2).clone()); if (this.fig.anim.setOverlay) this.fig.anim.setOverlay(null, 0.1); }
    this.path = this.P.awayPath(this.pos, from, 28 + Math.random() * 18);
    this.pi = 0; this.gait = 'run';
  }
  // back off from a thing (a fight), hands up, then watch it
  cower(from, secs = 4) {
    if (!this.standing) return;
    this.mode = 'cower'; this.t = 0; this.until = secs; this.from = { x: from.x, z: from.z };
    this.path = null; this.setGait('idle', 0.15);
    this.face(from.x, from.z);
    try { this.c.play('cower', { fade: 0.15, hold: true }); } catch (e) { /* */ }
  }
  watch(at, secs = 8) {
    if (!this.standing) return;
    this.mode = 'watch'; this.t = 0; this.until = secs; this.watchAt = { x: at.x, z: at.z };
    this.path = null; this.setGait('idle', 0.3); this.face(at.x, at.z);
    try { this.c.setState('watch', 0.4); } catch (e) { /* */ }
    this.gaitNow = 'watch';
  }

  // knocked down (a punch, a car, a round): hurt, or dead. dir: the blow's way
  knock(dir = null, { dead = false, by = 'player', why = 'punch' } = {}) {
    if (this.dead || (this.down && !dead)) return false;
    const F = this.fig, c = this.c;
    const wasDown = this.down;
    this.down = true; this.dead = dead; this.mode = dead ? 'dead' : 'down'; this.t = 0; this.path = null;
    this.downBy = by; this.downWhy = why;
    F.speed = 0;
    if (dir) {
      // (he falls away from it: his back to the blow)
      const a = Math.atan2(-dir.x, -dir.z);
      F.yaw = a; F._prevYaw = a;
    }
    if (!wasDown) {
      c.lookAt(null);
      try { c.ko('deathBack'); } catch (e) { F.die('deathBack'); }
      // a body is solid to things, not to feet: out of the walkers' colliders
      const col = this.stage.colliders, i = col.circles.indexOf(F.collider);
      if (i >= 0) col.circles.splice(i, 1);
      if (this.umb && this.umb.state === 'held') this.umb.drop(dir ? dir.clone().multiplyScalar(2).setY(1) : undefined);
    }
    if (dead) this.G.fx.bloodFx.pool(F, 0.95);
    return true;
  }

  // ---- one step ------------------------------------------------------------------------------
  step(dt) {
    this.t += dt; this.life += dt;
    const F = this.fig;
    if (this.down || this.dead) { F.speed = 0; return; }
    // the way: the next point of the path, kept to the right of it by `side`
    if (this.path && this.pi < this.path.length) {
      const [tx0, tz0] = this.path[this.pi];
      let tx = tx0, tz = tz0;
      // (keep right: offset from the leg's line toward its right by side; a
      // fleeing man takes the straight line)
      if (this.mode === 'walk' || this.mode === 'gather') {
        const prev = this.pi > 0 ? this.path[this.pi - 1] : [this.pos.x, this.pos.z];
        const lx = tx0 - prev[0], lz = tz0 - prev[1], ll = Math.hypot(lx, lz);
        if (ll > 0.5) { tx += (-lz / ll) * this.side; tz += (lx / ll) * this.side; }
      }
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      const reach = this.gait === 'run' || this.gait === 'sprint' ? 1.1 : 0.7;
      if (d < reach) {
        this.pi++;
        if (this.pi >= this.path.length) {
          this.path = null;
          const th = this.then; this.then = null;
          this.setGait('idle', 0.3);
          if (th) th(this);
        }
      } else {
        this.wantYaw = Math.atan2(dx, dz);
        this.setGait(this.gait);
      }
    } else if (this.gaitNow !== 'idle' && this.gaitNow !== 'watch' && this.mode !== 'cower') this.setGait('idle', 0.3);
    // the steering: away from the others close by and from the eye
    let ax = 0, az = 0;
    const near = this.P.near(this.pos.x, this.pos.z, 1.4);
    for (const o of near) {
      if (o === this || !o.standing) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 1.3 && od > 1e-3) { const k = (1.3 - od) / 1.3; ax += (ox / od) * k; az += (oz / od) * k; }
    }
    const E = this.G.eye, ex = this.pos.x - E.x, ez = this.pos.z - E.z, ed = Math.hypot(ex, ez);
    if (ed < 1.6 && ed > 1e-3 && F.speed > 0) { const k = (1.6 - ed) / 1.6 * 1.6; ax += (ex / ed) * k; az += (ez / ed) * k; }
    let want = this.wantYaw;
    if ((ax || az) && F.speed > 0) {
      const fx = Math.sin(want) + ax * 0.9, fz = Math.cos(want) + az * 0.9;
      want = Math.atan2(fx, fz);
    }
    const turn = F.speed > 3 ? 5 : 3.2;
    const dy = wrap(want - F.yaw);
    F.yaw += Math.sign(dy) * Math.min(Math.abs(dy), turn * dt);
    // (stuck - walking and not getting anywhere for 3 s: the next point, or give up the way)
    if (F.speed > 0.5) {
      const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
      this.stuckT = moved < F.speed * dt * 0.25 ? this.stuckT + dt : Math.max(0, this.stuckT - dt);
      if (this.stuckT > 3) { this.stuckT = 0; if (this.path && this.pi < this.path.length - 1) this.pi++; else { this.path = null; this.setGait('idle'); } }
    }
    this.lastPos.x = this.pos.x; this.lastPos.z = this.pos.z;
  }

  // after the figure's own locomotion: out of the walls, the posts, the cars,
  // the others and the eye (Hood.update calls it through onMove)
  resolve() {
    if (this.down || this.dead) return;
    const F = this.fig, col = this.stage.colliders;
    col.resolve(F.pos, this.r, F.collider);
    const E = this.G.eye, dx = F.pos.x - E.x, dz = F.pos.z - E.z, d = Math.hypot(dx, dz), m = this.r + 0.36;
    if (d < m && d > 1e-4 && !this.G.city?.inCar) { F.pos.x = E.x + dx / d * m; F.pos.z = E.z + dz / d * m; }
  }

  // the figure's pose and the umbrella (every step; a far man's pose is cheap: LOD)
  update(dt, t, camera) {
    this.c.update(dt, t, camera);
    if (this.fig.collider) { this.fig.collider.x = this.pos.x; this.fig.collider.z = this.pos.z; }
    if (this.umb) this.umb.update(dt);
  }
}
