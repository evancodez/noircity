// The city as it was (a retry at a checkpoint, a beat entered cold): every
// thing that burst stands again, every parked car where it stood, every
// lamp post a car bent upright and lit, the cars' marks gone.
export function resetCity(stage, G) {
  const S = stage.part('smash');
  if (S && S.reset && stage._dirty) S.reset();
  const C = stage.part('cars');
  if (C && C.parkedReset && stage._dirty) C.parkedReset();
  const L = stage.lamps;
  if (L && stage._dirty) {
    for (const l of L.posts) {
      if (!l.bent && !l.dead) continue;
      l.bent = false; l.dead = false; l.on = true; l.buzz = null; l.dieNow = false;
      if (l.group && l.q0) l.group.quaternion.copy(l.q0);
      if (l.head0) l.head.copy(l.head0);
      if (l.cone) { l.cone.position.copy(l.head); l.cone.material.uniforms.uApex.value.copy(l.head); }
      if (l.entry) l.entry.position.copy(l.head);
      if (l.bulb) l.bulb.material = stage.M.bulb;
      if (l.collider) l.collider.gone = false;
      if (l.group) { l.group.updateMatrixWorld(true); L.syncInstance(l, true); }
    }
    stage._posts = [];
  }
  if (G && G.fx && stage._dirty) G.fx.clear();
  stage._dirty = true;
}
