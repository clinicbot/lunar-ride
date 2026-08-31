# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify latest `fixes-build-90` HEAD and Aqua/Verdant CI because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`.
- Active branch: `fixes-build-90`; never modify `main` directly.
- Open draft PR #1 targets `main`.
- User updates Windows copy with `UPDATE.bat`, runs `ride.bat`, closes/reopens browser/game, then `Ctrl+F5`.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Create backup before risky world/visual changes.
- GitHub connector access is independent of local git/container networking.

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v150**, layered over v143 Glass Ocean, v144 real Quaternius fish/reef, v145 visibility/fauna isolation, v146 water-column distribution, v147 horizontal trajectories, v148 body/tail animation and v149 horizontal-tail/U-turn continuity.
- v150 code checkpoint before this handoff: `45f1772276c6d20e375d7a874c4bbecfa55d89c0`.
- Aqua CI run `33374432617`: **SUCCESS**. Every v143→v150 regression, all 11 imported fish checks and loader/cache wiring passed.
- Verdant CI run `33374432712`: **SUCCESS** on the same checkpoint.
- Backup before v150: `backup-v149-before-aqua-faces-reef-v150` at exact v149 final HEAD `cb0fbe51b102c52b9a669f7928e1498aa3f91b8f`.
- Earlier canonical backups: `backup-v148-before-aqua-axis-uturn-v149`, `backup-v147-before-aqua-tail-animation-v148`, `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v150 — readable fish faces + reef-only underwater background
New world-cleanup layer: `js/56-aqua-faces-reef-v150.js`.
Face enhancement is implemented inside the shared Aqua fish loader/animation file `js/54-aqua-tail-animation-v148.js` so facial geometry is baked into the same 24 species frames.
Regression: `tests/aqua-v150-faces-reef-smoke.js`.

### User-observed problems after v149
1. Many fish looked faceless: no readable eyes or mouth.
2. The underwater background still showed land-world elements such as mountains, columns/poles and buildings/stations. User explicitly wants the underwater view to read as ocean: essentially reef/coral around the glass tunnel rather than terrestrial scenery.

### Root causes
- Quaternius source models contain more surface detail, but Lunar Ride's lightweight creature loader uses geometry + material base colours and does not render the tiny source texture details. Eyes/mouths that depend on texture therefore disappear at riding distance.
- `js/03-world-generation.js` is intentionally generic and bakes space cities, stations, masts/equipment, roadside display pedestals, rocks and mountainous terrain for normal worlds. Aqua had `life.bases=0`, but several generic scenery blocks are independent of `bases`, so they leaked into the underwater world.

### v150 fish faces
All 11 Aqua species now get real geometry before the 24 animation frames are baked:
- two pale/cream eye ellipsoids;
- two dark pupils;
- one dark mouth detail;
- placement is model-relative and uses the detected head end rather than assuming all species point the same way;
- face geometry sits wholly inside the anchored front/head region, so eyes and mouth do not flex with the tail;
- lateral eye size remains deliberately readable at riding distance while front/back thickness is shallow;
- no extra draw call per actor: the 258 actors share the face-enhanced species frame buffers;
- `GLCRE[key].faceEnhanced=true`; telemetry `world.__aquaFishV148.faceEnhanced=true`.

The v150 regression decodes **all 11 actual fish glTF meshes**, appends the facial geometry to each, checks vertex/index/color/normal consistency, verifies all facial vertices remain in the rigid head region and confirms the face does not move between tail-animation phases.

### v150 reef-only background cleanup
`js/56-aqua-faces-reef-v150.js` is an Aqua-only outer `buildWorld` wrapper. It intentionally does **not** alter route geometry, road elevation/profile, riding physics or the glass/water meshes.

After all prior Aqua layers finish, v150:
- discards the old generic `w.props` mesh completely instead of trying to hide individual city/station objects;
- therefore removes leaked cities, stations, masts, equipment, roadside screen pedestals, rocks and old simplistic reef props in one deterministic step;
- clears `w.screens=[]` and `w.veg=null`;
- replaces the original mountain terrain mesh with a custom low seabed mesh. The road keeps its original vertical profile; within 16 m the seabed supports the road, from 16–92 m it eases down, then becomes an almost-flat ocean floor with only ~1 m soft undulation rather than mountains;
- reassigns `w.groundAt` / `w.meshH` to the clean seabed so later Aqua logic sees the same floor that is rendered;
- rebuilds only glass-tunnel structural ribs/low rails plus a dense coral reef into `w.props`;
- uses low organic coral forms (brain/lobe heads, squat table coral, fan clusters) instead of the tall coloured stick forms that read as poles;
- reef placement uses **150 route stations × 2 sides × 3 coral placements = 900 coral placements**, spread roughly 14–178 m from the route; each placement contains multiple coral heads, yielding well over 1,800 visible coral lobes/heads while remaining a shared baked mesh;
- re-anchors all 258 fish to the new seabed/road-relative water-column bands and clears their cached v147 motion so trajectories initialize against the cleaned environment.

Telemetry: `world.__aquaV150` with `reefOnly:true`, `genericPropsDiscarded:true`, `screensRemoved:true`, `vegetationRemoved:true`, `mountainTerrainReplaced:true`, coral counts/range, `fishReanchored`, and `faceGeometryFromV148:true`.

Important architectural choice: v150 does **not** edit `js/03-world-generation.js`. The generic generator stays intact for every other world, which greatly reduces regression risk. Verdant is untouched.

## Aqua v149 — horizontal tail plane + U-turn continuity
Files: `js/55-aqua-uturn-continuity-v149.js` and horizontal-axis correction in `js/54-aqua-tail-animation-v148.js`.
- All imported fish are long-axis local Y and pitched -π/2 at actor level; v149 forces tail flex to local X so it remains world-horizontal. This fixed sharks that looked as if they were galloping.
- On Aqua U-turn, fish within 135 m are held for 1.15 s and ease back to live trajectories over 2.35 s. No world rebuild or fish respawn occurs.
- Regression: `tests/aqua-v149-uturn-continuity-smoke.js`.

## Aqua v148 — geometry-baked fish animation
Active: `js/54-aqua-tail-animation-v148.js`.
- 24 geometry frames per species shared by actors.
- Head/front ~14% anchored; progressive bend grows toward tail; tail amplitude ~7.5% body length.
- Normals deform with geometry; independent per-fish phases; small reef fish beat faster than shark/swordfish.
- Uses deferred `installTailUpdate()` because the file loads before `js/07` defines `updateActors`.
- Procedural geometry animation, not native glTF animation-channel evaluation.
- v150 extends this loader with the face geometry described above.

## Aqua v147 / v146 / v145 / v144 / v143 retained
- **v147** `js/53-aqua-swim-motion-v147.js`: shallow horizontal ellipses (major 8–15 m, minor 1.4–3.2 m), yaw follows velocity, only ±0.18 m depth drift.
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish across bilateral height bands `[-1.5,1,4,8,12]`; v150 re-anchors those bands against the new seabed.
- **v145** `js/51-aqua-fish-visibility-v145.js`: hard fauna isolation, imported fish scale ×100, pitch -π/2.
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 species, total 258 fish. Assets in `assets/models/aqua_fish/`; provenance in `PROVENANCE.md`.
- **v143** `js/49-aqua-rift-v143.js`: separate **Aqua Rift — Glass Ocean** world, transparent half-cylinder glass tunnel, widened galleries and overhead water surface.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v150 with cache-buster `?b=150` in this order:
1. v143 base
2. v144 real fish/reef
3. v145 visibility/isolation
4. v146 distribution
5. v147 trajectory
6. v148 body/tail + v150 face-enhanced loader
7. v149 U-turn continuity
8. v150 reef-only terrain/props cleanup

Verdant files remain `?b=142`. `sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant CI invariants while caching all Aqua layers through `js/56` plus all fish assets.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.
Aqua CI protects v143 base through v150, including all actual fish assets, horizontal deformation, U-turn continuity, geometric face placement, reef-only background replacement, cache/wiring and Verdant v142 isolation. Verdant CI continues protecting the approved v142 world.

## Immediate visual test for v150
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
- fish close to the glass should have clearly readable eyes/pupils and a small mouth rather than blank heads;
- eyes/mouth should stay rigid with the head while body/tail flex;
- sharks should retain the v149 horizontal tail motion, not buck vertically;
- no space-city buildings, stations, masts, display poles or terrestrial rocks should remain in Aqua;
- distant mountain silhouettes should be gone; the surrounding world should read as low ocean floor and dense coral reef;
- the route profile/road itself should remain unchanged;
- U-turn continuity should still retain the just-passed school;
- Verdant Rift must remain visually unchanged.
