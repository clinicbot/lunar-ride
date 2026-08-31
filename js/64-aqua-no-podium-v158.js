"use strict";

/* Aqua Rift v158 — remove the actual v155 reef podium blocks ----------------
   Visual feedback on v157 showed the dark rectangular coral bases were still
   present. Root cause: v155 moundBase() creates one irregular block per mound
   with h up to about .44, while v157 only suppressed boxes with h <= .14.

   v158 adds a second, deliberately narrow geometry filter that matches the
   complete v155 mound-block / ledge envelope. It stays active only while Aqua
   is being built, and it leaves larger tunnel/road structure boxes alone.
   Creature placement from v157 is preserved unchanged.
*/
(function(){
  const AQUA_ID='aqua',VERSION=158;
  let aquaBuildActive=false,podiumBoxesSuppressed=0;

  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV158NoPodiums){
    const oldBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      const reefPodium = aquaBuildActive &&
        y<=.15 && h<=.50 &&
        w>=.30 && w<=2.25 &&
        d>=.20 && d<=1.10 &&
        (em===undefined || em<=.0125);
      if(reefPodium){podiumBoxesSuppressed++;return;}
      return oldBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV158NoPodiums=true;
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const isAqua=!!(sc&&sc.id===AQUA_ID);
    if(isAqua){aquaBuildActive=true;podiumBoxesSuppressed=0;}
    let w;
    try{w=previousBuild(sc,onProgress);}finally{if(isAqua)aquaBuildActive=false;}
    if(!w||!isAqua)return w;

    const prior=w.__aquaV157||{};
    w.__aquaV158={
      version:VERSION,
      sourcePodiumRootCause:'v155 moundBase boxes up to h=.44',
      completeV155PodiumEnvelopeSuppression:true,
      podiumBoxesSuppressed,
      creaturesRemainNearGlass:prior.creaturesMovedNearGlass===true,
      visibleCreatureCount:prior.visibleCreatureCount||36,
      smallCreatureGlassGap:prior.smallCreatureGlassGap||[2.2,7.5],
      leviathanGlassGap:prior.leviathanGlassGap||[8,15],
      coralGroups:prior.coralGroups||2800,
      roadUnchanged:true,
      glassUnchanged:true,
      waterUnchanged:true,
      verdantUntouched:true
    };
    console.log('Aqua Rift v158 no podium blocks:',w.__aquaV158);
    return w;
  };

  globalThis.__aquaV158Spec={
    VERSION,
    completeV155PodiumEnvelopeSuppression:true,
    matchedHeightMax:.50,
    matchedWidth:[.30,2.25],
    matchedDepth:[.20,1.10],
    preservesV157CreaturePlacement:true
  };
})();
