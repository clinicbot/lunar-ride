# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify latest `fixes-build-90` HEAD and Aqua/Verdant CI because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`.
- Active branch: `fixes-build-90`; never modify `main` directly.
- Open draft PR #1 targets `main`.
- User updates Windows copy with `UPDATE.bat`, runs `ride.bat`, closes/reopens browser/game, then `Ctrl+F5`.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Create a backup branch before risky visual/world changes.
- GitHub connector access is independent of local git/container networking; do not confuse the two.

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v151**, layered over v143 Glass Ocean through v150 reef-only cleanup/fish faces.
- v151 code/wiring checkpoint before this handoff: `6e161dfd78f94e51a0f7e84341c37889fe12f98b`.
- Aqua CI run `33376568183`: **SUCCESS**.
- Verdant CI run `33376568190`: **SUCCESS** on the same checkpoint.
- Backup before v151: `backup-v150-before-aqua-reef-jelly-v151` at v150 final HEAD `857d4e9f3d76cdcbe941590e1a99c50ca8526fa2`.
- Earlier canonical backups remain: `backup-v149-before-aqua-faces-reef-v150`, `backup-v148-before-aqua-axis-uturn-v149`, `backup-v147-before-aqua-tail-animation-v148`, `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v151 — coral gardens + restored jellyfish
New layer: `js/57-aqua-coral-jelly-v151.js`.
Regression: `tests/aqua-v151-coral-jelly-smoke.js`.

User approved the clean v150 underwater direction and asked to enrich the now-empty seabed with coral and restore the jellyfish from the earlier Aqua world.

### Coral enrichment
v151 **adds** a second reef mesh after v150 rather than changing v150's cleanup logic.
- `REEF_STATIONS=176` around the full lap.
- Every station places `CORALS_PER_SIDE=4` on each side: **1,408 additional coral placements**.
- Four distance bands from the road/tunnel: roughly `14–40`, `38–82`, `76–132`, `122–198 m`, always pushed outside the local glass radius.
- Coral is bilateral and deliberately distributed through near/mid/far depth so the water floor reads as a reef rather than a bare flat plane.
- Forms are low organic shapes only: brain/lobe coral, squat plates, fan clusters and low branching gardens. No tall coloured pole-like forms.
- Nine-colour mixed palette (coral pink/orange/purple/cyan/yellow/green etc.).
- Near reef is smaller and lower to preserve road readability; distant reef scales up modestly so it survives underwater fog.
- The v150 structural ribs, clean seabed and existing v150 reef are retained; v151 merges only the new reef geometry into `w.props`.

Telemetry: `world.__aquaV151` with `reefExtension:true`, exact placement/head counts, distance bands and `bilateral:true`.

### Restored jellyfish
v143's translucent `jellyAqua` procedural mesh was still present in `actorMeshes`; v144 had only removed its actors. v151 reuses that approved mesh rather than introducing a new asset.
- `JELLY_COUNT=52`.
- Jellyfish alternate left/right around the lap and are placed **outside the glass envelope** (`glass radius + at least ~9 m`).
- Five height bands relative to the route: `[2.8, 5.5, 9.0, 13.0, 17.5] m`, with seabed clearance protection.
- Small slow horizontal orbit only; the original gentle drone-style vertical drift is appropriate for jellyfish and is intentionally retained.
- A deferred Aqua-only `updateActors` wrapper adds a subtle bell pulse by varying `a.k` about ±5.5%; it preserves the underlying actor update and installs safely before/after js/07 load order.
- Jellyfish carry `aquaJelly:true`; existing 258 real fish are not modified by v151.
- Non-Aqua worlds are untouched.

Telemetry records exact jelly count, five height bands, `jellyOutsideGlass:true` and pulse activity.

## Aqua v150 — clean underwater stage + readable fish faces
Files: `js/56-aqua-faces-reef-v150.js` and face enhancement inside `js/54-aqua-tail-animation-v148.js`.
- Discards leaked generic `w.props` (cities/stations/masts/screens/terrestrial rocks) in Aqua only.
- Clears `w.screens` and `w.veg`.
- Replaces mountain terrain with a low softly rolling seabed while preserving the actual road/profile/physics/glass/water.
- Rebuilds glass structural ribs and **900** low organic coral placements into props.
- Re-anchors all 258 fish against the clean seabed.
- All 11 real Quaternius fish species receive geometric eyes, pupils and mouth baked into the rigid head region of their shared 24-frame animation buffers.
- v150 regression decodes all 11 actual fish assets and verifies faces stay rigid while tails flex.

## Aqua v149 / v148 / v147 retained
- **v149** `js/55-aqua-uturn-continuity-v149.js`: forces tail flex into world-horizontal plane and preserves nearby fish schools across U-turns (135 m capture; 1.15 s hold + 2.35 s rejoin).
- **v148** `js/54-aqua-tail-animation-v148.js`: 24 geometry-baked body/tail frames per species, head anchored, species-specific tail rates; v150 also adds face geometry here.
- **v147** `js/53-aqua-swim-motion-v147.js`: sustained shallow horizontal elliptical swimming, tangent yaw, only ±0.18 m fish depth drift.

## Aqua v146 / v145 / v144 / v143 retained
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish spread bilaterally through height bands `[-1.5,1,4,8,12]`.
- **v145** `js/51-aqua-fish-visibility-v145.js`: hard fauna isolation, imported fish scale ×100, pitch -π/2.
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 species, 258 fish. Assets in `assets/models/aqua_fish/`, provenance in `PROVENANCE.md`.
- **v143** `js/49-aqua-rift-v143.js`: separate **Aqua Rift — Glass Ocean** world with transparent half-cylinder glass tunnel, widened panorama galleries, overhead water surface and original procedural jelly mesh.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v151 with cache-buster `?b=151` in this order:
1. v143 base Glass Ocean
2. v144 real fish/reef
3. v145 visibility/fauna isolation
4. v146 water-column distribution
5. v147 swimming trajectory
6. v148 body/tail animation + face-enhanced loader
7. v149 U-turn continuity
8. v150 reef-only terrain/props cleanup
9. v151 additional coral gardens + jellyfish

Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant CI invariants while caching all Aqua layers through `js/57` plus all fish assets.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.
Aqua CI protects v143→v151 including all real fish assets, fish transforms/distribution/swimming/tail animation/U-turn continuity, geometric faces, reef-only world cleanup, v151 coral/jelly behavior and loader/offline wiring. Verdant CI continues protecting approved v142.

## Immediate visual test for v151
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
- seabed should now feel substantially richer on both sides, with coral visible close, mid-distance and into the underwater fog;
- coral should stay outside the glass/road and remain low/organic rather than looking like poles;
- 52 jellyfish should be visible intermittently at multiple heights and on both sides, drifting slowly and pulsing subtly;
- jellyfish must remain outside the glass tube;
- existing fish movement, faces and v149 U-turn continuity should remain unchanged;
- no terrestrial buildings/masts/mountains/fauna should return;
- Verdant Rift must remain visually unchanged.
