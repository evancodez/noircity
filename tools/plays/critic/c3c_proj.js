(() => { const C = G.scenes.ctx.flags.chase, T = N.THREE, h = C.his;
  const p = (dx, dy, dz) => { const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    // car frame: forward (cos yaw, -sin yaw), right (sin yaw, cos yaw)
    const v = new T.Vector3(h.pos.x + c * dz + s * dx, (h.pos.y || 0) + dy, h.pos.z - s * dz + c * dx).project(N.camera);
    return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight), v.z < 1 ? 1 : 0]; };
  return { mid: p(0, 0.9, 0), rearL: p(-0.8, 0.4, -1.9), rearR: p(0.8, 0.4, -1.9), back: p(0, 1.0, -2.2), W: innerWidth, H: innerHeight }; })()
