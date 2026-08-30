/* Lunar Ride service worker.
   NETWORK-FIRST for everything: while online you always get the newest
   deploy; every successful response is copied into the cache for offline use. */
const CACHE = 'lunar-ride-v123';

const CORE = [
  '.', 'index.html', 'css/styles.css', 'css/15-fixes.css', 'manifest.webmanifest',
  'js/01-scenes.js', 'js/02-core-geometry.js', 'js/03-world-generation.js',
  'js/04-webgl-shaders.js', 'js/05-gltf-models.js',
  'js/06-textures-renderer-setup.js', 'js/07-ride-physics.js',
  'js/08-audio.js', 'js/09-bluetooth.js', 'js/10-render-loop.js',
  'js/11-hud.js', 'js/12-export-tcx.js', 'js/13-app.js',
  'js/14-layout-fixes.js', 'js/15-map-pan.js', 'js/16-junction-cleanup.js',
  'js/17-verdant-rift.js', 'js/18-verdant-weather.js', 'js/19-verdant-assets.js',
  'js/20-verdant-route-audit.js', 'js/21-verdant-terrain-polish.js',
  'js/35-verdant-mountains-v123.js', 'js/25-verdant-lite-richness.js',
  'js/26-verdant-real-nature.js', 'js/30-verdant-natural-v119.js',
  'js/31-verdant-enrichment-v120.js', 'js/32-verdant-fauna-buildings-v121.js',
  'js/33-verdant-terrain-birds-v122.js', 'js/34-verdant-assets-gate-v123.js',
  'js/27-verdant-billboard-cleanup.js', 'js/28-verdant-instanced-renderer.js',
  'assets/images/verdant_rift_card.svg',
  'assets/models/verdant_bear.gltf', 'assets/models/verdant_frog.gltf',
  'assets/models/verdant_monkey.gltf', 'assets/models/verdant_ship.gltf'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}))
  );
});
