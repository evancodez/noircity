import * as THREE from 'three';
import { PURSE, NAMES } from './rooms/gym.js';
import { MANNERS } from '../cast/brawl/brain.js';

// A bout at the gym (brief O5 §2.1; the seam O4 fills: brawl.bout(level,
// bet)). Until O4's crowd brawl lands this is the base's fist fight
// (src/game/Brawl.js, FIGHT.md v5) in the ring: E at the man, a short cut
// (the black, the rope lifted) and I am squared up in one corner, my man in
// the other, the crowd at the ropes. Three levels, a man each (his hit
// points and his manners grow); the purse is paid on the knock-out. Losing
// is its downs (four at the first level, three at the second, two at the third): the warning before the last
// ("One more and you're down."), the black, the word, and I am outside the
// ropes by the steps - nothing taken; the man offers the bout again.
//   const run = boutStart(K, site, places)   run.offer()   run.step(dt)   run.busy   run.dispose()
const HP = [52, 90, 130];
const KIND = ['dockhand', 'brawler', 'foreman'];
const DOWNS = [4, 3, 2];
// (each level's man by his manners: the base's table slowed - a kid leaves
// long openings and breathes often; the second a little quicker; the third
// the base's own, the fight of the story)
const slow = (k, open = 0) => Object.fromEntries(Object.entries(MANNERS).map(([m, M]) => [m, { ...M, gap: [M.gap[0] * k, M.gap[1] * k], breathe: M.breathe * (1 + (k - 1) * 0.5), open: [M.open[0] + open, M.open[1] + open], combo: M.combo / k, feint: M.feint / k }]));
const STYLE = [slow(1.55, 0.2), slow(1.2, 0.08), MANNERS];

export function boutStart(K, s, P) {
  const G = P.game, B = G.brawl, F = s.frame;
  const R = K.ring;
  const inner = F.box(R.x0 + 0.25, R.x1 - 0.25, R.z0 + 0.25, R.z1 - 0.25);
  const st = { phase: null, t: 0, opp: null, crowd: [], downs: 0, lv: 0, fade: 0 };
  const corner = (k) => ({ x: (R.x0 + R.x1) / 2, z: k > 0 ? R.z1 - 0.95 : R.z0 + 0.95 });
  const run = {
    get busy() { return !!st.phase; },
    state: st,
    offer() {
      if (st.phase) return;
      st.lv = Math.min(2, s.state.wins || 0);
      st.phase = 'in'; st.t = 0; st.downs = 0;
      G.hud.clearPrompt();
      G.hud.message(`${NAMES[st.lv]}. THREE ROUNDS.`, 1.6);
      G.sfx.play('bell', F.v(R.x1, R.y + 1.4, R.z1), {}, { ref: 3 });
    },
    // the cut into the ring, under the black
    begin() {
      const c0 = corner(1), c1 = corner(-1);
      // (the man: a fresh one each bout)
      if (st.opp) { try { G.stage.cast.remove(st.opp); } catch (e) { /* */ } st.opp = null; }
      const p1 = F.w(c1.x, c1.z), p0 = F.w(c0.x, c0.z);
      const opp = P.spawnFig(s, { kind: KIND[st.lv], x: c1.x, z: c1.z, yaw: 0, name: 'boxer' + st.lv });
      if (!opp) { st.phase = null; return; }
      st.opp = opp;
      // the crowd at the ropes (three, out of the way of the steps)
      for (const c of st.crowd) { try { G.stage.cast.remove(c); } catch (e) { /* */ } }
      st.crowd = [];
      const spots = [[R.x0 - 0.75, (R.z0 + R.z1) / 2, -Math.PI / 2], [R.x0 - 0.7, R.z1 - 0.8, -Math.PI / 2], [(R.x0 + R.x1) / 2 - 0.7, R.z1 + 0.75, 0]];
      for (const [x, z, y] of spots) { const c = P.spawnFig(s, { kind: 'docker', x, z, yaw: y + Math.PI, name: 'crowd' + st.crowd.length, state: 'watch' }); if (c) { c.lookAt(F.v((R.x0 + R.x1) / 2, R.y + 1.5, (R.z0 + R.z1) / 2)); st.crowd.push(c); } }
      const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
      G.player.hands.equip('fists');
      G.controller.setPose(p0.x, p0.z, yaw, -0.05, R.y);
      G.controller.setMode('brawl', { opponent: opp, eyeY: R.y + 1.74, pos: { x: p0.x, z: p0.z }, yaw });
      this.fight({});
      st.phase = 'fight';
    },
    fight({ manner = 'measured', hp = null, retry = false }) {
      const opp = st.opp, ring = { bounds: inner, finishes: [
        { name: 'ropesN', spot: F.w((R.x0 + R.x1) / 2, R.z0 + 0.7), clip: 'koFall' },
        { name: 'ropesW', spot: F.w(R.x0 + 0.7, (R.z0 + R.z1) / 2), clip: 'koFall' },
      ] };
      B.start({ opponent: opp, manner, hp, room: ring, rng: G.stage.rng.fork(700 + st.lv), retry, lesson: false,
        who: { name: NAMES[st.lv], hp: HP[st.lv], manners: STYLE[st.lv] },
        onRetry: (m, hp2) => {
          st.downs++;
          if (st.downs >= DOWNS[st.lv]) { st.phase = 'lost'; return; }
          // (back to the corners under the black, and on: the base's retry)
          const c0 = corner(1), c1 = corner(-1), p0 = F.w(c0.x, c0.z), p1 = F.w(c1.x, c1.z);
          opp.place({ x: p1.x, z: p1.z }, Math.atan2(p0.x - p1.x, p0.z - p1.z));
          const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
          G.controller.setPose(p0.x, p0.z, yaw, -0.05, R.y);
          G.controller.setMode('brawl', { opponent: opp, eyeY: R.y + 1.74, pos: { x: p0.x, z: p0.z }, yaw });
          this.fight({ manner: m, hp: hp2, retry: true });
        },
      });
    },
    // out of the ring by the steps (won or lost), the controls mine
    out(why) {
      const p = F.w(K.man.x - 0.9, K.man.z + 0.3);
      if (B.active) B.stop();
      G.controller.setPose(p.x, p.z, F.yaw(0) + Math.PI * 0.9, -0.1, FLOOR_Y());
      G.player.hands.equip('empty');
      G.setViewmodelVisible(false);
      for (const c of st.crowd) { try { c.setState('idle', 0.4); c.lookAt(null); } catch (e) { /* */ } }
      if (why) G.hud.message(why, 2.2);
    },
    step(dt) {
      if (!st.phase) return;
      st.t += dt;
      if (st.phase === 'in') {
        st.fade = Math.min(1, st.t / 0.35); G.hud.fade(st.fade);
        if (st.t >= 0.4) { this.begin(); st.t = 0; st.fadeIn = 0.45; }
        return;
      }
      if (st.fadeIn > 0) { st.fadeIn -= dt; G.hud.fade(Math.max(0, st.fadeIn / 0.45)); }
      if (st.phase === 'fight') {
        if (B.finished && !B.active) { st.phase = 'won'; st.t = 0; }
        return;
      }
      if (st.phase === 'lost') {
        // (the down's black is up: when it has said its word, out of the ring)
        if (B.blackT <= 0) {
          this.out('Lost the bout.');
          // (the bout is over: finished, not won - stats.won says which)
          B.finished = true;
          st.phase = 'back'; st.t = 0;
        }
        return;
      }
      if (st.phase === 'won') {
        if (st.t > 0.1 && !st.paid) {
          st.paid = true;
          s.state.wins = (s.state.wins || 0) + 1;
          P.money(PURSE[st.lv], 'the purse');
          G.emit('bout', { won: true, level: st.lv + 1 });
          for (const c of st.crowd) { try { c.play('startle', { fade: 0.15 }); } catch (e) { /* */ } }
        }
        if (st.t > 2.6) { st.phase = 'back'; st.t = 0; G.hud.fade(1); this.out(null); st.paid = false; }
        return;
      }
      if (st.phase === 'back') {
        G.hud.fade(Math.max(0, 1 - st.t / 0.5));
        if (st.t > 0.5) {
          st.phase = null;
          G.hud.fade(0);
          if (st.opp && st.opp.down) { try { G.stage.cast.remove(st.opp); } catch (e) { /* */ } st.opp = null; }
          G.emit('bout', { won: !!(s.state.lastWon), level: st.lv + 1, over: true });
        }
      }
    },
    dispose() {
      if (st.phase && B.active) B.stop();
      if (st.phase) G.hud.fade(0);
      st.phase = null;
    },
  };
  const FLOOR_Y = () => 0.3;
  void THREE;
  return run;
}
