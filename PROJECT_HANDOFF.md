# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow

- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- Open draft PR targets `main`.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- `ride.bat` supports both `python` and `py` launchers.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky world/visual changes.

## Current checkpoint — 2026-08-30

- Current Verdant Rift release: **v132**.
- Main v132 code commit: `a4b5beb0d732d8c89781c4eddb121aee4e384b1b` (`Verdant v132 living world and richer sky`).
- Verdant CI run `33320972343`: **SUCCESS**; all steps passed including syntax, generated world, geometry, retained regressions, v132 expansion test, sky test, and current wiring.
- Backup immediately before v132 world/sky work: `backup-v131-before-v132-world-sky`.
- Earlier relevant backup: `backup-v130-before-v131-remove-palms`.
- The rejected v130 photogrammetry palms remain fully removed.

## v132 — giant-tree cleanup, road cleanup, mushroom grove, wildlife, buildings, sky

Main new file: `js/39-verdant-v132-expansion.js`.

### Oversized green broadleaf removal

The large green broadleaf objects seen by the user in v131 were traced to the imported `TwistedTree` family. `TwistedTree_1.gltf` reaches roughly 16.5 m before instance scaling, versus about 7 m for a normal `CommonTree_1`.

v132:
- removes runtime groups `twisted1` and `twisted3` completely;
- adds `MAX_TREE_HEIGHT=9.5` and drops any remaining imported tree instance whose model-height × scale exceeds that limit;
- keeps the normal imported nature architecture/GPU instancing.

### Final baked-prop road cleanup

v129 already filters `instNature`, but a thin green baked prop was still visible in the middle of the asphalt. v132 adds `cleanPropsNearRoad()` after all world construction. It removes baked `w.props` triangles whose X/Z centroid falls inside the road width plus a 2.4 m safety margin. Telemetry: `w.__verdantV132.roadPropTrianglesRemoved`.

### Alien mushroom-tree grove

The third newly uploaded GLB (`tmp_qap7x4r.glb`, raw ~155,978 triangles) was simplified and committed as a compact base64-encoded GLB text asset:
- `assets/models/verdant_mushroom_tree_v132.b64.0`
- current runtime asset is about 1,198 triangles (CI enforces <3,000);
- retains `POSITION`, `NORMAL`, `COLOR_0` and indexed geometry;
- loaded once by v132 and expanded into the existing `w.instNature` GPU-instancing format;
- no duplicated baked meshes.

Main groves are placed roughly **9.1–13.9 km**, with road-aware placement and target heights about 4–8 m. The v132 start gate waits briefly for this small asset so the grove is deterministic.

The other three uploaded GLBs remain candidates and are not yet integrated.

### Wildlife expansion

v132 adds on top of all retained v125/v129 wildlife:
- 6 additional bear herds, typically 4–6 bears each;
- 10 additional robot-cat groups, typically 6–9 cats each;
- 12 additional dragonfly swarms, typically 8–12 dragonflies each;
- 8 additional deer/stag herds, typically 7–10 animals each.

All use existing creature assets and lightweight actor behavior rather than new heavy meshes. Telemetry is under `w.__verdantV132`.

### More settlements

v132 attempts 16 extra building placements across four new clusters, with a separate 300k-triangle safety budget:
- field lab cluster around ~2.7–3.2 km;
- wetland/research cluster around ~8.5–9.0 km;
- mushroom-grove settlement around ~13.8–14.4 km;
- far relay cluster around ~23.1–23.7 km.

It reuses the existing station/city glTF families and automatic terrain foundations. Actual placed count may be lower if the triangle budget is reached; `w.__verdantV132.extraBuildings` and `skippedBuildings` report it.

### Richer sky

`assets/images/sky_verdant.svg` remains free of painted terrain/mountain paths, but v132 now contains:
- `cloud-layer-high`;
- `cloud-layer-mid`;
- `cloud-layer-low`;
- denser mist/haze;
- a large restrained `ringed-planet` sci-fi landmark.

No `<path>` landscape silhouettes are allowed, preserving the v128 guarantee that mountains come only from real 3-D terrain. `js/18-verdant-weather.js` loads `sky_verdant.svg?b=132`; rain/mist behavior remains visual-only.

## Retained v129 world cleanup

v129 remains active under v132:
1. legacy 26k billboard vegetation is hard-disabled;
2. imported plants are filtered against the globally nearest route leg;
3. final terrain roadbed uses `ROAD_FLAT=29`, `ROAD_BLEND=72`;
4. anti-dome shaping removes residual smooth terrain domes;
5. v129 wildlife density remains in addition to v132.

Telemetry: `w.__verdantRoadbedV129`, `w.__verdantMountainsV129`, `w.__verdantRoadPlantCleanupV129`, `w.__verdantWildlifeV129`.

## Retained mountain / road history

- `js/35-verdant-mountains-v123.js` retains v126 full-route replacement: `ROAD_CORE=46`, `ROAD_FADE=84`, full replacement after 130 m.
- v128 subtracts/replaces the old broad alpine Gaussian mass and exposes `w.__verdantMountainsV128`.
- v123 restored clean asphalt after `PathRocks_Diffuse` contaminated the road appearance.

## Performance rules

- Imported nature: `js/26-verdant-real-nature.js`.
- GPU instancing: `js/28-verdant-instanced-renderer.js`.
- Never duplicate thousands of imported meshes into world props.
- Any new vegetation must use the globally nearest route-leg check.
- Keep giant/unnormalized tree assets out of near-road vegetation.

## Current v132 wiring

`js/19-verdant-assets.js` loads all Verdant layers with `?b=132` and near the end intentionally loads:
1. `js/38-verdant-world-cleanup-v129.js`
2. `js/27-verdant-billboard-cleanup.js`
3. `js/39-verdant-v132-expansion.js`
4. `js/28-verdant-instanced-renderer.js`

Release label: `js/25-verdant-lite-richness.js` -> `RELEASE='132'`.
Service-worker cache: `sw.js` -> `lunar-ride-v132`; it also caches the v132 mushroom-tree asset.

## CI

Workflow: `.github/workflows/verdant-ci.yml`, runs on pushes to `fixes-build-90`.

It protects all retained earlier behavior plus `tests/verdant-v132-expansion-smoke.js`, which checks:
- TwistedTree removal and 9.5 m tree-height cap;
- final baked-prop road cleanup;
- bear/cat/dragonfly/deer expansion markers;
- extra settlement markers;
- mushroom GLB validity/attributes and <3,000 triangle budget;
- cloud layers and ringed planet;
- no painted landscape `<path>` elements;
- v132 release/cache/loader wiring.

Retained behavior tests should remain release-agnostic where possible.

## Next user visual test

Run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5, confirm **Verdant Rift · v132**.

Important places to inspect:
- ~0–1 km: verify the thin green prop no longer appears on the asphalt and giant green TwistedTree objects are gone;
- ~2.7–3.2 km: new field-lab buildings;
- ~8.5–9.0 km: new wetland settlement and increased wildlife;
- ~9.1–13.9 km: new mushroom-tree groves + dense dragonflies/cats/bears/deer;
- ~13.8–14.4 km: grove settlement;
- ~23.1–23.7 km: far relay additions;
- throughout: richer clouds and ringed planet visibility.

## Continue protocol

User can say:

> Continue my Lunar Ride project. Repository `clinicbot/lunar-ride`, branch `fixes-build-90`. Read `PROJECT_HANDOFF.md`, then inspect the latest HEAD and latest Verdant CI run before making any changes.

Always refresh HEAD/CI rather than trusting the exact SHA written here.
