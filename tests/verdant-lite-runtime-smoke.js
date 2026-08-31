'use strict';

/* Regression test for the v111 black-screen bug and v120 encounter layer.
   Any actor added after js/19 has initialized the original population must
   already carry the runtime fields updateActors() expects before frame one. */
const fs=require('fs'),vm=require('vm');

global.ROUTE_STEP=4;
global.isGL2=true;
global.TEX={veg:{}};
global.gl={};
global.bakeTextures=()=>{};
global.GLCRE={};
global.document=undefined;
global.mulberry32=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};

const n=7000;
const makeF=(v=0)=>{const a=new Float32Array(n);a.fill(v);return a;};
const modelKeys=['common5','common3','common1','twisted1','twisted3','pine5','pine1','pine3',
  'dead2','bush','bushFlowers','fern','flower4','mushroom','rock1','rock2'];
const models={};for(const k of modelKeys)models[k]={count:3};

global.buildWorld=()=>({
  verdant:{zoneAt:()=>0},
  veg:{ctr:new Float32Array(120),dat:new Float32Array(160),uv:new Float32Array(80)},
  actors:[],actorMeshes:{bear:{},frog:{},monkey:{},insect:{}},nMain:n,
  rx:makeF(10),rz:makeF(20),ry:makeF(5),tx:makeF(1),tz:makeF(0),
  meshH:()=>5,
  instNature:{ready:true,routeKm:25,models,groups:{},stats:{total:0}}
});

vm.runInThisContext(require('./_section')('js/25-verdant-lite-richness.js'),{filename:'js/25-verdant-lite-richness.js'});
vm.runInThisContext(require('./_section')('js/31-verdant-enrichment-v120.js'),{filename:'js/31-verdant-enrichment-v120.js'});
const w=buildWorld({id:'verdant',seed:9157});
const byType=t=>w.actors.filter(a=>a.type===t);
const bears=byType('bear'),frogs=byType('frog'),monkeys=byType('monkey'),insects=byType('insect');
const birds=byType('gbird'),ships=byType('shuttle'),drones=byType('drone');
if(bears.length!==7)throw new Error('expected 7 visible bears, got '+bears.length);
if(frogs.length!==18)throw new Error('expected 18 v120 frogs, got '+frogs.length);
if(monkeys.length!==14)throw new Error('expected 14 v120 monkeys, got '+monkeys.length);
if(insects.length!==28)throw new Error('expected 28 v120 insects, got '+insects.length);
if(birds.length!==47)throw new Error('expected 47 lightweight/v120 birds, got '+birds.length);
if(ships.length!==4||drones.length!==4)throw new Error('expected 4 v120 ships and 4 drones');

for(const [type,list] of [['bear',bears],['frog',frogs],['monkey',monkeys],['insect',insects]]){
  for(const [i,a] of list.entries()){
    for(const k of ['meta','hx','hz','wr','wander','wspd','alert','headYaw','headPitch','swing','gph'])
      if(a[k]===undefined||a[k]===null)throw new Error(type+' '+i+' missing runtime field '+k);
    if(!Number.isFinite(a.hx)||!Number.isFinite(a.hz)||!Number.isFinite(a.wander))
      throw new Error(type+' '+i+' has non-finite runtime state');
    if((type==='monkey'||type==='insect')&&!Number.isFinite(a.pinY))throw new Error(type+' '+i+' missing pinY');
  }
}
if(!w.__verdantV120||w.__verdantV120.totalPlants<100)
  throw new Error('v120 plant enrichment did not run');
console.log(JSON.stringify({ok:true,bears:bears.length,frogs:frogs.length,monkeys:monkeys.length,
  insects:insects.length,birds:birds.length,ships:ships.length,drones:drones.length,
  plants:w.__verdantV120.totalPlants,release:'120'}));
