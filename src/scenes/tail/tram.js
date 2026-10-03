import * as THREE from 'three';
import { Car } from '../../vehicles/Car.js';
import { Headlamps } from '../../vehicles/Vehicle.js';
import { figureInk } from '../../vehicles/models.js';
import { merge, roundedBox } from '../../world/geom.js';
import { EW, NS } from '../../stages/city/plan.js';

// The tram along Market St (lane C3): he runs the junction at Water St just
// ahead of it, its bell ringing, its lamp and its lit windows coming across;
// close behind him I make it too, further back I wait for it to pass (he
// gains, I do not lose him: Water St runs straight on north). It runs on
// its rails at its own pace (a moving wall: Car.js treats a kinematic car
// as fixed), and goes once it is out of my sight.
//   tram.step(dt) (the chase's traffic steps it); tram.v (the body) or null
const LEN = 12.4, WID = 2.5, SPEED = 8.5;
const _v = new THREE.Vector3();

let MODEL = null;
function model(M) {
  if (!MODEL) {
    const body = merge([
      roundedBox(LEN, 2.6, WID, 0.3, 3).translate(0, 1.9, 0),
      roundedBox(LEN - 0.6, 0.35, WID - 0.3, 0.15, 2).translate(0, 3.35, 0),
      new THREE.BoxGeometry(LEN - 1, 0.5, WID - 0.2).translate(0, 0.45, 0),
      // the trolley pole up to the wire
      new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6).rotateZ(1.05).translate(-1.2, 4.9, 0),
    ]);
    const win = [];
    for (let x = -LEN / 2 + 1.2; x < LEN / 2 - 1; x += 1.1) for (const z of [-WID / 2 - 0.01, WID / 2 + 0.01]) win.push(new THREE.PlaneGeometry(0.75, 0.9).rotateY(z > 0 ? 0 : Math.PI).translate(x, 2.35, z));
    for (const x of [-LEN / 2 - 0.01, LEN / 2 + 0.01]) win.push(new THREE.PlaneGeometry(1.6, 0.9).rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x, 2.4, 0));
    MODEL = { body, win: merge(win) };
  }
  const g = new THREE.Group();
  g.name = 'tram';
  const b = new THREE.Mesh(MODEL.body, M.paintGrey || M.paint);
  const w = new THREE.Mesh(MODEL.win, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(1.6) }));
  w.userData.noRay = true; w.userData.emitter = true;
  g.add(b, w);
  return { group: g, meshes: { body: b, win: w } };
}

export class Tram {
  constructor(chase) {
    this.chase = chase;
    this.game = chase.game;
    this.v = null;
    this.done = false;
    this.bellT = 0;
  }

  dispose() { if (this.v) this.chase.V.remove(this.v); this.v = null; }

  // across Market St's junction with Water St, from the east (dir -1) or the
  // west (dir +1), so as to reach it `lead` s after he does
  start(dir, his) {
    const C = this.chase, stage = C.stage;
    const t = Math.max(1.5, (his.pos.z - EW.market.z) / Math.max(4, his.speed)) + 1.3;
    const x0 = NS.water.x - dir * SPEED * t - dir * LEN / 2;
    const m = model(stage.M);
    stage.scene.add(m.group);
    const v = new Car(C.V, 'truck', m, { pos: new THREE.Vector3(x0, 0, EW.market.z), yaw: dir > 0 ? 0 : Math.PI, spec: { halfL: LEN / 2, halfW: WID / 2, mass: 30 } });
    v.inkSlot = figureInk(m.group);
    v.lamps = new Headlamps(stage, v, [new THREE.Vector3(LEN / 2, 1.2, -0.25), new THREE.Vector3(LEN / 2, 1.2, 0.25)], { reach: 26, intensity: 140, cone: 0.16 });
    v.kind = 'tram';
    const self = this;
    v.driver = { kinematic: true, drive(car, dt) { car.pos.x += dir * SPEED * dt; car.vel.set(dir * SPEED, 0, 0); car.yawRate = 0; self.x = car.pos.x; } };
    C.V.list.push(v);
    this.v = v; this.dir = dir; this.t = 0;
    this.game.sfx.play('c3_bell', v.pos, { k: 1 }, { ref: 8 });
  }

  step(dt) {
    const C = this.chase, his = C.his;
    if (this.v) {
      this.t += dt;
      const v = this.v;
      // the bell as it comes to the junction
      this.bellT -= dt;
      if (this.bellT <= 0 && Math.abs(v.pos.x - NS.water.x) < 45) { this.bellT = 1.6; this.game.sfx.play('c3_bell', v.pos, { k: 0.9 }, { ref: 8 }); }
      // gone: out of Market St, or far and out of my sight
      const e = this.game.camera.position;
      const d = Math.hypot(v.pos.x - e.x, v.pos.z - e.z);
      const hidden = C.stage.track.blocked(e.x, e.z, v.pos.x, v.pos.z, ['wall']);
      if (v.pos.x < -240 || v.pos.x > 100 || (this.t > 8 && hidden && d > 60)) this.dispose();
      const S = this.game.sfx;
      if (S && S.live && this.v) S.loop('c3_tram', v.pos, 0.3, 'brown', 120, 0, true);
      else if (S && S.loops && S.loops.has('c3_tram')) S.stopLoop('c3_tram');
      return;
    }
    if (this.done || !his || C.phase !== 'a') return;
    // he comes up Water St toward Market St: the tram is set going
    const D = C.driver;
    if (D.legIndex >= 3 && Math.abs(his.pos.x - NS.water.x) < 5 && his.pos.z > EW.market.z + 12 && his.pos.z < EW.market.z + 48 && his.vel.z < -3) {
      this.done = true;
      this.start(C.ctx.rng.next() < 0.5 ? 1 : -1, his);
    }
    void _v;
  }
}
