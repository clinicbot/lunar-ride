# Aqua Rift v157 visibility checkpoint

- Branch: `fixes-build-90`
- Backup before change: `backup-v156-before-visible-creatures-v157`
- Purpose: make the four uploaded creature families clearly visible from the glass tunnel and remove the remaining flat coral podium bases.

## Creature placement
- Eelbeast: 16 encounters at 0.15, 0.45, 0.80, 1.15, 1.55, 2.05, 2.45, 2.85, 3.30, 3.75, 4.20, 4.65, 5.10, 5.55, 6.15, 6.70 km.
- Siren: 10 encounters at 0.30, 0.95, 1.75, 2.45, 3.15, 3.85, 4.55, 5.25, 5.95, 6.65 km.
- Crawler: 8 encounters at 0.55, 1.40, 2.25, 3.10, 3.95, 4.80, 5.65, 6.50 km.
- Leviathan: 2 hero encounters at 1.65 and 5.70 km.

Small creatures are anchored only 2.2–7.5 m outside the local glass radius. Leviathans are 8–15 m outside the glass. Their vertical positions are road-relative rather than seabed-relative so they remain in the rider's visible water column.

## Podium removal
v156 depended on browser stack traces to detect calls from `moundBase`; this was not reliable. v157 suppresses very flat decorative boxes by dimensions while the Aqua build chain is active. Tunnel rails are deliberately unaffected because they are much taller.
