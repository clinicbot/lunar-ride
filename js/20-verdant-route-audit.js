"use strict";

/* Verdant circular elevation repair ---------------------------------------
   The first custom builder used an in-place forward/backward limiter.  On a
   closed loop its final backward assignment can move the last sample after
   the previous edge has already been checked, leaving one artificial cliff.
   This symmetric projection treats every edge equally and converges without
   privileging a seam.  The same delta is then applied to all geometry that
   was already baked by the custom builder. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant) return w;

    const n=w.nMain,lim=(sc.road.maxGrade||8)/100*ROUTE_STEP;
    const oldRy=new Float32Array(w.ry);
    let passes=0,maxDh=Infinity;
    for(;passes<600;passes++){
      maxDh=0;
      for(let i=0;i<n;i++){
        const j=(i+1)%n,dh=w.ry[j]-w.ry[i],ad=Math.abs(dh);
        if(ad>maxDh)maxDh=ad;
        if(ad>lim){
          const ex=(ad-lim)*.5;
          if(dh>0){w.ry[i]+=ex;w.ry[j]-=ex;}
          else     {w.ry[i]-=ex;w.ry[j]+=ex;}
        }
      }
      if(maxDh<=lim+.00005)break;
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

    /* trail vertices sit directly on the centre-line surface */
    if(w.road&&w.road.pos){
      const p=w.road.pos;
      for(let k=0;k<p.length;k+=3){const q=near(p[k],p[k+2]);if(q&&q.i<n)p[k+1]+=delta[q.i];}
    }
    /* terrain corridor: full correction under the trail, feathered outward */
    if(w.terrain&&w.terrain.pos){
      const p=w.terrain.pos;
      for(let k=0;k<p.length;k+=3){
        const q=near(p[k],p[k+2]);if(!q||q.i>=n)continue;
        const ww=w.verdant.widthAt(q.i),reach=ww+30,soft=ww+2;
        if(q.d<reach){const f=q.d<=soft?1:1-smoothstep((q.d-soft)/(reach-soft));p[k+1]+=delta[q.i]*f;}
      }
    }
    /* baked roadside models are rigid enough that a smooth local vertical
       shift preserves their shape while following the repaired terrain. */
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

    for(const a of w.actors){
      if(!Number.isFinite(a.px)||!Number.isFinite(a.pz))continue;
      const d=corr(a.px,a.pz,230,190);
      if(Number.isFinite(a.py))a.py+=d;
      if(Number.isFinite(a.gy))a.gy+=d;
      if(Number.isFinite(a.baseY))a.baseY+=d;
      if(Number.isFinite(a.pinY))a.pinY+=d;
      if(Number.isFinite(a.pinAlt))a.pinAlt+=d;
      if(Number.isFinite(a.baseRoadY))a.baseRoadY+=d;
    }
    for(const b of (w.bases||[])){
      if(Number.isFinite(b.y))b.y+=corr(b.x,b.z,230,190);
    }

    const seamXZ=Math.hypot(w.rx[0]-w.rx[n-1],w.rz[0]-w.rz[n-1]);
    w.__verdantAudit={passes,maxGrade:maxG,maxGradeIndex:maxI,seamXZ,
      seamY:Math.abs(w.ry[0]-w.ry[n-1]),lapKm:w.lapLen/1000};
    if(maxG>(sc.road.maxGrade||8)+.21||seamXZ>8.5)
      console.warn('Verdant route invariant failed',w.__verdantAudit);
    else console.log('Verdant route audit',w.__verdantAudit);
    return w;
  };
})();
