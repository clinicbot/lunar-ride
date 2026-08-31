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
- Aqua Rift current release is **v152**.
- v152 code/wiring checkpoint before this handoff: `9aa836a33c211be48045b8ec39f2cbaf7bbcec49`.
- Aqua CI run `33386203118`: **SUCCESS**.
- Verdant CI run `33386203090`: **SUCCESS** on the same checkpoint.
- Canonical backup before v152: `backup-v151-before-aqua-v152-proper-jelly-coral` at exact v151 final HEAD `07fa11d93278a6feceb0966ee04a2ba12cc0fd6e`.
- Two redundant same-HEAD v152 backup branches were also accidentally created (`...-2`, `...-final`); they are harmless. Use the canonical backup above.
- Earlier canonical backups remain: `backup-v150-before-aqua-reef-jelly-v151`, `backup-v149-before-aqua-faces-reef-v150`, `backup-v148-before-aqua-axis-uturn-v149`, `backup-v147-before-aqua-tail-animation-v148`, `backup-v146-before-aqua-swim-motion-v147`, `backup-v145-before-aqua-depth-v146`, `backup-v144-before-aqua-fish-visibility-v145`, `backup-v143-before-aqua-fish-pack-v144`, `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v152 — visible reef walls + the proper shared project jellyfish
New layer: `js/58-aqua-proper-jelly-reef-v152.js`.
Regression: `tests/aqua-v152-proper-jelly-reef-smoke.js`.

### Why v152 exists
After v151 the user clarified two issues from visual testing:
1. The intended jellyfish were **not** Aqua's old procedural `jellyAqua`; he meant the higher-quality jellyfish already used in the other Lunar Ride worlds.
2. The v151 coral extension was technically present but visually too distant/small to read. The visual target is the obvious colourful reef-garden/reef-wall feel seen beside the glass tunnel in the user's Zwift reference screenshot.

### Correct jellyfish source
The exact existing project asset was identified and verified:
- asset: `assets/models/creature_jelly.gltf`
- shared loader already present in `js/06-textures-renderer-setup.js`:
  `loadGLTFCreature('jelly','assets/models/creature_jelly.gltf',{});`
- shared creature metadata: `CREATURE.gjelly` in `js/02-core-geometry.js`.
- renderer already draws `gcre:'jelly'` through the GLCRE path.

v152 therefore removes all v151 actors with `aquaJelly:true` and creates **60** true shared-model actors with:
- `type:'gjelly'`
- `gcre:'jelly'`
- `meta:CREATURE.gjelly`
- `aquaJellyV152:true`.

They alternate left/right, always stay outside the local glass radius, and use three glass-relative distance bands. Exact deterministic count split is 12 close / 30 mid / 18 far. Four height ranges cover ~1.6–14.5 m relative to the road. The normal shared `gjelly` float/wander update supplies slow drift and gentle vertical motion; a v152 Aqua-only wrapper adds only a subtle ±3.5% scale pulse. The old v151 procedural jelly updater is harmless because its actors are removed and v152 actors use a different marker.

`sw.js` now explicitly caches `assets/models/creature_jelly.gltf` as well as the v152 script.

### Reef rebuilt for visibility
v152 deliberately **replaces `w.props` after v151** instead of stacking more weak coral geometry. It reconstructs the approved glass structural ribs/low rails, then adds a new high-visibility coral composition.

- `REEF_STATIONS=350` around the full lap.
- `GROUPS_PER_SIDE=4` per station on each side.
- Exact total: **2,800 coral groups**.
- Depth composition: 700 near / 1,400 mid / 700 far groups.
- Every placement is pushed to at least `glassRadius + 1.35 m`, including widened panorama galleries, so coral never enters the tube.
- The closest layer hugs just outside the glass, the two middle layers create the main visible reef garden/wall, and the far layer extends depth into the underwater fog.
- Shapes are broad/organic: brain/lobe clusters, broad plates, fan clusters, rounded branching gardens and thick sponge clusters. A low teal reef mound gives each group visual mass. No thin coloured pole forms are used.
- Colour bag implements the requested weighting: 25% purple, 20% pink, 20% orange, 15% turquoise, 10% blue, 10% cream/white.
- Visual rhythm: 20% of route stations are richer/larger; 10% are breathing zones at reduced scale; the rest are normal density. Group count stays deterministic while perceived density varies.
- Existing v150 seabed/terrain, road, glass, water and route geometry are not changed.

Telemetry: `world.__aquaV152` includes `reefWallVisible:true`, exact reef counts, density-rhythm counts, colour weights, removed v151 jelly count, `properProjectJelly:true`, `jellyAsset:'assets/models/creature_jelly.gltf'`, `jellyGcre:'jelly'`, exact jelly distance counts, `fishPreserved`, `roadUnchanged`, `glassUnchanged`, and `verdantUntouched:true`.

## Retained Aqua systems
- **v151** `js/57-aqua-coral-jelly-v151.js`: remains in the historical stack/regression, but v152 replaces its props and removes its procedural Aqua jelly actors at runtime.
- **v150** `js/56-aqua-faces-reef-v150.js` + face enhancement in js/54: removes terrestrial scenery/mountains, creates low seabed, and gives all 11 fish geometric eyes/pupils/mouth.
- **v149** `js/55-aqua-uturn-continuity-v149.js`: horizontal tail plane and local U-turn school continuity (135 m capture; 1.15 s hold + 2.35 s rejoin).
- **v148** `js/54-aqua-tail-animation-v148.js`: 24 geometry-baked body/tail frames per species, rigid head, species-specific tail rate.
- **v147** `js/53-aqua-swim-motion-v147.js`: sustained shallow horizontal elliptical swimming, tangent yaw, only ±0.18 m fish depth drift.
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish spread bilaterally through height bands `[-1.5,1,4,8,12]`.
- **v145** `js/51-aqua-fish-visibility-v145.js`: hard Aqua fauna isolation and Quaternius transform fix (scale ×100, pitch -π/2).
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 species, 258 fish; assets in `assets/models/aqua_fish/` with provenance.
- **v143** `js/49-aqua-rift-v143.js`: separate **Aqua Rift — Glass Ocean** scene, transparent half-cylinder tunnel, panorama galleries and overhead water surface.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v152 with cache-buster `?b=152` in order:
1. v143 base Glass Ocean
2. v144 real fish/reef
3. v145 visibility/fauna isolation
4. v146 water-column distribution
5. v147 swimming trajectory
6. v148 body/tail animation + face-enhanced loader
7. v149 U-turn continuity
8. v150 reef-only terrain/props cleanup
9. v151 historical coral/procedural-jelly layer
10. v152 visible reef rebuild + proper shared jellyfish

Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant CI invariants while caching all Aqua layers through js/58, all fish assets, and `assets/models/creature_jelly.gltf`.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.
Aqua CI now protects v143→v152. The v152 regression verifies exact 2,800 reef groups, near/mid/far counts, rich/breathing rhythm, removal of procedural Aqua jelly actors, 60 replacement actors using `type:'gjelly'`, `gcre:'jelly'` and `CREATURE.gjelly`, outside-glass placement, four height bands, fish preservation and pulse behavior. CI also parses `assets/models/creature_jelly.gltf` and verifies the existing shared loader path. Verdant CI remains green on approved v142.

## Immediate visual test for v152
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
- the jellyfish should now visibly be the same project jelly model used in the other worlds, not the old Aqua procedural dome/tentacle mesh;
- colourful coral should form obvious gardens/walls immediately outside both sides of the glass, much closer to the Zwift reference composition;
- the near/mid reef should be visually dominant, with far reef providing depth rather than disappearing entirely in fog;
- occasional denser sections and quieter breathing sections should avoid uniform clutter;
- no coral or jellyfish should enter the glass tube or road;
- existing 258 fish, fish faces/tail motion and U-turn continuity should remain unchanged;
- no terrestrial buildings/masts/mountains/fauna should return;
- Verdant Rift must remain visually unchanged.
