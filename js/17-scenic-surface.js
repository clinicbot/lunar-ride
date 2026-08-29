"use strict";

/* ==========================================================================\n   Scenic-route surface height\n   --------------------------------------------------------------------------\n   The hand-drawn route is appended after the original world's groundAt/meshH\n   closures were created, so those closures do not know about the new carved\n   corridor. Mirror the same corridor blend here so actors, birds' clearance,\n   props and any later systems see the terrain that is actually on screen.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const baseBuildWorld=buildWorld;

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    if(!w||!w.nCut||!w.nMain) return w;

    const base=w.nMain,n=w.nCut,hw=(scene.road&&scene.road.halfWidth)||3;
    const oldGround=w.groundAt,oldMesh=w.meshH||w.groundAt;
    const HC=64,hash=new Map(),key=(x,z)=>Math.floor(x/HC)+':'+Math.floor(z/HC);
    for(let k=0;k<n;k++){
      const i=base+k,kk=key(w.rx[i],w.rz[i]);
      if(!hash.has(kk))hash.set(kk,[]);hash.get(kk).push(k);
    }
    function near(x,z){
      const gx=Math.floor(x/HC),gz=Math.floor(z/HC);let bk=-1,bd=Infinity;
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
        const list=hash.get((gx+a)+':'+(gz+b));if(!list)continue;
        for(const k of list){const i=base+k,dx=x-w.rx[i],dz=z-w.rz[i],d=dx*dx+dz*dz;if(d<bd){bd=d;bk=k;}}
      }
      return bk<0?null:{k:bk,d:Math.sqrt(bd)};
    }
    const flatR=hw+(typeof STEP==='number'?STEP:14)*1.55,blendR=82;
    function surface(fn,x,z){
      const old=fn?fn(x,z):0,q=near(x,z);
      if(!q||q.d>=blendR)return old;
      const target=w.ry[base+q.k]-.30;
      const wt=q.d<=flatR?1:(1-smoothstep(clamp((q.d-flatR)/(blendR-flatR),0,1)));
      return lerp(old,target,wt);
    }
    w.groundAt=(x,z)=>surface(oldGround,x,z);
    w.meshH=(x,z)=>surface(oldMesh,x,z);
    w._scenicNear=near;
    return w;
  };
})();
