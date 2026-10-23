// [O4] A turn of the mouse wheel by real input (a trusted wheel event under the
// pointer lock): { "drive": "tools/lib/o4_wheel.mjs", "dy": 100 } (dy > 0: down,
// the next in the wheel). Returns { ok }.
export default async function drive({ mouse, W, H, opts, cursor, sleep }) {
  const [x, y] = cursor ? cursor() : [W / 2, H / 2];
  await mouse('mouseWheel', x, y, 'none', { deltaX: 0, deltaY: opts.dy ?? 100 });
  await sleep(60);
  return { ok: true };
}
