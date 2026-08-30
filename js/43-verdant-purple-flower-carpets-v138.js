"use strict";

/* Verdant Rift v138 — dense purple flower carpets -------------------------
   Reuse the existing Flower_4_Group imported model and add only large,
   natural-looking flower fields.  Thousands of transforms remain GPU-
   instanced, are distributed in oval patches, and are rejected if they enter
   the asphalt/shoulder exclusion zone.  No trees, wildlife, terrain or sky
   are changed here. */
(function(){
  const TAU=6.283185307179586;
  const TARGET_TOTAL=7110;
  const PATCHES=[
    {km:.95,side: 1,count:420,span:.14,near:8,far:32},
    {km:2.70,side:-1,count:520,span:.16,near:9,far:38},
    {km:5.25,side: 1,count:600,span:.18,near:8,far:34},
    {km:7.45,side:-1,count:520,span:.16,near:8,far:36},
    {km:9.85,side: 1,count:720,span:.20,near:7,far:38},
    {km:12.15,side:-1,count:760,span:.20,near:7,far:36},
    {km:14.60,side: 1,count:650,span:.18,near:9,far:42},
    {km:17.00,side:-1,count:720,span:.20,near:9,far:40},
    {km:19.55,side: 1,count:600,span:.17,near:8,far:38},
    {km:21.60,side:-1,count:620,span:.18,near:8,far:36},
    {km:23.50,side: 1,count:540,span:.16,near:7,far:34},
    {km:24.55,side:-1,count:440,span:.14,near:8,far:32}
  ];

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready||
       !w.instNature.models||!w.instNature.models.flower4||!w.instNature.groups||
       !w._dbg||typeof w._dbg.roadNear!=='function')return w;

    const rr=mulberry32(sc.seed+138043),nearRoad=w._dbg.roadNear;
    const routeKm=w.instNature.routeKm||((w.lapLen||25000)/1000),n=w.nMain;
    const instances=[],patchStats=[];

    const routePose=(km,off)=>{
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };

    for(const p of PATCHES){
      let placed=0,tries=0;
      while(placed<p.count&&tries<p.count*5){
        tries++;
        /* Uniform point in an ellipse: long axis follows the route, short
           axis spreads away from it.  This creates fields, not grid rows. */
        const a=rr()*TAU,r=Math.sqrt(rr());
        const dkm=Math.cos(a)*r*p.span*.5;
        const mid=(p.near+p.far)*.5,half=(p.far-p.near)*.5;
        const off=p.side*(mid+Math.sin(a)*r*half);
        const q=routePose(p.km+dkm,off),road=nearRoad(q.x,q.z);
        if(road&&road.i>=0&&road.i<n){
          const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(road.i):3.35;
          /* Wider than the old flower margin: carpets must visibly stop before
             the asphalt and shoulder, even on hairpins where another road leg
             is closer than the leg used to place the flower. */
          if(road.d<ww+4.2)continue;
        }
        const y=w.meshH(q.x,q.z)-.045;
        const scale=.18+rr()*.18;
        instances.push(q.km,q.x,y,q.z,rr()*TAU,scale);
        placed++;
      }
      patchStats.push({km:p.km,side:p.side,target:p.count,placed,tries});
    }

    const key='flower4CarpetV138';
    w.instNature.models[key]=w.instNature.models.flower4;
    w.instNature.groups[key]={kind:'flowers',range:.78,instances};
    if(w.instNature.stats){
      w.instNature.stats.flowers=(w.instNature.stats.flowers||0)+instances.length/6;
      w.instNature.stats.total=(w.instNature.stats.total||0)+instances.length/6;
    }
    w.__verdantPurpleCarpetsV138={patches:PATCHES.length,targetTotal:TARGET_TOTAL,
      totalPlaced:instances.length/6,roadMargin:4.2,model:'Flower_4_Group.gltf',patchStats};
    return w;
  };

  if(typeof globalThis!=='undefined'){
    globalThis.__verdantPurpleCarpetPatchesV138=PATCHES;
    globalThis.__verdantPurpleCarpetTargetV138=TARGET_TOTAL;
  }
})();
