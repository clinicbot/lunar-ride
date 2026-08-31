# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.
- Before the next risky visual change, create a backup from the current v155 checkpoint.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v155**.
- v155 code/wiring/CI feature checkpoint before this documentation update: `c70c59dd3a171aa111b15a6ea0bdd13d8bf57297`.
- Aqua CI run `33398577795` — **SUCCESS**.
- Verdant CI run `33398577774` — **SUCCESS** on the same checkpoint.
- Canonical pre-v155 backup: `backup-v154-before-aqua-reef-colonies-v155` from exact v154 final HEAD `58144f47c86b0069ac6cc09a5ed91835b7d383f1`.
- `js/09-bluetooth.js` remains untouched.

## Exact visual feedback that triggered v155
The user visually tested v154 and supplied a screenshot. v154 was a clear improvement: the side scenery finally began to read as reef rather than isolated tiny props. However three remaining problems were obvious:
1. the dark bases looked too artificial — like black podiums/platforms under coral sculptures;
2. close coral still looked visibly low-poly/schematic;
3. there was still too much object-gap-object rhythm instead of broad continuous reef mass.

The user explicitly said to continue working.

## Aqua v155 — organic reef colonies
New layer: `js/61-aqua-coral-colonies-v155.js`.
Regression: `tests/aqua-v155-reef-colonies-smoke.js`.

v155 preserves the exact **2,800 reef placements** but rebuilds their visual composition:
- **280 hero colony groups** remain: 140 primary + 140 secondary;
- the podium-like v154 bases are replaced with asymmetric dark reef mounds, ledges, stones and rubble;
- primary hero colonies contain the main coral plus roughly 5–6 overlapping companion forms and local mini-coral accents;
- secondary heroes contain several overlapping forms and accents;
- **840 deterministic accent placements** are represented in regression telemetry;
- the nearest allowed band is approximately `glassRadius + 1.02 m`, still outside the tube;
- close hero scale is increased again to make colonies occupy more of the rider's field of view;
- six established coral families remain: branching, fan, brain, plate, sponge and soft coral;
- medium/far reef remains cheaper LOD for performance.

Regression telemetry verifies:
- `coralGroups:2800`
- 700 near / 1400 mid / 700 far
- `heroGroups:280`
- `moundGroups:2800`
- `accentGroups:840`
- `podiumBasesRemoved:true`
- `reefColonies:true`
- `organicReefMounds:true`
- 60 proper v152 jellyfish preserved
- fish/road/glass/Verdant isolation preserved.

## External model research
The next fidelity ceiling is still real model geometry. Research found three especially useful **CC0 Smithsonian coral scans** already used by another open-source ocean project:
- Stylaster sanguineus (lace coral)
- Seriatopora hystrix (birdsnest coral)
- Goniastrea favulus (brain coral)

Their provenance is clean CC0. However the readily reusable optimized GLBs in that project use Meshopt compression and KTX2/Basis textures, which are not part of Lunar Ride's current lightweight glTF loader contract. Do **not** blindly drop those optimized binaries into Lunar Ride without first adding/validating decoder support or obtaining a compatible uncompressed conversion. v155 therefore focuses on the immediately visible podium/colony composition defect while retaining a controlled model-import path as the next possible fidelity step.

## Preserved systems
- 60 proper shared jellyfish from v152 remain unchanged (`assets/models/creature_jelly.gltf`, `type:'gjelly'`, `gcre:'jelly'`).
- Existing 258 fish and all swim/tail/face/U-turn systems remain unchanged.
- Road, glass, water and tunnel systems remain unchanged.
- Verdant v142 remains unchanged.
- No terrestrial props were introduced.

## Wiring / cache
- `js/19-verdant-assets.js` loads Aqua v143→v155 in order, all Aqua layers with `?b=155`.
- Verdant layers remain `?b=142`.
- `sw.js` intentionally keeps cache name `lunar-ride-v142` but includes `js/61-aqua-coral-colonies-v155.js`.
- Aqua CI protects all regressions v143→v155 and verifies fresh loader/cache wiring.

## NEXT TASK — user visual validation of v155
Do not start another coral version before seeing the user's v155 screenshot unless explicitly requested.

User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
1. Are the black/podium-looking bases gone and replaced by irregular reef-rock masses?
2. Do the closest clusters feel broader, denser and more like colonies rather than sculptures on stands?
3. Does the reef read more continuously down both sides of the glass?
4. Is performance still smooth?
5. Are the jellyfish and fish unchanged?

If v155 composition/rooting is now convincing but individual close coral still looks too synthetic, the next iteration should be a **controlled compatible CC0 model import** rather than another density increase.

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest CI, then continue from the v155 visual-validation feedback. Do not ask the user to repeat project history unless repository state conflicts with these notes.
