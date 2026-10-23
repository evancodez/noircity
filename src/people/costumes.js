import * as THREE from 'three';
import { COSTUMES } from '../cast/costumes.js';
import { profileAt } from '../enemies/Hood.js';
import { JOINT_INDEX } from '../enemies/HoodRig.js';
import { sstep, lerp } from '../cast/tailor.js';

// [O3] The city's people's clothes (lane O3): costumes for the tailor
// (src/cast/tailor.js), registered into the cast's COSTUMES table at load, so
// a Figure of any of these kinds is a cast figure like the diner's (its
// clips, its brawl, its deaths). Everyone told by the outline at 20 m, and no
// two alike in a frame (OPEN_WORLD's "nothing copy-paste"): the men in
// fedoras come in coat lengths, coat greys (black, charcoal, a grey, a pale
// raincoat), brims and scarves; the women in cloches and coats of their own
// greys; the Docks' gang in long black coats and white scarves under the
// fedora, the Tenements' in flat caps and short jackets; the police in
// peaked caps, long belted coats with the badge's glint.
//   LOOKS: { id: { kind (a COSTUMES key), role, sex, h } }   (every look here)
const TAU = Math.PI * 2;
const A = Math.abs;
const B = JOINT_INDEX;

// ---- the bodies --------------------------------------------------------------------------
// a man of middling build (the couple's him, a little fuller)
const MAN = {
  torso: [
    [0.95, 0.196, 0.138, 0.138, 0.0, 2.3],
    [1.03, 0.186, 0.132, 0.13, 0.004, 2.3],
    [1.12, 0.19, 0.138, 0.128, 0.008, 2.35],
    [1.22, 0.202, 0.146, 0.13, 0.01, 2.45],
    [1.31, 0.218, 0.146, 0.136, 0.008, 2.7],
    [1.37, 0.228, 0.138, 0.136, 0.0, 3.0],
    [1.41, 0.226, 0.124, 0.126, -0.008, 3.1],
    [1.44, 0.206, 0.108, 0.112, -0.013, 2.9],
    [1.465, 0.166, 0.094, 0.1, -0.017, 2.6],
    [1.484, 0.104, 0.082, 0.088, -0.019, 2.3],
    [1.496, 0.062, 0.066, 0.072, -0.02, 2.2],
  ],
  shoulderX: 0.178, shoulderY: 1.4, upper: 0.3, fore: 0.272, hipX: 0.094,
  neckR: 0.05, neckY: 1.475, headS: 0.98, jaw: 0.16,
};
// broad: a heavy man (the cop on the beat, a gang's muscle)
const BROAD = {
  torso: [
    [0.94, 0.214, 0.16, 0.152, 0.012, 2.3],
    [1.02, 0.214, 0.164, 0.148, 0.02, 2.3],
    [1.12, 0.22, 0.17, 0.146, 0.024, 2.4],
    [1.22, 0.234, 0.17, 0.15, 0.02, 2.5],
    [1.31, 0.252, 0.166, 0.154, 0.012, 2.8],
    [1.38, 0.264, 0.154, 0.152, 0.004, 3.3],
    [1.425, 0.266, 0.138, 0.142, -0.006, 3.7],
    [1.455, 0.252, 0.122, 0.128, -0.012, 3.6],
    [1.476, 0.222, 0.107, 0.113, -0.016, 3.1],
    [1.492, 0.164, 0.095, 0.1, -0.018, 2.7],
    [1.504, 0.1, 0.084, 0.09, -0.019, 2.3],
  ],
  shoulderX: 0.204, shoulderY: 1.41, upper: 0.305, fore: 0.28, hipX: 0.1,
  neckR: 0.06, headW: 1.03, jaw: 0.12,
};
// a woman in a coat (the couple's her)
const WOMAN = {
  torso: [
    [0.93, 0.18, 0.124, 0.134, -0.006, 2.3],
    [1.0, 0.166, 0.112, 0.118, 0.0, 2.3],
    [1.07, 0.148, 0.102, 0.104, 0.004, 2.3],
    [1.14, 0.152, 0.108, 0.104, 0.008, 2.35],
    [1.22, 0.168, 0.132, 0.108, 0.01, 2.45],
    [1.3, 0.182, 0.134, 0.112, 0.01, 2.7],
    [1.37, 0.198, 0.118, 0.116, 0.002, 3.1],
    [1.415, 0.204, 0.106, 0.11, -0.006, 3.4],
    [1.445, 0.194, 0.094, 0.1, -0.012, 3.2],
    [1.466, 0.162, 0.083, 0.09, -0.015, 2.8],
    [1.482, 0.104, 0.07, 0.076, -0.017, 2.4],
    [1.492, 0.06, 0.058, 0.064, -0.018, 2.2],
  ],
  shoulderX: 0.158, shoulderY: 1.405, upper: 0.285, fore: 0.25, hipX: 0.084,
  neckR: 0.044, headS: 0.92, jaw: 0.26, nose: 0.8,
};

// ---- the fedora (a cover the tailor does not have): the Hood's own hat,
// cut at the tailor's tessellation (the far figure's is a few strokes), on
// the figure's hat bone ---------------------------------------------------------------------
function fedora(F, H, brimR = 0.17, pinch = 1) {
  const hb = F.rig.BIND.hat, c = F.cover;
  const prof = [
    [0.0, 0.03], [0.06, 0.012], [0.098, 0.0], [brimR - 0.03, -0.001], [brimR - 0.006, 0.001],
    [brimR, 0.0045], [brimR - 0.004, 0.0085], [brimR - 0.03, 0.0082], [0.104, 0.0095], [0.1015, 0.014], [0.1015, 0.035],
    [0.0975, 0.038], [0.0925, 0.066], [0.0855, 0.091], [0.0755, 0.107], [0.058, 0.117], [0.032, 0.1205], [0.0, 0.121],
  ];
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.06);
  const s = c.s ?? 1;
  const geo = H.grid(H.seg(88, 16), H.seg(prof.length * 4, prof.length + 4), (u, v, p) => {
    const [r, h0] = profileAt(prof, v);
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    let h = h0;
    const crown = r < 0.106;
    const ox = crown ? 0.85 : lerp(0.85, 0.9, sstep(0.106, brimR, r));
    let x = r * sn * ox, z = r * cs;
    if (!crown) {
      const w = Math.pow(sstep(0.1, brimR, r), 1.4);
      h += w * (-0.024 * Math.max(0, cs) ** 1.5 + 0.017 * Math.max(0, -cs) ** 1.5 + 0.007 * sn * sn);
    } else if (h0 > 0.02) {
      const hk = sstep(0.045, 0.11, h0);
      x *= 1 - 0.16 * pinch * hk * Math.max(0, cs) ** 1.5;
      z += 0.006 * hk * Math.max(0, -cs) ** 1.5;
      const top = sstep(0.07, 0.113, h0);
      h -= top * Math.exp(-((x / 0.03) ** 2)) * (0.0205 + 0.0025 * cs) * pinch;
      h -= 0.008 * Math.max(0, cs) * sstep(0.04, 0.12, h0);
    }
    p.set(x * s, h * s, z * s).applyQuaternion(tilt).add(hb);
  });
  H.orientOut(geo, hb.clone().add(new THREE.Vector3(0, 0.04, 0)));
  const band = F.shade('band'), felt = F.shade('cover');
  return [{ geo, shade: (x, y) => { const h = y - hb.y; return h > 0.012 * s && h < 0.036 * s && Math.hypot(x - hb.x, 0) < 0.2 ? band : felt; }, weights: () => [[B.hat, 1]] }];
}

// ---- the police cap: a stiff round crown wider at the top, its flat top
// tipped a little forward, a black band, a short shining visor ----------------------------------
function copCap(F, H) {
  const hb = F.rig.BIND.hat, c = F.cover;
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch ?? 0.08);
  const rows = [[0.0, -0.004], [0.094, -0.004], [0.098, 0.01], [0.1, 0.034], [0.116, 0.062], [0.128, 0.074], [0.124, 0.082], [0.06, 0.086], [0.0, 0.087]];
  const crown = H.grid(H.seg(64, 14), H.seg(rows.length * 3, rows.length + 2), (u, v, p) => {
    const [r, y] = profileAt(rows, v);
    const th = u * TAU, sn = Math.sin(th), cs = Math.cos(th);
    // (the top's front higher than its back: the badge's lift)
    const yy = y + (y > 0.05 ? 0.008 * cs : 0);
    p.set(r * sn * 0.94, yy, r * cs * 1.02 + 0.006).applyQuaternion(tilt).add(hb);
  });
  H.orientOut(crown, hb.clone().add(new THREE.Vector3(0, 0.04, 0)));
  const visor = H.grid(H.seg(24, 8), H.seg(6, 3), (u, v, p) => {
    const a = (u - 0.5) * 2.2;
    const r = 0.096 + v * 0.06;
    p.set(Math.sin(a) * r * 0.94, -0.004 - v * 0.022, Math.cos(a) * r + 0.004).applyQuaternion(tilt).add(hb);
  }, { wrapU: false });
  visor.computeVertexNormals();
  const cap = F.shade('cover'), band = F.shade('band'), badge = F.shade('badge');
  return [
    { geo: crown, shade: (x, y, z) => { const h = y - hb.y, zz = z - hb.z; if (h > 0.02 && h < 0.056 && zz > 0.08 && A(x - hb.x) < 0.022) return badge; return h > 0.0 && h < 0.03 ? band : cap; }, weights: () => [[B.hat, 1]] },
    { geo: visor, shade: F.shade('visor'), weights: () => [[B.hat, 1]] },
  ];
}

// ---- the men in fedoras: coats by length and grey, brims, scarves ---------------------------
// (hem: the coat's hem in model metres - 0.36 mid-calf, 0.46 below the knee,
// 0.56 at the knee, 0.86 a suit's jacket; coat: its grey - 0.011 black,
// 0.022 charcoal, 0.05 a grey that prints, 0.14 a pale raincoat)
const FEDORA_COATS = [
  { id: 'a', hem: 0.38, coat: 0.011, brim: 0.17, scarf: null, belt: true, body: MAN, h: 1.8 },
  { id: 'b', hem: 0.46, coat: 0.024, brim: 0.19, scarf: 0.32, body: MAN, h: 1.77 },
  { id: 'c', hem: 0.56, coat: 0.05, brim: 0.16, scarf: null, body: BROAD, h: 1.82 },
  { id: 'd', hem: 0.4, coat: 0.15, brim: 0.17, scarf: null, belt: true, body: MAN, h: 1.79 },
  { id: 'e', hem: 0.86, coat: 0.016, brim: 0.165, scarf: null, body: MAN, h: 1.74, jacket: true },
  { id: 'f', hem: 0.5, coat: 0.012, brim: 0.18, scarf: 0.06, body: BROAD, h: 1.85 },
  { id: 'g', hem: 0.36, coat: 0.034, brim: 0.2, scarf: 0.4, body: MAN, h: 1.76 },
  { id: 'h', hem: 0.6, coat: 0.09, brim: 0.165, scarf: null, body: MAN, h: 1.72 },
];
function fedoraCostume(o, { name, gang = false } = {}) {
  const garments = [
    // the shirt's V at the throat (light) under the coat
    { kind: 'torso', shade: (th, y) => (y > 1.27 && A(th) < 0.11 ? 0.3 : 'coat') },
    { kind: 'skirt', y0: 1.04, hem: o.hem, split: o.jacket ? 0.4 : 0.5, flare: o.jacket ? [1.06, 1.1] : [1.22, 1.3], back: 0.4, folds: o.jacket ? 0.3 : 0.9, grow: 0.012, shade: 'coat' },
    { kind: 'lapels', near: true, top: 1.47, low: 1.22, shade: 'lapel' },
    o.scarf != null ? { kind: 'collar', style: 'scarf', r: 0.032, shade: 'scarf' } : { kind: 'collar', style: 'stand', h: 0.06, hFront: 0.04, open: 0.5, gap: 0.03, lean: 0.004, flareOut: 0.006, shade: 'collar' },
    { kind: 'sleeves', style: 'long', r: 0.084, cuff: 0.074 },
    { kind: 'legs', r: o.body === BROAD ? 1.06 : 0.95 },
    { kind: 'shoes' },
    { kind: 'hands', s: o.body === BROAD ? 1.04 : 0.96 },
    { kind: 'custom', build: (F, H) => fedora(F, H, o.brim, gang ? 1.15 : 1) },
  ];
  // (a belted trench: the belt a darker band at the waist)
  if (o.belt) garments[0] = { kind: 'torso', shade: (th, y) => (y > 1.27 && A(th) < 0.11 ? 0.3 : A(y - 1.04) < 0.022 ? 0.004 : 'coat') };
  return {
    name, h: o.h, body: o.body,
    cover: { kind: 'none', hatDY: 0.13, hatDZ: 0.0, pitch: gang ? 0.12 : 0.06, s: 1 },
    garments,
    skin: { coat: o.coat, lapel: o.coat * 0.9, collar: o.coat * 1.1, scarf: o.scarf ?? 0.3, hand: 0.022, skin: 0.03, cover: o.coat < 0.03 ? 0.007 : 0.012, band: 0.002, trousers: 0.007, shoes: 0.004 },
    collider: o.body === BROAD ? 0.34 : 0.3,
  };
}

// ---- the women: cloches, coats of their own grey, one with a fur collar, one a beret ----
const WOMEN = [
  { id: 'a', coat: 0.013, collar: 'fur', fur: 0.08, hem: 0.36, cover: 'cloche', cv: 0.01, h: 1.64 },
  { id: 'b', coat: 0.06, collar: 'stand', hem: 0.4, cover: 'cloche', cv: 0.02, h: 1.6 },
  { id: 'c', coat: 0.022, collar: 'scarf', fur: 0.35, hem: 0.34, cover: 'cloche', cv: 0.25, h: 1.67 },
  { id: 'd', coat: 0.14, collar: 'fur', fur: 0.025, hem: 0.38, cover: 'cloche', cv: 0.012, h: 1.62 },
];
function womanCostume(o, name) {
  return {
    name, h: o.h, body: WOMAN,
    cover: { kind: o.cover, hatDY: 0.1, hatDZ: 0.008, pitch: 0.2, s: 0.95 },
    garments: [
      { kind: 'torso', shade: 'coat' },
      { kind: 'skirt', y0: 1.02, hem: o.hem, split: 0.45, flare: [1.3, 1.4], back: 0.4, folds: 0.8, shade: 'coat' },
      o.collar === 'fur' ? { kind: 'collar', style: 'fur', r: 0.046, shade: 'fur' }
        : o.collar === 'scarf' ? { kind: 'collar', style: 'scarf', r: 0.03, shade: 'fur' }
          : { kind: 'collar', style: 'stand', h: 0.05, hFront: 0.035, open: 0.55, gap: 0.03, shade: 'coat' },
      { kind: 'sleeves', r: 0.068, cuff: 0.06 },
      { kind: 'legs', style: 'stocking' },
      { kind: 'shoes', style: 'flat' },
      { kind: 'hands', s: 0.82 },
    ],
    skin: { coat: o.coat, fur: o.fur ?? 0.04, hand: 0.022, skin: 0.03, cover: o.cv, band: 0.03, stocking: 0.012 },
    collider: 0.26,
  };
}

// ---- the Tenements' gang: flat caps pulled low, short jackets to the hip,
// the shirt's collar out over the jacket (a light V at the throat) -----------------------------
const CAPS = [
  { id: 'a', jacket: 0.012, shirt: 0.3, body: BROAD, h: 1.8 },
  { id: 'b', jacket: 0.03, shirt: 0.22, body: MAN, h: 1.76 },
  { id: 'c', jacket: 0.016, shirt: 0.36, body: MAN, h: 1.83, vest: true },
];
function capCostume(o, name) {
  return {
    name, h: o.h, body: o.body,
    cover: { kind: 'flatcap', hatDY: 0.124, hatDZ: 0.012, pitch: 0.18, s: 1.04, peak: 0.064, peakDrop: 0.34 },
    garments: [
      { kind: 'torso', shade: (th, y) => (y > 1.22 && A(th) < 0.16 ? 'shirt' : 'coat') },
      { kind: 'skirt', y0: 1.02, hem: 0.84, flare: [1.04, 1.08], back: 0.8, folds: 0.3, grow: 0.01, split: 0.22, shade: 'coat' },
      { kind: 'collar', style: 'band', h: 0.05, hFront: 0.04, open: 0.6, gap: 0.04, lean: 0.004, flareOut: 0.008, shade: 'shirt' },
      { kind: 'sleeves', r: 0.084, cuff: 0.07 },
      { kind: 'legs', r: 1.02, boot: true },
      { kind: 'shoes', style: 'boot' },
      { kind: 'hands', s: 1.04 },
    ],
    skin: { coat: o.jacket, shirt: o.shirt, hand: 0.022, skin: 0.03, cover: 0.013, peak: 0.01, trousers: 0.009, shoes: 0.004 },
    collider: o.body === BROAD ? 0.34 : 0.3,
  };
}

// ---- the police: a peaked cap with its badge, a long dark coat buttoned
// double down the front (two rows of light buttons), a pale belt, the
// badge's glint on the chest --------------------------------------------------------------------
function copCostume(name, { h = 1.84, body = BROAD, coat = 0.012 } = {}) {
  const buttons = (th, y) => {
    for (const r of [0.06, -0.06]) if (A(th - r) < 0.018 && y > 1.05 && y < 1.36 && A(((y - 1.06) / 0.075) % 1 - 0.5) > 0.36) return true;
    return false;
  };
  return {
    name, h, body,
    cover: { kind: 'none', hatDY: 0.125, hatDZ: 0.004, pitch: 0.08, s: 1 },
    garments: [
      { kind: 'torso', shade: (th, y) => {
        if (A(y - 1.02) < 0.024) return 0.32;                      // the belt
        if (y > 1.24 && y < 1.3 && th > 0.22 && th < 0.42) return 0.6;   // the badge, his left breast
        if (buttons(th, y)) return 0.4;
        return 'coat';
      } },
      { kind: 'skirt', y0: 1.0, hem: 0.44, split: 0.42, flare: [1.18, 1.26], back: 0.5, folds: 0.7, grow: 0.012, shade: 'coat' },
      { kind: 'collar', style: 'stand', h: 0.07, hFront: 0.06, open: 0.3, gap: 0.01, lean: 0.004, flareOut: 0.006, shade: 'coat' },
      { kind: 'sleeves', style: 'long', r: 0.088, cuff: 0.076 },
      { kind: 'legs', r: 1.04 },
      { kind: 'shoes' },
      { kind: 'hands', s: 1.04 },
      { kind: 'custom', build: (F, H) => copCap(F, H) },
    ],
    skin: { coat, hand: 0.022, skin: 0.03, cover: 0.01, band: 0.003, badge: 0.7, visor: 0.004, trousers: 0.008, shoes: 0.004 },
    collider: 0.34,
  };
}

// ---- the table of looks --------------------------------------------------------------------------
export const LOOKS = {};
const reg = (id, costume, info) => {
  costume.name = id;
  // (a part's shade function may name a skin shade - 'coat', 'shirt': the
  // tailor writes what it returns into the vertex colour, so the name is
  // made its grey here; a name left as it was printed NaN, a glowing coat)
  for (const g of costume.garments) {
    if (typeof g.shade !== 'function') continue;
    const f = g.shade, skin = costume.skin;
    g.shade = (...a) => { const v = f(...a); return typeof v === 'string' ? (skin[v] ?? 0.012) : v; };
  }
  if (!COSTUMES[id]) COSTUMES[id] = costume;
  LOOKS[id] = { kind: id, ...info };
};
for (const o of FEDORA_COATS) reg('o3_fedora_' + o.id, fedoraCostume(o, {}), { role: 'ped', sex: 'm', h: o.h, hat: 'fedora' });
for (const o of WOMEN) reg('o3_woman_' + o.id, womanCostume(o), { role: 'ped', sex: 'f', h: o.h, hat: 'cloche' });
// the Docks' gang: the long black coat, a white scarf, the fedora tipped down
reg('o3_docks_a', fedoraCostume({ hem: 0.34, coat: 0.009, brim: 0.18, scarf: 0.55, body: BROAD, h: 1.86, belt: true }, { gang: true }), { role: 'gang', gang: 'docks', h: 1.86 });
reg('o3_docks_b', fedoraCostume({ hem: 0.38, coat: 0.014, brim: 0.17, scarf: 0.5, body: MAN, h: 1.8 }, { gang: true }), { role: 'gang', gang: 'docks', h: 1.8 });
reg('o3_docks_c', fedoraCostume({ hem: 0.36, coat: 0.02, brim: 0.19, scarf: 0.62, body: MAN, h: 1.78 }, { gang: true }), { role: 'gang', gang: 'docks', h: 1.78 });
for (const o of CAPS) reg('o3_caps_' + o.id, capCostume(o), { role: 'gang', gang: 'tenements', h: o.h });
reg('o3_cop_a', copCostume('o3_cop_a'), { role: 'cop', h: 1.84 });
reg('o3_cop_b', copCostume('o3_cop_b', { h: 1.78, body: MAN, coat: 0.016 }), { role: 'cop', h: 1.78 });
reg('o3_cop_c', copCostume('o3_cop_c', { h: 1.88, body: BROAD, coat: 0.02 }), { role: 'cop', h: 1.88 });
// the detectives: a plain fedora and a long coat; the Tommy gun is theirs
reg('o3_tec_a', fedoraCostume({ hem: 0.4, coat: 0.03, brim: 0.17, scarf: null, body: BROAD, h: 1.84, belt: true }), { role: 'tec', h: 1.84 });
reg('o3_tec_b', fedoraCostume({ hem: 0.46, coat: 0.07, brim: 0.18, scarf: null, body: MAN, h: 1.8 }), { role: 'tec', h: 1.8 });
// the base's own people, walking the city too
for (const [id, info] of Object.entries({
  couple_him: { sex: 'm', h: 1.74, hat: 'bowler' }, couple_her: { sex: 'f', h: 1.64, hat: 'cloche' }, oldman: { sex: 'm', h: 1.66, hat: 'cap', old: true },
  docker: { sex: 'm', h: 1.82, hat: 'knit', work: true }, dockhand: { sex: 'm', h: 1.8, hat: 'cap', work: true }, tail_trucker: { sex: 'm', h: 1.8, hat: 'cap', work: true },
  victim: { sex: 'm', h: 1.74, hat: null },
})) if (COSTUMES[id]) LOOKS[id] = { kind: id, role: 'ped', ...info };

// the pedestrians' looks by district (weights): the Docks and the Yards
// working men, downtown the coats and the hats, the Hill the good coats
export const PED_LOOKS = {
  downtown: { o3_fedora_a: 3, o3_fedora_b: 3, o3_fedora_c: 2, o3_fedora_d: 2, o3_fedora_e: 2, o3_fedora_f: 1, o3_fedora_g: 2, o3_fedora_h: 2, o3_woman_a: 2, o3_woman_b: 2, o3_woman_c: 2, o3_woman_d: 2, couple_him: 2, couple_her: 1, oldman: 1, victim: 1 },
  tenements: { o3_fedora_a: 1, o3_fedora_c: 2, o3_fedora_e: 2, o3_fedora_h: 2, o3_woman_b: 2, o3_woman_c: 2, oldman: 3, dockhand: 2, tail_trucker: 2, docker: 1, couple_her: 1, victim: 1 },
  docks: { docker: 3, dockhand: 3, tail_trucker: 2, oldman: 1, o3_fedora_c: 1, o3_fedora_f: 1, o3_woman_b: 1 },
  yards: { tail_trucker: 3, dockhand: 2, docker: 1, oldman: 1, o3_fedora_e: 1 },
  hill: { o3_fedora_a: 2, o3_fedora_b: 2, o3_fedora_d: 2, o3_fedora_g: 2, o3_woman_a: 3, o3_woman_d: 2, o3_woman_c: 1, couple_him: 2, couple_her: 2 },
};
export const COP_LOOKS = ['o3_cop_a', 'o3_cop_b', 'o3_cop_c'];
export const TEC_LOOKS = ['o3_tec_a', 'o3_tec_b'];
export const GANG_LOOKS = { docks: ['o3_docks_a', 'o3_docks_b', 'o3_docks_c'], tenements: ['o3_caps_a', 'o3_caps_b', 'o3_caps_c'] };

// a seeded hash of numbers (0..1): the same seed and place, the same pick
export function hash(...n) {
  let h = 2166136261;
  for (const x of n) { h ^= Math.floor(x * 1000) | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return ((h >>> 0) % 100003) / 100003;
}
export function pickWeighted(table, u) {
  const E = Object.entries(table).filter(([k]) => LOOKS[k]);
  const tot = E.reduce((a, e) => a + e[1], 0);
  let x = u * tot;
  for (const [k, w] of E) { if ((x -= w) <= 0) return k; }
  return E[E.length - 1][0];
}
