"use strict";

/* Aqua Rift v156 — remove coral podiums + user-uploaded water creatures.
   Loaded after v155. It preserves the approved 2,800-group reef, fish,
   jellyfish, road/glass/water and Verdant v142. */
(function(){
  const AQUA_ID='aqua',VERSION=156,TWO_PI=Math.PI*2,BASE_GLASS_R=8.8;
  const MD=globalThis.__AQUA_V156_MODELS||{};
  const UPLOADED_MODELS={
    aqSiren156:{n:297,ni:1791,lo:[-0.2048635584702408,-0.500346448159721,-0.157304049530409],hi:[0.19499994557326614,0.5035273487837612,0.1582223206443559],col:[.22,.50,.58,.035],b:MD.siren||''},
    aqCrawler156:{n:431,ni:2616,lo:[-0.3938077644609183,-0.37779584510752395,-0.2173925832484013],hi:[0.4052831446600837,0.3826089346107078,0.2196102663015535],col:[.45,.31,.57,.025],b:MD.crawler||''},
    aqEel156:{n:262,ni:1551,lo:[-0.948686973907773,-0.19548850108675273,-0.225909791262309],hi:[0.9722856298941878,0.19919365194850955,0.22820306134248913],col:[.28,.48,.43,.030],b:MD.eelbeast||''},
    aqLeviathan156:{n:427,ni:3558,lo:[-0.2373310650479686,-0.45092079056031775,-0.47354320286788143],hi:[0.23509335232920367,0.4320449831987989,0.48820910958309044],col:[.48,.27,.40,.045],b:MD.leviathan||''}
  };

  /* v155 still created the visible dark platforms with three very flat box()
     calls inside moundBase(). Filter only those calls. Structural Aqua tunnel
     rails (h=.35) and every non-Aqua box remain untouched. */
  let platformBoxesSuppressed=0;
  if(typeof MeshB!=='undefined'&&MeshB.prototype&&!MeshB.prototype.__aquaV156NoPodiums){
    const originalBox=MeshB.prototype.box;
    MeshB.prototype.box=function(x,y,z,w,h,d,col,em){
      if(h<=.12&&d<=.60&&w<=2.10){
        const stack=(new Error()).stack||'';
        if(stack.indexOf('moundBase')>=0){platformBoxesSuppressed++;return;}
      }
      return originalBox.apply(this,arguments);
    };
    MeshB.prototype.__aquaV156NoPodiums=true;
  }

  function registerUploadedCreature(key,d){
    try{
      if(!d.b)throw new Error('model data missing');
      const raw=Uint8Array.from(atob(d.b),c=>c.charCodeAt(0));
      const words=new Uint16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),nv=d.n,ni=d.ni;
      if(words.length!==nv*3+ni)throw new Error('model payload size mismatch');
      const pos=new Float32Array(nv*3),nrm=new Float32Array(nv*3),idx=new Uint32Array(ni);
      for(let v=0;v<nv;v++)for(let j=0;j<3;j++)pos[v*3+j]=d.lo[j]+(d.hi[j]-d.lo[j])*(words[v*3+j]/65535);
      const io=nv*3;for(let i=0;i<ni;i++)idx[i]=words[io+i];
      for(let i=0;i<ni;i+=3){
        const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3,
          ax=pos[ib]-pos[ia],ay=pos[ib+1]-pos[ia+1],az=pos[ib+2]-pos[ia+2],
          bx=pos[ic]-pos[ia],by=pos[ic+1]-pos[ia+1],bz=pos[ic+2]-pos[ia+2],
          nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
        for(const o of [ia,ib,ic]){nrm[o]+=nx;nrm[o+1]+=ny;nrm[o+2]+=nz;}
      }
      for(let v=0;v<nv;v++){
        const o=v*3,L=Math.hypot(nrm[o],nrm[o+1],nrm[o+2])||1;
        nrm[o]/=L;nrm[o+1]/=L;nrm[o+2]/=L;
      }
      const col=new Float32Array(nv*4),limb=new Float32Array(nv);
      for(let v=0;v<nv;v++){col[v*4]=d.col[0];col[v*4+1]=d.col[1];col[v*4+2]=d.col[2];col[v*4+3]=d.col[3];}
      const mk=(a,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
      GLCRE[key]={ready:true,N:1,frames:[{pos:mk(pos),nrm:mk(nrm)}],col:mk(col),limbB:mk(limb),idxB:mk(idx,gl.ELEMENT_ARRAY_BUFFER),count:idx.length};
    }catch(e){console.warn('Aqua v156 uploaded creature failed:',key,e.message);}
  }

  const previousInit=initGL;
  initGL=function(){
    const r=previousInit();
    for(const key in UPLOADED_MODELS)registerUploadedCreature(key,UPLOADED_MODELS[key]);
    return r;
  };

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{
      i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;
    };
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,i};};
    return {n,radiusAt,pose};
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    if(sc&&sc.id===AQUA_ID)platformBoxesSuppressed=0;
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    const H=helpers(w),n=H.n;if(!n||!w.actors)return w;
    const rnd=mulberry32((sc.seed||14373)+156156),before=w.actors.length;
    const creatureCounts={siren:0,crawler:0,eelbeast:0,leviathan:0};
    const addCreature=(kind,key,count,opt)=>{
      for(let q=0;q<count;q++){
        const i=((q+.31+rnd()*.38)*n/count)|0,side=((q+(opt.flip||0))&1)?1:-1,
          glass=H.radiusAt(i),minOff=Math.max(opt.off0,glass+6),
          p=H.pose(i,side*(minOff+rnd()*(Math.max(minOff+.1,opt.off1)-minOff))),
          gy=typeof w.groundAt==='function'?w.groundAt(p.x,p.z):w.ry[i]-8,
          ph=rnd()*TWO_PI,r=opt.r0+rnd()*(opt.r1-opt.r0),alt=opt.a0+rnd()*(opt.a1-opt.a0),
          k=opt.k0+rnd()*(opt.k1-opt.k0),dir=rnd()<.5?-1:1;
        w.actors.push({type:'drone',gcre:key,mesh:'drone',aquaCreatureV156:true,creatureClass:kind,
          cx:p.x,cz:p.z,gy,r,alt,ph,w:dir*(opt.w0+rnd()*(opt.w1-opt.w0)),
          px:p.x+Math.cos(ph)*r,py:gy+alt,pz:p.z+Math.sin(ph)*r,
          yaw:ph+(opt.yawBias||0),pitch:opt.pitch||0,k,emiss:opt.emiss||.82,gph:ph});
        creatureCounts[kind]++;
      }
    };
    addCreature('siren','aqSiren156',10,{off0:34,off1:88,r0:3,r1:10,a0:8,a1:28,k0:3.2,k1:5.4,w0:.004,w1:.010,emiss:.86});
    addCreature('crawler','aqCrawler156',8,{off0:42,off1:98,r0:4,r1:12,a0:5,a1:22,k0:4.2,k1:6.8,w0:.003,w1:.008,emiss:.78,flip:1});
    addCreature('eelbeast','aqEel156',16,{off0:28,off1:82,r0:5,r1:14,a0:7,a1:30,k0:2.5,k1:4.4,w0:.006,w1:.014,emiss:.80,yawBias:Math.PI/2});
    addCreature('leviathan','aqLeviathan156',2,{off0:82,off1:145,r0:8,r1:20,a0:12,a1:34,k0:10,k1:15,w0:.0015,w1:.0035,emiss:.72});

    const jelly=w.actors.filter(a=>a&&a.aquaJellyV152===true).length;
    const fish=w.actors.filter(a=>a&&a.aquaFish===true).length;
    const prior=w.__aquaV155||{};
    w.__aquaV156={version:VERSION,reefBaseBoxesRemoved:true,reefBaseCylindersRemoved:true,
      platformBoxesSuppressed,uploadedUserModels:true,customCreatureCount:36,creatureCounts,
      heroLeviathans:creatureCounts.leviathan,coralGroups:prior.coralGroups||2800,
      nearGroups:prior.nearGroups||700,midGroups:prior.midGroups||1400,farGroups:prior.farGroups||700,
      heroGroups:prior.heroGroups||280,primaryHeroes:prior.primaryHeroes||140,secondaryHeroes:prior.secondaryHeroes||140,
      moundGroups:prior.moundGroups||2800,accentGroups:prior.accentGroups||840,
      jellyPreserved:jelly,properProjectJellyPreserved:jelly===60,fishPreserved:fish,
      priorActorCount:before,existingActorsPreserved:true,roadUnchanged:true,glassUnchanged:true,verdantUntouched:true};
    console.log('Aqua Rift v156 no-podium reef + uploaded creatures:',w.__aquaV156);
    return w;
  };

  globalThis.__aquaV156Spec={VERSION,customCreatureCount:36,creatureCounts:{siren:10,crawler:8,eelbeast:16,leviathan:2},reefBaseBoxesRemoved:true,reefBaseCylindersRemoved:true};
})();
