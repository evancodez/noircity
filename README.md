# NOIR EXTREME

A short first-person noir detective story, one rainy night in 1937, in a
city rendered in real time to look like a hand-inked black-and-white noir
illustration. Colour is an accent: blood, fire, an ember, a flame, scotch,
neon, the crew's red. Built with Three.js and Vite; every texture, model,
sound and effect is generated procedurally at startup (no art assets; the
music slots wait for the user's jazz in `public/music/`).

The target look is `reference/noir_reference.png`; progress frames per
milestone live in `docs/progress/`.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173, click to begin (pointer lock): the story opens
in the diner, on a stool at the counter.

| Key | Action |
| --- | --- |
| E | the prompt's action (light up, scotch, drink, pay, search, ...) |
| mouse | look (seated: around the room; inspecting: turn the object) |
| W A S D | move (walking) |
| X | stand up off the stool / sit back down (the foundation's stand-in) |
| F | a drag on the cigarette |
| left button | fire (with the Tommy gun in hand) |
| R | reload the drum |
| M | mute |
| Esc | release the mouse (pauses) |

Scenes 1 and 2 are the foundation's stubs: stand-in people and hands, the
beats moved on by E. See `docs/story/` for the story, the contracts and
the architecture.

## How the look works

- `src/render/Pipeline.js` renders normals + object ids, an emitter-only
  planar reflection of the wet street (long vertical streaks), volumetric
  lamp cones, 3D rain lit by the cones, bloom, and then one ink pass
  (`src/render/shaders/ink.js`): fog, filmic tone curve, dry-brush tonal
  quantisation from canvas-generated stroke textures sampled in **world
  space** (so strokes stay on surfaces as you move), hand-drawn contours,
  a saturation-keyed colour keep for blood and fire, rain streaks, grain.
- Enemies ("Hoods", `src/enemies/`) are skinned procedural men in fedoras
  and trench coats with procedural animation clips, inked as black
  silhouettes with a lamp rim.
- The world reacts: destructible cars that smoke, explode and burn (with a
  warm reflection on the street), shootable lamps and windows, a train
  crossing the el, lightning, and 27 procedural Web Audio sounds.

## Tooling

- `tools/shot.sh out.png "shot=street" 1600 1000` — headless Chrome WebGL
  screenshot of a named camera preset (`street`, `lamp`, `cars`, `hood`,
  `hoodstudy`, `hoods`, `viewmodel`, `battle&t=30` (autopilot combat),
  `wreck&t=8`, `train&t=6`, `title`, `end`; `t=` fast-forwards the
  simulation, `hud=1`, `debug=1`, `view=N` shows pipeline buffers).
- `tools/errors.sh "shot=battle&t=30"` — runtime errors, frame count and
  (with `audiotest=1`) the offline audio render table.
- `node tools/fps.mjs` (`UNCAPPED=1` for headroom) — frame-time measurement.

- `tools/shot.sh out.png "scene=diner&beat=order"` — a story beat's frame
  (every beat: `docs/story/ARCHITECTURE.md` §8).
- `python3 tools/golden.py check` — every golden frame against
  `shots/golden/` (the renderer is pixel-deterministic).
- `node tools/playtest.mjs` — a scripted play-through with trusted input.

## Design documents

`DESIGN.md` is the art direction and technical plan. The story pass:
`docs/story/STORY.md` (the story), `docs/story/CONTRACTS.md` (the binding
APIs, file ownership, the site plan), `docs/story/ARCHITECTURE.md` (the
engine as built, every stub and who replaces it), `docs/story/briefs/`
(one brief per lane). `docs/PHASE*_BRIEF.md` are the shooter's phases.
