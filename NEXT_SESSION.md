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
- Aqua Rift current release is **v157**.
- Backup immediately before v157: `backup-v156-before-visible-creatures-v157`.
- v157 adds a hard flat-base suppression layer and moves all 36 user-uploaded Aqua creatures close enough to the glass to be clearly visible.
- `js/09-bluetooth.js` remains untouched.

## Latest user feedback that triggered v157
The user visually tested v156 and reported:
1. the dark coral podium/platform bases were still visible;
2. none of the four new creature families were noticed;
3. after checking the v156 code, the creatures were found to be much too far from the glass (small creatures roughly 28–98 m away; leviathans 82–145 m away).
The user explicitly requested that the creatures be placed very close to the glass because the purpose is to see them.

## Aqua v157
New layer: `js/63-aqua-visible-creatures-v157.js`.
Regression: `tests/aqua-v157-visible-creatures-smoke.js`.

### Hard podium removal
v156 filtered flat bases only when `Error().stack` contained `moundBase`, which was unreliable in the browser. v157 instead marks the Aqua build as active and suppresses all very flat decorative `MeshB.box()` calls matching the reef-base dimensions. Structural tunnel rail boxes remain because they are much taller.

### Visible creature placement
All 36 v156 uploaded creatures are preserved and repositioned after the v156 build:
- 16 eelbeasts
- 10 sirens
- 8 crawlers
- 2 leviathans

Small creatures are now only **2.2–7.5 m outside the local glass radius**. Leviathans are **8–15 m outside the glass**. Vertical placement is relative to road height rather than seabed height so creatures remain in the rider's visible water column.

### Deterministic encounter km
Eelbeasts: 0.15, 0.45, 0.80, 1.15, 1.55, 2.05, 2.45, 2.85, 3.30, 3.75, 4.20, 4.65, 5.10, 5.55, 6.15, 6.70 km.
Sirens: 0.30, 0.95, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25, 5.95, 6.65 km.
Crawlers: 0.55, 1.40, 2.25, 3.10, 3.95, 4.80, 5.65, 6.50 km.
Leviathans: **1.65 km** and **5.70 km**.

The first four visible encounters are therefore deliberately early: 0.15, 0.30, 0.45 and 0.55 km.

## Preserved systems
- Exact 2,800 reef groups from v155/v156 are preserved.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn systems remain unchanged.
- Road, glass, water and tunnel systems remain unchanged.
- Verdant v142 remains unchanged.

## Wiring / cache
- `js/19-verdant-assets.js` loads Aqua v143→v157 in order, all Aqua layers with `?b=157`.
- Verdant layers remain `?b=142`.
- `sw.js` still intentionally uses cache name `lunar-ride-v142`, while caching v156 model payloads and `js/63-aqua-visible-creatures-v157.js`.
- Aqua CI protects regressions v143→v157.

## NEXT TASK — visual validation of v157
User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Check specifically:
1. Are the dark flat podium/platform bases finally gone?
2. At 0.15–0.55 km, are the first eel/siren/eel/crawler encounters obvious from the rider view?
3. Is the leviathan at 1.65 km clearly visible and suitably large without intersecting the glass?
4. Do creature scales/orientations look natural enough?
5. Is performance smooth and are fish/jellyfish unchanged?

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest Aqua/Verdant CI, then continue from the v157 visual-validation feedback.
