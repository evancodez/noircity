// NOIR CITY: the plan (lane O1). The whole city as data a person can read and
// change: the districts, the streets, the el's loop, the river and its one
// bridge, the landmarks, the special grounds. Nothing here builds a mesh: the
// generator (src/world/cityGen.js) turns this into blocks, lots, kerbs,
// lamps and colliders; the graphs (src/world/graph.js) into lanes and
// pavements; the map (src/world/map.js) into ink.
//
// Frame: metres, y up, x east, z SOUTH (north is -z: a viewer's yaw 0 looks
// north). The city is about 1.2 km square: x and z from -600 to 600.
//
//   THE HILL (north)     big houses behind walls, the park and its bandstand,
//                        Bridge St out over the river to the far bank (shut)
//   THE YARDS (west)     the rail yard, the gasworks (the holders, the
//                        stacks), the long straight where the races run
//   DOWNTOWN (centre)    Grand Ave under the el's loop, the neon, the clock
//                        tower on Clock Square, Broadway's diagonal, the
//                        police headquarters, the bank, the hotel
//   THE TENEMENTS (east) narrow streets, dead ends, fire escapes, the el's
//                        stations on the Bowery
//   THE DOCKS (south)    warehouses, the quay, the piers, the cranes, the
//                        fish market
//   THE RIVER            east and south: the quay road along it, the water
//                        beyond (a car in it is a wreck); the far bank a
//                        silhouette (the stadium's lights, the wheel)
//
// To change the city: move a street's line or its segments, add a special
// ground, rename a street. Every street is a grid line (NS: an x, EW: a z)
// with the segments where it is a road; where a line has no segment the two
// cells beside it are one block. Two streets are not on the grid: Broadway
// (a diagonal, corner to corner through five cells) and the river road
// (along the quay, round the south-east bend).

export const PAVE = 0.15;          // the pavements' top (the road is 0)
export const WATER_Y = -2.1;       // the river's surface
export const CITY = { x0: -600, x1: 600, z0: -600, z1: 600 };
// the land's own edges: the rail embankment (west), the Hill's wall (north)
export const EDGE = { west: -590, north: -590 };

// street classes: half the carriageway (hw), the pavement each side (p)
export const CLS = {
  avenue: { hw: 9, p: 5 },
  wide: { hw: 7, p: 4 },
  el: { hw: 8, p: 4 },                // (the el's columns stand in it, 7.8 m apart: a lane each side of them)
  street: { hw: 5.5, p: 3.5 },
  lane: { hw: 3.5, p: 2 },
};

// ---- the districts (first match wins: a point is in the first whose rect holds it) -------
// rect: [x0, x1, z0, z1]. look: the facade kit the generator fills its lots from.
export const DISTRICTS = [
  { id: 'hill', name: 'THE HILL', rect: [-600, 600, -600, -300], kit: 'hill' },
  { id: 'yards', name: 'THE YARDS', rect: [-600, -300, -300, 600], kit: 'yards' },
  { id: 'docks', name: 'THE DOCKS', rect: [-300, 600, 240, 600], kit: 'docks' },
  { id: 'tenements', name: 'THE TENEMENTS', rect: [150, 600, -300, 240], kit: 'tenement' },
  { id: 'downtown', name: 'DOWNTOWN', rect: [-300, 150, -300, 240], kit: 'downtown' },
];
export function districtAt(x, z) {
  for (const d of DISTRICTS) { const [a, b, c, e] = d.rect; if (x >= a && x < b && z >= c && z < e) return d; }
  return DISTRICTS[DISTRICTS.length - 1];
}

// ---- the grid -------------------------------------------------------------------------
// north-south streets: x, its class, the z segments where it is a road
// (a segment's ends are other lines' z: a junction, or a dead end where the
// crossing line has no road)
export const NS = [
  { id: 'straight', x: -450, name: 'THE STRAIGHT', cls: 'wide', segs: [[-540, 432]], straight: true },
  { id: 'foundry', x: -370, name: 'FOUNDRY ST', cls: 'street', segs: [[-120, 432]] },
  { id: 'gasworks', x: -300, name: 'GASWORKS AVE', cls: 'wide', segs: [[-540, 432]] },
  { id: 'mercer', x: -210, name: 'MERCER ST', cls: 'street', segs: [[-540, 432]] },
  { id: 'grand', x: -120, name: 'GRAND AVE', cls: 'avenue', segs: [[-420, 432]], tram: true },
  { id: 'baxter', x: -30, name: 'BAXTER ST', cls: 'street', segs: [[-540, 432]] },
  { id: 'canal', x: 60, name: 'CANAL ST', cls: 'street', segs: [[-300, 432]] },
  { id: 'bowery', x: 150, name: 'THE BOWERY', cls: 'el', segs: [[-540, 432]] },
  { id: 'mott', x: 210, name: 'MOTT ST', cls: 'lane', segs: [[-300, 240]] },
  { id: 'orchard', x: 270, name: 'ORCHARD ST', cls: 'lane', segs: [[-300, -120], [-30, 330]] },
  { id: 'hester', x: 330, name: 'HESTER ST', cls: 'street', segs: [[-540, 330]] },
  { id: 'doyers', x: 390, name: 'DOYERS LN', cls: 'lane', segs: [[-300, -150]] },
];
// east-west streets: z, its class, the x segments
export const EW = [
  { id: 'hillrd', z: -540, name: 'HILL RD', cls: 'street', segs: [[-450, 432]] },
  { id: 'bridge', z: -420, name: 'BRIDGE ST', cls: 'wide', segs: [[-450, 432]] },
  { id: 'parkrow', z: -300, name: 'PARK ROW', cls: 'wide', segs: [[-450, 432]] },
  { id: 'bayard', z: -240, name: 'BAYARD LN', cls: 'lane', segs: [[150, 432]] },
  { id: 'market', z: -210, name: 'MARKET ST', cls: 'el', segs: [[-300, 150]] },
  { id: 'pell', z: -150, name: 'PELL LN', cls: 'lane', segs: [[150, 330]] },
  { id: 'clock', z: -120, name: 'CLOCK ST', cls: 'street', segs: [[-510, 432]] },
  { id: 'eldridge', z: -60, name: 'ELDRIDGE LN', cls: 'lane', segs: [[150, 270]] },
  { id: 'centre', z: -30, name: 'CENTRE ST', cls: 'wide', segs: [[-450, 432]] },
  { id: 'rivington', z: 30, name: 'RIVINGTON LN', cls: 'lane', segs: [[150, 432]] },
  { id: 'fifth', z: 60, name: 'FIFTH ST', cls: 'street', segs: [[-450, 150]] },
  { id: 'delancey', z: 120, name: 'DELANCEY LN', cls: 'lane', segs: [[150, 432]] },
  { id: 'houston', z: 150, name: 'HOUSTON ST', cls: 'el', segs: [[-450, 150]] },
  { id: 'water', z: 240, name: 'WATER ST', cls: 'street', segs: [[-450, 432]] },
  { id: 'dock', z: 330, name: 'DOCK RD', cls: 'wide', segs: [[-450, 330]] },
];
// the grid's own boundary lines (no road on them: the land's edges, the river road's line)
export const NS_EXTRA = [EDGE.west, -540, -510, 432];
export const EW_EXTRA = [EDGE.north, 432];

// Broadway: the diagonal, corner to corner through five cells (a six-way
// junction at each grid crossing on its line), from Gasworks Ave x Water St
// to the Bowery x Market St
export const BROADWAY = { id: 'broadway', name: 'BROADWAY', cls: 'wide', a: [-300, 240], b: [150, -210] };

// ---- the river and its road -------------------------------------------------------------
// the river road's centre line (south from the Hill along the east quay, round
// the bend, west along the south quay to the rail yard), its class, and the
// quay: the pavement past its outer kerb to the water's edge
export const RIVER = {
  hw: 6, pIn: 3.5, quay: 14,           // carriageway half width, the city side's pavement, the quay (kerb to edge)
  // the centre line's corners: the bend is an arc about (300, 300)
  n: -560, e: 432, s: 432, w: -560, bend: { cx: 300, cz: 300 },
  name: 'RIVER RD',
};
// the river road's centre line, sampled (north end -> bend -> west end)
export const RIVER_LINE = (() => {
  const P = [];
  const { e, s, bend } = RIVER, R = e - bend.cx;
  for (let z = RIVER.n; z < bend.cz; z += 20) P.push([e, z]);
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * (Math.PI / 2); P.push([bend.cx + Math.cos(a) * R, bend.cz + Math.sin(a) * R]); }
  for (let x = bend.cx - 20; x >= RIVER.w; x -= 20) P.push([x, s]);
  return P;
})();
// the water's edge (the quay's face): the road's line pushed out by hw + quay
export const QUAY_OFF = RIVER.hw + RIVER.quay;
// piers into the river off the south quay (x centre, width, length past the
// quay's edge) and the slipways (a ramp down into the water: no railing)
export const PIERS = [
  { x: -240, w: 18, len: 70, name: 'PIER 3' },
  { x: -90, w: 18, len: 80, name: 'PIER 5' },
  { x: 90, w: 22, len: 90, name: 'PIER 7', office: true },
  { x: 230, w: 18, len: 60, name: 'PIER 9' },
];
export const SLIPS = [{ x: -400, w: 8 }, { x: 0, w: 8 }];
// the one bridge: Bridge St out over the river to the far bank, where the
// road is shut (a toll barrier, a lorry across it)
export const BRIDGE = { z: -420, x0: 432, x1: 610, hw: 7, foot: 2.5, deckY: 0, barrier: 596, name: 'THE BRIDGE' };
// the far bank (a silhouette, not a place)
export const FAR_BANK = { east: 610, south: 610 };

// ---- the el's loop ---------------------------------------------------------------------
// over Grand Ave, Market St, the Bowery and Houston St, its corners arcs of
// radius R over the corner lots (no building under them); its stations
export const EL = {
  x0: -120, x1: 150, z0: -210, z1: 150, R: 26, deckY: 9.5, hw: 3.9,
  stations: [
    { name: 'BOWERY - CLOCK', side: 'e', at: -120 },
    { name: 'BOWERY - FIFTH', side: 'e', at: 60 },
    { name: 'GRAND - CENTRE', side: 'w', at: -30 },
  ],
};

// ---- the special grounds (no street-front lots: their own builders) ---------------------
// rect: [x0, x1, z0, z1] in grid lines; the cells inside are theirs.
//   flush: at road level (no kerb), else raised like a block
export const SPECIAL = [
  { id: 'railyard', kind: 'railyard', name: 'THE RAIL YARD', rect: [-590, -510, -540, 432], flush: true, gate: { z: -120, w: 12 } },
  { id: 'gasworks', kind: 'gasworks', name: 'THE GASWORKS', rect: [-450, -300, -300, -120] },
  { id: 'park', kind: 'park', name: 'THE PARK', rect: [-210, -30, -540, -420] },
  { id: 'fishmarket', kind: 'market', name: 'FISH MARKET', rect: [-30, 60, 330, 432] },
  { id: 'marketHall', kind: 'hall', name: 'MARKET HALL', rect: [270, 330, -30, 30] },
];
// Clock Square: the north-west half of the cell Broadway cuts between Baxter,
// Canal St, Clock St and Centre St, a paved plaza with the tower at its middle
export const CLOCK = { x: 0, z: -90, h: 58, name: 'CLOCK SQUARE', cell: [-30, 60, -120, -30], half: 'nw' };
// the gasworks' holders and stacks (their ground is the gasworks' special)
export const GASWORKS = {
  holders: [{ x: -415, z: -255, r: 22, h: 34 }, { x: -340, z: -255, r: 18, h: 28 }, { x: -415, z: -170, r: 16, h: 24 }],
  stacks: [{ x: -340, z: -160, r: 2.6, h: 62 }, { x: -322, z: -175, r: 2.2, h: 54 }],
};
// the park: its bandstand, its paths' lamps (the generator lays the paths)
export const PARK = { bandstand: { x: -120, z: -480, r: 7 } };
// the docks' cranes on the quay (x along the south quay)
export const CRANES = [{ x: -330 }, { x: -160 }, { x: 20 }, { x: 160 }];
// across the water: the stadium's lights (east), the fairground's wheel
// (south-east), the far bank's warehouses
export const STADIUM = { x: 820, z: -150, r: 90 };
export const WHEEL = { x: 520, z: 780, r: 28 };

// ---- the named places (the lots the facade kits dress as themselves; O5's doors) ---------
// at: a point on the street front the lot must hold; kind: the facade's
export const PLACES = [
  { id: 'police', name: 'POLICE HEADQUARTERS', kind: 'police', at: [-75, -36], district: 'downtown' },
  { id: 'bank', name: 'FIRST CITY BANK', kind: 'bank', at: [-112, -200], district: 'downtown' },
  { id: 'hotel', name: 'HOTEL CARLTON', kind: 'hotel', at: [-129, 80], district: 'downtown' },
  { id: 'store', name: 'BAUMANN & SONS', kind: 'store', at: [-129, -110], district: 'downtown' },
  { id: 'theatre1', name: 'THE ORPHEUM', kind: 'theatre', at: [-129, 20], district: 'downtown' },
  { id: 'theatre2', name: 'THE BIJOU', kind: 'theatre', at: [-111, -60], district: 'downtown' },
  { id: 'diner', name: 'DINER', kind: 'diner', at: [-38, 100], district: 'downtown' },
  { id: 'gym', name: 'BOXING', kind: 'gym', at: [258, 60], district: 'tenements' },
  { id: 'bar1', name: 'BAR', kind: 'bar', at: [205, -120], district: 'tenements' },
  { id: 'bar2', name: 'BAR', kind: 'bar', at: [-15, 330], district: 'docks' },
  { id: 'gunshop', name: 'GUNS', kind: 'shop', at: [325, -30], district: 'tenements' },
  { id: 'garage', name: 'GARAGE', kind: 'garage', at: [-441, 60], district: 'yards' },
  { id: 'station', name: 'POLICE', kind: 'station', at: [300, -112], district: 'tenements' },
];

// ---- the starts (?start=city&at=<id>): a car at the kerb, me beside it ------------------
// car: where its middle stands and its heading (a car's rotation.y: 0 east, PI/2 north)
export const STARTS = {
  grand: { name: 'Grand Ave', car: { x: -112.2, z: 30, yaw: Math.PI / 2 } },
  clock: { name: 'Clock Square', car: { x: 25, z: -115.6, yaw: 0 } },
  tenements: { name: 'the Tenements', car: { x: 272.4, z: 80, yaw: Math.PI / 2 } },
  docks: { name: 'the Docks', car: { x: -100, z: 324.4, yaw: Math.PI } },
  yards: { name: 'the Yards', car: { x: -444.2, z: 0, yaw: Math.PI / 2 } },
  hill: { name: 'the Hill', car: { x: -100, z: -414.3, yaw: 0 } },
  gasworks: { name: 'the Gasworks', car: { x: -294.2, z: -200, yaw: Math.PI / 2 } },
  bridge: { name: 'the Bridge', car: { x: 470, z: -416, yaw: 0 } },
  river: { name: 'the river road', car: { x: 427.3, z: -100, yaw: -Math.PI / 2 } },
  park: { name: 'the Park', car: { x: -205.7, z: -470, yaw: Math.PI / 2 } },
};
export const START_DEFAULT = 'grand';
