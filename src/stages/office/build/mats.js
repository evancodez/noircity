import * as THREE from 'three';

// The office's materials (tone as the diner's, props/diner/kit.js: the
// room is lit by a dim ambient and by a few hard lights - the desk lamp,
// the street's light through the blind, the corridor's lamp; an albedo of
// ~0x40 prints near black in the ambient and pale in a pool). Each is
// tagged with the ink's interior surface class.
let MATS = null;
export function officeMats() {
  if (MATS) return MATS;
  const std = (name, color, roughness, surface, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
    m.name = 'office_' + name;
    m.userData.inkSurface = surface;
    return m;
  };
  const glow = (name, v, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), ...extra });
    m.name = 'office_' + name;
    m.userData.inkSurface = 'lit';
    return m;
  };
  MATS = {
    std, glow,
    plaster: std('plaster', 0x5a5a5a, 0.95, 'plaster'),
    plasterDark: std('plasterDark', 0x3a3a3a, 0.95, 'plaster'),
    ceil: std('ceil', 0x1e1e1e, 1.0, 'plaster'),
    wainscot: std('wainscot', 0x1a1a1a, 0.6, 'wood'),
    trim: std('trim', 0x121212, 0.5, 'wood'),
    boards: std('boards', 0x2a2a2a, 0.7, 'wood'),
    lino: std('lino', 0x303030, 0.45, 'lino'),
    door: std('door', 0x1c1c1c, 0.55, 'wood'),
    desk: std('desk', 0x1c1c1c, 0.5, 'wood'),
    deskTop: std('deskTop', 0x242424, 0.42, 'wood'),
    leather: std('leather', 0x101010, 0.7, 'cloth'),
    paper: std('paper', 0x9a9a9a, 0.95, 'plaster'),
    paperDim: std('paperDim', 0x6e6e6e, 0.95, 'plaster'),
    steel: std('steel', 0x1e1e1e, 0.35, 'metal'),
    steelLight: std('steelLight', 0x3a3a3a, 0.35, 'enamel'),
    iron: std('iron', 0x0c0c0c, 0.5, 'metal'),
    brass: std('brass', 0x2a2a2a, 0.3, 'metal'),
    cloth: std('cloth', 0x121212, 0.9, 'cloth'),
    coat: std('coat', 0x0c0c0c, 0.9, 'cloth'),
    blind: std('blind', 0x5c5c5c, 0.65, 'plaster'),
    brick: std('brick', 0x262626, 0.95, 'plaster'),
    stone: std('stone', 0x383838, 0.95, 'plaster'),
    asphalt: std('asphalt', 0x0a0a0a, 0.3, 'plaster'),
    black: std('black', 0x040404, 1.0, 'cloth'),
    glassDark: std('glassDark', 0x0a0a0a, 0.1, 'metal'),
    shade: std('shade', 0x0c0c0c, 0.35, 'enamel'),
    bulb: glow('bulb', 9),
    lampInner: glow('lampInner', 0.6, { side: THREE.DoubleSide }),
    lit: glow('lit', 1.4),
    litDim: glow('litDim', 0.35),
    litWin: glow('litWin', 1.1),
  };
  return MATS;
}
