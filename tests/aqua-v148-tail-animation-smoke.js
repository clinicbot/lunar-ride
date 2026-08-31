"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/54-aqua-tail-animation-v148.js','utf8');
for(const m of ['VERSION=148','FRAME_COUNT=24','TAIL_AMPLITUDE=.075','aquaTailAnimated:true','geometryBaked:true','__aquaFishV148'])
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
console.log('ok: Aqua v148 keeps the head anchored, bends body progressively, gives the tail a strong lateral beat, advances per-fish tail phase, and leaves non-Aqua loader/frame paths untouched');
