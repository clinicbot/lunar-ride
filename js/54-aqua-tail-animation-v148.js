"use strict";

/* Aqua Rift v148 — articulated-looking body/tail swim animation ------------
   v147 gave the fish proper horizontal trajectories but the meshes themselves
   were still rigid. This Aqua-only loader intercepts the 11 fish models and
   bakes 24 shared geometry frames per species. The head stays almost fixed,
   the body bends progressively, and the tail receives the largest lateral
   excursion. Small reef fish beat faster; sharks/swordfish beat slower.
   Verdant and every non-Aqua creature still use the original loader.

   All imported Aqua fish are authored long-axis Y and are rotated -90 deg on
   X at actor level by v145. Therefore local X is the only correct lateral tail
   plane after that rotation; local Z becomes world vertical. Earlier automatic
   transverse-axis selection made sharks and several other species buck up/down.

   js/19 loads this file before js/07 defines updateActors(), so the model/frame
   hooks install immediately while the per-frame phase updater retries on the
   next task until physics exists, exactly like v147's motion wrapper. */
(function(){
  const VERSION=148,FRAME_COUNT=24;
  const BODY_START=.14,TAIL_AMPLITUDE=.075,SPATIAL_PHASE=1.55;
  const FISH_KEYS=new Set(['aqClown','aqFishA','aqFishB','aqFishC','aqShark','aqAngler',
    'aqPuffer','aqLion','aqButterfly','aqSword','aqBlackLion']);
  const TAIL_SPEED={aqClown:9.2,aqFishA:7.8,aqFishB:7.5,aqFishC:7.7,aqShark:4.4,
    aqAngler:5.8,aqPuffer:6.2,aqLion:7.0,aqButterfly:8.4,aqSword:5.2,aqBlackLion:6.8};
  const TWO_PI=Math.PI*2;

  const previousLoader=loadGLTFCreature;
  loadGLTFCreature=async function(key,file,opts){
    if(!FISH_KEYS.has(key))return previousLoader(key,file,opts);
    try{return await loadAnimatedFish(key,file);}catch(e){
      console.warn('Aqua v148 animated fish fallback:',file,e&&e.message?e.message:e);
      return previousLoader(key,file,opts);
    }
  };

  async function loadAnimatedFish(key,file){
    const res=await fetch(file);if(!res.ok)throw new Error('HTTP '+res.status);
    const gj=await res.json(),uri=gj.buffers&&gj.buffers[0]&&gj.buffers[0].uri;
    if(!uri||uri.indexOf('base64,')<0)throw new Error('embedded buffer missing');
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const acc=i=>{const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],T=CT[a.componentType];
      if(!T)throw new Error('component type '+a.componentType);
      return new T(bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);};

    const P=[],N=[],I=[],CV=[];
    for(const mesh of gj.meshes||[])for(const pr of mesh.primitives||[]){
      const pos=acc(pr.attributes.POSITION),nrm=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL):null;
      const base=P.length/3,mat=(gj.materials||[])[pr.material]||{},
        c=(mat.pbrMetallicRoughness||{}).baseColorFactor||[.6,.6,.6,1],
        em=((mat.name||'').indexOf('glow')===0)?1.5:.02;
      for(let v=0;v<pos.length;v+=3){
        P.push(pos[v],pos[v+1],pos[v+2]);
        if(nrm)N.push(nrm[v],nrm[v+1],nrm[v+2]);else N.push(0,1,0);
        CV.push(c[0],c[1],c[2],em);
      }
      if(pr.indices!==undefined){const idx=acc(pr.indices);for(let j=0;j<idx.length;j++)I.push(base+idx[j]);}
      else for(let j=0;j<pos.length/3;j++)I.push(base+j);
    }
    if(!P.length||!I.length)throw new Error('empty fish mesh');

    const shape=analyseFishGeometry(P),mk=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);
      gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
    const frames=[];
    for(let f=0;f<FRAME_COUNT;f++){
      const d=deformFishFrame(P,N,shape,f/FRAME_COUNT);
      frames.push({pos:mk(d.pos),nrm:mk(d.nrm)});
    }
    const limb=new Float32Array(P.length/3);
    GLCRE[key]={ready:true,N:FRAME_COUNT,frames,col:mk(new Float32Array(CV)),
      limbB:mk(limb),idxB:mk(new Uint32Array(I),gl.ELEMENT_ARRAY_BUFFER),count:I.length,
      aquaTailAnimated:true,fishShape:shape};
    console.log('Aqua v148 tail/body fish baked:',key,FRAME_COUNT,'frames','axis',shape.longAxis,'side',shape.sideAxis,'tailHigh',shape.tailHigh);
    if(typeof updBuildTag==='function')updBuildTag();
    return GLCRE[key];
  }

  function analyseFishGeometry(P){
    const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<P.length;i+=3)for(let a=0;a<3;a++){const v=P[i+a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}
    const ex=mx.map((v,a)=>v-mn[a]),longAxis=ex.indexOf(Math.max(...ex));
    let sideAxis,upAxis;
    if(longAxis===1){
      /* Quaternius FBX2glTF fish: local Y -> forward after v145 pitch,
         local X -> world horizontal, local Z -> world vertical. */
      sideAxis=0;upAxis=2;
    }else{
      /* Defensive fallback for any future differently-authored model. Prefer
         X when it is transverse because actor pitch never turns X vertical. */
      const rem=[0,1,2].filter(a=>a!==longAxis);
      sideAxis=rem.includes(0)?0:rem[0];upAxis=rem[0]===sideAxis?rem[1]:rem[0];
    }
    const L=Math.max(ex[longAxis],1e-6),edge=.22;
    let loMin=Infinity,loMax=-Infinity,hiMin=Infinity,hiMax=-Infinity,loN=0,hiN=0;
    for(let i=0;i<P.length;i+=3){const u=(P[i+longAxis]-mn[longAxis])/L,s=P[i+sideAxis];
      if(u<edge){loMin=Math.min(loMin,s);loMax=Math.max(loMax,s);loN++;}
      if(u>1-edge){hiMin=Math.min(hiMin,s);hiMax=Math.max(hiMax,s);hiN++;}}
    const loSpread=loN?loMax-loMin:ex[sideAxis],hiSpread=hiN?hiMax-hiMin:ex[sideAxis];
    const tailHigh=hiSpread<=loSpread;
    return {mn,mx,extent:ex,longAxis,sideAxis,upAxis,length:L,tailHigh,
      horizontalFlexAxis:sideAxis===0,sideCentre:(mn[sideAxis]+mx[sideAxis])*.5,
      lowSpread:loSpread,highSpread:hiSpread};
  }

  function deformFishFrame(P,N,shape,cycle){
    const pos=new Float32Array(P.length),nrm=new Float32Array(N.length),
      la=shape.longAxis,sa=shape.sideAxis,L=shape.length,dir=shape.tailHigh?1:-1,
      phase=cycle*TWO_PI,side0=shape.sideCentre;
    for(let i=0;i<P.length;i+=3){
      const raw=(P[i+la]-shape.mn[la])/L,u=shape.tailHigh?raw:1-raw;
      const q=Math.max(0,Math.min(1,(u-BODY_START)/(1-BODY_START))),smooth=q*q*(3-2*q),
        ds=(q>0&&q<1)?6*q*(1-q)/(1-BODY_START):0,
        th=phase-SPATIAL_PHASE*u,st=Math.sin(th),ct=Math.cos(th),
        disp=L*TAIL_AMPLITUDE*smooth*st,
        slope=dir*TAIL_AMPLITUDE*(ds*st-SPATIAL_PHASE*smooth*ct),ang=Math.atan(slope),
        ca=Math.cos(ang),sn=Math.sin(ang),lat=P[i+sa]-side0;
      pos[i]=P[i];pos[i+1]=P[i+1];pos[i+2]=P[i+2];
      pos[i+la]=P[i+la]-lat*sn;pos[i+sa]=side0+lat*ca+disp;
      const nl=N[i+la],ns=N[i+sa];
      nrm[i]=N[i];nrm[i+1]=N[i+1];nrm[i+2]=N[i+2];
      nrm[i+la]=nl*ca-ns*sn;nrm[i+sa]=nl*sn+ns*ca;
      const ll=Math.hypot(nrm[i],nrm[i+1],nrm[i+2])||1;nrm[i]/=ll;nrm[i+1]/=ll;nrm[i+2]/=ll;
    }
    return {pos,nrm};
  }

  const previousFrame=glCreFrame;
  glCreFrame=function(a){
    const G=a&&a.aquaFish===true?GLCRE[a.gcre]:null;
    if(!G||!G.aquaTailAnimated||!G.ready)return previousFrame(a);
    const ph=a.__aquaTailPhase===undefined?(a.ph||0):a.__aquaTailPhase,
      fi=((Math.floor((((ph%TWO_PI)+TWO_PI)%TWO_PI)/TWO_PI*G.N)%G.N)+G.N)%G.N,F=G.frames[fi];
    return {pos:F.pos,nrm:F.nrm,col:G.col,limb:G.limbB,idx:G.idxB,count:G.count};
  };

  function installTailUpdate(){
    if(globalThis.__aquaFishV148UpdateInstalled)return;
    if(typeof updateActors!=='function'){
      if(typeof setTimeout==='function')setTimeout(installTailUpdate,0);
      return;
    }
    globalThis.__aquaFishV148UpdateInstalled=true;
    const previousUpdate=updateActors;
    updateActors=function(dt){
      previousUpdate(dt);
      if(!world||!state||!state.scene||state.scene.id!=='aqua'||!Array.isArray(world.actors))return;
      let animated=0;
      for(const a of world.actors){if(!a||a.aquaFish!==true)continue;
        if(a.__aquaTailPhase===undefined)a.__aquaTailPhase=a.ph||0;
        const base=TAIL_SPEED[a.gcre]||7.0,variation=.92+.16*(Math.sin((a.ph||0)*2.37)*.5+.5);
        a.__aquaTailPhase=(a.__aquaTailPhase+dt*base*variation)%TWO_PI;animated++;}
      if(!world.__aquaFishV148||world.__aquaFishV148.animated!==animated){
        world.__aquaFishV148={version:VERSION,animated,framesPerSpecies:FRAME_COUNT,
          bodyStart:BODY_START,tailAmplitude:TAIL_AMPLITUDE,spatialPhase:SPATIAL_PHASE,
          speciesTailSpeed:Object.assign({},TAIL_SPEED),geometryBaked:true,headAnchored:true,
          horizontalTailPlane:true,deferredUpdateInstall:true};
        if(world.__aquaFishV147)world.__aquaFishV147.correctedByV148=true;
        console.log('Aqua Rift v148 body/tail animation:',world.__aquaFishV148);
      }
    };
  }

  globalThis.__aquaFishV148Spec={VERSION,FRAME_COUNT,BODY_START,TAIL_AMPLITUDE,SPATIAL_PHASE,
    fishKeys:[...FISH_KEYS],tailSpeed:Object.assign({},TAIL_SPEED),analyseFishGeometry,deformFishFrame};
  installTailUpdate();
})();
