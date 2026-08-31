"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/65-aqua-sand-ab-v159.js');
for(const m of ['VERSION=159','uploadedCreaturesRemoved:true','sandABExperiment:true',
  "Aerial Beach 01","Sand 03","shoulderGlassGap:[.35,19.5]",
  'aerial_beach_01_diff_1k.jpg','sand_03_diff_1k.jpg'])
  if(!src.includes(m))throw new Error('missing v159 marker '+m);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};}
  quad(a,b,c,d,col,em){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);}
  tri(a,b,c,col,em){const base=this.pos.length/3;for(const v of [a,b,c]){this.pos.push(...v);this.nrm.push(0,1,0);this.col.push(col[0],col[1],col[2],em||0);this.limb.push(0);}this.idx.push(base,base+1,base+2);}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
function makeWorld(){
  const n=1793,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*1100;rz[i]=Math.cos(a)*1100;ry[i]=0;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[];for(let i=0;i<36;i++)actors.push({aquaCreatureV156:true});for(let i=0;i<60;i++)actors.push({aquaJellyV152:true});for(let i=0;i<12;i++)actors.push({aquaFish:true});
  return {nMain:n,lapLen:n*4,rx,rz,ry,tx,tz,groundAt:()=>-2,actors,__aquaV158:{version:158}};
}
const glStub={TEXTURE0:0,TEXTURE_2D:1,activeTexture(){},bindTexture(){},uniform1i(){},deleteBuffer(){}};
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,ROUTE_STEP:4,Image:function(){},TEX:{},gl:glStub,U:{uTexAA:1,uTexAN:2},US:{},CU:{},gpu:{},
  conditionTile(){return{};},glTexFromCanvas(){return{};},glTexFromData(){return{};},
  initGL:()=>{},uploadWorld:()=>{},uploadMesh:m=>m,drawMesh:()=>{},buildWorld:()=>makeWorld()};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const verdant=ctx.buildWorld({id:'verdant',seed:1},()=>{});if(verdant.__aquaV159)throw new Error('non-Aqua touched');
const w=ctx.buildWorld({id:'aqua',seed:14373},()=>{}),T=w.__aquaV159;
if(!T||T.version!==159||!T.sandShoulders||!T.sandABExperiment)throw new Error('v159 telemetry missing');
if(w.actors.some(a=>a.aquaCreatureV156))throw new Error('uploaded creatures remain');
if(w.actors.length!==72)throw new Error('preserved actor count wrong '+w.actors.length);
if(!w.sandA?.idx?.length||!w.sandB?.idx?.length)throw new Error('sand meshes missing');
if(T.sandAQuads<1000||T.sandBQuads<1000)throw new Error('sand A/B coverage too small');
if(T.segments.length!==4||T.segments[0].key!=='A'||T.segments[1].key!=='B'||T.segments[2].key!=='A'||T.segments[3].key!=='B')throw new Error('A/B segment schedule wrong');
console.log('ok: Aqua v159 removes uploaded creature actors and builds alternating Aerial Beach 01 / Sand 03 textured shoulder meshes along the full lap');
