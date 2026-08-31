"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path');

/* ---------- real-fish face geometry ------------------------------------- */
const tailSrc=fs.readFileSync('js/54-aqua-tail-animation-v148.js','utf8');
for(const m of ['faceEnhanced:true','addFaceDetail','eyes:2','pupils:2','mouth:1'])
  if(!tailSrc.includes(m))throw new Error('missing v150 face marker '+m);
const tailCtx={console,Math,Float32Array,Uint32Array,loadGLTFCreature:()=>{},glCreFrame:()=>({}),
  updateActors:()=>{},GLCRE:{},world:null,state:null};tailCtx.globalThis=tailCtx;
vm.createContext(tailCtx);vm.runInContext(tailSrc,tailCtx);
const F=tailCtx.__aquaFishV148Spec;
if(!F||typeof F.addFaceDetail!=='function')throw new Error('face helper not exported');

const files=['clownfish','fish-a','fish-b','fish-c','shark','anglerfish','puffer','lionfish','butterfly-fish','swordfish','black-lionfish'];
for(const name of files){
  const j=JSON.parse(fs.readFileSync(path.join('assets/models/aqua_fish',name+'.gltf'),'utf8')),
    b64=j.buffers[0].uri.slice(j.buffers[0].uri.indexOf(',')+1),buf=Buffer.from(b64,'base64'),
    ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),P=[],N=[],I=[],CV=[];
  const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const acc=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],T=CT[a.componentType];
    return new T(ab,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);};
  for(const mesh of j.meshes)for(const pr of mesh.primitives){
    const p=acc(pr.attributes.POSITION),n=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL):null,base=P.length/3;
    for(let q=0;q<p.length;q+=3){P.push(p[q],p[q+1],p[q+2]);if(n)N.push(n[q],n[q+1],n[q+2]);else N.push(0,1,0);CV.push(.5,.5,.5,0);}
    if(pr.indices!==undefined){const ix=acc(pr.indices);for(const v of ix)I.push(base+v);}else for(let q=0;q<p.length/3;q++)I.push(base+q);
  }
  const shape=F.analyseFishGeometry(P),oldV=P.length/3,oldI=I.length,face=F.addFaceDetail(P,N,I,CV,shape,name);
  if(face.eyes!==2||face.pupils!==2||face.mouth!==1)throw new Error(name+' face inventory bad');
  if(P.length/3<=oldV+100||I.length<=oldI+300||N.length!==P.length||CV.length!==(P.length/3)*4)
    throw new Error(name+' face geometry not appended consistently');
  let worstHead=0;
  for(let q=oldV*3;q<P.length;q+=3){const raw=(P[q+shape.longAxis]-shape.mn[shape.longAxis])/shape.length,
      u=shape.tailHigh?raw:1-raw;worstHead=Math.max(worstHead,u);}
  if(worstHead>.145)throw new Error(name+' face escaped anchored head region '+worstHead);
  const d=F.deformFishFrame(P,N,shape,0),e=F.deformFishFrame(P,N,shape,.25);
  let faceMotion=0;for(let q=oldV*3;q<P.length;q++)faceMotion=Math.max(faceMotion,Math.abs(d.pos[q]-e.pos[q]));
  if(faceMotion>shape.length*.001)throw new Error(name+' face deforms with tail '+faceMotion);
  console.log('face ok',name,'head',face.headEnd,'newVerts',P.length/3-oldV);
}

/* ---------- reef-only world wrapper ------------------------------------ */
const reefSrc=fs.readFileSync('js/56-aqua-faces-reef-v150.js','utf8');
for(const m of ['VERSION=150','reefOnly:true','genericPropsDiscarded:true','mountainTerrainReplaced:true','screensRemoved:true'])
  if(!reefSrc.includes(m))throw new Error('missing v150 reef marker '+m);
class MeshB{
  constructor(){this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];this.calls={quad:0,sph:0,cyl:0,box:0};}
  _v(n){for(let k=0;k<n;k++){this.pos.push(0,0,0);this.nrm.push(0,1,0);this.col.push(.2,.5,.5,0);this.limb.push(0);}const b=this.pos.length/3-n;for(let k=2;k<n;k++)this.idx.push(b,b+k-1,b+k);}
  quad(){this.calls.quad++;this._v(4);} sph(){this.calls.sph++;this._v(12);} cyl(){this.calls.cyl++;this._v(10);} box(){this.calls.box++;this._v(8);} setTF(){}
}
const mulberry32=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const hx=s=>[.2,.6,.7];
let nonAquaCalls=0;
const makeWorld=()=>{
  const n=180,rx=new Float32Array(n),rz=new Float32Array(n),ry=new Float32Array(n),tx=new Float32Array(n),tz=new Float32Array(n);
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;rx[i]=Math.sin(a)*420;rz[i]=Math.cos(a)*420;ry[i]=5+Math.sin(a*3)*12;tx[i]=Math.cos(a);tz[i]=-Math.sin(a);}
  const actors=[];for(let i=0;i<25;i++)actors.push({aquaFish:true,cx:rx[i*7%n]+25,cz:rz[i*7%n],px:0,py:30,pz:0,gy:20,alt:4,__aquaV146Band:i%5,__aquaV147Motion:{old:true}});
  return {nMain:n,rx,rz,ry,tx,tz,lapLen:n*4,actors,props:{legacyCity:true},terrain:{mountains:true},screens:[{old:true}],veg:{old:true},groundAt:()=>99};
};
const ctx={console,Math,Float32Array,Uint32Array,MeshB,mulberry32,hx,ROUTE_STEP:4,
  buildWorld:(sc)=>{if(sc.id!=='aqua')nonAquaCalls++;return makeWorld();}};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(reefSrc,ctx);
const other=ctx.buildWorld({id:'moon'},()=>{});if(nonAquaCalls!==1||!other.props.legacyCity)throw new Error('non-Aqua world was touched');
const w=ctx.buildWorld({id:'aqua',seed:7},()=>{});
if(!w.__aquaV150||!w.__aquaV150.reefOnly||!w.__aquaV150.genericPropsDiscarded)throw new Error('v150 telemetry missing');
if(w.props.legacyCity||w.terrain.mountains||w.screens.length||w.veg!==null)throw new Error('legacy land scenery survived');
if(!(w.props.pos.length>1000&&w.terrain.pos.length>1000))throw new Error('new reef/seabed meshes too small');
if(w.__aquaV150.coralPlacements!==150*2*3||w.__aquaV150.coralHeads<w.__aquaV150.coralPlacements*2)
  throw new Error('reef density too low '+JSON.stringify(w.__aquaV150));
if(w.__aquaV150.fishReanchored!==25||w.actors.some(a=>a.__aquaV147Motion))throw new Error('fish not reanchored to clean seabed');
if(typeof w.groundAt!=='function'||w.groundAt(1500,1500)>0)throw new Error('distant seabed was not lowered');
console.log('ok: Aqua v150 gives all 11 fish geometric faces and replaces land-world mountains/cities/poles/screens with a low coral-only seabed while non-Aqua worlds remain untouched');
