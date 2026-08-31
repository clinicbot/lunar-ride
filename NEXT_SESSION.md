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
- Aqua Rift current release is **v159**.
- Backup immediately before v159: `backup-v158-before-sand-ab-v159`.
- `js/09-bluetooth.js` remains untouched.

## Latest user feedback that triggered v159
The user visually tested v158 and reported:
1. the four uploaded creature families did not look good and should be removed;
2. coral bases/mounds were still visually obvious;
3. rather than continuing to fight every base primitive, the user suggested covering/blending the roadside reef floor with a good sand texture, similar to the successful asphalt approach;
4. the user approved an A/B test of two Poly Haven CC0 sand textures in different route sections.

## Aqua v159
Layer: `js/65-aqua-sand-ab-v159.js`.
Regression: `tests/aqua-v159-sand-ab-smoke.js`.
Provenance: `assets/images/AQUA_SAND_PROVENANCE.md`.

### Uploaded creatures removed
v159 filters every actor marked `aquaCreatureV156===true` after the existing Aqua stack has built. This removes all 36 experimental uploaded creatures while preserving fish and the 60 shared v152 jellyfish.

### Sand shoulder A/B experiment
Two separate textured seabed shoulder meshes are generated outside the local glass radius, extending about **0.35–19.5 m outside the glass** on both sides. The surface is gently raised/undulated so coral bases read as partially buried in sand rather than objects placed on dark platforms.

Route A/B schedule:
- **0.0–1.8 km:** Aerial Beach 01
- **1.8–3.6 km:** Sand 03
- **3.6–5.4 km:** Aerial Beach 01
- **5.4 km–lap end:** Sand 03

Both textures are Poly Haven **CC0** sources. During this experiment the 1K diffuse images are loaded from Poly Haven at runtime, conditioned through Lunar Ride's existing photo-texture pipeline, and supplied with derived normal maps. The chosen winner can later be vendored locally.

## Preserved systems
- Exact 2,800 reef groups remain.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn systems remain unchanged.
- Road asphalt, road geometry, glass, water and tunnel systems remain unchanged.
- Verdant v142 remains unchanged.

## Wiring / cache / CI
- `js/19-verdant-assets.js` loads `js/65-aqua-sand-ab-v159.js?b=159` after v158.
- Older Aqua layers remain at `?b=158`; Verdant remains `?b=142`.
- `sw.js` caches the new v159 script and provenance file. The two sand photos themselves are remote during this A/B experiment.
- Existing Aqua CI and Verdant CI still protect the prior stack.
- New workflow `.github/workflows/aqua-v159-ci.yml` checks v159 syntax, runtime sand/actor regression, loader/cache wiring and CC0 provenance.

## NEXT TASK — visual validation of v159
User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check specifically:
1. Are the four uploaded creatures gone?
2. Does sand appear on both sides of the road and visually bury/blend the coral bases?
3. Compare **Aerial Beach 01** in 0–1.8 km against **Sand 03** in 1.8–3.6 km.
4. Repeat the comparison in 3.6–5.4 km versus 5.4 km–lap end.
5. Which sand looks more natural underwater and which better hides the coral bases?
6. Is performance smooth and are fish/jellyfish/road/glass unchanged?

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest Aqua/v159/Verdant CI, then continue from the v159 visual-validation feedback.
