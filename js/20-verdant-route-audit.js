"use strict";

/* Verdant terrain-following elevation fit ---------------------------------
   The route folds back near itself in several places.  A kilometre-based
   artificial height profile can therefore put two physically adjacent roads
   tens of metres apart vertically and force the terrain into a cliff.  Fit
   the road primarily to the natural height field under its X/Z path instead,
   then circularly smooth only as much as necessary to satisfy the 8% riding
   grade.  This keeps nearby folds naturally compatible while retaining real
   climbs where the landscape itself rises. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant) return w;

    const n=w.nMain,oldRy=new Float32Array(w.ry);
    const landAt=w._dbg&&typeof w._dbg.landAt==='function'?w._dbg.landAt:null;
    const raw=new Float64Array(n);

    /* Keep only a small fraction of the old artistic profile as local flavour.
       The large-scale height comes from the actual terrain, so a folded route
       cannot arbitrarily be 100 m above the ground next to another section. */
    for(let i=0;i<n;i++){
      const land=landAt?landAt(w.rx[i],w.rz[i]):oldRy[i];
      const oldOff=oldRy[i]-land;
      raw[i]=land+clamp(oldOff*.10,-5,12);
    }

    /* Circular box filter.  Try progressively wider windows and choose the
       narrowest one that makes every sample legal.  Circular averaging has no
       privileged seam, unlike the old forward/backward clamp. */
    const radii=[3,6,10,16,24,36,52,72,96,128,168,220];
    const smoothCircular=(src,r)=>{
      const out=new Float64Array(n),pref=new Float64Array(n*2+1);
      for(let k=0;k<n*2;k++)pref[k+1]=pref[k]+src[k%n];
      const span=r*2+1;
      for(let i=0;i<n;i++){
        const c=i+n,a=c-r,b=c+r+1;
        out[i]=(pref[b]-pref[a])/span;
      }
      return out;
    };
    const maxGradeOf=a=>{
      let m=0,mi=0;
      for(let i=0;i<n;i++){
        const g=Math.abs((a[(i+1)%n]-a[i])/ROUTE_STEP*100);
        if(g>m){m=g;mi=i;}
      }
      return [m,mi];
    };

    let fitted=raw,chosenRadius=0,mg=maxGradeOf(fitted);
    for(const r of radii){
      fitted=smoothCircular(raw,r);mg=maxGradeOf(fitted);chosenRadius=r;
      if(mg[0]<=(sc.road.maxGrade||8)+.02)break;
    }

    /* Rare residuals after the widest useful filter are projected locally.
       This symmetric pass starts from an already smooth profile, so it
       converges quickly and does not spread one seam error around the lap. */
    const lim=(sc.road.maxGrade||8)/100*ROUTE_STEP;
    for(let pass=0;pass<240&&mg[0]>(sc.road.maxGrade||8)+.02;pass++){
      let changed=false;
      for(let i=0;i<n;i++){
        const j=(i+1)%n,dh=fitted[j]-fitted[i],ad=Math.abs(dh);
        if(ad>lim){
          const s=dh>0?1:-1,ex=(ad-lim)*.5;
          fitted[i]+=s*ex;fitted[j]-=s*ex;changed=true;
        }
      }
      mg=maxGradeOf(fitted);
      if(!changed)break;
    }

    for(let i=0;i<n;i++)w.ry[i]=fitted[i];
    const delta=new Float32Array(n);
    let mean=0,maxG=0,maxI=0,maxRoadLand=0;
    for(let i=0;i<n;i++){
      delta[i]=w.ry[i]-oldRy[i];mean+=w.ry[i];
      const j=(i+1)%n,g=(w.ry[j]-w.ry[i])/ROUTE_STEP*100;
      w.grade[i]=g;if(Math.abs(g)>maxG){maxG=Math.abs(g);maxI=i;}
      if(landAt)maxRoadLand=Math.max(maxRoadLand,Math.abs(w.ry[i]-landAt(w.rx[i],w.rz[i])));
    }
    w.meanY=mean/n;

    const near=(x,z)=>w._dbg&&w._dbg.roadNear?w._dbg.roadNear(x,z):null;
    const corr=(x,z,reach,soft)=>{
      const q=near(x,z);if(!q||q.i>=n||q.d>=reach)return 0;
      const f=q.d<=soft?1:1-smoothstep((q.d-soft)/Math.max(.001,reach-soft));
      return delta[q.i]*f;
    };

    /* Shift the already-baked road to the fitted centreline.  js/21 rebuilds
       the surrounding terrain from the natural land field afterwards. */
    if(w.road&&w.road.pos){
      const p=w.road.pos;
      for(let k=0;k<p.length;k+=3){const q=near(p[k],p[k+2]);if(q&&q.i<n)p[k+1]+=delta[q.i];}
    }
    if(w.props&&w.props.pos){
      const p=w.props.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=corr(p[k],p[k+2],150,110);
    }
    if(w.veg&&w.veg.ctr){
      const p=w.veg.ctr;for(let k=0;k<p.length;k+=3)p[k+1]+=corr(p[k],p[k+2],220,180);
    }

    for(const a of (w.actors||[])){
      if(!Number.isFinite(a.px)||!Number.isFinite(a.pz))continue;
      const d=corr(a.px,a.pz,220,180);
      if(Number.isFinite(a.py))a.py+=d;
      if(Number.isFinite(a.gy))a.gy+=d;
      if(Number.isFinite(a.baseY))a.baseY+=d;
      if(Number.isFinite(a.pinY))a.pinY+=d;
      if(Number.isFinite(a.pinAlt))a.pinAlt+=d;
      if(Number.isFinite(a.baseRoadY))a.baseRoadY+=d;
    }
    for(const b of (w.bases||[]))if(Number.isFinite(b.y))b.y+=corr(b.x,b.z,220,180);

    const seamXZ=Math.hypot(w.rx[0]-w.rx[n-1],w.rz[0]-w.rz[n-1]);
    w.__verdantAudit={maxGrade:maxG,maxGradeIndex:maxI,seamXZ,
      seamY:Math.abs(w.ry[0]-w.ry[n-1]),lapKm:w.lapLen/1000,
      terrainFitRadius:chosenRadius,maxRoadLandOffset:maxRoadLand};
    if(maxG>(sc.road.maxGrade||8)+.21||seamXZ>8.5)
      console.warn('Verdant route invariant failed',w.__verdantAudit);
    else console.log('Verdant route audit',w.__verdantAudit);
    return w;
  };
})();
