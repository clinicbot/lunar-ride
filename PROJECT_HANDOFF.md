# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow

- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- `ride.bat` supports both `python` and `py` launchers.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky world/visual changes.

## Current checkpoint — 2026-08-30

- Current Verdant Rift release: **v133**.
- Main v133 code commit: `b3f731d36a15fb20b338500b3167a8064ba85bd7` (`Verdant v133 fix alpha-masked tree leaves`).
- CI run `33323473141`: **SUCCESS**; every step passed, including retained world/wildlife/terrain regressions and the new v133 alpha-aware leaf test.
- Backup immediately before v133: `backup-v131-before-v133-alpha-leaf-fix`.
- v132 was visually rejected and fully rolled back in forward commit `21b8160744d6dedaa6ba206b02ba6e99d407b16b` (`Rollback Verdant v132 to v131 baseline`).
- Therefore **v133 uses the exact v131 world/wildlife/terrain/sky baseline**, plus only the tree-leaf alpha correction described below.

## v133 — alpha-masked tree-leaf correction

User supplied screenshots of giant green blade/plank shapes. Investigation showed the earlier TwistedTree-only diagnosis was wrong: those shapes remained when TwistedTree was removed in rejected v132.

Root cause: imported tree assets (`CommonTree`, `TwistedTree`, `Pine`) use alpha-masked leaf cards (`alphaMode: MASK`). The v129 imported-nature loader bakes textures to vertex colours and samples one alpha value per original triangle. When that sample lands on an opaque leaf region, the entire large leaf-card triangle is retained as solid green geometry, producing the blade/plank artifacts.

New file: `js/39-verdant-alpha-leaves-v133.js`.

It:
- reloads only the existing tree families: `CommonTree_1/3/5`, `TwistedTree_1/3`, `Pine_1/3/5`;
- detects leaf materials using `MASK` + leaf/leaves material names;
- splits each original leaf triangle into four smaller triangles;
- samples the source alpha mask independently for each sub-triangle and discards transparent pieces;
- samples source colour per emitted vertex;
- leaves all instance positions, scales, tree density, wildlife, buildings, terrain and road layout untouched;
- swaps only corrected tree geometry into `w.instNature.models` before the GPU instancing renderer uploads it;
- exposes telemetry under `w.__verdantLeafAlphaV133` and `window.__verdantLeafAlphaStatusV133`.

The v133 gate waits for corrected tree models before Verdant starts, so the old opaque-card geometry should not win a load race.

## Retained v131 / v129 baseline

- Rejected v130 photogrammetry palms remain fully removed.
- Legacy 26k billboard vegetation remains hard-disabled.
- `js/38` still filters imported plants against the globally nearest road leg.
- `js/37-verdant-mountains-v129.js` retains the final roadbed (`ROAD_FLAT=29`, `ROAD_BLEND=72`) and anti-dome terrain shaping.
- `js/36-verdant-wildlife-v125.js` + `js/38` retain the denser deer, cats, bears, monkeys, frogs, dragonflies and bird flocks from the good v131 baseline.
- `js/32-verdant-fauna-buildings-v121.js` retains the existing settlement/building layout.
- v128/v126 mountain cleanup remains intact.
- `assets/images/sky_verdant.svg` remains the v131 atmosphere-only sky; rejected v132 ringed-planet/cloud changes are not active.

## Rejected v132 lesson

Do not repeat broad family removal or combined world changes without visual confirmation. v132 removed too much attractive vegetation, reduced the apparent wildlife, failed to show the mushroom tree reliably, and left the ugly green objects. Future visual changes should be narrow and independently testable.

## Four uploaded GLB candidates

The four newer uploaded GLBs were inspected locally but are **not in the active repo/world** after the v132 rollback. Raw triangle counts were roughly 87k, 157k, 156k and 127k. The third is a mushroom-tree candidate. Do not re-integrate until a simplified version is previewed and the user explicitly approves the look.

## CI

Workflow: `.github/workflows/verdant-ci.yml`.

It protects:
- JavaScript syntax;
- generated world + real geometry;
- retained v121/v122/v123/v125/v126/v129 behavior;
- creature/building and imported-nature asset integrity;
- rejected v130 palm removal;
- v133 alpha-aware tree-leaf wiring and markers;
- atmosphere-only sky + retained v128 alpine cleanup;
- current v133 release/cache/load order.

## Immediate next visual test

User should run `UPDATE.bat`, close/reopen Lunar Ride, Ctrl+F5, and confirm **Verdant Rift · v133**. Inspect the same locations/screenshots that previously showed giant green leaf blades/planks. The red/attractive trees and v131 wildlife density should remain. If the alpha fix looks bad or performance suffers, revert to `backup-v131-before-v133-alpha-leaf-fix` via a forward rollback commit.
