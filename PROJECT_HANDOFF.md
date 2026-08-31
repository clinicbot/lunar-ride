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

## Current checkpoint — Aqua v158
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v158**.
- Backup immediately before v158: `backup-v157-before-no-podium-v158`.
- v157 layer: `js/63-aqua-visible-creatures-v157.js`.
- v158 layer: `js/64-aqua-no-podium-v158.js`.
- v158 regression: `tests/aqua-v158-no-podium-smoke.js`.
- `js/09-bluetooth.js` remains untouched.

## Why v158 was required
The user's v157 screenshot still showed the dark rectangular coral bases.

Inspection of `js/61-aqua-coral-colonies-v155.js` found the exact source: `moundBase()` creates one irregular `m.box(x,sy*.28,z,sx,sy,sz,...)` for every mound plus additional hero ledge boxes. The main mound boxes can have heights up to roughly `.44`.

v157's runtime filter only rejected boxes with `h <= .14`, so it removed some thin hero ledges but allowed the larger mound blocks that visually read as podiums. This explains why the screenshot barely changed.

## v158 podium fix
v158 wraps `MeshB.prototype.box` after v157 and, only while Aqua is being built, suppresses the full decorative v155 mound/ledge envelope:
- local `y <= .15`
- `h <= .50`
- `.30 <= w <= 2.25`
- `.20 <= d <= 1.10`
- `em <= .0125` when emission is supplied

This range covers the actual v155 mound block dimensions as well as the hero ledges. Larger/taller structural geometry passes through unchanged.

Telemetry:
- `version:158`
- `completeV155PodiumEnvelopeSuppression:true`
- `podiumBoxesSuppressed`
- `sourcePodiumRootCause:'v155 moundBase boxes up to h=.44'`

The v158 regression specifically verifies that a v155-style `h=.28` mound block and a hero ledge are suppressed while larger/taller structural boxes survive. It also verifies that non-Aqua worlds are not filtered.

## v157 creature visibility remains current
All 36 v156 uploaded creatures remain positioned deterministically near the glass:
- 16 eelbeasts
- 10 sirens
- 8 crawlers
- 2 leviathans

Small creatures are **2.2–7.5 m outside the local glass radius**. Leviathans are **8–15 m outside the glass**. Vertical positions are road-relative so they remain in the rider's visible water column.

### Encounter km
Eelbeasts: 0.15, 0.45, 0.80, 1.15, 1.55, 2.05, 2.45, 2.85, 3.30, 3.75, 4.20, 4.65, 5.10, 5.55, 6.15, 6.70 km.

Sirens: 0.30, 0.95, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25, 5.95, 6.65 km.

Crawlers: 0.55, 1.40, 2.25, 3.10, 3.95, 4.80, 5.65, 6.50 km.

Leviathans: **1.65 km** and **5.70 km**.

## Preserved Aqua systems
- Exact 2,800 reef placements remain.
- v156 uploaded geometry payloads remain in `js/62a..62d-aqua-v156-model-*.js`.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn layers remain unchanged.
- v157 near-glass creature placement remains unchanged.
- Road, glass, water and tunnel systems are intended to remain unchanged.
- Verdant v142 remains isolated.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua v143→v158 in order, all Aqua layers cache-busted with `?b=158`. Verdant layers remain `?b=142`.

`sw.js` intentionally retains cache name `lunar-ride-v142` while caching Aqua through `js/64-aqua-no-podium-v158.js` and all four v156 model-payload JavaScript files.

Aqua CI now protects v143→v158, including syntax, all runtime regressions, imported asset validation, v157 near-glass creature placement, and v158 full podium-envelope suppression / wiring.

At the v158 code checkpoint commit `27a7e497578e76e0f42013d13db2de84c2982ac4`, both Aqua CI and Verdant CI completed successfully.

## Immediate visual test
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Inspect specifically:
1. the dark rectangular podium bases should now be gone;
2. organic sphere/rubble mound geometry should remain so corals do not look completely unsupported;
3. visible creatures should appear already at 0.15–0.55 km;
4. the first leviathan should be clearly visible near 1.65 km;
5. no creature should intersect the glass;
6. performance, road/glass/tunnel, fish and jellyfish should remain unchanged;
7. Verdant Rift remains visually unchanged.

## Next task
Wait for the user's v158 screenshot/performance feedback. If any rectangular base still remains after v158, do not widen the runtime filter blindly: identify whether it is coming from a different primitive or a different layer and patch that exact source.
