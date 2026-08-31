# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.
- Before the next risky visual change, create a new backup from the current v153 checkpoint.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v153**.
- v153 code/wiring/CI feature checkpoint: `d3a3d03094e390b38df676d5973f451fd635127a`.
- Aqua CI run `33392300322` — **SUCCESS**.
- Verdant CI run `33392300238` — **SUCCESS** on the same checkpoint.
- Canonical pre-v153 backup: `backup-v152-before-aqua-hq-coral-v153` from exact pre-v153 HEAD `23c96d831701f69c743d3cb49c48f429cba761b2`.
- `js/09-bluetooth.js` remains untouched.

## Aqua v153 — high-quality coral geometry
New layer: `js/59-aqua-hq-coral-v153.js`.
Regression: `tests/aqua-v153-hq-coral-smoke.js`.

v153 directly addresses the user's complaint that the v152 coral was graphically low quality. It does **not** increase the reef count. It preserves the exact 2,800-placement composition and rebuilds the coral layer with six recognizable geometric families:
- branching / staghorn coral with tapered 3-D branches;
- sea fans with a visible radial/cross lattice;
- brain coral with ridged dome geometry;
- layered wavy plate coral;
- hollow tube sponges;
- soft coral with curved tapered fingers.

### Hybrid LOD / performance
- Exact reef budget remains **2,800 groups**: 700 near / 1,400 mid / 700 far.
- **140 close hero groups** (70 per side) receive the highest detail.
- **1,494 medium-detail groups** fill near/mid reef.
- **1,166 simple groups** carry the far silhouette.
- Smoke telemetry produced ~403,514 reef triangles in the test world; the extra close-up fidelity is offset by simpler far LOD instead of adding more coral groups.
- Colour weighting remains the approved v152 purple/pink/orange/turquoise/blue/cream palette.

### Preserved systems
- v152 shared jellyfish remain: 60 actors using `assets/models/creature_jelly.gltf`, `type:'gjelly'`, `gcre:'jelly'`.
- Existing 258 fish and all fish motion/tail/faces/U-turn systems remain unchanged.
- Road, glass, water/tunnel systems remain unchanged.
- Verdant v142 remains unchanged.
- No terrestrial mountains, poles, buildings or land animals were introduced.

## Asset research note
The repository had no dedicated coral/reef model assets. A suitable external candidate was found (MiniPoly Coral Reef Kit on Poly Pizza; one set is CC0), but v153 intentionally does **not** add an external dependency. The final implementation uses project-native lightweight mesh geometry so licensing, texture loading, file size and WebGL performance stay controlled. If the user later wants photorealistic/model-based coral, revisit this separately rather than mixing it into the current checkpoint.

## Wiring / cache
- `js/19-verdant-assets.js` now loads Aqua v143→v153 in order, all Aqua layers with `?b=153`.
- Verdant layers remain `?b=142`.
- `sw.js` keeps the intentional cache name `lunar-ride-v142` but includes `js/59-aqua-hq-coral-v153.js` for offline use.
- Aqua CI now syntax-checks and runs regressions v143→v153 and verifies v153 wiring/cache plus v152 jelly preservation.

## NEXT TASK — user visual validation of v153
Do **not** start v154 or make another coral change before seeing the user's v153 result unless the user explicitly asks.

User workflow:
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → **Aqua Rift — Glass Ocean**.

Ask/look for:
1. Do the closest corals now read clearly as branching coral, fan coral, brain coral, plates, sponges and soft coral rather than coloured blobs?
2. Are the 140 hero groups close enough and large enough to appreciate while riding?
3. Is the reef still colourful and obvious on both sides without entering the glass tube?
4. Does performance remain smooth?
5. Are the proper jellyfish and fish unchanged?

If the user sends screenshots/feedback, tune **v153-derived coral geometry/scale/placement only** based on what is actually visible. Preserve Verdant and the approved Aqua systems.

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify the current branch HEAD and latest CI, then continue from the v153 visual-validation feedback. Do not ask the user to repeat the project history unless repository state conflicts with these notes.
