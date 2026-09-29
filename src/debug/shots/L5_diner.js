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
    const dist = s / (2 * Math.tan((32 * Math.PI) / 180)) * 1.45 + 0.05;
    const cy = top + ud.size.y * 0.45;
    const pitch = -0.42;
    const pose = { x: C.frontX - 0.3 + Math.cos(pitch) * dist, y: cy - Math.sin(pitch) * dist, z: z0, yaw: Math.PI / 2, pitch, fov: 40 };
    holdEye(controller, pose);
    camera.fov = 40; camera.updateProjectionMatrix();
    return;
  }
  const far = ['bottle:scotch', 'bottle:rye', 'bottle:gin', 'bottle:beer', 'bottle:ketchup', 'bottle:milk', 'coffeePot', 'napkinBox', 'sugar', 'mug', 'saucer', 'tumbler'];
  const near = ['plate', 'pie', 'ashtray', 'cigarette', 'cigarettePack', 'lighter', 'matchbook', 'wallet', 'fork', 'knife', 'menu', 'newspaper', 'cup'];
  const row = (list, x, span) => list.forEach((k, i) => {
    const [kind, variant] = k.split(':');
    const z = z0 + span / 2 - (i + 0.5) * (span / list.length);
    const o = d.place(kind, V(x, top, z), { name: 'sheet.' + k, variant });
    o.rotation.y = kind === 'fork' || kind === 'knife' ? 0 : 0.4 + i * 0.3;
    const ud = o.userData;
    if (kind === 'lighter') { ud.setOpen(1); o.rotation.y = 1.2; }
    if (kind === 'matchbook') { ud.setOpen(0.5); o.rotation.y = Math.PI / 2 + 0.3; }
    if (kind === 'wallet') { ud.setOpen(1); o.rotation.y = Math.PI / 2; o.position.x += 0.03; }
    if (kind === 'cigarette') { o.rotation.set(0, 0, 0); o.applyMatrix4(new THREE.Matrix4().makeRotationY(0.8).multiply(ud.rest)); o.position.add(V(x, top, z)); ud.setTip('ash'); }
    if (kind === 'menu' || kind === 'newspaper') { o.scale.setScalar(0.5); o.rotation.y = Math.PI / 2 + 0.2; }
    if (kind === 'cup') o.position.y += 0.0;
    if (kind === 'pie') o.scale.setScalar(0.6);
    if (kind === 'plate') o.scale.setScalar(0.5);
  });
  row(far, C.frontX - 0.47, 1.2);
  row(near, C.frontX - 0.2, 1.05);
  holdEye(controller, { x: C.frontX + 0.28, y: top + 0.42, z: z0, yaw: Math.PI / 2, pitch: -0.52, fov: 68 });
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
export const presets = {
  propsheet: { x: C.frontX + 0.6, z: 3.2, y: 0, yaw: -Math.PI / 2, pitch: -0.4, fov: 68, t: 1, stage: stagePropSheet },
  diner_seat: roomView({ x: SX - 0.03, y: 1.6, z: S4, yaw: Math.PI / 2, pitch: -0.1, fov: 68 }),
  diner_left: roomView({ x: SX, y: 1.6, z: S4, yaw: -0.72, pitch: -0.06, fov: 68 }),
  diner_right: roomView({ x: SX + 0.05, y: 1.6, z: S4, yaw: -0.07, pitch: -0.08, fov: 68 }),
  diner_wide: roomView({ x: -12.75, y: 1.8, z: -5.05, yaw: Math.PI - 0.22, pitch: -0.1, fov: 70 }),
  diner_booth: roomView({ x: -11.25, y: 1.45, z: 10.05, yaw: 1.05, pitch: -0.08, fov: 68 }),
  diner_out: roomView({ x: SX, y: 1.6, z: S4, yaw: -Math.PI / 2, pitch: 0.0, fov: 68 }),
};
