"use strict";

/* Aqua Rift v145 — fish visibility + hard fauna isolation -----------------
   v144 successfully imported the Quaternius CC0 fish, but Lunar Ride's
   lightweight creature loader intentionally ignores glTF node transforms.
   These FBX2glTF fish keep a canonical x100 mesh-node scale and -90deg X
   rotation in their node, so the raw vertices rendered almost invisibly tiny.

   This Aqua-only correction restores those node transforms at actor level,
   removes every non-Aqua fauna actor regardless of legacy alias (gcat/gstag/
   gbird etc.), and redistributes the existing fish into close regular schools
   so sea life is continuously visible from the glass tunnel. Verdant and all
   other worlds are untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=145;
  const MODEL_SCALE_FACTOR=100;
  const MODEL_PITCH=-Math.PI/2;
  const SCHOOL_SIZE=6;
  const MIN_OFFSET=18,OFFSET_STEP=4;
  const MAX_SWIM_RADIUS=6;
  const FISH_KEYS=new Set(['aqClown','aqFishA','aqFishB','aqFishC','aqShark','aqAngler',
    'aqPuffer','aqLion','aqButterfly','aqSword','aqBlackLion']);

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID||!Array.isArray(w.actors))return w;
    return fixAqua(w);
  };

  function fixAqua(w){
    const before=w.actors.length,removedByType={},kept=[];
    let retainedRiders=0;

    /* Hard isolation is intentional. The player rider is not in world.actors;
       preserve optional NPC riders, preserve only v144 real Aqua fish, and
       discard every other base-world actor. This catches legacy aliases such
       as gcat/gstag/gbird without needing an ever-growing deny-list. */
    for(const a of w.actors){
      if(a&&a.aquaFish===true&&FISH_KEYS.has(a.gcre)){
        if(!a.__aquaV145Fixed){
          a.k=(a.k||1)*MODEL_SCALE_FACTOR;
          a.pitch=MODEL_PITCH;
          a.emiss=Math.max(.95,a.emiss||0);
          a.__aquaV145Fixed=true;
        }
        kept.push(a);
      }else if(a&&(a.type==='rider'||a.me===true)){
        retainedRiders++;kept.push(a);
      }else{
        const key=(a&&a.type)||'unknown';removedByType[key]=(removedByType[key]||0)+1;
      }
    }
    w.actors=kept;

    /* Put the already-created real fish into small, regularly spaced schools
       18-30 m from the road. With 258 fish this yields 43 schools, so a rider
       is never hundreds of metres from the nearest school. The 8.8 m glass
       tube remains safely clear. */
    const fish=w.actors.filter(a=>a&&a.aquaFish===true&&FISH_KEYS.has(a.gcre));
    const n=w.nMain||0,groups=Math.max(1,Math.ceil(fish.length/SCHOOL_SIZE));
    if(n&&w.rx&&w.rz&&w.tx&&w.tz){
      for(let q=0;q<fish.length;q++){
        const a=fish[q],g=Math.floor(q/SCHOOL_SIZE),j=q%SCHOOL_SIZE;
        const i=Math.min(n-1,Math.floor((g+.5)*n/groups));
        const side=(g&1)?-1:1;
        const off=MIN_OFFSET+(g%4)*OFFSET_STEP+(j-(SCHOOL_SIZE-1)/2)*.55;
        a.cx=w.rx[i]-w.tz[i]*off*side;
        a.cz=w.rz[i]+w.tx[i]*off*side;
        const floor=typeof w.groundAt==='function'?w.groundAt(a.cx,a.cz):(w.ry?w.ry[i]:0);
        a.gy=floor;
        a.alt=Math.max(5,Math.min(22,a.alt===undefined?10:a.alt));
        a.r=Math.max(2.2,Math.min(MAX_SWIM_RADIUS,a.r||3.5));
        a.px=a.cx+Math.cos(a.ph||0)*a.r;
        a.pz=a.cz+Math.sin(a.ph||0)*a.r;
        a.py=a.gy+a.alt;
      }
    }

    const removedNonAqua=before-w.actors.length;
    w.__aquaFishV145={version:VERSION,fish:fish.length,schools:groups,schoolSize:SCHOOL_SIZE,
      modelScaleFactor:MODEL_SCALE_FACTOR,modelPitch:MODEL_PITCH,minRoadOffset:MIN_OFFSET,
      maxSwimRadius:MAX_SWIM_RADIUS,removedNonAqua,removedByType,retainedRiders,
      hardFaunaIsolation:true};
    if(w.__aquaFishV144)w.__aquaFishV144.correctedByV145=true;
    console.log('Aqua Rift v145 fish visibility/fauna isolation:',w.__aquaFishV145);
    return w;
  }

  globalThis.__aquaFishV145Spec={VERSION,MODEL_SCALE_FACTOR,MODEL_PITCH,SCHOOL_SIZE,
    MIN_OFFSET,OFFSET_STEP,MAX_SWIM_RADIUS,fishKeys:[...FISH_KEYS]};
})();
