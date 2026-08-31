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

## Current checkpoint — Aqua v157
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v157**.
- Backup immediately before v157: `backup-v156-before-visible-creatures-v157`.
- v157 layer: `js/63-aqua-visible-creatures-v157.js`.
- v157 regression: `tests/aqua-v157-visible-creatures-smoke.js`.
- `js/09-bluetooth.js` remains untouched.

## Why v157 was required
The user's v156 screenshot showed that the dark rectangular coral bases were still visible. The user also did not see any of the four newly imported creature families. Inspection of v156 confirmed the creatures were placed far too far from the tunnel: small creatures were roughly 28–98 m from the glass and leviathans 82–145 m away.

The user explicitly requested moving them very close to the glass because the purpose is for the rider to see them.

## v157 podium fix
v156's podium suppression depended on `Error().stack` containing the function name `moundBase`. That is not reliable in browser execution.

v157 wraps `MeshB.prototype.box` again, but uses an Aqua-build-active flag plus dimensions instead of stack inspection. During Aqua construction it suppresses very flat decorative boxes (`h <= .14`, `w <= 2.25`, `d <= 1.05`) matching the reef-base geometry. Structural tunnel rails remain because they are much taller (`h=.35/.48`).

Telemetry:
- `hardFlatBaseSuppression:true`
- `flatBoxesSuppressed`

## v157 creature visibility
All 36 v156 uploaded creatures are retained and repositioned deterministically after the v156 build:
- 16 eelbeasts
- 10 sirens
- 8 crawlers
- 2 leviathans

Small creatures are now only **2.2–7.5 m outside the local glass radius**. Leviathans are **8–15 m outside the glass**. Their vertical positions are road-relative rather than seabed-relative so they remain in the rider's visible water column.

### Encounter km
Eelbeasts: 0.15, 0.45, 0.80, 1.15, 1.55, 2.05, 2.45, 2.85, 3.30, 3.75, 4.20, 4.65, 5.10, 5.55, 6.15, 6.70 km.

Sirens: 0.30, 0.95, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25, 5.95, 6.65 km.

Crawlers: 0.55, 1.40, 2.25, 3.10, 3.95, 4.80, 5.65, 6.50 km.

Leviathans: **1.65 km** and **5.70 km**.

The first four planned encounters therefore occur at 0.15, 0.30, 0.45 and 0.55 km so visual verification requires only the first half-kilometre.

## Preserved Aqua systems
- Exact 2,800 reef placements from v155/v156 remain.
- v156 uploaded geometry payloads remain in `js/aqua-v156-model-*.js`.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing 258 Quaternius fish and all swim/tail/face/U-turn layers remain unchanged.
- Road, glass, water and tunnel systems remain unchanged.
- Verdant v142 remains isolated.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v157 in order, all Aqua layers cache-busted with `?b=157`. Verdant layers remain `?b=142`.

`sw.js` intentionally retains cache name `lunar-ride-v142` while caching Aqua through `js/63-aqua-visible-creatures-v157.js` and all four v156 model-payload JavaScript files.

Aqua CI now protects v143→v157, including syntax, runtime regressions, v156 uploaded-creature wiring and v157 near-glass placement / hard-base-suppression markers.

## Immediate visual test
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Inspect specifically:
1. the black/flat podium bases should be gone;
2. visible creatures should appear already at 0.15–0.55 km;
3. the first leviathan should be clearly visible near 1.65 km;
4. no creature should intersect the glass;
5. performance, fish and jellyfish should remain unchanged;
6. Verdant Rift remains visually unchanged.

## Next task
Wait for the user's v157 screenshot/performance feedback. If the creatures are visible but orientation/scale/motion is weak, tune those properties rather than moving them far away again. If any rectangular bases remain, inspect which geometry primitive is still producing them rather than reintroducing stack-trace filtering.
