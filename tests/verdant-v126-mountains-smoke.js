'use strict';
const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');

const base=read('js/17-verdant-rift.js');
const mountains=read('js/35-verdant-mountains-v123.js');
const loader=read('js/19-verdant-assets.js');
const lite=read('js/25-verdant-lite-richness.js');
const sw=read('sw.js');

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
   building foundations sample the final terrain height. */
const mi=loader.indexOf('35-verdant-mountains-v123.js?b=126');
const ni=loader.indexOf('25-verdant-lite-richness.js?b=126');
if(mi<0||ni<0||mi>ni)throw new Error('v126 mountain pass load order incorrect');
if(!lite.includes("const RELEASE='126'"))throw new Error('v126 release label missing');
if(!sw.includes("lunar-ride-v126"))throw new Error('v126 cache missing');

console.log(JSON.stringify({ok:true,roadCoreM:46,fadeM:84,fullReplacementM:130,release:126}));
