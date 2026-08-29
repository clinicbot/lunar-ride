"use strict";

/* Verdant terrain / vegetation polish -------------------------------------
   The first preview carved the trail into the natural terrain over only
   ~30 m.  Where the route profile sat well below the procedural land this
   produced near-vertical green canyon walls.  This pass keeps the hand-drawn
   route but limits how quickly terrain may rise/fall away from it, then
   rebuilds the terrain sampler from the corrected mesh.  Close-range
   billboard vegetation is also reduced so large sprite cards cannot dominate
   the rider view; real geometry and glTF plants remain available nearby. */
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

    /* Broad, natural shoulders.  The allowed terrain difference grows with
       distance from the trail, preventing the 70-100% side walls visible in
       v105 while still allowing mountains farther away. */
    for(let k=0;k<pos.length;k+=3){
      const x=pos[k],z=pos[k+2],q=near(x,z);
      if(!q||q.i>=w.nMain||q.d>300) continue;
      const zone=w.verdant.zoneAt(q.i),ww=w.verdant.widthAt(q.i);
      const flat=ww+4.5;
      const sideSlope=(zone===3?0.34:(zone===6||zone===7?0.38:0.26));
      const roadY=w.ry[q.i]-.18;
      let y=pos[k+1];
      if(q.d<=flat) y=roadY;
      else {
        const allowed=sideSlope*(q.d-flat);
        y=clamp(y,roadY-allowed,roadY+allowed);
        /* Beyond ~220 m blend the constraint away so distant terrain keeps
           its large-scale mountains instead of becoming a flat corridor. */
        if(q.d>220){
          const f=smoothstep((q.d-220)/80);
          y=lerp(y,pos[k+1],f);
        }
      }
      pos[k+1]=y;
    }

    /* Recompute terrain normals after changing the heights. */
    const stepX=Math.abs(pos[3]-pos[0])||16;
    const at=(i,j)=>pos[(j*NV+i)*3+1];
    for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
      const kk=(j*NV+i)*3;
      const hL=at(Math.max(0,i-1),j),hR=at(Math.min(NV-1,i+1),j);
      const hD=at(i,Math.max(0,j-1)),hU=at(i,Math.min(NV-1,j+1));
      let nx=hL-hR,ny=2*stepX,nz=hD-hU,l=Math.hypot(nx,ny,nz)||1;
      nrm[kk]=nx/l;nrm[kk+1]=ny/l;nrm[kk+2]=nz/l;
    }

    /* Bilinear sampler of the corrected terrain mesh. */
    const minX=pos[0],minZ=pos[2];
    const stepZ=Math.abs(pos[NV*3+2]-minZ)||stepX;
    const gridH=(x,z)=>{
      const fx=clamp((x-minX)/stepX,0,NV-1.001),fz=clamp((z-minZ)/stepZ,0,NV-1.001);
      const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
      const a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
      return lerp(lerp(a,b,u),lerp(c,d,u),v);
    };
    w.meshH=gridH;w.groundAt=gridH;

    const deltaAt=(x,z)=>gridH(x,z)-oldGround(x,z);

    /* Move baked scenery with the new ground.  Because the terrain correction
       varies gradually over tens of metres, applying it per vertex does not
       visibly deform ordinary trees/rocks but prevents floating scenery. */
    if(w.props&&w.props.pos){
      const p=w.props.pos;
      for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }
    if(w.water&&w.water.pos){
      const p=w.water.pos;
      for(let k=0;k<p.length;k+=3)p[k+1]+=deltaAt(p[k],p[k+2]);
    }

    /* Vegetation cards: in v105 the nearby grass/tree sprites read as yellow
       rectangular boxes.  Keep billboards as cheap distant density, but make
       near-trail plants small and hide billboard trees where real geometry is
       the better visual solution. */
    if(w.veg&&w.veg.ctr&&w.veg.dat&&w.veg.uv){
      const C=w.veg.ctr,D=w.veg.dat,U=w.veg.uv;
      const plants=Math.floor(C.length/12);
      for(let p=0;p<plants;p++){
        const v=p*4,ci=v*3,di=v*4,ui=v*2;
        const x=C[ci],z=C[ci+2],q=near(x,z);
        const dy=deltaAt(x,z);
        for(let qv=0;qv<4;qv++) C[(v+qv)*3+1]+=dy;
        let size=D[di+2];
        const kind=Math.max(0,Math.min(5,Math.floor(U[ui]*6+.02)));
        if(kind<=1) size=Math.min(size,.62); else size=Math.min(size,3.2);
        if(q){
          if(q.d<70&&kind>=2) size=0;             // no tree cards beside rider
          else if(q.d<18&&kind<=1) size*=.28;
          else if(q.d<38&&kind<=1) size*=.48;
          if(q.d<26&&kind<=1&&(p%3)!==0) size=0; // thin close grass clutter
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

    /* Useful diagnostic for future worlds: report the steepest terrain sample
       inside 80 m of the trail after the correction. */
    let maxSide=0;
    for(let k=0;k<pos.length;k+=3){
      const q=near(pos[k],pos[k+2]);if(!q||q.d>80)continue;
      const i=(k/3)%NV|0,j=Math.floor((k/3)/NV);
      if(i<NV-1)maxSide=Math.max(maxSide,Math.abs(at(i+1,j)-at(i,j))/stepX*100);
      if(j<NV-1)maxSide=Math.max(maxSide,Math.abs(at(i,j+1)-at(i,j))/stepZ*100);
    }
    w.__verdantTerrainAudit={maxNearTrailSlopePct:maxSide};
    console.log('Verdant terrain audit',w.__verdantTerrainAudit);
    return w;
  };
})();
