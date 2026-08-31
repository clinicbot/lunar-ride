"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/61-aqua-coral-colonies-v155.js','utf8');
for(const m of ['VERSION=155','REEF_STATIONS=350','GROUPS_PER_SIDE=4',
  'reefColonies:true','organicReefMounds:true','closeColonyContinuity:true',
  'heroCoralColonies:true','podiumBasesRemoved:true','hqCoral:true',
  "coralTypes:['branching','fan','brain','plate','sponge','soft']"])
  if(!src.includes(m))throw new Error('missing v155 marker '+m);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};}
  P(x,y,z){const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;return [t.x+X*t.c+Z*t.s,t.y+Y,t.z-X*t.s+Z*t.c];}
  tri(a,b,c,col,em){const base=this.pos.length/3;for(const v of [a,b,c]){this.pos.push(v[0],v[1],v[2]);this.nrm.push(0,1,0);this.col.push(col?.[0]||.2,col?.[1]||.6,col?.[2]||.7,em||0);this.limb.push(0);}this.idx.push(base,base+1,base+2);}
  quad(a,b,c,d,col,em){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);}
  _poly(n,col,em){const cc=this.P(0,0,0);for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;this.tri(cc,this.P(Math.cos(a),.1,Math.sin(a)),this.P(Math.cos(b),.1,Math.sin(b)),col||[.2,.6,.7],em||0);}}
  sph(x,y,z,r,seg,rings,col,em){this._poly(Math.max(4,Math.min(12,seg||6)),col,em);}
  box(x,y,z,w,h,d,col,em){this._poly(6,col,em);}
  disc(x,y,z,r,seg,col,em){this._poly(Math.max(4,Math.min(12,seg||6)),col,em);}
  cyl(x,y,z,r,h,seg,col,em){this._poly(Math.max(4,Math.min(12,seg||6)),col,em);}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const hx=s=>{const n=parseInt(s.slice(1),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];};
function makeWorld(){
  const n=280,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*560;rz[i]=Math.cos(a)*560;ry[i]=4+Math.sin(a*2)*3;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[{aquaFish:true,id:'f1'},{aquaFish:true,id:'f2'}];
  for(let i=0;i<60;i++)actors.push({aquaJellyV152:true,type:'gjelly',gcre:'jelly',id:'j'+i});
  actors.push({type:'drone',id:'other'});
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,groundAt:(x,z)=>-8+.1*Math.sin(x*.01),props:{sentinel:true,pos:new Float32Array([0,0,0])},actors,__aquaV154:{version:154}};
}
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,hx,ROUTE_STEP:4,buildWorld:()=>makeWorld()};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);

const verdant=ctx.buildWorld({id:'verdant',seed:1},()=>{});
if(verdant.__aquaV155||!verdant.props.sentinel)throw new Error('non-Aqua world modified');
const w=ctx.buildWorld({id:'aqua',seed:14373},()=>{}),T=w.__aquaV155;
if(!T||T.version!==155||!T.reefColonies||!T.organicReefMounds||!T.closeColonyContinuity||!T.heroCoralColonies||!T.podiumBasesRemoved)throw new Error('v155 telemetry missing');
if(T.coralGroups!==2800||T.nearGroups!==700||T.midGroups!==1400||T.farGroups!==700)throw new Error('reef placement budget changed');
if(T.heroGroups!==280||T.heroTarget!==280||T.primaryHeroes!==140||T.secondaryHeroes!==140||T.heroColonyGroups!==280)throw new Error('hero colony plan wrong');
if(T.heroGroups+T.mediumGroups+T.simpleGroups!==2800)throw new Error('LOD counts do not total reef budget');
if(T.moundGroups!==2800)throw new Error('mound coverage incomplete');
if(T.accentGroups<800)throw new Error('not enough local accent density');
if(Object.keys(T.typeCounts).length!==6||Object.values(T.typeCounts).some(v=>v<100))throw new Error('coral type mix incomplete');
if(!T.proceduralSphereClustersReplaced||T.triangles<220000)throw new Error('colony geometry too weak '+T.triangles);
if(!w.props||w.props.sentinel||w.props.pos.length<600000)throw new Error('props reef was not rebuilt strongly enough');
if(T.fishPreserved!==2||T.jellyPreserved!==60||!T.properProjectJellyPreserved||w.actors.length!==63)throw new Error('Aqua actors disturbed');
if(!T.roadUnchanged||!T.glassUnchanged||!T.verdantUntouched||!T.actorsUnchanged)throw new Error('isolation telemetry failed');
console.log('ok: Aqua v155 keeps the 2800-group reef budget while replacing podium bases with organic reef colonies and preserving jellyfish, fish and non-Aqua worlds');
