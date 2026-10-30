import * as THREE from 'three';
import { LAYER, allocInkId } from '../render/layers.js';

// The city's signals (lane O2): every junction the graph marks `signal` runs
// its lights - its streets in two or three groups by their line (east-west,
// north-south, Broadway's diagonal), each group green in turn, then the
// change (amber), then all stopped a breath, then the next. A car reads its
// way in: go, the change, or stop (src/traffic/Traffic.js).
// What the eye sees: a signal hung over the middle of each junction on its
// span wires (1930s: a four-way head on a wire), a head facing every street
// that comes in, three lamps in it - the top lit is STOP, the middle the
// change, the bottom GO - lit white (the ink: a lamp is a white light; no
// colour, the registry's few are blood's and fire's). Drawn for the
// junctions within 170 m of the eye: three instanced draws for all of them.
//   signals.state(node, edgeIn) -> 'go' | 'amber' | 'stop'   (edgeIn: the street a car comes by)
//   signals.step(dt, eye)        signals.dispose()
const GREEN = 10, AMBER = 2.6, CLEAR = 1.6;
const NEAR = 170, MAXN = 30, HEAD_Y = 6.2;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function groupOf(e) {
  const a = Math.abs(Math.atan2(e.dz, e.dx)) % Math.PI;
  const d = Math.min(a, Math.PI - a);   // 0: along x
  return d < 0.35 ? 'x' : d > 1.22 ? 'z' : 'd';
}

export class Signals {
  constructor(stage, graph) {
    this.stage = stage;
    this.graph = graph;
    this.t = 0;
    this.nodes = [];
    for (const n of graph.nodes.values()) {
      if (!n.signal) continue;
      const groups = [...new Set(n.edges.map(groupOf))];
      // (a hash of the place: the phases are not all in step)
      const off = ((Math.sin(n.x * 12.9898 + n.z * 78.233) * 43758.5453) % 1 + 1) % 1;
      n.sig = { groups, off: off * groups.length * (GREEN + AMBER + CLEAR) };
      this.nodes.push(n);
    }
    // the heads: a dark plate with its three lamp housings, the lit lamp, the wires
    const M = stage.M;
    const plate = new THREE.BoxGeometry(0.08, 0.92, 0.36).translate(0, 0, 0);
    const hoods = [];
    for (const y of [0.27, 0, -0.27]) hoods.push(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(0.09, y + 0.06, 0));
    const head = mergeGeos([plate, ...hoods, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5).translate(0, 0.7, 0)]);
    this.heads = new THREE.InstancedMesh(head, M.lampIron, MAXN * 6);
    this.lamps = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 12).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(9) }), MAXN * 6);
    this.wires = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, 0.5, 0), M.lampIron, MAXN * 2);
    const id = allocInkId(1);
    for (const im of [this.heads, this.lamps, this.wires]) {
      im.count = 0; im.frustumCulled = false; im.userData.noRay = true; im.castShadow = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.userData.inkId = id;
      stage.scene.add(im);
    }
    this.lamps.userData.emitter = true;
    this.lamps.layers.set(LAYER.WORLD);
    this.shown = [];
    this.dealT = 0;
  }

  // the group green at a node now, and the phase's state for a group
  phase(n) {
    const S = n.sig, cyc = GREEN + AMBER + CLEAR, T = (this.t + S.off) % (cyc * S.groups.length);
    const gi = Math.floor(T / cyc), u = T - gi * cyc;
    return { group: S.groups[gi], st: u < GREEN ? 'go' : u < GREEN + AMBER ? 'amber' : 'stop', left: u < GREEN ? GREEN - u : u < GREEN + AMBER ? GREEN + AMBER - u : cyc - u };
  }
  state(n, edgeIn) {
    if (!n || !n.sig || !edgeIn) return 'go';
    const P = this.phase(n);
    return groupOf(edgeIn) === P.group ? P.st : 'stop';
  }
  // seconds until this way is green again (0 now)
  waitFor(n, edgeIn) { const P = this.phase(n); return groupOf(edgeIn) === P.group && P.st === 'go' ? 0 : P.left; }

  step(dt, eye) {
    this.t += dt;
    this.dealT -= dt;
    if (this.dealT <= 0) {
      this.dealT = 0.5;
      this.shown = this.nodes.filter((n) => Math.abs(n.x - eye.x) < NEAR && Math.abs(n.z - eye.z) < NEAR).sort((a, b) => Math.hypot(a.x - eye.x, a.z - eye.z) - Math.hypot(b.x - eye.x, b.z - eye.z)).slice(0, MAXN);
    }
    let h = 0, l = 0, w = 0;
    for (const n of this.shown) {
      const P = this.phase(n);
      // the wires: to two opposite corners of the junction, up to the eaves
      const hw = Math.max(...n.edges.map((e) => e.hw)) + 3;
      for (const sx of [-1, 1]) {
        const ax = n.x + sx * hw, az = n.z + sx * hw * (n.sig.groups.includes('d') ? -1 : 1), ay = HEAD_Y + 2.2;
        const bx = n.x, bz = n.z, by = HEAD_Y + 1.2;
        _p.set(bx, by, bz); const d = new THREE.Vector3(ax - bx, ay - by, az - bz); const L = d.length();
        _q.setFromUnitVectors(_y, d.normalize());
        this.wires.setMatrixAt(w++, _m.compose(_p, _q, _s.set(1, L, 1)));
      }
      for (const e of n.edges) {
        // (a head facing the street that comes in by e: its face toward the way out of the junction along e)
        const fx = (e.a === n.id ? e.dx : -e.dx), fz = (e.a === n.id ? e.dz : -e.dz);
        const yaw = Math.atan2(-fz, fx);
        _q.setFromAxisAngle(_y, yaw);
        _p.set(n.x + fx * 0.3, HEAD_Y, n.z + fz * 0.3);
        this.heads.setMatrixAt(h++, _m.compose(_p, _q, _s.set(1, 1, 1)));
        const st = groupOf(e) === P.group ? P.st : 'stop';
        const y = st === 'stop' ? 0.33 : st === 'amber' ? 0.06 : -0.21;
        _p.set(n.x + fx * 0.48, HEAD_Y + y, n.z + fz * 0.48);
        this.lamps.setMatrixAt(l++, _m.compose(_p, _q, _s.set(1, 1, 1)));
      }
    }
    this.heads.count = h; this.lamps.count = l; this.wires.count = w;
    for (const im of [this.heads, this.lamps, this.wires]) { im.instanceMatrix.needsUpdate = true; im.visible = im.count > 0; }
  }

  dispose() { for (const im of [this.heads, this.lamps, this.wires]) { if (im.parent) im.parent.remove(im); im.geometry.dispose(); } }
}

function mergeGeos(list) {
  const out = [];
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); out.push(n); }
  let count = 0; for (const g of out) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  let o = 0; for (const g of out) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return G;
}
