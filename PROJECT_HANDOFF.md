# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky visual/world changes.

## Current checkpoint — 2026-08-30
- Current Verdant Rift release: **v140**.
- Main v140 code commit: `d530171aa3555e79496b09c84690e7d7447a59f5`.
- Code CI run `33330199613`: **SUCCESS**; every step passed, including the new runtime multiplier/building/mushroom regression.
- Backup immediately before v140: `backup-v139-before-v140-wildlife-buildings-mushrooms`.
- v139 remains the approved rollback point for trees, purple mega-carpets and the pre-expansion wildlife/building population.

## v140 — wildlife x10/x3, buildings x5, roadside pairs, mushrooms
New active file: `js/45-verdant-wildlife-buildings-mushrooms-v140.js`.

The layer runs after all retained v139 world layers and counts the **actual current actor population** before adding anything. It therefore targets real final multipliers rather than approximate hard-coded additions.

Wildlife behavior:
- robot cats (`gcre: cat`) target **10x** their pre-v140 population;
- exactly **50% of the final cat population** is made from new 2x-scale giant cats; the other half remains/currently becomes normal-sized;
- robot dragonflies (`gcre: dfly`) target **10x** their pre-v140 population;
- deer/stags (`gcre: stag`) target **3x** their pre-v140 population;
- new animals are distributed as many visible groups/swarms/herds around the full 25 km lap, not as one uniform line;
- existing animal state/metadata patterns from v125 are reused so added animals remain compatible with the existing movement/flee/float behavior.

Buildings:
- uses the actual `w.__verdantV121.buildings` count as baseline and targets **5x total buildings**;
- adds up to four times the existing count using existing GLTREES building families, favoring lighter models while retaining visual variety;
- includes **16 planned paired roadside sites**, with one building on each side when the target count permits, so the road visibly passes between structures;
- roadside pair offsets account for road half-width + building footprint/foundation + a small pedestrian gap, rather than placing foundations on the asphalt;
- remaining added buildings form many smaller settlements farther from the road;
- all new static building geometry is appended once to `w.props`.

Mushrooms:
- deliberately does **not** restore the rejected bundled v132 code;
- reuses the already-loaded `assets/models/Mushroom_Common.gltf` through GPU instancing;
- adds **240 giant mushrooms**, scaled from the 0.46 m source model to roughly **4–8 m tall**, distributed in obvious groves around the lap;
- adds **2,400 smaller mushrooms** in denser patches;
- all candidates use globally-nearest-road rejection with mushroom-cap radius accounted for, so giant caps should not intrude onto the road;
- instanced groups: `mushroomGiantV140` and `mushroomPatchV140`.

Telemetry: `w.__verdantExpansionV140` exposes base/target/added/final animal and building counts plus mushroom counts.

Regression: `tests/verdant-v140-wildlife-buildings-mushrooms-smoke.js` executes the layer against a mocked world and verifies exact 10x cats, 10x dragonflies, 3x stags, half-final giant cats, 5x buildings with paired-road sites, 240 giant mushrooms and 2,400 small mushrooms while preserving existing nature groups.

## v139 — approved mega purple Flower_4 carpets
Active file: `js/44-verdant-purple-flower-megacarpets-v139.js`.
- 48 carpet centres distributed nearly evenly around the full 25 km lap;
- roughly 4x area per carpet versus v138;
- target **113,760 GPU-instanced Flower_4 groups**;
- globally-nearest-road clipping targets a visible plant edge about **0.10 m from asphalt**;
- trees/wildlife/terrain/buildings/mountains/sky are untouched by this layer.

Backup before v139: `backup-v138-before-v139-mega-purple-carpets`.

## v137 — approved red TwistedTree 50/50 mix
Active file: `js/42-verdant-twisted-tree-mix-v137.js`.
- only `twisted1` / `twisted3`;
- 50% current bright-red form;
- 50% exact v133 alpha-aware darker/denser form;
- preserves total count, location, yaw and scale.

Backup: `backup-v136-before-v137-twisted-50-50`.

## v136 — approved CommonTree mixture
Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree distribution:
- **65%** original bright v131 CommonTree;
- **25%** original geometry with darker foliage from v134;
- **10%** exact v133 alpha-aware compact CommonTree form.

Only `common1/common3/common5` are affected.

Important backups:
- `backup-v135-before-v136-real-compact-common`
- `backup-v134-before-v135-common-tree-structure-mix`
- `backup-v131-before-v134-common-tree-mix`

## Rejected experiments / lessons
- **v132 rejected:** bundled tree cleanup, road props, mushroom tree, extra wildlife/buildings and richer sky; changed too much and was rolled back. Do not restore the whole bundle.
- **v133 broadly rejected but useful:** alpha-aware fix applied to CommonTree + TwistedTree + Pine globally; later reused only selected looks.
- **v135 rejected:** synthetic geometry deformation did not reproduce the desired compact CommonTree.

Rule: keep visual changes isolated and get screenshots after each small change.

## Current problematic green blade objects
User has supplied close-ups of narrow/elongated green blade/plank/tree-like objects. Their exact runtime/model source is still **not proven**. Do not remove a tree family based only on appearance. Next debugging should identify the exact runtime/model key with labelled lineup/instrumentation and then change one model at a time while preserving approved v136/v137/v139/v140 work.

## Retained world systems
- v129 world cleanup remains baseline: no legacy triangular `w.veg`, global route-nearest plant filtering, final road support, additional wildlife density.
- Mountains retain v126/v128/v129 protections and anti-dome work.
- Sky remains the v131 atmosphere-only sky; rejected v132 planet/cloud sky is not active.
- GPU vegetation instancing remains in `js/28-verdant-instanced-renderer.js`; do not bake duplicated vegetation meshes.
- Wildlife retained from `js/36-verdant-wildlife-v125.js` + `js/38-verdant-world-cleanup-v129.js`, then expanded by v140.
- Original settlements retained from `js/32-verdant-fauna-buildings-v121.js`, then expanded by v140.

## Uploaded GLB candidates
Four newer GLBs were inspected but are not active. The third is a mushroom-tree candidate. v140 intentionally uses the already-supported `Mushroom_Common.gltf` instead of reintroducing the heavy/rejected candidate; the uploaded candidate can still be revisited independently later if desired.

## CI
Workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.
It protects syntax, generated world/geometry, wildlife, retained v121/v122/v123/v125/v126/v129 behavior, dependency integrity, rejected palm removal, v134 CommonTree mix, v136 exact compact CommonTree, v137 TwistedTree 50/50 split, v139 purple mega-carpets, v140 exact wildlife/building/mushroom expansion, atmosphere/mountain retention and current release/cache/load wiring.

## Immediate visual/performance test
Run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5 and confirm **Verdant Rift · v140**. Check several kilometres, not only the start. Desired result: dramatically more robot cats and dragonfly swarms, obvious deer herds, roughly half the cats visibly giant, many more buildings including road-between-buildings moments, and clearly visible 4–8 m giant mushroom groves plus small mushroom patches. Also watch FPS/startup time because v139 already carries ~114k flower transforms and v140 intentionally adds a large actor/building population. If performance is the only issue, preserve the requested visual density first and optimize culling/instancing rather than immediately removing approved content.
