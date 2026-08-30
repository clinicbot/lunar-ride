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
