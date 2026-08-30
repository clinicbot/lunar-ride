# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Verdant CI run because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky visual/world changes.
- GitHub connector access is independent of local `git clone`; do not infer connector availability from container networking.

## Current checkpoint — 2026-08-30
- Current Verdant Rift release: **v142**.
- Final v142 code/wiring commit before this handoff: `bed82ae043e179b8a5f2e8268bfdbefab1ea4399`.
- Code CI run `33335047221`: **SUCCESS**, including the v142 mushroom/carpet/colour/bear regression and current wiring checks.
- Backup immediately before v142: `backup-v141-before-v142-mushroom-carpet-fix`.
- v141 is the clean rollback point before the mushroom-size, bilateral-carpet, colour-mix and bear-restoration corrections.

## v142 — quarter mushrooms, bilateral hillside flower blankets, four-colour mix, bears x2
Active correction file: `js/48-verdant-mushroom-carpet-fix-v142.js`.
Regression: `tests/verdant-v142-mushroom-carpet-smoke.js`.

### Mushrooms
- Every currently rendered mushroom group is scaled by **0.25** relative to v141.
- This includes the uploaded mushroom model from v141 and the older baseline mushroom group.
- No mushroom-tree model is restored.

### Flower blankets
- The old one-sided `flower4MegaCarpetV139` runtime group is removed by v142 and rebuilt from the same approved 48 v139 patch centres.
- Every patch is generated on **both sides of the road**.
- Coverage reaches at least **170 m from the road centre** and follows `meshH()`, so it climbs the real green hillsides instead of remaining on a flat shoulder.
- Snow zone 7 and water are excluded.
- Global nearest-road clipping remains active; visible flowers still target about **10 cm from the asphalt edge**.
- The base model remains `Flower_4_Group.gltf`; GPU instancing remains intact.

### Random flower colours
The bilateral blankets are split into four GPU-instanced groups:
- `flower4HillsideCurrentV142` — **25% original colour**;
- `flower4HillsidePurpleV142` — **25% purple**;
- `flower4HillsideBlueV142` — **25% blue**;
- `flower4HillsideRedV142` — **25% red**.

Colour assignment uses a deterministic shuffled colour bag for each patch side, so the four colours are quarter-balanced but visually random and intermixed, not striped or clustered by colour. Clearly green leaf/stem vertices are preserved; tinting targets the non-green flower material.

### Bears
- Pre-v142 approved world had **7 bears** total.
- v142 counts the actual bear actors after all earlier world layers and adds only the missing number to reach **14 total**.
- New bears are placed deterministically across forest and alpine/descent areas.
- Existing bears are never removed.
- Imported `vbear` is used when ready, otherwise the existing procedural bear actor remains a fallback.

Telemetry: `w.__verdantVisualFixV142` exposes mushroom scaling, carpet counts/coverage, four colour counts, and bear before/target/added/final counts.

## v141 — uploaded mushroom model
Active files:
- `assets/models/verdant_mushroom_uploaded_v141.gltf`
- `js/46-verdant-uploaded-mushroom-model-v141.js`
- `js/47-verdant-uploaded-mushroom-replace-v141.js`

The user's uploaded single mushroom was optimized to a lightweight self-contained glTF and replaced v140's generic giant/small mushroom display groups. v142 retains that model but quarters all mushroom instance scales.

## v140 — approved wildlife/building expansion retained
Active file: `js/45-verdant-wildlife-buildings-mushrooms-v140.js`.
- robot cats: **10x** pre-v140 population;
- exactly half of final cats are **2x scale**;
- robot dragonflies: **10x**;
- deer/stags: **3x**;
- buildings: **5x**;
- includes paired roadside building sites so the road passes between structures;
- all requested animal/building multipliers remain protected by regression tests.
- v142 changes bears separately and does not alter cats, dragonflies, deer or buildings.

Backup before v140: `backup-v139-before-v140-wildlife-buildings-mushrooms`.

## v139 — approved Flower_4 mega-carpet source
Active source file: `js/44-verdant-purple-flower-megacarpets-v139.js`.
- 48 carpet centres around the full 25 km lap;
- original target 113,760 Flower_4 instances;
- road-edge gap ~0.10 m.
- In v142, its runtime one-sided group is replaced by the bilateral four-colour hillside groups, but its patch definitions remain the source geometry/profile.

Backup before v139: `backup-v138-before-v139-mega-purple-carpets`.

## Approved tree state
### v137 TwistedTree
`js/42-verdant-twisted-tree-mix-v137.js`
- only `twisted1/twisted3`;
- 50% bright-red current form;
- 50% exact v133 alpha-aware darker/denser form.

Backup: `backup-v136-before-v137-twisted-50-50`.

### v136 CommonTree
Active files:
- `js/39-verdant-common-tree-mix-v134.js`
- `js/41-verdant-common-tree-compact-v136.js`

Final CommonTree mix:
- 65% original bright;
- 25% darker foliage/original geometry;
- 10% exact v133 alpha-aware compact form.

Do not reactivate rejected `js/40-verdant-common-tree-structure-v135.js`.

## Rejected experiments / lessons
- v132 bundled too many unrelated changes and was rejected. Never restore it wholesale.
- v133 global alpha-aware changes were rejected globally; only the selectively approved CommonTree/TwistedTree looks remain.
- v135 synthetic CommonTree deformation was rejected.
- v130 photogrammetry palms were rejected and remain removed.

## Current unresolved green blade objects
The narrow/elongated green blade/plank/tree-like objects still have no proven runtime/model source. Do not remove a family based only on appearance. Identify the exact model/runtime key first, then change one source at a time while preserving v136/v137/v140/v141/v142.

## Retained world systems
- v129 world cleanup remains baseline: legacy triangular `w.veg` disabled, global route-nearest filtering, road support and wildlife density retained.
- Mountains retain v126/v128/v129 protections and anti-dome work.
- Sky remains v131 atmosphere-only.
- GPU nature instancing remains `js/28-verdant-instanced-renderer.js`; do not bake duplicated vegetation geometry.
- Settlements originate in v121 and are expanded by v140.
- Wildlife originates in v125/v129, is expanded in v140, and bears are restored to 14 by v142.

## CI
Workflow: `.github/workflows/verdant-ci.yml` on pushes to `fixes-build-90`.
Current CI protects syntax, generated world/geometry, v121/v122/v123/v125/v126/v129 behavior, asset dependencies, rejected palm removal, v134/v136/v137 tree states, v139 carpet source, v140 multipliers/buildings, v141 uploaded mushroom, v142 quarter-scale mushrooms + bilateral hillside carpets + four-colour random mix + 14 bears, atmosphere/mountain retention, and v142 release/cache/load wiring.

## Immediate visual/performance test
Run `UPDATE.bat` → close/reopen `ride.bat` → `Ctrl+F5` and confirm **Verdant Rift · v142**.
Check several kilometres, not just the start. Desired result:
- mushrooms visibly about one-quarter the v141 size;
- flower blankets on **both** sides wherever a carpet zone occurs;
- blankets climbing green hillsides, not stopping at the road shoulder;
- flowers randomly intermixed as original/purple/blue/red in roughly equal quarters;
- bears visible again, with **14 total** in the generated world;
- v140 cats, dragonflies, deer and expanded buildings unchanged.

Watch FPS because v139/v142 flower transforms are intentionally numerous. If performance becomes the only problem, optimize streaming/culling before reducing approved visual coverage.
