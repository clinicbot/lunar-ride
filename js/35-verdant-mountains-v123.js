"use strict";

/* Verdant Rift v126 — full-route perimeter mountain replacement ------------
   v124 correctly replaced the old smooth radial mountain ring, but protected
   180 m around EVERY route sample and faded the replacement over another
   260 m.  Because Verdant's 25 km route folds through the whole map, much of
   the distant skyline is close to some other road segment and therefore kept
   the old green dome silhouette.

   v126 keeps only the actually required road-support corridor untouched:
   46 m hard protection, then a smooth 84 m transition.  The original terrain
   carve ends around 31 m, so the ridden road, route profile and physics remain
   unchanged while virtually all visible distant terrain gets the asymmetric
   ridge treatment. */
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
    const ROAD_CORE=46,ROAD_FADE=84,FULL_REPLACE=ROAD_CORE+ROAD_FADE;
    const ridgeNoise=makeNoise(sc.seed+12417);
    const macroNoise=makeNoise(sc.seed+12471);
    const detailNoise=makeNoise(sc.seed+12509);
    const H=new Float32Array(nVert),before=new Float32Array(nVert),weight=new Float32Array(nVert);
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
      if(d<=ROAD_CORE)continue;

      const protect=smoothstep(clamp((d-ROAD_CORE)/ROAD_FADE,0,1));
      weight[v]=protect;
      if(protect<.0005)continue;
      const r=Math.hypot(x,z)/HALF,a=Math.atan2(z,x);

      /* Remove the smooth ring inherited from bareLand().  Beyond 130 m this
         is now a complete removal, independent of whether another route leg
         happens to run somewhere behind the current camera view. */
      const old=oldRadial(x,z)*protect;
      if(old>0){H[v]-=old;maxRemoved=Math.max(maxRemoved,old);}

      /* Asymmetric perimeter. Several unrelated angular frequencies and two
         spatial noise fields prevent circles, hemispheres and repeated peaks. */
      const warp=.058*Math.sin(a*3+.55)+.034*Math.sin(a*5-1.18)
                +.021*Math.sin(a*9+1.73)+.024*macroNoise(x/900+3,z/900-7);
      const start=clamp(.675+warp,.59,.76);
      const edgeQ=clamp((r-start)/Math.max(.18,1-start),0,1.48);
      if(edgeQ>0){
        const sector=clamp(.76+.24*Math.sin(a*2-.8)+.18*Math.sin(a*5+1.2)
                         +.11*Math.sin(a*7-2.1),.42,1.24);
        const rn=1-Math.abs(ridgeNoise(x/245+7.1,z/245-4.7));
        const rn2=1-Math.abs(detailNoise(x/132-11.3,z/132+3.2));
        const shoulder=.56+.56*Math.pow(rn,1.78)+.15*Math.pow(rn2,1.55);
        const add=Math.pow(edgeQ,1.70)*171*sector*shoulder*protect;
        H[v]+=add;maxAdded=Math.max(maxAdded,add);
      }

      /* Erosion/shoulders operate on all high terrain, not only the perimeter.
         This breaks the broad alpine Gaussian and any remaining smooth face
         without producing sharp procedural spikes. */
      const high=clamp((H[v]-34)/225,0,1),edge=clamp((r-.52)/.48,0,1);
      const strength=protect*clamp(.09+high*.62+edge*.40,0,1);
      if(strength>.015){
        const rn=1-Math.abs(ridgeNoise(x/278-5,z/278+9));
        const rn2=1-Math.abs(detailNoise(x/143+13,z/143-6));
        const macro=macroNoise(x/610+2.4,z/610-8.8);
        let delta=(macro*21+(rn*rn-.34)*39+(rn2*rn2-.34)*13)*strength;
        delta=clamp(delta,-38,52);
        H[v]+=delta;maxDetail=Math.max(maxDetail,Math.abs(delta));
      }
      changed++;
    }

    /* One very light weighted reconciliation.  Near the road the blend weight
       approaches zero, so the original carved terrain is mathematically kept. */
    const src=new Float32Array(H);
    for(let j=1;j<NV-1;j++)for(let i=1;i<NV-1;i++){
      const v=j*NV+i,k=v*3,q=near(pos[k],pos[k+2]),d=q?q.d:1e6;
      if(d<=ROAD_CORE)continue;
      const f=.075*weight[v];
      if(f<.0001)continue;
      const avg=(src[v-1]+src[v+1]+src[v-NV]+src[v+NV])*.25;
      H[v]=lerp(src[v],avg,f);
    }

    for(let v=0;v<nVert;v++)pos[v*3+1]=H[v];
    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const at=(i,j)=>H[j*NV+i];
    let maxProtectedChange=0,maxTransitionChange=0;

    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i,k=v*3,x=pos[k],z=pos[k+2];
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=(hL-hR)/stepX,ny=2,nz=(hD-hU)/stepZ,l=Math.hypot(nx,ny,nz)||1;
      nx/=l;ny/=l;nz/=l;nrm[k]=nx;nrm[k+1]=ny;nrm[k+2]=nz;

      const q=near(x,z),d=q?q.d:1e6,dh=Math.abs(H[v]-before[v]);
      if(d<=ROAD_CORE)maxProtectedChange=Math.max(maxProtectedChange,dh);
      else if(d<FULL_REPLACE)maxTransitionChange=Math.max(maxTransitionChange,dh);

      /* Broad shoulders become stone before they become cliffs.  This is what
         prevents a remaining high face from reading as one giant green blob. */
      if(col&&d>ROAD_CORE){
        const far=smoothstep(clamp((d-ROAD_CORE)/185,0,1));
        const high=clamp((H[v]-42)/220,0,1);
        const slope=clamp((1-ny)*1.75,0,1);
        const radial=clamp((Math.hypot(x,z)/HALF-.50)/.42,0,1);
        const m=far*clamp(slope*.58+high*.30+radial*.26,0,.82);
        if(m>.008){
          const variation=.84+.20*(macroNoise(x/410,z/410)*.5+.5);
          const warm=.5+.5*detailNoise(x/680-3,z/680+4);
          const rock=[(.39+.07*warm)*variation,(.40+.055*warm)*variation,(.38+.035*warm)*variation];
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
    w.__verdantMountainsV126={changed,maxRemoved,maxAdded,maxDetail,
      roadCoreM:ROAD_CORE,fadeM:ROAD_FADE,fullReplacementM:FULL_REPLACE,
      maxProtectedChange,maxTransitionChange};
    if(maxProtectedChange>.001)
      console.error('Verdant v126 mountain pass touched protected road core',maxProtectedChange);
    console.log('Verdant v126 full-route mountain replacement:',w.__verdantMountainsV126);
    return w;
  };
})();
