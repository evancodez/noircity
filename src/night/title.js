import * as THREE from 'three';
import { STARTS, START_DEFAULT } from '../world/plan.js';
import { compileAll } from '../stages/noircity/compile.js';

// NOIR CITY's title (lane O7, docs/seams/NIGHT.md §4): the live city behind
// the lettering - Grand Ave under the el from the start's kerb, in the rain,
// the coupe at the kerb low on the right, the street and the el running
// away up the frame (the reference's composition), the camera breathing a
// little sideways and back over a minute. NOIR CITY and its red splatter
// top left over the dark storeys; BEGIN (and CONTINUE, only for a city
// save: an old story's save is dropped quietly, Save.js) low over the wet
// street. BEGIN drops into the city at that kerb, which is why it is the
// picture: the title is the first frame of the night.
export const TITLE_CAM = { back: 3.4, side: -0.9, eye: 1.62, pitch: 0.075, sway: 0.55, swing: 0.05, period: 64 };

export class Title {
  constructor(night) {
    this.night = night;
    this.ready = false;
  }

  // enter the city's stage for the title and stand the camera at the kerb
  stage() {
    const G = this.night.game;
    const stage = G.enterStage('noircity');
    const a = stage.anchor(`city.start.${START_DEFAULT}`);
    const S = STARTS[START_DEFAULT];
    // (look development: ?titlecam=back,side,pitch)
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('titlecam') : null;
    if (q) { const [b, s, p] = q.split(',').map(Number); if (Number.isFinite(b)) TITLE_CAM.back = b; if (Number.isFinite(s)) TITLE_CAM.side = s; if (Number.isFinite(p)) TITLE_CAM.pitch = p; }
    stage.part('stream').warmAround(S.car.x, S.car.z);
    // the coupe at the kerb (BEGIN's place() takes it away and puts its own there)
    G.vehicles.clear();
    const car = G.vehicles.spawn('coupe', { at: new THREE.Vector3(S.car.x, 0, S.car.z), yaw: S.car.yaw, lights: true });
    if (car.lamps && car.lamps.setOn) car.lamps.setOn(false);
    car.driver = null;
    this.car = car;
    // the eye a little further back than the start, so the lettering has the storeys and the choices the street
    const fx = Math.cos(S.car.yaw), fz = -Math.sin(S.car.yaw), rx = Math.sin(S.car.yaw), rz = Math.cos(S.car.yaw);
    this.base = { x: a.pos.x - fx * (TITLE_CAM.back - 2.2) + rx * TITLE_CAM.side, z: a.pos.z - fz * (TITLE_CAM.back - 2.2) + rz * TITLE_CAM.side, yaw: a.yaw, fx, fz, rx, rz };
    G.titleCam = (t) => this.drift(t);
    G.setViewmodelVisible(false);
    if (!G.shotMode) this.compileMs = compileAll(stage, G);
    this.ready = true;
    this.drift(0);
    return stage;
  }

  // a pure function of time (shot=title renders it at t=)
  drift(t) {
    const B = this.base, G = this.night.game, T = TITLE_CAM;
    if (!B) return;
    const u = Math.sin((t / T.period) * Math.PI * 2);
    const v = 0.5 - 0.5 * Math.cos((t / T.period) * Math.PI * 2);
    const x = B.x + B.rx * T.sway * u - B.fx * 0.6 * v, z = B.z + B.rz * T.sway * u - B.fz * 0.6 * v;
    G.controller.setPose(x, z, B.yaw + T.swing * u * 0.4, T.pitch, G.stage.surfaceY(x, z) + T.eye - 1.65);
  }
}
