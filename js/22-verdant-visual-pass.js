"use strict";

/* Verdant Rift visual richness pass ---------------------------------------
   Runs only after the grade and terrain repairs.  It does not change route
   topology or physics: it enriches terrain colour and adds close-range real
   geometry so Verdant does not read as an empty green height field. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.verdant||!w.props) return w;

    const rnd=mulberry32(sc.seed+73017), noise=makeNoise(sc.seed+8121);
    const N=w.nMain, idxAt=km=>Math.max(0,Math.min(N-1,Math.floor(km*1000/ROUTE_STEP)));
    const point=(km,off)=>{
      const i=idxAt(km),side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      return {i,x,z,y:w.meshH(x,z)};
    };

    /* Less synthetic terrain colouring.  Snow becomes altitude/slope based
       rather than a hard white cap, and the valley gets broad natural colour
       variation that breaks up the single green carpet. */
    if(w.terrain&&w.terrain.pos&&w.terrain.col&&w.terrain.nrm){
      const P=w.terrain.pos,C=w.terrain.col,NN=w.terrain.nrm;
      const grassA=hx('#376f42'),grassB=hx('#6f9152'),rock=hx('#666b62'),snow=hx('#d9dedc'),soil=hx('#665b43');
      for(let v=0;v<P.length/3;v++){
        const k=v*3,c=v*4,x=P[k],y=P[k+1],z=P[k+2],ny=Math.max(0,NN[k+1]);
        const q=w._dbg&&w._dbg.roadNear?w._dbg.roadNear(x,z):null;
        const zone=q&&q.i>=0&&q.d<300?w.verdant.zoneAt(q.i):0;
        const n=clamp(noise(x/170,z/170)*.5+.5,0,1),micro=clamp(noise(x/43+11,z/43-7)*.5+.5,0,1);
        if(zone===0||zone===1||zone===3||zone===8){
          const g=[lerp(grassA[0],grassB[0],n),lerp(grassA[1],grassB[1],n),lerp(grassA[2],grassB[2],n)];
          const f=.28+.24*micro;C[c]=lerp(C[c],g[0],f);C[c+1]=lerp(C[c+1],g[1],f);C[c+2]=lerp(C[c+2],g[2],f);
        }
        const steep=clamp((.86-ny)/.38,0,1),rockAlt=clamp((y-145)/115,0,1),rf=Math.max(steep*.62,rockAlt*.32);
        C[c]=lerp(C[c],rock[0],rf);C[c+1]=lerp(C[c+1],rock[1],rf);C[c+2]=lerp(C[c+2],rock[2],rf);
        if(y<100&&micro<.22){const f=(.22-micro)*.8;C[c]=lerp(C[c],soil[0],f);C[c+1]=lerp(C[c+1],soil[1],f);C[c+2]=lerp(C[c+2],soil[2],f);}
        const sf=clamp((y-235)/85,0,1)*clamp((ny-.48)/.45,0,1);
        C[c]=lerp(C[c],snow[0],sf);C[c+1]=lerp(C[c+1],snow[1],sf);C[c+2]=lerp(C[c+2],snow[2],sf);
      }
    }

    /* Append real geometry to the already-corrected prop mesh. */
    const mb=new MeshB();
    mb.pos=Array.from(w.props.pos||[]);mb.nrm=Array.from(w.props.nrm||[]);mb.col=Array.from(w.props.col||[]);mb.idx=Array.from(w.props.idx||[]);mb.limb=[];
    const BIO={stem:hx('#4e5e3a'),leaf:hx('#3a7741'),glow:hx('#8ee8aa'),skin:hx('#806d50'),dark:hx('#28352b'),accent:hx('#bc6d43'),eye:hx('#f5e9a0')};
    const ROCK=hx('#5a5d55'),ROCK2=hx('#727469'),BUSH=hx('#477b43');
    const stamp=(km,off,scale,fn)=>{const p=point(km,off);mb.setTF(p.x,p.y-.08,p.z,rnd()*Math.PI*2,scale||1);fn(mb);mb.setTF(0,0,0,0,1);};
    const tree=(q,pine)=>{if(pine&&GLTREES.pine)appendGLTF(q,GLTREES.pine);else if(!pine&&GLTREES.oak)appendGLTF(q,GLTREES.oak);else if(pine)mPine(q,BIO,rnd);else mBroad(q,BIO,rnd);};
    const shrub=q=>{q.cyl(0,.02,0,.09,.65,6,BIO.stem);q.sph(0,.72,0,.62,8,5,BUSH);q.sph(.35,.56,.08,.38,7,4,BIO.leaf);q.sph(-.32,.52,-.12,.34,7,4,BIO.leaf);};
    const boulder=q=>{q.sph(0,.55,0,.95,9,5,rnd()<.5?ROCK:ROCK2);q.sph(.62,.30,.18,.48,8,4,ROCK);};

    /* 0-3 km: meadow / lakeside valley.  Deliberately asymmetric clusters,
       not evenly spaced roadside trees. */
    for(let km=.22;km<3;km+=.16+rnd()*.10){
      const side=rnd()<.5?-1:1,base=14+rnd()*34;
      const n=2+Math.floor(rnd()*4);
      for(let j=0;j<n;j++) stamp(km+(rnd()-.5)*.055,side*(base+j*4+rnd()*8),.55+rnd()*.62,q=>tree(q,rnd()<.28));
      if(rnd()<.75) stamp(km+(rnd()-.5)*.04,-side*(10+rnd()*28),.45+rnd()*.55,shrub);
      if(rnd()<.30) stamp(km,side*(9+rnd()*24),.55+rnd()*.75,boulder);
    }

    /* 3-6 km forest: denser pines and mixed understory. */
    for(let km=3.05;km<6;km+=.11+rnd()*.08){
      const side=rnd()<.5?-1:1,base=10+rnd()*28;
      for(let j=0;j<3+Math.floor(rnd()*3);j++) stamp(km+(rnd()-.5)*.04,side*(base+j*4+rnd()*7),.62+rnd()*.62,q=>tree(q,rnd()<.72));
      if(rnd()<.8)stamp(km,-side*(7+rnd()*22),.5+rnd()*.5,shrub);
    }

    /* 6-9 km wetland: lower vegetation and rocks keep sightlines open. */
    for(let km=6.05;km<9;km+=.13+rnd()*.12){
      const side=rnd()<.5?-1:1;
      stamp(km,side*(7+rnd()*17),.45+rnd()*.8,q=>mFan(q,BIO,rnd));
      if(rnd()<.55)stamp(km+(rnd()-.5)*.05,-side*(9+rnd()*24),.35+rnd()*.45,shrub);
      if(rnd()<.24)stamp(km,side*(15+rnd()*24),.5+rnd()*.7,boulder);
    }

    /* 9-13 km jungle single-track: close canopy, ferns are added by js/19. */
    for(let km=9.02;km<13;km+=.075+rnd()*.07){
      const side=rnd()<.5?-1:1,base=5.5+rnd()*14;
      for(let j=0;j<2+Math.floor(rnd()*3);j++) stamp(km+(rnd()-.5)*.035,side*(base+j*3.2+rnd()*4),.65+rnd()*.75,q=>tree(q,false));
      if(rnd()<.7)stamp(km,-side*(4+rnd()*9),.55+rnd()*.55,q=>mFan(q,BIO,rnd));
    }

    /* Alpine and return: break up the large smooth hills seen from the start. */
    for(let km=18.0;km<22.5;km+=.12+rnd()*.10){
      const side=rnd()<.5?-1:1;
      for(let j=0;j<2+Math.floor(rnd()*3);j++)stamp(km+(rnd()-.5)*.05,side*(10+j*6+rnd()*30),.55+rnd()*.72,q=>tree(q,true));
      if(rnd()<.5)stamp(km,-side*(12+rnd()*34),.55+rnd()*.9,boulder);
    }
    for(let km=22.55;km<24.95;km+=.14+rnd()*.12){
      const side=rnd()<.5?-1:1;
      for(let j=0;j<2+Math.floor(rnd()*3);j++)stamp(km+(rnd()-.5)*.05,side*(12+j*5+rnd()*34),.55+rnd()*.72,q=>tree(q,rnd()<.55));
      if(rnd()<.65)stamp(km,-side*(9+rnd()*25),.45+rnd()*.55,shrub);
    }

    w.props={pos:new Float32Array(mb.pos),nrm:new Float32Array(mb.nrm),col:new Float32Array(mb.col),idx:new Uint32Array(mb.idx)};
    w.__verdantVisual={extraPropTriangles:Math.max(0,(w.props.idx.length-(w.__verdantVisualBaseIdx||0))/3)};
    return w;
  };
})();
