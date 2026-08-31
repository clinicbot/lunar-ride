# Lunar Ride — NEXT SESSION

Read this file first, then `PROJECT_HANDOFF.md`.

## Repository
- Repo: `clinicbot/lunar-ride`
- Active branch: `fixes-build-90`
- Never modify `main` directly.
- Open draft PR #1 targets `main`.
- Do not touch `js/09-bluetooth.js` unless explicitly requested.
- Use the dedicated ChatGPT GitHub connector; do not confuse it with local `git clone`/container networking.
- Before the next risky visual change, create a backup branch from the current v152 checkpoint.

## Current world state
- Verdant Rift remains approved **v142** and must not be changed.
- Aqua Rift current release is **v152**.
- v152 feature checkpoint: `9aa836a33c211be48045b8ec39f2cbaf7bbcec49`.
- Handoff commit after v152: `0452436ace05ec6c9b0a523a75c715a8882e3d90`.
- Aqua CI for the v152 code checkpoint: run `33386203118` — SUCCESS.
- Verdant CI for the same code checkpoint: run `33386203090` — SUCCESS.
- Canonical pre-v152 backup: `backup-v151-before-aqua-v152-proper-jelly-coral` at v151 final HEAD `07fa11d93278a6feceb0966ee04a2ba12cc0fd6e`.

## Aqua v152 currently does
- Uses the **correct shared project jellyfish** from `assets/models/creature_jelly.gltf`, via `type:'gjelly'`, `gcre:'jelly'`, `CREATURE.gjelly`.
- 60 jellyfish, outside the glass, distributed left/right and at several heights.
- `js/58-aqua-proper-jelly-reef-v152.js` replaces the weak v151 props layer.
- Reef target is 2,800 coral groups, bilateral, in near/mid/far depth bands.
- v152 preserves the road, glass, water, fish systems, U-turn continuity and Verdant.
- Current Aqua stack is v143→v152; see `PROJECT_HANDOFF.md` for full details.

## IMPORTANT — exact visual feedback at the stopping point
The user has now visually tested the reef and says:

> "יש אלמוגים ברמה ירודה מאד... איך נשפר מבחינה גרפית ?"

This is the **next task**. Do not spend the next turn merely increasing the count of the existing procedural coral shapes. The problem is **graphical quality**, not just density.

## Next task — Aqua v153 high-quality coral upgrade
Goal: materially improve coral fidelity while preserving the approved Aqua composition.

Recommended approach:
1. First inspect existing repository assets for any higher-quality coral/reef models already present and reusable.
2. If insufficient, search for permissively licensed, game-ready coral/reef glTF/GLB assets (prefer CC0/public-domain or otherwise clearly reusable). Favor assets with recognizable fan coral, branching coral, brain coral, plate coral, soft coral and sponge forms.
3. Avoid importing huge photogrammetry meshes directly. Optimize/decimate if needed and keep browser/WebGL performance in mind.
4. Use a hybrid composition:
   - lightweight repeated reef models for the majority of the 2,800 placements;
   - a smaller number of high-quality "hero coral" clusters close to the glass where the user actually sees detail;
   - keep far reef simpler for performance.
5. Preserve the Zwift-like target: obvious colourful reef gardens/walls immediately outside both sides of the glass tunnel.
6. Do not bring back mountains, poles, terrestrial props, land animals, or buildings.
7. Keep proper shared jellyfish, all 258 fish, fish motion/tail/faces, road, tunnel, U-turn behavior and Verdant unchanged unless technically necessary.
8. Make a new backup branch before implementation, likely `backup-v152-before-aqua-hq-coral-v153`.
9. Implement as a new Aqua layer **v153**, add regression coverage, wire cache-busters/offline cache, and run both Aqua CI and Verdant CI before calling it complete.

## User workflow after next completed version
`UPDATE.bat` → `ride.bat` → close/reopen browser/game → `Ctrl+F5` → Aqua Rift — Glass Ocean.

## Fresh-chat instruction
If this is a new ChatGPT conversation, immediately read `NEXT_SESSION.md` and `PROJECT_HANDOFF.md` from branch `fixes-build-90` through the dedicated GitHub connector, verify the current branch HEAD, and continue directly with the v153 high-quality coral task. Do not ask the user to repeat the project history unless the repository state conflicts with these notes.
