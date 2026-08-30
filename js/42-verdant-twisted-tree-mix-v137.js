"use strict";

/* Verdant Rift v137 — 50/50 light / exact-v133 dark TwistedTree mix ------
   Preserve all approved v136 CommonTree work. Only TwistedTree_1/3 are
   affected: half keep the current v136/v131 model and half use the exact
   alpha-aware leaf-card reconstruction from rejected v133, which produced
   the attractive darker red / denser-looking crown. No other tree family,
   wildlife, terrain, road, buildings or sky is changed. */
(function(){
  const FILES={twisted1:'TwistedTree_1.gltf',twisted3:'TwistedTree_3.gltf'};
  const FIXED={};
  const DARK_RATIO=.50;
  const IMG_CACHE=new Map();
  const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const STATUS={started:false,total:2,settled:0,ready:0,failed:0,promise:null};

  function resolveUrl(uri,file){return new URL(uri,new URL(file,location.href)).href;}
  function decodeDataUri(uri){
    const s=uri.slice(uri.indexOf(',')+1),raw=atob(s),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  async function loadBuffer(def,file){
    if(!def||!def.uri)throw new Error('glTF buffer has no uri');
    if(def.uri.startsWith('data:'))return decodeDataUri(def.uri);
    const r=await fetch(resolveUrl(def.uri,file));
    if(!r.ok)throw new Error('buffer '+def.uri+' HTTP '+r.status);
    return await r.arrayBuffer();
  }
  function readComponent(dv,o,ct){
    if(ct===5120)return dv.getInt8(o);
    if(ct===5121)return dv.getUint8(o);
    if(ct===5122)return dv.getInt16(o,true);
    if(ct===5123)return dv.getUint16(o,true);
    if(ct===5125)return dv.getUint32(o,true);
    return dv.getFloat32(o,true);
  }
  function normComponent(v,ct){
    if(ct===5120)return Math.max(v/127,-1);
    if(ct===5121)return v/255;
    if(ct===5122)return Math.max(v/32767,-1);
    if(ct===5123)return v/65535;
    if(ct===5125)return v/4294967295;
    return v;
  }
  function accessor(gj,buffers,i){
    const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],Ctor=CT[a.componentType];
    if(!Ctor)throw new Error('unsupported component type '+a.componentType);
    const nc=COMPONENTS[a.type],bytes=Ctor.BYTES_PER_ELEMENT;
    const off=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||nc*bytes;
    const buf=buffers[bv.buffer||0];
    if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(buf,off,a.count*nc),nc};
    const out=new Float32Array(a.count*nc),dv=new DataView(buf);
    for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
      let v=readComponent(dv,off+n*stride+c*bytes,a.componentType);
      if(a.normalized)v=normComponent(v,a.componentType);
      out[n*nc+c]=v;
    }
    return{data:out,nc};
  }

  async function imagePixels(url){
    if(IMG_CACHE.has(url))return IMG_CACHE.get(url);
    const p=new Promise((resolve,reject)=>{
      const im=new Image();
      im.onload=()=>{
        try{
          const maxS=512,sc=Math.min(1,maxS/Math.max(im.naturalWidth,im.naturalHeight));
          const w=Math.max(1,Math.round(im.naturalWidth*sc));
          const h=Math.max(1,Math.round(im.naturalHeight*sc));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(im,0,0,w,h);
          resolve({w,h,data:cx.getImageData(0,0,w,h).data});
        }catch(e){reject(e);}
      };
      im.onerror=()=>reject(new Error('image '+url+' failed'));
      im.src=url;
    });
    IMG_CACHE.set(url,p);return p;
  }
  function sample(px,u,v){
    if(!px)return[1,1,1,1];
    u=((u%1)+1)%1;v=((v%1)+1)%1;
    const x=Math.min(px.w-1,Math.max(0,Math.floor(u*px.w)));
    const y=Math.min(px.h-1,Math.max(0,Math.floor((1-v)*px.h)));
    const k=(y*px.w+x)*4,d=px.data;
    return[d[k]/255,d[k+1]/255,d[k+2]/255,d[k+3]/255];
  }
  const mix=(a,b,t)=>a+(b-a)*t;
  function mixV(a,b,t){
    return {p:[mix(a.p[0],b.p[0],t),mix(a.p[1],b.p[1],t),mix(a.p[2],b.p[2],t)],
      n:[mix(a.n[0],b.n[0],t),mix(a.n[1],b.n[1],t),mix(a.n[2],b.n[2],t)],
      uv:[mix(a.uv[0],b.uv[0],t),mix(a.uv[1],b.uv[1],t)],
      vc:[mix(a.vc[0],b.vc[0],t),mix(a.vc[1],b.vc[1],t),mix(a.vc[2],b.vc[2],t),mix(a.vc[3],b.vc[3],t)]};
  }
  function faceNormal(a,b,c){
    const ax=b.p[0]-a.p[0],ay=b.p[1]-a.p[1],az=b.p[2]-a.p[2];
    const bx=c.p[0]-a.p[0],by=c.p[1]-a.p[1],bz=c.p[2]-a.p[2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
  }
  function vertexAt(vi,P,NA,UVA,CA){
    const p=vi*3,ncN=NA?NA.nc:0,ncU=UVA?UVA.nc:0,ncC=CA?CA.nc:0;
    return {p:[P[p],P[p+1],P[p+2]],
      n:NA?[NA.data[vi*ncN],NA.data[vi*ncN+1],NA.data[vi*ncN+2]]:[0,1,0],
      uv:UVA?[UVA.data[vi*ncU],UVA.data[vi*ncU+1]]:[0,0],
      vc:CA?[CA.data[vi*ncC],CA.data[vi*ncC+1],CA.data[vi*ncC+2],ncC>3?CA.data[vi*ncC+3]:1]:[1,1,1,1]};
  }

  async function loadCorrected(key,file){
    const r=await fetch(file);if(!r.ok)throw new Error('gltf HTTP '+r.status);
    const gj=await r.json(),buffers=await Promise.all((gj.buffers||[]).map(b=>loadBuffer(b,file)));
    const pixelBySource={},need=new Set();
    for(const mat of(gj.materials||[])){
      const ti=((mat.pbrMetallicRoughness||{}).baseColorTexture||{}).index;
      if(ti!==undefined&&gj.textures&&gj.textures[ti])need.add(gj.textures[ti].source);
    }
    await Promise.all(Array.from(need).map(async src=>{
      const im=gj.images&&gj.images[src];
      if(im&&im.uri)pixelBySource[src]=await imagePixels(resolveUrl(im.uri,file));
    }));

    const outP=[],outN=[],outC=[];let leafSource=0,leafOut=0;
    const emit=(a,b,c,px,fac,cut,masked,isLeaf)=>{
      const cu=(a.uv[0]+b.uv[0]+c.uv[0])/3,cv=(a.uv[1]+b.uv[1]+c.uv[1])/3;
      const mid=sample(px,cu,cv),alpha=mid[3]*fac[3]*(a.vc[3]+b.vc[3]+c.vc[3])/3;
      if(masked&&alpha<cut)return false;
      const fn=faceNormal(a,b,c);
      for(const q of [a,b,c]){
        const tex=sample(px,q.uv[0],q.uv[1]);
        outP.push(q.p[0],q.p[1],q.p[2]);
        let nx=q.n[0],ny=q.n[1],nz=q.n[2],ln=Math.hypot(nx,ny,nz);
        if(ln<.25){nx=fn[0];ny=fn[1];nz=fn[2];ln=1;}
        outN.push(nx/ln,ny/ln,nz/ln);
        outC.push(tex[0]*fac[0]*q.vc[0],tex[1]*fac[1]*q.vc[1],tex[2]*fac[2]*q.vc[2]);
      }
      if(isLeaf)leafOut++;
      return true;
    };

    for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
      if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
      const P=accessor(gj,buffers,pr.attributes.POSITION).data;
      const I=accessor(gj,buffers,pr.indices).data;
      const NA=pr.attributes.NORMAL!==undefined?accessor(gj,buffers,pr.attributes.NORMAL):null;
      const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
      const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
      const mat=(gj.materials&&gj.materials[pr.material])||{},pbr=mat.pbrMetallicRoughness||{};
      const fac=pbr.baseColorFactor||[1,1,1,1],ti=(pbr.baseColorTexture||{}).index;
      const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
      const px=src!==undefined?pixelBySource[src]:null,cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
      const masked=mat.alphaMode==='MASK'&&!!px&&!!UVA;
      const isLeaf=masked&&/leaf|leaves/i.test(mat.name||'');
      for(let t=0;t+2<I.length;t+=3){
        const a=vertexAt(I[t],P,NA,UVA,CA),b=vertexAt(I[t+1],P,NA,UVA,CA),c=vertexAt(I[t+2],P,NA,UVA,CA);
        if(!NA){const fn=faceNormal(a,b,c);a.n=fn;b.n=fn;c.n=fn;}
        if(isLeaf){
          leafSource++;
          const ab=mixV(a,b,.5),bc=mixV(b,c,.5),ca=mixV(c,a,.5);
          emit(a,ab,ca,px,fac,cut,true,true);
          emit(ab,b,bc,px,fac,cut,true,true);
          emit(ca,bc,c,px,fac,cut,true,true);
          emit(ab,bc,ca,px,fac,cut,true,true);
        }else emit(a,b,c,px,fac,cut,masked,false);
      }
    }
    if(!outP.length)throw new Error('no visible mesh triangles');
    return {pos:new Float32Array(outP),nrm:new Float32Array(outN),col:new Float32Array(outC),
      count:outP.length/3,triangles:outP.length/9,file,v133ExactTwistedAlpha:true,
      leafSourceTriangles:leafSource,leafOutputTriangles:leafOut};
  }

  function snapshot(){return {started:STATUS.started,total:STATUS.total,settled:STATUS.settled,
    ready:STATUS.ready,failed:STATUS.failed,complete:STATUS.started&&STATUS.settled>=STATUS.total};}
  function start(){
    if(STATUS.started)return STATUS.promise;STATUS.started=true;
    STATUS.promise=Promise.all(Object.keys(FILES).map(async key=>{
      try{FIXED[key]=await loadCorrected(key,'assets/models/'+FILES[key]);STATUS.ready++;}
      catch(e){FIXED[key]=null;STATUS.failed++;console.warn('Verdant v137 dark TwistedTree unavailable:',key,e.message);}
      STATUS.settled++;
    })).then(()=>snapshot());
    return STATUS.promise;
  }

  function scoreInstance(src,o,keySalt){
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*43)^
      Math.floor((src[o+3]||0)*31)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }
  function splitHalf(instances,keySalt){
    const n=Math.floor((instances&&instances.length||0)/6),target=Math.round(n*DARK_RATIO);
    if(!n||!target)return{light:instances||[],dark:[],total:n,darkCount:0};
    const ranked=[];for(let j=0;j<n;j++)ranked.push({j,score:scoreInstance(instances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const picked=new Uint8Array(n);for(let j=0;j<target;j++)picked[ranked[j].j]=1;
    const light=[],dark=[];
    for(let j=0;j<n;j++){
      const o=j*6,out=picked[j]?dark:light;for(let k=0;k<6;k++)out.push(instances[o+k]);
    }
    return{light,dark,total:n,darkCount:target};
  }
  if(typeof globalThis!=='undefined')globalThis.__verdantSplitTwistedHalfV137=splitHalf;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;
    let total=0,lightTotal=0,darkTotal=0,groups=0;
    for(const [ki,key] of Object.keys(FILES).entries()){
      const g=w.instNature.groups[key],m=FIXED[key];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const part=splitHalf(g.instances,0x6a09e667^(ki*0x9e3779b9));
      const darkKey=key+'DarkV137';
      g.instances=part.light;
      w.instNature.models[darkKey]=m;
      w.instNature.groups[darkKey]={kind:g.kind,range:g.range,instances:part.dark};
      total+=part.total;lightTotal+=part.light.length/6;darkTotal+=part.darkCount;groups++;
    }
    w.__verdantTwistedTreeMixV137={groupsProcessed:groups,totalTwistedTrees:total,
      lightTwistedTrees:lightTotal,darkTwistedTrees:darkTotal,requestedDarkRatio:DARK_RATIO,
      actualDarkRatio:total?darkTotal/total:0,exactV133AlphaOnDarkHalf:true,
      preservesV136CommonTrees:true,preservesWildlife:true,preservesOtherTreeFamilies:true};
    console.log('Verdant v137 TwistedTree mix:',w.__verdantTwistedTreeMixV137);
    return w;
  };

  start();
  if(typeof window!=='undefined'){
    window.__verdantTwistedMixStatusV137=snapshot;
    window.__verdantTwistedMixWaitV137=start;
  }
  function installGate(){
    if(typeof startRide!=='function'||startRide.__verdantTwistedV137)return;
    const base=startRide;
    const gated=function(sc,resume){
      if(!sc||sc.id!=='verdant'||snapshot().complete)return base(sc,resume);
      try{
        const loading=document.getElementById('loading'),txt=document.getElementById('loadTxt');
        if(loading)loading.classList.add('on');if(txt)txt.textContent='Preparing red tree variants';
      }catch(e){}
      return start().then(()=>base(sc,resume));
    };
    gated.__verdantTwistedV137=true;startRide=gated;
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGate,{once:true});
    else setTimeout(installGate,0);
  }
})();
