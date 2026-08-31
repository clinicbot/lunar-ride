"use strict";

/* Aqua Rift v151 — coral gardens + restored jellyfish ---------------------
   v150 finally removed leaked land scenery and left a clean submarine stage.
   This layer enriches that approved base without changing road, glass, fish,
   U-turn continuity, or Verdant:

   - add a second baked reef layer in near/mid/far depth bands on BOTH sides;
   - use only low organic coral forms (brains, fans, plates, branching gardens);
   - restore the existing Aqua jellyfish mesh as slow drifting actors;
   - keep jellyfish safely outside the glass envelope and spread them through
     several height bands;
   - add a very subtle bell pulse by changing actor scale only.
*/
(function(){
  const AQUA_ID='aqua',VERSION=151,TWO_PI=Math.PI*2;
  const REEF_STATIONS=176,CORALS_PER_SIDE=4,JELLY_COUNT=52;
  const BANDS=[[14,40],[38,82],[76,132],[122,198]];
  const HEIGHT_BANDS=[2.8,5.5,9.0,13.0,17.5];
  const PALETTE=['#ff5f7f','#ff9b50','#c96aff','#53d8e7','#f1dd65','#ff82c7','#72d79b','#8f86ff','#ef7256'];

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    return enrichAquaV151(w,sc);
  };

  function meshOf(m){return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
    col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};}
  function mergeMesh(base,extra){
    const e=meshOf(extra);if(!base||!base.pos||!base.idx)return e;
    const pos=new Float32Array(base.pos.length+e.pos.length);pos.set(base.pos);pos.set(e.pos,base.pos.length);
    const nrm=new Float32Array(base.nrm.length+e.nrm.length);nrm.set(base.nrm);nrm.set(e.nrm,base.nrm.length);
    const col=new Float32Array(base.col.length+e.col.length);col.set(base.col);col.set(e.col,base.col.length);
    const limb=new Float32Array((base.limb?base.limb.length:base.pos.length/3)+e.limb.length);
    if(base.limb)limb.set(base.limb);limb.set(e.limb,base.limb?base.limb.length:base.pos.length/3);
    const idx=new Uint32Array(base.idx.length+e.idx.length);idx.set(base.idx);const vo=base.pos.length/3;
    for(let i=0;i<e.idx.length;i++)idx[base.idx.length+i]=e.idx[i]+vo;
    return {pos,nrm,col,limb,idx};
  }
  function routeHelpers(w){
    const n=w.nMain,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);d=Math.min(d,routeKm-d);return d;};
    const radiusAt=i=>{const km=((i%n)+n)%n*ROUTE_STEP/1000;let r=8.8;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;};
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};};
    return {radiusAt,pose,routeKm};
  }

  function enrichAquaV151(w,sc){
    const n=w.nMain||0;if(!n||!w.rx||!w.rz||!w.ry)return w;
    const rnd=mulberry32((sc.seed||14373)+151151),H=routeHelpers(w),reef=new MeshB(),cols=PALETTE.map(hx);
    let coralPlacements=0,coralHeads=0;

    const brain=(x,y,z,yaw,scale,c)=>{reef.setTF(x,y,z,yaw,scale);
      reef.sph(0,.36,0,.46,7,4,c,.08,false,.72);reef.sph(.34,.28,.10,.31,7,4,c,.07,false,.70);
      reef.sph(-.31,.27,-.08,.29,7,4,c,.07,false,.70);coralHeads+=3;};
    const plate=(x,y,z,yaw,scale,c)=>{reef.setTF(x,y,z,yaw,scale);
      reef.cyl(0,0,0,.12,.40,6,c,.05);reef.sph(0,.44,0,.72,8,4,c,.08,false,.20);
      reef.sph(.31,.48,.06,.48,7,4,c,.07,false,.16);coralHeads+=2;};
    const fan=(x,y,z,yaw,scale,c)=>{reef.setTF(x,y,z,yaw,scale);reef.cyl(0,0,0,.08,.30,5,c,.05);
      for(let q=0;q<6;q++){const a=-1.15+q*.46;reef.sph(Math.sin(a)*.46,.34+Math.cos(a)*.43,0,.24,6,3,c,.07,false,.38);}
      coralHeads+=6;};
    const branch=(x,y,z,yaw,scale,c)=>{reef.setTF(x,y,z,yaw,scale);
      const pts=[[-.28,.24,-.05],[0,.34,.03],[.27,.22,.06],[-.16,.52,.05],[.15,.56,-.03]];
      for(const p of pts)reef.sph(p[0],p[1],p[2],.20,6,3,c,.07,false,.65);coralHeads+=pts.length;};

    /* Four distance bands per side at every station.  Near reef stays low so
       the road remains readable; mid/far reef gets slightly larger to keep the
       ocean floor visually alive all the way to the fog horizon. */
    for(let st=0;st<REEF_STATIONS;st++){
      const base=Math.floor((st+.22+rnd()*.56)*n/REEF_STATIONS)%n;
      for(const side of [-1,1])for(let k=0;k<CORALS_PER_SIDE;k++){
        const i=(base+Math.floor((rnd()-.5)*8)+n)%n,glass=H.radiusAt(i),band=BANDS[k],
          lo=Math.max(band[0],glass+4.6),hi=Math.max(lo+4,band[1]),
          off=lo+Math.pow(rnd(),k<2?.88:.68)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-10,
          scale=(k===0?.48:k===1?.68:k===2?.82:1.0)+rnd()*(k===0?.78:k===1?.92:k===2?1.15:1.40),
          c=cols[(st*3+k+(side>0?4:0))%cols.length],yaw=rnd()*TWO_PI,kind=(st+k*5+(side>0?2:0))%12;
        if(kind<5)brain(p.x,y,p.z,yaw,scale,c);
        else if(kind<8)plate(p.x,y,p.z,yaw,scale,c);
        else if(kind<10)fan(p.x,y,p.z,yaw,scale,c);
        else branch(p.x,y,p.z,yaw,scale,c);
        coralPlacements++;
      }
    }
    reef.setTF(0,0,0,0,1);w.props=mergeMesh(w.props,reef);

    /* v143's attractive translucent jelly model remains in actorMeshes even
       after v144 removed the old procedural fauna.  Reuse it; make a fallback
       only if a future base revision omits it. */
    w.actorMeshes=w.actorMeshes||{};
    if(!w.actorMeshes.jellyAqua){
      const jm=new MeshB(),J=hx('#d989ff'),L=hx('#a8efff');jm.sph(0,.35,0,.42,10,5,J,.35,true,.65);
      for(const x of [-.24,-.08,.08,.24])jm.cyl(x,-.65,0,.025,.85,5,L,.35,'y');w.actorMeshes.jellyAqua=meshOf(jm);
    }
    let jellyfish=0;
    for(let j=0;j<JELLY_COUNT;j++){
      const i=Math.floor((j+.18+rnd()*.64)*n/JELLY_COUNT)%n,glass=H.radiusAt(i),side=(j&1)?1:-1,
        off=glass+9+rnd()*70,p=H.pose(i,side*off),floor=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-10,
        band=HEIGHT_BANDS[j%HEIGHT_BANDS.length],target=Math.max(floor+3.0,w.ry[i]+band),
        orbit=1.4+rnd()*3.8,baseK=.72+rnd()*.88,ph=rnd()*TWO_PI;
      w.actors.push({type:'drone',mesh:'jellyAqua',aquaJelly:true,cx:p.x,cz:p.z,gy:floor,r:orbit,
        alt:target-floor,ph,w:(j&1?1:-1)*(.006+rnd()*.013),px:p.x,py:target,pz:p.z,yaw:rnd()*TWO_PI,
        k:baseK,__aquaJellyBaseK:baseK,__aquaJellyPulse:ph,__aquaV151RoadOffset:off,
        __aquaV151GlassRadius:glass,__aquaV151HeightBand:j%HEIGHT_BANDS.length,emiss:1});
      jellyfish++;
    }

    w.__aquaV151={version:VERSION,reefExtension:true,coralPlacements,coralHeads,
      reefStations:REEF_STATIONS,coralsPerSide:CORALS_PER_SIDE,distanceBands:BANDS.map(x=>x.slice()),
      bilateral:true,jellyfish,jellyMesh:'jellyAqua',jellyHeightBands:HEIGHT_BANDS.slice(),
      jellyOutsideGlass:true,jellyPulse:true,verdantUntouched:true};
    console.log('Aqua Rift v151 coral gardens + jellyfish:',w.__aquaV151);
    return w;
  }

  function installJellyUpdate(){
    if(globalThis.__aquaV151JellyUpdateInstalled)return;
    if(typeof updateActors!=='function'){if(typeof setTimeout==='function')setTimeout(installJellyUpdate,0);return;}
    globalThis.__aquaV151JellyUpdateInstalled=true;const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
      let active=0;for(const a of world.actors){if(!a||a.aquaJelly!==true)continue;
        if(a.__aquaJellyPulse===undefined)a.__aquaJellyPulse=a.ph||0;
        a.__aquaJellyPulse=(a.__aquaJellyPulse+dt*(1.15+.22*Math.sin((a.ph||0)*1.7)))%TWO_PI;
        a.k=(a.__aquaJellyBaseK||1)*(1+.055*Math.sin(a.__aquaJellyPulse));active++;}
      if(world.__aquaV151)world.__aquaV151.jellyPulseActive=active;
    };
  }

  globalThis.__aquaV151Spec={VERSION,REEF_STATIONS,CORALS_PER_SIDE,JELLY_COUNT,
    BANDS:BANDS.map(x=>x.slice()),HEIGHT_BANDS:HEIGHT_BANDS.slice(),PALETTE:PALETTE.slice()};
  installJellyUpdate();
})();
