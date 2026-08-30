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
