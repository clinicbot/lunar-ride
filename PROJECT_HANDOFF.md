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

- Current Verdant Rift release: **v136**.
- Main v136 code commit: `bff86e87424956534f97fba6890e7caef105dee0`.
- CI run `33326959543`: **SUCCESS**; all steps passed, including retained v134 75/25 CommonTree colour mix, the new v136 10% exact-v133 compact CommonTree regression, retained wildlife/terrain checks, atmosphere and current wiring.
- Backup immediately before v136: `backup-v135-before-v136-real-compact-common`.
- User-approved v134 backup remains: `backup-v134-before-v135-common-tree-structure-mix`.

## v136 — exact v133 compact CommonTree on 10% only

The user showed a close-up of the compact dark-green CommonTree appearance from rejected v133 and clarified that this exact form, not a synthetic deformation, is desired as a minority variant.

New active file: `js/41-verdant-common-tree-compact-v136.js`.

Behavior:
- preserves the approved v134 CommonTree colour population;
- targets **only** `common1`, `common3`, `common5` (`CommonTree_1/3/5`);
- rebuilds only those three CommonTree models with the **same alpha-aware leaf-card subdivision algorithm used in v133**;
- each alpha-masked leaf triangle is split into four sub-triangles and alpha-tested per sub-triangle, reproducing the compact v133 CommonTree silhouette;
- only **10% of the total CommonTree population** is moved from the remaining light group into this exact-v133 compact model;
- final target distribution: **65% original light + 25% original-geometry dark + 10% exact v133 compact CommonTree**;
- selection is deterministic and spatially mixed;
- v136 waits for the three compact CommonTree models to finish preparing before starting Verdant;
- `TwistedTree`, `Pine`, red trees, wildlife, terrain, road, buildings and sky are untouched;
- telemetry: `w.__verdantCommonTreeCompactV136`.

Runtime/static regression: `tests/verdant-v136-common-tree-compact-smoke.js` verifies the exact 10% split from a 75/25 input population and protects the v133 alpha-aware markers. The loader/wiring test confirms the rejected synthetic v135 structure layer is no longer active.

## v135 — rejected synthetic structure experiment

v135 tried to imitate the compact shape by contracting/stretching the existing v131 CommonTree geometry. The user did not see the desired compact trees because this was not the same structure as v133.

- File retained only historically: `js/40-verdant-common-tree-structure-v135.js`.
- It is **not loaded or cached by v136**.
- Backup: `backup-v135-before-v136-real-compact-common`.

Do not re-enable this synthetic structure layer unless explicitly requested.

## v134 — approved CommonTree light/dark mix

User approved this version visually and asked to preserve it.

File: `js/39-verdant-common-tree-mix-v134.js`.

Behavior:
- targets only `common1`, `common3`, `common5`;
- keeps exact v131 geometry, positions, yaw, scale and total tree count;
- **75% original bright colour + 25% darker foliage colour** before v136 takes 10% of total from the light group;
- dark variant shares position/normal buffers with the original model;
- does not touch other tree families, wildlife or world geometry;
- telemetry: `w.__verdantCommonTreeMixV134`.

Backup preserving exact v134: `backup-v134-before-v135-common-tree-structure-mix`.

## Good baseline and rejected experiments

### v131 — good baseline

v131 is the visual/world baseline underneath v134/v136. It fully removed the rejected v130 photogrammetry palms while retaining established nature, wildlife, roads, mountains and settlements.

### v132 — rejected

v132 bundled oversized-tree cleanup, road-prop cleanup, mushroom tree, extra wildlife/buildings and richer sky. User rejected it because attractive trees disappeared/changed, wildlife appeared reduced, ugly green objects remained and mushroom trees were not visible. It was fully rolled back to the exact v131 tree.

Lesson: do not bundle multiple visual/world changes. Make one small change, get screenshots, then continue.

### v133 — broadly rejected but source of the desired compact CommonTree

v133 applied alpha-mask reconstruction to every imported tree family (`CommonTree`, `TwistedTree`, `Pine`). It changed too much: CommonTree became compact/darker, red trees changed strongly, and ugly green blade objects still remained. User preferred v131 overall but later specifically liked the compact CommonTree appearance.

Backup: `backup-v133-before-return-v131`.

Important: **never re-enable the broad v133 tree fix.** v136 reuses the v133 alpha-aware algorithm for CommonTree only.

## Current problematic green objects

User has supplied multiple close-up screenshots of narrow/elongated green blade/plank/tree-like objects. Their exact source is still **not proven**. Previous broad diagnoses were wrong or incomplete.

Next debugging rule:
- do not remove a family based only on appearance;
- identify the specific runtime/model key first, ideally with a temporary labelled lineup or instrumentation;
- change one model at a time;
- preserve the approved v134/v136 CommonTree mixture while testing.

## Retained v129 world cleanup

v129 remains the world/runtime baseline:

1. `js/26`, `js/27`, `js/38` hard-disable legacy triangular `w.veg` billboards.
2. `js/38` filters imported plant transforms against the globally nearest route leg using `w._dbg.roadNear`.
3. `js/37-verdant-mountains-v129.js` builds final road support (`ROAD_FLAT=29`, `ROAD_BLEND=72`) and updates normals/height sampling.
4. `js/37` adds global anti-dome ridge/saddle shaping.
5. `js/38` retains the wildlife-density expansion on top of v125.

Telemetry includes `w.__verdantRoadbedV129`, `w.__verdantMountainsV129`, `w.__verdantRoadPlantCleanupV129`, and `w.__verdantWildlifeV129`.

## Retained mountain / sky / road history

- `js/35-verdant-mountains-v123.js`: v126 full-route mountain replacement with `ROAD_CORE=46`, `ROAD_FADE=84`, full replacement beyond 130 m.
- v128 subtracts/replaces the old broad alpine Gaussian mass and exposes `w.__verdantMountainsV128`.
- `assets/images/sky_verdant.svg` is the **v131 atmosphere-only sky**: no painted terrain paths. Rejected v132 ringed-planet/cloud additions are not active.
- v123 restored clean core asphalt after `PathRocks_Diffuse` contaminated road appearance.

## Imported nature / performance

- Main imported-nature source: `js/26-verdant-real-nature.js`.
- GPU instancing: `js/28-verdant-instanced-renderer.js`.
- v134 adds only dark CommonTree model groups and shares original position/normal arrays.
- v136 adds only three alpha-aware compact CommonTree model groups and keeps the existing instancing architecture.
- Never bake thousands of duplicated vegetation meshes into world props.
- Any new vegetation must be checked against the globally nearest route leg.

## Wildlife / settlements retained

- `js/36-verdant-wildlife-v125.js`: deer/stag herds, cats, bears, moving frogs, dragonflies, birds, monkey troops/jellies and flee behavior.
- `js/38` adds additional v129 density.
- `js/32-verdant-fauna-buildings-v121.js`: established outpost, main sky-port city and summit relay placements.
- `js/34-verdant-assets-gate-v123.js` waits for buildings, creatures and imported nature.

## Four uploaded GLB candidates — not active

Four newer GLBs were inspected but are **not in the active world after rollback**. Approximate raw triangle counts: 87k, 157k, 156k and 127k. The third is a mushroom-tree candidate. Do not reintegrate until a simplified version is previewed and approved independently.

## CI

Workflow: `.github/workflows/verdant-ci.yml`, on pushes to `fixes-build-90`.

It protects:
- JavaScript syntax;
- generated world + real geometry;
- retained v121/v122/v123/v125/v126/v129 behavior;
- creature/building and imported-nature dependency integrity;
- explicit removal of rejected v130 palms;
- v134 CommonTree 75/25 colour mix;
- v136 exact-v133 CommonTree compact algorithm and 10% split, yielding 65/25/10;
- absence of the active rejected v135 synthetic structure layer;
- retained v131 atmosphere + v128 mountain cleanup;
- current v136 release/cache/load-order wiring.

## Immediate visual test

User should run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5, confirm **Verdant Rift · v136**, then inspect the same early-route CommonTree areas. Desired result: familiar bright v131 CommonTrees still dominate, about one quarter are the approved darker v134 colour variant, and roughly 10% show the **same compact dark-green crown structure seen in the user's v133 screenshot**. If this still does not visually match, return to `backup-v134-before-v135-common-tree-structure-mix` and diagnose the exact v133 runtime key before any further change.
