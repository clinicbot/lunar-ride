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

- Current Verdant Rift release: **v135**.
- Main v135 code commit: `327f644557cdc166a4ef44837d2abe448cb42b4b`.
- CI run `33326303519`: **SUCCESS**; all steps passed, including retained v134 75/25 CommonTree colour mix plus the new v135 exact 10% structure-variant runtime test.
- Backup of the user-approved v134: `backup-v134-before-v135-common-tree-structure-mix`.
- Earlier v134 backup: `backup-v131-before-v134-common-tree-mix`.
- v135 is intentionally another narrow, reversible visual change.

## v135 — add 10% compact CommonTree structure variant

User approved v134 and asked to keep it, while also retaining a small amount of the alternate CommonTree structure seen in the rejected v133 experiment.

New file: `js/40-verdant-common-tree-structure-v135.js`.

Behavior:
- keeps the entire v134 75/25 CommonTree colour mix intact;
- targets **only** `common1`, `common3`, `common5`;
- takes **10% of the total CommonTree population from the remaining light group** and moves those instances to a compact structural variant;
- final target distribution: **65% original light + 25% original-geometry dark + 10% compact structure**;
- compact structure uses the same source CommonTree model and colour buffer, but contracts green foliage radially and stretches it slightly vertically; bark is not deliberately recoloured;
- recomputes normals for the compact variant;
- selection is deterministic and spatially mixed;
- does **not** target `TwistedTree`, `Pine`, red trees, wildlife, terrain, buildings, road or sky;
- telemetry: `w.__verdantCommonTreeStructureV135`.

Runtime test: `tests/verdant-v135-common-tree-structure-smoke.js` runs v134 + v135 together and verifies exact **65/25/10** counts on test groups, preserved v134 dark ratio, unchanged wildlife, and untouched TwistedTree/Pine.

## v134 — approved CommonTree light/dark mix

User approved the existing bright-green CommonTree look from v131 and also liked a darker-green appearance. v134 keeps both.

File: `js/39-verdant-common-tree-mix-v134.js`.

Behavior:
- targets only `common1`, `common3`, `common5`;
- keeps exact v131 geometry, positions, yaw, scale and total tree count;
- 75% original bright colour and 25% darker foliage colour;
- dark variant shares position/normal buffers with the original model;
- does not touch other tree families, wildlife or world geometry;
- telemetry: `w.__verdantCommonTreeMixV134`.

Backup preserving this exact user-approved state: `backup-v134-before-v135-common-tree-structure-mix`.

## Good baseline and rejected experiments

### v131 — good baseline

v131 is the visual/world baseline underneath v134/v135. It fully removed the rejected v130 photogrammetry palms while retaining the established nature, wildlife, roads, mountains and settlements.

### v132 — rejected

v132 combined oversized-tree cleanup, road-prop cleanup, mushroom tree, extra wildlife/buildings and richer sky. User rejected it because attractive red/other trees disappeared or changed, wildlife appeared reduced, ugly green objects remained and mushroom trees were not visible. It was fully rolled back via a forward commit to the exact v131 tree.

Lesson: do not bundle multiple visual/world changes. Make one small change, get screenshots, then continue.

### v133 — rejected but visually informative

v133 attempted an alpha-mask reconstruction for every imported tree family (`CommonTree`, `TwistedTree`, `Pine`). It changed too many existing trees: CommonTree became darker/structurally different, red trees became much darker, and the ugly green blade objects still remained. User preferred v131 overall but liked some of the alternate CommonTree appearance. v133 was fully rolled back to v131.

Backup of rejected v133: `backup-v133-before-return-v131`.

Important: do **not** re-enable the broad v133 alpha fix. Any reuse of that visual idea must stay isolated to CommonTree only, as v134/v135 do.

## Current problematic green objects

User has supplied multiple close-up screenshots of narrow/elongated green blade/plank/tree-like objects. Their exact source is **not yet proven**. Previous diagnoses (`TwistedTree`, then all alpha-masked tree cards) were too broad and did not eliminate them reliably.

Next debugging rule:
- do not remove a family based only on appearance;
- identify the specific runtime/model key first, ideally with a temporary labelled model lineup or instrumentation;
- change one model at a time;
- preserve the approved v134/v135 CommonTree mixture while testing.

## Retained v129 world cleanup

v129 remains the world/runtime baseline under v131/v134/v135:

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
- v134 adds only three dark CommonTree model groups and shares their position/normal arrays with the existing models.
- v135 adds only three compact CommonTree model groups and reuses the same instance architecture.
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
- v134 exact CommonTree 75/25 mix and non-interference with other tree families/wildlife;
- v135 exact CommonTree 10% structure split, resulting in 65/25/10 on deterministic test groups;
- retained v131 atmosphere + v128 mountain cleanup;
- current v135 release/cache/load-order wiring.

## Immediate visual test

User should run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5, confirm **Verdant Rift · v135**, then inspect the same early-route CommonTree areas. Desired result: most trees remain familiar bright v131 CommonTrees, about one quarter remain the approved darker v134 colour variant, and a smaller roughly 10% subset has a visibly more compact/taller crown structure. If the compact structure is not attractive, roll forward from `backup-v134-before-v135-common-tree-structure-mix` and remove only the v135 layer.
