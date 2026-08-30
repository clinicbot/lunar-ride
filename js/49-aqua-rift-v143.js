"use strict";

/* Aqua Rift v143 -----------------------------------------------------------
   A separate underwater world inspired by the *experience* of riding through
   a transparent aquarium tunnel, without copying another game's geometry.

   Design goals:
   - normal Lunar Ride physics and controls;
   - a continuous glass canopy around the road, with several wider panorama
     galleries along the lap;
   - a visible water surface high overhead and blue underwater fog;
   - colourful coral/kelp outside the tube;
   - animated fish and jellyfish using the existing lightweight orbiting-actor
     path (type "drone"), but with custom procedural meshes.

   Verdant Rift and all older worlds are untouched. */
(function(){
  const AQUA_ID='aqua';
  const VERSION=143;
  const FISH_COUNT=96, GIANT_FISH_COUNT=12, JELLY_COUNT=24;
  const CORAL_COUNT=220, KELP_COUNT=140;
  const GLASS_R=8.8, GLASS_ARC_SEG=12, GLASS_STEP=5;

  SCENES.push({
    id:AQUA_ID,
    name:'Aqua Rift — Glass Ocean',
    art:'assets/images/aqua_rift_card.svg',
    subtitle:'A submerged grand aquarium ride: a transparent glass road tunnel, panoramic reef galleries, coral gardens, moving fish schools and drifting jellyfish beneath a luminous ocean surface.',
    customWorld:AQUA_ID,
    land:{amp:24,scale:520,rough:.32,craters:0,craterMax:0,rimAmp:155},
    road:{maxGrade:4.5,halfWidth:3.6,loopR:1120,twist:.62,tunnels:0,bridges:0},
    sun:{az:2.15,el:.72,col:'#baf6ff',amb:'#236879'},
    col:{high:'#497f78',low:'#204f55',road:'#303c42',rumble:'#86dbea',lane:'#c9fbff'},
    sky:{top:'#073b59',horizon:'#1683a0',fog:'#187a91',fogDen:.00115,stars:0,starBright:0,cloud:0,earth:null},
    life:{bases:0,walkers:0,rovers:0,ships:0,drones:0,station:false,spaceport:false},
    flora:{},fauna:{},
    bio:{stem:'#245f57',leaf:'#55a97b',glow:'#73f2ff',skin:'#64a9a3',dark:'#16343a',accent:'#ff6f91',eye:'#fff4a3'},
    kit:{hull:'#d9f7f8',trim:'#76b7c4',dark:'#19373f',glow:'#75f5ff',panel:'#235a68',gold:'#f5d77d',suit:'#edfafa',visor:'#7ce9f5',pack:'#9dcbd2',stripe:'#ff6f91',flame:'#a8fbff'},
    audio:{wind:.12,birds:0},rocks:260,seed:14373,
    exposure:1.18,bloom:.72
  });

  const previousBuild=buildWorld;
  buildWorld=function(scene,onProgress){
    if(!scene||scene.customWorld!==AQUA_ID)return previousBuild(scene,onProgress);
    const w=previousBuild(scene,p=>onProgress&&onProgress(Math.min(.78,p*.78)));
    if(!w)return w;
    enhanceAqua(w,scene);
    onProgress&&onProgress(1);
    return w;
  };

  function meshOf(m){
    return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),col:new Float32Array(m.col),
      limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};
  }
  function mergeMesh(base,extra){
    const e=meshOf(extra); if(!base||!base.pos||!base.idx)return e;
    const pos=new Float32Array(base.pos.length+e.pos.length);pos.set(base.pos);pos.set(e.pos,base.pos.length);
    const nrm=new Float32Array(base.nrm.length+e.nrm.length);nrm.set(base.nrm);nrm.set(e.nrm,base.nrm.length);
    const col=new Float32Array(base.col.length+e.col.length);col.set(base.col);col.set(e.col,base.col.length);
    const idx=new Uint32Array(base.idx.length+e.idx.length);idx.set(base.idx);
    const vo=base.pos.length/3;for(let i=0;i<e.idx.length;i++)idx[base.idx.length+i]=e.idx[i]+vo;
    return {pos,nrm,col,idx};
  }

  function enhanceAqua(w,scene){
    const rnd=mulberry32((scene.seed||14373)+VERSION),n=w.nMain,routeKm=w.lapLen/1000;
    if(!n||!w.rx||!w.rz||!w.ry)return w;

    const wrapKm=k=>((k%routeKm)+routeKm)%routeKm;
    const kmDist=(a,b)=>{let d=Math.abs(wrapKm(a)-wrapKm(b));return Math.min(d,routeKm-d);};
    const galleryCenters=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const radiusAtKm=km=>{
      let r=GLASS_R;
      for(const c of galleryCenters){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}
      return r;
    };
    const pose=(i,off)=>{
      i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};
    };
    const ringPoint=(i,a,r)=>{
      const nx=-w.tz[i],nz=w.tx[i],sa=Math.sin(a),ca=Math.cos(a);
      return [w.rx[i]+nx*sa*r,w.ry[i]+.12+ca*r,w.rz[i]+nz*sa*r];
    };

    /* Continuous half-cylinder glass canopy. */
    const glass=new MeshB(),GC=hx('#78ddeb');
    for(let i=0;i<n;i+=GLASS_STEP){
      const j=(i+GLASS_STEP)%n,ra=radiusAtKm(i*ROUTE_STEP/1000),rb=radiusAtKm(j*ROUTE_STEP/1000);
      for(let s=0;s<GLASS_ARC_SEG;s++){
        const a0=-Math.PI/2+s/GLASS_ARC_SEG*Math.PI,a1=-Math.PI/2+(s+1)/GLASS_ARC_SEG*Math.PI;
        glass.quad(ringPoint(i,a0,ra),ringPoint(j,a0,rb),ringPoint(j,a1,rb),ringPoint(i,a1,ra),GC,.08);
      }
    }
    w.glass=meshOf(glass);

    /* Opaque structural ribs make the transparent tube readable at speed. */
    const reef=new MeshB(),RIB=hx('#5bb6c6'),rail=hx('#287487');
    for(let i=0;i<n;i+=24){
      const j=(i+1)%n,r=radiusAtKm(i*ROUTE_STEP/1000);
      for(let s=0;s<GLASS_ARC_SEG;s++){
        const a0=-Math.PI/2+s/GLASS_ARC_SEG*Math.PI,a1=-Math.PI/2+(s+1)/GLASS_ARC_SEG*Math.PI;
        reef.quad(ringPoint(i,a0,r+.05),ringPoint(j,a0,r+.05),ringPoint(j,a1,r+.05),ringPoint(i,a1,r+.05),RIB,.12);
      }
      const lp=pose(i,-r),rp=pose(i,r);
      reef.setTF(lp.x,lp.y+.02,lp.z,Math.atan2(w.tx[i],w.tz[i]),1);reef.box(0,0,0,.22,.48,4.0,rail,.15);
      reef.setTF(rp.x,rp.y+.02,rp.z,Math.atan2(w.tx[i],w.tz[i]),1);reef.box(0,0,0,.22,.48,4.0,rail,.15);
    }

    /* Coral gardens deliberately begin outside the glass envelope. */
    const corals=['#ff5577','#ff9d45','#c85cff','#51d7e8','#f5dc5b'].map(hx),green=hx('#2f8d68'),green2=hx('#5fc88f');
    for(let k=0;k<CORAL_COUNT;k++){
      const i=(rnd()*n)|0,r=radiusAtKm(i*ROUTE_STEP/1000),side=rnd()<.5?-1:1,off=r+5+rnd()*62;
      const p=pose(i,side*off),y=w.groundAt(p.x,p.z),sc=.65+rnd()*1.6,c=corals[k%corals.length];
      reef.setTF(p.x,y,p.z,rnd()*6.28318,sc);
      reef.cyl(0,0,0,.16,1.6+rnd()*2.7,6,c,.12);
      reef.cyl(.22,.7,0,.10,1.0+rnd()*1.5,6,c,.15,'y');
      reef.cyl(-.22,.45,.08,.09,.8+rnd()*1.3,6,c,.15,'y');
      reef.sph(0,1.55+rnd()*1.8,0,.26,7,4,c,.18,false,.75);
    }
    for(let k=0;k<KELP_COUNT;k++){
      const i=(rnd()*n)|0,r=radiusAtKm(i*ROUTE_STEP/1000),side=rnd()<.5?-1:1,off=r+4+rnd()*48;
      const p=pose(i,side*off),y=w.groundAt(p.x,p.z),h=3+rnd()*6;
      reef.setTF(p.x,y,p.z,rnd()*6.28318,.8+rnd()*.7);
      reef.cyl(0,0,0,.10,h,5,k%2?green:green2,.05);
      for(let q=1;q<4;q++)reef.sph((q%2?.28:-.28),h*q/4,0,.32,6,3,k%2?green2:green,.04,false,.42);
    }
    reef.setTF(0,0,0,0,1);
    w.props=mergeMesh(w.props,reef);

    /* A luminous ocean surface well above the tube, visible from below. */
    let maxRoad=-1e9;for(let i=0;i<n;i++)if(w.ry[i]>maxRoad)maxRoad=w.ry[i];
    const surfaceY=maxRoad+48,ext=1580,wm=new MeshB(),WC=hx('#31a8c7');
    wm.quad([-ext,surfaceY,-ext],[ext,surfaceY,-ext],[ext,surfaceY,ext],[-ext,surfaceY,ext],WC,.12);
    wm.quad([-ext,surfaceY,ext],[ext,surfaceY,ext],[ext,surfaceY,-ext],[-ext,surfaceY,-ext],WC,.12);
    w.water=meshOf(wm);w.waterY=surfaceY;

    /* Small procedural fish meshes. Existing 'drone' motion supplies smooth
       horizontal swimming plus a gentle vertical oscillation, while mesh lets
       every school have its own species/colour without touching core code. */
    const ell=(m,rx,ry,rz,col)=>{
      const seg=10,rings=6,V=(t,p)=>[Math.sin(t)*Math.cos(p)*rx,.28+Math.cos(t)*ry,Math.sin(t)*Math.sin(p)*rz];
      for(let a=0;a<rings;a++){const t0=a/rings*Math.PI,t1=(a+1)/rings*Math.PI;
        for(let b=0;b<seg;b++){const p0=b/seg*6.28318,p1=(b+1)/seg*6.28318;m.quad(V(t0,p0),V(t0,p1),V(t1,p1),V(t1,p0),col,.08);}}
    };
    const fishMesh=(body,accent)=>{
      const m=new MeshB(),B=hx(body),A=hx(accent),D=hx('#071317');ell(m,.34,.22,.66,B);
      m.tri([0,.28,-.52],[0,.70,-1.00],[0,.28,-.86],A,.12);m.tri([0,.28,-.52],[0,-.14,-1.00],[0,.28,-.86],A,.12);
      m.tri([-.25,.24,-.05],[-.62,.02,-.22],[-.18,.22,.18],A,.10);m.tri([.25,.24,-.05],[.62,.02,-.22],[.18,.22,.18],A,.10);
      m.sph(-.16,.38,.48,.045,6,3,D,.1);m.sph(.16,.38,.48,.045,6,3,D,.1);return meshOf(m);
    };
    const jellyMesh=()=>{const m=new MeshB(),J=hx('#df78ff'),L=hx('#9beaff');m.sph(0,.35,0,.42,10,5,J,.35,true,.65);
      for(const x of [-.24,-.08,.08,.24])m.cyl(x,-.65,0,.025,.85,5,L,.35,'y');return meshOf(m);};
    w.actorMeshes=w.actorMeshes||{};
    w.actorMeshes.fishBlue=fishMesh('#4bd8f2','#f4ef73');
    w.actorMeshes.fishGold=fishMesh('#ffd34e','#ff7b55');
    w.actorMeshes.fishViolet=fishMesh('#9a73ff','#61f1db');
    w.actorMeshes.fishCoral=fishMesh('#ff6b78','#ffe478');
    w.actorMeshes.jellyAqua=jellyMesh();

    const keys=['fishBlue','fishGold','fishViolet','fishCoral'];
    const addSwimmer=(mesh,kScale,slow)=>{
      const i=(rnd()*n)|0,r0=radiusAtKm(i*ROUTE_STEP/1000),side=rnd()<.5?-1:1,off=r0+18+rnd()*78,p=pose(i,side*off);
      const gy=w.groundAt(p.x,p.z),rad=5+rnd()*18,alt=5+rnd()*25;
      w.actors.push({type:'drone',mesh,cx:p.x,cz:p.z,gy,r:rad,alt,ph:rnd()*6.28318,
        w:(rnd()<.5?-1:1)*(slow?(.012+rnd()*.025):(.035+rnd()*.075)),px:p.x,py:gy+alt,pz:p.z,yaw:rnd()*6.28318,k:kScale,emiss:1});
    };
    for(let k=0;k<FISH_COUNT;k++)addSwimmer(keys[k%keys.length],.55+rnd()*.85,false);
    for(let k=0;k<GIANT_FISH_COUNT;k++)addSwimmer(keys[k%keys.length],1.8+rnd()*1.6,true);
    for(let k=0;k<JELLY_COUNT;k++)addSwimmer('jellyAqua',.8+rnd()*1.1,true);

    w.__aquaRiftV143={version:VERSION,routeKm:+routeKm.toFixed(2),glassRadius:GLASS_R,galleryCenters:galleryCenters.map(x=>+x.toFixed(2)),
      fish:FISH_COUNT,giantFish:GIANT_FISH_COUNT,jellyfish:JELLY_COUNT,coral:CORAL_COUNT,kelp:KELP_COUNT,waterSurfaceY:surfaceY};
    console.log('Aqua Rift v143 ready:',w.__aquaRiftV143);
    return w;
  }

  globalThis.__aquaRiftV143Spec={VERSION,FISH_COUNT,GIANT_FISH_COUNT,JELLY_COUNT,CORAL_COUNT,KELP_COUNT,GLASS_R,GLASS_ARC_SEG,GLASS_STEP};
})();
