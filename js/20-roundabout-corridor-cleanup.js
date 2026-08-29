"use strict";

/* ==========================================================================\n   Roundabout obsolete-corridor cleanup\n   --------------------------------------------------------------------------\n   The flat roundabout can require a long replacement ramp. The original road\n   and its low rails must therefore be removed along the entire superseded\n   approach, not only inside the small roundabout construction disc.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=="function")return;
  const baseBuildWorld=buildWorld;
  const wrap=(i,n)=>((i%n)+n)%n;

  function pathMetric(x,z,pts){
    let best=Infinity,bestAlong=0,along=0;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i];
      const vx=b[0]-a[0],vz=b[1]-a[1],L2=vx*vx+vz*vz,L=Math.sqrt(L2)||1;
      const t=L2?Math.max(0,Math.min(1,((x-a[0])*vx+(z-a[1])*vz)/L2)):0;
      const qx=a[0]+vx*t,qz=a[1]+vz*t,d=Math.hypot(x-qx,z-qz);
      if(d<best){best=d;bestAlong=along+L*t;}
      along+=L;
    }
    return {d:best,along:bestAlong};
  }

  function obsoletePaths(w,r){
    const out=[];
    let p=[];
    /* Main road before the junction: outer tie-in -> junction. */
    for(let j=0;j<=r.ks;j++){
      const i=wrap(r.jn-r.ks+j,w.nMain);
      p.push([w.rx[i],w.rz[i]]);
    }
    out.push(p);

    /* Main road after the junction, reversed so it is tie-in -> junction. */
    p=[];
    for(let j=r.ks;j>=0;j--){
      const i=wrap(r.jn+j,w.nMain);
      p.push([w.rx[i],w.rz[i]]);
    }
    out.push(p);

    /* Scenic road: again orient from its outer tie-in toward the junction. */
    p=[];
    if(r.which==='A'){
      for(let k=r.cutK;k>=0;k--){const i=w.nMain+k;p.push([w.rx[i],w.rz[i]]);}
    }else{
      for(let k=r.cutK;k<w.nCut;k++){const i=w.nMain+k;p.push([w.rx[i],w.rz[i]]);}
    }
    out.push(p);
    return out;
  }

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    if(!w||!w.roundabouts||!w.roundabouts.length||!w.road||!w.road.pos||!w.road.idx)return w;

    const STRIPES=10,RING_SEG=96,DISK_VERTS=1+RING_SEG,RING_VERTS=(RING_SEG+1)*2;
    const addedFor=r=>(r.arms.prev.points.length+r.arms.next.points.length+r.arms.cut.points.length)*STRIPES+
      DISK_VERTS+RING_VERTS*3;
    const totalVerts=w.road.pos.length/3;
    const originalVerts=Math.max(0,totalVerts-w.roundabouts.reduce((s,r)=>s+addedFor(r),0));
    const hw=(scene.road&&scene.road.halfWidth)||3.2;
    const roadClear=hw+1.7,propClear=hw+3.1,seamKeep=7;
    const corridors=w.roundabouts.flatMap(r=>obsoletePaths(w,r));

    const inCorridor=(x,z,clear)=>{
      for(const p of corridors){
        const m=pathMetric(x,z,p);
        if(m.along>seamKeep&&m.d<clear)return true;
      }
      return false;
    };

    let roadRemoved=0,propRemoved=0;
    {
      const pos=w.road.pos,idx=w.road.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        let drop=false;
        if(ia<originalVerts||ib<originalVerts||ic<originalVerts){
          const cx=(pos[ia*3]+pos[ib*3]+pos[ic*3])/3;
          const cz=(pos[ia*3+2]+pos[ib*3+2]+pos[ic*3+2])/3;
          if(inCorridor(cx,cz,roadClear))drop=true;
        }
        if(drop)roadRemoved++;else keep.push(ia,ib,ic);
      }
      w.road.idx=new Uint32Array(keep);
    }

    if(w.props&&w.props.pos&&w.props.idx){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ys=[pos[ia*3+1],pos[ib*3+1],pos[ic*3+1]];
        const vertical=Math.max(...ys)-Math.min(...ys);
        const cx=(pos[ia*3]+pos[ib*3]+pos[ic*3])/3;
        const cz=(pos[ia*3+2]+pos[ib*3+2]+pos[ic*3+2])/3;
        const drop=vertical<3.5&&inCorridor(cx,cz,propClear);
        if(drop)propRemoved++;else keep.push(ia,ib,ic);
      }
      w.props.idx=new Uint32Array(keep);
    }

    /* Permanent regression diagnostic: no original road surface may remain in\n       the superseded corridor after the short tie-in seam allowance. */
    let residualRoad=0;
    {
      const pos=w.road.pos,idx=w.road.idx;
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        if(ia>=originalVerts&&ib>=originalVerts&&ic>=originalVerts)continue;
        const cx=(pos[ia*3]+pos[ib*3]+pos[ic*3])/3;
        const cz=(pos[ia*3+2]+pos[ib*3+2]+pos[ic*3+2])/3;
        if(inCorridor(cx,cz,roadClear))residualRoad++;
      }
    }
    w.roundaboutCorridorCleanup={roadRemoved,propRemoved,residualRoad,seamKeep,roadClear,propClear};
    try{window.__roundaboutCorridorCleanup=w.roundaboutCorridorCleanup;}catch(e){}
    if(residualRoad)console.warn('Roundabout obsolete-road cleanup left',residualRoad,'road triangles');
    return w;
  };
})();
