'use strict';
const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');

const mat=read('js/33-verdant-terrain-birds-v122.js');
const mountains=read('js/35-verdant-mountains-v123.js');
const gate=read('js/34-verdant-assets-gate-v123.js');
const loader=read('js/19-verdant-assets.js');
const lite=read('js/25-verdant-lite-richness.js');
const sw=read('sw.js');

/* Road regression: v122's PathRocks photograph must never be the paved-road
   sampler again.  The original TEX.aA/TEX.aN pair is explicitly rebound. */
if(!mat.includes("b===gpu.road")||!mat.includes('gl.TEXTURE6')||!mat.includes('TEX.aA')||!mat.includes('TEX.aN'))
  throw new Error('clean Verdant road material reset missing');
if(mat.includes("[6,V.aA||TEX.aA]")||mat.includes("[7,V.aN||TEX.aN]"))
  throw new Error('PathRocks is routed back into paved road');
if(!mat.includes("V.pathA=")||!mat.includes("roadMaterial='core-asphalt-clean'"))
  throw new Error('v123 path/road material telemetry missing');

/* Mountain regression: only distant terrain may be ruggedized. */
for(const k of ['d<180','roadProtectionM:180','w.meshH=gridH','w.groundAt=gridH','__verdantMountainsV123'])
  if(!mountains.includes(k))throw new Error('mountain protection/height update missing: '+k);
if(!mountains.includes('ridgeNoise')||!mountains.includes('macroNoise')||!mountains.includes('detailNoise'))
  throw new Error('multi-scale mountain breakup missing');

/* Asset timing regression: all v121 settlement and visible glTF creature
   families must be awaited before the synchronous world build. */
const buildingKeys=['stSide','sHang','sAnt','stGate','sRef','cGate','cDome','cTower','cArc','cSpire','cClu','sRing'];
const creatureKeys=['stag','jelly','bird','bird2','bird3','bird4','cat','dfly','vbear','vfrog','vmonkey','vship'];
for(const k of buildingKeys)if(!gate.includes(k+':'))throw new Error('asset gate missing building '+k);
for(const k of creatureKeys)if(!gate.includes(k+':['))throw new Error('asset gate missing creature '+k);
for(const k of ['waitForAssets','retryMissing','18000','startRide=gated','Loading wildlife & settlements'])
  if(!gate.includes(k))throw new Error('asset readiness behavior missing: '+k);

if(loader.indexOf('35-verdant-mountains-v123.js')<loader.indexOf('21-verdant-terrain-polish.js'))
  throw new Error('mountain pass must run after terrain polish');
for(const f of ['35-verdant-mountains-v123.js','34-verdant-assets-gate-v123.js'])
  if(!loader.includes(f))throw new Error('v123 loader missing '+f);
if(!lite.includes("const RELEASE='123'"))throw new Error('v123 release label missing');
if(!sw.includes("lunar-ride-v123")||!sw.includes('35-verdant-mountains-v123.js')||!sw.includes('34-verdant-assets-gate-v123.js'))
  throw new Error('v123 service worker wiring missing');

console.log(JSON.stringify({ok:true,buildings:buildingKeys.length,creatureAssets:creatureKeys.length,
  road:'core asphalt',mountainProtectionM:180,release:123}));
