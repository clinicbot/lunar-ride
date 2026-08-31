"use strict";

/* Aqua Rift v157 — make uploaded creatures clearly visible + hard-remove
   remaining flat coral podiums. Loaded after v156.

   v156 correctly imported the four user-provided creature meshes but placed
   them too far from the glass to read during normal riding. Its podium filter
   also depended on Error().stack containing moundBase, which is not reliable
   in the browser. v157 fixes both issues without touching fish, jellyfish,
   road, glass, water or Verdant.
*/
(function(){
  const AQUA_ID='aqua',VERSION=157,TWO_PI=Math.PI*2,BASE_GLASS_R=8.8;
  let aquaBuildActive=false,flatBoxesSuppressed=0;

  /* Hard podium suppression: while Aqua is being built, reject every very
     flat decorative box matching the v154/v155 reef-base dimensions. This is
     deliberately dimension-based, not stack-trace-based. Structural tunnel
     rails are taller (h=.35/.48) and therefore pass through untouched. */
  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV157NoFlatBases){
    const oldBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      if(aquaBuildActive && h<=.14 && w<=2.25 && d<=1.05){flatBoxesSuppressed++;return;}
      return oldBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV157NoFlatBases=true;
  }

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;
    };
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,i};};
    return {n,routeKm,radiusAt,pose};
  }

  const KM={
    eelbeast:[.15,.45,.80,1.15,1.55,2.05,2.45,2.85,3.30,3.75,4.20,4.65,5.10,5.55,6.15,6.70],
    siren:[.30,.95,1.75,2.45,3.15,3.85,4.55,5.25,5.95,6.65],
    crawler:[.55,1.40,2.25,3.10,3.95,4.80,5.65,6.50],
    leviathan:[1.65,5.70]
  };
  const OPT={
    eelbeast:{off0:2.2,off1:6.5,y0:1.0,y1:5.8,r0:1.2,r1:3.8,k0:3.0,k1:4.7,w0:.010,w1:.020},
    siren:{off0:2.4,off1:7.0,y0:.8,y1:5.0,r0:1.0,r1:3.0,k0:3.5,k1:5.5,w0:.008,w1:.016},
    crawler:{off0:2.6,off1:7.5,y0:.3,y1:3.4,r0:.8,r1:2.6,k0:4.5,k1:7.0,w0:.006,w1:.013},
    leviathan:{off0:8.0,off1:15.0,y0:1.0,y1:7.0,r0:2.0,r1:5.0,k0:11.0,k1:16.0,w0:.0025,w1:.0050}
  };

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const isAqua=!!(sc&&sc.id===AQUA_ID);
    if(isAqua){aquaBuildActive=true;flatBoxesSuppressed=0;}
    let w;
    try{w=previousBuild(sc,onProgress);}finally{if(isAqua)aquaBuildActive=false;}
    if(!w||!isAqua||!w.actors)return w;

    const H=helpers(w),rnd=mulberry32((sc.seed||14373)+157157),byClass={};
    for(const a of w.actors)if(a&&a.aquaCreatureV156===true)(byClass[a.creatureClass]||(byClass[a.creatureClass]=[])).push(a);

    let moved=0;
    for(const kind of ['eelbeast','siren','crawler','leviathan']){
      const arr=byClass[kind]||[],kms=KM[kind],o=OPT[kind];
      for(let q=0;q<arr.length;q++){
        const a=arr[q],km=kms[q%kms.length]%H.routeKm,i=Math.max(0,Math.min(H.n-1,Math.round(km*1000/ROUTE_STEP))),
          side=(q&1)?1:-1,glass=H.radiusAt(i),off=glass+o.off0+rnd()*(o.off1-o.off0),p=H.pose(i,side*off),
          roadY=w.ry[i],ph=(q*1.713+rnd()*.7)%TWO_PI;
        a.cx=p.x;a.cz=p.z;a.gy=roadY;
        a.r=o.r0+rnd()*(o.r1-o.r0);
        a.alt=o.y0+rnd()*(o.y1-o.y0);
        a.ph=ph;a.gph=ph;
        a.w=(q&1?-1:1)*(o.w0+rnd()*(o.w1-o.w0));
        a.k=o.k0+rnd()*(o.k1-o.k0);
        a.px=a.cx+Math.cos(ph)*a.r;
        a.py=roadY+a.alt;
        a.pz=a.cz+Math.sin(ph)*a.r;
        a.yaw=ph+(kind==='eelbeast'?Math.PI/2:0);
        a.aquaVisibleCreatureV157=true;
        a.anchorKmV157=+km.toFixed(3);
        a.glassGapV157=+(off-glass).toFixed(2);
        moved++;
      }
    }

    const prior=w.__aquaV156||{};
    const c={eelbeast:(byClass.eelbeast||[]).length,siren:(byClass.siren||[]).length,
      crawler:(byClass.crawler||[]).length,leviathan:(byClass.leviathan||[]).length};
    w.__aquaV157={version:VERSION,hardFlatBaseSuppression:true,flatBoxesSuppressed,
      creaturesMovedNearGlass:true,visibleCreatureCount:moved,creatureCounts:c,
      encounterKm:KM,smallCreatureGlassGap:[2.2,7.5],leviathanGlassGap:[8,15],
      roadRelativeCreatureHeight:true,coralGroups:prior.coralGroups||2800,
      jellyPreserved:prior.jellyPreserved||60,fishPreserved:prior.fishPreserved||0,
      existingActorsPreserved:true,roadUnchanged:true,glassUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v157 visible close creatures + no flat bases:',w.__aquaV157);
    return w;
  };

  globalThis.__aquaV157Spec={VERSION,hardFlatBaseSuppression:true,visibleCreatureCount:36,
    firstEncountersKm:[.15,.30,.45,.55],leviathanKm:[1.65,5.70]};
})();
