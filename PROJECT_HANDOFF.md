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

- Current Verdant Rift release: **v134**.
- Current code HEAD before this handoff update: `1ea2b943307b6a2f1de976882150e7a2e376f07c`.
- CI run `33325847215`: **SUCCESS**; all steps passed, including the new runtime check proving the CommonTree mix is 75% light / 25% dark and that TwistedTree/Pine/wildlife are untouched.
- Backup immediately before v134: `backup-v131-before-v134-common-tree-mix`.
- v134 is intentionally a very narrow visual change on top of the good v131 baseline.

## v134 — CommonTree light/dark mix only

User approved the existing bright-green CommonTree look from v131 and also liked the darker-green appearance seen incidentally in rejected v133. The requested experiment is to keep both.

New file: `js/39-verdant-common-tree-mix-v134.js`.

Behavior:
- targets **only** `common1`, `common3`, `common5` (`CommonTree_1/3/5`);
- keeps the exact v131 geometry, positions, yaw, scale and total tree count;
- keeps **75%** of CommonTree instances with the original v131 colour buffer;
- moves **25%** to a second model key using the same position/normal buffers but a darker foliage colour buffer;
- darkens only greenish foliage vertices; bark/branches are preserved;
- selection is deterministic and spatially mixed, not every fourth tree in route order;
- does **not** target `TwistedTree`, `Pine`, red trees, wildlife, terrain, buildings, road or sky;
- telemetry: `w.__verdantCommonTreeMixV134`.

Runtime test: `tests/verdant-v134-common-tree-mix-smoke.js` verifies exact 75/25 behavior on test groups, unchanged geometry references, untouched TwistedTree and untouched wildlife.

## Good baseline and rejected experiments

### v131 — good baseline

v131 is the visual/world baseline underneath v134. It fully removed the rejected v130 photogrammetry palms while retaining the established nature, wildlife, roads, mountains and settlements.

### v132 — rejected

v132 combined oversized-tree cleanup, road-prop cleanup, mushroom tree, extra wildlife/buildings and richer sky. User rejected it because attractive red/other trees disappeared or changed, wildlife appeared reduced, ugly green objects remained and mushroom trees were not visible. It was fully rolled back via a forward commit to the exact v131 tree.

Lesson: do not bundle multiple visual/world changes. Make one small change, get screenshots, then continue.

### v133 — rejected but visually informative

v133 attempted an alpha-mask reconstruction for every imported tree family (`CommonTree`, `TwistedTree`, `Pine`). It changed too many existing trees: CommonTree became darker, red trees became much darker, and the ugly green blade objects still remained. User preferred v131 overall, but liked some of the darker CommonTree look. v133 was fully rolled back to v131.

Backup of rejected v133: `backup-v133-before-return-v131`.

Important: do **not** re-enable the broad v133 alpha fix. If alpha work is revisited, isolate a single identified model first.

## Current problematic green objects

User has supplied multiple close-up screenshots of narrow/elongated green blade/plank/tree-like objects. Their exact source is **not yet proven**. Previous diagnoses (`TwistedTree`, then all alpha-masked tree cards) were too broad and did not eliminate them reliably.

Next debugging rule:
- do not remove a family based only on appearance;
- identify the specific runtime/model key first, ideally with a temporary labelled model lineup or instrumentation;
- change one model at a time;
- preserve the approved v131/v134 trees while testing.

## Retained v129 world cleanup

v129 remains the world/runtime baseline under v131/v134:

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
- v134 preserves this architecture; it adds only three dark CommonTree model groups and shares their position/normal arrays with the existing models.
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
- retained v131 atmosphere + v128 mountain cleanup;
- current v134 release/cache/load-order wiring.

## Immediate visual test

User should run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5, confirm **Verdant Rift · v134**, then inspect the same early-route CommonTree areas. Desired result: familiar bright v131 trees still dominate, with a minority of clearly darker green versions mixed among them. If the dark variant is too dark/light or the proportion looks wrong, adjust only the colour multiplier/ratio; do not touch other tree families.
