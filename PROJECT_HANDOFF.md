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
- Current Verdant Rift release: **v137**.
- Main v137 code commit: `e6f3562d93d1751b2a3727841667ce5a29c69d59`.
- CI run `33327637471`: **SUCCESS**, including syntax, generated world, real geometry, wildlife, retained terrain/mountain tests, v134 CommonTree mix, v136 exact compact CommonTree and new v137 TwistedTree 50/50 test.
- Backup immediately before v137: `backup-v136-before-v137-twisted-50-50`.
- v136 itself is user-approved and should remain an easy rollback point.

## v137 — red TwistedTree 50/50 mix
User supplied two screenshots of the red trees: current bright-red form and the darker/denser-looking form seen in rejected v133. User requested 50% of each.

New active file: `js/42-verdant-twisted-tree-mix-v137.js`.

Behavior:
- targets **only** `twisted1` and `twisted3` (`TwistedTree_1/3`);
- keeps 50% of instances exactly as current v136/v131 bright-red TwistedTree;
- moves 50% to an alternate model rebuilt with the **exact alpha-aware leaf-card algorithm from v133**;
- corrected half splits alpha-masked leaf triangles into four and alpha-tests each sub-triangle, reproducing the darker/denser v133 TwistedTree appearance rather than merely recolouring it;
- instance selection is deterministic and spatially mixed;
- preserves total TwistedTree count, location, yaw and scale;
- does not target CommonTree, Pine, wildlife, terrain, road, buildings or sky;
- telemetry: `w.__verdantTwistedTreeMixV137`;
- load gate waits for the two alternate TwistedTree models before Verdant starts.

Regression: `tests/verdant-v137-twisted-tree-mix-smoke.js` verifies the layer targets only TwistedTree_1/3 and deterministically splits 10 test instances 5/5 without mutating the source list.

## v136 — approved CommonTree mixture
v136 is the approved green-tree state underneath v137.

Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree target distribution:
- **65%** original bright v131 CommonTree;
- **25%** original geometry with darker foliage from v134;
- **10%** exact v133 alpha-aware compact CommonTree form.

Only `common1/common3/common5` are affected by these layers. TwistedTree/Pine/wildlife/world are not modified by the CommonTree layers.

Backups:
- `backup-v135-before-v136-real-compact-common`
- `backup-v134-before-v135-common-tree-structure-mix`
- `backup-v131-before-v134-common-tree-mix`

## Rejected experiments / lessons
- **v132 rejected:** bundled tree cleanup, road props, mushroom tree, extra wildlife/buildings and richer sky; changed too much and was fully rolled back.
- **v133 broadly rejected but useful:** alpha-aware fix was applied to CommonTree + TwistedTree + Pine globally. It changed too many tree families, but user later liked the compact CommonTree and dark-red TwistedTree forms. Backup: `backup-v133-before-return-v131`.
- **v135 rejected:** synthetic geometry deformation did not reproduce the desired compact CommonTree. `js/40-verdant-common-tree-structure-v135.js` is not loaded/cached.

Rule: keep visual changes isolated by model family and get screenshots after each small change.

## Current problematic green blade objects
User has supplied close-ups of narrow/elongated green blade/plank/tree-like objects. Their exact runtime/model source is **still not proven**. Do not remove a tree family based only on appearance. Next debugging should identify the exact runtime/model key (prefer labelled lineup/instrumentation) and change one model at a time while preserving approved v136/v137 tree mixtures.

## Retained world systems
- v129 world cleanup remains the baseline: no legacy triangular `w.veg` billboard fallback, global route-nearest plant filtering, final road support, additional wildlife density.
- Mountains retain v126/v128/v129 protections and anti-dome work.
- Sky remains the v131 atmosphere-only sky; rejected v132 planet/cloud sky is not active.
- GPU vegetation instancing remains in `js/28-verdant-instanced-renderer.js`; do not bake thousands of duplicated meshes.
- Wildlife retained from `js/36-verdant-wildlife-v125.js` + `js/38-verdant-world-cleanup-v129.js`.
- Settlements retained from `js/32-verdant-fauna-buildings-v121.js`.

## Uploaded GLB candidates
Four newer GLBs were inspected but are not active. The third is a mushroom-tree candidate; do not reintroduce it until simplified and previewed independently.

## CI
Workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.
It protects syntax, world/geometry, wildlife, retained v121/v122/v123/v125/v126/v129 behavior, dependency integrity, rejected palm removal, v134 CommonTree mix, v136 exact compact CommonTree, v137 TwistedTree 50/50 split, atmosphere/mountain retention and current release/cache/load wiring.

## Immediate visual test
Run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5 and confirm **Verdant Rift · v137**. Inspect areas with red TwistedTrees. Desired result: an obvious spatial mixture of roughly half bright red current trees and half darker/denser v133-style red trees, while the approved v136 CommonTree mixture and wildlife remain unchanged.
