/* Lunar Ride service worker.
   NETWORK-FIRST for everything: while online you always get the newest
   deploy; every successful response is copied into the cache for offline use. */
const CACHE = 'lunar-ride-v142';

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
  'js/35-verdant-mountains-v123.js', 'js/37-verdant-mountains-v129.js',
  'js/25-verdant-lite-richness.js', 'js/26-verdant-real-nature.js',
  'js/30-verdant-natural-v119.js', 'js/31-verdant-enrichment-v120.js',
  'js/32-verdant-fauna-buildings-v121.js', 'js/33-verdant-terrain-birds-v122.js',
  'js/34-verdant-assets-gate-v123.js', 'js/36-verdant-wildlife-v125.js',
  'js/38-verdant-world-cleanup-v129.js', 'js/27-verdant-billboard-cleanup.js',
  'js/39-verdant-common-tree-mix-v134.js', 'js/41-verdant-common-tree-compact-v136.js',
  'js/42-verdant-twisted-tree-mix-v137.js', 'js/44-verdant-purple-flower-megacarpets-v139.js',
  'js/46-verdant-uploaded-mushroom-model-v141.js',
  'js/45-verdant-wildlife-buildings-mushrooms-v140.js',
  'js/47-verdant-uploaded-mushroom-replace-v141.js',
  'js/48-verdant-mushroom-carpet-fix-v142.js',
  'js/49-aqua-rift-v143.js', 'js/50-aqua-real-fish-v144.js',
  'js/51-aqua-fish-visibility-v145.js', 'js/52-aqua-depth-distribution-v146.js',
  'js/53-aqua-swim-motion-v147.js', 'js/54-aqua-tail-animation-v148.js',
  'js/55-aqua-uturn-continuity-v149.js', 'js/56-aqua-faces-reef-v150.js',
  'js/57-aqua-coral-jelly-v151.js', 'js/58-aqua-proper-jelly-reef-v152.js',
  'js/59-aqua-hq-coral-v153.js', 'js/60-aqua-hero-coral-v154.js',
  'js/28-verdant-instanced-renderer.js',
  'assets/images/verdant_rift_card.svg', 'assets/images/aqua_rift_card.svg', 'assets/images/sky_verdant.svg',
  'assets/models/verdant_bear.gltf', 'assets/models/verdant_frog.gltf',
  'assets/models/verdant_monkey.gltf', 'assets/models/verdant_ship.gltf',
  'assets/models/verdant_mushroom_uploaded_v141.gltf', 'assets/models/creature_jelly.gltf',
  'assets/models/aqua_fish/clownfish.gltf',
  'assets/models/aqua_fish/fish-a.gltf',
  'assets/models/aqua_fish/fish-b.gltf',
  'assets/models/aqua_fish/fish-c.gltf',
  'assets/models/aqua_fish/shark.gltf',
  'assets/models/aqua_fish/anglerfish.gltf',
  'assets/models/aqua_fish/puffer.gltf',
  'assets/models/aqua_fish/lionfish.gltf',
  'assets/models/aqua_fish/butterfly-fish.gltf',
  'assets/models/aqua_fish/swordfish.gltf',
  'assets/models/aqua_fish/black-lionfish.gltf'
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