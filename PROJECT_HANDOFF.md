# Lunar Ride — project handoff

Persistent continuation note. Before changing code, read this file, then verify the latest `fixes-build-90` HEAD and latest Aqua/Verdant CI runs because the branch may have advanced.

## Repository workflow
- Repository: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`; do not modify `main` directly.
- User updates Windows copy with `UPDATE.bat` (`git pull --ff-only origin fixes-build-90`).
- After updating: close/reopen Lunar Ride and Ctrl+F5.
- Never touch `js/09-bluetooth.js` unless explicitly requested.
- Make a backup branch before risky visual/world changes.
- GitHub connector access is independent of local `git clone`; do not infer connector availability from container networking.

## Current checkpoint — 2026-08-31
- Current Verdant Rift release: **v142**.
- Current separate underwater world: **Aqua Rift v144 — Glass Ocean**.
- Aqua v144 real-fish code/wiring commit: `73da8d27769a458a8732c560824d8d20a094b29c`.
- Fish asset import commit: `43eca8446e21f8fb7dd3dc736b6b9ae1dfd3be9e`.
- Aqua CI run `33338419562`: **SUCCESS**, including imported-asset validation, v144 fauna replacement and reef checks.
- Verdant regression CI run `33338419575`: **SUCCESS**; all existing Verdant v142 tests still pass.
- Backup immediately before v144 fish/reef work: `backup-v143-before-aqua-fish-pack-v144`.
- Backup immediately before initial Aqua work: `backup-v142-before-aqua-rift`.
- Verdant's own pre-v142 backup remains `backup-v141-before-v142-mushroom-carpet-fix`.
- Important version rule: Aqua v144 is a **separate world**, not Verdant v144. `js/25-verdant-lite-richness.js` remains `RELEASE='142'` and service-worker cache remains `lunar-ride-v142` intentionally. Aqua v143/v144 files and fish assets are added inside that cache.
- The HUD's `· v...` text comes from the global app stamp in `index.html`; it may still display the older app stamp (the user's screenshot showed `v106`). Do not use that HUD stamp as proof of the Aqua internal release. Aqua runtime telemetry is `w.__aquaFishV144`.

## Aqua Rift v144 — real Quaternius CC0 fish + dense reef
Active layer: `js/50-aqua-real-fish-v144.js`.
Regression: `tests/aqua-v144-real-fish-smoke.js`.
Fish assets: `assets/models/aqua_fish/`.
Provenance: `assets/models/aqua_fish/PROVENANCE.md`.

### User-approved direction
The v143 underwater glass-tunnel world was visually well received, but a cat was seen on the road and fled through the glass tube. The user requested that Aqua contain no irrelevant terrestrial fauna such as cats, deer or birds; the surrounding ecosystem should instead read as a reef with lots of coral and swimming fish.

### Imported real fish assets
Eleven real Quaternius models were imported directly from a verified public GLB subset at pinned source commit `e160070ede35d2d1a62c7572e8b348211c58fe83`, with CC0 provenance retained:
- `clownfish.gltf`
- `fish-a.gltf`
- `fish-b.gltf`
- `fish-c.gltf`
- `shark.gltf`
- `anglerfish.gltf`
- `puffer.gltf`
- `lionfish.gltf`
- `butterfly-fish.gltf`
- `swordfish.gltf`
- `black-lionfish.gltf`

Every file is glTF 2.0 with an embedded base64 buffer and at least one source animation clip. Import CI validated all 11. The source GLBs were converted losslessly to JSON `.gltf` only because Lunar Ride's existing `loadGLTFCreature()` consumes JSON glTF with an embedded buffer.

Important limitation: Lunar Ride's current creature loader does **not** evaluate native `gltf.animations`; without a custom pose it bakes the rest frame. v144 therefore uses the real Quaternius geometry/material base colours while the existing `type:'drone'` actor motion supplies visible swimming movement. The original animation clips remain in the files for a future native-animation upgrade.

This is all **11 fish models in the verified directly downloadable GLB subset** used for v144. Quaternius' full Animated Cute Fish Pack contains 52 models, but the official pack exposes FBX/OBJ/Blend rather than directly compatible GLB; importing the entire 52-model pack would be a separate conversion pass and was not done in v144.

### Aqua-only fauna replacement
v144 runs only when `sc.id==='aqua'`.
- Removes terrestrial/base animal types such as bear, frog, monkey, insect, stag/deer, cat and birds.
- Removes the v143 synthetic `fishBlue`, `fishGold`, `fishViolet`, `fishCoral` and `jellyAqua` swimmers.
- Removes generic base `fish`/ray/jelly actors so the visible Aqua animal population is controlled by the real-fish layer.
- Does not remove unrelated mechanical/rider actors.
- Does not touch Verdant fauna at all.

### Real fish population
- **30 schools**.
- **8 real fish per school** = 240 school fish.
- **18 larger hero fish** (primarily shark/swordfish classes).
- **258 real Quaternius fish actors total**.
- All 11 imported models are represented.
- Schools share broad centres/directions but vary phase, orbit radius, height and scale so they read as groups rather than perfect circles.
- Fish are centred safely outside the glass envelope; hero fish are generally farther and slower.
- Anglerfish are biased lower in the water column.

### Denser reef
v144 adds, on top of v143:
- **420 extra coral structures**;
- **180 extra kelp plants**.

Combined target/telemetry estimate with v143 base:
- about **640 coral structures** total;
- about **320 kelp plants** total.

Telemetry: `w.__aquaFishV144` exposes source/license, species list, removed actor counts/types, school/hero fish counts, per-model counts and reef additions/totals.

### v144 integration
- `js/19-verdant-assets.js` loads `js/49-aqua-rift-v143.js?b=143` followed by `js/50-aqua-real-fish-v144.js?b=144`.
- `sw.js` retains `lunar-ride-v142` but caches `js/50-aqua-real-fish-v144.js` and all 11 Aqua fish glTFs.
- `.github/workflows/aqua-ci.yml` validates v143 base, v144 runtime behavior, all 11 imported assets/animations/provenance, loader wiring and offline cache.
- The one-shot fish-import workflow used to fetch/convert the assets should be deleted after import; it is not part of the ongoing runtime.
- `js/09-bluetooth.js` remains untouched.

## Aqua Rift v143 — underwater glass-tunnel base
Primary base world file: `js/49-aqua-rift-v143.js`.
World card: `assets/images/aqua_rift_card.svg`.
Regression: `tests/aqua-rift-v143-smoke.js`.

Aqua is registered as a new menu world with:
- id `aqua`;
- name **Aqua Rift — Glass Ocean**;
- normal Lunar Ride controls, rider physics, trainer resistance and camera behavior;
- a gentler route (`maxGrade: 4.5`, `halfWidth: 3.6`, `loopR: 1120`, `twist: .62`);
- blue underwater atmosphere/fog and high bloom tuned independently from Verdant.

### Glass-tunnel experience
- The entire road is covered by a continuous transparent half-cylinder canopy rendered through the existing `world.glass` path.
- Base canopy radius is **8.8 m**.
- Four sections around the lap widen into panoramic glass galleries, adding up to about **6.4 m** to the radius.
- Opaque turquoise structural ribs and side rails make the transparent enclosure readable while riding.
- This is an original Lunar Ride construction inspired by the experience of an underwater aquarium tunnel, not a copy of another game's geometry.

### Ocean base environment
- A large double-sided water-surface mesh sits about **48 m above the highest road point**.
- v143 base has **220 coral structures** and **140 kelp plants** outside the glass.
- v143 originally created 96 normal procedural fish + 12 giant procedural fish + 24 jellyfish. v144 removes those runtime actors and replaces them with the real Quaternius population while retaining the v143 geometry/water/glass base.

Telemetry: `w.__aquaRiftV143` remains available for base-world information; `w.__aquaFishV144` describes the current fauna/reef layer.

## Verdant Rift v142 — quarter mushrooms, bilateral hillside flower blankets, four-colour mix, bears x2
Active correction file: `js/48-verdant-mushroom-carpet-fix-v142.js`.
Regression: `tests/verdant-v142-mushroom-carpet-smoke.js`.

### Mushrooms
- Every currently rendered mushroom group is scaled by **0.25** relative to v141.
- This includes the uploaded mushroom model from v141 and the older baseline mushroom group.
- No mushroom-tree model is restored.

### Flower blankets
- The old one-sided `flower4MegaCarpetV139` runtime group is removed by v142 and rebuilt from the same approved 48 v139 patch centres.
- Every patch is generated on **both sides of the road**.
- Coverage reaches at least **170 m from the road centre** and follows `meshH()`, so it climbs the real green hillsides.
- Snow zone 7 and water are excluded.
- Global nearest-road clipping remains active; visible flowers still target about **10 cm from the asphalt edge**.
- The base model remains `Flower_4_Group.gltf`; GPU instancing remains intact.

### Random flower colours
The bilateral blankets are split into four GPU-instanced groups:
- `flower4HillsideCurrentV142` — **25% original colour**;
- `flower4HillsidePurpleV142` — **25% purple**;
- `flower4HillsideBlueV142` — **25% blue**;
- `flower4HillsideRedV142` — **25% red**.

Colour assignment uses a deterministic shuffled colour bag for each patch side, so the four colours are quarter-balanced but visually random and intermixed. Clearly green leaf/stem vertices are preserved; tinting targets the non-green flower material.

### Bears
- Pre-v142 approved world had **7 bears** total.
- v142 adds only the missing number to reach **14 total**.
- New bears are placed deterministically across forest and alpine/descent areas.
- Existing bears are never removed.

Telemetry: `w.__verdantVisualFixV142`.

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
- v142 changes bears separately and does not alter cats, dragonflies, deer or buildings.

Backup before v140: `backup-v139-before-v140-wildlife-buildings-mushrooms`.

## v139 — approved Flower_4 mega-carpet source
Active source file: `js/44-verdant-purple-flower-megacarpets-v139.js`.
- 48 carpet centres around the full 25 km lap;
- original target 113,760 Flower_4 instances;
- road-edge gap ~0.10 m;
- v142 replaces its runtime one-sided group with bilateral four-colour hillside groups but keeps its patch definitions as the source profile.

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
- v133 global alpha-aware changes were rejected globally; only selectively approved CommonTree/TwistedTree looks remain.
- v135 synthetic CommonTree deformation was rejected.
- v130 photogrammetry palms were rejected and remain removed.

## Current unresolved green blade objects
The narrow/elongated green blade/plank/tree-like objects still have no proven runtime/model source. Do not remove a family based only on appearance. Identify the exact model/runtime key first, then change one source at a time while preserving approved states.

## Retained world systems
- v129 world cleanup remains Verdant baseline: legacy triangular `w.veg` disabled, global route-nearest filtering, road support and wildlife density retained.
- Verdant mountains retain v126/v128/v129 protections and anti-dome work.
- Verdant sky remains v131 atmosphere-only.
- GPU nature instancing remains `js/28-verdant-instanced-renderer.js`; do not bake duplicated vegetation geometry.
- Settlements originate in v121 and are expanded by v140.
- Aqua is separate from these Verdant-specific layers and should remain isolated unless the user explicitly asks to share an asset/system.

## CI
Verdant workflow: `.github/workflows/verdant-ci.yml`.
Aqua workflow: `.github/workflows/aqua-ci.yml`.

Verdant CI protects syntax, generated world/geometry, v121/v122/v123/v125/v126/v129 behavior, asset dependencies, rejected palm removal, v134/v136/v137 tree states, v139 carpet source, v140 multipliers/buildings, v141 uploaded mushroom, v142 mushroom/carpet/colour/bear behavior, atmosphere/mountain retention and v142 release/cache/load wiring.

Aqua CI protects v143 glass/water/reef base, v144 real-fish replacement, removal of terrestrial/procedural fauna, exact real-fish population, use of all 11 imported models, increased reef density, glTF validity, source animation presence, CC0 provenance, loader/cache wiring and isolation from Verdant.

## Immediate visual/performance test
Run `UPDATE.bat` → close/reopen `ride.bat` → `Ctrl+F5`, then choose **Aqua Rift — Glass Ocean**.

For v144 specifically check:
- no cats, deer/stags, birds or other terrestrial animals around/inside the tube;
- no old simple v143 procedural fish/jelly forms;
- visible variety among the 11 real fish models, especially clownfish, puffer/lionfish, shark and swordfish;
- schools look natural rather than rigid circular formations;
- fish stay outside the glass and do not cross through the road tube;
- the seabed reads much more strongly as a reef with ~640 coral / ~320 kelp target totals;
- fish scale/orientation is correct; imported model units/orientation have not yet been visually approved in the user's browser;
- FPS/startup time remains acceptable with 258 real fish actors and denser reef.

The user already visually approved the **v143 base look** as “מאד יפה”. v144 is a fauna/reef upgrade and now needs screenshot-driven visual approval for fish scale/orientation/density. Preserve Verdant v142 while tuning Aqua.
