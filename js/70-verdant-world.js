"use strict";
/* Verdant Rift - complete world (flattened layers)
   Flattened from the v107-v160 layer files (verbatim, in the exact
   load order the page used). Original files live in git history and in
   branch backup-v160-before-flatten. Section markers below let the
   tests exercise each original layer in isolation. */

/* ===== BEGIN js/20-verdant-route-audit.js ===== */
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
/* ===== END js/20-verdant-route-audit.js ===== */

/* ===== BEGIN js/21-verdant-terrain-polish.js ===== */
"use strict";

/* Verdant terrain / vegetation polish -------------------------------------
   Rebuild the terrain from the untouched natural height field and blend it
   broadly toward the fitted road.  The terrain grid is 16 m, while some
   Verdant trails are only a few metres wide, so the roadbed itself must be
   wider than one grid cell or terrain triangles can poke through the trail. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant||!w.terrain||!w._dbg) return w;

    const near=w._dbg.roadNear;
    const landAt=typeof w._dbg.landAt==='function'?w._dbg.landAt:null;
    const pos=w.terrain.pos,nrm=w.terrain.nrm;
    const nVert=pos.length/3,NV=Math.round(Math.sqrt(nVert));
    if(NV*NV!==nVert) return w;

    const oldGround=w.meshH;
    const oldActorGround=[];
    for(const a of (w.actors||[]))
      oldActorGround.push(Number.isFinite(a.px)&&Number.isFinite(a.pz)?oldGround(a.px,a.pz):NaN);

    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const H=new Float32Array(nVert),dist=new Float32Array(nVert),ri=new Int32Array(nVert),pin=new Uint8Array(nVert);

    /* Start over from natural land.  Use a broad, nearly-flat support shelf
       beneath the trail so every 16 m terrain triangle adjacent to the narrow
       path stays below it.  The shelf then eases back into natural terrain. */
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z);
      const natural=landAt?landAt(x,z):pos[k+1];
      let y=natural;
      ri[v]=q&&q.i<w.nMain?q.i:-1;
      dist[v]=q?q.d:1e6;
      if(q&&q.i<w.nMain&&q.d<260){
        const zone=w.verdant.zoneAt(q.i),ww=w.verdant.widthAt(q.i);
        const roadY=w.ry[q.i]-.30;
        /* At least one full terrain-cell radius on either side. */
        const flat=Math.max(20,ww+10);
        const blend=(zone===3?135:(zone===6||zone===7?185:165));
        const f=q.d<=flat?1:1-smoothstep(clamp((q.d-flat)/(blend-flat),0,1));
        y=lerp(natural,roadY,f);
        if(q.d<=flat)pin[v]=1;
      }
      H[v]=y;
    }

    const MAX_SIDE=.38,maxDx=MAX_SIDE*stepX,maxDz=MAX_SIDE*stepZ;
    const active=v=>dist[v]<220;
    const relax=(a,b,maxDh)=>{
      if(!(active(a)||active(b)))return false;
      const dh=H[b]-H[a],ad=Math.abs(dh);
      if(ad<=maxDh+.001)return false;
      const s=dh>0?1:-1,ex=ad-maxDh;
      if(pin[a]&&!pin[b])H[b]-=s*ex;
      else if(pin[b]&&!pin[a])H[a]+=s*ex;
      else if(!pin[a]&&!pin[b]){H[a]+=s*ex*.5;H[b]-=s*ex*.5;}
      else {
        /* Both are roadbed cells.  Keep the lower one from becoming a wall
           but split the small reconciliation between them. */
        H[a]+=s*ex*.5;H[b]-=s*ex*.5;
      }
      return true;
    };
    let terrainPasses=0;
    for(;terrainPasses<420;terrainPasses++){
      let changed=false;
      if((terrainPasses&1)===0){
        for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
          const a=j*NV+i;
          if(i+1<NV)changed=relax(a,a+1,maxDx)||changed;
          if(j+1<NV)changed=relax(a,a+NV,maxDz)||changed;
        }
      }else{
        for(let j=NV-1;j>=0;j--)for(let i=NV-1;i>=0;i--){
          const a=j*NV+i;
          if(i>0)changed=relax(a,a-1,maxDx)||changed;
          if(j>0)changed=relax(a,a-NV,maxDz)||changed;
        }
      }
      if(!changed)break;
    }

    for(let v=0;v<nVert;v++)pos[v*3+1]=H[v];
    const at=(i,j)=>H[j*NV+i];

    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const kk=(j*NV+i)*3;
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=(hL-hR)/stepX,ny=2,nz=(hD-hU)/stepZ,l=Math.hypot(nx,ny,nz)||1;
      nrm[kk]=nx/l;nrm[kk+1]=ny/l;nrm[kk+2]=nz/l;
    }

    const minX=pos[0],minZ=pos[2];
    const gridH=(x,z)=>{
      const fx=clamp((x-minX)/stepX,0,NV-1.001),fz=clamp((z-minZ)/stepZ,0,NV-1.001);
      const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
      return lerp(lerp(at(i,j),at(i+1,j),u),lerp(at(i,j+1),at(i+1,j+1),u),v);
    };
    w.meshH=gridH;w.groundAt=gridH;
    const deltaAt=(x,z)=>gridH(x,z)-oldGround(x,z);

    if(w.props&&w.props.pos){
      const p=w.props.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    if(w.water&&w.water.pos){
      const p=w.water.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }

    /* v105's yellow rectangles were billboard vegetation.  Remove these from
       the rider's near field; real geometry/glTF plants carry the close view. */
    if(w.veg&&w.veg.ctr&&w.veg.dat&&w.veg.uv){
      const C=w.veg.ctr,D=w.veg.dat,U=w.veg.uv;
      const plants=Math.floor(C.length/12);
      for(let p=0;p<plants;p++){
        const v=p*4,ci=v*3,di=v*4,ui=v*2;
        const x=C[ci],z=C[ci+2],q=near(x,z),dy=deltaAt(x,z);
        for(let qv=0;qv<4;qv++)C[(v+qv)*3+1]+=dy;
        let size=D[di+2];
        const kind=Math.max(0,Math.min(5,Math.floor(U[ui]*6+.02)));
        if(kind<=1)size=Math.min(size,.48); else size=Math.min(size,2.4);
        if(q){
          if(q.d<70)size=0;
          else if(q.d<115&&kind>=2)size*=.28;
          else if(q.d<120&&kind<=1)size*=.45;
          if(q.d<165&&kind<=1&&(p%2))size=0;
        }
        for(let qv=0;qv<4;qv++)D[(v+qv)*4+2]=size;
      }
    }

    for(let i=0;i<(w.actors||[]).length;i++){
      const a=w.actors[i];
      if(!Number.isFinite(a.px)||!Number.isFinite(a.pz))continue;
      const old=oldActorGround[i];if(!Number.isFinite(old))continue;
      const d=gridH(a.px,a.pz)-old;
      if(Number.isFinite(a.py))a.py+=d;
      if(Number.isFinite(a.gy))a.gy+=d;
      if(Number.isFinite(a.baseY))a.baseY+=d;
      if(Number.isFinite(a.pinY))a.pinY+=d;
      if(Number.isFinite(a.pinAlt))a.pinAlt+=d;
      if(Number.isFinite(a.baseRoadY))a.baseRoadY+=d;
    }
    for(const b of (w.bases||[]))if(Number.isFinite(b.x)&&Number.isFinite(b.z)&&Number.isFinite(b.y))
      b.y+=deltaAt(b.x,b.z);

    let maxSide=0,worst=null,maxRoadGap=0;
    const record=(pct,i,j,dir,h0,h1,v2)=>{
      if(pct<=maxSide)return;maxSide=pct;
      const v=j*NV+i;
      worst={x:pos[v*3],z:pos[v*3+2],gridI:i,gridJ:j,dir,h0,h1,
        roadIndex:ri[v],roadDist:dist[v],otherRoadIndex:ri[v2],otherRoadDist:dist[v2]};
    };
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i;if(dist[v]>80)continue;
      if(i<NV-1){const h0=at(i,j),h1=at(i+1,j),pct=Math.abs(h1-h0)/stepX*100;record(pct,i,j,'x',h0,h1,v+1);}
      if(j<NV-1){const h0=at(i,j),h1=at(i,j+1),pct=Math.abs(h1-h0)/stepZ*100;record(pct,i,j,'z',h0,h1,v+NV);}
    }
    for(let i=0;i<w.nMain;i+=8)
      maxRoadGap=Math.max(maxRoadGap,Math.abs(gridH(w.rx[i],w.rz[i])-(w.ry[i]-.30)));
    w.__verdantTerrainAudit={passes:terrainPasses,maxNearTrailSlopePct:maxSide,maxRoadGroundGap:maxRoadGap,worst};
    console.log('Verdant terrain audit',w.__verdantTerrainAudit);
    return w;
  };
})();
/* ===== END js/21-verdant-terrain-polish.js ===== */

/* ===== BEGIN js/35-verdant-mountains-v123.js ===== */
"use strict";

/* Verdant Rift v128 — full-route mountain cleanup -------------------------
   v126 removed the old smooth radial perimeter uplift while protecting the
   ridden corridor.  A second legacy source remained in bareLand(): the broad
   235 m Gaussian alpine mass centred near (1050,760).  From many viewpoints
   that still reads as a large green hemisphere even after adding erosion.

   v128 keeps the v126 road protection exactly as-is, explicitly removes that
   Gaussian mass away from the road, and replaces it with several offset,
   anisotropic ridges.  The result keeps a dramatic alpine quarter without a
   circular/domed silhouette. */
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
    const alpineWeight=new Float32Array(nVert);
    for(let v=0;v<nVert;v++)H[v]=before[v]=pos[v*3+1];

    const oldRadial=(x,z)=>{
      const r=Math.hypot(x,z)/HALF;
      if(r<=.72)return 0;
      const q=(r-.72)/.28;
      return q*q*185;
    };
    const oldAlpine=(x,z)=>{
      const dx=x-1050,dz=z-760;
      return 235*Math.exp(-(dx*dx+dz*dz)/(950*950));
    };
    const alpineRidges=(x,z)=>{
      const ridge=(cx,cz,ca,sa,su,sv,amp)=>{
        const dx=x-cx,dz=z-cz;
        const u=dx*ca+dz*sa,v=-dx*sa+dz*ca;
        return amp*Math.exp(-(u*u)/(su*su)-(v*v)/(sv*sv));
      };
      let h=0;
      h+=ridge(990,720,.80803,.58914,1120,285,118);
      h+=ridge(1260,930,.97590,-.21823,720,230,84);
      h+=ridge(720,1030,.52337,.85211,650,205,68);
      const broad=.78+.13*macroNoise(x/420+4.2,z/420-7.1)
                        +.09*detailNoise(x/205-8.4,z/205+2.7);
      const serr=.88+.12*Math.sin((x+z)/185+ridgeNoise(x/260,z/260)*1.7);
      return Math.max(0,h*clamp(broad*serr,.55,1.18));
    };

    let changed=0,maxRemoved=0,maxAdded=0,maxDetail=0;
    let maxAlpineRemoved=0,maxAlpineAdded=0;
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z),d=q?q.d:1e6;
      if(d<=ROAD_CORE)continue;

      const protect=smoothstep(clamp((d-ROAD_CORE)/ROAD_FADE,0,1));
      weight[v]=protect;
      if(protect<.0005)continue;
      const r=Math.hypot(x,z)/HALF,a=Math.atan2(z,x);

      /* Remove both legacy smooth mountain sources.  Beyond 130 m this is a
         complete removal, independent of whether another route leg happens to
         run somewhere behind the current camera view. */
      const old=oldRadial(x,z)*protect;
      if(old>0){H[v]-=old;maxRemoved=Math.max(maxRemoved,old);}
      const oldA=oldAlpine(x,z)*protect;
      if(oldA>.01){H[v]-=oldA;maxAlpineRemoved=Math.max(maxAlpineRemoved,oldA);}

      /* Replace the old alpine Gaussian with offset elongated ridges rather
         than another radial mound.  Its footprint is deliberately asymmetric. */
      const ar=alpineRidges(x,z)*protect;
      if(ar>.01){
        H[v]+=ar;
        alpineWeight[v]=clamp(ar/175,0,1);
        maxAlpineAdded=Math.max(maxAlpineAdded,ar);
      }

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

      /* Erosion/shoulders operate on all high terrain, including the new
         alpine ridges, so broad smooth faces do not survive as green blobs. */
      const high=clamp((H[v]-34)/225,0,1),edge=clamp((r-.52)/.48,0,1);
      const strength=protect*clamp(.09+high*.62+edge*.40+alpineWeight[v]*.22,0,1);
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

      /* Broad shoulders become stone before they become cliffs.  Alpine ridge
         influence explicitly contributes so the replacement cannot read as a
         single giant green mass. */
      if(col&&d>ROAD_CORE){
        const far=smoothstep(clamp((d-ROAD_CORE)/185,0,1));
        const high=clamp((H[v]-42)/220,0,1);
        const slope=clamp((1-ny)*1.75,0,1);
        const radial=clamp((Math.hypot(x,z)/HALF-.50)/.42,0,1);
        const m=far*clamp(slope*.58+high*.30+radial*.26+alpineWeight[v]*.34,0,.90);
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
    w.__verdantMountainsV128={maxAlpineRemoved,maxAlpineAdded,legacyAlpineCenter:[1050,760],
      legacyAlpineAmp:235,paintedSkyMountains:false};
    if(maxProtectedChange>.001)
      console.error('Verdant v128 mountain pass touched protected road core',maxProtectedChange);
    console.log('Verdant v128 full-route mountain cleanup:',w.__verdantMountainsV126,w.__verdantMountainsV128);
    return w;
  };
})();
/* ===== END js/35-verdant-mountains-v123.js ===== */

/* ===== BEGIN js/37-verdant-mountains-v129.js ===== */
"use strict";

/* Verdant Rift v129 — global mountain breakup + final roadbed --------------
   v128 removed the two known legacy dome sources, but the base low-frequency
   terrain can still form broad smooth green hills.  This pass breaks those
   smooth elevated faces into ridges/saddles across the whole map, then
   re-establishes a generous final road-support shelf so terrain triangles can
   never poke through the asphalt.  It runs before nature/fauna placement. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.terrain||!w.terrain.pos||!w.terrain.nrm||
       !w._dbg||typeof w._dbg.roadNear!=='function'||!w.verdant)return w;

    const pos=w.terrain.pos,nrm=w.terrain.nrm,col=w.terrain.col;
    const nVert=pos.length/3,NV=Math.round(Math.sqrt(nVert));
    if(NV*NV!==nVert)return w;

    const near=w._dbg.roadNear,oldGround=w.meshH;
    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const ROAD_FLAT=29,ROAD_BLEND=72,ROUGH_FADE=55;
    const ridgeA=makeNoise(sc.seed+129071),ridgeB=makeNoise(sc.seed+129113);
    const macro=makeNoise(sc.seed+129181),detail=makeNoise(sc.seed+129227);
    const src=new Float32Array(nVert),H=new Float32Array(nVert);
    for(let v=0;v<nVert;v++)src[v]=H[v]=pos[v*3+1];
    const atSrc=(i,j)=>src[j*NV+i];

    let roughened=0,smoothHillCells=0,maxRoughDelta=0;
    for(let j=1;j<NV-1;j++)for(let i=1;i<NV-1;i++){
      const v=j*NV+i,k=v*3,x=pos[k],z=pos[k+2],q=near(x,z),d=q?q.d:1e6;
      if(d<=ROAD_FLAT)continue;
      const protect=smoothstep(clamp((d-ROAD_FLAT)/ROUGH_FADE,0,1));
      if(protect<.002)continue;
      const h=src[v],relief=clamp((h-26)/125,0,1);
      if(relief<.025)continue;
      const sx=(atSrc(i+1,j)-atSrc(i-1,j))/(2*stepX);
      const sz=(atSrc(i,j+1)-atSrc(i,j-1))/(2*stepZ);
      const slope=Math.hypot(sx,sz),smoothFace=1-clamp(slope/.52,0,1);
      const r1=1-Math.abs(ridgeA(x/238+7.2,z/238-4.9));
      const r2=1-Math.abs(ridgeB(x/151-11.4,z/151+8.6));
      const broad=macro(x/520+2.7,z/520-6.3);
      const tooth=detail(x/104-5.1,z/104+12.7);
      const strength=protect*relief*(.62+.38*smoothFace);
      let delta=((r1*r1-.36)*44+(r2*r2-.34)*21+broad*13+tooth*5)*strength;
      /* Cut narrow saddles into smooth domes instead of merely roughening the
         surface texture. This changes the silhouette itself. */
      const saddle=Math.pow(1-Math.abs(ridgeB(x/305+17,z/305-3)),3.0);
      delta-=saddle*(11+15*smoothFace)*strength;
      delta=clamp(delta,-31,42);
      H[v]+=delta;
      if(Math.abs(delta)>.35)roughened++;
      if(smoothFace>.58&&relief>.16)smoothHillCells++;
      maxRoughDelta=Math.max(maxRoughDelta,Math.abs(delta));
    }

    /* Final roadbed. A 16 m grid needs more than one cell radius around a
       narrow road: 29 m covers the cell diagonal plus the widest road edge.
       The road ribbon itself is at ry + .08, so terrain at ry - .34 leaves a
       reliable 42 cm visual/depth gap beneath the asphalt. */
    let roadbedVerts=0;
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z);
      if(!q||q.i<0||q.i>=w.nMain||q.d>=ROAD_BLEND)continue;
      const ww=w.verdant.widthAt(q.i),flat=Math.max(ROAD_FLAT,ww+14);
      const f=q.d<=flat?1:1-smoothstep(clamp((q.d-flat)/(ROAD_BLEND-flat),0,1));
      if(f<=0)continue;
      const target=w.ry[q.i]-.34;
      H[v]=lerp(H[v],target,f);roadbedVerts++;
    }

    for(let v=0;v<nVert;v++)pos[v*3+1]=H[v];
    const at=(i,j)=>H[j*NV+i];
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i,k=v*3,x=pos[k],z=pos[k+2];
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=(hL-hR)/stepX,ny=2,nz=(hD-hU)/stepZ,l=Math.hypot(nx,ny,nz)||1;
      nx/=l;ny/=l;nz/=l;nrm[k]=nx;nrm[k+1]=ny;nrm[k+2]=nz;

      /* Make elevated/rugged distant land read as mountain rather than one
         green blob. This is intentionally stronger than v128 on mid-height
         smooth hills, while the road corridor remains green and untouched. */
      if(col){
        const q=near(x,z),d=q?q.d:1e6;
        const far=smoothstep(clamp((d-ROAD_BLEND)/150,0,1));
        const high=clamp((H[v]-48)/120,0,1),slope=clamp((1-ny)*2.1,0,1);
        const m=far*clamp(high*.52+slope*.60,0,.86);
        if(m>.008){
          const varr=.84+.18*(macro(x/390,z/390)*.5+.5);
          const warm=.5+.5*detail(x/640-2,z/640+5);
          const rock=[(.40+.055*warm)*varr,(.405+.045*warm)*varr,(.385+.035*warm)*varr];
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

    /* Objects created by the base builder existed before this final terrain
       pass. Move those that are ground-bound by exactly the terrain delta. */
    const deltaAt=(x,z)=>gridH(x,z)-oldGround(x,z);
    if(w.props&&w.props.pos){
      const p=w.props.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    if(w.water&&w.water.pos){
      const p=w.water.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    for(const a of (w.actors||[])){
      if(!Number.isFinite(a.px)||!Number.isFinite(a.pz))continue;
      const dy=deltaAt(a.px,a.pz);
      if(Number.isFinite(a.py))a.py+=dy;
      if(Number.isFinite(a.gy))a.gy+=dy;
      if(Number.isFinite(a.baseY))a.baseY+=dy;
      if(Number.isFinite(a.pinY))a.pinY+=dy;
    }
    for(const b of (w.bases||[]))if(Number.isFinite(b.x)&&Number.isFinite(b.z)&&Number.isFinite(b.y))
      b.y+=deltaAt(b.x,b.z);

    let minRoadClearance=1e9,maxRoadTerrainAbove=-1e9;
    for(let i=0;i<w.nMain;i+=4){
      const ww=w.verdant.widthAt(i);
      for(const off of [-ww,0,ww]){
        const x=w.rx[i]-w.tz[i]*off,z=w.rz[i]+w.tx[i]*off;
        const th=gridH(x,z),roadY=w.ry[i]+.08,clear=roadY-th;
        minRoadClearance=Math.min(minRoadClearance,clear);
        maxRoadTerrainAbove=Math.max(maxRoadTerrainAbove,th-roadY);
      }
    }
    w.__verdantMountainsV129={roughened,smoothHillCells,maxRoughDelta,
      mode:'global-anti-dome-ridges'};
    w.__verdantRoadbedV129={roadbedVerts,flatM:ROAD_FLAT,blendM:ROAD_BLEND,
      minRoadClearanceM:minRoadClearance,maxRoadTerrainAboveM:maxRoadTerrainAbove};
    if(minRoadClearance<.18)
      console.error('Verdant v129 roadbed clearance too small',w.__verdantRoadbedV129);
    console.log('Verdant v129 mountain/roadbed:',w.__verdantMountainsV129,w.__verdantRoadbedV129);
    return w;
  };
})();
/* ===== END js/37-verdant-mountains-v129.js ===== */

/* ===== BEGIN js/25-verdant-lite-richness.js ===== */
"use strict";

/* Verdant Rift lightweight wildlife pass ---------------------------------
   Imported glTF nature is the visual baseline from v115 onward. The legacy
   billboard vegetation is hard-disabled by v129. v142 keeps the complete
   approved v141 world and applies only the mushroom-size and bilateral
   hillside-carpet visual correction in a later layer. */
(function(){
  const fixVegTexture=()=>{
    if(!TEX||!TEX.veg||isGL2) return;
    gl.bindTexture(gl.TEXTURE_2D,TEX.veg);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D,null);
  };
  const oldBake=bakeTextures;
  bakeTextures=function(){const r=oldBake();fixVegTexture();return r;};
  fixVegTexture();

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant') return w;

    const hash=p=>{
      let x=(p+1)^(sc.seed*2654435761);
      x=Math.imul(x^(x>>>16),2246822519);
      x=Math.imul(x^(x>>>13),3266489917);
      return ((x^(x>>>16))>>>0)/4294967296;
    };

    const BEAR_META={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};
    const putBear=(km,off,k)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes.bear) return;
      const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const ph=hash(i+17001)*6.28318;
      w.actors.push({type:'bear',px:x,py:w.meshH(x,z),pz:z,yaw:hash(i)*6.28318,k:k||1,emiss:1,
        meta:BEAR_META,ph,hx:x,hz:z,wr:2.2,wander:ph,wspd:(i&1?-1:1)*.05,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph});
    };
    putBear(.22,-20,1.15);
    putBear(2.72,24,1.25);
    putBear(16.8,-27,1.18);

    let birdCount=0;
    if(w.actors){
      const birdKeys=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready);
      const flock=(baseKm,count,seedOff)=>{
        for(let j=0;j<count;j++){
          const km=baseKm+j*.08;
          const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
          const g=birdKeys.length?birdKeys[(j+seedOff)%birdKeys.length]:'bird';
          w.actors.push({type:'gbird',gcre:g,cx:w.rx[i],cz:w.rz[i],R:18+j*7,
            circ:(j+seedOff)*1.41,w:(j&1?-1:1)*(.10+j*.012),baseY:w.ry[i]+13+j*2,
            px:w.rx[i],py:w.ry[i]+15,pz:w.rz[i],yaw:0,flap:true,flapT:1.4,
            gph:(j+seedOff)*.83,emiss:1,k:1.05+j*.05});
          birdCount++;
        }
      };
      flock(.06,4,0);
      flock(4.7,3,3);
      flock(9.7,3,2);
      flock(14.4,4,1);
      flock(20.4,3,1);
      flock(23.4,3,0);
    }

    w.__verdantLite={extraBears:3,extraBirds:birdCount};
    return w;
  };

  const RELEASE='161';
  const label=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build '+RELEASE;
    const e=document.getElementById('sceneName');
    if(e&&e.textContent&&e.textContent.indexOf('Verdant Rift')>=0&&!e.textContent.endsWith('v'+RELEASE))
      e.textContent=e.textContent.replace(/\s·\sv\d+\s*$/,'')+' · v'+RELEASE;
  };
  if(typeof document!=='undefined'){
    const install=()=>{
      label();
      const e=document.getElementById('sceneName');
      if(e)new MutationObserver(()=>label()).observe(e,{childList:true,characterData:true,subtree:true});
      [100,350,800,1500].forEach(ms=>setTimeout(label,ms));
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }
})();
/* ===== END js/25-verdant-lite-richness.js ===== */

/* ===== BEGIN js/26-verdant-real-nature.js ===== */
"use strict";

/* Verdant Rift v129 — imported nature instance source ---------------------
   External glTF models are parsed once while the menu is visible. Textures
   are sampled into per-vertex colours, but models are NOT duplicated into the
   world's props mesh. v129 exposes deterministic load status so the Verdant
   start gate can wait for nature too; the triangular legacy billboard field
   is never used as a fallback. */
(function(){
  const STORE={};
  const IMG_CACHE=new Map();
  let started=false;
  const LOAD={total:0,settled:0,ready:0,failed:0,promise:null};

  const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,
            5125:Uint32Array,5126:Float32Array};

  function resolveUrl(uri,file){return new URL(uri,new URL(file,location.href)).href;}
  function decodeDataUri(uri){
    const s=uri.slice(uri.indexOf(',')+1),raw=atob(s),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  async function loadBuffer(def,file){
    if(!def||!def.uri)throw new Error('glTF buffer has no uri');
    if(def.uri.startsWith('data:'))return decodeDataUri(def.uri);
    const r=await fetch(resolveUrl(def.uri,file));
    if(!r.ok)throw new Error('buffer '+def.uri+' HTTP '+r.status);
    return await r.arrayBuffer();
  }
  function readComponent(dv,o,ct){
    if(ct===5120)return dv.getInt8(o);
    if(ct===5121)return dv.getUint8(o);
    if(ct===5122)return dv.getInt16(o,true);
    if(ct===5123)return dv.getUint16(o,true);
    if(ct===5125)return dv.getUint32(o,true);
    return dv.getFloat32(o,true);
  }
  function normComponent(v,ct){
    if(ct===5120)return Math.max(v/127,-1);
    if(ct===5121)return v/255;
    if(ct===5122)return Math.max(v/32767,-1);
    if(ct===5123)return v/65535;
    if(ct===5125)return v/4294967295;
    return v;
  }
  function accessor(gj,buffers,i){
    const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],Ctor=CT[a.componentType];
    if(!Ctor)throw new Error('unsupported component type '+a.componentType);
    const nc=COMPONENTS[a.type],bytes=Ctor.BYTES_PER_ELEMENT;
    const off=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||nc*bytes;
    const buf=buffers[bv.buffer||0];
    if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(buf,off,a.count*nc),nc};
    const out=new Float32Array(a.count*nc),dv=new DataView(buf);
    for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
      let v=readComponent(dv,off+n*stride+c*bytes,a.componentType);
      if(a.normalized)v=normComponent(v,a.componentType);
      out[n*nc+c]=v;
    }
    return{data:out,nc};
  }

  async function imagePixels(url){
    if(IMG_CACHE.has(url))return IMG_CACHE.get(url);
    const p=new Promise((resolve,reject)=>{
      const im=new Image();
      im.onload=()=>{
        try{
          const maxS=512,sc=Math.min(1,maxS/Math.max(im.naturalWidth,im.naturalHeight));
          const w=Math.max(1,Math.round(im.naturalWidth*sc));
          const h=Math.max(1,Math.round(im.naturalHeight*sc));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const cx=cv.getContext('2d',{willReadFrequently:true});
          cx.drawImage(im,0,0,w,h);
          resolve({w,h,data:cx.getImageData(0,0,w,h).data});
        }catch(e){reject(e);}
      };
      im.onerror=()=>reject(new Error('image '+url+' failed'));
      im.src=url;
    });
    IMG_CACHE.set(url,p);return p;
  }
  function sample(px,u,v){
    u=((u%1)+1)%1;v=((v%1)+1)%1;
    const x=Math.min(px.w-1,Math.max(0,Math.floor(u*px.w)));
    const y=Math.min(px.h-1,Math.max(0,Math.floor((1-v)*px.h)));
    const k=(y*px.w+x)*4,d=px.data;
    return[d[k]/255,d[k+1]/255,d[k+2]/255,d[k+3]/255];
  }

  function faceNormal(P,ia,ib,ic){
    const ax=P[ib]-P[ia],ay=P[ib+1]-P[ia+1],az=P[ib+2]-P[ia+2];
    const bx=P[ic]-P[ia],by=P[ic+1]-P[ia+1],bz=P[ic+2]-P[ia+2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
  }

  async function loadModel(key,file){
    try{
      const r=await fetch(file);if(!r.ok)throw new Error('gltf HTTP '+r.status);
      const gj=await r.json();
      const buffers=await Promise.all((gj.buffers||[]).map(b=>loadBuffer(b,file)));
      const pixelBySource={},need=new Set();
      for(const mat of(gj.materials||[])){
        const ti=((mat.pbrMetallicRoughness||{}).baseColorTexture||{}).index;
        if(ti!==undefined&&gj.textures&&gj.textures[ti])need.add(gj.textures[ti].source);
      }
      await Promise.all(Array.from(need).map(async src=>{
        const im=gj.images&&gj.images[src];
        if(im&&im.uri)try{pixelBySource[src]=await imagePixels(resolveUrl(im.uri,file));}catch(e){}
      }));

      const outP=[],outN=[],outC=[];let visibleTriangles=0;
      for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
        if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
        const P=accessor(gj,buffers,pr.attributes.POSITION).data;
        const I=accessor(gj,buffers,pr.indices).data;
        const NA=pr.attributes.NORMAL!==undefined?accessor(gj,buffers,pr.attributes.NORMAL):null;
        const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
        const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
        const mat=(gj.materials&&gj.materials[pr.material])||{};
        const pbr=mat.pbrMetallicRoughness||{},fac=pbr.baseColorFactor||[1,1,1,1];
        const ti=(pbr.baseColorTexture||{}).index;
        const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
        const px=src!==undefined?pixelBySource[src]:null;
        const cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
        for(let t=0;t+2<I.length;t+=3){
          const a=I[t],b=I[t+1],c=I[t+2];
          let tc=[1,1,1,1];
          if(px&&UVA){
            const U=UVA.data,nc=UVA.nc;
            tc=sample(px,(U[a*nc]+U[b*nc]+U[c*nc])/3,(U[a*nc+1]+U[b*nc+1]+U[c*nc+1])/3);
          }
          let vr=1,vg=1,vb=1,va=1;
          if(CA){
            const C=CA.data,nc=CA.nc;
            vr=(C[a*nc]+C[b*nc]+C[c*nc])/3;
            vg=(C[a*nc+1]+C[b*nc+1]+C[c*nc+1])/3;
            vb=(C[a*nc+2]+C[b*nc+2]+C[c*nc+2])/3;
            if(nc>3)va=(C[a*nc+3]+C[b*nc+3]+C[c*nc+3])/3;
          }
          const alpha=tc[3]*fac[3]*va;
          if(mat.alphaMode==='MASK'&&alpha<cut)continue;
          const col=[tc[0]*fac[0]*vr,tc[1]*fac[1]*vg,tc[2]*fac[2]*vb];
          const ia=a*3,ib=b*3,ic=c*3,fn=faceNormal(P,ia,ib,ic);
          for(const vi of [a,b,c]){
            const p=vi*3;outP.push(P[p],P[p+1],P[p+2]);
            if(NA){const n=vi*NA.nc;outN.push(NA.data[n],NA.data[n+1],NA.data[n+2]);}
            else outN.push(fn[0],fn[1],fn[2]);
            outC.push(col[0],col[1],col[2]);
          }
          visibleTriangles++;
        }
      }
      if(!outP.length)throw new Error('no visible mesh triangles');
      STORE[key]={pos:new Float32Array(outP),nrm:new Float32Array(outN),
                  col:new Float32Array(outC),count:outP.length/3,
                  triangles:visibleTriangles,file};
      console.log('Verdant instanced nature ready:',key,'triangles',visibleTriangles);
      return true;
    }catch(e){
      console.warn('Verdant nature unavailable:',key,e.message);
      STORE[key]=null;return false;
    }
  }

  const natureStatus=()=>({
    started,total:LOAD.total,settled:LOAD.settled,ready:LOAD.ready,failed:LOAD.failed,
    complete:started&&LOAD.total>0&&LOAD.settled>=LOAD.total,
    coreReady:!!(STORE.common1&&STORE.bush&&STORE.fern)
  });

  function startLoads(){
    if(started)return LOAD.promise;started=true;
    const files={
      common1:'CommonTree_1.gltf',common3:'CommonTree_3.gltf',common5:'CommonTree_5.gltf',
      twisted1:'TwistedTree_1.gltf',twisted3:'TwistedTree_3.gltf',
      pine1:'Pine_1.gltf',pine3:'Pine_3.gltf',pine5:'Pine_5.gltf',dead2:'DeadTree_2.gltf',
      bush:'Bush_Common.gltf',bushFlowers:'Bush_Common_Flowers.gltf',fern:'Fern_1.gltf',
      flower4:'Flower_4_Group.gltf',mushroom:'Mushroom_Common.gltf',
      rock1:'Rock_Medium_1.gltf',rock2:'Rock_Medium_2.gltf'
    };
    const keys=Object.keys(files);LOAD.total=keys.length;
    const jobs=keys.map(k=>loadModel(k,'assets/models/'+files[k]).then(ok=>{
      LOAD.settled++;if(ok)LOAD.ready++;else LOAD.failed++;
      return ok;
    }));
    LOAD.promise=Promise.all(jobs).then(()=>natureStatus());
    return LOAD.promise;
  }

  if(typeof window!=='undefined'){
    window.__verdantNatureStatusV129=natureStatus;
    window.__verdantNatureWaitV129=()=>startLoads();
  }
  if(typeof window!=='undefined'&&typeof fetch==='function')startLoads();
  const oldInit=initGL;
  initGL=function(){const r=oldInit();startLoads();return r;};

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant)return w;

    const coreReady=!!(STORE.common1&&STORE.bush&&STORE.fern);
    if(!coreReady){
      /* Never resurrect the old 26k billboard layer: that is the source of
         the giant green triangular silhouettes seen when nature lost the race. */
      w.veg=null;
      w.__realNature={ready:false,loading:!natureStatus().complete,
        legacyBillboards:false,natureStatus:natureStatus()};
      return w;
    }

    const rr=mulberry32(sc.seed+11713),n=w.nMain,routeKm=n*ROUTE_STEP/1000;
    const groups={},models={};
    const stats={trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,total:0};
    const ranges={trees:1.45,bushes:.90,ferns:.68,flowers:.58,mushrooms:.46,rocks:1.08};

    const available=keys=>keys.filter(k=>STORE[k]);
    const pickKey=(keys,fallback)=>{
      const a=available(keys);if(a.length)return a[Math.floor(rr()*a.length)];
      return STORE[fallback]?fallback:null;
    };
    const add=(km,off,key,scale,kind)=>{
      if(!key||!STORE[key])return false;
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      if(!groups[key])groups[key]={kind,range:ranges[kind]||1,instances:[]};
      groups[key].instances.push(km,x,y,z,rr()*6.283185,scale);
      models[key]=STORE[key];
      stats[kind]++;stats.total++;return true;
    };
    const scatterBoth=(k0,k1,step,pool,offMin,offMax,sMin,sMax,kind,chance,cluster)=>{
      chance=chance===undefined?1:chance;cluster=cluster||0;
      let km=k0+rr()*step;
      while(km<k1){
        for(const side of [-1,1]){
          if(rr()>chance)continue;
          const off=side*(offMin+rr()*(offMax-offMin));
          const key=pickKey(pool,kind==='trees'?'common1':kind==='ferns'?'fern':'bush');
          add(km+(rr()-.5)*step*.35,off,key,sMin+rr()*(sMax-sMin),kind);
          if(cluster&&rr()<cluster){
            const off2=off+side*(2+rr()*6);
            add(km+(rr()-.5)*step*.55,off2,key,(sMin+rr()*(sMax-sMin))*.88,kind);
          }
        }
        km+=step*(.82+rr()*.36);
      }
    };

    scatterBoth(0,4,.070,['common1','common3','common5'],8,34,.70,1.08,'trees',.92,.24);
    scatterBoth(0,4,.036,['bush','bushFlowers'],5,22,.48,.90,'bushes',.90,.18);
    scatterBoth(0,4,.070,['fern'],5,18,.12,.22,'ferns',.72,.08);

    scatterBoth(4,9,.058,['common1','common3','twisted1','twisted3'],7,30,.58,.96,'trees',.94,.30);
    scatterBoth(4,9,.031,['bush','bushFlowers'],4.8,20,.42,.82,'bushes',.93,.22);
    scatterBoth(4,9,.046,['fern'],4.5,17,.12,.24,'ferns',.86,.12);

    scatterBoth(9,14,.078,['twisted1','twisted3','common5'],7,26,.52,.88,'trees',.88,.28);
    scatterBoth(9,14,.022,['fern'],4,16,.11,.23,'ferns',.95,.20);
    scatterBoth(9,14,.050,['bush','bushFlowers'],4.5,18,.38,.78,'bushes',.90,.20);
    scatterBoth(9,14,.066,['flower4'],4.5,16,.22,.42,'flowers',.72,.10);
    scatterBoth(9,14,.095,['mushroom'],4,13,.22,.42,'mushrooms',.60,.08);

    scatterBoth(14,19,.125,['dead2','twisted1'],9,32,.44,.74,'trees',.72,.10);
    scatterBoth(14,19,.047,['rock1','rock2'],5,25,.48,1.10,'rocks',.90,.16);
    scatterBoth(14,19,.070,['bush'],6,22,.38,.68,'bushes',.74,.08);

    scatterBoth(19,23,.055,['pine1','pine3','pine5'],7,30,.56,.96,'trees',.95,.30);
    scatterBoth(19,23,.052,['fern','bush'],4.5,18,.18,.48,'ferns',.82,.12);
    scatterBoth(19,23,.085,['rock1','rock2'],6,23,.50,1.05,'rocks',.68,.08);

    scatterBoth(23,25,.065,['common1','common5','pine5','twisted1'],7,28,.58,.96,'trees',.94,.28);
    scatterBoth(23,25,.034,['bush','bushFlowers'],4.5,18,.38,.78,'bushes',.92,.18);
    scatterBoth(23,25,.070,['fern','flower4'],4,15,.16,.38,'flowers',.72,.08);

    w.instNature={ready:true,routeKm,models,groups,stats};
    w.__realNature={ready:true,mode:'gpu-instanced',stats,natureStatus:natureStatus(),legacyBillboards:false};
    console.log('Verdant v129 instance plan:',stats,'groups',Object.keys(groups).length,natureStatus());
    return w;
  };
})();
/* ===== END js/26-verdant-real-nature.js ===== */

/* ===== BEGIN js/30-verdant-natural-v119.js ===== */
"use strict";

/* Verdant Rift v119 — natural clustered forest ----------------------------
   Replaces the evenly spaced v117/v118 placement with irregular groves,
   clearings, hero trees and layered undergrowth.  All geometry remains GPU
   instanced: this file only creates compact transform records. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;

    const I=w.instNature,G=I.groups,M=I.models,n=w.nMain,L=I.routeKm||25;
    const rr=mulberry32(sc.seed+119031);
    const stats={groves:0,heroTrees:0,trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,total:0};
    const ranges={trees:1.65,bushes:.95,ferns:.76,flowers:.62,mushrooms:.50,rocks:1.12};

    /* v119 owns the imported-nature transform plan.  Keep the parsed models,
       but remove the older regular placement from v117. */
    for(const k in G)if(G[k]&&G[k].instances)G[k].instances.length=0;

    const available=keys=>keys.filter(k=>M[k]);
    const pick=keys=>{const a=available(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const tri=()=>((rr()+rr()+rr())/3-.5)*2; // centre-biased -1..1
    const group=(key,kind)=>{
      if(!G[key])G[key]={kind,range:ranges[kind]||1,instances:[]};
      G[key].kind=kind;G[key].range=Math.max(G[key].range||0,ranges[kind]||1);
      return G[key];
    };
    const add=(km,off,key,scale,kind)=>{
      if(!key||!M[key]||!Number.isFinite(km)||!Number.isFinite(off))return false;
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      group(key,kind).instances.push(km,x,y,z,rr()*6.283185,scale);
      stats[kind]++;stats.total++;return true;
    };

    const sections=[
      {k0:0,k1:4, gap:.20,open:.16,intensity:1.00,
       trees:['common5','common3','common1'],bushes:['bush','bushFlowers'],low:['fern','flower4']},
      {k0:4,k1:9, gap:.16,open:.05,intensity:1.20,
       trees:['common5','common3','common1','twisted1','twisted3'],bushes:['bush','bushFlowers'],low:['fern']},
      {k0:9,k1:14,gap:.145,open:.04,intensity:1.27,
       trees:['common5','twisted1','twisted3'],bushes:['bushFlowers','bush'],low:['fern','flower4','mushroom']},
      {k0:14,k1:19,gap:.255,open:.26,intensity:.62,
       trees:['dead2','twisted1','common5'],bushes:['bush'],low:['rock1','rock2']},
      {k0:19,k1:23,gap:.145,open:.04,intensity:1.30,
       trees:['pine5','pine1','pine3'],bushes:['bush','fern'],low:['fern','rock1']},
      {k0:23,k1:25,gap:.17,open:.08,intensity:1.12,
       trees:['common5','common3','pine5','twisted1'],bushes:['bush','bushFlowers'],low:['fern','flower4']}
    ];

    const addLow=(km,off,key,scale)=>{
      if(!key)return;
      const kind=key.indexOf('rock')===0?'rocks':key.indexOf('flower')===0?'flowers':
                 key.indexOf('mushroom')===0?'mushrooms':'ferns';
      add(km,off,key,scale,kind);
    };

    const grove=(sec,km,side)=>{
      const intensity=sec.intensity*(.78+rr()*.46);
      const centreOff=side*(14+rr()*45);
      const longR=.035+rr()*.065;      // 35-100 m along route
      const latR=7+rr()*17;
      const treeCount=Math.max(3,Math.round((6+rr()*8)*intensity));
      stats.groves++;

      /* Trees form an irregular oval, with a few outliers. */
      for(let q=0;q<treeCount;q++){
        const near=q<2&&Math.abs(centreOff)<30;
        const k=km+tri()*longR*(q%5===0?1.45:1);
        let off=centreOff+tri()*latR;
        if(Math.abs(off)<6.8)off=(off<0?-1:1)*(6.8+rr()*5);
        const key=pick(sec.trees);
        const sca=(near?1.02:0.70)+rr()*(near?.55:.58);
        add(k,off,key,sca,'trees');
      }

      /* Bushes and low plants are concentrated under and around the grove,
         rather than sprinkled uniformly across the whole map. */
      const bushCount=Math.round((8+rr()*11)*intensity);
      for(let q=0;q<bushCount;q++){
        const k=km+tri()*longR*1.18;
        let off=centreOff+tri()*(latR+7);
        if(Math.abs(off)<4.8)off=(off<0?-1:1)*(4.8+rr()*5);
        add(k,off,pick(sec.bushes),.45+rr()*.68,'bushes');
      }
      const lowCount=Math.round((10+rr()*16)*intensity);
      for(let q=0;q<lowCount;q++){
        const k=km+tri()*longR*1.25;
        let off=centreOff+tri()*(latR+9);
        if(Math.abs(off)<4.2)off=(off<0?-1:1)*(4.2+rr()*4.5);
        const key=pick(sec.low);if(!key)continue;
        const sca=key.indexOf('rock')===0?.34+rr()*.70:key.indexOf('flower')===0?.20+rr()*.38:
                  key.indexOf('mushroom')===0?.20+rr()*.35:.15+rr()*.30;
        addLow(k,off,key,sca);
      }
    };

    for(const sec of sections){
      let km=sec.k0+rr()*sec.gap;
      while(km<sec.k1){
        /* A clearing removes an entire grove, producing the open/closed rhythm
           seen in real woodland instead of a continuous roadside fence. */
        if(rr()>=sec.open){
          const r=rr();
          if(r<.18)grove(sec,km,rr()<.5?-1:1);
          else{
            grove(sec,km,-1);
            if(r>.32)grove(sec,km+(rr()-.5)*.045,1);
          }
        }
        km+=sec.gap*(.68+rr()*.76);
      }

      /* Hero trees: sparse, larger foreground objects with deliberately
         irregular spacing.  They anchor the rider's near view. */
      let hk=sec.k0+.08+rr()*.16;
      while(hk<sec.k1){
        if(rr()>.16&&sec.intensity>.7){
          const sides=rr()<.20?[-1,1]:[rr()<.5?-1:1];
          for(const side of sides){
            add(hk+(rr()-.5)*.025,side*(7.2+rr()*10.5),pick(sec.trees),1.25+rr()*.52,'trees');
            stats.heroTrees++;
          }
        }
        hk+=(.24+rr()*.24)/Math.max(.85,sec.intensity);
      }

      /* Verge layer: subtle low growth close to the trail.  It deliberately
         skips many samples so it never becomes another regular line. */
      let vk=sec.k0+rr()*.025;
      const vergeStep=sec.intensity>1.2?.020:sec.intensity<.7?.052:.030;
      while(vk<sec.k1){
        if(rr()<.68){
          const side=rr()<.5?-1:1;
          const key=rr()<.55?pick(sec.low):pick(sec.bushes);
          if(key){
            if(sec.low.indexOf(key)>=0){
              const sca=key.indexOf('rock')===0?.28+rr()*.46:key.indexOf('flower')===0?.18+rr()*.28:
                        key.indexOf('mushroom')===0?.17+rr()*.26:.13+rr()*.22;
              addLow(vk+(rr()-.5)*.010,side*(4.4+rr()*9),key,sca);
            }else add(vk+(rr()-.5)*.010,side*(5.0+rr()*12),key,.36+rr()*.48,'bushes');
          }
        }
        vk+=vergeStep*(.70+rr()*.75);
      }
    }

    I.stats={trees:stats.trees,bushes:stats.bushes,ferns:stats.ferns,flowers:stats.flowers,
             mushrooms:stats.mushrooms,rocks:stats.rocks,total:stats.total};
    I.naturalV119=stats;
    w.__realNature={ready:true,mode:'gpu-instanced-natural-v119',stats};
    console.log('Verdant v119 natural forest:',stats);
    return w;
  };
})();
/* ===== END js/30-verdant-natural-v119.js ===== */

/* ===== BEGIN js/31-verdant-enrichment-v120.js ===== */
"use strict";

/* Verdant Rift v120 — habitat + encounter enrichment ----------------------
   Adds visual depth on top of v119 without duplicating model geometry.
   Everything added here is either a compact GPU instance transform or a
   lightweight actor.  The route, terrain and trainer physics are untouched. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;

    const I=w.instNature,G=I.groups,M=I.models,n=w.nMain,L=I.routeKm||25;
    const rr=mulberry32(sc.seed+120031);
    const stats={trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,
                 bears:0,frogs:0,monkeys:0,insects:0,birds:0,ships:0,drones:0,totalPlants:0};
    const ranges={trees:1.72,bushes:1.02,ferns:.82,flowers:.66,mushrooms:.56,rocks:1.18};
    const available=keys=>keys.filter(k=>M[k]);
    const pick=keys=>{const a=available(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const group=(key,kind)=>{
      if(!G[key])G[key]={kind,range:ranges[kind]||1,instances:[]};
      G[key].kind=kind;G[key].range=Math.max(G[key].range||0,ranges[kind]||1);
      return G[key];
    };
    const addPlant=(km,off,key,scale,kind)=>{
      if(!key||!M[key]||!Number.isFinite(km)||!Number.isFinite(off))return false;
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      group(key,kind).instances.push(km,x,y,z,rr()*6.283185,scale);
      stats[kind]++;stats.totalPlants++;return true;
    };
    const lowKind=key=>key&&key.indexOf('rock')===0?'rocks':key&&key.indexOf('flower')===0?'flowers':
                         key&&key.indexOf('mushroom')===0?'mushrooms':'ferns';
    const biome=km=>{
      if(km<4)return{trees:['common5','common3','common1'],bush:['bush','bushFlowers'],low:['fern','flower4']};
      if(km<9)return{trees:['common5','common3','common1','twisted1','twisted3'],bush:['bush','bushFlowers'],low:['fern']};
      if(km<14)return{trees:['common5','twisted1','twisted3'],bush:['bushFlowers','bush'],low:['fern','flower4','mushroom']};
      if(km<19)return{trees:['dead2','twisted1','common5'],bush:['bush'],low:['rock1','rock2']};
      if(km<23)return{trees:['pine5','pine1','pine3'],bush:['bush','fern'],low:['fern','rock1']};
      return{trees:['common5','common3','pine5','twisted1'],bush:['bush','bushFlowers'],low:['fern','flower4']};
    };

    /* Background forest depth.  Prefer the lighter models in the larger
       clusters; these fill the horizon behind v119's foreground groves. */
    const forestBands=[
      [0.0,4.0,1.00],[4.0,9.0,1.18],[9.0,14.0,1.12],
      [14.0,19.0,.42],[19.0,23.0,1.25],[23.0,25.0,1.08]
    ];
    for(const [k0,k1,intensity] of forestBands){
      let km=k0+.03+rr()*.08;
      const step=.085/Math.max(.55,intensity);
      while(km<k1){
        const b=biome(km);
        for(const side of [-1,1]){
          if(rr()<.84*intensity){
            let pool=b.trees;
            if(km<14&&M.common5)pool=['common5','common5'].concat(pool);
            if(km>=19&&km<23&&M.pine5)pool=['pine5','pine5'].concat(pool);
            const count=1+(rr()<.72?1:0)+(rr()<.28?1:0);
            for(let q=0;q<count;q++){
              const off=side*(28+rr()*58);
              addPlant(km+(rr()-.5)*.075,off,pick(pool),.68+rr()*.58,'trees');
            }
          }
        }
        km+=step*(.72+rr()*.62);
      }
    }

    /* Irregular verge thickets.  Anchors are far apart, but each anchor grows
       a small local patch, so the trail feels lush without becoming a fence. */
    for(let km=.10;km<L;){
      const b=biome(km),rocky=km>=14&&km<19;
      if(rr()>(rocky?.48:.17)){
        const side=rr()<.5?-1:1;
        const centre=side*((rocky?7.5:5.0)+rr()*(rocky?14:12));
        const count=(rocky?2:4)+Math.floor(rr()*(rocky?4:7));
        for(let q=0;q<count;q++){
          const useLow=rr()<.62,key=useLow?pick(b.low):pick(b.bush);
          if(!key)continue;
          const off=centre+side*((rr()-.5)*(rocky?10:8));
          if(useLow){
            const kind=lowKind(key);
            const scale=kind==='rocks'?.30+rr()*.72:kind==='flowers'?.20+rr()*.38:
                        kind==='mushrooms'?.18+rr()*.34:.16+rr()*.32;
            addPlant(km+(rr()-.5)*.030,off,key,scale,kind);
          }else addPlant(km+(rr()-.5)*.030,off,key,.42+rr()*.65,'bushes');
        }
      }
      km+=.075+rr()*.105;
    }

    /* Signature pockets: intentionally denser scenes every few kilometres.
       These are short enough to feel like places rather than a global density
       increase. */
    const pockets=[
      {a:.75,b:1.45,tree:['common5','common3','common1'],low:['fern','flower4'],mul:1.0},
      {a:4.55,b:5.45,tree:['common5','common3','twisted1'],low:['fern'],mul:1.18},
      {a:9.45,b:10.55,tree:['twisted1','twisted3','common5'],low:['fern','flower4','mushroom'],mul:1.32},
      {a:12.05,b:13.10,tree:['twisted1','twisted3','common5'],low:['fern','mushroom'],mul:1.28},
      {a:19.35,b:20.45,tree:['pine5','pine1','pine3'],low:['fern','rock1'],mul:1.30},
      {a:23.55,b:24.45,tree:['common5','common3','pine5'],low:['fern','flower4'],mul:1.10}
    ];
    for(const p of pockets){
      for(let km=p.a+rr()*.025;km<p.b;km+=.040*(.72+rr()*.50)){
        for(const side of [-1,1]){
          if(rr()<.90){
            addPlant(km+(rr()-.5)*.025,side*(10+rr()*28),pick(p.tree),.85+rr()*.70,'trees');
            if(rr()<.55)addPlant(km+(rr()-.5)*.045,side*(24+rr()*36),pick(p.tree),.70+rr()*.60,'trees');
          }
          const lc=2+Math.floor(rr()*4*p.mul);
          for(let q=0;q<lc;q++){
            const key=pick(p.low);if(!key)continue;
            const kind=lowKind(key),scale=kind==='rocks'?.34+rr()*.68:kind==='flowers'?.20+rr()*.38:
              kind==='mushrooms'?.18+rr()*.34:.15+rr()*.31;
            addPlant(km+(rr()-.5)*.032,side*(4.5+rr()*19),key,scale,kind);
          }
        }
      }
    }

    /* Rocky outcrops in the exposed ridge. */
    for(let km=14.15;km<18.85;km+=.18+rr()*.20){
      const side=rr()<.5?-1:1,count=3+Math.floor(rr()*6);
      for(let q=0;q<count;q++)addPlant(km+(rr()-.5)*.075,side*(6+rr()*28),pick(['rock1','rock2']),.42+rr()*1.05,'rocks');
      if(rr()<.42)addPlant(km+(rr()-.5)*.055,-side*(10+rr()*24),pick(['dead2','twisted1']),.68+rr()*.48,'trees');
    }

    /* Wildlife helpers.  These initialize the full runtime state immediately;
       actors added here run after the v19 adapter, so relying on that adapter
       would recreate the v111 black-screen bug. */
    const META={
      bear:{float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      frog:{float:0,gait:4.3,turn:1.2,rest:0,eye:.46,hip:.16,sh:.33,headY:.42,headZ:.20},
      monkey:{float:.01,gait:2.5,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12},
      insect:{float:.01,gait:7.5,turn:1.5,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.05}
    };
    const addAnimal=(type,km,off,k,yadd)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes[type])return false;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off),x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const ph=rr()*6.283185,meta=META[type],py=w.meshH(x,z)+(yadd||0);
      const a={type,px:x,py,pz:z,yaw:rr()*6.283185,k:k||1,emiss:1,meta,ph,hx:x,hz:z,
        wr:type==='bear'?2.2:(type==='frog'?.35:(type==='monkey'?.22:.6)),wander:ph,
        wspd:(i&1?-1:1)*(type==='frog'?.35:(type==='insect'?.7:.05)),alert:0,
        headYaw:0,headPitch:0,swing:0,gph:ph};
      if(type==='monkey'||type==='insect')a.pinY=py;
      if(type==='bear')a.gcre='vbear';else if(type==='frog')a.gcre='vfrog';else if(type==='monkey')a.gcre='vmonkey';
      w.actors.push(a);stats[type==='bear'?'bears':type==='frog'?'frogs':type==='monkey'?'monkeys':'insects']++;return true;
    };

    /* Visible animal encounters, not distant map decoration. */
    [[3.45,-13,1.35],[5.62,12,1.42],[18.35,-14,1.38],[20.72,13,1.45]]
      .forEach(v=>addAnimal('bear',v[0],v[1],v[2],0));
    for(const base of [6.15,6.62,7.08,7.58,8.10,8.55]){
      for(let j=0;j<3;j++)addAnimal('frog',base+(j-1)*.025,(j%2?-1:1)*(4.5+rr()*4),1.35+rr()*.45,0);
    }
    for(let j=0;j<14;j++){
      const km=9.35+j*.26,side=j%2?-1:1;
      addAnimal('monkey',km,side*(5.5+rr()*7),1.15+rr()*.42,2.8+rr()*3.0);
    }
    for(let j=0;j<28;j++){
      const km=7.0+j*.19,side=j%2?-1:1;
      addAnimal('insect',km,side*(4+rr()*11),.85+rr()*.55,1.0+rr()*3.3);
    }

    /* Extra bird encounters distributed across the lap. */
    const birdKeys=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready);
    const flock=(baseKm,count,seedOff)=>{
      if(!w.actors)return;
      for(let j=0;j<count;j++){
        const km=(baseKm+j*.045)%L,i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
        const g=birdKeys.length?birdKeys[(j+seedOff)%birdKeys.length]:'bird';
        w.actors.push({type:'gbird',gcre:g,cx:w.rx[i],cz:w.rz[i],R:16+j*6+rr()*8,
          circ:(j+seedOff)*1.31+rr(),w:(j&1?-1:1)*(.09+j*.010),baseY:w.ry[i]+11+j*1.6,
          px:w.rx[i],py:w.ry[i]+13,pz:w.rz[i],yaw:0,flap:true,flapT:1.2+rr()*1.2,
          gph:(j+seedOff)*.79,emiss:1,k:1.05+j*.04});stats.birds++;
      }
    };
    [2.25,5.75,8.75,12.55,15.55,18.30,22.10,24.15].forEach((km,i)=>flock(km,3+(i%3===0?1:0),i));

    /* Larger, lower fly-bys make the existing sky traffic noticeable. */
    if(w.actors){
      for(let j=0;j<4;j++){
        const a=rr()*6.283185;
        w.actors.push({type:'shuttle',gcre:'vship',dx:Math.cos(a),dz:Math.sin(a),
          sx:(rr()*2-1)*420,sz:(rr()*2-1)*420,ph:rr()*6.283185,spd:42+rr()*44,
          alt:85+rr()*145,len:5200,s0:rr()*5200,k:2.0+rr()*1.0});stats.ships++;
      }
      for(const km of [16.15,16.75,17.35,17.80]){
        const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
        w.actors.push({type:'drone',cx:w.rx[i],cz:w.rz[i],gy:w.ry[i],r:18+rr()*34,
          alt:12+rr()*24,ph:rr()*6.283185,w:(rr()<.5?-1:1)*(.11+rr()*.12),
          px:w.rx[i],py:w.ry[i]+22,pz:w.rz[i],yaw:0,k:1.5+rr()*.5});stats.drones++;
      }
    }

    if(I.stats){
      for(const k of ['trees','bushes','ferns','flowers','mushrooms','rocks'])I.stats[k]=(I.stats[k]||0)+stats[k];
      I.stats.total=(I.stats.total||0)+stats.totalPlants;
    }
    I.enrichmentV120=stats;
    w.__verdantV120=stats;
    console.log('Verdant v120 enrichment:',stats);
    return w;
  };
})();
/* ===== END js/31-verdant-enrichment-v120.js ===== */

/* ===== BEGIN js/32-verdant-fauna-buildings-v121.js ===== */
"use strict";

/* Verdant Rift v121 — fauna + settlements ----------------------------------
   Uses the static glTF buildings already loaded into GLTREES and the remaining
   creature library already baked into GLCRE.  Buildings are sparse, baked once
   into the world props mesh, and sit on automatic foundations.  Animals are
   lightweight actors with their full runtime state initialized immediately. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;

    const rr=mulberry32(sc.seed+121031),n=w.nMain,L=(w.lapLen||25000)/1000;
    const stats={buildings:0,buildingTris:0,skippedBuildings:[],stags:0,cats:0,
      jellies:0,dragonflies:0,rays:0,walkers:0,rovers:0,drones:0};
    const mb=new MeshB();
    const MAX_BUILDING_TRIS=450000;
    const foundationCol=hx('#343d3c');

    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      return {i,x,z,yaw:Math.atan2(w.tx[i],w.tz[i])};
    };

    const bounds=model=>{
      if(model.__v121Bounds)return model.__v121Bounds;
      const f=model.norm||1,mn=[1e20,1e20,1e20],mx=[-1e20,-1e20,-1e20];
      let tris=0;
      for(const pr of model.prims||[]){
        const P=pr.pos||[];tris+=Math.floor((pr.idx||[]).length/3);
        for(let v=0;v+2<P.length;v+=3){
          const x=P[v]*f,y=P[v+1]*f,z=P[v+2]*f;
          if(x<mn[0])mn[0]=x;if(y<mn[1])mn[1]=y;if(z<mn[2])mn[2]=z;
          if(x>mx[0])mx[0]=x;if(y>mx[1])mx[1]=y;if(z>mx[2])mx[2]=z;
        }
      }
      model.__v121Bounds={mn,mx,w:Math.max(.01,mx[0]-mn[0]),h:Math.max(.01,mx[1]-mn[1]),
        d:Math.max(.01,mx[2]-mn[2]),cx:(mn[0]+mx[0])*.5,cz:(mn[2]+mx[2])*.5,tris};
      return model.__v121Bounds;
    };

    const stampBuilding=(key,km,off,targetH,yawOff,label)=>{
      const model=GLTREES&&GLTREES[key];
      if(!model||!model.prims||!model.prims.length){stats.skippedBuildings.push(label||key);return false;}
      const b=bounds(model);
      if(stats.buildingTris+b.tris>MAX_BUILDING_TRIS){stats.skippedBuildings.push((label||key)+'(budget)');return false;}
      const p=routePose(km,off),scale=targetH/b.h,yaw=p.yaw+(yawOff||0);
      const fw=b.w*scale,fd=b.d*scale;
      const r=Math.min(22,Math.max(4,Math.max(fw,fd)*.40));
      const samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]];
      let minG=1e20,maxG=-1e20;
      for(const q of samples){const gy=w.meshH(p.x+q[0],p.z+q[1]);if(gy<minG)minG=gy;if(gy>maxG)maxG=gy;}
      if(!Number.isFinite(minG)||!Number.isFinite(maxG)){minG=maxG=w.meshH(p.x,p.z);}

      /* deep enough to hide uneven terrain under a large footprint */
      const fh=Math.max(1.0,(maxG-minG)+1.0);
      mb.setTF(p.x,minG-.55,p.z,yaw,1);
      mb.box(0,0,0,fw+3.5,fh,fd+3.5,foundationCol,.02);

      mb.setTF(p.x,maxG+.10,p.z,yaw,scale);
      const f=model.norm||1;
      for(const pr of model.prims){
        const P=pr.pos,I=pr.idx,c=pr.col||[.5,.5,.5],em=pr.em||.02;
        for(let t=0;t+2<I.length;t+=3){
          const at=ii=>{
            const j=I[ii]*3;
            return mb.P(P[j]*f-b.cx,P[j+1]*f-b.mn[1],P[j+2]*f-b.cz);
          };
          mb.tri(at(t),at(t+1),at(t+2),c,em);
        }
      }
      stats.buildings++;stats.buildingTris+=b.tris;return true;
    };

    /* Three recognizable settlements rather than a random scatter. */
    const settlement=[
      /* 5–6 km: forest research / ranger outpost */
      ['stSide',5.42,-30,12,.20,'station_side'],
      ['sHang', 5.60, 42,18,-.35,'station_hangar'],
      ['sAnt',  5.76, 55,25,.15,'station_antenna'],
      ['stGate',5.92,-38,14,1.57,'station_gate'],
      ['sRef',  6.05, 62,22,.45,'station_refinery'],

      /* 16–18 km: the main sky-port city */
      ['cGate', 16.02,-34,24,1.57,'city_gate'],
      ['cDome', 16.25, 58,34,.25,'city_dome'],
      ['cTower',16.48,-74,72,-.12,'city_tower'],
      ['cArc',  16.72, 88,58,.30,'city_arcology'],
      ['cSpire',16.98,-96,66,-.28,'city_spire_pair'],
      ['cClu',  17.22, 82,52,.18,'city_cluster'],
      ['sRing', 17.48,-62,38,.38,'station_ring'],

      /* 21–22 km: summit relay */
      ['sAnt',  21.10,-35,28,-.20,'station_antenna_summit'],
      ['sRing', 21.32, 45,28,.30,'station_ring_summit'],
      ['stSide',21.52,-42,13,-.25,'station_side_summit'],
      ['stGate',21.70, 36,13,1.57,'station_gate_summit']
    ];
    for(const s of settlement)stampBuilding(...s);

    if(mb.idx.length&&w.props){
      const base=w.props.pos.length/3;
      const pos=new Float32Array(w.props.pos.length+mb.pos.length);pos.set(w.props.pos);pos.set(mb.pos,w.props.pos.length);
      const nrm=new Float32Array(w.props.nrm.length+mb.nrm.length);nrm.set(w.props.nrm);nrm.set(mb.nrm,w.props.nrm.length);
      const col=new Float32Array(w.props.col.length+mb.col.length);col.set(w.props.col);col.set(mb.col,w.props.col.length);
      const idx=new Uint32Array(w.props.idx.length+mb.idx.length);idx.set(w.props.idx);
      for(let i=0;i<mb.idx.length;i++)idx[w.props.idx.length+i]=base+mb.idx[i];
      w.props={pos,nrm,col,idx};
    }

    /* ---- the rest of the creature library -------------------------------- */
    const META={
      stag:{float:0,gait:3.3,turn:.95,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.4,turn:1.15,rest:.05,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      jelly:{float:3.0,gait:0,turn:0,rest:0,eye:.85,hip:.48,sh:.75,headY:.82,headZ:0},
      dfly:{float:1.25,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02}
    };
    const addCreature=(kind,gcre,km,off,k,yadd)=>{
      if(!w.actors||!GLCRE||!GLCRE[gcre]||!GLCRE[gcre].ready)return false;
      const p=routePose(km,off),meta=META[kind],ph=rr()*6.283185,py=w.meshH(p.x,p.z)+(yadd||0);
      const a={type:'v121_'+kind, gcre, px:p.x,py,pz:p.z,yaw:rr()*6.283185,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr:kind==='stag'?2.6:(kind==='cat'?.9:(kind==='jelly'?1.4:.7)),
        wander:ph,wspd:(rr()<.5?-1:1)*(kind==='stag'?.045:(kind==='cat'?.09:(kind==='dfly'?.55:.08))),
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,gait:meta.gait,rdx:p.x,rdz:p.z};
      if(meta.float)a.pinY=py;
      w.actors.push(a);
      if(kind==='stag')stats.stags++;else if(kind==='cat')stats.cats++;
      else if(kind==='jelly')stats.jellies++;else stats.dragonflies++;
      return true;
    };

    /* deer where the forest opens, including a few close enough to notice */
    [[1.35,-13],[2.15,16],[3.35,-18],[4.35,12],[5.05,-15],[19.25,15],[19.90,-12],[20.45,17],[23.45,-14],[24.20,16]]
      .forEach(v=>addCreature('stag','stag',v[0],v[1],.90+rr()*.22,0));

    /* cats live around the three settlements */
    [[5.46,-8],[5.82,10],[6.02,-11],[16.18,9],[16.66,-12],[17.12,10],[21.18,-8],[21.56,9]]
      .forEach(v=>addCreature('cat','cat',v[0],v[1],.95+rr()*.18,0));

    /* floating jellies over wetland / jungle pools */
    [[6.35,-14,5],[6.78,16,7],[7.20,-18,6],[7.72,13,8],[8.18,-15,5],[8.62,17,7],
     [10.25,-18,6],[10.82,16,8],[11.35,-14,7],[12.10,18,6]]
      .forEach(v=>addCreature('jelly','jelly',v[0],v[1],.80+rr()*.35,v[2]));

    /* dragonflies remain low and close to the trail in the wet sections */
    for(let j=0;j<24;j++){
      const km=6.05+j*.115+(rr()-.5)*.035,side=j%2?-1:1;
      addCreature('dfly','dfly',km,side*(4.5+rr()*9),.85+rr()*.35,1.1+rr()*1.8);
    }

    /* make the ray-birds unmistakable rather than relying only on random bird rotation */
    if(w.actors&&GLCRE.bird4&&GLCRE.bird4.ready){
      for(let j=0;j<7;j++){
        const km=12.2+j*.07,p=routePose(km,0);
        w.actors.push({type:'gbird',gcre:'bird4',cx:p.x,cz:p.z,R:24+j*7,circ:j*.82,
          w:(j&1?-1:1)*(.065+j*.006),baseY:w.ry[p.i]+18+j*2,px:p.x,py:w.ry[p.i]+20,pz:p.z,
          yaw:0,flap:true,flapT:1.6,gph:j*.7,emiss:1,k:1.25+j*.06});stats.rays++;
      }
    }

    /* Extra human/robot activity around the new structures, using the meshes
       already present in the base Verdant actor set. */
    const putExisting=(type,km,off,k)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes[type])return false;
      const p=routePose(km,off),ph=rr()*6.283185;
      if(type==='astro'){
        w.actors.push({type:'astro',cx:p.x,cz:p.z,r:2+rr()*5,w:(rr()<.5?-1:1)*.07,ph,walk:true,
          px:p.x,py:w.meshH(p.x,p.z),pz:p.z,yaw:0,k:k||1});stats.walkers++;
      }else if(type==='rover'){
        w.actors.push({type:'rover',cx:p.x,cz:p.z,r:5+rr()*12,w:(rr()<.5?-1:1)*.05,ph,
          px:p.x,py:w.meshH(p.x,p.z),pz:p.z,yaw:0,k:k||1});stats.rovers++;
      }else if(type==='drone'){
        w.actors.push({type:'drone',cx:p.x,cz:p.z,gy:w.meshH(p.x,p.z),r:18+rr()*28,alt:14+rr()*24,
          ph,w:(rr()<.5?-1:1)*(.10+rr()*.12),px:p.x,py:w.meshH(p.x,p.z)+20,pz:p.z,yaw:0,k:k||1});stats.drones++;
      }
      return true;
    };
    for(const km of [5.45,5.68,5.92,16.15,16.38,16.65,16.90,17.18,17.42,21.18,21.48])
      putExisting('astro',km,(rr()<.5?-1:1)*(8+rr()*12),1);
    for(const km of [5.70,16.48,17.08,21.38])putExisting('rover',km,(rr()<.5?-1:1)*(14+rr()*16),1.1);
    for(const km of [5.58,16.28,16.82,17.35,21.25])putExisting('drone',km,(rr()<.5?-1:1)*(20+rr()*18),1.3);

    stats.allBuildingKeys=['stSide','sHang','sAnt','stGate','sRef','cGate','cDome','cTower','cArc','cSpire','cClu','sRing'];
    stats.allCreatureKeys=['bear','frog','monkey','insect','stag','cat','jelly','dfly','bird','bird2','bird3','bird4'];
    w.__verdantV121=stats;
    console.log('Verdant v121 fauna + settlements:',stats);
    return w;
  };
})();
/* ===== END js/32-verdant-fauna-buildings-v121.js ===== */

/* ===== BEGIN js/33-verdant-terrain-birds-v122.js ===== */
"use strict";

/* Verdant Rift v122 — terrain materials + a much busier sky ----------------
   The nature pack contains high-resolution rock/path photographs. Verdant
   keeps the upgraded rock source for cliffs and mountain faces, but v123
   deliberately restores the proven neutral Lunar Ride road material. The
   PathRocks sample is still conditioned and retained for later true off-road
   sections; it is no longer painted across the paved road, where its green
   detail looked like grass bleeding through the lane.

   Birds stay as lightweight gbird actors. They are spread in habitat-sized
   flocks so only a small subset is within the renderer's 430 m actor cull at
   any one time, even though the whole 25 km lap feels alive. */
(function(){
  /* ---- Verdant-only terrain texture set ---------------------------------- */
  TEX.verdant=TEX.verdant||{ready:false,loading:false};

  async function loadVerdantTerrainMaterials(){
    const V=TEX.verdant;
    if(V.ready||V.loading)return V.promise||Promise.resolve(V);
    V.loading=true;
    V.promise=(async()=>{
      try{
        const [rock,path,desert]=await Promise.all([
          loadImage('assets/models/Rocks_Diffuse.png'),
          loadImage('assets/models/PathRocks_Diffuse.png'),
          loadImage('assets/models/Rocks_Desert_Diffuse.png')
        ]);
        const S=1024;
        if(rock){
          /* Rock_Medium's own diffuse map becomes the cliff/mountain source. */
          let rc=conditionTile(rock,S,.42,4.8,.72,.92);
          /* A small amount of the desert-rock sample breaks colour repetition
             without turning the whole green world into a desert. */
          if(desert){
            const dc=conditionTile(desert,S,.38,4.2,.68,.88);
            const mix=document.createElement('canvas');mix.width=S;mix.height=S;
            const x=mix.getContext('2d');
            x.drawImage(rc.albCanvas,0,0);
            x.globalAlpha=.22;x.drawImage(dc.albCanvas,0,0);x.globalAlpha=1;
            rc=conditionTile(mix,S,0,4.9,.78,.96);
          }
          V.rA=glTexFromCanvas(rc.albCanvas);V.rN=glTexFromData(rc.nrm,S);
        }
        if(path){
          /* Keep a prepared gravel material for future single-track/off-road
             meshes, but DO NOT bind it to gpu.road. */
          const pc=conditionTile(path,S,.30,2.8,.58,.72);
          V.pathA=glTexFromCanvas(pc.albCanvas);V.pathN=glTexFromData(pc.nrm,S);
        }
        V.ready=!!(V.rA&&V.rN);
        V.loading=false;
        const el=typeof document!=='undefined'&&document.getElementById('texStatus');
        if(el&&V.ready&&!el.textContent.includes('Verdant rock'))
          el.textContent+=' | Verdant rock: nature pack';
        console.log('Verdant v123 materials:',V.ready?'rock ready; clean road restored':'fallback');
      }catch(e){
        V.loading=false;V.ready=false;
        console.warn('Verdant terrain textures unavailable:',e&&e.message?e.message:e);
      }
      return V;
    })();
    return V.promise;
  }

  /* drawMesh is the choke point for terrain/road geometry. Verdant gets the
     upgraded rock only on terrain. The road explicitly rebinds the original
     asphalt slot, preventing the PathRocks image from colouring the lane. */
  const baseDrawMesh=drawMesh;
  drawMesh=function(b){
    const active=typeof state!=='undefined'&&state.scene&&state.scene.id==='verdant'
      &&typeof gpu!=='undefined';
    const V=TEX.verdant;
    if(active&&V&&V.ready&&b===gpu.terrain){
      const binds=[[2,TEX.gA],[3,TEX.gN],[4,V.rA||TEX.rA],[5,V.rN||TEX.rN],
                   [6,TEX.aA],[7,TEX.aN]];
      for(const q of binds){gl.activeTexture(gl.TEXTURE0+q[0]);gl.bindTexture(gl.TEXTURE_2D,q[1]);}
      gl.activeTexture(gl.TEXTURE0);
    }else if(active&&b===gpu.road){
      /* hard reset of the road pair: no Verdant grass/rock/path texture can
         leak into the road material even after a terrain draw. */
      gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,TEX.aA);
      gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,TEX.aN);
      gl.activeTexture(gl.TEXTURE0);
    }
    return baseDrawMesh(b);
  };

  /* ---- bird enrichment ---------------------------------------------------- */
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;
    loadVerdantTerrainMaterials();              // lazy: only Verdant pays for it

    const rr=mulberry32(sc.seed+122771),n=w.nMain,L=(w.lapLen||25000)/1000;
    const stats={birds:0,finches:0,kestrels:0,gulls:0,rays:0,flocks:0};
    const pose=(km)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      return {i,x:w.rx[i],z:w.rz[i],y:w.ry[i]};
    };
    const addBird=(gcre,km,opt,j)=>{
      const p=pose(km),side=(j&1?-1:1);
      const along=(rr()-.5)*(opt.spread||.12);
      const p2=pose(km+along);
      const R=(opt.r0||12)+rr()*((opt.r1||28)-(opt.r0||12));
      const base=(opt.h0||9)+rr()*((opt.h1||24)-(opt.h0||9));
      const a={type:'gbird',gcre,cx:p2.x+side*(rr()*5),cz:p2.z+side*(rr()*5),R,
        circ:rr()*6.283185,w:(rr()<.5?-1:1)*((opt.w0||.055)+rr()*(opt.w1||.10)),
        baseY:p.y+base,px:p2.x,py:p.y+base,pz:p2.z,yaw:0,
        flap:rr()>.28,flapT:.8+rr()*2.6,gph:rr()*6.283185,emiss:1,
        k:(opt.k0||.82)+rr()*((opt.k1||1.15)-(opt.k0||.82))};
      if(opt.glide)a.noGlide=rr()<.55;
      w.actors.push(a);stats.birds++;
      if(gcre==='bird3')stats.finches++;else if(gcre==='bird')stats.kestrels++;
      else if(gcre==='bird2')stats.gulls++;else if(gcre==='bird4')stats.rays++;
    };
    const flock=(gcre,km,count,opt)=>{
      stats.flocks++;
      for(let j=0;j<count;j++)addBird(gcre,km,opt||{},j);
    };

    for(const km of [.45,2.25,4.15,9.55,11.25,18.75,20.15,23.35])
      flock('bird3',km,8,{h0:6,h1:14,r0:7,r1:18,w0:.08,w1:.16,k0:.72,k1:.98,spread:.16});
    for(const km of [6.35,7.65,8.85])
      flock('bird2',km,8,{h0:10,h1:24,r0:16,r1:38,w0:.05,w1:.10,k0:.92,k1:1.18,spread:.22,glide:true});
    for(const km of [3.15,12.75,14.35,19.35,22.35])
      flock('bird',km,6,{h0:16,h1:34,r0:20,r1:48,w0:.04,w1:.085,k0:.96,k1:1.25,spread:.20,glide:true});
    for(const km of [16.55,17.35,21.35])
      flock('bird4',km,5,{h0:25,h1:48,r0:30,r1:64,w0:.025,w1:.055,k0:1.18,k1:1.55,spread:.24,glide:true});

    stats.textureAssets=['Rocks_Diffuse.png','Rocks_Desert_Diffuse.png','PathRocks_Diffuse.png'];
    stats.roadMaterial='core-asphalt-clean';
    stats.totalActors=w.actors.length;
    w.__verdantV122=stats;
    console.log('Verdant v122/v123 terrain + birds:',stats);
    return w;
  };
})();
/* ===== END js/33-verdant-terrain-birds-v122.js ===== */

/* ===== BEGIN js/34-verdant-assets-gate-v123.js ===== */
"use strict";

/* Verdant Rift v129 — asset readiness gate ---------------------------------
   The original v123 gate waited for creatures and settlements, but not the
   imported nature parser. Entering Verdant while nature was still decoding
   made the whole ride fall back to the old triangular billboard forest.
   v129 waits for nature settlement too, then calls the synchronous world
   builder only after every requested nature model has settled. */
(function(){
  const BUILDINGS={
    stSide:'assets/models/station_side.gltf',
    sHang:'assets/models/station_hangar.gltf',
    sAnt:'assets/models/station_antenna.gltf',
    stGate:'assets/models/station_gate.gltf',
    sRef:'assets/models/station_refinery.gltf',
    cGate:'assets/models/city_gate.gltf',
    cDome:'assets/models/city_dome.gltf',
    cTower:'assets/models/city_tower.gltf',
    cArc:'assets/models/city_arcology.gltf',
    cSpire:'assets/models/city_spire_pair.gltf',
    cClu:'assets/models/city_cluster.gltf',
    sRing:'assets/models/station_ring.gltf'
  };
  const CREATURES={
    stag:['assets/models/creature_stag.gltf',{pose:stagPose,head:['Neck','Head'],N:16}],
    jelly:['assets/models/creature_jelly.gltf',{}],
    bird:['assets/models/bird_kestrel.gltf',{pose:birdPose,N:16}],
    bird2:['assets/models/bird_gull.gltf',{pose:birdPose,N:16}],
    bird3:['assets/models/bird_finch.gltf',{pose:birdPose,N:16}],
    bird4:['assets/models/bird_ray.gltf',{pose:birdPose,N:16}],
    cat:['assets/models/creature_cat.gltf',{pose:stagPose,head:['Neck','Head'],N:16}],
    dfly:['assets/models/creature_dragonfly.gltf',{pose:birdPose,N:12}],
    vbear:['assets/models/verdant_bear.gltf',{}],
    vfrog:['assets/models/verdant_frog.gltf',{}],
    vmonkey:['assets/models/verdant_monkey.gltf',{}],
    vship:['assets/models/verdant_ship.gltf',{}]
  };

  const natureStatus=()=>{
    try{
      if(typeof window!=='undefined'&&typeof window.__verdantNatureStatusV129==='function')
        return window.__verdantNatureStatusV129();
    }catch(e){}
    return {started:false,total:0,settled:0,ready:0,failed:0,complete:false,coreReady:false};
  };
  const status=()=>{
    const mb=[],mc=[];
    for(const k in BUILDINGS)if(!GLTREES||!GLTREES[k]||!GLTREES[k].prims||!GLTREES[k].prims.length)mb.push(k);
    for(const k in CREATURES)if(!GLCRE||!GLCRE[k]||!GLCRE[k].ready)mc.push(k);
    const ns=natureStatus(),baseTotal=Object.keys(BUILDINGS).length+Object.keys(CREATURES).length;
    const baseReady=baseTotal-mb.length-mc.length;
    return {missingBuildings:mb,missingCreatures:mc,nature:ns,
      total:baseTotal+(ns.total||0),ready:baseReady+(ns.settled||0),
      natureComplete:!!ns.complete,natureCoreReady:!!ns.coreReady};
  };

  let waiting=null,retried=false;
  const retryMissing=s=>{
    if(retried)return;
    retried=true;
    for(const k of s.missingBuildings){
      const f=BUILDINGS[k];
      try{loadGLTFStatic(k,f,1);}catch(e){}
    }
    for(const k of s.missingCreatures){
      const c=CREATURES[k];
      try{loadGLTFCreature(k,c[0],c[1]);}catch(e){}
    }
    try{
      if(typeof window.__verdantNatureWaitV129==='function')window.__verdantNatureWaitV129();
    }catch(e){}
  };

  const allReady=s=>!s.missingBuildings.length&&!s.missingCreatures.length&&s.natureComplete;
  const waitForAssets=()=>{
    try{if(typeof window.__verdantNatureWaitV129==='function')window.__verdantNatureWaitV129();}catch(e){}
    const now=status();
    if(allReady(now))return Promise.resolve({...now,complete:true});
    if(waiting)return waiting;
    const t0=performance.now();retried=false;
    waiting=new Promise(resolve=>{
      const tick=()=>{
        const s=status(),elapsed=performance.now()-t0;
        const bar=typeof $==='function'&&$('loadBar');
        if(bar){const frac=s.total? s.ready/s.total:1;bar.style.width=(8+frac*27).toFixed(1)+'%';}
        const txt=typeof $==='function'&&$('loadTxt');
        if(txt)txt.textContent='Loading wildlife, nature & settlements '+s.ready+'/'+s.total;
        if(allReady(s)){
          waiting=null;resolve({...s,complete:true,elapsed});return;
        }
        if(elapsed>5000&&!retried)retryMissing(s);
        if(elapsed>24000){
          console.warn('Verdant v129 asset gate timed out; continuing without legacy billboards',s);
          waiting=null;resolve({...s,complete:false,elapsed});return;
        }
        setTimeout(tick,90);
      };
      tick();
    });
    return waiting;
  };

  const install=()=>{
    if(typeof startRide!=='function'||startRide.__verdantGateV129)return;
    const originalStartRide=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant')return originalStartRide(sc,resume);
      const s=status();
      if(allReady(s))return originalStartRide(sc,resume);

      try{readSetup();if(cfg.sound)audioStart();}catch(e){}
      try{
        $('menu').classList.add('hide');$('loading').classList.add('on');
        $('loadBar').style.width='8%';$('loadTxt').textContent='Loading wildlife, nature & settlements';
      }catch(e){}
      waitForAssets().then(result=>{
        window.__verdantAssetGateV129=result;
        try{$('loadTxt').textContent='Building the world';}catch(e){}
        originalStartRide(sc,resume);
      });
    };
    gated.__verdantGateV123=true;
    gated.__verdantGateV129=true;
    startRide=gated;
    window.__verdantAssetStatusV123=status;
    window.__verdantAssetStatusV129=status;
  };

  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})();
/* ===== END js/34-verdant-assets-gate-v123.js ===== */

/* ===== BEGIN js/36-verdant-wildlife-v125.js ===== */
"use strict";

/* Verdant Rift v125 — living herds + sampled-palm hero vegetation ----------
   More life, but not more statues. Land animals use the engine's existing
   awareness/grazing/flee state; road-side deer therefore run off the road when
   the rider closes to ~32 m. Frogs are deliberately small and hop/bob through
   compact wetland patches. The uploaded photogrammetry GLB was a ~293k-triangle
   tropical palm: far too heavy for a web ride as-is, so this pass uses its
   proportions/palette as a lightweight procedural hero palm instead. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.actors)return w;

    const rr=mulberry32(sc.seed+125031),n=w.nMain,L=(w.lapLen||25000)/1000;
    const TAU=6.283185307179586;
    const stats={stagHerds:0,stags:0,catGroups:0,cats:0,bearGroups:0,bears:0,
      frogGroups:0,frogs:0,dragonflySwarms:0,dragonflies:0,birdFlocks:0,birds:0,
      monkeyTroops:0,monkeys:0,jellyGroups:0,jellies:0,retunedFrogs:0,palms:0};

    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      bear:{float:0,gait:2.9,turn:.78,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      frog:{float:.001,gait:4.6,turn:1.20,rest:0,eye:.46,hip:.16,sh:.33,headY:.42,headZ:.20},
      dfly:{float:1.20,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02},
      monkey:{float:.01,gait:2.7,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12},
      jelly:{float:2.8,gait:0,turn:0,rest:0,eye:.85,hip:.48,sh:.75,headY:.82,headZ:0}
    };
    const GCRE={stag:"stag",cat:"cat",bear:"vbear",frog:"vfrog",dfly:"dfly",monkey:"vmonkey",jelly:"jelly"};

    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,
        rx:w.rx[i],rz:w.rz[i],yaw:Math.atan2(w.tx[i],w.tz[i])};
    };
    const ready=k=>GLCRE&&GLCRE[k]&&GLCRE[k].ready;

    const addLand=(kind,km,off,k,wr,wspd)=>{
      const g=GCRE[kind]; if(!ready(g))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind],py=w.meshH(p.x,p.z);
      const a={type:"v125_"+kind,gcre:g,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz};
      w.actors.push(a);stats[kind+"s"]++;return true;
    };
    const addFloat=(kind,km,off,k,wr,wspd,yadd)=>{
      const g=GCRE[kind]; if(!ready(g))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind];
      const ground=w.meshH(p.x,p.z),py=ground+(yadd||0);
      w.actors.push({type:"v125_"+kind,gcre:g,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,pinY:py,rdx:p.rx,rdz:p.rz});
      const sk=kind==="dfly"?"dragonflies":kind==="jelly"?"jellies":kind+"s";
      stats[sk]++;return true;
    };

    /* Retune every frog that older enrichment layers already created.  This
       removes the large statue-like frogs from v120 instead of merely adding
       nicer frogs beside them.  A tiny float flag gives a gentle hop/bob while
       the larger wander radius makes the patch visibly alive. */
    for(const a of w.actors){
      if(a&&a.type==="frog"&&a.gcre==="vfrog"){
        const ground=w.meshH(a.px,a.pz),ph=a.ph===undefined?rr()*TAU:a.ph;
        a.k=.34+rr()*.12;a.meta=META.frog;a.ph=ph;a.hx=a.px;a.hz=a.pz;
        a.wr=.9+rr()*1.25;a.wander=ph;a.wspd=(rr()<.5?-1:1)*(.55+rr()*.35);
        a.alert=0;a.headYaw=0;a.headPitch=0;a.swing=0;a.gph=ph;
        a.pinY=ground+.24;a.py=a.pinY;a.flee=0;
        stats.retunedFrogs++;
      }
    }

    /* Deer herds. Two or three animals in selected herds deliberately start
       on/at the road edge; the existing generic animal flee code owns the
       reaction when the rider approaches, so this stays consistent with the
       original Lunar Ride stag behaviour. */
    const deerHerds=[1.55,3.85,5.15,10.65,13.35,15.15,19.55,20.35,23.55,24.35];
    deerHerds.forEach((base,h)=>{
      const count=5+Math.floor(rr()*4),side=h%2?-1:1;stats.stagHerds++;
      for(let j=0;j<count;j++){
        let off;
        if((h===1||h===4||h===7)&&j<3)off=(j-1)*2.1;
        else off=side*(7+rr()*18)+(rr()-.5)*4;
        addLand("stag",base+(rr()-.5)*.13,off,.82+rr()*.24,1.8+rr()*3.0,.11+rr()*.10);
      }
    });

    const catGroups=[[5.55,-1],[6.00,1],[16.25,-1],[16.85,1],[17.40,-1],[21.25,1],[21.70,-1],[23.95,1]];
    catGroups.forEach(([base,side])=>{
      const count=4+Math.floor(rr()*4);stats.catGroups++;
      for(let j=0;j<count;j++)addLand("cat",base+(rr()-.5)*.085,
        side*(5.0+rr()*12),.72+rr()*.22,1.6+rr()*2.4,.24+rr()*.20);
    });

    [[2.85,-1],[8.95,1],[12.85,-1],[18.45,1],[22.75,-1]].forEach(([base,side])=>{
      const count=3+Math.floor(rr()*3);stats.bearGroups++;
      for(let j=0;j<count;j++)addLand("bear",base+(rr()-.5)*.11,
        side*(11+rr()*18),1.00+rr()*.25,3.0+rr()*3.5,.055+rr()*.055);
    });

    const frogPatches=[6.25,6.75,7.25,7.85,8.35,10.15,10.75,11.45,12.15];
    frogPatches.forEach((base,g)=>{
      const count=5+Math.floor(rr()*4);stats.frogGroups++;
      for(let j=0;j<count;j++){
        const side=j%2?-1:1,off=side*(3.8+rr()*7.5);
        addFloat("frog",base+(rr()-.5)*.075,off,.32+rr()*.16,
          .8+rr()*1.3,.55+rr()*.35,.24);
      }
    });

    [6.45,7.45,8.45,9.85,11.15,12.45,13.55].forEach((base,g)=>{
      const count=8+Math.floor(rr()*6);stats.dragonflySwarms++;
      for(let j=0;j<count;j++){
        const side=j%2?-1:1;
        addFloat("dfly",base+(rr()-.5)*.12,side*(3+rr()*10),.55+rr()*.30,
          2.2+rr()*3.0,.75+rr()*.65,1.0+rr()*2.5);
      }
    });

    [[9.45,-1],[10.85,1],[12.25,-1],[13.05,1]].forEach(([base,side])=>{
      stats.monkeyTroops++;
      for(let j=0;j<4+Math.floor(rr()*3);j++)addFloat("monkey",base+(rr()-.5)*.10,
        side*(5+rr()*10),.90+rr()*.25,1.2+rr()*1.4,.10+rr()*.10,2.6+rr()*2.4);
    });
    [[7.15,-1],[8.15,1],[10.35,-1],[11.75,1]].forEach(([base,side])=>{
      stats.jellyGroups++;
      for(let j=0;j<3+Math.floor(rr()*3);j++)addFloat("jelly",base+(rr()-.5)*.10,
        side*(8+rr()*12),.70+rr()*.28,2.0+rr()*2.0,.10+rr()*.08,4.5+rr()*3.0);
    });

    const birdKeys=["bird","bird2","bird3","bird4"].filter(ready);
    const flock=(base,count,seedOff)=>{
      if(!birdKeys.length)return;stats.birdFlocks++;
      for(let j=0;j<count;j++){
        const km=(base+(rr()-.5)*.22+L)%L,p=routePose(km,0),g=birdKeys[(j+seedOff)%birdKeys.length];
        w.actors.push({type:"gbird",gcre:g,cx:p.x,cz:p.z,R:18+rr()*55,circ:rr()*TAU,
          w:(rr()<.5?-1:1)*(.07+rr()*.10),baseY:w.ry[p.i]+12+rr()*32,
          px:p.x,py:w.ry[p.i]+16,pz:p.z,yaw:0,flap:true,flapT:1.0+rr()*1.6,
          gph:rr()*TAU,emiss:1,k:.85+rr()*.55});stats.birds++;
      }
    };
    [0.75,2.65,4.85,6.75,8.65,10.55,12.65,14.85,16.75,18.85,20.75,22.75,24.25]
      .forEach((km,i)=>flock(km,7+Math.floor(rr()*6),i));

    /* The uploaded scan is excellent visual reference but too heavy raw for
       the phone build. This lightweight palm follows its silhouette/palette. */
    if(w.props){
      const pm=new MeshB(),trunk=hx("#5b4938"),leafA=hx("#2f6650"),leafB=hx("#52785a");
      const palm=(km,off,H)=>{
        const p=routePose(km,off),gy=w.meshH(p.x,p.z),yaw=rr()*TAU;
        pm.setTF(p.x,gy,p.z,yaw,1);
        const th=H*.54,seg=th/5,leanX=(rr()-.5)*H*.035,leanZ=(rr()-.5)*H*.035;
        for(let s=0;s<5;s++){
          const f=s/5,cx=leanX*f,cz=leanZ*f,w0=H*(.040-.010*f);
          pm.box(cx,seg*(s+.5),cz,w0,seg*1.04,w0,trunk,.01);
        }
        const top=[leanX,th,leanZ],fronds=11;
        for(let q=0;q<fronds;q++){
          const a=q/fronds*TAU+(rr()-.5)*.18,ca=Math.cos(a),sa=Math.sin(a);
          const len=H*(.31+rr()*.13),wid=H*(.030+rr()*.012),drop=H*(.045+rr()*.055);
          const p0=pm.P(top[0],top[1],top[2]);
          const p1=pm.P(top[0]+ca*len*.40-sa*wid,top[1]+H*.035,top[2]+sa*len*.40+ca*wid);
          const p2=pm.P(top[0]+ca*len*.40+sa*wid,top[1]+H*.035,top[2]+sa*len*.40-ca*wid);
          const tip=pm.P(top[0]+ca*len,top[1]-drop,top[2]+sa*len);
          pm.tri(p0,p1,p2,q&1?leafA:leafB,.01);
          pm.tri(p1,tip,p2,q&1?leafA:leafB,.01);
        }
        stats.palms++;
      };
      [9.35,9.75,10.15,10.65,11.05,11.55,12.05,12.55,13.00,13.45].forEach((km,i)=>{
        palm(km,(i%2?-1:1)*(11+rr()*20),8.5+rr()*4.5);
        if(i%3===0)palm(km+.035,(i%2?1:-1)*(18+rr()*18),7.5+rr()*3.5);
      });
      if(pm.idx.length){
        const base=w.props.pos.length/3;
        const pos=new Float32Array(w.props.pos.length+pm.pos.length);pos.set(w.props.pos);pos.set(pm.pos,w.props.pos.length);
        const nrm=new Float32Array(w.props.nrm.length+pm.nrm.length);nrm.set(w.props.nrm);nrm.set(pm.nrm,w.props.nrm.length);
        const col=new Float32Array(w.props.col.length+pm.col.length);col.set(w.props.col);col.set(pm.col,w.props.col.length);
        const idx=new Uint32Array(w.props.idx.length+pm.idx.length);idx.set(w.props.idx);
        for(let i=0;i<pm.idx.length;i++)idx[w.props.idx.length+i]=base+pm.idx[i];
        w.props={pos,nrm,col,idx};
      }
    }

    w.__verdantWildlifeV125=stats;
    console.log("Verdant v125 living wildlife:",stats);
    return w;
  };
})();
/* ===== END js/36-verdant-wildlife-v125.js ===== */

/* ===== BEGIN js/38-verdant-world-cleanup-v129.js ===== */
"use strict";

/* Verdant Rift v129 — hard legacy cleanup, road-safe plants, dense wildlife -
   This is the final world-construction pass.  It permanently removes the old
   billboard field, filters every imported nature instance against the NEAREST
   route leg (not merely the leg that spawned it), and adds frequent visible
   animal herds throughout the lap. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w._dbg||typeof w._dbg.roadNear!=='function')return w;

    const near=w._dbg.roadNear;
    const oldBillboardCount=w.veg&&w.veg.count?w.veg.count:0;
    /* Hard disable: never fall back to the old triangular billboard forest,
       even if an imported model failed. Sparse real geometry is preferable to
       the legacy green triangles. */
    w.veg=null;

    let checked=0,rejectedRoad=0,kept=0;
    const rejectedByKind={};
    if(w.instNature&&w.instNature.ready&&w.instNature.groups){
      const margin={trees:5.0,bushes:3.6,ferns:2.8,flowers:2.8,mushrooms:2.6,rocks:2.5};
      const scalePad={trees:1.45,bushes:1.25,ferns:.75,flowers:.70,mushrooms:.65,rocks:.75};
      for(const key in w.instNature.groups){
        const g=w.instNature.groups[key];
        if(!g||!g.instances||!g.instances.length)continue;
        const src=g.instances,out=[],kind=g.kind||'bushes';
        for(let p=0;p+5<src.length;p+=6){
          const km=src[p],x=src[p+1],y=src[p+2],z=src[p+3],yaw=src[p+4],scale=src[p+5];
          checked++;
          const q=near(x,z);
          if(q&&q.i>=0&&q.i<w.nMain){
            const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(q.i):3.35;
            const need=ww+(margin[kind]||3.0)+(scalePad[kind]||.8)*Math.max(.2,scale||1);
            if(q.d<need){rejectedRoad++;rejectedByKind[kind]=(rejectedByKind[kind]||0)+1;continue;}
          }
          out.push(km,x,y,z,yaw,scale);kept++;
        }
        g.instances=out;
      }
    }

    const rr=mulberry32(sc.seed+129381),L=(w.lapLen||25000)/1000,n=w.nMain,TAU=6.283185307179586;
    const ready=k=>typeof GLCRE!=='undefined'&&GLCRE[k]&&GLCRE[k].ready;
    const stats={extraStagHerds:0,stags:0,extraCatGroups:0,cats:0,extraBearGroups:0,bears:0,
      extraMonkeyTroops:0,monkeys:0,extraBirdFlocks:0,birds:0,totalAdded:0};
    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      bear:{float:0,gait:2.9,turn:.78,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      monkey:{float:.01,gait:2.7,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12}
    };
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,rx:w.rx[i],rz:w.rz[i]};
    };
    const addLand=(kind,gcre,km,off,k,wr,wspd)=>{
      if(!ready(gcre)||!w.actors)return false;
      const p=routePose(km,off),ph=rr()*TAU,py=w.meshH(p.x,p.z);
      w.actors.push({type:'v129_'+kind,gcre,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta:META[kind],ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz});
      stats[kind+'s']++;stats.totalAdded++;return true;
    };

    /* Interleave these with v125's ten herds. The result is roughly one deer
       encounter per kilometre, with 7-11 animals in each new herd and most
       animals close enough to the road to be obvious from the saddle. */
    const extraHerds=[.55,2.45,3.15,4.55,6.05,7.55,8.95,9.85,11.55,12.45,14.15,18.95,21.35,22.15];
    extraHerds.forEach((base,h)=>{
      const count=7+Math.floor(rr()*5),side=h%2?-1:1;stats.extraStagHerds++;
      for(let j=0;j<count;j++){
        const off=side*(7+rr()*14)+(rr()-.5)*3.5;
        addLand('stag','stag',base+(rr()-.5)*.12,off,.96+rr()*.28,2.0+rr()*3.2,.12+rr()*.11);
      }
    });

    [[1.15,-1],[4.95,1],[6.55,-1],[15.55,1],[16.05,-1],[17.85,1],[20.95,-1],[24.65,1]]
      .forEach(([base,side])=>{
        stats.extraCatGroups++;
        for(let j=0;j<5+Math.floor(rr()*4);j++)
          addLand('cat','cat',base+(rr()-.5)*.08,side*(6+rr()*10),.78+rr()*.24,1.8+rr()*2.4,.25+rr()*.20);
      });

    [[2.10,1],[10.10,-1],[13.80,1],[23.10,-1]].forEach(([base,side])=>{
      stats.extraBearGroups++;
      for(let j=0;j<3+Math.floor(rr()*3);j++)
        addLand('bear','vbear',base+(rr()-.5)*.11,side*(12+rr()*15),1.05+rr()*.25,3+rr()*3.4,.06+rr()*.05);
    });

    [[9.15,-1],[10.25,1],[11.85,-1],[12.95,1],[13.65,-1]].forEach(([base,side])=>{
      stats.extraMonkeyTroops++;
      for(let j=0;j<5+Math.floor(rr()*4);j++)
        addLand('monkey','vmonkey',base+(rr()-.5)*.10,side*(7+rr()*10),.95+rr()*.24,1.4+rr()*1.5,.11+rr()*.10);
    });

    const birdKeys=['bird','bird2','bird3','bird4'].filter(ready);
    if(w.actors&&birdKeys.length){
      const flockBases=[1.35,3.45,5.95,7.95,10.05,12.05,14.05,16.15,18.25,20.25,22.45,24.55];
      flockBases.forEach((base,f)=>{
        stats.extraBirdFlocks++;
        const count=6+Math.floor(rr()*4);
        for(let j=0;j<count;j++){
          const p=routePose(base+(rr()-.5)*.18,0),g=birdKeys[(j+f)%birdKeys.length];
          w.actors.push({type:'gbird',gcre:g,cx:p.x,cz:p.z,R:16+rr()*48,circ:rr()*TAU,
            w:(rr()<.5?-1:1)*(.07+rr()*.11),baseY:w.ry[p.i]+10+rr()*28,
            px:p.x,py:w.ry[p.i]+14,pz:p.z,yaw:0,flap:true,flapT:1+rr()*1.6,
            gph:rr()*TAU,emiss:1,k:.90+rr()*.55});
          stats.birds++;stats.totalAdded++;
        }
      });
    }

    w.__verdantRoadPlantCleanupV129={oldBillboardCount,legacyBillboardsDisabled:true,
      checked,rejectedRoad,kept,rejectedByKind};
    w.__verdantWildlifeV129=stats;
    console.log('Verdant v129 world cleanup:',w.__verdantRoadPlantCleanupV129,w.__verdantWildlifeV129);
    return w;
  };
})();
/* ===== END js/38-verdant-world-cleanup-v129.js ===== */

/* ===== BEGIN js/27-verdant-billboard-cleanup.js ===== */
"use strict";

/* Verdant Rift v129 — hard-disable legacy billboard vegetation ------------
   The old 26k sprite forest is never uploaded in Verdant. Previous releases
   kept it when imported nature lost an asynchronous load race; that produced
   the huge green triangular silhouettes seen in v128 screenshots. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;
    const oldCount=w.veg&&w.veg.count?w.veg.count:0;
    w.veg=null;
    w.__billboardCleanup={removed:true,oldIndexCount:oldCount,mode:'hard-disable-v129'};
    console.log('Verdant v129: legacy billboard vegetation hard-disabled');
    return w;
  };
})();
/* ===== END js/27-verdant-billboard-cleanup.js ===== */

/* ===== BEGIN js/39-verdant-common-tree-mix-v134.js ===== */
"use strict";

/* Verdant Rift v134 — 75/25 light/dark CommonTree mix ----------------------
   Keep the proven v131 CommonTree geometry, placement, scale and density.
   Only create a second foliage-colour variant and deterministically move
   exactly ~25% of CommonTree instances into that dark variant.  No alpha
   rebuild, no tree-family removal and no wildlife/terrain/sky changes. */
(function(){
  const COMMON_KEYS=['common1','common3','common5'];
  const DARK_RATIO=.25;

  function darkVariant(model){
    if(!model||!model.col)return null;
    const src=model.col,dst=new Float32Array(src.length);
    for(let i=0;i+2<src.length;i+=3){
      const r=src[i],g=src[i+1],b=src[i+2];
      const greenish=g>Math.max(r,b)*1.08&&g>.16;
      if(greenish){
        /* Darken foliage only; preserve bark/branches and exact geometry. */
        dst[i]=r*.42;
        dst[i+1]=g*.58;
        dst[i+2]=b*.44;
      }else{
        dst[i]=r;dst[i+1]=g;dst[i+2]=b;
      }
    }
    return {pos:model.pos,nrm:model.nrm,col:dst,count:model.count,
      triangles:model.triangles,file:model.file,v134DarkCommon:true};
  }

  function scoreInstance(src,o,keySalt){
    /* Stable 32-bit mix using km/x/z plus key salt, only for visual selection. */
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*31)^
      Math.floor((src[o+3]||0)*17)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }

  function splitGroup(instances,keySalt){
    const n=Math.floor((instances&&instances.length||0)/6);
    if(!n)return {light:instances||[],dark:[],total:0,darkCount:0};
    const ranked=[];
    for(let j=0;j<n;j++)ranked.push({j,score:scoreInstance(instances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const target=Math.round(n*DARK_RATIO),isDark=new Uint8Array(n);
    for(let j=0;j<target;j++)isDark[ranked[j].j]=1;
    const light=[],dark=[];
    for(let j=0;j<n;j++){
      const o=j*6,out=isDark[j]?dark:light;
      for(let k=0;k<6;k++)out.push(instances[o+k]);
    }
    return {light,dark,total:n,darkCount:target};
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;

    let total=0,darkTotal=0,groups=0;
    for(let ki=0;ki<COMMON_KEYS.length;ki++){
      const key=COMMON_KEYS[ki],g=w.instNature.groups[key],m=w.instNature.models[key];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const dm=darkVariant(m);if(!dm)continue;
      const part=splitGroup(g.instances,0x9e3779b9^(ki*0x45d9f3b));
      const darkKey=key+'DarkV134';
      g.instances=part.light;
      w.instNature.models[darkKey]=dm;
      w.instNature.groups[darkKey]={kind:g.kind,range:g.range,instances:part.dark};
      total+=part.total;darkTotal+=part.darkCount;groups++;
    }

    w.__verdantCommonTreeMixV134={groupsProcessed:groups,totalCommonTrees:total,
      lightCommonTrees:total-darkTotal,darkCommonTrees:darkTotal,
      requestedDarkRatio:DARK_RATIO,actualDarkRatio:total?darkTotal/total:0,
      geometryUnchanged:true,positionsUnchanged:true,wildlifeUnchanged:true};
    console.log('Verdant v134 CommonTree mix:',w.__verdantCommonTreeMixV134);
    return w;
  };
})();
/* ===== END js/39-verdant-common-tree-mix-v134.js ===== */

/* ===== BEGIN js/41-verdant-common-tree-compact-v136.js ===== */
"use strict";

/* Verdant Rift v136 — real v133 compact CommonTree on 10% -----------------
   Preserve the approved v134 population: 75% original light / 25% original
   geometry dark.  From the remaining light group, move exactly 10% of the
   TOTAL CommonTree population to the actual alpha-aware CommonTree geometry
   used by v133.  Only CommonTree_1/3/5 are rebuilt; TwistedTree, Pine,
   wildlife, terrain, road, buildings and sky are untouched. */
(function(){
  const FILES={common1:'CommonTree_1.gltf',common3:'CommonTree_3.gltf',common5:'CommonTree_5.gltf'};
  const FIXED={};
  const STRUCT_RATIO=.10;
  const IMG_CACHE=new Map();
  const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const STATUS={started:false,total:3,settled:0,ready:0,failed:0,promise:null};

  function resolveUrl(uri,file){return new URL(uri,new URL(file,location.href)).href;}
  function decodeDataUri(uri){
    const s=uri.slice(uri.indexOf(',')+1),raw=atob(s),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  async function loadBuffer(def,file){
    if(!def||!def.uri)throw new Error('glTF buffer has no uri');
    if(def.uri.startsWith('data:'))return decodeDataUri(def.uri);
    const r=await fetch(resolveUrl(def.uri,file));
    if(!r.ok)throw new Error('buffer '+def.uri+' HTTP '+r.status);
    return await r.arrayBuffer();
  }
  function readComponent(dv,o,ct){
    if(ct===5120)return dv.getInt8(o);
    if(ct===5121)return dv.getUint8(o);
    if(ct===5122)return dv.getInt16(o,true);
    if(ct===5123)return dv.getUint16(o,true);
    if(ct===5125)return dv.getUint32(o,true);
    return dv.getFloat32(o,true);
  }
  function normComponent(v,ct){
    if(ct===5120)return Math.max(v/127,-1);
    if(ct===5121)return v/255;
    if(ct===5122)return Math.max(v/32767,-1);
    if(ct===5123)return v/65535;
    if(ct===5125)return v/4294967295;
    return v;
  }
  function accessor(gj,buffers,i){
    const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],Ctor=CT[a.componentType];
    if(!Ctor)throw new Error('unsupported component type '+a.componentType);
    const nc=COMPONENTS[a.type],bytes=Ctor.BYTES_PER_ELEMENT;
    const off=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||nc*bytes;
    const buf=buffers[bv.buffer||0];
    if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(buf,off,a.count*nc),nc};
    const out=new Float32Array(a.count*nc),dv=new DataView(buf);
    for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
      let v=readComponent(dv,off+n*stride+c*bytes,a.componentType);
      if(a.normalized)v=normComponent(v,a.componentType);
      out[n*nc+c]=v;
    }
    return{data:out,nc};
  }

  async function imagePixels(url){
    if(IMG_CACHE.has(url))return IMG_CACHE.get(url);
    const p=new Promise((resolve,reject)=>{
      const im=new Image();
      im.onload=()=>{
        try{
          const maxS=512,sc=Math.min(1,maxS/Math.max(im.naturalWidth,im.naturalHeight));
          const w=Math.max(1,Math.round(im.naturalWidth*sc));
          const h=Math.max(1,Math.round(im.naturalHeight*sc));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0,w,h);
          resolve({w,h,data:cx.getImageData(0,0,w,h).data});
        }catch(e){reject(e);}
      };
      im.onerror=()=>reject(new Error('image '+url+' failed'));
      im.src=url;
    });
    IMG_CACHE.set(url,p);return p;
  }
  function sample(px,u,v){
    if(!px)return[1,1,1,1];
    u=((u%1)+1)%1;v=((v%1)+1)%1;
    const x=Math.min(px.w-1,Math.max(0,Math.floor(u*px.w)));
    const y=Math.min(px.h-1,Math.max(0,Math.floor((1-v)*px.h)));
    const k=(y*px.w+x)*4,d=px.data;
    return[d[k]/255,d[k+1]/255,d[k+2]/255,d[k+3]/255];
  }
  const mix=(a,b,t)=>a+(b-a)*t;
  function mixV(a,b,t){
    return {p:[mix(a.p[0],b.p[0],t),mix(a.p[1],b.p[1],t),mix(a.p[2],b.p[2],t)],
      n:[mix(a.n[0],b.n[0],t),mix(a.n[1],b.n[1],t),mix(a.n[2],b.n[2],t)],
      uv:[mix(a.uv[0],b.uv[0],t),mix(a.uv[1],b.uv[1],t)],
      vc:[mix(a.vc[0],b.vc[0],t),mix(a.vc[1],b.vc[1],t),mix(a.vc[2],b.vc[2],t),mix(a.vc[3],b.vc[3],t)]};
  }
  function faceNormal(a,b,c){
    const ax=b.p[0]-a.p[0],ay=b.p[1]-a.p[1],az=b.p[2]-a.p[2];
    const bx=c.p[0]-a.p[0],by=c.p[1]-a.p[1],bz=c.p[2]-a.p[2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
  }
  function vertexAt(vi,P,NA,UVA,CA){
    const p=vi*3,ncN=NA?NA.nc:0,ncU=UVA?UVA.nc:0,ncC=CA?CA.nc:0;
    return {p:[P[p],P[p+1],P[p+2]],
      n:NA?[NA.data[vi*ncN],NA.data[vi*ncN+1],NA.data[vi*ncN+2]]:[0,1,0],
      uv:UVA?[UVA.data[vi*ncU],UVA.data[vi*ncU+1]]:[0,0],
      vc:CA?[CA.data[vi*ncC],CA.data[vi*ncC+1],CA.data[vi*ncC+2],ncC>3?CA.data[vi*ncC+3]:1]:[1,1,1,1]};
  }

  async function loadCorrected(key,file){
    const r=await fetch(file);if(!r.ok)throw new Error('gltf HTTP '+r.status);
    const gj=await r.json(),buffers=await Promise.all((gj.buffers||[]).map(b=>loadBuffer(b,file)));
    const pixelBySource={},need=new Set();
    for(const mat of(gj.materials||[])){
      const ti=((mat.pbrMetallicRoughness||{}).baseColorTexture||{}).index;
      if(ti!==undefined&&gj.textures&&gj.textures[ti])need.add(gj.textures[ti].source);
    }
    await Promise.all(Array.from(need).map(async src=>{
      const im=gj.images&&gj.images[src];
      if(im&&im.uri)pixelBySource[src]=await imagePixels(resolveUrl(im.uri,file));
    }));

    const outP=[],outN=[],outC=[];let leafSource=0,leafOut=0;
    const emit=(a,b,c,px,fac,cut,masked,isLeaf)=>{
      const cu=(a.uv[0]+b.uv[0]+c.uv[0])/3,cv=(a.uv[1]+b.uv[1]+c.uv[1])/3;
      const mid=sample(px,cu,cv),alpha=mid[3]*fac[3]*(a.vc[3]+b.vc[3]+c.vc[3])/3;
      if(masked&&alpha<cut)return false;
      const fn=faceNormal(a,b,c);
      for(const q of [a,b,c]){
        const tex=sample(px,q.uv[0],q.uv[1]);
        outP.push(q.p[0],q.p[1],q.p[2]);
        let nx=q.n[0],ny=q.n[1],nz=q.n[2],ln=Math.hypot(nx,ny,nz);
        if(ln<.25){nx=fn[0];ny=fn[1];nz=fn[2];ln=1;}
        outN.push(nx/ln,ny/ln,nz/ln);
        outC.push(tex[0]*fac[0]*q.vc[0],tex[1]*fac[1]*q.vc[1],tex[2]*fac[2]*q.vc[2]);
      }
      if(isLeaf)leafOut++;
      return true;
    };

    for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
      if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
      const P=accessor(gj,buffers,pr.attributes.POSITION).data;
      const I=accessor(gj,buffers,pr.indices).data;
      const NA=pr.attributes.NORMAL!==undefined?accessor(gj,buffers,pr.attributes.NORMAL):null;
      const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
      const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
      const mat=(gj.materials&&gj.materials[pr.material])||{},pbr=mat.pbrMetallicRoughness||{};
      const fac=pbr.baseColorFactor||[1,1,1,1],ti=(pbr.baseColorTexture||{}).index;
      const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
      const px=src!==undefined?pixelBySource[src]:null,cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
      const masked=mat.alphaMode==='MASK'&&!!px&&!!UVA;
      const isLeaf=masked&&/leaf|leaves/i.test(mat.name||'');
      for(let t=0;t+2<I.length;t+=3){
        const a=vertexAt(I[t],P,NA,UVA,CA),b=vertexAt(I[t+1],P,NA,UVA,CA),c=vertexAt(I[t+2],P,NA,UVA,CA);
        if(!NA){const fn=faceNormal(a,b,c);a.n=fn;b.n=fn;c.n=fn;}
        if(isLeaf){
          leafSource++;
          const ab=mixV(a,b,.5),bc=mixV(b,c,.5),ca=mixV(c,a,.5);
          emit(a,ab,ca,px,fac,cut,true,true);
          emit(ab,b,bc,px,fac,cut,true,true);
          emit(ca,bc,c,px,fac,cut,true,true);
          emit(ab,bc,ca,px,fac,cut,true,true);
        }else emit(a,b,c,px,fac,cut,masked,false);
      }
    }
    if(!outP.length)throw new Error('no visible mesh triangles');
    return {pos:new Float32Array(outP),nrm:new Float32Array(outN),col:new Float32Array(outC),
      count:outP.length/3,triangles:outP.length/9,file,v133ExactCommonAlpha:true,
      leafSourceTriangles:leafSource,leafOutputTriangles:leafOut};
  }

  function snapshot(){return {started:STATUS.started,total:STATUS.total,settled:STATUS.settled,
    ready:STATUS.ready,failed:STATUS.failed,complete:STATUS.started&&STATUS.settled>=STATUS.total};}
  function start(){
    if(STATUS.started)return STATUS.promise;STATUS.started=true;
    STATUS.promise=Promise.all(Object.keys(FILES).map(async key=>{
      try{FIXED[key]=await loadCorrected(key,'assets/models/'+FILES[key]);STATUS.ready++;}
      catch(e){FIXED[key]=null;STATUS.failed++;console.warn('Verdant v136 compact CommonTree unavailable:',key,e.message);}
      STATUS.settled++;
    })).then(()=>snapshot());
    return STATUS.promise;
  }

  function scoreInstance(src,o,keySalt){
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*41)^
      Math.floor((src[o+3]||0)*29)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }
  function splitForCompact(lightInstances,darkInstances,keySalt){
    const nLight=Math.floor((lightInstances&&lightInstances.length||0)/6);
    const nDark=Math.floor((darkInstances&&darkInstances.length||0)/6);
    const total=nLight+nDark,target=Math.min(nLight,Math.round(total*STRUCT_RATIO));
    if(!nLight||!target)return{light:lightInstances||[],compact:[],total,nLight,nDark,target:0};
    const ranked=[];for(let j=0;j<nLight;j++)ranked.push({j,score:scoreInstance(lightInstances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const picked=new Uint8Array(nLight);for(let j=0;j<target;j++)picked[ranked[j].j]=1;
    const light=[],compact=[];
    for(let j=0;j<nLight;j++){
      const o=j*6,out=picked[j]?compact:light;for(let k=0;k<6;k++)out.push(lightInstances[o+k]);
    }
    return{light,compact,total,nLight,nDark,target};
  }
  if(typeof globalThis!=='undefined')globalThis.__verdantSplitForCompactV136=splitForCompact;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;
    let total=0,lightTotal=0,darkTotal=0,compactTotal=0,groups=0;
    for(const [ki,key] of Object.keys(FILES).entries()){
      const g=w.instNature.groups[key],m=FIXED[key],darkKey=key+'DarkV134',dg=w.instNature.groups[darkKey];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const part=splitForCompact(g.instances,dg&&dg.instances,0x51ed270b^(ki*0x9e3779b9));
      const compactKey=key+'CompactV136';
      g.instances=part.light;
      w.instNature.models[compactKey]=m;
      w.instNature.groups[compactKey]={kind:g.kind,range:g.range,instances:part.compact};
      total+=part.total;lightTotal+=part.light.length/6;darkTotal+=part.nDark;compactTotal+=part.target;groups++;
    }
    w.__verdantCommonTreeCompactV136={groupsProcessed:groups,totalCommonTrees:total,
      lightCommonTrees:lightTotal,darkCommonTrees:darkTotal,compactCommonTrees:compactTotal,
      requestedCompactRatio:STRUCT_RATIO,actualCompactRatio:total?compactTotal/total:0,
      usesExactV133CommonAlpha:true,preservesV134DarkMix:true,preservesWildlife:true,
      preservesOtherTreeFamilies:true};
    return w;
  };

  function installGate(){
    if(typeof startRide!=='function'||startRide.__verdantCompactV136)return;
    const base=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant'||snapshot().complete)return base(sc,resume);
      try{
        const loading=document.getElementById('loading'),txt=document.getElementById('loadTxt');
        if(loading)loading.classList.add('on');if(txt)txt.textContent='Preparing compact CommonTree variants';
      }catch(e){}
      return start().then(()=>base(sc,resume));
    };
    gated.__verdantCompactV136=true;startRide=gated;
  }

  if(typeof window!=='undefined'){
    window.__verdantCompactCommonStatusV136=snapshot;
    window.__verdantCompactCommonWaitV136=start;
  }
  if(typeof fetch==='function'&&typeof document!=='undefined')start();
  if(typeof document!=='undefined'){
    installGate();
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGate,{once:true});
    else setTimeout(installGate,0);
  }
})();
/* ===== END js/41-verdant-common-tree-compact-v136.js ===== */

/* ===== BEGIN js/42-verdant-twisted-tree-mix-v137.js ===== */
"use strict";

/* Verdant Rift v137 — 50/50 light / exact-v133 dark TwistedTree mix ------
   Preserve all approved v136 CommonTree work. Only TwistedTree_1/3 are
   affected: half keep the current v136/v131 model and half use the exact
   alpha-aware leaf-card reconstruction from rejected v133, which produced
   the attractive darker red / denser-looking crown. No other tree family,
   wildlife, terrain, road, buildings or sky is changed. */
(function(){
  const FILES={twisted1:'TwistedTree_1.gltf',twisted3:'TwistedTree_3.gltf'};
  const FIXED={};
  const DARK_RATIO=.50;
  const IMG_CACHE=new Map();
  const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const STATUS={started:false,total:2,settled:0,ready:0,failed:0,promise:null};

  function resolveUrl(uri,file){return new URL(uri,new URL(file,location.href)).href;}
  function decodeDataUri(uri){
    const s=uri.slice(uri.indexOf(',')+1),raw=atob(s),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  async function loadBuffer(def,file){
    if(!def||!def.uri)throw new Error('glTF buffer has no uri');
    if(def.uri.startsWith('data:'))return decodeDataUri(def.uri);
    const r=await fetch(resolveUrl(def.uri,file));
    if(!r.ok)throw new Error('buffer '+def.uri+' HTTP '+r.status);
    return await r.arrayBuffer();
  }
  function readComponent(dv,o,ct){
    if(ct===5120)return dv.getInt8(o);
    if(ct===5121)return dv.getUint8(o);
    if(ct===5122)return dv.getInt16(o,true);
    if(ct===5123)return dv.getUint16(o,true);
    if(ct===5125)return dv.getUint32(o,true);
    return dv.getFloat32(o,true);
  }
  function normComponent(v,ct){
    if(ct===5120)return Math.max(v/127,-1);
    if(ct===5121)return v/255;
    if(ct===5122)return Math.max(v/32767,-1);
    if(ct===5123)return v/65535;
    if(ct===5125)return v/4294967295;
    return v;
  }
  function accessor(gj,buffers,i){
    const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],Ctor=CT[a.componentType];
    if(!Ctor)throw new Error('unsupported component type '+a.componentType);
    const nc=COMPONENTS[a.type],bytes=Ctor.BYTES_PER_ELEMENT;
    const off=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||nc*bytes;
    const buf=buffers[bv.buffer||0];
    if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(buf,off,a.count*nc),nc};
    const out=new Float32Array(a.count*nc),dv=new DataView(buf);
    for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
      let v=readComponent(dv,off+n*stride+c*bytes,a.componentType);
      if(a.normalized)v=normComponent(v,a.componentType);
      out[n*nc+c]=v;
    }
    return{data:out,nc};
  }

  async function imagePixels(url){
    if(IMG_CACHE.has(url))return IMG_CACHE.get(url);
    const p=new Promise((resolve,reject)=>{
      const im=new Image();
      im.onload=()=>{
        try{
          const maxS=512,sc=Math.min(1,maxS/Math.max(im.naturalWidth,im.naturalHeight));
          const w=Math.max(1,Math.round(im.naturalWidth*sc));
          const h=Math.max(1,Math.round(im.naturalHeight*sc));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0,w,h);
          resolve({w,h,data:cx.getImageData(0,0,w,h).data});
        }catch(e){reject(e);}
      };
      im.onerror=()=>reject(new Error('image '+url+' failed'));
      im.src=url;
    });
    IMG_CACHE.set(url,p);return p;
  }
  function sample(px,u,v){
    if(!px)return[1,1,1,1];
    u=((u%1)+1)%1;v=((v%1)+1)%1;
    const x=Math.min(px.w-1,Math.max(0,Math.floor(u*px.w)));
    const y=Math.min(px.h-1,Math.max(0,Math.floor((1-v)*px.h)));
    const k=(y*px.w+x)*4,d=px.data;
    return[d[k]/255,d[k+1]/255,d[k+2]/255,d[k+3]/255];
  }
  const mix=(a,b,t)=>a+(b-a)*t;
  function mixV(a,b,t){
    return {p:[mix(a.p[0],b.p[0],t),mix(a.p[1],b.p[1],t),mix(a.p[2],b.p[2],t)],
      n:[mix(a.n[0],b.n[0],t),mix(a.n[1],b.n[1],t),mix(a.n[2],b.n[2],t)],
      uv:[mix(a.uv[0],b.uv[0],t),mix(a.uv[1],b.uv[1],t)],
      vc:[mix(a.vc[0],b.vc[0],t),mix(a.vc[1],b.vc[1],t),mix(a.vc[2],b.vc[2],t),mix(a.vc[3],b.vc[3],t)]};
  }
  function faceNormal(a,b,c){
    const ax=b.p[0]-a.p[0],ay=b.p[1]-a.p[1],az=b.p[2]-a.p[2];
    const bx=c.p[0]-a.p[0],by=c.p[1]-a.p[1],bz=c.p[2]-a.p[2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
  }
  function vertexAt(vi,P,NA,UVA,CA){
    const p=vi*3,ncN=NA?NA.nc:0,ncU=UVA?UVA.nc:0,ncC=CA?CA.nc:0;
    return {p:[P[p],P[p+1],P[p+2]],
      n:NA?[NA.data[vi*ncN],NA.data[vi*ncN+1],NA.data[vi*ncN+2]]:[0,1,0],
      uv:UVA?[UVA.data[vi*ncU],UVA.data[vi*ncU+1]]:[0,0],
      vc:CA?[CA.data[vi*ncC],CA.data[vi*ncC+1],CA.data[vi*ncC+2],ncC>3?CA.data[vi*ncC+3]:1]:[1,1,1,1]};
  }

  async function loadCorrected(key,file){
    const r=await fetch(file);if(!r.ok)throw new Error('gltf HTTP '+r.status);
    const gj=await r.json(),buffers=await Promise.all((gj.buffers||[]).map(b=>loadBuffer(b,file)));
    const pixelBySource={},need=new Set();
    for(const mat of(gj.materials||[])){
      const ti=((mat.pbrMetallicRoughness||{}).baseColorTexture||{}).index;
      if(ti!==undefined&&gj.textures&&gj.textures[ti])need.add(gj.textures[ti].source);
    }
    await Promise.all(Array.from(need).map(async src=>{
      const im=gj.images&&gj.images[src];
      if(im&&im.uri)pixelBySource[src]=await imagePixels(resolveUrl(im.uri,file));
    }));

    const outP=[],outN=[],outC=[];let leafSource=0,leafOut=0;
    const emit=(a,b,c,px,fac,cut,masked,isLeaf)=>{
      const cu=(a.uv[0]+b.uv[0]+c.uv[0])/3,cv=(a.uv[1]+b.uv[1]+c.uv[1])/3;
      const mid=sample(px,cu,cv),alpha=mid[3]*fac[3]*(a.vc[3]+b.vc[3]+c.vc[3])/3;
      if(masked&&alpha<cut)return false;
      const fn=faceNormal(a,b,c);
      for(const q of [a,b,c]){
        const tex=sample(px,q.uv[0],q.uv[1]);
        outP.push(q.p[0],q.p[1],q.p[2]);
        let nx=q.n[0],ny=q.n[1],nz=q.n[2],ln=Math.hypot(nx,ny,nz);
        if(ln<.25){nx=fn[0];ny=fn[1];nz=fn[2];ln=1;}
        outN.push(nx/ln,ny/ln,nz/ln);
        outC.push(tex[0]*fac[0]*q.vc[0],tex[1]*fac[1]*q.vc[1],tex[2]*fac[2]*q.vc[2]);
      }
      if(isLeaf)leafOut++;
      return true;
    };

    for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
      if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
      const P=accessor(gj,buffers,pr.attributes.POSITION).data;
      const I=accessor(gj,buffers,pr.indices).data;
      const NA=pr.attributes.NORMAL!==undefined?accessor(gj,buffers,pr.attributes.NORMAL):null;
      const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
      const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
      const mat=(gj.materials&&gj.materials[pr.material])||{},pbr=mat.pbrMetallicRoughness||{};
      const fac=pbr.baseColorFactor||[1,1,1,1],ti=(pbr.baseColorTexture||{}).index;
      const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
      const px=src!==undefined?pixelBySource[src]:null,cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
      const masked=mat.alphaMode==='MASK'&&!!px&&!!UVA;
      const isLeaf=masked&&/leaf|leaves/i.test(mat.name||'');
      for(let t=0;t+2<I.length;t+=3){
        const a=vertexAt(I[t],P,NA,UVA,CA),b=vertexAt(I[t+1],P,NA,UVA,CA),c=vertexAt(I[t+2],P,NA,UVA,CA);
        if(!NA){const fn=faceNormal(a,b,c);a.n=fn;b.n=fn;c.n=fn;}
        if(isLeaf){
          leafSource++;
          const ab=mixV(a,b,.5),bc=mixV(b,c,.5),ca=mixV(c,a,.5);
          emit(a,ab,ca,px,fac,cut,true,true);
          emit(ab,b,bc,px,fac,cut,true,true);
          emit(ca,bc,c,px,fac,cut,true,true);
          emit(ab,bc,ca,px,fac,cut,true,true);
        }else emit(a,b,c,px,fac,cut,masked,false);
      }
    }
    if(!outP.length)throw new Error('no visible mesh triangles');
    return {pos:new Float32Array(outP),nrm:new Float32Array(outN),col:new Float32Array(outC),
      count:outP.length/3,triangles:outP.length/9,file,v133ExactTwistedAlpha:true,
      leafSourceTriangles:leafSource,leafOutputTriangles:leafOut};
  }

  function snapshot(){return {started:STATUS.started,total:STATUS.total,settled:STATUS.settled,
    ready:STATUS.ready,failed:STATUS.failed,complete:STATUS.started&&STATUS.settled>=STATUS.total};}
  function start(){
    if(STATUS.started)return STATUS.promise;STATUS.started=true;
    STATUS.promise=Promise.all(Object.keys(FILES).map(async key=>{
      try{FIXED[key]=await loadCorrected(key,'assets/models/'+FILES[key]);STATUS.ready++;}
      catch(e){FIXED[key]=null;STATUS.failed++;console.warn('Verdant v137 dark TwistedTree unavailable:',key,e.message);}
      STATUS.settled++;
    })).then(()=>snapshot());
    return STATUS.promise;
  }

  function scoreInstance(src,o,keySalt){
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*43)^
      Math.floor((src[o+3]||0)*31)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }
  function splitHalf(instances,keySalt){
    const n=Math.floor((instances&&instances.length||0)/6),target=Math.round(n*DARK_RATIO);
    if(!n||!target)return{light:instances||[],dark:[],total:n,darkCount:0};
    const ranked=[];for(let j=0;j<n;j++)ranked.push({j,score:scoreInstance(instances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const picked=new Uint8Array(n);for(let j=0;j<target;j++)picked[ranked[j].j]=1;
    const light=[],dark=[];
    for(let j=0;j<n;j++){
      const o=j*6,out=picked[j]?dark:light;for(let k=0;k<6;k++)out.push(instances[o+k]);
    }
    return{light,dark,total:n,darkCount:target};
  }
  if(typeof globalThis!=='undefined')globalThis.__verdantSplitTwistedHalfV137=splitHalf;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;
    let total=0,lightTotal=0,darkTotal=0,groups=0;
    for(const [ki,key] of Object.keys(FILES).entries()){
      const g=w.instNature.groups[key],m=FIXED[key];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const part=splitHalf(g.instances,0x6a09e667^(ki*0x9e3779b9));
      const darkKey=key+'DarkV137';
      g.instances=part.light;
      w.instNature.models[darkKey]=m;
      w.instNature.groups[darkKey]={kind:g.kind,range:g.range,instances:part.dark};
      total+=part.total;lightTotal+=part.light.length/6;darkTotal+=part.darkCount;groups++;
    }
    w.__verdantTwistedTreeMixV137={groupsProcessed:groups,totalTwistedTrees:total,
      lightTwistedTrees:lightTotal,darkTwistedTrees:darkTotal,requestedDarkRatio:DARK_RATIO,
      actualDarkRatio:total?darkTotal/total:0,exactV133AlphaOnDarkHalf:true,
      preservesV136CommonTrees:true,preservesWildlife:true,preservesOtherTreeFamilies:true};
    console.log('Verdant v137 TwistedTree mix:',w.__verdantTwistedTreeMixV137);
    return w;
  };

  start();
  if(typeof window!=='undefined'){
    window.__verdantTwistedMixStatusV137=snapshot;
    window.__verdantTwistedMixWaitV137=start;
  }
  function installGate(){
    if(typeof startRide!=='function'||startRide.__verdantTwistedV137)return;
    const base=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant'||snapshot().complete)return base(sc,resume);
      try{
        const loading=document.getElementById('loading'),txt=document.getElementById('loadTxt');
        if(loading)loading.classList.add('on');if(txt)txt.textContent='Preparing red tree variants';
      }catch(e){}
      return start().then(()=>base(sc,resume));
    };
    gated.__verdantTwistedV137=true;startRide=gated;
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGate,{once:true});
    else setTimeout(installGate,0);
  }
})();
/* ===== END js/42-verdant-twisted-tree-mix-v137.js ===== */

/* ===== BEGIN js/44-verdant-purple-flower-megacarpets-v139.js ===== */
"use strict";

/* Verdant Rift v139 — mega purple flower carpets --------------------------
   Keep the user-approved v138 Flower_4_Group look, but spread it across the
   empty green plains much more aggressively.  Compared with v138 this layer
   uses 4x as many patches (48 vs 12), about 4x the area per patch, and 4x the
   instances per patch so density is preserved.  Flowers are allowed to grow
   almost to the asphalt: estimated outer flower geometry stops ~10 cm from
   the nearest road edge.  Everything remains one GPU-instanced model group;
   no trees, wildlife, terrain, buildings or sky are changed. */
(function(){
  const TAU=6.283185307179586;
  const NOMINAL_ROUTE_KM=25;
  const PATCH_COUNT=48;
  const TARGET_TOTAL=113760; // 7110 (v138) * 4 patches * 4 instances/patch area
  const ROAD_EDGE_GAP=.10;  // metres from visible flower edge to asphalt edge
  const FLOWER_RADIUS_FACTOR=.80; // Flower_4_Group max horizontal radius / scale

  /* These are the twelve approved v138 patch profiles.  v139 repeats their
     density/shape palette four times around the lap, but places the 48 patch
     centres evenly so previously bare green plains are much more likely to be
     covered.  Doubling both ellipse axes gives ~4x area per patch. */
  const BASE=[
    {count:420,span:.14,near:8,far:32},
    {count:520,span:.16,near:9,far:38},
    {count:600,span:.18,near:8,far:34},
    {count:520,span:.16,near:8,far:36},
    {count:720,span:.20,near:7,far:38},
    {count:760,span:.20,near:7,far:36},
    {count:650,span:.18,near:9,far:42},
    {count:720,span:.20,near:9,far:40},
    {count:600,span:.17,near:8,far:38},
    {count:620,span:.18,near:8,far:36},
    {count:540,span:.16,near:7,far:34},
    {count:440,span:.14,near:8,far:32}
  ];
  const PATCHES=Array.from({length:PATCH_COUNT},(_,i)=>{
    const b=BASE[i%BASE.length];
    const oldWidth=b.far-b.near;
    return {
      km:(i+.5)*NOMINAL_ROUTE_KM/PATCH_COUNT,
      side:(i&1)?-1:1,
      count:b.count*4,
      span:b.span*2,
      near:0,
      far:oldWidth*2
    };
  });

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready||
       !w.instNature.models||!w.instNature.models.flower4||!w.instNature.groups||
       !w._dbg||typeof w._dbg.roadNear!=='function')return w;

    const rr=mulberry32(sc.seed+139044),nearRoad=w._dbg.roadNear;
    const routeKm=w.instNature.routeKm||((w.lapLen||25000)/1000),n=w.nMain;
    const instances=[],patchStats=[];

    const routePose=(km,off)=>{
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };

    for(const p of PATCHES){
      let placed=0,tries=0,rejectedRoad=0;
      while(placed<p.count&&tries<p.count*8){
        tries++;
        /* Uniform point in an ellipse.  Long axis follows the route; short
           axis fills the neighbouring plain all the way toward the road. */
        const a=rr()*TAU,r=Math.sqrt(rr());
        const dkm=Math.cos(a)*r*p.span*.5;
        const mid=(p.near+p.far)*.5,half=(p.far-p.near)*.5;
        const off=p.side*(mid+Math.sin(a)*r*half);
        const q=routePose(p.km+dkm,off);
        const scale=.18+rr()*.18;
        const road=nearRoad(q.x,q.z);
        if(road&&road.i>=0&&road.i<n){
          const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(road.i):3.35;
          /* road.d is centre-line distance.  Add the estimated flower radius
             so the visible plant edge, not merely its centre, stays 10 cm
             outside the asphalt edge.  This also protects nearby hairpins. */
          const plantRadius=FLOWER_RADIUS_FACTOR*scale;
          if(road.d<ww+ROAD_EDGE_GAP+plantRadius){rejectedRoad++;continue;}
        }
        const y=w.meshH(q.x,q.z)-.045;
        instances.push(q.km,q.x,y,q.z,rr()*TAU,scale);
        placed++;
      }
      patchStats.push({km:p.km,side:p.side,target:p.count,placed,tries,rejectedRoad,
        span:p.span,far:p.far});
    }

    const key='flower4MegaCarpetV139';
    w.instNature.models[key]=w.instNature.models.flower4;
    w.instNature.groups[key]={kind:'flowers',range:.95,instances};
    if(w.instNature.stats){
      w.instNature.stats.flowers=(w.instNature.stats.flowers||0)+instances.length/6;
      w.instNature.stats.total=(w.instNature.stats.total||0)+instances.length/6;
    }
    w.__verdantPurpleCarpetsV139={patches:PATCHES.length,targetTotal:TARGET_TOTAL,
      totalPlaced:instances.length/6,roadEdgeGap:ROAD_EDGE_GAP,
      flowerRadiusFactor:FLOWER_RADIUS_FACTOR,model:'Flower_4_Group.gltf',patchStats};
    return w;
  };

  if(typeof globalThis!=='undefined'){
    globalThis.__verdantPurpleCarpetPatchesV139=PATCHES;
    globalThis.__verdantPurpleCarpetTargetV139=TARGET_TOTAL;
    globalThis.__verdantPurpleCarpetRoadGapV139=ROAD_EDGE_GAP;
  }
})();
/* ===== END js/44-verdant-purple-flower-megacarpets-v139.js ===== */

/* ===== BEGIN js/46-verdant-uploaded-mushroom-model-v141.js ===== */
"use strict";

/* Verdant Rift v141 — exact uploaded mushroom model -----------------------
   The user supplied GLB was reduced from ~156k triangles to a tiny 223-triangle
   vertex-colour glTF. This script loads that same-origin asset synchronously
   during script startup so buildWorld can remain synchronous and deterministic. */
(function(){
  const FILE='assets/models/verdant_mushroom_uploaded_v141.gltf';
  const STATUS={file:FILE,ready:false,error:null,triangles:0,vertices:0};
  const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

  function decodeDataUri(uri){
    const raw=atob(uri.slice(uri.indexOf(',')+1)),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  function accessor(g,b,i){
    const a=g.accessors[i],v=g.bufferViews[a.bufferView],Ctor=CT[a.componentType],nc=NC[a.type];
    if(!Ctor||!nc)throw new Error('unsupported accessor');
    const bytes=Ctor.BYTES_PER_ELEMENT,off=(v.byteOffset||0)+(a.byteOffset||0);
    const stride=v.byteStride||nc*bytes;
    if(stride!==nc*bytes)throw new Error('strided accessor not supported');
    return {data:new Ctor(b,off,a.count*nc),nc,count:a.count};
  }
  function parse(g){
    if(!g||!g.buffers||!g.buffers[0]||!String(g.buffers[0].uri||'').startsWith('data:'))
      throw new Error('embedded glTF buffer required');
    const b=decodeDataUri(g.buffers[0].uri),pr=g.meshes&&g.meshes[0]&&g.meshes[0].primitives&&g.meshes[0].primitives[0];
    if(!pr||pr.attributes.POSITION===undefined||pr.attributes.NORMAL===undefined||pr.attributes.COLOR_0===undefined||pr.indices===undefined)
      throw new Error('mushroom glTF attributes incomplete');
    const P=accessor(g,b,pr.attributes.POSITION),N=accessor(g,b,pr.attributes.NORMAL),C=accessor(g,b,pr.attributes.COLOR_0),I=accessor(g,b,pr.indices);
    const count=I.count,pos=new Float32Array(count*3),nrm=new Float32Array(count*3),col=new Float32Array(count*3);
    for(let j=0;j<count;j++){
      const vi=I.data[j],d=j*3,s=vi*3;
      pos[d]=P.data[s];pos[d+1]=P.data[s+1];pos[d+2]=P.data[s+2];
      nrm[d]=N.data[s];nrm[d+1]=N.data[s+1];nrm[d+2]=N.data[s+2];
      col[d]=C.data[s];col[d+1]=C.data[s+1];col[d+2]=C.data[s+2];
    }
    return {pos,nrm,col,count,triangles:count/3,file:FILE,source:'user-uploaded-glb'};
  }
  function load(){
    try{
      const x=new XMLHttpRequest();x.open('GET',FILE+'?b=141',false);x.send(null);
      if(x.status&&!(x.status>=200&&x.status<300))throw new Error('HTTP '+x.status);
      const m=parse(JSON.parse(x.responseText));
      STATUS.ready=true;STATUS.triangles=m.triangles;STATUS.vertices=m.count;
      globalThis.__verdantUploadedMushroomModelV141=m;
      console.log('Verdant v141 uploaded mushroom ready:',m.triangles,'triangles');
    }catch(e){
      STATUS.error=String(e&&e.message||e);console.warn('Verdant v141 uploaded mushroom unavailable:',STATUS.error);
    }
  }
  globalThis.__verdantUploadedMushroomStatusV141=()=>({...STATUS});
  load();
})();
/* ===== END js/46-verdant-uploaded-mushroom-model-v141.js ===== */

/* ===== BEGIN js/45-verdant-wildlife-buildings-mushrooms-v140.js ===== */
"use strict";

/* Verdant Rift v140 — wildlife, settlements + mushroom expansion -----------
   A deliberately isolated layer on top of the approved v139 world. It counts
   the animals/buildings that actually survived all older layers, then grows
   those populations to the user-requested multipliers. Existing trees, flower
   mega-carpets, terrain and sky are not changed. */
(function(){
  const TAU=6.283185307179586;
  const CAT_MULT=10, DFLY_MULT=10, STAG_MULT=3, BUILDING_MULT=5;
  const GIANT_CAT_FRACTION=.5;
  const GIANT_MUSHROOM_TARGET=240, SMALL_MUSHROOM_TARGET=2400;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.actors)return w;

    const rr=mulberry32(sc.seed+140031),L=(w.lapLen||25000)/1000,n=w.nMain;
    const ready=k=>typeof GLCRE!=="undefined"&&GLCRE&&GLCRE[k]&&GLCRE[k].ready;
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,
        rx:w.rx[i],rz:w.rz[i],yaw:Math.atan2(w.tx[i],w.tz[i])};
    };

    const countGcre=key=>w.actors.reduce((s,a)=>s+(a&&a.gcre===key?1:0),0);
    const baseCats=countGcre("cat");
    const baseDflies=countGcre("dfly");
    const baseStags=countGcre("stag");
    const targetCats=Math.round(baseCats*CAT_MULT);
    const targetDflies=Math.round(baseDflies*DFLY_MULT);
    const targetStags=Math.round(baseStags*STAG_MULT);
    const needCats=Math.max(0,targetCats-baseCats);
    const needDflies=Math.max(0,targetDflies-baseDflies);
    const needStags=Math.max(0,targetStags-baseStags);
    /* All pre-v140 cats are normal-sized. Add enough giant cats that exactly
       half of the final population is the requested 2x-scale variant. */
    const giantCatTarget=Math.min(needCats,Math.round(targetCats*GIANT_CAT_FRACTION));

    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      dfly:{float:1.20,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02}
    };
    const added={cats:0,giantCats:0,dragonflies:0,stags:0};

    const addLand=(kind,gcre,km,off,k,wr,wspd)=>{
      if(!ready(gcre))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind],py=w.meshH(p.x,p.z);
      w.actors.push({type:"v140_"+kind,gcre,px:p.x,py,pz:p.z,yaw:rr()*TAU,k,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz});
      return true;
    };
    const addFloat=(km,off,k)=>{
      if(!ready("dfly"))return false;
      const p=routePose(km,off),ph=rr()*TAU,py=w.meshH(p.x,p.z)+1.0+rr()*2.8;
      w.actors.push({type:"v140_dfly",gcre:"dfly",px:p.x,py,pz:p.z,yaw:rr()*TAU,k,emiss:1,
        meta:META.dfly,ph,hx:p.x,hz:p.z,wr:2.1+rr()*3.2,wander:ph,
        wspd:(rr()<.5?-1:1)*(.75+rr()*.65),alert:0,headYaw:0,headPitch:0,swing:0,
        gph:ph,pinY:py,rdx:p.rx,rdz:p.rz});
      return true;
    };

    /* Cats: clustered encounters throughout the whole lap. Giant flags are
       quota-spread instead of creating a separate giant-only district. */
    for(let i=0;i<needCats;i++){
      const group=Math.floor(i/9),base=(.30+group*.39)%L;
      const giant=Math.floor((i+1)*giantCatTarget/Math.max(1,needCats))>
                  Math.floor(i*giantCatTarget/Math.max(1,needCats));
      const side=group%2?-1:1,normalScale=.76+rr()*.25;
      if(addLand("cat","cat",base+(rr()-.5)*.12,side*(5.8+rr()*13.5),
          normalScale*(giant?2:1),1.7+rr()*2.8,.24+rr()*.20)){
        added.cats++;if(giant)added.giantCats++;
      }
    }

    /* Deer: keep them as recognizable herds, not a uniform single-file scatter. */
    for(let i=0;i<needStags;i++){
      const group=Math.floor(i/12),base=(.55+group*.62)%L,side=group%2?-1:1;
      if(addLand("stag","stag",base+(rr()-.5)*.16,side*(8+rr()*21),
          .82+rr()*.28,2.0+rr()*3.4,.11+rr()*.11))added.stags++;
    }

    /* Robot dragonflies: many low swarms along the route. */
    for(let i=0;i<needDflies;i++){
      const group=Math.floor(i/15),base=(.42+group*.44)%L,side=i%2?-1:1;
      if(addFloat(base+(rr()-.5)*.14,side*(3.0+rr()*12),.55+rr()*.32))added.dragonflies++;
    }

    /* ---- Buildings: total current settlement count x5 ------------------- */
    const baseBuildings=(w.__verdantV121&&Number.isFinite(w.__verdantV121.buildings))?
      w.__verdantV121.buildings:16;
    const targetBuildings=Math.round(baseBuildings*BUILDING_MULT);
    const needBuildings=Math.max(0,targetBuildings-baseBuildings);
    const bstats={base:baseBuildings,target:targetBuildings,added:0,pairedRoadSites:0,
      trisAdded:0,skipped:[]};

    const mb=typeof MeshB!=="undefined"?new MeshB():null;
    const foundationCol=typeof hx==="function"?hx("#343d3c"):[.20,.24,.24];
    const bounds=model=>{
      if(model.__v140Bounds)return model.__v140Bounds;
      if(model.__v121Bounds){model.__v140Bounds=model.__v121Bounds;return model.__v140Bounds;}
      const f=model.norm||1,mn=[1e20,1e20,1e20],mx=[-1e20,-1e20,-1e20];let tris=0;
      for(const pr of model.prims||[]){
        const P=pr.pos||[];tris+=Math.floor((pr.idx||[]).length/3);
        for(let v=0;v+2<P.length;v+=3){
          const x=P[v]*f,y=P[v+1]*f,z=P[v+2]*f;
          if(x<mn[0])mn[0]=x;if(y<mn[1])mn[1]=y;if(z<mn[2])mn[2]=z;
          if(x>mx[0])mx[0]=x;if(y>mx[1])mx[1]=y;if(z>mx[2])mx[2]=z;
        }
      }
      return model.__v140Bounds={mn,mx,w:Math.max(.01,mx[0]-mn[0]),h:Math.max(.01,mx[1]-mn[1]),
        d:Math.max(.01,mx[2]-mn[2]),cx:(mn[0]+mx[0])*.5,cz:(mn[2]+mx[2])*.5,tris};
    };
    const buildingCandidates=["stSide","stGate","sHang","sAnt","sRef","sRing",
      "cGate","cDome","cTower","cArc","cSpire","cClu"];
    const availableBuildings=(typeof GLTREES!=="undefined"&&GLTREES)?
      buildingCandidates.filter(k=>GLTREES[k]&&GLTREES[k].prims&&GLTREES[k].prims.length):[];
    /* Prefer the lighter models for this fivefold expansion while retaining
       enough families for visual variety. */
    availableBuildings.sort((a,b)=>bounds(GLTREES[a]).tris-bounds(GLTREES[b]).tris);
    const buildPool=availableBuildings.slice(0,Math.min(9,availableBuildings.length));

    const stampAt=(key,km,off,targetH,yawOff,label)=>{
      if(!mb||!GLTREES||!GLTREES[key])return false;
      const model=GLTREES[key],b=bounds(model),p=routePose(km,off);
      const scale=targetH/b.h,yaw=p.yaw+(yawOff||0),fw=b.w*scale,fd=b.d*scale;
      const r=Math.min(22,Math.max(4,Math.max(fw,fd)*.40));
      const samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]];
      let minG=1e20,maxG=-1e20;
      for(const q of samples){const gy=w.meshH(p.x+q[0],p.z+q[1]);if(gy<minG)minG=gy;if(gy>maxG)maxG=gy;}
      if(!Number.isFinite(minG)||!Number.isFinite(maxG))minG=maxG=w.meshH(p.x,p.z);
      const fh=Math.max(1,(maxG-minG)+1);
      mb.setTF(p.x,minG-.55,p.z,yaw,1);mb.box(0,0,0,fw+3.5,fh,fd+3.5,foundationCol,.02);
      mb.setTF(p.x,maxG+.10,p.z,yaw,scale);
      const f=model.norm||1;
      for(const pr of model.prims){
        const P=pr.pos,I=pr.idx,c=pr.col||[.5,.5,.5],em=pr.em||.02;
        for(let t=0;t+2<I.length;t+=3){
          const at=ii=>{const j=I[ii]*3;return mb.P(P[j]*f-b.cx,P[j+1]*f-b.mn[1],P[j+2]*f-b.cz);};
          mb.tri(at(t),at(t+1),at(t+2),c,em);
        }
      }
      bstats.added++;bstats.trisAdded+=b.tris;return true;
    };
    const stampRoadPair=(km,key,targetH)=>{
      if(!GLTREES||!GLTREES[key])return 0;
      const b=bounds(GLTREES[key]),scale=targetH/b.h,yawOff=Math.PI*.5;
      /* Facing the road rotates model depth into the lateral direction. Leave
         a small but safe pedestrian strip beyond the asphalt edge. */
      const lateralHalf=b.d*scale*.5+1.75,p0=routePose(km,0);
      const roadHalf=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(p0.i):3.35;
      const off=roadHalf+2.4+lateralHalf;
      let c=0;
      if(bstats.added<needBuildings&&stampAt(key,km,-off,targetH,-yawOff,"pairL"))c++;
      if(bstats.added<needBuildings&&stampAt(key,km, off,targetH, yawOff,"pairR"))c++;
      if(c===2)bstats.pairedRoadSites++;
      return c;
    };

    if(buildPool.length&&needBuildings>0){
      const pairKm=[.85,2.15,3.55,4.85,6.25,7.65,9.05,10.45,11.85,13.25,14.65,16.05,18.15,20.05,22.15,24.05];
      for(let i=0;i<pairKm.length&&bstats.added<needBuildings;i++)
        stampRoadPair(pairKm[i],buildPool[i%buildPool.length],12+rr()*18);

      /* Remaining buildings form many small settlements farther from the road. */
      let tries=0;
      while(bstats.added<needBuildings&&tries<needBuildings*8){
        const i=tries++,key=buildPool[(i*5+2)%buildPool.length],km=(.25+i*.37)%L;
        const side=i%2?-1:1,off=side*(30+rr()*72),h=12+rr()*36;
        stampAt(key,km,off,h,(rr()-.5)*1.2,"cluster");
      }
    }

    if(mb&&mb.idx&&mb.idx.length&&w.props){
      const base=w.props.pos.length/3;
      const pos=new Float32Array(w.props.pos.length+mb.pos.length);pos.set(w.props.pos);pos.set(mb.pos,w.props.pos.length);
      const nrm=new Float32Array(w.props.nrm.length+mb.nrm.length);nrm.set(w.props.nrm);nrm.set(mb.nrm,w.props.nrm.length);
      const col=new Float32Array(w.props.col.length+mb.col.length);col.set(w.props.col);col.set(mb.col,w.props.col.length);
      const idx=new Uint32Array(w.props.idx.length+mb.idx.length);idx.set(w.props.idx);
      for(let i=0;i<mb.idx.length;i++)idx[w.props.idx.length+i]=base+mb.idx[i];
      w.props={pos,nrm,col,idx};
    }

    /* ---- Mushrooms: visible giant groves + dense low patches ------------- */
    const mstats={giantTarget:GIANT_MUSHROOM_TARGET,giants:0,smallTarget:SMALL_MUSHROOM_TARGET,small:0};
    if(w.instNature&&w.instNature.ready&&w.instNature.models&&w.instNature.models.mushroom&&w.instNature.groups){
      const near=w._dbg&&typeof w._dbg.roadNear==="function"?w._dbg.roadNear:null;
      const giant=[],small=[];
      const canPlace=(q,scale,giantMode)=>{
        if(!near)return true;
        const r=near(q.x,q.z);if(!r||r.i<0||r.i>=n)return true;
        const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(r.i):3.35;
        const capRadius=giantMode?.46*scale:.38;
        return r.d>=ww+capRadius+(giantMode?.8:.35);
      };
      const addM=(arr,km,off,scale,giantMode)=>{
        const q=routePose(km,off);if(!canPlace(q,scale,giantMode))return false;
        arr.push(q.km,q.x,w.meshH(q.x,q.z)-.04,q.z,rr()*TAU,scale);return true;
      };
      let tries=0;
      while(mstats.giants<GIANT_MUSHROOM_TARGET&&tries<GIANT_MUSHROOM_TARGET*12){
        const i=tries++,grove=Math.floor(i/18),base=(.55+grove*1.18)%L,side=grove%2?-1:1;
        if(addM(giant,base+(rr()-.5)*.20,side*(10+rr()*30),8.8+rr()*8.5,true))mstats.giants++;
      }
      tries=0;
      while(mstats.small<SMALL_MUSHROOM_TARGET&&tries<SMALL_MUSHROOM_TARGET*8){
        const i=tries++,grove=Math.floor(i/110),base=(.35+grove*.86)%L,side=grove%2?-1:1;
        if(addM(small,base+(rr()-.5)*.24,side*(4+rr()*25),.35+rr()*.55,false))mstats.small++;
      }
      w.instNature.models.mushroomGiantV140=w.instNature.models.mushroom;
      w.instNature.models.mushroomPatchV140=w.instNature.models.mushroom;
      w.instNature.groups.mushroomGiantV140={kind:"mushrooms",range:1.35,instances:giant};
      w.instNature.groups.mushroomPatchV140={kind:"mushrooms",range:1.05,instances:small};
      if(w.instNature.stats){
        const add=mstats.giants+mstats.small;
        w.instNature.stats.mushrooms=(w.instNature.stats.mushrooms||0)+add;
        w.instNature.stats.total=(w.instNature.stats.total||0)+add;
      }
    }

    w.__verdantExpansionV140={
      base:{cats:baseCats,dragonflies:baseDflies,stags:baseStags,buildings:baseBuildings},
      target:{cats:targetCats,dragonflies:targetDflies,stags:targetStags,buildings:targetBuildings},
      added,buildings:bstats,mushrooms:mstats,
      final:{cats:baseCats+added.cats,dragonflies:baseDflies+added.dragonflies,
        stags:baseStags+added.stags,buildings:baseBuildings+bstats.added}
    };
    console.log("Verdant v140 wildlife/buildings/mushrooms:",w.__verdantExpansionV140);
    return w;
  };

  if(typeof globalThis!=="undefined")globalThis.__verdantV140Spec={
    CAT_MULT,DFLY_MULT,STAG_MULT,BUILDING_MULT,GIANT_CAT_FRACTION,
    GIANT_MUSHROOM_TARGET,SMALL_MUSHROOM_TARGET
  };
})();
/* ===== END js/45-verdant-wildlife-buildings-mushrooms-v140.js ===== */

/* ===== BEGIN js/47-verdant-uploaded-mushroom-replace-v141.js ===== */
"use strict";

/* Verdant Rift v141 — replace v140's generic mushrooms with the exact
   user-uploaded mushroom. Wildlife, cats, stags and buildings from v140 are
   deliberately untouched. No mushroom-tree scaling is used. */
(function(){
  const HERO_TARGET=240,PATCH_TARGET=2400,TAU=Math.PI*2;
  const HERO_SCALE_MIN=1.00,HERO_SCALE_MAX=1.80;
  const PATCH_SCALE_MIN=.35,PATCH_SCALE_MAX=.90;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.instNature||!w.instNature.groups||!w.instNature.models)return w;
    const model=globalThis.__verdantUploadedMushroomModelV141;
    if(!model||!model.count){
      w.__verdantMushroomV141={ready:false,reason:'uploaded model unavailable'};
      return w;
    }

    const groups=w.instNature.groups,models=w.instNature.models,stats=w.instNature.stats||null;
    let removed=0;
    for(const key of ['mushroomGiantV140','mushroomPatchV140']){
      const g=groups[key];if(g&&g.instances)removed+=g.instances.length/6;
      delete groups[key];delete models[key];
    }
    if(stats&&removed){
      stats.mushrooms=Math.max(0,(stats.mushrooms||0)-removed);
      stats.total=Math.max(0,(stats.total||0)-removed);
    }

    /* Also replace the small pre-v140 Mushroom_Common render model so every
       visible Verdant mushroom now uses the user's supplied mushroom shape. */
    if(groups.mushroom)models.mushroom=model;

    const rr=mulberry32((sc.seed||0)+141031),n=w.nMain,L=w.lapLen/1000;
    const near=w._dbg&&typeof w._dbg.roadNear==="function"?w._dbg.roadNear:null;
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };
    const canPlace=(q,scale)=>{
      if(!near)return true;
      const r=near(q.x,q.z);if(!r||r.i<0||r.i>=n)return true;
      const half=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(r.i):3.35;
      return r.d>=half+.45*scale+.25;
    };
    const add=(arr,km,off,sMin,sMax)=>{
      const q=routePose(km,off),scale=sMin+rr()*(sMax-sMin);if(!canPlace(q,scale))return false;
      arr.push(q.km,q.x,w.meshH(q.x,q.z)-.02,q.z,rr()*TAU,scale);return true;
    };

    const hero=[],patch=[];let h=0,p=0,tries=0;
    while(h<HERO_TARGET&&tries<HERO_TARGET*16){
      const j=tries++,grove=Math.floor(j/12),base=(.48+grove*1.11)%L,side=grove%2?-1:1;
      if(add(hero,base+(rr()-.5)*.18,side*(6+rr()*24),HERO_SCALE_MIN,HERO_SCALE_MAX))h++;
    }
    tries=0;
    while(p<PATCH_TARGET&&tries<PATCH_TARGET*10){
      const j=tries++,grove=Math.floor(j/100),base=(.22+grove*.78)%L,side=grove%2?-1:1;
      if(add(patch,base+(rr()-.5)*.28,side*(4+rr()*22),PATCH_SCALE_MIN,PATCH_SCALE_MAX))p++;
    }

    models.mushroomHeroV141=model;models.mushroomPatchV141=model;
    groups.mushroomHeroV141={kind:'mushrooms',range:1.25,instances:hero};
    groups.mushroomPatchV141={kind:'mushrooms',range:.92,instances:patch};
    if(stats){stats.mushrooms=(stats.mushrooms||0)+h+p;stats.total=(stats.total||0)+h+p;}

    const telemetry={ready:true,asset:model.file||'assets/models/verdant_mushroom_uploaded_v141.gltf',
      source:'user-uploaded-glb',optimizedTriangles:model.triangles||223,
      removedV140Generic:removed,heroTarget:HERO_TARGET,heroes:h,patchTarget:PATCH_TARGET,patches:p,
      heroScale:[HERO_SCALE_MIN,HERO_SCALE_MAX],patchScale:[PATCH_SCALE_MIN,PATCH_SCALE_MAX],mushroomTrees:false};
    w.__verdantMushroomV141=telemetry;
    if(w.__verdantExpansionV140&&w.__verdantExpansionV140.mushrooms)
      w.__verdantExpansionV140.mushrooms.replacedByV141=true;
    console.log('Verdant v141 uploaded mushroom replacement:',telemetry);
    return w;
  };

  globalThis.__verdantMushroomV141Spec={HERO_TARGET,PATCH_TARGET,HERO_SCALE_MIN,HERO_SCALE_MAX,PATCH_SCALE_MIN,PATCH_SCALE_MAX};
})();
/* ===== END js/47-verdant-uploaded-mushroom-replace-v141.js ===== */

/* ===== BEGIN js/48-verdant-mushroom-carpet-fix-v142.js ===== */
"use strict";

/* Verdant Rift v142 — user visual corrections -----------------------------
   1) Every visible mushroom is exactly 25% of its v141 scale.
   2) Each approved v139 carpet zone becomes a bilateral green-ground blanket:
      both sides of the road, extending far up neighbouring hillsides.
   3) Flower blankets are deterministically random-mixed 25/25/25/25 between
      the original colour, purple, blue and red while keeping green foliage.
   4) Bears are restored to 14 total (2x the previous 7-bear population).
   Snow is excluded and global nearest-road clipping is retained.
   Buildings, cats, dragonflies, deer, trees, terrain, road and sky are not
   otherwise modified. */
(function(){
  const TAU=Math.PI*2;
  const MUSHROOM_SCALE_FACTOR=.25;
  const CARPET_COUNT_MULTIPLIER=1.15;
  const CARPET_SPAN_MULTIPLIER=1.35;
  const CARPET_MIN_FAR=170;
  const CARPET_FAR_MULTIPLIER=3;
  const ROAD_EDGE_GAP=.10;
  const FLOWER_RADIUS_FACTOR=.80;
  const FLOWER_SCALE_MIN=.26;
  const FLOWER_SCALE_MAX=.56;
  const SNOW_ZONE=7;
  const GOLDEN=2.399963229728653;
  const BEAR_TARGET=14;
  const FLOWER_KEYS=[
    'flower4HillsideCurrentV142','flower4HillsidePurpleV142',
    'flower4HillsideBlueV142','flower4HillsideRedV142'
  ];
  const FLOWER_LABELS=['current','purple','blue','red'];
  const FLOWER_TINTS=[null,[.78,.22,.95],[.18,.55,1.0],[1.0,.18,.20]];
  const BEAR_SITES=[
    [3.35,-26],[18.05,27],[4.05,22],[18.85,-22],[4.75,-19],[19.65,31],[5.45,29],
    [20.45,-18],[5.95,-23],[21.15,25],[23.20,-29],[3.70,18],[20.90,20],[24.10,28]
  ];
  const BEAR_META={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};

  function tintedFlowerModel(base,tint){
    if(!tint)return base;
    const src=base.col||new Float32Array(0),col=new Float32Array(src);
    for(let i=0;i+2<col.length;i+=3){
      const r=src[i],g=src[i+1],b=src[i+2];
      /* Preserve clearly green leaf/stem vertices.  Only flower/non-green
         material is recoloured, so the result reads as coloured blossoms on
         the same plant instead of whole purple/blue/red bushes. */
      const leafy=g>r*1.12&&g>b*1.08&&g>.12;
      if(leafy)continue;
      const lum=Math.max(.16,Math.min(1,.299*r+.587*g+.114*b));
      const k=.48+.72*lum;
      col[i]=Math.min(1,tint[0]*k);
      col[i+1]=Math.min(1,tint[1]*k);
      col[i+2]=Math.min(1,tint[2]*k);
    }
    return {...base,col};
  }

  function shuffledColourBag(n,rr){
    const a=Array.from({length:n},(_,i)=>i&3);
    for(let i=a.length-1;i>0;i--){const j=Math.floor(rr()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}
    return a;
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.groups||!w.instNature.models)return w;

    const groups=w.instNature.groups,models=w.instNature.models,stats=w.instNature.stats||null;

    /* Mushroom correction: quarter the rendered scale of every current
       mushroom instance, including baseline and uploaded-v141 groups. */
    let mushroomInstances=0,mushroomGroups=0;
    for(const key of Object.keys(groups)){
      if(!/^mushroom/i.test(key))continue;
      const a=groups[key]&&groups[key].instances;if(!a)continue;
      mushroomGroups++;
      for(let i=5;i<a.length;i+=6){a[i]*=MUSHROOM_SCALE_FACTOR;mushroomInstances++;}
    }

    /* Remove the old one-sided v139 group and rebuild the same flowering
       regions on BOTH sides, over the actual terrain height and up hills. */
    const oldKey='flower4MegaCarpetV139',old=groups[oldKey];
    const oldCount=old&&old.instances?old.instances.length/6:0;
    if(oldCount&&stats){
      stats.flowers=Math.max(0,(stats.flowers||0)-oldCount);
      stats.total=Math.max(0,(stats.total||0)-oldCount);
    }
    delete groups[oldKey];delete models[oldKey];

    const PATCHES=globalThis.__verdantPurpleCarpetPatchesV139||[];
    const flowerModel=models.flower4;
    const nearRoad=w._dbg&&typeof w._dbg.roadNear==='function'?w._dbg.roadNear:null;
    const routeKm=w.instNature.routeKm||((w.lapLen||25000)/1000),n=w.nMain;
    const rr=mulberry32((sc.seed||0)+142048);
    const colourInstances=[[],[],[],[]],colourCounts=[0,0,0,0],patchStats=[];

    const routePose=(km,off)=>{
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side};
    };
    const greenAt=(q,road)=>{
      const i=road&&road.i>=0&&road.i<n?road.i:q.i;
      if(w.verdant&&typeof w.verdant.zoneAt==='function'&&w.verdant.zoneAt(i)===SNOW_ZONE)return false;
      const y=w.meshH(q.x,q.z);
      if(Number.isFinite(w.waterY)&&y<=w.waterY+.08)return false;
      return true;
    };

    if(flowerModel&&PATCHES.length&&nearRoad){
      for(const p of PATCHES){
        const span=p.span*CARPET_SPAN_MULTIPLIER;
        const far=Math.max(CARPET_MIN_FAR,p.far*CARPET_FAR_MULTIPLIER);
        const target=Math.max(1,Math.round(p.count*CARPET_COUNT_MULTIPLIER));
        for(const side of [-1,1]){
          let placed=0,tries=0,rejectedRoad=0,rejectedGround=0;
          const bag=shuffledColourBag(target,rr),localColours=[0,0,0,0];
          /* Golden-angle low-discrepancy positions give broad continuous
             coverage; the separate shuffled colour bag makes the four flower
             colours look naturally intermixed instead of forming stripes. */
          while(placed<target&&tries<target*5){
            const j=tries++,r=Math.sqrt((j%target+.5)/target);
            const a=j*GOLDEN+rr()*.08;
            const dkm=Math.cos(a)*r*span*.5;
            const offMag=(.015+Math.abs(Math.sin(a))*r*.985)*far;
            const q=routePose(p.km+dkm,side*offMag);
            const scale=FLOWER_SCALE_MIN+rr()*(FLOWER_SCALE_MAX-FLOWER_SCALE_MIN);
            const road=nearRoad(q.x,q.z);
            if(road&&road.i>=0&&road.i<n){
              const ww=w.verdant&&typeof w.verdant.widthAt==='function'?w.verdant.widthAt(road.i):3.35;
              const plantRadius=FLOWER_RADIUS_FACTOR*scale;
              if(road.d<ww+ROAD_EDGE_GAP+plantRadius){rejectedRoad++;continue;}
            }
            if(!greenAt(q,road)){rejectedGround++;continue;}
            const y=w.meshH(q.x,q.z)-.045,ci=bag[placed];
            colourInstances[ci].push(q.km,q.x,y,q.z,rr()*TAU,scale);
            colourCounts[ci]++;localColours[ci]++;placed++;
          }
          patchStats.push({km:p.km,side,target,placed,tries,rejectedRoad,rejectedGround,span,far,colours:localColours});
        }
      }
    }

    let carpetInstances=0;
    if(flowerModel){
      for(let ci=0;ci<4;ci++){
        const a=colourInstances[ci];if(!a.length)continue;
        const key=FLOWER_KEYS[ci];
        models[key]=tintedFlowerModel(flowerModel,FLOWER_TINTS[ci]);
        groups[key]={kind:'flowers',range:1.15,instances:a};
        carpetInstances+=a.length/6;
      }
      if(stats&&carpetInstances){
        stats.flowers=(stats.flowers||0)+carpetInstances;
        stats.total=(stats.total||0)+carpetInstances;
      }
    }

    /* Bears: the approved pre-expansion world contained seven.  Restore a
       deterministic 14 total, distributed between forest and alpine/descent
       areas.  Existing bears are kept; only the missing number is added. */
    const actors=w.actors||[],bearsBefore=actors.filter(a=>a&&(a.type==='bear'||a.gcre==='vbear')).length;
    let bearsAdded=0;
    for(let b=bearsBefore;b<BEAR_TARGET;b++){
      const s=BEAR_SITES[bearsAdded%BEAR_SITES.length],q=routePose(s[0],s[1]),ph=rr()*TAU;
      const useGL=typeof GLCRE!=='undefined'&&GLCRE&&GLCRE.vbear&&GLCRE.vbear.ready;
      const a={type:'bear',px:q.x,py:w.meshH(q.x,q.z),pz:q.z,yaw:rr()*TAU,k:1.10+rr()*.35,emiss:1,
        meta:BEAR_META,ph,hx:q.x,hz:q.z,wr:2.2,wander:ph,wspd:(b&1?-1:1)*.05,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,v142:true};
      if(useGL)a.gcre='vbear';
      actors.push(a);bearsAdded++;
    }
    w.actors=actors;
    const bearsFinal=actors.filter(a=>a&&(a.type==='bear'||a.gcre==='vbear')).length;

    const telemetry={
      mushroomScaleFactor:MUSHROOM_SCALE_FACTOR,mushroomGroups,mushroomInstances,
      oldCarpetInstances:oldCount,patchCentres:PATCHES.length,sidesPerPatch:2,
      carpetInstances,minFar:CARPET_MIN_FAR,farMultiplier:CARPET_FAR_MULTIPLIER,
      spanMultiplier:CARPET_SPAN_MULTIPLIER,countMultiplier:CARPET_COUNT_MULTIPLIER,
      snowExcluded:true,roadEdgeGap:ROAD_EDGE_GAP,flowerScale:[FLOWER_SCALE_MIN,FLOWER_SCALE_MAX],
      flowerColourLabels:FLOWER_LABELS,flowerColourCounts:colourCounts,
      bearsBefore,bearTarget:BEAR_TARGET,bearsAdded,bearsFinal,patchStats
    };
    w.__verdantVisualFixV142=telemetry;
    if(w.__verdantPurpleCarpetsV139)w.__verdantPurpleCarpetsV139.replacedByV142=true;
    if(w.__verdantMushroomV141)w.__verdantMushroomV141.scaleCorrectedByV142=MUSHROOM_SCALE_FACTOR;
    console.log('Verdant v142 mushroom/carpet/bear correction:',telemetry);
    return w;
  };

  globalThis.__verdantVisualFixV142Spec={MUSHROOM_SCALE_FACTOR,CARPET_COUNT_MULTIPLIER,
    CARPET_SPAN_MULTIPLIER,CARPET_MIN_FAR,CARPET_FAR_MULTIPLIER,FLOWER_SCALE_MIN,FLOWER_SCALE_MAX,
    SNOW_ZONE,BEAR_TARGET,FLOWER_KEYS,FLOWER_LABELS};
})();
/* ===== END js/48-verdant-mushroom-carpet-fix-v142.js ===== */
