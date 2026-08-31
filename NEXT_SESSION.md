# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.
- Before the next risky visual change, create a backup from the current v156 checkpoint.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v156**.
- v156 code/wiring/CI feature checkpoint: `d9b5e4bc3940ad1786c8b2798e11ae3798734e98`.
- Aqua CI run `33404254807` — **SUCCESS** on that checkpoint.
- Verdant CI run `33404254821` — **SUCCESS** on the same checkpoint.
- Canonical pre-v156 backup: `backup-v155-before-aqua-creatures-v156`.
- `js/09-bluetooth.js` remains untouched.

## Exact visual feedback that triggered v156
The user visually tested v155 and supplied a screenshot. The dark flat platforms were still clearly visible under coral. This was a real geometry problem, not a cache problem: `moundBase()` in v155 still emitted several thin `box()` ledges. The user also supplied four GLB water-creature models and asked to add them for more visual interest.

## Aqua v156 — no podiums + uploaded water creatures
New files:
- `js/62a-aqua-v156-model-siren.js`
- `js/62b-aqua-v156-model-crawler.js`
- `js/62c-aqua-v156-model-eelbeast.js`
- `js/62d-aqua-v156-model-leviathan.js`
- `js/62-aqua-creatures-v156.js`
- regression: `tests/aqua-v156-creatures-smoke.js`

The uploaded GLBs were simplified/quantized into lightweight embedded model-data JS payloads compatible with Lunar Ride's existing WebGL creature path. v156 registers them into `GLCRE` without introducing a new binary loader dependency.

### Platform removal
v156 intercepts only the thin `box()` calls originating from v155 `moundBase()` (`h <= .12`, `d <= .60`, `w <= 2.10`, and stack contains `moundBase`). The structural Aqua tunnel rails are preserved (`h=.35`) and Verdant boxes are untouched. The remaining mound geometry is rounded rock/rubble, so the black rectangular podiums should disappear.

### New water creatures
Exactly **36** custom creatures are added outside the glass at varied distances/heights using the established slow `drone` orbit motion:
- 10 siren-like creatures (`aqSiren156`)
- 8 crawler-like creatures (`aqCrawler156`)
- 16 eel-like creatures (`aqEel156`)
- 2 very large, rare leviathans (`aqLeviathan156`)

The leviathans are intentionally sparse, far from the glass and slow-moving. The other families appear at mixed depths so they add interest without becoming another uniform school.

### Preserved systems
- v155 reef budget remains 2,800 groups: 700 near / 1,400 mid / 700 far.
- 280 hero groups, 2,800 mound groups and 840 accents are preserved.
- 60 proper v152 jellyfish remain.
- Existing fish remain and their swim/tail/face/U-turn systems are unchanged.
- Road, glass, water and tunnel structural rails remain unchanged.
- Verdant v142 remains unchanged.

## Wiring / cache / CI
- `js/19-verdant-assets.js` loads Aqua v143→v156 with `?b=156`.
- The four model-data files load immediately before `js/62-aqua-creatures-v156.js`.
- Verdant layers remain `?b=142`.
- `sw.js` intentionally keeps cache name `lunar-ride-v142` and now caches all five v156 JS files.
- Aqua CI protects v143→v156 and includes the new model-registration/platform-filter regression.
- Code checkpoint CI: Aqua `33404254807` SUCCESS; Verdant `33404254821` SUCCESS.

## NEXT TASK — user visual validation of v156
User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
1. The thin black rectangular coral platforms should be gone; irregular rounded reef rock/rubble should remain.
2. The four new creature families should be visible at varied depths and distances outside the glass.
3. Only two giant leviathans exist, so they should feel like occasional sightings rather than repeated props.
4. Fish and 60 jellyfish should look/behave as before.
5. Performance should remain smooth and Verdant visually unchanged.

If the platforms still appear, first inspect whether they are a different geometry source rather than changing cache logic. If creatures are too sparse/large/small/oriented incorrectly, tune only v156 population/scale/orientation rather than disturbing v155 reef or earlier fish/jelly layers.

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest Aqua/Verdant CI, then continue from the user's v156 visual feedback. Do not ask the user to repeat project history unless repository state conflicts with these notes.
