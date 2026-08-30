"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/43-verdant-purple-flower-carpets-v138.js','utf8');
for(const marker of ['flower4CarpetV138','TARGET_TOTAL=7110','road.d<ww+4.2','Flower_4_Group.gltf','__verdantPurpleCarpetsV138'])
  if(!src.includes(marker))throw new Error('missing v138 marker: '+marker);

const N=2600,rx=[],rz=[],tx=[],tz=[];
for(let i=0;i<N;i++){rx.push(i*10);rz.push(0);tx.push(1);tz.push(0);}
const model={count:9,pos:new Float32Array(27),nrm:new Float32Array(27),col:new Float32Array(27)};
const world={instNature:{ready:true,routeKm:25,models:{flower4:model},groups:{sentinel:{kind:'trees',range:1,instances:[0,1,0,1,0,1]}},stats:{flowers:10,total:20}},
  _dbg:{roadNear:(x,z)=>({i:Math.max(0,Math.min(N-1,Math.floor(x/10))),d:100})},
  verdant:{widthAt:()=>3.35},nMain:N,rx,rz,tx,tz,meshH:()=>0,lapLen:25000};
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const ctx={console,Float32Array,Math,ROUTE_STEP:10,mulberry32,globalThis:null,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const out=ctx.buildWorld({id:'verdant',seed:77});
const g=out.instNature.groups.flower4CarpetV138;
if(!g)throw new Error('v138 carpet group missing');
if(g.instances.length/6!==7110)throw new Error('expected 7110 carpet instances, got '+g.instances.length/6);
if(out.instNature.models.flower4CarpetV138!==model)throw new Error('v138 must reuse existing flower4 model');
if(out.instNature.groups.sentinel.instances.length!==6)throw new Error('v138 changed an existing nature group');
if(out.__verdantPurpleCarpetsV138.patches!==12)throw new Error('expected 12 dense flower fields');
if(out.__verdantPurpleCarpetsV138.totalPlaced!==7110)throw new Error('telemetry total mismatch');
if(out.instNature.stats.flowers!==7120||out.instNature.stats.total!==7130)throw new Error('nature stats not incremented correctly');
console.log('ok: v138 adds 12 road-safe GPU-instanced purple flower carpets / 7110 groups while preserving existing world groups');
