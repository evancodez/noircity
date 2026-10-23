# NOIR CITY — performance audit (numbers and levers)

Measured 2026-10-23 01:10-02:01 on the user's Mac, headless Chrome (ANGLE
Metal), muted, one Chrome of mine at a time, every run under `tools/wd.sh`,
my own server on :5381. Nothing under `src/` was changed; the probes ran in
the page (`window.__noir`) and in a scratch copy of `tools/fpstable.mjs`.

**Read every absolute number as a loaded-machine number.** Seven lanes were
running headless Chromes the whole hour: the one-minute load was 17-241 and
the GPU was 93-100 % busy *before* every reading (`ioreg`, page blank). That
is why the frame rates below are ratios to `shot=perf` measured either side
in the same Chrome (as `tools/fpstable.mjs` does), why each pose was measured
twice, and why the load sits beside every number. `shot=perf` itself ran at
16-40 fps in these runs (its clean figure in game one's Phase 3b record is
>= 85 fps uncapped); no clean absolute reading was possible.

Code: the table's first run, the breakdown, the drive and the load test ran
on main at `360ba15` (O1's city). Main moved under the server during the
table's second run (`814c675`, O6's merge, at 01:54: the poses from
`city_gasworks` on, and the junctions' second reading, are on O6's code).

---------------------------------------------------------------------------
## 1. Frame time at the ten golden poses and the two busiest junctions

1440 x 900, uncapped (`--disable-gpu-vsync --disable-frame-rate-limit`), each
pose `scene=city&beat=roam&anim=1&t=3` plus the manifest's `pose` / `car` /
`at`, 5 s of frames after the page settles; `perf` = `shot=perf&t=1&anim=1`
measured before and after each pose (the mean of the two). Ratio > 1: faster
than `perf`.

**The two busiest junctions** were found by a sweep, not guessed: every road
node with four or more ways (76), the eye at its middle, four headings, then
eight headings at the four heaviest. The heaviest single views are both
Broadway's six-way junctions under the el, looking along Broadway:
J1 = Market St x the Bowery x Broadway (150, -210), yaw 2.356 (south-west,
down Broadway): 1,083 draws, 2.96 M triangles; J2 = Grand Ave x Broadway
(-120, 60), yaw 5.498 (north-east, up Broadway): 1,078 draws, 2.89 M. (By the
mean over four headings the Tenements' junctions lead, ~890 draws.)

| pose | run A: fps / perf around / **ratio** / load | run B: fps / perf around / **ratio** / load | p95 ms (A / B) | draws | tris (M) | CPU render ms (A / B) |
| --- | --- | --- | --- | --- | --- | --- |
| city_elcorner | 47.6 / 25.7 / **1.85** / 31 | 32.7 / 18.1 / **1.81** / 30 | 33.9 / 50.5 | 471 | 1.66 | 20.3 / 22.1 |
| city_grand_car (in the car) | 29.9 / 28.9 / **1.03** / 32 | 19.0 / 18.7 / **1.02** / 40 | 49.9 / 69.0 | 621 | 2.09 | 35.5 / 50.9 |
| city_broadway | 30.6 / 28.9 / **1.06** / 40 | 32.1 / 20.8 / **1.54** / 33 | 48.9 / 46.7 | 827 | 2.28 | 31.7 / 30.8 |
| city_station | 32.7 / 27.5 / **1.19** / 33 | 32.7 / 25.0 / **1.31** / 31 | 48.2 / 47.9 | 615 | 1.93 | 30.6 / 30.0 |
| city_tenements | 67.0 / 34.2 / **1.96** / 28 | 32.6 / 23.6 / **1.38** / 30 | 31.2 / 49.5 | 567 | 1.86 | 14.2 / 25.3 |
| city_quay | 76.4 / 40.4 / **1.89** / 27 | 28.0 / 20.3 / **1.38** / 49 | 31.0 / 51.9 | 440 | 1.30 | 7.2 / 34.6 |
| city_gasworks | 75.2 / 33.3 / **2.26** / 39 | 50.8 / 19.9 / **2.55** / 63 | 21.4 / 35.6 | 299 | 1.06 | 12.5 / 22.8 |
| city_park | 48.2 / 27.6 / **1.75** / 37 | 39.7 / 26.3 / **1.51** / 83 | 34.5 / 46.3 | 261 | 1.21 | 18.9 / 20.7 |
| city_straight | 47.2 / 23.8 / **1.98** / 86 | 47.9 / 36.0 / **1.33** / 92 | 33.7 / 34.6 | 644 | 1.87 | 20.2 / 20.7 |
| city_clock | 55.7 / 19.5 / **2.86** / 134 | 89.6 / 39.9 (one side) / **2.25** / 112 | 34.0 / 17.3 | 431 | 1.48 | 20.5 / 9.7 |
| **J1** (150, -210) down Broadway | 28.5 / 17.4 / **1.64** / 162 | 33.1 / 18.9 / **1.75** / 232 | 51.0 / 49.1 | 1,013 | 2.80 | 36.1 / 27.7 |
| **J2** (-120, 60) up Broadway | 20.9 / 16.7 / **1.25** / 180 | 32.7 / 22.8 / **1.44** / 186 | 63.6 / 50.6 | 819 | 2.17 | 47.7 / 25.4 |

Run A 01:16-01:21; run B 01:50-02:00 (it hung on J1's `perf` at load 125 and
the watchdog ended it; the junctions' run B is a separate run at 02:00).
`shot=perf` for reference: 727 draws, 2.90 M triangles.

What holds across both runs: **every pose is at or above `perf`'s speed; the
slowest is Grand Ave from the car (1.02-1.03 x, the same both times)**, then
J2 (1.25-1.44), the station and Broadway (1.06-1.54); the open places (the
gasworks, the clock's square, the Straight) are 1.3-2.9 x. The ratios scatter
by up to 0.6 between runs at the same pose (the other lanes' load moved by
2-5 x between a pose and its `perf`), so read the order, not the second
decimal. If `perf` is still at its clean >= 85 fps, Grand Ave from the car is
about 87 fps (11.5 ms): ~5 ms of a 60 fps frame to spare at the worst pose
today. That figure is derived, not measured (see section 7).

---------------------------------------------------------------------------
## 2. The ten-minute drive (real keys) — the hitch list

`tools/lib/o1_city.mjs` `drive` twice round its 4.29 km loop (the O1 route
through every district, W / S / A / D by trusted key events), 1280 x 800,
vsync on (as `tools/play.mjs` always runs), plus my own frame recorder in the
page: every frame's time, and for every frame over 50 ms where the eye was,
the district, the speed, whether a chunk was attached or dropped that frame,
the stream's build step, and whether geometries, programs or textures were
created. Load sampled every 10 s alongside: **1-min load 17-132 (median 76),
GPU 99-100 % at every sample**.

| | loop 1 (323 s) | loop 2 (326 s) | the whole (649 s) |
| --- | --- | --- | --- |
| result | done, 5 districts, never inside a wall, 0 chunks missing within 100 m, 0 built late | the same | |
| frames | 11,843 | 10,581 | 22,490 |
| over 50 ms (O1's recorder) | 280 (max 80.4) | 530 (max 77.7) | |
| frame time p50 / p95 / p99 / p99.9 / max | | | 27.7 / 47.9 / 58.0 / 70.3 / 126.5 ms |
| frames <= 20 / 20-33 / 33-50 / 50-100 / > 100 ms | | | 5,138 / 10,562 / 5,974 / 814 / 2 |
| chunks built / dropped | 145 / 140 | 146 / 146 | 291 / 286 |

Every frame over 50 ms (816), by what the page was doing in that frame:
- **a chunk attached**: 39 (5 %); a chunk dropped: 26; a stream build step
  running: 72; **a program compiled: 1** (the start, below); new textures: 0.
- by district: downtown 297, the Docks 208, the Hill 93, the river road 78,
  the Yards 77, the Tenements 63. By speed: 52 % at 40-60 km/h.
- by size: 50-60 ms 668, 60-75 ms 141, 75-100 ms 5, over 100 ms 2.
- by minute: 3, 0, 6, 37, 97, 149, 8, 84, 23, 177, 232 — it follows the
  machine: **9 in the first three minutes (load 17-32)**, hundreds once the
  load passed 50.

So on this hour the slow frames are the GPU shared with seven other lanes,
not the stream. What remains when the machine is quieter (the first three
minutes, load 17-32) is the hitch list:

| # | ms | where | what the page was doing | kind |
| --- | --- | --- | --- | --- |
| 1 | 108, then 127 | Grand Ave, the start (-113, 30), 0.2 and 0.6 s into the drive | the bot's first E into the car: **1 program compiled, 6 geometries uploaded** in that frame, a 127 ms frame after it | first entry into the car: **a program `compile.js` misses** |
| 2 | 51, 51, 56, 50 | the Hill, Bridge St west (-57..-90, -422) at 60 km/h | nothing streaming (1 drop) | GPU (fill) |
| 3 | 56 | the Yards (-301, -275) at 60 km/h | **a chunk attached after an 8.9 ms build step** (the budget is 4 ms) | the stream's step |
| 4 | 50 | the Yards (-301, -252) | nothing | GPU |

Loaded but repeated in both loops at the same spot (the heaviest views of
the route, not streaming): (-105, 59) Grand Ave x Broadway at 32 km/h (78 and
75 ms: J2's junction), (51, 331) Dock Rd (78, 75 ms), (-13..-32, 144) Houston
St under the el (73-78 ms, one with 2 chunks dropped). The longest single
build step of the whole drive: **13.6 ms** (`stream.stats.buildMs`); the
attached-chunk frames' steps were 4-9 ms.

---------------------------------------------------------------------------
## 3. Memory (start, middle, end of the drive)

JS heap after a forced collection (DevTools `Runtime.getHeapUsage`), the
renderer's counts (`renderer.info`):

| | start (on Grand Ave) | middle (after loop 1, 323 s) | end (after loop 2, 649 s) |
| --- | --- | --- | --- |
| JS heap (MB, after GC) | 83.3 | 85.3 | 85.2 |
| GPU geometries | 1,075 | 1,187 | 1,187 |
| textures | 63 | 63 | 63 |
| programs | 121 | 123 | 123 |
| chunks live / built / dropped | 21 / 21 / 0 | 26 / 166 / 140 | 26 / 312 / 286 |

**Flat**: after the first loop has visited every district nothing grows (the
+112 geometries and +2 programs between start and middle are the first
sight of the far tiles and the car's first entry; loop 2 adds none). The near
chunks' geometry is 1.4-1.5 MB a chunk (30.6 MB live at Grand Ave, 54.4 MB at
J1), freed on drop.

---------------------------------------------------------------------------
## 4. Where the frame goes (measured and read)

### 4.1 Draws and triangles by pass (exact: `renderer.render` wrapped for one frame)

| pass | Grand Ave, in the car: draws / tris | J1: draws / tris |
| --- | --- | --- |
| 1 id (normals + ids), world | 213 / 674 k | 363 / 1,036 k |
| 1 id, the cabin (viewmodel) | 6 / 27 k | — |
| 2 planar reflection (two renders) | 143 / 430 k | 222 / 472 k |
| 2 reflection post (the streak splats, 8 draws) | 8 / 202 k | 8 / 202 k |
| 3 scene (4x MSAA), world | 217 / 677 k | 378 / 1,038 k |
| 3 scene, the cabin | 6 / 27 k | — |
| 4 volume (the lamps' cones) | 24 / 2 k | 24 / 2 k |
| 4 rain (instanced: 20,000 streaks, 700 splashes) | 2 / 41 k | 2 / 41 k |
| the lamps' two shadow maps, when re-rendered | 2 / 7 k | 2 / 7 k |
| **a frame** | **622 / 2.09 M** | **1,013 / 2.80 M** |

Every visible mesh is drawn about three times (id, reflection, scene); the
near relief (dark panes, trim, iron, trees, kerbs) is already left out of the
mirror (`stream.js`, `REFL_OUT`).

### 4.2 The near chunks (96 m, built within 180 m)

| | Grand Ave | J1 |
| --- | --- | --- |
| chunks loaded | 21 | 38 |
| meshes a chunk | 7.0 | 7.1 |
| triangles a chunk, mean / max | 21.2 k / 28.8 k | 20.8 k / 35.4 k |
| geometry a chunk | 1.46 MB | 1.43 MB |
| by bucket (all chunks): iron / trim / dark / kerb / tree | 193 k / 126 k / 74 k / 28 k / 25 k | 387 k / 198 k / 114 k / 43 k / 49 k |

**The iron is 43-49 % of the near city's triangles**, and most of it is the
lamp post: `src/city/kits/street.js` `LAMP` is a 12-sided lathe of 21 rings,
a 28 x 6 tube arm and a 30 x 4 scroll (about 1,050 triangles) plus a
252-triangle shade, copied into every chunk's merged iron for each of ~650
posts (`stream.js` `buildChunk`: `placeLamp(LAMP.iron, l)`). The fire
escapes (boxes) and the washing lines (3-sided cylinders) are small. No near
geometry is instanced: everything is merged per chunk per material.

### 4.3 The rest of the scene (at Grand Ave; J1 alike)

| group | meshes | triangles | instanced | casts a lamp shadow |
| --- | --- | --- | --- | --- |
| the el | 101 (77 at J1) | 248 k | 3 instanced meshes, 4,758 instances (railing posts, braces, cross beams) | 28 meshes |
| the near city | 147 (269 at J1) | 446 k (791 k) | none | none |
| the river, quay, bridge, far bank | 22 | 126 k | 3, 1,294 instances | none |
| the far city (240 m tiles) | 96 | 98 k | none (merged by tile) | none (by design) |
| landmarks | 19 | 97 k | none | none |
| the player's coupe | 20 | 44 k | — | — |
| places (fronts, neon) | 5 | 5 k | — | — |
| the rain | 2 | 41 k | yes (20,700) | — |

**The el**: each column bay (a pair of columns, the portal, the arches to
the next) is **its own mesh in two builds** (`src/stages/noircity/parts/el.js`
`buildSteps`, `build(lo)`: full within 70 m, light to 320 m), so ~100 el
meshes are drawn in three passes; the deck is already merged in 80 m chunks.

**Lights**: 11 lights reach every lit shader — the lamps' pool of 5
SpotLights (2 with 1024² shadow maps, far 26 m), the headlamps' 2 SpotLights,
4 PointLights held at intensity 0 (the fx's pre-allocated flash / fire
lights). Only the el (28 meshes) casts into the lamps' maps today: a map
re-render is 2 draws, 7 k triangles. Figures and cars cast (`castShadow`),
so with moving people near a lamp the maps start re-rendering (the pipeline
throttles: every other frame near, every fourth far).

### 4.4 The cost of each part (knock-outs and `__noir.bench()`)

`__noir.bench()` (each pass executed k extra times, gl.finish between): the
ms a pass costs, under load.

| pass (ms) | Grand Ave (load 129) | J1 (load 59) |
| --- | --- | --- |
| whole frame | 75.3 | 36.7 |
| 3 scene (4x MSAA, the wet street, every lit shader) | **23.6** | **17.9** |
| 6 ink | 8.0 | 13.0 |
| 2 reflection | 3.5 | 6.8 |
| 4 volume | 1.1 | 3.9 |
| 1 id | 0.9 | 3.5 |

Knock-outs: frames rendered synchronously (`pipeline.render` + `gl.finish`)
with one part hidden, against the frames either side with it shown. Under
load 43-129 the base itself moved 52-108 ms within the run, so a knock-out is
**indicative only (+-10 ms)**; the parts that came out large at both poses:

| hidden | Grand Ave saves (ms) | J1 saves (ms) |
| --- | --- | --- |
| the near city | 7.8 | 14.3 |
| the el | 6.6 | 8.3 |
| the wet street (the ground's shader) | 4.9 | 14.4 |
| the reflection pass | 11.5 | (-0.9: noise) |
| the volume + rain passes | 14.1 | 3.5 |
| the river | 2.9 | 3.8 |
| the far city | (-1.2: noise) | 1.8 |
| every shadow map re-rendered every frame | (-1.4: noise) | +3.2 |

(GPU timer queries, `__noir.gpuProfile()`, returned 19-34 ms for every stage
of one frame — not usable under this load; see section 7.)

---------------------------------------------------------------------------
## 5. Where the next lanes will spend: a budget

Simulated in the page at Grand Ave (in the car) and at J1 with the real
kits: **40 figures** (`__noir.spawnHood`, the Hood's own LODs) on the
pavements' walk edges 7-97 m from the eye, spread evenly; **30 cars**
(`stage.part('cars').spawn`, the game's sedan, `lights: false`, its far LOD
set once) at the 30 nearest bays; **100 props going over** (separate meshes
of the bin's kit, shadow-casting, turning every frame); then every lamp
shadow map re-rendered every frame (the worst case of moving casters).
Single readings at load 94-181 (GPU 98-100 %): trust the draws, triangles
and CPU columns more than the fps.

| added | draws (Grand / J1) | triangles (Grand / J1) | CPU submit ms | CPU sim ms | live fps, loaded (Grand / J1) |
| --- | --- | --- | --- | --- | --- |
| nothing | 620 / 1,013 | 2.09 / 2.80 M | 7.4 / 8.0 | 0.6 / 0.6 | 28.1 / 27.7 |
| + 40 figures (standing, animated, no brains) | +29 / +22 | +0.22 / +0.17 M | +7.1 / +4.9 | +2.4 / +2.2 | 24.0 / 24.9 |
| + 30 parked cars | **+368 / +399** | **+1.41 / +1.14 M** | -0.3 / +5.8 | ~0 | 23.9 / 19.0 |
| + 100 props going over | +78 / +81 | +0.02 / +0.01 M | +0.4 / -0.5 | (no physics) | 25.2 / 19.0 |
| + every shadow map every frame | — | — | +3.3 / +2.6 | — | — |
| **all of it** | **1,095 / 1,515** | **3.74 / 4.12 M** | **14.5 / 18.2** | **3.1 / 3.1** | **-10 % / -31 %** |

One sedan in full view at 10 m: +34 draws, +148 k triangles a frame (12
meshes x three passes; `src/world/Cars.js` `spawn`: paint, chrome, dark,
skirt, rubber, whitewalls, hubs, caps, glass, seams, lens, contact shadow).
One figure at 6 m: +3 draws, +66 k triangles. Most of the 40 figures are
culled or far (LOD at 12 and 17 m); most of the 30 cars are not (the bays
line the street the eye looks down).

**What is left at 60 fps** (16.7 ms), read through the ratio to `perf` since
no clean absolute was possible: today the slowest pose is ~1.0 x `perf`
(Grand Ave from the car) and the busiest junction 1.6-1.75 x. With the three
lanes' load as simulated, J1 loses ~31 % (to ~1.2 x `perf`) and Grand Ave
~10 % (to ~0.9 x `perf`). So, *if* `perf` holds its clean >= 85 fps, the
busiest junction stays near 100 fps and the car on Grand Ave near 75; if
`perf` is nearer 60 on the user's Mac, Grand Ave in the car with traffic
drops under 60 first. The traffic is the one lane that doubles the frame's
draws; the crowd costs CPU (7 ms submit + 2.4 ms animation for 40 standing
men, before their brains); the props cost draws only while they are
separate meshes.

| lane | its cap | measured cost as built today | the share to hold it to |
| --- | --- | --- | --- |
| O2 traffic | 30 cars (seam: 12 moving within 120 m) | +370-400 draws, +1.1-1.4 M tris, ~0-6 ms CPU | <= 120 draws: needs lever 1 |
| O3 crowd | 40 figures (seam: 20 within 120 m) | +22-29 draws, +0.2 M tris, +5-7 ms CPU submit, +2.4 ms sim; their brains not measured | 4 ms CPU with brains: the LODs exist; the CPU is the risk |
| O6 props | 100 going over | +80 draws while separate, ~0 tris | merge back into the chunk once at rest |
| O4 police at heat 4 | (estimated from the parts: 4 cars + 8 men + flashes) | ~+60-140 draws, ~+0.6 M tris at full LOD, + the shadow maps re-rendering (+2.6-3.3 ms CPU worst case) | the cars' lever 1 again; their lights from the pool, never new lights |

---------------------------------------------------------------------------
## 6. The levers, in order of value

1. **A car in one draw beyond its near distance, and the city calling the
   LOD at all** — `src/world/Cars.js` `spawn` (12 meshes a car) and
   `lodUpdate` (swaps geometries but keeps all 12 draws), and
   `src/stages/noircity/parts/cars.js` `update` (a no-op: the city never
   calls `lodUpdate`, so every car is drawn at full detail at any range).
   Measured: 30 cars are +370-400 draws and +1.1-1.4 M triangles, more than
   the crowd and the props together and half the frame again. A merged far
   build (one geometry, vertex colour, one ink id, one draw, the far LOD's
   triangles) past ~36 m and `lodUpdate(camera)` every tick would bring 30
   cars to roughly 60-90 draws and ~0.3 M triangles. It is what the
   traffic, the parked cars and the police all spend.
2. **The near city's iron and the el's bays: fewer triangles and draws in
   every pass** — `src/city/kits/street.js` `LAMP` (the lamp post: ~1,300
   triangles copied into every chunk for ~650 posts, 43-49 % of the near
   city's triangles; a 6-8-sided post of fewer rings, or the posts as one
   InstancedMesh per chunk, halves the near iron) and
   `src/stages/noircity/parts/el.js` `buildSteps` / `build(lo)` (one mesh
   per column bay, ~100 drawn three times; merged per 80 m deck chunk like
   the deck, ~15). The near city and the el are the two largest knock-outs
   at both poses (near 7.8-14.3 ms, el 6.6-8.3 ms, loaded), and the passes
   are 2.8-4.1 M triangles once the lanes arrive.
3. **The two hitches that are the game's, not the machine's** — the first
   E into the car compiles a program and uploads 6 geometries in the frame
   (108 then 127 ms): `src/stages/noircity/compile.js` (`compileAll` under
   the fade-in) misses one program (and 6 geometries) that the first entry into the car
   makes (which one was not traced); and a chunk's build step runs to 9-14 ms against its 4 ms
   budget: `src/stages/noircity/parts/stream.js` `buildChunk` merges a whole
   bucket (`mergeAll(list)`) in one step - split the big buckets (iron,
   trim) over steps, or merge off the main thread.

Not ranked, for the art director's shader lane only (`src/render/` is not a
lane's to change): the scene pass is half the GPU frame in `bench()`
(17.9-23.6 ms of 36.7-75.3, loaded) and the wet street's shader
(`src/render/shaders/ground.js` `makeGroundMaterial`) the largest single
material in it (4.9-14.4 ms knocked out); and every lit shader loops over 11
lights, 4 of them PointLights held at intensity 0.

---------------------------------------------------------------------------
## 7. What I could not measure, and why

- **A clean absolute frame rate.** Load 17-241 and the GPU 93-100 % busy
  before every reading for the whole hour (seven lanes' headless Chromes,
  `secd` and Spotlight churn). Every fps here is a ratio to `perf` or a
  loaded reading; the "~87 fps at Grand Ave" is the ratio times `perf`'s
  clean figure from game one's record, not a reading of mine. Re-run
  `MOMENTS`-style poses when `ioreg` shows the GPU under 30 % before a run.
- **GPU time per pass by timer queries.** `__noir.gpuProfile()` gave 19-34
  ms for every stage (the queries include the queue's wait on a shared GPU);
  `__noir.bench()` was used instead, itself loaded.
- **Per-part cost in ms to better than +-10 ms.** The knock-outs were single
  A/B runs while the base moved 52-108 ms; only the draws and triangles are
  exact.
- **The next lanes' CPU.** The figures stood with no brains (O3's AI, O4's
  police tactics), the cars were parked (O2's driving, pathing and physics),
  the props turned without physics (O6's bodies): their simulation cost is
  not in these numbers. The police at heat 4 were estimated from the parts,
  not built.
- **The golden poses as frozen frames.** The table uses `anim=1&t=3` (the
  live frame), not the manifest's still `t=2`.
- **Run B's junctions** were cut by the watchdog when `perf`'s page hung at
  load 125; they were measured again on their own a minute later.
