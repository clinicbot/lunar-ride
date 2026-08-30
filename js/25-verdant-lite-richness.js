"use strict";

/* Verdant Rift lightweight wildlife pass ---------------------------------
   Imported glTF nature is the visual baseline from v115 onward.  The legacy
   billboard vegetation is removed by js/27, so this file only keeps the
   WebGL1 compatibility fix, visible wildlife, and the Verdant release label. */
(function(){
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
  bakeTextures=function(){const r=oldBake();fixVegTexture();return r;};
  fixVegTexture();

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant') return w;

    const hash=p=>{
      let x=(p+1)^(sc.seed*2654435761);
      x=Math.imul(x^(x>>>16),2246822519);
      x=Math.imul(x^(x>>>13),3266489917);
      return ((x^(x>>>16))>>>0)/4294967296;
    };

    const BEAR_META={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};
    const putBear=(km,off,k)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes.bear) return;
      const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const ph=hash(i+17001)*6.28318;
      w.actors.push({type:'bear',px:x,py:w.meshH(x,z),pz:z,yaw:hash(i)*6.28318,k:k||1,emiss:1,
        meta:BEAR_META,ph,hx:x,hz:z,wr:2.2,wander:ph,wspd:(i&1?-1:1)*.05,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph});
    };
    putBear(.22,-20,1.15);
    putBear(2.72,24,1.25);
    putBear(16.8,-27,1.18);

    let birdCount=0;
    if(w.actors){
      const birdKeys=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready);
      const flock=(baseKm,count,seedOff)=>{
        for(let j=0;j<count;j++){
          const km=baseKm+j*.08;
          const i=Math.max(0,Math.min(w.nMain-1,Math.floor(km*1000/ROUTE_STEP)));
          const g=birdKeys.length?birdKeys[(j+seedOff)%birdKeys.length]:'bird';
          w.actors.push({type:'gbird',gcre:g,cx:w.rx[i],cz:w.rz[i],R:18+j*7,
            circ:(j+seedOff)*1.41,w:(j&1?-1:1)*(.10+j*.012),baseY:w.ry[i]+13+j*2,
            px:w.rx[i],py:w.ry[i]+15,pz:w.rz[i],yaw:0,flap:true,flapT:1.4,
            gph:(j+seedOff)*.83,emiss:1,k:1.05+j*.05});
          birdCount++;
        }
      };
      flock(.06,4,0);
      flock(4.7,3,3);
      flock(9.7,3,2);
      flock(14.4,4,1);
      flock(20.4,3,1);
      flock(23.4,3,0);
    }

    w.__verdantLite={extraBears:3,extraBirds:birdCount};
    return w;
  };

  const RELEASE='119';
  const label=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build '+RELEASE;
    const e=document.getElementById('sceneName');
    if(e&&e.textContent&&e.textContent.indexOf('Verdant Rift')>=0&&!e.textContent.endsWith('v'+RELEASE))
      e.textContent=e.textContent.replace(/\s·\sv\d+\s*$/,'')+' · v'+RELEASE;
  };
  if(typeof document!=='undefined'){
    const install=()=>{
      label();
      const e=document.getElementById('sceneName');
      if(e)new MutationObserver(()=>label()).observe(e,{childList:true,characterData:true,subtree:true});
      [100,350,800,1500].forEach(ms=>setTimeout(label,ms));
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }
})();