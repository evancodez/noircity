import * as THREE from 'three';
import { allocInkId } from '../../../render/layers.js';
import { lathe, merge, roundedBox, tube, V3 } from '../../../world/geom.js';
import { STREET } from '../../../world/Street.js';
import { OVERPASS } from '../../../world/Overpass.js';
import { DINER } from '../site.js';

// Street dressing that reacts (lane 4's brief 6, fix 10, with lane 3): the
// things of the street a round, a body or a blast can break, registered
// with lane 3's kinds (stage.breakables.add(obj, { kind })):
//   pipe     drainpipes down every second pilaster of the near building
//            (where no accepted camera looks: the stone of the street view
//            stays as it was), and a steam main along the el's columns
//            behind the start
//   sign     two shop signs hung on brackets (the tailor's, the barber's)
//   crate, barrel   stacks at the road works and the pipe job
//   paper    the newsstand's papers        wire   the overhead wires
//   awning   the diner's rolled awning
// None stands where the Hoods' nav grid looks (colliders only beyond it).
const X = STREET.facadeX;

export default {
  name: 'dressing', order: 180,
  build(stage) {
    const { M, colliders, breakables } = stage;
    const rng = stage.rng.fork(1800);
    const g = new THREE.Group();
    g.name = 'dressing';
    stage.scene.add(g);
    const std = (c, r = 0.6, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMap: M.envSoft, envMapIntensity: 0.4 });
    const MAT = { pipe: std(0x1a1a1a, 0.5, 0.4), wood: std(0x2a2a2a, 0.85, 0), iron: M.iron, hoop: std(0x151515, 0.5, 0.6) };
    const mesh = (parts, mat, id = allocInkId()) => {
      const m = new THREE.Mesh(merge(parts), mat);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.inkId = id;
      g.add(m);
      return m;
    };
    const out = { pipes: [], signs: [], crates: [], barrels: [] };

    // ---- drainpipes: a hopper head under the cornice, the pipe down the
    // pilaster's flank on brackets, a shoe at the foot
    const pil = [];
    for (let z = 40 - 2.0; z > -24 + 1; z -= 4.4) pil.push(z);
    const pipeAt = [38.0, 29.2, 20.4, -6.0].filter((z) => pil.some((p) => Math.abs(p - z) < 0.05));
    for (const pz of pipeAt) {
      const z = pz + (pz === -6.0 ? -0.5 : 0.5), x = X + 0.14;
      const P = [
        new THREE.CylinderGeometry(0.055, 0.055, 21.0, 14).translate(x, 10.7, z),
        lathe([[0.055, 0], [0.08, 0.05], [0.16, 0.3], [0.16, 0.42], [0.0, 0.42]], 14).translate(x, 21.1, z),
        new THREE.CylinderGeometry(0.055, 0.075, 0.3, 14).rotateZ(0.6).translate(x + 0.08, 0.3, z),
      ];
      for (let y = 1.5; y < 21; y += 2.2) P.push(new THREE.TorusGeometry(0.065, 0.012, 6, 16).rotateX(Math.PI / 2).translate(x, y, z));
      const m = mesh(P, MAT.pipe);
      out.pipes.push(breakables.add(m, { kind: 'pipe', hp: 3 }));
    }

    // ---- two shop signs on brackets: the tailor's and the barber's
    const signTex = (text) => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 160;
      const x = c.getContext('2d');
      x.fillStyle = '#161616'; x.fillRect(0, 0, 256, 160);
      x.strokeStyle = '#8a8a8a'; x.lineWidth = 5; x.strokeRect(10, 10, 236, 140);
      x.fillStyle = '#b4b4b4';
      x.font = 'bold 50px "Bodoni 72", Didot, Georgia, serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, 128, 82);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    for (const [bz, text] of [[31.4 + 1.3, 'TAILOR'], [13.8 - 1.3, 'BARBER']]) {
      const grp = new THREE.Group();
      g.add(grp);
      const id = allocInkId();
      const y = 4.9, x0 = X + 0.45;
      const arm = [
        new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8).rotateZ(Math.PI / 2).translate(x0 + 0.62, y, bz),
        tube([V3(x0, y - 0.45, bz), V3(x0 + 0.3, y - 0.3, bz), V3(x0 + 0.62, y - 0.05, bz), V3(x0 + 0.9, y, bz)], 0.012, 5, 20),
        roundedBox(0.04, 0.3, 0.12, 0.01).translate(x0 - 0.02, y - 0.2, bz),
      ];
      for (const s of [0.3, 1.05]) arm.push(new THREE.TorusGeometry(0.035, 0.007, 5, 12).translate(x0 + s, y - 0.06, bz));
      const a = new THREE.Mesh(merge(arm), MAT.iron);
      a.userData.inkId = id; a.castShadow = true;
      grp.add(a);
      const board = new THREE.Mesh(roundedBox(0.95, 0.6, 0.05, 0.015).translate(x0 + 0.68, y - 0.42, bz), MAT.wood);
      board.userData.inkId = id; board.castShadow = true;
      grp.add(board);
      const face = new THREE.MeshStandardMaterial({ map: signTex(text), roughness: 0.7 });
      for (const s of [1, -1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.54), face);
        p.position.set(x0 + 0.68, y - 0.42, bz + s * 0.027);
        if (s < 0) p.rotation.y = Math.PI;
        p.userData.inkId = id;
        p.userData.noRay = true;
        grp.add(p);
      }
      out.signs.push(breakables.add(grp, { kind: 'sign', hp: 2 }));
    }

    // ---- crates and barrels at the edges' works
    const crate = (x, z, yaw, stack = 1) => {
      const grp = new THREE.Group();
      g.add(grp);
      const id = allocInkId();
      const P = [];
      for (let k = 0; k < stack; k++) {
        const s = 0.9, y = k * s;
        P.push(roundedBox(s, s, s, 0.03).translate(0, y + s / 2, 0));
        for (const d of [-1, 1]) for (const yy of [0.12, s - 0.12]) P.push(new THREE.BoxGeometry(s + 0.02, 0.08, 0.03).translate(0, y + yy, d * (s / 2 + 0.01)));
        P.push(new THREE.BoxGeometry(s * 1.3, 0.08, 0.03).rotateZ(Math.PI / 4).translate(0, y + s / 2, s / 2 + 0.012));
      }
      const m = new THREE.Mesh(merge(P), MAT.wood);
      m.userData.inkId = id; m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      grp.position.set(x, 0, z); grp.rotation.y = yaw;
      const col = colliders.addBox(x, z, 0.5, 0.5, yaw, 'works');
      out.crates.push(breakables.add(grp, { kind: 'crate', hp: 2, collider: col }));
    };
    const barrel = (x, z, tipped = false) => {
      const grp = new THREE.Group();
      g.add(grp);
      const id = allocInkId();
      const body = lathe([[0, 0], [0.28, 0], [0.3, 0.04], [0.31, 0.12], [0.33, 0.3], [0.345, 0.44], [0.33, 0.58], [0.31, 0.76], [0.3, 0.84], [0.28, 0.88], [0, 0.88]], 28);
      const hoops = [0.1, 0.3, 0.58, 0.78].map((y) => new THREE.TorusGeometry(y > 0.2 && y < 0.7 ? 0.345 : 0.315, 0.012, 5, 28).rotateX(Math.PI / 2).translate(0, y, 0));
      const b = new THREE.Mesh(body, MAT.wood); b.userData.inkId = id; b.castShadow = true; b.receiveShadow = true;
      const h = new THREE.Mesh(merge(hoops), MAT.hoop); h.userData.inkId = id;
      grp.add(b, h);
      grp.position.set(x, 0, z);
      if (tipped) { grp.rotation.z = Math.PI / 2; grp.position.y = 0.34; }
      const col = colliders.addCircle(x, z, 0.4, 'works');
      out.barrels.push(breakables.add(grp, { kind: 'barrel', hp: 2, collider: col }));
    };
    // (south: nav grid ends at z 29.7; north at -117.7: all of them beyond)
    crate(18.8, 31.2, 0.2, 2); crate(19.8, 31.3, -0.1); crate(-8.6, 31.6, 0.3);
    barrel(20.8, 31.0); barrel(-7.4, 31.2); barrel(-7.1, 32.2, true);
    crate(-8.4, -122.0, -0.2, 2); crate(18.5, -121.7, 0.15);
    barrel(19.7, -121.5); barrel(20.5, -121.9);

    // ---- a steam main along the el's street-side columns, behind the
    // start (no accepted camera looks back there), clamped to each column
    {
      const ov = stage.part('overpass');
      if (ov) {
        const s0 = ov.sAtZ(46), s1 = ov.sAtZ(-4);
        const pts = [];
        for (let s = s0; s <= s1; s += 1.0) { const f = ov.frameAt(s); pts.push(V3(f.P.x - f.N.x * (OVERPASS.halfW - 0.85), 3.4, f.P.z - f.N.z * (OVERPASS.halfW - 0.85))); }
        const P = [tube(pts, 0.14, 12, pts.length * 2)];
        for (const st of ov.stations) {
          if (st.s < s0 || st.s > s1) continue;
          const f = st.frame;
          const c = V3(f.P.x - f.N.x * (OVERPASS.halfW - 0.85), 3.4, f.P.z - f.N.z * (OVERPASS.halfW - 0.85));
          P.push(new THREE.TorusGeometry(0.17, 0.03, 6, 20).rotateY(Math.atan2(f.T.x, f.T.z)).translate(c.x, c.y, c.z));
          P.push(new THREE.BoxGeometry(0.08, 0.08, 0.7).rotateY(Math.atan2(f.N.x, f.N.z)).translate((c.x + st.L.x) / 2, 3.4, (c.z + st.L.z) / 2));
        }
        // lagging joints: a fatter collar every so often
        for (let i = 6; i < pts.length; i += 9) P.push(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 14).rotateX(Math.PI / 2).lookAt(pts[i + 1] ? pts[i + 1].clone().sub(pts[i]) : V3(0, 0, 1)).translate(pts[i].x, pts[i].y, pts[i].z));
        const m = mesh(P, MAT.pipe);
        out.pipes.push(breakables.add(m, { kind: 'pipe', hp: 4 }));
      }
    }

    // ---- what other parts built that breaks: the newsstand's papers, the
    // overhead wires, the diner's awning
    const props = stage.part('props');
    for (const p of (props && props.papers) || []) breakables.add(p, { kind: 'paper', hp: 1 });
    for (const w of (props && props.wireMeshes) || []) breakables.add(w, { kind: 'wire', hp: 1 });
    const front = stage.part('dinerFront');
    if (front && front.awning) out.awning = breakables.add(front.awning, { kind: 'awning', hp: 3 });
    void rng; void DINER;
    return { group: g, ...out };
  },
};
