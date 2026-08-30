"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/44-verdant-purple-flower-megacarpets-v139.js','utf8');
for(const marker of ['PATCH_COUNT=48','TARGET_TOTAL=113760','ROAD_EDGE_GAP=.10',
  'FLOWER_RADIUS_FACTOR=.80','flower4MegaCarpetV139','Flower_4_Group.gltf','__verdantPurpleCarpetsV139'])
  if(!src.includes(marker))throw new Error('missing v139 marker: '+marker);
if(!src.includes('road.d<ww+ROAD_EDGE_GAP+plantRadius'))
  throw new Error('v139 must protect the visible flower edge 10 cm from asphalt');

const N=2600,rx=[],rz=[],tx=[],tz=[];
for(let i=0;i<N;i++){rx.push(i*10);rz.push(0);tx.push(1);tz.push(0);}
const model={count:9,pos:new Float32Array(27),nrm:new Float32Array(27),col:new Float32Array(27)};
const world={instNature:{ready:true,routeKm:25,models:{flower4:model},
  groups:{sentinel:{kind:'trees',range:1,instances:[0,1,0,1,0,1]}},stats:{flowers:10,total:20}},
  _dbg:{roadNear:(x,z)=>({i:Math.max(0,Math.min(N-1,Math.floor(x/10))),d:100})},
  verdant:{widthAt:()=>3.35},nMain:N,rx,rz,tx,tz,meshH:()=>0,lapLen:25000};
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const ctx={console,Float32Array,Math,ROUTE_STEP:10,mulberry32,globalThis:null,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const patches=ctx.__verdantPurpleCarpetPatchesV139;
if(!Array.isArray(patches)||patches.length!==48)throw new Error('expected exactly 48 v139 patches');
if(ctx.__verdantPurpleCarpetTargetV139!==113760)throw new Error('target total must be 113760');
if(Math.abs(ctx.__verdantPurpleCarpetRoadGapV139-.10)>1e-9)throw new Error('road edge gap must be 0.10 m');
for(const p of patches){
  if(p.near!==0)throw new Error('patches must be allowed to approach the road filter');
  if(p.span<.28||p.span>.401)throw new Error('unexpected enlarged patch span '+p.span);
  if(p.count%4!==0)throw new Error('each v139 patch count should be a 4x v138 profile');
}
const out=ctx.buildWorld({id:'verdant',seed:77});
const g=out.instNature.groups.flower4MegaCarpetV139;
if(!g)throw new Error('v139 mega carpet group missing');
if(g.instances.length/6!==113760)throw new Error('expected 113760 carpet instances, got '+g.instances.length/6);
if(out.instNature.models.flower4MegaCarpetV139!==model)throw new Error('v139 must reuse existing flower4 model');
if(out.instNature.groups.sentinel.instances.length!==6)throw new Error('v139 changed an existing nature group');
if(out.__verdantPurpleCarpetsV139.patches!==48)throw new Error('telemetry patch count mismatch');
if(out.__verdantPurpleCarpetsV139.totalPlaced!==113760)throw new Error('telemetry total mismatch');
if(out.instNature.stats.flowers!==113770||out.instNature.stats.total!==113780)
  throw new Error('nature stats not incremented correctly');
console.log('ok: v139 adds 48 mega purple carpets / 113760 GPU instances, ~4x area per patch, 10 cm road-edge gap');
