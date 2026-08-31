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
- Aqua Rift current release is **v158**.
- Backup immediately before v158: `backup-v157-before-no-podium-v158`.
- v157 keeps all 36 user-uploaded Aqua creatures close to the glass.
- v158 targets the actual remaining dark rectangular coral podiums.
- `js/09-bluetooth.js` remains untouched.

## Latest user feedback that triggered v158
The user visually tested v157 and the dark rectangular coral bases were still clearly visible.

Inspection found the precise root cause in `js/61-aqua-coral-colonies-v155.js`:
- `moundBase()` creates an irregular `m.box(x,sy*.28,z,sx,sy,sz,...)` for every mound;
- those blocks can have `h` up to about **0.44**;
- v157 only suppressed boxes with `h <= 0.14`, so the main mound blocks escaped the filter;
- v155 replaces `w.props`, so these v155 boxes are the relevant visible podium source.

## Aqua v158
New layer: `js/64-aqua-no-podium-v158.js`.
Regression: `tests/aqua-v158-no-podium-smoke.js`.

### Complete v155 podium-envelope suppression
While Aqua is being built, v158 suppresses decorative boxes matching the full v155 mound/ledge envelope:
- local `y <= .15`
- `h <= .50`
- `.30 <= w <= 2.25`
- `.20 <= d <= 1.10`
- low reef-base emission (`em <= .0125`)

The regression proves both an escaped v155-style `h=.28` mound block and a hero ledge are suppressed, while larger/taller structural boxes and non-Aqua worlds survive.

## v157 creature placement remains unchanged
All 36 uploaded creatures stay near the glass:
- 16 eelbeasts
- 10 sirens
- 8 crawlers
- 2 leviathans

Small creatures remain **2.2–7.5 m outside the local glass radius**. Leviathans remain **8–15 m outside the glass**.

### Deterministic encounter km
Eelbeasts: 0.15, 0.45, 0.80, 1.15, 1.55, 2.05, 2.45, 2.85, 3.30, 3.75, 4.20, 4.65, 5.10, 5.55, 6.15, 6.70 km.
Sirens: 0.30, 0.95, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25, 5.95, 6.65 km.
Crawlers: 0.55, 1.40, 2.25, 3.10, 3.95, 4.80, 5.65, 6.50 km.
Leviathans: **1.65 km** and **5.70 km**.

## Preserved systems
- Exact 2,800 reef groups remain.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn systems remain unchanged.
- v156 uploaded creature geometry and v157 placement remain unchanged.
- Road, glass, water and tunnel systems are intended to remain unchanged.
- Verdant v142 remains unchanged.

## Wiring / cache / CI
- `js/19-verdant-assets.js` loads Aqua v143→v158 in order, all Aqua layers with `?b=158`.
- Verdant layers remain `?b=142`.
- `sw.js` intentionally retains cache name `lunar-ride-v142` and now caches `js/64-aqua-no-podium-v158.js`.
- Aqua CI protects regressions v143→v158.
- At the v158 code checkpoint, Aqua CI and Verdant CI both passed on commit `27a7e497578e76e0f42013d13db2de84c2982ac4`.

## NEXT TASK — visual validation of v158
User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check specifically:
1. Are the dark rectangular podium/platform blocks finally gone?
2. Are coral mounds still visually present through their organic sphere/rubble geometry rather than floating?
3. At 0.15–0.55 km, are the first creature encounters obvious from the rider view?
4. Is performance smooth and are road/glass/tunnel/fish/jellyfish unchanged?

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest Aqua/Verdant CI, then continue from the v158 visual-validation feedback.
