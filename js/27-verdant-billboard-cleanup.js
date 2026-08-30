"use strict";

/* Verdant Rift v129 — hard-disable legacy billboard vegetation ------------
   The old 26k sprite forest is never uploaded in Verdant. Previous releases
   kept it when imported nature lost an asynchronous load race; that produced
   the huge green triangular silhouettes seen in v128 screenshots. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;
    const oldCount=w.veg&&w.veg.count?w.veg.count:0;
    w.veg=null;
    w.__billboardCleanup={removed:true,oldIndexCount:oldCount,mode:'hard-disable-v129'};
    console.log('Verdant v129: legacy billboard vegetation hard-disabled');
    return w;
  };
})();
