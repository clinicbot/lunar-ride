"use strict";

/* ==========================================================================\n   16. Copernicus foot-junction visual cleanup\n   --------------------------------------------------------------------------\n   Around 6.3 km the loop, climb entrance and return branch occupy the same\n   physical throat. The route is correct, but their painted road ribbons and\n   low roadside furniture overlap visually. Keep the geometry/physics intact\n   and clean only the presentation: fade the paint to plain asphalt through\n   the throat and remove low clutter immediately beside the road.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const buildWorldBase=buildWorld;

  buildWorld=function(scene,onProgress){
    const w=buildWorldBase(scene,onProgress);
    if(!w||!scene||scene.id!=='copernicus'||!w.road) return w;

    const targetM=6300;
    const i0=clamp(Math.round(targetM/ROUTE_STEP),0,w.nMain-1);
    const cx=w.rx[i0], cz=w.rz[i0];
    const roadCol=hx(scene.col.road);

    /* The generator uses ten cross-road vertices per route sample. Inside
       the junction all of them become asphalt; across the outer 45 m the
       original lane/shoulder paint fades back in gradually. */
    const NL=10, innerR=82, outerR=128;
    let paintedSamples=0;
    if(w.road.col&&w.road.col.length>=w.nPts*NL*4){
      for(let i=0;i<w.nPts;i++){
        const dx=w.rx[i]-cx, dz=w.rz[i]-cz, d=Math.hypot(dx,dz);
        if(d>=outerR) continue;
        const u=clamp((d-innerR)/(outerR-innerR),0,1);
        const clean=1-smoothstep(u);
        if(clean<=0) continue;
        paintedSamples++;
        for(let j=0;j<NL;j++){
          const k=(i*NL+j)*4;
          w.road.col[k]  =lerp(w.road.col[k],  roadCol[0],clean);
          w.road.col[k+1]=lerp(w.road.col[k+1],roadCol[1],clean);
          w.road.col[k+2]=lerp(w.road.col[k+2],roadCol[2],clean);
          w.road.col[k+3]*=(1-clean); /* no glowing paint inside the throat */
        }
      }
    }

    /* Guard rails/posts and small clutter are baked into props. Remove only
       triangles that are both close to this junction AND entirely low to the
       nearest road deck. Tall signs/buildings survive because their triangles
       reach well above this threshold. */
    let removedTriangles=0;
    if(w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos, idx=w.props.idx, keep=[];
      const propR=118;
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q], ib=idx[q+1], ic=idx[q+2];
        const ax=pos[ia*3], ay=pos[ia*3+1], az=pos[ia*3+2];
        const bx=pos[ib*3], by=pos[ib*3+1], bz=pos[ib*3+2];
        const cxT=pos[ic*3], cy=pos[ic*3+1], czT=pos[ic*3+2];
        const mx=(ax+bx+cxT)/3, mz=(az+bz+czT)/3;
        const dx=mx-cx, dz=mz-cz;
        let drop=false;
        if(dx*dx+dz*dz<propR*propR){
          const nr=w._dbg.roadNear(mx,mz);
          if(nr&&nr.d<scene.road.halfWidth+5.5){
            const top=Math.max(ay,by,cy);
            if(top<=w.ry[nr.i]+1.35) drop=true;
          }
        }
        if(drop) removedTriangles++;
        else keep.push(ia,ib,ic);
      }
      if(removedTriangles) w.props.idx=new Uint32Array(keep);
    }

    try{
      window.__copernicusFootFix={
        km:+(i0*ROUTE_STEP/1000).toFixed(2),
        centre:[+cx.toFixed(1),+cz.toFixed(1)],
        paintedSamples,removedTriangles
      };
    }catch(e){}
    return w;
  };
})();
