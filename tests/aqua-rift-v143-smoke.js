"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/49-aqua-rift-v143.js');
for(const m of ["id:AQUA_ID","customWorld:AQUA_ID","GLASS_R=8.8","FISH_COUNT=96","GIANT_FISH_COUNT=12","JELLY_COUNT=24","Aqua Rift v143 ready"])
  if(!src.includes(m))throw new Error('missing Aqua v143 marker '+m);

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hx(c){const n=parseInt(c.slice(1),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x:x||0,y:y||0,z:z||0,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};}
  P(x,y,z){const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;return[t.x+X*t.c+Z*t.s,t.y+Y,t.z-X*t.s+Z*t.c];}
  tri(a,b,c,col,em){for(const v of [a,b,c]){this.idx.push(this.pos.length/3);this.pos.push(v[0],v[1],v[2]);this.nrm.push(0,1,0);this.col.push(col[0],col[1],col[2],em||0);this.limb.push(0);}}
  quad(a,b,c,d,col,em){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);}
  box(x,y,z,w,h,d,col,em){const p=this.P(x,y,z);this.quad(p,p,p,p,col,em);}
  cyl(x,y,z,r,h,seg,col,em){for(let i=0;i<Math.max(1,seg);i++){const p=this.P(x,y,z);this.tri(p,p,p,col,em);}}
  sph(x,y,z,r,seg,rings,col,em){for(let i=0;i<Math.max(1,seg*rings);i++){const p=this.P(x,y,z);this.tri(p,p,p,col,em);}}
}
const ROUTE_STEP=4,N=420,R=250,rx=new Float32Array(N),rz=new Float32Array(N),ry=new Float32Array(N),tx=new Float32Array(N),tz=new Float32Array(N),grade=new Float32Array(N);
for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;rx[i]=Math.cos(a)*R;rz[i]=Math.sin(a)*R;tx[i]=Math.cos(b)*R-rx[i];tz[i]=Math.sin(b)*R-rz[i];const l=Math.hypot(tx[i],tz[i])||1;tx[i]/=l;tz[i]/=l;}
const world={nMain:N,nPts:N,lapLen:N*ROUTE_STEP,rx,rz,ry,tx,tz,grade,meanY:0,groundAt:()=>0,meshH:()=>0,
  actors:[],actorMeshes:{},props:{pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)}};
const ctx={console,Math,Float32Array,Uint32Array,SCENES:[],ROUTE_STEP,MeshB,hx,mulberry32,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
if(ctx.SCENES.length!==1||ctx.SCENES[0].id!=='aqua')throw new Error('Aqua scene was not registered');
const out=ctx.buildWorld(ctx.SCENES[0]);
if(!out.glass||out.glass.idx.length===0)throw new Error('glass tunnel missing');
if(!out.water||out.water.idx.length===0||!(out.waterY>0))throw new Error('overhead water surface missing');
if(!out.props||out.props.idx.length===0)throw new Error('reef props missing');
const t=out.__aquaRiftV143;if(!t)throw new Error('Aqua telemetry missing');
if(t.fish!==96||t.giantFish!==12||t.jellyfish!==24||t.coral!==220||t.kelp!==140)throw new Error('Aqua population telemetry wrong '+JSON.stringify(t));
if(out.actors.length!==132)throw new Error('expected 132 animated sea creatures, got '+out.actors.length);
for(const k of ['fishBlue','fishGold','fishViolet','fishCoral','jellyAqua'])if(!out.actorMeshes[k])throw new Error('missing creature mesh '+k);
if(!out.actors.every(a=>a.type==='drone'))throw new Error('Aqua swimmers must use the existing orbiting actor path');
console.log('ok: Aqua Rift v143 registers a separate underwater world with glass tunnel, reef, overhead water and 132 animated sea creatures');
