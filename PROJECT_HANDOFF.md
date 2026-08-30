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
- Current Verdant Rift release: **v139**.
- Main v139 code commit: `49e75596ae4e52a292e72270e225607715790324`.
- Code CI run `33329416840`: **SUCCESS**; all regression steps passed, including retained v134/v136/v137 tree mixes and the v139 mega-carpet runtime test.
- Backup immediately before v139: `backup-v138-before-v139-mega-purple-carpets`.
- v138 remains an easy rollback point if the new density is too heavy visually or for mobile performance.

## v139 — mega purple Flower_4 carpets
User liked v138 but said there were still large empty green plains. Requested 4x as many carpets, each carpet about 4x larger, and flowers reaching to about 10 cm from the road edge.

New active file: `js/44-verdant-purple-flower-megacarpets-v139.js`.

Behavior:
- reuses the existing `flower4` / `assets/models/Flower_4_Group.gltf` model;
- replaces the active v138 12-field layer; `js/43-verdant-purple-flower-carpets-v138.js` remains historical but is **not loaded or cached as active core**;
- uses **48 carpet centres** distributed nearly evenly around the full 25 km lap (about one every 0.52 km), alternating sides;
- each carpet doubles both ellipse axes relative to its corresponding v138 profile, giving about **4x area per carpet**;
- instance count is also multiplied by 4 per carpet to preserve similar visual density;
- target total is **113,760 GPU-instanced Flower_4 groups**;
- all instances share the existing Flower_4 mesh and are stored in one instanced group (`flower4MegaCarpetV139`); no duplicated baked geometry;
- patch distribution remains irregular/elliptical rather than grid-like;
- patches are allowed to extend toward the road and rely on a globally-nearest-road check for final clipping;
- road clipping uses the current road half-width + estimated visible Flower_4 radius + **0.10 m** gap, so the visible plant edge should stop roughly 10 cm from the asphalt edge even near hairpins;
- scale remains 0.18–0.36;
- trees, wildlife, terrain, buildings, mountains and sky are untouched;
- telemetry: `w.__verdantPurpleCarpetsV139`.

Regression: `tests/verdant-v139-purple-megacarpets-smoke.js` verifies 48 patches, target 113,760 instances, 10 cm road-edge gap marker, reuse of the existing Flower_4 model, stats accounting and preservation of pre-existing nature groups.

## v138 — approved smaller purple carpet baseline
v138 was visually approved but judged too sparse overall.

Historical file: `js/43-verdant-purple-flower-carpets-v138.js`.
- 12 fields;
- target 7,110 Flower_4 groups;
- 4.2 m road margin;
- backup before v139: `backup-v138-before-v139-mega-purple-carpets`.

## v137 — approved red TwistedTree 50/50 mix
Active file: `js/42-verdant-twisted-tree-mix-v137.js`.
- only `twisted1` / `twisted3`;
- 50% current bright-red form;
- 50% exact v133 alpha-aware darker/denser form;
- preserves total count, location, yaw and scale.

Backup: `backup-v136-before-v137-twisted-50-50`.

## v136 — approved CommonTree mixture
Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree distribution:
- **65%** original bright v131 CommonTree;
- **25%** original geometry with darker foliage from v134;
- **10%** exact v133 alpha-aware compact CommonTree form.

Only `common1/common3/common5` are affected.

Important backups:
- `backup-v135-before-v136-real-compact-common`
- `backup-v134-before-v135-common-tree-structure-mix`
- `backup-v131-before-v134-common-tree-mix`

## Rejected experiments / lessons
- **v132 rejected:** bundled tree cleanup, road props, mushroom tree, extra wildlife/buildings and richer sky; changed too much and was rolled back.
- **v133 broadly rejected but useful:** alpha-aware fix applied to CommonTree + TwistedTree + Pine globally; later reused only selected looks.
- **v135 rejected:** synthetic geometry deformation did not reproduce the desired compact CommonTree.

Rule: keep visual changes isolated and get screenshots after each small change.

## Current problematic green blade objects
User has supplied close-ups of narrow/elongated green blade/plank/tree-like objects. Their exact runtime/model source is still **not proven**. Do not remove a tree family based only on appearance. Next debugging should identify the exact runtime/model key with labelled lineup/instrumentation and then change one model at a time while preserving approved v136/v137/v139 work.

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
It protects syntax, generated world/geometry, wildlife, retained v121/v122/v123/v125/v126/v129 behavior, dependency integrity, rejected palm removal, v134 CommonTree mix, v136 exact compact CommonTree, v137 TwistedTree 50/50 split, v139 purple mega-carpets, atmosphere/mountain retention and current release/cache/load wiring.

## Immediate visual/performance test
Run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5 and confirm **Verdant Rift · v139**. Carpet centres now occur approximately every 0.52 km around the lap, starting near 0.26 km and alternating sides. Desired result: large previously empty green plains are substantially covered by dense purple Flower_4 fields, and the visible field edge approaches to roughly 10 cm from asphalt without plants appearing on the road. Also watch startup time/frame rate on the phone because v139 intentionally raises the transform count to ~114k; if performance is poor, preserve the 48/large-field coverage but reduce transform density rather than shrinking the fields.
