"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/58-aqua-proper-jelly-reef-v152.js');
for(const m of ['VERSION=152','REEF_STATIONS=350','GROUPS_PER_SIDE=4','JELLY_COUNT=60',
  "jellyAsset:'assets/models/creature_jelly.gltf'","gcre:'jelly'","type:'gjelly'",
  'properProjectJelly:true','reefWallVisible:true','jellyOutsideGlass:true'])
  if(!src.includes(m))throw new Error('missing v152 marker '+m);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.tf={};}
  setTF(x,y,z,yaw,k){this.tf={x,y,z,yaw,k};}
  _v(n){const b=this.pos.length/3;for(let i=0;i<n;i++){this.pos.push(i*.01,0,0);this.nrm.push(0,1,0);this.col.push(.2,.6,.7,0);this.limb.push(0);}for(let i=2;i<n;i++)this.idx.push(b,b+i-1,b+i);}
  sph(){this._v(10);}cyl(){this._v(8);}quad(){this._v(4);}box(){this._v(8);}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const hx=()=>[.2,.6,.7];
const jellyMeta={headY:0,headZ:0,gait:0,turn:0,rest:0,eye:.6,float:2,hip:0,sh:0};
let baseUpdates=0,baseBuilds=0;
function makeWorld(){
  const n=280,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*560;rz[i]=Math.cos(a)*560;ry[i]=4+Math.sin(a*2)*3;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,
    groundAt:(x,z)=>-8+.15*Math.sin(x*.01)+.15*Math.cos(z*.01),
    props:{pos:new Float32Array([0,0,0]),nrm:new Float32Array([0,1,0]),col:new Float32Array([.1,.2,.3,0]),idx:new Uint32Array([0]),limb:new Float32Array([0])},
    actors:[
      {aquaFish:true,type:'drone',id:'fish1',k:1},{aquaFish:true,type:'drone',id:'fish2',k:1},
      {aquaJelly:true,type:'drone',mesh:'jellyAqua',id:'oldJ1'},{aquaJelly:true,type:'drone',mesh:'jellyAqua',id:'oldJ2'}
    ]};
}
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,hx,ROUTE_STEP:4,
  CREATURE:{gjelly:jellyMeta},buildWorld:()=>{baseBuilds++;return makeWorld();},
  updateActors:()=>{baseUpdates++;},world:null,state:null};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);

const other=ctx.buildWorld({id:'verdant',seed:1},()=>{});
if(other.__aquaV152||other.actors.length!==4)throw new Error('non-Aqua world modified');
const w=ctx.buildWorld({id:'aqua',seed:14373},()=>{}),T=w.__aquaV152;
if(!T||T.version!==152||!T.reefWallVisible||T.coralGroups!==2800)throw new Error('v152 reef telemetry wrong');
if(T.nearGroups!==700||T.midGroups!==1400||T.farGroups!==700)throw new Error('reef depth counts wrong '+JSON.stringify([T.nearGroups,T.midGroups,T.farGroups]));
if(T.richGroups!==560||T.breathingGroups!==280)throw new Error('density rhythm counts wrong');
if(T.coralHeads<T.coralGroups*2)throw new Error('reef geometry too sparse '+T.coralHeads);
if(!w.props||w.props.pos.length<100000)throw new Error('v152 visible reef was not rebuilt as a substantial mesh');
if(w.actors.some(a=>a&&a.aquaJelly===true))throw new Error('v151 procedural jelly survived v152');
if(T.oldV151JellyRemoved!==2)throw new Error('wrong old jelly removal count '+T.oldV151JellyRemoved);
const jelly=w.actors.filter(a=>a&&a.aquaJellyV152===true);
if(jelly.length!==60||T.jellyfish!==60)throw new Error('wrong project jelly count '+jelly.length);
if(jelly.some(a=>a.type!=='gjelly'||a.gcre!=='jelly'||a.meta!==jellyMeta))throw new Error('v152 is not using shared project jelly creature path');
if(jelly.some(a=>a.__aquaJellyV152RoadOffset-a.__aquaJellyV152GlassRadius<2.19))throw new Error('project jelly entered the glass envelope');
const db=[0,0,0],hb=new Set();for(const a of jelly){db[a.__aquaJellyV152DistanceBand]++;hb.add(a.__aquaJellyV152HeightBand);}
if(db.join(',')!=='12,30,18')throw new Error('jelly depth distribution wrong '+db);
if(hb.size!==4)throw new Error('jelly height distribution incomplete');
if(w.actors.filter(a=>a&&a.aquaFish===true).length!==2||T.fishPreserved!==2)throw new Error('fish disturbed by v152');
if(T.jellyAsset!=='assets/models/creature_jelly.gltf'||T.jellyGcre!=='jelly')throw new Error('wrong jelly asset telemetry');
ctx.world=w;ctx.state={scene:{id:'aqua'},elapsed:1.25};const before=jelly[0].k;ctx.updateActors(.25);
if(baseUpdates!==1)throw new Error('base actor update path not preserved');
if(jelly[0].k===before||T.jellyPulseActive!==60)throw new Error('v152 jelly pulse inactive');
console.log('ok: Aqua v152 rebuilds 2800 close/mid/far visible reef groups and replaces procedural Aqua jellies with 60 shared creature_jelly.gltf GLCRE actors while preserving fish and non-Aqua worlds');
