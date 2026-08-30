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
- Current Verdant Rift release: **v138**.
- Main v138 code commit: `ac0c6708ef2d9c672a4f2ec8de60abcfccd6fa69`.
- Code CI run `33328614110`: **SUCCESS**; every regression step passed, including v134/v136/v137 tree mixes and the new v138 purple-flower-carpet runtime test.
- Backup immediately before v138: `backup-v137-before-v138-purple-carpets`.
- v137 remains the approved rollback point before the flower-field change.

## v138 — dense purple flower carpets
User pointed to the existing small purple flower/shrub and requested true fields/carpets containing hundreds or thousands of them rather than sparse individual plants.

New active file: `js/43-verdant-purple-flower-carpets-v138.js`.

Behavior:
- reuses the already-loaded `flower4` model (`assets/models/Flower_4_Group.gltf`); no new mesh asset is introduced;
- adds **12 large oval flower fields** spread around the 25 km route;
- target total is **7,110 GPU-instanced Flower_4 groups**;
- individual fields contain roughly 420–760 instances, producing the requested hundreds/thousands visual effect while only nearby transforms are streamed by `js/28`;
- carpets use deterministic irregular/elliptical scatter, not a grid;
- each candidate checks the globally nearest road leg through `w._dbg.roadNear`;
- flowers are rejected inside road width + **4.2 m** safety margin, so fields visibly stop before asphalt/shoulder even near hairpins;
- scale varies mildly (`0.18–0.36`) to keep a natural carpet texture;
- model geometry is shared with the existing `flower4` GPU model, preserving the instancing architecture;
- trees, wildlife, terrain, buildings, mountains and sky are untouched;
- telemetry: `w.__verdantPurpleCarpetsV138`.

Regression: `tests/verdant-v138-purple-flower-carpets-smoke.js` builds a mocked Verdant world and verifies all 7,110 instances, 12 fields, model reuse, stats accounting, and preservation of pre-existing nature groups.

## v137 — approved red TwistedTree 50/50 mix
User approved mixing the current bright-red TwistedTree with the darker/denser v133-style form.

Active file: `js/42-verdant-twisted-tree-mix-v137.js`.
- targets only `twisted1` / `twisted3`;
- 50% stay bright-red current form;
- 50% use the exact v133 alpha-aware leaf-card structure;
- preserves total count, location, yaw and scale;
- no CommonTree/Pine/world changes.

Backup: `backup-v136-before-v137-twisted-50-50`.

## v136 — approved CommonTree mixture
Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree target distribution:
- **65%** original bright v131 CommonTree;
- **25%** original geometry with darker foliage from v134;
- **10%** exact v133 alpha-aware compact CommonTree form.

Only `common1/common3/common5` are affected by these layers.

Important backups:
- `backup-v135-before-v136-real-compact-common`
- `backup-v134-before-v135-common-tree-structure-mix`
- `backup-v131-before-v134-common-tree-mix`

## Rejected experiments / lessons
- **v132 rejected:** bundled tree cleanup, road props, mushroom tree, extra wildlife/buildings and richer sky; changed too much and was rolled back.
- **v133 broadly rejected but useful:** alpha-aware fix applied to CommonTree + TwistedTree + Pine globally; user later reused only selected looks from it.
- **v135 rejected:** synthetic geometry deformation did not reproduce the desired compact CommonTree.

Rule: keep visual changes isolated and get screenshots after each small change.

## Current problematic green blade objects
User has supplied close-ups of narrow/elongated green blade/plank/tree-like objects. Their exact runtime/model source is still **not proven**. Do not remove a tree family based only on appearance. Next debugging should identify the exact runtime/model key with labelled lineup/instrumentation and then change one model at a time while preserving v136/v137/v138 approved work.

## Retained world systems
- v129 world cleanup remains baseline: no legacy triangular `w.veg`, global route-nearest plant filtering, final road support, additional wildlife density.
- Mountains retain v126/v128/v129 protections and anti-dome work.
- Sky remains the v131 atmosphere-only sky; rejected v132 planet/cloud sky is not active.
- GPU vegetation instancing remains in `js/28-verdant-instanced-renderer.js`; do not bake duplicated meshes.
- Wildlife retained from `js/36-verdant-wildlife-v125.js` + `js/38-verdant-world-cleanup-v129.js`.
- Settlements retained from `js/32-verdant-fauna-buildings-v121.js`.

## Uploaded GLB candidates
Four newer GLBs were inspected but are not active. The third is a mushroom-tree candidate; do not reintroduce it until simplified and previewed independently.

## CI
Workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.
It protects syntax, generated world/geometry, wildlife, retained v121/v122/v123/v125/v126/v129 behavior, dependency integrity, rejected palm removal, v134 CommonTree mix, v136 exact compact CommonTree, v137 TwistedTree 50/50 split, v138 purple flower carpets, atmosphere/mountain retention and current release/cache/load wiring.

## Immediate visual test
Run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5 and confirm **Verdant Rift · v138**. Purple carpets should be easy to see near multiple locations, beginning around **0.95 km**, then around **2.7, 5.25, 7.45, 9.85, 12.15 km** and continuing later in the lap. Desired result: broad dense purple fields with a clean green gap before the asphalt, while v136/v137 tree mixtures and wildlife remain unchanged.
