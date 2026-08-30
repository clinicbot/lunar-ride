"use strict";

/* Verdant Rift v129 — imported nature instance source ---------------------
   External glTF models are parsed once while the menu is visible. Textures
   are sampled into per-vertex colours, but models are NOT duplicated into the
   world's props mesh. v129 exposes deterministic load status so the Verdant
   start gate can wait for nature too; the triangular legacy billboard field
   is never used as a fallback. */
(function(){
  const STORE={};
  const IMG_CACHE=new Map();
  let started=false;
  const LOAD={total:0,settled:0,ready:0,failed:0,promise:null};

  const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,
            5125:Uint32Array,5126:Float32Array};

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
          const cx=cv.getContext('2d',{willReadFrequently:true});
          cx.drawImage(im,0,0,w,h);
          resolve({w,h,data:cx.getImageData(0,0,w,h).data});
        }catch(e){reject(e);}
      };
      im.onerror=()=>reject(new Error('image '+url+' failed'));
      im.src=url;
    });
    IMG_CACHE.set(url,p);return p;
  }
  function sample(px,u,v){
    u=((u%1)+1)%1;v=((v%1)+1)%1;
    const x=Math.min(px.w-1,Math.max(0,Math.floor(u*px.w)));
    const y=Math.min(px.h-1,Math.max(0,Math.floor((1-v)*px.h)));
    const k=(y*px.w+x)*4,d=px.data;
    return[d[k]/255,d[k+1]/255,d[k+2]/255,d[k+3]/255];
  }

  function faceNormal(P,ia,ib,ic){
    const ax=P[ib]-P[ia],ay=P[ib+1]-P[ia+1],az=P[ib+2]-P[ia+2];
    const bx=P[ic]-P[ia],by=P[ic+1]-P[ia+1],bz=P[ic+2]-P[ia+2];
    let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
    const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
  }

  async function loadModel(key,file){
    try{
      const r=await fetch(file);if(!r.ok)throw new Error('gltf HTTP '+r.status);
      const gj=await r.json();
      const buffers=await Promise.all((gj.buffers||[]).map(b=>loadBuffer(b,file)));
      const pixelBySource={},need=new Set();
      for(const mat of(gj.materials||[])){
        const ti=((mat.pbrMetallicRoughness||{}).baseColorTexture||{}).index;
        if(ti!==undefined&&gj.textures&&gj.textures[ti])need.add(gj.textures[ti].source);
      }
      await Promise.all(Array.from(need).map(async src=>{
        const im=gj.images&&gj.images[src];
        if(im&&im.uri)try{pixelBySource[src]=await imagePixels(resolveUrl(im.uri,file));}catch(e){}
      }));

      const outP=[],outN=[],outC=[];let visibleTriangles=0;
      for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
        if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
        const P=accessor(gj,buffers,pr.attributes.POSITION).data;
        const I=accessor(gj,buffers,pr.indices).data;
        const NA=pr.attributes.NORMAL!==undefined?accessor(gj,buffers,pr.attributes.NORMAL):null;
        const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
        const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
        const mat=(gj.materials&&gj.materials[pr.material])||{};
        const pbr=mat.pbrMetallicRoughness||{},fac=pbr.baseColorFactor||[1,1,1,1];
        const ti=(pbr.baseColorTexture||{}).index;
        const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
        const px=src!==undefined?pixelBySource[src]:null;
        const cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
        for(let t=0;t+2<I.length;t+=3){
          const a=I[t],b=I[t+1],c=I[t+2];
          let tc=[1,1,1,1];
          if(px&&UVA){
            const U=UVA.data,nc=UVA.nc;
            tc=sample(px,(U[a*nc]+U[b*nc]+U[c*nc])/3,(U[a*nc+1]+U[b*nc+1]+U[c*nc+1])/3);
          }
          let vr=1,vg=1,vb=1,va=1;
          if(CA){
            const C=CA.data,nc=CA.nc;
            vr=(C[a*nc]+C[b*nc]+C[c*nc])/3;
            vg=(C[a*nc+1]+C[b*nc+1]+C[c*nc+1])/3;
            vb=(C[a*nc+2]+C[b*nc+2]+C[c*nc+2])/3;
            if(nc>3)va=(C[a*nc+3]+C[b*nc+3]+C[c*nc+3])/3;
          }
          const alpha=tc[3]*fac[3]*va;
          if(mat.alphaMode==='MASK'&&alpha<cut)continue;
          const col=[tc[0]*fac[0]*vr,tc[1]*fac[1]*vg,tc[2]*fac[2]*vb];
          const ia=a*3,ib=b*3,ic=c*3,fn=faceNormal(P,ia,ib,ic);
          for(const vi of [a,b,c]){
            const p=vi*3;outP.push(P[p],P[p+1],P[p+2]);
            if(NA){const n=vi*NA.nc;outN.push(NA.data[n],NA.data[n+1],NA.data[n+2]);}
            else outN.push(fn[0],fn[1],fn[2]);
            outC.push(col[0],col[1],col[2]);
          }
          visibleTriangles++;
        }
      }
      if(!outP.length)throw new Error('no visible mesh triangles');
      STORE[key]={pos:new Float32Array(outP),nrm:new Float32Array(outN),
                  col:new Float32Array(outC),count:outP.length/3,
                  triangles:visibleTriangles,file};
      console.log('Verdant instanced nature ready:',key,'triangles',visibleTriangles);
      return true;
    }catch(e){
      console.warn('Verdant nature unavailable:',key,e.message);
      STORE[key]=null;return false;
    }
  }

  const natureStatus=()=>({
    started,total:LOAD.total,settled:LOAD.settled,ready:LOAD.ready,failed:LOAD.failed,
    complete:started&&LOAD.total>0&&LOAD.settled>=LOAD.total,
    coreReady:!!(STORE.common1&&STORE.bush&&STORE.fern)
  });

  function startLoads(){
    if(started)return LOAD.promise;started=true;
    const files={
      common1:'CommonTree_1.gltf',common3:'CommonTree_3.gltf',common5:'CommonTree_5.gltf',
      twisted1:'TwistedTree_1.gltf',twisted3:'TwistedTree_3.gltf',
      pine1:'Pine_1.gltf',pine3:'Pine_3.gltf',pine5:'Pine_5.gltf',dead2:'DeadTree_2.gltf',
      bush:'Bush_Common.gltf',bushFlowers:'Bush_Common_Flowers.gltf',fern:'Fern_1.gltf',
      flower4:'Flower_4_Group.gltf',mushroom:'Mushroom_Common.gltf',
      rock1:'Rock_Medium_1.gltf',rock2:'Rock_Medium_2.gltf'
    };
    const keys=Object.keys(files);LOAD.total=keys.length;
    const jobs=keys.map(k=>loadModel(k,'assets/models/'+files[k]).then(ok=>{
      LOAD.settled++;if(ok)LOAD.ready++;else LOAD.failed++;
      return ok;
    }));
    LOAD.promise=Promise.all(jobs).then(()=>natureStatus());
    return LOAD.promise;
  }

  if(typeof window!=='undefined'){
    window.__verdantNatureStatusV129=natureStatus;
    window.__verdantNatureWaitV129=()=>startLoads();
  }
  if(typeof window!=='undefined'&&typeof fetch==='function')startLoads();
  const oldInit=initGL;
  initGL=function(){const r=oldInit();startLoads();return r;};

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant)return w;

    const coreReady=!!(STORE.common1&&STORE.bush&&STORE.fern);
    if(!coreReady){
      /* Never resurrect the old 26k billboard layer: that is the source of
         the giant green triangular silhouettes seen when nature lost the race. */
      w.veg=null;
      w.__realNature={ready:false,loading:!natureStatus().complete,
        legacyBillboards:false,natureStatus:natureStatus()};
      return w;
    }

    const rr=mulberry32(sc.seed+11713),n=w.nMain,routeKm=n*ROUTE_STEP/1000;
    const groups={},models={};
    const stats={trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,total:0};
    const ranges={trees:1.45,bushes:.90,ferns:.68,flowers:.58,mushrooms:.46,rocks:1.08};

    const available=keys=>keys.filter(k=>STORE[k]);
    const pickKey=(keys,fallback)=>{
      const a=available(keys);if(a.length)return a[Math.floor(rr()*a.length)];
      return STORE[fallback]?fallback:null;
    };
    const add=(km,off,key,scale,kind)=>{
      if(!key||!STORE[key])return false;
      km=((km%routeKm)+routeKm)%routeKm;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      if(!groups[key])groups[key]={kind,range:ranges[kind]||1,instances:[]};
      groups[key].instances.push(km,x,y,z,rr()*6.283185,scale);
      models[key]=STORE[key];
      stats[kind]++;stats.total++;return true;
    };
    const scatterBoth=(k0,k1,step,pool,offMin,offMax,sMin,sMax,kind,chance,cluster)=>{
      chance=chance===undefined?1:chance;cluster=cluster||0;
      let km=k0+rr()*step;
      while(km<k1){
        for(const side of [-1,1]){
          if(rr()>chance)continue;
          const off=side*(offMin+rr()*(offMax-offMin));
          const key=pickKey(pool,kind==='trees'?'common1':kind==='ferns'?'fern':'bush');
          add(km+(rr()-.5)*step*.35,off,key,sMin+rr()*(sMax-sMin),kind);
          if(cluster&&rr()<cluster){
            const off2=off+side*(2+rr()*6);
            add(km+(rr()-.5)*step*.55,off2,key,(sMin+rr()*(sMax-sMin))*.88,kind);
          }
        }
        km+=step*(.82+rr()*.36);
      }
    };

    scatterBoth(0,4,.070,['common1','common3','common5'],8,34,.70,1.08,'trees',.92,.24);
    scatterBoth(0,4,.036,['bush','bushFlowers'],5,22,.48,.90,'bushes',.90,.18);
    scatterBoth(0,4,.070,['fern'],5,18,.12,.22,'ferns',.72,.08);

    scatterBoth(4,9,.058,['common1','common3','twisted1','twisted3'],7,30,.58,.96,'trees',.94,.30);
    scatterBoth(4,9,.031,['bush','bushFlowers'],4.8,20,.42,.82,'bushes',.93,.22);
    scatterBoth(4,9,.046,['fern'],4.5,17,.12,.24,'ferns',.86,.12);

    scatterBoth(9,14,.078,['twisted1','twisted3','common5'],7,26,.52,.88,'trees',.88,.28);
    scatterBoth(9,14,.022,['fern'],4,16,.11,.23,'ferns',.95,.20);
    scatterBoth(9,14,.050,['bush','bushFlowers'],4.5,18,.38,.78,'bushes',.90,.20);
    scatterBoth(9,14,.066,['flower4'],4.5,16,.22,.42,'flowers',.72,.10);
    scatterBoth(9,14,.095,['mushroom'],4,13,.22,.42,'mushrooms',.60,.08);

    scatterBoth(14,19,.125,['dead2','twisted1'],9,32,.44,.74,'trees',.72,.10);
    scatterBoth(14,19,.047,['rock1','rock2'],5,25,.48,1.10,'rocks',.90,.16);
    scatterBoth(14,19,.070,['bush'],6,22,.38,.68,'bushes',.74,.08);

    scatterBoth(19,23,.055,['pine1','pine3','pine5'],7,30,.56,.96,'trees',.95,.30);
    scatterBoth(19,23,.052,['fern','bush'],4.5,18,.18,.48,'ferns',.82,.12);
    scatterBoth(19,23,.085,['rock1','rock2'],6,23,.50,1.05,'rocks',.68,.08);

    scatterBoth(23,25,.065,['common1','common5','pine5','twisted1'],7,28,.58,.96,'trees',.94,.28);
    scatterBoth(23,25,.034,['bush','bushFlowers'],4.5,18,.38,.78,'bushes',.92,.18);
    scatterBoth(23,25,.070,['fern','flower4'],4,15,.16,.38,'flowers',.72,.08);

    w.instNature={ready:true,routeKm,models,groups,stats};
    w.__realNature={ready:true,mode:'gpu-instanced',stats,natureStatus:natureStatus(),legacyBillboards:false};
    console.log('Verdant v129 instance plan:',stats,'groups',Object.keys(groups).length,natureStatus());
    return w;
  };
})();
