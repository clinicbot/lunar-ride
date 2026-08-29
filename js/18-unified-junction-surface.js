"use strict";

/* ==========================================================================\n   18. Unified junction surfaces\n   --------------------------------------------------------------------------\n   Recolouring overlapping ribbons is not enough: at a fork their shoulder\n   strips are still separate pieces of geometry and can form white wedges and\n   z-fighting. Every detected same-level junction therefore gets ONE asphalt\n   surface generated from the road edges around it. This is data-driven and\n   applies to future forks/merges/crossings too.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const baseBuildWorld=buildWorld;

  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  function hull(points){
    if(points.length<3) return points.slice();
    const a=points.slice().sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
    const lo=[];
    for(const p of a){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
    const hi=[];
    for(let i=a.length-1;i>=0;i--){const p=a[i];while(hi.length>=2&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
    lo.pop();hi.pop();return lo.concat(hi);
  }
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    const zones=(window.__junctions||[]).slice();
    if(!w||!w.road||!zones.length) return w;

    const hw=scene.road.halfWidth||3;
    const roadCol=hx(scene.col.road);
    const pos=[],nrm=[],col=[],idx=[];
    let patches=0;

    const roadY=(x,z,fallback)=>{
      if(w._dbg&&typeof w._dbg.roadNear==='function'){
        const q=w._dbg.roadNear(x,z);
        if(q&&q.i>=0&&q.i<w.nPts&&q.d<hw+16) return w.ry[q.i]+0.19;
      }
      return fallback+0.19;
    };

    for(const z of zones){
      const cx=z.centre[0],cz=z.centre[1],cy=z.height;
      /* Only the true conflict core gets the unified patch. Paint cleanup may\n         feather much farther out, but a 30-55 m paved throat is enough to hide\n         every overlapping shoulder without turning the junction into a plaza. */
      const patchR=clamp(z.core*0.70,30,55);
      const edge=[];
      for(let i=0;i<w.nPts;i+=2){
        if(Math.abs(w.ry[i]-cy)>5) continue;
        const dx=w.rx[i]-cx,dz=w.rz[i]-cz;
        if(dx*dx+dz*dz>patchR*patchR) continue;
        const nx=-w.tz[i],nz=w.tx[i],off=hw+1.35;
        edge.push([w.rx[i]+nx*off,w.rz[i]+nz*off]);
        edge.push([w.rx[i]-nx*off,w.rz[i]-nz*off]);
      }
      let H=hull(edge);
      if(H.length<3) continue;

      /* Remove pathological far hull points caused by a nearby but unrelated\n         sample. The detector already rejected grade-separated crossings; this\n         is just a final visual guard rail. */
      H=H.filter(p=>Math.hypot(p[0]-cx,p[1]-cz)<=patchR+hw+3);
      if(H.length<3) continue;

      const base=pos.length/3;
      let centreY=0;
      const ys=[];
      for(const p of H){const y=roadY(p[0],p[1],cy);ys.push(y);centreY+=y;}
      centreY/=H.length;
      pos.push(cx,centreY,cz);nrm.push(0,1,0);col.push(roadCol[0],roadCol[1],roadCol[2],0);
      for(let k=0;k<H.length;k++){
        pos.push(H[k][0],ys[k],H[k][1]);nrm.push(0,1,0);col.push(roadCol[0],roadCol[1],roadCol[2],0);
      }
      for(let k=0;k<H.length;k++){
        const a=base,b=base+1+k,c=base+1+((k+1)%H.length);
        idx.push(a,b,c);
      }
      patches++;
    }

    if(idx.length){
      const oldV=w.road.pos.length/3;
      w.road={
        pos:concatF(w.road.pos,new Float32Array(pos)),
        nrm:concatF(w.road.nrm,new Float32Array(nrm)),
        col:concatF(w.road.col,new Float32Array(col)),
        idx:concatU(w.road.idx,new Uint32Array(idx),oldV)
      };
    }
    try{window.__junctionSurface={patches,triangles:idx.length/3};}catch(e){}
    return w;
  };
})();
