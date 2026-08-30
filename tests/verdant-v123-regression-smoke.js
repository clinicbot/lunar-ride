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
  throw new Error('path/road material telemetry missing');

/* Mountain regression: the current pass must protect the road core, update
   terrain sampling and use multi-scale ridge breakup.  Exact release numbers
   are deliberately NOT tested here; this is a behavior regression test. */
for(const k of ['ROAD_CORE=46','ROAD_FADE=84','w.meshH=gridH','w.groundAt=gridH','__verdantMountainsV126'])
  if(!mountains.includes(k))throw new Error('mountain protection/height update missing: '+k);
if(!mountains.includes('ridgeNoise')||!mountains.includes('macroNoise')||!mountains.includes('detailNoise'))
  throw new Error('multi-scale mountain breakup missing');

/* Asset timing regression: all settlement and visible glTF creature families
   must be awaited before the synchronous world build. */
const buildingKeys=['stSide','sHang','sAnt','stGate','sRef','cGate','cDome','cTower','cArc','cSpire','cClu','sRing'];
const creatureKeys=['stag','jelly','bird','bird2','bird3','bird4','cat','dfly','vbear','vfrog','vmonkey','vship'];
for(const k of buildingKeys)if(!gate.includes(k+':'))throw new Error('asset gate missing building '+k);
for(const k of creatureKeys)if(!gate.includes(k+':['))throw new Error('asset gate missing creature '+k);
for(const k of ['waitForAssets','retryMissing','18000','startRide=gated','Loading wildlife & settlements'])
  if(!gate.includes(k))throw new Error('asset readiness behavior missing: '+k);

if(loader.indexOf('35-verdant-mountains-v123.js')<loader.indexOf('21-verdant-terrain-polish.js'))
  throw new Error('mountain pass must run after terrain polish');
for(const f of ['35-verdant-mountains-v123.js','34-verdant-assets-gate-v123.js'])
  if(!loader.includes(f))throw new Error('Verdant loader missing '+f);

const rm=lite.match(/const RELEASE='(\d+)'/),cm=sw.match(/lunar-ride-v(\d+)/);
if(!rm||+rm[1]<123)throw new Error('current Verdant release label missing');
if(!cm||+cm[1]!==+rm[1])throw new Error('service-worker cache/release mismatch');
if(!sw.includes('35-verdant-mountains-v123.js')||!sw.includes('34-verdant-assets-gate-v123.js'))
  throw new Error('service worker Verdant wiring missing');

console.log(JSON.stringify({ok:true,buildings:buildingKeys.length,creatureAssets:creatureKeys.length,
  road:'core asphalt',mountainRoadCoreM:46,release:+rm[1]}));
