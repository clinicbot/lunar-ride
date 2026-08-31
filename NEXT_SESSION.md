# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v160**.
- Backup immediately before v160: `backup-v159-before-rocky-upperfish-v160`.
- `js/09-bluetooth.js` remains untouched.

## Latest user feedback that triggered v160
The user visually tested v159 around 2.06 km and reported:
1. the **Aerial Beach 01** look was clearly better than **Sand 03**;
2. some coral bases were still visible through/above the smooth seabed shoulders;
3. a **rockier/rubble seabed** would probably blend/hide the bases better than smooth sand;
4. fish should also be swimming **above the underground glass tunnel**, not only around its sides.

## Aqua v160
Layer: `js/66-aqua-rocky-upperfish-v160.js`.
Regression: `tests/aqua-v160-rocky-upperfish-smoke.js`.
Provenance: `assets/images/AQUA_ROCK_PROVENANCE.md`.
Dedicated workflow: `.github/workflows/aqua-v160-ci.yml`.

### Rocky shoulder treatment
- v160 supersedes the v159 A/B visual appearance for both roadside shoulders.
- Full-lap rocky texture: **Poly Haven Rocks Ground 04**, CC0.
- Shoulder span: approximately **0.24–20.5 m outside the local glass radius** on both sides.
- The surface has stronger cross-route relief than v159 and includes partially buried low-poly rubble clusters to break flat silhouettes and visually swallow remaining base edges.
- v159 remains loaded because it owns the proven sandA/sandB GPU upload/draw path; v160 replaces its generated geometry with the rocky full-lap mesh and swaps the runtime material to the rock texture.
- The v159 `Sand 03` A/B appearance is retired by v160.

### Fish above the tunnel
v160 adds **60 additional existing-style Quaternius fish** in **12 schools of 5** above the tunnel crown.
- Fish are placed **4–11 m above the local top of the glass envelope**.
- They are still marked `aquaFish===true`, so the established v147 horizontal swim system, tail animation and face/U-turn systems continue to animate them.
- Existing fish are preserved; this is an additive upper-water layer.

## Preserved systems
- All 36 experimental uploaded v156 creatures remain removed by v159.
- Exact 2,800 reef groups remain.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn systems remain intact.
- Road asphalt/geometry, glass, water and tunnel structure remain unchanged.
- Verdant v142 remains unchanged.

## Wiring / cache / CI
- `js/19-verdant-assets.js` loads `js/65-aqua-sand-ab-v159.js?b=159`, then `js/66-aqua-rocky-upperfish-v160.js?b=160`.
- Verdant layers remain `?b=142`.
- `sw.js` caches the v160 script and `AQUA_ROCK_PROVENANCE.md`; the remote rock photo itself is still fetched at runtime during this visual experiment.
- Aqua v160 CI, Aqua v159 CI, main Aqua CI and Verdant CI all passed on the v160 code checkpoint commit `94a3bdb9f0607b8c71242201ff29ef07938c7868`.

## NEXT TASK — visual validation of v160
User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check specifically:
1. Does the rocky/rubble shoulder look more natural than either v159 sand treatment?
2. Are the remaining coral bases better hidden/blended by the increased relief and rubble?
3. Are fish clearly visible above the tunnel arches/crown from normal rider view?
4. Is the upper fish density appropriate or too busy?
5. Is performance smooth and are road/glass/jellyfish/Verdant unchanged?

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest Aqua/v159/v160/Verdant CI, then continue from the v160 visual-validation feedback.
