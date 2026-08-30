# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Aqua/Verdant CI runs because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky visual/world changes.
- GitHub connector access is independent of local `git clone`; do not infer connector availability from container networking.

## Current checkpoint — 2026-08-30
- Current Verdant Rift release: **v142**.
- Current separate underwater world: **Aqua Rift v143 — Glass Ocean**.
- Aqua code/wiring checkpoint before this handoff: `93ebeca47c833d5cf7be2ebe0dc64e22d381fffe`.
- Aqua CI run `33336251881`: **SUCCESS**.
- Verdant regression CI run on the same Aqua checkpoint, `33336251906`: **SUCCESS**; all existing Verdant v142 tests still pass.
- Backup immediately before Aqua work: `backup-v142-before-aqua-rift`.
- Verdant's own pre-v142 backup remains `backup-v141-before-v142-mushroom-carpet-fix`.
- Important version rule: Aqua v143 is a **separate world**, not Verdant v143. `js/25-verdant-lite-richness.js` remains `RELEASE='142'` and service-worker cache remains `lunar-ride-v142` intentionally, while the Aqua v143 files are included in that cache.

## Aqua Rift v143 — separate underwater glass-tunnel world
Primary world file: `js/49-aqua-rift-v143.js`.
World card: `assets/images/aqua_rift_card.svg`.
Regression: `tests/aqua-rift-v143-smoke.js`.
CI workflow: `.github/workflows/aqua-ci.yml`.

Aqua is registered as a new menu world with:
- id `aqua`;
- name **Aqua Rift — Glass Ocean**;
- normal Lunar Ride controls, rider physics, trainer resistance and camera behavior;
- a gentler route (`maxGrade: 4.5`, `halfWidth: 3.6`, `loopR: 1120`, `twist: .62`);
- blue underwater atmosphere/fog and high bloom tuned independently from Verdant.

### Glass-tunnel experience
- The entire road is covered by a continuous transparent half-cylinder canopy rendered through the existing `world.glass` path.
- Base canopy radius is **8.8 m**.
- Four sections around the lap widen into panoramic glass galleries, adding up to about **6.4 m** to the radius so the rider periodically enters large aquarium-like chambers rather than one visually uniform tube.
- Opaque turquoise structural ribs and side rails make the transparent enclosure readable while riding.
- This is an original Lunar Ride construction inspired by the experience of an underwater aquarium tunnel, not a copy of another game's geometry.

### Ocean environment
- A large double-sided water-surface mesh sits about **48 m above the highest road point**, so the surface is visible overhead from below.
- Coral gardens begin outside the glass envelope: **220 coral structures** in five bright colour families.
- **140 kelp plants** are distributed outside the tunnel.
- The seabed remains visible through the glass, using the generated terrain beneath the route.

### Animated sea life
Aqua deliberately reuses the existing lightweight `type:'drone'` orbit/update path for swimming movement, avoiding changes to core render/physics code.
- **96 normal fish**;
- **12 giant fish**;
- **24 jellyfish**;
- **132 animated sea creatures total**.

Procedural actor meshes:
- `fishBlue`
- `fishGold`
- `fishViolet`
- `fishCoral`
- `jellyAqua`

Fish schools orbit outside the tube with gentle altitude movement; giant fish use slower, larger paths; jellyfish use the same low-cost movement mechanism with a distinct translucent-looking glowing procedural form.

Telemetry: `w.__aquaRiftV143` exposes version, route length, glass radius/gallery positions, fish/jelly populations, coral/kelp counts and water-surface height.

### Aqua integration safeguards
- `js/19-verdant-assets.js` loads `js/49-aqua-rift-v143.js?b=143` after the Verdant v142 correction layer.
- `sw.js` includes the Aqua JS and world card but intentionally retains cache name `lunar-ride-v142` so existing Verdant release/cache regression invariants remain valid.
- Aqua has its own CI workflow and smoke test.
- The full Verdant workflow also runs on Aqua commits; latest verified checkpoint passed both Aqua and Verdant suites.
- `js/09-bluetooth.js` was not modified.

## v142 — quarter mushrooms, bilateral hillside flower blankets, four-colour mix, bears x2
Active correction file: `js/48-verdant-mushroom-carpet-fix-v142.js`.
Regression: `tests/verdant-v142-mushroom-carpet-smoke.js`.

### Mushrooms
- Every currently rendered mushroom group is scaled by **0.25** relative to v141.
- This includes the uploaded mushroom model from v141 and the older baseline mushroom group.
- No mushroom-tree model is restored.

### Flower blankets
- The old one-sided `flower4MegaCarpetV139` runtime group is removed by v142 and rebuilt from the same approved 48 v139 patch centres.
- Every patch is generated on **both sides of the road**.
- Coverage reaches at least **170 m from the road centre** and follows `meshH()`, so it climbs the real green hillsides instead of remaining on a flat shoulder.
- Snow zone 7 and water are excluded.
- Global nearest-road clipping remains active; visible flowers still target about **10 cm from the asphalt edge**.
- The base model remains `Flower_4_Group.gltf`; GPU instancing remains intact.

### Random flower colours
The bilateral blankets are split into four GPU-instanced groups:
- `flower4HillsideCurrentV142` — **25% original colour**;
- `flower4HillsidePurpleV142` — **25% purple**;
- `flower4HillsideBlueV142` — **25% blue**;
- `flower4HillsideRedV142` — **25% red**.

Colour assignment uses a deterministic shuffled colour bag for each patch side, so the four colours are quarter-balanced but visually random and intermixed, not striped or clustered by colour. Clearly green leaf/stem vertices are preserved; tinting targets the non-green flower material.

### Bears
- Pre-v142 approved world had **7 bears** total.
- v142 counts the actual bear actors after all earlier world layers and adds only the missing number to reach **14 total**.
- New bears are placed deterministically across forest and alpine/descent areas.
- Existing bears are never removed.
- Imported `vbear` is used when ready, otherwise the existing procedural bear actor remains a fallback.

Telemetry: `w.__verdantVisualFixV142` exposes mushroom scaling, carpet counts/coverage, four colour counts, and bear before/target/added/final counts.

## v141 — uploaded mushroom model
Active files:
- `assets/models/verdant_mushroom_uploaded_v141.gltf`
- `js/46-verdant-uploaded-mushroom-model-v141.js`
- `js/47-verdant-uploaded-mushroom-replace-v141.js`

The user's uploaded single mushroom was optimized to a lightweight self-contained glTF and replaced v140's generic giant/small mushroom display groups. v142 retains that model but quarters all mushroom instance scales.

## v140 — approved wildlife/building expansion retained
Active file: `js/45-verdant-wildlife-buildings-mushrooms-v140.js`.
- robot cats: **10x** pre-v140 population;
- exactly half of final cats are **2x scale**;
- robot dragonflies: **10x**;
- deer/stags: **3x**;
- buildings: **5x**;
- includes paired roadside building sites so the road passes between structures;
- all requested animal/building multipliers remain protected by regression tests.
- v142 changes bears separately and does not alter cats, dragonflies, deer or buildings.

Backup before v140: `backup-v139-before-v140-wildlife-buildings-mushrooms`.

## v139 — approved Flower_4 mega-carpet source
Active source file: `js/44-verdant-purple-flower-megacarpets-v139.js`.
- 48 carpet centres around the full 25 km lap;
- original target 113,760 Flower_4 instances;
- road-edge gap ~0.10 m.
- In v142, its runtime one-sided group is replaced by the bilateral four-colour hillside groups, but its patch definitions remain the source geometry/profile.

Backup before v139: `backup-v138-before-v139-mega-purple-carpets`.

## Approved tree state
### v137 TwistedTree
`js/42-verdant-twisted-tree-mix-v137.js`
- only `twisted1/twisted3`;
- 50% bright-red current form;
- 50% exact v133 alpha-aware darker/denser form.

Backup: `backup-v136-before-v137-twisted-50-50`.

### v136 CommonTree
Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree mix:
- 65% original bright;
- 25% darker foliage/original geometry;
- 10% exact v133 alpha-aware compact form.

Do not reactivate rejected `js/40-verdant-common-tree-structure-v135.js`.

## Rejected experiments / lessons
- v132 bundled too many unrelated changes and was rejected. Never restore it wholesale.
- v133 global alpha-aware changes were rejected globally; only the selectively approved CommonTree/TwistedTree looks remain.
- v135 synthetic CommonTree deformation was rejected.
- v130 photogrammetry palms were rejected and remain removed.

## Current unresolved green blade objects
The narrow/elongated green blade/plank/tree-like objects still have no proven runtime/model source. Do not remove a family based only on appearance. Identify the exact model/runtime key first, then change one source at a time while preserving v136/v137/v140/v141/v142.

## Retained world systems
- v129 world cleanup remains Verdant baseline: legacy triangular `w.veg` disabled, global route-nearest filtering, road support and wildlife density retained.
- Verdant mountains retain v126/v128/v129 protections and anti-dome work.
- Verdant sky remains v131 atmosphere-only.
- GPU nature instancing remains `js/28-verdant-instanced-renderer.js`; do not bake duplicated vegetation geometry.
- Settlements originate in v121 and are expanded by v140.
- Wildlife originates in v125/v129, is expanded in v140, and bears are restored to 14 by v142.
- Aqua is separate from all these Verdant-specific layers and should remain isolated unless the user explicitly asks to share an asset/system.

## CI
Verdant workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.
Aqua workflow: `.github/workflows/aqua-ci.yml` on pushes to `fixes-build-90`.

Verdant CI protects syntax, generated world/geometry, v121/v122/v123/v125/v126/v129 behavior, asset dependencies, rejected palm removal, v134/v136/v137 tree states, v139 carpet source, v140 multipliers/buildings, v141 uploaded mushroom, v142 quarter-scale mushrooms + bilateral hillside carpets + four-colour random mix + 14 bears, atmosphere/mountain retention, and v142 release/cache/load wiring.

Aqua CI protects Aqua syntax, runtime world registration, non-empty glass/water/reef geometry, exact 96+12+24 sea-life populations, Aqua loader/cache/card wiring, and verifies Verdant v142 wiring remains present.

## Immediate visual/performance test
Run `UPDATE.bat` → close/reopen `ride.bat` → `Ctrl+F5`.

For the new world choose **Aqua Rift — Glass Ocean**. First visual pass should check:
- whether the glass canopy reads as a transparent underwater tunnel rather than an opaque blue roof;
- whether 8.8 m feels like the right base radius and the four widened galleries feel dramatically larger;
- whether the water surface is convincingly overhead;
- whether coral and kelp are clearly outside the glass rather than intruding into the road;
- whether the 96 normal fish + 12 giant fish + 24 jellyfish are visible enough without looking crowded;
- first-person and third-person camera views;
- FPS/startup time.

This is the **first playable Aqua implementation verified by CI**, not yet visually approved from an in-game screenshot. The next step should be screenshot-driven tuning of glass opacity, tunnel radius, fish density/scale, water height, reef density and colour balance. Preserve Verdant v142 while tuning Aqua.

For Verdant, confirm **Verdant Rift · v142** and retain the previously approved mushroom/carpet/colour/bear behavior.
