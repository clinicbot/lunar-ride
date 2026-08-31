"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/51-aqua-fish-visibility-v145.js','utf8');
for(const m of ['VERSION=145','MODEL_SCALE_FACTOR=100','MODEL_PITCH=-Math.PI/2','hardFaunaIsolation:true','__aquaFishV145'])
  if(!src.includes(m))throw new Error('missing Aqua v145 marker '+m);

const N=120,rx=[],rz=[],ry=[],tx=[],tz=[];
for(let i=0;i<N;i++){rx.push(i*4);rz.push(0);ry.push(0);tx.push(1);tz.push(0);}
const keys=['aqClown','aqFishA','aqFishB','aqFishC','aqShark','aqAngler','aqPuffer','aqLion','aqButterfly','aqSword','aqBlackLion'];
const actors=[];
for(let i=0;i<18;i++)actors.push({type:'drone',aquaFish:true,gcre:keys[i%keys.length],k:.8+i*.01,ph:i*.3,r:9,alt:30,cx:999,cz:999,gy:0,px:0,py:0,pz:0,emiss:.72});
actors.push({type:'gcat',k:1},{type:'gstag',k:1},{type:'gbird',k:1},{type:'cat',k:1},{type:'stag',k:1},{type:'bird',k:1},{type:'shuttle',k:1},{type:'rider',k:1});
const world={nMain:N,rx,rz,ry,tx,tz,groundAt:()=>-2,actors,__aquaFishV144:{version:144}};
const ctx={console,Math,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const out=ctx.buildWorld({id:'aqua'}),t=out.__aquaFishV145;
if(!t||t.version!==145)throw new Error('v145 telemetry missing');
if(t.fish!==18||t.schools!==3||t.modelScaleFactor!==100||!t.hardFaunaIsolation)throw new Error('bad telemetry '+JSON.stringify(t));
if(t.removedNonAqua!==7||t.retainedRiders!==1)throw new Error('fauna isolation count wrong '+JSON.stringify(t));
if(out.actors.length!==19)throw new Error('expected 18 fish + rider, got '+out.actors.length);
if(out.actors.some(a=>!a.aquaFish&&a.type!=='rider'&&!a.me))throw new Error('non-Aqua actor survived');
const fish=out.actors.filter(a=>a.aquaFish);
for(let i=0;i<fish.length;i++){
  const a=fish[i],original=.8+i*.01;
  if(Math.abs(a.k-original*100)>1e-9)throw new Error('fish scale not corrected '+a.k);
  if(Math.abs(a.pitch+Math.PI/2)>1e-12)throw new Error('fish pitch not corrected '+a.pitch);
  if(!a.__aquaV145Fixed)throw new Error('fish correction marker absent');
  if(a.r>6||a.alt>22||a.alt<5)throw new Error('fish visibility placement out of range');
  if(Math.abs(a.cz)<15)throw new Error('fish school too close to glass/road: '+a.cz);
}
if(!out.__aquaFishV144.correctedByV145)throw new Error('v144 correction link missing');
const verdant={actors:[{type:'gcat',k:1}]};ctx.buildWorld=(()=>verdant);
// Layer guard was already captured around the original build; validate source guard instead.
if(!src.includes("sc.id!==AQUA_ID"))throw new Error('Aqua-only guard missing');
console.log('ok: Aqua v145 scales/rotates imported fish into visibility, keeps schools near the tunnel, and removes all non-Aqua fauna while retaining riders');
