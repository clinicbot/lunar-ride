"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/57-aqua-coral-jelly-v151.js','utf8');
for(const m of ['VERSION=151','REEF_STATIONS=176','CORALS_PER_SIDE=4','JELLY_COUNT=52','reefExtension:true','jellyOutsideGlass:true','aquaJelly:true'])
  if(!src.includes(m))throw new Error('missing v151 marker '+m);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];}
  _v(n){const b=this.pos.length/3;for(let i=0;i<n;i++){this.pos.push(i*.01,0,0);this.nrm.push(0,1,0);this.col.push(.2,.6,.7,0);this.limb.push(0);}for(let i=2;i<n;i++)this.idx.push(b,b+i-1,b+i);}
  sph(){this._v(12);}cyl(){this._v(10);}quad(){this._v(4);}box(){this._v(8);}setTF(){}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const hx=()=>[.2,.6,.7];
let baseUpdates=0,baseBuilds=0;
function makeWorld(){
  const n=240,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*520;rz[i]=Math.cos(a)*520;ry[i]=3+Math.sin(a*2)*4;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,
    groundAt:(x,z)=>-10+.2*Math.sin(x*.01)+.2*Math.sin(z*.01),
    props:{pos:new Float32Array([0,0,0]),nrm:new Float32Array([0,1,0]),col:new Float32Array([.1,.2,.3,0]),idx:new Uint32Array([0]),limb:new Float32Array([0])},
    actorMeshes:{jellyAqua:{ready:true}},actors:[{aquaFish:true,type:'drone',k:1}]};
}
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,hx,ROUTE_STEP:4,
  buildWorld:()=>{baseBuilds++;return makeWorld();},updateActors:()=>{baseUpdates++;},world:null,state:null};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const other=ctx.buildWorld({id:'verdant',seed:1},()=>{});
if(other.__aquaV151||other.actors.length!==1)throw new Error('non-Aqua world modified');
const w=ctx.buildWorld({id:'aqua',seed:14373},()=>{}),T=w.__aquaV151;
if(!T||T.version!==151||!T.reefExtension||!T.bilateral)throw new Error('v151 telemetry missing');
if(T.coralPlacements!==176*2*4)throw new Error('wrong coral placement count '+T.coralPlacements);
if(T.coralHeads<T.coralPlacements*2)throw new Error('coral geometry too sparse '+T.coralHeads);
const jelly=w.actors.filter(a=>a.aquaJelly===true);
if(jelly.length!==52||T.jellyfish!==52)throw new Error('wrong jellyfish count '+jelly.length);
if(jelly.some(a=>a.mesh!=='jellyAqua'||a.__aquaV151RoadOffset<a.__aquaV151GlassRadius+8.99))throw new Error('jellyfish entered glass envelope');
const bands=new Set(jelly.map(a=>a.__aquaV151HeightBand));if(bands.size!==5)throw new Error('jelly height bands incomplete');
if(w.actors.filter(a=>a.aquaFish===true).length!==1)throw new Error('existing fish were disturbed');
if(w.props.pos.length<=1)throw new Error('reef extension did not merge into props');
ctx.world=w;ctx.state={scene:{id:'aqua'}};const before=jelly[0].k;ctx.updateActors(.35);
if(baseUpdates!==1)throw new Error('base update path was not preserved');
if(jelly[0].k===before||T.jellyPulseActive!==52)throw new Error('jelly pulse update inactive');
console.log('ok: Aqua v151 adds 1408 bilateral near/mid/far coral placements and restores 52 outside-glass drifting jellyfish with subtle pulse while preserving fish and non-Aqua worlds');
