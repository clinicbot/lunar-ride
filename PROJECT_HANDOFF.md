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

- Current Verdant Rift release: **v131**.
- Main v131 code commit: `7b874948e589aa76712af6c471f26a7608013ede` (`Verdant v131 remove rejected photogrammetry palms`).
- CI run `33315157810`: **SUCCESS**; all steps passed, including syntax, generated world, real geometry, retained wildlife/terrain regressions, explicit v131 palm-removal regression, atmosphere check, and current wiring.
- Backup immediately before removal: `backup-v130-before-v131-remove-palms`.
- Earlier backups retained: `backup-v129-before-v130-photogrammetry-palms`, `backup-v128-before-v129-world-cleanup`, `backup-v127-before-v128-mountain-cleanup`, `backup-v125-before-v126-mountains`.
- v130 photogrammetry palm experiment was visually rejected by the user and is now **fully removed from the active branch and runtime**.

## v131 — rejected palm removal

The v130 palm experiment appeared as large green elongated objects and did not visually integrate with Verdant. v131 removes it completely:

- deleted `js/39-verdant-photogrammetry-palms-v130.js`;
- deleted all six `verdant_palm_*_v130_part*.gltf` assets;
- removed all palm references from `js/19-verdant-assets.js`;
- removed all palm references from `sw.js`;
- release label is `131` and service-worker cache is `lunar-ride-v131`;
- CI explicitly fails if any rejected v130 palm file or runtime/cache reference reappears.

## Retained v129 world cleanup

v129 remains the visual/runtime baseline under v131:

1. **Legacy triangular billboard kill:** `js/26`, `js/27`, and `js/38` hard-disable legacy `w.veg`; the asset gate waits for imported nature settlement. Never re-enable legacy billboards as fallback.
2. **Plants on road:** `js/38` filters imported plant transforms against globally nearest route leg using `w._dbg.roadNear`, important because the 25 km route folds near itself.
3. **Roadbed:** `js/37-verdant-mountains-v129.js` builds final road support (`ROAD_FLAT=29`, `ROAD_BLEND=72`), recalculates normals and updates `meshH/groundAt`.
4. **Smooth green domes:** `js/37` adds global anti-dome ridge/saddle shaping to real 3-D base terrain.
5. **Wildlife density:** `js/38` adds 14 additional stag/deer herds plus more cats, bears, monkey troops and bird flocks while retaining v125 wildlife/flee behavior.

Telemetry includes `w.__verdantRoadbedV129`, `w.__verdantMountainsV129`, `w.__verdantRoadPlantCleanupV129`, and `w.__verdantWildlifeV129`.

## Retained mountain / sky history

- `js/35-verdant-mountains-v123.js` retains v126 full-route mountain replacement: `ROAD_CORE=46`, `ROAD_FADE=84`, full replacement beyond 130 m.
- v128 subtracts/replaces the old broad alpine Gaussian mass and exposes `w.__verdantMountainsV128`.
- `assets/images/sky_verdant.svg` contains no painted landscape paths; unwanted mountain silhouettes must come from real geometry or vegetation.

## Road/material

- v123 restored clean core asphalt after `PathRocks_Diffuse` made the road look green/grass-contaminated.
- `tests/verdant-v123-regression-smoke.js` protects this behavior.

## Imported nature / performance rules

- Main imported-nature source: `js/26-verdant-real-nature.js`.
- GPU instancing: `js/28-verdant-instanced-renderer.js`.
- Never duplicate thousands of imported meshes into world props.
- Any new vegetation must be checked against the globally nearest route leg.
- Prefer sparse imported nature over legacy billboard fallback.

## Wildlife / settlements retained

- `js/36-verdant-wildlife-v125.js`: retained deer herds, cats, bears, moving frogs, dragonfly swarms, bird flocks, monkey troops/jellies and flee behavior.
- `js/38` adds the v129 density expansion.
- `js/32-verdant-fauna-buildings-v121.js`: 16 building placements in outpost (~5–6 km), main sky-port city (~16–18 km), summit relay (~21–22 km).
- `js/34-verdant-assets-gate-v123.js` waits for buildings, creatures and imported nature; timeout is 24 s.

## Four newly uploaded GLB candidates — not yet in repo

The user uploaded four new GLB assets after rejecting the v130 palm. They have been inspected locally but **have not been committed or integrated**.

All four are technically friendly in structure: glTF 2.0 GLB, one mesh / one primitive, vertex colours in normalized `COLOR_0`, no external textures, no materials, no skins/animations, and upright Y-axis geometry. They do not include normals, but the existing imported-nature loader can derive face normals.

Approximate raw stats:

1. `tmpio7oc5gu.glb` — mushroom-like humanoid/character silhouette, ~1.74 MB, 43,532 vertices, **86,920 triangles**.
2. `tmpsw0h41xa.glb` — large fantasy mushroom cluster/structure, ~3.14 MB, 78,472 vertices, **156,598 triangles**.
3. `tmp_qap7x4r.glb` — giant mushroom-tree / canopy landmark, ~3.12 MB, 78,107 vertices, **155,978 triangles**.
4. `tmpw1wzir76.glb` — complex alien rock/island-like prop, ~2.55 MB, 63,801 vertices, **127,322 triangles**.

They are far better candidates than the rejected palm in orientation and colour format, but are too dense for repeated phone/WebGL instancing in raw form. Recommended next step if the user wants them: create simplified Hero + LOD variants (roughly 8–20k tris Hero depending on object, 2–5k LOD), preserve vertex colours, generate normals, then visually inspect before any world integration.

## CI

Workflow: `.github/workflows/verdant-ci.yml`, runs on pushes to `fixes-build-90`.

It protects:
- JS syntax;
- generated world + real geometry;
- retained v121/v122/v123/v125/v126 behavior;
- retained v129 anti-dome/roadbed/billboard-kill/nearest-road/wildlife behavior;
- creature/building and imported-nature asset integrity;
- v131 explicit removal of the rejected v130 palms;
- atmosphere-only sky + retained v128 alpine cleanup;
- current v131 release/cache/load-order wiring.

Retained behavior tests should be release-agnostic where possible.

## Continue protocol

User can say:

> Continue my Lunar Ride project. Repository `clinicbot/lunar-ride`, branch `fixes-build-90`. Read `PROJECT_HANDOFF.md`, then inspect the latest HEAD and latest Verdant CI run before making any changes.

Always refresh HEAD/CI rather than trusting the exact SHA written here.
