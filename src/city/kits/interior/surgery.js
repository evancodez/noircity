// Cutting a way in (lane O5): the city draws every lot's mass in the far
// tiles' merged meshes and every window's dark pane in the near chunks'
// (lane O1), so a place's walls cannot simply be left out. While a place is
// loaded its own pieces are taken out of those meshes by moving their
// vertices onto one point (a degenerate run draws nothing) - the base tier's
// box (36 vertices: mergeAll makes every geometry non-indexed) or a pane's
// quad (6) - and put back as they were when it is dropped. Nothing changes
// while a place is not loaded: the city's frames are the city's.
//   const cut = cutRun(mesh, test, n)  -> { mesh, at, saved } | null
//   heal(cut)
// test(i, P) -> true if a run of n vertices starting at vertex i is the one
// (P: the position array).

export function cutRun(mesh, test, n) {
  if (!mesh || !mesh.geometry) return null;
  const A = mesh.geometry.getAttribute('position');
  const P = A.array, count = A.count;
  for (let i = 0; i + n <= count; i++) {
    if (!test(i, P)) continue;
    const saved = P.slice(i * 3, (i + n) * 3);
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    for (let k = 0; k < n; k++) { P[(i + k) * 3] = x; P[(i + k) * 3 + 1] = y; P[(i + k) * 3 + 2] = z; }
    A.needsUpdate = true;
    return { mesh, at: i, n, saved };
  }
  return null;
}

export function heal(cut) {
  if (!cut || !cut.mesh.geometry) return;
  const A = cut.mesh.geometry.getAttribute('position');
  if (!A || A.count < cut.at + cut.n) return;
  A.array.set(cut.saved, cut.at * 3);
  A.needsUpdate = true;
}

// a run of n vertices whose bounds are the box (x0..x1, y0..y1, z0..z1), within eps
export function boxRun(x0, x1, y0, y1, z0, z1, n = 36, eps = 2e-3) {
  return (i, P) => {
    const fx = P[i * 3], fy = P[i * 3 + 1], fz = P[i * 3 + 2];
    // (a quick look at its first corner first)
    if (!(near(fx, x0, eps) || near(fx, x1, eps)) || !(near(fy, y0, eps) || near(fy, y1, eps)) || !(near(fz, z0, eps) || near(fz, z1, eps))) return false;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity, e = Infinity, f = -Infinity;
    for (let k = 0; k < n; k++) {
      const o = (i + k) * 3;
      a = Math.min(a, P[o]); b = Math.max(b, P[o]); c = Math.min(c, P[o + 1]); d = Math.max(d, P[o + 1]); e = Math.min(e, P[o + 2]); f = Math.max(f, P[o + 2]);
    }
    return near(a, x0, eps) && near(b, x1, eps) && near(c, y0, eps) && near(d, y1, eps) && near(e, z0, eps) && near(f, z1, eps);
  };
}
const near = (a, b, e) => Math.abs(a - b) < e;
