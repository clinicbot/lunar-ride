"use strict";
const fs=require('fs'),vm=require('vm');
const assetPath='assets/models/verdant_mushroom_uploaded_v141.gltf';
const a=JSON.parse(fs.readFileSync(assetPath,'utf8'));
if(a.asset?.version!=='2.0'||!a.meshes?.length)throw new Error('invalid v141 mushroom glTF');
if(!a.buffers?.[0]?.uri?.startsWith('data:'))throw new Error('v141 mushroom must be self-contained');
const pr=a.meshes[0].primitives[0],ia=a.accessors[pr.indices],tri=ia.count/3;
for(const k of ['POSITION','NORMAL','COLOR_0'])if(pr.attributes[k]===undefined)throw new Error('missing '+k);
if(tri<100||tri>1000)throw new Error('unexpected optimized triangle count '+tri);

const loader=require('./_section')('js/46-verdant-uploaded-mushroom-model-v141.js');
const src=require('./_section')('js/47-verdant-uploaded-mushroom-replace-v141.js');
for(const m of ['user-uploaded-glb','HERO_TARGET=240','PATCH_TARGET=2400','HERO_SCALE_MAX=1.80','mushroomTrees:false'])
  if(!src.includes(m))throw new Error('missing v141 marker '+m);
if(!loader.includes('verdant_mushroom_uploaded_v141.gltf')||!loader.includes('XMLHttpRequest'))throw new Error('v141 uploaded model loader missing');

function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const old={count:3},up={count:669,triangles:tri,file:assetPath};
const N=2500,rx=[],rz=[],tx=[],tz=[];for(let i=0;i<N;i++){rx.push(i*10);rz.push(0);tx.push(1);tz.push(0);}
const mk=(n)=>Array.from({length:n*6},(_,i)=>i%6===0?1:0);
const world={nMain:N,lapLen:25000,rx,rz,tx,tz,meshH:()=>0,verdant:{widthAt:()=>3.35},_dbg:{roadNear:()=>({i:0,d:100})},
  __verdantExpansionV140:{final:{cats:40,dragonflies:50,stags:18,buildings:20},mushrooms:{giants:240,small:2400}},
  instNature:{models:{mushroom:old,mushroomGiantV140:old,mushroomPatchV140:old,sentinel:old},
    groups:{mushroom:{kind:'mushrooms',range:1,instances:mk(2)},mushroomGiantV140:{kind:'mushrooms',range:1,instances:mk(240)},
      mushroomPatchV140:{kind:'mushrooms',range:1,instances:mk(2400)},sentinel:{kind:'trees',range:1,instances:mk(1)}},
    stats:{mushrooms:2642,total:3000}}};
const ctx={console,Math,Float32Array,Uint32Array,ROUTE_STEP:10,mulberry32,buildWorld:()=>world,__verdantUploadedMushroomModelV141:up};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const out=ctx.buildWorld({id:'verdant',seed:9157}),t=out.__verdantMushroomV141;
if(!t?.ready||t.heroes!==240||t.patches!==2400||t.removedV140Generic!==2640)throw new Error('v141 mushroom targets failed '+JSON.stringify(t));
if(out.instNature.groups.mushroomGiantV140||out.instNature.groups.mushroomPatchV140)throw new Error('generic v140 mushroom groups remain');
if(out.instNature.models.mushroom!==up||out.instNature.models.mushroomHeroV141!==up||out.instNature.models.mushroomPatchV141!==up)throw new Error('uploaded mushroom model not used everywhere');
if(out.instNature.groups.sentinel.instances.length!==6)throw new Error('unrelated nature group changed');
if(out.__verdantExpansionV140.final.cats!==40||out.__verdantExpansionV140.final.buildings!==20)throw new Error('v140 wildlife/buildings changed');
const all=out.instNature.groups.mushroomHeroV141.instances.concat(out.instNature.groups.mushroomPatchV141.instances);
let max=0;for(let i=5;i<all.length;i+=6)max=Math.max(max,all[i]);if(max>1.800001)throw new Error('mushroom-tree scale returned '+max);
console.log('ok: v141 uses optimized user-uploaded mushroom, replaces generic v140 groves, preserves wildlife/buildings, no mushroom trees');
