"use strict";

/* Aqua Rift v152 — visible reef walls + the project's real jellyfish -------
   v151 restored jellyfish using Aqua's old procedural mesh and its coral
   extension sat too far from the glass to read at riding speed.  v152 replaces
   that visual layer, rather than stacking more distant scenery:

   - rebuild props from scratch as the glass structural ribs + 2,800 obvious
     coral groups, concentrated close to the OUTSIDE of the glass and extending
     into mid/far reef gardens;
   - remove v151 procedural `jellyAqua` actors;
   - use the exact `assets/models/creature_jelly.gltf` model already loaded by
     the shared engine as GLCRE `jelly`, with the same `gjelly` creature meta
     used by the other Lunar Ride worlds;
   - keep road, tunnel glass, seabed, fish, fish animation/U-turn and Verdant
     untouched.
*/
(function(){
  const AQUA_ID='aqua',VERSION=152,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const JELLY_COUNT=60,RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  /* Four route-centre bands.  Each lower bound is raised to glassRadius+gap,
     so even the panoramic galleries keep all reef geometry outside the tube. */
  const REEF_BANDS=[[10.4,15.3],[13.0,24.0],[20.0,39.0],[35.0,78.0]];
  const JELLY_GLASS_BANDS=[[2.2,8.0],[8.0,24.0],[24.0,55.0]];
  const HEIGHT_RANGES=[[1.6,3.0],[3.1,6.0],[6.2,10.0],[10.2,14.5]];
  /* 20-entry weighted colour bag = 25/20/20/15/10/10 %. */
  const COLOUR_BAG=[
    '#a95cff','#a95cff','#a95cff','#a95cff','#a95cff',
    '#ff639d','#ff639d','#ff639d','#ff639d',
    '#ff934d','#ff934d','#ff934d','#ff934d',
    '#4bd8d2','#4bd8d2','#4bd8d2',
    '#4f86ff','#4f86ff','#f3e4be','#f3e4be'
  ];

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    return rebuildAquaV152(w,sc);
  };

  function meshOf(m){return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
    col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};}

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;};
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};};
    const ringPoint=(i,a,r)=>{i=((i%n)+n)%n;const nx=-w.tz[i],nz=w.tx[i],sa=Math.sin(a),ca=Math.cos(a);
      return [w.rx[i]+nx*sa*r,w.ry[i]+.12+ca*r,w.rz[i]+nz*sa*r];};
    return {n,routeKm,radiusAt,pose,ringPoint};
  }

  function rebuildAquaV152(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+152152),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

    /* Rebuild only the intended underwater props. This deliberately discards
       v150/v151 coral props before adding the stronger v152 composition, so
       the old almost-invisible distant garden is not paid for or double-drawn. */
    for(let i=0;i<n;i+=RIB_EVERY){
      const j=(i+1)%n,r=H.radiusAt(i);
      for(let s=0;s<ARC_SEG;s++){
        const a0=-Math.PI/2+s/ARC_SEG*Math.PI,a1=-Math.PI/2+(s+1)/ARC_SEG*Math.PI;
        reef.quad(H.ringPoint(i,a0,r+.05),H.ringPoint(j,a0,r+.05),H.ringPoint(j,a1,r+.05),H.ringPoint(i,a1,r+.05),rib,.09);
      }
      const lp=H.pose(i,-r),rp=H.pose(i,r),yaw=Math.atan2(w.tx[i],w.tz[i]);
      reef.setTF(lp.x,lp.y+.02,lp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
      reef.setTF(rp.x,rp.y+.02,rp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
    }

    const cols=COLOUR_BAG.map(hx),reefBase=hx('#245f67');
    let coralHeads=0,nearGroups=0,midGroups=0,farGroups=0,richGroups=0,breathingGroups=0;
    const mound=(x,y,z,yaw,s)=>{reef.setTF(x,y,z,yaw,s);reef.sph(0,.13,0,.72,7,3,reefBase,.02,false,.38);};
    const brain=(x,y,z,yaw,s,c,rich)=>{mound(x,y,z,yaw,s);reef.setTF(x,y,z,yaw,s);
      const pts=[[-.38,.32,-.08],[0,.39,.04],[.39,.31,.08],[-.18,.58,.10],[.20,.55,-.10]];
      const lim=rich?pts.length:4;for(let q=0;q<lim;q++){const p=pts[q];reef.sph(p[0],p[1],p[2],.34+(q%2)*.06,7,4,c,.09,false,.72);coralHeads++;}};
    const plate=(x,y,z,yaw,s,c,rich)=>{mound(x,y,z,yaw,s);reef.setTF(x,y,z,yaw,s);
      reef.cyl(0,0,0,.16,.34,6,c,.07);reef.sph(0,.43,0,.82,9,4,c,.10,false,.19);coralHeads++;
      reef.sph(.38,.50,.10,.58,8,4,c,.09,false,.16);coralHeads++;
      if(rich){reef.sph(-.38,.42,-.08,.50,8,4,c,.08,false,.17);coralHeads++;}};
    const fan=(x,y,z,yaw,s,c,rich)=>{mound(x,y,z,yaw,s);reef.setTF(x,y,z,yaw,s);
      const count=rich?8:6;for(let q=0;q<count;q++){const a=-1.18+q*(2.36/(count-1));
        reef.sph(Math.sin(a)*.72,.28+Math.cos(a)*.72,0,.31,6,3,c,.10,false,.42);coralHeads++;}};
    const branch=(x,y,z,yaw,s,c,rich)=>{mound(x,y,z,yaw,s);reef.setTF(x,y,z,yaw,s);
      const pts=[[-.48,.28,-.08],[-.24,.54,.08],[0,.38,0],[.25,.58,-.06],[.50,.31,.09],[0,.73,.03]];
      const lim=rich?pts.length:5;for(let q=0;q<lim;q++){const p=pts[q];reef.sph(p[0],p[1],p[2],.25+(q%3)*.035,6,3,c,.09,false,.75);coralHeads++;}};
    const sponge=(x,y,z,yaw,s,c,rich)=>{mound(x,y,z,yaw,s);reef.setTF(x,y,z,yaw,s);
      const pts=[[-.35,.02,0,.28,.60],[0,.03,.06,.34,.72],[.38,.02,-.04,.25,.53],[-.10,.06,-.25,.22,.46]];
      const lim=rich?4:3;for(let q=0;q<lim;q++){const p=pts[q];reef.cyl(p[0],p[1],p[2],p[3],p[4],7,c,.08);coralHeads++;}};

    /* Exactly 2,800 broad reef groups. Every station contributes four depth
       layers on each side. 20% of stations are richer/larger; 10% intentionally
       breathe, matching the visual rhythm requested instead of uniform clutter. */
    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      const mode=st%10,rich=mode===1||mode===6,breathing=mode===9;
      for(const side of [-1,1])for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.35,band[0]),hi=Math.max(lo+2.5,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.05:.72)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          base=[1.10,1.38,1.58,1.86][k],spread=[.72,1.00,1.18,1.38][k],
          zoneMul=rich?1.30:(breathing?.72:1),s=(base+rnd()*spread)*zoneMul,
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],yaw=rnd()*TWO_PI,kind=(st+k*4+(side>0?3:0))%15;
        if(kind<4)brain(p.x,y,p.z,yaw,s,c,rich);
        else if(kind<7)plate(p.x,y,p.z,yaw,s,c,rich);
        else if(kind<10)fan(p.x,y,p.z,yaw,s,c,rich);
        else if(kind<13)branch(p.x,y,p.z,yaw,s,c,rich);
        else sponge(p.x,y,p.z,yaw,s,c,rich);
        if(k===0)nearGroups++;else if(k<3)midGroups++;else farGroups++;
        if(rich)richGroups++;if(breathing)breathingGroups++;
      }
    }
    reef.setTF(0,0,0,0,1);w.props=meshOf(reef);

    /* Remove v151's procedural Aqua-only jellies and replace them with the
       exact project model used by other worlds: creature_jelly.gltf -> GLCRE
       key `jelly`, creature type/meta `gjelly`. */
    const before=w.actors||[],removed=before.filter(a=>a&&a.aquaJelly===true).length;
    w.actors=before.filter(a=>!a||a.aquaJelly!==true);
    const meta=(typeof CREATURE!=='undefined'&&CREATURE.gjelly)||{headY:0,headZ:0,gait:0,turn:0,rest:0,eye:.6,float:2,hip:0,sh:0};
    let closeJelly=0,midJelly=0,farJelly=0;
    for(let j=0;j<JELLY_COUNT;j++){
      const i=Math.floor((j+.20+rnd()*.60)*n/JELLY_COUNT)%n,glass=H.radiusAt(i),side=(j&1)?1:-1;
      let bi;if(j%10<2)bi=0;else if(j%10<7)bi=1;else bi=2;
      const b=JELLY_GLASS_BANDS[bi],outside=b[0]+rnd()*(b[1]-b[0]),off=glass+outside,p=H.pose(i,side*off),
        floor=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8;
      let hi;if(j%20<4)hi=0;else if(j%20<13)hi=1;else if(j%20<18)hi=2;else hi=3;
      const hr=HEIGHT_RANGES[hi],height=hr[0]+rnd()*(hr[1]-hr[0]),pinY=Math.max(floor+1.8,w.ry[i]+height),
        ph=rnd()*TWO_PI,baseK=.82+rnd()*.58;
      w.actors.push({type:'gjelly',meta,gcre:'jelly',aquaJellyV152:true,hx:p.x,hz:p.z,px:p.x,py:pinY,pz:p.z,
        yaw:rnd()*TWO_PI,pinY,wr:1.3+rnd()*3.6,wander:ph,wr2:0,wspd:(j&1?1:-1)*(.018+rnd()*.026),
        gait:0,ph,alert:0,headYaw:0,headPitch:0,swing:0,emiss:1,gph:0,k:baseK,
        __aquaJellyV152BaseK:baseK,__aquaJellyV152GlassRadius:glass,__aquaJellyV152RoadOffset:off,
        __aquaJellyV152DistanceBand:bi,__aquaJellyV152HeightBand:hi});
      if(bi===0)closeJelly++;else if(bi===1)midJelly++;else farJelly++;
    }

    const fishCount=w.actors.filter(a=>a&&a.aquaFish===true).length;
    w.__aquaV152={version:VERSION,reefWallVisible:true,coralGroups:CORAL_GROUPS,coralHeads,
      reefStations:REEF_STATIONS,groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,
      richGroups,breathingGroups,colourWeights:{purple:.25,pink:.20,orange:.20,turquoise:.15,blue:.10,cream:.10},
      oldV151JellyRemoved:removed,jellyfish:JELLY_COUNT,properProjectJelly:true,
      jellyAsset:'assets/models/creature_jelly.gltf',jellyGcre:'jelly',jellyType:'gjelly',
      jellyDistanceCounts:[closeJelly,midJelly,farJelly],jellyOutsideGlass:true,jellyPulse:true,
      fishPreserved:fishCount,roadUnchanged:true,glassUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v152 visible reef + project jellyfish:',w.__aquaV152);
    return w;
  }

  function installPulse(){
    if(globalThis.__aquaV152PulseInstalled)return;
    if(typeof updateActors!=='function'){if(typeof setTimeout==='function')setTimeout(installPulse,0);return;}
    globalThis.__aquaV152PulseInstalled=true;const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
      const t=state.elapsed||0;let active=0;
      for(const a of world.actors){if(!a||a.aquaJellyV152!==true)continue;
        const b=a.__aquaJellyV152BaseK||1;
        a.k=b*(1+.035*Math.sin(t*(1.55+.18*Math.sin(a.ph||0))+(a.ph||0)));active++;}
      if(world.__aquaV152)world.__aquaV152.jellyPulseActive=active;
    };
  }

  globalThis.__aquaV152Spec={VERSION,REEF_STATIONS,GROUPS_PER_SIDE,CORAL_GROUPS,JELLY_COUNT,
    REEF_BANDS:REEF_BANDS.map(x=>x.slice()),JELLY_GLASS_BANDS:JELLY_GLASS_BANDS.map(x=>x.slice()),
    HEIGHT_RANGES:HEIGHT_RANGES.map(x=>x.slice()),COLOUR_BAG:COLOUR_BAG.slice(),
    jellyAsset:'assets/models/creature_jelly.gltf'};
  installPulse();
})();
