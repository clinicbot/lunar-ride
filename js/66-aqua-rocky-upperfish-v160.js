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
