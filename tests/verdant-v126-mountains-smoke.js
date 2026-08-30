'use strict';
const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');

const base=read('js/17-verdant-rift.js');
const mountains=read('js/35-verdant-mountains-v123.js');
const loader=read('js/19-verdant-assets.js');

/* The original terrain carve reaches width+28 m.  The widest Verdant road is
   3.35 m half-width, so a 46 m hard core leaves >14 m safety beyond the carve. */
if(!base.includes('blend=w+28'))throw new Error('expected Verdant terrain carve definition missing');
if(!mountains.includes('ROAD_CORE=46')||!mountains.includes('ROAD_FADE=84'))
  throw new Error('v126 road-core/fade constants missing');
if(!mountains.includes('FULL_REPLACE=ROAD_CORE+ROAD_FADE'))
  throw new Error('v126 full-replacement distance missing');
if(!mountains.includes('if(d<=ROAD_CORE)continue'))
  throw new Error('hard road-core protection missing');
if(!mountains.includes('smoothstep(clamp((d-ROAD_CORE)/ROAD_FADE,0,1))'))
  throw new Error('smooth mountain transition missing');

/* The old circular uplift must be actively removed, then replaced by warped,
   angularly varying ridges and erosion instead of another radial dome. */
for(const k of ['oldRadial','H[v]-=old','Math.sin(a*3+.55)','Math.sin(a*5-1.18)',
                'ridgeNoise','macroNoise','detailNoise','__verdantMountainsV126'])
  if(!mountains.includes(k))throw new Error('v126 full-route breakup missing: '+k);
if(!mountains.includes('maxProtectedChange')||!mountains.includes('roadCoreM:ROAD_CORE')||
   !mountains.includes('fullReplacementM:FULL_REPLACE'))
  throw new Error('v126 mountain safety telemetry missing');

/* The pass must run before nature/fauna placement so trees, animals and
   building foundations sample the final terrain height. This regression is
   intentionally release-agnostic: later releases must keep the v126 geometry
   algorithm without being forced to retain a v126 cache/version label. */
const m=loader.match(/35-verdant-mountains-v123\.js\?b=\d+/);
const n=loader.match(/25-verdant-lite-richness\.js\?b=\d+/);
if(!m||!n||loader.indexOf(m[0])>loader.indexOf(n[0]))
  throw new Error('mountain pass load order incorrect');

console.log(JSON.stringify({ok:true,roadCoreM:46,fadeM:84,fullReplacementM:130}));
