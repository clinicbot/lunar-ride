"use strict";

/* Verdant Rift v139 — mega purple flower carpets --------------------------
   Keep the user-approved v138 Flower_4_Group look, but spread it across the
   empty green plains much more aggressively.  Compared with v138 this layer
   uses 4x as many patches (48 vs 12), about 4x the area per patch, and 4x the
   instances per patch so density is preserved.  Flowers are allowed to grow
   almost to the asphalt: estimated outer flower geometry stops ~10 cm from
   the nearest road edge.  Everything remains one GPU-instanced model group;
   no trees, wildlife, terrain, buildings or sky are changed. */
(function(){
  const TAU=6.283185307179586;
  const NOMINAL_ROUTE_KM=25;
  const PATCH_COUNT=48;
  const TARGET_TOTAL=113760; // 7110 (v138) * 4 patches * 4 instances/patch area
  const ROAD_EDGE_GAP=.10;  // metres from visible flower edge to asphalt edge
  const FLOWER_RADIUS_FACTOR=.80; // Flower_4_Group max horizontal radius / scale

  /* These are the twelve approved v138 patch profiles.  v139 repeats their
     density/shape palette four times around the lap, but places the 48 patch
     centres evenly so previously bare green plains are much more likely to be
     covered.  Doubling both ellipse axes gives ~4x area per patch. */
  const BASE=[
    {count:420,span:.14,near:8,far:32},
    {count:520,span:.16,near:9,far:38},
    {count:600,span:.18,near:8,far:34},
    {count:520,span:.16,near:8,far:36},
    {count:720,span:.20,near:7,far:38},
    {count:760,span:.20,near:7,far:36},
    {count:650,span:.18,near:9,far:42},
    {count:720,span:.20,near:9,far:40},
    {count:600,span:.17,near:8,far:38},
    {count:620,span:.18,near:8,far:36},
    {count:540,span:.16,near:7,far:34},
    {count:440,span:.14,near:8,far:32}
  ];
  const PATCHES=Array.from({length:PATCH_COUNT},(_,i)=>{
    const b=BASE[i%BASE.length];
    const oldWidth=b.far-b.near;
    return {
      km:(i+.5)*NOMINAL_ROUTE_KM/PATCH_COUNT,
      side:(i&1)?-1:1,
      count:b.count*4,
      span:b.span*2,
      near:0,
      far:oldWidth*2
    };
  });

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready||
       !w.instNature.models||!w.instNature.models.flower4||!w.instNature.groups||
       !w._dbg||typeof w._dbg.roadNear!=='function')return w;

    const rr=mulberry32(sc.seed+139044),nearRoad=w._dbg.roadNear;
    const routeKm=w.instNature.routeKm||((w.lapLen||25000)/1000),n=w.nMain;
    const instances=[],patchStats=[];

    const routePose=(km,off)=>{
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };

    for(const p of PATCHES){
      let placed=0,tries=0,rejectedRoad=0;
      while(placed<p.count&&tries<p.count*8){
        tries++;
        /* Uniform point in an ellipse.  Long axis follows the route; short
           axis fills the neighbouring plain all the way toward the road. */
        const a=rr()*TAU,r=Math.sqrt(rr());
        const dkm=Math.cos(a)*r*p.span*.5;
        const mid=(p.near+p.far)*.5,half=(p.far-p.near)*.5;
        const off=p.side*(mid+Math.sin(a)*r*half);
        const q=routePose(p.km+dkm,off);
        const scale=.18+rr()*.18;
        const road=nearRoad(q.x,q.z);
        if(road&&road.i>=0&&road.i<n){
          const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(road.i):3.35;
          /* road.d is centre-line distance.  Add the estimated flower radius
             so the visible plant edge, not merely its centre, stays 10 cm
             outside the asphalt edge.  This also protects nearby hairpins. */
          const plantRadius=FLOWER_RADIUS_FACTOR*scale;
          if(road.d<ww+ROAD_EDGE_GAP+plantRadius){rejectedRoad++;continue;}
        }
        const y=w.meshH(q.x,q.z)-.045;
        instances.push(q.km,q.x,y,q.z,rr()*TAU,scale);
        placed++;
      }
      patchStats.push({km:p.km,side:p.side,target:p.count,placed,tries,rejectedRoad,
        span:p.span,far:p.far});
    }

    const key='flower4MegaCarpetV139';
    w.instNature.models[key]=w.instNature.models.flower4;
    w.instNature.groups[key]={kind:'flowers',range:.95,instances};
    if(w.instNature.stats){
      w.instNature.stats.flowers=(w.instNature.stats.flowers||0)+instances.length/6;
      w.instNature.stats.total=(w.instNature.stats.total||0)+instances.length/6;
    }
    w.__verdantPurpleCarpetsV139={patches:PATCHES.length,targetTotal:TARGET_TOTAL,
      totalPlaced:instances.length/6,roadEdgeGap:ROAD_EDGE_GAP,
      flowerRadiusFactor:FLOWER_RADIUS_FACTOR,model:'Flower_4_Group.gltf',patchStats};
    return w;
  };

  if(typeof globalThis!=='undefined'){
    globalThis.__verdantPurpleCarpetPatchesV139=PATCHES;
    globalThis.__verdantPurpleCarpetTargetV139=TARGET_TOTAL;
    globalThis.__verdantPurpleCarpetRoadGapV139=ROAD_EDGE_GAP;
  }
})();
