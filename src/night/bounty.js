import * as THREE from 'three';
import { RNG } from '../util/rng.js';
import { frayEdges, blob } from '../ui/inkArt.js';
import { LETTER_FONT } from '../ui/lettering.js';
import { tagInk, allocInkId } from '../render/layers.js';
import { DISTRICTS } from '../world/plan.js';
import { crowdOf } from '../combat/brawl/Crowd.js';
import { kitUse, kitFree, rayHits } from './patrol.js';
import { armFigure } from '../cast/arm.js';   // [O8]
import { drawnGun } from './fist.js';
import { input } from '../input/Pad.js';

// The bounty board (lane O7, docs/seams/NIGHT.md §5) by the police
// headquarters' door: three names a night, each with a photo and the
// district under it, and nothing else - no arrow, no count, no line. E at
// the board: the card (the game held while it is read; E or ESC puts it
// away). A man on the board stands on a corner of his turf (O3's gang man
// when O3 merges; until then O4's hood of the crowd brawl, put on his corner
// as I come within 110 m); taken down, his poster is crossed, and E at the
// board pays it ($ at the desk: O5's when the station's room merges).
// [O7] after the critic (B2: 'a contest that cannot be lost' - he stood with
// his back to me, took three jabs and a revolver at arm's length): he is a
// man now (THINGS_TO_DO §5).
//   he notices   me within 8 m, or watching him from 16 m for 3 s: he turns,
//                'Looking for me?', and comes at me with his fists - O4's crowd
//                brawl (he gets up once; up again he runs: losing, he runs)
//                a gun drawn within 25 m of him, or a shot within 40 m: he
//                draws too - the gun kit's gang gunman (cover from the world,
//                the raise and the glint); hurt past half, he runs for it
//   I lose       down to him: the hospital (the black names him), he is back on
//                his corner, nothing lost but the stitches
//   I win        down with my fists: E 'take him in' - 'Come on.', he walks off
//                to the station: the full reward; dead (a round): half; got
//                away ('He got away.'): back on his corner when I come again
// [O5b] (brief O5b §2) one board: the posters hang on the sheets of the headquarters' hall (src/places/rooms/
// police.js draws them from poster() below; the board outside the door is gone); a man taken in follows me
// ('Come on.': on foot at my heels, in the back of my car) to the sergeant's desk, where E books him ('Book
// him.': the reward through game.money, game.things.end, the poster PAID, the man walked to a cell); lost on
// the way (left 70 m behind, or a fall) he is back on his corner. A dead man's half is paid at the desk.
export const BOUNTY = { reach: 2.2, near: 110, far: 220, rewards: [150, 250, 400], notice: 8, watch: 16, watchT: 3, gun: 25, heard: 40, half: 0.5, take: 2.2, runHp: 0.45, away: 60, runSp: 3.3, lost: 32, runT: 15 };
const FIRST = ['Sal', 'Vito', 'Eddie', 'Lou', 'Frankie', 'Mickey', 'Nate', 'Joey', 'Carmine', 'Duke', 'Rocco', 'Benny'];
const LAST = ['Moretti', 'Kane', 'Doyle', 'Russo', 'Malloy', 'Brandt', 'Costa', 'Quinn', 'Falco', 'Ricci', 'Shea', 'Varga'];
const NICK = ['the Knife', 'Two-Bits', 'the Ox', 'Lucky', 'the Priest', 'Spats', 'the Weasel', 'Blue'];
const TURF = ['docks', 'tenements'];
const _v = new THREE.Vector3(), _dir = new THREE.Vector3(), _ray = new THREE.Vector3(), _door = new THREE.Vector3();

export class Bounty {
  constructor(night) {
    this.night = night;
    this.open = false;
    this.list = null;
    this.men = new Map();
    this.prompted = false;
    this.paid = 0;
    const G = night.game;
    G.on('night:start', () => { this.list = null; this.dropAll(); });
    G.on('scene:enter', () => { this.dropAll(); this.boardMesh = null; this.place = null; });
    // (a shot heard near a man on his corner: he draws; a round of mine through him there: he is hit, and draws)
    G.on('shot', () => { for (const M of this.men.values()) { if (M.mode === 'corner' || M.mode === 'turn' || M.mode === 'come') this.heard(M); else if (M.mode === 'run' && !M.crowdRun && M.c && !M.c.down && rayHits(G, M.c.pos)) { M.c.ko('deathBack'); this.dead(M); } } });
    // (a man running from the fight shot down by the crowd brawl's round)
    G.on('crowd:shot', (e) => { const F = crowdOf(G), m = F.men && F.men[e.man]; for (const M of this.men.values()) if (m && m.c === M.c) this.dead(M); });
    G.on('crowd:up', (e) => { const F = crowdOf(G), m = F.men && F.men[e.man]; for (const M of this.men.values()) if (m && m.c === M.c && M.mode === 'fight') this.flee(M, m); });
  }
  // ([O5b] a man I was leading is lost with the scene - a fall, a beat: back on his corner)
  dropAll() { for (const M of this.men.values()) { if (M.mode === 'led') this.lose(M, true); this.drop(M); } this.men.clear(); kitFree(this.night, 'bounty'); }
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

  // [O5b] the board outside the headquarters' door is gone: the posters are on the hall's sheets
  // (src/places/rooms/police.js), the desk inside pays
  board() { return null; }
  // the station's site (O5's police headquarters)
  hq() { const P = this.G.city && this.G.city.places; return P ? P.byId.get('police') : null; }

  step(dt) {
    const N = this.night, G = this.G;
    if (!N.inCity || G.failing || N.el.riding) { if (this.prompted) this.prompt(false); return; }
    const L = this.names();
    // the men on their corners: put there as I come near, taken away far off
    const e = G.eye;
    let take = null;
    for (const b of L) {
      const d = Math.hypot(e.x - b.x, e.z - b.z);
      let M = this.men.get(b.id);
      if (b.state === 'out' && !M && d < BOUNTY.near && !(b.awayT && G.time - b.awayT < 90 && d > BOUNTY.near * 0.5)) M = this.spawn(b);
      // ([O5b] a man I lead is mine, however far from his corner; one in a cell goes when I am well away)
      const held = M && (M.mode === 'led' || M.mode === 'booked' || M.mode === 'jailed');
      if (M && ((d > BOUNTY.far && !held) || M.mode === 'gone' || (M.mode === 'jailed' && Math.hypot(e.x - M.pos.x, e.z - M.pos.z) > 70))) { this.drop(M); this.men.delete(b.id); continue; }
      if (M) { this.stepMan(M, dt); if (M.mode === 'beaten' && Math.hypot(M.pos.x - e.x, M.pos.z - e.z) < BOUNTY.take) take = M; }
    }
    const R = G.city;
    if (R && R.inCar) { if (this.prompted) this.prompt(false); return; }
    // a man beaten on the pavement: E takes him in
    if (take) {
      this.prompt(true, 'E  take him in');
      if (G.keysDown.has('KeyE')) { G.keysDown.delete('KeyE'); this.takeIn(take); }
      return;
    }
    if (this.prompted) this.prompt(false);
  }
  // what the board owes: a man taken in his reward, a dead one half of it (THINGS_TO_DO §5)
  // [O5b] (a man taken in is paid when he is booked at the desk: owed is the dead men's halves)
  owed(L = this.names()) { return L.reduce((a, b) => a + (b.state === 'dead' || b.state === 'down' ? Math.round(b.reward * BOUNTY.half) : 0), 0); }

  // ---- the man ------------------------------------------------------------------------
  stepMan(M, dt) {
    const G = this.G, e = G.eye, R = G.city, F = crowdOf(G);
    M.t += dt;
    const p = M.pos, d = Math.hypot(e.x - p.x, e.z - p.z);
    const onFoot = !(R && R.inCar) && !(R && R.places && R.places.inside);
    // (nothing between us: the graph's 2D test - or, where it says no (a man on a lot's corner), the eye's own ray to his head)
    const clear = () => {
      const g = this.night.graph();
      if (!g || g.lineOfSight(p.x, p.z, e.x, e.z) !== false) return true;
      const to = _ray.set(p.x - e.x, (p.y || 0) + 1.6 - e.y, p.z - e.z), L = to.length();
      return L < 0.5 || !G.rays.raycast(e.clone(), to.normalize(), L - 0.4);
    };
    if (M.mode === 'gun') {
      const h = M.h;
      if (!h || !h.alive) { if (h && !M.removed) this.dead(M); return; }
      // hurt past half: he runs for it
      if (h.hp < M.max * BOUNTY.runHp) this.runGun(M);
      if (d > BOUNTY.away) { this.gotAway(M); }
      return;
    }
    if (M.mode === 'run') { this.stepRun(M, dt); return; }
    if (M.mode === 'booked' || M.mode === 'jailed') { if (M.mode === 'booked') this.stepBooked(M, dt); return; }
    if (M.mode === 'fight' || M.mode === 'beaten' || M.mode === 'led') { if (M.mode === 'led') this.stepLed(M, dt); if (M.mode === 'fight' && M.c && !M.c.alive && !F.active) M.mode = 'beaten'; return; }
    if (!M.c || !M.c.alive) return;
    // a gun of mine out near him: he draws too
    if (drawnGun(G) && d < BOUNTY.gun && clear()) { this.toGun(M); return; }
    if (M.mode === 'corner') {
      // watched: looked at from close for a while
      const f = G.camera.getWorldDirection(_dir);
      const look = d > 0.5 ? ((p.x - e.x) * f.x + (p.z - e.z) * f.z) / (d * (Math.hypot(f.x, f.z) || 1)) : 1;
      M.watched = d < BOUNTY.watch && look > 0.94 && clear() ? M.watched + dt : Math.max(0, M.watched - dt);
      if (onFoot && ((d < BOUNTY.notice && clear()) || M.watched > BOUNTY.watchT)) this.notice(M);
      else if (d < BOUNTY.notice * 1.5 && !onFoot) M.c.lookAt(new THREE.Vector3(e.x, e.y, e.z));
      return;
    }
    // turned: he says it, then he comes at me with his fists
    if (M.mode === 'turn' || M.mode === 'come') {
      this.face(M.c, Math.atan2(e.x - p.x, e.z - p.z), dt);
      if (!onFoot || d > BOUNTY.watch + 4) { if (M.t > 6) this.back(M); return; }
      if (M.mode === 'turn' && M.t < 1.3) return;
      // (close enough: the crowd brawl's own feet bring him in - and never left stuck on a post or a
      // corner walking at me: after 6 s of it, within 12 m, the fight begins where he stands)
      if ((d < 4.5 || (M.mode === 'come' && M.t > 7.3 && d < 12)) && !F.active && !G.failing) { this.fight(M); return; }
      if (M.mode !== 'come') { M.mode = 'come'; try { M.c.setState('walk', 0.25); } catch (err) { /* */ } }
      const sp = 1.7, x0 = p.x, z0 = p.z, a = Math.atan2(e.x - p.x, e.z - p.z);
      const q = _v.set(x0 + Math.sin(a) * sp * dt, 0, z0 + Math.cos(a) * sp * dt);
      G.stage.colliders.resolve(q, 0.35, M.c.fig && M.c.fig.collider);
      // (a post in his way: a step to his side round it)
      if (Math.hypot(q.x - x0, q.z - z0) < sp * dt * 0.3) { const sa = a + (M.b.seed % 2 ? 1.3 : -1.3); q.set(x0 + Math.sin(sa) * sp * dt, 0, z0 + Math.cos(sa) * sp * dt); G.stage.colliders.resolve(q, 0.35, M.c.fig && M.c.fig.collider); }
      M.c.pos.x = q.x; M.c.pos.z = q.z; if (M.c.object) { M.c.object.position.x = q.x; M.c.object.position.z = q.z; }
      M.c.speed = sp;
    }
  }
  face(c, yaw, dt) { const dy = Math.atan2(Math.sin(yaw - c.yaw), Math.cos(yaw - c.yaw)); c.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 6 * dt); }
  short(b) { return b.name.replace(/"[^"]*" /, ''); }

  notice(M) {
    const G = this.G;
    M.mode = 'turn'; M.t = 0;
    M.c.lookAt(G.eye.clone());
    try { M.c.setState('idle', 0.2); } catch (err) { /* */ }
    if (G.hud.say) G.hud.say(M.b.reward >= 400 ? 'You lost, friend?' : 'Looking for me?', 1.8, { always: true });
    G.emit('bounty:notice', { id: M.b.id });
  }
  back(M) {
    M.mode = 'corner'; M.t = 0; M.watched = 0;
    M.c.lookAt(null);
    try { M.c.setState('idle', 0.4); } catch (err) { /* */ }
  }
  // my fist on him (night/fist.js): the fight at once (a man running: brought down)
  onFist(M) {
    const G = this.G, F = crowdOf(G);
    if (M.mode === 'run') { M.c.ko('deathBack'); this.beaten(M); return; }
    if (F.active || G.failing) return;
    this.fight(M);
    F.inputStep(0);   // (the press that started it is my first jab)
  }
  fight(M) {
    const G = this.G, F = crowdOf(G), b = M.b, who = this.short(b);
    M.mode = 'fight'; M.t = 0;
    M.c.lookAt(null);
    F.start({ men: [{ kind: 'gangster', c: M.c, name: who.split(' ').pop().toUpperCase() }], leave: true, seed: 5300 + b.seed % 1000, mercy: Math.min(3, b.falls || 0),
      onDown: () => { b.falls = (b.falls || 0) + 1; return { why: `${who} put you down.`, to: 'hospital' }; },
      onEnd: (r) => {
        if (r === 'won') this.beaten(M);
        // (I walked off: he walks off too, back on his corner another time; my gun drawn: he runs from it -
        // a round may find him, crowd:shot - the crowd brawl's men going off are its own until it lets them go)
        else if (r === 'left' || r === 'drawn') { M.mode = 'run'; M.crowdRun = true; M.quiet = r === 'left'; M.t = 0; }
      } });
    G.emit('bounty:fight', { id: b.id });
  }
  // losing, he runs (up again after his first fall): the fight is over, he is off at a hurt man's pace
  flee(M, m) {
    const G = this.G, F = crowdOf(G);
    F.finish('fled');
    M.mode = 'run'; M.crowdRun = false; M.t = 0; M.ang = Math.atan2(M.c.pos.x - G.eye.x, M.c.pos.z - G.eye.z);
    M.c.down = false;
    try { M.c.setState('run', 0.3); } catch (err) { /* */ }
    void m;
    if (G.hud.say) G.hud.say('He’s running.', 1.8, { always: true });
    G.emit('bounty:run', { id: M.b.id });
  }
  stepRun(M, dt) {
    const G = this.G, c = M.c;
    if (!c || c.down) return;
    if (M.crowdRun) { if (!G.cast.list.includes(c)) { if (M.quiet) { M.b.awayT = G.time; M.mode = 'gone'; } else this.gotAway(M); } return; }
    const sp = BOUNTY.runSp;
    const q = _v.set(c.pos.x + Math.sin(M.ang) * sp * dt, 0, c.pos.z + Math.cos(M.ang) * sp * dt);
    G.stage.colliders.resolve(q, 0.35, c.fig && c.fig.collider);
    if (Math.hypot(q.x - c.pos.x, q.z - c.pos.z) < sp * dt * 0.3) M.ang += (M.b.seed % 2 ? 1 : -1) * 2.4 * dt;
    c.pos.x = q.x; c.pos.z = q.z; if (c.object) { c.object.position.x = q.x; c.object.position.z = q.z; }
    this.face(c, M.ang, dt); c.speed = sp;
    if (Math.hypot(c.pos.x - G.eye.x, c.pos.z - G.eye.z) > BOUNTY.lost || M.t > BOUNTY.runT) this.gotAway(M);
  }
  beaten(M) {
    const G = this.G;
    M.mode = 'beaten'; M.t = 0;
    G.emit('bounty:beaten', { id: M.b.id });
  }
  takeIn(M) {
    const G = this.G, b = M.b;
    this.prompt(false);
    b.state = 'taken';
    M.mode = 'led'; M.t = 0; M.far = 0; M.walk = null;
    if (G.hud.say) G.hud.say('Come on.', 1.8, { always: true });
    try { M.c.down = false; M.c.play('o4_getUp', { fade: 0.2, hold: true }); } catch (err) { /* */ }
    // [O5b] the thing taken up: the line, the mark on the headquarters' door (game.things)
    const S = this.hq();
    if (G.things) G.things.start('bounty_' + b.id, { line: 'Take him to headquarters.', at: S ? { x: S.door.x, z: S.door.z } : null });
    if (G.news) G.news.say(`${this.short(b)} TAKEN IN, ${b.district}`);
    G.emit('bounty:taken', { id: b.id, name: b.name });
  }
  // [O5b] taken in: up off the pavement, he follows me - at my heels on foot (a walk, a run when I
  // run), into the back of my car when I get in near him and out of it when I get out, through a
  // door behind me; left 70 m behind for 8 s he is lost: back on his corner.
  // After the critic: he follows the way I went (a trail of my steps, or my car's), never put
  // anywhere out of my sight (M.trail; the old 24 m catch-up is gone); he walks to the car's back door
  // and gets in only when it stands (M1: he vanished the frame I pressed E); 'He's falling behind.'
  // from 40 m before he is lost at 70 (WAVE_C rule 2); in my face he steps back to 2 m (M2)
  stepLed(M, dt) {
    const G = this.G, c = M.c, R = G.city;
    if (!c || M.t < 1.6) return;
    const me = G.controller.pos;
    const car = R && R.inCar ? R.car : null;
    const col = c.fig && c.fig.collider;
    const put = (q) => { c.pos.x = q.x; c.pos.z = q.z; if (c.object) { c.object.position.x = q.x; c.object.position.z = q.z; } };
    const T = M.trail || (M.trail = []);
    // the trail: a point every 0.8 m of the way I went (on foot, or my car's way down the road)
    { const at = car ? car.pos : me, last = T[T.length - 1]; if (!last || Math.hypot(at.x - last.x, at.z - last.z) > 0.8) { T.push({ x: at.x, z: at.z }); if (T.length > 400) T.shift(); } }
    let goal = null, goalSp = 0;
    if (car) {
      if (M.inCar) { put(car.pos); M.far = 0; this.warnFar(M, false); return; }
      // the car's back door on his side: he walks to it (runs, from far) and gets in while it stands
      const side = car.local(c.pos, _v).z >= 0 ? 1 : -1;
      const door = car.world(-car.spec.halfL * 0.3, side * (car.spec.halfW + 0.42), _door);
      const dd = Math.hypot(door.x - c.pos.x, door.z - c.pos.z), still = car.speedAbs < 1.2;
      if (still && dd < 0.5) {
        M.inCar = true; T.length = 0;
        if (c.object) c.object.visible = false;
        if (col) col.gone = true;
        this.walkState(M, 'idle');
        G.sfx.play('b7_carDoor', new THREE.Vector3(door.x, 1.0, door.z));
        G.emit('bounty:boarded', { id: M.b.id });
        return;
      }
      if (still && Math.hypot(c.pos.x - car.pos.x, c.pos.z - car.pos.z) < 12) { goal = door; goalSp = dd > 3 ? 4.6 : 1.6; T.length = 0; }
    } else if (M.inCar) {
      // (out of the back as I get out: at the back door on my side, behind me)
      M.inCar = false; T.length = 0;
      const f = G.camera.getWorldDirection(_dir);
      const q = _v.set(me.x - f.x * 1.4, 0, me.z - f.z * 1.4);
      G.stage.colliders.resolve(q, 0.35, col);
      put(q);
      if (c.object) c.object.visible = true;
      if (col) col.gone = false;
    }
    const d = Math.hypot(me.x - c.pos.x, me.z - c.pos.z);
    // (through a place's door behind me, in or out: he steps through at my back - a door I just went
    // through, him a few strides behind it, never across the city)
    const P = R && R.places;
    if (P && P.list && !car && d < 12) {
      const lotOf = (x, z) => P.list.find((s) => s.lot && x > s.lot.x0 && x < s.lot.x1 && z > s.lot.z0 && z < s.lot.z1) || null;
      const mine = P.inside || null, his = lotOf(c.pos.x, c.pos.z);
      if (mine !== his) {
        const f = G.camera.getWorldDirection(_dir); const q = _v.set(me.x - f.x * 1.3, 0, me.z - f.z * 1.3);
        G.stage.colliders.resolve(q, 0.35, col);
        if (lotOf(q.x, q.z) === mine) { put(q); T.length = 0; return; }
      }
    }
    // lost: left far behind for a while - warned first
    this.warnFar(M, M.warned ? d > 30 : d > 40);
    M.far = d > 70 ? M.far + dt : 0;
    if (M.far > 8) { this.lose(M); return; }
    if (!goal) {
      // close: straight to me (the trail behind him forgotten); in my face: a step back
      if (d < 5) T.length = 0;
      if (d < 1.2) M.back = true; else if (d > 1.9) M.back = false;
      if (M.back) {
        const a = Math.atan2(c.pos.x - me.x, c.pos.z - me.z), sp = 1.1;
        const q = _v.set(c.pos.x + Math.sin(a) * sp * dt, 0, c.pos.z + Math.cos(a) * sp * dt);
        G.stage.colliders.resolve(q, 0.35, col); put(q);
        this.walkState(M, 'idle'); this.face(c, a + Math.PI, dt); c.speed = 0;
        return;
      }
      if (d < 2.0) { this.walkState(M, 'idle'); this.face(c, Math.atan2(me.x - c.pos.x, me.z - c.pos.z), dt); c.speed = 0; return; }
      // far: along the trail (the points he has passed dropped; a later one nearer him taken)
      while (T.length > 1 && (Math.hypot(T[0].x - c.pos.x, T[0].z - c.pos.z) < 0.7 || Math.hypot(T[1].x - c.pos.x, T[1].z - c.pos.z) < Math.hypot(T[0].x - c.pos.x, T[0].z - c.pos.z))) T.shift();
      goal = T.length && d > 5 ? T[0] : me;
      goalSp = d > 12 ? 6.2 : d > 5 ? 4.6 : 1.5;
    }
    const sp = goalSp;
    this.walkState(M, sp > 2 ? 'run' : 'walk');
    let a = Math.atan2(goal.x - c.pos.x, goal.z - c.pos.z);
    const q = _v.set(c.pos.x + Math.sin(a) * sp * dt, 0, c.pos.z + Math.cos(a) * sp * dt);
    G.stage.colliders.resolve(q, 0.35, col);
    if (Math.hypot(q.x - c.pos.x, q.z - c.pos.z) < sp * dt * 0.3) { a += (M.b.seed % 2 ? 1.3 : -1.3); q.set(c.pos.x + Math.sin(a) * sp * dt, 0, c.pos.z + Math.cos(a) * sp * dt); G.stage.colliders.resolve(q, 0.35, col); }
    put(q);
    this.face(c, a, dt); c.speed = sp;
  }
  // [O5b] the kit's warning line while the man I lead falls behind (cleared when he is near again, in the car, or lost)
  warnFar(M, on) {
    const G = this.G, W = 'He\u2019s falling behind.';
    if (on && !M.warned) { M.warned = true; G.hud.warn(W); }
    else if (!on && M.warned) { M.warned = false; if (G.hud.warnText === W) G.hud.warn(null); }
  }
  walkState(M, st) { if (M.walk === st) return; M.walk = st; try { M.c.setState(st, 0.25); } catch (err) { /* */ } }
  // [O5b] the man I was leading lost (left behind, or the night went on without him): back on his corner
  lose(M, quiet = false) {
    const G = this.G, b = M.b;
    this.warnFar(M, false);
    if (M.c && M.c.object) M.c.object.visible = true;
    b.state = 'out'; b.awayT = G.time;
    M.mode = 'gone';
    if (G.things && G.things.active.has('bounty_' + b.id)) G.things.end('bounty_' + b.id, { result: 'lost' });
    if (!quiet && G.hud.say) G.hud.say('He got away.', 2.0, { always: true });
    G.emit('bounty:away', { id: b.id });
  }
  // [O5b] the man I lead within reach of me (the desk books him)
  ledNear(r = 7) {
    const e = this.G.controller.pos;
    for (const M of this.men.values()) if (M.mode === 'led' && !M.inCar && M.c && M.t > 1.6 && Math.hypot(M.c.pos.x - e.x, M.c.pos.z - e.z) < r) return M;
    return null;
  }
  // [O5b] E at the sergeant's desk with him at hand: booked - the reward, the poster PAID, and he is
  // walked through the cells' door to a cell (path: world points from the room; path.sit: the bench)
  book(M, path = []) {
    const G = this.G, b = M.b;
    b.state = 'paid'; b.paidHalf = false;
    this.paid += b.reward;
    M.mode = 'booked'; M.t = 0; M.path = path.map((p) => ({ x: p.x, z: p.z })); M.sitAt = path.sit || null;
    if (G.hud.say) G.hud.say('Book him.', 1.6, { always: true });
    if (G.things && G.things.active.has('bounty_' + b.id)) G.things.end('bounty_' + b.id, { result: 'booked', money: b.reward, news: `${this.short(b).toUpperCase()} BOOKED AT HEADQUARTERS`, where: b.district });
    else G.money.add(b.reward, 'bounty');
    G.emit('bounty:booked', { id: b.id, name: b.name, reward: b.reward });
  }
  // walked to his cell by the path, then sat on its bench
  stepBooked(M, dt) {
    const c = M.c;
    if (!c || M.t < 0.8) return;
    const t = M.path && M.path[0];
    if (!t) {
      M.mode = 'jailed'; this.walkState(M, 'idle');
      if (M.sitAt) { try { c.sit({ pos: new THREE.Vector3(M.sitAt.x, M.sitAt.y, M.sitAt.z), yaw: M.sitAt.yaw, name: 'bench' }); c.setState('sitSmoke', 0.4); } catch (err) { /* */ } }
      this.G.emit('bounty:jailed', { id: M.b.id });
      return;
    }
    const dx = t.x - c.pos.x, dz = t.z - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { M.path.shift(); return; }
    this.walkState(M, 'walk');
    const sp = Math.min(1.4, d / Math.max(dt, 1e-3));
    c.pos.x += (dx / d) * sp * dt; c.pos.z += (dz / d) * sp * dt;
    if (c.object) { c.object.position.x = c.pos.x; c.object.position.z = c.pos.z; }
    this.face(c, Math.atan2(dx, dz), dt); c.speed = 1.4;
  }
  // a dead man's half (any owed): paid at the desk
  collect() {
    const G = this.G, L = this.names();
    const owed = L.filter((b) => b.state === 'down' || b.state === 'dead');
    if (!owed.length) return 0;
    const sum = this.owed(L);
    for (const b of owed) { b.paidHalf = true; b.state = 'paid'; }
    this.paid += sum;
    G.money.add(sum, 'bounty');
    G.emit('bounty:paid', { sum });
    return sum;
  }
  dead(M) {
    const G = this.G, b = M.b;
    if (b.state !== 'out') return;
    b.state = 'dead';
    if (M.mode === 'gun') { kitFree(this.night, 'bounty'); }
    M.mode = 'dead';
    G.emit('bounty:down', { id: b.id, name: b.name });
    if (G.news) G.news.say(`${this.short(b)} SHOT DEAD IN ${b.district}`);
  }
  gotAway(M) {
    const G = this.G;
    if (M.mode === 'gone') return;
    M.b.awayT = G.time;
    if (M.mode === 'gun') kitFree(this.night, 'bounty');
    M.mode = 'gone';
    if (G.hud.say) G.hud.say('He got away.', 2.0, { always: true });
    G.emit('bounty:away', { id: M.b.id });
  }
  // a shot near him on his corner: he heard it - he draws (a round through him first: hurt)
  heard(M) {
    const G = this.G, p = M.pos, d = Math.hypot(G.eye.x - p.x, G.eye.z - p.z);
    if (d > BOUNTY.heard) return;
    const hit = M.c && rayHits(G, p, BOUNTY.heard);
    this.toGun(M, hit ? 0.5 : 1);
  }
  // he draws: the gun kit's gang gunman where he stood (the street's encounter: the hospital if he puts me down)
  toGun(M, hpK = 1) {
    const G = this.G, b = M.b, p = { x: M.pos.x, z: M.pos.z }, e = G.eye;
    const A = 30;
    if (!G.guns || !G.guns.active) G.stage.part('bounds').navAround(p.x, p.z, A + 6);
    const K = kitUse(this.night, 'bounty', { area: { x0: p.x - A, x1: p.x + A, z0: p.z - A, z1: p.z + A }, to: 'hospital', maxFiring: 2, flankAfter: 14, settleK: 1.4, dmgK: 0.8,
      why: { open: `${this.short(b)} shot you in the open.`, moving: `${this.short(b)} shot you in the open.`, bare: `${this.short(b)} shot you. Get behind something.` } });
    if (!K) return;
    const r = new RNG(b.seed);
    // [O8] the man himself draws (his own figure to the gun kit: src/cast/arm.js) - no other man
    // made where he stood; a new gunman only if he has no figure standing
    const own = M.c && M.c.fig && M.c.fig.alive && !M.c.down;
    const h = own ? armFigure(G, K, M.c, { kind: 'pistol' })
      : K.spawn({ kind: 'pistol', at: p, way: { steps: [{ x: p.x, z: p.z }] }, cover: true, yaw: Math.atan2(e.x - p.x, e.z - p.z),
        variant: { coat: Math.floor(r.next() * 3), brim: Math.floor(r.next() * 2), tall: Math.floor(r.next() * 2), cig: r.next() < 0.5 } });
    h.bountyId = b.id;
    if (hpK < 1) h.hp = Math.round(h.hp * hpK);
    if (!own) { try { G.cast.remove(M.c); } catch (err) { /* */ } }
    M.c = null; M.h = h; M.max = h.hp / hpK; M.mode = 'gun'; M.t = 0;
    if (G.hud.say) G.hud.say('Wrong man to draw on.', 1.8, { always: true });
    G.emit('bounty:gun', { id: b.id });
  }
  // the gunman hurt past half: his brain let go, he runs off the way he faces from me
  runGun(M) {
    const G = this.G, h = M.h;
    if (M.ran) return;
    M.ran = true;
    const ai = G.ais.get(h);
    if (ai) { try { ai.release(); } catch (err) { /* */ } G.ais.delete(h); }
    try { h.setState && h.setState('run'); } catch (err) { /* */ }
    M.runAng = Math.atan2(h.pos.x - G.eye.x, h.pos.z - G.eye.z);
    M.mode = 'gunrun';
    if (G.hud.say) G.hud.say('He’s running.', 1.8, { always: true });
    const step = (t, dt) => {
      if (M.mode !== 'gunrun' || !h.alive) { const i = G.scripts.indexOf(step); if (i >= 0) G.scripts.splice(i, 1); if (!h.alive && M.mode === 'gunrun') this.dead(M); return; }
      const q = _v.set(h.pos.x + Math.sin(M.runAng) * 4.2 * dt, 0, h.pos.z + Math.cos(M.runAng) * 4.2 * dt);
      G.stage.colliders.resolve(q, 0.32, h.collider);
      if (Math.hypot(q.x - h.pos.x, q.z - h.pos.z) < 4.2 * dt * 0.3) M.runAng += 2.2 * dt;
      h.pos.x = q.x; h.pos.z = q.z; h.yaw = M.runAng;
      if (Math.hypot(h.pos.x - G.eye.x, h.pos.z - G.eye.z) > 45) { this.gotAway({ ...M, mode: 'gun' }); M.mode = 'gone'; kitFree(this.night, 'bounty'); }
    };
    G.scripts.push(step);
  }
  prompt(on, text) {
    const H = this.G.hud;
    if (on && (!this.prompted || H.promptShown !== text)) H.prompt(text, null, 'nbounty');
    else if (!on && this.prompted) H.clearPrompt('nbounty');
    this.prompted = on;
  }

  // a man on his corner: O4's hood (the crowd brawl's 'gangster'), idle, facing the street
  spawn(b) {
    const G = this.G;
    const r = new RNG(b.seed);
    let c = null;
    try { c = G.cast.spawn('o4_gangster', { at: { x: b.x, z: b.z }, yaw: r.next() * Math.PI * 2, name: 'wanted_' + b.id }); } catch (err) { return null; }
    try { c.setState('idle', 0); } catch (err) { /* */ }
    const M = { b, c, h: null, mode: 'corner', t: 0, watched: 0, get pos() { return this.h ? this.h.pos : this.c ? this.c.pos : { x: b.x, z: b.z }; }, get alive() { return this.h ? this.h.alive : !!(this.c && this.c.alive); } };
    c.bountyId = b.id;
    c.onFist = () => this.onFist(M);
    this.men.set(b.id, M);
    return M;
  }
  drop(M) {
    const G = this.G;
    if (!M) return;
    M.removed = true;
    try {
      if (M.c && G.cast.list.includes(M.c) && !(crowdOf(G).active && crowdOf(G).men.some((m) => m.c === M.c))) G.cast.remove(M.c);
      if (M.h && M.h.alive) G.removeHood(M.h);
    } catch (e) { /* gone with the stage */ }
    if (M.mode === 'gun' || M.mode === 'gunrun') kitFree(this.night, 'bounty');
  }

  // [O5b] E at the hall's board: the card (the desk pays)
  use() { this.openCard(); }

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
    // ([O7] after the critic, m1: the pad's circle puts it back too)
    if (G.keysDown.has('KeyE') || G.keysDown.has('Escape') || G.hud.paused || (G.keysDown.has('KeyC') && input.last === 'pad')) { G.keysDown.delete('KeyE'); G.keysDown.delete('KeyC'); this.closeCard(); }
  }
}

// a wanted poster: the photo (a man under his hat brim, in ink), the name,
// the district, the reward; crossed through when he is down, PAID when paid
export function poster(b) {
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
  // [O7] (the terms, small: alive the reward, dead half)
  g.font = `600 10px ${LETTER_FONT}`; g.fillText(`DEAD  $${Math.round(b.reward * BOUNTY.half)}`, w / 2, py + ph + 98);
  frayEdges(c, [228, 224, 214], new RNG(b.seed + 3), 60);
  if (b.state !== 'out') {
    g.strokeStyle = '#060606'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(16, 24); g.lineTo(w - 16, h - 30); g.stroke();
    blob(g, 18, 26, 6, rng, 0.2);
    if (b.state === 'paid') { g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.25); g.font = `800 40px ${LETTER_FONT}`; g.lineWidth = 6; g.strokeStyle = '#e4e0d6'; g.strokeText('PAID', 0, 0); g.fillStyle = '#060606'; g.fillText('PAID', 0, 0); g.restore(); }
  }
  return c;
}
