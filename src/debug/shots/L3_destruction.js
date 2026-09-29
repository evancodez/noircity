import * as THREE from 'three';
import { setDebugWreckKind } from '../../world/Cars.js';
import { buildProp } from '../../props/index.js';
import { roundedBox } from '../../world/geom.js';

// Lane 3's presets (destruction). Query strings:
//   shot=wreck&t=<s>&wreckkind=A|B|C|D   the core wreck preset, its staged
//                                        blast forced to a kind (the param is
//                                        read here, at load: Shots.js is frozen)
//   shot=wreckstudy                      the four wrecks side on under the lamp,
//                                        no fire: the silhouette alone (D, on its
//                                        side, turned 35 deg: its underside and
//                                        rims toward us)
//   shot=wreckstudy&wk=A|B|C|D           one of them, 8 m away
const Q = () => new URLSearchParams(location.search);
setDebugWreckKind(Q().get('wreckkind'));

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// wreckstudy: the parked cars cleared away, the wrecks in a row across the
// avenue by the lamp at z = -17.5, seen side on against the lit mist down
// the avenue
function stageWreckStudy(world, camera, controller, game) {
  const cars = world.cars;
  for (const c of cars.cars) c.group.visible = false;
  const one = Q().get('wk');
  const kinds = one ? [one] : ['A', 'B', 'C', 'D'];
  const step = 5.3;
  kinds.forEach((k, i) => {
    const x = 0.4 + (i - (kinds.length - 1) / 2) * step;
    const car = cars.spawn({ pos: V(x, 0, -19.5), yaw: k === 'D' ? 0.6 : 0.0, lights: false, paint: 'paint' });
    cars.cars.push(car);
    // (D rolls onto its near side: its underside, axles and rims face us)
    cars.wreckNow(car, k, { fire: Q().get('fire') === '1', rollSgn: 1 });
  });
}

// glassstudy2: the diner's plate glass (bay B2, 3.55 x 2.5 m) seen from the
// kerb, shot `hits` times at seeded points in the last 2 s (1: a star; 4:
// stars and the first pieces out; 12: most of it gone; all: shattered by the
// rounds, the shards falling, then lying on the pavement at t + 3)
//   shot=glassstudy2&hits=1|4|12|all   (&age=<s>: seconds since the last round)
function stageGlassStudy(world, camera, controller, game) {
  const T = tEnd(presets.glassstudy2);
  const pane = world.part('dinerFront').panes.B2;
  const hq = Q().get('hits') || '4';
  const age = parseFloat(Q().get('age') ?? (hq === 'all' ? '0.45' : '0.4'));
  // (all: three rounds, then it goes at the frame's age - glass.shatter, as
  // the round that takes it past its count would)
  const n = hq === 'all' ? 3 : Math.max(1, parseInt(hq, 10) || 1);
  const pts = [];
  // (seeded points: a golden-ratio scatter over the pane, the first near the
  // middle; the eye fires them)
  for (let k = 0; k < n; k++) {
    const u = ((0.5 + k * 0.618034) % 1) - 0.5, v = ((0.37 + k * 0.414214) % 1) - 0.5;
    pts.push(new THREE.Vector3(pane.c.x, pane.c.y + v * pane.h * 0.8, pane.c.z + u * pane.w * 0.85));
  }
  const t1 = T - age - (hq === 'all' ? 0.3 : 0), t0 = Math.max(0.2, t1 - (hq === 'all' ? 0.6 : 1.6));
  let k = 0, gone = false;
  game.scripts.push((t) => {
    if (hq === 'all' && !gone && t >= T - age - 1e-6) {
      gone = true;
      const dir = pane.c.clone().sub(camera.position).normalize();
      game.glass.shatter(pane, { dir, power: 1, by: 'bullet', at: pts[0] });
    }
    while (k < pts.length && t >= t0 + (t1 - t0) * (pts.length > 1 ? k / (pts.length - 1) : 1) - 1e-6) {
      if (pane.state === 'gone') { k = pts.length; break; }
      const eye = camera.position.clone();
      const dir = pts[k].clone().sub(eye).normalize();
      const hit = game.rays.raycast(eye, dir, 30);
      if (hit) game.react.bullet(hit, dir);
      k++;
    }
  });
}

// windowman: the diner's end bay (B4) bursting outwards at the moment the
// brawler goes through it (glass.shatter with a man-sized hole round him),
// seen from the pavement; &age=<s> after the burst (default 0.12)
function stageWindowMan(world, camera, controller, game) {
  const T = tEnd(presets.windowman);
  const pane = world.part('dinerFront').panes.B4;
  const age = parseFloat(Q().get('age') ?? '0.12');
  const at = new THREE.Vector3(pane.c.x, 1.55, pane.c.z + 0.2);
  let mack = null;
  try {
    mack = game.cast && game.cast.spawn('brawler', { at: { x: -10.9, z: at.z }, yaw: -Math.PI / 2 });
  } catch (e) { mack = null; }
  let done = false;
  game.scripts.push((t) => {
    if (mack && mack.object) {
      // (he goes through backwards: a stand-in slide along +x)
      const u = Math.max(0, Math.min(1, (t - (T - age - 0.25)) / 0.6));
      mack.object.position.x = -10.9 + u * 1.9;
    }
    if (!done && t >= T - age - 1e-6) {
      done = true;
      game.glass.shatter(pane, { dir: new THREE.Vector3(1, 0.05, 0.1).normalize(), power: 1.6, at, by: 'body' });
      try { mack && mack.ko && mack.ko('deathBack'); } catch (e) { /* the stub cast */ }
    }
  });
}

// breakstudy: my own test bench on the pavement by the lamp at z = -17.5
// (a counter-high block, the things on it and beside it), seen from the
// building line against the lit street, each kind broken
// at t = 2.0 (the default frame: its contact, 0.02 s after)
//   shot=breakstudy&kind=<k>&t=<s>   k: bottle (on the bench, shot) | neck (in
//   the brawler's hand, broken on the bench: the neck stays) | plate | cup |
//   saucer | tumbler | stool | topple (a row of four) | table | pieCase |
//   jukebox (three hits) | liquid | pour | cig | punch | all (every thing on
//   the bench, whole)
function stageBreakStudy(world, camera, controller, game) {
  const kind = Q().get('kind') || 'all';
  const T0 = 2.0;
  const S = world, B = S.breakables;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const F = 0.15, top = 1.2, bx = -7.5, bz = -15.8;
  const M = S.M;
  const mk = (geo, mat, x, y, z, solid = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; m.userData.inkId = 2; S.scene.add(m); if (solid) S.addSolid(m); return m; };
  // the bench: a counter-high block
  mk(roundedBox(0.62, top - F, 1.6, 0.02, 2), M.stoneTrim || M.stone, bx, (top + F) / 2, bz);
  const onBench = (o, dz = 0, dx = 0) => { o.position.set(bx + dx, top, bz + dz); S.scene.add(o); return o; };
  const at = (o, y = 0.1) => o.localToWorld(V3(0, y, 0));
  const from = camera.position.clone();
  const shoot = (p) => { const d = p.clone().sub(from).normalize(); const h = game.rays.raycast(from, d, 20); if (h) game.react.bullet(h, d); };
  const ev = [];
  const want = (k) => kind === k || kind === 'all';
  if (want('bottle')) { const b = onBench(buildProp('bottle'), -0.55); B.add(b, { kind: 'bottle' }); ev.push([T0, () => shoot(at(b, 0.1))]); }
  if (want('plate')) { const b = onBench(buildProp('plate'), 0.1, 0.05); B.add(b, { kind: 'plate' }); ev.push([T0, () => B.hit(b, { point: at(b, 0.01), dir: V3(-1, -0.3, -0.2).normalize(), by: 'body', power: 1 })]); }
  if (want('cup')) { const b = onBench(buildProp('cup'), 0.45); B.add(b, { kind: 'cup' }); ev.push([T0, () => shoot(at(b, 0.04))]); }
  if (want('saucer')) { const b = onBench(buildProp('saucer'), 0.75); B.add(b, { kind: 'saucer' }); ev.push([T0, () => B.hit(b, { point: at(b, 0.01), dir: V3(-0.4, -1, 0).normalize(), by: 'fist', power: 3 })]); }
  if (want('tumbler')) { const b = onBench(buildProp('tumbler'), -0.2); b.userData.setFill(0.5); B.add(b, { kind: 'tumbler' }); ev.push([T0, () => shoot(at(b, 0.05))]); }
  if (want('pieCase')) {
    const c = new THREE.Group(); c.position.set(bx - 0.05, top, bz + 0.2);
    const frame = new THREE.Mesh(roundedBox(0.46, 0.03, 0.62, 0.01, 1).translate(0, 0.015, 0), M.chrome); c.add(frame);
    const gm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.1, transparent: true, opacity: 0.25, depthWrite: false });
    for (const [w, h, x, y, z, ry] of [[0.6, 0.34, 0.23, 0.2, 0, Math.PI / 2], [0.46, 0.34, 0, 0.2, 0.31, 0], [0.46, 0.34, 0, 0.2, -0.31, 0]]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); g.position.set(x, y, z); g.rotation.y = ry; g.userData.glass = true; c.add(g);
    }
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.6), gm); lid.position.set(0, 0.37, 0); lid.rotation.x = -Math.PI / 2; lid.userData.glass = true; c.add(lid);
    for (const dz of [-0.14, 0.14]) { const pie = buildProp('pie'); pie.position.set(0, 0.03, dz); c.add(pie); }
    S.scene.add(c);
    c.traverse((m) => { if (m.isMesh) { m.userData.inkId = m.userData.inkId || 3; S.addSolid(m); } });
    B.add(c, { kind: 'pieCase' });
    ev.push([T0, () => B.hit(c, { point: c.localToWorld(V3(0.23, 0.2, 0)), dir: V3(-1, 0, 0), by: 'body', power: 1 })]);
  }
  if (want('stool')) { const b = buildProp('stool'); b.position.set(bx + 0.1, F, bz - 1.25); S.scene.add(b); B.add(b, { kind: 'stool', hp: 3 }); ev.push([T0, () => B.hit(b, { point: at(b, 0.7), dir: V3(0.3, 0, -1).normalize(), by: 'body', power: 3 })]); }
  if (kind === 'topple') {
    const row = [];
    for (let i = 0; i < 4; i++) { const b = buildProp('stool'); b.position.set(bx + 0.2, F, bz - 2.4 + i * 0.62); S.scene.add(b); row.push(B.add(b, { kind: 'stool', hp: 3 })); }
    ev.push([T0, () => B.topple(row[3], V3(0, 0, -1.5))]);
  }
  if (want('table')) {
    const tb = mk(roundedBox(0.64, 0.04, 1.4, 0.01, 1), M.stoneTrim || M.stone, bx + 0.3, 0.88, bz + 1.6);
    const leg = new THREE.Mesh(roundedBox(0.1, 0.72, 0.1, 0.01, 1), M.stoneTrim || M.stone); leg.position.set(0, -0.38, 0); tb.add(leg);
    B.add(tb, { kind: 'table', hp: 3 });
    ev.push([T0, () => B.hit(tb, { point: tb.localToWorld(V3(0, 0.02, 0)), dir: V3(0, -1, 0), by: 'body', power: 3 })]);
  }
  if (kind === 'jukebox') {
    const j = new THREE.Group(); j.position.set(bx + 0.2, F, bz - 1.4);
    const body = new THREE.Mesh(roundedBox(0.9, 1.3, 0.6, 0.06, 2).translate(0, 0.65, 0), M.stoneTrim || M.stone); j.add(body);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35).rotateY(-Math.PI / 2).translate(-0.305, 1.0, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.7, 0.7) })); j.add(glow);
    S.scene.add(j);
    j.traverse((m) => { if (m.isMesh) { m.userData.inkId = 4; S.addSolid(m); } });
    B.add(j, { kind: 'jukebox', hp: 3 });
    for (const [k, dt] of [[0, -0.9], [1, -0.5], [2, 0]]) ev.push([T0 + dt, () => B.hit(j, { point: j.localToWorld(V3(-0.3, 0.7 + k * 0.15, -0.1 + k * 0.1)), dir: V3(1, 0, 0), by: 'fist', power: 1 })]);
  }
  if (kind === 'liquid') ev.push([T0, () => B.spill(V3(bx + 0.2, top, bz), { accent: 'amber', amount: 1 })]);
  if (kind === 'neck') {
    try {
      const mack = game.cast.spawn('brawler', { at: { x: bx + 0.9, z: bz + 0.95 }, yaw: -2.2 });
      const b = buildProp('bottle');
      mack.hold(b, 'R');
      B.add(b, { kind: 'bottle' });
      ev.push([T0, () => { B.hit(b, { point: b.localToWorld(V3(0, 0.1, 0)), dir: V3(-1, -0.4, 0).normalize(), by: 'body', power: 1 }); }]);
    } catch (e) { console.warn('breakstudy neck: no cast', e); }
  }
  if (kind === 'pour') {
    const g = onBench(buildProp('tumbler'), 0.0, 0.0);
    g.userData.setFill(0.2);
    // (the bottle tipped 120 deg over the glass, its mouth 7 cm above the rim)
    const b = buildProp('bottle'), a = 2.1, H = b.userData.size.y;
    const mouth = V3(bx, top + 0.085 + 0.07, bz - 0.02);
    b.position.set(mouth.x, mouth.y - H * Math.cos(a), mouth.z - H * Math.sin(a));
    b.rotation.x = a;
    S.scene.add(b);
    ev.push([T0 - 1.2, () => game.fx.pour.start({ from: b, to: g, accent: 'amber', rate: 1 })]);
  }
  if (kind === 'cig') {
    const tip = V3(bx - 0.18, top + 0.006, bz - 0.04);
    const c = buildProp('cigarette'); c.position.set(bx - 0.1, top, bz - 0.04); c.rotation.z = Math.PI / 2; S.scene.add(c);
    game.scripts.push((t) => { if (t > 0.3) game.fx.cig.wisp(tip); });
    ev.push([T0 - 1.0, () => game.fx.cig.exhale(V3(bx - 0.35, 1.5, bz + 0.35), V3(0.8, 0.15, -0.5).normalize())]);
  }
  if (kind === 'punch') ev.push([T0, () => game.fx.hit.punch(V3(bx, 1.6, bz), V3(1, 0, 0), 0.9)]);
  // (the eye turns to what breaks beside the bench)
  const near = { pour: [bx, top + 0.12, bz, 0.75], cig: [bx - 0.1, top + 0.2, bz, 0.9], punch: [bx, 1.6, bz, 1.6] }[kind];
  if (near) {
    const ex = near[0] - near[3], ez = near[2] + near[3] * 0.5, ey = 1.55;
    controller.setPose(ex, ez, Math.atan2(-(near[0] - ex), -(near[2] - ez)), Math.atan2(near[1] - ey, Math.hypot(near[0] - ex, near[2] - ez)), ey - 1.65);
    camera.updateMatrixWorld();
  }
  const aim = { stool: [bx + 0.1, 0.6, bz - 1.25], topple: [bx + 0.2, 0.6, bz - 1.5], jukebox: [bx + 0.2, 0.9, bz - 1.4], table: [bx + 0.3, 0.55, bz + 1.6], neck: [bx + 0.5, 1.3, bz + 0.6] }[kind];
  if (aim) {
    const ex = Math.max(-9.8, aim[0] - 1.6), ez = aim[2] + (kind === 'table' ? 2.6 : -2.6), eye = 1.8;
    const yaw = Math.atan2(-(aim[0] - ex), -(aim[2] - ez));
    const pitch = Math.atan2(aim[1] - eye, Math.hypot(aim[0] - ex, aim[2] - ez));
    controller.setPose(ex, ez, yaw, pitch, F);
    camera.updateMatrixWorld();
  }
  let k = 0;
  ev.sort((a, b) => a[0] - b[0]);
  game.scripts.push((t) => { while (k < ev.length && t >= ev[k][0] - 1e-6) ev[k++][1](); });
}

const tEnd = (shot) => { const t = parseFloat(Q().get('t') ?? ''); return Number.isFinite(t) ? t : shot.t; };

export const presets = {
  // (the bench at 3 m, a little above it)
  breakstudy: { x: -9.5, z: -15.8, y: 0.15, yaw: -Math.PI / 2, pitch: -0.2, fov: 50, t: 2.02, stage: stageBreakStudy },
  // (on the road by the kerb, square to bay B2, eye 1.65 over the street)
  glassstudy2: { x: -6.0, z: 5.0, y: 0.15, yaw: Math.PI / 2, pitch: 0.08, fov: 58, t: 4, stage: stageGlassStudy },
  windowman: { x: -6.2, z: -8.6 + 1.3, y: 0.15, yaw: 2.55, pitch: 0.0, fov: 62, t: 4, stage: stageWindowMan },
  wreckstudy: { x: 0.4, z: -9.0, y: 0.0, yaw: 0, pitch: -0.02, fov: 70, t: 2, stage: stageWreckStudy },
};
// (one wreck: 8 m from its side)
if (Q().get('wk')) Object.assign(presets.wreckstudy, { z: -11.5, fov: 55 });
