# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.
- Before the next risky visual change, create a new backup from the current v154 checkpoint.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v154**.
- v154 code/wiring/CI feature checkpoint: `ecfa09a111300e3f657df28ffb3bcfd620aeebfa`.
- Aqua CI run `33394089760` — **SUCCESS**.
- Verdant CI run `33394089757` — **SUCCESS** on the same checkpoint.
- Canonical pre-v154 backup: `backup-v153-before-aqua-hero-coral-v154` from exact v153 HEAD `875ab0fe414c418798870eccf1f4c15889065be9`.
- `js/09-bluetooth.js` remains untouched.

## Why v154 exists — exact visual feedback from v153
The user visually tested v153 and sent a screenshot. The result was improved versus v152, but still not good enough:
- coral silhouettes were more varied, but many still looked low-poly / schematic;
- reef read as small scattered props instead of a rich reef wall;
- coral close to the glass was not visually dominant enough;
- the large fan silhouette on the right was the strongest direction: large recognizable forms close to the rider.

The user then explicitly said to continue working. v154 is therefore a composition/scale/cluster upgrade derived from v153.

## Aqua v154 — hero coral clusters + reef pedestals
New layer: `js/60-aqua-hero-coral-v154.js`.
Regression: `tests/aqua-v154-hero-coral-smoke.js`.

v154 still preserves the exact **2,800 placement** budget (700 near / 1,400 mid / 700 far), but changes how the closest reef reads:
- **280 hero groups** total instead of 140: 140 primary near heroes + 140 secondary heroes;
- primary hero placements contain the main coral plus three overlapping companion coral forms;
- secondary heroes contain the main coral plus two companions;
- every one of the 2,800 placements gets a dark reef pedestal / ledge so coral does not look like a small object sitting on a flat floor;
- nearest reef starts at only `glassRadius + 1.10 m` and is scaled larger;
- six recognizable families are retained: branching, fan, brain, plate, sponge and soft coral;
- ordinary medium/far placements remain cheaper than hero clusters to control performance.

### Preserved systems
- 60 proper shared jellyfish from v152 remain unchanged (`creature_jelly.gltf`, `type:'gjelly'`, `gcre:'jelly'`).
- Existing 258 fish and fish swim/tail/face/U-turn systems remain unchanged.
- Road, glass, water and tunnel systems remain unchanged.
- Verdant v142 remains unchanged.
- No terrestrial mountains, poles, buildings or land animals were introduced.

## Asset research note
A CC0 external candidate still exists: MiniPoly `Coral Reef Set` on Poly Pizza. v154 does **not** import it; it remains project-native geometry. This was deliberate for this iteration so we could first fix the obvious composition problem from the screenshot without adding a new asset/loader dependency. If v154 still looks too low-poly after visual testing, the next iteration should strongly favor a controlled CC0 model import rather than simply increasing procedural complexity again.

## Wiring / cache
- `js/19-verdant-assets.js` loads Aqua v143→v154 in order, all Aqua layers with `?b=154`.
- Verdant layers remain `?b=142`.
- `sw.js` keeps the intentional cache name `lunar-ride-v142` but includes `js/60-aqua-hero-coral-v154.js`.
- The original Verdant v121 cache entry `js/32-verdant-fauna-buildings-v121.js` is explicitly protected by Aqua CI.
- Aqua CI syntax-checks and runs regressions v143→v154 and verifies v154 wiring/cache plus v152 jelly preservation.

## NEXT TASK — user visual validation of v154
Do not start another coral version before seeing the user's v154 screenshot unless explicitly requested.

User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Look for:
1. Does the close reef now feel like larger continuous coral gardens/walls instead of isolated small props?
2. Are hero clusters clearly larger and more visually dominant near both sides of the glass?
3. Do the dark reef ledges make the coral feel rooted/natural rather than floating on a flat surface?
4. Is performance still smooth?
5. Are jellyfish and fish unchanged?

If the user still says the actual coral objects look too low-poly/synthetic despite the improved composition, the next step should be a controlled **CC0 external coral model import** (likely MiniPoly Coral Reef Set or another verified CC0 source), with a small number of model-based hero clusters and strict LOD/performance limits.

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify current branch HEAD and latest CI, then continue from the v154 visual-validation feedback. Do not ask the user to repeat the project history unless repository state conflicts with these notes.
