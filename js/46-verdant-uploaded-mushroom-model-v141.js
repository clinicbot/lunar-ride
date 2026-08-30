"use strict";

/* Verdant Rift v141 — exact uploaded mushroom model -----------------------
   The user supplied GLB was reduced from ~156k triangles to a tiny 223-triangle
   vertex-colour glTF. This script loads that same-origin asset synchronously
   during script startup so buildWorld can remain synchronous and deterministic. */
(function(){
  const FILE='assets/models/verdant_mushroom_uploaded_v141.gltf';
  const STATUS={file:FILE,ready:false,error:null,triangles:0,vertices:0};
  const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

  function decodeDataUri(uri){
    const raw=atob(uri.slice(uri.indexOf(',')+1)),a=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);
    return a.buffer;
  }
  function accessor(g,b,i){
    const a=g.accessors[i],v=g.bufferViews[a.bufferView],Ctor=CT[a.componentType],nc=NC[a.type];
    if(!Ctor||!nc)throw new Error('unsupported accessor');
    const bytes=Ctor.BYTES_PER_ELEMENT,off=(v.byteOffset||0)+(a.byteOffset||0);
    const stride=v.byteStride||nc*bytes;
    if(stride!==nc*bytes)throw new Error('strided accessor not supported');
    return {data:new Ctor(b,off,a.count*nc),nc,count:a.count};
  }
  function parse(g){
    if(!g||!g.buffers||!g.buffers[0]||!String(g.buffers[0].uri||'').startsWith('data:'))
      throw new Error('embedded glTF buffer required');
    const b=decodeDataUri(g.buffers[0].uri),pr=g.meshes&&g.meshes[0]&&g.meshes[0].primitives&&g.meshes[0].primitives[0];
    if(!pr||pr.attributes.POSITION===undefined||pr.attributes.NORMAL===undefined||pr.attributes.COLOR_0===undefined||pr.indices===undefined)
      throw new Error('mushroom glTF attributes incomplete');
    const P=accessor(g,b,pr.attributes.POSITION),N=accessor(g,b,pr.attributes.NORMAL),C=accessor(g,b,pr.attributes.COLOR_0),I=accessor(g,b,pr.indices);
    const count=I.count,pos=new Float32Array(count*3),nrm=new Float32Array(count*3),col=new Float32Array(count*3);
    for(let j=0;j<count;j++){
      const vi=I.data[j],d=j*3,s=vi*3;
      pos[d]=P.data[s];pos[d+1]=P.data[s+1];pos[d+2]=P.data[s+2];
      nrm[d]=N.data[s];nrm[d+1]=N.data[s+1];nrm[d+2]=N.data[s+2];
      col[d]=C.data[s];col[d+1]=C.data[s+1];col[d+2]=C.data[s+2];
    }
    return {pos,nrm,col,count,triangles:count/3,file:FILE,source:'user-uploaded-glb'};
  }
  function load(){
    try{
      const x=new XMLHttpRequest();x.open('GET',FILE+'?b=141',false);x.send(null);
      if(x.status&&!(x.status>=200&&x.status<300))throw new Error('HTTP '+x.status);
      const m=parse(JSON.parse(x.responseText));
      STATUS.ready=true;STATUS.triangles=m.triangles;STATUS.vertices=m.count;
      globalThis.__verdantUploadedMushroomModelV141=m;
      console.log('Verdant v141 uploaded mushroom ready:',m.triangles,'triangles');
    }catch(e){
      STATUS.error=String(e&&e.message||e);console.warn('Verdant v141 uploaded mushroom unavailable:',STATUS.error);
    }
  }
  globalThis.__verdantUploadedMushroomStatusV141=()=>({...STATUS});
  load();
})();
