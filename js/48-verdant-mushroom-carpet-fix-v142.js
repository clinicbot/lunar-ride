"use strict";

/* Verdant Rift v142 — user visual corrections -----------------------------
   1) Every visible mushroom is exactly 25% of its v141 scale.
   2) Each approved v139 purple-carpet zone becomes a bilateral green-ground
      blanket: both sides of the road, extending far up neighbouring hillsides.
      Snow is excluded and global nearest-road clipping is retained.
   No wildlife, buildings, trees, terrain, road or sky are modified. */
(function(){
  const TAU=Math.PI*2;
  const MUSHROOM_SCALE_FACTOR=.25;
  const CARPET_COUNT_MULTIPLIER=1.15;
  const CARPET_SPAN_MULTIPLIER=1.35;
  const CARPET_MIN_FAR=170;      // metres from road centre, enough to climb visible hillsides
  const CARPET_FAR_MULTIPLIER=3; // also scales the approved v139 patch width
  const ROAD_EDGE_GAP=.10;
  const FLOWER_RADIUS_FACTOR=.80;
  const FLOWER_SCALE_MIN=.26;
  const FLOWER_SCALE_MAX=.56;
  const SNOW_ZONE=7;
  const GOLDEN=2.399963229728653;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.groups||!w.instNature.models)return w;

    const groups=w.instNature.groups,models=w.instNature.models,stats=w.instNature.stats||null;

    /* Mushroom correction: quarter the rendered scale of every current
       mushroom instance, including the older baseline Mushroom_Common group
       and the two v141 uploaded-mushroom groups. */
    let mushroomInstances=0,mushroomGroups=0;
    for(const key of Object.keys(groups)){
      if(!/^mushroom/i.test(key))continue;
      const a=groups[key]&&groups[key].instances;if(!a)continue;
      mushroomGroups++;
      for(let i=5;i<a.length;i+=6){a[i]*=MUSHROOM_SCALE_FACTOR;mushroomInstances++;}
    }

    /* Replace the one-sided v139 carpet group with a much wider paired
       blanket.  We reuse the exact Flower_4_Group model and the approved v139
       patch centres/profiles, but generate BOTH sides for every centre. */
    const oldKey='flower4MegaCarpetV139',old=groups[oldKey];
    const oldCount=old&&old.instances?old.instances.length/6:0;
    if(oldCount&&stats){
      stats.flowers=Math.max(0,(stats.flowers||0)-oldCount);
      stats.total=Math.max(0,(stats.total||0)-oldCount);
    }
    delete groups[oldKey];delete models[oldKey];

    const PATCHES=globalThis.__verdantPurpleCarpetPatchesV139||[];
    const flowerModel=models.flower4;
    const nearRoad=w._dbg&&typeof w._dbg.roadNear==='function'?w._dbg.roadNear:null;
    const routeKm=w.instNature.routeKm||((w.lapLen||25000)/1000),n=w.nMain;
    const rr=mulberry32((sc.seed||0)+142048);
    const instances=[],patchStats=[];

    const routePose=(km,off)=>{
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };
    const greenAt=(q,road)=>{
      const i=road&&road.i>=0&&road.i<n?road.i:q.i;
      if(w.verdant&&typeof w.verdant.zoneAt==='function'&&w.verdant.zoneAt(i)===SNOW_ZONE)return false;
      const y=w.meshH(q.x,q.z);
      if(Number.isFinite(w.waterY)&&y<=w.waterY+.08)return false;
      return true;
    };

    if(flowerModel&&PATCHES.length&&nearRoad){
      for(const p of PATCHES){
        const span=p.span*CARPET_SPAN_MULTIPLIER;
        const far=Math.max(CARPET_MIN_FAR,p.far*CARPET_FAR_MULTIPLIER);
        const target=Math.max(1,Math.round(p.count*CARPET_COUNT_MULTIPLIER));
        for(const side of [-1,1]){
          let placed=0,tries=0,rejectedRoad=0,rejectedGround=0;
          /* Golden-angle low-discrepancy ellipse: much more even than purely
             random scatter, so the green surface reads as one continuous
             flower blanket instead of isolated circular clumps. */
          while(placed<target&&tries<target*5){
            const j=tries++,u=(j+.5)/(target*5),r=Math.sqrt((j%target+.5)/target);
            const a=j*GOLDEN+rr()*.08;
            const dkm=Math.cos(a)*r*span*.5;
            const offMag=(.015+Math.abs(Math.sin(a))*r*.985)*far;
            const q=routePose(p.km+dkm,side*offMag);
            const scale=FLOWER_SCALE_MIN+rr()*(FLOWER_SCALE_MAX-FLOWER_SCALE_MIN);
            const road=nearRoad(q.x,q.z);
            if(road&&road.i>=0&&road.i<n){
              const ww=w.verdant&&typeof w.verdant.widthAt==='function'?w.verdant.widthAt(road.i):3.35;
              const plantRadius=FLOWER_RADIUS_FACTOR*scale;
              if(road.d<ww+ROAD_EDGE_GAP+plantRadius){rejectedRoad++;continue;}
            }
            if(!greenAt(q,road)){rejectedGround++;continue;}
            const y=w.meshH(q.x,q.z)-.045;
            instances.push(q.km,q.x,y,q.z,rr()*TAU,scale);placed++;
          }
          patchStats.push({km:p.km,side,target,placed,tries,rejectedRoad,rejectedGround,span,far});
        }
      }
    }

    const newKey='flower4GreenHillsideBlanketV142';
    if(flowerModel&&instances.length){
      models[newKey]=flowerModel;
      groups[newKey]={kind:'flowers',range:1.15,instances};
      if(stats){
        stats.flowers=(stats.flowers||0)+instances.length/6;
        stats.total=(stats.total||0)+instances.length/6;
      }
    }

    const telemetry={
      mushroomScaleFactor:MUSHROOM_SCALE_FACTOR,mushroomGroups,mushroomInstances,
      oldCarpetInstances:oldCount,patchCentres:PATCHES.length,sidesPerPatch:2,
      carpetInstances:instances.length/6,minFar:CARPET_MIN_FAR,farMultiplier:CARPET_FAR_MULTIPLIER,
      spanMultiplier:CARPET_SPAN_MULTIPLIER,countMultiplier:CARPET_COUNT_MULTIPLIER,
      snowExcluded:true,roadEdgeGap:ROAD_EDGE_GAP,flowerScale:[FLOWER_SCALE_MIN,FLOWER_SCALE_MAX],patchStats
    };
    w.__verdantVisualFixV142=telemetry;
    if(w.__verdantPurpleCarpetsV139)w.__verdantPurpleCarpetsV139.replacedByV142=true;
    if(w.__verdantMushroomV141)w.__verdantMushroomV141.scaleCorrectedByV142=MUSHROOM_SCALE_FACTOR;
    console.log('Verdant v142 mushroom/carpet correction:',telemetry);
    return w;
  };

  globalThis.__verdantVisualFixV142Spec={MUSHROOM_SCALE_FACTOR,CARPET_COUNT_MULTIPLIER,
    CARPET_SPAN_MULTIPLIER,CARPET_MIN_FAR,CARPET_FAR_MULTIPLIER,FLOWER_SCALE_MIN,FLOWER_SCALE_MAX,SNOW_ZONE};
})();
