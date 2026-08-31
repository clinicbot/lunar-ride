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
