"use strict";

/* Aqua Rift v150 — reef-only seafloor and visual cleanup -------------------
   The base world generator is intentionally shared by all Lunar Ride worlds,
   so it also bakes cities, stations, masts, roadside screens and mountainous
   terrain into its generic props/terrain meshes.  Underwater those read as a
   leaked land world.  This final Aqua-only build wrapper replaces (not merges)
   those two visual meshes after v143-v149 have finished:

   - road/physics/profile stay exactly as generated;
   - distant mountain terrain becomes a low, softly rolling seabed;
   - generic props, cities, stations, poles, rocks and screen pedestals vanish;
   - only the glass-tunnel structural ribs plus a dense organic coral reef are
     rebuilt into props;
   - existing 258 fish are re-anchored to the new seabed/road water column.

   Verdant and every non-Aqua scene pass through untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=150;
  const BED_EXTENT=1600,BED_STEP=24;
  const ROAD_FLOOR_GAP=1.25,ROAD_BLEND_START=16,ROAD_BLEND_END=92;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_STATIONS=150,CORAL_PER_SIDE=3,CORAL_NEAR=14,CORAL_FAR=178;
  const COLOURS=['#ff5577','#ff9c45','#c862ff','#4fd5e7','#f5d95d','#ff74bb','#70d58c'];
  const TWO_PI=Math.PI*2;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    return cleanAquaWorld(w,sc);
  };

  function meshOf(m){
    return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
      col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};
  }
  function smooth01(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
  function buildRouteLookup(w){
    const CELL=72,b=new Map(),n=w.nMain||0,key=(x,z)=>Math.floor(x/CELL)+':'+Math.floor(z/CELL);
    for(let i=0;i<n;i+=2){const k=key(w.rx[i],w.rz[i]);if(!b.has(k))b.set(k,[]);b.get(k).push(i);}
    return function nearest(x,z){
      const gx=Math.floor(x/CELL),gz=Math.floor(z/CELL);let bi=0,bd=Infinity;
      for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        const a=b.get((gx+dx)+':'+(gz+dz));if(!a)continue;
        for(const i of a){const qx=x-w.rx[i],qz=z-w.rz[i],d=qx*qx+qz*qz;if(d<bd){bd=d;bi=i;}}
      }
      if(!Number.isFinite(bd)){
        for(let i=0;i<n;i+=8){const qx=x-w.rx[i],qz=z-w.rz[i],d=qx*qx+qz*qz;if(d<bd){bd=d;bi=i;}}
      }
      return {i:bi,d:Math.sqrt(bd)};
    };
  }

  function cleanAquaWorld(w,sc){
    const rnd=mulberry32((sc.seed||14373)+VERSION),n=w.nMain||0;
    if(!n||!w.rx||!w.rz||!w.ry)return w;
    const nearest=buildRouteLookup(w);
    let minRoad=Infinity,maxRoad=-Infinity;
    for(let i=0;i<n;i++){if(w.ry[i]<minRoad)minRoad=w.ry[i];if(w.ry[i]>maxRoad)maxRoad=w.ry[i];}
    const abyss=minRoad-13.5;

    /* Keep a shallow shelf under/near the route so the tarmac never floats,
       then ease down to an almost-flat ocean floor.  The tiny sinusoidal
       texture gives the seabed life without creating recognisable mountains. */
    const seabedAt=(x,z)=>{
      const q=nearest(x,z),roadY=w.ry[q.i]-ROAD_FLOOR_GAP;
      const ripple=1.15*Math.sin(x*.0061+z*.0017)+.65*Math.sin(z*.0073-x*.0022);
      const far=abyss+ripple;
      if(q.d<=ROAD_BLEND_START)return roadY;
      if(q.d>=ROAD_BLEND_END)return far;
      return roadY+(far-roadY)*smooth01((q.d-ROAD_BLEND_START)/(ROAD_BLEND_END-ROAD_BLEND_START));
    };

    const bed=new MeshB(),sandA=hx('#195d65'),sandB=hx('#206e72');
    for(let z=-BED_EXTENT;z<BED_EXTENT;z+=BED_STEP)for(let x=-BED_EXTENT;x<BED_EXTENT;x+=BED_STEP){
      const x1=Math.min(BED_EXTENT,x+BED_STEP),z1=Math.min(BED_EXTENT,z+BED_STEP),
        y00=seabedAt(x,z),y10=seabedAt(x1,z),y11=seabedAt(x1,z1),y01=seabedAt(x,z1),
        c=((Math.floor((x+BED_EXTENT)/BED_STEP)+Math.floor((z+BED_EXTENT)/BED_STEP))&1)?sandA:sandB;
      bed.quad([x,y00,z],[x1,y10,z],[x1,y11,z1],[x,y01,z1],c,.015);
    }
    w.terrain=meshOf(bed);
    w.groundAt=seabedAt;
    w.meshH=seabedAt;

    const routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);d=Math.min(d,routeKm-d);return d;};
    const radiusAt=i=>{
      const km=(i*ROUTE_STEP/1000)%routeKm;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}
      return r;
    };
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};};
    const ringPoint=(i,a,r)=>{const nx=-w.tz[i],nz=w.tx[i],sa=Math.sin(a),ca=Math.cos(a);
      return [w.rx[i]+nx*sa*r,w.ry[i]+.12+ca*r,w.rz[i]+nz*sa*r];};

    /* Start props from an empty mesh. This is the key isolation step: generic
       cities/stations/masts/screens/rocks from the shared generator cannot
       survive because none of the old props mesh is copied. */
    const reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');
    for(let i=0;i<n;i+=RIB_EVERY){
      const j=(i+1)%n,r=radiusAt(i);
      for(let s=0;s<ARC_SEG;s++){
        const a0=-Math.PI/2+s/ARC_SEG*Math.PI,a1=-Math.PI/2+(s+1)/ARC_SEG*Math.PI;
        reef.quad(ringPoint(i,a0,r+.05),ringPoint(j,a0,r+.05),ringPoint(j,a1,r+.05),ringPoint(i,a1,r+.05),rib,.09);
      }
      const lp=pose(i,-r),rp=pose(i,r),yaw=Math.atan2(w.tx[i],w.tz[i]);
      reef.setTF(lp.x,lp.y+.02,lp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
      reef.setTF(rp.x,rp.y+.02,rp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
    }

    const palette=COLOURS.map(hx);let coralHeads=0;
    const brain=(x,y,z,yaw,scale,c)=>{
      reef.setTF(x,y,z,yaw,scale);
      reef.sph(0,.52,0,.62,8,5,c,.08,false,.70);
      reef.sph(.34,.36,.14,.36,7,4,c,.07,false,.72);
      reef.sph(-.30,.34,-.10,.33,7,4,c,.07,false,.72);
      coralHeads+=3;
    };
    const table=(x,y,z,yaw,scale,c)=>{
      reef.setTF(x,y,z,yaw,scale);
      reef.cyl(0,0,0,.16,.72,6,c,.06);
      reef.sph(0,.78,0,.78,9,4,c,.08,false,.23);
      reef.sph(.25,.82,.08,.52,8,4,c,.07,false,.18);
      coralHeads+=2;
    };
    const fan=(x,y,z,yaw,scale,c)=>{
      reef.setTF(x,y,z,yaw,scale);
      reef.cyl(0,0,0,.10,.42,5,c,.06);
      for(let q=0;q<5;q++){
        const a=-1.0+q*.5,xx=Math.sin(a)*.48,yy=.45+Math.cos(a)*.42;
        reef.sph(xx,yy,0,.28,6,4,c,.08,false,.42);
      }
      coralHeads+=5;
    };

    /* Dense but low organic reef: paired on both sides and spread far enough
       to fill the visible water volume. No tall coloured sticks are used. */
    for(let st=0;st<REEF_STATIONS;st++){
      const i=Math.floor((st+.35+rnd()*.3)*n/REEF_STATIONS)%n;
      for(const side of [-1,1])for(let k=0;k<CORAL_PER_SIDE;k++){
        const glass=radiusAt(i),off=Math.max(CORAL_NEAR,glass+3.5)+Math.pow(rnd(),.72)*(CORAL_FAR-Math.max(CORAL_NEAR,glass+3.5)),
          p=pose(i,side*off),y=seabedAt(p.x,p.z),scale=.65+rnd()*1.55,c=palette[(st+k+(side>0?2:0))%palette.length],
          yaw=rnd()*TWO_PI,type=(st+k*2+(side>0?1:0))%10;
        if(type<6)brain(p.x,y,p.z,yaw,scale,c);
        else if(type<9)table(p.x,y,p.z,yaw,scale,c);
        else fan(p.x,y,p.z,yaw,scale,c);
      }
    }
    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);
    w.screens=[];
    w.veg=null;

    /* v146 may have raised low schools to clear now-removed mountains. Rebase
       each school to the road-relative water-column bands against this new
       seafloor, while keeping its x/z, species, phase and v149 continuity. */
    const bands=[-1.5,1,4,8,12];let fish=0;
    for(const a of (w.actors||[]))if(a&&a.aquaFish===true){
      const q=nearest(a.cx!==undefined?a.cx:a.px,a.cz!==undefined?a.cz:a.pz),
        band=a.__aquaV146Band!==undefined?a.__aquaV146Band:(fish%bands.length),
        desired=w.ry[q.i]+bands[band%bands.length],floor=seabedAt(a.cx,a.cz),target=Math.max(floor+1.8,desired);
      a.gy=target;a.alt=0;a.py=target;
      delete a.__aquaV147Motion;
      fish++;
    }

    w.__aquaV150={version:VERSION,reefOnly:true,genericPropsDiscarded:true,screensRemoved:true,
      vegetationRemoved:true,mountainTerrainReplaced:true,seabedRange:[abyss,maxRoad-ROAD_FLOOR_GAP],
      bedExtent:BED_EXTENT,bedStep:BED_STEP,reefStations:REEF_STATIONS,
      coralPlacements:REEF_STATIONS*2*CORAL_PER_SIDE,coralHeads,coralRange:[CORAL_NEAR,CORAL_FAR],
      structuralRibsRetained:true,fishReanchored:fish,faceGeometryFromV148:true};
    console.log('Aqua Rift v150 reef-only world:',w.__aquaV150);
    return w;
  }

  globalThis.__aquaV150Spec={VERSION,BED_EXTENT,BED_STEP,ROAD_FLOOR_GAP,ROAD_BLEND_START,ROAD_BLEND_END,
    REEF_STATIONS,CORAL_PER_SIDE,CORAL_NEAR,CORAL_FAR,COLOURS:COLOURS.slice(),smooth01};
})();
