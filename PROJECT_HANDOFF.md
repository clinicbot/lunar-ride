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
- Aqua Rift current layer is **v147** on top of v143 Glass Ocean, v144 Quaternius fish/reef, v145 fish visibility/fauna isolation, and v146 water-column redistribution.
- Current v147 wiring/test commit: `4510763053562701f79f00854ce7d3edadd8cb6e`.
- Aqua CI run `33367528892`: **SUCCESS**, including v147 horizontal-swim regression and wiring/cache checks.
- Verdant CI run `33367528881`: **SUCCESS** on the same commit.
- Backup before v147: `backup-v146-before-aqua-swim-motion-v147` (several redundant backup-v146-before-aqua-swim-motion-v147-* branches were accidentally created too; use the plain branch as the canonical one).
- Backup before v146: `backup-v145-before-aqua-depth-v146`.
- Backup before v145: `backup-v144-before-aqua-fish-visibility-v145`.
- Backup before v144: `backup-v143-before-aqua-fish-pack-v144`.
- Backup before initial Aqua: `backup-v142-before-aqua-rift`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v147 — real horizontal swimming motion
Active layer: `js/53-aqua-swim-motion-v147.js`.
Regression: `tests/aqua-v147-swim-motion-smoke.js`.

### User-observed v146 issue
The fish were visible and better distributed, but visually they mostly moved up/down rather than swimming. Root cause: all Aqua fish were still `type:'drone'`; core `updateActors()` gives drones a ±2.5 m vertical sine bob. v146 changed their centres/heights but did not replace that runtime motion.

### v147 correction
- Leaves the generic render/update core untouched.
- `js/53` wraps `updateActors()` after it becomes available. Because the file is loaded through `js/19` before `js/10`, its installer retries with `setTimeout(...,0)` until `updateActors` exists, then wraps once.
- Runs only for `state.scene.id==='aqua'` and only actors marked `aquaFish===true`.
- Calls the original updater first, then overwrites each fish's final transform.
- Replaces metre-scale vertical bob with **long shallow horizontal elliptical swim paths**.
- Major axis: **8–15 m**; minor axis: **1.4–3.2 m**.
- Angular speed: about **0.20–0.34 rad/s**, with both directions represented.
- Fish body yaw follows the actual tangent/velocity of the ellipse.
- Only **±0.18 m** slow depth drift remains.
- Adds a very small whole-body yaw sway (`0.055 rad`) as a temporary propulsion cue until native tail animation is implemented.
- Route tangent for each school centre is found once and cached in `a.__aquaV147Motion`; neighbouring paths receive small angular variation so they do not look like parallel cars.
- Telemetry: `w.__aquaFishV147` with `motion:'horizontal-elliptical-swim'`, `headingFollowsVelocity:true`, `removesDroneBob:true`.
- v146 telemetry gets `correctedByV147=true`.

Important limitation: Quaternius source GLTFs contain native animation clips, but Lunar Ride's current lightweight creature loader still does **not** evaluate those clips. v147 improves trajectory/orientation, not true skeletal tail animation. Do not claim native tail animation is playing.

## Aqua v146 — full water-column distribution
Active layer: `js/52-aqua-depth-distribution-v146.js`.
Regression: `tests/aqua-v146-depth-distribution-smoke.js`.

After visual review showed fish concentrated too high, v146 keeps the same 258 fish but redistributes schools bilaterally around the route and across five height bands relative to road/floor: `[-1.5, 1.0, 4.0, 8.0, 12.0]`, with floor clearance protection. Paired left/right schools are created at route stations. Telemetry: `w.__aquaFishV146`.

## Aqua v145 — fish visibility + hard fauna isolation
Active layer: `js/51-aqua-fish-visibility-v145.js`.
Regression: `tests/aqua-v145-fish-visibility-smoke.js`.

v144 initially showed no real fish and still leaked cats/deer/birds. Two root causes were fixed:
1. deny-list filtering missed legacy aliases (`gcat`, `gstag`, `gbird` etc.), so v145 uses positive isolation: Aqua retains only `aquaFish` actors and optional NPC riders;
2. imported FBX2glTF fish store canonical node transform `scale≈100` and -90° X rotation, while `loadGLTFCreature()` ignores node transforms. v145 restores this at actor level (`k×100`, `pitch=-π/2`).

v145 keeps the existing v144 258 fish and arranges them into about 43 close schools. Verdant and all non-Aqua worlds are guarded out. Telemetry: `w.__aquaFishV145`.

## Aqua v144 — Quaternius CC0 fish + dense reef
Active layer: `js/50-aqua-real-fish-v144.js`.
Regression: `tests/aqua-v144-real-fish-smoke.js`.
Fish assets: `assets/models/aqua_fish/`.
Provenance: `assets/models/aqua_fish/PROVENANCE.md`.

Eleven imported Quaternius CC0 fish models are present:
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

v144 creates **258 real fish actors** and adds 420 coral structures + 180 kelp on top of v143, for target totals around 640 coral + 320 kelp. The source assets retain animation clips but the current loader does not play them.

## Aqua v143 — Glass Ocean base
Primary: `js/49-aqua-rift-v143.js`.
World card: `assets/images/aqua_rift_card.svg`.
Regression: `tests/aqua-rift-v143-smoke.js`.

- Separate world id `aqua`, name **Aqua Rift — Glass Ocean**.
- Continuous transparent half-cylinder glass canopy.
- Base glass radius 8.8 m plus four widened panoramic galleries.
- Water surface about 48 m above highest road point.
- Base reef: 220 coral + 140 kelp.
- User visually approved the base look as very beautiful; preserve it while tuning fauna.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua layers with cache-buster `?b=147` in this order:
1. v143 base
2. v144 real fish/reef
3. v145 visibility/isolation
4. v146 water-column distribution
5. v147 swim motion

`sw.js` intentionally retains cache name `lunar-ride-v142` for Verdant invariants, while caching all Aqua layers and fish assets.

## Higher-quality fish direction
User would like better-looking fish models after motion is correct. High-quality photorealistic assets can be very heavy and frequently depend on texture maps that Lunar Ride's current creature loader does not render. Do not replace the 258 school fish wholesale with 500k+ triangle models. Preferred future approach: keep lightweight fish for schools and add a small number of optimized high-detail/hero fish, ideally after texture/normal-map support or model baking/decimation is implemented.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua.
- all current mushrooms at 25% of v141 scale;
- bilateral hillside flower blankets, four intermixed colour groups (~25% each);
- 14 bears total;
- v140 cats/dragonflies/deer/buildings retained;
- approved v137 TwistedTree and v136 CommonTree mixes retained;
- do not reactivate rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree, or v130 palms.
- GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects v143 base, v144 fish/reef/provenance, v145 transform/isolation, v146 depth distribution, and v147 horizontal swimming motion + loader/offline wiring. Verdant CI continues to protect the approved Verdant v142 state and historical invariants.

## Immediate visual test for v147
Run `UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check visually:
- fish should travel clearly forward/sideways through the water rather than bob vertically;
- turns should be broad/gentle rather than tight circles;
- body orientation should follow swim direction;
- vertical drift should be subtle (~36 cm peak-to-peak), not metres;
- fish should still appear low, eye-level, mid and high, on both sides;
- no cats/deer/birds should return;
- fish should not enter the glass tube;
- FPS/startup remain acceptable.

If trajectory looks correct but the fish bodies still look too rigid, the next technical step is native fish-tail/body animation support or a lightweight procedural body/tail deformation, not more vertical actor motion.
