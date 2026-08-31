# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify latest `fixes-build-90` HEAD and Aqua/Verdant CI because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`.
- Active branch: `fixes-build-90`; never modify `main` directly.
- Open draft PR #1 targets `main`.
- User updates Windows copy with `UPDATE.bat`, runs `ride.bat`, closes/reopens browser/game, then `Ctrl+F5`.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Create a backup branch before risky visual/world changes.
- GitHub connector access is independent of local git/container networking; do not confuse the two.

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v155**.
- v155 code/wiring/CI feature checkpoint before this handoff commit: `c70c59dd3a171aa111b15a6ea0bdd13d8bf57297`.
- Aqua CI run `33398577795`: **SUCCESS**.
- Verdant CI run `33398577774`: **SUCCESS** on the same code checkpoint.
- Canonical backup immediately before v155: `backup-v154-before-aqua-reef-colonies-v155` at exact v154 final HEAD `58144f47c86b0069ac6cc09a5ed91835b7d383f1`.
- Earlier canonical backups remain available for v143→v154 history.
- `js/09-bluetooth.js` remains untouched.

## Visual history leading to v155
### v153
v153 replaced crude coral blobs with six recognizable procedural families and hybrid LOD. The user's screenshot showed improved silhouettes, but reef still felt like scattered low-poly props.

### v154
v154 doubled close hero presence to 280 groups and formed overlapping clusters on dark reef ledges. The user's screenshot showed a clear composition improvement: the side scenery finally began to read as reef.

However the v154 screenshot still showed three defects:
1. dark bases looked artificial, like black podiums under coral sculptures;
2. individual close coral still looked low-poly / schematic;
3. reef mass was still too discontinuous: object → gap → object instead of broad colony/reef shapes.

The user explicitly asked to continue, creating v155.

## Aqua v155 — organic reef colonies
New layer: `js/61-aqua-coral-colonies-v155.js`.
Regression: `tests/aqua-v155-reef-colonies-smoke.js`.

### Fixed placement budget
v155 still rebuilds `w.props` and preserves the established placement count:
- 350 route stations;
- 4 groups per side per station;
- exact total **2,800 reef placements**;
- 700 near / 1,400 mid / 700 far.

This is intentionally not another raw density increase.

### Organic reef mounds instead of podiums
Every placement receives an irregular darker reef foundation generated from asymmetric rock masses, ledges and rubble rather than the v154 circular/stacked pedestal treatment.

Telemetry:
- `organicReefMounds:true`
- `moundGroups:2800`
- `podiumBasesRemoved:true`.

### 280 hero colonies
The v154 280-hero budget remains:
- **140 primary hero colonies** in the closest band;
- **140 secondary hero colonies** in the second band.

Primary hero colonies now contain the main coral plus about five or six overlapping companion forms, irregular mound pieces, rubble and several local mini-coral accents. Secondary heroes contain multiple companions and accents.

Telemetry:
- `heroGroups:280`
- `primaryHeroes:140`
- `secondaryHeroes:140`
- `heroColonyGroups:280`
- `accentGroups:840`
- `reefColonies:true`
- `closeColonyContinuity:true`.

### Closer / larger close reef
The nearest placement floor is approximately `glassRadius + 1.02 m`, still outside the glass envelope. Close hero scaling is increased again so colonies occupy more screen space at riding speed.

### Coral families retained
The six v153/v154 recognizable families remain:
1. branching / staghorn;
2. sea fan lattice;
3. ridged brain coral;
4. layered wavy plate coral;
5. hollow tube sponge;
6. soft branching coral.

Medium/far LOD remains cheaper to keep the added close-colony richness focused where it matters.

## External CC0 model research after v154 feedback
A stronger model-based path was investigated before finalizing v155.

A separate open-source ocean project documents three **CC0 Smithsonian Institution** coral scans:
- **Stylaster sanguineus** — lace coral;
- **Seriatopora hystrix** — birdsnest coral;
- **Goniastrea favulus** — brain coral.

The licence evidence is clean CC0/Public Domain. These are materially more realistic source meshes than Lunar Ride's procedural coral.

Important compatibility constraint: the readily reusable optimized GLBs in that project are Meshopt-compressed and use KTX2/Basis textures. Lunar Ride's current lightweight glTF path has not been validated for those extensions. Do not simply copy those optimized files into the project without adding/validating decoder support or producing compatible uncompressed embedded glTF versions. v155 therefore fixes the immediately visible podium/continuity problem now while keeping controlled CC0 model import as a future fidelity step.

Earlier MiniPoly/Poly Pizza CC0 coral research also remains relevant, but any external asset must be verified for format, licence and runtime performance before shipping.

## Preserved Aqua systems
- **v154** `js/60-aqua-hero-coral-v154.js`: historical hero-cluster/pedestal layer; v155 supersedes its props result at runtime.
- **v153** `js/59-aqua-hq-coral-v153.js`: six recognizable coral geometry families / hybrid LOD.
- **v152** `js/58-aqua-proper-jelly-reef-v152.js`: 60 proper shared project jellyfish.
- **v151** `js/57-aqua-coral-jelly-v151.js`: historical procedural-jelly layer removed/superseded later.
- **v150** `js/56-aqua-faces-reef-v150.js`: reef-only cleanup / readable fish faces.
- **v149** `js/55-aqua-uturn-continuity-v149.js`: local U-turn school continuity.
- **v148** `js/54-aqua-tail-animation-v148.js`: baked body/tail animation.
- **v147** `js/53-aqua-swim-motion-v147.js`: horizontal swimming trajectory.
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish throughout the water column.
- **v145** `js/51-aqua-fish-visibility-v145.js`: fauna isolation + imported transform fix.
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 species, 258 fish total.
- **v143** `js/49-aqua-rift-v143.js`: Aqua Rift — Glass Ocean scene.

v155 does not modify actors, road, glass, water or tunnel systems. Regression verifies 60 v152 jellyfish and existing fish actors are preserved. Verdant v142 remains isolated.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v155 with cache-buster `?b=155` in order:
1. v143 base Glass Ocean
2. v144 real fish
3. v145 visibility/fauna isolation
4. v146 water-column distribution
5. v147 swimming trajectory
6. v148 body/tail animation + face-enhanced loader
7. v149 U-turn continuity
8. v150 reef-only cleanup / fish faces
9. v151 historical coral/procedural-jelly layer
10. v152 visible reef + proper shared jellyfish
11. v153 HQ recognizable coral geometry
12. v154 hero clusters / old pedestal composition
13. **v155 organic reef colonies / mound composition**

Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant invariants while caching Aqua through `js/61-aqua-coral-colonies-v155.js`, all fish assets and `assets/models/creature_jelly.gltf`.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects **v143→v155**:
- syntax for all Aqua layers and regressions;
- all runtime smoke/regression tests through v155;
- imported Quaternius fish asset/provenance checks;
- shared `creature_jelly.gltf` loader/meta checks;
- loader cache-busting `?b=155` for every Aqua layer;
- service-worker inclusion through js/61;
- Verdant v142 loader/cache isolation;
- v152 proper jelly regression markers;
- v153/v154 compatibility markers;
- v155 exact 2,800 placement budget, 280 heroes, 2,800 mounds, 840 accents, six coral families, substantial geometry and non-Aqua isolation.

Feature checkpoint results:
- Aqua `33398577795` — **SUCCESS**.
- Verdant `33398577774` — **SUCCESS**.

## Immediate visual test — v155
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look specifically for:
- black/podium-looking v154 bases should be gone;
- close reef should sit on irregular dark rock/rubble masses instead;
- primary hero colonies should look broader and more crowded, with multiple coral forms overlapping;
- reef should read more continuously on both sides;
- no coral enters the tube;
- frame rate remains smooth;
- same proper v152 jellyfish and all fish behavior remain;
- Verdant Rift is visually unchanged.

## Next task after this handoff
Wait for the user's v155 screenshot/performance feedback. If rooting/composition is now convincing but close individual coral fidelity remains the main weakness, the next major step should be a **compatible CC0 model-based hero path**, not another placement-count increase.
