"use strict";
const fs=require("fs"),vm=require("vm");
const src=fs.readFileSync("js/45-verdant-wildlife-buildings-mushrooms-v140.js","utf8");
for(const marker of ["CAT_MULT=10","DFLY_MULT=10","STAG_MULT=3","BUILDING_MULT=5","GIANT_CAT_FRACTION=.5",
  "GIANT_MUSHROOM_TARGET=240","SMALL_MUSHROOM_TARGET=2400","stampRoadPair","mushroomGiantV140","__verdantExpansionV140"])
  if(!src.includes(marker))throw new Error("missing v140 marker: "+marker);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.idx=[];}
  setTF(){}
  P(x,y,z){return [x,y,z];}
  tri(a,b,c,col,em){const base=this.pos.length/3;this.pos.push(...a,...b,...c);this.nrm.push(0,1,0,0,1,0,0,1,0);for(let i=0;i<3;i++)this.col.push(col[0]||0,col[1]||0,col[2]||0,em||0);this.idx.push(base,base+1,base+2);}
  box(x,y,z,w,h,d,col,em){this.tri([x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x,y+h,z+d/2],col,em);}
}
const simpleModel={norm:1,prims:[{pos:new Float32Array([-1,0,-1, 1,0,-1, 0,2,1]),idx:new Uint32Array([0,1,2]),col:[.5,.5,.5],em:.02}]};
const GLTREES={};for(const k of ["stSide","stGate","sHang","sAnt","sRef","sRing","cGate","cDome","cTower","cArc","cSpire","cClu"])GLTREES[k]=simpleModel;
const GLCRE={cat:{ready:true},dfly:{ready:true},stag:{ready:true}};
const N=2500,rx=[],rz=[],tx=[],tz=[];for(let i=0;i<N;i++){rx.push(i*10);rz.push(0);tx.push(1);tz.push(0);}
const actors=[];for(let i=0;i<4;i++)actors.push({gcre:"cat",k:1});for(let i=0;i<5;i++)actors.push({gcre:"dfly",k:1});for(let i=0;i<6;i++)actors.push({gcre:"stag",k:1});actors.push({gcre:"bird"});
const mushroomModel={count:3,pos:new Float32Array(9),nrm:new Float32Array(9),col:new Float32Array(9)};
const world={actors,nMain:N,lapLen:25000,rx,rz,tx,tz,meshH:()=>0,
  verdant:{widthAt:()=>3.35},_dbg:{roadNear:()=>({i:0,d:100})},
  __verdantV121:{buildings:4},
  props:{pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)},
  instNature:{ready:true,routeKm:25,models:{mushroom:mushroomModel},groups:{sentinel:{kind:"trees",range:1,instances:[0,1,0,1,0,1]}},stats:{mushrooms:0,total:1}}};
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const ctx={console,Math,Float32Array,Uint32Array,MeshB,GLTREES,GLCRE,ROUTE_STEP:10,mulberry32,hx:()=>[.2,.2,.2],globalThis:null,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const out=ctx.buildWorld({id:"verdant",seed:9157});
const t=out.__verdantExpansionV140;if(!t)throw new Error("v140 telemetry missing");
if(t.base.cats!==4||t.target.cats!==40||t.final.cats!==40)throw new Error("cat x10 failed: "+JSON.stringify(t));
if(t.added.giantCats!==20)throw new Error("expected 20 giant cats / half final population, got "+t.added.giantCats);
if(t.base.dragonflies!==5||t.target.dragonflies!==50||t.final.dragonflies!==50)throw new Error("dragonfly x10 failed");
if(t.base.stags!==6||t.target.stags!==18||t.final.stags!==18)throw new Error("stag x3 failed");
if(t.base.buildings!==4||t.target.buildings!==20||t.final.buildings!==20)throw new Error("building x5 failed: "+JSON.stringify(t.buildings));
if(t.buildings.pairedRoadSites<1)throw new Error("no paired roadside building sites created");
if(t.mushrooms.giants!==240||t.mushrooms.small!==2400)throw new Error("mushroom targets not reached");
if(out.instNature.groups.mushroomGiantV140.instances.length/6!==240)throw new Error("giant mushroom group mismatch");
if(out.instNature.groups.mushroomPatchV140.instances.length/6!==2400)throw new Error("small mushroom group mismatch");
if(out.instNature.models.mushroomGiantV140!==mushroomModel)throw new Error("giant mushrooms must reuse existing GPU model");
if(out.instNature.groups.sentinel.instances.length!==6)throw new Error("v140 mutated an existing nature group");
console.log("ok: v140 exact wildlife multipliers, 50% giant final cat population, x5 buildings with road pairs, and mushroom groves");
