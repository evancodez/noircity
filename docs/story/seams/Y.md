# Wave B seams, the world's side (Builder Y)

A lane adds a file; it never edits a shared one. Every folder below is read
with `import.meta.glob` (eager, in path order); a name defined twice (in two
files, or in a file and the built-ins) throws at load, so a clash shows at
once. Nothing here changes what the game does without a file.

---------------------------------------------------------------------------
## Y1. Cast kinds: `src/cast/kinds/*.js`

```js
export default {
  kind,              // the name cast.spawn(kind) takes; not one of the built-ins
  h,                 // height, metres (the top of the head cover)
  name?,             // the Character's name ('mack' style); default the kind
  costume,           // a costume as src/cast/costumes.js writes them (body, cover,
                     //   garments, skin, collider; h and name default to the kind's)
  clips?: { name: { duration, marks?, loop?, hold?, state?, then?,
                    def(ctx, arg) -> { pose(t), armSpace?, rootMotion?, fps? } } },
  idle?: 'clipName', // played as his 'idle' (a clip of this file or a built-in one)
  onSpawn?(c, fig, cast),   // after the Character is made (props on him, extras)
};
```

- `costume` goes into `COSTUMES` (costumes.js), the kind into `KINDS`
  (Cast.js), each clip's timing into `CAST_CLIPS` (so `c.play`, `c.setState`,
  `c.clip(name).marks` work) and its poses into the clip bank (castAnim.js
  `DEFS`, baked per costume the first time it is played). `ctx` is
  `{ kind, costume, rig, s }`; `arg` is what follows `@` in a seat clip's name.
  A pose is castAnim's: `mergePose(NEUTRAL, { chest: [p, y, r], handTR: [x, y, z], ... })`.
- Clip names are global (every kind's bank knows every clip): prefix them
  with the kind.
- A kind file may import `tailor.js`, `enemies/HoodRig.js`, `enemies/HoodAnim.js`,
  never Cast / Character / Figure / castAnim / costumes (it is read before them).
- `cast.has(kind)` -> true for the built-ins and the files' kinds.

```js
import { NEUTRAL, mergePose } from '../../enemies/HoodRig.js';
export default { kind: 'clerk', h: 1.72, costume: CLERK,   // CLERK: a costume, as in costumes.js
  clips: { clerk_nod: { duration: 2, loop: true, def: () => ({ pose: (t) => mergePose(NEUTRAL, { head: [10 * Math.sin(Math.PI * t), 0, 0] }) }) } },
  idle: 'clerk_nod',
  onSpawn(c) { c.items.set('pen', null); } };
```

---------------------------------------------------------------------------
## Y2. The Hoods under direction

Options on `game.spawnHood(x, z, opts)`, `cast.spawn('hood' | 'heavy', opts)`
and `director.spawn({ who: 'hood' | 'heavy', ...opts })`:

| option | meaning |
| --- | --- |
| `wake: fn(game, hood) -> bool` \| `'sight'` \| `'shot'` \| `[...]` | he stands idle until it is true (any of a list). `'sight'`: the eye within 60 m, in front of him (150 degrees) or within 4 m, and a clear line (looked for every 0.2 s). `'shot'`: a `'shot'` event (the player's weapons), or any Hood's shot. A hit always wakes him. |
| `entry: [{x, z} \| anchor, ...]`, `run: true` | once awake he walks (runs) these in order, without thinking: straight where the nav grid says the line is clear, else an A* path. A hit cuts it short. |
| `post: {x, z} \| anchor`, `leash: m` | then he fights from there: his cover points, his peeks and every move he makes stay within `leash` (default 3) of the post. `leash: 0`: he never moves; with no cover there he shoots from where he stands whenever he has a line. A `leash` without a `post` ties him to the end of his entry (or where he spawned). |
| `aim: 1` | a scale on his hit chance (Game.hoodFire), capped at 1 |
| `hp` | his hit points (default 100, a heavy 170) |
| `brain: 'cover' \| 'none' \| '<file>'` | 'cover' is today's; 'none' no AI |

Order: wake, then entry, then the brain. Without any of these options a
Hood is exactly today's (`this.direct` is null: not one extra draw of his rng;
the battle frames are the test). In `director.spawn`, `entry` as a word
(`'idle' | 'walk' | 'run'`) is still the old start state; an array is the
path.

```js
d.spawn({ who: 'hood', at: 'door.out', group: 'door',
  entry: ['door.in', { x: -3, z: 2 }], run: true,
  post: 'landing.top', leash: 0, wake: 'sight', aim: 0.8, hp: 80 });
cast.spawn('heavy', { at: { x: 4, z: -30 }, post: { x: 4, z: -30 }, leash: 2, wake: (G) => G.director.alive('door') === 0 });
game.spawnHood(-6, -30, { brain: 'sniper', aim: 1.4 });
```

### Brains: `src/enemies/brains/*.js`

```js
export default {
  name,                                   // brain: '<name>'
  create(game, hood, opts) -> { update(dt, t), onHit?(dir, stunned), release?(), press?() -> bool, state? },
};
```

`opts` is everything the spawn was given (a brain may read its own options:
`post`, `leash`, anything else) plus `opts.body`, the man's body: a HoodAI
whose cover state machine never runs (enemies/HoodBrains.js `BrainHost`). The
direction (wake, entry) runs before `update` is first called; `release` when he
dies or is removed; `press` when the lull breaker picks him (return true if he
takes the initiative); `state` (optional) is shown in the Game's debug states.

```js
export default { name: 'sniper', create(game, hood, { body }) {
  let next = 2;
  return { update(dt, t) { body.stop(); body.faceTo(body.player.x, body.player.z, dt, 4);
    if (t < next || !body.checkLOS(dt) || !body.token()) return;
    hood.setState('aim', 0.2); body.fire(t); body.dropToken(); next = t + 3; } };
} };
```

**The calls a brain can make.**

On `body` (enemies/HoodAI.js, HoodBrains.js):
- move: `go(x, z, run) -> bool` (an A* path on the stage's nav grid; kept
  within the leash on a post), `follow(dt) -> arrived` (walks / runs the path:
  turns, speed 1.5 / 2.9 m/s, repaths when stuck), `stop()`, `path` / `run`
  (set `path = [Vector3]` for a straight step), `postMove(mode)` (on a post),
  `leashed(x, z)`, `inLeash(x, z)`, `posted`.
- face: `faceTo(x, z, dt, rate = 5) -> angle left` (turns his heading).
- see: `player` (the eye, Vector3), `eye()`, `distToPlayer()`,
  `checkLOS(dt, force)` (throttled 0.2-0.32 s unless forced), `losFrom(x, z)`.
- fire: `fire(t) -> bool` (Game.hoodFire: the muzzle flash, the sound, the hit
  roll with his `aim`, the round landing a moment later); `token(force)` /
  `dropToken()` (the fire tokens: at most two men, three from level 5, shoot
  at once; `force` always gets one); `lastShot`.
- his cover: `cover` (a CoverSet point he holds: set `.taken = body`), the
  stage's `game.covers.points` and `game.covers.hides(pt, x, z)`.
- `rng` (his own fork: draw from it, never from the stage's), `heavy`,
  `aim`, `underFire` (s), `stun` (s) and `direct` (the direction's record).

On `hood` (enemies/Hood.js):
- `setState(name, fade)`: `idle`, `walk`, `run` (locomotion moves him along
  his heading at `hood.speed` m/s while in walk / run), `aim`, and the Hood's
  clips (`leanDoor`, `stepOut`, `sitCar`, ...); `stagger()`, `flinch(dir)`.
- `speed`, `yaw` (a heading: he faces (sin yaw, cos yaw)), `pos`, `alive`,
  `hp`, `heavy`, `state`.
- `setAim(on)` (the aim overlay while he walks), `lookAt(Vector3 | null)`
  (the head and chest turn to it), `fire()` (the recoil clip; returns the
  muzzle's world point: `body.fire` calls it for you), `muzzleWorld()`.

### A new stage: the Hoods' nav grid and cover points

The Stage (src/world/World.js) builds both on its own after its parts, from
`stage.colliders`; a stage provides:
- **bounds**: `stage.colliders.setBounds(minX, maxX, minZ, maxZ)` round the
  ground the Hoods may walk. Required whenever a stage has Hoods (the default
  bounds are +-1e9: the grid would not fit in memory). The grid is 0.5 m cells
  over the bounds only (`addRegion` rooms are not in it: a room the Hoods
  fight in must be inside the bounds).
- **obstacles**: every `colliders.addBox(cx, cz, hx, hz, angle, tag)` and
  `addCircle(x, z, r, tag)` blocks the grid within 0.45 m (a man's radius);
  a wall is a thin box. Circles tagged `'hood'` do not block.
- **cover**: a box or circle whose `tag` is one of `car`, `booth`, `stand`,
  `crates`, `barrels`, `column`, `hydrant`, `can` (enemies/HoodAI.js
  `COVER_TAGS`: value and pad) gives cover points round it (a box: both long
  faces, 1 or 3 along them, and both ends; a circle: 4, a column 6), each
  kept only where the grid is free. `covers.hides(pt, x, z)` is exact against
  that obstacle's footprint. Tag a counter, a car door, a crate stack with
  one of those tags and it is cover.
- **line of sight**: the stage's meshes (`stage.solids`, the ray world) stop
  the Hoods' eyes and rounds; `userData.noRay` opts a mesh out.
- **the ground**: `stage.surfaceY(x, z)` (a part's `addSurface`) for his feet.
- Anchors (`stage.addAnchor`) are what `entry` and `post` name.

---------------------------------------------------------------------------
## Y3. Props: `src/props/kinds/*.js`

```js
export const SPECS = { kind: (variant, lod) => spec };   // one file may hold several kinds
```

A spec is kinds.js's: `{ parts: [{ geo, mat, id, name?, parent?, pivot?, keep?, cast?, side? }],
groups?: { name: [x, y, z] }, grip: [x, y, z] | Matrix4, rest?: Matrix4,
accent?: key, init?(group, ud, byName), after?(group, ud, byName) }`, origin
the middle of the base, +y up, the front toward +z, metres; `lod` 1 halves
the segments. Materials from `PM()` (props/lib.js). The kind is added to
`PROP_KINDS`; `buildProp(kind, { lod, variant })` builds it.

```js
import * as THREE from 'three';
import { PM, slab } from '../lib.js';
export const SPECS = {
  ledger: (v, lod) => ({ parts: [{ geo: slab(0.22, 0.03, 0.3), mat: PM().leather, id: 0 }], grip: [0, 0.015, 0] }),
};
```

---------------------------------------------------------------------------
## Y4. Sounds and rooms: `src/audio/sounds/*.js`

```js
export default (kit) => ({
  sounds: { name(ctx, out, t0, p, R, send) -> seconds },
  rooms?: { name: roomDef },
});
```

A sound is the built-ins' shape: build a node graph into `out` starting at
`t0` (p: the params of `sfx.play(name, pos, p, opts)`, R: the noise buffers
`R.white / pink / brown` and `R.ir`, send: the street's reverb send or null),
return its length. `kit` (Sfx.js `KIT`): `burst, thud, ping, chain, osc, gain,
env, filt, voice, noise, shaper, loopN, lfo, glassFall, splinter, tear, rng,
dinerBed`, `B` (the whole table: `kit.B.clang(ctx, out, t0, { k }, R)`) and
`ROOMS`. `sfx.play(name)` plays it; `audiotest=1` renders it with the rest.

**A room definition** (`sfx.room(name)`, which the Game calls when the Look's
`room` changes; a stage part sets it with `stage.addLook(box, { ..., room })`):
`{ inside?: true, wall?: 600, wallGain?: 0.25, bed?(ctx, R, out, kit) -> { gain, stop() } }`.
Inside, the street (rain, thunder, the train, far shots) goes through the
wall: a low-pass at `wall` Hz and `wallGain` of its level (a broken window,
`sfx.roomOpen(k)`, opens it toward the street's). The bed is the room's own
sound, built when the ear comes in (its `gain` faded to 1 in 0.4 s), stopped
when it goes to another room. Built in: `street` (outside), `diner`.

```js
export default (kit) => ({
  sounds: { typewriter(ctx, out, t0, p, R) { kit.ping(ctx, out, t0, [[2100, 0.1, 0.03]]); kit.burst(ctx, out, R, t0, 'white', ['bandpass', 3000, 2], 0.1, 0.001, 0.02); return 0.1; } },
  rooms: { office: { wall: 500, wallGain: 0.2, bed(ctx, R, out, k) { const g = k.gain(ctx, 0.0001), srcs = []; g.connect(out);
    k.chain(k.loopN(ctx, R, 'brown', 0.8, srcs), k.filt(ctx, 'lowpass', 240), k.gain(ctx, 0.1), g);
    return { gain: g, stop() { srcs.forEach((s) => s.stop()); g.disconnect(); } }; } } },
});
```
