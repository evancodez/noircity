// [O1c] the street answers a fist (docs/briefs/O1C_STREETS.md §2): a walk down
// Grand Ave hitting every kind of thing once by real input - for each, set up
// standing a step off it and facing it (a tool's teleport between walks, as the
// jank walk's), a short walk at it by W, then LMB (twice for the second blow) -
// and what it did: the set's record (a jolt, over, broken), the hand (hurt: the
// flinch and the beat), the glass (cracked, then gone), a bottle (broken), a car
// (its skin dented - the damage record's dents -, its body rocked, the crime),
// the crimes it made; 3.5 s on, nothing floating, everything resting, and
// ([O1c] after the critic, B2) SEEN where it lies: from 3 m, looking at it,
// the frame with it and without it differ where it lies (__seeLying).
//   { "drive": "tools/lib/o1c_fist.mjs", "targets": [{ name, find, presses, expect }] }
//   find: an expression giving { x, z, it? (a set item), thing? } - the page's helpers below
//   expect: 'over' | 'break' | 'ring' (iron: stands, the hand hurts) | 'shake' (stands, no hurt)
//           | 'glass' (crack, then break) | 'wall' (the hand hurts) | 'door' | 'car' | 'item'
const HELPERS = `(() => {
  const C = G.stage.part('city').C, S = G.stage.smash;
  // the set's item of a kind nearest Grand Ave's pavements (x -120, z 30) - its record's or the lamp's
  window.__item = (kind, i = 0, from = [-120, 30], max = 400) => {
    const L = S.items.filter((it) => it.kind === kind && it.state === 'stand' && !it.gone && Math.hypot(it.x - from[0], it.z - from[1]) < max && !C.inWater(it.x, it.z));
    L.sort((a, b) => Math.hypot(a.x - from[0], a.z - from[1]) - Math.hypot(b.x - from[0], b.z - from[1]));
    return L[i] || null;
  };
  // where to stand: a step off its near side, on clear ground, on the street side (the way with most room)
  window.__standBy = (x, z, r, gap = 0.75) => {
    let best = null, bs = -1;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, d = r + gap + 0.35;
      const q = new N.THREE.Vector3(x + Math.cos(a) * d, 0, z + Math.sin(a) * d), q0 = q.clone();
      G.stage.colliders.resolve(q, 0.4);
      // (not inside a lot: a poly lot's walls are its edges only - nothing solid between me and it)
      if (q.distanceTo(q0) > 0.02 || C.inWater(q.x, q.z) || !G.stage.part('city').graph.lineOfSight(q.x, q.z, x, z)) continue;
      // (room behind me: clear 2.5 m back the same way)
      const b = new N.THREE.Vector3(x + Math.cos(a) * (d + 2.2), 0, z + Math.sin(a) * (d + 2.2)), b0 = b.clone();
      G.stage.colliders.resolve(b, 0.4);
      const room = b.distanceTo(b0) < 0.02 ? 2 : 1;
      if (room > bs) { bs = room; best = [q.x, q.z]; }
    }
    return best;
  };
  // the lowest point of an item's drawn shape over the ground there (floating > 0.15, sunk < -0.3)
  window.__rest = (it) => {
    const P = S.pools && S.pools[it.kind];
    const g = P && P.im && P.im.geometry;
    if (!g) return null;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox, v = new N.THREE.Vector3();
    let lo = Infinity;
    for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) { v.set(X, Y, Z).applyQuaternion(it.Q).add(it.P); lo = Math.min(lo, v.y); }
    return +(lo - G.stage.surfaceY(it.P.x, it.P.z)).toFixed(3);
  };
  // (the i-th of a kind with a clear place to stand by it: the next one when it has none)
  window.__T = (kind, i = 0) => { for (let k = i; k < i + 6; k++) { const it = window.__item(kind, k); if (!it) return null; const r = it.K.round ? it.K.r : Math.max(it.fp ? Math.min(it.fp.hx, it.fp.hz) : 0.3, 0.2); const st = window.__standBy(it.x, it.z, r); if (st) return { x: it.x, z: it.z, it, stand: st }; } return null; };
  // a place on a facade with nothing on it (no shop glass, no door) and clear ground before it
  const clearAt = (x, z) => { const q = new N.THREE.Vector3(x, 0, z), q0 = q.clone(); G.stage.colliders.resolve(q, 0.4); return q.distanceTo(q0) < 0.02 && !S.near(x, z, 1.6).some((it) => it.state === 'stand' && Math.hypot(it.x - x, it.z - z) < 1.6); };
  window.__face = (want) => {
    const st = G.stage.part('stream');
    const L = C.lots.filter((l) => l.kind === 'rect' && !l.place && Math.hypot((l.x0 + l.x1) / 2 + 120, (l.z0 + l.z1) / 2 - 30) < 160);
    L.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 + 120, (a.z0 + a.z1) / 2 - 30) - Math.hypot((b.x0 + b.x1) / 2 + 120, (b.z0 + b.z1) / 2 - 30));
    for (const l of L) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let u = 0.15; u < 0.9; u += 0.07) {
      const x = nx ? (nx > 0 ? l.x1 : l.x0) : l.x0 + (l.x1 - l.x0) * u, z = nz ? (nz > 0 ? l.z1 : l.z0) : l.z0 + (l.z1 - l.z0) * u;
      const sx = x + nx * 1.0, sz = z + nz * 1.0;
      if (!clearAt(sx, sz)) continue;
      const door = st.doorNear(x, z, want === 'door' ? 0.5 : 2.2);
      const shop = S.shopNear(sx, sz, null, 1.6);
      if (want === 'wall' && !door && !shop) return { x, z, stand: [sx, sz], kind: 'wall' };
      if (want === 'door' && door) { const dx = door.x + (door.nx || nx) * 1.0, dz = door.z + (door.nz || nz) * 1.0; if (clearAt(dx, dz)) return { x: door.x, z: door.z, stand: [dx, dz], kind: 'door' }; }
      if (want === 'glass' && shop && shop.w > 1.6 && !door && !(shop.it && shop.it.pane)) { const gx = shop.x + shop.nx * 1.0, gz = shop.z + shop.nz * 1.0; if (clearAt(gx, gz)) return { x: shop.x, z: shop.z, w: shop, stand: [gx, gz], kind: 'glass' }; }
    }
    return null;
  };
  window.__car = () => { const L = (G.vehicles.list || []).filter((c) => !c.wrecked && Math.abs(c.speed || 0) < 0.1); L.sort((a, b) => Math.hypot(a.pos.x + 120, a.pos.z - 30) - Math.hypot(b.pos.x + 120, b.pos.z - 30)); const c = L[0]; return c ? { x: c.pos.x, z: c.pos.z, r: 1.05, kind: 'car', car: c } : null; };
  // (a car's damage record: its dents (the scar's slots in use) and the body's rock, sampled)
  window.__dents = (c) => { const D = c && c.smashD; return D && D.scar ? D.scar.dents.filter((d) => d.w > 0).length : 0; };
  window.__rockOn = (c) => { window.__rock = 0; const f = () => { window.__rock = Math.max(window.__rock, Math.abs(c.roll) + Math.abs(c.pitch)); if (window.__rockT > performance.now()) requestAnimationFrame(f); }; window.__rockT = performance.now() + 3000; requestAnimationFrame(f); };
  window.__bottle = () => { const I = G.stage.part('items'); const L = I.list.filter((it) => it.kind === 'bottle' && !it.taken && !C.inWater(it.x, it.z)); L.sort((a, b) => Math.hypot(a.x + 120, a.z - 30) - Math.hypot(b.x + 120, b.z - 30)); for (const it of L) { const n = S.near(it.x, it.z, 2).filter((q) => q.state === 'stand' && Math.hypot(q.x - it.x, q.z - it.z) < 1.6); if (!n.length) return { x: it.x, z: it.z, item: it, r: 0.05, kind: 'bottle' }; } return null; };
  // a thing a cop can see (6 - 22 m off, in his line): the vandal's witness
  window.__seen = (kind) => { const P = G.police, g = G.stage.part('city').graph; if (!P) return null; for (const c of P.cops) { if (!c.standing) continue; const L = S.near(c.pos.x, c.pos.z, 22).filter((it) => it.kind === kind && it.state === 'stand' && Math.hypot(it.x - c.pos.x, it.z - c.pos.z) > 6 && g.lineOfSight(c.pos.x, c.pos.z, it.x, it.z)); if (L.length) return { x: L[0].x, z: L[0].z, it: L[0], cop: c.pos.clone() }; } return null; };
  // ([O1c] after the critic, B2) is a thing lying seen? From 3 m, facing it, looking down at it:
  // two frames of the canvas, with it drawn and with its instance taken out, inside its
  // drawn box: the share of pixels it changes by 20 levels or more (ink on ink: next to none),
  // the share it makes brighter, and the mean change. (A rAF set after the game's own runs after its render: the canvas
  // still holds the frame.)
  window.__grab = () => new Promise((res) => requestAnimationFrame(() => { const c = document.querySelector('canvas'), w = c.width, h = c.height, x = document.createElement('canvas'); x.width = w; x.height = h; const g = x.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0); res({ g, w, h }); }));
  window.__seeLying = async (it) => {
    const P = S.pools[it.kind]; if (!P || it.inst < 0) return null;
    const e = G.eye; let ax = it.P.x - e.x, az = it.P.z - e.z; const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
    N.controller.setPose(it.P.x - ax * 3, it.P.z - az * 3, Math.atan2(-ax, -az), -0.32);
    await new Promise((r) => setTimeout(r, 700));
    const g = P.im.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox, v = new N.THREE.Vector3(), c = document.querySelector('canvas');
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const X of [b.min.x, b.max.x]) for (const Y of [b.min.y, b.max.y]) for (const Z of [b.min.z, b.max.z]) { v.set(X, Y, Z).applyQuaternion(it.Q).add(it.P).project(G.camera); const px = (v.x + 1) / 2 * c.width, py = (1 - v.y) / 2 * c.height; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(c.width - 1, Math.ceil(x1)); y1 = Math.min(c.height - 1, Math.ceil(y1));
    if (x1 - x0 < 4 || y1 - y0 < 4) return { frac: 0, d: 0, box: 0 };
    const A = await window.__grab();
    const m = new N.THREE.Matrix4(); P.im.getMatrixAt(it.inst, m); P.im.setMatrixAt(it.inst, new N.THREE.Matrix4().makeScale(0, 0, 0)); P.im.instanceMatrix.needsUpdate = true;
    await new Promise((r) => requestAnimationFrame(() => r()));
    const B = await window.__grab();
    P.im.setMatrixAt(it.inst, m); P.im.instanceMatrix.needsUpdate = true;
    const a = A.g.getImageData(x0, y0, x1 - x0, y1 - y0).data, q = B.g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let n = 0, up = 0, any = 0, sum = 0;
    for (let i = 0; i < a.length; i += 4) { const la = (a[i] + a[i + 1] + a[i + 2]) / 3, lb = (q[i] + q[i + 1] + q[i + 2]) / 3; n++; sum += la - lb; if (la - lb >= 20) up++; if (Math.abs(la - lb) >= 20) any++; }
    return { frac: +(any / n).toFixed(3), up: +(up / n).toFixed(3), d: +(sum / n).toFixed(1), box: n };
  };
  window.__fistLog = [];
  // (the press's latency: the page's own mousedown to the swing's frame - performance.now both)
  if (!window.__swOn) { window.__swOn = 1; document.addEventListener('mousedown', () => { window.__down = performance.now(); }, true); G.on('city:swing', () => { window.__swing = performance.now(); }); }
  if (!window.__fistOn) { window.__fistOn = 1; G.on('city:fist', (e) => window.__fistLog.push({ t: G.time, ...e, man: e.man || null })); }
  return 1;
})()`;

export default async function o1cFist({ js, keyDown, keyUp, mouse, sleep, log, opts, cursor }) {
  await js(HELPERS);
  const out = [];
  for (const T of opts.targets || []) {
    const tg = await js(`(() => { const t = ${T.find}; if (!t) return null; window.__t = t; const it = t.it || null;
      const r = it ? (it.K.round ? it.K.r : Math.max(it.fp ? Math.min(it.fp.hx, it.fp.hz) : 0.3, 0.2)) : (t.r || 0.3);
      const st = t.stand || window.__standBy(t.x, t.z, r, ${T.gap ?? 0.75});
      if (!st) return null;
      G.stage.part('stream').warmAround(st[0], st[1]);
      // (facing it, from a little further back: the walk at it is the keys)
      const ax = t.x - st[0], az = t.z - st[1], al = Math.hypot(ax, az) || 1;
      const bx = st[0] - ax / al * 0.6, bz = st[1] - az / al * 0.6;
      N.controller.setPose(bx, bz, Math.atan2(-ax, -az), ${T.pitch ?? -0.12});
      window.__ev0 = G.stage.smash.events.length; window.__cr0 = G.crime ? G.crime.log.length : 0; window.__fl0 = window.__fistLog.length;
      window.__dent0 = t.car ? window.__dents(t.car) : 0; if (t.car) window.__rockOn(t.car);
      return { x: +t.x.toFixed(1), z: +t.z.toFixed(1), kind: it ? it.kind : t.kind, at: [+bx.toFixed(1), +bz.toFixed(1)] }; })()`);
    if (!tg) { out.push({ name: T.name, ok: false, why: 'not found' }); log(`  ${T.name}: NOT FOUND`); continue; }
    await sleep(250);
    // a short walk at it by W (0.25 s), then the press (twice: the second blow)
    await keyDown('KeyW'); await sleep(T.walk ?? 260); await keyUp('KeyW');
    await sleep(120);
    const [cx, cy] = cursor();
    await js('(window.__down = window.__swing = null, 1)');
    for (let k = 0; k < (T.presses || 1); k++) {
      await mouse('mousePressed', cx, cy, 'left'); await sleep(60); await mouse('mouseReleased', cx, cy, 'left');
      if (k + 1 < (T.presses || 1)) await sleep(T.between ?? 700);
    }
    // the first frame that shows the act (the hands up: the press's latency)
    const lat = await js(`(window.__swing && window.__down && window.__swing >= window.__down ? +(window.__swing - window.__down).toFixed(1) : null)`);
    await sleep(T.settle ?? 3500);
    const r = await js(`(() => { const t = window.__t, it = t.it || null, S = G.stage.smash;
      const ev = S.events.slice(window.__ev0).filter((e) => !it || e.id === it.id).map((e) => e.what + ':' + e.by);
      const fl = window.__fistLog.slice(window.__fl0).map((e) => (e.thing || 'whiff') + (e.how ? ':' + e.how : '') + (e.hurt ? ':hurt' : ''));
      const cr = G.crime ? G.crime.log.slice(window.__cr0).map((c) => c.kind + (c.seen ? '@' + c.seen : '')) : [];
      const pane = t.w && t.w.it && t.w.it.pane ? t.w.it.pane.state : null;
      const item = t.item ? { taken: t.item.taken, x: +t.item.x.toFixed(2), z: +t.item.z.toFixed(2) } : null;
      return { state: it ? it.state : null, gone: it ? !!it.gone : null, rest: it && it.state !== 'stand' && !it.gone ? window.__rest(it) : null, ev, fl, cr, pane, item,
        heat: G.police ? G.police.heat : null,
        tilt: it && it.Q && it.state !== 'stand' ? Math.round(Math.acos(Math.min(1, new N.THREE.Vector3(0, 1, 0).applyQuaternion(it.Q).y)) * 57.3) : null,
        dents: t.car ? window.__dents(t.car) - window.__dent0 : null, rock: t.car ? +window.__rock.toFixed(3) : null,
        hands: G.player.hands.set, clip: G.player.hands.clip ? G.player.hands.clip.name : null }; })()`);
    // (what went over: seen where it lies, from 3 m)
    if (T.expect === 'over' && r.state === 'rest' && !r.gone) r.seen = await js(`window.__seeLying(window.__t.it)`);
    const e = T.expect, ev = r.ev.join(' '), fl = r.fl.join(' ');
    const lies = r.rest == null || (r.rest > -0.3 && r.rest < 0.15);
    let ok;
    const seen = !r.seen || r.seen.frac >= (opts.seenFrac ?? 0.15);
    if (e === 'over') ok = /over/.test(ev) && (r.state === 'rest') && lies && !!r.seen && seen;
    else if (e === 'break') ok = /break/.test(ev) && r.gone;
    else if (e === 'ring') ok = /jolt/.test(ev) && r.state === 'stand' && /:hurt/.test(fl);
    else if (e === 'shake') ok = /jolt/.test(ev) && r.state === 'stand' && !/:hurt/.test(fl);
    else if (e === 'glass') ok = /glass:crack/.test(fl) && /glass:break/.test(fl) && r.pane === 'gone';
    else if (e === 'wall') ok = /wall:hit:hurt/.test(fl);
    else if (e === 'door') ok = /door:hit/.test(fl);
    else if (e === 'car') ok = r.dents >= 1 && r.rock > 0.004 && r.cr.some((c) => c.startsWith('vandal'));
    else if (e === 'item') ok = /item:bottle:broken/.test(fl) && r.item && r.item.taken;
    else ok = true;
    if (T.crime) ok = ok && r.cr.some((c) => c.startsWith(T.crime));
    if (T.heat != null) ok = ok && r.heat >= T.heat;
    const rec = { name: T.name, kind: tg.kind, ok, lat, ...r };
    out.push(rec);
    log(`  ${T.name} (${tg.kind} at ${tg.x}, ${tg.z}): ${e} ${ok ? 'ok' : 'NOT OK'} - set: [${ev}] fist: [${fl}] ${r.state ? 'now ' + r.state : ''}${r.rest != null ? ` lowest ${r.rest} m over the ground, tilted ${r.tilt} deg` : ''}${r.seen ? ` seen from 3 m: ${(r.seen.frac * 100).toFixed(0)} % of its box changed by it (${(r.seen.up * 100).toFixed(0)} % brighter), mean ${r.seen.d}` : ''}${r.dents != null ? ` dents +${r.dents}, rock ${r.rock} rad` : ''}${r.pane ? ' pane ' + r.pane : ''}${r.cr.length ? ' crimes: ' + r.cr.join(',') : ''}${T.heat != null ? ' heat ' + r.heat : ''} (press to act ${lat} ms)`);
    if (T.shot && opts.shotEach) await sleep(10);
  }
  return { hits: out, bad: out.filter((h) => !h.ok).map((h) => h.name), lat: out.map((h) => h.lat).filter((x) => x != null) };
}
