"use strict";

/* Verdant circular elevation repair ---------------------------------------
   The original custom builder creates a good 25 km profile but its in-place
   limiter can leave one artificial cliff at the loop closure.  Do not diffuse
   that error around the whole lap: replace only a controlled window around
   the seam with a grade-safe bridge, then run a short symmetric cleanup. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant) return w;

    const n=w.nMain,lim=(sc.road.maxGrade||8)/100*ROUTE_STEP;
    const oldRy=new Float32Array(w.ry);

    /* The damaged edge is at the lap seam.  A 1.44 km bridge (720 m either
       side) is long enough to reconcile the two elevations gently while
       preserving the other ~23.6 km of the designed profile exactly. */
    const W=Math.min(180,Math.floor(n/12));
    const a=n-W,b=W,yA=oldRy[a],yB=oldRy[b],span=2*W;
    for(let k=0;k<=span;k++){
      const i=(a+k)%n,t=k/span;
      w.ry[i]=lerp(yA,yB,t);
    }

    /* Safety projection for any numerical residual.  Because the seam is now
       already a legal ramp this converges in a handful of passes instead of
       thousands and cannot spread a visual plateau around the lap. */
    let passes=0,maxDh=Infinity;
    for(;passes<120;passes++){
      maxDh=0;let changed=false;
      for(let i=0;i<n;i++){
        const j=(i+1)%n,dh=w.ry[j]-w.ry[i],ad=Math.abs(dh);
        if(ad>maxDh)maxDh=ad;
        if(ad>lim+.00001){
          const ex=(ad-lim)*.5;
          if(dh>0){w.ry[i]+=ex;w.ry[j]-=ex;}
          else     {w.ry[i]-=ex;w.ry[j]+=ex;}
          changed=true;
        }
      }
      if(!changed)break;
    }

    const delta=new Float32Array(n);
    let mean=0,maxG=0,maxI=0;
    for(let i=0;i<n;i++){
      delta[i]=w.ry[i]-oldRy[i];mean+=w.ry[i];
      const j=(i+1)%n,g=(w.ry[j]-w.ry[i])/ROUTE_STEP*100;
      w.grade[i]=g;
      if(Math.abs(g)>maxG){maxG=Math.abs(g);maxI=i;}
    }
    w.meanY=mean/n;

    const near=(x,z)=>w._dbg&&w._dbg.roadNear?w._dbg.roadNear(x,z):null;
    const corr=(x,z,reach,soft)=>{
      const q=near(x,z);if(!q||q.i>=n||q.d>=reach)return 0;
      const f=q.d<=soft?1:1-smoothstep((q.d-soft)/Math.max(.001,reach-soft));
      return delta[q.i]*f;
    };

    if(w.road&&w.road.pos){
      const p=w.road.pos;
      for(let k=0;k<p.length;k+=3){const q=near(p[k],p[k+2]);if(q&&q.i<n)p[k+1]+=delta[q.i];}
    }
    if(w.terrain&&w.terrain.pos){
      const p=w.terrain.pos;
      for(let k=0;k<p.length;k+=3){
        const q=near(p[k],p[k+2]);if(!q||q.i>=n)continue;
        const ww=w.verdant.widthAt(q.i),reach=ww+30,soft=ww+2;
        if(q.d<reach){const f=q.d<=soft?1:1-smoothstep((q.d-soft)/(reach-soft));p[k+1]+=delta[q.i]*f;}
      }
    }
    if(w.props&&w.props.pos){
      const p=w.props.pos;
      for(let k=0;k<p.length;k+=3)p[k+1]+=corr(p[k],p[k+2],130,95);
    }
    if(w.veg&&w.veg.ctr){
      const p=w.veg.ctr;
      for(let k=0;k<p.length;k+=3)p[k+1]+=corr(p[k],p[k+2],230,190);
    }

    const oldGround=w.groundAt,oldMesh=w.meshH;
    const surfaceFix=(fn,x,z)=>{
      const q=near(x,z);if(!q||q.i>=n)return fn(x,z);
      const ww=w.verdant.widthAt(q.i),reach=ww+30,soft=ww+2;
      const f=q.d<=soft?1:(q.d<reach?1-smoothstep((q.d-soft)/(reach-soft)):0);
      return fn(x,z)+delta[q.i]*f;
    };
    w.groundAt=(x,z)=>surfaceFix(oldGround,x,z);
    w.meshH=(x,z)=>surfaceFix(oldMesh,x,z);

    for(const a2 of w.actors){
      if(!Number.isFinite(a2.px)||!Number.isFinite(a2.pz))continue;
      const d=corr(a2.px,a2.pz,230,190);
      if(Number.isFinite(a2.py))a2.py+=d;
      if(Number.isFinite(a2.gy))a2.gy+=d;
      if(Number.isFinite(a2.baseY))a2.baseY+=d;
      if(Number.isFinite(a2.pinY))a2.pinY+=d;
      if(Number.isFinite(a2.pinAlt))a2.pinAlt+=d;
      if(Number.isFinite(a2.baseRoadY))a2.baseRoadY+=d;
    }
    for(const bb of (w.bases||[])){
      if(Number.isFinite(bb.y))bb.y+=corr(bb.x,bb.z,230,190);
    }

    const seamXZ=Math.hypot(w.rx[0]-w.rx[n-1],w.rz[0]-w.rz[n-1]);
    w.__verdantAudit={passes,maxGrade:maxG,maxGradeIndex:maxI,seamXZ,
      seamY:Math.abs(w.ry[0]-w.ry[n-1]),lapKm:w.lapLen/1000,bridgeSamples:span};
    if(maxG>(sc.road.maxGrade||8)+.21||seamXZ>8.5)
      console.warn('Verdant route invariant failed',w.__verdantAudit);
    else console.log('Verdant route audit',w.__verdantAudit);
    return w;
  };
})();
