// [O3] after the critic (B1): a beat cop I punch first, by real input, until
// the fight is won or `tries` are lost (each loss the arrest and the station:
// the next try is a cop 5 m ahead of where I wake).
//   { "drive": "tools/lib/o3_copfirst.mjs", "profile": "idle" | "bad" | "medium" | "good", "tries": 3 }
// The fist fight itself is lane O4's bot (tools/lib/o4_brawl.mjs), reading
// only what the screen shows. Returns per try: how it ended, how long, the
// heat, where I woke, the fail's words, how long the warning was up.
import o4 from './o4_brawl.mjs';
const SENS = 0.0021;
const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(js, expr, ms, every = 100) { const T = Date.now() + ms; while (Date.now() < T) { if ((await js(expr)) === true) return true; await sleepP(every); } return false; }

export default async function copFirst(api) {
  const { js, opts, log, turn, mouse, cursor } = api;
  const R = { profile: opts.profile || 'medium', tries: [] };
  const n = opts.tries || 3;
  for (let k = 0; k < n; k++) {
    await waitFor(js, '!G.failing && G.state === "playing" && !!G.people && G.scenes.fadeK < 0.05', 30000);
    await sleepP(1200);
    // a beat cop 5 m ahead, facing me (the only staging)
    await js(`(() => { const E = G.eye, y = G.controller.yaw, fx = -Math.sin(y), fz = -Math.cos(y); window.__o3cop = G.people.dbgCop(E.x + fx * 5, E.z + fz * 5, Math.atan2(-fx, -fz)); return 1; })()`);
    // walk up to him and punch (W, then LMB at arm's length)
    await api.keyDown('KeyW');
    await waitFor(js, 'Math.hypot(window.__o3cop.pos.x - G.eye.x, window.__o3cop.pos.z - G.eye.z) < 1.7', 6000, 40);
    await api.keyUp('KeyW');
    const s = await js(`({ x: G.eye.x, z: G.eye.z, yaw: G.controller.yaw, pitch: G.controller.pitch, cx: window.__o3cop.pos.x, cz: window.__o3cop.pos.z })`);
    const want = Math.atan2(-(s.cx - s.x), -(s.cz - s.z));
    const dy = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    await turn(Math.round(-dy / SENS), Math.round(-(-0.05 - s.pitch) / SENS));
    const [x, y] = cursor(); await mouse('mousePressed', x, y, 'left'); await sleepP(70); await mouse('mouseReleased', x, y, 'left');
    const T = { k };
    T.fight = await waitFor(js, 'G.crowd.active && G.crowd.men.length > 0 && G.crowd.men[0].kind === "cop"', 3000, 40);
    T.sent = await js(`G.police.events.filter(e => e.what === 'send').length`);
    if (!T.fight) { R.tries.push(T); log(`copfirst ${k}: no fight ${JSON.stringify(await js('({ jab: G.people.hands.lastJab, mode: G.controller.mode })'))}`); continue; }
    const beat = await js('G.scenes.beat');
    const D = await o4({ ...api, opts: { profile: R.profile, beat, tries: 1, wins: 1, timeout: opts.timeout ?? 160000 } });
    const t = D.tries[0] || {};
    T.result = t.result || 'none'; T.secs = t.secs; T.why = t.why; T.warnedFor = t.warnedFor; T.landed = t.stats && t.stats.landed; T.taken = t.stats && t.stats.taken;
    // (the fight sent no one after me while it lasted: B1's cause)
    T.sentDuring = (await js(`G.police.events.filter(e => e.what === 'send').length`)) - T.sent;
    await sleepP(2500);
    T.after = await js(`({ beat: G.scenes.beat, heat: G.police.heat, fail: G.lastFail && G.lastFail.why, cop: window.__o3cop && { mode: window.__o3cop.mode, down: window.__o3cop.down }, gunOnPavement: (G.stage.part('items').list || []).some(i => i.dropped && i.kind === 'weapon' && !i.taken), mode: G.controller.mode })`);
    R.tries.push(T);
    log(`copfirst ${k}: ${JSON.stringify(T)}`);
    if (T.result === 'won') break;
    if (T.result !== 'down') break;
  }
  R.won = R.tries.some((t) => t.result === 'won');
  R.ended = R.tries.every((t) => t.result === 'won' || t.result === 'down');
  R.wonAt = R.tries.findIndex((t) => t.result === 'won') + 1;
  return R;
}
