import * as THREE from 'three';

// The interiors' materials (lane O5): the ink's three greys and its black,
// made once a stage and shared by every room (the city's own kinds of
// material: no new program at a door). Each carries its interior surface
// class (userData.inkSurface, render/shaders/idpass.js: the ink prints a
// room's plaster, wood, cloth calm - flat washes that follow the light; a
// lit panel its own flat light). Tone is albedo (the diner's rule,
// props/diner/kit.js: sRGB 0x18 prints black, 0x28..0x40 dark-grey washes),
// plus the pools of the room's lamps (paper white where a pool falls).
//   plaster   the walls             paper     a pale wall (the hotel's, the lobby's)
//   boards    the floor's planks    tile      the diner's, the station's lino
//   concrete  the garage's, the warehouse's, the stairwells'
//   canvas    the ring's floor (the palest thing in the gym)
//   wood      the furniture         woodHi    a counter's polished top
//   leather   seats, the bags       cloth     a bed, a curtain    linen  sheets, towels
//   iron, chrome, glass, black, bulb
//   lit       a lit panel (a back bar's glass, a lit window, a hatch)  litDim  a dimmer one
//   screen    the theatre's screen
export function interiorMats(stage) {
  if (stage._o5mats) return stage._o5mats;
  const M = stage.M;
  const env = M.envSoft;
  const std = (surf, o) => { const m = new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.15, metalness: 0, ...o }); m.userData.inkSurface = surf; m.name = 'o5_' + surf; return m; };
  const lit = (v, o = {}) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(v), ...o }); m.userData.inkSurface = 'lit'; m.name = 'o5_lit'; return m; };
  const X = {
    plaster: std('plaster', { color: 0x262626, roughness: 0.95 }),
    paper: std('plaster', { color: 0x3a3a38, roughness: 0.95 }),
    dark: std('plaster', { color: 0x101010, roughness: 0.95 }),
    boards: std('wood', { color: 0x1c1c1c, roughness: 0.6, envMapIntensity: 0.3 }),
    tile: std('lino', { color: 0x2e2e2e, roughness: 0.3, envMapIntensity: 0.45 }),
    // [O5b] the hospital's pale lino (where a pool of light lands white) and its stone front
    lino: std('lino', { color: 0x4e4e4c, roughness: 0.32, envMapIntensity: 0.4 }),
    stone: std('plaster', { color: 0x4a4a47, roughness: 0.9 }),
    concrete: std('plaster', { color: 0x1d1d1d, roughness: 0.92 }),
    canvas: std('cloth', { color: 0x4a4a48, roughness: 1.0, envMapIntensity: 0 }),
    wood: std('wood', { color: 0x141414, roughness: 0.62, envMapIntensity: 0.2 }),
    woodHi: std('enamel', { color: 0x222222, roughness: 0.38, envMapIntensity: 0.5 }),
    leather: std('leather', { color: 0x0c0c0c, roughness: 0.55, envMapIntensity: 0.4 }),
    cloth: std('cloth', { color: 0x161616, roughness: 1.0, envMapIntensity: 0, side: THREE.DoubleSide }),
    linen: std('cloth', { color: 0x585856, roughness: 1.0, envMapIntensity: 0 }),
    rope: std('cloth', { color: 0x5e5e5c, roughness: 0.9 }),
    iron: std('metal', { color: 0x0c0c0c, roughness: 0.5, metalness: 0.35, envMapIntensity: 0.5 }),
    lampIron: std('metal', { color: 0x0d0d0d, roughness: 0.35, metalness: 0.7, envMapIntensity: 0.6 }),
    chrome: std('chrome', { color: 0x8a8a8a, roughness: 0.18, metalness: 1.0, envMapIntensity: 1.0 }),
    glass: std('metal', { color: 0x060606, roughness: 0.06, metalness: 0.8, envMapIntensity: 1.4 }),
    poster: std('plaster', { color: 0x5c5c58, roughness: 1.0, envMapIntensity: 0 }),
    black: M.black,
    bulb: M.bulb,
    lit: lit(1.0),
    litDim: lit(0.34),
    screen: lit(1.25),
  };
  stage._o5mats = X;
  return X;
}
