import { lose } from './money.js';

// [O4] Where a fall in the city ends (docs/briefs/O4_COMBAT.md §2, OPEN_WORLD
// §3): the kit's fail is the fall and the black; what comes up out of it is
// the city's - the hospital after a gunfight or a fist fight lost to anyone
// but the police, the station after the police got me.
//   wake(G, 'hospital' | 'station') -> { line, cost }   the rules (the guns kept
//        at both, the user's rule; the money less a little, at the station less more) - the place (lane O5's door, lane O3's station)
//        puts me there and says the line
//   fallTo(kind)  the spec a fight's onDown gives the kit: { why, to }
// The hospital's stitches: a tenth of what I have, $5 at least (if I have it).
export const FALL = { hospital: { frac: 0.1, min: 5 }, station: { frac: 0.2, min: 10 } };

export function wake(G, where = 'hospital') {
  const R = FALL[where] || FALL.hospital;
  const cost = lose(G, R.frac, R.min, where);
  let line;
  if (where === 'station') {
    // [manager, the user's rule 2026-10-23 (O4b's brief, OPEN_WORLD §3): "I don't want my gun taken away
    // when arrested" - every gun I carry and its rounds stay mine; the fine is the station's answer]
    if (G.player.weapons.current && G.player.weapons.current !== 'fists') G.player.weapons.equip('fists');
    line = cost ? `The station. A $${cost} fine.` : 'The station. Released.';
  } else line = cost ? `The hospital. $${cost} for the stitches.` : 'The hospital. Stitched up.';
  G.emit('fall:wake', { where, cost });
  return { line, cost };
}

// a fight's onDown: the black's words, and the beat (the place's) to wake in
export function fallTo(why, where = 'hospital', beat = null) { return { why, to: beat || where }; }
