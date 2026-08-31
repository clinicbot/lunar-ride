"use strict";
const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync('js/54-aqua-tail-animation-v148.js','utf8');
for(const m of ['VERSION=148','FRAME_COUNT=24','TAIL_AMPLITUDE=.075','aquaTailAnimated:true','geometryBaked:true','__aquaFishV148','installTailUpdate','setTimeout(installTailUpdate,0)'])
  if(!src.includes(m))throw new Error('missing Aqua v148 marker '+m);

let oldLoads=0,oldUpdates=0;
const ctx={console,Math,Float32Array,Uint32Array,
  loadGLTFCreature:()=>{oldLoads++;return 'legacy';},
  glCreFrame:()=>({legacy:true}),
  updateActors:()=>{oldUpdates++;},
  GLCRE:{},world:null,state:null};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const S=ctx.__aquaFishV148Spec;
if(!S||S.VERSION!==148||S.FRAME_COUNT!==24||S.fishKeys.length!==11)throw new Error('v148 spec missing/bad');

/* synthetic fish: long Z body, thick head at -Z, thin tail at +Z */
const P=[
 -.45,-.35,-1, .45,-.35,-1, -.45,.35,-1, .45,.35,-1,
 -.30,-.42,-.25, .30,-.42,-.25, -.30,.42,-.25, .30,.42,-.25,
 -.18,-.40,.45, .18,-.40,.45, -.18,.40,.45, .18,.40,.45,
 -.08,-.50,1, .08,-.50,1, -.08,.50,1, .08,.50,1
];
const N=[];for(let i=0;i<P.length/3;i++)N.push(1,0,0);
const sh=S.analyseFishGeometry(P);
if(sh.longAxis!==2||sh.sideAxis!==0||!sh.tailHigh)throw new Error('fish geometry analysis failed '+JSON.stringify(sh));
const f0=S.deformFishFrame(P,N,sh,0),fq=S.deformFishFrame(P,N,sh,.25);
const head=0,tail=12*3;
const headMove=Math.hypot(f0.pos[head]-P[head],f0.pos[head+1]-P[head+1],f0.pos[head+2]-P[head+2]);
const tailMove=Math.abs(f0.pos[tail+sh.sideAxis]-P[tail+sh.sideAxis]);
const tailDelta=Math.abs(f0.pos[tail+sh.sideAxis]-fq.pos[tail+sh.sideAxis]);
if(headMove>1e-7)throw new Error('head should remain anchored, moved '+headMove);
if(tailMove<sh.length*.04||tailDelta<sh.length*.04)throw new Error('tail bend too small '+tailMove+' delta '+tailDelta);
for(let i=0;i<f0.nrm.length;i+=3){const l=Math.hypot(f0.nrm[i],f0.nrm[i+1],f0.nrm[i+2]);if(!Number.isFinite(l)||Math.abs(l-1)>.001)throw new Error('bad deformed normal '+l);}

/* Run the same geometric invariant across every real imported fish mesh. */
const files=['clownfish','fish-a','fish-b','fish-c','shark','anglerfish','puffer','lionfish','butterfly-fish','swordfish','black-lionfish'];
for(const name of files){
  const j=JSON.parse(fs.readFileSync(path.join('assets/models/aqua_fish',name+'.gltf'),'utf8')),
    b64=j.buffers[0].uri.slice(j.buffers[0].uri.indexOf(',')+1),buf=Buffer.from(b64,'base64'),
    ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),RP=[],RN=[];
  const acc=i=>{const a=j.accessors[i],bv=j.bufferViews[a.bufferView],off=(bv.byteOffset||0)+(a.byteOffset||0);
    if(a.componentType!==5126)throw new Error(name+' expected FLOAT accessor');
    return new Float32Array(ab,off,a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]||1));};
  for(const mesh of j.meshes)for(const pr of mesh.primitives){
    const p=acc(pr.attributes.POSITION),n=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL):null;
    for(let i=0;i<p.length;i+=3){RP.push(p[i],p[i+1],p[i+2]);if(n)RN.push(n[i],n[i+1],n[i+2]);else RN.push(0,1,0);}
  }
  const shape=S.analyseFishGeometry(RP),a=S.deformFishFrame(RP,RN,shape,0),b=S.deformFishFrame(RP,RN,shape,.25);
  let headDelta=0,tailDelta2=0,headN=0,tailN=0;
  for(let i=0;i<RP.length;i+=3){const raw=(RP[i+shape.longAxis]-shape.mn[shape.longAxis])/shape.length,
      u=shape.tailHigh?raw:1-raw,d=Math.abs(a.pos[i+shape.sideAxis]-b.pos[i+shape.sideAxis]);
    if(u<.10){headDelta=Math.max(headDelta,d);headN++;}if(u>.90){tailDelta2=Math.max(tailDelta2,d);tailN++;}}
  if(!headN||!tailN)throw new Error(name+' missing head/tail samples');
  if(headDelta>shape.length*.001)throw new Error(name+' head not anchored '+headDelta);
  if(tailDelta2<shape.length*.035)throw new Error(name+' tail beat too small '+tailDelta2+' L '+shape.length);
  console.log('real fish deform ok',name,'longAxis',shape.longAxis,'sideAxis',shape.sideAxis,'tailHigh',shape.tailHigh,'L',shape.length.toFixed(4),'tailDelta',tailDelta2.toFixed(4));
}

/* animated Aqua fish use their own phase; unrelated creatures retain legacy frame path */
ctx.GLCRE.aqClown={ready:true,aquaTailAnimated:true,N:24,frames:Array.from({length:24},(_,i)=>({pos:'p'+i,nrm:'n'+i})),col:'c',limbB:'l',idxB:'i',count:9};
const fish={aquaFish:true,gcre:'aqClown',ph:0};
const fr=ctx.glCreFrame(fish);
if(fr.legacy||fr.count!==9||fr.pos!=='p0')throw new Error('animated fish frame routing failed');
ctx.world={actors:[fish],__aquaFishV147:{version:147}};ctx.state={scene:{id:'aqua'}};
ctx.updateActors(.5);
if(oldUpdates!==1||!(fish.__aquaTailPhase>4))throw new Error('tail phase did not advance independently '+fish.__aquaTailPhase);
if(!ctx.world.__aquaFishV148||ctx.world.__aquaFishV148.animated!==1||!ctx.world.__aquaFishV147.correctedByV148)throw new Error('v148 telemetry missing');
const legacy=ctx.glCreFrame({gcre:'vbear'});if(!legacy.legacy)throw new Error('non-Aqua glCreFrame path disturbed');
ctx.loadGLTFCreature('vbear','bear.gltf',{});if(oldLoads!==1)throw new Error('non-Aqua loader interception leaked');

/* Real page order: js/54 executes before js/07 creates updateActors. It must
   load cleanly, schedule installation, and wrap updateActors after physics appears. */
const queued=[];let lateBaseCalls=0;
const late={console,Math,Float32Array,Uint32Array,
  loadGLTFCreature:()=>{},glCreFrame:()=>({legacy:true}),GLCRE:{},world:null,state:null,
  setTimeout:fn=>{queued.push(fn);return queued.length;}};late.globalThis=late;
vm.createContext(late);vm.runInContext(src,late);
if(late.__aquaFishV148UpdateInstalled)throw new Error('v148 updater installed before updateActors existed');
if(queued.length!==1)throw new Error('v148 did not queue deferred installer exactly once: '+queued.length);
late.updateActors=()=>{lateBaseCalls++;};
late.world={actors:[{aquaFish:true,gcre:'aqClown',ph:.2}],__aquaFishV147:{version:147}};
late.state={scene:{id:'aqua'}};
queued.shift()();
if(!late.__aquaFishV148UpdateInstalled||typeof late.updateActors!=='function')throw new Error('deferred updater did not install');
late.updateActors(.25);
if(lateBaseCalls!==1||!(late.world.actors[0].__aquaTailPhase>.2)||!late.world.__aquaFishV148?.deferredUpdateInstall)
  throw new Error('deferred updater did not advance tail phase after js/07-style late definition');

console.log('ok: Aqua v148 keeps heads anchored, bends all real fish tails, advances independent species phases, survives pre-js/07 load order via deferred install, and leaves non-Aqua paths untouched');
