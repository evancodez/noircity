// __noir.bench(): per-pass GPU cost. Each pass is executed K extra times per
// frame; (T(K) - T(0)) / K is its cost, which is robust against the sync and
// compositor overhead that makes "skip a pass" measurements noisy.
export async function bench(renderer, pipeline, scene, camera, { frames = 24, k = 8 } = {}) {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  const timeFrames = async () => {
    for (let i = 0; i < 4; i++) { pipeline.render(scene, camera, 0); gl.finish(); }
    await new Promise((r) => setTimeout(r, 20));
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      pipeline.render(scene, camera, i / 60);
      gl.finish();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return (performance.now() - t0) / frames;
  };
  const out = {};
  const base = await timeFrames();
  out.frame = +base.toFixed(2);
  for (const name of ['id', 'refl', 'scene', 'vol', 'ink']) {
    pipeline.repeat[name] = k;
    const t = await timeFrames();
    pipeline.repeat[name] = 0;
    out[name] = +((t - base) / k).toFixed(2);
  }
  out.size = `${pipeline.width}x${pipeline.height}`;
  return out;
}
