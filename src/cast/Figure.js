import * as THREE from 'three';
import { Hood } from '../enemies/Hood.js';
import { figureGeometry, figureRig } from './tailor.js';
import { COSTUMES } from './costumes.js';
import { castBank, CastAnimator } from './castAnim.js';

// A figure of the cast (lane 6): a Hood in a costume. Everything a Hood is
// (enemies/Hood.js: the skeleton's joints, one skinned mesh per LOD, the ink
// slot and its brush anchor, the shadow, the coat-hem spring, the look-at,
// the hit volumes) with the costume's body, cover and clothes, the
// costume's own clips (src/cast/castAnim.js) and a few things of its own:
//   root motion     a clip that travels (rise, the throws, the last blow)
//                   carries the figure's position with it
//   throwCover(v)   the cap knocked off (the brawler, round three)
//   extras          what a figure carries as part of who he is (the old
//                   man's broadsheet, her cigarette holder, his umbrella)
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

export class Figure extends Hood {
  constructor(stage, { kind, pos = new THREE.Vector3(), yaw = 0 } = {}) {
    const costume = COSTUMES[kind];
    if (!costume) throw new Error(`Figure: no costume '${kind}'`);
    const lods = [figureGeometry(costume, 0), figureGeometry(costume, 1), figureGeometry(costume, 2)];
    const rig = figureRig(costume);
    const bank = castBank(kind);
    super(stage, {
      pos, yaw, variant: { coat: 0, brim: 0, tall: 1, cig: false, heavy: false, unarmed: true },
      build: {
        lods, offsets: rig.OFFSET, scale: costume.h / lods[0].userData.top,
        animator: (obj) => new CastAnimator(obj, bank),
        surface: (x, z) => stage.surfaceY(x, z),
        hatR: 0.13, hatFlies: false,
      },
    });
    this.kind = kind;
    this.costume = costume;
    this.rig = rig;
    this.bank = bank;
    if (this.collider) this.collider.r = (costume.collider ?? 0.32) * this.scale;
    this._rmClip = null;
    this.onMove = () => this.rootMotion();
  }

  // ---- root motion: a travelling clip moves the figure ------------------------------
  // (called by Hood.update after locomotion, before the mixer steps: the
  // clip's time after this step is baseTime + dt)
  startRoot(name, { scale = 1, yaw = null } = {}) {
    const c = this.anim.clips[name];
    if (!c || !c.rootMotion) { this._rmClip = null; return; }
    if (yaw != null) this.yaw = yaw;
    this._rmClip = { name, x0: this.pos.x, z0: this.pos.z, yaw0: this.yaw, scale };
  }

  rootMotion() {
    const R = this._rmClip;
    if (!R) return;
    if (this.anim.base !== R.name) { this._rmClip = null; return; }
    const c = this.anim.clips[R.name];
    const t = Math.min(c.duration, this.anim.baseTime + (this._dt || 0));
    const [lx, lz] = c.rootMotion(t);
    const s = this.scale * R.scale, cy = Math.cos(R.yaw0), sy = Math.sin(R.yaw0);
    this.pos.x = R.x0 + (lx * cy + lz * sy) * s;
    this.pos.z = R.z0 + (-lx * sy + lz * cy) * s;
  }

  update(dt, t, camera = null) {
    this._dt = dt;
    super.update(dt, t, camera);
    if (this.extras && this.character) for (const e of this.extras) if (e.update) e.update(this.character, dt);
  }

  // ---- the cover knocked off -------------------------------------------------------------
  // v: world velocity (m/s) the blow gives it
  throwCover(v) {
    if (this.hat) return;
    const b = this.bones, obj = this.object, hat = b.hat;
    const m = _m.copy(obj.matrixWorld).invert().multiply(hat.matrixWorld);
    obj.add(hat);
    m.decompose(hat.position, hat.quaternion, _v);
    hat.scale.set(1, 1, 1);
    const inv = obj.quaternion.clone().invert();
    const vel = v.clone().applyQuaternion(inv).divideScalar(this.scale);
    const g = 9.8, y0 = Math.max(0, hat.position.y - 0.03);
    const tFly = Math.max(0.15, (vel.y + Math.sqrt(vel.y * vel.y + 2 * g * y0)) / g);
    const axis = new THREE.Vector3(vel.z, 0, -vel.x);
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize();
    const up0 = new THREE.Vector3(0, 1, 0).applyQuaternion(hat.quaternion);
    this.hat = {
      bone: hat, vel, rest: false, landed: false, tau: 0, tFly, axis,
      q0: hat.quaternion.clone(),
      qRight: new THREE.Quaternion().setFromUnitVectors(up0, new THREE.Vector3(0, 1, 0)),
      turns: Math.max(1, Math.round(6 * tFly / (Math.PI * 2))),
      tRight: 0.12,
      spin: new THREE.Vector3(),
    };
  }

  dispose() {
    if (this.extras) for (const e of this.extras) if (e.dispose) e.dispose(this.character);
    super.dispose();
  }
}
