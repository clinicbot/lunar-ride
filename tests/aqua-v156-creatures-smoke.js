"use strict";
const fs=require('fs'),vm=require('vm');
const main=require('./_section')('js/62-aqua-creatures-v156.js');
for(const m of ['VERSION=156','reefBaseBoxesRemoved:true','reefBaseCylindersRemoved:true','uploadedUserModels:true','customCreatureCount:36','aqSiren156','aqCrawler156','aqEel156','aqLeviathan156'])
  if(!main.includes(m))throw new Error('missing v156 marker '+m);
const dataFiles=['62a-aqua-v156-model-siren.js','62b-aqua-v156-model-crawler.js','62c-aqua-v156-model-eelbeast.js','62d-aqua-v156-model-leviathan.js'];
for(const f of dataFiles){
  const s=require('./_section')('js/'+f),m=s.match(/='([A-Za-z0-9+/=]+)'/);
  if(!m||m[1].length<1000)throw new Error('bad payload '+f);
}
class MeshB{
  constructor(){this.boxCalls=[];}
  box(x,y,z,w,h,d){this.boxCalls.push({w,h,d});return 1;}
}
function makeWorld(){
  const n=280,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*560;rz[i]=Math.cos(a)*560;ry[i]=4;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[{aquaFish:true},{aquaFish:true}];for(let i=0;i<60;i++)actors.push({aquaJellyV152:true});actors.push({type:'other'});
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,groundAt:()=>-8,actors,__aquaV155:{coralGroups:2800,nearGroups:700,midGroups:1400,farGroups:700,heroGroups:280,primaryHeroes:140,secondaryHeroes:140,moundGroups:2800,accentGroups:840}};
}
let lastMesh=null;
function oldBuild(sc){
  const w=makeWorld();
  if(sc&&sc.id==='aqua'){
    lastMesh=new MeshB();
    function moundBase(){lastMesh.box(0,.04,.74,1.95,.11,.46);lastMesh.box(-.72,.02,-.16,.98,.09,.54);}
    function tunnelRail(){lastMesh.box(0,0,0,.20,.35,2.6);}
    moundBase();tunnelRail();
  }
  return w;
}
const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,createBuffer:()=>({}),bindBuffer:()=>{},bufferData:()=>{}};
const ctx={console,Math,Float32Array,Uint32Array,Uint16Array,Uint8Array,ArrayBuffer,MeshB,ROUTE_STEP:4,GLCRE:{},gl,
  atob:s=>Buffer.from(s,'base64').toString('binary'),mulberry32:a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;},
  initGL:()=>true,buildWorld:oldBuild};
ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of dataFiles)vm.runInContext(require('./_section')('js/'+f),ctx);
vm.runInContext(main,ctx);
ctx.initGL();
for(const k of ['aqSiren156','aqCrawler156','aqEel156','aqLeviathan156'])if(!ctx.GLCRE[k]?.ready||!ctx.GLCRE[k].count)throw new Error('model registration failed '+k);
const v=ctx.buildWorld({id:'verdant',seed:1});if(v.__aquaV156)throw new Error('Verdant modified');
const w=ctx.buildWorld({id:'aqua',seed:14373}),T=w.__aquaV156;
if(lastMesh.boxCalls.length!==1||lastMesh.boxCalls[0].h!==.35)throw new Error('podium filter did not isolate only moundBase boxes '+JSON.stringify(lastMesh.boxCalls));
if(T.platformBoxesSuppressed!==2||!T.reefBaseBoxesRemoved||!T.reefBaseCylindersRemoved)throw new Error('podium telemetry wrong');
if(T.customCreatureCount!==36||T.creatureCounts.siren!==10||T.creatureCounts.crawler!==8||T.creatureCounts.eelbeast!==16||T.creatureCounts.leviathan!==2)throw new Error('creature counts wrong');
if(w.actors.filter(a=>a.aquaCreatureV156).length!==36||w.actors.length!==99)throw new Error('actors not added');
if(T.coralGroups!==2800||T.heroGroups!==280||T.moundGroups!==2800||T.accentGroups!==840)throw new Error('v155 reef budget not preserved');
if(T.jellyPreserved!==60||T.fishPreserved!==2||!T.properProjectJellyPreserved||!T.verdantUntouched)throw new Error('preservation failed');
console.log('ok: Aqua v156 removes v155 moundBase platform boxes only, registers four uploaded creature meshes, adds 36 water creatures and preserves the approved reef/fish/jelly/Verdant state');
