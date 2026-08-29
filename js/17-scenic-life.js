"use strict";

/* ==========================================================================\n   17. Scenic-route population pass\n   --------------------------------------------------------------------------\n   Hand-drawn/scenic roads are appended after the original world has already\n   distributed its actors and scenery. Give the added road its own population\n   pass, reusing existing scene actors/animations and the same visual palette.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const baseBuildWorld=buildWorld;

  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};

  function populate(w,scene){
    if(!w||!w.nCut||!w.actors||!scene||scene.id!=='copernicus') return w;
    const rnd=mulberry32((scene.seed||1)+17017);
    const base=w.nMain,n=w.nCut,hw=scene.road.halfWidth||3;

    function spot(f,side=1,off=16){
      const k=clamp(Math.round(f*(n-1)),2,n-3),i=base+k;
      const x=w.rx[i]-w.tz[i]*off*side,z=w.rz[i]+w.tx[i]*off*side;
      let y=w.ry[i]-.25;
      if(w._dbg&&typeof w._dbg.landAt==='function'){
        const gy=w._dbg.landAt(x,z);
        if(Number.isFinite(gy)&&Math.abs(gy-w.ry[i])<18)y=gy;
      }
      return {k,i,x,y,z,rx:w.rx[i],rz:w.rz[i],ry:w.ry[i],tx:w.tx[i],tz:w.tz[i],side,off};
    }

    const proto=type=>w.actors.find(a=>a.type===type);
    const protoWhere=(type,pred)=>w.actors.find(a=>a.type===type&&(!pred||pred(a)));
    let addedActors=0;

    function addGroundClone(type,f,side,off,extra={}){
      const p0=proto(type); if(!p0)return;
      const p=spot(f,side,off),a={...p0,...extra};
      a.hx=p.x;a.hz=p.z;a.px=p.x;a.pz=p.z;
      if('cx' in a){a.cx=p.x;a.cz=p.z;}
      if('baseRoadY' in a)a.baseRoadY=p.ry;
      if('pinY' in a)delete a.pinY;
      if('pinAlt' in a)delete a.pinAlt;
      if('rdx' in a){a.rdx=p.rx;a.rdz=p.rz;}
      if('awayX' in a){const d=Math.hypot(p.x-p.rx,p.z-p.rz)||1;a.awayX=(p.x-p.rx)/d;a.awayZ=(p.z-p.rz)/d;}
      if('gy' in a)a.gy=p.y;
      a.wander=rnd()*6.28318;a.ph=rnd()*6.28318;a.yaw=rnd()*6.28318;
      w.actors.push(a);addedActors++;
    }

    /* The scene's own fauna, concentrated along the new road. */
    const fauna=scene.fauna||{},faunaKinds=Object.keys(fauna).filter(k=>fauna[k]>0&&proto(k));
    faunaKinds.forEach((kind,ki)=>{
      addGroundClone(kind,.18+ki*.08,ki%2?1:-1,hw+12+rnd()*8);
      addGroundClone(kind,.55+ki*.09,ki%2?-1:1,hw+14+rnd()*11);
      addGroundClone(kind,.78-ki*.05,ki%2?1:-1,hw+10+rnd()*8);
    });

    /* Astronauts working at two roadside research stops. */
    if(proto('astro')){
      for(const f of [.30,.34,.69,.73]){
        const side=f<.5?1:-1;
        addGroundClone('astro',f,side,25+rnd()*8,{r:4+rnd()*7,walk:true,w:(rnd()<.5?-1:1)*(.05+rnd()*.07)});
      }
    }

    /* Drones patrol above the branch rather than above the old loop. */
    if(proto('drone')) for(const f of [.24,.50,.76]){
      const p=spot(f,f>.5?-1:1,18),a={...proto('drone')};
      a.cx=p.x;a.cz=p.z;a.gy=p.ry;a.r=28+rnd()*42;a.alt=22+rnd()*28;
      a.ph=rnd()*6.28318;a.w=(rnd()<.5?-1:1)*(.12+rnd()*.12);
      w.actors.push(a);addedActors++;
    }

    /* Existing animated bird model(s), including whichever Copernicus loaded. */
    const bird=protoWhere('gbird',a=>!('pinAlt' in a))||proto('gbird');
    if(bird) for(const f of [.16,.40,.61,.84]){
      const p=spot(f,rnd()<.5?-1:1,10+rnd()*12),flock=2+(rnd()<.45?1:0);
      for(let b=0;b<flock;b++){
        const a={...bird};
        a.cx=p.x+(rnd()*2-1)*7;a.cz=p.z+(rnd()*2-1)*7;
        a.R=18+rnd()*28;a.circ=rnd()*6.28318;a.w=(rnd()<.5?-1:1)*(.07+rnd()*.08);
        a.baseY=p.ry+10+rnd()*15;a.px=a.cx;a.pz=a.cz;a.py=a.baseY;
        delete a.pinAlt;delete a.noGlide;
        a.flap=true;a.flapT=.8+rnd()*2.2;a.gph=rnd()*6.28318;
        w.actors.push(a);addedActors++;
      }
    }

    /* Air traffic crossing the new valley. */
    if(proto('shuttle')) for(const f of [.37,.82]){
      const p=spot(f,1,0),a={...proto('shuttle')};
      const side=rnd()<.5?-1:1;
      a.dx=-p.tz*side;a.dz=p.tx*side;a.sx=p.x-a.dx*900;a.sz=p.z-a.dz*900;
      a.len=1800;a.s0=rnd()*900;a.alt=150+rnd()*150;a.spd=48+rnd()*30;
      w.actors.push(a);addedActors++;
    }

    /* A second orbital station makes the scenic section feel inhabited too. */
    if(proto('station')){
      const a={...proto('station')};a.ph=rnd()*6.28318;a.r=1050+rnd()*330;a.alt=620+rnd()*130;a.w=(rnd()<.5?-1:1)*.013;
      w.actors.push(a);addedActors++;
    }

    /* Static route-specific props: research outposts, antennae and crystal\n       markers. They use the ordinary props mesh, so lighting/shadows remain\n       identical to the rest of the world. */
    if(w.props&&w.props.pos&&w.props.nrm&&w.props.col&&w.props.idx){
      const P=[],N=[],C=[],I=[];
      const kit=scene.kit||{},bio=scene.bio||{};
      const cHull=hx(kit.hull||'#bfc6d0'),cDark=hx(kit.dark||'#30343a');
      const cGlow=hx(kit.glow||bio.glow||'#8fd8ff'),cCrystal=hx(bio.glow||'#b9dfff');
      const V=(x,y,z,nx,ny,nz,c,e=0)=>{const i=P.length/3;P.push(x,y,z);N.push(nx,ny,nz);C.push(c[0],c[1],c[2],e);return i;};
      function box(x,y,z,sx,sy,sz,c,e=0){
        const x0=x-sx/2,x1=x+sx/2,y0=y,y1=y+sy,z0=z-sz/2,z1=z+sz/2;
        const faces=[
          [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],
          [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],
          [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],
          [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]],
          [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]],
          [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]]
        ];
        for(const f of faces){const b=P.length/3;for(let q=0;q<4;q++)V(f[q][0],f[q][1],f[q][2],f[4][0],f[4][1],f[4][2],c,e);I.push(b,b+1,b+2,b,b+2,b+3);}
      }
      function crystal(x,y,z,r,h,c){
        const b=P.length/3,top=V(x,y+h,z,0,1,0,c,.65);
        const ring=[];for(let k=0;k<5;k++){const a=k/5*6.28318;ring.push(V(x+Math.cos(a)*r,y,z+Math.sin(a)*r,Math.cos(a),.25,Math.sin(a),c,.5));}
        for(let k=0;k<5;k++)I.push(top,ring[k],ring[(k+1)%5]);
      }
      for(const [f,side] of [[.31,1],[.70,-1]]){
        const p=spot(f,side,38),yaw=Math.atan2(p.tz,p.tx),cs=Math.cos(yaw),sn=Math.sin(yaw);
        /* compact modular lunar research stop */
        box(p.x,p.y,p.z,15,5.2,9,cHull);
        box(p.x+cs*9,p.y,p.z+sn*9,7,3.8,6,cDark);
        box(p.x-cs*6,p.y+5.2,p.z-sn*6,.55,10,.55,cHull);
        box(p.x-cs*6,p.y+14.7,p.z-sn*6,5.5,.35,.5,cGlow,.75);
        box(p.x-cs*6,p.y+14.7,p.z-sn*6,.5,.35,5.5,cGlow,.75);
      }
      for(let q=0;q<22;q++){
        const f=.10+rnd()*.80,side=rnd()<.5?-1:1,p=spot(f,side,hw+9+rnd()*17);
        crystal(p.x,p.y,p.z,.55+rnd()*1.1,2+rnd()*4.5,cCrystal);
      }
      if(I.length){
        const off=w.props.pos.length/3;
        w.props={...w.props,pos:concatF(w.props.pos,new Float32Array(P)),nrm:concatF(w.props.nrm,new Float32Array(N)),
          col:concatF(w.props.col,new Float32Array(C)),idx:concatU(w.props.idx,new Uint32Array(I),off)};
      }
    }

    try{window.__scenicLife={actors:addedActors,routeKm:+(w.cutLen/1000).toFixed(2)};}catch(e){}
    return w;
  }

  buildWorld=function(scene,onProgress){return populate(baseBuildWorld(scene,onProgress),scene);};
})();
