"use strict";

/* Verdant Rift v114 — billboard cleanup ---------------------------------
   The real nature pilot is intentionally judged on the imported glTF plants,
   not on the old vegetation atlas.  In the first 2.4 km, once the imported
   nature layer is active, hide every legacy billboard (grass/bush/oak/pine)
   instead of converting old trees into small grass clumps.  Terrain grass
   remains visible through the ground texture; only the upright sprite cards
   are suppressed. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.veg||!w._dbg||!w._dbg.roadNear) return w;
    if(!w.__realNature||!w.__realNature.ready) return w;

    const ctr=w.veg.ctr,dat=w.veg.dat;
    const plants=Math.floor(ctr.length/12);
    let hidden=0;
    for(let p=0;p<plants;p++){
      const q=w._dbg.roadNear(ctr[p*12],ctr[p*12+2]);
      if(!q||q.i*ROUTE_STEP>2400) continue;
      const db=p*16;
      dat[db+2]=0;
      dat[db+6]=0;
      dat[db+10]=0;
      dat[db+14]=0;
      hidden++;
    }
    w.__billboardCleanup={hidden};
    console.log('Verdant v114: hidden legacy pilot billboards:',hidden);
    return w;
  };

  const RELEASE='114';
  const label=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build '+RELEASE;
    const e=document.getElementById('sceneName');
    if(e&&e.textContent&&e.textContent.indexOf('Verdant Rift')>=0&&!e.textContent.endsWith('v'+RELEASE))
      e.textContent=e.textContent.replace(/\s·\sv\d+\s*$/,'')+' · v'+RELEASE;
  };
  if(typeof document!=='undefined'){
    const install=()=>{
      label();
      const e=document.getElementById('sceneName');
      if(e)new MutationObserver(()=>label()).observe(e,{childList:true,characterData:true,subtree:true});
      [100,350,800,1500].forEach(ms=>setTimeout(label,ms));
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }
})();
