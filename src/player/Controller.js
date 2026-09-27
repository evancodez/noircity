import * as THREE from 'three';
import { STREET } from '../world/Street.js';

// First-person controller: pointer-lock mouse look, WASD (+Shift sprint),
// capsule-vs-XZ collision against the world's colliders, kerb step, head bob.
// Camera eye height 1.65 m above whatever surface the player stands on.
export const EYE = 1.65;

export class Controller {
  constructor(camera, dom, world) {
    this.camera = camera;
    this.dom = dom;
    this.world = world;
    this.pos = new THREE.Vector3(-7.4, 0, 6);  // feet position
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.36;
    this.enabled = false;       // input enabled (pointer locked)
    this.keys = new Set();
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.groundY = 0;
    this.stepTimer = 0;
    this.sensitivity = 0.0021;
    this.onStep = null;         // callback(x, z) for footsteps (ripples / audio)

    this._onMouse = (e) => {
      if (!this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch -= e.movementY * this.sensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this._onKey = (e, down) => {
      const k = e.code;
      if (down) this.keys.add(k); else this.keys.delete(k);
    };
    document.addEventListener('mousemove', this._onMouse);
    document.addEventListener('keydown', (e) => this._onKey(e, true));
    document.addEventListener('keyup', (e) => this._onKey(e, false));
    document.addEventListener('pointerlockchange', () => {
      this.enabled = document.pointerLockElement === this.dom;
      if (!this.enabled) this.keys.clear();
    });
  }

  lock() {
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignored: headless / unsupported */ }
  }

  setPose(x, z, yaw, pitch, y = null) {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0, 0);
    this.groundY = y ?? this.surfaceY(x, z);
    this.apply(0);
  }

  surfaceY(x) {
    // left & right pavements are raised; smooth the kerb step over 25 cm
    const l = 1 - THREE.MathUtils.smoothstep(x, STREET.kerbX - 0.12, STREET.kerbX + 0.12);
    const r = THREE.MathUtils.smoothstep(x, STREET.rightKerbX - 0.12, STREET.rightKerbX + 0.12);
    return STREET.pavementTop * Math.max(l, r);
  }

  update(dt) {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = sprint ? 6.8 : 4.0;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, -cos), right = (cos, -sin) in XZ
    const wx = (-sin * f + cos * s), wz = (-cos * f - sin * s);
    const len = Math.hypot(wx, wz) || 1;
    const tx = (wx / len) * speed * (f || s ? 1 : 0);
    const tz = (wz / len) * speed * (f || s ? 1 : 0);
    const accel = (f || s) ? 12 : 9;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.world.colliders.resolve(this.pos, this.radius);

    const gy = this.surfaceY(this.pos.x);
    this.groundY += (gy - this.groundY) * (1 - Math.exp(-14 * dt));
    const v = Math.hypot(this.vel.x, this.vel.z);
    this.bobAmp += ((v > 0.3 ? Math.min(1, v / 4) : 0) - this.bobAmp) * (1 - Math.exp(-8 * dt));
    const prev = this.bobPhase;
    this.bobPhase += dt * (v > 0.1 ? 2.1 + v * 0.95 : 0);
    // a footstep lands every half bob cycle
    if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI) && this.onStep) this.onStep(this.pos.x, this.pos.z, v);
    this.apply(dt);
  }

  apply() {
    const c = this.camera;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.045 * this.bobAmp;
    const bobX = Math.cos(this.bobPhase) * 0.025 * this.bobAmp;
    c.position.set(this.pos.x + Math.cos(this.yaw) * bobX, this.groundY + EYE - 0.02 + bobY, this.pos.z - Math.sin(this.yaw) * bobX);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase) * 0.004 * this.bobAmp);
  }
}
