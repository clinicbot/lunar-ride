# Lunar Ride — project handoff

This file is the persistent continuation note for future ChatGPT sessions. Before changing code, read this file and then verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow

- Repository: `clinicbot/lunar-ride`
- Active development/test branch: `fixes-build-90`
- Do not modify `main` directly. There is an open draft PR from `fixes-build-90` to `main`.
- User updates the local Windows copy with `UPDATE.bat`, which runs `git pull --ff-only origin fixes-build-90`.
- After updating, close/reopen Lunar Ride and use Ctrl+F5 when testing a new release.
- Keep `js/09-bluetooth.js` untouched unless a Bluetooth change is explicitly requested.
- Preserve working versions with backup branches before risky visual/world changes.

## Current checkpoint — 2026-08-30

- Current Verdant Rift release: **v129**.
- Main v129 code commit: `dff4d382bb1f1ff056ac6b2fea68d7b98a929b05` (`Verdant v129 fix road plants domes and wildlife density`).
- Follow-up regression-test commit: `cd4bd80f098b1187024259a69e769cb8a3c4e077` (`Make v123 asset gate regression release-agnostic`).
- CI run `33308353773`: **SUCCESS**. All steps passed, including syntax, generated world, real geometry, wildlife runtime, retained v121/v122/v123/v125/v126 regressions, the new v129 cleanup regression, all asset validation, atmosphere/v128 mountain retention, and v129 release wiring.
- Backup created immediately before v129: `backup-v128-before-v129-world-cleanup`.
- Earlier backups retained: `backup-v127-before-v128-mountain-cleanup`, `backup-v125-before-v126-mountains`.
- The next real-world task is visual testing by the user after `UPDATE.bat` + close/reopen + Ctrl+F5. Confirm scene label **v129** and revisit the screenshot locations around the early lap/full lap.

## What v129 fixes and why

The user's v128 screenshots finally exposed that several visually similar defects had different sources. v129 addresses all of them together instead of treating everything as one mountain problem.

### 1. Giant green triangular silhouettes — asynchronous legacy billboard race

- Base Verdant still creates a legacy ~26,000-quad billboard vegetation field in `js/17-verdant-rift.js`.
- `js/26-verdant-real-nature.js` previously kept that field if the imported nature models had not finished parsing at world-build time.
- `js/34-verdant-assets-gate-v123.js` waited for buildings and creatures, but **not imported nature**. Therefore entering Verdant quickly could preserve the old triangular billboard forest for the whole ride even though some modern imported vegetation was also visible.
- v129 exposes imported-nature readiness through `window.__verdantNatureStatusV129` / `window.__verdantNatureWaitV129` and the asset gate now waits for nature settlement too.
- v129 never resurrects legacy billboards as a fallback: `js/26` sets `w.veg=null` when core imported nature is unavailable, and `js/27-verdant-billboard-cleanup.js` hard-disables `w.veg` unconditionally for Verdant.
- `js/38-verdant-world-cleanup-v129.js` repeats the hard kill as final defense.

### 2. Plants appearing on the road — folded-route placement bug

- Imported/natural vegetation layers place a plant at an offset from the route sample that spawned it.
- Because the 25 km route folds through the 5.2 km map, a plant can be safely offset from one route leg while accidentally landing on a **different nearby route leg**.
- `js/38-verdant-world-cleanup-v129.js` now filters **every imported nature instance** against `w._dbg.roadNear(x,z)`, i.e. the globally nearest road leg, with kind/scale-aware clearances for trees, bushes, ferns, flowers, mushrooms and rocks.
- Telemetry: `w.__verdantRoadPlantCleanupV129` reports checked, rejected and retained instances by kind.

### 3. Grass/terrain intruding into asphalt — final roadbed support

- Verdant terrain uses a 16 m grid. Earlier near-road flattening was not wide enough to guarantee that a diagonal terrain triangle could never poke toward the narrow road ribbon after subsequent terrain passes.
- New file `js/37-verdant-mountains-v129.js` runs after the retained v128 mountain layer and **before vegetation/fauna placement**.
- It creates a final roadbed shelf: `ROAD_FLAT=29` m, blending to `ROAD_BLEND=72` m, with terrain target around `ry - 0.34` while the road ribbon is around `ry + 0.08`.
- It recalculates normals and updates `meshH` / `groundAt` after the pass.
- Telemetry: `w.__verdantRoadbedV129`, including `minRoadClearanceM`.

### 4. Remaining smooth green dome-like hills — base low-frequency terrain

- v126 removed/replaced the original radial perimeter uplift.
- v128 removed/replaced the old alpine Gaussian mass and removed painted skyline mountains from the SVG.
- The v128 screenshots nevertheless showed broad smooth green hills. At that point the sky SVG contained no landscape paths, proving these were **real 3-D base terrain**, mainly the broad low-frequency `bareLand()` noise rather than another hidden sky image.
- `js/37-verdant-mountains-v129.js` therefore adds a **global anti-dome ridge/saddle pass** to elevated smooth terrain, starting outside the final road-support core and becoming strong quickly. It changes silhouette, not merely texture, and applies stronger stone colour to elevated/rugged surfaces.
- Telemetry: `w.__verdantMountainsV129`.

### 5. Wildlife felt sparse despite v125

Retained v125 wildlife is still in `js/36-verdant-wildlife-v125.js`, but ten deer-herd locations across 25 km left long stretches where little was visible. v129 keeps all retained animals and adds a new final density layer in `js/38-verdant-world-cleanup-v129.js`:

- **14 additional stag/deer herds**, generally 7–11 animals each, interleaved with the retained ten herds;
- **8 additional cat groups**;
- **4 additional bear groups**;
- **5 additional monkey troops**;
- **12 additional bird flocks**, generally 6–9 birds each.
- New land animals carry `rdx/rdz` road references so the existing flee behavior can still work.
- Telemetry: `w.__verdantWildlifeV129`.

## Verdant Rift world / wiring

- Scene id: `verdant`.
- One continuous closed route, about 25 km, no road junction choices.
- Route/world builder: `js/17-verdant-rift.js`.
- Weather: `js/18-verdant-weather.js`; route-aware rain/mist, visual only; sky cache-bust is `?b=129`.
- Verdant loader/wiring: `js/19-verdant-assets.js`.
- Release label: `js/25-verdant-lite-richness.js` (`RELEASE='129'`).
- Service worker: `sw.js`, cache `lunar-ride-v129`.
- New v129 terrain/roadbed layer: `js/37-verdant-mountains-v129.js`.
- New v129 final plant/wildlife cleanup layer: `js/38-verdant-world-cleanup-v129.js`.
- Current important load order: terrain polish -> retained v128 mountain pass (`js/35`) -> v129 anti-dome/roadbed (`js/37`) -> nature/enrichment/fauna -> readiness gate -> retained v125 wildlife (`js/36`) -> v129 final cleanup (`js/38`) -> hard billboard cleanup (`js/27`) -> GPU instanced renderer (`js/28`).

## Retained mountain history

### v126 radial-perimeter replacement

`js/35-verdant-mountains-v123.js` retains the v126 algorithm that subtracts the original radial ring and replaces it with asymmetric multi-scale ridges/erosion.

- Hard road protection: `ROAD_CORE=46` m.
- Fade: `ROAD_FADE=84` m.
- Full replacement beyond 130 m.
- Updates normals, colouring, `meshH` and `groundAt`.
- Telemetry remains `w.__verdantMountainsV126` for release-agnostic regressions.

### v128 legacy alpine Gaussian removal

- Original `bareLand()` contains a broad `235*Math.exp(...)` alpine mass.
- v128 explicitly subtracts it away from the protected road corridor and replaces it with anisotropic ridge systems/noise/erosion.
- Telemetry: `w.__verdantMountainsV128`.

### v128 atmosphere-only sky

- `assets/images/sky_verdant.svg` contains **no painted mountain/hill/triangle paths**; only sky gradient, cloud ellipses and haze.
- This is intentionally retained so unwanted landscape silhouettes can be diagnosed as real geometry/vegetation rather than background art.

## Road / terrain material

- v122 experimented with `Rocks_Diffuse.png`, `Rocks_Desert_Diffuse.png`, and `PathRocks_Diffuse.png`.
- `PathRocks_Diffuse` made the paved road look green/grass-contaminated. v123 restored the core asphalt material while retaining rock textures for terrain/mountains.
- `tests/verdant-v123-regression-smoke.js` protects this and was made release-agnostic again in v129 (it no longer hardcodes an old 18-second gate timeout/string).

## Imported vegetation / performance architecture

- Imported glTF nature assets live under `assets/models/` (CommonTree, TwistedTree, Pine, DeadTree, bushes, ferns, flowers, mushrooms, rocks, etc.).
- Nature distribution is irregular/grove-based: `js/26`, `js/30`, `js/31` plus enrichment layers.
- GPU instancing is important for phone/web performance: `js/28-verdant-instanced-renderer.js`.
- Do not regress to baking thousands of duplicated imported meshes.
- **Do not re-enable legacy Verdant billboards as a fallback.** A sparse imported scene is preferable to the old giant triangular sprites.
- Any new vegetation placement should be validated against the **globally nearest route leg**, not merely its source route sample, because the route folds back near itself.

## Settlements / buildings

`js/32-verdant-fauna-buildings-v121.js` adds 16 building placements using 12 glTF building families, grouped into recognizable settlements:

- around 5–6 km: research/ranger outpost;
- around 16–18 km: main sky-port city;
- around 21–22 km: summit relay.

`js/34-verdant-assets-gate-v123.js` now waits for buildings, creatures **and imported nature settlement** before synchronous world construction. Timeout is currently 24 seconds; if nature assets fail, Verdant continues without legacy billboards.

## Living wildlife — retained + v129

Retained main layer: `js/36-verdant-wildlife-v125.js`:

- 10 deer/stag herd locations, generally 5–8 each;
- 8 cat-group locations;
- 5 bear-group locations;
- 9 mobile frog patches;
- 7 dragonfly swarms;
- 13 extra bird-flock locations;
- monkey troops, floating jellies, lightweight procedural hero palms;
- existing generic flee behavior for road-side animals.

v129 adds the denser set described above via `js/38` without removing retained v125 behavior.

## Uploaded GLB reference

The user previously uploaded a photogrammetry-style tropical plant/palm GLB. It was a single ~14.7 MB / ~292,648-triangle textured mesh with no skeleton/animation and is too heavy to instance directly in the phone/web ride. v125 uses its silhouette/palette only as reference for lightweight procedural palms. If higher fidelity is later desired, use a genuinely optimized low-poly version rather than the raw scan.

## CI

Workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.

It currently checks:
- JavaScript syntax;
- generated Verdant world;
- real geometry load;
- wildlife runtime;
- v121 fauna/buildings;
- v122 terrain/birds;
- road/material + asset readiness regression;
- v125 living wildlife/flee/frogs/swarms;
- v126 full-route mountain safety;
- **v129 world cleanup regression**: anti-dome/roadbed markers, nature readiness, hard billboard kill, global nearest-road plant filtering, expanded wildlife and loader/cache order;
- glTF creature/building asset integrity;
- imported nature dependencies;
- atmosphere-only sky + retained v128 alpine-dome removal;
- release/cache/wiring consistency.

Important lesson: retained feature tests should be **release-agnostic** where possible. Do not make old behavior regressions fail merely because a later release changes the cache number, timeout duration or loading text.

## Other important project features/fixes already done on this branch

The branch began as a build-90 stabilization branch and also contains prior fixes including TCX calorie/time handling, save/continue state preservation, gradient auditing, map pan/zoom, junction cleanup work, debug-start safety, and many Verdant additions. Before altering old ride physics or export code, inspect current files and tests rather than reconstructing them from memory.

## How to continue in a new ChatGPT conversation

The user can simply say:

> Continue my Lunar Ride project. Repository `clinicbot/lunar-ride`, branch `fixes-build-90`. Read `PROJECT_HANDOFF.md`, then inspect the latest HEAD and latest Verdant CI run before making any changes.

That is the safest continuation protocol. Do not rely on the exact HEAD recorded above if the branch has advanced; always refresh it first.
