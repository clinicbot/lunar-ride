"use strict";

/* Verdant Rift v122 — terrain materials + a much busier sky ----------------
   The nature pack already contains high-resolution rock/path photographs.
   Verdant loads those lazily the first time the world is built and uses them
   only for this scene.  Other Lunar Ride worlds keep their existing texture
   set.  The main terrain shader already blends rock by surface slope, so a
   better rock source automatically improves cliffs and mountain faces.

   Birds stay as lightweight gbird actors.  They are spread in habitat-sized
   flocks so only a small subset is within the renderer's 430 m actor cull at
   any one time, even though the whole 25 km lap now feels alive. */
(function(){
  /* ---- Verdant-only terrain texture set ---------------------------------- */
  TEX.verdant=TEX.verdant||{ready:false,loading:false};

  async function loadVerdantTerrainMaterials(){
    const V=TEX.verdant;
    if(V.ready||V.loading)return V.promise||Promise.resolve(V);
    V.loading=true;
    V.promise=(async()=>{
      try{
        const [rock,path,desert]=await Promise.all([
          loadImage('assets/models/Rocks_Diffuse.png'),
          loadImage('assets/models/PathRocks_Diffuse.png'),
          loadImage('assets/models/Rocks_Desert_Diffuse.png')
        ]);
        const S=1024;
        if(rock){
          /* Rock_Medium's own diffuse map becomes the cliff/mountain source. */
          let rc=conditionTile(rock,S,.42,4.8,.72,.92);
          /* A small amount of the desert-rock sample breaks colour repetition
             without turning the whole green world into a desert. */
          if(desert){
            const dc=conditionTile(desert,S,.38,4.2,.68,.88);
            const mix=document.createElement('canvas');mix.width=S;mix.height=S;
            const x=mix.getContext('2d');
            x.drawImage(rc.albCanvas,0,0);
            x.globalAlpha=.22;x.drawImage(dc.albCanvas,0,0);x.globalAlpha=1;
            rc=conditionTile(mix,S,0,4.9,.78,.96);
          }
          V.rA=glTexFromCanvas(rc.albCanvas);V.rN=glTexFromData(rc.nrm,S);
        }
        if(path){
          /* The asphalt slot is scene-specific here: in Verdant it is a
             compact dirt/gravel/small-stone trail rather than black tarmac. */
          const pc=conditionTile(path,S,.30,2.8,.78,.90);
          V.aA=glTexFromCanvas(pc.albCanvas);V.aN=glTexFromData(pc.nrm,S);
        }
        V.ready=!!(V.rA&&V.rN&&V.aA&&V.aN);
        V.loading=false;
        const el=typeof document!=='undefined'&&document.getElementById('texStatus');
        if(el&&V.ready&&!el.textContent.includes('Verdant rock/path'))
          el.textContent+=' | Verdant rock/path: nature pack';
        console.log('Verdant v122 materials:',V.ready?'rock + gravel ready':'fallback');
      }catch(e){
        V.loading=false;V.ready=false;
        console.warn('Verdant v122 terrain textures unavailable:',e&&e.message?e.message:e);
      }
      return V;
    })();
    return V.promise;
  }

  /* drawMesh is already the single choke point for terrain/road geometry.
     Rebinding only the texture units keeps the core shader and every other
     scene untouched.  Sampler uniforms are already fixed to units 2..7 by the
     renderer, so this is also safe while drawMesh is used by the shadow pass. */
  const baseDrawMesh=drawMesh;
  drawMesh=function(b){
    const V=TEX.verdant;
    if(V&&V.ready&&typeof state!=='undefined'&&state.scene&&state.scene.id==='verdant'
       &&typeof gpu!=='undefined'&&(b===gpu.terrain||b===gpu.road)){
      const binds=[[2,TEX.gA],[3,TEX.gN],[4,V.rA||TEX.rA],[5,V.rN||TEX.rN],
                   [6,V.aA||TEX.aA],[7,V.aN||TEX.aN]];
      for(const q of binds){
        gl.activeTexture(gl.TEXTURE0+q[0]);gl.bindTexture(gl.TEXTURE_2D,q[1]);
      }
      gl.activeTexture(gl.TEXTURE0);
    }
    return baseDrawMesh(b);
  };

  /* ---- bird enrichment ---------------------------------------------------- */
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;
    loadVerdantTerrainMaterials();              // lazy: only Verdant pays for it

    const rr=mulberry32(sc.seed+122771),n=w.nMain,L=(w.lapLen||25000)/1000;
    const stats={birds:0,finches:0,kestrels:0,gulls:0,rays:0,flocks:0};
    const pose=(km)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      return {i,x:w.rx[i],z:w.rz[i],y:w.ry[i]};
    };
    const addBird=(gcre,km,opt,j)=>{
      const p=pose(km),side=(j&1?-1:1);
      const along=(rr()-.5)*(opt.spread||.12);
      const p2=pose(km+along);
      const R=(opt.r0||12)+rr()*((opt.r1||28)-(opt.r0||12));
      const base=(opt.h0||9)+rr()*((opt.h1||24)-(opt.h0||9));
      const a={type:'gbird',gcre,cx:p2.x+side*(rr()*5),cz:p2.z+side*(rr()*5),R,
        circ:rr()*6.283185,w:(rr()<.5?-1:1)*((opt.w0||.055)+rr()*(opt.w1||.10)),
        baseY:p.y+base,px:p2.x,py:p.y+base,pz:p2.z,yaw:0,
        flap:rr()>.28,flapT:.8+rr()*2.6,gph:rr()*6.283185,emiss:1,
        k:(opt.k0||.82)+rr()*((opt.k1||1.15)-(opt.k0||.82))};
      if(opt.glide)a.noGlide=rr()<.55;
      w.actors.push(a);stats.birds++;
      if(gcre==='bird3')stats.finches++;else if(gcre==='bird')stats.kestrels++;
      else if(gcre==='bird2')stats.gulls++;else if(gcre==='bird4')stats.rays++;
    };
    const flock=(gcre,km,count,opt)=>{
      stats.flocks++;
      for(let j=0;j<count;j++)addBird(gcre,km,opt||{},j);
    };

    /* Finches: numerous, low, small and close to the tree canopy. */
    for(const km of [.45,2.25,4.15,9.55,11.25,18.75,20.15,23.35])
      flock('bird3',km,8,{h0:6,h1:14,r0:7,r1:18,w0:.08,w1:.16,k0:.72,k1:.98,spread:.16});

    /* Gulls: broad wetland/river circles. */
    for(const km of [6.35,7.65,8.85])
      flock('bird2',km,8,{h0:10,h1:24,r0:16,r1:38,w0:.05,w1:.10,k0:.92,k1:1.18,spread:.22,glide:true});

    /* Kestrels: smaller groups over ridges and open forest. */
    for(const km of [3.15,12.75,14.35,19.35,22.35])
      flock('bird',km,6,{h0:16,h1:34,r0:20,r1:48,w0:.04,w1:.085,k0:.96,k1:1.25,spread:.20,glide:true});

    /* Rays: unmistakable high silhouettes above the city and summit. */
    for(const km of [16.55,17.35,21.35])
      flock('bird4',km,5,{h0:25,h1:48,r0:30,r1:64,w0:.025,w1:.055,k0:1.18,k1:1.55,spread:.24,glide:true});

    stats.textureAssets=['Rocks_Diffuse.png','Rocks_Desert_Diffuse.png','PathRocks_Diffuse.png'];
    stats.totalActors=w.actors.length;
    w.__verdantV122=stats;
    console.log('Verdant v122 terrain + birds:',stats);
    return w;
  };
})();