import { NS, EW, districtAt } from './plan.js';

// NOIR CITY: every street its own (lane O1b, brief docs/briefs/O1B_STREETS.md
// §1, the user after his first drive: "make things look a bit more distinct
// from street to street"). Each street of the plan has a CHARACTER the
// generator (cityGen.js furnish, world/dressing.js) and the kits
// (city/kits/facade.js, city/kits/dress.js) read:
//   mat     its facades: 'brick' (dark), 'stone' (grey), 'pale' (limestone),
//           'iron' (cast-iron fronts: pilasters), 'tile' (a glazed ground
//           floor), 'timber' (boarded sheds)
//   win     its window heads: 'lintel' 'hood' 'arch' 'plain'
//   lamp    its lamp: 'goose' (the gooseneck), 'globe' (a fluted post, a glass
//           ball), 'bracket' (a lantern on an iron arm from the wall), 'hung'
//           (a shade on a wire across the lane), 'dish' (a timber pole with
//           an enamel dish)
//   trades  what its shops sell (a lettered board over each, something
//           behind the lit glass: city/kits/dress.js TRADES)
//   letter  its boards' lettering: 'deco' 'serif' 'script' 'block' 'stencil'
//   awning  its awnings' canvas: 'stripe' 'pin' 'pale' 'dark' 'scallop', and
//           how many shop fronts have one (awnK)
//   trees   'plane' 'bare' 'poplar' 'elm' or none, every treeStep m
//   props   its furniture by rule, each a density 0..1 (world/dressing.js)
//   unique  the one thing mid-block that is only there
//   red     the chance a neon blade over its shops burns red (one in ten)
//   accent  [O1b] after the critic (M2: seven streets of ten under 0.1 % colour):
//           the one colour a driver sees down this street - { col: 'red' |
//           'blue' | 'amber', every: m } - blades over its shop fronts (or its
//           bars' doors) every so many metres a side (stages/noircity/parts/
//           places.js); the Docks', the Yards' and the Hill's by their own
//           things (a bar's red blade, lit amber names on the sheds, amber
//           lanterns on the gates)
//   wash    [O1b] (M6: the Tenements' lanes alike) the share of its laundry
//           lines kept (1: all of them; the bakers' lane and Doyers none)
// A street that crosses districts is read with its district's kit (the
// massing, the roofline): the character is the street's, the kit the ground's.
// Nothing copy-paste: every prop, tree, board and display picks its variant
// by a seeded hash of where it stands (vhash), so no two corners read alike.

// a seeded hash of a place (and a salt): 0 .. 1
export function vhash(x, z, salt = 0) {
  let h = Math.imul(Math.round(x * 4) + 0x632BE5AB, 0x85EBCA6B) ^ Math.imul(Math.round(z * 4) + 0x1B873593, 0xC2B2AE35) ^ Math.imul(salt + 0x165667B1, 0x27D4EB2F);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
export const vpick = (list, x, z, salt = 0) => list[Math.floor(vhash(x, z, salt) * list.length) % list.length];

// the districts' own (a street not in the table, and the base under every street's)
const BASE = {
  downtown: { mat: 'stone', win: 'hood', lamp: 'goose', trades: ['tailor', 'jeweler', 'shoes', 'hats', 'radio', 'books', 'cafe', 'drugs'], letter: 'deco', awning: 'stripe', awnK: 0.3, trees: null, props: { mailbox: 0.5, booth: 0.4, board: 0.4, bike: 0.1, bin: 0.3 }, red: 0.1, accent: { col: 'blue', every: 50 } },
  tenement: { mat: 'brick', win: 'arch', lamp: 'bracket', trades: ['grocer', 'butcher', 'barber', 'laundry', 'deli', 'pawn', 'shoes', 'chopsuey'], letter: 'serif', awning: 'pin', awnK: 0.45, trees: null, props: { crate: 0.5, barrel: 0.4, churn: 0.3, bin: 0.6, bike: 0.35, board: 0.3, fruit: 0.3, rainbarrel: 0.2 }, red: 0.12, accent: { col: 'red', every: 40 } },
  docks: { mat: 'brick', win: 'lintel', lamp: 'dish', trades: ['chandler', 'hardware', 'cafe'], letter: 'stencil', awning: 'dark', awnK: 0.1, trees: null, props: { crate: 0.9, barrel: 0.8, cart: 0.5, drum: 0.3, bin: 0.3 }, red: 0, accent: { col: 'red', every: 50 } },
  yards: { mat: 'timber', win: 'plain', lamp: 'dish', trades: ['hardware'], letter: 'stencil', awning: null, awnK: 0, trees: null, props: { drum: 0.7, rainbarrel: 0.6, crate: 0.4, cart: 0.3, bin: 0.2 }, red: 0, accent: { col: 'amber', every: 40 } },
  hill: { mat: 'pale', win: 'hood', lamp: 'globe', trades: [], letter: 'serif', awning: null, awnK: 0, trees: 'bare', treeStep: 26, props: { mailbox: 0.4, booth: 0.15 }, red: 0, accent: { col: 'amber', every: 0 } },
};

// the streets' own (over their district's): what a man remembers each by
export const STREETS = {
  // ---- downtown
  grand: { look: 'the el and the tram over stone; the tailors and the jewelers; the hotel\'s canopy', mat: 'stone', win: 'hood', lamp: 'goose', trades: ['tailor', 'jeweler', 'hats', 'shoes', 'radio'], letter: 'deco', awning: 'stripe', awnK: 0.35, unique: 'canopy', red: 0.12, accent: { col: 'blue', every: 70 } },
  centre: { look: 'the wide street of pale limestone and plane trees; globe lamps; the newspaper\'s lit board', mat: 'pale', win: 'hood', lamp: 'globe', trades: ['books', 'drugs', 'cafe', 'jeweler', 'tailor'], letter: 'serif', awning: 'pale', awnK: 0.25, trees: 'plane', treeStep: 22, unique: 'paper', red: 0.06, accent: { col: 'blue', every: 45 } },
  broadway: { look: 'the diagonal: flatirons, the billboards, the cinema\'s bulbs', mat: 'iron', win: 'plain', lamp: 'goose', trades: ['radio', 'cafe', 'hats', 'shoes', 'cigars'], letter: 'block', awning: 'stripe', awnK: 0.3, unique: 'cinema', red: 0.2, accent: { col: 'amber', every: 45 } },
  clock: { look: 'the clockmakers\' street: brick and iron fronts, a lit street clock, bracket lanterns', mat: 'brick', win: 'lintel', lamp: 'bracket', trades: ['jeweler', 'books', 'tobacco', 'radio'], letter: 'script', awning: 'scallop', awnK: 0.3, unique: 'clock', red: 0.1, accent: { col: 'amber', every: 40 } },
  baxter: { look: 'the firehouse\'s red doors; iron fronts; goosenecks', mat: 'iron', win: 'plain', lamp: 'goose', trades: ['hardware', 'shoes', 'deli', 'cafe'], letter: 'block', awning: 'dark', awnK: 0.25, unique: 'firehouse', props: { mailbox: 0.5, booth: 0.4, bin: 0.4, bike: 0.2, board: 0.3 }, accent: { col: 'red', every: 55 } },
  canal: { look: 'tiled lunchrooms and the bathhouse; poplars in tubs', mat: 'tile', win: 'lintel', lamp: 'globe', trades: ['cafe', 'deli', 'drugs', 'laundry'], letter: 'deco', awning: 'pin', awnK: 0.35, trees: 'poplar', treeStep: 30, unique: 'baths', red: 0.1, accent: { col: 'blue', every: 40 } },
  mercer: { look: 'the church on the corner of the city; dark brick and bare trees', mat: 'brick', win: 'arch', lamp: 'goose', trades: ['books', 'tailor', 'florist'], letter: 'serif', awning: 'dark', awnK: 0.2, trees: 'bare', treeStep: 28, unique: 'church', red: 0, accent: { col: 'amber', every: 50 } },
  fifth: { look: 'the dance hall and the florists; striped awnings under plane trees', mat: 'stone', win: 'hood', lamp: 'globe', trades: ['florist', 'cafe', 'hats', 'shoes'], letter: 'script', awning: 'stripe', awnK: 0.5, trees: 'plane', treeStep: 26, unique: 'ballroom', red: 0.15, accent: { col: 'red', every: 45 } },
  market: { look: 'under the el: the bank\'s columns, pawn and radio shops', mat: 'stone', win: 'lintel', lamp: 'goose', trades: ['pawn', 'radio', 'hardware', 'shoes'], letter: 'block', awning: 'dark', awnK: 0.2, unique: 'columns', red: 0.1, accent: { col: 'blue', every: 45 } },
  houston: { look: 'under the el: the missions and the flophouses, the red JESUS SAVES', mat: 'brick', win: 'lintel', lamp: 'goose', trades: ['pawn', 'barber', 'chopsuey', 'tobacco'], letter: 'block', awning: 'pin', awnK: 0.3, unique: 'mission', red: 0.15, accent: { col: 'red', every: 45 } },
  water: { look: 'between the docks and the town: the ship chandlers, the seamen\'s hall', mat: 'brick', win: 'lintel', lamp: 'bracket', trades: ['chandler', 'cafe', 'pawn', 'hardware'], letter: 'stencil', awning: 'dark', awnK: 0.2, unique: 'seamen', props: { crate: 0.5, barrel: 0.5, bin: 0.3, cart: 0.2, board: 0.2 }, accent: { col: 'amber', every: 40 } },
  // ---- the tenements
  bowery: { look: 'under the el: the pawnshops\' three balls, the red neon, the station stairs', mat: 'brick', win: 'arch', lamp: 'goose', trades: ['pawn', 'barber', 'shoes', 'deli', 'chopsuey'], letter: 'block', awning: 'pin', awnK: 0.35, unique: 'balls', red: 0.25, accent: { col: 'red', every: 32 } },
  hester: { look: 'the market street: the church of red brick, the fruit stands, bracket lanterns', mat: 'brick', win: 'arch', lamp: 'bracket', trades: ['grocer', 'butcher', 'florist', 'deli'], letter: 'serif', awning: 'stripe', awnK: 0.55, unique: 'steeple', props: { fruit: 0.8, crate: 0.6, barrel: 0.3, churn: 0.4, bin: 0.5, bike: 0.3, board: 0.4 }, accent: { col: 'amber', every: 40 } },
  // [O1c] (Mott and Orchard side by side read as one lane: Mott is grey stone with flat
  // lintels and lanterns on brackets, its trades the barbers' and the tobacconists'; Orchard
  // keeps its brick arches, the wires' hung lamps and the pushcarts)
  mott: { look: 'the barbers\' lane: grey stone and flat lintels, lanterns on brackets, washing, a striped pole', mat: 'stone', win: 'lintel', lamp: 'bracket', trades: ['barber', 'laundry', 'chopsuey', 'tobacco'], letter: 'script', awning: 'pin', awnK: 0.4, unique: 'barber', accent: { col: 'blue', every: 30 }, wash: 0.5 },
  orchard: { look: 'the pushcart lane: hung lamps, crates and churns, the cellar bar\'s amber window', lamp: 'hung', trades: ['grocer', 'butcher', 'shoes', 'deli'], letter: 'serif', awning: 'stripe', awnK: 0.5, unique: 'cellar', props: { crate: 0.8, barrel: 0.5, churn: 0.6, bin: 0.6, bike: 0.4, fruit: 0.5, cart: 0.4 }, accent: { col: 'amber', every: 35 }, wash: 0.5 },
  doyers: { look: 'the crooked dead end: chop suey and the laundry\'s steam', lamp: 'hung', trades: ['chopsuey', 'laundry', 'tobacco'], letter: 'block', awning: 'pin', awnK: 0.4, unique: 'chinese', red: 0.3, wash: 0 },
  pell: { look: 'the laundries\' lane: steam out of the vents, wash on the lines', lamp: 'hung', trades: ['laundry', 'tailor', 'barber'], letter: 'script', awning: 'pale', awnK: 0.3, unique: 'steamvent', accent: { col: 'amber', every: 35 }, wash: 1 },
  bayard: { look: 'the poultry lane: crates of birds, rain barrels, bracket lamps', lamp: 'bracket', trades: ['butcher', 'grocer', 'hardware'], letter: 'stencil', awning: 'dark', awnK: 0.3, unique: 'poultry', props: { crate: 0.9, barrel: 0.4, rainbarrel: 0.5, bin: 0.6, churn: 0.3 }, accent: { col: 'red', every: 35 }, wash: 0.35 },
  // [O1c] (Eldridge and Pell, the two lanes off the Bowery, both hung lamps on brick: Eldridge's grey stone and brackets)
  eldridge: { look: 'the short dead end of grey stone: the yard gate, the bracket lanterns, the water tower over the roofs', mat: 'stone', win: 'lintel', lamp: 'bracket', trades: ['grocer', 'shoes'], letter: 'serif', awning: 'pin', awnK: 0.3, unique: 'gate', accent: { col: 'blue', every: 35 }, wash: 0.8 },
  rivington: { look: 'the bakers\' lane: the oven\'s glow at the cellar grating, flour sacks', lamp: 'bracket', trades: ['deli', 'grocer', 'barber'], letter: 'serif', awning: 'stripe', awnK: 0.45, unique: 'bakery', accent: { col: 'amber', every: 30 }, wash: 0 },
  delancey: { look: 'the bicycle lane: bikes against every wall, the cycle shop', lamp: 'hung', trades: ['hardware', 'shoes', 'radio'], letter: 'block', awning: 'pin', awnK: 0.35, unique: 'cycles', props: { bike: 0.9, crate: 0.4, bin: 0.5, barrel: 0.2, churn: 0.2 }, accent: { col: 'blue', every: 35 }, wash: 0.3 },
  // ---- the docks
  dock: { look: 'the wide road of the warehouses: dish lamps on timber poles, barrels and carts, the yard\'s gate', mat: 'brick', win: 'lintel', lamp: 'dish', trades: ['chandler', 'cafe'], letter: 'stencil', unique: 'yardgate', accent: { col: 'red', every: 50 } },
  river: { look: 'the quay road: the railing, the water, the lamps on the river side', lamp: 'goose', accent: { col: 'red', every: 60 } },
  // ---- the yards
  straight: { look: 'the long straight: telegraph poles, the water tower, the sheds\' teeth', mat: 'timber', lamp: 'dish', unique: 'watertower', accent: { col: 'amber', every: 40 } },
  foundry: { look: 'the foundry street: oil drums, the stack, the billboard on the roofs', mat: 'brick', lamp: 'dish', unique: 'billboard', accent: { col: 'amber', every: 40 } },
  gasworks: { look: 'the gasworks\' avenue: the holders behind the fence, the dish lamps', mat: 'brick', lamp: 'dish', unique: 'gasboard', accent: { col: 'amber', every: 40 } },
  // ---- the hill
  hillrd: { look: 'the top of the hill: the long walls, the winter trees, the globes; the curving lane up to the big houses', lamp: 'globe', trees: 'bare', treeStep: 24, unique: 'lane', accent: { col: 'amber', every: 0 } },
  bridge: { look: 'Bridge St: the walls and gates, bare trees, the curving lane\'s mouth, the bridge\'s lanterns ahead', lamp: 'globe', trees: 'bare', treeStep: 30, accent: { col: 'amber', every: 0 } },
  parkrow: { look: 'Park Row: the park\'s railing, the poplars, the globe lamps', mat: 'pale', lamp: 'globe', trees: 'poplar', treeStep: 24, trades: ['florist', 'books', 'cafe'], letter: 'script', awning: 'pale', awnK: 0.3, unique: 'fountain', accent: { col: 'amber', every: 45 } },
};

// a street's character in a district (the district's base, the street's own over it)
const CACHE = new Map();
export function character(streetId, district) {
  const k = streetId + '|' + district;
  if (CACHE.has(k)) return CACHE.get(k);
  const kit = district === 'tenements' ? 'tenement' : district;
  const B = BASE[kit] || BASE.downtown, S = STREETS[streetId] || {};
  // (a street of the old town crossing the yards or the hill keeps the ground's lamp unless its own is the yards' or the hill's)
  const out = { ...B, ...S, props: { ...B.props, ...(S.props || {}) }, id: streetId, district };
  if ((kit === 'hill' || kit === 'yards' || kit === 'docks') && S.lamp && S.lamp !== B.lamp && !['hillrd', 'bridge', 'parkrow', 'dock', 'straight', 'foundry', 'gasworks', 'river', 'water'].includes(streetId)) out.lamp = B.lamp;
  if (kit === 'hill' && !['parkrow'].includes(streetId)) { out.trades = []; out.awning = null; }
  if (kit === 'yards' || kit === 'docks') { out.trees = S.trees && ['straight', 'dock'].includes(streetId) ? S.trees : null; }
  CACHE.set(k, out);
  return out;
}
// the character of a point on a street (its district there)
export function characterAt(streetId, x, z) { return character(streetId, districtAt(x, z).id); }
// the street ids (for the report and the blind test)
export const STREET_IDS = [...NS.map((l) => l.id), ...EW.map((l) => l.id), 'broadway', 'river'];
