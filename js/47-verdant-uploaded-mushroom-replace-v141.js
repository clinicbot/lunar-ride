"use strict";

/* Verdant Rift v141 — replace v140's generic mushrooms with the exact
   user-uploaded mushroom. Wildlife, cats, stags and buildings from v140 are
   deliberately untouched. No mushroom-tree scaling is used. */
(function(){
  const HERO_TARGET=240,PATCH_TARGET=2400,TAU=Math.PI*2;
  const HERO_SCALE_MIN=1.00,HERO_SCALE_MAX=1.80;
  const PATCH_SCALE_MIN=.35,PATCH_SCALE_MAX=.90;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.instNature||!w.instNature.groups||!w.instNature.models)return w;
    const model=globalThis.__verdantUploadedMushroomModelV141;
    if(!model||!model.count){
      w.__verdantMushroomV141={ready:false,reason:'uploaded model unavailable'};
      return w;
    }

    const groups=w.instNature.groups,models=w.instNature.models,stats=w.instNature.stats||null;
    let removed=0;
    for(const key of ['mushroomGiantV140','mushroomPatchV140']){
      const g=groups[key];if(g&&g.instances)removed+=g.instances.length/6;
      delete groups[key];delete models[key];
    }
    if(stats&&removed){
      stats.mushrooms=Math.max(0,(stats.mushrooms||0)-removed);
      stats.total=Math.max(0,(stats.total||0)-removed);
    }

    /* Also replace the small pre-v140 Mushroom_Common render model so every
       visible Verdant mushroom now uses the user's supplied mushroom shape. */
    if(groups.mushroom)models.mushroom=model;

    const rr=mulberry32((sc.seed||0)+141031),n=w.nMain,L=w.lapLen/1000;
    const near=w._dbg&&typeof w._dbg.roadNear==="function"?w._dbg.roadNear:null;
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };
    const canPlace=(q,scale)=>{
      if(!near)return true;
      const r=near(q.x,q.z);if(!r||r.i<0||r.i>=n)return true;
      const half=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(r.i):3.35;
      return r.d>=half+.45*scale+.25;
    };
    const add=(arr,km,off,sMin,sMax)=>{
      const q=routePose(km,off),scale=sMin+rr()*(sMax-sMin);if(!canPlace(q,scale))return false;
      arr.push(q.km,q.x,w.meshH(q.x,q.z)-.02,q.z,rr()*TAU,scale);return true;
    };

    const hero=[],patch=[];let h=0,p=0,tries=0;
    while(h<HERO_TARGET&&tries<HERO_TARGET*16){
      const j=tries++,grove=Math.floor(j/12),base=(.48+grove*1.11)%L,side=grove%2?-1:1;
      if(add(hero,base+(rr()-.5)*.18,side*(6+rr()*24),HERO_SCALE_MIN,HERO_SCALE_MAX))h++;
    }
    tries=0;
    while(p<PATCH_TARGET&&tries<PATCH_TARGET*10){
      const j=tries++,grove=Math.floor(j/100),base=(.22+grove*.78)%L,side=grove%2?-1:1;
      if(add(patch,base+(rr()-.5)*.28,side*(4+rr()*22),PATCH_SCALE_MIN,PATCH_SCALE_MAX))p++;
    }

    models.mushroomHeroV141=model;models.mushroomPatchV141=model;
    groups.mushroomHeroV141={kind:'mushrooms',range:1.25,instances:hero};
    groups.mushroomPatchV141={kind:'mushrooms',range:.92,instances:patch};
    if(stats){stats.mushrooms=(stats.mushrooms||0)+h+p;stats.total=(stats.total||0)+h+p;}

    const telemetry={ready:true,asset:model.file||'assets/models/verdant_mushroom_uploaded_v141.gltf',
      source:'user-uploaded-glb',optimizedTriangles:model.triangles||223,
      removedV140Generic:removed,heroTarget:HERO_TARGET,heroes:h,patchTarget:PATCH_TARGET,patches:p,
      heroScale:[HERO_SCALE_MIN,HERO_SCALE_MAX],patchScale:[PATCH_SCALE_MIN,PATCH_SCALE_MAX],mushroomTrees:false};
    w.__verdantMushroomV141=telemetry;
    if(w.__verdantExpansionV140&&w.__verdantExpansionV140.mushrooms)
      w.__verdantExpansionV140.mushrooms.replacedByV141=true;
    console.log('Verdant v141 uploaded mushroom replacement:',telemetry);
    return w;
  };

  globalThis.__verdantMushroomV141Spec={HERO_TARGET,PATCH_TARGET,HERO_SCALE_MIN,HERO_SCALE_MAX,PATCH_SCALE_MIN,PATCH_SCALE_MAX};
})();
