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
- Aqua Rift current layer is **v148** on top of v143 Glass Ocean, v144 Quaternius fish/reef, v145 visibility/fauna isolation, v146 water-column redistribution, and v147 horizontal swimming trajectories.
- Current v148 runtime/test checkpoint before this handoff: `460bcc9742f730267fa878934eb84703c7a29bfc`.
- Aqua CI run `33369307877`: **SUCCESS**, including real-model deformation and real browser-order deferred-install regression.
- Verdant CI run `33369307909`: **SUCCESS** on the same checkpoint.
- Backup before v148: `backup-v147-before-aqua-tail-animation-v148`.
- Canonical earlier backups: `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v148 — visible body and tail animation
Active layer: `js/54-aqua-tail-animation-v148.js`.
Regression: `tests/aqua-v148-tail-animation-smoke.js`.

### User-observed v147 limitation
v147 fixed the metre-scale vertical bob and made fish travel horizontally, but the fish meshes themselves remained rigid. The user explicitly asked to make the body/tail move while swimming.

### v148 implementation
- Aqua-only; non-Aqua creature loading and frame rendering delegate to existing engine paths.
- Intercepts loading only for the 11 `aq*` fish model keys.
- Reuses the Quaternius CC0 assets and actor-level ×100 / -π/2 correction from v145.
- Bakes **24 geometry frames per species** once at load time; the 258 actors share those model frame buffers.
- Automatically analyses each model to identify body-length axis, lateral bend axis and which end is the narrower tail end.
- Front/head ~14% stays effectively anchored; bend grows smoothly toward the tail.
- Tail lateral amplitude ≈ **7.5% of source body length**, with spatial phase lag for a travelling S-like body wave rather than rigid rotation.
- Normals are bent/renormalized with geometry to preserve lighting.
- Independent per-fish tail phase; reef fish beat faster, shark/swordfish slower.
- Base tail phase rates (rad/s): clown 9.2, fishA 7.8, fishB 7.5, fishC 7.7, shark 4.4, angler 5.8, puffer 6.2, lion 7.0, butterfly 8.4, sword 5.2, black-lion 6.8, with slight per-fish variation.
- `glCreFrame()` uses v148 frames only for `aquaFish` on models marked `aquaTailAnimated`; every other creature keeps the legacy path.
- Telemetry: `world.__aquaFishV148` with `geometryBaked:true`, `headAnchored:true`, `deferredUpdateInstall:true`; v147 gets `correctedByV148=true`.

### Critical runtime-order fix
`js/19` loads Aqua layers before `js/07-ride-physics.js`, so `updateActors` does not yet exist when `js/54` first executes. An early v148 implementation tried to wrap it immediately; this would have left the tail phase frozen in the real browser even though geometry tests passed. Final v148 uses `installTailUpdate()` with a zero-delay retry until `updateActors` exists, mirroring the proven v147 install pattern. The regression now explicitly simulates this exact page order: load js54 with no `updateActors`, verify deferred installation is queued, define the physics updater later, run the queued installer, and verify tail phase advances.

### Validation against actual fish assets
The regression decodes and deforms **all 11 actual imported glTF meshes**, not just a synthetic fish. For every species it verifies the head region stays effectively fixed while the tail changes substantially between animation phases. All passed: clownfish, fish-a, fish-b, fish-c, shark, anglerfish, puffer, lionfish, butterfly-fish, swordfish and black-lionfish. Shark and butterfly-fish are correctly auto-detected with the tail on the opposite longitudinal end from most other species.

Important transparency: the Quaternius files still contain native animation clips, but v148 does **not** evaluate native glTF animation channels. It uses procedural geometry-baked body/tail animation that works consistently with Lunar Ride's lightweight renderer.

## Aqua v147 — horizontal swimming trajectory
Active: `js/53-aqua-swim-motion-v147.js`.
Regression: `tests/aqua-v147-swim-motion-smoke.js`.
- Horizontal shallow ellipses, major axis 8–15 m and minor 1.4–3.2 m.
- Angular speed ~0.20–0.34 rad/s, both directions.
- Fish yaw follows actual velocity/tangent.
- Only ±0.18 m slow vertical drift.
- v148 supplies the body/tail propulsion flex that v147 lacked.

## Aqua v146 — full water-column distribution
Active: `js/52-aqua-depth-distribution-v146.js`.
Regression: `tests/aqua-v146-depth-distribution-smoke.js`.
Same 258 fish are bilateral across five relative height bands `[-1.5, 1.0, 4.0, 8.0, 12.0]`, with floor-clearance protection and paired left/right schools.

## Aqua v145 — visibility + hard fauna isolation
Active: `js/51-aqua-fish-visibility-v145.js`.
Regression: `tests/aqua-v145-fish-visibility-smoke.js`.
- Positive isolation retains only real Aqua fish plus optional NPC riders, removing cats/deer/birds and aliases `gcat/gstag/gbird`.
- Restores imported node transform at actor level: scale ×100, pitch -π/2.
- Keeps schools near enough to glass to remain visible.

## Aqua v144 — Quaternius CC0 fish + dense reef
Active: `js/50-aqua-real-fish-v144.js`.
Regression: `tests/aqua-v144-real-fish-smoke.js`.
Fish assets: `assets/models/aqua_fish/`; provenance: `assets/models/aqua_fish/PROVENANCE.md`.
Eleven models: clownfish, fish-a, fish-b, fish-c, shark, anglerfish, puffer, lionfish, butterfly-fish, swordfish, black-lionfish. v144 creates **258 fish** and adds 420 coral + 180 kelp on top of v143, targeting ~640 coral + 320 kelp.

## Aqua v143 — Glass Ocean base
Primary: `js/49-aqua-rift-v143.js`; card: `assets/images/aqua_rift_card.svg`; regression: `tests/aqua-rift-v143-smoke.js`.
Separate **Aqua Rift — Glass Ocean** world with continuous transparent half-cylinder glass canopy, 8.8 m base radius, four widened galleries, water surface ~48 m above highest road and base reef 220 coral + 140 kelp. Preserve the visually approved base while tuning fauna.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v148 with cache-buster `?b=148`, ending with `js/54-aqua-tail-animation-v148.js?b=148`. Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant invariants while caching all Aqua layers including v148 and all fish assets.

## Higher-quality fish direction
User also wants higher graphical-quality fish. Do not replace all 258 school fish with extremely high-poly textured models. Preferred future approach: retain optimized school fish and add a small number of optimized high-detail hero fish, ideally after texture/normal-map support or baking/decimation.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms remain 25% scale; bilateral four-colour hillside flowers remain; 14 bears remain; v140 cats/dragonflies/deer/buildings remain; approved v137 TwistedTree and v136 CommonTree mixes remain. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms stay off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua: `.github/workflows/aqua-ci.yml`; Verdant: `.github/workflows/verdant-ci.yml`. Aqua CI protects v143 base, v144 fish/reef/provenance, v145 transform/isolation, v146 distribution, v147 trajectory, v148 real-mesh body/tail deformation and deferred real-page-order installation. Verdant CI protects approved Verdant v142.

## Immediate visual test for v148
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**. Watch close fish in motion: body should flex progressively toward the tail, tail should beat clearly side-to-side, head should remain comparatively stable, shark/swordfish should beat slower than small reef fish, v147 horizontal movement and v146 height distribution should remain, no terrestrial fauna should reappear, and FPS/startup should stay acceptable. If animation is too strong/subtle, tune v148 amplitude/frequency only.
