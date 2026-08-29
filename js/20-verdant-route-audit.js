"use strict";

/* Verdant terrain-following elevation fit ---------------------------------
   The route folds back near itself in several places.  A kilometre-based
   artificial height profile can therefore put two physically adjacent roads
   tens of metres apart vertically and force the terrain into a cliff.  Fit
   the road primarily to the natural height field under its X/Z path instead,
   then circularly smooth only as much as necessary to satisfy the 8% riding
   grade. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant) return w;

    const n=w.nMain,oldRy=new Float32Array(w.ry);
    const landAt=w._dbg&&typeof w._dbg.landAt==='function'?w._dbg.landAt:null;
    const raw=new Float64Array(n);

    for(let i=0;i<n;i++){
      const land=landAt?landAt(w.rx[i],w.rz[i]):oldRy[i];
      const oldOff=oldRy[i]-land;
      raw[i]=land+clamp(oldOff*.10,-5,12);
    }

    const radii=[3,6,10,16,24,36,52,72,96,128,168,220];
    const smoothCircular=(src,r)=>{
      const out=new Float64Array(n),pref=new Float64Array(n*3+1);
      for(let k=0;k<n*3;k++)pref[k+1]=pref[k]+src[k%n];
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

    /* The filtered profile is already smooth; this projection only trims the
       residual peaks.  Let it truly converge rather than stopping after an
       arbitrary 240 iterations. */
    const lim=(sc.road.maxGrade||8)/100*ROUTE_STEP;
    let projectPasses=0;
    for(;projectPasses<5000&&mg[0]>(sc.road.maxGrade||8)+.005;projectPasses++){
      let changed=false;
      const forward=(projectPasses&1)===0;
      for(let kk=0;kk<n;kk++){
        const i=forward?kk:(n-1-kk),j=(i+1)%n;
        const dh=fitted[j]-fitted[i],ad=Math.abs(dh);
        if(ad>lim+.000001){
          const s=dh>0?1:-1,ex=(ad-lim)*.5;
          fitted[i]+=s*ex;fitted[j]-=s*ex;changed=true;
        }
      }
      if(!changed)break;
      if((projectPasses&15)===15)mg=maxGradeOf(fitted);
    }
    mg=maxGradeOf(fitted);

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
    if(w.road&&w.road.pos){
      const p=w.road.pos;
      for(let k=0;k<p.length;k+=3){
        const q=near(p[k],p[k+2]);
        if(q&&q.i<n)p[k+1]+=delta[q.i];
      }
    }

    const seamXZ=Math.hypot(w.rx[0]-w.rx[n-1],w.rz[0]-w.rz[n-1]);
    w.__verdantAudit={maxGrade:maxG,maxGradeIndex:maxI,seamXZ,
      seamY:Math.abs(w.ry[0]-w.ry[n-1]),lapKm:w.lapLen/1000,
      terrainFitRadius:chosenRadius,projectPasses,maxRoadLandOffset:maxRoadLand};
    if(maxG>(sc.road.maxGrade||8)+.21||seamXZ>8.5)
      console.warn('Verdant route invariant failed',w.__verdantAudit);
    else console.log('Verdant route audit',w.__verdantAudit);
    return w;
  };
})();
