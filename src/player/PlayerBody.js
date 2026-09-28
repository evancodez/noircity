import * as THREE from 'three';
import { Hood } from '../enemies/Hood.js';
import { twoBone, L_UPPER, L_FORE, BIND, eulerQ } from '../enemies/HoodRig.js';
import { WALK, RUN } from '../enemies/HoodAnim.js';
import { buildTommyParts, MUZZLE, EJECT } from './Viewmodel.js';
import { allocHoodSlot, PLAYER_SLOT, HOOD_ID0, FIG_ANCHOR, HERO } from '../render/layers.js';

// The player's own body for the over-the-shoulder camera (Phase 3b, `V`).
//
// A Hood (enemies/Hood.js) in the player's variant - the longest coat (to
// mid-shin), the wide-brimmed fedora, no pistol - built at full tessellation
// (it is seen from half a metre) as a "ghost": no collider, no hit volumes,
// nothing the bullets or the Hoods' line of sight can touch. It carries the
// Tommy gun in both hands.
//
// Driven every fixed step from the player's state, never from input:
//   legs   the Hoods' own baked gait clips (idle / walk / run), time-scaled by
//          the controller's speed, the root turned toward the direction of
//          travel (strafing) and the clip run backwards when backpedalling
//   torso  turned to the aim (bladed ~20 deg, right shoulder back), pitched
//          with it; breath; a recoil kick; a flinch spring (hit reactions)
//   gun    its butt in the right shoulder pocket at chin height (the cheek
//          on the stock), its bore on the AIM POINT - the world point under
//          the crosshair (aim(), from the eye), so the barrel converges on
//          what the player shoots at; sprinting lowers it to the port, the
//          reload tilts it and swaps the drum
//   arms   two-bone IK (HoodRig.twoBone): the right fist on the pistol grip
//          with the elbow tucked down under the gun (a raised elbow hid the
//          drum from the camera), the left hand on the foregrip (on the drum
//          in the reload)
//   head   squared to the aim, dropped a little onto the stock
//   coat   the Hood's hem spring (acceleration, turns); the hat a small
//          spring of its own that lags the head (bob, lean, turns)
// In first person the body is hidden (object.visible = false: no draw, no
// shadow, no reflection) and not even updated; only the viewmodel shows.
//
// Camera (placeCamera): a boom from the first-person eye, OTS.back behind
// and OTS.right to the right of it and OTS.up above it, pulled in if a wall
// is behind the player. The boom is swung OTS.yaw degrees to the LEFT of the
// aim about the world's up (camera and boom together, rigidly, so the body
// keeps its place in the frame): the camera looks up the street while the
// aim - the crosshair, drawn where the aim point projects (Hud) - sits right
// of centre, and the gun, pointing at it, crosses into the frame with its
// whole length showing, like the reference's shooter who fires right of
// where the picture looks. The boom takes only OTS.pitchK of the look's
// pitch (the camera itself takes all of it): looking down no longer lifts
// the camera over the hat, so the brim stays edge-on instead of spreading
// into a black disc. Bullets, the Hoods' sense of being shot at and the
// aim itself stay on the EYE (eyeObj), never on the boom camera.
export const OTS = { right: 0.45, up: 0.03, back: 0.6, yaw: 15, pitchK: 0.4 };

const Y = new THREE.Vector3(0, 1, 0);
const D2R = Math.PI / 180;
// the player variant's wide brim (Hood.js BRIM_R[1])
const BRIM_R_PLAYER = 0.19;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// gun-local points (Viewmodel.js frame: +x right, +y up, muzzle toward -z)
const BUTT = new THREE.Vector3(0, -0.095, 0.455);       // the butt plate, in the shoulder
const GRIP = new THREE.Vector3(0, -0.07, 0.088);        // the right fist
const FORE = new THREE.Vector3(0, -0.05, -0.3);         // the left hand
// the shoulder pocket in the chest bone's frame (bind: chest at y 1.28):
// the stock in the right shoulder's inside, the gun at chin height under
// the right eye (the cheek weld: 6 cm in toward the centre line and 6 cm
// higher than Phase 3b's first cut), so from the camera out to the right at
// about brim height the receiver and the drum show past the shoulder, side
// on, with the hat above them like the reference's shooter
const POCKET = new THREE.Vector3(-0.10, 1.47, 0.14).sub(BIND.chest);
// look development (URL): otscam=right,up,back[,yawDeg,pitchK]  otspocket=x,y,z (bind space)
// otsblade=<deg> (the torso's turn to the right)
const LD = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
if (LD.get('otscam')) { const [r, u, b, y = OTS.yaw, k = OTS.pitchK] = LD.get('otscam').split(',').map(Number); Object.assign(OTS, { right: r, up: u, back: b, yaw: y, pitchK: k }); }
if (LD.get('otspocket')) POCKET.set(...LD.get('otspocket').split(',').map(Number)).sub(BIND.chest);
const BLADE = parseFloat(LD.get('otsblade') ?? '20');
// the right elbow's pole: down, and this much out to his right (1.1: a
// raised 'chicken wing'; lower: the elbow tucked under the gun)
const ELBOW_OUT = parseFloat(LD.get('otselbow') ?? '-0.5');
// the head's drop onto the stock (deg, forward): the brim tips toward the aim
// so the camera behind sees its top and the crown above it
const HEAD_DROP = parseFloat(LD.get('otshead') ?? '12');
// The staged hero frame (shot=ots) swings the barrel this much further right
// than the man it is held on, the illustrator's cheat the reference makes:
// the Tommy gun's drum is a flat can on its flank, and from behind the
// shoulder a barrel pointing where the eye looks shows it edge-on; 8 deg
// more side-on opens it into a round drum under the receiver. In play the
// barrel converges on the crosshair exactly (no cheat).
const GUN_CHEAT = parseFloat(LD.get('otscheat') ?? '8');

// The key light (Phase 3b): lit only by the street, the player's back - the
// side the camera sees - printed as one black mass. Like the viewmodel's own
// key, the body gets a light of its own, from up and to the left of the
// camera (where the reference's lamp stands), folded into its material, so
// the coat's back and shoulders, the hat's crown and the gun's top raise
// dry-brush greys under the ink's figure ceiling. (A material term, not a
// scene light: a light would be paid by every lit pixel of the frame.)
const KEY = { dir: new THREE.Vector3(-0.75, 0.6, 0.3).normalize(), col: 2.6 };
function keyed(mat, U) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uKeyDir = U.dir;
    sh.uniforms.uKeyCol = U.col;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKeyDir;\nuniform float uKeyCol;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          // (uKeyDir: world space; normal: view space)
          vec3 kd = normalize( ( viewMatrix * vec4( uKeyDir, 0.0 ) ).xyz );
          float k = max( dot( normal, kd ), 0.0 );
          reflectedLight.directDiffuse += diffuseColor.rgb * uKeyCol * k * k;
        }`);
  };
  m.customProgramCacheKey = () => 'playerKey';
  return m;
}

export class PlayerBody {
  constructor(game) {
    const world = game.world;
    this.game = game;
    this.world = world;
    const h = new Hood(world, { variant: { coat: 3, brim: 1, tall: 1, player: true }, ghost: true });
    this.hood = h;
    // (exactly the controller's eye height: 1.0 puts his eye at ~1.66 m)
    h.scale = 1;
    h.object.scale.setScalar(1);
    h.object.name = 'playerBody';
    h.mesh.castShadow = true;
    // the body and the gun take the key light (world direction set per step)
    this.keyU = { dir: { value: new THREE.Vector3() }, col: { value: KEY.col } };
    h.mesh.material = keyed(h.mesh.material, this.keyU);
    h.setState('idle', 0);
    // the Tommy gun, in two parts (the drum comes out in the reload): an ink
    // figure of its own (a Hood slot reserved for it, layers.PLAYER_SLOT),
    // so the ink draws the paper trap line between it and the coat behind -
    // black steel against a black coat still reads; its brush field rides
    // on the gun (FIG_ANCHOR, set every step)
    const P = buildTommyParts();
    this.gunMat = keyed(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.35, envMap: world.M.envSoft, envMapIntensity: 0.45 }), this.keyU);
    this.gun = new THREE.Group();
    this.gun.name = 'playerGun';
    const body = new THREE.Mesh(P.body, this.gunMat);
    this.drumG = new THREE.Group();
    this.drumC = P.drumC;
    this.drumG.position.copy(P.drumC);
    const drum = new THREE.Mesh(P.drum, this.gunMat);
    this.drumG.add(drum);
    this.gun.add(body, this.drumG);
    this.gunSlot = allocHoodSlot(PLAYER_SLOT.gun);
    for (const m of [body, drum]) { m.userData.inkId = HOOD_ID0 + this.gunSlot; m.userData.inkFigure = true; m.castShadow = true; m.userData.noRay = true; }
    world.scene.add(this.gun);
    h.afterPose = (hh, dt) => this.pose(dt);

    this.aimPoint = new THREE.Vector3(0, 1.5, -30);
    this.crossPoint = new THREE.Vector3(0, 1.5, -30);
    // the first-person eye (the aim's origin and frame) while the camera is
    // out on the boom
    this.eyeObj = new THREE.Object3D();
    this.eyeObj.rotation.order = 'YXZ';
    this.legYaw = 0;
    this.back = false;
    this.rec = { z: 0, vz: 0, p: 0, vp: 0, roll: 0 };
    this.fl = { yaw: 0, vyaw: 0, pitch: 0, vpitch: 0, side: 1 };
    this.hat = { x: 0, vx: 0, z: 0, vz: 0 };
    this.lower = 0;          // 0 = shouldered, 1 = at the port (sprint)
    this.t = 0;
    this._prevVel = new THREE.Vector3();
    this._prevYaw = 0;
    this.gunQ = new THREE.Quaternion();
    this.gunPos = new THREE.Vector3();
    // scratch
    this._v = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
    this._q = [0, 1, 2, 3, 4, 5].map(() => new THREE.Quaternion());
    this._m = new THREE.Matrix4();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.visible = true;
    this.setVisible(false);
  }

  // (after first person: the body was not updated, so its springs start at
  // rest where the player stands now instead of kicking from where he was)
  settle() {
    const C = this.game.controller, h = this.hood;
    h.pos.set(C.pos.x, 0, C.pos.z);
    h.yaw = C.yaw + Math.PI;
    h._prevPos.copy(h.pos); h._vel.set(C.vel.x, 0, C.vel.z); h._prevYaw = h.yaw;
    this._prevVel.set(C.vel.x, 0, C.vel.z);
    this._prevYaw = C.yaw;
    this._lastShot = this.game.weapon.lastShotTime;
  }

  setVisible(v) {
    if (v === this.visible) return;
    this.visible = v;
    HERO[1].w = v ? 1 : 0;
    this.hood.object.visible = v;
    this.gun.visible = v;
  }

  // ---- the camera ---------------------------------------------------------------
  // The eye (Controller.apply) is kept as the aim's frame (eyeObj); the camera
  // goes out on the boom, swung OTS.yaw to the left of the aim.
  placeCamera(camera) {
    const G = this.game, C = G.controller;
    camera.updateMatrixWorld();
    const E = this.eyeObj;
    E.position.copy(camera.position);
    E.quaternion.copy(camera.quaternion);
    E.updateMatrixWorld();
    const swing = this._q[0].setFromAxisAngle(Y, OTS.yaw * D2R);
    // the camera: the eye's own orientation (pitch, bob, shake) swung left
    const camQ = this._q[1].copy(swing).multiply(camera.quaternion);
    // the boom: the swing and only part of the pitch
    const boomQ = this._q[2].setFromEuler(this._e.set(C.pitch * OTS.pitchK, C.yaw + OTS.yaw * D2R, 0, 'YXZ'));
    // the key light rides with the camera
    this.keyU.dir.value.copy(KEY.dir).applyQuaternion(camQ);
    const eye = this._v[0].copy(camera.position);
    const off = this._v[1].set(OTS.right, OTS.up, OTS.back).applyQuaternion(boomQ);
    const len = off.length();
    const dir = this._v[2].copy(off).divideScalar(len);
    let k = len;
    const hit = G.rays.raycast(eye, dir, len + 0.25);
    if (hit) k = Math.max(0.12, hit.t - 0.25);
    camera.position.copy(eye).addScaledVector(dir, k);
    camera.quaternion.copy(camQ);
    camera.updateMatrixWorld();
  }

  // the world point under the crosshair: what the barrel converges on (from
  // the eye, along the aim; crossPoint is where the crosshair is drawn)
  aim() {
    const G = this.game, E = this.eyeObj;
    const o = E.position;
    const f = this._v[3].set(0, 0, -1).applyQuaternion(E.quaternion);
    let t = 60;
    const w = G.rays.raycast(o, f, t);
    if (w) t = w.t;
    const hh = G.rays.raycastHoods(o, f, t, G.world.hoods.list);
    if (hh && hh.t < t) t = hh.t;
    this.crossPoint.copy(o).addScaledVector(f, Math.max(0.5, t));
    // (never nearer than ~4 m from the gun: a wall at the muzzle must not
    // swing the barrel across the body)
    this.aimPoint.copy(o).addScaledVector(f, Math.max(4.5, t));
    // (a staged shot may hold the barrel on a point of its own)
    if (this.aimOverride) this.aimPoint.copy(this.aimOverride());
  }

  // ---- per step ----------------------------------------------------------------
  update(dt, t) {
    const G = this.game, C = G.controller, h = this.hood, W = G.weapon;
    this.t += dt;
    h.pos.set(C.pos.x, 0, C.pos.z);
    h.yaw = C.yaw + Math.PI;
    // gait from the controller's velocity, in the body's frame
    const vx = C.vel.x, vz = C.vel.z, sp = Math.hypot(vx, vz);
    const fx = -Math.sin(C.yaw), fz = -Math.cos(C.yaw);          // forward
    const along = vx * fx + vz * fz, side = vx * -fz + vz * fx;   // side: + = to his right
    // (the player moves at 4 m/s, sprints at 6.8: the Hoods' walk is 1 m/s,
    // their run 2.9, so anything over a stroll takes the run, its cadence
    // raised less than the speed - the legs are below the frame anyway)
    const state = sp < 0.35 ? 'idle' : sp > 2.2 ? 'run' : 'walk';
    if (state !== h.state) h.setState(state, 0.25);
    let legT = 0;
    if (state !== 'idle') {
      // the legs turn toward the travel (up to ~65 deg); walking backwards
      // runs the gait in reverse with the legs turned toward the reverse
      const ang = Math.atan2(side, along);         // 0 ahead, + to his right
      this.back = Math.abs(ang) > 1.95 ? true : Math.abs(ang) < 1.6 ? false : this.back;
      legT = this.back ? wrap(ang - Math.PI) : ang;
      legT = Math.max(-1.15, Math.min(1.15, legT));
      const clip = state === 'run' ? RUN.speed : WALK.speed;
      h.anim.setTimeScale((this.back ? -1 : 1) * Math.max(0.35, Math.pow(sp / clip, 0.65)));
    }
    this.legYaw += (legT - this.legYaw) * (1 - Math.exp(-8 * dt));
    // the gun lowers to the port while sprinting and in the reload's swap
    const sprint = sp > 5.2 && !this.back;
    this.lower += ((sprint ? 1 : 0) - this.lower) * (1 - Math.exp(-6 * dt));
    // springs
    if (dt > 0) {
      const R = this.rec;
      const kr = 420, cr = 30;
      R.vz += (-kr * R.z - cr * R.vz) * dt; R.z += R.vz * dt;
      R.vp += (-kr * R.p - cr * R.vp) * dt; R.p += R.vp * dt;
      R.roll *= Math.exp(-10 * dt);
      const F = this.fl, kf = 120, cf = 11;
      F.vyaw += (-kf * F.yaw - cf * F.vyaw) * dt; F.yaw += F.vyaw * dt;
      F.vpitch += (-kf * F.pitch - cf * F.vpitch) * dt; F.pitch += F.vpitch * dt;
      // the hat lags the head: tips back as he starts, forward as he stops,
      // swings out on a turn, bobs on the steps
      const ax = (vx - this._prevVel.x) / dt, az = (vz - this._prevVel.z) / dt;
      this._prevVel.set(vx, 0, vz);
      const aF = ax * fx + az * fz, aS = ax * -fz + az * fx;
      const yawRate = wrap(C.yaw - this._prevYaw) / dt;
      this._prevYaw = C.yaw;
      const H = this.hat, kh = 140, ch = 9;
      const bob = Math.cos(C.bobPhase * 2) * 0.02 * C.bobAmp;
      const tx = Math.max(-0.12, Math.min(0.12, -aF * 0.006)) + bob;
      const tz = Math.max(-0.12, Math.min(0.12, aS * 0.006 + yawRate * 0.012));
      H.vx += (-kh * (H.x - tx) - ch * H.vx) * dt; H.x += H.vx * dt;
      H.vz += (-kh * (H.z - tz) - ch * H.vz) * dt; H.z += H.vz * dt;
      H.x = Math.max(-0.15, Math.min(0.15, H.x)); H.z = Math.max(-0.15, Math.min(0.15, H.z));
    }
    // a fresh round: the kick
    if (W.lastShotTime !== this._lastShot) {
      if (this._lastShot !== undefined) this.kick(W.rng ? () => W.rng.next() : Math.random);
      this._lastShot = W.lastShotTime;
    }
    h.speed = 0;            // (the Hood's own locomotion stays off: the controller moves him)
    h.update(dt, t, G.camera);
  }

  kick(rng = Math.random) {
    const R = this.rec;
    R.vz += 0.9;
    R.vp += 1.4;
    R.roll += (rng() - 0.5) * 0.03;
  }

  // hit reaction: the torso twists away from the shot, the head snaps back
  // (dir: world direction the bullet travelled; null = from the front)
  flinch(dir = null, k = 1) {
    const F = this.fl;
    let s = 1;
    if (dir) {
      // travelling toward his left (+X in his frame) = came from his right
      const yaw = this.hood.yaw;
      const lx = Math.cos(yaw) * dir.x - Math.sin(yaw) * dir.z;
      s = lx > 0 ? -1 : 1;
    }
    F.vyaw += s * 5.5 * k;
    F.vpitch += -4.0 * k;
  }

  // ---- the pose (Hood.update's afterPose: bones in place, before the hat) --------
  pose(dt) {
    const h = this.hood, b = h.bones, obj = h.object, G = this.game, C = G.controller, W = G.weapon;
    const V = this._v, Q = this._q;
    // 1. the legs turn toward the travel (the root carries the whole body;
    // the torso is re-aimed below in world space)
    if (Math.abs(this.legYaw) > 1e-4) {
      // (legYaw + = travel to his right = the root turned toward -X: a
      // negative turn about Y in his frame)
      b.root.quaternion.premultiply(Q[0].setFromAxisAngle(Y, -this.legYaw));
      obj.updateMatrixWorld(true);
    }
    const objQ = obj.getWorldQuaternion(Q[1]);
    const pitch = C.pitch;
    const F = this.fl, R = this.rec;
    const breath = Math.sin(this.t * 1.6);
    const reloadU = W.reloading ? 1 - W.reloadLeft / 2.3 : -1;
    const rl = reloadU >= 0 ? sstep(0, 0.14, reloadU) * (1 - sstep(0.84, 1, reloadU)) : 0;
    const low = Math.max(this.lower, rl * 0.55);
    // 2. torso: bladed, pitched with the aim, the flinch on top
    // (HoodRig convention: pitch + bows forward, yaw + turns his front to his
    // LEFT, roll + leans to his right)
    const aimDeg = pitch / D2R;
    const chestP = -aimDeg * 0.42 + 6 + 1.2 * breath - R.p * 40 + F.pitch * 9 + 8 * low;
    const chestY = -BLADE + F.yaw * 16 + 10 * low;
    const chestR = 3 + F.yaw * 4;
    this.setWorld(b.chest, Q[2].copy(objQ).multiply(eulerQ([chestP, chestY, chestR], Q[3])));
    const hipsQ = b.hips.getWorldQuaternion(Q[4]);
    this.setWorld(b.spine, Q[5].copy(hipsQ).slerp(b.chest.getWorldQuaternion(Q[3]), 0.5));
    // re-apply the chest (the spine moved its parent)
    this.setWorld(b.chest, Q[2]);
    // head: squared to the aim, dropped onto the stock, snapped by a hit
    // (rolled to his right and dropped: the right cheek on the stock)
    const headQ = Q[5].copy(objQ).multiply(eulerQ([-aimDeg * 0.85 + HEAD_DROP - F.pitch * 14 + 6 * low, 2 + F.yaw * 22, 7 * (1 - low)], Q[3]));
    this.setWorld(b.neck, Q[4].copy(b.chest.getWorldQuaternion(Q[4])).slerp(headQ, 0.5));
    this.setWorld(b.head, headQ);
    // hat spring (the hat bone's bind rotation is identity)
    b.hat.quaternion.setFromEuler(this._e.set(this.hat.x, 0, this.hat.z, 'YXZ'));
    obj.updateMatrixWorld(true);
    // 3. the gun: butt in the shoulder pocket, bore on the aim point
    const pocket = V[0].copy(POCKET).applyMatrix4(b.chest.matrixWorld);
    const f = V[1].subVectors(this.aimPoint, pocket).normalize();
    if (GUN_CHEAT && this.aimOverride) f.applyAxisAngle(Y, -GUN_CHEAT * D2R);
    // (sprint / reload: the muzzle drops and swings in across the body)
    if (low > 0.001) {
      const right = V[2].crossVectors(f, Y).normalize();
      f.applyAxisAngle(right, -0.75 * low).applyAxisAngle(Y, 0.5 * low).normalize();
    }
    const gz = V[2].copy(f).negate();                       // gun +z = back
    const gx = V[3].crossVectors(Y, gz);
    if (gx.lengthSq() < 1e-6) gx.set(1, 0, 0);
    gx.normalize();
    const gy = V[4].crossVectors(gz, gx).normalize();
    this._m.makeBasis(gx, gy, gz);
    const gq = this.gunQ.setFromRotationMatrix(this._m);
    // cant (a little roll into the cheek), the recoil's muzzle rise, the
    // reload's tilt
    gq.multiply(Q[0].setFromEuler(this._e.set(R.p + 0.1 * rl, 0, -0.1 + R.roll - 0.6 * rl, 'YXZ')));
    const gp = this.gunPos.copy(BUTT).applyQuaternion(gq).negate().add(pocket);
    gp.addScaledVector(V[5].set(0, 0, 1).applyQuaternion(gq), R.z * 0.9);
    this.gun.position.copy(gp);
    this.gun.quaternion.copy(gq);
    // the reload: the drum out and down, a fresh one in
    let drumOut = 0, drumDrop = 0, handDrum = 0;
    if (reloadU >= 0) {
      handDrum = sstep(0.1, 0.24, reloadU) * (1 - sstep(0.62, 0.72, reloadU));
      drumOut = sstep(0.24, 0.4, reloadU) * (1 - sstep(0.5, 0.64, reloadU));
      drumDrop = sstep(0.34, 0.46, reloadU) * (1 - sstep(0.48, 0.56, reloadU));
    }
    this.drumG.position.set(this.drumC.x + 0.15 * drumOut, this.drumC.y - 0.2 * drumDrop, this.drumC.z);
    this.drumG.rotation.set(0.3 * drumDrop, 0, -0.35 * drumOut);
    this.gun.updateMatrixWorld(true);
    // (the gun's brush anchor: its receiver and its heading)
    FIG_ANCHOR[this.gunSlot].set(gp.x, gp.y, gp.z, Math.atan2(-gz.x, -gz.z) + Math.PI);
    // 4. arms: two-bone IK onto the grip and the foregrip (drum in the reload)
    const gm = this.gun.matrixWorld;
    const back = V[5].set(0, 0, 1).applyQuaternion(gq);
    const gripW = V[6].copy(GRIP).applyMatrix4(gm).addScaledVector(back, 0.055);
    this.arm('R', gripW, V[7].set(0, -1, 0).addScaledVector(V[2].set(-1, 0, 0).applyQuaternion(objQ), ELBOW_OUT));
    const foreL = V[6].copy(FORE).lerp(V[7].copy(this.drumG.position).add(V[2].set(0.02, -0.02, 0.06)), handDrum).applyMatrix4(gm).addScaledVector(back, 0.07);
    this.arm('L', foreL, V[7].set(0, -1, 0).addScaledVector(V[2].set(1, 0, 0).applyQuaternion(objQ), 0.35));
    obj.updateMatrixWorld(true);
    // the hero key's hat frame (the ink's crown / band / brim tests)
    const hm = b.hat.matrixWorld.elements;
    HERO[0].set(hm[12], hm[13], hm[14], BRIM_R_PLAYER);
    const ux = V[5].set(hm[4], hm[5], hm[6]).normalize();
    HERO[1].set(ux.x, ux.y, ux.z, this.visible ? 1 : 0);
    const xx = V[5].set(hm[0], hm[1], hm[2]).normalize();
    HERO[3].set(xx.x, xx.y, xx.z, 0);
  }

  // bone.world rotation := q (then its children follow)
  setWorld(bone, q) {
    const pq = bone.parent.getWorldQuaternion(this._pq || (this._pq = new THREE.Quaternion()));
    bone.quaternion.copy(pq.invert().multiply(q));
    bone.updateMatrixWorld(true);
  }

  // two-bone IK of one arm onto a wrist target (world) with an elbow pole
  // (world direction), then the hand turned to the gun (both hands: their
  // -Y along the bore, +Z up the gun, like the Hood's fist on his pistol)
  arm(s, target, pole) {
    const h = this.hood, b = h.bones, obj = h.object;
    const inv = this._invM || (this._invM = new THREE.Matrix4());
    inv.copy(obj.matrixWorld).invert();
    const objQ = obj.getWorldQuaternion(this._oq || (this._oq = new THREE.Quaternion()));
    const objQi = this._oqi || (this._oqi = new THREE.Quaternion());
    objQi.copy(objQ).invert();
    const S = (this._S || (this._S = new THREE.Vector3())).setFromMatrixPosition(b['upperArm' + s].matrixWorld).applyMatrix4(inv);
    const T = (this._T || (this._T = new THREE.Vector3())).copy(target).applyMatrix4(inv);
    const P = (this._P || (this._P = new THREE.Vector3())).copy(pole).applyQuaternion(objQi);
    const qU = this._qU || (this._qU = new THREE.Quaternion()), qL = this._qL || (this._qL = new THREE.Quaternion());
    twoBone(S, T, P, L_UPPER, L_FORE, -1, qU, qL);
    // shoulder's rotation in his frame
    const qs = (this._qs || (this._qs = new THREE.Quaternion()));
    b['shoulder' + s].getWorldQuaternion(qs);
    qs.premultiply(objQi);
    b['upperArm' + s].quaternion.copy(qs.invert().multiply(qU));
    b['forearm' + s].quaternion.copy(qU).invert().multiply(qL);
    // the hand: X = -gunX, Y = gunZ, Z = gunY (in his frame)
    const hq = (this._hq || (this._hq = new THREE.Quaternion())).copy(objQi).multiply(this.gunQ)
      .multiply(this._hb || (this._hb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)))));
    b['hand' + s].quaternion.copy(qL).invert().multiply(hq);
    b['upperArm' + s].updateMatrixWorld(true);
  }

  // ---- world points of the gun (the flash, the case, the smoke) --------------------
  muzzleWorld(out = new THREE.Vector3()) { return out.copy(MUZZLE).applyMatrix4(this.gun.matrixWorld); }
  ejectWorld(out = new THREE.Vector3()) { return out.copy(EJECT).applyMatrix4(this.gun.matrixWorld); }
  gunForward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.gun.quaternion); }
  gunAxis(out, x, y, z) { return out.set(x, y, z).applyQuaternion(this.gun.quaternion); }
  // a moving shadow caster (render/Pipeline.js's shadow cache)
  caster() { const p = this.hood.pos; return { id: 'player', x: p.x, y: p.y + 1, z: p.z, moving: true }; }
}
