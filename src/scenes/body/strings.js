import * as THREE from 'three';
import { chalkMaterial, segment, dashed, ring } from './chalk.js';
import { XV, STOOD, SHOOTER, WOUNDS, MARKS, STUDY, ALLEY, V } from './place.js';

// Puzzle A, the line of fire (scene 3, lane B1). Where he stood is drawn
// as an inker would: a dashed outline of a standing man, the two wounds
// ringed. From the study view (the plane of the shots face on) I carry the
// free end of a string pinned in a bullet mark; the line from the mark
// through my end runs on across the alley as a faint ray to what it
// strikes. Through the wound it goes taut (a pluck, a twitch) and stays;
// the second crosses the first on the fire escape's landing, where the red
// shows. One to one: the end is where the pointer is, on that plane.
// (no default export: not a scene)

// the outline: a standing man in profile, facing the landing (-z); d is
// toward his front, h up from the flags; his hat on (it is in the gutter now)
const PROFILE = [
  [-0.1, 0.0], [-0.125, 0.07], [-0.075, 0.3], [-0.085, 0.47], [-0.11, 0.56], [-0.12, 0.8], [-0.15, 0.93],
  [-0.135, 1.06], [-0.12, 1.14], [-0.14, 1.3], [-0.145, 1.42], [-0.115, 1.52], [-0.07, 1.575],
  [-0.075, 1.62], [-0.095, 1.67], [-0.155, 1.705], [-0.1, 1.72], [-0.085, 1.82], [-0.02, 1.855], [0.05, 1.84],
  [0.085, 1.78], [0.095, 1.73], [0.19, 1.72], [0.1, 1.7], [0.1, 1.655], [0.125, 1.628], [0.1, 1.6], [0.09, 1.575],
  [0.06, 1.55], [0.1, 1.49], [0.14, 1.4], [0.145, 1.28], [0.13, 1.14], [0.125, 1.0], [0.11, 0.84],
  [0.095, 0.62], [0.085, 0.5], [0.07, 0.3], [0.07, 0.12], [0.1, 0.07], [0.21, 0.035], [0.215, 0.0],
];

// the outline and the rings, built once and raised (faded in) by the scene
export function makeOutline(stage) {
  const mat = chalkMaterial({ color: 0.95, minPx: 2.0, opacity: 0 });
  const pts = PROFILE.map(([d, h]) => V(XV + 0.03, ALLEY.y + h, STOOD.z - d));
  const g = new THREE.Group();
  g.name = 'body_outline';
  g.add(dashed(pts, mat, { dash: 0.07, gap: 0.05, r: 0.0035 }));
  for (const w of WOUNDS) g.add(ring(w.clone().setX(XV + 0.04), V(1, 0, 0), 0.045, mat, { r: 0.003, dashes: 7 }));
  stage.scene.add(g);
  const O = { group: g, mat, k: 0, want: 0 };
  O.raise = (on = true) => { O.want = on ? 1 : 0; };
  O.set = (k) => { O.k = O.want = k; mat.uniforms.uOpacity.value = k; g.visible = k > 0.001; };
  O.step = (dt) => {
    if (Math.abs(O.want - O.k) < 1e-4) return;
    O.k += Math.sign(O.want - O.k) * Math.min(Math.abs(O.want - O.k), dt / 0.9);
    mat.uniforms.uOpacity.value = O.k * O.k * (3 - 2 * O.k);
    g.visible = O.k > 0.001;
  };
  O.remove = () => { if (g.parent) g.parent.remove(g); };
  O.set(0);
  return O;
}

// the pins in the marks and the strings (taut ones stay in the world)
export function makeStrings(stage) {
  const strong = chalkMaterial({ color: 1.0, minPx: 2.4 });
  const faint = chalkMaterial({ color: 0.8, minPx: 1.6, opacity: 0.45 });
  const g = new THREE.Group();
  g.name = 'body_strings';
  stage.scene.add(g);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.5 });
  const S = MARKS.map((m, i) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6).rotateX(Math.PI / 2).translate(0, 0, -0.02), pinMat);
    pin.position.copy(m);
    pin.userData.noRay = true;
    g.add(pin);
    const a = segment(strong, 0.0035), b = segment(strong, 0.0035), ray = segment(faint, 0.002);
    for (const s of [a, b, ray]) g.add(s.mesh);
    const st = { i, mark: m, wound: WOUNDS[i], a, b, ray, end: m.clone().add(V(0, -0.22, 0)), taut: false, twitch: 0 };
    // (at rest the string hangs from its pin)
    a.set(m, st.end); b.mesh.visible = false; ray.mesh.visible = false;
    return st;
  });
  const R = { group: g, strings: S };
  R.remove = () => { if (g.parent) g.parent.remove(g); };
  // a taut string: from the mark through the wound to the gun; a twitch
  // bows it a little and dies away
  R.drawTaut = (st) => {
    const mid = st.mark.clone().lerp(SHOOTER, 0.5);
    if (st.twitch > 0) {
      const k = st.twitch / 0.35;
      const off = Math.sin((1 - k) * 42) * 0.03 * k * k;
      mid.y += off; mid.x += off * 0.4;
    }
    st.a.set(st.mark, mid); st.b.set(mid, SHOOTER);
    st.ray.mesh.visible = false;
  };
  R.setTaut = (st) => { st.taut = true; st.end.copy(SHOOTER); R.drawTaut(st); };
  return R;
}

const _ray = new THREE.Raycaster(), _n = new THREE.Vector2();
const PLANE = new THREE.Plane(new THREE.Vector3(1, 0, 0), -XV);
const TOL = THREE.MathUtils.degToRad(3.4);

// The puzzle's run, stepped by the scene (ctx.onStep): the study view (the
// eye eased there from where it was), the pointer, the strings.
//   run.done   both taut (the solved picture held its beat)
export function runStrings(ctx, R, O, { from = null } = {}) {
  const { game: G, stage, controller: C } = ctx;
  const alley = stage.part('alley');
  const cam = G.camera;
  // the eye eased from where it was to the study view, and held there
  const P0 = from || C.eyePose();
  const P1 = { x: STUDY.x, y: STUDY.y, z: STUDY.z, yaw: STUDY.yaw, pitch: STUDY.pitch };
  const EASE = 1.3;
  let push = 0;
  const PUSH = SHOOTER.clone().sub(V(P1.x, P1.y, P1.z)).setLength(0.3);
  const track = (t) => {
    const u = Math.min(1, t / EASE), k = u * u * (3 - 2 * u);
    const L = (a, b) => a + (b - a) * k;
    const dy = Math.atan2(Math.sin(P1.yaw - P0.yaw), Math.cos(P1.yaw - P0.yaw));
    // (solved: a slow push toward where the lines cross, 0.3 m along the
    // line from the eye to it [second pass: toward it from any study view])
    const px = PUSH.x * push, py = PUSH.y * push, pz = PUSH.z * push, pp = push * 0.1;
    return { x: L(P0.x, P1.x) + px, y: L(P0.y, P1.y) + py, z: L(P0.z, P1.z) + pz, yaw: P0.yaw + dy * k, pitch: L(P0.pitch, P1.pitch) + pp };
  };
  C.setMode('cutscene', { track });
  const fov0 = cam.fov;
  const run = { active: true, done: false, t: 0, cur: 0, ndc: new THREE.Vector2(), progress: 0, idle: 0, hinted: 0, solvedT: -1, ease: EASE };
  const S = R.strings;
  // the pointer starts on the first pin
  const toNdc = (p) => { const v = p.clone().project(cam); return new THREE.Vector2(v.x, v.y); };
  const HINTS = ['Through the wound.', 'Carry the end through the ring on his chest.', 'Move the mouse: the string through the circle.'];
  // (shot mode, the strips: the pointer put on a world point)
  run.aimAt = (p) => { if (run.t >= EASE * 0.85) run.ndc.lerp(toNdc(p), 0.1); };
  run.skipTo = (i) => { for (let k = 0; k < i; k++) if (!S[k].taut) R.setTaut(S[k]); run.cur = i; };
  run.step = (dt) => {
    if (!run.active) return;
    run.t += dt;
    // (the lens eases to the study's)
    const u = Math.min(1, run.t / EASE), k = u * u * (3 - 2 * u);
    const f = fov0 + (STUDY.fov - fov0) * k;
    if (Math.abs(cam.fov - f) > 1e-3) { cam.fov = f; cam.updateProjectionMatrix(); }
    for (const st of S) if (st.taut) { if (st.twitch > 0) st.twitch = Math.max(0, st.twitch - dt); R.drawTaut(st); }
    if (run.solvedT >= 0) {
      run.solvedT += dt;
      push = Math.min(1, run.solvedT / 2.6);
      push = push * push * (3 - 2 * push);
      if (run.solvedT > 2.4) { run.done = true; }
      return;
    }
    if (run.t < EASE * 0.85) {
      // (the pointer rides the pin until the view has arrived)
      run.ndc.copy(toNdc(S[run.cur].mark));
      return;
    }
    const st = S[run.cur];
    // the mouse carries the end, one to one on the screen
    const m = G.mouse;
    run.ndc.x = Math.max(-0.97, Math.min(0.97, run.ndc.x + m.dx * 2 / innerWidth));
    run.ndc.y = Math.max(-0.95, Math.min(0.95, run.ndc.y - m.dy * 2 / innerHeight));
    _ray.setFromCamera(_n.copy(run.ndc), cam);
    const hit = _ray.ray.intersectPlane(PLANE, new THREE.Vector3());
    if (hit) {
      hit.z = Math.max(ALLEY.zN + 0.05, Math.min(ALLEY.zS - 0.03, hit.z));
      hit.y = Math.max(ALLEY.y + 0.05, Math.min(9, hit.y));
      st.end.copy(hit);
    }
    // [R2-G] (my hand holds the end now, hands.js stringHand: no cross)
    // the string from the pin to my end; the ray on from it to what it strikes
    const dir = st.end.clone().sub(st.mark);
    const len = dir.length();
    st.a.set(st.mark, st.end); st.b.mesh.visible = false;
    if (len > 0.12) {
      dir.divideScalar(len);
      _ray.set(st.end, dir); _ray.far = 14;
      const hits = alley ? _ray.intersectObjects(alley.rayTargets(), false) : [];
      const far = hits.length ? hits[0].point : st.end.clone().addScaledVector(dir, 9);
      st.ray.set(st.end, far);
    } else st.ray.mesh.visible = false;
    // through the wound: taut
    const w = st.wound.clone().sub(st.mark);
    const ang = len > 1e-3 ? dir.angleTo(w) : Math.PI;
    if ((len > w.length() * 1.05 && ang < TOL) || st.end.distanceTo(st.wound) < 0.07) {
      R.setTaut(st);
      st.twitch = 0.35;
      G.sfx.play('stringTaut', st.wound);
      run.progress++;
      run.idle = 0;
      if (run.cur + 1 < S.length) {
        run.cur++;
        // (the pointer goes to the next pin)
        run.ndc.copy(toNdc(S[run.cur].mark));
      } else {
        run.solvedT = 0;
        G.hud.cursor(null);
        G.hud.clearPrompt('scene');
        if (ctx.onSolvedStrings) ctx.onSolvedStrings();
      }
      return;
    }
    // the framework's hint: 40 s without a string going taut
    run.idle += dt;
    if (run.idle > 40 && run.hinted < 3) { G.hud.say(HINTS[run.hinted], 4); run.hinted++; run.idle = 0; }
  };
  run.end = () => {
    run.active = false;
    G.hud.cursor(null);
    if (Math.abs(cam.fov - fov0) > 1e-3) { cam.fov = fov0; cam.updateProjectionMatrix(); }
  };
  run.fov0 = fov0;
  return run;
}
