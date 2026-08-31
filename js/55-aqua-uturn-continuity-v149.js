"use strict";

/* Aqua Rift v149 — U-turn local-scene continuity ---------------------------
   Fish are dynamic, but a rider who passes a nearby school and immediately
   U-turns should still see that same school rather than a completely changed
   local tableau. This Aqua-only layer snapshots nearby fish at the U-turn,
   holds their world positions very briefly while tails keep animating, then
   eases them back onto their existing v147 swim trajectories. No world rebuild,
   respawn or species change occurs. Verdant and non-Aqua worlds are untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=149;
  const CAPTURE_RADIUS=135;
  const HOLD_SECONDS=1.15;
  const REJOIN_SECONDS=2.35;
  const TOTAL_SECONDS=HOLD_SECONDS+REJOIN_SECONDS;

  function smoothstep(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}

  function install(){
    if(globalThis.__aquaFishV149Installed)return;
    if(typeof updateActors!=='function'||typeof doUturn!=='function'||typeof segPoint!=='function'){
      if(typeof setTimeout==='function')setTimeout(install,0);
      return;
    }
    globalThis.__aquaFishV149Installed=true;

    const previousUTurn=doUturn;
    doUturn=function(){
      if(world&&state&&state.scene&&state.scene.id===AQUA_ID&&Array.isArray(world.actors)){
        const p=[0,0,0];
        segPoint(state.seg,state.s,state.playerX*state.dir,p);
        const r2=CAPTURE_RADIUS*CAPTURE_RADIUS;
        let captured=0;
        for(const a of world.actors){
          if(!a||a.aquaFish!==true)continue;
          const dx=(a.px||0)-p[0],dz=(a.pz||0)-p[2];
          if(dx*dx+dz*dz>r2)continue;
          a.__aquaV149Hold={x:a.px,y:a.py,z:a.pz,yaw:a.yaw||0,start:state.elapsed||0};
          captured++;
        }
        world.__aquaFishV149={version:VERSION,captured,lastUTurnAt:state.elapsed||0,
          captureRadius:CAPTURE_RADIUS,holdSeconds:HOLD_SECONDS,rejoinSeconds:REJOIN_SECONDS,
          uTurnLocalContinuity:true,worldRebuild:false,fishRespawn:false};
      }
      return previousUTurn();
    };

    const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
      const t=state.elapsed||0;
      let held=0,rejoining=0;
      for(const a of world.actors){
        const h=a&&a.__aquaV149Hold;if(!h)continue;
        const age=Math.max(0,t-h.start);
        if(age>=TOTAL_SECONDS){delete a.__aquaV149Hold;continue;}
        const tx=a.px,ty=a.py,tz=a.pz,tyaw=a.yaw||0;
        if(age<=HOLD_SECONDS){
          a.px=h.x;a.py=h.y;a.pz=h.z;a.yaw=h.yaw;held++;
        }else{
          const q=smoothstep((age-HOLD_SECONDS)/REJOIN_SECONDS);
          a.px=h.x+(tx-h.x)*q;
          a.py=h.y+(ty-h.y)*q;
          a.pz=h.z+(tz-h.z)*q;
          /* angle-safe yaw blend */
          let d=tyaw-h.yaw;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
          a.yaw=h.yaw+d*q;rejoining++;
        }
      }
      if(world.__aquaFishV149){
        world.__aquaFishV149.held=held;
        world.__aquaFishV149.rejoining=rejoining;
      }
    };
  }

  globalThis.__aquaFishV149Spec={VERSION,CAPTURE_RADIUS,HOLD_SECONDS,REJOIN_SECONDS,TOTAL_SECONDS};
  install();
})();
