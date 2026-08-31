"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/55-aqua-uturn-continuity-v149.js','utf8');
for(const m of ['VERSION=149','CAPTURE_RADIUS=135','HOLD_SECONDS=1.15','REJOIN_SECONDS=2.35','uTurnLocalContinuity:true','worldRebuild:false','fishRespawn:false'])
  if(!src.includes(m))throw new Error('missing Aqua v149 marker '+m);

let baseUpdates=0,baseTurns=0;
const near={aquaFish:true,px:10,py:5,pz:0,yaw:.4},far={aquaFish:true,px:300,py:6,pz:0,yaw:1.1},other={type:'rider',px:12,py:0,pz:0};
const ctx={console,Math,
  world:{actors:[near,far,other]},
  state:{scene:{id:'aqua'},seg:'m',s:0,playerX:0,dir:1,elapsed:10},
  segPoint:(seg,s,off,out)=>{out[0]=0;out[1]=0;out[2]=0;return out;},
  doUturn:()=>{baseTurns++;ctx.state.dir*=-1;},
  updateActors:dt=>{baseUpdates++;near.px=50;near.py=8;near.pz=20;near.yaw=1.4;far.px=310;},
  setTimeout:fn=>{throw new Error('unexpected deferred install');}
};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
if(!ctx.__aquaFishV149Installed)throw new Error('v149 did not install');
const S=ctx.__aquaFishV149Spec;if(!S||S.VERSION!==149||S.TOTAL_SECONDS!==3.5)throw new Error('v149 spec bad');
ctx.doUturn();
if(baseTurns!==1||ctx.state.dir!==-1)throw new Error('base U-turn not preserved');
if(!near.__aquaV149Hold)throw new Error('near fish not captured');
if(far.__aquaV149Hold)throw new Error('far fish should not be captured');
if(!ctx.world.__aquaFishV149||ctx.world.__aquaFishV149.captured!==1||!ctx.world.__aquaFishV149.uTurnLocalContinuity)throw new Error('v149 telemetry missing');

/* During the short hold, underlying swim motion still runs but position is restored. */
ctx.state.elapsed=10.5;ctx.updateActors(.5);
if(baseUpdates!==1)throw new Error('base updater not called');
if(Math.abs(near.px-10)>1e-9||Math.abs(near.py-5)>1e-9||Math.abs(near.pz)>1e-9||Math.abs(near.yaw-.4)>1e-9)
  throw new Error('near fish did not hold its pre-turn world position');

/* During rejoin, fish must be between the held point and its live trajectory. */
ctx.state.elapsed=12.325;ctx.updateActors(.5); // halfway through 2.35 s rejoin
if(!(near.px>10&&near.px<50&&near.py>5&&near.py<8&&near.pz>0&&near.pz<20))
  throw new Error('near fish did not ease back to live trajectory '+JSON.stringify(near));
if(ctx.world.__aquaFishV149.rejoining!==1)throw new Error('rejoin telemetry bad');

/* After the continuity window, live v147 motion is fully restored. */
ctx.state.elapsed=13.6;ctx.updateActors(.5);
if(near.__aquaV149Hold)throw new Error('hold not cleared');
if(near.px!==50||near.py!==8||near.pz!==20||near.yaw!==1.4)throw new Error('live trajectory not restored');

/* U-turn outside Aqua must remain a pure pass-through. */
ctx.state.scene={id:'verdant'};ctx.state.dir=1;near.__aquaV149Hold=undefined;ctx.doUturn();
if(baseTurns!==2||ctx.state.dir!==-1||near.__aquaV149Hold)throw new Error('non-Aqua U-turn was disturbed');
console.log('ok: Aqua v149 preserves nearby schools across an immediate U-turn, keeps the original U-turn/update paths, eases fish back onto their live trajectories, and does nothing outside Aqua');
