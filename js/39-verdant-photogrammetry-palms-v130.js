"use strict";

/* Verdant Rift v130 — optimized photogrammetry palms -----------------------
   The user's dense palm scan is reduced into small self-contained glTF parts.
   Parts are merged once at load time; the existing GPU instance renderer then
   draws sparse Hero palms near the road and lighter LOD palms farther away. */
(function(){
  const FILES={
    palmHero:[1,2,3,4].map(i=>'assets/models/verdant_palm_hero_v130_part'+i+'.gltf'),
    palmLod:[1,2].map(i=>'assets/models/verdant_palm_lod_v130_part'+i+'.gltf')
  };
  const PALMS={palmHero:null,palmLod:null};
  const LOAD={started:false,settled:0,ready:0,failed:0,promise:null};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};

  function decode(uri){
    const raw=atob(uri.slice(uri.indexOf(',')+1)),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a.buffer;
  }
  function component(dv,o,ct){
    if(ct===5120)return dv.getInt8(o); if(ct===5121)return dv.getUint8(o);
    if(ct===5122)return dv.getInt16(o,true); if(ct===5123)return dv.getUint16(o,true);
    if(ct===5125)return dv.getUint32(o,true); return dv.getFloat32(o,true);
  }
  function norm(v,ct){
    if(ct===5120)return Math.max(v/127,-1); if(ct===5121)return v/255;
    if(ct===5122)return Math.max(v/32767,-1); if(ct===5123)return v/65535; return v;
  }
  function accessor(g,b,i){
    const a=g.accessors[i],v=g.bufferViews[a.bufferView],Ctor=CT[a.componentType],nc=NC[a.type];
    const bytes=Ctor.BYTES_PER_ELEMENT,off=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||nc*bytes;
    if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(b,off,a.count*nc),nc};
    const out=new Float32Array(a.count*nc),dv=new DataView(b);
    for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
      let x=component(dv,off+n*stride+c*bytes,a.componentType); if(a.normalized)x=norm(x,a.componentType); out[n*nc+c]=x;
    }
    return{data:out,nc};
  }
  async function loadPart(file){
    const r=await fetch(file); if(!r.ok)throw new Error(file+' HTTP '+r.status);
    const g=await r.json(),b=decode(g.buffers[0].uri),p=g.meshes[0].primitives[0];
    const P=accessor(g,b,p.attributes.POSITION),N=accessor(g,b,p.attributes.NORMAL),C=accessor(g,b,p.attributes.COLOR_0),I=accessor(g,b,p.indices).data;
    const pos=new Float32Array(I.length*3),nrm=new Float32Array(I.length*3),col=new Float32Array(I.length*3); let q=0;
    for(let t=0;t<I.length;t++){
      const vi=I[t],pp=vi*P.nc,nn=vi*N.nc,cc=vi*C.nc;
      pos[q]=P.data[pp];nrm[q]=N.data[nn];col[q++]=C.data[cc];
      pos[q]=P.data[pp+1];nrm[q]=N.data[nn+1];col[q++]=C.data[cc+1];
      pos[q]=P.data[pp+2];nrm[q]=N.data[nn+2];col[q++]=C.data[cc+2];
    }
    return{pos,nrm,col,count:I.length,triangles:I.length/3};
  }
  function join(parts,key){
    const verts=parts.reduce((s,p)=>s+p.count,0),pos=new Float32Array(verts*3),nrm=new Float32Array(verts*3),col=new Float32Array(verts*3);
    let o=0,tris=0; for(const p of parts){pos.set(p.pos,o);nrm.set(p.nrm,o);col.set(p.col,o);o+=p.pos.length;tris+=p.triangles;}
    return{pos,nrm,col,count:verts,triangles:tris,file:key};
  }
  async function loadSet(key){
    try{PALMS[key]=join(await Promise.all(FILES[key].map(loadPart)),key);LOAD.ready++;return true;}
    catch(e){PALMS[key]=null;LOAD.failed++;console.warn('Verdant v130 palm unavailable:',key,e&&e.message||e);return false;}
    finally{LOAD.settled++;}
  }
  function startLoads(){
    if(LOAD.started)return LOAD.promise;LOAD.started=true;
    LOAD.promise=Promise.all(Object.keys(FILES).map(loadSet)).then(()=>({complete:true,ready:LOAD.ready,failed:LOAD.failed}));return LOAD.promise;
  }
  startLoads();

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;
    const I=w.instNature,G=I.groups,M=I.models,L=I.routeKm||25,n=w.nMain,near=w._dbg&&w._dbg.roadNear;
    const hero=PALMS.palmHero,lod=PALMS.palmLod,rr=mulberry32(sc.seed+130031);
    const stats={heroPalms:0,lodPalms:0,skippedRoad:0,heroTriangles:hero?hero.triangles:0,lodTriangles:lod?lod.triangles:0,source:'optimized-photogrammetry-scan'};
    if(hero){M.palmHero=hero;G.palmHero={kind:'trees',range:.72,instances:[]};}
    if(lod){M.palmLod=lod;G.palmLod={kind:'trees',range:1.05,instances:[]};}
    const pose=(km,off)=>{km=((km%L)+L)%L;const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP))),s=off<0?-1:1,o=Math.abs(off);const x=w.rx[i]-w.tz[i]*o*s,z=w.rz[i]+w.tx[i]*o*s;return{km,x,z,y:w.meshH(x,z)-.015};};
    const add=(key,km,off,H,minRoad)=>{
      if(!M[key]||!G[key])return false;
      for(let a=0;a<4;a++){
        const s=off<0?-1:1,p=pose(km+(a?.006*a:0),off+s*a*7),q=near?near(p.x,p.z):null;
        if(q&&q.d<minRoad){stats.skippedRoad++;continue;}
        G[key].instances.push(p.km,p.x,p.y,p.z,rr()*6.283185,H);stats[key==='palmHero'?'heroPalms':'lodPalms']++;return true;
      } return false;
    };
    const anchors=[9.18,9.58,9.98,10.38,10.78,11.18,11.58,11.98,12.38,12.78,13.18,13.58,13.86];
    anchors.forEach((km,a)=>{
      const side=a%2?-1:1;if(hero)add('palmHero',km+(rr()-.5)*.035,side*(13+rr()*10),9.2+rr()*3.7,11.5);
      if(lod)for(let j=0;j<3+(a%3===0?1:0);j++){const s=(j&1)?-side:side;add('palmLod',km+(rr()-.5)*.12,s*(27+rr()*43),7.2+rr()*4.2,17.5);}
    });
    for(const [km,s] of [[8.82,-1],[8.96,1],[14.05,-1],[14.18,1]])if(lod)add('palmLod',km,s*(31+rr()*24),7+rr()*3.2,17.5);
    if(I.stats){I.stats.trees=(I.stats.trees||0)+stats.heroPalms+stats.lodPalms;I.stats.total=(I.stats.total||0)+stats.heroPalms+stats.lodPalms;}
    w.__verdantPhotogrammetryPalmsV130=stats;return w;
  };

  function installGate(){
    if(typeof startRide!=='function'||startRide.__verdantPalmGateV130)return;const prior=startRide;
    startRide=function(sc,resume){if(!sc||sc.id!=='verdant'||LOAD.settled>=2)return prior(sc,resume);const l=document.getElementById('loading'),t=document.getElementById('loadTxt');if(l)l.classList.add('on');if(t)t.textContent='Loading photogrammetry palms';startLoads().then(()=>prior(sc,resume));};
    startRide.__verdantPalmGateV130=true;
  }
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGate,{once:true});else setTimeout(installGate,0);}
  if(typeof window!=='undefined')window.__verdantPalmAssetsV130={state:LOAD,models:PALMS,wait:startLoads};
})();
