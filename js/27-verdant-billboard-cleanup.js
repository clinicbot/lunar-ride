"use strict";

/* Verdant Rift v116 — fast legacy billboard cleanup -----------------------
   Imported glTF nature is the visual baseline. The old upright vegetation
   sprites are disabled with one cheap linear pass over their size fields.
   No road lookup and no build-label observer are used here. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.veg||!w.veg.dat)return w;
    if(!w.__realNature||!w.__realNature.ready)return w;

    const dat=w.veg.dat;
    let hidden=0;
    for(let db=0;db+14<dat.length;db+=16){
      dat[db+2]=0;
      dat[db+6]=0;
      dat[db+10]=0;
      dat[db+14]=0;
      hidden++;
    }
    w.__billboardCleanup={hidden,mode:'global-fast'};
    console.log('Verdant v116: hidden legacy billboards:',hidden);
    return w;
  };
})();
