import * as THREE from 'three';

// A place's own frame (lane O5): its street door's middle at y 0, local +z
// out to the street (the door's normal), the room at z < 0, local +x to my
// right as I walk in. A room is authored in this frame; the kit maps it to
// the world with one rotation about y (the city's faces are axis-aligned, so
// a local box is a world box).
//   F.w(lx, lz) -> { x, z }      F.l(x, z) -> { x, z } (world to local)
//   F.v(lx, ly, lz) -> Vector3   F.yaw(localYaw) -> a viewer's world yaw
//   F.figYaw(localYaw) -> a figure's world heading (it faces (sin, cos))
//   F.box(x0, x1, z0, z1) -> a world rect { x0, x1, z0, z1 }
//   F.M: the Matrix4 local -> world
export class Frame {
  constructor(door) {
    this.ox = door.x; this.oz = door.z;
    this.nx = door.nx; this.nz = door.nz;
    // (a rotation about y by th: local (0,0,1) -> (sin th, cos th) = n)
    this.th = Math.atan2(door.nx, door.nz);
    this.c = Math.cos(this.th); this.s = Math.sin(this.th);
    this.M = new THREE.Matrix4().makeRotationY(this.th).setPosition(this.ox, 0, this.oz);
    this.Mi = this.M.clone().invert();
  }
  // local (lx, lz) -> world: Ry(th) (x, z) = (x c + z s, -x s + z c)
  w(lx, lz) { return { x: this.ox + lx * this.c + lz * this.s, z: this.oz - lx * this.s + lz * this.c }; }
  l(x, z) { const dx = x - this.ox, dz = z - this.oz; return { x: dx * this.c - dz * this.s, z: dx * this.s + dz * this.c }; }
  v(lx, ly, lz, out = new THREE.Vector3()) { const p = this.w(lx, lz); return out.set(p.x, ly, p.z); }
  // a direction (local) to world
  dir(lx, lz) { return { x: lx * this.c + lz * this.s, z: -lx * this.s + lz * this.c }; }
  // a viewer's yaw: local 0 looks in (local -z)
  yaw(ly = 0) { return this.th + ly; }
  // a figure's heading: local 0 faces local +z (out); PI faces in
  figYaw(ly = 0) { return this.th + ly; }
  box(x0, x1, z0, z1) {
    const a = this.w(x0, z0), b = this.w(x1, z1);
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
  }
  // a world rect -> the local rect it covers
  lbox(B) {
    const a = this.l(B.x0, B.z0), b = this.l(B.x1, B.z1);
    return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
  }
}
