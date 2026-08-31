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
- Aqua Rift current release is **v153**.
- v153 code/wiring/CI feature checkpoint: `d3a3d03094e390b38df676d5973f451fd635127a`.
- Aqua CI run `33392300322`: **SUCCESS**.
- Verdant CI run `33392300238`: **SUCCESS** on the same checkpoint.
- Canonical backup immediately before v153: `backup-v152-before-aqua-hq-coral-v153` at exact pre-v153 HEAD `23c96d831701f69c743d3cb49c48f429cba761b2`.
- Earlier canonical backups remain available for v143→v152 history.
- `js/09-bluetooth.js` remains untouched.

## Aqua v153 — high-quality coral geometry
New layer: `js/59-aqua-hq-coral-v153.js`.
Regression: `tests/aqua-v153-hq-coral-smoke.js`.

### Why v153 exists
The user visually tested v152 and reported that the coral was present but graphically very low quality. The problem was not density: v152 already had 2,800 groups. The weak point was that recognizable coral forms were approximated mainly by spheres and cylinders.

v153 therefore keeps the established composition but **rebuilds `w.props` again** with better geometry rather than stacking more coral.

### Six recognizable coral families
1. **Branching / staghorn** — tapered tubes in arbitrary 3-D directions, secondary branches and rounded bright tips at higher LOD.
2. **Sea fan** — radial spokes plus connecting lattice so the silhouette reads as a fan rather than a row of blobs.
3. **Brain coral** — a domed polar mesh with sinusoidal ridge height/colour variation.
4. **Plate coral** — layered wavy discs with visible thickness and support stems.
5. **Tube sponge** — tapered hollow pipes with bright rims and dark openings.
6. **Soft coral** — curved/tapered fingers with branching at hero LOD.

Each group still receives a low reef-rock base so the garden has visual mass. The approved colour weighting from v152 is retained: 25% purple, 20% pink, 20% orange, 15% turquoise, 10% blue, 10% cream/white.

### Placement and LOD
The total composition remains exactly **2,800 reef groups**:
- 350 route stations;
- 4 groups per side per station;
- 700 near / 1,400 mid / 700 far;
- every placement remains outside the local glass radius (`glassRadius + >=1.35 m`), including widened galleries.

Hybrid detail budget:
- **140 hero groups** in the nearest band, deterministic 70 per side;
- **1,494 medium-detail groups**;
- **1,166 simple/far groups**.

The v153 smoke world reports roughly **403,514 reef triangles**. This is intentional: close detail is funded by cheaper far LOD instead of increasing the 2,800-placement count.

Telemetry: `world.__aquaV153` includes `hqCoral:true`, exact reef/depth counts, hero/medium/simple counts, per-type counts, `hybridLOD:true`, `recognizableGeometry:true`, `closeHeroCorals:true`, `proceduralSphereClustersReplaced:true`, triangle count, fish/jelly preservation and isolation markers.

## Asset research performed for v153
- Repository inspection found no dedicated coral/reef models to reuse.
- External permissive-asset research found MiniPoly's **Coral Reef Kit** on Poly Pizza; the primary `Coral Reef Set` is CC0/Public Domain while the other bundle variants are CC-BY.
- The external asset was **not imported** into v153. The final implementation is self-contained project-native geometry, avoiding new texture/file-size/license/loader dependencies and giving exact control over WebGL triangle budget.
- If a later iteration explicitly needs model/texture realism beyond v153, external CC0 assets can be revisited as a separate controlled step.

## v152 preserved jellyfish system
`js/58-aqua-proper-jelly-reef-v152.js` remains immediately before v153 in the stack.
- 60 shared project jellyfish from `assets/models/creature_jelly.gltf`.
- `type:'gjelly'`, `gcre:'jelly'`, `meta:CREATURE.gjelly`.
- always outside glass, three distance bands, four height ranges.
- subtle v152 pulse retained.

v153 does **not** rebuild or mutate actors; it only rebuilds the reef/structural props mesh. Thus the proper v152 jellyfish remain the active jelly system.

## Retained Aqua systems
- **v152** `js/58-aqua-proper-jelly-reef-v152.js`: proper shared project jellyfish and prior visible reef checkpoint; v153 replaces only its coral props geometry.
- **v151** `js/57-aqua-coral-jelly-v151.js`: historical layer; its procedural jelly actors are removed by v152.
- **v150** `js/56-aqua-faces-reef-v150.js`: removes terrestrial scenery/mountains, creates low seabed and readable fish faces.
- **v149** `js/55-aqua-uturn-continuity-v149.js`: local U-turn school continuity.
- **v148** `js/54-aqua-tail-animation-v148.js`: 24 baked body/tail frames per species.
- **v147** `js/53-aqua-swim-motion-v147.js`: sustained shallow horizontal swimming.
- **v146** `js/52-aqua-depth-distribution-v146.js`: 258 fish spread bilaterally through the water column.
- **v145** `js/51-aqua-fish-visibility-v145.js`: hard Aqua fauna isolation and imported model transform fix.
- **v144** `js/50-aqua-real-fish-v144.js`: 11 Quaternius CC0 fish species, 258 fish total.
- **v143** `js/49-aqua-rift-v143.js`: separate **Aqua Rift — Glass Ocean** scene, transparent half-cylinder tunnel, galleries and water surface.

No v153 change should disturb road, tunnel glass/water, fish, fish faces/tails, U-turn behavior or jellyfish unless technically necessary and explicitly validated.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v153 with cache-buster `?b=153` in order:
1. v143 base Glass Ocean
2. v144 real fish
3. v145 visibility/fauna isolation
4. v146 water-column distribution
5. v147 swimming trajectory
6. v148 body/tail animation + face-enhanced loader
7. v149 U-turn continuity
8. v150 reef-only cleanup / fish faces
9. v151 historical coral/procedural-jelly layer
10. v152 visible reef + proper shared jellyfish
11. **v153 HQ coral geometry / LOD rebuild**

Verdant files remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142` for established Verdant invariants while caching all Aqua layers through js/59, all fish assets and `assets/models/creature_jelly.gltf`.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects **v143→v153**:
- syntax for all Aqua layers and regressions;
- all runtime smoke/regression tests v143 through v153;
- imported Quaternius fish asset/provenance checks;
- shared `creature_jelly.gltf` loader/meta checks;
- v153 loader cache-busting + service-worker cache checks;
- v152 jelly regression markers;
- v153 exact reef budget, 140 hero groups, six coral families, substantial geometry and non-Aqua isolation.

Feature checkpoint results:
- Aqua `33392300322` — SUCCESS.
- Verdant `33392300238` — SUCCESS.

## Immediate visual test — v153
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look specifically for:
- close coral should now read as recognizable branching/fan/brain/plate/sponge/soft forms, not coloured spherical blobs;
- hero colonies should be large/close enough to appreciate at riding speed;
- reef should remain obvious on both sides and entirely outside the tube;
- frame rate should remain smooth despite close detail;
- the same proper project jellyfish from v152 should still be present;
- all 258 fish, fish faces/tail motion and U-turn continuity should remain unchanged;
- no terrestrial buildings/masts/mountains/fauna should return;
- Verdant Rift must remain visually unchanged.

## Next task after this handoff
Wait for the user's v153 visual result/screenshot. Do not automatically start v154. If tuning is needed, base it on what is actually visible and change only the coral geometry/scale/placement derived from v153 unless the user requests broader changes.
