import { crowdOf } from '../combat/brawl/Crowd.js';

// [O3] The fist fights the people start, on lane O4's crowd brawl
// (src/combat/brawl/Crowd.js: one to four men in the open street, the soft
// lock, the cue, the cards, the leaving at 30 m, the wheel's draw): a beat
// cop I punch or who comes to cuff me, a gang man I punch or shoulder (and
// the nearest of his three with him). The man is the street's own figure
// (his Person's Character, handed to the crowd: no change of look), held out
// of the street's brains while it lasts (p.mode and p.job 'fight': the
// police never send him anywhere, People never steps him).
//   police.fists.start(p, { why })  -> bool    police.fists.active   .who   .stop()   .step(dt)
// How it ends, as the city has it:
//   won    he lies where he fell (a cop: his whistle, HEAT 2, his gun on the
//          pavement for E; a gang man: his three draw)
//   down   me: a cop's fight is the arrest (the station), a gang's the black
//          and the hospital ('Beaten.')
//   left   I walked 30 m off: a cop comes after me (the arrest is still his),
//          a gang man goes back to his corner
//   drawn  the wheel drew a gun: a cop draws back (HEAT 2), a gang draws
export function streetFists(police) {
  const G = police.G, P = police.P;
  const F = {
    active: false, who: null, men: [], ended: null, falls: {},
    start(p, { why = 'arrest' } = {}) {
      const crowd = crowdOf(G);
      if (F.active || crowd.active || G.brawl.active || !p || !p.standing || p.armed || G.failing) return false;
      const men = [p];
      // (a gang man is not alone: the nearest of his three on his feet steps in with him)
      if (p.role === 'gang' && p.gang && !p.gang.war) {
        const mate = p.gang.men.filter((q) => q !== p && q.standing && !q.armed && q.mode !== 'fight')
          .sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos))[0];
        if (mate && mate.pos.distanceTo(p.pos) < 7) men.push(mate);
      }
      F.active = true; F.who = p; F.men = men; F.why = why; F.ended = null; F.downed = false;
      for (const q of men) F.hold(q);
      const kind = p.role === 'cop' ? 'cop' : 'gangster';
      // (my fists up in the frame: the street's hands only show what they hold)
      G.setViewmodelVisible(true);
      crowd.start({
        men: men.map((q) => ({ kind, c: q.c, at: { x: q.pos.x, z: q.pos.z }, yaw: q.fig.yaw, id: `o3_${q.id}` })),
        leave: true, seed: 3300 + (p.id % 97),
        // (O4's mercy: my falls to this kind of man tonight, 0..3 - a little more time to
        // read his cue, his openings longer; never a blow landed for me, idle still loses)
        mercy: Math.min(3, F.falls[kind] || 0),
        // (my fall in it: a cop's is the arrest, a gang's the black and the hospital)
        onDown: (e) => F.down(kind, e),
        onEnd: (result) => { F.ended = result; },
      });
      police.event('fists', { who: p.role, why, men: men.length });
      // (the warning was the arrest's: the fight is the answer to it; nothing of the street's over it)
      police.warn(null); police.arrestT = 0;
      G.hud.clearPrompt('cityin'); G.hud.clearPrompt('cityout'); G.hud.clearPrompt('citydoor');
      return true;
    },
    // a man of the street into the fight: out of his brain, still where he stands
    hold(q) {
      q.prevJob = q.job; q.prevMode = q.mode;
      q.mode = 'fight'; if (q.role === 'cop') q.job = 'fight';
      q.path = null; q.then = null; q.fig.speed = 0; q.gaitNow = null;
      if (q.umb && q.umb.state === 'held') q.umb.drop();
      q.c.lookAt(null);
    },
    // a man back to the street after it (left, drawn): his brain again
    free(q, m) {
      if (m) { m.off = null; m.removed = true; }
      if (!q.standing) return;
      q.c.down = false;
      try { q.c.fig.anim.setOverlay(null, 0.12); q.c.fig.anim.setTimeScale(1); } catch (e) { /* */ }
      q.gaitNow = null; q.mode = 'walk'; q.path = null;
      q.c.noGlance = false;
      if (q.role === 'cop') { q.job = police.heat ? 'respond' : 'beat'; q.mode = police.heat ? 'chase' : 'walk'; }
      else if (q.gang && q.holdAt) { q.mode = 'walk'; q.goTo(q.holdAt, { gait: 'walk' }); }
    },
    down(kind, e) {
      const p = F.who;
      F.downed = true;
      F.falls[kind] = (F.falls[kind] || 0) + 1;
      // (the black says the fix, six words at most: the crowd's own words for what put me down)
      const fix = e && e.why && e.why !== 'Down.' ? e.why : null;
      const words = (t) => t.split(/\s+/).length;
      if (p && p.role === 'cop') {
        police.event('arrest', { how: 'fists' });
        G.counters.arrests = (G.counters.arrests || 0) + 1;
        G.sfx.play('o3_cuffs', null, {}, { send: false });
        return { why: fix && words(fix) <= 5 ? `Arrested. ${fix}` : 'Arrested.', to: 'station' };
      }
      return { why: fix || 'Beaten.', to: 'hospital' };
    },
    stop() {
      if (!F.active) return;
      F.active = false;
      const crowd = G.crowd;
      if (crowd && crowd.active) crowd.stop('o3');
      F.who = null; F.men = [];
    },
    step() {
      if (!F.active) return;
      const crowd = G.crowd;
      // (stopped from outside - a fail, the title: the men let go as they stand)
      if (!F.ended && !(crowd && crowd.active)) F.ended = F.downed ? 'down' : 'stop';
      if (!F.ended) return;
      const result = F.ended, p = F.who, men = F.men;
      F.ended = null; F.active = false; F.who = null; F.men = [];
      if (result === 'down') return;
      const byC = new Map((crowd ? crowd.men : []).map((m) => [m.c, m]));
      // each man as the crowd left him: down (out, or not yet up) or on his feet
      for (const q of men) {
        const m = byC.get(q.c);
        const out = m && (m.state === 'out' || m.state === 'down');
        if (out) {
          q.down = true; q.mode = 'down'; q.t = 0; q.downWhy = 'fists'; q.downBy = 'player'; q.fig.speed = 0;
          if (m) m.removed = true;
          if (q.job === 'fight') q.job = 'down';
        } else F.free(q, m);
      }
      // (the eye back to the street's walk, eased; a gun drawn keeps the gun's)
      const C = G.controller;
      if (C.mode === 'crowd') C.setMode('walk', { pose: { x: C.pos.x, z: C.pos.z, yaw: C.yaw, pitch: -0.1 }, ease: 0.35 });
      if (result === 'won') {
        if (p.role === 'cop') {
          P.crime.emit('assault', p.pos, 'player', { victim: p });
          // (a cop put down: his whistle as he goes - the patrol car is on its way)
          p.say('o3_whistle'); police.raise(2, G.eye, 'assault');
          F.dropGun(p);
        } else {
          P.crime.emit('punch', p.pos, 'player', { victim: p });
          if (p.gang) P.gangs.onBeaten(p);
        }
      } else if (result === 'drawn') {
        // a gun drawn on them: a cop draws back (HEAT 2: a gun on a policeman), a gang draws
        if (p.role === 'cop') { police.raise(2, G.eye, 'gun on a cop'); for (const q of men) if (q.standing) police.guns.arm(q, 'pistol', 'police'); }
        else if (p.gang) P.gangs.hostile(p.gang, 'draw');
      }
      police.event('fists:end', { result });
    },
    // a cop down: his revolver on the pavement by him (the street's items: E takes it, lane O1b)
    dropGun(p) {
      if (p.gunDropped) return;
      p.gunDropped = true;
      let I = null;
      try { I = G.stage.part('items'); } catch (e) { I = null; }
      if (I && I.drop) I.drop('weapon', p.pos.x + Math.sin(p.fig.yaw) * 0.7, p.pos.z + Math.cos(p.fig.yaw) * 0.7, { gun: 'revolver' });
    },
  };
  return F;
}
