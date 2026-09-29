import * as THREE from 'three';
import { Hood, playerPartGeometry } from '../enemies/Hood.js';
import { twoBone, L_UPPER, L_FORE, BIND, eulerQ } from '../enemies/HoodRig.js';
import { WALK, RUN } from '../enemies/HoodAnim.js';
import { buildTommyParts, MUZZLE, EJECT } from './Viewmodel.js';
import { allocHoodSlot, PLAYER_SLOT, HOOD_ID0, FIG_ANCHOR, HERO, PLAYER_HEAD } from '../render/layers.js';

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
// (Phase 3c: up -0.02 - the lens at brim height, below the eye, so the brim
// is a thin edge-on shape with the crown and ribbon above it, like the
// reference's shooter, not a black disc seen from above)
export const OTS = { right: 0.45, up: -0.02, back: 0.6, yaw: 15, pitchK: 0.4 };

const Y = new THREE.Vector3(0, 1, 0);
const D2R = Math.PI / 180;
// the player's own brim (Hood.js PLAYER_BRIM: narrower than any Hood's, with
// a stronger snap - at 0.19 it printed as a sombrero from half a metre)
const BRIM_R_PLAYER = 0.15;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// gun-local points (Viewmodel.js frame: +x right, +y up, muzzle toward -z)
const BUTT = new THREE.Vector3(0, -0.095, 0.455);       // the butt plate, in the shoulder
const GRIP = new THREE.Vector3(0, -0.07, 0.088);        // the right fist
// the left hand on the foregrip (Phase 3c: it never got there - the grip
// was out of the arm's reach, see GUN_SCALE / PROTRACT - and hung hidden
// behind the receiver): the wrist behind the grip's top, the hand turned
// 20 deg across it so the fingers wrap its near side, where the lens sees
// them between the drum and the fins, under the barrel (otsfore=x,y,z
// gun-local wrist; otsforerot=x,y,z deg in the gun's frame, applied Z*Y*X)
// (Phase 3c review: it still never got there - the wrist stopped 6 cm short,
// at the drum's front edge, hidden behind the drum. With the collarbone
// protracted 55 deg and the torso bladed 38 the arm reaches, and the wrist is
// set on the foregrip's top, 1.5 cm out to his left: the fist rides ahead of
// the drum with its knuckles over the barrel's top line)
// (Phase 3d: 2 cm up and 4 cm back - gun-local /0.88 - from the foregrip's
// top: at -0.30 the arm was at full stretch, the wrist stopping ~5 mm short
// (PlayerBody.wristErr), and the fist rode level with the barrel on its far
// side, where the barrel and the fins hid it; now the solve lands, the elbow
// keeps a bend, and the knuckles ride over the barrel's top line just ahead
// of the drum)
const FORE = new THREE.Vector3(-0.012, 0.029, -0.255);
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
// (Phase 3c: 20 -> 30 deg, with the left collarbone protracted below: the
// left shoulder comes forward so the hand reaches the foregrip)
// (Phase 3c review: 30 -> 38, and the protraction 35 -> 55 below: the left
// hand's reach onto the foregrip)
const BLADE = parseFloat(LD.get('otsblade') ?? '38');
// the player's own Tommy gun at true size (Phase 3c): the viewmodel's gun
// is built ~12 % long (0.97 m; an M1928 is 0.86), and the foregrip sat
// 0.92 m from his left shoulder - out of a 0.57 m arm's reach, so the left
// hand never got there. (otsgunscale=<k>)
const GUN_SCALE = parseFloat(LD.get('otsgunscale') ?? '0.88');
const PROTRACT = parseFloat(LD.get('otsprotract') ?? '55');
if (LD.get('otsfore')) FORE.set(...LD.get('otsfore').split(',').map(Number));
const FORE_ROT = (LD.get('otsforerot') ?? '0,-20,0').split(',').map((d) => parseFloat(d) * Math.PI / 180);
const FORE_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(FORE_ROT[0], FORE_ROT[1], FORE_ROT[2], 'ZYX'));
const ID_Q = new THREE.Quaternion();
// the right elbow's pole: down, and this much out to his right (1.1: a
// raised 'chicken wing'; lower: the elbow tucked under the gun)
// (Phase 3d: -0.5 -> 0.3 - tucked in, the upper arm hung straight down
// behind the torso's flank and the two printed as one convex sack, the dome
// shoulder; out a little, as the reference's shooter holds it, the sleeve
// breaks away from the back at the armpit and the shoulder turns a corner
// into the arm - the drum loses ~1 % of its pixels in ots, ~10 % in battle)
const ELBOW_OUT = parseFloat(LD.get('otselbow') ?? '0.3');
// the head's drop onto the stock (deg, forward). Phase 3c: 12 -> 3.5 - at
// 12 the brim tipped its whole top to the camera behind and spread into a
// black disc; nearly level, it stays edge-on at the lens's height
const HEAD_DROP = parseFloat(LD.get('otshead') ?? '3.5');
// (m) how far the head sinks toward the shoulders (otssink=<m>)
// (Phase 3e: 0.03 -> 0.045 - with the hat set down on the head, layers
// PLAYER_HEAD, the skull sinks 1.5 cm further between the collar's wings:
// the ear's lobe near the wings' tops, the nape and the jaw going down into
// the collar instead of a neck column under a round skull)
const HEAD_SINK = parseFloat(LD.get('otssink') ?? '0.045');
// The staged hero frame (shot=ots) swings the barrel this much further right
// than the man it is held on, the illustrator's cheat the reference makes:
// the Tommy gun's drum is a flat can on its flank, and from behind the
// shoulder a barrel pointing where the eye looks shows it edge-on; 8 deg
// more side-on opens it into a round drum under the receiver. In play the
// barrel converges on the crosshair exactly (no cheat).
const GUN_CHEAT = parseFloat(LD.get('otscheat') ?? '8');
// the drum's turn toward the lens (rad, about the gun's up; otsdrum=<deg>)
const DRUM_TURN = parseFloat(LD.get('otsdrum') ?? '26') * Math.PI / 180;
// otslog=1: the IK wrists' miss logged every frame (arm())
const OTS_LOG = LD.get('otslog') === '1';

// The key light (Phase 3b): lit only by the street, the player's back - the
// side the camera sees - printed as one black mass. Like the viewmodel's own
// key, the body gets a light of its own, from up and to the left of the
// camera (where the reference's lamp stands), folded into its material, so
// the coat's back and shoulders and the gun's top raise dry-brush ticks.
// (A material term, not a scene light: a light would be paid by every lit
// pixel of the frame.)
// Phase 3c: the ink quantises the hero's lit response to two levels
// (render/shaders/ink.js, the hero block), so the key only has to say WHERE
// the light falls: its strength is held at 1.0 (at 2.6 it printed as
// wet-latex gloss), and the head and the hat take none of it (the ink's own
// world key decides their ticks). The hero has no specular at all - no
// lamp hotspot, no environment sheen: felt, wool and blued steel in ink.
const KEY = { dir: new THREE.Vector3(-0.75, 0.6, 0.3).normalize(), col: 1.0 };
// The ink's own key on the head, the hat and the gun (layers.HERO[2]; Phase
// 3c: camera-relative, like the material key - world-fixed, the side the
// reference lights went dark whenever the player faced the other way): from
// ahead, right and above the lens, where the reference's flash and far lamp
// are, so the crown's right side, the brim's front edge, the ear and the
// receiver's top catch it while the back the camera sees stays black
const INK_KEY = new THREE.Vector3(0.75, 0.55, -0.4).normalize();
function keyed(mat, U, head = 0) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uKeyDir = U.dir;
    sh.uniforms.uKeyCol = U.col;
    sh.uniforms.uHeadK = { value: head };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vBindY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindY = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKeyDir;\nuniform float uKeyCol, uHeadK;\nvarying float vBindY;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          // (uKeyDir: world space; normal: view space; vBindY: the bind
          // pose's height - the head, the hat and the neck above the collar
          // take no key)
          vec3 kd = normalize( ( viewMatrix * vec4( uKeyDir, 0.0 ) ).xyz );
          float k = max( dot( normal, kd ), 0.0 );
          float headM = uHeadK * smoothstep( 1.53, 1.57, vBindY );
          reflectedLight.directDiffuse += diffuseColor.rgb * uKeyCol * k * k * ( 1.0 - headM );
          reflectedLight.directSpecular = vec3( 0.0 );
          reflectedLight.indirectSpecular = vec3( 0.0 );
        }`);
  };
  m.customProgramCacheKey = () => 'playerKey' + head;
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
    h.mesh.material = keyed(h.mesh.material, this.keyU, 1);
    // his ears and his left hand: rigid meshes on the head and the left hand
    // bones (bind-space geometry, so the material key's bind height still
    // tells the head from the body), each an ink id of its own - the ear a
    // shell the ink cuts out of the black skull, the glove a shape of its
    // own on the foregrip between the drum and the fins
    this.partSlots = [];
    // (Phase 3e: and the yoke - a thin flat slab over his shoulders, rigid
    // on the chest bone, Hood.js buildYoke - an id of its own so the ink
    // draws its straight back arris where it meets the coat)
    for (const [kind, bone, slot] of [['ears', 'head', PLAYER_SLOT.ear], ['hand', 'handL', PLAYER_SLOT.hand], ['yoke', 'chest', PLAYER_SLOT.yoke]]) {
      const m = new THREE.Mesh(playerPartGeometry(kind), h.mesh.material);
      m.name = 'player_' + kind;
      m.position.copy(BIND[bone]).negate();
      m.castShadow = true;
      const k = allocHoodSlot(slot);
      m.userData.inkId = HOOD_ID0 + k; m.userData.inkFigure = true; m.userData.noRay = true;
      h.bones[bone].add(m);
      this.partSlots.push(k);
    }
    h.setState('idle', 0);
    // the head sunk into the shoulders (Phase 3c, second round): a shooter
    // on the stock hunches, his head down between the raised collar and the
    // brim; upright on a 9 cm neck, from behind at brim height the skull and
    // the neck stood a head's height above the collar like a column
    h.bones.head.position.y -= HEAD_SINK;
    // (Phase 3e) the hat set down on the head (layers.PLAYER_HEAD.hatDrop):
    // on the Hoods' 13.5 cm head-to-brim offset the whole skull hung under
    // the brim, a black ball as wide as the crown with the hat perched on
    // top; lowered, the brim cuts the skull near its equator, at the top of
    // the ear, and only the nape, the ear, the cheek and the jaw show under
    // it, as on the reference's shooter
    h.bones.hat.position.y -= PLAYER_HEAD.hatDrop;
    // the Tommy gun, in two parts (the drum comes out in the reload): an ink
    // figure of its own (a Hood slot reserved for it, layers.PLAYER_SLOT),
    // so the ink draws the paper trap line between it and the coat behind -
    // black steel against a black coat still reads; its brush field rides
    // on the gun (FIG_ANCHOR, set every step)
    const P = buildTommyParts();
    this.gunMat = keyed(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6, metalness: 0.35, envMap: world.M.envSoft, envMapIntensity: 0.45 }), this.keyU);
    this.gun = new THREE.Group();
    this.gun.name = 'playerGun';
    this.gun.scale.setScalar(GUN_SCALE);
    const body = new THREE.Mesh(P.body, this.gunMat);
    const fins = new THREE.Mesh(P.fins, this.gunMat);
    const sight = new THREE.Mesh(P.sight, this.gunMat);
    const stock = new THREE.Mesh(P.stock, this.gunMat);
    this.drumG = new THREE.Group();
    this.drumC = P.drumC;
    this.drumG.position.copy(P.drumC);
    const drum = new THREE.Mesh(P.drum, this.gunMat);
    this.drumG.add(drum);
    this.gun.add(body, fins, sight, stock, this.drumG);
    // (Phase 3c: the drum, the finned barrel and the sights each an ink id -
    // a Hood slot - of their own, so the ink draws their contours and the
    // paper trap between them inside the black steel; all four share the
    // gun's brush anchor)
    this.gunSlot = allocHoodSlot(PLAYER_SLOT.gun);
    // (Phase 3d: and the walnut stock, so the stock / receiver contour draws
    // and its comb takes a dashed light line of its own)
    this.gunSlots = [this.gunSlot, allocHoodSlot(PLAYER_SLOT.drum), allocHoodSlot(PLAYER_SLOT.fins), allocHoodSlot(PLAYER_SLOT.sight), allocHoodSlot(PLAYER_SLOT.stock)];
    [body, drum, fins, sight, stock].forEach((m, i) => { m.userData.inkId = HOOD_ID0 + this.gunSlots[i]; m.userData.inkFigure = true; m.castShadow = true; m.userData.noRay = true; });
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
    this.wristErr = { L: 0, R: 0 };
    this.wristErrMax = { L: 0, R: 0 };
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
    const ik = this._v[4].copy(INK_KEY).applyQuaternion(camQ);
    HERO[2].set(ik.x, ik.y, ik.z, 1);
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
    const gp = this.gunPos.copy(BUTT).multiplyScalar(GUN_SCALE).applyQuaternion(gq).negate().add(pocket);
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
    // (Phase 3c review: the drum turned ~26 deg on the receiver toward the
    // lens behind the shoulder - the illustrator's cheat the reference makes:
    // true to the gun, from here its face was a thin edge-on oval; turned, it
    // opens into the round can under the receiver)
    this.drumG.rotation.set(0.3 * drumDrop, -DRUM_TURN * (1 - drumOut), -0.35 * drumOut);
    this.gun.updateMatrixWorld(true);
    // (the gun's brush anchor: its receiver and its heading)
    for (const k of this.gunSlots) FIG_ANCHOR[k].set(gp.x, gp.y, gp.z, Math.atan2(-gz.x, -gz.z) + Math.PI);
    // 4. arms: two-bone IK onto the grip and the foregrip (drum in the reload)
    // (Phase 3c: the left collarbone swung forward - protracted, as a
    // shooter reaches for the foregrip - so the hand gets there)
    if (PROTRACT) {
      b.shoulderL.quaternion.multiply(Q[0].setFromAxisAngle(Y, -PROTRACT * D2R * (1 - low)));
      b.shoulderL.updateMatrixWorld(true);
    }
    const gm = this.gun.matrixWorld;
    const back = V[5].set(0, 0, 1).applyQuaternion(gq);
    const gripW = V[6].copy(GRIP).applyMatrix4(gm).addScaledVector(back, 0.055);
    this.arm('R', gripW, V[7].set(0, -1, 0).addScaledVector(V[2].set(-1, 0, 0).applyQuaternion(objQ), ELBOW_OUT));
    const foreL = V[6].copy(FORE).lerp(V[7].copy(this.drumG.position).add(V[2].set(0.02, -0.02, 0.06)), handDrum).applyMatrix4(gm).addScaledVector(back, 0.07);
    this.arm('L', foreL, V[7].set(0, -1, 0).addScaledVector(V[2].set(1, 0, 0).applyQuaternion(objQ), 0.35),
      (this._foreQ || (this._foreQ = new THREE.Quaternion())).copy(FORE_Q).slerp(ID_Q, handDrum));
    obj.updateMatrixWorld(true);
    // (the ears ride on the body's brush anchor; the glove, Phase 3c review,
    // on the gun's - its fingers wrap the gun, and the ink draws the gaps
    // between them across the bore)
    FIG_ANCHOR[this.partSlots[0]].set(h.pos.x, h.pos.y, h.pos.z, h.yaw);
    // (the yoke on the body's too: the coat's strokes run on across it)
    FIG_ANCHOR[this.partSlots[2]].set(h.pos.x, h.pos.y, h.pos.z, h.yaw);
    // (Phase 3d: the glove's frame is the WRIST's, turned with the gun's
    // heading - the ink counts its knuckles along the bore from the wrist)
    const wr = b.handL.getWorldPosition(V[5]);
    FIG_ANCHOR[this.partSlots[1]].set(wr.x, wr.y, wr.z, FIG_ANCHOR[this.gunSlot].w);
    // (and the fist's own frame for its knuckle ticks: the wrist, the hand's
    // -Y - its length - and its +Z - the knuckle row)
    HERO[6].set(wr.x, wr.y, wr.z, 0);
    const hw = b.handL.matrixWorld.elements;
    const ly = V[5].set(-hw[4], -hw[5], -hw[6]).normalize();
    HERO[7].set(ly.x, ly.y, ly.z, 0);
    const lz = V[5].set(hw[8], hw[9], hw[10]).normalize();
    HERO[8].set(lz.x, lz.y, lz.z, 0);
    // the hero key's hat frame (the ink's crown / band / brim tests)
    const hm = b.hat.matrixWorld.elements;
    HERO[0].set(hm[12], hm[13], hm[14], BRIM_R_PLAYER);
    const ux = V[5].set(hm[4], hm[5], hm[6]).normalize();
    HERO[1].set(ux.x, ux.y, ux.z, this.visible ? 1 : 0);
    const xx = V[5].set(hm[0], hm[1], hm[2]).normalize();
    HERO[3].set(xx.x, xx.y, xx.z, 0);
    // the neck's frame (the ink's neck column, inside the collar), and the
    // sleeve's fold line: the right upper arm's heading in the body's
    // frontal plane (the ink's brush frame: the root turned by its yaw)
    const ua = b.upperArmR.getWorldPosition(V[5]), fa = b.forearmR.getWorldPosition(V[6]);
    const dx = fa.x - ua.x, dz = fa.z - ua.z, cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
    const foldA = Math.atan2(fa.y - ua.y, cy * dx - sy * dz);
    const nm = b.neck.matrixWorld.elements;
    HERO[4].set(nm[12], nm[13], nm[14], foldA);
    const nu = V[5].set(nm[4], nm[5], nm[6]).normalize();
    HERO[5].set(nu.x, nu.y, nu.z, 0);
    // (Phase 3e) the chest's forward axis: the yoke slab's back arris
    const cm = b.chest.matrixWorld.elements;
    const cf = V[5].set(cm[8], cm[9], cm[10]).normalize();
    HERO[9].set(cf.x, cf.y, cf.z, 0);
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
  arm(s, target, pole, extra = null) {
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
    const hq = (this._hq || (this._hq = new THREE.Quaternion())).copy(objQi).multiply(this.gunQ);
    if (extra) hq.multiply(extra);
    hq.multiply(this._hb || (this._hb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
        new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)))));
    b['hand' + s].quaternion.copy(qL).invert().multiply(hq);
    b['upperArm' + s].updateMatrixWorld(true);
    // (Phase 3d) the wrist's miss: how far the solved wrist stopped from its
    // target (m) - out of reach, the arm straightens and the hand hangs short
    // (behind the drum, where the lens never sees it). Kept per frame in
    // wristErr (and its worst in wristErrMax); otslog=1 logs it every frame.
    const miss = this._wv || (this._wv = new THREE.Vector3());
    const e = miss.setFromMatrixPosition(b['hand' + s].matrixWorld).distanceTo(target);
    this.wristErr[s] = e;
    if (e > this.wristErrMax[s]) this.wristErrMax[s] = e;
    if (OTS_LOG && s === 'L') console.log(`[ots] wrist miss L ${(this.wristErr.L * 100).toFixed(1)} cm  R ${(this.wristErr.R * 100).toFixed(1)} cm`);
  }

  // ---- world points of the gun (the flash, the case, the smoke) --------------------
  muzzleWorld(out = new THREE.Vector3()) { return out.copy(MUZZLE).applyMatrix4(this.gun.matrixWorld); }
  ejectWorld(out = new THREE.Vector3()) { return out.copy(EJECT).applyMatrix4(this.gun.matrixWorld); }
  gunForward(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.gun.quaternion); }
  gunAxis(out, x, y, z) { return out.set(x, y, z).applyQuaternion(this.gun.quaternion); }
  // a moving shadow caster (render/Pipeline.js's shadow cache)
  caster() { const p = this.hood.pos; return { id: 'player', x: p.x, y: p.y + 1, z: p.z, moving: true }; }
}
