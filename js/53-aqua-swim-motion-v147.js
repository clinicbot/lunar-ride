"use strict";

/* Aqua Rift v147 — real horizontal swimming motion ------------------------
   v146 fixed the water-column distribution, but the actors were still routed
   through the generic drone updater, which adds a ±2.5 m vertical bob. That
   reads as floating, not swimming. This post-update Aqua-only layer replaces
   the final fish transform with long, shallow horizontal ellipses: sustained
   forward travel, gentle turns, body yaw aligned to velocity, and only a few
   centimetres of slow depth drift. Verdant and non-Aqua actors are untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=147;
  const MAJOR_MIN=8,MAJOR_MAX=15;
  const MINOR_MIN=1.4,MINOR_MAX=3.2;
  const OMEGA_MIN=.20,OMEGA_MAX=.34;
  const VERTICAL_DRIFT=.18;
  const BODY_SWAY=.055;
  const TWO_PI=Math.PI*2;

  if(typeof updateActors!=='function')return;
  const previousUpdateActors=updateActors;
  updateActors=function(dt){
    previousUpdateActors(dt);
    if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
    const t=state.elapsed||0;
    let fishCount=0;

    for(const a of world.actors){
      if(!a||a.aquaFish!==true)continue;
      fishCount++;
      if(!a.__aquaV147Motion)initMotion(a);
      const m=a.__aquaV147Motion;
      const th=m.phase+t*m.omega;
      const c=Math.cos(th),s=Math.sin(th);

      /* Long ellipse in the local route direction. Most of each circuit is
         visibly forward travel; the narrow cross-axis only supplies a gentle
         turn instead of a tiny circular orbit. */
      a.px=m.cx+m.tx*m.major*c+m.nx*m.minor*s;
      a.pz=m.cz+m.tz*m.major*c+m.nz*m.minor*s;

      /* The old drone bob was metres high. Real fish mostly hold depth while
         cruising, so vertical motion is deliberately subtle. */
      a.py=m.baseY+VERTICAL_DRIFT*Math.sin(th*.72+m.depthPhase);

      /* Tangent of the ellipse = actual swim direction. A very small whole-
         body sway suggests propulsion until native tail animation is wired. */
      const vx=-m.tx*m.major*s*m.omega+m.nx*m.minor*c*m.omega;
      const vz=-m.tz*m.major*s*m.omega+m.nz*m.minor*c*m.omega;
      a.yaw=Math.atan2(vx,vz)+BODY_SWAY*Math.sin(t*3.6+m.phase*1.7);
      a.gph=(a.gph||0)+dt*4.5;
    }

    if(!world.__aquaFishV147||world.__aquaFishV147.fish!==fishCount){
      world.__aquaFishV147={version:VERSION,fish:fishCount,motion:'horizontal-elliptical-swim',
        majorAxis:[MAJOR_MIN,MAJOR_MAX],minorAxis:[MINOR_MIN,MINOR_MAX],
        angularSpeed:[OMEGA_MIN,OMEGA_MAX],verticalDrift:VERTICAL_DRIFT,
        bodySway:BODY_SWAY,headingFollowsVelocity:true,removesDroneBob:true};
      if(world.__aquaFishV146)world.__aquaFishV146.correctedByV147=true;
      console.log('Aqua Rift v147 swim motion:',world.__aquaFishV147);
    }
  };

  function initMotion(a){
    const phase=((a.ph||0)%TWO_PI+TWO_PI)%TWO_PI;
    let tx=1,tz=0;

    /* v146 placed every school relative to the road but did not retain the
       route tangent. Find it once from the fish school centre, then cache it.
       This one-time nearest-route scan is cheap and avoids touching core world
       generation just for movement orientation. */
    if(world&&world.rx&&world.rz&&world.tx&&world.tz&&world.nMain){
      let best=0,bd=Infinity;
      for(let i=0;i<world.nMain;i++){
        const dx=(a.cx||0)-world.rx[i],dz=(a.cz||0)-world.rz[i],d=dx*dx+dz*dz;
        if(d<bd){bd=d;best=i;}
      }
      tx=world.tx[best];tz=world.tz[best];
    }
    let tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;

    /* Slightly rotate individual paths so neighbouring fish do not look like
       cars on parallel rails while the school still travels cohesively. */
    const steer=((phase/TWO_PI)-.5)*.24,cs=Math.cos(steer),sn=Math.sin(steer);
    const rtx=tx*cs-tz*sn,rtz=tx*sn+tz*cs;
    tx=rtx;tz=rtz;
    const nx=-tz,nz=tx;
    const frac=(Math.sin(phase*3.71)*.5+.5);
    const major=MAJOR_MIN+(MAJOR_MAX-MAJOR_MIN)*frac;
    const minor=MINOR_MIN+(MINOR_MAX-MINOR_MIN)*(1-frac*.65);
    const omega=(OMEGA_MIN+(OMEGA_MAX-OMEGA_MIN)*((Math.cos(phase*2.17)*.5+.5)))
      *((Math.sin(phase*1.31)>=0)?1:-1);

    a.__aquaV147Motion={cx:a.cx||a.px||0,cz:a.cz||a.pz||0,baseY:a.gy+(a.alt||0),
      tx,tz,nx,nz,major,minor,omega,phase,depthPhase:phase*1.93};
  }

  globalThis.__aquaFishV147Spec={VERSION,MAJOR_MIN,MAJOR_MAX,MINOR_MIN,MINOR_MAX,
    OMEGA_MIN,OMEGA_MAX,VERTICAL_DRIFT,BODY_SWAY};
})();
