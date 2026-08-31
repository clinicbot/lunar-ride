"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/63-aqua-visible-creatures-v157.js','utf8');
for(const m of ['VERSION=157','hardFlatBaseSuppression:true','creaturesMovedNearGlass:true',
  'smallCreatureGlassGap:[2.2,7.5]','leviathanGlassGap:[8,15]',
  'firstEncountersKm:[.15,.30,.45,.55]','leviathanKm:[1.65,5.70]'])
  if(!src.includes(m))throw new Error('missing v157 marker '+m);

class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
  setTF(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};}
  box(x,y,z,w,h,d){this.idx.push(1,2,3,1,3,4);}
}
MeshB.prototype.__aquaV156NoPodiums=true;
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
function makeWorld(){
  const n=1793,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*1120;rz[i]=Math.cos(a)*1120;ry[i]=Math.sin(a*2)*3;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[];
  for(let i=0;i<60;i++)actors.push({aquaJellyV152:true});
  for(let i=0;i<258;i++)actors.push({aquaFish:true});
  const add=(kind,n2)=>{for(let i=0;i<n2;i++)actors.push({type:'drone',aquaCreatureV156:true,creatureClass:kind,cx:0,cz:0,gy:0,r:99,alt:99,ph:0,w:0,k:1,px:0,py:0,pz:0});};
  add('siren',10);add('crawler',8);add('eelbeast',16);add('leviathan',2);
  return {nMain:n,lapLen:n*4,rx,rz,ry,tx,tz,actors,__aquaV156:{coralGroups:2800,jellyPreserved:60,fishPreserved:258}};
}
let platformCalls=0,railCalls=0;
const oldBuild=(sc)=>{
  const w=makeWorld(),m=new MeshB();
  if(sc.id==='aqua'){
    m.box(0,0,0,1.95,.11,.46);platformCalls++;
    m.box(0,0,0,.20,.35,2.6);railCalls++;
  }
  return w;
};
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,ROUTE_STEP:4,buildWorld:oldBuild};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const v=ctx.buildWorld({id:'verdant',seed:1},()=>{});
if(v.__aquaV157)throw new Error('non-Aqua world modified');
const w=ctx.buildWorld({id:'aqua',seed:14373},()=>{}),T=w.__aquaV157;
if(!T||T.version!==157||!T.hardFlatBaseSuppression||!T.creaturesMovedNearGlass)throw new Error('v157 telemetry missing');
if(T.visibleCreatureCount!==36)throw new Error('expected 36 visible creatures');
if(T.creatureCounts.siren!==10||T.creatureCounts.crawler!==8||T.creatureCounts.eelbeast!==16||T.creatureCounts.leviathan!==2)throw new Error('creature counts changed');
if(T.flatBoxesSuppressed<1)throw new Error('flat podium box was not suppressed');
if(T.jellyPreserved!==60||T.fishPreserved!==258||!T.roadUnchanged||!T.glassUnchanged||!T.verdantUntouched)throw new Error('preserved systems changed');
const cr=w.actors.filter(a=>a.aquaVisibleCreatureV157);
if(cr.length!==36)throw new Error('not all uploaded creatures repositioned');
for(const a of cr){
  const g=a.glassGapV157;
  if(a.creatureClass==='leviathan'){if(g<8||g>15)throw new Error('leviathan gap out of range '+g);}
  else if(g<2.2||g>7.5)throw new Error('small creature gap out of visible range '+g);
  if(Math.abs(a.py-a.gy)>8.0)throw new Error('creature height too far from road');
}
const first=cr.map(a=>a.anchorKmV157).sort((a,b)=>a-b).slice(0,4);
if(first[0]>.16||first[1]>.31||first[2]>.46||first[3]>.56)throw new Error('early encounters missing '+first.join(','));
const lev=cr.filter(a=>a.creatureClass==='leviathan').map(a=>a.anchorKmV157).sort((a,b)=>a-b);
if(Math.abs(lev[0]-1.65)>.01||Math.abs(lev[1]-5.70)>.01)throw new Error('leviathan anchors wrong '+lev.join(','));
console.log('ok: Aqua v157 hard-removes flat reef podium boxes and moves all 36 uploaded creatures close enough to the glass to be obvious during riding');
