"use strict";

/* Verdant terrain / vegetation polish -------------------------------------
   Rebuild the terrain from the untouched natural height field and blend it
   broadly toward the fitted road.  This replaces v105's narrow trench carve.
   A final neighbour relaxation explicitly prevents near-vertical terrain
   faces around the rider. */
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

    /* Start over from the natural land surface.  The road fit in js/20 now
       follows this same field, so only modest shaping is required. */
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z);
      const natural=landAt?landAt(x,z):pos[k+1];
      let y=natural;
      ri[v]=q&&q.i<w.nMain?q.i:-1;
      dist[v]=q?q.d:1e6;
      if(q&&q.i<w.nMain&&q.d<240){
        const zone=w.verdant.zoneAt(q.i),ww=w.verdant.widthAt(q.i);
        const roadY=w.ry[q.i]-.22;
        const flat=ww+3.5;
        const blend=(zone===3?125:(zone===6||zone===7?170:150));
        const f=q.d<=flat?1:1-smoothstep(clamp((q.d-flat)/(blend-flat),0,1));
        y=lerp(natural,roadY,f);
        if(q.d<=flat)pin[v]=1;
      }
      H[v]=y;
    }

    /* Explicit terrain-face limiter.  The route-fitting pass has already
       removed major altitude conflicts, so this relaxation is now shaping
       shoulders rather than trying to reconcile incompatible roads. */
    const MAX_SIDE=.38,maxDx=MAX_SIDE*stepX,maxDz=MAX_SIDE*stepZ;
    const active=v=>dist[v]<205;
    const relax=(a,b,maxDh)=>{
      if(!(active(a)||active(b)))return false;
      const dh=H[b]-H[a],ad=Math.abs(dh);
      if(ad<=maxDh+.001)return false;
      const s=dh>0?1:-1,ex=ad-maxDh;
      if(pin[a]&&!pin[b])H[b]-=s*ex;
      else if(pin[b]&&!pin[a])H[a]+=s*ex;
      else {H[a]+=s*ex*.5;H[b]-=s*ex*.5;}
      return true;
    };
    let terrainPasses=0;
    for(;terrainPasses<320;terrainPasses++){
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

    /* The scenery was baked against the old v105 terrain.  Move it exactly
       once onto the rebuilt surface. */
    if(w.props&&w.props.pos){
      const p=w.props.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    if(w.water&&w.water.pos){
      const p=w.water.pos;for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }

    /* Remove the obvious rectangular vegetation cards from the rider's near
       field.  They remain farther away for inexpensive forest density; close
       scenery is supplied by real mesh trees, props and Verdant glTF ferns. */
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
    /* Sample terrain support directly under the centreline. */
    for(let i=0;i<w.nMain;i+=8)maxRoadGap=Math.max(maxRoadGap,Math.abs(gridH(w.rx[i],w.rz[i])-(w.ry[i]-.22)));
    w.__verdantTerrainAudit={passes:terrainPasses,maxNearTrailSlopePct:maxSide,maxRoadGroundGap:maxRoadGap,worst};
    console.log('Verdant terrain audit',w.__verdantTerrainAudit);
    return w;
  };
})();
