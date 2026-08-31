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
- Aqua Rift current release is **v154**.
- v154 code/wiring/CI feature checkpoint: `ecfa09a111300e3f657df28ffb3bcfd620aeebfa`.
- Aqua CI run `33394089760`: **SUCCESS**.
- Verdant CI run `33394089757`: **SUCCESS** on the same feature checkpoint.
- Canonical backup immediately before v154: `backup-v153-before-aqua-hero-coral-v154` at exact v153 HEAD `875ab0fe414c418798870eccf1f4c15889065be9`.
- Earlier canonical backups remain available for v143→v153 history.
- `js/09-bluetooth.js` remains untouched.

## Visual result that triggered v154
The user visually tested v153 and supplied a screenshot. v153 was clearly better than v152 in silhouette variety, but the reef still looked too much like scattered low-poly props. Main observations:
1. individual coral still looked schematic / low-poly in several places;
2. the reef did not read as a rich continuous reef wall;
3. small isolated objects were visually dominated by the road and fish;
4. the large fan coral silhouette on the right was the strongest direction — recognizable, large and close to the rider.

The user explicitly asked to continue working. v154 responds first to the composition/scale/rooting problem before introducing a new external asset dependency.

## Aqua v154 — hero coral clusters + reef pedestals
New layer: `js/60-aqua-hero-coral-v154.js`.
Regression: `tests/aqua-v154-hero-coral-smoke.js`.

### Placement budget remains fixed
v154 still rebuilds `w.props` and keeps the exact established composition:
- 350 route stations;
- 4 groups per side per station;
- exact total **2,800 reef placements**;
- 700 near / 1,400 mid / 700 far.

The point is not more placements; it is to make the nearest placements visually read as reef gardens instead of isolated props.

### 280 hero groups
v153 had 140 highest-detail hero groups. v154 doubles the hero presence to **280 total**:
- **140 primary heroes** in the nearest band;
- **140 secondary heroes** in the second band.

Primary hero placement:
- one large main coral;
- three overlapping companion coral forms;
- large dark reef pedestal / ledge.

Secondary hero placement:
- one main coral;
- two overlapping companion forms;
- reef pedestal / ledge.

Telemetry verifies `heroGroups:280`, `primaryHeroes:140`, `secondaryHeroes:140`, `heroClusterCount:280`.

### Reef pedestals / rooting
Every one of the 2,800 groups gets a darker teal/rock reef base. Hero bases are larger and include layered ledges/blocks so the cluster reads as growing from a reef shelf instead of sitting as a tiny coloured object on a flat strip.

Telemetry: `reefPedestals:true`, `pedestalGroups:2800`, `clusteredComposition:true`, `closeWallFeeling:true`.

### Closer and larger near reef
v154 moves the nearest allowed placement from the prior `glassRadius + 1.35 m` target to approximately **`glassRadius + 1.10 m`** while still staying outside the glass envelope. Near/secondary bands are also biased larger so visible detail occupies more of the rider's field of view.

### Six retained coral families
The v153 geometry families remain and are enlarged/refined in v154:
1. branching / staghorn;
2. sea fan lattice;
3. ridged brain coral;
4. layered wavy plate coral;
5. hollow tube sponge;
6. soft branching coral.

Colour palette remains the established purple/pink/orange/turquoise/blue/cream weighting.

### Performance strategy
The cluster multiplication is limited to the 280 hero groups. Ordinary medium groups no longer automatically spawn extra companion models, so the close-up richness is concentrated where it can actually be seen. Far reef remains simpler LOD.

The v154 regression uses a simplified test `MeshB` and reports substantial geometry; do not treat its triangle telemetry as a literal production GPU triangle count. Visual frame-rate testing on the user's actual device is the deciding performance check.

## External coral model research
Before v154, external permissive coral assets were revisited.
- MiniPoly **Coral Reef Kit** on Poly Pizza was found.
- The primary **Coral Reef Set** is explicitly Public Domain / **CC0**.
- Other models in that bundle are CC-BY.

v154 does **not** import the external set. This iteration intentionally addresses the obvious screenshot composition problem with project-native geometry first, avoiding a new asset conversion/loader dependency.

If v154 composition is improved but the coral still looks too synthetic/low-poly, the next iteration should **not** merely add more procedural polygons. It should strongly favor a controlled CC0 model-based hero path, ideally importing only verified CC0 coral assets, documenting provenance, using a small hero count and maintaining strict LOD/performance limits.

## Preserved v152 jellyfish system
`js/58-aqua-proper-jelly-reef-v152.js` remains in the stack before v153/v154.
- 60 shared project jellyfish from `assets/models/creature_jelly.gltf`.
- `type:'gjelly'`, `gcre:'jelly'`, `meta:CREATURE.gjelly`.
- outside glass, three distance bands, four height bands.
- subtle v152 pulse retained.

v154 does not mutate actor arrays. Regression verifies all 60 proper v152 jellyfish remain.

## Retained Aqua systems
- **v153** `js/59-aqua-hq-coral-v153.js`: six recognizable coral geometry families / hybrid LOD; v154 supersedes its props result at runtime.
- **v152** `js/58-aqua-proper-jelly-reef-v152.js`: proper shared project jellyfish.
- **v151** `js/57-aqua-coral-jelly-v151.js`: historical layer; old procedural jellies removed by v152.
- **v150** `js/56-aqua-faces-reef-v150.js`: reef-only cleanup / fish faces.
- **v149** `js/55-aqua-uturn-continuity-v149.js`: local U-turn school continuity.
- **v148** `js/54-aqua-tail-animation-v148.js`: baked body/tail animation.
- **v147** `js/53-aqua-swim-motion-v147.js`: horizontal swimming trajectory.
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish throughout the water column.
- **v145** `js/51-aqua-fish-visibility-v145.js`: fauna isolation + imported transform fix.
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 species, 258 fish total.
- **v143** `js/49-aqua-rift-v143.js`: Aqua Rift — Glass Ocean scene, transparent tunnel/galleries/water.

Road, tunnel glass, water, fish swim/tail/faces/U-turn behavior and Verdant are intentionally isolated from v154.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v154 with cache-buster `?b=154` in order:
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
12. **v154 hero coral clusters / reef pedestals**

Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant invariants while caching Aqua through js/60, all fish assets and `assets/models/creature_jelly.gltf`.

During v154 wiring, a temporary typo changed the Verdant v121 cache filename; it was immediately corrected before the final CI checkpoint. Aqua CI now explicitly verifies `js/32-verdant-fauna-buildings-v121.js` remains in `sw.js` to prevent recurrence.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects **v143→v154**:
- syntax for all Aqua layers and regression tests;
- all runtime smoke/regression tests through v154;
- imported Quaternius fish asset/provenance checks;
- shared `creature_jelly.gltf` loader/meta checks;
- loader cache-busting `?b=154` for every Aqua layer;
- service-worker inclusion through js/60;
- Verdant v142 loader isolation and original v121 service-worker filename;
- v152 proper jelly regression markers;
- v153 HQ coral markers;
- v154 exact 2,800 placement budget, 280 hero groups, 2,800 pedestals, six coral families, substantial geometry and non-Aqua isolation.

Feature checkpoint results:
- Aqua `33394089760` — **SUCCESS**.
- Verdant `33394089757` — **SUCCESS**.

## Immediate visual test — v154
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look specifically for:
- close reef should read as larger clusters/gardens, not isolated little props;
- both sides should have more visually dominant hero groups;
- dark reef shelves/pedestals should make coral feel rooted;
- the large recognizable fan/branch/plate silhouettes should occupy more screen space;
- no coral should enter the glass tube;
- frame rate should remain smooth;
- same proper v152 jellyfish and all fish behavior should remain;
- Verdant Rift must remain visually unchanged.

## Next task after this handoff
Wait for the user's v154 screenshot/performance feedback. If composition is now good but coral object fidelity is still too low, make the next change a **controlled CC0 external coral model import** rather than another density increase or broad procedural complexity increase.
