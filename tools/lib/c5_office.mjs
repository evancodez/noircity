// [C5] Chapter III, Room 304, by real input (tools/play.mjs { "drive": "tools/lib/c5_office.mjs", "order": [...] }).
// A player who walks the floor, looks at a thing, presses E on it; who rubs
// the pad with the pencil's side (LMB held, the mouse back and forth down the
// sheet), turns the dial by the mouse to the numbers on the sheet in his hand,
// and lays the pieces of the check together on the desk (LMB drags a piece,
// RMB with the mouse turns it). The record says what was done and when.
//   order: the steps in the order played, from:
//     'door' (push the suite's door, into the outer office), 'ames' (into his
//     room), 'lamp', 'search' (Ames: the key), 'drawer' (R1: unlock, open),
//     'pencil', 'pad' (rub until it reads, tear), 'ash', 'picture', 'dial',
//     'envelope', 'check' (the pieces), 'stills', and the flavour/try-all ones:
//     'drawers' (every other drawer of his desk), 'cabinets' (one of his
//     cabinets' drawers), 'phone' (hang up, lift), 'hat', 'photo', 'pad0' (the
//     pad before the lamp/pencil), 'dial0' (the dial before the sheet: try a
//     little, step back), 'corridor' (out to the corridor and back), 'outer'
//     (the outer office's cooler and typewriter)
//   stall: true - the stuck test: half the pad, E out; half the dial, E out; come back to each
const sleep0 = (ms) => new Promise((r) => setTimeout(r, ms));
export default async function drive({ js, turn, keyDown, keyUp, mouse, shot, log, sleep, W, H, opts, cursor }) {
  const rec = { done: [], fails: [], t: {}, prompts: {} };
  const t0 = Date.now();
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ST = `(() => { const G = N.game, C = N.controller, e = G.eye, sc = G.scenes, F = sc.ctx ? sc.ctx.flags : {}, I = G.interact;
    const pad = F.pad, safe = F.safe, A = G.puzzles.active;
    return { scene: sc.current && sc.current.id, beat: sc.beat, fade: sc.fadeK, x: C.pos.x, z: C.pos.z, ex: e.x, ey: e.y, ez: e.z, yaw: C.yaw, pitch: C.pitch, sens: C.sensitivity, mode: C.mode, frozen: C.frozen,
      cur: I.current ? I.current.id : null, curPrompt: I.current ? I.current.prompt : null, s: F.s ? { ...F.s, tried: null } : null,
      pad: pad ? { active: pad.active, readable: !!pad.readable, tore: !!pad.tore, done: pad.done, shown: pad.shown || 0, tip: [pad.tip.x, pad.tip.z] } : null,
      safe: safe ? { active: safe.active, stage: safe.stage, reading: safe.reading, cracked: safe.cracked, opened: safe.opened, gate: safe.gate } : null,
      puzzle: A ? A.id : null, stills: !!(G.stills && G.stills.active), obj: G.hud.objectiveText || null, say: G.hud.sayText || null };
  })()`;
  const st = () => js(ST);
  const tap = async (code, hold = 60) => { await keyDown(code); await sleep(hold); await keyUp(code); };
  const press = async () => tap('KeyE');
  // the view onto a world point at a hand's pace
  const aimAt = async (p, tol = 0.03, ms = 3000) => {
    const T = Date.now();
    for (;;) {
      const s = await st();
      const dx = p[0] - s.ex, dy = p[1] - s.ey, dz = p[2] - s.ez;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const ey = wrap(yaw - s.yaw), ep = pitch - s.pitch;
      if (Math.hypot(ey, ep) < tol || Date.now() - T > ms) return Math.hypot(ey, ep);
      const k = 0.6, mxv = 0.25;
      const ddy = Math.max(-mxv, Math.min(mxv, ey * k)), ddp = Math.max(-mxv, Math.min(mxv, ep * k));
      await turn(Math.round(-ddy / s.sens), Math.round(-ddp / s.sens));
      await sleep(30);
    }
  };
  // walk through points by W and the mouse
  const walk = async (pts, ms = 15000) => {
    const T = Date.now();
    for (const [x, z] of pts) {
      for (;;) {
        const s = await st();
        const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
        if (d < 0.22) break;
        if (Date.now() - T > ms) { await keyUp('KeyW'); rec.fails.push('walk ' + x + ',' + z); return false; }
        const ey = wrap(Math.atan2(-dx, -dz) - s.yaw);
        await turn(Math.round(-Math.max(-0.35, Math.min(0.35, ey * 0.7)) / s.sens), Math.round(-(-0.05 - s.pitch) * 0.3 / s.sens));
        if (Math.abs(ey) < 0.5) await keyDown('KeyW'); else await keyUp('KeyW');
        await sleep(40);
      }
    }
    await keyUp('KeyW');
    await sleep(120);
    return true;
  };
  // E on a thing: aim at it until the interact names it, then press
  const use = async (id, p, ms = 5000) => {
    const T = Date.now();
    for (;;) {
      await aimAt(p, 0.04, 1200);
      const s = await st();
      if (s.cur === id) { rec.prompts[id] = s.curPrompt; await press(); await sleep(250); rec.done.push(id); return true; }
      if (Date.now() - T > ms) { rec.fails.push('use ' + id + ' (current ' + s.cur + ')'); return false; }
      await sleep(80);
    }
  };
  const P = await js(`(() => { const O = N.game.stage.part('office'), V = N.THREE.Vector3; const w = (o) => o.getWorldPosition(new V()).toArray();
    const R1 = O.desk.drawers.find((d) => d.id === 'R1');
    return { chain: O.lamp.parts.shadeG.localToWorld(new V(0.03, -0.11, 0.1)).toArray(), ames: (O.ames ? w(O.ames.fig.bones.chest) : [4.6, 1, 3.6]), r1: R1.group.parent.localToWorld(new V(R1.group.position.x + 0.03, R1.y + 0.1, R1.z)).toArray(),
      pad: [3.92, 0.8, 3.9], ash: O.furn.ashtray.toArray(), pic: [2.85, 1.5, 0.1], dial: O.safe.centre.toArray(), phone: w(O.phone.recv), hat: [0.25, 1.7, 5.75], photo: [1.02, 1.46, 6.65] }; })()`);
  // the routes on the floor (round the furniture)
  const R = {
    toDoor: [[-4.95, -5.6], [-4.95, -3.6], [-4.75, 1.5], [-4.7, 3.35]],
    intoOuter: [[-3.0, 3.35]],
    toOpening: [[-1.2, 3.4], [0.6, 3.4]],
    deskFront: [[2.2, 3.0], [2.9, 3.4]],
    behindS: [[2.2, 2.0], [4.85, 2.25], [4.9, 2.6]],
    behindN: [[2.2, 4.9], [4.9, 5.0], [4.95, 4.7]],
    toSafe: [[2.75, 1.0]],
  };
  const goBehindS = async () => { const s = await st(); if (s.x > 4.5 && s.z < 3.2) return; if (s.x > 4.4) await walk([[4.9, 5.3], [3.3, 5.3]]); await walk(R.behindS); };
  const goBehindN = async () => { const s = await st(); if (s.x > 4.5 && s.z > 4.2) return; if (s.x > 4.4) await walk([[4.9, 2.1], [3.3, 2.1]]); await walk(R.behindN); };
  const goFront = async () => { const s = await st(); if (s.x > 4.4) await walk(s.z < 3.6 ? [[4.85, 2.1], [3.0, 2.1]] : [[4.9, 5.2], [3.0, 5.0]]); await walk(R.deskFront); };
  const goSafe = async () => { const s = await st(); if (s.x > 4.4) await walk([[4.85, 2.1]]); await walk(R.toSafe); };
  // the pad: LMB held, strokes across the sheet working down it, until it reads; then E tears it off
  const rubPad = async ({ half = false } = {}) => {
    let s = await st();
    if (!s.pad || !s.pad.active) return false;
    await sleep(700);
    const [cx, cy] = cursor();
    // (the tip to the sheet's top: up the sheet is -x: mouse dy < 0)
    await turn(0, -260); await sleep(60);
    await mouse('mousePressed', cx, cy, 'left');
    let dir = 1, n = 0;
    for (; n < 70; n++) {
      for (let k = 0; k < 6; k++) { await turn(dir * 95, 0); await sleep(18); }
      dir = -dir;
      await turn(0, 24); await sleep(20);
      if (n % 4 === 3) { s = await st(); if (s.pad.readable) break; if (half && s.pad.shown > 0.3) break; }
      // (the bottom of the sheet: back up and over again)
      if (s.pad && s.pad.tip && s.pad.tip[0] > 3.92 + 0.15) await turn(0, -500);
    }
    await mouse('mouseReleased', cx, cy, 'left');
    await sleep(400);
    s = await st();
    rec.t.padStrokes = n;
    await press();
    await sleep(2000);
    return true;
  };
  // the dial: right to the first (the reading falls), back; left to the second, back; right to the third, rest
  const turnDial = async ({ half = false } = {}) => {
    const COMBO = [36, 12, 57], DIRS = [-1, 1, -1];
    let s = await st();
    if (!s.safe || !s.safe.active) return false;
    await sleep(600);
    for (let k = s.safe.stage; k < 3; k++) {
      const want = COMBO[k], dir = DIRS[k];
      // (past it once the way it must turn: at least a quarter turn on, then onto it)
      let moved = 0;
      for (let i = 0; i < 400; i++) {
        s = await st();
        const r = s.safe.reading;
        const togo = dir < 0 ? (r - want + 100) % 100 : (want - r + 100) % 100;
        if (s.safe.gate === k && moved > 6) break;
        const step = Math.max(0.6, Math.min(6, togo * 0.5 + 0.4));
        // (mouse right: the reading falls)
        await turn(Math.round(-dir * step / 0.075), 0);
        moved += step;
        await sleep(25);
      }
      if (half && k === 1) { await sleep(300); return 'half'; }
      // set it: back a little the other way (the third: rest on it)
      if (k < 2) { await turn(Math.round(dir * 1.2 / 0.075), 0); await sleep(120); }
      else await sleep(700);
    }
    await sleep(500);
    s = await st();
    if (s.safe.cracked) { await press(); await sleep(2600); }
    return (await st()).safe.opened;
  };
  // the pieces of the check: each turned to the first's turn and dragged to where it tore from
  const pieceCheck = async () => {
    await sleep(900);
    const Q = `(() => { const st = N.game.scenes.ctx.flags.checkSt, A = N.game.puzzles.active; if (!st || !A) return null; const a = A.anchor, yaw = a.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
      const tab = (p) => { const dx = p.x - a.pos.x, dz = p.z - a.pos.z; return [dx * c - dz * s, -(dx * s + dz * c)]; };
      const P = st.pieces; const ref = P[0];
      return { ptr: [A.pointer.x, A.pointer.z], whole: st.whole, pieces: P.map((q) => { const w = q === ref ? q.g.position : (() => { const dx = q.c.x - ref.c.x, dy = q.c.y - ref.c.y; const v = new N.THREE.Vector3(dx, 0, -dy).applyAxisAngle(new N.THREE.Vector3(0, 1, 0), ref.g.rotation.y); return ref.g.position.clone().add(v); })();
        return { i: q.i, group: q.group, at: tab(q.g.position), want: tab(w), rot: q.g.rotation.y, wantRot: ref.g.rotation.y }; }) }; })()`;
    const [cx, cy] = cursor();
    // (closed-loop, as a hand watching the piece: the page may take a mouse move into more than one step)
    const ptrTo = async (x, z) => {
      for (let i = 0; i < 20; i++) {
        const q = await js(Q); if (!q) return;
        const dx = x - q.ptr[0], dz = z - q.ptr[1];
        if (Math.hypot(dx, dz) < 0.002) return;
        await turn(Math.round(dx * 0.5 / 0.0006), Math.round(-dz * 0.5 / 0.0006)); await sleep(45);
      }
    };
    // a piece (and its group) held and carried until its middle is at (x, z)
    const carry = async (i, x, z) => {
      let q = await js(Q); if (!q) return;
      await ptrTo(q.pieces[i].at[0], q.pieces[i].at[1]);
      await mouse('mousePressed', cx, cy, 'left'); await sleep(90);
      for (let k = 0; k < 24; k++) {
        q = await js(Q); if (!q) break;
        const m = q.pieces[i];
        const dx = x - m.at[0], dz = z - m.at[1];
        if (Math.hypot(dx, dz) < 0.0025) break;
        await turn(Math.round(dx * 0.5 / 0.0006), Math.round(-dz * 0.5 / 0.0006)); await sleep(45);
      }
      await mouse('mouseReleased', cx, cy, 'left'); await sleep(200);
    };
    // a piece turned by the wheel over it until it lies as the first does
    const turnTo = async (i) => {
      let q = await js(Q); if (!q) return;
      await ptrTo(q.pieces[i].at[0], q.pieces[i].at[1]);
      for (let k = 0; k < 24; k++) {
        q = await js(Q); if (!q) break;
        const m = q.pieces[i], dr = wrap(m.wantRot - m.rot);
        if (Math.abs(dr) < 0.03) break;
        // (a notch of the wheel turns it 0.0025 rad a unit; rotation -= turn)
        const units = Math.max(-240, Math.min(240, Math.round(-dr * 0.6 / 0.0025)));
        const [px, py] = cursor();
        await mouse('mouseWheel', px, py, 'none', { deltaX: 0, deltaY: units });
        await sleep(45);
      }
    };
    // (the first piece to the middle of the table: the rest are laid round it)
    await carry(0, 0, 0);
    for (let round = 0; round < 3; round++) {
      let q = await js(Q); if (!q || q.whole) break;
      for (const p of q.pieces) {
        q = await js(Q); if (!q || q.whole) break;
        const me = q.pieces[p.i], g0 = q.pieces[0].group;
        if (me.group === g0) continue;
        await turnTo(p.i);
        q = await js(Q); if (!q) break;
        const m2 = q.pieces[p.i];
        await carry(p.i, m2.want[0], m2.want[1]);
        if (opts.debug) { const q2 = await js(Q); log('piece ' + p.i + ' -> ' + JSON.stringify(q2 && q2.pieces.map((z) => [z.i, z.group, z.at.map((v) => +v.toFixed(3)), z.want.map((v) => +v.toFixed(3)), +z.rot.toFixed(2)]))); }
      }
    }
    for (let i = 0; i < 40; i++) { const s = await st(); if (!s.puzzle) return true; await sleep(150); }
    return false;
  };

  const steps = opts.order || ['door', 'ames', 'lamp', 'search', 'drawer', 'pencil', 'pad', 'picture', 'dial', 'envelope', 'check', 'stills'];
  for (const step of steps) {
    const s0 = await st();
    log(`c5 office: ${step} (beat ${s0.beat}, obj '${s0.obj}')`);
    rec.t[step] = +((Date.now() - t0) / 1000).toFixed(1);
    switch (step) {
      case 'door': await walk(R.toDoor); await use('doorAMES', [-3.88, 1.1, 3.6]); await walk(R.intoOuter); await sleep(1800); break;
      case 'corridor': { const s = await st(); if (s.x > 0) await walk([[0.6, 3.4], [-1.2, 3.4]]); await walk([[-3.0, 3.35]]); await use('doorAMES', [-3.88, 1.1, 3.6]); await walk([[-4.7, 3.35], [-4.75, 0.0], [-4.75, 3.35]]); await use('doorAMES', [-3.88, 1.1, 3.6]); await walk([[-3.0, 3.35], [-1.2, 3.4], [0.6, 3.4]]); break; }
      case 'outer': { await walk([[-1.0, 5.6]]); await use('cooler', [-0.62, 1.0, 6.5]); await use('typewriter', [-1.56, 0.88, 5.1]); await walk([[-1.2, 3.4], [0.6, 3.4]]); break; }
      case 'ames': await walk(R.toOpening); break;
      case 'lamp': await goBehindN(); await use('chain', P.chain); break;
      case 'search': await goBehindS(); await use('ames', [P.ames[0] - 0.12, P.ames[1] - 0.05, P.ames[2]]); await sleep(2800); break;
      case 'drawer': await goBehindN(); await use('drawerR1', P.r1); { const s = await st(); if (s.s && !s.s.key) break; } await sleep(300); if ((await st()).curPrompt === 'open') await press(); await sleep(600); break;
      case 'drawers': await goBehindN(); for (const id of ['R2', 'R3']) { const d = await js(`(() => { const O = N.game.stage.part('office'), d = O.desk.drawers.find((q) => q.id === '${id}'); return d.group.parent.localToWorld(new N.THREE.Vector3(d.group.position.x + 0.03, d.y + 0.1, d.z)).toArray(); })()`); await use('drawer' + id, d); await sleep(500); await use('drawer' + id, d); } await use('drawerR1', P.r1); await sleep(300); await goBehindS(); for (const id of ['L1', 'L2']) { const d = await js(`(() => { const O = N.game.stage.part('office'), d = O.desk.drawers.find((q) => q.id === '${id}'); return d.group.parent.localToWorld(new N.THREE.Vector3(d.group.position.x + 0.03, d.y + 0.1, d.z)).toArray(); })()`); await use('drawer' + id, d); await sleep(500); } break;
      case 'cabinets': await walk([[1.02, 5.3]]); { const id = await js(`N.game.stage.part('office').cabinets[1].drawers[1].id`); const p = await js(`(() => { const c = N.game.stage.part('office').cabinets[1], d = c.drawers[1]; return c.group.localToWorld(new N.THREE.Vector3(0, d.y + 0.2, d.group.position.z - 0.02)).toArray(); })()`); await use('cab' + id, p); await sleep(500); await use('cab' + id, p); } break;
      case 'pencil': { await goBehindN(); const p = await js(`(() => { const pc = N.game.stage.part('office').pencil; return pc && pc.parent ? pc.getWorldPosition(new N.THREE.Vector3()).toArray() : null; })()`); if (p) await use('pencil', p); else rec.fails.push('no pencil'); break; }
      case 'phone': await goBehindS(); await use('phone', P.phone); await sleep(400); { const p = await js(`N.game.stage.part('office').phone.recv.getWorldPosition(new N.THREE.Vector3()).toArray()`); await use('phone', p); } break;
      case 'ash': await goFront(); await use('ash', P.ash); break;
      case 'hat': await walk([[1.0, 5.0]]); await use('hat', P.hat); break;
      case 'photo': await walk([[1.2, 5.3]]); await use('photo', P.photo); break;
      case 'pad0': await goFront(); await use('pad', P.pad); await sleep(800); break;
      case 'pad': await goFront(); await use('pad', P.pad); await sleep(400); await rubPad(); break;
      case 'padHalf': await goFront(); await use('pad', P.pad); await sleep(400); await rubPad({ half: true }); await sleep(800); break;
      case 'picture': await goSafe(); await use('picture', P.pic); await sleep(900); break;
      case 'dial0': await goSafe(); await use('safe', P.dial); await sleep(800); await turn(-300, 0); await sleep(300); await press(); await sleep(800); break;
      case 'dialHalf': await goSafe(); await use('safe', P.dial); await turnDial({ half: true }); await press(); await sleep(800); break;
      case 'dial': await goSafe(); await use('safe', P.dial); { const ok = await turnDial(); if (!ok) rec.fails.push('dial'); } break;
      case 'envelope': { await goSafe(); const p = await js(`(() => { const E = N.game.stage.part('office').envelope; return E && E.parent ? E.getWorldPosition(new N.THREE.Vector3()).toArray() : null; })()`); if (p) await use('envelope', p); break; }
      case 'check': await goFront(); await walk([[3.0, 3.8]]); await use('lay', [3.92, 0.8, 3.9]); { const ok = await pieceCheck(); if (!ok) rec.fails.push('check'); } break;
      case 'stills': for (let i = 0; i < 30; i++) { const s = await st(); if (!s.stills && s.beat === 'done') break; if (s.stills) { await mouse('mousePressed', ...cursor(), 'left'); await sleep(60); await mouse('mouseReleased', ...cursor(), 'left'); } await sleep(700); } break;
      case 'leave': { const s1 = await st(); for (let k = 0; k < 6; k++) { await turn(Math.round(0.25 / s1.sens), 0); await sleep(40); } } for (let i = 0; i < 30; i++) { const s = await st(); if (s.scene === 'gunfight') break; await sleep(300); } break;
      default: log('unknown step ' + step);
    }
    if (opts.snaps) await shot('c5_' + step);
    if (rec.fails.length && opts.stopOnFail !== false) { log('c5 office: stopped at ' + step + ': ' + rec.fails.join('; ')); await shot('c5_fail_' + step); break; }
  }
  await keyUp('KeyW');
  const s = await st();
  rec.end = { scene: s.scene, beat: s.beat, s: s.s, obj: s.obj, hints: s.s && s.s.hints };
  rec.secs = +((Date.now() - t0) / 1000).toFixed(1);
  void sleep0; void H; void W;
  return rec;
}
