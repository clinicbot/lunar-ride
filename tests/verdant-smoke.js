'use strict';

/* Headless smoke test for Verdant Rift.  It deliberately stubs rendering
   details but executes the real custom world builder plus its Verdant-only
   route/terrain/visual/depth passes, so generated data matches the live app. */
const fs=require('fs'),vm=require('vm');

global.SCENES=[];
global.ROUTE_STEP=4;
global.cfg={riders:0};
global.GLTREES={oak:null,pine:null,vfern:null};
global.GLCRE={};
global.RIDER_KITS=[];
global.RIDER_META={};
global.buildWorld=function(){throw new Error('unexpected legacy buildWorld call');};
global.clamp=(v,a,b)=>v<a?a:(v>b?b:v);
global.lerp=(a,b,t)=>a+(b-a)*t;
global.smoothstep=t=>t*t*(3-2*t);
global.hx=c=>{const n=parseInt(c.slice(1),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];};
global.mulberry32=a=>function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
global.makeNoise=seed=>{const r=mulberry32(seed);const p=new Float32Array(256);for(let i=0;i<256;i++)p[i]=r()*2-1;return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=smoothstep(fx),v=smoothstep(fy);const q=(a,b)=>p[(((a*73+b*151)%256)+256)%256];return lerp(lerp(q(xi,yi),q(xi+1,yi),u),lerp(q(xi,yi+1),q(xi+1,yi+1),u),v);};};

function MeshB(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.setTF(0,0,0,0,1);}
MeshB.prototype.setTF=function(x,y,z,yaw,k){this.tf={x,y,z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:k===undefined?1:k};};
MeshB.prototype.P=function(x,y,z){const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;return[t.x+X*t.c+Z*t.s,t.y+Y,t.z-X*t.s+Z*t.c];};
MeshB.prototype.tri=function(a,b,c,col,em){const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2],bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;for(const v of[a,b,c]){this.idx.push(this.pos.length/3);this.pos.push(...v);this.nrm.push(nx,ny,nz);this.col.push(col[0],col[1],col[2],em||0);this.limb.push(0);}};
MeshB.prototype.quad=function(a,b,c,d,col,em){this.tri(a,b,c,col,em);this.tri(a,c,d,col,em);};
MeshB.prototype.disc=function(x,y,z,r,seg,col,em){const C=this.P(x,y,z);for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2,b=(i+1)/seg*Math.PI*2;this.tri(C,this.P(x+Math.cos(a)*r,y,z+Math.sin(a)*r),this.P(x+Math.cos(b)*r,y,z+Math.sin(b)*r),col,em);}};
MeshB.prototype.sph=MeshB.prototype.cyl=MeshB.prototype.box=function(){};
global.MeshB=MeshB;
for(const n of ['mCrystal','mFan','mBroad','mPine','mDome','mDish','mMast','mSolarFarm','mAstro','mRover','mShuttle','mDrone','mRider'])global[n]=()=>{};
global.appendGLTF=()=>{};

for(const f of ['js/17-verdant-rift.js','js/20-verdant-route-audit.js','js/21-verdant-terrain-polish.js','js/22-verdant-visual-pass.js','js/23-verdant-depth-pass.js'])
  vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});

const sc=SCENES.find(s=>s.id==='verdant');
if(!sc)throw new Error('Verdant scene was not registered');
const w=buildWorld(sc);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const finite=a=>{for(let i=0;i<a.length;i++)if(!Number.isFinite(a[i]))return false;return true;};
assert(w.nCut===0,'Verdant must remain a single route with no shortcut');
assert(Math.abs(w.lapLen-25000)<120,'lap length is '+w.lapLen+' m, expected ~25 km');
assert(w.nMain>6000&&w.nMain<6500,'unexpected route sample count '+w.nMain);
assert(finite(w.rx)&&finite(w.rz)&&finite(w.ry)&&finite(w.grade),'non-finite route values');
let maxG=0,maxI=0;for(let i=0;i<w.grade.length;i++){const g=Math.abs(w.grade[i]);if(g>maxG){maxG=g;maxI=i;}}
const last=w.nMain-1;
const seamXZ=Math.hypot(w.rx[0]-w.rx[last],w.rz[0]-w.rz[last]);
console.log('route diagnostics',JSON.stringify({lapLen:w.lapLen,nMain:w.nMain,maxGrade:maxG,maxGradeKm:maxI*4/1000,seamXZ,seamY:w.ry[0]-w.ry[last],audit:w.__verdantAudit,terrainAudit:w.__verdantTerrainAudit,roadPos:w.road.pos.length,roadIdx:w.road.idx.length,depth:w.__verdantDepth}));
assert(maxG<=8.21,'grade limit exceeded: '+maxG.toFixed(3)+'% at '+(maxI*4/1000).toFixed(3)+' km');
assert(seamXZ<8.5,'route loop does not close spatially: '+seamXZ.toFixed(2)+' m');
assert(w.__verdantTerrainAudit&&w.__verdantTerrainAudit.maxNearTrailSlopePct<46,'near-trail terrain still too steep: '+(w.__verdantTerrainAudit&&w.__verdantTerrainAudit.maxNearTrailSlopePct));
assert(w.__verdantTerrainAudit&&w.__verdantTerrainAudit.maxRoadGroundGap<0.75,'terrain does not support trail closely enough: '+(w.__verdantTerrainAudit&&w.__verdantTerrainAudit.maxRoadGroundGap));
assert(w.terrain.pos.length>100000&&w.terrain.idx.length>100000,'terrain mesh missing');
assert(w.road.pos.length>=w.nMain*18,'trail vertex data incomplete');
assert(w.road.idx.length>=w.nMain*6,'trail surface incomplete');
assert(w.veg&&w.veg.count>100000,'vegetation field too sparse');
const count=t=>w.actors.filter(a=>a.type===t).length;
assert(count('bear')===6,'bear population wrong after depth pass: '+count('bear'));
assert(count('frog')===12,'frog population wrong');
assert(count('monkey')===14,'monkey population wrong');
assert(count('insect')===36,'insect population wrong');
assert(count('shuttle')>=9,'sky traffic missing');
assert(w.verdant&&w.verdant.zoneAt(0)===0,'Verdant zone metadata missing');
assert(w.__verdantVisual,'visual richness pass did not run');
assert(w.__verdantDepth&&w.__verdantDepth.ponds===2&&w.__verdantDepth.earlyBears===2,'v108 depth pass did not run');
console.log(JSON.stringify({ok:true,lapKm:(w.lapLen/1000).toFixed(2),maxGrade:maxG.toFixed(2),maxNearTrailSlope:w.__verdantTerrainAudit.maxNearTrailSlopePct.toFixed(2),maxRoadGroundGap:w.__verdantTerrainAudit.maxRoadGroundGap.toFixed(3),terrainTriangles:w.terrain.idx.length/3,trailTriangles:w.road.idx.length/3,vegetationQuads:w.veg.count/6,actors:w.actors.length,depth:w.__verdantDepth},null,2));
