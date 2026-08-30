"use strict";

/* Verdant Rift v129 — asset readiness gate ---------------------------------
   The original v123 gate waited for creatures and settlements, but not the
   imported nature parser. Entering Verdant while nature was still decoding
   made the whole ride fall back to the old triangular billboard forest.
   v129 waits for nature settlement too, then calls the synchronous world
   builder only after every requested nature model has settled. */
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

  const natureStatus=()=>{
    try{
      if(typeof window!=='undefined'&&typeof window.__verdantNatureStatusV129==='function')
        return window.__verdantNatureStatusV129();
    }catch(e){}
    return {started:false,total:0,settled:0,ready:0,failed:0,complete:false,coreReady:false};
  };
  const status=()=>{
    const mb=[],mc=[];
    for(const k in BUILDINGS)if(!GLTREES||!GLTREES[k]||!GLTREES[k].prims||!GLTREES[k].prims.length)mb.push(k);
    for(const k in CREATURES)if(!GLCRE||!GLCRE[k]||!GLCRE[k].ready)mc.push(k);
    const ns=natureStatus(),baseTotal=Object.keys(BUILDINGS).length+Object.keys(CREATURES).length;
    const baseReady=baseTotal-mb.length-mc.length;
    return {missingBuildings:mb,missingCreatures:mc,nature:ns,
      total:baseTotal+(ns.total||0),ready:baseReady+(ns.settled||0),
      natureComplete:!!ns.complete,natureCoreReady:!!ns.coreReady};
  };

  let waiting=null,retried=false;
  const retryMissing=s=>{
    if(retried)return;
    retried=true;
    for(const k of s.missingBuildings){
      const f=BUILDINGS[k];
      try{loadGLTFStatic(k,f,1);}catch(e){}
    }
    for(const k of s.missingCreatures){
      const c=CREATURES[k];
      try{loadGLTFCreature(k,c[0],c[1]);}catch(e){}
    }
    try{
      if(typeof window.__verdantNatureWaitV129==='function')window.__verdantNatureWaitV129();
    }catch(e){}
  };

  const allReady=s=>!s.missingBuildings.length&&!s.missingCreatures.length&&s.natureComplete;
  const waitForAssets=()=>{
    try{if(typeof window.__verdantNatureWaitV129==='function')window.__verdantNatureWaitV129();}catch(e){}
    const now=status();
    if(allReady(now))return Promise.resolve({...now,complete:true});
    if(waiting)return waiting;
    const t0=performance.now();retried=false;
    waiting=new Promise(resolve=>{
      const tick=()=>{
        const s=status(),elapsed=performance.now()-t0;
        const bar=typeof $==='function'&&$('loadBar');
        if(bar){const frac=s.total? s.ready/s.total:1;bar.style.width=(8+frac*27).toFixed(1)+'%';}
        const txt=typeof $==='function'&&$('loadTxt');
        if(txt)txt.textContent='Loading wildlife, nature & settlements '+s.ready+'/'+s.total;
        if(allReady(s)){
          waiting=null;resolve({...s,complete:true,elapsed});return;
        }
        if(elapsed>5000&&!retried)retryMissing(s);
        if(elapsed>24000){
          console.warn('Verdant v129 asset gate timed out; continuing without legacy billboards',s);
          waiting=null;resolve({...s,complete:false,elapsed});return;
        }
        setTimeout(tick,90);
      };
      tick();
    });
    return waiting;
  };

  const install=()=>{
    if(typeof startRide!=='function'||startRide.__verdantGateV129)return;
    const originalStartRide=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant')return originalStartRide(sc,resume);
      const s=status();
      if(allReady(s))return originalStartRide(sc,resume);

      try{readSetup();if(cfg.sound)audioStart();}catch(e){}
      try{
        $('menu').classList.add('hide');$('loading').classList.add('on');
        $('loadBar').style.width='8%';$('loadTxt').textContent='Loading wildlife, nature & settlements';
      }catch(e){}
      waitForAssets().then(result=>{
        window.__verdantAssetGateV129=result;
        try{$('loadTxt').textContent='Building the world';}catch(e){}
        originalStartRide(sc,resume);
      });
    };
    gated.__verdantGateV123=true;
    gated.__verdantGateV129=true;
    startRide=gated;
    window.__verdantAssetStatusV123=status;
    window.__verdantAssetStatusV129=status;
  };

  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})();
