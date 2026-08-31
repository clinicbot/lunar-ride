"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/66-aqua-rocky-upperfish-v160.js');
for(const marker of ['VERSION=160','rockyShoulders:true','sand03Retired:true','UPPER_SCHOOLS=12','FISH_PER_UPPER_SCHOOL=5','Rocks Ground 04','aquaUpperFishV160:true']){
  if(!src.includes(marker))throw new Error('missing marker '+marker);
}
class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};}
  P(x,y,z){const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;return[t.x+X*t.c+Z*t.s,t.y+Y,t.z-X*t.s+Z*t.c];}
  tri(a,b,c,col,em){const base=this.pos.length/3;for(const v of [a,b,c]){this.pos.push(...v);this.nrm.push(0,1,0);this.col.push(col?.[0]||.7,col?.[1]||.7,col?.[2]||.7,em||0);this.limb.push(0);}this.idx.push(base,base+1,base+2);}
  quad(a,b,c,d,col,em){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);}
  sph(x,y,z,r,seg,rings,col,em){const center=this.P(x,y,z),n=Math.max(4,seg||6);for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;this.tri(center,this.P(x+Math.cos(a)*r,y+.1*r,z+Math.sin(a)*r),this.P(x+Math.cos(b)*r,y+.1*r,z+Math.sin(b)*r),col,em);}}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
function makeWorld(){
  const n=360,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*280;rz[i]=Math.cos(a)*280;ry[i]=2+Math.sin(a*2);tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[];for(let i=0;i<258;i++)actors.push({type:'drone',gcre:'aqFish'+(i%4),mesh:'drone',aquaFish:true,cx:0,cz:0,gy:5,alt:0,ph:i*.1,k:.8,emiss:.72});
  for(let i=0;i<60;i++)actors.push({aquaJellyV152:true,type:'gjelly'});
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,groundAt:(x,z)=>-6+.1*Math.sin(x*.02),actors,
    sandA:{old:true},sandB:{old:true},__aquaV159:{version:159,uploadedCreaturesRemoved:true}};
}
const gpu={road:{road:true},sandA:{},sandB:{}},TEX={sandABReady:true};
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,ROUTE_STEP:4,TEX,gpu,
  initGL:()=>{},buildWorld:(sc)=>makeWorld(),drawMesh:(m)=>m,world:null,Image:function(){},conditionTile:()=>{},glTexFromCanvas:()=>{},glTexFromData:()=>{}};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const verdant=ctx.buildWorld({id:'verdant',seed:1});if(verdant.__aquaV160)throw new Error('Verdant modified');
const w=ctx.buildWorld({id:'aqua',seed:14373}),T=w.__aquaV160;
if(!T||T.version!==160||!T.rockyShoulders||!T.sand03Retired)throw new Error('v160 telemetry missing');
if(T.upperTunnelFish!==60||T.upperTunnelSchools!==12)throw new Error('upper fish counts wrong '+JSON.stringify(T));
if(w.actors.filter(a=>a.aquaUpperFishV160).length!==60)throw new Error('upper fish actor count wrong');
if(w.actors.filter(a=>a.aquaJellyV152).length!==60)throw new Error('jellies changed');
if(w.actors.filter(a=>a.aquaFish).length!==318)throw new Error('existing fish not preserved plus upper fish');
if(!w.sandA||w.sandA.pos.length<25000||!w.sandA.idx.length)throw new Error('rocky shoulder mesh weak');
if(w.sandB!==null)throw new Error('old B segment not retired');
if(T.rubblePieces<100)throw new Error('not enough rubble '+T.rubblePieces);
const upper=w.actors.filter(a=>a.aquaUpperFishV160);if(upper.some(a=>a.py<=0))throw new Error('upper fish not elevated');
if(!T.uploadedCreaturesRemainRemoved||!T.roadUnchanged||!T.glassUnchanged||!T.waterUnchanged||!T.verdantUntouched)throw new Error('preservation telemetry failed');
console.log('ok: Aqua v160 replaces A/B sand with full-lap rocky shoulders and adds 60 fish in 12 schools above the glass tunnel while preserving existing fish/jellies and Verdant isolation');
