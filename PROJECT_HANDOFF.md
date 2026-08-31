# Lunar Ride — project handoff

Persistent continuation note. Before changing code, verify the latest `fixes-build-90` HEAD and the latest Aqua/Verdant CI runs because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`.
- Active branch: `fixes-build-90`; never modify `main` directly.
- Open draft PR #1 targets `main`.
- User updates Windows copy with `UPDATE.bat`, runs `ride.bat`, closes/reopens the browser/game, then uses `Ctrl+F5`.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Create a backup branch before risky world/visual changes.
- GitHub connector access is independent of local git/container networking.

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142**.
- Aqua Rift current fauna/visibility layer is **v145** on top of the v143 Glass Ocean base and v144 Quaternius fish/reef import.
- v145 code commit: `01dc0685fc2886fa0653d0b791d949c0874206d2`.
- v145 Aqua CI run `33365700753`: **SUCCESS**.
- Same-commit Verdant regression run `33365700770`: **SUCCESS**.
- Backup before v145: `backup-v144-before-aqua-fish-visibility-v145`.
- Backup before v144: `backup-v143-before-aqua-fish-pack-v144`.
- Backup before initial Aqua: `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` was not modified.

## Aqua v145 — critical fish visibility + fauna isolation fix
Active layer: `js/51-aqua-fish-visibility-v145.js`.
Regression: `tests/aqua-v145-fish-visibility-smoke.js`.

### User-observed v144 failure
The user reported that no fish were visible and cats, deer/stags and birds were still present in Aqua.

Two concrete root causes were found:
1. v144 used a deny-list of actor types. The generic world generator also creates legacy imported aliases such as `gcat`, `gstag` and `gbird`, so the v144 list did not truly isolate Aqua from every terrestrial/base actor.
2. The imported Quaternius GLTFs are FBX2glTF assets whose raw POSITION data is tiny (for example clownfish coordinates are around hundredths of a unit) while the mesh node carries the canonical transform: approximately `scale:[100,100,100]` and a -90 degree X rotation. Lunar Ride's lightweight `loadGLTFCreature()` reads primitive POSITION/NORMAL buffers but does not apply glTF node transforms. Thus the real fish existed but rendered effectively invisible.

### v145 correction
- Aqua now uses **positive isolation**, not a fauna deny-list.
- In `sc.id==='aqua'`, only actors marked `aquaFish===true` with one of the 11 imported Aqua `gcre` keys are retained; optional NPC `rider` actors are also retained.
- Every other world actor is removed in Aqua, including `gcat`, `gstag`, `gbird`, cats, deer, birds, shuttles or any future unrelated base-world actor.
- Verdant and all other worlds exit the layer untouched.
- Every retained imported fish receives the missing model-node transform at actor level: **scale ×100** and **pitch -π/2**.
- Fish emissive visibility floor is raised to 0.95.
- The existing 258 v144 real fish are redistributed into **43 small schools of up to 6 fish**, regularly spaced around the lap.
- School centres are approximately **18–30 m from the road**, safely outside the 8.8 m glass tunnel, with swim radius capped at 6 m and altitude constrained to 5–22 m above local seabed.
- This makes a school much more likely to be visible continuously instead of random 800 m+ gaps between broad v144 school centres.
- Telemetry: `w.__aquaFishV145`.
- v144 telemetry gets `correctedByV145=true`.

### v145 wiring
`js/19-verdant-assets.js` loads, in order:
- `js/49-aqua-rift-v143.js?b=145`
- `js/50-aqua-real-fish-v144.js?b=145`
- `js/51-aqua-fish-visibility-v145.js?b=145`

`sw.js` retains the existing app cache name `lunar-ride-v142` to preserve Verdant invariants, but now includes the v145 correction file plus all Aqua fish assets. Aqua CI explicitly validates the imported FBX2glTF node-scale assumption and v145 isolation/visibility transform.

## Aqua v144 — Quaternius CC0 fish + dense reef
Active import/population layer: `js/50-aqua-real-fish-v144.js`.
Regression: `tests/aqua-v144-real-fish-smoke.js`.
Fish assets: `assets/models/aqua_fish/`.
Provenance: `assets/models/aqua_fish/PROVENANCE.md`.

Eleven Quaternius CC0 models were imported from a pinned public GLB source and converted to self-contained glTF JSON with embedded buffers:
- clownfish
- fish-a
- fish-b
- fish-c
- shark
- anglerfish
- puffer
- lionfish
- butterfly-fish
- swordfish
- black-lionfish

The source assets retain native animation clips, but Lunar Ride's current lightweight creature loader does not play glTF animation clips; existing actor motion supplies swimming movement. Do not claim native tail/body animation is currently playing.

v144 creates **258 real fish actors**: 30×8 school fish plus 18 larger hero fish, and adds 420 coral structures + 180 kelp on top of v143. Combined reef target is roughly 640 coral + 320 kelp.

Important: v145 does not replace these assets or create a second population. It corrects the v144 actors after world construction.

## Aqua v143 — Glass Ocean base
Primary world: `js/49-aqua-rift-v143.js`.
World card: `assets/images/aqua_rift_card.svg`.
Regression: `tests/aqua-rift-v143-smoke.js`.

- Separate world id `aqua`, name **Aqua Rift — Glass Ocean**.
- Continuous transparent half-cylinder glass canopy over the road.
- Base glass radius 8.8 m with four widened panoramic galleries.
- Water surface roughly 48 m above highest road point.
- v143 base reef: 220 coral + 140 kelp.
- v143 originally had procedural fish/jelly swimmers; v144 removes them and supplies the real Quaternius population.
- User visually liked the v143 base underwater look; current work should preserve that base while tuning fauna/reef.

Telemetry: `w.__aquaRiftV143`.

## Verdant Rift current approved state — v142
Do not disturb while tuning Aqua.

### v142
Active: `js/48-verdant-mushroom-carpet-fix-v142.js`.
Regression: `tests/verdant-v142-mushroom-carpet-smoke.js`.
- all current mushrooms are 25% of v141 scale;
- bilateral flower blankets on both road sides and green hillsides;
- four deterministic intermixed flower colour groups at roughly 25% each;
- 14 bears total;
- snow/water exclusions and road protection retained.

### v141 mushroom
- `assets/models/verdant_mushroom_uploaded_v141.gltf`
- `js/46-verdant-uploaded-mushroom-model-v141.js`
- `js/47-verdant-uploaded-mushroom-replace-v141.js`

### v140 expansion
Active: `js/45-verdant-wildlife-buildings-mushrooms-v140.js`.
- cats 10×, half final cats 2× scale;
- dragonflies 10×;
- deer/stags 3×;
- buildings 5× with paired roadside sites.

### v139 flower source
`js/44-verdant-purple-flower-megacarpets-v139.js`: 48 source carpet centres, original 113,760 Flower_4 target. v142 replaces the one-sided runtime carpet while retaining these patch definitions.

### Approved trees
- v137 TwistedTree: 50% bright-red current form / 50% exact v133 alpha-aware darker form.
- v136 CommonTree: 65% original bright / 25% darker / 10% exact v133 compact form.
- Do not reactivate rejected v135 synthetic CommonTree deformation, global v133 alpha changes, v132 bundle, or v130 palms.

## Retained systems
- v129 Verdant world cleanup and global road-nearest filtering.
- v126/v128/v129 mountain protections.
- v131 atmosphere-only sky.
- GPU nature instancing in `js/28-verdant-instanced-renderer.js`.
- Current unresolved green blade/plank-like objects still have no proven source; identify exact runtime/model key before changing them.

## CI
Aqua: `.github/workflows/aqua-ci.yml`.
Verdant: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects v143 base, v144 imported fish/reef/provenance, and v145 model-transform correction + hard fauna isolation + close-school placement + loader/offline wiring. Verdant CI continues to protect all approved Verdant v142 and historical invariants.

## Immediate user visual test for v145
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → choose **Aqua Rift — Glass Ocean**.

First check only these items:
- **no cats, deer/stags or birds at all** in Aqua;
- real fish are clearly visible outside the glass within the first few hundred metres;
- fish are horizontal rather than standing vertically;
- fish scale is plausible; v145 intentionally restores the source ×100 transform, so screenshot-driven scale tuning may still be needed;
- fish do not penetrate the glass tube;
- FPS/startup remain acceptable.

If the fish are now visible but too large/small or rotated incorrectly, tune only v145 actor scale/pitch first. Preserve v143 glass/ocean and Verdant v142.