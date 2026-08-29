"use strict";

/* Verdant Rift v115 — fast legacy billboard cleanup -----------------------
   The imported glTF nature is now the visual baseline. The old upright
   vegetation sprites are disabled with one cheap linear pass over their size
   fields. No road lookup is performed here. This also deliberately contains
   NO build-label observer: js/25 is the single owner of the Verdant release
   label, avoiding the v113/v114 MutationObserver feedback loop. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.veg||!w.veg.dat) return w;
    if(!w.__realNature||!w.__realNature.ready) return w;

    const dat=w.veg.dat;
    let hidden=0;
    /* Each plant has four vertices; dat stores 4 floats per vertex. The size
       component is offset 2 in each vertex record. */
    for(let db=0;db+14<dat.length;db+=16){
      dat[db+2]=0;
      dat[db+6]=0;
      dat[db+10]=0;
      dat[db+14]=0;
      hidden++;
    }
    w.__billboardCleanup={hidden,mode:'global-fast'};
    console.log('Verdant v115: hidden legacy billboards:',hidden);
    return w;
  };
})();
