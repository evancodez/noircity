import { makeBrain } from '../enemies/HoodBrains.js';
import { buildProp } from '../props/index.js';

// [O8] One cast, every system (docs/briefs/O8_FIGURES.md §3): a man of the
// cast who draws stays the man he was. His own figure (a Character of the
// stage's cast) is handed to the gun kit - its gunman brain (the raise, the
// glint, the settle, cover, flanks: docs/story/seams/GUNS.md) steps him from
// here on - and the revolver comes out into his fist; no new man is made
// in his place (the figure no longer changes as he draws). O3's copGuns.arm
// does the same for a Person of the street; this is the seam for the rest
// (the bounty's wanted man, a room's man).
//   armFigure(game, kit, character, { kind: 'pistol' | 'tommy', hp, cover }) -> the figure
export function armFigure(G, K, c, { kind = 'pistol', hp = 100, cover = true } = {}) {
  const h = c.fig;
  // (out of the cast's own list: the gun kit's men are stepped as the stage's Hoods)
  const L = c.cast && c.cast.list, i = L ? L.indexOf(c) : -1;
  if (i >= 0) L.splice(i, 1);
  c.lookAt(null);
  if (h.anim && h.anim.setOverlay) h.anim.setOverlay(null, 0.1);
  h.hp = hp; h.heavy = kind !== 'pistol'; h.gunKind = kind; h.turnSafe = true;
  h.surface = (x, z) => G.stage.surfaceY(x, z);
  G.stage.hoods.list.push(h);
  G.counters.spawned++;
  const B = makeBrain(G, h, 'gunman', { kind, heavy: kind !== 'pistol', wait: 0.4, cover });
  G.ais.set(h, B);
  h.onMove = (hh) => K.resolveMan(hh);
  if (B) B.kit = K;
  if (kind === 'tommy') { h.addTommy(); if (h.tommy) { h.tommy.userData.inkId = h.inkId; h.tommy.userData.inkFigure = true; } }
  else {
    const gun = buildProp('revolver');
    gun.traverse((o) => { if (o.isMesh) { o.userData.inkId = h.inkId; o.userData.inkFigure = true; o.userData.noRay = true; } });
    try { c.hold(gun, 'R'); } catch (e) { h.bones.handR.add(gun); }
  }
  return h;
}
