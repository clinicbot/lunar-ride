# Lunar Ride

A browser-based solo indoor cycling simulator. It connects to a smart trainer through Web Bluetooth, renders procedural 3D worlds in WebGL, simulates cycling physics, controls FTMS resistance, reads heart rate, and exports rides as TCX.

## Run locally

Do not open `index.html` using `file://`. Serve the folder over HTTP. On Windows, double-click `ride.bat`, or run:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`.

## Android

The hosted GitHub Pages version is preferable on Android because it is served over HTTPS, which is appropriate for Web Bluetooth. Open the Pages URL in Chrome, connect the trainer, and optionally send the phone display to a larger screen over HDMI.

## Project layout

- `index.html` – markup only
- `css/styles.css` – interface styling
- `js/01-scenes.js` – world definitions
- `js/02-core-geometry.js` – math, mesh builders, procedural props/creatures
- `js/03-world-generation.js` – terrain, roads, settlements, vegetation, actors
- `js/04-webgl-shaders.js` – WebGL setup and shader source
- `js/05-gltf-models.js` – cyclist/creature/tree glTF loading and animation baking
- `js/06-textures-renderer-setup.js` – procedural/photo textures and GPU setup
- `js/07-ride-physics.js` – rider state, road movement, cycling physics
- `js/08-audio.js` – generated road/wind/drivetrain/tunnel audio
- `js/09-bluetooth.js` – FTMS, cycling power and heart-rate Bluetooth
- `js/10-render-loop.js` – camera, rendering and animated actors
- `js/11-hud.js` – route profile and HUD
- `js/12-export-tcx.js` – TCX activity export
- `js/13-app.js` – menu, controls and application startup
- `assets/models/` – glTF assets
- `assets/images/` – optional artwork/photo textures

## GitHub Pages

This repository includes `.github/workflows/pages.yml`. In GitHub, set **Settings → Pages → Source** to **GitHub Actions**. Each push to `main` then deploys the current version.

## Refactor philosophy

This first split intentionally keeps the original classic-script execution model and shared state. That minimizes the chance of changing trainer timing or simulation behavior. A later refactor can introduce ES-module imports/exports and stronger encapsulation once this version is verified on the real trainer.
