"use strict";
const fs=require('fs'),vm=require('vm');
const src=require('./_section')('js/53-aqua-swim-motion-v147.js');
for(const m of ['VERSION=147','VERTICAL_DRIFT=.18',"motion:'horizontal-elliptical-swim'",'headingFollowsVelocity:true','removesDroneBob:true'])
  if(!src.includes(m))throw new Error('missing Aqua v147 marker '+m);

const N=80,rx=[],rz=[],tx=[],tz=[];
for(let i=0;i<N;i++){rx.push(i*5);rz.push(0);tx.push(1);tz.push(0);}
const fish={type:'drone',aquaFish:true,gcre:'aqClown',cx:100,cz:20,gy:4,alt:0,ph:.7,
  px:100,py:4,pz:20,yaw:0,gph:0};
const rider={type:'rider',px:7,py:1,pz:2,yaw:.3};
const world={nMain:N,rx,rz,tx,tz,actors:[fish,rider],__aquaFishV146:{version:146}};
let t=0;
const state={scene:{id:'aqua'},elapsed:0};
function oldUpdate(dt){
  t+=dt;state.elapsed=t;
  // Simulate the old drone updater: circular XZ motion plus the bad ±2.5m bob.
  const ang=fish.ph+t*.025;
  fish.px=fish.cx+Math.cos(ang)*4;
  fish.pz=fish.cz+Math.sin(ang)*4;
  fish.py=fish.gy+Math.sin(t*1.1+fish.ph)*2.5;
  fish.yaw=ang;
}
const ctx={console,Math,world,state,updateActors:oldUpdate};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);

const samples=[];
for(let i=0;i<240;i++){
  ctx.updateActors(1/30);
  samples.push([fish.px,fish.py,fish.pz,fish.yaw]);
}
const ys=samples.map(s=>s[1]),xs=samples.map(s=>s[0]),zs=samples.map(s=>s[2]);
const yr=Math.max(...ys)-Math.min(...ys);
const horizontal=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));
if(yr>.38)throw new Error('fish still bobs too much vertically: '+yr);
if(horizontal<5)throw new Error('fish does not visibly swim horizontally: '+horizontal);
if(!Number.isFinite(fish.yaw)||Math.abs(samples[0][3]-samples[120][3])<.05)throw new Error('fish heading does not follow motion');
if(!fish.__aquaV147Motion)throw new Error('motion cache missing');
if(Math.abs(rider.px-7)>1e-9||Math.abs(rider.yaw-.3)>1e-9)throw new Error('non-fish actor changed');
const tel=world.__aquaFishV147;
if(!tel||tel.version!==147||tel.fish!==1||tel.verticalDrift!==.18||!tel.headingFollowsVelocity||!tel.removesDroneBob)
  throw new Error('bad v147 telemetry '+JSON.stringify(tel));
if(!world.__aquaFishV146.correctedByV147)throw new Error('v146 correction link missing');

// Aqua-only guard: same wrapper in another scene must leave the old updater result alone.
state.scene={id:'verdant'}; const before=fish.py;ctx.updateActors(1/30);
const expected=fish.gy+Math.sin(state.elapsed*1.1+fish.ph)*2.5;
if(Math.abs(fish.py-expected)>1e-9)throw new Error('v147 altered non-Aqua motion');
console.log('ok: Aqua v147 replaces metre-scale drone bob with sustained horizontal swimming, tangent heading and subtle depth drift');
