'use strict';
const fs=require('fs'),vm=require('vm');

global.ROUTE_STEP=4;
global.mulberry32=a=>function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
global.hx=c=>{const n=parseInt(c.slice(1),16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];};

function MeshB(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
MeshB.prototype.setTF=function(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};};
MeshB.prototype.P=function(x,y,z){const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;return[t.x+X*t.c+Z*t.s,t.y+Y,t.z-X*t.s+Z*t.c];};
MeshB.prototype.tri=function(a,b,c,col,em){const base=this.pos.length/3;for(const v of [a,b,c]){this.pos.push(...v);this.nrm.push(0,1,0);this.col.push(col[0],col[1],col[2],em||0);this.limb.push(0);}this.idx.push(base,base+1,base+2);};
MeshB.prototype.box=function(x,y,z,w,h,d,col,em){const P=(a,b,c)=>this.P(a,b,c),x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;const v=[P(x0,y0,z0),P(x1,y0,z0),P(x1,y0,z1),P(x0,y0,z1),P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)];const q=(a,b,c,d)=>{this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);};q(v[4],v[5],v[6],v[7]);q(v[3],v[2],v[1],v[0]);q(v[0],v[1],v[5],v[4]);q(v[1],v[2],v[6],v[5]);q(v[2],v[3],v[7],v[6]);q(v[3],v[0],v[4],v[7]);};
global.MeshB=MeshB;

const triModel={norm:1,prims:[{pos:new Float32Array([-1,0,-1, 1,0,-1, 0,3,1]),idx:new Uint16Array([0,1,2]),col:[.5,.6,.7],em:.02}]};
global.GLTREES={};
for(const k of ['stSide','sHang','sAnt','stGate','sRef','cGate','cDome','cTower','cArc','cSpire','cClu','sRing'])
  global.GLTREES[k]={norm:1,prims:triModel.prims.map(p=>({pos:p.pos,idx:p.idx,col:p.col,em:p.em}))};
global.GLCRE={stag:{ready:true},cat:{ready:true},jelly:{ready:true},dfly:{ready:true},bird4:{ready:true}};

const n=7000,fill=v=>{const a=new Float32Array(n);a.fill(v);return a;};
global.buildWorld=()=>({
  lapLen:25000,nMain:n,rx:fill(0),rz:fill(0),ry:fill(5),tx:fill(1),tz:fill(0),meshH:()=>5,
  actors:[],actorMeshes:{astro:{},rover:{},drone:{}},
  props:{pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)}
});

vm.runInThisContext(fs.readFileSync('js/32-verdant-fauna-buildings-v121.js','utf8'),{filename:'js/32-verdant-fauna-buildings-v121.js'});
const w=buildWorld({id:'verdant',seed:9157});
const s=w.__verdantV121;
if(!s)throw new Error('v121 stats missing');
if(s.buildings!==16)throw new Error('expected 16 stamped building placements, got '+s.buildings+' skipped '+s.skippedBuildings.join(','));
if(s.skippedBuildings.length)throw new Error('unexpected skipped buildings: '+s.skippedBuildings.join(','));
for(const [k,n0] of [['stags',10],['cats',8],['jellies',10],['dragonflies',24],['rays',7]])
  if(s[k]!==n0)throw new Error('expected '+n0+' '+k+', got '+s[k]);
if(!w.props.idx.length)throw new Error('building geometry was not merged into props');
const animals=w.actors.filter(a=>String(a.type).startsWith('v121_'));
for(const [i,a] of animals.entries()){
  for(const k of ['meta','hx','hz','wr','wander','wspd','alert','headYaw','headPitch','swing','gph','gcre'])
    if(a[k]===undefined||a[k]===null)throw new Error('v121 animal '+i+' missing '+k);
  if(a.meta.float&&a.pinY===undefined)throw new Error('floating v121 animal '+i+' missing pinY');
}
console.log(JSON.stringify({ok:true,buildings:s.buildings,buildingTris:s.buildingTris,animals:animals.length,rays:s.rays}));
