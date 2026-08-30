"use strict";

/* Verdant Rift v142 — user visual corrections -----------------------------
   1) Every visible mushroom is exactly 25% of its v141 scale.
   2) Each approved v139 carpet zone becomes a bilateral green-ground blanket:
      both sides of the road, extending far up neighbouring hillsides.
   3) Flower blankets are deterministically random-mixed 25/25/25/25 between
      the original colour, purple, blue and red while keeping green foliage.
   4) Bears are restored to 14 total (2x the previous 7-bear population).
   Snow is excluded and global nearest-road clipping is retained.
   Buildings, cats, dragonflies, deer, trees, terrain, road and sky are not
   otherwise modified. */
(function(){
  const TAU=Math.PI*2;
  const MUSHROOM_SCALE_FACTOR=.25;
  const CARPET_COUNT_MULTIPLIER=1.15;
  const CARPET_SPAN_MULTIPLIER=1.35;
  const CARPET_MIN_FAR=170;
  const CARPET_FAR_MULTIPLIER=3;
  const ROAD_EDGE_GAP=.10;
  const FLOWER_RADIUS_FACTOR=.80;
  const FLOWER_SCALE_MIN=.26;
  const FLOWER_SCALE_MAX=.56;
  const SNOW_ZONE=7;
  const GOLDEN=2.399963229728653;
  const BEAR_TARGET=14;
  const FLOWER_KEYS=[
    'flower4HillsideCurrentV142','flower4HillsidePurpleV142',
    'flower4HillsideBlueV142','flower4HillsideRedV142'
  ];
  const FLOWER_LABELS=['current','purple','blue','red'];
  const FLOWER_TINTS=[null,[.78,.22,.95],[.18,.55,1.0],[1.0,.18,.20]];
  const BEAR_SITES=[
    [3.35,-26],[18.05,27],[4.05,22],[18.85,-22],[4.75,-19],[19.65,31],[5.45,29],
    [20.45,-18],[5.95,-23],[21.15,25],[23.20,-29],[3.70,18],[20.90,20],[24.10,28]
  ];
  const BEAR_META={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};

  function tintedFlowerModel(base,tint){
    if(!tint)return base;
    const src=base.col||new Float32Array(0),col=new Float32Array(src);
    for(let i=0;i+2<col.length;i+=3){
      const r=src[i],g=src[i+1],b=src[i+2];
      /* Preserve clearly green leaf/stem vertices.  Only flower/non-green
         material is recoloured, so the result reads as coloured blossoms on
         the same plant instead of whole purple/blue/red bushes. */
      const leafy=g>r*1.12&&g>b*1.08&&g>.12;
      if(leafy)continue;
      const lum=Math.max(.16,Math.min(1,.299*r+.587*g+.114*b));
      const k=.48+.72*lum;
      col[i]=Math.min(1,tint[0]*k);
      col[i+1]=Math.min(1,tint[1]*k);
      col[i+2]=Math.min(1,tint[2]*k);
    }
    return {...base,col};
  }

  function shuffledColourBag(n,rr){
    const a=Array.from({length:n},(_,i)=>i&3);
    for(let i=a.length-1;i>0;i--){const j=Math.floor(rr()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}
    return a;
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.groups||!w.instNature.models)return w;

    const groups=w.instNature.groups,models=w.instNature.models,stats=w.instNature.stats||null;

    /* Mushroom correction: quarter the rendered scale of every current
       mushroom instance, including baseline and uploaded-v141 groups. */
    let mushroomInstances=0,mushroomGroups=0;
    for(const key of Object.keys(groups)){
      if(!/^mushroom/i.test(key))continue;
      const a=groups[key]&&groups[key].instances;if(!a)continue;
      mushroomGroups++;
      for(let i=5;i<a.length;i+=6){a[i]*=MUSHROOM_SCALE_FACTOR;mushroomInstances++;}
    }

    /* Remove the old one-sided v139 group and rebuild the same flowering
       regions on BOTH sides, over the actual terrain height and up hills. */
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
    const colourInstances=[[],[],[],[]],colourCounts=[0,0,0,0],patchStats=[];

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
          const bag=shuffledColourBag(target,rr),localColours=[0,0,0,0];
          /* Golden-angle low-discrepancy positions give broad continuous
             coverage; the separate shuffled colour bag makes the four flower
             colours look naturally intermixed instead of forming stripes. */
          while(placed<target&&tries<target*5){
            const j=tries++,r=Math.sqrt((j%target+.5)/target);
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
            const y=w.meshH(q.x,q.z)-.045,ci=bag[placed];
            colourInstances[ci].push(q.km,q.x,y,q.z,rr()*TAU,scale);
            colourCounts[ci]++;localColours[ci]++;placed++;
          }
          patchStats.push({km:p.km,side,target,placed,tries,rejectedRoad,rejectedGround,span,far,colours:localColours});
        }
      }
    }

    let carpetInstances=0;
    if(flowerModel){
      for(let ci=0;ci<4;ci++){
        const a=colourInstances[ci];if(!a.length)continue;
        const key=FLOWER_KEYS[ci];
        models[key]=tintedFlowerModel(flowerModel,FLOWER_TINTS[ci]);
        groups[key]={kind:'flowers',range:1.15,instances:a};
        carpetInstances+=a.length/6;
      }
      if(stats&&carpetInstances){
        stats.flowers=(stats.flowers||0)+carpetInstances;
        stats.total=(stats.total||0)+carpetInstances;
      }
    }

    /* Bears: the approved pre-expansion world contained seven.  Restore a
       deterministic 14 total, distributed between forest and alpine/descent
       areas.  Existing bears are kept; only the missing number is added. */
    const actors=w.actors||[],bearsBefore=actors.filter(a=>a&&(a.type==='bear'||a.gcre==='vbear')).length;
    let bearsAdded=0;
    for(let b=bearsBefore;b<BEAR_TARGET;b++){
      const s=BEAR_SITES[bearsAdded%BEAR_SITES.length],q=routePose(s[0],s[1]),ph=rr()*TAU;
      const useGL=typeof GLCRE!=='undefined'&&GLCRE&&GLCRE.vbear&&GLCRE.vbear.ready;
      const a={type:'bear',px:q.x,py:w.meshH(q.x,q.z),pz:q.z,yaw:rr()*TAU,k:1.10+rr()*.35,emiss:1,
        meta:BEAR_META,ph,hx:q.x,hz:q.z,wr:2.2,wander:ph,wspd:(b&1?-1:1)*.05,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,v142:true};
      if(useGL)a.gcre='vbear';
      actors.push(a);bearsAdded++;
    }
    w.actors=actors;
    const bearsFinal=actors.filter(a=>a&&(a.type==='bear'||a.gcre==='vbear')).length;

    const telemetry={
      mushroomScaleFactor:MUSHROOM_SCALE_FACTOR,mushroomGroups,mushroomInstances,
      oldCarpetInstances:oldCount,patchCentres:PATCHES.length,sidesPerPatch:2,
      carpetInstances,minFar:CARPET_MIN_FAR,farMultiplier:CARPET_FAR_MULTIPLIER,
      spanMultiplier:CARPET_SPAN_MULTIPLIER,countMultiplier:CARPET_COUNT_MULTIPLIER,
      snowExcluded:true,roadEdgeGap:ROAD_EDGE_GAP,flowerScale:[FLOWER_SCALE_MIN,FLOWER_SCALE_MAX],
      flowerColourLabels:FLOWER_LABELS,flowerColourCounts:colourCounts,
      bearsBefore,bearTarget:BEAR_TARGET,bearsAdded,bearsFinal,patchStats
    };
    w.__verdantVisualFixV142=telemetry;
    if(w.__verdantPurpleCarpetsV139)w.__verdantPurpleCarpetsV139.replacedByV142=true;
    if(w.__verdantMushroomV141)w.__verdantMushroomV141.scaleCorrectedByV142=MUSHROOM_SCALE_FACTOR;
    console.log('Verdant v142 mushroom/carpet/bear correction:',telemetry);
    return w;
  };

  globalThis.__verdantVisualFixV142Spec={MUSHROOM_SCALE_FACTOR,CARPET_COUNT_MULTIPLIER,
    CARPET_SPAN_MULTIPLIER,CARPET_MIN_FAR,CARPET_FAR_MULTIPLIER,FLOWER_SCALE_MIN,FLOWER_SCALE_MAX,
    SNOW_ZONE,BEAR_TARGET,FLOWER_KEYS,FLOWER_LABELS};
})();
