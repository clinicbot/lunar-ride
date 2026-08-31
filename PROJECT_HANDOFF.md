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

## Current checkpoint — Aqua v159
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v159**.
- Backup immediately before v159: `backup-v158-before-sand-ab-v159`.
- v159 layer: `js/65-aqua-sand-ab-v159.js`.
- v159 regression: `tests/aqua-v159-sand-ab-smoke.js`.
- Sand-source provenance: `assets/images/AQUA_SAND_PROVENANCE.md`.
- Dedicated v159 workflow: `.github/workflows/aqua-v159-ci.yml`.
- `js/09-bluetooth.js` remains untouched.

## Why v159 was required
The user's v158 screenshot still showed visible coral bases/platform-like mound geometry. The user also decided the four user-uploaded creature families added in v156 did not look good in Aqua and explicitly requested removing them.

Instead of continuing to widen geometry suppression filters, the user proposed a more natural visual solution: cover/blend the reef floor beside the road with realistic sand, analogous to the improved asphalt treatment on the road. The user approved an A/B test of two high-quality Poly Haven CC0 sand sources in alternating route sections.

## v159 uploaded-creature removal
v159 runs after the existing Aqua stack and removes every actor marked `aquaCreatureV156===true`. This removes all **36** experimental uploaded creatures:
- 16 eelbeasts
- 10 sirens
- 8 crawlers
- 2 leviathans

The old v156/v157 model/placement JavaScript still loads for this low-risk A/B experiment, but its generated actors are removed immediately by v159. If v159 is approved, dead-code cleanup can be done later without mixing it into the visual test.

The existing Quaternius fish and the 60 proper shared v152 jellyfish are preserved.

## v159 sand shoulder A/B experiment
v159 generates two independent route-following seabed shoulder meshes outside the local glass envelope on **both** sides of the road.

The shoulder spans approximately **0.35–19.5 m outside the local glass radius** and uses several cross-road rows with mild height variation. The purpose is to make the coral mound/base geometry read as partially buried in seabed sand rather than dark objects placed on platforms.

### Route comparison schedule
- **0.0–1.8 km:** Aerial Beach 01
- **1.8–3.6 km:** Sand 03
- **3.6–5.4 km:** Aerial Beach 01
- **5.4 km–lap end:** Sand 03

This provides two separate examples of each texture under different route views and lighting.

### Texture sources
Both are Poly Haven **CC0** assets:
- A — Aerial Beach 01, author Rob Tuytel
- B — Sand 03, author Charlotte Baglioni

During v159, the 1K diffuse images are loaded from Poly Haven at runtime and passed through Lunar Ride's existing `conditionTile()` pipeline, which flattens baked lighting, makes the image tileable and derives a normal map. This keeps the A/B experiment small. Once a winner is chosen, the selected texture can be vendored into the repository for fully local/offline use.

See `assets/images/AQUA_SAND_PROVENANCE.md` for source URLs and attribution/license notes.

## Rendering approach
- `w.sandA` and `w.sandB` are built as separate static meshes.
- `uploadWorld()` uploads them to `gpu.sandA` / `gpu.sandB`.
- The draw wrapper renders them immediately before the road.
- During the main pass, the existing asphalt material shader is reused temporarily with the appropriate sand diffuse/normal pair, then the original asphalt textures are restored before the actual road is drawn.
- During the shadow pass, the sand meshes are also drawn so they receive/cast scene-consistent shadows.
- If the remote photos have not loaded yet, the road remains unaffected; the sand photo draw waits until the A/B textures are ready.

## Preserved Aqua systems
- Exact 2,800 reef placements remain.
- 60 proper shared v152 jellyfish remain unchanged.
- Existing Quaternius fish and all swim/tail/face/U-turn layers remain unchanged.
- Road asphalt and road geometry remain unchanged.
- Glass, water and tunnel systems remain unchanged.
- Verdant v142 remains isolated.

## Current wiring / cache / CI
`js/19-verdant-assets.js` loads Aqua through v158 as before, then loads `js/65-aqua-sand-ab-v159.js?b=159`. Verdant layers remain `?b=142`.

`sw.js` intentionally retains cache name `lunar-ride-v142` while adding the v159 script and provenance note to CORE. The two experimental sand photos are cross-origin remote resources and therefore are not included in the service-worker CORE cache during the A/B test.

CI coverage:
- existing `.github/workflows/aqua-ci.yml` protects the established Aqua v143→v158 stack;
- new `.github/workflows/aqua-v159-ci.yml` protects v159 syntax, dynamic removal of uploaded actors, A/B mesh generation, loader/cache wiring and provenance;
- `.github/workflows/verdant-ci.yml` protects approved Verdant v142.

## Immediate visual test
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Inspect specifically:
1. all four uploaded creature families should be gone;
2. sand should appear along both sides of the road and visually bury/blend the coral bases;
3. compare **Aerial Beach 01** over 0–1.8 km against **Sand 03** over 1.8–3.6 km;
4. repeat the comparison over 3.6–5.4 km versus 5.4 km–lap end;
5. choose which texture looks more natural underwater and better hides the coral bases;
6. verify performance, fish, jellyfish, road and glass are unchanged.

## Next task
Wait for the user's v159 visual feedback. If one sand clearly wins, keep that texture for the whole route, vendor it locally, and tune shoulder width/height/tint if needed. If neither works, adjust the shoulder geometry/tint before returning to destructive coral-base changes.
