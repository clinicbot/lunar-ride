'use strict';

/* Regression test for the v111 black-screen bug. The lightweight pass adds
   actors after js/19 has initialized the original population, so any newly
   added ground creature must already carry the runtime fields updateActors()
   expects before the first animation frame. */
const fs=require('fs'),vm=require('vm');

global.ROUTE_STEP=4;
global.isGL2=true;
global.TEX={veg:{}};
global.gl={};
global.bakeTextures=()=>{};
global.GLCRE={};
global.document=undefined;

const n=1000;
const makeF=(v=0)=>{const a=new Float32Array(n);a.fill(v);return a;};
global.buildWorld=()=>({
  verdant:{zoneAt:()=>0},
  veg:{ctr:new Float32Array(120),dat:new Float32Array(160),uv:new Float32Array(80)},
  _dbg:{roadNear:()=>({i:0,d:20})},
  actors:[],actorMeshes:{bear:{}},nMain:n,
  rx:makeF(10),rz:makeF(20),ry:makeF(5),tx:makeF(1),tz:makeF(0),
  meshH:()=>5
});

vm.runInThisContext(fs.readFileSync('js/25-verdant-lite-richness.js','utf8'),{filename:'js/25-verdant-lite-richness.js'});
const w=buildWorld({id:'verdant',seed:9157});
const bears=w.actors.filter(a=>a.type==='bear');
if(bears.length!==2)throw new Error('expected 2 lightweight bears, got '+bears.length);
for(const [i,a] of bears.entries()){
  for(const k of ['meta','hx','hz','wr','wander','wspd','alert','headYaw','headPitch','swing','gph'])
    if(a[k]===undefined||a[k]===null)throw new Error('bear '+i+' missing runtime field '+k);
  if(!Number.isFinite(a.hx)||!Number.isFinite(a.hz)||!Number.isFinite(a.wander))
    throw new Error('bear '+i+' has non-finite runtime state');
}
console.log(JSON.stringify({ok:true,bears:bears.length,release:'112'}));
