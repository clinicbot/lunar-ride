"use strict";

/* Verdant Rift v124 — replace the old smooth perimeter ring ----------------
   The original Verdant terrain raised every point outside r=.72 with the same
   quadratic radial term. From the road that reads as giant green half-circles.
   v123 added ridges on top of that ring, so some directions looked excellent
   while other directions still exposed the smooth mound underneath.

   v124 removes that radial component ONLY away from the road and replaces it
   with an asymmetric, warped perimeter mountain system. The ridden route,
   road-support corridor and route-profile array are never modified. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.terrain||!w.terrain.pos||!w._dbg||
       typeof w._dbg.roadNear!=='function')return w;

    const pos=w.terrain.pos,nrm=w.terrain.nrm,col=w.terrain.col;
    const nVert=pos.length/3,NV=Math.round(Math.sqrt(nVert));
    if(NV*NV!==nVert)return w;

    const near=w._dbg.roadNear,HALF=2600;
    const ridgeNoise=makeNoise(sc.seed+12417);
    const macroNoise=makeNoise(sc.seed+12471);
    const detailNoise=makeNoise(sc.seed+12509);
    const H=new Float32Array(nVert),before=new Float32Array(nVert);
    for(let v=0;v<nVert;v++)H[v]=before[v]=pos[v*3+1];

    const oldRadial=(x,z)=>{
      const r=Math.hypot(x,z)/HALF;
      if(r<=.72)return 0;
      const q=(r-.72)/.28;
      return q*q*185;
    };

    let changed=0,maxRemoved=0,maxAdded=0,maxDetail=0;
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z),d=q?q.d:1e6;
      if(d<=180)continue;                         // hard road/physics protection

      const protect=smoothstep(clamp((d-180)/260,0,1));
      if(protect<.001)continue;
      const r=Math.hypot(x,z)/HALF,a=Math.atan2(z,x);

      /* Remove the exact smooth radial term inherited from bareLand(). */
      const old=oldRadial(x,z)*protect;
      if(old>0){H[v]-=old;maxRemoved=Math.max(maxRemoved,old);}

      /* The perimeter now starts at a different radius in every direction.
         Several incommensurate angular waves prevent any circular silhouette. */
      const warp=.052*Math.sin(a*3+.55)+.030*Math.sin(a*5-1.18)
                +.018*Math.sin(a*9+1.73)+.020*macroNoise(x/900+3,z/900-7);
      const start=clamp(.685+warp,.60,.76);
      const edgeQ=clamp((r-start)/Math.max(.18,1-start),0,1.45);
      if(edgeQ>0){
        const sector=clamp(.78+.22*Math.sin(a*2-.8)+.17*Math.sin(a*5+1.2)
                         +.10*Math.sin(a*7-2.1),.46,1.20);
        const rn=1-Math.abs(ridgeNoise(x/245+7.1,z/245-4.7));
        const rn2=1-Math.abs(detailNoise(x/132-11.3,z/132+3.2));
        const shoulder=.60+.52*Math.pow(rn,1.75)+.13*Math.pow(rn2,1.5);
        const add=Math.pow(edgeQ,1.72)*168*sector*shoulder*protect;
        H[v]+=add;maxAdded=Math.max(maxAdded,add);
      }

      /* Secondary erosion/shoulders break broad faces as well as the skyline.
         It is intentionally low-frequency: no noisy spikes or saw teeth. */
      const high=clamp((H[v]-40)/230,0,1),edge=clamp((r-.56)/.44,0,1);
      const strength=protect*clamp(.06+high*.48+edge*.42,0,1);
      if(strength>.02){
        const rn=1-Math.abs(ridgeNoise(x/280-5,z/280+9));
        const rn2=1-Math.abs(detailNoise(x/145+13,z/145-6));
        const macro=macroNoise(x/620+2.4,z/620-8.8);
        let delta=(macro*18+(rn*rn-.34)*34+(rn2*rn2-.34)*10)*strength;
        delta=clamp(delta,-30,42);
        H[v]+=delta;maxDetail=Math.max(maxDetail,Math.abs(delta));
      }
      changed++;
    }

    /* Very light reconciliation outside the protected corridor. */
    const src=new Float32Array(H);
    for(let j=1;j<NV-1;j++)for(let i=1;i<NV-1;i++){
      const v=j*NV+i,k=v*3,q=near(pos[k],pos[k+2]);
      if(q&&q.d<=180)continue;
      const avg=(src[v-1]+src[v+1]+src[v-NV]+src[v+NV])*.25;
      H[v]=src[v]*.90+avg*.10;
    }

    for(let v=0;v<nVert;v++)pos[v*3+1]=H[v];
    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const at=(i,j)=>H[j*NV+i];
    let maxProtectedChange=0;

    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i,k=v*3,x=pos[k],z=pos[k+2];
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=(hL-hR)/stepX,ny=2,nz=(hD-hU)/stepZ,l=Math.hypot(nx,ny,nz)||1;
      nx/=l;ny/=l;nz/=l;nrm[k]=nx;nrm[k+1]=ny;nrm[k+2]=nz;

      const q=near(x,z),d=q?q.d:1e6;
      if(d<=180)maxProtectedChange=Math.max(maxProtectedChange,Math.abs(H[v]-before[v]));

      /* Even a broad mountain shoulder should no longer read as one flat green
         blob. Blend high/far/steep terrain toward stone so the rock texture can
         participate before the face becomes a cliff. */
      if(col&&d>180){
        const far=smoothstep(clamp((d-180)/360,0,1));
        const high=clamp((H[v]-55)/240,0,1);
        const slope=clamp((1-ny)*1.65,0,1);
        const radial=clamp((Math.hypot(x,z)/HALF-.58)/.36,0,1);
        const m=far*clamp(slope*.54+high*.25+radial*.20,0,.72);
        if(m>.01){
          const variation=.88+.15*(macroNoise(x/430,z/430)*.5+.5);
          const rock=[.43*variation,.44*variation,.41*variation];
          col[v*4]=lerp(col[v*4],rock[0],m);
          col[v*4+1]=lerp(col[v*4+1],rock[1],m);
          col[v*4+2]=lerp(col[v*4+2],rock[2],m);
        }
      }
    }

    const minX=pos[0],minZ=pos[2];
    const gridH=(x,z)=>{
      const fx=clamp((x-minX)/stepX,0,NV-1.001),fz=clamp((z-minZ)/stepZ,0,NV-1.001);
      const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
      return lerp(lerp(at(i,j),at(i+1,j),u),lerp(at(i,j+1),at(i+1,j+1),u),v);
    };
    w.meshH=gridH;w.groundAt=gridH;
    w.__verdantMountainsV124={changed,maxRemoved,maxAdded,maxDetail,
      roadProtectionM:180,maxProtectedChange};
    if(maxProtectedChange>.001)console.error('Verdant v124 mountain pass touched protected road corridor',maxProtectedChange);
    console.log('Verdant v124 mountain replacement:',w.__verdantMountainsV124);
    return w;
  };
})();
