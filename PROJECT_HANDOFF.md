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

- Current release shown for Verdant Rift: **v127**.
- HEAD before this handoff file: `b2fd4900c6eea160a2a19fe73c3e55290f16892b`.
- Latest Verdant CI run before this handoff: run `33304741901`, **SUCCESS**.
- The earlier red CI email for run `33303766220` was caused by an obsolete string-based regression assertion; gameplay/geometry/wildlife tests before that assertion were passing. That obsolete test dependency has since been fixed and the latest CI is green.
- Backup created before the latest mountain work: `backup-v125-before-v126-mountains`.

## Verdant Rift world

- Scene id: `verdant`.
- One continuous closed route, about 25 km, no road junction choices.
- Route/world builder: `js/17-verdant-rift.js`.
- Weather: `js/18-verdant-weather.js`; route-aware rain/mist, visual only.
- Verdant loader/wiring: `js/19-verdant-assets.js`.
- Release label is currently in `js/25-verdant-lite-richness.js`.
- Service-worker cache release must match the release label in `sw.js`.

## Terrain / mountain history

The user repeatedly found old-looking green hemispheres / circular hills / triangular cartoon mountains visible around the route. There are two separate visual sources that had to be addressed:

1. **3-D terrain mesh** — the original `bareLand()` added a smooth radial perimeter uplift. `js/35-verdant-mountains-v123.js` now contains the retained **v126 full-route mountain replacement** algorithm. It removes/replaces the smooth radial ring away from the road, adds asymmetric multi-scale ridges/erosion, stone colour on high/steep/far surfaces, recalculates normals, and updates `meshH` / `groundAt`.
   - Hard road protection: `ROAD_CORE=46` m.
   - Fade: `ROAD_FADE=84` m.
   - Full replacement beyond about 130 m.
   - The smaller protection radius was necessary because the 25 km route folds through much of the 5.2 km terrain map; the old 180 m protection left many distant domes untouched.

2. **Sky/background panorama** — some apparent green domes/triangles were not terrain at all; they came from `assets/images/sky_verdant.svg`. In **v127** the old cartoon green skyline was replaced with three low-contrast, angular irregular atmospheric mountain chains plus haze/clouds. `js/18-verdant-weather.js` loads `sky_verdant.svg?b=127`.

User's most recent mountain screenshots showed that many old mountains were still visible throughout the route before this v126/v127 work. The current v127 specifically attempts to fix both the 3-D and background causes. The next real-world task is to have the user update and visually retest the same locations and the full lap.

## Road / terrain material

- v122 experimented with `Rocks_Diffuse.png`, `Rocks_Desert_Diffuse.png`, and `PathRocks_Diffuse.png`.
- `PathRocks_Diffuse` made the paved road look green/grass-contaminated. v123 restored the core asphalt material for the road while retaining the rock textures for terrain/mountains.
- Regression test: `tests/verdant-v123-regression-smoke.js` protects this.

## Imported vegetation / performance architecture

- User imported many glTF nature assets under `assets/models/` (CommonTree, TwistedTree, Pine, DeadTree, bushes, ferns, flowers, mushrooms, rocks, etc.).
- The visually preferred imported trees are used; the ugly old yellow grass-clump fallback was removed.
- Nature distribution is irregular/grove-based, not evenly spaced roadside planting: `js/30-verdant-natural-v119.js` plus enrichment layers.
- GPU instancing is important for performance: `js/28-verdant-instanced-renderer.js`.
- Do not regress to baking thousands of duplicated meshes.

## Settlements / buildings

`js/32-verdant-fauna-buildings-v121.js` adds 16 building placements using 12 glTF building families, grouped into recognizable settlements rather than random scatter:

- around 5–6 km: research/ranger outpost;
- around 16–18 km: main sky-port city;
- around 21–22 km: summit relay.

Building keys include station side/hangar/antenna/gate/refinery/ring and city gate/dome/tower/arcology/spire pair/cluster. Automatic foundations sample terrain so buildings should not float or bury themselves on slopes.

`js/34-verdant-assets-gate-v123.js` waits for required building and creature assets before synchronous world construction; this fixed the earlier timing bug where most buildings/animals disappeared if the user entered Verdant before glTF loading finished.

## Living wildlife — v125 retained layer

Main file: `js/36-verdant-wildlife-v125.js`.

The goal is a **living world, not static statues**. Current retained groups include:

- 10 deer/stag herd locations, generally 5–8 animals each.
- Several selected herds deliberately begin on/near the road.
- Existing generic engine flee behavior is reused: animals carry road reference (`rdx/rdz`); when the rider gets within roughly 32 m, road-side animals enter flee state and run away from the road.
- 8 cat-group locations, generally 4–7 cats.
- 5 bear-group locations, generally 3–5 bears.
- 9 frog patches; old large frogs are retuned smaller and mobile. New frogs are roughly 0.32–0.48 scale and wander/hop/bob rather than stand like statues.
- 7 dragonfly swarm locations, generally 8–13 dragonflies each.
- 13 additional bird-flock locations across the whole 25 km lap, using all four bird glTF families.
- monkey troops and floating jelly groups in jungle/wetland sections.
- lightweight procedural hero palms in the jungle section.

There are also older wildlife/bird layers retained from v120–v122, including additional bears, frogs, monkeys, insects and 133 birds in 19 flocks. CI protects v125 flee/frog/swarm/flock behavior in `tests/verdant-v125-wildlife-smoke.js`.

## Uploaded GLB reference

The user uploaded a photogrammetry-style tropical plant/palm GLB during the Verdant work. Inspection showed it was a single very dense textured mesh, about **14.7 MB / ~292,648 triangles**, without skeleton/animation. It is too heavy to instance directly in the phone/web ride. v125 therefore uses its silhouette/palette as reference for lightweight procedural palms. If fidelity is later desired, create/obtain a genuinely optimized low-poly version rather than inserting the raw scan.

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
- glTF creature/building asset integrity;
- imported nature dependencies;
- v127 atmospheric skyline;
- release/cache/wiring consistency.

Important lesson: retained feature tests should be **release-agnostic** where possible. Do not make a v125/v126 behavior regression fail merely because the current release becomes v128.

## Other important project features/fixes already done on this branch

The branch began as a build-90 stabilization branch and also contains prior fixes including TCX calorie/time handling, save/continue state preservation, gradient auditing, map pan/zoom, junction cleanup work, debug-start safety, and many Verdant additions. The draft PR description records the initial stabilization changes. Before altering old ride physics or export code, inspect current files and tests rather than reconstructing them from memory.

## How to continue in a new ChatGPT conversation

The user can simply say:

> Continue my Lunar Ride project. Repository `clinicbot/lunar-ride`, branch `fixes-build-90`. Read `PROJECT_HANDOFF.md`, then inspect the latest HEAD and latest Verdant CI run before making any changes.

That is the safest continuation protocol. Do not rely on the exact HEAD recorded above if the branch has advanced; always refresh it first.
