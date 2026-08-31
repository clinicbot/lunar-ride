"use strict";

/* Aqua Rift v148 — articulated body/tail animation, face-enhanced by v150 ---
   v147 gives the fish horizontal trajectories.  This loader bakes 24 shared
   geometry frames per species, keeps the head stable, bends the tail in the
   horizontal plane, and now adds durable geometric eyes/pupils/mouth details
   before the frames are baked.  That makes faces readable even though Lunar
   Ride's lightweight creature path does not render the tiny source textures.
   Verdant and every non-Aqua creature keep the original loader. */
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

    /* Analyse the untouched source body first. Facial geometry is then added
       into the anchored head region, so eyes and mouth ride with the head but
       never get dragged by the tail wave. */
    const shape=analyseFishGeometry(P);
    const face=addFaceDetail(P,N,I,CV,shape,key);
    const mk=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);
      gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
    const frames=[];
    for(let f=0;f<FRAME_COUNT;f++){
      const d=deformFishFrame(P,N,shape,f/FRAME_COUNT);
      frames.push({pos:mk(d.pos),nrm:mk(d.nrm)});
    }
    const limb=new Float32Array(P.length/3);
    GLCRE[key]={ready:true,N:FRAME_COUNT,frames,col:mk(new Float32Array(CV)),
      limbB:mk(limb),idxB:mk(new Uint32Array(I),gl.ELEMENT_ARRAY_BUFFER),count:I.length,
      aquaTailAnimated:true,fishShape:shape,faceEnhanced:true,faceDetail:face};
    console.log('Aqua fish baked:',key,FRAME_COUNT,'frames','axis',shape.longAxis,
      'side',shape.sideAxis,'tailHigh',shape.tailHigh,'face',face);
    if(typeof updBuildTag==='function')updBuildTag();
    return GLCRE[key];
  }

  function analyseFishGeometry(P){
    const mn=[Infinity,Infinity,Infinity],mx=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<P.length;i+=3)for(let a=0;a<3;a++){const v=P[i+a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}
    const ex=mx.map((v,a)=>v-mn[a]),longAxis=ex.indexOf(Math.max(...ex));
    let sideAxis,upAxis;
    if(longAxis===1){sideAxis=0;upAxis=2;}
    else{const rem=[0,1,2].filter(a=>a!==longAxis);sideAxis=rem.includes(0)?0:rem[0];upAxis=rem[0]===sideAxis?rem[1]:rem[0];}
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

  function addFaceDetail(P,N,I,CV,shape,key){
    const la=shape.longAxis,sa=shape.sideAxis,ua=shape.upAxis,L=shape.length,
      inward=shape.tailHigh?1:-1,head=shape.tailHigh?shape.mn[la]:shape.mx[la],
      side0=(shape.mn[sa]+shape.mx[sa])*.5,up0=(shape.mn[ua]+shape.mx[ua])*.5,
      sideHalf=Math.max(L*.035,shape.extent[sa]*.39),
      eyeR=Math.max(L*.020,Math.min(L*.045,Math.max(shape.extent[sa],shape.extent[ua])*.105));
    const EYE=[.94,.91,.64,.18],PUP=[.012,.016,.015,.01],MOUTH=[.055,.018,.022,.015];

    const addEllipsoid=(centre,radii,col,seg=8,rings=5)=>{
      const base=P.length/3;
      for(let r=0;r<=rings;r++){
        const th=r/rings*Math.PI,st=Math.sin(th),ct=Math.cos(th);
        for(let s=0;s<=seg;s++){
          const ph=s/seg*TWO_PI,cp=Math.cos(ph),sp=Math.sin(ph);
          const v=[centre[0]+radii[0]*st*cp,centre[1]+radii[1]*ct,centre[2]+radii[2]*st*sp];
          const nn=[(v[0]-centre[0])/(radii[0]*radii[0]),(v[1]-centre[1])/(radii[1]*radii[1]),(v[2]-centre[2])/(radii[2]*radii[2])];
          const nl=Math.hypot(nn[0],nn[1],nn[2])||1;
          P.push(v[0],v[1],v[2]);N.push(nn[0]/nl,nn[1]/nl,nn[2]/nl);CV.push(col[0],col[1],col[2],col[3]);
        }
      }
      for(let r=0;r<rings;r++)for(let s=0;s<seg;s++){
        const a=base+r*(seg+1)+s,b=a+seg+1;
        I.push(a,b,a+1,a+1,b,b+1);
      }
    };
    const axisR=(along,side,up)=>{const q=[eyeR,eyeR,eyeR];q[la]=along;q[sa]=side;q[ua]=up;return q;};
    const centre=(along,side,up)=>{const q=[0,0,0];q[la]=along;q[sa]=side;q[ua]=up;return q;};

    const eyeAlong=head+inward*L*.105,eyeUp=up0+shape.extent[ua]*.10;
    for(const sg of [-1,1]){
      const ec=centre(eyeAlong,side0+sg*sideHalf,eyeUp);
      addEllipsoid(ec,axisR(eyeR*.92,eyeR,eyeR*.92),EYE,8,5);
      const pc=ec.slice();pc[sa]+=sg*eyeR*.70;
      addEllipsoid(pc,axisR(eyeR*.48,eyeR*.44,eyeR*.48),PUP,7,4);
    }
    const mouthAlong=head+inward*L*.025,mouthUp=up0-shape.extent[ua]*.10;
    addEllipsoid(centre(mouthAlong,side0,mouthUp),axisR(eyeR*.24,eyeR*.72,eyeR*.28),MOUTH,8,4);
    return {key,eyes:2,pupils:2,mouth:1,eyeRadius:eyeR,headEnd:shape.tailHigh?'low':'high'};
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
          horizontalTailPlane:true,faceEnhanced:true,deferredUpdateInstall:true};
        if(world.__aquaFishV147)world.__aquaFishV147.correctedByV148=true;
        console.log('Aqua Rift v148 body/tail animation:',world.__aquaFishV148);
      }
    };
  }

  globalThis.__aquaFishV148Spec={VERSION,FRAME_COUNT,BODY_START,TAIL_AMPLITUDE,SPATIAL_PHASE,
    fishKeys:[...FISH_KEYS],tailSpeed:Object.assign({},TAIL_SPEED),analyseFishGeometry,
    addFaceDetail,deformFishFrame};
  installTailUpdate();
})();
