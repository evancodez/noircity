import { crowdOf } from '../combat/brawl/Crowd.js';
import { BOXER_LEVELS } from '../combat/brawl/kinds.js';
import { money, pay, earn } from '../combat/money.js';
import { priceCard } from '../scenes/o4/places.js';

// A bout at the gym (brief O5 §2.1). The rules are lane O4's: the crowd brawl
// (src/combat/brawl/Crowd.js) with the boxer of a level (BOXER_LEVELS: his
// numbers, the bet, the purse); the room is mine. E at the man by the ring's
// steps: the bet is taken (what I have of it: broke, I fight for half the
// purse), a short black, I am in my corner and he in his; won, the purse (and
// the bet back); down, the kit's fall: 'Out cold. The bet is his.', and I come
// round on the boards by the ring's steps (the city's beat `wake`) with the
// man offering again. Each fall at a level gives the next try O4's mercy.
//   const run = boutStart(K, site, places)   run.offer()   run.step(dt)   run.busy   run.reset()   run.dispose()
export const level = (s) => Math.min(3, (s.state.wins || 0) + 1);
export function boutPrompt(s) {
  const L = BOXER_LEVELS[level(s)];
  return `a bout: ${L.name.toLowerCase()}`;
}

export function boutStart(K, s, P) {
  const G = P.game, F = s.frame, R = K.ring, C = crowdOf(G);
  const st = { phase: null, t: 0, lv: 1, bet: 0, result: null, fadeIn: 0 };
  const mid = { x: (R.x0 + R.x1) / 2 };
  const corner = (k) => ({ x: mid.x, z: k > 0 ? R.z1 - 0.95 : R.z0 + 0.95 });
  const run = {
    get busy() { return !!st.phase; },
    state: st,
    offer() {
      if (st.phase || C.active) return;
      st.lv = level(s);
      const L = BOXER_LEVELS[st.lv];
      st.bet = Math.min(money(G), L.bet);
      if (st.bet > 0) pay(G, st.bet, 'bet');
      st.phase = 'in'; st.t = 0; st.result = null;
      priceCard(G.hud, []);
      G.hud.clearPrompt();
      G.sfx.play('o4_bell', null, {}, { send: false, gain: 0.7 });
    },
    // the cut into the ring, under the black
    begin() {
      const L = BOXER_LEVELS[st.lv];
      const c0 = corner(1), c1 = corner(-1), p0 = F.w(c0.x, c0.z), p1 = F.w(c1.x, c1.z);
      const yaw = Math.atan2(-(p1.x - p0.x), -(p1.z - p0.z));
      G.controller.setPose(p0.x, p0.z, yaw, -0.05, R.y);
      G.eye.copy(G.camera.position);
      const inner = F.box(R.x0 + 0.3, R.x1 - 0.3, R.z0 + 0.3, R.z1 - 0.3);
      const falls = (s.state.falls || (s.state.falls = {}))[st.lv] || 0;
      // (each fall at this level, on top of O4's mercy - his openings longer, his blows further apart -
      // the man is a little less: less to put down, his guard and his answer a little slower; the
      // clumsy hand is through by the third or fourth try, an idle one never)
      const f = Math.min(3, falls), over = { ...L, guard: L.guard - 0.1 * f, answer: Math.max(0.2, L.answer - 0.08 * f) }, hp = Math.round(L.hp * (1 - 0.15 * f));
      C.start({ men: [{ kind: 'boxer', at: { x: p1.x, z: p1.z }, yaw: Math.atan2(p0.x - p1.x, p0.z - p1.z), name: L.name, over, hp }],
        bounds: inner, leave: false, maxIn: 1, seed: 7100 + st.lv + falls * 7, mercy: falls,
        onEnd: (r) => { st.result = r; },
        onDown: ({ why } = {}) => {
          s.state.falls[st.lv] = falls + 1;
          // (the city's beat: up by the ring's steps, the man offering again)
          G.city.wake = { id: s.id, where: 'ring' };
          // (the black says what put me down - the crowd's fix - and what it cost)
          return { why: (why || 'Out cold.') + (st.bet > 0 ? ' The bet is his.' : ''), to: 'wake' };
        } });
      st.phase = 'fight'; st.ours = true;
      G.hud.objective('Win the bout.');
    },
    // out of the ring by the steps, the controls mine
    out() {
      const p = F.w(K.man.x - 0.9, K.man.z + 0.3);
      // (facing the man by the steps: the next bout is offered at once)
      G.controller.setPose(p.x, p.z, F.yaw(Math.atan2(-0.9, 0.3)), -0.08, 0.3);
      G.eye.copy(G.camera.position);
      if (st.ours) { C.clearMen(); st.ours = false; }
      G.player.hands.equip('empty');
      G.setViewmodelVisible(false);
    },
    // (a fall's black: the ring empty, the man by the steps again)
    reset() { if (st.ours) { if (C.active) C.stop('reset'); C.clearMen(); st.ours = false; } st.phase = null; G.hud.objective(null); G.hud.fade(0); },
    step(dt) {
      // the card of the night, while I stand by the man (O4's)
      if (!st.phase) {
        const m = F.w(K.man.x, K.man.z), d = Math.hypot(G.eye.x - m.x, G.eye.z - m.z);
        const lv = level(s), L = BOXER_LEVELS[lv];
        priceCard(G.hud, d < 3.2 && P.inside === s && !G.failing ? ['THE GYM.  TONIGHT:', L.name + '  (' + ['', 'A KID', 'A PRO', 'THE CHAMP'][lv] + ')', 'BET $' + L.bet + '  -  PURSE $' + L.purse, 'YOU HAVE  $' + money(G)] : []);
        return;
      }
      st.t += dt;
      if (st.phase === 'in') {
        G.hud.fade(Math.min(1, st.t / 0.3));
        if (st.t >= 0.35) { this.begin(); st.t = 0; st.fadeIn = 0.4; }
        return;
      }
      if (st.fadeIn > 0) { st.fadeIn -= dt; G.hud.fade(Math.max(0, st.fadeIn / 0.4)); }
      if (st.phase === 'fight') {
        if (!st.result) return;
        const L = BOXER_LEVELS[st.lv];
        if (st.result === 'won') {
          G.sfx.play('o4_bell', null, {}, { send: false, gain: 0.7 });
          const purse = st.bet > 0 ? L.purse + st.bet : Math.round(L.purse / 2);
          earn(G, purse, 'purse');
          s.state.wins = Math.max(s.state.wins || 0, st.lv);
          G.hud.objective('Won. $' + purse + '.');
          G.emit('bout', { won: true, level: st.lv, purse });
        } else {
          G.hud.objective(st.bet > 0 ? 'The bout is off. The bet is his.' : 'The bout is off.');
          G.emit('bout', { won: false, level: st.lv });
        }
        st.phase = 'after'; st.t = 0;
        return;
      }
      if (st.phase === 'after') {
        if (st.t > 2.2) G.hud.fade(Math.min(1, (st.t - 2.2) / 0.3));
        if (st.t > 2.55) { this.out(); G.hud.objective(null); st.phase = 'back'; st.t = 0; }
        return;
      }
      if (st.phase === 'back') {
        G.hud.fade(Math.max(0, 1 - st.t / 0.45));
        if (st.t > 0.45) { st.phase = null; G.hud.fade(0); }
      }
    },
    dispose() {
      if (st.phase && C.active) C.stop('gone');
      if (st.phase) { G.hud.fade(0); G.hud.objective(null); }
      if (st.ours) { C.clearMen(); st.ours = false; }
      priceCard(G.hud, []);
      st.phase = null;
    },
  };
  return run;
}
