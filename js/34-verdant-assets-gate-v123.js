"use strict";

/* Verdant Rift v123 — asset readiness gate ---------------------------------
   v121 originally stamped settlements and several animal families only when
   their asynchronous glTF load happened to be finished at the exact instant
   buildWorld ran. Entering Verdant quickly therefore made those objects vanish
   for the whole ride. This gate waits for the required library before calling
   the existing synchronous startRide/buildWorld pipeline. */
(function(){
  const BUILDINGS={
    stSide:'assets/models/station_side.gltf',
    sHang:'assets/models/station_hangar.gltf',
    sAnt:'assets/models/station_antenna.gltf',
    stGate:'assets/models/station_gate.gltf',
    sRef:'assets/models/station_refinery.gltf',
    cGate:'assets/models/city_gate.gltf',
    cDome:'assets/models/city_dome.gltf',
    cTower:'assets/models/city_tower.gltf',
    cArc:'assets/models/city_arcology.gltf',
    cSpire:'assets/models/city_spire_pair.gltf',
    cClu:'assets/models/city_cluster.gltf',
    sRing:'assets/models/station_ring.gltf'
  };
  const CREATURES={
    stag:['assets/models/creature_stag.gltf',{pose:stagPose,head:['Neck','Head'],N:16}],
    jelly:['assets/models/creature_jelly.gltf',{}],
    bird:['assets/models/bird_kestrel.gltf',{pose:birdPose,N:16}],
    bird2:['assets/models/bird_gull.gltf',{pose:birdPose,N:16}],
    bird3:['assets/models/bird_finch.gltf',{pose:birdPose,N:16}],
    bird4:['assets/models/bird_ray.gltf',{pose:birdPose,N:16}],
    cat:['assets/models/creature_cat.gltf',{pose:stagPose,head:['Neck','Head'],N:16}],
    dfly:['assets/models/creature_dragonfly.gltf',{pose:birdPose,N:12}],
    vbear:['assets/models/verdant_bear.gltf',{}],
    vfrog:['assets/models/verdant_frog.gltf',{}],
    vmonkey:['assets/models/verdant_monkey.gltf',{}],
    vship:['assets/models/verdant_ship.gltf',{}]
  };

  const status=()=>{
    const mb=[],mc=[];
    for(const k in BUILDINGS)if(!GLTREES||!GLTREES[k]||!GLTREES[k].prims||!GLTREES[k].prims.length)mb.push(k);
    for(const k in CREATURES)if(!GLCRE||!GLCRE[k]||!GLCRE[k].ready)mc.push(k);
    return {missingBuildings:mb,missingCreatures:mc,
      total:Object.keys(BUILDINGS).length+Object.keys(CREATURES).length,
      ready:Object.keys(BUILDINGS).length+Object.keys(CREATURES).length-mb.length-mc.length};
  };

  let waiting=null,retried=false;
  const retryMissing=s=>{
    if(retried)return;
    retried=true;
    /* A normal startup already requested every file. Retry only what is still
       absent after several seconds, covering a transient fetch/decode failure. */
    for(const k of s.missingBuildings){
      const f=BUILDINGS[k];
      try{loadGLTFStatic(k,f,1);}catch(e){}
    }
    for(const k of s.missingCreatures){
      const c=CREATURES[k];
      try{loadGLTFCreature(k,c[0],c[1]);}catch(e){}
    }
  };

  const waitForAssets=()=>{
    const now=status();
    if(!now.missingBuildings.length&&!now.missingCreatures.length)return Promise.resolve({...now,complete:true});
    if(waiting)return waiting;
    const t0=performance.now();retried=false;
    waiting=new Promise(resolve=>{
      const tick=()=>{
        const s=status(),elapsed=performance.now()-t0;
        const bar=typeof $==='function'&&$('loadBar');
        if(bar){const frac=s.total? s.ready/s.total:1;bar.style.width=(8+frac*27).toFixed(1)+'%';}
        const txt=typeof $==='function'&&$('loadTxt');
        if(txt)txt.textContent='Loading wildlife & settlements '+s.ready+'/'+s.total;
        if(!s.missingBuildings.length&&!s.missingCreatures.length){
          waiting=null;resolve({...s,complete:true,elapsed});return;
        }
        if(elapsed>4200&&!retried)retryMissing(s);
        if(elapsed>18000){
          console.warn('Verdant asset gate timed out; continuing with available assets',s);
          waiting=null;resolve({...s,complete:false,elapsed});return;
        }
        setTimeout(tick,90);
      };
      tick();
    });
    return waiting;
  };

  const install=()=>{
    if(typeof startRide!=='function'||startRide.__verdantGateV123)return;
    const originalStartRide=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant')return originalStartRide(sc,resume);
      const s=status();
      if(!s.missingBuildings.length&&!s.missingCreatures.length)return originalStartRide(sc,resume);

      /* Show feedback immediately. Audio also gets its browser-required user
         gesture now, before the asynchronous wait. */
      try{readSetup();if(cfg.sound)audioStart();}catch(e){}
      try{
        $('menu').classList.add('hide');$('loading').classList.add('on');
        $('loadBar').style.width='8%';$('loadTxt').textContent='Loading wildlife & settlements';
      }catch(e){}
      waitForAssets().then(result=>{
        window.__verdantAssetGateV123=result;
        try{$('loadTxt').textContent='Building the world';}catch(e){}
        originalStartRide(sc,resume);
      });
    };
    gated.__verdantGateV123=true;
    startRide=gated;
    window.__verdantAssetStatusV123=status;
  };

  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})();
