"use strict";

/* Verdant Rift v123 — distant mountain realism -----------------------------
   The road corridor is deliberately left untouched.  Only terrain well away
   from the route receives broad ridges, secondary erosion and a less uniformly
   green high-altitude palette.  This breaks the smooth circular background
   hills without changing the 25 km route profile or its physics. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.terrain||!w.terrain.pos||!w._dbg||
       typeof w._dbg.roadNear!=='function')return w;

    const pos=w.terrain.pos,nrm=w.terrain.nrm,col=w.terrain.col;
    const nVert=pos.length/3,NV=Math.round(Math.sqrt(nVert));
    if(NV*NV!==nVert)return w;

    const near=w._dbg.roadNear;
    const ridgeNoise=makeNoise(sc.seed+12317);
    const macroNoise=makeNoise(sc.seed+12371);
    const detailNoise=makeNoise(sc.seed+12409);
    const H=new Float32Array(nVert);
    for(let v=0;v<nVert;v++)H[v]=pos[v*3+1];

    let changed=0,maxUp=0,maxDown=0;
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],y=H[v],rad=Math.hypot(x,z);
      /* Cheap early-out keeps the extra build pass small in the central
         valley; the visually offending background masses are high or far. */
      if(rad<720&&y<70)continue;
      const q=near(x,z),d=q?q.d:1e6;
      if(d<180)continue;                         // never disturb road support

      const roadFar=smoothstep(clamp((d-180)/360,0,1));
      const high=clamp((y-45)/210,0,1);
      const edge=clamp((rad-850)/1700,0,1);
      const strength=roadFar*clamp(.18+high*.62+edge*.42,0,1);
      if(strength<.035)continue;

      /* Large coherent mountain folds plus a ridged erosion component. The
         wavelengths are much larger than the 16 m terrain grid, so we create
         real mountain shoulders rather than noisy spikes. */
      const rn=1-Math.abs(ridgeNoise(x/235+7.1,z/235-4.7));
      const rn2=1-Math.abs(detailNoise(x/125-11.3,z/125+3.2));
      const macro=macroNoise(x/610+2.4,z/610-8.8);
      let delta=(macro*27 + (rn*rn-.34)*46 + (rn2*rn2-.34)*13)*strength;
      delta=clamp(delta,-42,58);
      H[v]+=delta;
      changed++;
      if(delta>maxUp)maxUp=delta;if(delta<maxDown)maxDown=delta;
    }

    /* One gentle spatial reconciliation pass.  It preserves the new ridges
       but removes any isolated grid-cell step before normals are rebuilt. */
    const src=new Float32Array(H);
    for(let j=1;j<NV-1;j++)for(let i=1;i<NV-1;i++){
      const v=j*NV+i,k=v*3,x=pos[k],z=pos[k+2],q=near(x,z);
      if(q&&q.d<180)continue;
      const avg=(src[v-1]+src[v+1]+src[v-NV]+src[v+NV])*.25;
      H[v]=src[v]*.88+avg*.12;
    }

    for(let v=0;v<nVert;v++)pos[v*3+1]=H[v];
    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const at=(i,j)=>H[j*NV+i];
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i,k=v*3;
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=(hL-hR)/stepX,ny=2,nz=(hD-hU)/stepZ,l=Math.hypot(nx,ny,nz)||1;
      nx/=l;ny/=l;nz/=l;nrm[k]=nx;nrm[k+1]=ny;nrm[k+2]=nz;

      /* High/far mountains should not remain a single saturated green blob.
         Let steep faces go grey-brown so the v122 rock photograph can read. */
      if(col){
        const x=pos[k],z=pos[k+2],q=near(x,z),d=q?q.d:1e6;
        if(d>180){
          const far=smoothstep(clamp((d-180)/360,0,1));
          const high=clamp((H[v]-70)/220,0,1);
          const slope=clamp((1-ny)*1.75,0,1);
          const m=far*clamp(slope*.60+high*.26,0,.68);
          if(m>.01){
            const variation=.90+.12*(macroNoise(x/430,z/430)*.5+.5);
            const rock=[.43*variation,.44*variation,.41*variation];
            col[v*4]=lerp(col[v*4],rock[0],m);
            col[v*4+1]=lerp(col[v*4+1],rock[1],m);
            col[v*4+2]=lerp(col[v*4+2],rock[2],m);
          }
        }
      }
    }

    /* Later habitat/settlement layers must use the improved terrain height. */
    const minX=pos[0],minZ=pos[2];
    const gridH=(x,z)=>{
      const fx=clamp((x-minX)/stepX,0,NV-1.001),fz=clamp((z-minZ)/stepZ,0,NV-1.001);
      const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
      return lerp(lerp(at(i,j),at(i+1,j),u),lerp(at(i,j+1),at(i+1,j+1),u),v);
    };
    w.meshH=gridH;w.groundAt=gridH;
    w.__verdantMountainsV123={changed,maxUp,maxDown,roadProtectionM:180};
    console.log('Verdant v123 mountain realism:',w.__verdantMountainsV123);
    return w;
  };
})();
