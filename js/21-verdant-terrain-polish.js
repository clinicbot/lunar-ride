"use strict";

/* Verdant terrain / vegetation polish -------------------------------------
   v105 showed two issues very clearly: the road corridor could become a deep
   green trench, and billboard vegetation close to the rider read as floating
   rectangular cards.  This pass fixes both without changing the 25 km route.

   The important part is the 2-D terrain relaxation below.  A per-vertex
   nearest-road clamp is not enough when nearby grid vertices happen to choose
   different route samples.  We therefore enforce an explicit maximum slope
   between neighbouring terrain cells, while keeping the actual trail corridor
   pinned to the road height. */
(function(){
  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant||!w.terrain||!w._dbg) return w;

    const near=w._dbg.roadNear;
    const pos=w.terrain.pos,nrm=w.terrain.nrm;
    const nVert=pos.length/3;
    const NV=Math.round(Math.sqrt(nVert));
    if(NV*NV!==nVert) return w;

    const oldGround=w.meshH;
    const oldActorGround=[];
    for(const a of (w.actors||[]))
      oldActorGround.push(Number.isFinite(a.px)&&Number.isFinite(a.pz)?oldGround(a.px,a.pz):NaN);

    const stepX=Math.abs(pos[3]-pos[0])||16;
    const stepZ=Math.abs(pos[NV*3+2]-pos[2])||stepX;
    const H=new Float32Array(nVert),dist=new Float32Array(nVert),ri=new Int32Array(nVert),pin=new Uint8Array(nVert);

    /* First make a broad road-aware corridor.  This is deliberately much
       wider than the old ~30 m carve so the rider sees hillsides, not walls. */
    for(let v=0;v<nVert;v++){
      const k=v*3,x=pos[k],z=pos[k+2],q=near(x,z);
      let y=pos[k+1];
      ri[v]=q&&q.i<w.nMain?q.i:-1;
      dist[v]=q?q.d:1e6;
      if(q&&q.i<w.nMain&&q.d<=320){
        const zone=w.verdant.zoneAt(q.i),ww=w.verdant.widthAt(q.i);
        const flat=ww+5.5;
        const roadY=w.ry[q.i]-.20;
        /* Jungle can be a little steeper; ordinary valley/forest terrain is
           intentionally gentler. */
        const sideSlope=(zone===3?0.30:(zone===6||zone===7?0.34:0.24));
        if(q.d<=flat){
          y=roadY; pin[v]=1;
        }else{
          const allowed=sideSlope*(q.d-flat);
          y=clamp(y,roadY-allowed,roadY+allowed);
          if(q.d>240){
            const f=smoothstep((q.d-240)/80);
            y=lerp(y,pos[k+1],f);
          }
        }
      }
      H[v]=y;
    }

    /* Explicit neighbour slope guarantee.  Only the area influenced by the
       route is relaxed; distant mountains keep their original character.
       Pinned vertices are the narrow strip directly under the trail.  If an
       edge touches a pinned vertex the free neighbour does all the moving;
       otherwise the correction is split evenly. */
    const MAX_SIDE=.40;                 // 40% maximum terrain face near trail
    const maxDx=MAX_SIDE*stepX,maxDz=MAX_SIDE*stepZ;
    const active=v=>dist[v]<155;
    const relax=(a,b,maxDh)=>{
      if(!(active(a)||active(b)))return false;
      let dh=H[b]-H[a],ad=Math.abs(dh);
      if(ad<=maxDh+.001)return false;
      const s=dh>0?1:-1,ex=ad-maxDh;
      if(pin[a]&&!pin[b]) H[b]-=s*ex;
      else if(pin[b]&&!pin[a]) H[a]+=s*ex;
      else if(!pin[a]&&!pin[b]){H[a]+=s*ex*.5;H[b]-=s*ex*.5;}
      else {
        /* Two pinned cells should normally belong to adjacent road samples.
           If a folded route makes them disagree, split the correction rather
           than permit an artificial vertical wall.  The road mesh itself
           remains at the designed centreline height. */
        H[a]+=s*ex*.5;H[b]-=s*ex*.5;
      }
      return true;
    };
    let terrainPasses=0;
    for(;terrainPasses<120;terrainPasses++){
      let changed=false;
      /* alternate scan direction to avoid pushing all corrections one way */
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
    /* Recompute terrain normals after changing the heights. */
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const kk=(j*NV+i)*3;
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=hL-hR,ny=stepX+stepZ,nz=hD-hU,l=Math.hypot(nx,ny,nz)||1;
      nrm[kk]=nx/l;nrm[kk+1]=ny/l;nrm[kk+2]=nz/l;
    }

    /* Bilinear sampler of the corrected terrain mesh. */
    const minX=pos[0],minZ=pos[2];
    const gridH=(x,z)=>{
      const fx=clamp((x-minX)/stepX,0,NV-1.001),fz=clamp((z-minZ)/stepZ,0,NV-1.001);
      const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
      const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
      return lerp(lerp(a,b,u),lerp(c,d,u),v);
    };
    w.meshH=gridH;w.groundAt=gridH;

    const deltaAt=(x,z)=>gridH(x,z)-oldGround(x,z);

    /* Move baked scenery with the new ground so nothing floats after the
       hillside correction. */
    if(w.props&&w.props.pos){
      const p=w.props.pos;
      for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    if(w.water&&w.water.pos){
      const p=w.water.pos;
      for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }

    /* v105's yellow rectangles are camera-facing vegetation sprites.  Keep
       billboards for distant density, but remove them from the immediate
       roadside where real geometry/glTF vegetation looks much more natural. */
    if(w.veg&&w.veg.ctr&&w.veg.dat&&w.veg.uv){
      const C=w.veg.ctr,D=w.veg.dat,U=w.veg.uv;
      const plants=Math.floor(C.length/12);
      for(let p=0;p<plants;p++){
        const v=p*4,ci=v*3,di=v*4,ui=v*2;
        const x=C[ci],z=C[ci+2],q=near(x,z),dy=deltaAt(x,z);
        for(let qv=0;qv<4;qv++)C[(v+qv)*3+1]+=dy;
        let size=D[di+2];
        const kind=Math.max(0,Math.min(5,Math.floor(U[ui]*6+.02)));
        if(kind<=1)size=Math.min(size,.52); else size=Math.min(size,2.7);
        if(q){
          if(q.d<55)size=0;                    // no billboard cards near rider
          else if(q.d<85&&kind>=2)size*=.35;
          else if(q.d<80&&kind<=1)size*=.55;
          if(q.d<120&&kind<=1&&(p%2))size=0;  // thin distant grass repetition
        }
        for(let qv=0;qv<4;qv++)D[(v+qv)*4+2]=size;
      }
    }

    /* Ground-bound actors follow the corrected surface immediately. */
    for(let i=0;i<(w.actors||[]).length;i++){
      const a=w.actors[i];
      if(!Number.isFinite(a.px)||!Number.isFinite(a.pz))continue;
      const old=oldActorGround[i];
      if(!Number.isFinite(old))continue;
      const d=gridH(a.px,a.pz)-old;
      if(Number.isFinite(a.py))a.py+=d;
      if(Number.isFinite(a.gy))a.gy+=d;
      if(Number.isFinite(a.baseY))a.baseY+=d;
      if(Number.isFinite(a.pinY))a.pinY+=d;
      if(Number.isFinite(a.baseRoadY))a.baseRoadY+=d;
    }
    for(const b of (w.bases||[]))if(Number.isFinite(b.x)&&Number.isFinite(b.z)&&Number.isFinite(b.y))
      b.y+=deltaAt(b.x,b.z);

    /* Diagnostic with exact location of the worst remaining terrain edge. */
    let maxSide=0,worst=null;
    const record=(pct,i,j,dir,h0,h1)=>{
      if(pct<=maxSide)return;maxSide=pct;
      const v=j*NV+i,q=ri[v]>=0?{i:ri[v],d:dist[v]}:null;
      worst={x:pos[v*3],z:pos[v*3+2],gridI:i,gridJ:j,dir,h0,h1,roadIndex:q&&q.i,roadDist:q&&q.d};
    };
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const v=j*NV+i;
      if(dist[v]>80)continue;
      if(i<NV-1){const h0=at(i,j),h1=at(i+1,j),pct=Math.abs(h1-h0)/stepX*100;record(pct,i,j,'x',h0,h1);}
      if(j<NV-1){const h0=at(i,j),h1=at(i,j+1),pct=Math.abs(h1-h0)/stepZ*100;record(pct,i,j,'z',h0,h1);}
    }
    w.__verdantTerrainAudit={passes:terrainPasses,maxNearTrailSlopePct:maxSide,worst};
    console.log('Verdant terrain audit',w.__verdantTerrainAudit);
    return w;
  };
})();
