// Lane C3: the chase without a browser. The city's walls, columns, posts
// and parked cars from its own layout (src/stages/city/layout.js, the same
// seeds the stage draws from), the cars on their real physics (Car.js), his
// driver (his.js through pilot.js), the tail's rules (chase.js RULES), and
// a player's hands (src/scenes/tail/bot.js: idle, bad, good). Fast: a whole
// chase in a second or two, for tuning by numbers; the proofs themselves
// are the plays by real input in the browser (tools/plays/tail_*.json).
//   node tools/lib/c3city.mjs [his|idle|bad|good] [seed] [beat]
import * as THREE from 'three';
import { RNG } from '../../src/util/rng.js';
const { Car } = await import('../../src/vehicles/Car.js');
const { lotsOf, parkedOf, postsOf, elStations } = await import('../../src/stages/city/layout.js');
const { makeTrack } = await import('../../src/stages/city/parts/track.js');
const P = await import('../../src/stages/city/plan.js');
const { His } = await import('../../src/scenes/tail/his.js');
const { RULES } = await import('../../src/scenes/tail/rules.js');
const BOT = await import('../../src/scenes/tail/bot.js');

export function makeCity(seed = 1937) {
  const R = new RNG(seed).fork(3303);
  const lots = lotsOf(R.fork(601));
  const { columns } = elStations();
  const posts = postsOf(R.fork(502));
  const T = makeTrack({ lots, columns, posts });
  T.parked = parkedOf(R.fork(911)).map((p, i) => ({
    kind: 'parked', parked: true, i, pos: new THREE.Vector3(p.x, 0, p.z), yaw: p.yaw, vel: new THREE.Vector3(), yawRate: 0,
    spec: { halfL: 2.45, halfW: 0.95, mass: 1.6, k: 1.32 }, solid: true,
    box() { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { cx: this.pos.x, cz: this.pos.z, hx: 2.45, hz: 0.95, c, s }; },
    emit() {}, hurt() {},
  }));
  const game = { stage: { track: T }, time: 0, camera: { position: new THREE.Vector3() } };
  const vehicles = { game, list: [] };
  T.vehicles = () => vehicles.list;
  const spawn = (kind, x, z, yaw, speed = 0) => { const v = new Car(vehicles, kind, { group: new THREE.Group() }, { pos: new THREE.Vector3(x, 0, z), yaw }); v.place(v.pos, yaw, speed); vehicles.list.push(v); return v; };
  return { T, game, vehicles, spawn };
}

// a headless chase: the rules of chase.js over the real cars and drivers
export function runChase({ seed = 1937, bot = 'idle', beat = 'start', secs = 200, verbose = false, botSeed = 7, attempt = 0 } = {}) {
  const W = makeCity(seed);
  const S = P.START;
  const ch = { phase: 'start', t: 0, unseen: 0, farT: 0, log: [], fails: [] };
  let my, his;
  if (beat === 'start') { my = W.spawn('coupe', S.my.x, S.my.z, S.my.yaw); his = W.spawn('sedan', S.his.x, S.his.z, S.his.yaw); }
  else if (beat === 'chase2') {
    const z = P.EW.canal.z + 1.65;
    my = W.spawn('coupe', P.NS.baxter.x - 70, z, 0, 11); his = W.spawn('sedan', P.NS.baxter.x - 38, z, 0, 12);
  }
  else if (beat === 'river') {
    const s0 = P.riverSAtZ(P.EW.market.z + 26);
    const at = (s, d) => { const p = P.riverPoint(s, d), f = P.riverFrame(s, {}); return [p.x, p.z, f.yaw]; };
    my = W.spawn('coupe', ...at(s0, 1.9), 12); his = W.spawn('sedan', ...at(s0 + 34, 1.9), 13);
  }
  W.game.vehicles = W.vehicles; W.vehicles.player = my;
  ch.my = my; ch.his = his;
  ch.gap = () => Math.hypot(his.pos.x - my.pos.x, his.pos.z - my.pos.z);
  ch.bodies = () => W.T.bodies();
  ch.onRiver = () => { if (ch.phase === 'a') ch.phase = 'b'; };
  const D = new His(ch, his, beat === 'chase2' ? { leg: 2, prev: 'avenue.canal' } : { leg: 0 });
  his.driver = D;
  ch.driver = D;
  if (beat === 'river') { D.state = 'go'; D.toRiver(); ch.phase = 'b'; }
  if (beat === 'chase2') { D.state = 'go'; ch.phase = 'a'; }
  const B = BOT.makeBot(ch, bot, { seed: botSeed, track: W.T, attempt });
  const dt = 1 / 60;
  let lastLog = -1;
  const out = { result: null, t: 0, maxGap: 0, unseenMax: 0, myDmg: 0, hisLeg: 0, choices: null, track: [] };
  for (let i = 0; i < secs * 60; i++) {
    ch.t += dt; W.game.time += dt;
    // the eye: my seat
    W.game.camera.position.set(my.pos.x, 1.5, my.pos.z);
    if (ch.phase === 'start' && (my.speed > 1.2 || ch.t > 2.4)) { ch.phase = 'a'; D.state = 'go'; }
    // my hands
    const k = B.tick(dt);
    my.input.throttle = k.W ? 1 : 0; my.input.brake = k.S ? 1 : 0; my.input.steer = (k.A ? 1 : 0) - (k.D ? 1 : 0); my.input.handbrake = k.Space ? 1 : 0;
    my.step(dt);
    his.step(dt);
    // the rules
    if (ch.phase === 'a' || ch.phase === 'b') {
      const gap = ch.gap();
      const seen = !W.T.blocked(my.pos.x, my.pos.z, his.pos.x, his.pos.z, ['wall', 'fence', 'works', 'gate']);
      ch.unseen = seen ? Math.max(0, ch.unseen - dt * 2) : ch.unseen + dt;
      ch.farT = gap > RULES.farWarn + 15 ? ch.farT + dt : Math.max(0, ch.farT - dt * 2);
      out.maxGap = Math.max(out.maxGap, gap); out.unseenMax = Math.max(out.unseenMax, ch.unseen);
      if (ch.phase === 'a' && (ch.unseen > RULES.unseenLost || gap > RULES.farLost || ch.farT > RULES.farT)) { out.result = 'Lost him.'; break; }
      if (my.damage >= 4) { out.result = 'Wrecked.'; break; }
      if (ch.phase === 'b' && D.state !== 'lost' && (his.pos.z > RULES.gateZ || D.atPier)) { out.result = 'He warned them.'; break; }
      if (ch.phase === 'b' && B.stopped && B.stopped()) { out.result = 'stopped'; break; }
    }
    if (verbose && Math.floor(ch.t) !== lastLog) { lastLog = Math.floor(ch.t); console.log(ch.t.toFixed(0), ch.phase, 'leg', D.legIndex, D.state, 'his', his.pos.x.toFixed(0), his.pos.z.toFixed(0), (his.speed * 3.6).toFixed(0), 'me', my.pos.x.toFixed(0), my.pos.z.toFixed(0), (my.speed * 3.6).toFixed(0), 'gap', ch.gap().toFixed(0), 'uns', ch.unseen.toFixed(1), 'dmg', my.damage.toFixed(2), his.damage.toFixed(2)); }
    if (Math.floor(ch.t * 2) !== Math.floor((ch.t - dt) * 2)) out.track.push([+my.pos.x.toFixed(1), +my.pos.z.toFixed(1), +his.pos.x.toFixed(1), +his.pos.z.toFixed(1)]);
    if (ch.phase === 'b' && !out.bAt) out.bAt = +ch.t.toFixed(1);
  }
  out.t = +ch.t.toFixed(1); out.myDmg = +my.damage.toFixed(2); out.hisDmg = +his.damage.toFixed(2); out.hisLeg = D.legIndex; out.choices = D.choices; out.phase = ch.phase; out.hisState = D.state;
  out.stats = { my: my.stats, his: his.stats };
  return out;
}

// tries from the checkpoints until phase b is reached (or `max` tries): a
// player's evening with the chapter
export function campaign({ bot = 'bad', seed = 1937, botSeed = 7, max = 6 } = {}) {
  const tries = [];
  let beat = 'start';
  for (let k = 0; k < max; k++) {
    const r = runChase({ seed, bot, beat, botSeed: botSeed + k * 13, attempt: k });
    tries.push({ beat, result: r.result, t: r.t, leg: r.hisLeg, dmg: r.myDmg, bAt: r.bAt || null, hit: (r.stats.my.log || []).slice(0, 3) });
    if (r.phase === 'b' || r.bAt) break;
    if (r.hisLeg >= 2) beat = 'chase2';
  }
  return tries;
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === 'campaign') {
  const r = campaign({ bot: process.argv[3] || 'bad', botSeed: +(process.argv[4] || 7) });
  for (const t of r) console.log(JSON.stringify(t));
  process.exit(0);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode = 'his', seed = '1937', beat = 'start', botSeed = '7'] = process.argv.slice(2);
  const r = runChase({ bot: mode === 'his' ? 'chaser' : mode, seed: +seed, beat, verbose: !!process.env.V, botSeed: +botSeed });
  const { track, ...rest } = r;
  console.log(JSON.stringify(rest));
  if (process.env.TRACK) { const fs = await import('node:fs'); fs.writeFileSync(process.env.TRACK, JSON.stringify(track)); }
}
