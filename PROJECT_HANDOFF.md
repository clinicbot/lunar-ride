# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow

- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- Open draft PR targets `main`.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky world/visual changes.

## Current checkpoint — 2026-08-30

- Current Verdant Rift release: **v130**.
- Current code HEAD before this handoff update: `d5fea3fa8cd27003c7bc999778933237c3857205`.
- Verdant CI run `33314558729`: **SUCCESS**; all steps passed, including the new v130 palm regression plus all retained road/terrain/wildlife regressions.
- Backup immediately before v130 palm integration: `backup-v129-before-v130-photogrammetry-palms`.
- Earlier backups retained: `backup-v128-before-v129-world-cleanup`, `backup-v127-before-v128-mountain-cleanup`, `backup-v125-before-v126-mountains`.
- Next user test: `UPDATE.bat`, close/reopen, Ctrl+F5, confirm **Verdant Rift · v130**, then inspect the jungle/transition section roughly **8.8–14.2 km** for the new palms and watch phone performance.

## v130 — optimized photogrammetry palms

The user supplied a dense photogrammetry tropical palm GLB (~14.7 MB / ~292,648 triangles). It was far too heavy for direct phone/WebGL instancing, so it was reduced and converted to vertex-coloured self-contained glTF assets.

### Runtime models

For reliable GitHub text upload and very small runtime cost, the optimized palm is split into self-contained glTF parts with embedded base64 buffers and no external texture/bin dependencies:

Hero model, reconstructed from four parts:
- `assets/models/verdant_palm_hero_v130_part1.gltf`
- `assets/models/verdant_palm_hero_v130_part2.gltf`
- `assets/models/verdant_palm_hero_v130_part3.gltf`
- `assets/models/verdant_palm_hero_v130_part4.gltf`
- Combined Hero budget: **1,248 triangles**.

LOD model, reconstructed from two parts:
- `assets/models/verdant_palm_lod_v130_part1.gltf`
- `assets/models/verdant_palm_lod_v130_part2.gltf`
- Combined LOD budget: **538 triangles**.

The original texture look was baked into vertex colours. This deliberately trades some close-up texture detail for excellent phone performance and keeps the original photogrammetry silhouette rather than the old procedural/cartoon palm.

### Integration

Main file: `js/39-verdant-photogrammetry-palms-v130.js`.

- Loads and joins the glTF parts once.
- Expands indexed parts into the `pos/nrm/col/count` format already consumed by `js/28-verdant-instanced-renderer.js`.
- Adds `palmHero` and `palmLod` to `w.instNature`, so the existing GPU instancing architecture draws them; do not bake duplicated palm meshes into world props.
- Hero palms are sparse and relatively close to the route; LOD palms are more numerous and farther away.
- Main placement anchors span ~9.18–13.86 km, with transition LOD palms near ~8.82/8.96 and 14.05/14.18 km.
- Hero scale is roughly 9.2–12.9 m; LOD roughly 7–11.4 m.
- Every candidate is checked with `w._dbg.roadNear()` against the globally nearest route leg. Hero minimum road clearance is ~11.5 m and LOD ~17.5 m, with retry offsets if a candidate is too close.
- Telemetry: `w.__verdantPhotogrammetryPalmsV130` reports Hero/LOD counts, skipped-road attempts and model triangle counts.
- Asset load gate displays `Loading photogrammetry palms` if needed and waits before building Verdant.
- `window.__verdantPalmAssetsV130` exposes load state/models/wait for diagnostics.

### v130 wiring

`js/19-verdant-assets.js` load order near the end is intentionally:
1. `js/38-verdant-world-cleanup-v129.js`
2. `js/27-verdant-billboard-cleanup.js`
3. `js/39-verdant-photogrammetry-palms-v130.js`
4. `js/28-verdant-instanced-renderer.js`

This means v129 cleanup happens first, the v130 palm layer adds road-safe instances next, and the GPU renderer uploads the final `instNature` plan afterward.

Release label: `js/25-verdant-lite-richness.js` -> `RELEASE='130'`.
Service-worker cache: `sw.js` -> `lunar-ride-v130`; it caches `js/39` and all six palm part files for offline use.

## v129 retained world cleanup

v129 fixed four independent visual/runtime problems and remains fully active under v130:

1. **Giant green triangular silhouettes:** old ~26k billboards could survive an async nature-loading race. `js/26`, `js/27`, and `js/38` now hard-disable legacy `w.veg`; asset gate waits for imported nature settlement. Never re-enable the old billboards as a fallback.
2. **Plants on the road:** the folded 25 km route can pass near itself. `js/38` validates imported plant transforms against the globally nearest road leg (`w._dbg.roadNear`), not only the route sample that spawned the plant.
3. **Grass/terrain intruding into asphalt:** `js/37-verdant-mountains-v129.js` builds a final roadbed (`ROAD_FLAT=29`, `ROAD_BLEND=72`), recalculates normals and updates `meshH/groundAt`.
4. **Residual smooth green domes:** `js/37` adds a global anti-dome ridge/saddle pass to real 3-D base terrain.
5. **Sparse wildlife:** `js/38` adds 14 more stag/deer herds plus additional cat, bear, monkey and bird groups while retaining v125 wildlife/flee behavior.

Telemetry includes `w.__verdantRoadbedV129`, `w.__verdantMountainsV129`, `w.__verdantRoadPlantCleanupV129`, and `w.__verdantWildlifeV129`.

## Retained mountain / sky history

- `js/35-verdant-mountains-v123.js` retains v126 full-route mountain replacement: `ROAD_CORE=46`, `ROAD_FADE=84`, full replacement beyond 130 m; subtracts the old radial perimeter uplift and adds asymmetric ridges/erosion.
- v128 also subtracts/replaces the old broad alpine Gaussian mass and exposes `w.__verdantMountainsV128`.
- `assets/images/sky_verdant.svg` has **no painted mountain/hill/triangle paths** — only atmosphere/clouds/haze. Unwanted mountain silhouettes therefore come from real geometry or vegetation, not painted sky art.

## Road/material

- v123 restored clean core asphalt after `PathRocks_Diffuse` made the road look green/grass-contaminated.
- `tests/verdant-v123-regression-smoke.js` protects the asphalt/material behavior.

## Imported nature / performance rules

- Main imported-nature source: `js/26-verdant-real-nature.js`.
- GPU instancing: `js/28-verdant-instanced-renderer.js`.
- Never regress to duplicating thousands of imported meshes into world props.
- Any new vegetation must be checked against the **globally nearest route leg** because the route folds near itself.
- Prefer a sparse imported scene over any legacy billboard fallback.

## Wildlife / settlements retained

- `js/36-verdant-wildlife-v125.js`: retained deer herds, cats, bears, moving frogs, dragonfly swarms, bird flocks, monkey troops/jellies and flee behavior.
- `js/38` adds the v129 density expansion.
- `js/32-verdant-fauna-buildings-v121.js`: 16 building placements in outpost (~5–6 km), main sky-port city (~16–18 km), summit relay (~21–22 km).
- `js/34-verdant-assets-gate-v123.js` waits for buildings, creatures and imported nature; current timeout is 24 s.

## CI

Workflow: `.github/workflows/verdant-ci.yml`, runs on pushes to `fixes-build-90`.

It protects:
- JS syntax;
- generated world + real geometry;
- wildlife runtime;
- retained v121/v122/v123/v125/v126 behavior;
- retained v129 anti-dome/roadbed/billboard-kill/nearest-road/wildlife behavior;
- creature/building and imported-nature asset integrity;
- **v130 palm assets**: valid glTF 2.0, self-contained buffers, Hero exactly 1,248 tris, LOD exactly 538 tris, performance budgets, roadNear/telemetry integration;
- atmosphere-only sky + retained v128 alpine cleanup;
- current v130 release/cache/load-order wiring.

Retained behavior tests should be release-agnostic. Do not pin an old v125/v126/v129 regression to a cache number or timeout just because the release advances.

## Continue protocol

User can say:

> Continue my Lunar Ride project. Repository `clinicbot/lunar-ride`, branch `fixes-build-90`. Read `PROJECT_HANDOFF.md`, then inspect the latest HEAD and latest Verdant CI run before making any changes.

Always refresh HEAD/CI rather than trusting the exact SHA written here.
