# Aqua fish model quality research — v146

Visual review after v145 confirmed that the imported Quaternius fish are visible but deliberately stylized/low-poly. Higher-detail permissive alternatives were researched before replacing runtime assets.

Promising sources:

- Khronos glTF Sample Assets — Barramundi Fish. CC0, native glTF, PBR showcase asset with normal and occlusion maps. Strong technical fit as a quality reference, but Lunar Ride's current creature baker ignores base-colour/normal textures and would render it much flatter unless the loader is extended.
- ffish.asia / floraZia on Sketchfab — thousands of photogrammetry-derived organism models, many explicitly CC0. Example: Blue-striped Angelfish (CC0) is about 586.5k triangles. Visual fidelity is excellent but that density is far too high for dozens/hundreds of simultaneous WebGL fish without decimation/LOD and texture baking.
- code4fukui/vr-medaka — redistributes an ffish.asia CC0 medaka model as a ~1.5 MB GLB and demonstrates animated WebXR use. This is a realistic candidate for a small number of hero fish, but it is a freshwater species and still requires a texture-capable/optimized import path for Lunar Ride.

Decision for v146: do not silently swap the approved working population to unoptimized high-poly assets. First fix the user-visible vertical/spatial distribution. A future quality pass should add a texture-aware fish import path plus LOD/decimation, then introduce a handful of higher-detail hero fish while retaining lighter school fish for performance.
