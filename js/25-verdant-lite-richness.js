"use strict";

/* Verdant Rift lightweight richness pass ---------------------------------
   Keeps the proven v106 route/terrain and avoids the expensive v110 visual
   pass.  Reuses the existing 26k billboard plants instead of appending large
   real-geometry forests, and puts visible wildlife near the start. */
(function(){
  /* The vegetation atlas is 1536x256 (NPOT). WebGL 1 cannot use mipmapped
     filtering on NPOT textures, which can make the entire vegetation layer
     sample as an incomplete texture. Keep mipmaps on WebGL 2, but use plain
     linear filtering on the WebGL 1 fallback. */
  const fixVegTexture=()=>{
    if(!TEX||!TEX.veg||isGL2) return;
    gl.bindTexture(gl.TEXTURE_2D,TEX.veg);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D,null);
  };
  const oldBake=bakeTextures;
  bakeTextures=function(){
    const r=oldBake();
    fixVegTexture();
    return r;
  };
  fixVegTexture();

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant||!w.veg) return w;

    /* The original 0-3 km valley used almost exclusively grass sprites, so
       the first screen looked empty even though thousands of plants existed.
       Convert a deterministic fraction of those existing sprites into oak,
       pine and bush atlas cells. Vertex count does not increase at all. */
    const ctr=w.veg.ctr,dat=w.veg.dat,uv=w.veg.uv;
    const plants=Math.floor(ctr.length/12);
    let changed=0;
    const setPlant=(p,kind,size)=>{
      const u0=kind/6,u1=u0+1/6,ub=p*8,db=p*16;
      uv[ub]=u0; uv[ub+2]=u1; uv[ub+4]=u1; uv[ub+6]=u0;
      dat[db+2]=size; dat[db+6]=size; dat[db+10]=size; dat[db+14]=size;
    };
    const hash=p=>{
      let x=(p+1)^(sc.seed*2654435761);
      x=Math.imul(x^(x>>>16),2246822519);
      x=Math.imul(x^(x>>>13),3266489917);
      return ((x^(x>>>16))>>>0)/4294967296;
    };
    const roadNear=w._dbg&&w._dbg.roadNear;
    if(roadNear){
      for(let p=0;p<plants;p++){
        const x=ctr[p*12],z=ctr[p*12+2],q=roadNear(x,z);
        if(!q||w.verdant.zoneAt(q.i)!==0) continue;
        const h=hash(p);
        if(h<.26){
          const pine=h<.08;
          setPlant(p,pine?3:2,4.4+hash(p+70001)*3.6);
          changed++;
        }else if(h<.44){
          setPlant(p,1,1.1+hash(p+90001)*1.8);
          changed++;
        }
      }
    }

    /* Put unmistakable life inside the initial camera range. These reuse the
       existing low-poly actor meshes; no new models or geometry are loaded. */
    const putAnimal=(type,km,off,k)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes[type]) return;
      const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      w.actors.push({type,px:x,py:w.meshH(x,z),pz:z,yaw:hash(i)*6.28318,k:k||1,emiss:1});
    };
    putAnimal('bear',.22,-20,1.15);
    putAnimal('bear',2.72,24,1.25);

    /* A small flock circles near the start. If the glTF birds are already
       ready they are used; otherwise the normal bird fallback will take over
       when available. */
    if(w.actors){
      const birdKeys=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready);
      [0.06,0.14,0.28,0.46].forEach((km,j)=>{
        const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
        const g=birdKeys.length?birdKeys[j%birdKeys.length]:'bird';
        w.actors.push({type:'gbird',gcre:g,cx:w.rx[i],cz:w.rz[i],R:18+j*7,
          circ:j*1.41,w:(j&1?-1:1)*(.10+j*.012),baseY:w.ry[i]+13+j*2,
          px:w.rx[i],py:w.ry[i]+15,pz:w.rz[i],yaw:0,flap:true,flapT:1.4,
          gph:j*.83,emiss:1,k:1.05+j*.05});
      });
    }

    w.__verdantLite={reusedBillboards:changed,extraActors:6};
    return w;
  };

  /* Visible test marker so the user can immediately tell this safe pass is
     active without relying on cached script names. */
  const RELEASE='111';
  const label=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build '+RELEASE;
    const e=document.getElementById('sceneName');
    if(e&&e.textContent&&e.textContent.indexOf('Verdant Rift')>=0)
      e.textContent=e.textContent.replace(/\s·\sv\d+\s*$/,'')+' · v'+RELEASE;
  };
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',label,{once:true});
    else label();
    [100,350,800].forEach(ms=>setTimeout(label,ms));
  }
})();
