// Why a figure's torso wound round and round (Wave A round 2, owner 2).
// three's AnimationMixer writes a bone only when its mixed value differs
// from the value it wrote the step before (PropertyMixer.apply compares its
// two accumulation buffers). A clip that holds a bone still - a static
// spine in a standing pose, the last frame of a held one-shot - is written
// once and then left alone. Hood.postPose turns the spine, chest and head
// toward a look-at target by MULTIPLYING their quaternions; on a bone the
// mixer no longer writes, that turn is added again every step: the chest
// winds a full turn in a few seconds (Dot at her pour, glancing at the
// room; the brawler's rise into his guard and his fall).
// steady(fig): before each step's pose, the figure's bindings are marked
// stale (last step's buffer set to NaN), so the mixer writes every bone
// every step and the look-at, the IK and the rest are laid on the clip's
// pose, never on their own last result. (Hood.update calls fig.script
// first, before its mixer runs.) The Hoods are untouched.
export function steady(fig) {
  if (!fig || fig._steady) return;
  fig._steady = true;
  const prev = fig.script || null;
  fig.script = (h, t, dt) => {
    const B = h.anim && h.anim.mixer && h.anim.mixer._bindings;
    if (B) {
      for (const pm of B) {
        const s = pm.valueSize, buf = pm.buffer;
        if (!buf) continue;
        for (let i = s; i < 3 * s && i < buf.length; i++) buf[i] = NaN;
      }
    }
    if (prev) prev(h, t, dt);
  };
}
