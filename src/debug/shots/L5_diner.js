import * as THREE from 'three';
import { DINER, stoolZ } from '../../stages/block/site.js';
import { PROP_KINDS, BOTTLE_VARIANTS } from '../../props/index.js';

// Lane 5's presets: the diner's room and the prop library.
//   propsheet                   every kind on the counter under a lamp, two rows, 0.6 m from the eye
//   propsheet&kind=<k>          one prop filling the frame (&variant=<v> for a bottle;
//                               &open=<0..1>, &fill=<0..1>, &tip=<unlit|lit|ash>, &turn=<rad>)
//   diner_seat                  the player's view from stool 4 at the back bar (eye y 1.60, fov 68)
//   diner_left / diner_right    from the stool, down the counter toward the door and windows /
//                               toward the jukebox
//   diner_wide                  from the door end, standing: the whole room, the cast in place
//   diner_booth                 from a booth, looking at the counter
//   diner_out                   from the stool, straight out through the glass at the street
//   ... each with &train=1 (the el passing, mid pass) where it shows;
//   &eye=x,y,z,yaw,pitch[,fov] puts the eye anywhere in the room (close looks)
// The room views stand the scene's cast where scene 1 has it (settle).
const Q = () => new URLSearchParams(location.search);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const C = DINER.counter;

// a fixed eye (the controller's cutscene mode holds it; the scene's setup
// may have seated the player first)
function holdEye(controller, pose) {
  controller.setMode('cutscene', { track: () => pose });
}

// the prop sheet: two rows on the counter top under the pendant at z 3.2
function stagePropSheet(stage, camera, controller) {
  const d = stage.part('diner');
  for (const k of [...d.items.keys()]) d.take(k);
  const q = Q(), one = q.get('kind');
  const z0 = DINER.pendants.z[2];
  const top = C.topY;
  if (one) {
    const o = d.place(one, V(C.frontX - 0.3, top, z0), { name: 'sheet', variant: q.get('variant') });
    const ud = o.userData;
    if (q.has('open')) ud.setOpen(parseFloat(q.get('open')));
    if (q.has('fill')) ud.setFill(parseFloat(q.get('fill')));
    if (q.has('tip')) ud.setTip(q.get('tip'));
    o.rotation.y = parseFloat(q.get('turn') || '0.5');
    // frame it: the eye on the counter's front, looking down at it
    const s = Math.max(ud.size.x, ud.size.y, ud.size.z, 0.03);
    const dist = s / (2 * Math.tan((20 * Math.PI) / 180)) * 1.2 + 0.03;
    const cy = top + ud.size.y * 0.45;
    const pitch = -0.42;
    const pose = { x: C.frontX - 0.3 + Math.cos(pitch) * dist, y: cy - Math.sin(pitch) * dist, z: z0, yaw: Math.PI / 2, pitch, fov: 40 };
    holdEye(controller, pose);
    camera.fov = 40; camera.updateProjectionMatrix();
    return;
  }
  // two rows along the counter under the pendant: the tall things behind,
  // the small and flat things in front; each spaced by its own width
  const far = ['bottle:scotch', 'bottle:rye', 'bottle:gin', 'bottle:beer', 'bottle:ketchup', 'bottle:milk', 'coffeePot', 'tumbler', 'mug', 'cup', 'sugar', 'napkinBox', 'pie'];
  const near = ['plate', 'saucer', 'ashtray', 'cigarette', 'cigarettePack', 'lighter', 'matchbook', 'wallet', 'fork', 'knife', 'menu', 'newspaper'];
  const row = (list, x, gap) => {
    const objs = list.map((k) => {
      const [kind, variant] = k.split(':');
      const o = d.place(kind, V(x, top, z0), { name: 'sheet.' + k, variant });
      const ud = o.userData;
      let w = Math.max(ud.size.x, ud.size.z) * 0.8;
      o.rotation.y = 0.5;
      if (kind === 'fork' || kind === 'knife') { o.rotation.y = 0.15; w = 0.04; }
      if (kind === 'lighter') { ud.setOpen(1); o.rotation.y = Math.PI / 2 + 0.3; w = 0.06; }
      if (kind === 'matchbook') { ud.setOpen(0.55); o.rotation.y = Math.PI / 2 + 0.25; w = 0.05; }
      if (kind === 'wallet') { ud.setOpen(1); o.rotation.y = Math.PI / 2; w = 0.2; }
      if (kind === 'cigarette') { ud.setTip('ash'); o.rotation.set(0, 0, 0); o.userData.lay = true; w = 0.05; }
      if (kind === 'menu' || kind === 'newspaper') { o.scale.setScalar(0.55); o.rotation.y = Math.PI / 2 + 0.15; w *= 0.5; }
      if (kind === 'pie' || kind === 'plate') w = 0.2;
      if (kind === 'cup') { const sc = d.place('saucer', V(x, top, z0), { name: 'sheet.cupSaucer' }); o.userData.saucer = sc; o.position.y += 0.006; }
      return { o, w };
    });
    const total = objs.reduce((a, q) => a + q.w + gap, -gap);
    let z = z0 + total / 2;
    for (const q of objs) {
      z -= q.w / 2;
      q.o.position.z = z;
      if (q.o.userData.saucer) q.o.userData.saucer.position.z = z;
      if (q.o.userData.lay) { const p = q.o.position.clone(); q.o.position.set(0, 0, 0); q.o.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2 + 0.4).multiply(q.o.userData.rest)); q.o.position.add(p); }
      z -= q.w / 2 + gap;
    }
  };
  row(far, C.frontX - 0.45, 0.035);
  row(near, C.frontX - 0.17, 0.04);
  holdEye(controller, { x: C.frontX + 0.5, y: top + 0.5, z: z0, yaw: Math.PI / 2, pitch: -0.5, fov: 68 });
  camera.fov = 68; camera.updateProjectionMatrix();
  void PROP_KINDS; void BOTTLE_VARIANTS; void stoolZ;
}

// a room view: the scene's cast where scene 1 has them (settle), the eye
// held at a pose; &train=1 runs the el train's pass to its middle
function roomView(pose) {
  return {
    scene: 'diner', beat: 'settle', t: 1.5, viewmodel: false,
    stage(stage, camera, controller, game) {
      const q = Q();
      // (&eye=x,y,z,yaw,pitch[,fov]: any other eye in the same room, for
      // close looks)
      if (q.has('eye')) { const [x, y, z, yaw, pitch, fov] = q.get('eye').split(',').map(Number); pose = { x, y, z, yaw, pitch, fov: fov || pose.fov }; }
      holdEye(controller, pose);
      camera.fov = q.has('fov') ? parseFloat(q.get('fov')) : pose.fov; camera.updateProjectionMatrix();
      if (game.setViewmodelVisible) game.setViewmodelVisible(false);
      if (q.get('train') === '1') stage.part('diner').trainPass(7, { at: 3.5 - 1.5 });
    },
  };
}
const S4 = stoolZ(DINER.playerStool), SX = DINER.stools.x;
// diner_alive: the room's API at work (lane 5's brief P0.2, P1), staged on
// the step's clock from t = 0: stool 5 spun at 0.2, the jukebox changes at
// 0.5 (2 s) and is hit three times from 3.0 (dark for a second), the
// pendant over stool 3 swings from 0.3, the register's drawer opens at 1.0,
// the bell at 1.2, a power dip at 2.0, cups rattle from 2.5; stool 7
// toppled at 1.5. Default t = 2.2 (mid change, drawer out, the lamp
// swinging); &t= scrubs. The eye looks down the counter from the jukebox end.
function stageAlive(stage, camera, controller, game) {
  const d = stage.part('diner');
  const ev = [
    [0.2, () => d.stool(5).spin(2)], [0.3, () => d.lamps[3].swing(V(0.6, 0, 0.3))], [0.5, () => d.jukebox.next()],
    [1.0, () => d.register.open()], [1.2, () => d.bell.ring()], [1.5, () => d.stool(7).topple(V(1, 0, -0.3))],
    [2.0, () => d.lampsDip(0.5, 0.6)], [2.5, () => d.cupsRattle(1, 3)],
    [3.0, () => d.jukebox.hit(1)], [3.3, () => d.jukebox.hit(1)], [3.6, () => d.jukebox.hit(1)],
  ];
  let k = 0;
  const t0 = game.time;
  game.scripts.push((t) => { while (k < ev.length && t - t0 >= ev[k][0]) ev[k++][1](); });
}
export const presets = {
  propsheet: { x: C.frontX + 0.6, z: 3.2, y: 0, yaw: -Math.PI / 2, pitch: -0.4, fov: 68, t: 1, stage: stagePropSheet },
  diner_seat: roomView({ x: SX - 0.03, y: 1.6, z: S4, yaw: Math.PI / 2, pitch: -0.1, fov: 68 }),
  diner_left: roomView({ x: SX, y: 1.6, z: S4, yaw: -0.72, pitch: -0.06, fov: 68 }),
  diner_right: roomView({ x: SX + 0.05, y: 1.6, z: S4, yaw: -0.07, pitch: -0.08, fov: 68 }),
  diner_wide: roomView({ x: -12.75, y: 1.8, z: -5.05, yaw: Math.PI - 0.22, pitch: -0.1, fov: 70 }),
  diner_booth: roomView({ x: -11.25, y: 1.45, z: 10.05, yaw: 1.05, pitch: -0.08, fov: 68 }),
  diner_alive: (() => { const v = roomView({ x: -12.95, y: 1.75, z: -2.4, yaw: Math.PI - 0.28, pitch: -0.14, fov: 62 }); const st = v.stage; return { ...v, t: 2.2, stage(...a) { st(...a); stageAlive(...a); } }; })(),
  diner_out: roomView({ x: SX, y: 1.6, z: S4, yaw: -Math.PI / 2, pitch: 0.0, fov: 68 }),
};
