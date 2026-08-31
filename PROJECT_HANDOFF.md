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

## Current checkpoint — Aqua v160
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v160**.
- Backup immediately before v160: `backup-v159-before-rocky-upperfish-v160`.
- v159 layer: `js/65-aqua-sand-ab-v159.js`.
- v160 layer: `js/66-aqua-rocky-upperfish-v160.js`.
- v160 regression: `tests/aqua-v160-rocky-upperfish-smoke.js`.
- Rocky-source provenance: `assets/images/AQUA_ROCK_PROVENANCE.md`.
- Dedicated v160 workflow: `.github/workflows/aqua-v160-ci.yml`.
- `js/09-bluetooth.js` remains untouched.

## User feedback leading to v160
The v159 A/B visual test showed that **Aerial Beach 01** looked better than **Sand 03**, but some coral mound/base geometry remained obvious and the smooth shoulder treatment still looked too planar. The user proposed moving toward a **rocky/rubble seabed** instead of smooth sand and also requested that fish swim **above the underground glass tunnel**, not only around its sides.

## v160 rocky seabed
v160 supersedes the v159 A/B visual appearance while reusing its proven GPU upload/draw path.

### Texture
- **Rocks Ground 04** from Poly Haven.
- Author: Rob Tuytel.
- License: **CC0**.
- Runtime 1K diffuse endpoint is documented in `assets/images/AQUA_ROCK_PROVENANCE.md`.
- The photo is passed through the existing `conditionTile()` pipeline to generate tileable albedo and a derived normal map.

### Geometry
- The rocky shoulder now spans about **0.24–20.5 m outside the local glass radius** on both sides for the entire lap.
- Cross-route rows use stronger uneven relief than v159 so the shoulder no longer reads as a smooth sheet.
- Sparse partially buried low-poly rubble clusters are added along both sides. They use rounded sphere-based geometry rather than boxes/podiums and are intended to break silhouettes and visually cover exposed coral-base edges.
- v160 sets `w.sandA` to the full-lap rocky mesh and retires the old v159 B mesh (`w.sandB=null`).
- At draw time, v160 temporarily swaps the v159 sand material pair to the rocky material, then restores the previous values before the road itself is drawn.

## v160 fish above the tunnel
v160 adds **60 fish** in **12 schools of 5** above the glass tunnel crown.

Placement:
- route stations are distributed around the lap;
- school centers stay near the route centerline with small lateral variation;
- absolute fish height is based on the local road height plus the local glass radius;
- fish are placed **4–11 m above the local top of the glass envelope**.

The new actors reuse existing Quaternius `gcre` fish models and are marked `aquaFish===true` plus `aquaUpperFishV160===true`. Because the v147 updater animates every Aqua actor marked `aquaFish`, the new upper schools automatically receive the established horizontal elliptical swimming motion. Existing tail/facial/U-turn layers remain in the stack.

## v159 uploaded-creature removal remains active
All 36 experimental uploaded v156 creature actors remain removed by v159. The old v156/v157 geometry/placement JavaScript remains loaded for now, but v159 filters those actors after build. No user-uploaded creature should appear in v160.

## Preserved Aqua systems
- Exact 2,800 reef placements remain.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish remain; v160 is additive with 60 upper-tunnel fish.
- Established swim/tail/face/U-turn systems remain unchanged.
- Road asphalt and road geometry remain unchanged.
- Glass, water and tunnel structure remain unchanged.
- Verdant v142 remains isolated.

## Current wiring / cache / CI
`js/19-verdant-assets.js` loads Aqua through v158 as before, then:
- `js/65-aqua-sand-ab-v159.js?b=159`
- `js/66-aqua-rocky-upperfish-v160.js?b=160`

Verdant layers remain `?b=142`.

`sw.js` intentionally retains cache name `lunar-ride-v142` while caching the v160 script and `assets/images/AQUA_ROCK_PROVENANCE.md`. The remote Poly Haven rocky image itself is not in CORE during the visual experiment.

CI coverage:
- `.github/workflows/aqua-ci.yml` protects the established Aqua stack;
- `.github/workflows/aqua-v159-ci.yml` continues to protect the v159 dependency layer;
- `.github/workflows/aqua-v160-ci.yml` protects v160 syntax, runtime rocky shoulder generation, 60 upper-tunnel fish, loader/cache wiring and CC0 provenance;
- `.github/workflows/verdant-ci.yml` protects approved Verdant v142.

At v160 code checkpoint commit `94a3bdb9f0607b8c71242201ff29ef07938c7868`, Aqua v160 CI, Aqua v159 CI, main Aqua CI and Verdant CI all completed successfully.

## Immediate visual test
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Inspect specifically:
1. rocky shoulders should replace both v159 sand looks over the full lap;
2. remaining coral bases should read as buried/blended into an uneven rocky seabed rather than standing on a flat sheet;
3. rounded rubble clusters should add natural irregularity without creating new podiums;
4. fish schools should be visible above the tunnel crown/arches;
5. upper fish density should add life without becoming visually noisy;
6. road, glass, jellyfish and Verdant should remain unchanged;
7. performance should remain smooth.

## Next task
Wait for the user's v160 screenshot/performance feedback. If the rocky treatment is good but bases still peek through, adjust the local shoulder height/relief or rubble density before returning to destructive coral-base changes. If upper fish are too sparse/dense, tune school count/clearance rather than touching the established side-fish distribution.
