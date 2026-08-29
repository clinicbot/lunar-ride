"use strict";

/* Verdant Rift v116 — imported nature biomes ------------------------------
   Uses the external-buffer/textured glTF nature pack uploaded to assets/models.
   The existing renderer stays unchanged: material textures are sampled once
   while the menu is visible, colours are baked per triangle, and a controlled
   amount of geometry is merged into the normal props mesh.

   v116 expands the proven v113 pilot across the full 25 km, but deliberately
   varies density and species by route section.  A hard triangle budget prevents
   an unexpectedly heavy source model from freezing the browser. */
(function(){
  const STORE={};
  const IMG_CACHE=new Map();
  let started=false;

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

      const prims=[];let visibleTriangles=0;
      for(const mesh of(gj.meshes||[]))for(const pr of(mesh.primitives||[])){
        if(pr.attributes.POSITION===undefined||pr.indices===undefined)continue;
        const P=accessor(gj,buffers,pr.attributes.POSITION).data;
        const I=accessor(gj,buffers,pr.indices).data;
        const UVA=pr.attributes.TEXCOORD_0!==undefined?accessor(gj,buffers,pr.attributes.TEXCOORD_0):null;
        const CA=pr.attributes.COLOR_0!==undefined?accessor(gj,buffers,pr.attributes.COLOR_0):null;
        const mat=(gj.materials&&gj.materials[pr.material])||{};
        const pbr=mat.pbrMetallicRoughness||{},fac=pbr.baseColorFactor||[1,1,1,1];
        const ti=(pbr.baseColorTexture||{}).index;
        const src=ti!==undefined&&gj.textures&&gj.textures[ti]?gj.textures[ti].source:undefined;
        const px=src!==undefined?pixelBySource[src]:null;
        const ntri=Math.floor(I.length/3),triCol=new Float32Array(ntri*3),visible=new Uint8Array(ntri);
        const cut=mat.alphaCutoff===undefined?.5:mat.alphaCutoff;
        for(let t=0;t<ntri;t++){
          const a=I[t*3],b=I[t*3+1],c=I[t*3+2];
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
          const vis=(mat.alphaMode==='MASK'&&alpha<cut)?0:1;
          visible[t]=vis;if(vis)visibleTriangles++;
          triCol[t*3]=tc[0]*fac[0]*vr;
          triCol[t*3+1]=tc[1]*fac[1]*vg;
          triCol[t*3+2]=tc[2]*fac[2]*vb;
        }
        prims.push({pos:P,idx:I,triCol,visible});
      }
      if(!prims.length)throw new Error('no mesh primitives');
      STORE[key]={prims,triangles:visibleTriangles,file};
      console.log('Verdant nature ready:',key,'triangles',visibleTriangles);
      return true;
    }catch(e){
      console.warn('Verdant nature unavailable:',key,e.message);
      STORE[key]=null;return false;
    }
  }

  function startLoads(){
    if(started)return;started=true;
    /* Core species first so the rider can enter the world quickly. */
    const core=[
      loadModel('common1','assets/models/CommonTree_1.gltf'),
      loadModel('twisted1','assets/models/TwistedTree_1.gltf'),
      loadModel('pine1','assets/models/Pine_1.gltf'),
      loadModel('bush','assets/models/Bush_Common.gltf'),
      loadModel('fern','assets/models/Fern_1.gltf')
    ];
    /* Variants start only after the core requests settle. They share texture
       cache entries, so the extra visual variety is relatively cheap. */
    Promise.allSettled(core).then(()=>Promise.allSettled([
      loadModel('common3','assets/models/CommonTree_3.gltf'),
      loadModel('common5','assets/models/CommonTree_5.gltf'),
      loadModel('twisted3','assets/models/TwistedTree_3.gltf'),
      loadModel('pine3','assets/models/Pine_3.gltf'),
      loadModel('pine5','assets/models/Pine_5.gltf'),
      loadModel('dead2','assets/models/DeadTree_2.gltf'),
      loadModel('bushFlowers','assets/models/Bush_Common_Flowers.gltf'),
      loadModel('flower4','assets/models/Flower_4_Group.gltf'),
      loadModel('mushroom','assets/models/Mushroom_Common.gltf'),
      loadModel('rock1','assets/models/Rock_Medium_1.gltf'),
      loadModel('rock2','assets/models/Rock_Medium_2.gltf')
    ]));
  }

  function appendModel(mb,m){
    if(!m)return;
    for(const pr of m.prims){
      const P=pr.pos,I=pr.idx,C=pr.triCol,V=pr.visible;
      for(let t=0,ti=0;t+2<I.length;t+=3,ti++){
        if(!V[ti])continue;
        const i0=I[t]*3,i1=I[t+1]*3,i2=I[t+2]*3;
        const A=mb.P(P[i0],P[i0+1],P[i0+2]);
        const B=mb.P(P[i1],P[i1+1],P[i1+2]);
        const D=mb.P(P[i2],P[i2+1],P[i2+2]);
        mb.tri(A,B,D,[C[ti*3],C[ti*3+1],C[ti*3+2]],0.01);
      }
    }
  }
  function mergeProps(w,mb){
    if(!mb.idx.length)return 0;
    const op=w.props||{pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)};
    const p=new Float32Array(op.pos.length+mb.pos.length);p.set(op.pos);p.set(mb.pos,op.pos.length);
    const n=new Float32Array(op.nrm.length+mb.nrm.length);n.set(op.nrm);n.set(mb.nrm,op.nrm.length);
    const c=new Float32Array(op.col.length+mb.col.length);c.set(op.col);c.set(mb.col,op.col.length);
    const ix=new Uint32Array(op.idx.length+mb.idx.length);ix.set(op.idx);
    const base=op.pos.length/3;
    for(let i=0;i<mb.idx.length;i++)ix[op.idx.length+i]=mb.idx[i]+base;
    w.props={pos:p,nrm:n,col:c,idx:ix};
    return mb.idx.length/3;
  }

  if(typeof window!=='undefined'&&typeof fetch==='function')startLoads();
  const oldInit=initGL;
  initGL=function(){const r=oldInit();startLoads();return r;};

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant)return w;

    const coreReady=!!(STORE.common1&&STORE.twisted1&&STORE.pine1&&STORE.bush&&STORE.fern);
    if(!coreReady){
      w.__realNature={ready:false,loading:true};
      return w;
    }

    const mb=new MeshB(),rr=mulberry32(sc.seed+913),n=w.nMain;
    const MAX_NEW_TRIS=430000;
    const stats={trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,skippedBudget:0};
    const available=keys=>keys.map(k=>STORE[k]).filter(Boolean);
    const pick=keys=>{const a=available(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const at=(km,off,model,scale,kind)=>{
      if(!model)return false;
      const now=mb.idx.length/3;
      if(now+(model.triangles||0)>MAX_NEW_TRIS){stats.skippedBudget++;return false;}
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      mb.setTF(x,w.meshH(x,z)-.06,z,rr()*6.28318,scale);
      appendModel(mb,model);
      if(kind&&stats[kind]!==undefined)stats[kind]++;
      return true;
    };
    const scatter=(k0,k1,step,pool,offMin,offMax,sMin,sMax,kind)=>{
      let j=0;
      for(let km=k0+step*.4;km<k1;km+=step*(.88+rr()*.24),j++){
        const side=(j&1)?1:-1;
        const off=side*(offMin+rr()*(offMax-offMin));
        at(km,off,pick(pool),sMin+rr()*(sMax-sMin),kind);
      }
    };

    /* 0-4 km — open green forest / meadow. */
    scatter(0,4,.27,['common1','common3','common5'],11,38,.72,1.08,'trees');
    scatter(0,4,.25,['bush','bushFlowers'],6,24,.58,.98,'bushes');

    /* 4-9 km — denser mixed woodland with twisted trees. */
    scatter(4,9,.29,['common1','common3','twisted1','twisted3'],8,31,.58,.94,'trees');
    scatter(4,9,.27,['bush','bushFlowers','fern'],5,20,.34,.78,'bushes');

    /* 9-14 km — wet jungle: fewer big trunks, much richer undergrowth. */
    scatter(9,14,.47,['twisted1','twisted3','common5'],9,28,.52,.84,'trees');
    scatter(9,14,.24,['fern'],4.5,17,.14,.28,'ferns');
    scatter(9,14,.44,['bushFlowers','flower4'],5,19,.34,.72,'flowers');
    scatter(9,14,.62,['mushroom'],4.5,15,.28,.50,'mushrooms');

    /* 14-19 km — exposed rocky / dead-wood section. */
    scatter(14,19,.72,['dead2','twisted1'],11,35,.45,.72,'trees');
    scatter(14,19,.43,['rock1','rock2'],6,27,.55,1.20,'rocks');
    scatter(14,19,.68,['bush'],8,24,.42,.72,'bushes');

    /* 19-23 km — alpine pine forest. */
    scatter(19,23,.30,['pine1','pine3','pine5'],8,32,.58,.94,'trees');
    scatter(19,23,.48,['rock1','rock2'],7,24,.55,1.05,'rocks');
    scatter(19,23,.58,['fern','bush'],6,19,.28,.60,'ferns');

    /* 23-25 km — mixed return, blending species from earlier biomes. */
    scatter(23,25,.31,['common1','common5','pine5','twisted1'],9,30,.58,.92,'trees');
    scatter(23,25,.29,['bush','bushFlowers','fern'],5,18,.30,.70,'bushes');
    scatter(23,25,.55,['flower4'],5,16,.30,.58,'flowers');

    mb.setTF(0,0,0,0,1);
    const tris=mergeProps(w,mb);
    w.__realNature={ready:true,triangles:tris,budget:MAX_NEW_TRIS,stats};
    console.log('Verdant v116 imported nature:',w.__realNature);
    return w;
  };
})();
