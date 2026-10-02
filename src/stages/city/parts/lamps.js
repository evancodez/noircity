import * as THREE from 'three';
import { Lamps } from '../../../world/Lamps.js';
import { tagInk, markFigure } from '../../../render/layers.js';
import { lathe, merge, tube, V3 } from '../../../world/geom.js';
import { PAVE, EL, PELL, SPECIAL, ALLEY_W, PIER } from '../plan.js';
import { postsOf } from '../layout.js';

// The city's lamps: the block's lamp system (world/Lamps.js: the cones, the
// registry entries for the rain and the rim, the pooled real SpotLights
// dealt to the nearest) with the city's own posts. Goosenecks on the
// pavements every ~40 m, alternating sides, one at a corner of every
// junction (where to go is lit), lamps hung under the el every other span,
// wall brackets in the alleys and Pell Lane, the quay's posts on the river
// road, the pier yard's. The pool is five lights (two with shadows): the
// track keeps two for the cars' headlamps, so a frame carries seven.
// A cone the eye cannot see (too far, or behind a block: sight.js sets
// lamp.seen) is not drawn.
//   api: the Lamps (stage.lamps), plus posts: [lamp] (the lamp posts a car
//   can bend: the track's round things), near(x, z, r)
const SHOW = 170;

export default {
  name: 'lamps', order: 50, tick: 40,
  build(stage) {
    const L = Object.create(Lamps.prototype);
    Object.assign(L, { world: stage, lamps: [], rng: stage.rng.fork(501), _poolTimer: 0, _fwd: new THREE.Vector3() });
    L.geo = L.postGeometry();
    L.posts = [];
    const { M, scene } = stage;
    const post = (x, z, yaw, real = true) => {
      const l = L.addPost(V3(x, PAVE, z), yaw, { real });
      l.post = { x, z };
      L.posts.push(l);
      return l;
    };
    // the posts (layout.js): the streets' alternating pavements, a corner of
    // every junction, the quay's on the river road
    for (const P of postsOf(stage.rng.fork(502))) {
      const l = post(P.x, P.z, P.yaw, true);
      if (P.overWater) l.overWater = true;
    }
    // ... and under the el (avenue, Harbor St, the river road's south half):
    // hung from the deck's middle every other span
    {
      const pts = EL.pts;
      let acc = 0, k = 0;
      for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (acc < 23) continue;
        acc = 0; k++;
        const [x, z] = pts[i];
        if (z < -262) continue;
        L.addHanging(V3(x, EL.deckY, z), { real: true });
      }
    }
    // wall brackets: Pell Lane (the backlot's lamp over the cars: the east
    // fence's post), the alleys, the dead end
    const bracketArm = [V3(0, 0, 0), V3(0.22, 0.1, 0), V3(0.5, 0.14, 0), V3(0.68, 0.04, 0), V3(0.72, -0.1, 0)];
    const bracketGeo = merge([tube(bracketArm, 0.026, 8, 28), new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16).rotateZ(Math.PI / 2).translate(0.02, 0, 0)]);
    const dishGeo = lathe([[0.02, 0.05], [0.05, 0.03], [0.13, -0.04], [0.23, -0.12], [0.27, -0.15], [0.25, -0.15]], 28).translate(0.72, -0.1, 0);
    const discGeo = new THREE.CircleGeometry(0.2, 32).rotateX(Math.PI / 2).translate(0.72, -0.24, 0);
    const wall = (x, y, z, nx, nz, { real = true, out = 0.35, strength = 1, half = 0.5 } = {}) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-nz, nx);
      const iron = new THREE.Mesh(bracketGeo, M.lampIron);
      const shade = new THREE.Mesh(dishGeo, M.lampShade);
      const bulb = new THREE.Mesh(discGeo, M.bulb);
      g.add(iron, shade, bulb);
      tagInk(g);
      markFigure(shade);
      scene.add(g);
      g.updateMatrixWorld(true);
      const head = V3(0.72, -0.25, 0).applyMatrix4(g.matrixWorld);
      const axis = V3(nx * out, -1, nz * out).normalize();
      const h = (head.y / Math.max(0.3, -axis.y)) * 0.97;
      const lamp = L.addCustom({ head, axis, height: h, half, real, bulb, fadeEnd: 0.9, edgeSoft: 0.25, strength, tag: 'wall' });
      lamp.group = g;
      lamp.sconce = true;
      g.traverse((o) => { if (o.isMesh) o.userData.lamp = lamp; });
      return lamp;
    };
    L.wall = wall;
    // Pell Lane: over the cars at the kerb (the backlot's own lamp), and one
    // on the west facades further up
    wall(PELL.x + PELL.hw + PELL.pe - 0.15, 4.6, 26, -1, 0, { strength: 1.1 });
    wall(PELL.x - PELL.hw - PELL.pw + 0.1, 4.8, -2, 1, 0, { strength: 0.9 });
    {
      const xa = SPECIAL['3,2'].alleyNS;
      for (const z of [-82, -52]) wall(xa - ALLEY_W / 2 + 0.1, 4.4, z, 1, 0, { strength: 0.9 });
      const za = SPECIAL['1,3'].alleyEW;
      for (const x of [-158, -128]) wall(x, 4.4, za - ALLEY_W / 2 + 0.1, 0, 1, { strength: 0.9 });
      const D = SPECIAL['0,1'].deadEnd;
      wall(D.x0 + 0.1, 4.2, D.z, 1, 0, { strength: 1.0 });
    }
    // the pier's yard: two posts and a flood over the gate
    post(PIER.yard.x0 + 6, PIER.yard.z0 + 3, -Math.PI / 2, true);
    post(PIER.yard.x0 + 26, PIER.yard.z1 - 3, Math.PI / 2, true);
    L.gateLamp = wall(PIER.gate.x - 0.2, 6.2, PIER.gate.z + PIER.gate.w / 2 + 1.2, -1, 0, { strength: 1.3, half: 0.6, out: 0.6 });

    // the pool: 2 with shadows + 3 plain (the cars' two are the track's)
    L.pool = [];
    const mk = (shadow) => {
      const spot = new THREE.SpotLight(0xffffff, 0, 26, 0.85, 0.95, 2.0);
      spot.castShadow = shadow;
      if (shadow) {
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 5;
        spot.shadow.camera.near = 0.3; spot.shadow.camera.far = 26;
      }
      spot.position.set(0, -50, 0);
      stage.scene.add(spot, spot.target);
      L.pool.push({ spot, lamp: null, k: 0, shadow });
    };
    for (let i = 0; i < 2; i++) mk(true);
    for (let i = 0; i < 3; i++) mk(false);
    L.buildInstances();
    L.near = (x, z, r = 6) => {
      let best = null, bd = r;
      for (const l of L.posts) { const e = Math.hypot(l.post.x - x, l.post.z - z); if (e < bd && !l.bent) { bd = e; best = l; } }
      return best;
    };
    const baseUpdate = L.update;
    L.update = function (dt, t, camera) {
      const p = camera.position;
      for (const l of this.lamps) {
        const far = Math.abs(l.head.x - p.x) + Math.abs(l.head.z - p.z) > SHOW * 1.3 || Math.hypot(l.head.x - p.x, l.head.z - p.z) > SHOW;
        l.cone.visible = !far && l.seen !== false;
      }
      baseUpdate.call(this, dt, t, camera);
    };
    return L;
  },
  update: (lamps, dt, t, camera) => lamps.update(dt, t, camera),
};
