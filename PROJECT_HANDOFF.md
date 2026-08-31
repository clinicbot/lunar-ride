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

## Current checkpoint — 2026-08-31
- Verdant Rift remains **v142** and must be preserved.
- Aqua Rift current release is **v156**.
- v156 code/wiring/CI feature checkpoint: `d9b5e4bc3940ad1786c8b2798e11ae3798734e98`.
- Aqua CI run `33404254807`: **SUCCESS**.
- Verdant CI run `33404254821`: **SUCCESS** on the same code checkpoint.
- Canonical backup immediately before v156: `backup-v155-before-aqua-creatures-v156`.
- `js/09-bluetooth.js` remains untouched.

## Visual history leading to v156
v153 introduced six recognizable coral families; v154 increased close hero presence and overlapping clusters; v155 tried to replace podiums with organic colonies. The user's v155 screenshot proved the flat dark platforms were still visible. Inspection showed this was not a service-worker/cache issue: v155 `moundBase()` still emitted several thin rectangular `box()` ledges under hero colonies.

The user then supplied four GLB water-creature models and explicitly asked to add them to Aqua for more interest while fixing the platforms.

## Aqua v156 — true podium removal + uploaded water creatures
New runtime/data files:
1. `js/62a-aqua-v156-model-siren.js`
2. `js/62b-aqua-v156-model-crawler.js`
3. `js/62c-aqua-v156-model-eelbeast.js`
4. `js/62d-aqua-v156-model-leviathan.js`
5. `js/62-aqua-creatures-v156.js`

Regression: `tests/aqua-v156-creatures-smoke.js`.

### User-uploaded model conversion
The four user GLBs were inspected and simplified to lightweight quantized geometry. Their compact position/index payloads are stored as base64 uint16 data in the four `62a..62d` JS files. `js/62-aqua-creatures-v156.js` reconstructs positions/normals at GL initialization and registers each model directly in the established `GLCRE` creature registry. This avoids adding a new GLB/parser/texture dependency to the lightweight Lunar Ride runtime.

Registered model keys:
- `aqSiren156`
- `aqCrawler156`
- `aqEel156`
- `aqLeviathan156`

### Actual platform fix
v156 intentionally does **not** rebuild the entire approved v155 reef again. Instead it fixes the exact defect at the source-call level: it wraps `MeshB.prototype.box` and suppresses only the very flat box dimensions called from a function named `moundBase` (`h<=.12`, `d<=.60`, `w<=2.10`).

This removes the three v155 hero-mound ledge/platform boxes while preserving:
- Aqua structural tunnel rails (`h=.35`),
- all non-mound geometry,
- all Verdant geometry.

The remaining v155 mound is composed of rounded rock/rubble spheres, so visually it should read as an irregular reef foundation instead of a black stage.

Regression explicitly creates two fake `moundBase()` boxes plus one tunnel-rail box and verifies only the mound boxes are suppressed.

### 36 new water creatures
v156 adds exactly **36** moving user-model creatures, all outside the glass and using the established `type:'drone'` orbit/swim movement contract:
- **10 sirens** — medium-large, mixed depth, moderate distance;
- **8 crawlers** — slightly larger/deeper/farther;
- **16 eel-beasts** — most common, elongated orientation with a 90° yaw bias;
- **2 leviathans** — very large, very slow, rare and far from the tube.

The population is deliberately sparse compared with the 258 existing fish. The intent is occasional interesting silhouettes/events rather than another repetitive school.

Telemetry `w.__aquaV156` records:
- `reefBaseBoxesRemoved:true`
- `reefBaseCylindersRemoved:true`
- `platformBoxesSuppressed`
- `uploadedUserModels:true`
- `customCreatureCount:36`
- creature counts 10 / 8 / 16 / 2
- `heroLeviathans:2`
- v155 reef counts carried forward
- jelly/fish preservation
- road/glass/Verdant isolation.

## Preserved Aqua systems
- v155 reef composition remains exact: **2,800 groups** = 700 near / 1,400 mid / 700 far.
- 280 hero colonies remain (140 primary + 140 secondary).
- 2,800 mound groups and 840 accents remain.
- v153-v155 coral families/composition remain intact except the thin v155 moundBase boxes are suppressed.
- v152: 60 proper shared project jellyfish remain (`assets/models/creature_jelly.gltf`).
- v144-v150: 258 Quaternius fish and their visibility/depth/swim/tail/face/U-turn behavior remain unchanged.
- Road, glass and water remain unchanged.
- Aqua tunnel structural rails remain unchanged.
- Verdant v142 remains isolated.

## Current Aqua wiring
`js/19-verdant-assets.js` loads Aqua with cache-buster `?b=156` in order:
1. v143 base Glass Ocean
2. v144 real fish
3. v145 visibility/fauna isolation
4. v146 depth distribution
5. v147 swim trajectory
6. v148 body/tail animation
7. v149 U-turn continuity
8. v150 fish faces / reef cleanup
9. v151 historical coral/jelly layer
10. v152 proper shared jellyfish
11. v153 recognizable HQ coral
12. v154 hero clusters
13. v155 coral colonies / mound composition
14. v156 siren model payload
15. v156 crawler model payload
16. v156 eel-beast model payload
17. v156 leviathan model payload
18. **v156 platform filter + creature population**

Verdant scripts remain `?b=142`.
`sw.js` intentionally retains cache name `lunar-ride-v142`, preserves the original `js/32-verdant-fauna-buildings-v121.js` entry, and includes all five v156 files.

## CI
Aqua workflow: `.github/workflows/aqua-ci.yml`.
Verdant workflow: `.github/workflows/verdant-ci.yml`.

Aqua CI now protects **v143→v156**:
- syntax for all Aqua scripts including 62a-d/main and all regressions;
- all runtime smoke tests through v156;
- Quaternius fish/provenance checks;
- shared jelly asset/loader checks;
- `?b=156` loader wiring for every Aqua layer;
- service-worker inclusion for all v156 model/runtime files;
- Verdant v142 wiring/cache invariants;
- v152/v153/v154/v155 regression markers;
- v156 model payload presence, registration, exact 36-creature population and selective moundBase box suppression.

Feature checkpoint results:
- Aqua run `33404254807` — **SUCCESS**.
- Verdant run `33404254821` — **SUCCESS**.

## Verdant Rift approved state — v142
Do not disturb while tuning Aqua. Mushrooms 25% scale; bilateral four-colour hillside flowers; 14 bears; v140 cats/dragonflies/deer/buildings; approved v137 TwistedTree and v136 CommonTree mixes. Rejected v132 bundle, global v133 alpha changes, v135 synthetic CommonTree and v130 palms remain off. GPU nature instancing remains `js/28-verdant-instanced-renderer.js`.

## Immediate visual test — v156
Run:
`UPDATE.bat` → `ride.bat` → close/reopen → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look specifically for:
- the dark rectangular platforms under coral should finally be gone;
- rounded irregular rock/rubble should remain under colonies;
- new user-model creatures should appear at different depths and on both sides, not in a single line;
- only two giant leviathans exist, so sightings should be occasional;
- fish and proper v152 jellyfish should be unchanged;
- no creature enters the glass tube;
- frame rate should remain smooth;
- Verdant must be visually unchanged.

## Next task after this handoff
Wait for the user's v156 screenshot/performance feedback. If platforms still appear, identify the visible geometry source before changing cache or coral density. If the new creatures are poorly oriented/scaled/sparse/dense, tune only v156 model transform/population parameters. Do not disturb Verdant, fish, jellyfish or the approved v155 reef budget without explicit visual evidence.
