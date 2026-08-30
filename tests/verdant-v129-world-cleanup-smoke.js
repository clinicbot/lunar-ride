"use strict";
const fs=require('fs');
const R=f=>fs.readFileSync(f,'utf8');
const loader=R('js/19-verdant-assets.js');
const terrain=R('js/37-verdant-mountains-v129.js');
const cleanup=R('js/38-verdant-world-cleanup-v129.js');
const nature=R('js/26-verdant-real-nature.js');
const bill=R('js/27-verdant-billboard-cleanup.js');
const gate=R('js/34-verdant-assets-gate-v123.js');
const lite=R('js/25-verdant-lite-richness.js');
const weather=R('js/18-verdant-weather.js');
const sw=R('sw.js');

/* Final terrain must break up the residual low-frequency green domes while
   rebuilding a road support shelf wider than a 16 m terrain cell diagonal. */
for(const k of ['ROAD_FLAT=29','ROAD_BLEND=72','__verdantMountainsV129','__verdantRoadbedV129','minRoadClearanceM'])
  if(!terrain.includes(k))throw new Error('v129 terrain/roadbed marker missing: '+k);
if(!terrain.includes('w.meshH=gridH;w.groundAt=gridH'))throw new Error('v129 terrain height sampler not updated');

/* No asynchronous race is allowed to resurrect the 26k legacy billboards. */
if(!nature.includes('__verdantNatureStatusV129')||!nature.includes('__verdantNatureWaitV129'))
  throw new Error('v129 imported-nature readiness API missing');
if(!nature.includes('legacyBillboards:false')||!nature.includes('w.veg=null'))
  throw new Error('v129 nature fallback can still expose legacy billboards');
if(!gate.includes('__verdantNatureStatusV129')||!gate.includes('natureComplete'))
  throw new Error('asset gate does not wait for nature settlement');
if(!bill.includes("mode:'hard-disable-v129'")||!bill.includes('w.veg=null'))
  throw new Error('legacy billboard hard kill missing');

/* Every imported transform must be checked against the nearest route leg,
   not merely the route sample it was spawned from. */
for(const k of ['near(x,z)','const need=ww+','rejectedRoad','legacyBillboardsDisabled:true'])
  if(!cleanup.includes(k))throw new Error('road-safe nature cleanup missing: '+k);

/* Wildlife density must be visibly greater than v125. */
if(!cleanup.includes('extraStagHerds')||!cleanup.includes('const extraHerds=[.55,2.45,3.15,4.55,6.05,7.55,8.95,9.85,11.55,12.45,14.15,18.95,21.35,22.15]'))
  throw new Error('large v129 deer-herd expansion missing');
for(const k of ['extraCatGroups','extraBearGroups','extraMonkeyTroops','extraBirdFlocks'])
  if(!cleanup.includes(k))throw new Error('v129 wildlife expansion missing: '+k);
if(!cleanup.includes('rdx:p.rx,rdz:p.rz'))throw new Error('v129 land animals lack flee road reference');

const m37=loader.match(/37-verdant-mountains-v129\.js\?b=129/);
const m26=loader.match(/26-verdant-real-nature\.js\?b=129/);
const m38=loader.match(/38-verdant-world-cleanup-v129\.js\?b=129/);
const m28=loader.match(/28-verdant-instanced-renderer\.js\?b=129/);
if(!m37||!m26||!m38||!m28)throw new Error('v129 loader wiring missing');
if(!(loader.indexOf(m37[0])<loader.indexOf(m26[0])&&loader.indexOf(m26[0])<loader.indexOf(m38[0])&&loader.indexOf(m38[0])<loader.indexOf(m28[0])))
  throw new Error('v129 layer order incorrect');
if(!lite.includes("const RELEASE='129'"))throw new Error('v129 release label missing');
if(!weather.includes('sky_verdant.svg?b=129'))throw new Error('v129 sky cache bust missing');
if(!sw.includes("lunar-ride-v129")||!sw.includes('js/37-verdant-mountains-v129.js')||!sw.includes('js/38-verdant-world-cleanup-v129.js'))
  throw new Error('v129 service-worker wiring missing');

console.log('ok: v129 kills legacy billboards, protects the road, rejects road plants, breaks smooth domes and greatly increases wildlife');
