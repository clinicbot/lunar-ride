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
- v148 code/wiring checkpoint before this handoff: `98ad3cfcf40942bbc2792dc371959d982ab7e998`.
- Aqua CI run `33368890909`: **SUCCESS**.
- Verdant CI run `33368890925`: **SUCCESS** on the same checkpoint.
- Backup before v148: `backup-v147-before-aqua-tail-animation-v148`.
- Canonical earlier backups: `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v148 — visible body and tail animation
Active layer: `js/54-aqua-tail-animation-v148.js`.
Regression: `tests/aqua-v148-tail-animation-smoke.js`.

### User-observed v147 limitation
v147 fixed the obviously wrong metre-scale vertical bob and made fish travel horizontally, but the fish meshes themselves remained rigid. The user explicitly asked to make the body/tail move while swimming.

### v148 implementation
- Aqua-only; non-Aqua creature loading and frame rendering delegate to the existing engine paths.
- Intercepts loading only for the 11 `aq*` fish model keys.
- Reuses the existing Quaternius CC0 fish assets and the actor-level ×100 / -π/2 correction from v145.
- Bakes **24 geometry frames per species** once at load time; actors share those GPU frame buffers, so 258 fish do not each allocate their own animated mesh.
- Automatically analyses each model's bounding box to identify its longitudinal body axis, lateral bend axis, and which end is the narrower tail end.
- Head/front ~14% remains effectively anchored; body curvature increases smoothly toward the tail.
- Tail lateral amplitude is about **7.5% of source body length** with a spatial phase lag so the body forms a travelling S-like wave rather than rotating as one rigid block.
- Normals are rotated and renormalized with the bend, preserving lighting quality.
- Each fish gets an independent tail phase; small fish beat faster and shark/swordfish slower.
- Species base phase speeds (rad/s): clown 9.2, fishA 7.8, fishB 7.5, fishC 7.7, shark 4.4, angler 5.8, puffer 6.2, lion 7.0, butterfly 8.4, sword 5.2, black-lion 6.8, plus slight per-fish variation.
- `glCreFrame()` uses the v148 baked frame only for `aquaFish` whose model has `aquaTailAnimated`; all other creatures retain the legacy frame path.
- Telemetry: `world.__aquaFishV148` with `geometryBaked:true` and `headAnchored:true`; v147 gets `correctedByV148=true`.

### Validation against real assets
The v148 regression decodes and deforms **all 11 actual imported fish glTF meshes**, not only a synthetic fixture. It verifies the head region remains effectively fixed and the tail changes substantially between phases. All 11 passed: clownfish, fish-a, fish-b, fish-c, shark, anglerfish, puffer, lionfish, butterfly-fish, swordfish and black-lionfish. Shark and butterfly-fish were correctly detected with the tail on the opposite longitudinal end from most other species.

Important transparency: the original Quaternius files still contain native animation clips, but v148 does **not** evaluate those native glTF animation channels. It uses a robust procedural geometry-baking animation designed to work consistently across all 11 imported models in Lunar Ride's lightweight renderer.

## Aqua v147 — horizontal swimming trajectory
Active: `js/53-aqua-swim-motion-v147.js`.
Regression: `tests/aqua-v147-swim-motion-smoke.js`.

- Replaces generic drone bob with horizontal shallow ellipses.
- Major axis 8–15 m; minor axis 1.4–3.2 m.
- Angular speed ~0.20–0.34 rad/s in both directions.
- Fish yaw follows actual velocity/tangent.
- Only ±0.18 m slow vertical drift remains.
- v148 now supplies the visible propulsion/body flex that v147 lacked.

## Aqua v146 — full water-column distribution
Active: `js/52-aqua-depth-distribution-v146.js`.
Regression: `tests/aqua-v146-depth-distribution-smoke.js`.

Same 258 fish are distributed bilaterally around the route across five relative height bands `[-1.5, 1.0, 4.0, 8.0, 12.0]`, with floor-clearance protection and paired left/right schools.

## Aqua v145 — visibility + hard fauna isolation
Active: `js/51-aqua-fish-visibility-v145.js`.
Regression: `tests/aqua-v145-fish-visibility-smoke.js`.

- Positive Aqua isolation keeps only real `aquaFish` actors plus optional NPC riders, removing cats/deer/birds and legacy aliases such as `gcat/gstag/gbird`.
- Restores imported FBX2glTF node transform at actor level: scale ×100 and pitch -π/2.
- Keeps schools close enough to the glass to remain visible.

## Aqua v144 — Quaternius CC0 fish + dense reef
Active: `js/50-aqua-real-fish-v144.js`.
Regression: `tests/aqua-v144-real-fish-smoke.js`.
Fish assets: `assets/models/aqua_fish/`; provenance: `assets/models/aqua_fish/PROVENANCE.md`.

Eleven fish models: clownfish, fish-a, fish-b, fish-c, shark, anglerfish, puffer, lionfish, butterfly-fish, swordfish, black-lionfish. v144 creates **258 real fish actors** and adds 420 coral + 180 kelp on top of v143, targeting ~640 coral + 320 kelp total.

## Aqua v143 — Glass Ocean base
Primary: `js/49-aqua-rift-v143.js`.
World card: `assets/images/aqua_rift_card.svg`.
Regression: `tests/aqua-rift-v143-smoke.js`.

- Separate world id `aqua`, **Aqua Rift — Glass Ocean**.
- Continuous transparent half-cylinder glass canopy, base radius 8.8 m, four widened galleries.
- Water surface ~48 m above highest road.
- Base reef 220 coral + 140 kelp.
- User visually liked the base underwater look; preserve it while tuning fauna.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v148 with cache-buster `?b=148`, ending with `js/54-aqua-tail-animation-v148.js?b=148`. Verdant files remain `?b=142`.

`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant invariants while caching all Aqua layers including v148 and all fish assets.

## Higher-quality fish direction
User would also like higher graphical-quality fish. Do not replace the 258 school fish wholesale with extremely high-poly textured models. Preferred future approach: keep optimized school fish and add a small number of optimized high-detail hero fish, ideally after texture/normal-map support or model baking/decimation is implemented.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua.
- mushrooms at 25% of v141 scale;
- bilateral hillside flower blankets with four intermixed colour groups;
- 14 bears total;
- v140 cats/dragonflies/deer/buildings retained;
- approved v137 TwistedTree and v136 CommonTree mixes retained;
- rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms stay off;
- GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI protects v143 base, v144 fish/reef/provenance, v145 transform/isolation, v146 depth distribution, v147 horizontal trajectory, and v148 body/tail animation. v148 regression explicitly validates all 11 real fish meshes. Verdant CI protects approved Verdant v142 and historical invariants.

## Immediate visual test for v148
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check close fish in motion: body should flex progressively toward the tail, tail should beat clearly side-to-side, head should remain comparatively stable, shark/swordfish should beat more slowly than small reef fish, horizontal trajectory and low/eye/mid/high bilateral distribution should remain, no terrestrial fauna should reappear, and FPS/startup should remain acceptable. If animation is visually too strong or too subtle, tune v148 amplitude/frequency only; preserve v143–v147 behavior and Verdant v142.
