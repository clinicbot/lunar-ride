"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/50-aqua-real-fish-v144.js');
for(const m of ["VERSION=144","SCHOOL_COUNT=30","FISH_PER_SCHOOL=8","HERO_FISH=18","EXTRA_CORAL=420","EXTRA_KELP=180","source:'Quaternius CC0'"])
  if(!src.includes(m))throw new Error('missing Aqua v144 marker '+m);
const files=['clownfish','fish-a','fish-b','fish-c','shark','anglerfish','puffer','lionfish','butterfly-fish','swordfish','black-lionfish'];
for(const n of files)if(!src.includes(n+'.gltf'))throw new Error('fish asset not wired '+n);

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hx(c){const n=parseInt(c.slice(1),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x:x||0,y:y||0,z:z||0,k:k===undefined?1:k};}
  p(x,y,z){return[this.tf.x+x*this.tf.k,this.tf.y+y*this.tf.k,this.tf.z+z*this.tf.k];}
  tri(a,b,c,col,em){for(const v of [a,b,c]){this.idx.push(this.pos.length/3);this.pos.push(...v);this.nrm.push(0,1,0);this.col.push(col[0],col[1],col[2],em||0);}}
  cyl(x,y,z,r,h,seg,col,em){for(let i=0;i<Math.max(1,seg);i++){const p=this.p(x,y,z);this.tri(p,p,p,col,em);}}
  sph(x,y,z,r,seg,rings,col,em){for(let i=0;i<Math.max(1,seg*rings);i++){const p=this.p(x,y,z);this.tri(p,p,p,col,em);}}
}
const N=300,rx=new Float32Array(N),rz=new Float32Array(N),ry=new Float32Array(N),tx=new Float32Array(N),tz=new Float32Array(N);
for(let i=0;i<N;i++){const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;rx[i]=Math.cos(a)*260;rz[i]=Math.sin(a)*260;tx[i]=Math.cos(b)*260-rx[i];tz[i]=Math.sin(b)*260-rz[i];const l=Math.hypot(tx[i],tz[i])||1;tx[i]/=l;tz[i]/=l;}
const actors=[
  {type:'cat',mesh:'cat'},{type:'stag',mesh:'stag'},{type:'bird',mesh:'bird'},
  {type:'drone',mesh:'fishBlue'},{type:'drone',mesh:'jellyAqua'},
  {type:'drone',mesh:'drone',sentinel:true},{type:'astro',mesh:'astro',sentinel:true}
];
const world={nMain:N,lapLen:N*4,rx,rz,ry,tx,tz,groundAt:()=>0,actors,actorMeshes:{fishBlue:{},jellyAqua:{},drone:{}},
  props:{pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)},
  __aquaRiftV143:{coral:220,kelp:140}};
const loaded=[];
const ctx={console,Math,Float32Array,Uint32Array,Object,Set,MeshB,hx,mulberry32,
  initGL:()=>{loaded.push('base');},loadGLTFCreature:(k,f)=>loaded.push(k+'='+f),buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
ctx.initGL();
if(loaded.length!==12)throw new Error('expected base init + 11 real fish loads, got '+loaded.length);
for(const n of files)if(!loaded.some(x=>x.endsWith('/'+n+'.gltf')))throw new Error('loader missed '+n);
const out=ctx.buildWorld({id:'aqua',seed:14373});
const t=out.__aquaFishV144;if(!t)throw new Error('v144 telemetry missing');
if(t.realFish!==258||t.schools!==30||t.heroFish!==18)throw new Error('wrong fish population '+JSON.stringify(t));
if(t.estimatedCoralTotal!==640||t.estimatedKelpTotal!==320)throw new Error('reef density wrong '+JSON.stringify(t));
for(const bad of ['cat','stag','bird'])if(out.actors.some(a=>a.type===bad))throw new Error('terrestrial fauna remains '+bad);
if(out.actors.some(a=>['fishBlue','fishGold','fishViolet','fishCoral','jellyAqua'].includes(a.mesh)))throw new Error('v143 procedural swimmer remains');
if(!out.actors.some(a=>a.sentinel&&a.type==='drone')||!out.actors.some(a=>a.sentinel&&a.type==='astro'))throw new Error('non-fauna actor was removed');
const real=out.actors.filter(a=>a.aquaFish);
if(real.length!==258||!real.every(a=>a.type==='drone'&&a.gcre&&a.mesh==='drone'))throw new Error('real fish actor wiring wrong');
if(new Set(real.map(a=>a.gcre)).size!==11)throw new Error('not all 11 fish models are represented');
if(out.actorMeshes.fishBlue||out.actorMeshes.jellyAqua)throw new Error('unused v143 procedural meshes remain');
if(!out.props.idx.length)throw new Error('extra coral/kelp geometry missing');
if(t.removedActors!==5)throw new Error('expected five replaced fauna actors, got '+t.removedActors);
console.log('ok: Aqua v144 removes terrestrial/procedural fauna, uses all 11 Quaternius CC0 fish models for 258 swimmers, and grows reef to ~640 coral / 320 kelp');
