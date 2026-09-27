# NOIR EXTREME

A first-person wave shooter set on one rain-soaked city block under an
elevated railway, rendered in real time to look like a hand-inked
black-and-white noir illustration. The only colour in the world is blood
and fire. Built with Three.js and Vite; every texture, model, sound and
effect is generated procedurally at startup (no art assets).

The target look is `reference/noir_reference.png`; progress frames per
milestone live in `docs/progress/`.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173, click to begin (pointer lock).

| Key | Action |
| --- | --- |
| W A S D | move |
| mouse | look, **left button** fire |
| R | reload the drum |
| V | toggle over-the-shoulder camera |
| M | mute |
| Esc | release the mouse (pauses) |

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
  `wreck&t=8`, `train&t=6`, `ots`, `title`, `end`; `t=` fast-forwards the
  simulation, `hud=1`, `debug=1`, `view=N` shows pipeline buffers).
- `tools/errors.sh "shot=battle&t=30"` — runtime errors, frame count and
  (with `audiotest=1`) the offline audio render table.
- `node tools/fps.mjs` (`UNCAPPED=1` for headroom) — frame-time measurement.

## Design documents

`DESIGN.md` is the art direction and technical plan; `docs/PHASE*_BRIEF.md`
are the per-phase briefs and review notes.
