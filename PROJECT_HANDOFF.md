# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify latest `fixes-build-90` HEAD and Aqua/Verdant CI because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`.
- Active branch: `fixes-build-90`; never modify `main` directly.
- Open draft PR #1 targets `main`.
- User updates Windows copy with `UPDATE.bat`, runs `ride.bat`, closes/reopens browser/game, then `Ctrl+F5`.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Create backup before risky world/visual changes.
- GitHub connector access is independent of local git/container networking.

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v149** on top of v143 Glass Ocean, v144 Quaternius fish/reef, v145 visibility/fauna isolation, v146 water-column redistribution, v147 horizontal swimming trajectories and v148 geometry-baked body/tail animation.
- v149 code/wiring checkpoint before this handoff: `7e1817ef0d10a9583591841ba2628db4ed6b735c`.
- Aqua CI run `33372282746`: **SUCCESS**.
- Verdant CI run `33372282765`: **SUCCESS** on the same checkpoint.
- Backup before v149: `backup-v148-before-aqua-axis-uturn-v149`.
- Earlier canonical backups: `backup-v147-before-aqua-tail-animation-v148`, `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v149 — horizontal tail plane + U-turn local continuity
New layer: `js/55-aqua-uturn-continuity-v149.js`.
Updated animation base: `js/54-aqua-tail-animation-v148.js`.
Regressions: `tests/aqua-v148-tail-animation-smoke.js`, `tests/aqua-v149-uturn-continuity-smoke.js`.

### User-observed problems after v148
1. Some fish looked good, but others moved their rear body and tail up/down. Sharks in particular looked as if they were galloping on a horse.
2. After passing a school and immediately pressing U-turn, the local scene could feel very different and the fish school could seem to disappear.

### Root cause of shark/vertical tail motion
All 11 imported Quaternius fish are authored with their body-length axis on local **Y**. v145 applies actor pitch `-Math.PI/2` so they face correctly in the game. Under that rotation:
- local Y becomes forward/back;
- local X remains horizontal left/right;
- local Z becomes world vertical.

The old v148 automatic transverse-axis selector sometimes chose local Z as `sideAxis` because it was geometrically thinner. That was mathematically plausible in model space but visually wrong after the actor pitch: sharks, clownfish, anglerfish, puffer and butterfly-fish could therefore bend vertically.

### v149 horizontal-tail correction
- `analyseFishGeometry()` now forces current Y-long Aqua fish to `sideAxis=0` (local X) and `upAxis=2` (local Z).
- Body/tail deformation therefore remains in the horizontal plane after v145 pitch.
- No deformation is applied to local Z, preventing the galloping/bucking effect.
- Head anchoring, progressive body bend, 24 shared frames per species, per-fish phase and species-specific tail rates remain unchanged.
- Telemetry `world.__aquaFishV148` now includes `horizontalTailPlane:true`.
- Regression decodes all **11 real imported fish meshes** and verifies every one has longAxis Y, sideAxis X, upAxis Z, strong tail movement, anchored head and zero deformation leakage into local Z.

### v149 U-turn continuity
`js/55-aqua-uturn-continuity-v149.js` installs only after `updateActors`, `doUturn` and `segPoint` exist, so it is safe with the real page load order.

When U-turn is pressed in Aqua:
- fish within **135 m** of the rider are captured by their current world-space positions;
- the original `doUturn()` still runs normally; there is no world rebuild, fish respawn or species replacement;
- nearby fish are held in their pre-turn positions for **1.15 s** while their tail animation continues;
- over the next **2.35 s** they ease smoothly back onto their live v147 trajectories;
- after 3.5 s all normal swimming is fully restored;
- fish outside the radius are untouched;
- Verdant and every non-Aqua world are untouched.

This is intentionally local and short-lived: it prevents a just-seen school from visually vanishing during the turn without making the ocean static.

Telemetry: `world.__aquaFishV149` with `uTurnLocalContinuity:true`, `worldRebuild:false`, `fishRespawn:false`, captured/held/rejoining counts and timing values.

## Aqua v148 — geometry-baked fish animation
Active animation file: `js/54-aqua-tail-animation-v148.js`.
- 24 geometry frames per species, shared by all actors of that species.
- Front/head ~14% stays anchored; bend grows smoothly toward tail.
- Tail amplitude ~7.5% of source body length with spatial phase lag.
- Normals deform/renormalize with geometry.
- Independent per-fish tail phase.
- Base tail rates (rad/s): clown 9.2, fishA 7.8, fishB 7.5, fishC 7.7, shark 4.4, angler 5.8, puffer 6.2, lion 7.0, butterfly 8.4, sword 5.2, black-lion 6.8.
- Deferred `installTailUpdate()` is required because js/54 loads before js/07 defines `updateActors`.
- This is procedural geometry animation, not evaluation of the native glTF animation clips.

## Aqua v147 — horizontal swimming trajectory
Active: `js/53-aqua-swim-motion-v147.js`.
- Horizontal shallow ellipses, major axis 8–15 m, minor 1.4–3.2 m.
- Angular speed ~0.20–0.34 rad/s, both directions.
- Fish yaw follows actual velocity/tangent.
- Only ±0.18 m slow depth drift.
- v148/v149 supply correct horizontal body/tail propulsion.

## Aqua v146 — water-column distribution
Active: `js/52-aqua-depth-distribution-v146.js`.
Same 258 fish are bilateral across five relative height bands `[-1.5, 1.0, 4.0, 8.0, 12.0]`, with floor-clearance protection and paired left/right schools.

## Aqua v145 — visibility + fauna isolation
Active: `js/51-aqua-fish-visibility-v145.js`.
Positive isolation retains real Aqua fish plus optional NPC riders, removes terrestrial fauna aliases, and restores imported transform at actor level: scale ×100, pitch -π/2.

## Aqua v144 — Quaternius CC0 fish + reef
Active: `js/50-aqua-real-fish-v144.js`.
Assets: `assets/models/aqua_fish/`; provenance: `assets/models/aqua_fish/PROVENANCE.md`.
Eleven models: clownfish, fish-a, fish-b, fish-c, shark, anglerfish, puffer, lionfish, butterfly-fish, swordfish, black-lionfish. Total 258 fish; extra 420 coral + 180 kelp on top of v143.

## Aqua v143 — Glass Ocean base
Primary: `js/49-aqua-rift-v143.js`; card: `assets/images/aqua_rift_card.svg`.
Separate **Aqua Rift — Glass Ocean** world with transparent half-cylinder tunnel, panoramic galleries, high water surface and reef. Preserve this approved visual base while tuning fauna.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v149 with cache-buster `?b=149` in this order:
1. v143 base
2. v144 real fish/reef
3. v145 visibility/isolation
4. v146 distribution
5. v147 trajectory
6. v148 body/tail animation
7. v149 U-turn continuity

Verdant files remain `?b=142`. `sw.js` intentionally retains cache name `lunar-ride-v142` while caching all Aqua layers through js/55 and all fish assets.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.
Aqua CI now protects v143 base, v144 fish/provenance, v145 transform/isolation, v146 distribution, v147 horizontal trajectories, v148 real-mesh horizontal body/tail deformation and deferred install, plus v149 U-turn continuity and loader/offline wiring. Verdant CI continues protecting v142.

## Immediate visual test for v149
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check especially:
- sharks should no longer buck/gallop up and down; the tail/body flex should be lateral;
- clownfish, anglerfish, puffer and butterfly-fish should also lose the vertical tail swing;
- species that already looked good should remain good;
- pass a visible school, immediately press U-turn: the same nearby school should remain where you just saw it for the turn, then gradually resume normal movement rather than apparently vanishing;
- normal swimming should be fully restored a few seconds after the turn;
- no cats/deer/birds return and Verdant remains unchanged.
