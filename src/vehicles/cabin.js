import * as THREE from 'three';
import { COUPE, WHEEL_TURN } from './models.js';
import { DRIVE } from '../player/clips/drive.js';
import { Screen } from '../scenes/tail/screen.js';

// My coupe's cabin, for any scene that puts me at its wheel (lane C3; lane
// B5's tail had it inline): the eye in the seat (the drive mode), both hands
// on the wheel (the drive set), the dials (speed, revs), the wheel turning
// with the car's steer (and its pull once damaged), the wipers and the
// windscreen's rain (screen.js), the cabin as a sound room (its bed: the
// engine by revs, the tyres on the wet, the rain on the roof) and a dry box
// the rain never enters. The lamps' switch on the dash (lampsOn).
//   const cab = new Cabin(game); cab.attach(car, opts); each step cab.step(dt);
//   cab.dispose() (leaving the scene)
const _v = new THREE.Vector3();
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Cabin {
  constructor(game) {
    this.game = game;
    this.stage = game.stage;
    this.t = 0;
    this.box = new THREE.Box3();
    this.look = this.stage.addLook(this.box, { room: 'car', rainOverlay: 0 });
    if (!this.stage.dry.includes(this.box)) this.stage.dry.push(this.box);
    this.screen = new Screen(this.stage, game);
    this.car = null;
  }

  // the eye in the seat, the hands on the wheel (opts: the drive mode's)
  attach(car, opts = {}) {
    const G = this.game;
    this.car = car;
    DRIVE.car = car; DRIVE.camera = G.camera; DRIVE.aim = 0; DRIVE.grip = null;
    G.player.hands.equip('drive');
    G.controller.setMode('drive', { vehicle: car, game: G, eye: COUPE.eye, pitch: -0.12, fov: 58, ease: 0.001, lookInto: true, ...opts });
    G.setViewmodelVisible(true);
    this.screen.attach(car);
    this.screen.clearCracks();
    this.place();
  }

  // the lamps' switch on the dash: a small knob by the dials, pulled out
  // (lamps on) or pushed in; made the first time it is wanted
  lampSwitch(on) {
    const v = this.car;
    if (!v || !v.model.group) return;
    if (!this.knob || this.knob.parent !== v.model.group) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8).rotateZ(Math.PI / 2), v.model.meshes && v.model.meshes.chrome ? v.model.meshes.chrome.material : this.stage.M.chrome);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 14).rotateZ(Math.PI / 2).translate(-0.022, 0, 0), this.stage.M.rubber);
      g.add(shaft, head);
      g.position.copy(COUPE.dial).add(new THREE.Vector3(-0.02, -0.11, 0.2));
      g.traverse((o) => { if (o.isMesh) { o.userData.inkId = v.model.group.children[0] ? v.model.group.children[0].userData.inkId : 0; o.userData.inkFigure = true; o.userData.noRay = true; } });
      v.model.group.add(g);
      this.knob = g;
    }
    this.knob.children[0].position.x = on ? -0.02 : 0;
    this.knob.children[1].position.x = on ? -0.02 : 0;
  }

  place() {
    if (!this.car) return;
    const e = this.car.seat(COUPE.eye, _v);
    this.box.min.set(e.x - 0.9, e.y - 1.0, e.z - 0.9);
    this.box.max.set(e.x + 0.9, e.y + 0.45, e.z + 0.9);
  }

  step(dt) {
    const v = this.car;
    if (!v) return;
    this.t += dt;
    this.place();
    const m = v.model;
    if (m.needles) {
      const kmh = Math.abs(v.speed) * 3.6;
      this.needle = (this.needle ?? 0) + ((kmh / 120) * 4.7 - (this.needle ?? 0)) * (1 - Math.exp(-dt * 10));
      m.needles[0].rotation.x = -2.35 + this.needle + Math.sin(this.t * 31) * 0.01 * v.shake;
      // the revs: three gears, near the top as it pulls
      const sp = Math.abs(v.speed), g = sp < 7 ? [0, 7] : sp < 14 ? [7, 14] : [14, 24];
      const rev = 0.25 + 0.65 * clamp((sp - g[0]) / (g[1] - g[0]), 0, 1) * (v.input.throttle ? 1 : 0.7) + (v.input.throttle && sp < 1 ? 0.2 : 0);
      this.rev = (this.rev ?? 0.3) + (rev - (this.rev ?? 0.3)) * (1 - Math.exp(-dt * 6));
      m.needles[1].rotation.x = -1.2 + this.rev * 2.4;
    }
    // the wheel follows the car's steer (and the pull of a bent track rod)
    const turnK = WHEEL_TURN * (1 - 0.35 * clamp(Math.abs(v.speed) / 22, 0, 1));
    if (m.wheel) m.wheel.rotation.x = -(v.steer + (v.pull || 0) * 2.2) * turnK + Math.sin(this.t * 29) * 0.012 * v.shake;
    // the wipers: a sweep a second and a bit; the blades' thump in the bed
    const P = 1.15;
    this.wipeT = (this.wipeT || 0) + dt;
    const u = (this.wipeT % P) / P;
    const end = u < 0.5 ? 0 : 1;
    const S = this.game.sfx;
    if (this._wEnd !== undefined && end !== this._wEnd) { const B = S && S.bed; if (B && B.wipe) B.wipe(end ? 1 : 0.6); }
    this._wEnd = end;
    const sweep = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
    if (m.wipers) for (const w of m.wipers) w.arm.rotation.x = 1.52 - sweep * 1.65;
    this.screen.wipe(sweep, m.wipers, this.wipeT);
    this.screen.update(dt, v);
    // the bed: the engine, the tyres, the rain on the roof
    if (S && S.live && S.bed && S.bedName === 'car' && S.bed.set) S.bed.set({ speed: v.speed, throttle: v.input.throttle * (v.power ?? 1), slide: v.slide || 0, shake: v.shake });
  }

  dispose() {
    if (DRIVE.car === this.car) DRIVE.car = null;
    this.box.min.set(1e5, 1e5, 1e5); this.box.max.set(1e5, 1e5, 1e5);
    if (this.screen.mesh.parent) this.screen.mesh.parent.remove(this.screen.mesh);
    this.car = null;
  }
}
