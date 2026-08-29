"use strict";

/* Verdant Rift v117 — remove legacy billboard vegetation -----------------
   Once the imported instanced nature plan is ready, the old 26k sprite layer
   is not uploaded at all.  This saves both CPU work and GPU memory instead of
   uploading the sprites and then hiding them. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;
    if(!w.instNature||!w.instNature.ready)return w;
    const oldCount=w.veg&&w.veg.count?w.veg.count:0;
    w.veg=null;
    w.__billboardCleanup={removed:true,oldIndexCount:oldCount,mode:'no-upload'};
    console.log('Verdant v117: legacy billboard vegetation removed before upload');
    return w;
  };
})();
