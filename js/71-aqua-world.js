"use strict";
/* Aqua Rift - complete world (flattened layers)
   Flattened from the v107-v160 layer files (verbatim, in the exact
   load order the page used). Original files live in git history and in
   branch backup-v160-before-flatten. Section markers below let the
   tests exercise each original layer in isolation. */

/* ===== BEGIN js/49-aqua-rift-v143.js ===== */
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
/* ===== END js/49-aqua-rift-v143.js ===== */

/* ===== BEGIN js/50-aqua-real-fish-v144.js ===== */
"use strict";

/* Aqua Rift v144 — real CC0 reef fish -------------------------------------
   Replaces the leaked terrestrial/base fauna and v143 procedural swimmers in
   Aqua only with real Quaternius fish models imported under CC0.  The current
   Lunar Ride creature loader bakes a static model frame; the existing drone
   trajectory supplies visible swimming motion.  Original animation clips are
   retained inside the source glTF files for a later native-animation upgrade.

   Verdant Rift and every other world are intentionally untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=144;
  const SCHOOL_COUNT=30,FISH_PER_SCHOOL=8,HERO_FISH=18;
  const EXTRA_CORAL=420,EXTRA_KELP=180;
  const FISH_DIR='assets/models/aqua_fish/';
  const SPECIES=[
    {key:'aqClown',file:'clownfish.gltf',scale:.72},
    {key:'aqFishA',file:'fish-a.gltf',scale:.82},
    {key:'aqFishB',file:'fish-b.gltf',scale:.80},
    {key:'aqFishC',file:'fish-c.gltf',scale:.84},
    {key:'aqShark',file:'shark.gltf',scale:1.35,hero:true},
    {key:'aqAngler',file:'anglerfish.gltf',scale:.90,deep:true},
    {key:'aqPuffer',file:'puffer.gltf',scale:.74},
    {key:'aqLion',file:'lionfish.gltf',scale:.88},
    {key:'aqButterfly',file:'butterfly-fish.gltf',scale:.76},
    {key:'aqSword',file:'swordfish.gltf',scale:1.05,hero:true},
    {key:'aqBlackLion',file:'black-lionfish.gltf',scale:.90}
  ];
  const PROC_MESHES=new Set(['fishBlue','fishGold','fishViolet','fishCoral','jellyAqua']);
  const REPLACED_TYPES=new Set(['bear','frog','monkey','insect','stag','cat','jelly','dfly',
    'bird','bird2','bird3','bird4','ray','fish']);

  const previousInit=initGL;
  initGL=function(){
    const r=previousInit();
    for(const s of SPECIES)loadGLTFCreature(s.key,FISH_DIR+s.file,{});
    return r;
  };

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    return upgradeAqua(w,sc);
  };

  function mergeMesh(base,extra){
    const e={pos:new Float32Array(extra.pos),nrm:new Float32Array(extra.nrm),
      col:new Float32Array(extra.col),idx:new Uint32Array(extra.idx)};
    if(!base||!base.pos||!base.idx)return e;
    const pos=new Float32Array(base.pos.length+e.pos.length);pos.set(base.pos);pos.set(e.pos,base.pos.length);
    const nrm=new Float32Array(base.nrm.length+e.nrm.length);nrm.set(base.nrm);nrm.set(e.nrm,base.nrm.length);
    const col=new Float32Array(base.col.length+e.col.length);col.set(base.col);col.set(e.col,base.col.length);
    const idx=new Uint32Array(base.idx.length+e.idx.length);idx.set(base.idx);
    const vo=base.pos.length/3;for(let i=0;i<e.idx.length;i++)idx[base.idx.length+i]=e.idx[i]+vo;
    return {pos,nrm,col,idx};
  }

  function upgradeAqua(w,sc){
    const rnd=mulberry32((sc.seed||14373)+VERSION),n=w.nMain;
    if(!n||!w.rx||!w.rz||!w.ry||!w.actors)return w;

    /* Remove only Aqua's inappropriate fauna and its old synthetic swimmers.
       Mechanical scenery/riders are preserved; Verdant never enters here. */
    const removedByType={},before=w.actors.length;
    w.actors=w.actors.filter(a=>{
      const remove=REPLACED_TYPES.has(a.type)||PROC_MESHES.has(a.mesh);
      if(remove){const k=PROC_MESHES.has(a.mesh)?('procedural:'+a.mesh):(a.type||'unknown');removedByType[k]=(removedByType[k]||0)+1;}
      return !remove;
    });
    if(w.actorMeshes)for(const k of PROC_MESHES)delete w.actorMeshes[k];

    const pose=(i,off)=>{
      i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};
    };
    const seaFloor=(x,z)=>typeof w.groundAt==='function'?w.groundAt(x,z):0;
    const counts=Object.fromEntries(SPECIES.map(s=>[s.key,0]));

    const addFish=(species,cx,cz,gy,alt,radius,phase,speed,scale)=>{
      const ang=phase;
      w.actors.push({type:'drone',gcre:species.key,mesh:'drone',aquaFish:true,
        cx,cz,gy,r:radius,alt,ph:phase,w:speed,
        px:cx+Math.cos(ang)*radius,py:gy+alt,pz:cz+Math.sin(ang)*radius,
        yaw:phase,k:scale,emiss:.72,gph:phase});
      counts[species.key]++;
    };

    /* Cohesive schools.  Every school shares a broad centre, height and swim
       direction, while individual phases/radii vary enough to avoid rings. */
    for(let s=0;s<SCHOOL_COUNT;s++){
      const i=(rnd()*n)|0,side=rnd()<.5?-1:1;
      const c=pose(i,side*(28+rnd()*82)),gy=seaFloor(c.x,c.z);
      const baseAlt=6+rnd()*27,dir=rnd()<.5?-1:1,baseW=dir*(.018+rnd()*.032);
      const species=SPECIES[s%SPECIES.length];
      for(let j=0;j<FISH_PER_SCHOOL;j++){
        const a=rnd()*Math.PI*2,spread=2+rnd()*10;
        const cx=c.x+Math.cos(a)*spread,cz=c.z+Math.sin(a)*spread;
        const deep=species.deep?Math.max(3,baseAlt*.45):baseAlt;
        addFish(species,cx,cz,gy,deep+(rnd()-.5)*5,2.5+rnd()*7.5,
          rnd()*Math.PI*2,baseW*(.82+rnd()*.36),species.scale*(.74+rnd()*.52));
      }
    }

    /* Larger hero fish are sparse, slower and farther from the glass. */
    const heroSpecies=SPECIES.filter(s=>s.hero);
    for(let j=0;j<HERO_FISH;j++){
      const sp=heroSpecies[j%heroSpecies.length],i=(rnd()*n)|0,side=rnd()<.5?-1:1;
      const c=pose(i,side*(48+rnd()*105)),gy=seaFloor(c.x,c.z);
      addFish(sp,c.x,c.z,gy,10+rnd()*30,6+rnd()*15,rnd()*Math.PI*2,
        (rnd()<.5?-1:1)*(.010+rnd()*.018),sp.scale*(1.35+rnd()*.65));
    }

    /* Make the seabed read as a reef rather than generic terrain. */
    const reef=new MeshB(),corals=['#ff496f','#ff8d42','#ba5cff','#38cae5','#f2d84e','#ff73be'].map(hx),
      greens=['#1f8468','#39a978','#66c98f'].map(hx);
    for(let k=0;k<EXTRA_CORAL;k++){
      const i=(rnd()*n)|0,side=rnd()<.5?-1:1,p=pose(i,side*(19+rnd()*108)),y=seaFloor(p.x,p.z),
        sca=.55+rnd()*1.75,c=corals[k%corals.length];
      reef.setTF(p.x,y,p.z,rnd()*Math.PI*2,sca);
      const h=1.0+rnd()*3.6;
      reef.cyl(0,0,0,.11+rnd()*.10,h,6,c,.10);
      reef.cyl(.20,h*.28,.02,.07,h*(.35+rnd()*.38),5,c,.12);
      reef.cyl(-.18,h*.18,-.03,.06,h*(.32+rnd()*.42),5,c,.12);
      reef.sph(0,h*.92,0,.20+rnd()*.22,7,4,c,.16,false,.72);
    }
    for(let k=0;k<EXTRA_KELP;k++){
      const i=(rnd()*n)|0,side=rnd()<.5?-1:1,p=pose(i,side*(20+rnd()*96)),y=seaFloor(p.x,p.z),
        h=2.8+rnd()*7.5,c=greens[k%greens.length];
      reef.setTF(p.x,y,p.z,rnd()*Math.PI*2,.72+rnd()*.65);
      reef.cyl(0,0,0,.075+rnd()*.045,h,5,c,.04);
      for(let q=1;q<=4;q++)reef.sph((q&1?.24:-.24),h*q/5,0,.24+rnd()*.16,6,3,greens[(k+q)%greens.length],.04,false,.36);
    }
    reef.setTF(0,0,0,0,1);w.props=mergeMesh(w.props,reef);

    const realFish=Object.values(counts).reduce((a,b)=>a+b,0);
    const prior=w.__aquaRiftV143||{};
    w.__aquaFishV144={version:VERSION,source:'Quaternius CC0',species:SPECIES.map(s=>s.file),
      removedActors:before-(w.actors.length-realFish),removedByType,
      schools:SCHOOL_COUNT,fishPerSchool:FISH_PER_SCHOOL,heroFish:HERO_FISH,realFish,counts,
      extraCoral:EXTRA_CORAL,extraKelp:EXTRA_KELP,
      estimatedCoralTotal:(prior.coral||0)+EXTRA_CORAL,estimatedKelpTotal:(prior.kelp||0)+EXTRA_KELP};
    console.log('Aqua Rift v144 real-fish reef:',w.__aquaFishV144);
    return w;
  }

  globalThis.__aquaFishV144Spec={VERSION,SCHOOL_COUNT,FISH_PER_SCHOOL,HERO_FISH,EXTRA_CORAL,EXTRA_KELP,
    species:SPECIES.map(s=>({key:s.key,file:s.file}))};
})();
/* ===== END js/50-aqua-real-fish-v144.js ===== */

/* ===== BEGIN js/51-aqua-fish-visibility-v145.js ===== */
"use strict";

/* Aqua Rift v145 — fish visibility + hard fauna isolation -----------------
   v144 successfully imported the Quaternius CC0 fish, but Lunar Ride's
   lightweight creature loader intentionally ignores glTF node transforms.
   These FBX2glTF fish keep a canonical x100 mesh-node scale and -90deg X
   rotation in their node, so the raw vertices rendered almost invisibly tiny.

   This Aqua-only correction restores those node transforms at actor level,
   removes every non-Aqua fauna actor regardless of legacy alias (gcat/gstag/
   gbird etc.), and redistributes the existing fish into close regular schools
   so sea life is continuously visible from the glass tunnel. Verdant and all
   other worlds are untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=145;
  const MODEL_SCALE_FACTOR=100;
  const MODEL_PITCH=-Math.PI/2;
  const SCHOOL_SIZE=6;
  const MIN_OFFSET=18,OFFSET_STEP=4;
  const MAX_SWIM_RADIUS=6;
  const FISH_KEYS=new Set(['aqClown','aqFishA','aqFishB','aqFishC','aqShark','aqAngler',
    'aqPuffer','aqLion','aqButterfly','aqSword','aqBlackLion']);

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID||!Array.isArray(w.actors))return w;
    return fixAqua(w);
  };

  function fixAqua(w){
    const before=w.actors.length,removedByType={},kept=[];
    let retainedRiders=0;

    /* Hard isolation is intentional. The player rider is not in world.actors;
       preserve optional NPC riders, preserve only v144 real Aqua fish, and
       discard every other base-world actor. This catches legacy aliases such
       as gcat/gstag/gbird without needing an ever-growing deny-list. */
    for(const a of w.actors){
      if(a&&a.aquaFish===true&&FISH_KEYS.has(a.gcre)){
        if(!a.__aquaV145Fixed){
          a.k=(a.k||1)*MODEL_SCALE_FACTOR;
          a.pitch=MODEL_PITCH;
          a.emiss=Math.max(.95,a.emiss||0);
          a.__aquaV145Fixed=true;
        }
        kept.push(a);
      }else if(a&&(a.type==='rider'||a.me===true)){
        retainedRiders++;kept.push(a);
      }else{
        const key=(a&&a.type)||'unknown';removedByType[key]=(removedByType[key]||0)+1;
      }
    }
    w.actors=kept;

    /* Put the already-created real fish into small, regularly spaced schools
       18-30 m from the road. With 258 fish this yields 43 schools, so a rider
       is never hundreds of metres from the nearest school. The 8.8 m glass
       tube remains safely clear. */
    const fish=w.actors.filter(a=>a&&a.aquaFish===true&&FISH_KEYS.has(a.gcre));
    const n=w.nMain||0,groups=Math.max(1,Math.ceil(fish.length/SCHOOL_SIZE));
    if(n&&w.rx&&w.rz&&w.tx&&w.tz){
      for(let q=0;q<fish.length;q++){
        const a=fish[q],g=Math.floor(q/SCHOOL_SIZE),j=q%SCHOOL_SIZE;
        const i=Math.min(n-1,Math.floor((g+.5)*n/groups));
        const side=(g&1)?-1:1;
        const off=MIN_OFFSET+(g%4)*OFFSET_STEP+(j-(SCHOOL_SIZE-1)/2)*.55;
        a.cx=w.rx[i]-w.tz[i]*off*side;
        a.cz=w.rz[i]+w.tx[i]*off*side;
        const floor=typeof w.groundAt==='function'?w.groundAt(a.cx,a.cz):(w.ry?w.ry[i]:0);
        a.gy=floor;
        a.alt=Math.max(5,Math.min(22,a.alt===undefined?10:a.alt));
        a.r=Math.max(2.2,Math.min(MAX_SWIM_RADIUS,a.r||3.5));
        a.px=a.cx+Math.cos(a.ph||0)*a.r;
        a.pz=a.cz+Math.sin(a.ph||0)*a.r;
        a.py=a.gy+a.alt;
      }
    }

    const removedNonAqua=before-w.actors.length;
    w.__aquaFishV145={version:VERSION,fish:fish.length,schools:groups,schoolSize:SCHOOL_SIZE,
      modelScaleFactor:MODEL_SCALE_FACTOR,modelPitch:MODEL_PITCH,minRoadOffset:MIN_OFFSET,
      maxSwimRadius:MAX_SWIM_RADIUS,removedNonAqua,removedByType,retainedRiders,
      hardFaunaIsolation:true};
    if(w.__aquaFishV144)w.__aquaFishV144.correctedByV145=true;
    console.log('Aqua Rift v145 fish visibility/fauna isolation:',w.__aquaFishV145);
    return w;
  }

  globalThis.__aquaFishV145Spec={VERSION,MODEL_SCALE_FACTOR,MODEL_PITCH,SCHOOL_SIZE,
    MIN_OFFSET,OFFSET_STEP,MAX_SWIM_RADIUS,fishKeys:[...FISH_KEYS]};
})();
/* ===== END js/51-aqua-fish-visibility-v145.js ===== */

/* ===== BEGIN js/52-aqua-depth-distribution-v146.js ===== */
"use strict";

/* Aqua Rift v146 — water-column distribution ------------------------------
   The v145 fish are now correctly sized and visible, but visual review showed
   that too many schools sit high above the rider.  This Aqua-only layer keeps
   the same 258 real Quaternius fish and hard fauna isolation while redistributing
   schools on BOTH sides of the route and throughout the water column: low,
   eye-level, mid and high.  No Verdant code or fauna is touched. */
(function(){
  const AQUA_ID='aqua',VERSION=146;
  const SCHOOL_SIZE=6;
  const ROAD_OFFSETS=[16,20,24,29];
  const HEIGHT_BANDS=[-1.5,1.0,4.0,8.0,12.0];
  const FLOOR_CLEARANCE=2.2;
  const SWIM_RADIUS_MIN=2.0,SWIM_RADIUS_MAX=5.0;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID||!Array.isArray(w.actors))return w;
    return distributeAquaFish(w);
  };

  function distributeAquaFish(w){
    const fish=w.actors.filter(a=>a&&a.aquaFish===true);
    const n=w.nMain||0;
    if(!fish.length||!n||!w.rx||!w.rz||!w.ry||!w.tx||!w.tz)return w;

    const groups=Math.ceil(fish.length/SCHOOL_SIZE);
    const stations=Math.ceil(groups/2);
    const byBand=new Array(HEIGHT_BANDS.length).fill(0);
    let left=0,right=0,minVisualY=1e9,maxVisualY=-1e9;

    for(let q=0;q<fish.length;q++){
      const a=fish[q],g=Math.floor(q/SCHOOL_SIZE),j=q%SCHOOL_SIZE;
      const station=Math.floor(g/2);
      const side=(g%2===0)?-1:1; // paired schools: left + right at each route station
      const i=Math.min(n-1,Math.floor((station+.5)*n/stations));
      const off=ROAD_OFFSETS[(station+j)%ROAD_OFFSETS.length]+(j-(SCHOOL_SIZE-1)/2)*.35;
      const cx=w.rx[i]-w.tz[i]*off*side;
      const cz=w.rz[i]+w.tx[i]*off*side;
      const floor=typeof w.groundAt==='function'?w.groundAt(cx,cz):w.ry[i]-4;
      const band=(station+j*2)%HEIGHT_BANDS.length;
      const desired=w.ry[i]+HEIGHT_BANDS[band]+((j%3)-1)*.45;
      const targetY=Math.max(floor+FLOOR_CLEARANCE,desired);

      /* drone update uses gy+alt plus a small sinusoidal bob.  Anchor gy at
         the desired absolute height and zero alt so the band really is low
         when requested rather than inheriting v144/v145's high altitude. */
      a.cx=cx; a.cz=cz; a.gy=targetY; a.alt=0;
      a.r=SWIM_RADIUS_MIN+((j+station)%7)/6*(SWIM_RADIUS_MAX-SWIM_RADIUS_MIN);
      a.ph=((a.ph||0)+j*.83+station*.37)%6.28318530718;
      a.px=a.cx+Math.cos(a.ph)*a.r;
      a.pz=a.cz+Math.sin(a.ph)*a.r;
      a.py=targetY;
      a.__aquaV146Band=band;
      a.__aquaV146Side=side;

      byBand[band]++;
      if(side<0)left++; else right++;
      if(targetY<minVisualY)minVisualY=targetY;
      if(targetY>maxVisualY)maxVisualY=targetY;
    }

    w.__aquaFishV146={version:VERSION,fish:fish.length,schools:groups,pairedStations:stations,
      schoolSize:SCHOOL_SIZE,roadOffsets:ROAD_OFFSETS.slice(),heightBands:HEIGHT_BANDS.slice(),
      floorClearance:FLOOR_CLEARANCE,swimRadius:[SWIM_RADIUS_MIN,SWIM_RADIUS_MAX],
      byBand,left,right,minVisualY,maxVisualY,bilateral:true,fullWaterColumn:true};
    if(w.__aquaFishV145)w.__aquaFishV145.correctedByV146=true;
    console.log('Aqua Rift v146 water-column fish distribution:',w.__aquaFishV146);
    return w;
  }

  globalThis.__aquaFishV146Spec={VERSION,SCHOOL_SIZE,ROAD_OFFSETS:ROAD_OFFSETS.slice(),
    HEIGHT_BANDS:HEIGHT_BANDS.slice(),FLOOR_CLEARANCE,SWIM_RADIUS_MIN,SWIM_RADIUS_MAX};
})();
/* ===== END js/52-aqua-depth-distribution-v146.js ===== */

/* ===== BEGIN js/53-aqua-swim-motion-v147.js ===== */
"use strict";

/* Aqua Rift v147 — real horizontal swimming motion ------------------------
   v146 fixed the water-column distribution, but the actors were still routed
   through the generic drone updater, which adds a ±2.5 m vertical bob. That
   reads as floating, not swimming. This post-update Aqua-only layer replaces
   the final fish transform with long, shallow horizontal ellipses: sustained
   forward travel, gentle turns, body yaw aligned to velocity, and only a few
   centimetres of slow depth drift. Verdant and non-Aqua actors are untouched.

   This file is loaded by js/19 before js/10 defines updateActors(), so install
   retries on the next task until the render loop exists, then wraps it once. */
(function(){
  const AQUA_ID='aqua',VERSION=147;
  const MAJOR_MIN=8,MAJOR_MAX=15;
  const MINOR_MIN=1.4,MINOR_MAX=3.2;
  const OMEGA_MIN=.20,OMEGA_MAX=.34;
  const VERTICAL_DRIFT=.18;
  const BODY_SWAY=.055;
  const TWO_PI=Math.PI*2;

  globalThis.__aquaFishV147Spec={VERSION,MAJOR_MIN,MAJOR_MAX,MINOR_MIN,MINOR_MAX,
    OMEGA_MIN,OMEGA_MAX,VERTICAL_DRIFT,BODY_SWAY};

  function install(){
    if(globalThis.__aquaFishV147Installed)return;
    if(typeof updateActors!=='function'){
      if(typeof setTimeout==='function')setTimeout(install,0);
      return;
    }
    globalThis.__aquaFishV147Installed=true;
    const previousUpdateActors=updateActors;
    updateActors=function(dt){
      previousUpdateActors(dt);
      if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
      const t=state.elapsed||0;
      let fishCount=0;

      for(const a of world.actors){
        if(!a||a.aquaFish!==true)continue;
        fishCount++;
        if(!a.__aquaV147Motion)initMotion(a);
        const m=a.__aquaV147Motion;
        const th=m.phase+t*m.omega;
        const c=Math.cos(th),s=Math.sin(th);

        /* Long ellipse in the local route direction. Most of each circuit is
           visibly forward travel; the narrow cross-axis only supplies a gentle
           turn instead of a tiny circular orbit. */
        a.px=m.cx+m.tx*m.major*c+m.nx*m.minor*s;
        a.pz=m.cz+m.tz*m.major*c+m.nz*m.minor*s;

        /* The old drone bob was metres high. Real fish mostly hold depth while
           cruising, so vertical motion is deliberately subtle. */
        a.py=m.baseY+VERTICAL_DRIFT*Math.sin(th*.72+m.depthPhase);

        /* Tangent of the ellipse = actual swim direction. A very small whole-
           body sway suggests propulsion until native tail animation is wired. */
        const vx=-m.tx*m.major*s*m.omega+m.nx*m.minor*c*m.omega;
        const vz=-m.tz*m.major*s*m.omega+m.nz*m.minor*c*m.omega;
        a.yaw=Math.atan2(vx,vz)+BODY_SWAY*Math.sin(t*3.6+m.phase*1.7);
        a.gph=(a.gph||0)+dt*4.5;
      }

      if(!world.__aquaFishV147||world.__aquaFishV147.fish!==fishCount){
        world.__aquaFishV147={version:VERSION,fish:fishCount,motion:'horizontal-elliptical-swim',
          majorAxis:[MAJOR_MIN,MAJOR_MAX],minorAxis:[MINOR_MIN,MINOR_MAX],
          angularSpeed:[OMEGA_MIN,OMEGA_MAX],verticalDrift:VERTICAL_DRIFT,
          bodySway:BODY_SWAY,headingFollowsVelocity:true,removesDroneBob:true};
        if(world.__aquaFishV146)world.__aquaFishV146.correctedByV147=true;
        console.log('Aqua Rift v147 swim motion:',world.__aquaFishV147);
      }
    };
  }

  function initMotion(a){
    const phase=((a.ph||0)%TWO_PI+TWO_PI)%TWO_PI;
    let tx=1,tz=0;

    /* v146 placed every school relative to the road but did not retain the
       route tangent. Find it once from the fish school centre, then cache it. */
    if(world&&world.rx&&world.rz&&world.tx&&world.tz&&world.nMain){
      let best=0,bd=Infinity;
      for(let i=0;i<world.nMain;i++){
        const dx=(a.cx||0)-world.rx[i],dz=(a.cz||0)-world.rz[i],d=dx*dx+dz*dz;
        if(d<bd){bd=d;best=i;}
      }
      tx=world.tx[best];tz=world.tz[best];
    }
    let tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;

    /* Slightly rotate individual paths so neighbouring fish do not look like
       cars on parallel rails while the school still travels cohesively. */
    const steer=((phase/TWO_PI)-.5)*.24,cs=Math.cos(steer),sn=Math.sin(steer);
    const rtx=tx*cs-tz*sn,rtz=tx*sn+tz*cs;
    tx=rtx;tz=rtz;
    const nx=-tz,nz=tx;
    const frac=(Math.sin(phase*3.71)*.5+.5);
    const major=MAJOR_MIN+(MAJOR_MAX-MAJOR_MIN)*frac;
    const minor=MINOR_MIN+(MINOR_MAX-MINOR_MIN)*(1-frac*.65);
    const omega=(OMEGA_MIN+(OMEGA_MAX-OMEGA_MIN)*((Math.cos(phase*2.17)*.5+.5)))
      *((Math.sin(phase*1.31)>=0)?1:-1);

    a.__aquaV147Motion={cx:a.cx||a.px||0,cz:a.cz||a.pz||0,baseY:a.gy+(a.alt||0),
      tx,tz,nx,nz,major,minor,omega,phase,depthPhase:phase*1.93};
  }

  install();
})();
/* ===== END js/53-aqua-swim-motion-v147.js ===== */

/* ===== BEGIN js/54-aqua-tail-animation-v148.js ===== */
"use strict";

/* Aqua Rift v148 — articulated body/tail animation, face-enhanced by v150 ---
   v147 gives the fish horizontal trajectories.  This loader bakes 24 shared
   geometry frames per species, keeps the head stable, bends the tail in the
   horizontal plane, and now adds durable geometric eyes/pupils/mouth details
   before the frames are baked.  That makes faces readable even though Lunar
   Ride's lightweight creature path does not render the tiny source textures.
   Verdant and every non-Aqua creature keep the original loader. */
(function(){
  const VERSION=148,FRAME_COUNT=24;
  const BODY_START=.14,TAIL_AMPLITUDE=.075,SPATIAL_PHASE=1.55;
  const FISH_KEYS=new Set(['aqClown','aqFishA','aqFishB','aqFishC','aqShark','aqAngler',
    'aqPuffer','aqLion','aqButterfly','aqSword','aqBlackLion']);
  const TAIL_SPEED={aqClown:9.2,aqFishA:7.8,aqFishB:7.5,aqFishC:7.7,aqShark:4.4,
    aqAngler:5.8,aqPuffer:6.2,aqLion:7.0,aqButterfly:8.4,aqSword:5.2,aqBlackLion:6.8};
  const TWO_PI=Math.PI*2;

  const previousLoader=loadGLTFCreature;
  loadGLTFCreature=async function(key,file,opts){
    if(!FISH_KEYS.has(key))return previousLoader(key,file,opts);
    try{return await loadAnimatedFish(key,file);}catch(e){
      console.warn('Aqua v148 animated fish fallback:',file,e&&e.message?e.message:e);
      return previousLoader(key,file,opts);
    }
  };

  async function loadAnimatedFish(key,file){
    const res=await fetch(file);if(!res.ok)throw new Error('HTTP '+res.status);
    const gj=await res.json(),uri=gj.buffers&&gj.buffers[0]&&gj.buffers[0].uri;
    if(!uri||uri.indexOf('base64,')<0)throw new Error('embedded buffer missing');
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const acc=i=>{const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],T=CT[a.componentType];
      if(!T)throw new Error('component type '+a.componentType);
      return new T(bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);};

    const P=[],N=[],I=[],CV=[];
    for(const mesh of gj.meshes||[])for(const pr of mesh.primitives||[]){
      const pos=acc(pr.attributes.POSITION),nrm=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL):null;
      const base=P.length/3,mat=(gj.materials||[])[pr.material]||{},
        c=(mat.pbrMetallicRoughness||{}).baseColorFactor||[.6,.6,.6,1],
        em=((mat.name||'').indexOf('glow')===0)?1.5:.02;
      for(let v=0;v<pos.length;v+=3){
        P.push(pos[v],pos[v+1],pos[v+2]);
        if(nrm)N.push(nrm[v],nrm[v+1],nrm[v+2]);else N.push(0,1,0);
        CV.push(c[0],c[1],c[2],em);
      }
      if(pr.indices!==undefined){const idx=acc(pr.indices);for(let j=0;j<idx.length;j++)I.push(base+idx[j]);}
      else for(let j=0;j<pos.length/3;j++)I.push(base+j);
    }
    if(!P.length||!I.length)throw new Error('empty fish mesh');

    /* Analyse the untouched source body first. Facial geometry is then added
       into the anchored head region, so eyes and mouth ride with the head but
       never get dragged by the tail wave. */
    const shape=analyseFishGeometry(P);
    const face=addFaceDetail(P,N,I,CV,shape,key);
    const mk=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);
      gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
    const frames=[];
    for(let f=0;f<FRAME_COUNT;f++){
      const d=deformFishFrame(P,N,shape,f/FRAME_COUNT);
      frames.push({pos:mk(d.pos),nrm:mk(d.nrm)});
    }
    const limb=new Float32Array(P.length/3);
    GLCRE[key]={ready:true,N:FRAME_COUNT,frames,col:mk(new Float32Array(CV)),
      limbB:mk(limb),idxB:mk(new Uint32Array(I),gl.ELEMENT_ARRAY_BUFFER),count:I.length,
      aquaTailAnimated:true,fishShape:shape,faceEnhanced:true,faceDetail:face};
    console.log('Aqua fish baked:',key,FRAME_COUNT,'frames','axis',shape.longAxis,
      'side',shape.sideAxis,'tailHigh',shape.tailHigh,'face',face);
    if(typeof updBuildTag==='function')updBuildTag();
    return GLCRE[key];
  }

  function analyseFishGeometry(P){
    const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<P.length;i+=3)for(let a=0;a<3;a++){const v=P[i+a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}
    const ex=mx.map((v,a)=>v-mn[a]),longAxis=ex.indexOf(Math.max(...ex));
    let sideAxis,upAxis;
    if(longAxis===1){sideAxis=0;upAxis=2;}
    else{const rem=[0,1,2].filter(a=>a!==longAxis);sideAxis=rem.includes(0)?0:rem[0];upAxis=rem[0]===sideAxis?rem[1]:rem[0];}
    const L=Math.max(ex[longAxis],1e-6),edge=.22;
    let loMin=Infinity,loMax=-Infinity,hiMin=Infinity,hiMax=-Infinity,loN=0,hiN=0;
    for(let i=0;i<P.length;i+=3){const u=(P[i+longAxis]-mn[longAxis])/L,s=P[i+sideAxis];
      if(u<edge){loMin=Math.min(loMin,s);loMax=Math.max(loMax,s);loN++;}
      if(u>1-edge){hiMin=Math.min(hiMin,s);hiMax=Math.max(hiMax,s);hiN++;}}
    const loSpread=loN?loMax-loMin:ex[sideAxis],hiSpread=hiN?hiMax-hiMin:ex[sideAxis];
    const tailHigh=hiSpread<=loSpread;
    return {mn,mx,extent:ex,longAxis,sideAxis,upAxis,length:L,tailHigh,
      horizontalFlexAxis:sideAxis===0,sideCentre:(mn[sideAxis]+mx[sideAxis])*.5,
      lowSpread:loSpread,highSpread:hiSpread};
  }

  function addFaceDetail(P,N,I,CV,shape,key){
    const la=shape.longAxis,sa=shape.sideAxis,ua=shape.upAxis,L=shape.length,
      inward=shape.tailHigh?1:-1,head=shape.tailHigh?shape.mn[la]:shape.mx[la],
      side0=(shape.mn[sa]+shape.mx[sa])*.5,up0=(shape.mn[ua]+shape.mx[ua])*.5,
      sideHalf=Math.max(L*.035,shape.extent[sa]*.39),
      eyeR=Math.max(L*.020,Math.min(L*.045,Math.max(shape.extent[sa],shape.extent[ua])*.105));
    const EYE=[.94,.91,.64,.18],PUP=[.012,.016,.015,.01],MOUTH=[.055,.018,.022,.015];

    const addEllipsoid=(centre,radii,col,seg=8,rings=5)=>{
      const base=P.length/3;
      for(let r=0;r<=rings;r++){
        const th=r/rings*Math.PI,st=Math.sin(th),ct=Math.cos(th);
        for(let s=0;s<=seg;s++){
          const ph=s/seg*TWO_PI,cp=Math.cos(ph),sp=Math.sin(ph);
          const v=[centre[0]+radii[0]*st*cp,centre[1]+radii[1]*ct,centre[2]+radii[2]*st*sp];
          const nn=[(v[0]-centre[0])/(radii[0]*radii[0]),(v[1]-centre[1])/(radii[1]*radii[1]),(v[2]-centre[2])/(radii[2]*radii[2])];
          const nl=Math.hypot(nn[0],nn[1],nn[2])||1;
          P.push(v[0],v[1],v[2]);N.push(nn[0]/nl,nn[1]/nl,nn[2]/nl);CV.push(col[0],col[1],col[2],col[3]);
        }
      }
      for(let r=0;r<rings;r++)for(let s=0;s<seg;s++){
        const a=base+r*(seg+1)+s,b=a+seg+1;
        I.push(a,b,a+1,a+1,b,b+1);
      }
    };
    const axisR=(along,side,up)=>{const q=[eyeR,eyeR,eyeR];q[la]=along;q[sa]=side;q[ua]=up;return q;};
    const centre=(along,side,up)=>{const q=[0,0,0];q[la]=along;q[sa]=side;q[ua]=up;return q;};

    /* Keep the eye's front-back thickness well inside BODY_START=.14 while
       preserving its full lateral size. This prevents pupils/eyes from being
       caught by the first body-flex vertices on compact species. */
    const eyeAlong=head+inward*L*.090,eyeUp=up0+shape.extent[ua]*.10;
    for(const sg of [-1,1]){
      const ec=centre(eyeAlong,side0+sg*sideHalf,eyeUp);
      addEllipsoid(ec,axisR(eyeR*.55,eyeR,eyeR*.92),EYE,8,5);
      const pc=ec.slice();pc[sa]+=sg*eyeR*.70;
      addEllipsoid(pc,axisR(eyeR*.38,eyeR*.44,eyeR*.48),PUP,7,4);
    }
    const mouthAlong=head+inward*L*.025,mouthUp=up0-shape.extent[ua]*.10;
    addEllipsoid(centre(mouthAlong,side0,mouthUp),axisR(eyeR*.24,eyeR*.72,eyeR*.28),MOUTH,8,4);
    return {key,eyes:2,pupils:2,mouth:1,eyeRadius:eyeR,headEnd:shape.tailHigh?'low':'high'};
  }

  function deformFishFrame(P,N,shape,cycle){
    const pos=new Float32Array(P.length),nrm=new Float32Array(N.length),
      la=shape.longAxis,sa=shape.sideAxis,L=shape.length,dir=shape.tailHigh?1:-1,
      phase=cycle*TWO_PI,side0=shape.sideCentre;
    for(let i=0;i<P.length;i+=3){
      const raw=(P[i+la]-shape.mn[la])/L,u=shape.tailHigh?raw:1-raw;
      const q=Math.max(0,Math.min(1,(u-BODY_START)/(1-BODY_START))),smooth=q*q*(3-2*q),
        ds=(q>0&&q<1)?6*q*(1-q)/(1-BODY_START):0,
        th=phase-SPATIAL_PHASE*u,st=Math.sin(th),ct=Math.cos(th),
        disp=L*TAIL_AMPLITUDE*smooth*st,
        slope=dir*TAIL_AMPLITUDE*(ds*st-SPATIAL_PHASE*smooth*ct),ang=Math.atan(slope),
        ca=Math.cos(ang),sn=Math.sin(ang),lat=P[i+sa]-side0;
      pos[i]=P[i];pos[i+1]=P[i+1];pos[i+2]=P[i+2];
      pos[i+la]=P[i+la]-lat*sn;pos[i+sa]=side0+lat*ca+disp;
      const nl=N[i+la],ns=N[i+sa];
      nrm[i]=N[i];nrm[i+1]=N[i+1];nrm[i+2]=N[i+2];
      nrm[i+la]=nl*ca-ns*sn;nrm[i+sa]=nl*sn+ns*ca;
      const ll=Math.hypot(nrm[i],nrm[i+1],nrm[i+2])||1;nrm[i]/=ll;nrm[i+1]/=ll;nrm[i+2]/=ll;
    }
    return {pos,nrm};
  }

  const previousFrame=glCreFrame;
  glCreFrame=function(a){
    const G=a&&a.aquaFish===true?GLCRE[a.gcre]:null;
    if(!G||!G.aquaTailAnimated||!G.ready)return previousFrame(a);
    const ph=a.__aquaTailPhase===undefined?(a.ph||0):a.__aquaTailPhase,
      fi=((Math.floor((((ph%TWO_PI)+TWO_PI)%TWO_PI)/TWO_PI*G.N)%G.N)+G.N)%G.N,F=G.frames[fi];
    return {pos:F.pos,nrm:F.nrm,col:G.col,limb:G.limbB,idx:G.idxB,count:G.count};
  };

  function installTailUpdate(){
    if(globalThis.__aquaFishV148UpdateInstalled)return;
    if(typeof updateActors!=='function'){
      if(typeof setTimeout==='function')setTimeout(installTailUpdate,0);
      return;
    }
    globalThis.__aquaFishV148UpdateInstalled=true;
    const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!=='aqua'||!Array.isArray(world.actors))return;
      let animated=0;
      for(const a of world.actors){if(!a||a.aquaFish!==true)continue;
        if(a.__aquaTailPhase===undefined)a.__aquaTailPhase=a.ph||0;
        const base=TAIL_SPEED[a.gcre]||7.0,variation=.92+.16*(Math.sin((a.ph||0)*2.37)*.5+.5);
        a.__aquaTailPhase=(a.__aquaTailPhase+dt*base*variation)%TWO_PI;animated++;}
      if(!world.__aquaFishV148||world.__aquaFishV148.animated!==animated){
        world.__aquaFishV148={version:VERSION,animated,framesPerSpecies:FRAME_COUNT,
          bodyStart:BODY_START,tailAmplitude:TAIL_AMPLITUDE,spatialPhase:SPATIAL_PHASE,
          speciesTailSpeed:Object.assign({},TAIL_SPEED),geometryBaked:true,headAnchored:true,
          horizontalTailPlane:true,faceEnhanced:true,deferredUpdateInstall:true};
        if(world.__aquaFishV147)world.__aquaFishV147.correctedByV148=true;
        console.log('Aqua Rift v148 body/tail animation:',world.__aquaFishV148);
      }
    };
  }

  globalThis.__aquaFishV148Spec={VERSION,FRAME_COUNT,BODY_START,TAIL_AMPLITUDE,SPATIAL_PHASE,
    fishKeys:[...FISH_KEYS],tailSpeed:Object.assign({},TAIL_SPEED),analyseFishGeometry,
    addFaceDetail,deformFishFrame};
  installTailUpdate();
})();
/* ===== END js/54-aqua-tail-animation-v148.js ===== */

/* ===== BEGIN js/55-aqua-uturn-continuity-v149.js ===== */
"use strict";

/* Aqua Rift v149 — U-turn local-scene continuity ---------------------------
   Fish are dynamic, but a rider who passes a nearby school and immediately
   U-turns should still see that same school rather than a completely changed
   local tableau. This Aqua-only layer snapshots nearby fish at the U-turn,
   holds their world positions very briefly while tails keep animating, then
   eases them back onto their existing v147 swim trajectories. No world rebuild,
   respawn or species change occurs. Verdant and non-Aqua worlds are untouched. */
(function(){
  const AQUA_ID='aqua',VERSION=149;
  const CAPTURE_RADIUS=135;
  const HOLD_SECONDS=1.15;
  const REJOIN_SECONDS=2.35;
  const TOTAL_SECONDS=HOLD_SECONDS+REJOIN_SECONDS;

  function smoothstep(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}

  function install(){
    if(globalThis.__aquaFishV149Installed)return;
    if(typeof updateActors!=='function'||typeof doUturn!=='function'||typeof segPoint!=='function'){
      if(typeof setTimeout==='function')setTimeout(install,0);
      return;
    }
    globalThis.__aquaFishV149Installed=true;

    const previousUTurn=doUturn;
    doUturn=function(){
      if(world&&state&&state.scene&&state.scene.id===AQUA_ID&&Array.isArray(world.actors)){
        const p=[0,0,0];
        segPoint(state.seg,state.s,state.playerX*state.dir,p);
        const r2=CAPTURE_RADIUS*CAPTURE_RADIUS;
        let captured=0;
        for(const a of world.actors){
          if(!a||a.aquaFish!==true)continue;
          const dx=(a.px||0)-p[0],dz=(a.pz||0)-p[2];
          if(dx*dx+dz*dz>r2)continue;
          a.__aquaV149Hold={x:a.px,y:a.py,z:a.pz,yaw:a.yaw||0,start:state.elapsed||0};
          captured++;
        }
        world.__aquaFishV149={version:VERSION,captured,lastUTurnAt:state.elapsed||0,
          captureRadius:CAPTURE_RADIUS,holdSeconds:HOLD_SECONDS,rejoinSeconds:REJOIN_SECONDS,
          uTurnLocalContinuity:true,worldRebuild:false,fishRespawn:false};
      }
      return previousUTurn();
    };

    const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!==AQUA_ID||!Array.isArray(world.actors))return;
      const t=state.elapsed||0;
      let held=0,rejoining=0;
      for(const a of world.actors){
        const h=a&&a.__aquaV149Hold;if(!h)continue;
        const age=Math.max(0,t-h.start);
        if(age>=TOTAL_SECONDS){delete a.__aquaV149Hold;continue;}
        const tx=a.px,ty=a.py,tz=a.pz,tyaw=a.yaw||0;
        if(age<=HOLD_SECONDS){
          a.px=h.x;a.py=h.y;a.pz=h.z;a.yaw=h.yaw;held++;
        }else{
          const q=smoothstep((age-HOLD_SECONDS)/REJOIN_SECONDS);
          a.px=h.x+(tx-h.x)*q;
          a.py=h.y+(ty-h.y)*q;
          a.pz=h.z+(tz-h.z)*q;
          /* angle-safe yaw blend */
          let d=tyaw-h.yaw;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
          a.yaw=h.yaw+d*q;rejoining++;
        }
      }
      if(world.__aquaFishV149){
        world.__aquaFishV149.held=held;
        world.__aquaFishV149.rejoining=rejoining;
      }
    };
  }

  globalThis.__aquaFishV149Spec={VERSION,CAPTURE_RADIUS,HOLD_SECONDS,REJOIN_SECONDS,TOTAL_SECONDS};
  install();
})();
/* ===== END js/55-aqua-uturn-continuity-v149.js ===== */

/* ===== BEGIN js/56-aqua-faces-reef-v150.js ===== */
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
/* ===== END js/56-aqua-faces-reef-v150.js ===== */

/* ===== BEGIN js/57-aqua-coral-jelly-v151.js ===== */
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
/* ===== END js/57-aqua-coral-jelly-v151.js ===== */

/* ===== BEGIN js/58-aqua-proper-jelly-reef-v152.js ===== */
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
/* ===== END js/58-aqua-proper-jelly-reef-v152.js ===== */

/* ===== BEGIN js/59-aqua-hq-coral-v153.js ===== */
"use strict";

/* Aqua Rift v153 — high-quality coral geometry --------------------------------
   v152 fixed visibility and jellyfish correctness, but its coral silhouettes were
   built mostly from spheres/cylinders. v153 keeps the same 2,800-placement reef
   budget and replaces the coral layer with recognizable lightweight reef models:

   - branching / staghorn colonies made from tapered 3-D branch tubes;
   - sea fans with visible radial lattice;
   - brain corals with ridged dome geometry;
   - layered wavy plate corals;
   - hollow tube sponges;
   - soft corals with curved tapered fingers.

   A hybrid LOD keeps performance controlled: 140 detailed hero groups sit in the
   closest band outside the glass; medium-detail models fill near/mid reef; far
   reef uses simplified silhouettes. Fish, v152 shared jellyfish, road, glass,
   tunnel logic and Verdant are not modified.
*/
(function(){
  const AQUA_ID='aqua',VERSION=153,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const HERO_EVERY=5,HERO_GROUPS=(REEF_STATIONS/HERO_EVERY)*2;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_BANDS=[[10.4,15.3],[13.0,24.0],[20.0,39.0],[35.0,78.0]];
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
    return rebuildAquaV153(w,sc);
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

  const sat=(x)=>Math.max(0,Math.min(1,x));
  const shade=(c,k)=>[sat(c[0]*k),sat(c[1]*k),sat(c[2]*k)];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

  function tube(m,a,b,r0,r1,seg,c0,c1,em){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1;
    const d=[dx/L,dy/L,dz/L];
    const ref=Math.abs(d[1])<.88?[0,1,0]:[1,0,0];
    let ux=d[1]*ref[2]-d[2]*ref[1],uy=d[2]*ref[0]-d[0]*ref[2],uz=d[0]*ref[1]-d[1]*ref[0];
    let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    const vx=d[1]*uz-d[2]*uy,vy=d[2]*ux-d[0]*uz,vz=d[0]*uy-d[1]*ux;
    const R=(p,r,ang)=>m.P(p[0]+(ux*Math.cos(ang)+vx*Math.sin(ang))*r,
                           p[1]+(uy*Math.cos(ang)+vy*Math.sin(ang))*r,
                           p[2]+(uz*Math.cos(ang)+vz*Math.sin(ang))*r);
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      m.quad(R(a,r0,a0),R(a,r0,a1),R(b,r1,a1),R(b,r1,a0),mix(c0,c1,.45),em);
    }
  }

  function tip(m,p,r,c,em,lod){
    m.sph(p[0],p[1],p[2],r,lod>1?7:5,lod>1?3:2,c,em,false,.92);
  }

  function rockBase(m,c,lod){
    const rc=mix(c,[.08,.22,.23],.72);
    m.sph(0,.10,0,.68,lod>0?7:5,lod>0?3:2,rc,.015,false,.34);
    if(lod>1)m.sph(.38,.08,-.18,.34,6,2,shade(rc,1.12),.02,false,.42);
  }

  function branching(m,c,lod,v){
    rockBase(m,c,lod);
    const dark=shade(c,.72),hi=mix(c,[1,1,1],.22),seg=lod>1?7:(lod?6:5);
    const trunk=[[0,.12,0],[.03,.46,.01],[-.04,.82,.02],[.02,1.18,0]];
    for(let i=0;i<trunk.length-1;i++)tube(m,trunk[i],trunk[i+1],.15-i*.018,.135-i*.020,seg,dark,c,.07);
    const B=[
      [[.01,.42,0],[-.48,.70,.08],[-.64,.98,.13]],
      [[-.02,.58,.01],[.47,.82,-.05],[.62,1.10,-.12]],
      [[-.02,.79,.02],[-.35,1.03,-.16],[-.43,1.28,-.22]],
      [[.01,.91,0],[.34,1.13,.18],[.39,1.38,.26]]
    ];
    if(v>.5)B.push([[.02,.64,0],[.12,.91,.38],[.16,1.17,.50]]);
    const count=lod===0?2:(lod===1?4:B.length);
    for(let q=0;q<count;q++){
      const p=B[q];
      tube(m,p[0],p[1],.105,.080,seg,dark,c,.075);
      tube(m,p[1],p[2],.080,.045,seg,c,hi,.09);
      if(lod>0)tip(m,p[2],.075,hi,.12,lod);
      if(lod>1){
        const s=q&1?-1:1,mid=p[1],end=[p[2][0]+s*.22,p[2][1]-.01,p[2][2]+(q%2?.14:-.12)];
        tube(m,mid,end,.060,.032,5,c,hi,.10); tip(m,end,.055,hi,.13,lod);
      }
    }
    if(lod>0)tip(m,trunk[3],.085,hi,.12,lod);
  }

  function seaFan(m,c,lod,v){
    rockBase(m,c,lod);
    const edge=shade(c,.70),hi=mix(c,[1,.92,1],.18),seg=lod>1?6:5;
    const n=lod>1?9:(lod?7:5),top=[];
    for(let i=0;i<n;i++){
      const u=n===1?0:i/(n-1),x=(u*2-1)*.78,y=.35+Math.sqrt(Math.max(0,1-(x/.86)*(x/.86)))*1.05;
      const z=.05*Math.sin(i*1.7+v*TWO_PI);top.push([x,y,z]);
      tube(m,[0,.16,0],[x*.45,y*.62,z],[.055,.055][0],.035,seg,edge,c,.085);
      tube(m,[x*.45,y*.62,z],[x,y,z],.035,.025,seg,c,hi,.11);
    }
    for(let i=0;i<n-1;i++)tube(m,top[i],top[i+1],.026,.026,5,c,hi,.10);
    if(lod>0){
      for(const f of [.46,.68,.84]){
        for(let i=0;i<n-1;i++){
          const a=top[i],b=top[i+1],pa=[a[0]*f,.18+(a[1]-.18)*f,a[2]],pb=[b[0]*f,.18+(b[1]-.18)*f,b[2]];
          tube(m,pa,pb,.014,.014,4,shade(c,.92),hi,.075);
        }
      }
    }
  }

  function brain(m,c,lod,v){
    rockBase(m,c,lod);
    const sectors=lod>1?16:(lod?12:9),rings=lod>1?6:(lod?5:3),R=.78;
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI;
      const rr=R*rho*(1+.035*Math.sin(5*a+v*TWO_PI));
      const ridge=.055*Math.sin(a*6+rho*16+v*4);
      return m.P(Math.cos(a)*rr,.18+.78*Math.sqrt(Math.max(0,1-rho*rho))+ridge,Math.sin(a)*rr);
    };
    const center=m.P(0,.98,0),hi=mix(c,[1,1,.92],.22),lo=shade(c,.72);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),s%2?c:hi,.09);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const wave=Math.sin((s/sectors*TWO_PI)*6+(r/rings)*16+v*4),cc=wave>.15?hi:(wave<-.35?lo:c);
      m.quad(V(r,s),V(r+1,s),V(r+1,s+1),V(r,s+1),cc,.075);
    }
  }

  function wavyPlate(m,c,lod,y,r,phase){
    const sectors=lod>1?16:(lod?12:9),rings=lod>1?3:2,hi=mix(c,[1,1,1],.18),lo=shade(c,.75);
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI,rr=r*rho;
      const yy=y+.055*Math.sin(a*3+phase)*(rho*rho)+.06*(1-rho);
      return m.P(Math.cos(a)*rr,yy,Math.sin(a)*rr);
    };
    const center=m.P(0,y+.06,0);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),hi,.08);
    for(let ri=1;ri<rings;ri++)for(let s=0;s<sectors;s++)m.quad(V(ri,s),V(ri+1,s),V(ri+1,s+1),V(ri,s+1),ri&1?c:hi,.08);
    for(let s=0;s<sectors;s++){
      const a=V(rings,s),b=V(rings,s+1),a2=[a[0],a[1]-.045*m.tf.k,a[2]],b2=[b[0],b[1]-.045*m.tf.k,b[2]];
      m.quad(a,b,b2,a2,lo,.04);
    }
  }

  function plate(m,c,lod,v){
    rockBase(m,c,lod);
    tube(m,[0,.12,0],[0,.48,0],.13,.105,lod>0?7:5,shade(c,.72),c,.06);
    wavyPlate(m,c,lod,.48,.72,v*TWO_PI);
    if(lod>0){tube(m,[.06,.38,0],[.18,.76,.03],.08,.065,6,shade(c,.74),c,.07);wavyPlate(m,shade(c,1.05),lod,.78,.53,v*TWO_PI+1.5);}
    if(lod>1){tube(m,[-.08,.28,.02],[-.28,.64,-.08],.07,.055,6,shade(c,.72),c,.07);wavyPlate(m,mix(c,[1,.8,.9],.14),lod,.66,.40,v*TWO_PI+3.0);}
  }

  function hollowSponge(m,x,z,h,r,c,lod,lean){
    const seg=lod>1?10:(lod?8:6),top=[x+lean,h,z],base=[x,.12,z],dark=shade(c,.35),hi=mix(c,[1,1,.92],.18);
    tube(m,base,top,r*1.02,r*.78,seg,shade(c,.75),c,.07);
    const rin=r*.48;
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      const O0=m.P(top[0]+Math.cos(a0)*r*.78,top[1],top[2]+Math.sin(a0)*r*.78);
      const O1=m.P(top[0]+Math.cos(a1)*r*.78,top[1],top[2]+Math.sin(a1)*r*.78);
      const I0=m.P(top[0]+Math.cos(a0)*rin,top[1]-.045,top[2]+Math.sin(a0)*rin);
      const I1=m.P(top[0]+Math.cos(a1)*rin,top[1]-.045,top[2]+Math.sin(a1)*rin);
      m.quad(O0,O1,I1,I0,hi,.11);
    }
    m.disc(top[0],top[1]-.055,top[2],rin,seg,dark,.01);
  }

  function sponge(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?6:(lod?4:3);
    const P=[[-.36,-.12,.74,.22],[.02,.06,1.02,.25],[.37,-.04,.64,.18],[-.15,.31,.60,.16],[.30,.29,.88,.17],[-.46,.25,.52,.14]];
    for(let i=0;i<n;i++){const p=P[i],cc=i%2?c:mix(c,[1,.72,.35],.12);hollowSponge(m,p[0],p[1],p[2],p[3],cc,lod,(i%3-1)*.06);}
  }

  function soft(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?8:(lod?6:4),seg=lod>1?6:5,hi=mix(c,[1,.86,1],.20),dark=shade(c,.68);
    for(let i=0;i<n;i++){
      const a=(i/n)*TWO_PI+v*.7,rad=.18+(i%3)*.08;
      const p0=[Math.cos(a)*rad,.13,Math.sin(a)*rad];
      const p1=[Math.cos(a)*(.28+(i%2)*.08),.48+(i%3)*.05,Math.sin(a)*(.28+(i%2)*.08)];
      const bend=a+(i&1?.32:-.28),p2=[Math.cos(bend)*(.42+(i%3)*.05),.88+(i%4)*.07,Math.sin(bend)*(.42+(i%3)*.05)];
      tube(m,p0,p1,.105,.073,seg,dark,c,.07);tube(m,p1,p2,.073,.035,seg,c,hi,.10);
      if(lod>0)tip(m,p2,.058,hi,.13,lod);
      if(lod>1&&i<5){
        const p3=[p2[0]+Math.cos(a+1.57)*.18,p2[1]-.02,p2[2]+Math.sin(a+1.57)*.18];
        tube(m,p1,p3,.050,.028,5,c,hi,.10);tip(m,p3,.047,hi,.13,lod);
      }
    }
  }

  const BUILDERS=[branching,seaFan,brain,plate,sponge,soft];

  function rebuildAquaV153(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+153153),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

    /* Preserve the established glass structural ribs exactly; only w.props reef
       geometry is rebuilt. Road, glass/water meshes and actor systems are separate. */
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

    const cols=COLOUR_BAG.map(hx);
    let nearGroups=0,midGroups=0,farGroups=0,heroGroups=0,mediumGroups=0,simpleGroups=0;
    const typeCounts={branching:0,fan:0,brain:0,plate:0,sponge:0,soft:0},names=Object.keys(typeCounts);

    /* Same exact 2,800 placement budget as v152. The nearest band gets a
       predictable 140 hero models (70 per side). Far reef is deliberately
       simpler, so the extra close-up quality is paid for by cheaper distance LOD. */
    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      for(const side of [-1,1])for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.35,band[0]),hi=Math.max(lo+2.5,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.08:.74)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          hero=k===0&&st%HERO_EVERY===(side>0?1:3),
          lod=hero?2:((k===0||k===1||(k===2&&st%3===0))?1:0),
          base=[1.08,1.34,1.58,1.82][k],spread=[.62,.90,1.04,1.24][k],
          s=(base+rnd()*spread)*(hero?1.18:1),
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],
          yaw=rnd()*TWO_PI,v=rnd(),kind=(st*3+k*5+(side>0?2:0))%BUILDERS.length;
        reef.setTF(p.x,y,p.z,yaw,s);
        BUILDERS[kind](reef,c,lod,v);
        typeCounts[names[kind]]++;
        if(hero)heroGroups++;
        if(lod===2){}else if(lod===1)mediumGroups++;else simpleGroups++;
        if(k===0)nearGroups++;else if(k<3)midGroups++;else farGroups++;
      }
    }
    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);

    const fishCount=(w.actors||[]).filter(a=>a&&a.aquaFish===true).length;
    const jelly=(w.actors||[]).filter(a=>a&&a.aquaJellyV152===true);
    w.__aquaV153={version:VERSION,hqCoral:true,coralGroups:CORAL_GROUPS,reefStations:REEF_STATIONS,
      groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,heroGroups,
      heroTarget:HERO_GROUPS,mediumGroups,simpleGroups,typeCounts,
      coralTypes:['branching','fan','brain','plate','sponge','soft'],
      hybridLOD:true,recognizableGeometry:true,closeHeroCorals:true,
      proceduralSphereClustersReplaced:true,triangles:Math.floor(reef.idx.length/3),
      jellyPreserved:jelly.length,properProjectJellyPreserved:jelly.length===60,
      fishPreserved:fishCount,actorsUnchanged:true,roadUnchanged:true,glassUnchanged:true,
      verdantUntouched:true};
    console.log('Aqua Rift v153 HQ coral geometry:',w.__aquaV153);
    return w;
  }
})();
/* ===== END js/59-aqua-hq-coral-v153.js ===== */

/* ===== BEGIN js/60-aqua-hero-coral-v154.js ===== */
"use strict";

/* Aqua Rift v154 — hero coral clusters and reef pedestals --------------------
   Visual feedback on v153: silhouettes improved, but the reef still read as
   scattered low-poly props rather than a rich coral wall. v154 keeps the exact
   2,800 placement budget and the preserved Aqua systems, but changes how that
   budget is spent:

   - many more close hero groups (280 total, not 140);
   - each hero placement becomes a true coral cluster, often 3–4 overlapping
     coral forms instead of one isolated object;
   - every group grows from a darker reef pedestal / ledge so coral does not
     appear to float as a tiny object on a flat floor;
   - the nearest layers are pulled visually closer to the glass and enlarged;
   - medium reef keeps richer silhouettes, while only the far band stays simple.

   Fish, v152 shared jellyfish, road, water, glass, tunnel logic and Verdant
   remain untouched.
*/
(function(){
  const AQUA_ID='aqua',VERSION=154,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const HERO_PRIMARY_EVERY=5,HERO_SECONDARY_EVERY=5,HERO_GROUPS=280;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_BANDS=[[9.9,13.8],[11.8,20.5],[18.5,33.0],[31.0,72.0]];
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
    return rebuildAquaV154(w,sc);
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

  const sat=x=>Math.max(0,Math.min(1,x));
  const shade=(c,k)=>[sat(c[0]*k),sat(c[1]*k),sat(c[2]*k)];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

  function tube(m,a,b,r0,r1,seg,c0,c1,em){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1;
    const d=[dx/L,dy/L,dz/L],ref=Math.abs(d[1])<.88?[0,1,0]:[1,0,0];
    let ux=d[1]*ref[2]-d[2]*ref[1],uy=d[2]*ref[0]-d[0]*ref[2],uz=d[0]*ref[1]-d[1]*ref[0];
    let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    const vx=d[1]*uz-d[2]*uy,vy=d[2]*ux-d[0]*uz,vz=d[0]*uy-d[1]*ux;
    const R=(p,r,ang)=>m.P(p[0]+(ux*Math.cos(ang)+vx*Math.sin(ang))*r,
                           p[1]+(uy*Math.cos(ang)+vy*Math.sin(ang))*r,
                           p[2]+(uz*Math.cos(ang)+vz*Math.sin(ang))*r);
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      m.quad(R(a,r0,a0),R(a,r0,a1),R(b,r1,a1),R(b,r1,a0),mix(c0,c1,.45),em);
    }
  }

  function tip(m,p,r,c,em,lod){ m.sph(p[0],p[1],p[2],r,lod>1?8:6,lod>1?4:3,c,em,false,.92); }

  function rockBase(m,c,lod){
    const rc=mix(c,[.08,.22,.23],.72);
    m.sph(0,.10,0,.70,lod>0?8:6,lod>0?4:2,rc,.015,false,.34);
    if(lod>0){
      m.sph(.34,.06,-.14,.42,7,3,shade(rc,1.08),.02,false,.42);
      m.sph(-.28,.05,.18,.33,6,3,shade(rc,.96),.015,false,.36);
    }
  }

  function pedestal(m,c,lod,hero){
    const base=mix(c,[.05,.18,.20],.82),hi=shade(base,1.12),rings=hero?3:(lod>0?2:1);
    m.sph(0,.06,0,hero?1.18:(lod>0?.95:.80),hero?10:8,hero?4:3,base,.012,false,.28);
    m.sph(.40,.03,-.22,hero?.56:.42,8,3,shade(base,.92),.01,false,.24);
    if(rings>1){
      const seg=hero?16:12,rad=hero?1.12:.88,th=hero?.18:.14;
      m.cyl(0,.10,0,rad,th,seg,shade(base,.82),.01);
      if(hero)m.cyl(0,.26,0,rad*.72,.14,14,hi,.012);
    }
    if(hero){
      m.box(0,.02,.78,1.48,.10,.38,shade(base,.88),.008);
      m.box(-.72,.01,-.20,.64,.08,.44,shade(base,.84),.008);
      m.box(.74,.01,.16,.70,.08,.46,shade(base,.90),.008);
    }
  }

  function branching(m,c,lod,v){
    rockBase(m,c,lod);
    const dark=shade(c,.70),hi=mix(c,[1,1,1],.24),seg=lod>1?8:(lod?7:5);
    const trunk=[[0,.12,0],[.03,.52,.01],[-.04,.92,.02],[.02,1.34,0]];
    for(let i=0;i<trunk.length-1;i++)tube(m,trunk[i],trunk[i+1],.17-i*.020,.145-i*.021,seg,dark,c,.07);
    const B=[
      [[.01,.46,0],[-.56,.80,.08],[-.78,1.15,.14]],
      [[-.02,.62,.01],[.53,.92,-.05],[.76,1.28,-.13]],
      [[-.02,.88,.02],[-.44,1.17,-.18],[-.58,1.48,-.28]],
      [[.01,1.00,0],[.42,1.28,.20],[.56,1.60,.30]],
      [[.02,.70,0],[.12,1.00,.48],[.18,1.36,.68]],
      [[-.01,.56,-.02],[-.08,.90,-.44],[-.16,1.18,-.62]]
    ];
    const count=lod===0?3:(lod===1?5:B.length);
    for(let q=0;q<count;q++){
      const p=B[q];
      tube(m,p[0],p[1],.115,.088,seg,dark,c,.078);
      tube(m,p[1],p[2],.088,.048,seg,c,hi,.096);
      if(lod>0)tip(m,p[2],.078,hi,.12,lod);
      if(lod>1){
        const s=q&1?-1:1,mid=p[1],end=[p[2][0]+s*.24,p[2][1]-.02,p[2][2]+(q%2?.18:-.14)];
        tube(m,mid,end,.064,.034,6,c,hi,.10); tip(m,end,.058,hi,.13,lod);
      }
    }
    if(lod>0)tip(m,trunk[3],.09,hi,.12,lod);
  }

  function seaFan(m,c,lod,v){
    rockBase(m,c,lod);
    const edge=shade(c,.70),hi=mix(c,[1,.92,1],.18),seg=lod>1?7:5;
    const n=lod>1?11:(lod?8:5),top=[];
    for(let i=0;i<n;i++){
      const u=n===1?0:i/(n-1),x=(u*2-1)*.92,y=.34+Math.sqrt(Math.max(0,1-(x/.98)*(x/.98)))*1.22;
      const z=.06*Math.sin(i*1.7+v*TWO_PI);top.push([x,y,z]);
      tube(m,[0,.16,0],[x*.44,y*.60,z],[.06,.06][0],.037,seg,edge,c,.088);
      tube(m,[x*.44,y*.60,z],[x,y,z],.037,.026,seg,c,hi,.11);
    }
    for(let i=0;i<n-1;i++)tube(m,top[i],top[i+1],.027,.027,5,c,hi,.10);
    if(lod>0){
      for(const f of [.34,.52,.70,.86]) for(let i=0;i<n-1;i++){
        const a=top[i],b=top[i+1],pa=[a[0]*f,.18+(a[1]-.18)*f,a[2]],pb=[b[0]*f,.18+(b[1]-.18)*f,b[2]];
        tube(m,pa,pb,.014,.014,4,shade(c,.94),hi,.075);
      }
    }
  }

  function brain(m,c,lod,v){
    rockBase(m,c,lod);
    const sectors=lod>1?18:(lod?14:10),rings=lod>1?7:(lod?5:3),R=.88;
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI,rr=R*rho*(1+.04*Math.sin(5*a+v*TWO_PI));
      const ridge=.060*Math.sin(a*6+rho*17+v*4);return m.P(Math.cos(a)*rr,.18+.88*Math.sqrt(Math.max(0,1-rho*rho))+ridge,Math.sin(a)*rr);
    };
    const center=m.P(0,1.08,0),hi=mix(c,[1,1,.92],.22),lo=shade(c,.70);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),s%2?c:hi,.09);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const wave=Math.sin((s/sectors*TWO_PI)*6+(r/rings)*16+v*4),cc=wave>.15?hi:(wave<-.35?lo:c);
      m.quad(V(r,s),V(r+1,s),V(r+1,s+1),V(r,s+1),cc,.075);
    }
  }

  function wavyPlate(m,c,lod,y,r,phase){
    const sectors=lod>1?18:(lod?13:9),rings=lod>1?4:2,hi=mix(c,[1,1,1],.18),lo=shade(c,.75);
    const V=(ri,si)=>{const rho=ri/rings,a=si/sectors*TWO_PI,rr=r*rho;const yy=y+.065*Math.sin(a*3+phase)*(rho*rho)+.07*(1-rho);return m.P(Math.cos(a)*rr,yy,Math.sin(a)*rr);};
    const center=m.P(0,y+.07,0);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),hi,.08);
    for(let ri=1;ri<rings;ri++)for(let s=0;s<sectors;s++)m.quad(V(ri,s),V(ri+1,s),V(ri+1,s+1),V(ri,s+1),ri&1?c:hi,.08);
    for(let s=0;s<sectors;s++){
      const a=V(rings,s),b=V(rings,s+1),a2=[a[0],a[1]-.055*m.tf.k,a[2]],b2=[b[0],b[1]-.055*m.tf.k,b[2]];
      m.quad(a,b,b2,a2,lo,.04);
    }
  }

  function plate(m,c,lod,v){
    rockBase(m,c,lod);
    tube(m,[0,.12,0],[0,.54,0],.15,.115,lod>0?8:5,shade(c,.72),c,.06);
    wavyPlate(m,c,lod,.54,.86,v*TWO_PI);
    if(lod>0){ tube(m,[.06,.42,0],[.20,.86,.04],.09,.070,6,shade(c,.74),c,.07); wavyPlate(m,shade(c,1.05),lod,.90,.64,v*TWO_PI+1.5); }
    if(lod>1){ tube(m,[-.10,.30,.02],[-.34,.76,-.10],.08,.060,6,shade(c,.72),c,.07); wavyPlate(m,mix(c,[1,.8,.9],.14),lod,.76,.49,v*TWO_PI+3.0); }
  }

  function hollowSponge(m,x,z,h,r,c,lod,lean){
    const seg=lod>1?10:(lod?8:6),top=[x+lean,h,z],base=[x,.12,z],dark=shade(c,.35),hi=mix(c,[1,1,.92],.18);
    tube(m,base,top,r*1.02,r*.78,seg,shade(c,.75),c,.07);
    const rin=r*.48;
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      const O0=m.P(top[0]+Math.cos(a0)*r*.78,top[1],top[2]+Math.sin(a0)*r*.78);
      const O1=m.P(top[0]+Math.cos(a1)*r*.78,top[1],top[2]+Math.sin(a1)*r*.78);
      const I0=m.P(top[0]+Math.cos(a0)*rin,top[1]-.045,top[2]+Math.sin(a0)*rin);
      const I1=m.P(top[0]+Math.cos(a1)*rin,top[1]-.045,top[2]+Math.sin(a1)*rin);
      m.quad(O0,O1,I1,I0,hi,.11);
    }
    m.disc(top[0],top[1]-.055,top[2],rin,seg,dark,.01);
  }

  function sponge(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?7:(lod?5:3);
    const P=[[-.42,-.14,.88,.26],[.03,.08,1.14,.29],[.43,-.05,.74,.21],[-.18,.35,.70,.18],[.34,.32,.98,.18],[-.54,.30,.58,.16],[.58,.10,.66,.18]];
    for(let i=0;i<n;i++){ const p=P[i],cc=i%2?c:mix(c,[1,.72,.35],.12); hollowSponge(m,p[0],p[1],p[2],p[3],cc,lod,(i%3-1)*.07); }
  }

  function soft(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?9:(lod?6:4),seg=lod>1?7:5,hi=mix(c,[1,.86,1],.20),dark=shade(c,.68);
    for(let i=0;i<n;i++){
      const a=(i/n)*TWO_PI+v*.7,rad=.20+(i%3)*.09;
      const p0=[Math.cos(a)*rad,.13,Math.sin(a)*rad];
      const p1=[Math.cos(a)*(.30+(i%2)*.09),.52+(i%3)*.05,Math.sin(a)*(.30+(i%2)*.09)];
      const bend=a+(i&1?.34:-.30),p2=[Math.cos(bend)*(.48+(i%3)*.05),.98+(i%4)*.08,Math.sin(bend)*(.48+(i%3)*.05)];
      tube(m,p0,p1,.115,.080,seg,dark,c,.07);tube(m,p1,p2,.080,.038,seg,c,hi,.10);
      if(lod>0)tip(m,p2,.060,hi,.13,lod);
      if(lod>1&&i<6){ const p3=[p2[0]+Math.cos(a+1.57)*.20,p2[1]-.02,p2[2]+Math.sin(a+1.57)*.20]; tube(m,p1,p3,.052,.028,5,c,hi,.10); tip(m,p3,.048,hi,.13,lod); }
    }
  }

  const BUILDERS=[branching,seaFan,brain,plate,sponge,soft];
  const TYPE_NAMES=['branching','fan','brain','plate','sponge','soft'];

  function clusterFor(m,c,lod,v,kind,heroLevel,rnd){
    pedestal(m,c,lod,heroLevel>0);
    BUILDERS[kind](m,c,Math.max(lod,heroLevel>1?2:lod),v);

    const tf={x:m.tf.x,y:m.tf.y,z:m.tf.z,k:m.tf.k,c:m.tf.c,s:m.tf.s};
    const rootYaw=Math.atan2(tf.s||0,(tf.c===undefined?1:tf.c));
    const placeLocal=(dx,dz,scale,yaw,fn,col,plod,pv)=>{
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
      const P=m.P(dx,0,dz);
      m.setTF(P[0],P[1],P[2],yaw,tf.k*scale);
      fn(m,col,plod,pv);
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
    };

    if(heroLevel===2){
      placeLocal(-.54,-.18,.68,rnd()*TWO_PI,BUILDERS[(kind+1)%BUILDERS.length],mix(c,[1,.86,.92],.14),1,v*.73+.11);
      placeLocal(.48,.22,.62,rnd()*TWO_PI,BUILDERS[(kind+3)%BUILDERS.length],mix(c,[.92,1,.98],.10),1,v*.61+.37);
      placeLocal(.06,-.54,.52,rnd()*TWO_PI,BUILDERS[(kind+5)%BUILDERS.length],shade(c,1.04),1,v*.49+.58);
    }else if(heroLevel===1){
      placeLocal(-.34,.20,.52,rnd()*TWO_PI,BUILDERS[(kind+2)%BUILDERS.length],mix(c,[1,.95,.95],.08),1,v*.68+.19);
      placeLocal(.30,-.25,.43,rnd()*TWO_PI,BUILDERS[(kind+4)%BUILDERS.length],shade(c,1.02),0,v*.41+.43);
    }
  }

  function rebuildAquaV154(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+154154),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

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

    const cols=COLOUR_BAG.map(hx);
    let nearGroups=0,midGroups=0,farGroups=0,heroGroups=0,mediumGroups=0,simpleGroups=0,heroClusters=0;
    let primaryHeroes=0,secondaryHeroes=0,pedestalGroups=0;
    const typeCounts={branching:0,fan:0,brain:0,plate:0,sponge:0,soft:0};

    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      for(const side of [-1,1]) for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.10,band[0]),hi=Math.max(lo+2.4,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.15:.78)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          heroPrimary=(k===0&&st%HERO_PRIMARY_EVERY===(side>0?1:3)),
          heroSecondary=(k===1&&st%HERO_SECONDARY_EVERY===(side>0?0:2)),
          heroLevel=heroPrimary?2:(heroSecondary?1:0),
          lod=heroLevel===2?2:(heroLevel===1?1:((k<=1|| (k===2&&st%3!==1))?1:0)),
          base=[1.26,1.12,1.34,1.60][k],spread=[.92,.74,.96,1.08][k],
          s=(base+rnd()*spread)*(heroLevel===2?1.36:(heroLevel===1?1.18:1)),
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],
          yaw=rnd()*TWO_PI,v=rnd(),kind=(st*3+k*5+(side>0?2:0))%BUILDERS.length;
        reef.setTF(p.x,y,p.z,yaw,s);
        clusterFor(reef,c,lod,v,kind,heroLevel,rnd);
        typeCounts[TYPE_NAMES[kind]]++;
        pedestalGroups++;
        if(heroPrimary){heroGroups++;heroClusters++;primaryHeroes++;}
        else if(heroSecondary){heroGroups++;heroClusters++;secondaryHeroes++;}
        else if(lod===1)mediumGroups++;else simpleGroups++;
        if(k===0)nearGroups++; else if(k<3)midGroups++; else farGroups++;
      }
    }

    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);

    const fishCount=(w.actors||[]).filter(a=>a&&a.aquaFish===true).length;
    const jelly=(w.actors||[]).filter(a=>a&&a.aquaJellyV152===true);
    w.__aquaV154={version:VERSION,hqCoral:true,heroClusters:true,reefPedestals:true,
      clusteredComposition:true,closeWallFeeling:true,coralGroups:CORAL_GROUPS,
      reefStations:REEF_STATIONS,groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,
      heroGroups,heroTarget:HERO_GROUPS,primaryHeroes,secondaryHeroes,heroClusterCount:heroClusters,
      mediumGroups,simpleGroups,pedestalGroups,typeCounts,
      coralTypes:['branching','fan','brain','plate','sponge','soft'],
      hybridLOD:true,recognizableGeometry:true,closeHeroCorals:true,
      proceduralSphereClustersReplaced:true,triangles:Math.floor(reef.idx.length/3),
      jellyPreserved:jelly.length,properProjectJellyPreserved:jelly.length===60,
      fishPreserved:fishCount,actorsUnchanged:true,roadUnchanged:true,glassUnchanged:true,
      verdantUntouched:true};
    console.log('Aqua Rift v154 hero coral clusters:',w.__aquaV154);
    return w;
  }
})();
/* ===== END js/60-aqua-hero-coral-v154.js ===== */

/* ===== BEGIN js/61-aqua-coral-colonies-v155.js ===== */
"use strict";

/* Aqua Rift v155 — reef colonies and organic hero mounds ---------------------
   User feedback on v154: coral silhouettes are improved, but close reef still
   reads as isolated props on podium-like black bases. v155 keeps the approved
   Aqua systems and exact 2,800 placement budget, but rebuilds the reef again so
   the close bands read as fuller coral colonies:

   - replace podium-like pedestals with asymmetric reef mounds/ledges;
   - increase close-band continuity using broader hero colonies and local rubble;
   - enrich each hero colony with 4–6 overlapping coral pieces plus scatter;
   - keep procedural coral families for medium/far LOD to protect performance.

   Fish, shared v152 jellyfish, road, glass/water tunnel and Verdant remain
   untouched. This layer only replaces the coral props mesh.
*/
(function(){
  const AQUA_ID='aqua',VERSION=155,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const HERO_PRIMARY_EVERY=5,HERO_SECONDARY_EVERY=5,HERO_GROUPS=280;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_BANDS=[[9.8,13.4],[11.4,20.2],[18.4,33.0],[31.0,72.0]];
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
    return rebuildAquaV155(w,sc);
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

  const sat=x=>Math.max(0,Math.min(1,x));
  const shade=(c,k)=>[sat(c[0]*k),sat(c[1]*k),sat(c[2]*k)];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

  function tube(m,a,b,r0,r1,seg,c0,c1,em){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1;
    const d=[dx/L,dy/L,dz/L],ref=Math.abs(d[1])<.88?[0,1,0]:[1,0,0];
    let ux=d[1]*ref[2]-d[2]*ref[1],uy=d[2]*ref[0]-d[0]*ref[2],uz=d[0]*ref[1]-d[1]*ref[0];
    let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    const vx=d[1]*uz-d[2]*uy,vy=d[2]*ux-d[0]*uz,vz=d[0]*uy-d[1]*ux;
    const R=(p,r,ang)=>m.P(p[0]+(ux*Math.cos(ang)+vx*Math.sin(ang))*r,
                           p[1]+(uy*Math.cos(ang)+vy*Math.sin(ang))*r,
                           p[2]+(uz*Math.cos(ang)+vz*Math.sin(ang))*r);
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      m.quad(R(a,r0,a0),R(a,r0,a1),R(b,r1,a1),R(b,r1,a0),mix(c0,c1,.45),em);
    }
  }

  function tip(m,p,r,c,em,lod){m.sph(p[0],p[1],p[2],r,lod>1?8:6,lod>1?4:3,c,em,false,.92);}

  function rockBase(m,c,lod){
    const rc=mix(c,[.08,.22,.23],.72);
    m.sph(0,.10,0,.70,lod>0?8:6,lod>0?4:2,rc,.015,false,.34);
    if(lod>0){
      m.sph(.34,.06,-.14,.42,7,3,shade(rc,1.08),.02,false,.42);
      m.sph(-.28,.05,.18,.33,6,3,shade(rc,.96),.015,false,.36);
    }
  }

  function rubblePebble(m,x,y,z,r,col){m.sph(x,y,z,r,5,2,col,.008,false,.32);}

  function moundBase(m,c,lod,heroLevel,rnd){
    const dark=mix(c,[.10,.16,.18],.88),mid=shade(dark,1.08),hi=shade(dark,1.18);
    const major=heroLevel===2?7:(heroLevel===1?5:(lod>0?4:2));
    const radius=heroLevel===2?1.85:(heroLevel===1?1.40:(lod>0?1.06:.88));
    const lift=heroLevel===2?.22:(heroLevel===1?.15:.08);
    for(let i=0;i<major;i++){
      const a=(i/major)*TWO_PI+rnd()*.55,rr=radius*(.16+rnd()*.52),x=Math.cos(a)*rr,z=Math.sin(a)*rr;
      const sx=(heroLevel===2?.70:.54)*(.74+rnd()*.64),sy=(heroLevel===2?.28:.22)*(.78+rnd()*.58),sz=(heroLevel===2?.66:.50)*(.78+rnd()*.66);
      const col=i%3===0?hi:(i%2?mid:dark);
      /* Keep the caller's route-relative yaw/scale. Individual mound blocks stay
         intentionally irregular through position/size variation rather than
         resetting MeshB's transform (which would flatten hero scaling). */
      m.box(x,sy*.28,z,sx,sy,sz,col,.010);
      m.sph(x,lift+rnd()*.08,z,heroLevel===2?.56:(heroLevel===1?.44:.34),lod>0?8:6,lod>0?3:2,col,.014,false,.42);
    }
    m.sph(0,lift*.45,0,heroLevel===2?1.36:(heroLevel===1?1.08:(lod>0?.90:.76)),heroLevel===2?10:8,heroLevel===2?4:3,dark,.012,false,.30);
    if(heroLevel>0){
      const plateCol=shade(dark,.94);
      m.box(0,.04,.74,heroLevel===2?1.95:1.32,.11,heroLevel===2?.46:.34,plateCol,.008);
      m.box(-.72,.02,-.16,heroLevel===2?.98:.72,.09,heroLevel===2?.54:.42,shade(dark,.88),.008);
      if(heroLevel===2)m.box(.76,.03,.18,1.08,.09,.56,shade(dark,.92),.008);
    }
    const pebs=heroLevel===2?12:(heroLevel===1?8:(lod>0?5:2));
    for(let i=0;i<pebs;i++){
      const a=rnd()*TWO_PI,r=(heroLevel===2?1.85:(heroLevel===1?1.45:1.0))*(.28+rnd()*.50);
      rubblePebble(m,Math.cos(a)*r,.06+rnd()*.16,Math.sin(a)*r,.08+rnd()*.16,i%2?mid:shade(dark,.84));
    }
  }

  function branching(m,c,lod,v){
    rockBase(m,c,lod);
    const dark=shade(c,.70),hi=mix(c,[1,1,1],.24),seg=lod>1?8:(lod?7:5);
    const trunk=[[0,.12,0],[.03,.52,.01],[-.04,.92,.02],[.02,1.34,0]];
    for(let i=0;i<trunk.length-1;i++)tube(m,trunk[i],trunk[i+1],.17-i*.020,.145-i*.021,seg,dark,c,.07);
    const B=[
      [[.01,.46,0],[-.56,.80,.08],[-.78,1.15,.14]],
      [[-.02,.62,.01],[.53,.92,-.05],[.76,1.28,-.13]],
      [[-.02,.88,.02],[-.44,1.17,-.18],[-.58,1.48,-.28]],
      [[.01,1.00,0],[.42,1.28,.20],[.56,1.60,.30]],
      [[.02,.70,0],[.12,1.00,.48],[.18,1.36,.68]],
      [[-.01,.56,-.02],[-.08,.90,-.44],[-.16,1.18,-.62]]
    ];
    const count=lod===0?3:(lod===1?5:B.length);
    for(let q=0;q<count;q++){
      const p=B[q];
      tube(m,p[0],p[1],.115,.088,seg,dark,c,.078);
      tube(m,p[1],p[2],.088,.048,seg,c,hi,.096);
      if(lod>0)tip(m,p[2],.078,hi,.12,lod);
      if(lod>1){
        const s=q&1?-1:1,mid=p[1],end=[p[2][0]+s*.24,p[2][1]-.02,p[2][2]+(q%2?.18:-.14)];
        tube(m,mid,end,.064,.034,6,c,hi,.10);tip(m,end,.058,hi,.13,lod);
      }
    }
    if(lod>0)tip(m,trunk[3],.09,hi,.12,lod);
  }

  function seaFan(m,c,lod,v){
    rockBase(m,c,lod);
    const edge=shade(c,.70),hi=mix(c,[1,.92,1],.18),seg=lod>1?7:5;
    const n=lod>1?11:(lod?8:5),top=[];
    for(let i=0;i<n;i++){
      const u=n===1?0:i/(n-1),x=(u*2-1)*.92,y=.34+Math.sqrt(Math.max(0,1-(x/.98)*(x/.98)))*1.22;
      const z=.06*Math.sin(i*1.7+v*TWO_PI);top.push([x,y,z]);
      tube(m,[0,.16,0],[x*.44,y*.60,z],.06,.037,seg,edge,c,.088);
      tube(m,[x*.44,y*.60,z],[x,y,z],.037,.026,seg,c,hi,.11);
    }
    for(let i=0;i<n-1;i++)tube(m,top[i],top[i+1],.027,.027,5,c,hi,.10);
    if(lod>0){
      for(const f of [.34,.52,.70,.86])for(let i=0;i<n-1;i++){
        const a=top[i],b=top[i+1],pa=[a[0]*f,.18+(a[1]-.18)*f,a[2]],pb=[b[0]*f,.18+(b[1]-.18)*f,b[2]];
        tube(m,pa,pb,.014,.014,4,shade(c,.94),hi,.075);
      }
    }
  }

  function brain(m,c,lod,v){
    rockBase(m,c,lod);
    const sectors=lod>1?18:(lod?14:10),rings=lod>1?7:(lod?5:3),R=.88;
    const V=(ri,si)=>{const rho=ri/rings,a=si/sectors*TWO_PI,rr=R*rho*(1+.04*Math.sin(5*a+v*TWO_PI));const ridge=.060*Math.sin(a*6+rho*17+v*4);return m.P(Math.cos(a)*rr,.18+.88*Math.sqrt(Math.max(0,1-rho*rho))+ridge,Math.sin(a)*rr);};
    const center=m.P(0,1.08,0),hi=mix(c,[1,1,.92],.22),lo=shade(c,.70);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),s%2?c:hi,.09);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const wave=Math.sin((s/sectors*TWO_PI)*6+(r/rings)*16+v*4),cc=wave>.15?hi:(wave<-.35?lo:c);
      m.quad(V(r,s),V(r+1,s),V(r+1,s+1),V(r,s+1),cc,.075);
    }
  }

  function wavyPlate(m,c,lod,y,r,phase){
    const sectors=lod>1?18:(lod?13:9),rings=lod>1?4:2,hi=mix(c,[1,1,1],.18),lo=shade(c,.75);
    const V=(ri,si)=>{const rho=ri/rings,a=si/sectors*TWO_PI,rr=r*rho;const yy=y+.065*Math.sin(a*3+phase)*(rho*rho)+.07*(1-rho);return m.P(Math.cos(a)*rr,yy,Math.sin(a)*rr);};
    const center=m.P(0,y+.07,0);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),hi,.08);
    for(let ri=1;ri<rings;ri++)for(let s=0;s<sectors;s++)m.quad(V(ri,s),V(ri+1,s),V(ri+1,s+1),V(ri,s+1),ri&1?c:hi,.08);
    for(let s=0;s<sectors;s++){
      const a=V(rings,s),b=V(rings,s+1),a2=[a[0],a[1]-.055*m.tf.k,a[2]],b2=[b[0],b[1]-.055*m.tf.k,b[2]];
      m.quad(a,b,b2,a2,lo,.04);
    }
  }

  function plate(m,c,lod,v){
    rockBase(m,c,lod);
    tube(m,[0,.12,0],[0,.54,0],.15,.115,lod>0?8:5,shade(c,.72),c,.06);
    wavyPlate(m,c,lod,.54,.86,v*TWO_PI);
    if(lod>0){tube(m,[.06,.42,0],[.20,.86,.04],.09,.070,6,shade(c,.74),c,.07);wavyPlate(m,shade(c,1.05),lod,.90,.64,v*TWO_PI+1.5);}
    if(lod>1){tube(m,[-.10,.30,.02],[-.34,.76,-.10],.08,.060,6,shade(c,.72),c,.07);wavyPlate(m,mix(c,[1,.8,.9],.14),lod,.76,.49,v*TWO_PI+3.0);}
  }

  function hollowSponge(m,x,z,h,r,c,lod,lean){
    const seg=lod>1?10:(lod?8:6),top=[x+lean,h,z],base=[x,.12,z],dark=shade(c,.35),hi=mix(c,[1,1,.92],.18);
    tube(m,base,top,r*1.02,r*.78,seg,shade(c,.75),c,.07);
    const rin=r*.48;
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      const O0=m.P(top[0]+Math.cos(a0)*r*.78,top[1],top[2]+Math.sin(a0)*r*.78);
      const O1=m.P(top[0]+Math.cos(a1)*r*.78,top[1],top[2]+Math.sin(a1)*r*.78);
      const I0=m.P(top[0]+Math.cos(a0)*rin,top[1]-.045,top[2]+Math.sin(a0)*rin);
      const I1=m.P(top[0]+Math.cos(a1)*rin,top[1]-.045,top[2]+Math.sin(a1)*rin);
      m.quad(O0,O1,I1,I0,hi,.11);
    }
    m.disc(top[0],top[1]-.055,top[2],rin,seg,dark,.01);
  }

  function sponge(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?7:(lod?5:3);
    const P=[[-.42,-.14,.88,.26],[.03,.08,1.14,.29],[.43,-.05,.74,.21],[-.18,.35,.70,.18],[.34,.32,.98,.18],[-.54,.30,.58,.16],[.58,.10,.66,.18]];
    for(let i=0;i<n;i++){const p=P[i],cc=i%2?c:mix(c,[1,.72,.35],.12);hollowSponge(m,p[0],p[1],p[2],p[3],cc,lod,(i%3-1)*.07);}
  }

  function soft(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?9:(lod?6:4),seg=lod>1?7:5,hi=mix(c,[1,.86,1],.20),dark=shade(c,.68);
    for(let i=0;i<n;i++){
      const a=(i/n)*TWO_PI+v*.7,rad=.20+(i%3)*.09;
      const p0=[Math.cos(a)*rad,.13,Math.sin(a)*rad];
      const p1=[Math.cos(a)*(.30+(i%2)*.09),.52+(i%3)*.05,Math.sin(a)*(.30+(i%2)*.09)];
      const bend=a+(i&1?.34:-.30),p2=[Math.cos(bend)*(.48+(i%3)*.05),.98+(i%4)*.08,Math.sin(bend)*(.48+(i%3)*.05)];
      tube(m,p0,p1,.115,.080,seg,dark,c,.07);tube(m,p1,p2,.080,.038,seg,c,hi,.10);
      if(lod>0)tip(m,p2,.060,hi,.13,lod);
      if(lod>1&&i<6){const p3=[p2[0]+Math.cos(a+1.57)*.20,p2[1]-.02,p2[2]+Math.sin(a+1.57)*.20];tube(m,p1,p3,.052,.028,5,c,hi,.10);tip(m,p3,.048,hi,.13,lod);}
    }
  }

  const BUILDERS=[branching,seaFan,brain,plate,sponge,soft];
  const TYPE_NAMES=['branching','fan','brain','plate','sponge','soft'];

  function miniAccent(m,c,lod,v,kind){
    const scale=lod>0?.28:.22;
    const tf={x:m.tf.x,y:m.tf.y,z:m.tf.z,c:m.tf.c,s:m.tf.s,k:m.tf.k};
    const yaw=Math.atan2(tf.s||0,tf.c===undefined?1:tf.c);
    const idx=kind===undefined?Math.floor(Math.abs(v||0)*997)%BUILDERS.length:kind%BUILDERS.length;
    m.setTF(tf.x,tf.y,tf.z,yaw,tf.k*scale);
    BUILDERS[idx](m,mix(c,[1,.95,.95],.06),0,v);
    m.setTF(tf.x,tf.y,tf.z,yaw,tf.k);
  }

  function clusterFor(m,c,lod,v,kind,heroLevel,rnd){
    moundBase(m,c,lod,heroLevel,rnd);
    BUILDERS[kind](m,c,Math.max(lod,heroLevel===2?2:lod),v);

    const tf={x:m.tf.x,y:m.tf.y,z:m.tf.z,k:m.tf.k,c:m.tf.c,s:m.tf.s};
    const rootYaw=Math.atan2(tf.s||0,(tf.c===undefined?1:tf.c));
    const placeLocal=(dx,dz,dy,scale,yaw,fn,col,plod,pv)=>{
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
      const P=m.P(dx,dy,dz);
      m.setTF(P[0],P[1],P[2],yaw,tf.k*scale);
      fn(m,col,plod,pv);
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
    };
    if(heroLevel===2){
      placeLocal(-.82,-.28,.10,.78,rnd()*TWO_PI,BUILDERS[(kind+1)%6],mix(c,[1,.86,.92],.14),1,v*.73+.11);
      placeLocal(.78,.18,.12,.74,rnd()*TWO_PI,BUILDERS[(kind+3)%6],mix(c,[.92,1,.98],.10),1,v*.61+.37);
      placeLocal(.12,-.72,.08,.66,rnd()*TWO_PI,BUILDERS[(kind+5)%6],shade(c,1.04),1,v*.49+.58);
      placeLocal(-.10,.80,.06,.61,rnd()*TWO_PI,BUILDERS[(kind+2)%6],mix(c,[1,.95,.85],.12),1,v*.29+.21);
      placeLocal(.46,-.36,.14,.52,rnd()*TWO_PI,BUILDERS[(kind+4)%6],mix(c,[.90,1,.90],.10),0,v*.57+.41);
      placeLocal(-.48,.42,.08,.46,rnd()*TWO_PI,BUILDERS[(kind+1)%6],shade(c,1.02),0,v*.84+.07);
      for(let i=0;i<4;i++)placeLocal((rnd()-.5)*1.9,(rnd()-.5)*1.6,.03+rnd()*.10,.24+rnd()*.08,rnd()*TWO_PI,miniAccent,mix(c,[1,1,.92],.08),0,v*rnd()+i*.17);
    }else if(heroLevel===1){
      placeLocal(-.44,.20,.08,.56,rnd()*TWO_PI,BUILDERS[(kind+2)%6],mix(c,[1,.95,.95],.08),1,v*.68+.19);
      placeLocal(.36,-.28,.06,.44,rnd()*TWO_PI,BUILDERS[(kind+4)%6],shade(c,1.02),0,v*.41+.43);
      placeLocal(.00,.46,.04,.34,rnd()*TWO_PI,miniAccent,mix(c,[1,.97,.90],.08),0,v*.26+.13);
      if(rnd()>.45)placeLocal(-.36,-.38,.03,.28,rnd()*TWO_PI,miniAccent,shade(c,1.03),0,v*.34+.59);
    }else if(lod>0&&rnd()>.52){
      placeLocal((rnd()-.5)*.68,(rnd()-.5)*.54,.02,.24,rnd()*TWO_PI,miniAccent,mix(c,[1,.95,.95],.05),0,v*.42+.14);
    }
  }

  function rebuildAquaV155(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+155155),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

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

    const cols=COLOUR_BAG.map(hx);
    let nearGroups=0,midGroups=0,farGroups=0,heroGroups=0,mediumGroups=0,simpleGroups=0;
    let primaryHeroes=0,secondaryHeroes=0,moundGroups=0,heroColonyGroups=0,accentGroups=0;
    const typeCounts={branching:0,fan:0,brain:0,plate:0,sponge:0,soft:0};

    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      for(const side of [-1,1])for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.02,band[0]),hi=Math.max(lo+2.4,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.10:.78)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          heroPrimary=(k===0&&st%HERO_PRIMARY_EVERY===(side>0?1:3)),
          heroSecondary=(k===1&&st%HERO_SECONDARY_EVERY===(side>0?0:2)),
          heroLevel=heroPrimary?2:(heroSecondary?1:0),
          lod=heroLevel===2?2:(heroLevel===1?1:((k<=1||(k===2&&st%3!==1))?1:0)),
          base=[1.34,1.18,1.36,1.60][k],spread=[1.06,.86,.98,1.10][k],
          s=(base+rnd()*spread)*(heroLevel===2?1.46:(heroLevel===1?1.22:1)),
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],
          yaw=rnd()*TWO_PI,v=rnd(),kind=(st*3+k*5+(side>0?2:0))%BUILDERS.length;
        reef.setTF(p.x,y,p.z,yaw,s);
        clusterFor(reef,c,lod,v,kind,heroLevel,rnd);
        typeCounts[TYPE_NAMES[kind]]++;
        moundGroups++;
        if(heroPrimary){heroGroups++;heroColonyGroups++;primaryHeroes++;accentGroups+=4;}
        else if(heroSecondary){heroGroups++;heroColonyGroups++;secondaryHeroes++;accentGroups+=2;}
        else if(lod===1)mediumGroups++;else simpleGroups++;
        if(k===0)nearGroups++;else if(k<3)midGroups++;else farGroups++;
      }
    }

    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);

    const fishCount=(w.actors||[]).filter(a=>a&&a.aquaFish===true).length;
    const jelly=(w.actors||[]).filter(a=>a&&a.aquaJellyV152===true);
    w.__aquaV155={version:VERSION,hqCoral:true,reefColonies:true,organicReefMounds:true,
      closeColonyContinuity:true,heroCoralColonies:true,coralGroups:CORAL_GROUPS,
      reefStations:REEF_STATIONS,groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,
      heroGroups,heroTarget:HERO_GROUPS,primaryHeroes,secondaryHeroes,heroColonyGroups,
      mediumGroups,simpleGroups,moundGroups,accentGroups,typeCounts,
      coralTypes:['branching','fan','brain','plate','sponge','soft'],
      hybridLOD:true,recognizableGeometry:true,closeHeroCorals:true,
      podiumBasesRemoved:true,proceduralSphereClustersReplaced:true,triangles:Math.floor(reef.idx.length/3),
      jellyPreserved:jelly.length,properProjectJellyPreserved:jelly.length===60,
      fishPreserved:fishCount,actorsUnchanged:true,roadUnchanged:true,glassUnchanged:true,
      verdantUntouched:true};
    console.log('Aqua Rift v155 reef colonies:',w.__aquaV155);
    return w;
  }
})();
/* ===== END js/61-aqua-coral-colonies-v155.js ===== */

/* ===== BEGIN js/62a-aqua-v156-model-siren.js ===== */
"use strict";
(globalThis.__AQUA_V156_MODELS||(globalThis.__AQUA_V156_MODELS={})).siren='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HAH0ABsBGwH0APMAHwH7AB0B+wAfAfoA8wD0APYA+gD2APsA+gD7AMMAwwD7AMUAyAD/AAIBygDIAAIByADFAMMAwwDFAJQAlwCUAMUAlwDIAJYAlgDIAJkAmQCXAJYAlwCWAJQA+gAfAf8AIQECAR8BHwECAf8A/wDIAPoA+gDIAMMAyADKAJkAlgB3AJQAlAB3AE0AeAB3AJYAHQH0APoAygACAQkB0ADKAAkBwwCUAJEAeACWAJkAewB4AJkAdwBQAE0AeABQAHcAHAEbAfMA9gAcAfMA9AAcAfoAHAH2APoAIQEJAQIBUABOAE0AeAB7AFAA+gAfAR0BygDQAJkAlABNAJEAewBVAFAA8wC8AO8AfgB7AJkAGgEYARkBFwEZARgBIAEhAR8BHgEgAR8BHwH6AP0AHgEfAf0AIQEgAQkBCQEgAQgB+gD5AP0A7gDyAPMA7wDuAPMA7gC8AL4AvADuAO8AvADzAPIAwAC8APIA+QD6AMAA+QDDAPoA+gDDAMAAxADDAPkAxAD5APoAxAD6AMYA/QDGAPoAwwDGAPoACQEIAdAA0AAIAc8AvgC8ALoAxADGAMMArACtAKsAgwCsAIQAhACsAK0ArQCDAIQAgwCtAKwAugCLAIoAvACLALoAiwC8AMAAjwCLAMAAwACQAI8AkQCQAMMAkADAAMMA0ADPAJkAmQDPAJwAjgCLAI8AigCLAIwAkACOAI8AkQCOAJAAbwCMAIsAiwBwAG8AiwByAHAAcgCLAI4AkQBNAHIAjgCRAHIAegB+AJwAnAB+AJkAfgB6AHsAcgBvAHAATQBMAHIAegBUAFUAegBVAHsATgBMAE0AUABVAFQATwBQAFQATgBQAE8ATABOAE8A/gAeAf0A7gC+AOsA6wC+ALoArACDAKsArACvAIMAjgCPAHIA8gD1AMAAjABvAIoAbwByAEQAUwBUAHoA6wC6AOgA6AC6ALgA9QD5AMAAugCKAIgAigBvAEQATABJAHIAVAApAE8ACwAAAAMA3gCrAKoA4ACzAK8A5ACzAOAA6AC4AOUA5QC4ALYARAByAEkAJQASACMAAwAJAAsAnADPAKEA1gCkAKEATABPACUAKQAlAE8AJQAUABIAFgHnAOgA5QAWAegA/AAeAf4AIAEeAfwAIAH8AAEBAAEgAQEBBwEgAQABIAEHAQgB5ADgAOMA4wDgAOIA6wDoAOoA6gDoAOcA/AAAAQEB8gDuAPEA8QDuAO0A7gDrAO0A7QDrAOoA9QDyAPEA/QD5APwA/AD5APgA+QD1APgA+AD1APEA/gD9APwA3gCqAKkA3QDeAKkArwCuAOAA4wCyALMA4wCzAOQAtgC1AOUACAEHAc8AzwAHAc4ArACrAKoArwCzALIAtgC4ALUAtQC4ALcArwCyALEAsQCuAK8AugC3ALgA1QDPAM4AhwC3ALoAhwC6AIgAzwDVAKEAoQDVAKAAoADVANYAoADWAKEApADWANUAoACkANUAigCHAIgAoQCkAKAAnAChAKAAhwCKAGwAbACKAEQAegCcAKAAgQB6AKAAfQB6AIEARABDAGwAUwB6AFcAVwB6AH0AgQBaAFcARwBEAEkARwBJAEwAXQBaAFcARABHAEMATABLAEcAJQAkAEsATAAlAEsATAAkACUAKAAkACUATwAoACUAKQBRACgALAApAFQAVABTACwAVABTAFcALABUAFcAVwAuADAAWgAuAFcAXQAwAC4AWgBdAC4AKQAoACUALgAsADAAIgAkACUAIwAiACUAKQAsACgAIgASABAAEgAiACMAJQATABQAEwAlACgALAAuABUAMAAsABUAFQAuADAAEgATABAAEgAUABMACAAKAAsACQAIAAsACQADAAgAAwACAAgAAAALAAoABAAAAAoAAgAAAAQAAwAAAAIA4gATAeMAFgHlAOMA4wDlALUAgQBdAFcAFgHjABMBVwBTACwA3gDdAKoAqgDdAKkA4gDgALEA4ACuALEACAAZAAoAtQCyAOMAAAH8AMkABwEAAc4AQwBAAGwAJAAoAEsAGQAHAAoAJAAiABAAJAAQABMACAAEAAoAAgAEAAgAyQD8AMcAzgAAAckAuQC3AIcAoADVAKcANwAdADUANQAdABkAKAAkABMA2wASAREBFAEWARMBFAEVARYBEQHdANsA3QDcANsA3QASAd8AEQESAd0AFAHjAOEAFAETAeMAFgEVAeYA5wAWAeYA4wDiAOEA6gDnAOYA6gDmAOkA8QDtAPAA7QDqAOkA7ADtAOkA8ADtAOwA+ADxAPAA9wD4APAA/AD4APcA3QCpANwA3ACpAKgAqQDfAKgA3QDfAKkA4gCxALAA4gCwAOEAsgDhALAA4wDhALIA4wC1AOEAtADhALUA5gC5AOkAtAC5AOYA6QC5ALsAuwDsAOkA7QDsALsAwgD8APcAwgDHAPwACgELAdUA1AAKAdUACgHXANUAsgCwALEAtwC0ALUAuQC0ALcAyQDUANUAtwC5ALsA1QDOAMkAuQCHAIkAuQCJALsApgDXANoApgCnANcApwDVANcAhwCGAIkApwCmAKAApgCjAKAAbABrAIYAhwBsAIYAoACjAIEAgQCjAIIAbABpAGsAfQCBAHkAQABpAGwANABiADUAQAA/AGkAPwA8AGkAfQB5AFcAVwB5AFYAWQB5AFcAVwB5AIEAgQCCAF0AXQCCAFwANwA1ADQAQwA/AEAASgBIAEcASgBHAEsAPwBDAEIARwBIAEYARQBCAEMARgBFAEcARwBFAEMAGQA0ADUAGgA0ABkANwAcAB0ASwAoAEoASgAoACcAVwBWACwALABWAC0AVwAwAFkAWQAwAC8AXAAvAF0ALwAwAF0AKAAkACYAJwAoACYAHQAcABkALAAtACsAGQAcABoAJwAmACQAKAAnACQAGQAIAAcAGgAZAAcAIgAQAA8AEQAiAA8AEAAiABEALAArACgAKwAnACgACgAHAAgAEQAPABAADQAFAA4A5gDhALQA8ADsALsA9wDwAMIAxwCYAMkApgCCAKMANwA0AGIAWABcAIIADgAFAAwADwAFAA0ADwAGAAUAFQEUAeYAFAHhAOYA3ACoAN8A8AC7AL8AwgDwAMEAmADHAJUAawBpAIYANwBiAGMAYwBiADQAZgA5AGMAYwA5ADcASABKAHEAHAA3ADkAKgBKACcAwQDwAL8A1wAKAdoAmACVAHkAlQB2AHkANAA3AGMAPABoAGkASgAqAHYAHAA5ACAAWQAvAFwADgAhAA0ABgANAAUABgAPAA0A2wDfABIBwgDBAI0AxwDCAJUASABxAEYAdQBxAEoAeQB2AFIAdgAqAFIAeQBSAFYANAAaADcANwAaABwAKwBWAFIAKwAtAFYA3wDbANwAvwC7AI0AuwCJAI0AwQC/AI0AjQCTAMIAbgCJAG0AQgBuAG0AQgBFAG4AbgBFAEYAcQBuAEYAdgB1AEoABgEOAQoBBgHUAM0A1AAGAQoB2QDaAA4B2gAKAQ4B1ADJAM0AwgCTAJIAlQDCAJMAyQCYAJsAzQDJAJsApgDaANkApgDZAKUAkwCNAJIAkgCNAHQAhgCFAIkAhQBpAGcAhgBpAIUAiQCFAGoAiQBqAG0AjQBuAHEAjQBxAHMAjQBxAHQAdgCVAHQAdACVAJMAmAB5AHwAmwCYAHwAeQCfAHwAfACfAJsAnwB5AIAAWwCCAKYApgClAFsAaQBoAGcAZgBjAGQAcQB1AHQAdgB0AHUAFwBgADMAYQAzAGAAFwBhAGAAFwAzAGEAYwA3ADYAZgBkADkAZAAfADkAHwBnADsAaAA8AGcAZwA8ADsAagBBAEIAbQBqAEIAeQBZAFgAgAB5AFgAggBbAFgANAAzABcAWwBcAFgAOwA8AB8AQQA+AEIAQgA+AD8AWQBcAFgAPwA+ADwAOwA8AD4ANwAcABsANgA3ABsAHAA3ADYAGwAcADYAHwAgADkAUgAqACsAGwAcAB4AIAAfABwAHwAeABwAKwAqACcAiQBuAI0AkwCSAHQAYwA2AGQAZwAfAGQAagA+AEEAWwCAAFgAGwAeADYAZwBqAIUAHwA2AB4ADQEOASgBDgEGASgBHwBkADYAPgBqAGcAKAEnAQ0BBgEFASgBKAEFAScBBgEoAScBDQEnAQ4BEAEOAQ0BBQEGAcwABgHNAMwADgEQAdkAEAHYANkAzQCbAMwAmwCaAMwA2QDYAKUApQDYAJ4AngCaAJsAmwCfAJ4AgAB/AJ4AgACeAJ8ApQCeAH8AWwClAH8AfwCAAFsAZAA9AGcAZQA9AGQAYAAXAF8AFwAyAF8AZAAfAGUAZQAfADgAZwA9AD4APgA9ADsAOwA9ADoAOgA4ADsAOwA4AB8AFwAWADIAMgAYABcAFgAXABgADQEnARABngDTAJoA0wDMAJoAngCiAH8APQBlADoAZQA4ADoABQEkAScBMgAWABgAJwEjASYBJAEjAScBBAEjAQUBBQEjASQBJwEmARABEAEmAQ8BBQHMAAQBzADLAAQBEAEPAdgA2AAPAdIAywDMANIAzADTANIA0wCdANIA0wCeAJ0A0gCdAJ4A0gCeANgAngCiAJ0AMgBeAF8AMgAxAF4AJgEMAQ8B0gDRAJ0ABAHLANIADwHRANIADAHRAA8BJQEmASMBIwEiASUBBAEDASMBAwEiASMBJgElAQwBBAHSAAMB0gDRAAMBIgEDASUBAwEMASUBDAEDAdEA';
/* ===== END js/62a-aqua-v156-model-siren.js ===== */

/* ===== BEGIN js/62b-aqua-v156-model-crawler.js ===== */
"use strict";
(globalThis.__AQUA_V156_MODELS||(globalThis.__AQUA_V156_MODELS={})).crawler='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ANQARADQAEQAbADQAOwAgACEAIAA7ADoAAgAbAAcAGwARAAcAFAAhACAAFwAUACAAFAAXAAsAFwAKAAsABgACAAcACgAHAAsAAgAHAAoAWABFAGIARwA6AFgANABQAEUARwAsADoAOgAsACAAYABkAHUAYgBgAHUAdQBkAGIAYgBFAGAAWABiAGQAdQBYAGQAZABaAFgATgBeAE8ATwBeAEwAQABgAEUAWgBHAFgAQABOAE8ATgBMAF4AUABOAEAARQBQAEAATwBMAE4ANABAAFAAPQBHAFoANABFAEAAQABFADMARwA9ADoAMwBFADQAQAAzADQAPQAsAEcALAA9ADoANAAbADMAGwAQADMAJAAsAD0AJAAgACwAGwACABAAAgABABAAIAAaABcAFwAaAA4AAQACAAUABQACAAYACgAXAA4ACgAOAAQAAgAKAAQABAABAAIAhQCJAGQAYACFAGQAZgBaAGQAJAAaACAAZACJAGYAQABwAGAAiQCFAKYApgCFAKQAiQCmAKcAiQCMAGYAhQBgAHAAZgCMAHYAcABgAG8AbwBAAFIAcABAAG8AWgAuAD0AQAAzADIAMwAQADIAEAAPADIAJAA9ACMAGgAkACMAGQAaACMAAQAAABAAAAAPABAAGgAZAA0AGgANAA4AAQAFAAAADgANAAMADgADAAQABAADAAAAAQAEAAAApgCkAKcAlQCkAIUAZgBdAFoAQAAyAFIAWgBdAC4APwETATwBPAETAQ4BpADGAKcAjACJAKkAqQCJAKcAhQCEAJUAcACEAIUAbwCEAHAAZgB2AF0ALgAjAD0AbAE/AWoBagE/ATwBDgETARABxgDJAKcAbAFBAT8BEwE/ARYBPwFBARYBzACpAMkAyQCpAKcApACVAIQAngGdAWoBagGdAWwBagE8AWgBbAFvAUEBPAE7AWgBQwFBAW8BOwE8AQ0BPAEOAQ0BQQFDARYBFgFDARUBAAEeAQIBDQEMAQkBEAENAQ4BEwEWARUBBQHJAAIBBQHMAMkAEwESARABDgHeABABEgHsAN4AEgHeABABvgC2AL0AsQC+AL0AxgCkAMQAvQCgALEAsQCgALIAsgDEAKQApACgALIApACEAKAAoACEAIMAhABvAIMAbwBuAIMAjwB6AHYAjwB2AIwAbwBSAG4AUgBDAG4AdgBcAF0AegBcAHYAMgAoAEMAUgAyAEMAXQBcAC4ALgAtACIAIgAjAC4AIwAiABgAIwAYABkADwAIABwADwAAAAgADQAZAAwAGQAYAAwADAAJAA0ADQAJAAMAAAADAAkAnQF9AWwBfQFvAWwBZwE7AWIBYgE7ATgBBwEFAQIBAgHGAAABxACyAKAAqQCsAIwAMgAPACgAZwFqAWgBOwFnAWgBBwECATMBOAE7AQkBCQE7AQ0BEAHeAA0BEgETAewArACpAMwArACPAIwACQAIAAAAHgEzAQIBBwEzATUB9AC9ALYABwHNAAUBBQHNAMwA6wAMAQ0B3gDrAA0BEwEVAewAzQCsAMwALgBcAD4AYgE4AV8BXwE4ATUBAAEzAR4BQwEhARUBxAAAAcYAFQHuAOwAegCPAHkAfQGdAaEBnQFqAWcBfQGhAWwBbAGhAW8BXwFkAWIBdAFvAX8BbwF0AUMBMwFMATUBTAEzATIBMgEzAS0BMwEAAS0BQwFGASEBIQEZARUBGQHuABUBCQHpAAcBwgC9APgAwgD4APoAAAHEAP0AGgEVAe4ABwHpAM0ACQHQAOkADAHrAAkB6wDQAAkB7gDkAOwAFQHkAO4A4gDeAOwAoADCAMQAsgCfAKAAgwCCAKAAaAB5AI8AaAB6AHkAegB5AFwAXABbAEkAXABbAD4APgBbAEkAPgBJADwAKABCAEMAPAAuAD4APAAtAC4AKwAiAC0AKAAPAB4ADwAcAB4AGAAiABUADAAYABYAbwGhAaUBOAEHATUBCQEHATgBGQEaAe4A+gDBAMIAzQDQAKwAzQDpANAApQF/AW8BWwFfATUBdAFGAUMBRgEZASEBnwDCAKAArwCsANAArACQAI8AQwBCAFEASQBbADwADAAWAAkAlgGdAWcBYgFkAWcBTAFbATUBRgF0AUUBMgEtAUwB6wDeAN0ArACvAJAAaABcAHkACAAJABMAFgATAAkAXwFeAWQB+AD9APoAwgDBAMQA1wDrAN0A7ADkAOIAKwAtADwAoQGdAaABoAGdAZwBoQGgAaQBoQGkAaUBpQGkAX8BnQGWAZUBnQGVAZwBZAFeAY8BjwFeAYoBZwFkAXwBfAFkAY8BfAGVAWcBZwGVAZYBfwFvAXMBfwFzAXQBXwFbAV4BcwFFAXQBRQFzAUYBAAH9AC0BRgFFARkBwQD4APoA+gD9AMEA5ADuABkB9AC2APMAtgC7APMAwQD4AMIA/QDEAMEA6wDXANAA6QCvANAA3QDcANcA3gDiAN0AwgCfAMEAoACCAJ8AjwCQAJcAaACXAJAAaACPAJcAeABoAJAAbQCCAG4AbgCCAIMAbgBDAG0AQwBRAG0AWwBcAGgAQgAoADYAKAAeADYAHgASADYAIgArABUAHgAcABIAHAAIABIAEgAIABMAGAAVABYAEgAWABUAFgASABMALQEsAUwBGQHjAOQAaAB4AFsAKwAfABUArgGcAZsBoAGcAa4BpAFzAX8BpAGpAXMBrgGkAaABkACXAHgAFQAdABIArwCYAJAAowGkAa4BiQGOAYoBigGOAY8BlAGcAZUBlAGbAZwBigFeAYkBqQGkAaMBiQFeAXkBjgFkAY8BjgF7AWQBewF8AWQBlQF8AZQBfAF7AZQBqQF1AXMBeQFeAVsBWgF5AVsBSwFaAUwBTAFaAVsBcwFIAUUBSAFzAXUBTAEsAUsB8wDyACQB/AD9APgA+QD8APgALQH8ACwB/QD8AC0BGQFFARsBRQFIARsB+ADBAPkA7wAZARsB/AD5AMEA8wC7APIAuwC1APIA/ADBAMAAGQHvAOMA4wDvAOQA1gDSANcA1wDSANAA5ADjAOIA1gDXANsA4wC0AOIA1wDcANsA3QDbANwA4gC0ANsA4gDbAN0A0ADSAK8ArwDSAK4AwQCfAMAAnwCeAMAArgCYAK8AjgCYAK4AnwCCAJ4AggCBAJ4AmACOAJAAjgCXAJAAlwCOAHgAggBtAIEAbQBfAIEAeACOAHcAbQBRAF8AeAB3AFsAWwB3AEgAUQBBAF8AUQBCAEEAWwBIADwAQgAmAEEAPABIACoAJgBCACcAQgA2ACcAEgAnADYAPAAqACsAKwApAB8AKwAqACkAHQAnABIAHwAdABUAiQF5AVoBIwFRASQBTQAvAEsAOABBACcAJwBBACYAKQAnAB8AJwAdAB8AcgBfAEEAKQAqADkArQGnAa4BmgGtAa4BmgGuAZsBpwGjAa4BiAGNAY4BiQGIAY4BmwGUAZIBmwGSAZoBqAGjAacBjQGSAY4BkgF7AY4BqAGpAaMBhgGIAYkBlAF7AZIBhgFaAVgBiQFaAYYBdQGpAagBcgF1AagBSwFYAVoBcgFIAXUBSgFYAUsBcgFHAUgBSwFJAUoBSwEsAUkBLAH7AEkBJAEjAfEA+QAcAR0BHQEcASgBJAHyACMB8gDxACMBJAHxAPIALAH8APsAGwFIAUcBGwFHARgB7wAbARgB8gC1APEAtQC6APEA8gC6ALUAugDyAPEA+wD8AOcA5wD8AMAAGAHmAO8A5gDjAO8AvwDnAMAA5gDhAOMA1QDRANYA1gDRANIA1gDaANUA1gDbANoAtADjAOEA4QDaALQA2gDbALQA0QCtAK4A0gDRAK4AtQCwALoAvwDAAJ4AowC/AJ4AngCAAKMArgCtAKsArgCrAI4AngCBAIAAjgCrAI0AgQBfAIAAgABfAHEAZwB3AI4AjQBnAI4AcgBxAF8AQQBEAHEAQQBxAHIARgBIAGcASAB3AGcAUwBEAEEALwA/AEsATQBLAD8APwAvAE0AUwBBADgAUwA4AEQASABGACoAOABBAEQAQQAxAEQARAAxADgAOQAqAEYAQQAmADEAQQA4ADEALwA/ADAALwAwACUAOQA4ACcAKQA5ACcAcQByAIAAOQBGAFcARgBWAFcAOAA5AEQARAA5AFcArAGaAZkBmgGsAa0BpwGsAaYBrQGsAacBqgGNAYcBqgGQAY0BjQGIAYcBjQGQAZIBkAGZAZoBkAGaAZIBhwGIAYUBiAGGAYUBqAGnAaYBhQFYAVcBhQGGAVgBpgFxAagBqAFxAXIBUQFQASMBIwEiAVABVwFKATEBVwFYAUoBcgFEAUcBcQFEAXIBSQErAUoBSgErATEBSQH7ACsBIwHxAPAA8AAiASMB8QAiAfAAIwEiAfEA/wArAfsARwEXARgBRAEXAUcBwwD/APsAFwHlABgB8QC6APAAugC5APAA+wDnAMMA5gAYAeUAvwDDAOcA5gDgAOEArQDRAM8A1QDaANQA1ADaANkA4ADZAOEA5gDlAOAA0QDVANQA0QDUAM8A4QDZANoAugCwALkAsACbALkAvwCjAMMAowCdAMMAzwCzAK0AqwCtAKoArQCzAKoAowCiAJ0AogCjAIAAogCAAIYAqwCqAIsAqwCLAI0AgAB/AIYAYQCAAHIAfwCAAGEAiwBnAI0AcQBhAHIAiwBlAGcAYQBxAEQAZwBlAEYAYwBGAGUAYwBWAEYAVABhAEQAVABXAFYAVABEAFcAVABWAGEAzwCqALMAYQBWAGMAcQGmAX4B/wAxASsBjAGqAYcBMQH/AP4A1ADZANgAqgCoAIsAYQCGAH8AigCLAIcAfwBsAH4AYwBlAIoAZQCLAIoArAGZAasBqwGZAZgBpgGsAasBpgGrAaIBjAGQAaoBjAGRAZABkQGYAZABkAGYAZkBhQGDAYQBhAFdAYcBhAGHAYUBjAGHAV0BgwGCAYQBUAFUAYEBVwGEAYUBhAFXAVkBpgGiAW4BbgF+AaYBWQFXAV0BfgFuAXEBcQFuAXABUAEiAVQBIgEnAVQBVwEwAVkBMQEwAVcBTwFEAXABRAFxAXABIgH3ACcBTwFCAUQBIgHwAPcAAQEwATEBAQExAf4AFwFEAUIBFAEXAUIBFwEUAeUA8AC5APcAuQC4APcA/wDDAP4AwwDFAP4AFAHtAOUA5QDtAOAA7QDfAOAA0wDUANgAzwDUANMAzwDTAM4AxQDDAKEAzwDOAMsA3wDYANkAzwDLAKoA4ADfANkAuQCbALgAmwCaALgAwwCdAKEAqACqAMsAnQCcAKEAogChAJ0AiwCoAKUAiAChAIYAhgChAKIAiwClAJYAlgClAIcAhwCLAJYAYQB/AH0AiACGAHMAiABzAIcAfwB+AH0AhgCIAIcAhgCHAHMAfgBsAH0AfwB9AGwAhgBhAHMAigCHAHQAYwCKAHQAcwBhAHQAYQBjAHQAyADFAKUAxQChAKUApQChAIcAhwChAIgAbABrAH0AhwBzAHQA3wDtABQBcAFuAU8BbgFCAU8BywDOAAYBpQCoAMsAnAB9AJIAWQFdAYQBxQDIAP4AyAABAf4AmgCRAJIAqwGYAZ8BnwGYAZcBqwGfAaIBjAGLAWYBjAFmAZEBmAGRAZMBmAGTAZcBgQFUAVMBgAGBAVMBjAFdAXgBYwGMAXgBiwGMAWMBegGRAWYBkQF6AZMBegFmAZMBZgFpAZMBaQGXAZMBogGfAW4BbgGfAWsBXQFZAXgBdgFUAVMBbgFrAW0BWQFdAVYBeAFZAVYBVAEnAVMBJwEmAVMBWQEwAS8BWQEvAVYBQgFuAW0BQAFCAW0BLwEwATQBNAEwAU0BMAEvAU0BTQEvATQBJwH3ACYB9wD2ACYBMAEBAS8BAQEDAS8BBgE0AQQBFAFCAUABIAEUAUABAwEBAccAFAEgAe0A7QAgAREB6AAGAc4ABAEGAegA7QARAd8A9wC4APYAuAC8APYAAQHIAMcABgEEAcoAywAGAcoA0wALAeoADwELAdMA2AAPAdMA3wARAdgA2AARAQ8BzgDLAOgA0wDqAM4A6gDoAM4AuACZALwApQDHAMgAywDKAMcAywDHAKUAuACaAJkAmgCZAJEAkgCRAJMAkwCRAJkAnACSAJMAlACcAJMAkQB7AJoAmgB7AJkAkgB7AJEAnACUAH0AkwB7AJIAlACTAJIAfQCUAJIAagB7AGkAagBpAHwAagB8AGsAaQBrAHwAawBpAGoAZgGLAWMBVgEvATQBAwHHAMoAbQFrAUABawE+AUABAwHKAAQBewCTAJkAZgFjAToBYwFOAToBNAEvAQQBBAEvAQMBQAERASABPgERAUABCwEKAeoACgHoAOoAnwGXAWsBlwFpAWsBTgEKAToBOgEKAQsBCwEPAToBeAFWAVwBVgFVAVwBXAFgAXgBYAFjAXgBaQFmAWUBUwFSASUBawFpAT4BPgFpAT0BJQFTASYBVQFWAS4BLgFWAS8BTgFjATcBZgE6ATkBZQFmATkBZQE5AWkBOQE9AWkBKQEuAS8BNAE2AS8BNgEuAS8BLwEqASkBLwE0AS4BLgE0ATYBJgElAfUANAEEATYBNwEKAU4BPgE9AREBOgEKATcBOQE6ATcBPQE5AQ8BLgEpASoBLwEuASoBOQE6AQ8BJgH2ACUB9gD1ACUBJgH1APYANgEEAR8BCgE3AQgBOQEPAQsBEQE9AQ8B6AAIAQQBCAHoAAoB9QD2ALcAtwD2ALwA9gD1ALwAvAD1ALcAmQC3ALwAVQE2AVwBLgE2AVUBNwFjAWABCAE3AR8BNwE2AR8BHwEEAQgBXAE2ATcBXAE3AWAB';
/* ===== END js/62b-aqua-v156-model-crawler.js ===== */

/* ===== BEGIN js/62c-aqua-v156-model-eelbeast.js ===== */
"use strict";
(globalThis.__AQUA_V156_MODELS||(globalThis.__AQUA_V156_MODELS={})).eelbeast='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bQBvAFYAbQBWAGEAZQBYAFkA8QD+APYA7gDxAOYA5gDxAPIA8QD2APcA8QD3APIA7gDmANgA5gDZANgA2QC+AL0A2QC9ANgAzwDOAMUAvgCcAL0AvQCcAJsAxQCzALYAxQC2AKUAswC2AKoAqgC2AKkAjQCbAJwAqgCpAIkAiQCpAJYAlgCMAIkAjgCQAI0AjQCQAH4AkAB/AH4AiQCMAIgAfwBtAGAAfgB/AGAAiQCIAHMAdACJAHMAZQB0AHMAYABtAGEAZQBzAFgAWABzAGgAYQBEAGAAVABgAEQAWQBOAFgAUQA/AD4ASwBZAEoAPwBEAEMAQwBEADQARAA3ADQANwBLAEoANwBKAEcANwA6ACMAIwA6ACoAIwAqAB8AGQAjAB0AIwAfAB0AGQAdABoAHQAfACAAHQAfABwAGQAdABwAGQAcAA4AGQAOABQAugC9AJsAsQCbAI0AqQCMAJYAiACMAHMASgBYAE4ANwBKADoANAA3ACMANAAjACcAJwAjABkAHwAlACEAHAAfAA4ADgAfABUAFAAOAAcAugCbALEAPgBDAFEASgBOADoAOgBOADwAOgA8ADAAOgAwACoAKgAwACwAKgAsAB8AHwAsACUAjQB+AHsAGQAUABcADgAVABAA2AC9ALoAfgBgAHsABwAOAAkAAgHxAPsA+gD7APEA+gDxAO4A7gDtAPoA7gDYANcA7gDXAO0A5ADYANcA5ADXANMA1wDYANMA0wDYALoA0wC6ALkAugCxALAAugCwALkAsQCNAHoAsQB6ALAAtQCoAKkAjQB7AHoAjACXAGkAewBgAHoAegBgAGoAagBgAGwAbABgAEIAcwBpAGcAYABUAEIATgBoAFsAQwA0ADMAQwAzAEIANAAnADMAMwAnAC0AJwAmAC0AJwAZACIAJwAiACYAGQAXACIAFwAUABIAFwASABYAFAATABIAFAAHABMACwAHAAYADgAQAAkACQAQAAQABwAJAAYABgAJAAgACQAEAAgAJAAsACkAKQAsACsAFwAWACIACAAEAAMABgAIAAEAAQAIAAMAbABCAGoALgA7ADkAIgAWABgAagBCAF0ACAAPAA0A+gDtAPkA+QDtAOwA7QDXAOwA7ADXANYA0wC5ALgA0wC4ANIAuQCwALgAuACwAK8AsAB6AK8ArwB6AJgAmAB6AHkAegBqAFwAegBcAHkAagBdAFwAXQBCAFwAXABCAF8AXwBCAFMATABNAFsASQBNAEgAQgAzAEEAQQAzADIAKAA5ADYAFgASABgAGAASABMAEwASABEAEQATAAoAEwALAAoACgALAAYACgAGAAUABgABAAUABQABAAAAAQADAAIAAQACAAAASABMAFoATwBTADEAMQBTAEEAMQBBADIANQA4AEgAVwBaAGYARgBIAFcA+QDsAOsA0gC4AMsAywC4ALcArwCYAHgAeACYAJoAeQBcAF8AtwC4ALwAuACvALcAtwCvAK4ArgCvAJoArwB4AJoAeAB5AH0AeQBfAH0AXwBrAH0ATwAxAD0APQAxAEAAMQBBAEAAtwCuALwAvACuAJoAzQDdAMwAawBuAIIAawCCAH0A5QDVANQA1QC8ALsAeAB9AHcAdwB9AHwAjgCcAI8AjwCcAJ0AnACQAJ0AnQCQAJEAjwCRAJAAjwCQAI4AvgDAAKIAqgCJAKUA5gDbANkA5gDyANsA8gD3AN4A9gDiAPcA9wDiAN4A4gDjAN4A4gDOAN4A3gDOAM8AzwDFAMYAxgDFAKUAtgCzAKUAjQCcAI4AaABOAFgAUQBUAEQAUQBEAD8AWABKAFkAPwBDAD4A9gDqAOIAxQDKALMAygC2ALMArQCMAKkAjAB2AHMAUQBDAFQA4gDRAM4AAgEFAf4AAgH+APEA0QDKAM4AzgDKAMUA+wAEAQIBBAEFAQIBBAH1AP4ABAH+AAUB/gD1APYA9QDqAPYA4QDqAPUA6gDhAOIA4QDJANEA4QDRAOIA0QDJAMoAyQC1ALYAyQC2AMoAtQCpALYAqACsAKkAqQCsAK0ArACXAK0ArQCXAIwAaQB2AIwAdgBpAHMAcwBnAGgAZwBbAGgAWwBNAE4AQgBUAEMATQA7ADwATQA8AE4AOwAvADwAPAAvADAALwArACwALwAsADAAHwAsACQAHgAfACQAHgAPABUAHgAVAB8ABwALABMADwAQABUAAAH7APoAtQCsAKgALgArAC8AKQArAC4AGwAPAB4ADQAPABsADwAEABAALgAvADsAGwAeACQAOQA7AE0AOQBNAEkAJgAoAC0AKAApAC4AIgAbACgAIgAoACYAKQAbACQAGwApACgACAAEAA8AKAAuADkAGAAbACIAEwANABgAGAANABsAAQEDAQQBAQEEAfsA+gD/AAAB/wDwAPsA/wD7AAAB8AABAfsAAwH1AAQB0gDWANMA0wDWANcAtQCrAKwAlwCLAGkAZwBpAHIAZgBbAGcAWgBbAGYATABbAFoASABNAEwASAA5AEkAOAA5AEgANQA5ADgANgA5ADUAMwAtADIAMwAoADIAMgAoADUAKAA2ADUALQAoADMAEwAKABgACgAMAA0ACgANABMADAACAAgADAAIAA0AAgAEAAgAAgADAAgA+gD5AP8A+QDwAP8A/QD1AAMB/QD0APUA9ADpAPUA9QDpAOEA6QDgAOEA4ADQAOEA4QDQAMkA0ADIAMkAyACnAMkAyQCnALUAtQCnAKsAqwCLAJcAqwCXAKwAiwB1AGkAdQByAGkAcgBmAGcASABaAFcAQQBTAEIA8AADAQEBNQBIAEYABQACAAoACgACAAwAAAACAAUA8AD9AAMBwwDIANAAiwByAHUARgBXAFUAMgBGAEEAMgA1AEYA6wD4APkA+ADwAPkA7wD8APAA8AD8AP0A/AD0AP0A8wD0APwA1gDlAOwA7ADlAOsA1QDlANYAywDVANYAywDWANIAtwC8AMsAywC8ANUAwwDQAM0AwgDIAMMAeQB4AJgApwCLAKsAhwCLAKYApgCLAKcAhwCKAIsAhwByAIsAcQByAIcAXwBeAGsAYwBXAHAAVwBmAHAAcABmAHIAXwBVAF4AXgBVAGIAVQBXAGIAYgBXAGMAUwBVAF8AUwBFAFUAPQBTAE8AUgBFAFMAQABBAFMAUwBAAFIAQABFAFIARgBVAEUAQQBGAEAAQABGAEUA6wDvAPgA+ADvAPAA7wDzAPwA8wDoAPQA9ADoAOkA6ADfAOkA6QDfAOAA3wDDANAA3wDQAOAAzQDCAMMAwgDHAMgAxwC0AKcAxwCnAMgAtACmAKcAcQBwAHIAXgBiAG4AXgBuAGsAYgBjAG4AbgBjAHAAPQBSAFMAPQBAAFIAsgC0AMIAwgC0AMcA5QDnAO8A5QDvAOsA5wDzAO8A5wDoAPMA3wDNAMMAcABxAIUAhQBxAIcA3QDNAN8ApACmALIAsgCmALQAbgBwAIUAbgCFAIIA1ADnAOUA5wDcAOgA1ADaAOcA2gDcAOcA6ADdAN8A3ADdAOgAwQDCAMwAzADCAM0AvwDCAMEAmgCZALsAmgC7ALwAngCjAL8AvwCjAMIAowCyAMIAowCkALIAdwCaAHgAdwB8AJoAmgB8AJkAowCTAKQAkwCHAKQApACHAKYAlACHAJMAhACFAJMAhQCUAJMAhQCHAJQAggCFAIQAggCEAIEAfQCCAIEAfQCBAHwAuwDUANUA3ADMAN0AvwDBAMwAmQCeALsAuwCeAL8AfACBAJ4AfACeAJkAgQCTAKMAgQCjAJ4AgQCEAJMAuwDaANQAuwC/ANoAvwDMANoA2gDMANwA';
/* ===== END js/62c-aqua-v156-model-eelbeast.js ===== */

/* ===== BEGIN js/62d-aqua-v156-model-leviathan.js ===== */
"use strict";
(globalThis.__AQUA_V156_MODELS||(globalThis.__AQUA_V156_MODELS={})).leviathan='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HAAaAAgAHAAIACAAFwAVABoAFwAaABsAFQAZABoAFQAUABkANQAVABcANQAyABUAMgA0ABUANAA2ABUAFQA2ABQAIAAkACMAIAAIACMAIwBsAEIAIwBsAEAAHwA8AD4AGwAcACAAIQA9ACIAPQAhACQAIQAgACQAeAB0AH8AdABIAH8AAwAKAAIASwAnAHMAcwB2AEsAdgB9AEsASwBzAHwADAAOAA0AcwB9AHYASwB9AHMAIQAiACAAIgAhAB0AHQAhABsAFwAdABsANwAdABcANwA6AB0ALgBXADAAVwAxADAAMQA1ADAALwA0ADAAWgA1ADEAWgBfADUAUgBaAFcAVwBaADEAWgBSADEAXwBaAIoAIQAgABsAHAAgABoAIAAIABoAMAA1ADIAMAAyADQALgAwAC8ALgAvAC0ALwA0AFwAXAA0AF4APQBCAEEAPwBCAD0APwBuAEIAPQBBACQAPwBvAG4ADwAqAE4ADwAoACoAKgAoAE4ATgCAACsACAAkACMAGQA5ABQAOQA2ABQANAA2AF4ANgA5AGIAYgA5AGQAYgBkAJEAZAA5ADwAZAA8AGgAXgC5ALcAXgBiALkAXgBiADYANgBiAGQANgBkADkAGgAZAB8AGQAeAB8ADwBKACgADwBOAEoAKwAqAE4AKAAqAEoAKgBOAEoATgCAAEoASgCAAHoASgBOACgAOgBmAB0AZgBlAB0AHQAiADsAHQA6ACIAOgBmAGoAOgBqACIAIgBqADsAagA9ACIAPQBqAGkAPQBpAD8AYwCSAJAAkACSAGcAZgA7AGoAHQA7AGYAIgA9AGkAOgBmAGcAYwCQAGcAYwBnAJIAMwA1AF8AaQA/AG0AbwBuAJ0AbgCcAJ0AbgBCAJwAPwBvAG0ANwAXADUAYAAzAGEAMwBfAGEAYAA3ADMAYABjADcANwA1ADMAYQBfAI0AXwC1ALYAjQBfALYAjQC2ALIAsgC2AN0A3QCxAOIAsgCxAN0AIwBBAEIAQAAjAEIAQgBsAEAAIwBsAD4AbABAAD4AIwA+AB8AQgCbAGwAbACbAHAAQACaAD4APgCaAJYAJABBACMAQgBwAJsAQgBsAHAAbABAAHAAcABAAJoAmwBwAMUAxQBwAMYAxQDGAMcAcACaAMYAxgCaAMUAPABoAJYAUAAtACoAKgAuACwALgAqAC0AUAAuAC0ALgAsAC0ATwBOAIEATwBQAE4AUAAqAE4AgQCCAE8AewBPAE4AgAB5AHoAewBOAEoAegB5AEoAewBKAHkAeQB0AKMAeQCjAKQApADPAAYBUAAqAC4AgQBQAE8AEwAqACwALAAqAC0ALQAvAFYAEwAtACoALAAtABMAOQA8AB4APACWAD4AZACRAJUAZACVAGgAYgCPAJEAlQC/AGgAaAC/AMAAKwBWACoAKgBWAC0ALwBeADQALwBcAF4AXACMAF4AKwCAAFYAVgBZAFwAVgCAAFkAiwCMAFwAeQB0AEgAgAB5AEgAjAC0ALcAjAC3AF4AXACLALQAjACLALQAKgAtACsAOgCSAGcAawCZAG0AawCUAJkAlADCAJkAZwCSAL4AlAD0AMIAmQDCAPQA9AD3AMIA8wD3APQANwBnADoANwCOAJAANwCQAGcAZwCQAI4AZwCOAGUAOgA7AGYAZgBnAJIAagA/AGkAbQA/AGoAagAiAGkAagBpAG0AZwBqAGYAagBlADsAOwBpAGoAZgBnAGUAZgBlAGoAZQCTAGkAZQBpADsAPwBvAGkAYABhAGMAYABhAF8AYABfADMAXQBgAF8AYAAzAGMAMwA3AGMAOgBlAGYAOgAdAGUAXQCNAF8AWwBdAF8ANQBdAFsAbQCZAMEAbQCeAG8AbwCeAJ0AbQDBAJ4AwQCZAJ0AnQDBAMgA+gD7AJ0A+gDIAPsAnACbAG4AnACdAJsAmwCdAKAAoADHAJsAnQD7AMcAoACdAMcAUgBRAIIAUQBPAIIAUQBQAE8AUQBQAFcAUAAuAFcALwBWAFwAUQBXAFIAggCFAFIAggDWAIUAhQDWANkAVwAuAFEALgBQAFEAUQCCAFAAUACCAE8AcACbAMYAxwDFAHAAxQDHAJsAmwDFAMYAcADFAJoAmgCWAMMAKAAPAEcAaACWAJgAlgCaAMQAmgDFAMQAxADDAJYAaACYAMMAaADDAMAAwwDEAPYA+AD2AMQAZABoAJEAaACVAJEALQBWACsAggDUAIEAggDVANQAgQDRAHsAgQDUANEA0QDQAHsAewDQAHkA0ADPAHkAeQDPAKQAzwDQAKQAowCkAHQAdACjAHcAowDMAHcAdwCjAKIAdwCiAHYAdgCiAM4AdgDOAHMAcwDOAM0AcwDNAHUAdQDNAKEA1AAJAdEA0QDPANAA0ADPAAYBBgEBAaQApAABAaMAowABAcwAowDMAKIAogCjAAABogAAAc4AzgAAAQUBzgAFAf8AzQAEAaEABAHLAKEAoQDLAAMBowABAQABBgHPANEA0QA3AQYBAAE2AQUB/wA2ATUB/wA1AQQBNQE0AQQBBAEDAcsABAE0AQMBMgE3ATEBLQEyATEBNAE1ATkBAwE0ATkBOQF4AQMBeAF2AQMBAwF2ATMBcwB1AKEAzQBzAKEAzgCiAP8ABQH/ADYB/wAEATYBNgEEATUBBAHLADQBywADATQBywAzAQMBNAF5ATkBOQF4AXkBRQBxAHMAcQBFAHIAcQByAHMARQBzAHIAcgAnAEUAkADuAJIAkgDuAPAA7gCQAOwA8ABcASIBXAFgASIBXAFbAWABZwBrAGoAlABrAGcAZwC+AJQAawBtAJQAbQCZAJQAvgCUAPMAlAD0APMAZwBlAGoAawBqAJkAmQBqAG0AawBtAGoAsgDmAI0AYwCOADcAYQCNALgAkgDwAL4AvgDwACIBvgAiAfMAZwCTAJIAZwBlAJMA8ACSAJMAkwC9APAAkwCXAL0A8AC9APEAXQBgADMAYwCOALsAjgA3AGcAZwCSAGUAkgC9AGUAZQC9AJMAvgDwAL0AkgC+AL0AOgBlAGcAvQDvAL4AvQCTAPEA8AC9ACIBagBpAGUAZQBpAJcAZQCXAJMAaQBvAJcAbwCeAJcAagBvAG0AbwBqAGkAbwCZAG0AbwCeAJkA8wAqAWkBJAHzAGkBXQAzAF8AYQC4AGMAuAC7AGMAPwBvAJ0AWACFAFIAhQCKAFIAigBaAFIAXQBfAIoArACKAFgAWACKAIUAaQCTAJcA8QDBAJ4AmQCeAMIAwgCeAMEAkwDxAJcA8QCeAJcA8wD3ACcB8QAnAfcA9wDCAMEAwQDxAPcAbgCbAEIAnABCAJsAmwDFAKAAoADFAMcAyACdAPoA+gD7ACwB+wDHACwBLAHHACsBxwD5APsAKwHHAPsA+wArAWsBSgB6AE4AegCAAE4AgABIAFkASAB/AE0AfgBMAE0ATAB+AH0AewBPAIEASgBPAHsASgBOAE8AdAB3AHgAeAB3AH8AdwB+AH8AfgBNAH8AdwB2AH4AdgB9AH4AtwC5AOcA5wC5AOoAtwDnALQA5wDlALQA5wAbAegAGwHoAOsA5wDqAOsA5wDrAOgA6AAYAecA5wAYAeUA5QAYARYBGwFQARgBGwEYAegAUAFFARYBFgEYAVABRQFMARYBRQFQARsB5wDlAOgA5QAYAegA5QDgABYB4QAVAeAA4AAVAUsB4ABLARYBFgFLAUwBYgCPALkAkQCVAL8AuQCPAOoAkQC/ALwAjwDqAJEAkQC8APIAkQDyAL8AOQBkAGgAOQBoADwAXACJAFkAVQBIAFkASABVAE0AVQBUAE0ATQBTAEwAWQCJAFUAiQCIAFUAVQCIAFQAVACIAIcATQBUAFMAVACHAFMATABTAIMAUwCEAIMATACDAEsAhABTAIYAhwCGAFMArgCvAIMAsACvAK4ASwCDAHwAfACDAKsAfACrAKcAqwCDAK0AdQB8AKcApwCrAKYApgCrAKoAqgCrAK0AqgCtANgArQDcANgAdQCnAKUApwCmAKUApgCqANMAqgDYANMApQCmANMAygClANIApQDTANIAqgANAdgA0wALAQcB0gDTAAcBygDSAP4A/gDSAAcBXACJAIsAiQCIAIsAiwCIALMAiwCzALQAtACzAOUA5QCzAOAASAApAE0AhgCuALAArgCDALAAswCIAOAAiADhAOAAiACHAOEAhwDgAOEAhwDfAOAAsACDAK8AsADeAK8ArwCDAN4AgwDcAN4ArQDcAIMA4ADfAOQA4ADkABQB3wCwAOQA3ADYABAB2AANAQ8BSQB4AHQASQBIAHgASAB/AHgASQB0AH8ASQB/ACkAdQClAKEAyQClAMoAygD9AMkAyQDKAP4A/QDJAP4ASwBMAH0AcwB1AHwAzgD/AM0AzQD/AAQBdwBNAH4AdwCiAMwAgwCGAIQAgwCuAIYAhwCGAN8A3wCGALAAdQBLAHwAywChAKUAzgDNAAQBzgAEAf8ApQD+AMsAyQD+AKUA/gAvAcsAywAvAQMBAwEvATMB/gD9AC8BMwEvAXYBSwCrAIMASwB8AKsApwDTAKYA0wALAQ0BdQDLAKEApQD9AMkA/QClAP4A/gAzAS8BywAzAf4AkACSAPAAkADwAO4A7gDwAOwAIgHzAGAB8wAkAWABmQDBAMIA9wCeAPEAmQCeAMEAwQCeAPcAjQDmALgA5gCyALgAvQDxACcB8QDCAPcAwQDCAPEAuwC6AI4AjgC6AJAAngBtAJkAmQDCAPcAlwDxAL0AmQD3AMEA9wDzAPEA9wDCAPMA8wDCACoBwgDBACkBwgApASoBwQDIACkBKQHIAPoAKQH6AGYB+gBpAWYB+gAsAWYBigCFAFoAhQBSAFoAigBdALUAtQBdAF8ArABYAIUAhQCKAKwAtQC2AIoAtgCKALIAsgCKAOIA4gCxALIAggDVANYA1gDVANkA1QAOAdkA1gDZAA4BmwDHAHAAeQCkANAApAAGAdAAmgDDAMUAwwDEAMUAlgBoAMMAxAD4AMUAwwDAAPYAwAD1APYAvwDyAPUAvwD1AMAAmACWAMMAvwDAAPIAwAD1APIA+QD2APgA+QAoAfYA+QAoAfgA9QD2ACUB9gAoASUBiQCIALMAtADlAOAAtADgALMAswDhAIgAswDgAOEAiADgAIcAhwCwAIYAhwDfALAAsADkAOMAogAAAcwAzAAAAQEBAAEFAf8AAQEAATsBgwDeAK0ArQDeANwA3gAQAdwAlAC+APQAvgDzAPQAuwDsALgAsgDmABIBkgCQAL4AkAC6AL4A7ACQAL4AugDvAL4AugC9AO8AuwCQALoAigCxAOIAigC2ALEAtgCyALEA4gARARcBFwERARoBigCsALEAuwC6AOwA7AC6AO4AVAHmAFMBkAC9ALoAvgC9AJAAvgAiAe8AIgEhAe8AvgDzAPAA8ADzAPEAngDBAJ0AbQCdAMEAbwCdAG0AigCpALEAsQCpAOIAEQEaAVEB1QAJAQ4B1QDUAAkBCQFBAUIBCQFCAQ4BQgFBAYUBQQE/AYUBCQEIAT8BCQE/AUEBWABSAKwAUgCFAKwAqQCsAIUAqQCFAIIArACpAIIArACCAIUArACpANoArACKAKkA1gDaANkA2gCpANkAqQDiANkA2QDiAA4B4gAXAQ4BqQCCANYAggDZANYAggCFANkAxwD5AMYAxgD5AMUA6wDqABwB6gAfAesA6gC8AB8B6gDtALwAvADyACUBvAAlAR8B8gD1ACUB6wAfARwBHAEfASABcwBLAHUAsgASAREBsgARAd0ADAESAREB3QARARIBEQHiAEcBEQFGAUcB7ADwAL4A3QARAeIAEgFUAeYAkACSAOwA7ACSAL4A7AC+AO4A7gC+APAAIgG9ACEBIQG9ACcBIgEhAfMAIQEnAfMAIgEkAfMAJAEiAWABwgAqAcEAwQAqASkBwgDIAMEA8wAkASoBKgEkAWkBJAFkAWkBaQFkAWYBKQFpAfoAKQFmAWkB7gC6AB0BugAeAR0BugDvAB4B7gAdAR4B5gBSAVMB5gAdAVIB7gAdAeYAUgFTAR0B7wBfASEBHQFfAVkBHQEhAV8BXwGRAVkBrACpANYArADWANoA2gCKAKwAigDaAKkA2QAOARcB2QAXAeIAuADpAOYA8ADzACIBIgEnAb0AIgHzACcB2QDaAA4BqQDaANYAugAdAe8A7wAdAR4BKgFpAWYBKgFmASkBZgErASwBZgFrASsBxgD4APkAxQD4AMYA+wD5ACsBKwH5AGoBKwFoAZYBagFnASsBxQD5APgA+wAsASsBawFoASsBHwHrACAB6wAcASABIAFhASUBJQFhAWIBGwHrABwBVQEZAVcBGQEbAVcBGwEcAVcBVwEgAV0BXQFhAWIBXQFiAZIBjQGPAZABjwFdAZMBkgGTAV0B6gCRALwAvwDyALwANgF6AXMBNgE6AXoBegE6AXMBcwE6ATYBsAATAeMAsADeABMBFAHkABMB5ADjABMBSwEVAUoBFQHgAEoB4AAUAUoBFAETAUoBSgETAUkBEwFIAUkBEwHeAEgBiAFLAUoBiAFKAYIBNQE0AToBNQE6AXkB3QAMAbIAsgAMARIBsgASAd0A3QASAQwB7AC4AOYA5gDuAOwA7gDwACIBXAHuAFsBWwHuACIB8ABgASIBIgFgAVsBWwFgAVoBWgFgAV8BEQFGARoBRgFRARoBRgFSAVEBiwFVAVEBugAhAR0B7wAhAboAHQEhAe8ADgFCARcBDgHVANYAUQEXARoBFwFOAUIBFwFGAU4BFwEaARkBQgFOAU0BTgEZAU0BRQFNARsBTQEZARsB+QBqAWcB+QBnASgBYgEoAWcBYgFnAWUBJQEoAWIBZwFoAZYBaAFnASsBYgFlAZUBZwGVAWUBkwGWAaQBkwGVAZYBlgGVAWcBkwGSAZUB0QAIAQkBBgEBAT4BAQE9AT4BAQEwATEBPAEBATsBPgE9AT8BPQF7ATwBPAF+AXsBPAE7AXsBOwF+AXsBAAF3ATsBAAE2AXcBNgF6AXcBdwF6ATsBOwF6AX4BNAE5AToBOgE5AXkBOgF5AXoBPwE+AQYBAAE7ATYBOwF6ATYBNQE6ATkBeQF4ATQBNAF4ATkB9gAoAfgAVwFdARwBXQEgARwBVwGPAV0BHwEgASUBYQFdAZIBYQGSAWIBRQFCAYUBigFFAYUBRQGKAUwBigGEAUwBFwEZAU4BGAFFAVABGAEWAUUBTQFCAUUBhQGKAYQB4AAWARUBFgFLARUBSwFKAeAA3gBJAUgBEwFJAd4AiQGIAUsBgwGCAYgBSAHeABABEAFDAUgBEAHYAEMBQwHYAA8B2AAQAQ8BQwEPARAB2AAPAUABDQHYAEABCwE4AQcBDQE4AQsB/gAHAS8B0gA4AQcBfQE4AUABQAE4AQ0BLwEHATgB0wDSAAsB2ADTAA0BCwHSAAcB/gA4AQcBLwE4Af4A5gBTARIBEgFTAVQB7gBcAfAA7gAiAVwBEgFPAREBUwFSAVYBEgFPAVQBTwFTAVQBTwFHAVMBUwFSAVQBIQFfAWABIgEhAWABHQFZASEBIQFZAV8BIgFfASEBIgFgAV8BXwFaAVkBJgEjASQBIQEnASQBJwFkASQBZAFmASQBJAEmAWMBZgEkAWMBZgFjAWgBaAGWAWYBIQEkAV8BXwEkASMBXwEjAV4BIwEmAV4BXgEmAWMBXwFeAZEBkAFeAY8BXwFeASQBXgEjASQBkQGQAV4BaAGWAWMBFwEOAUYBRgFOARkBRgEZARcBFwFGARoBYwGWAZMBlgFoAWsBlgErAWcBZwFiAZUBYgGSAWUB0QA3AQgBCAE/AQYBBgEyATcBNwEIAQYBHAEgAVcBJQH1AGIB9QAoAWIBJQEoAfUASAFDAUQBSQGHAYEBSQGGAYcBSQFIAYYBRAGGAUgBhgFDAUABhgFEAUMBDwFAAUMBhAFMAYkBiQFMAUsBSgGBAYIBSgFJAYEBgQGHAYYBgwGCAX4BGgFVARkBUgFGAUcBUQGLAVIBiwGNAVUBUwFSAUcBHQFWAVIBEQFPAUcBUQGLAY0BXwFaAZEBWgGOAZEBjgGNAZEBjQGRAZABjQGQAY4BkAGRAY4BWwFaAV8BWwFfAWABIQFfAScBJwFfAWQBIQFkAV8BZAEhAScBZgFoAWsBXwEkAWQBJAFjAV8BXwFjAV4BEQFRAUYBHQFZAVgBUQFSAVgBUQFYAYsBWAGNAYsBWAFeAZABkAGNAVgBUgEdAVgBWQGRAVgBWQGOAZEBWAGRAV4BoQGNAakBWAGQAZEBWQFaAY4BXgGQAWMBkAGTAWMBZgFjAZYBGgFGAU0BFwFGAU0BUQEaAVUBjQFVAVcBXgGTAZABXgFjAZMBPwFBAQgBQQEIAQkBPQE/AQgBPwE9AXwBPQE8AXwBfAE8AXsBPwF/AT0BPQF/AXwBfwE/AXwBXQEgAWEBkgGVAWIBLQFvAWwBLQEuATEBLgEwATEBMgExAQYBLQEuAXUBMQF1AS4BLQF1ATEBAQF7AT0BAQF0AXsBdQGfAXQBLQGcAS4BLQFwAZwBAQF0ATwBewF8AXQBPAF7AXQBnwGeAXQBNgE1AToBgAFAAYYBeAF9AUABeAE4AX0BPwF/AYUBfwGEAYUBfwF8AYQBhAGDAYkBhAFLAUwBhAGJAUsBfAGDAYQBgwGIAYkBfgF6AYEBfgGBAYIBSQFKAYIBggGBAUkBeQGAAYEBgQGAAYcBgAGGAYcBgAF5AUABQAF5AXgBdgEvAXgBLwE4AXgBfAF7AYMBegF5AYEBfgGCAXoBggGBAXoBegGBAYABegGAAXkBgAGBAYYBeQGAAXgBgAFAAXgBdgE4AS8BeAE4AXYBYAFfAWQBYAFkASQBYAEkAV8BXwGiAWQBogFkAaMBZAFmAaMBowFmAacBZgGmAacBowGnAaYBXwGOAVoBXwGRAY4BXwGiAZEBogGQAZEBogGqAZABogGjAaoBqgGTAZABUQFVAU0BZgGWAaYBlgGkAWgBlgGkAaUBiwFRAU0BiwFNAVUBjQFXAY8BkAGPAZMBfwE/AYQBPwGFAYQBLQEuAXABLgGcAXABnAGfAZ4BcgGaAZsBcgGbAXMBcwGbAZ0BcgFxAZsBcgFzAXEBcgGdAZsBcgFzAZ0BkwGkAaoBowGqAaUBpQGjAaYBpQGqAZYBpgGlAZYBpAGlAaoBnwF1AZ4BdQF0AZ4BewGoAYMBfgF7AYMBcQGbAZ0BcQGdAXIBpgGWAaoBowGmAaoBewF+AagBfgGDAagB';
/* ===== END js/62d-aqua-v156-model-leviathan.js ===== */

/* ===== BEGIN js/62-aqua-creatures-v156.js ===== */
"use strict";

/* Aqua Rift v156 — remove coral podiums + user-uploaded water creatures.
   Loaded after v155. It preserves the approved 2,800-group reef, fish,
   jellyfish, road/glass/water and Verdant v142. */
(function(){
  const AQUA_ID='aqua',VERSION=156,TWO_PI=Math.PI*2,BASE_GLASS_R=8.8;
  const MD=globalThis.__AQUA_V156_MODELS||{};
  const UPLOADED_MODELS={
    aqSiren156:{n:297,ni:1791,lo:[-0.2048635584702408,-0.500346448159721,-0.157304049530409],hi:[0.19499994557326614,0.5035273487837612,0.1582223206443559],col:[.22,.50,.58,.035],b:MD.siren||''},
    aqCrawler156:{n:431,ni:2616,lo:[-0.3938077644609183,-0.37779584510752395,-0.2173925832484013],hi:[0.4052831446600837,0.3826089346107078,0.2196102663015535],col:[.45,.31,.57,.025],b:MD.crawler||''},
    aqEel156:{n:262,ni:1551,lo:[-0.948686973907773,-0.19548850108675273,-0.225909791262309],hi:[0.9722856298941878,0.19919365194850955,0.22820306134248913],col:[.28,.48,.43,.030],b:MD.eelbeast||''},
    aqLeviathan156:{n:427,ni:3558,lo:[-0.2373310650479686,-0.45092079056031775,-0.47354320286788143],hi:[0.23509335232920367,0.4320449831987989,0.48820910958309044],col:[.48,.27,.40,.045],b:MD.leviathan||''}
  };

  /* v155 still created the visible dark platforms with three very flat box()
     calls inside moundBase(). Filter only those calls. Structural Aqua tunnel
     rails (h=.35) and every non-Aqua box remain untouched. */
  let platformBoxesSuppressed=0;
  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV156NoPodiums){
    const originalBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      if(h<=.12&&d<=.60&&w<=2.10){
        const stack=(new Error()).stack||'';
        if(stack.indexOf('moundBase')>=0){platformBoxesSuppressed++;return;}
      }
      return originalBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV156NoPodiums=true;
  }

  function registerUploadedCreature(key,d){
    try{
      if(!d.b)throw new Error('model data missing');
      const raw=Uint8Array.from(atob(d.b),c=>c.charCodeAt(0));
      const words=new Uint16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),nv=d.n,ni=d.ni;
      if(words.length!==nv*3+ni)throw new Error('model payload size mismatch');
      const pos=new Float32Array(nv*3),nrm=new Float32Array(nv*3),idx=new Uint32Array(ni);
      for(let v=0;v<nv;v++)for(let j=0;j<3;j++)pos[v*3+j]=d.lo[j]+(d.hi[j]-d.lo[j])*(words[v*3+j]/65535);
      const io=nv*3;for(let i=0;i<ni;i++)idx[i]=words[io+i];
      for(let i=0;i<ni;i+=3){
        const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3,
          ax=pos[ib]-pos[ia],ay=pos[ib+1]-pos[ia+1],az=pos[ib+2]-pos[ia+2],
          bx=pos[ic]-pos[ia],by=pos[ic+1]-pos[ia+1],bz=pos[ic+2]-pos[ia+2],
          nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
        for(const o of [ia,ib,ic]){nrm[o]+=nx;nrm[o+1]+=ny;nrm[o+2]+=nz;}
      }
      for(let v=0;v<nv;v++){
        const o=v*3,L=Math.hypot(nrm[o],nrm[o+1],nrm[o+2])||1;
        nrm[o]/=L;nrm[o+1]/=L;nrm[o+2]/=L;
      }
      const col=new Float32Array(nv*4),limb=new Float32Array(nv);
      for(let v=0;v<nv;v++){col[v*4]=d.col[0];col[v*4+1]=d.col[1];col[v*4+2]=d.col[2];col[v*4+3]=d.col[3];}
      const mk=(a,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
      GLCRE[key]={ready:true,N:1,frames:[{pos:mk(pos),nrm:mk(nrm)}],col:mk(col),limbB:mk(limb),idxB:mk(idx,gl.ELEMENT_ARRAY_BUFFER),count:idx.length};
    }catch(e){console.warn('Aqua v156 uploaded creature failed:',key,e.message);}
  }

  const previousInit=initGL;
  initGL=function(){
    const r=previousInit();
    for(const key in UPLOADED_MODELS)registerUploadedCreature(key,UPLOADED_MODELS[key]);
    return r;
  };

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;
    };
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,i};};
    return {n,radiusAt,pose};
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    if(sc&&sc.id===AQUA_ID)platformBoxesSuppressed=0;
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    const H=helpers(w),n=H.n;if(!n||!w.actors)return w;
    const rnd=mulberry32((sc.seed||14373)+156156),before=w.actors.length;
    const creatureCounts={siren:0,crawler:0,eelbeast:0,leviathan:0};
    const addCreature=(kind,key,count,opt)=>{
      for(let q=0;q<count;q++){
        const i=((q+.31+rnd()*.38)*n/count)|0,side=((q+(opt.flip||0))&1)?1:-1,
          glass=H.radiusAt(i),minOff=Math.max(opt.off0,glass+6),
          p=H.pose(i,side*(minOff+rnd()*(Math.max(minOff+.1,opt.off1)-minOff))),
          gy=typeof w.groundAt==='function'?w.groundAt(p.x,p.z):w.ry[i]-8,
          ph=rnd()*TWO_PI,r=opt.r0+rnd()*(opt.r1-opt.r0),alt=opt.a0+rnd()*(opt.a1-opt.a0),
          k=opt.k0+rnd()*(opt.k1-opt.k0),dir=rnd()<.5?-1:1;
        w.actors.push({type:'drone',gcre:key,mesh:'drone',aquaCreatureV156:true,creatureClass:kind,
          cx:p.x,cz:p.z,gy,r,alt,ph,w:dir*(opt.w0+rnd()*(opt.w1-opt.w0)),
          px:p.x+Math.cos(ph)*r,py:gy+alt,pz:p.z+Math.sin(ph)*r,
          yaw:ph+(opt.yawBias||0),pitch:opt.pitch||0,k,emiss:opt.emiss||.82,gph:ph});
        creatureCounts[kind]++;
      }
    };
    addCreature('siren','aqSiren156',10,{off0:34,off1:88,r0:3,r1:10,a0:8,a1:28,k0:3.2,k1:5.4,w0:.004,w1:.010,emiss:.86});
    addCreature('crawler','aqCrawler156',8,{off0:42,off1:98,r0:4,r1:12,a0:5,a1:22,k0:4.2,k1:6.8,w0:.003,w1:.008,emiss:.78,flip:1});
    addCreature('eelbeast','aqEel156',16,{off0:28,off1:82,r0:5,r1:14,a0:7,a1:30,k0:2.5,k1:4.4,w0:.006,w1:.014,emiss:.80,yawBias:Math.PI/2});
    addCreature('leviathan','aqLeviathan156',2,{off0:82,off1:145,r0:8,r1:20,a0:12,a1:34,k0:10,k1:15,w0:.0015,w1:.0035,emiss:.72});

    const jelly=w.actors.filter(a=>a&&a.aquaJellyV152===true).length;
    const fish=w.actors.filter(a=>a&&a.aquaFish===true).length;
    const prior=w.__aquaV155||{};
    w.__aquaV156={version:VERSION,reefBaseBoxesRemoved:true,reefBaseCylindersRemoved:true,
      platformBoxesSuppressed,uploadedUserModels:true,customCreatureCount:36,creatureCounts,
      heroLeviathans:creatureCounts.leviathan,coralGroups:prior.coralGroups||2800,
      nearGroups:prior.nearGroups||700,midGroups:prior.midGroups||1400,farGroups:prior.farGroups||700,
      heroGroups:prior.heroGroups||280,primaryHeroes:prior.primaryHeroes||140,secondaryHeroes:prior.secondaryHeroes||140,
      moundGroups:prior.moundGroups||2800,accentGroups:prior.accentGroups||840,
      jellyPreserved:jelly,properProjectJellyPreserved:jelly===60,fishPreserved:fish,
      priorActorCount:before,existingActorsPreserved:true,roadUnchanged:true,glassUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v156 no-podium reef + uploaded creatures:',w.__aquaV156);
    return w;
  };

  globalThis.__aquaV156Spec={VERSION,customCreatureCount:36,creatureCounts:{siren:10,crawler:8,eelbeast:16,leviathan:2},reefBaseBoxesRemoved:true,reefBaseCylindersRemoved:true};
})();
/* ===== END js/62-aqua-creatures-v156.js ===== */

/* ===== BEGIN js/63-aqua-visible-creatures-v157.js ===== */
"use strict";

/* Aqua Rift v157 — make uploaded creatures clearly visible + hard-remove
   remaining flat coral podiums. Loaded after v156.

   v156 correctly imported the four user-provided creature meshes but placed
   them too far from the glass to read during normal riding. Its podium filter
   also depended on Error().stack containing moundBase, which is not reliable
   in the browser. v157 fixes both issues without touching fish, jellyfish,
   road, glass, water or Verdant.
*/
(function(){
  const AQUA_ID='aqua',VERSION=157,TWO_PI=Math.PI*2,BASE_GLASS_R=8.8;
  let aquaBuildActive=false,flatBoxesSuppressed=0;

  /* Hard podium suppression: while Aqua is being built, reject every very
     flat decorative box matching the v154/v155 reef-base dimensions. This is
     deliberately dimension-based, not stack-trace-based. Structural tunnel
     rails are taller (h=.35/.48) and therefore pass through untouched. */
  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV157NoFlatBases){
    const oldBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      if(aquaBuildActive && h<=.14 && w<=2.25 && d<=1.05){flatBoxesSuppressed++;return;}
      return oldBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV157NoFlatBases=true;
  }

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;
    };
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,i};};
    return {n,routeKm,radiusAt,pose};
  }

  const KM={
    eelbeast:[.15,.45,.80,1.15,1.55,2.05,2.45,2.85,3.30,3.75,4.20,4.65,5.10,5.55,6.15,6.70],
    siren:[.30,.95,1.75,2.45,3.15,3.85,4.55,5.25,5.95,6.65],
    crawler:[.55,1.40,2.25,3.10,3.95,4.80,5.65,6.50],
    leviathan:[1.65,5.70]
  };
  const OPT={
    eelbeast:{off0:2.2,off1:6.5,y0:1.0,y1:5.8,r0:1.2,r1:3.8,k0:3.0,k1:4.7,w0:.010,w1:.020},
    siren:{off0:2.4,off1:7.0,y0:.8,y1:5.0,r0:1.0,r1:3.0,k0:3.5,k1:5.5,w0:.008,w1:.016},
    crawler:{off0:2.6,off1:7.5,y0:.3,y1:3.4,r0:.8,r1:2.6,k0:4.5,k1:7.0,w0:.006,w1:.013},
    leviathan:{off0:8.0,off1:15.0,y0:1.0,y1:7.0,r0:2.0,r1:5.0,k0:11.0,k1:16.0,w0:.0025,w1:.0050}
  };

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const isAqua=!!(sc&&sc.id===AQUA_ID);
    if(isAqua){aquaBuildActive=true;flatBoxesSuppressed=0;}
    let w;
    try{w=previousBuild(sc,onProgress);}finally{if(isAqua)aquaBuildActive=false;}
    if(!w||!isAqua||!w.actors)return w;

    const H=helpers(w),rnd=mulberry32((sc.seed||14373)+157157),byClass={};
    for(const a of w.actors)if(a&&a.aquaCreatureV156===true)(byClass[a.creatureClass]||(byClass[a.creatureClass]=[])).push(a);

    let moved=0;
    for(const kind of ['eelbeast','siren','crawler','leviathan']){
      const arr=byClass[kind]||[],kms=KM[kind],o=OPT[kind];
      for(let q=0;q<arr.length;q++){
        const a=arr[q],km=kms[q%kms.length]%H.routeKm,i=Math.max(0,Math.min(H.n-1,Math.round(km*1000/ROUTE_STEP))),
          side=(q&1)?1:-1,glass=H.radiusAt(i),off=glass+o.off0+rnd()*(o.off1-o.off0),p=H.pose(i,side*off),
          roadY=w.ry[i],ph=(q*1.713+rnd()*.7)%TWO_PI;
        a.cx=p.x;a.cz=p.z;a.gy=roadY;
        a.r=o.r0+rnd()*(o.r1-o.r0);
        a.alt=o.y0+rnd()*(o.y1-o.y0);
        a.ph=ph;a.gph=ph;
        a.w=(q&1?-1:1)*(o.w0+rnd()*(o.w1-o.w0));
        a.k=o.k0+rnd()*(o.k1-o.k0);
        a.px=a.cx+Math.cos(ph)*a.r;
        a.py=roadY+a.alt;
        a.pz=a.cz+Math.sin(ph)*a.r;
        a.yaw=ph+(kind==='eelbeast'?Math.PI/2:0);
        a.aquaVisibleCreatureV157=true;
        a.anchorKmV157=+km.toFixed(3);
        a.glassGapV157=+(off-glass).toFixed(2);
        moved++;
      }
    }

    const prior=w.__aquaV156||{};
    const c={eelbeast:(byClass.eelbeast||[]).length,siren:(byClass.siren||[]).length,
      crawler:(byClass.crawler||[]).length,leviathan:(byClass.leviathan||[]).length};
    w.__aquaV157={version:VERSION,hardFlatBaseSuppression:true,flatBoxesSuppressed,
      creaturesMovedNearGlass:true,visibleCreatureCount:moved,creatureCounts:c,
      encounterKm:KM,smallCreatureGlassGap:[2.2,7.5],leviathanGlassGap:[8,15],
      roadRelativeCreatureHeight:true,coralGroups:prior.coralGroups||2800,
      jellyPreserved:prior.jellyPreserved||60,fishPreserved:prior.fishPreserved||0,
      existingActorsPreserved:true,roadUnchanged:true,glassUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v157 visible close creatures + no flat bases:',w.__aquaV157);
    return w;
  };

  globalThis.__aquaV157Spec={VERSION,hardFlatBaseSuppression:true,visibleCreatureCount:36,
    firstEncountersKm:[.15,.30,.45,.55],leviathanKm:[1.65,5.70]};
})();
/* ===== END js/63-aqua-visible-creatures-v157.js ===== */

/* ===== BEGIN js/64-aqua-no-podium-v158.js ===== */
"use strict";

/* Aqua Rift v158 — remove the actual v155 reef podium blocks ----------------
   Visual feedback on v157 showed the dark rectangular coral bases were still
   present. Root cause: v155 moundBase() creates one irregular block per mound
   with h up to about .44, while v157 only suppressed boxes with h <= .14.

   v158 adds a second, deliberately narrow geometry filter that matches the
   complete v155 mound-block / ledge envelope. It stays active only while Aqua
   is being built, and it leaves larger tunnel/road structure boxes alone.
   Creature placement from v157 is preserved unchanged.
*/
(function(){
  const AQUA_ID='aqua',VERSION=158;
  let aquaBuildActive=false,podiumBoxesSuppressed=0;

  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV158NoPodiums){
    const oldBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      const reefPodium = aquaBuildActive &&
        y<=.15 && h<=.50 &&
        w>=.30 && w<=2.25 &&
        d>=.20 && d<=1.10 &&
        (em===undefined || em<=.0125);
      if(reefPodium){podiumBoxesSuppressed++;return;}
      return oldBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV158NoPodiums=true;
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const isAqua=!!(sc&&sc.id===AQUA_ID);
    if(isAqua){aquaBuildActive=true;podiumBoxesSuppressed=0;}
    let w;
    try{w=previousBuild(sc,onProgress);}finally{if(isAqua)aquaBuildActive=false;}
    if(!w||!isAqua)return w;

    const prior=w.__aquaV157||{};
    w.__aquaV158={
      version:VERSION,
      sourcePodiumRootCause:'v155 moundBase boxes up to h=.44',
      completeV155PodiumEnvelopeSuppression:true,
      podiumBoxesSuppressed,
      creaturesRemainNearGlass:prior.creaturesMovedNearGlass===true,
      visibleCreatureCount:prior.visibleCreatureCount||36,
      smallCreatureGlassGap:prior.smallCreatureGlassGap||[2.2,7.5],
      leviathanGlassGap:prior.leviathanGlassGap||[8,15],
      coralGroups:prior.coralGroups||2800,
      roadUnchanged:true,
      glassUnchanged:true,
      waterUnchanged:true,
      verdantUntouched:true
    };
    console.log('Aqua Rift v158 no podium blocks:',w.__aquaV158);
    return w;
  };

  globalThis.__aquaV158Spec={
    VERSION,
    completeV155PodiumEnvelopeSuppression:true,
    matchedHeightMax:.50,
    matchedWidth:[.30,2.25],
    matchedDepth:[.20,1.10],
    preservesV157CreaturePlacement:true
  };
})();
/* ===== END js/64-aqua-no-podium-v158.js ===== */

/* ===== BEGIN js/65-aqua-sand-ab-v159.js ===== */
"use strict";

/* Aqua Rift v159 — sand shoulder A/B experiment -----------------------------
   User requested two changes after visual validation of v158:
   1) remove the four user-uploaded creature families entirely;
   2) stop fighting the visible coral bases directly and instead bury/blend
      them into a textured seabed shoulder beside the road.

   A/B test along the lap:
     0.0–1.8 km  : Poly Haven Aerial Beach 01
     1.8–3.6 km  : Poly Haven Sand 03
     3.6–5.4 km  : Aerial Beach 01
     5.4–lap end : Sand 03

   Both source textures are CC0. During this experiment they are loaded from
   Poly Haven's 1K diffuse endpoints and conditioned through Lunar Ride's
   existing photo-texture pipeline (tile conditioning + derived normal map).
   The sand ribbons are separate GPU meshes and borrow the existing asphalt
   material shader only while they are drawn; the road asphalt is restored
   immediately afterwards.
*/
(function(){
  const AQUA_ID='aqua',VERSION=159,BASE_GLASS_R=8.8,SAND_STEP=2;
  const A_URL='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_beach_01/aerial_beach_01_diff_1k.jpg';
  const B_URL='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sand_03/sand_03_diff_1k.jpg';
  const SEGMENTS=[
    {from:0,to:1.8,tex:'Aerial Beach 01',key:'A'},
    {from:1.8,to:3.6,tex:'Sand 03',key:'B'},
    {from:3.6,to:5.4,tex:'Aerial Beach 01',key:'A'},
    {from:5.4,to:99,tex:'Sand 03',key:'B'}
  ];

  function meshOf(m){return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
    col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};}

  function radiusHelper(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    return i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}
      return r;
    };
  }

  function pAt(w,i,side,off,lift){
    const n=w.nMain;i=((i%n)+n)%n;
    const x=w.rx[i]-w.tz[i]*off*side,z=w.rz[i]+w.tx[i]*off*side;
    const gy=typeof w.groundAt==='function'?w.groundAt(x,z):w.ry[i]-8;
    return [x,gy+lift,z];
  }

  function sandKey(km,routeKm){
    km=((km%routeKm)+routeKm)%routeKm;
    if(km<1.8)return 'A';
    if(km<3.6)return 'B';
    if(km<5.4)return 'A';
    return 'B';
  }

  function buildSandShoulders(w,seed){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,radiusAt=radiusHelper(w),
      rnd=mulberry32((seed||14373)+159159),A=new MeshB(),B=new MeshB(),
      C=[.96,.93,.86],cross=[.35,4.2,10.2,19.5],baseLift=[.34,.82,.68,.30];
    let qa=0,qb=0;
    for(let i=0;i<n;i+=SAND_STEP){
      const j=(i+SAND_STEP)%n,km=((i+j)*.5)*ROUTE_STEP/1000,key=sandKey(km,routeKm),m=key==='A'?A:B;
      const ri=radiusAt(i),rj=radiusAt(j);
      for(const side of [-1,1]){
        const rowI=[],rowJ=[];
        for(let c=0;c<cross.length;c++){
          const wave=.10*Math.sin(i*.31+c*1.73+side*.8)+.06*(rnd()-.5),
            waveJ=.10*Math.sin(j*.31+c*1.73+side*.8)+.06*(rnd()-.5),
            li=Math.max(.22,baseLift[c]+wave),lj=Math.max(.22,baseLift[c]+waveJ);
          rowI.push(pAt(w,i,side,ri+cross[c],li));
          rowJ.push(pAt(w,j,side,rj+cross[c],lj));
        }
        for(let c=0;c<cross.length-1;c++)m.quad(rowI[c],rowJ[c],rowJ[c+1],rowI[c+1],C,.0);
        if(key==='A')qa+=cross.length-1;else qb+=cross.length-1;
      }
    }
    A.setTF(0,0,0,0,1);B.setTF(0,0,0,0,1);
    return {A:meshOf(A),B:meshOf(B),qa,qb,routeKm};
  }

  function loadRemote(url){
    return new Promise(res=>{
      const im=new Image();
      im.crossOrigin='anonymous';
      im.onload=()=>res(im);im.onerror=()=>res(null);im.src=url;
    });
  }

  async function loadSandTextures(){
    if(typeof gl==='undefined'||typeof conditionTile!=='function')return;
    try{
      const [a,b]=await Promise.all([loadRemote(A_URL),loadRemote(B_URL)]);
      TEX.sandSrc=TEX.sandSrc||{};
      if(a){const c=conditionTile(a,1024,.42,2.0,.28,.72);TEX.sandAA=glTexFromCanvas(c.albCanvas);TEX.sandAN=glTexFromData(c.nrm,1024);TEX.sandSrc.A='Aerial Beach 01 / Poly Haven CC0';}
      if(b){const c=conditionTile(b,1024,.58,2.5,.30,.78);TEX.sandBA=glTexFromCanvas(c.albCanvas);TEX.sandBN=glTexFromData(c.nrm,1024);TEX.sandSrc.B='Sand 03 / Poly Haven CC0';}
      TEX.sandABReady=!!(TEX.sandAA&&TEX.sandAN&&TEX.sandBA&&TEX.sandBN);
      console.log('Aqua v159 sand textures:',TEX.sandSrc,'ready',TEX.sandABReady);
    }catch(e){TEX.sandABReady=false;console.warn('Aqua v159 sand texture load failed',e);}
  }

  const previousInit=initGL;
  initGL=function(){const r=previousInit();loadSandTextures();return r;};

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    const before=(w.actors||[]).length;
    if(w.actors)w.actors=w.actors.filter(a=>!(a&&a.aquaCreatureV156===true));
    const removed=before-(w.actors||[]).length,s=buildSandShoulders(w,sc.seed);
    w.sandA=s.A;w.sandB=s.B;
    w.__aquaV159={version:VERSION,uploadedCreaturesRemoved:true,removedUploadedCreatureActors:removed,
      sandShoulders:true,sandABExperiment:true,sandSources:['Aerial Beach 01','Sand 03'],
      sourceLicense:'Poly Haven CC0',segments:SEGMENTS,shoulderGlassGap:[.35,19.5],
      sandAQuads:s.qa,sandBQuads:s.qb,routeKm:+s.routeKm.toFixed(3),
      roadUnchanged:true,glassUnchanged:true,waterUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v159 sand A/B shoulders:',w.__aquaV159);
    return w;
  };

  function freeGpuMesh(b){
    if(!b||typeof gl==='undefined')return;
    if(b.pos)gl.deleteBuffer(b.pos);if(b.nrm)gl.deleteBuffer(b.nrm);if(b.col)gl.deleteBuffer(b.col);
    if(b.idx)gl.deleteBuffer(b.idx);if(b.limb)gl.deleteBuffer(b.limb);
  }
  const previousUpload=uploadWorld;
  uploadWorld=function(w){
    freeGpuMesh(gpu.sandA);freeGpuMesh(gpu.sandB);gpu.sandA=null;gpu.sandB=null;
    const r=previousUpload(w);
    if(w&&w.sandA)gpu.sandA=uploadMesh(w.sandA);
    if(w&&w.sandB)gpu.sandB=uploadMesh(w.sandB);
    return r;
  };

  function bindAsphaltPair(alb,nrm){
    gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,alb);gl.uniform1i(U.uTexAA,6);
    gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,nrm);gl.uniform1i(U.uTexAN,7);
    gl.activeTexture(gl.TEXTURE0);
  }
  const previousDrawMesh=drawMesh;
  drawMesh=function(m){
    const aqua=typeof world!=='undefined'&&world&&world.__aquaV159;
    if(aqua&&typeof gpu!=='undefined'&&m===gpu.road&&(gpu.sandA||gpu.sandB)){
      if(typeof CU!=='undefined'&&typeof US!=='undefined'&&CU===US){
        if(gpu.sandA)previousDrawMesh(gpu.sandA);
        if(gpu.sandB)previousDrawMesh(gpu.sandB);
      }else if(typeof TEX!=='undefined'&&TEX.sandABReady&&typeof U!=='undefined'){
        if(gpu.sandA){bindAsphaltPair(TEX.sandAA,TEX.sandAN);previousDrawMesh(gpu.sandA);}
        if(gpu.sandB){bindAsphaltPair(TEX.sandBA,TEX.sandBN);previousDrawMesh(gpu.sandB);}
        bindAsphaltPair(TEX.aA,TEX.aN);
      }
    }
    return previousDrawMesh(m);
  };

  globalThis.__aquaV159Spec={VERSION,uploadedCreaturesRemoved:true,sandABExperiment:true,
    sources:{A:'Aerial Beach 01',B:'Sand 03'},segments:SEGMENTS,
    remoteDiffuse:{A:A_URL,B:B_URL},shoulderGlassGap:[.35,19.5]};
})();
/* ===== END js/65-aqua-sand-ab-v159.js ===== */

/* ===== BEGIN js/66-aqua-rocky-upperfish-v160.js ===== */
"use strict";

/* Aqua Rift v160 — rocky reef shoulders + fish above the tunnel -------------
   Visual feedback on v159:
   - Aerial Beach 01 read better than Sand 03;
   - smooth shoulder surfaces still exposed some coral bases;
   - user requested a rockier seabed and fish swimming above the buried glass
     tunnel so the full water volume feels alive.

   v160 supersedes the v159 A/B shoulder appearance without touching the road,
   glass, water, jellyfish, existing fish motion stack or Verdant v142.
*/
(function(){
  const AQUA_ID='aqua',VERSION=160,BASE_GLASS_R=8.8,ROCK_STEP=2,TWO_PI=Math.PI*2;
  const ROCK_URL='https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocks_ground_04/rocks_ground_04_diff_1k.jpg';
  const ROCK_SOURCE='Rocks Ground 04 / Poly Haven CC0';
  const UPPER_SCHOOLS=12,FISH_PER_UPPER_SCHOOL=5,UPPER_FISH=UPPER_SCHOOLS*FISH_PER_UPPER_SCHOOL;
  const TOP_CLEARANCE_MIN=4.0,TOP_CLEARANCE_MAX=11.0;

  function meshOf(m){return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
    col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};}

  function radiusHelper(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    return i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}
      return r;
    };
  }

  function groundPoint(w,i,side,off,lift){
    const n=w.nMain;i=((i%n)+n)%n;
    const x=w.rx[i]-w.tz[i]*off*side,z=w.rz[i]+w.tx[i]*off*side;
    const gy=typeof w.groundAt==='function'?w.groundAt(x,z):w.ry[i]-8;
    return [x,gy+lift,z];
  }

  function buildRockyShoulders(w,seed){
    const n=w.nMain||0,radiusAt=radiusHelper(w),rnd=mulberry32((seed||14373)+160160),m=new MeshB(),
      cross=[.24,2.6,5.8,9.8,14.6,20.5],
      base=[.56,.88,1.04,.94,.70,.36],
      col=[.74,.78,.72];
    let quads=0,rubble=0;

    for(let i=0;i<n;i+=ROCK_STEP){
      const j=(i+ROCK_STEP)%n,ri=radiusAt(i),rj=radiusAt(j);
      for(const side of [-1,1]){
        const a=[],b=[];
        for(let c=0;c<cross.length;c++){
          const broad=.16*Math.sin(i*.19+c*1.41+side*.73)+.08*Math.sin(i*.047+c*.91),
            broadJ=.16*Math.sin(j*.19+c*1.41+side*.73)+.08*Math.sin(j*.047+c*.91),
            grit=.09*(rnd()-.5),gritJ=.09*(rnd()-.5),
            li=Math.max(.28,base[c]+broad+grit),lj=Math.max(.28,base[c]+broadJ+gritJ);
          a.push(groundPoint(w,i,side,ri+cross[c],li));
          b.push(groundPoint(w,j,side,rj+cross[c],lj));
        }
        for(let c=0;c<cross.length-1;c++){m.quad(a[c],b[c],b[c+1],a[c+1],col,0);quads++;}

        /* Sparse partially buried rubble breaks the shoulder silhouette and
           visually swallows remaining coral-base edges without new podiums. */
        if(((i/ROCK_STEP)|0)%6===0){
          const off=ri+2.4+rnd()*11.8,p=groundPoint(w,i,side,off,.34+rnd()*.24),yaw=rnd()*TWO_PI;
          m.setTF(p[0],p[1],p[2],yaw,.72+rnd()*.75);
          const rc=[.56+.08*rnd(),.62+.07*rnd(),.58+.06*rnd()];
          m.sph(0,0,0,.58+rnd()*.52,7,3,rc,.006,false,.38);rubble++;
          m.sph(.48,-.12,.15,.34+rnd()*.28,6,3,rc,.005,false,.34);rubble++;
          if(rnd()>.42){m.sph(-.42,-.16,-.20,.28+rnd()*.24,6,3,rc,.004,false,.32);rubble++;}
          m.setTF(0,0,0,0,1);
        }
      }
    }
    m.setTF(0,0,0,0,1);
    return {mesh:meshOf(m),quads,rubble};
  }

  function addUpperTunnelFish(w,seed){
    const fish=(w.actors||[]).filter(a=>a&&a.aquaFish===true),n=w.nMain||0;
    if(!fish.length||!n)return {added:0,schools:0,minY:null,maxY:null};
    const radiusAt=radiusHelper(w),rnd=mulberry32((seed||14373)+160761);
    let added=0,minY=Infinity,maxY=-Infinity;
    for(let s=0;s<UPPER_SCHOOLS;s++){
      const i=Math.min(n-1,Math.floor((s+.44)*n/UPPER_SCHOOLS)),top=w.ry[i]+radiusAt(i),
        baseY=top+TOP_CLEARANCE_MIN+rnd()*(TOP_CLEARANCE_MAX-TOP_CLEARANCE_MIN),
        lateral=((s%3)-1)*3.6;
      const cx0=w.rx[i]-w.tz[i]*lateral,cz0=w.rz[i]+w.tx[i]*lateral;
      for(let j=0;j<FISH_PER_UPPER_SCHOOL;j++){
        const src=fish[(s*11+j*7)%fish.length],along=(j-(FISH_PER_UPPER_SCHOOL-1)/2)*1.7,
          cross=(j%2?1:-1)*(1.1+rnd()*2.3),
          cx=cx0+w.tx[i]*along-w.tz[i]*cross,cz=cz0+w.tz[i]*along+w.tx[i]*cross,
          ph=rnd()*TWO_PI,py=baseY+(j%3-1)*.75;
        w.actors.push({type:'drone',gcre:src.gcre,mesh:'drone',aquaFish:true,aquaUpperFishV160:true,
          cx,cz,gy:py,alt:0,r:3.0+rnd()*2.4,ph,w:(rnd()<.5?-1:1)*(.018+rnd()*.025),
          px:cx,py,pz:cz,yaw:ph,k:(src.k||.9)*(.80+rnd()*.34),emiss:src.emiss===undefined?.72:src.emiss,gph:ph});
        added++;if(py<minY)minY=py;if(py>maxY)maxY=py;
      }
    }
    return {added,schools:UPPER_SCHOOLS,minY,maxY};
  }

  function loadRemote(url){return new Promise(res=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>res(null);im.src=url;});}
  async function loadRockTexture(){
    if(typeof gl==='undefined'||typeof conditionTile!=='function')return;
    try{
      const im=await loadRemote(ROCK_URL);
      if(!im){TEX.aquaRockReady=false;return;}
      const c=conditionTile(im,1024,.52,2.7,.34,.78);
      TEX.aquaRockA=glTexFromCanvas(c.albCanvas);TEX.aquaRockN=glTexFromData(c.nrm,1024);
      TEX.aquaRockReady=!!(TEX.aquaRockA&&TEX.aquaRockN);TEX.aquaRockSrc=ROCK_SOURCE;
      console.log('Aqua v160 rocky seabed texture:',ROCK_SOURCE,'ready',TEX.aquaRockReady);
    }catch(e){TEX.aquaRockReady=false;console.warn('Aqua v160 rocky texture load failed',e);}
  }

  const previousInit=initGL;
  initGL=function(){const r=previousInit();loadRockTexture();return r;};

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    const rocky=buildRockyShoulders(w,sc.seed),upper=addUpperTunnelFish(w,sc.seed);

    /* v159 already owns the upload/draw path for sandA/sandB. Replace its A/B
       geometry with one full-lap rocky mesh and retire the second A/B mesh. */
    w.sandA=rocky.mesh;
    w.sandB=null;
    const prior=w.__aquaV159||{};
    w.__aquaV160={version:VERSION,rockyShoulders:true,sand03Retired:true,aerialBeachExperimentRetired:true,
      rockySource:ROCK_SOURCE,sourceLicense:'Poly Haven CC0',rockyQuads:rocky.quads,rubblePieces:rocky.rubble,
      shoulderGlassGap:[.24,20.5],upperTunnelFish:upper.added,upperTunnelSchools:upper.schools,
      fishPerUpperSchool:FISH_PER_UPPER_SCHOOL,topClearance:[TOP_CLEARANCE_MIN,TOP_CLEARANCE_MAX],
      upperFishMinY:upper.minY,upperFishMaxY:upper.maxY,existingFishPreserved:true,
      uploadedCreaturesRemainRemoved:prior.uploadedCreaturesRemoved===true,
      roadUnchanged:true,glassUnchanged:true,waterUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v160 rocky shoulders + upper fish:',w.__aquaV160);
    return w;
  };

  /* v159's renderer already knows how to draw gpu.sandA/B before the road.
     Temporarily swap its sand texture pair to the v160 rocky material. */
  const previousDrawMesh=drawMesh;
  drawMesh=function(m){
    const aqua=typeof world!=='undefined'&&world&&world.__aquaV160;
    if(aqua&&typeof gpu!=='undefined'&&m===gpu.road&&typeof TEX!=='undefined'){
      const save={aa:TEX.sandAA,an:TEX.sandAN,ba:TEX.sandBA,bn:TEX.sandBN,ready:TEX.sandABReady};
      if(TEX.aquaRockReady){TEX.sandAA=TEX.aquaRockA;TEX.sandAN=TEX.aquaRockN;TEX.sandBA=TEX.aquaRockA;TEX.sandBN=TEX.aquaRockN;TEX.sandABReady=true;}
      else TEX.sandABReady=false;
      const r=previousDrawMesh(m);
      TEX.sandAA=save.aa;TEX.sandAN=save.an;TEX.sandBA=save.ba;TEX.sandBN=save.bn;TEX.sandABReady=save.ready;
      return r;
    }
    return previousDrawMesh(m);
  };

  globalThis.__aquaV160Spec={VERSION,rockyShoulders:true,rockySource:'Rocks Ground 04',
    sourceLicense:'Poly Haven CC0',UPPER_SCHOOLS,FISH_PER_UPPER_SCHOOL,UPPER_FISH,
    topClearance:[TOP_CLEARANCE_MIN,TOP_CLEARANCE_MAX],remoteDiffuse:ROCK_URL};
})();
/* ===== END js/66-aqua-rocky-upperfish-v160.js ===== */
