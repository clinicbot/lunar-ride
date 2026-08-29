"use strict";

/* ==========================================================================\n   Scenic-route population pass\n   --------------------------------------------------------------------------\n   The scenic road is appended after the original world has already distributed\n   its wildlife and structures. Populate the new road deliberately, using the\n   same actor types and animation system as the rest of Copernicus. Every\n   ground placement is sampled from the corrected scenic terrain surface.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const baseBuildWorld=buildWorld;
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};

  function populate(w,scene){
    if(!w||!w.nCut||!w.actors||!scene||scene.id!=='copernicus')return w;
    const rnd=mulberry32((scene.seed||1)+17017),base=w.nMain,n=w.nCut,hw=scene.road.halfWidth||3;
    const surf=w.meshH||w.groundAt;

    function spot(f,side=1,off=14){
      const k=clamp(Math.round(f*(n-1)),3,n-4),i=base+k;
      const x=w.rx[i]-w.tz[i]*off*side,z=w.rz[i]+w.tx[i]*off*side;
      let y=surf?surf(x,z):w.ry[i]-.3;if(!Number.isFinite(y))y=w.ry[i]-.3;
      return {k,i,x,y,z,rx:w.rx[i],rz:w.rz[i],ry:w.ry[i],tx:w.tx[i],tz:w.tz[i],side,off};
    }
    const proto=t=>w.actors.find(a=>a.type===t);
    const protoWhere=(t,p)=>w.actors.find(a=>a.type===t&&(!p||p(a)));
    let addedActors=0;

    function groundClone(type,f,side,off,extra={}){
      const src=proto(type);if(!src)return false;
      const p=spot(f,side,off),a={...src,...extra,scenic:true};
      a.hx=p.x;a.hz=p.z;a.px=p.x;a.py=p.y;a.pz=p.z;
      if('cx' in a){a.cx=p.x;a.cz=p.z;}
      delete a.pinY;delete a.pinAlt;
      if(a.meta&&a.meta.float)a.baseRoadY=p.ry;
      if('rdx' in a){a.rdx=p.rx;a.rdz=p.rz;}
      if('awayX' in a){const d=Math.hypot(p.x-p.rx,p.z-p.rz)||1;a.awayX=(p.x-p.rx)/d;a.awayZ=(p.z-p.rz)/d;}
      if('gy' in a)a.gy=p.y;
      a.wander=rnd()*6.28318;a.ph=rnd()*6.28318;a.yaw=rnd()*6.28318;
      a.flee=0;a.alert=0;a.grazing=false;
      w.actors.push(a);addedActors++;return true;
    }

    /* Put recognizable wildlife close enough to the road to be seen while\n       riding. Prefer Copernicus' own fauna, then any richer creature models\n       already present in the world. */
    const kinds=['strider','drifter','gstag','gjelly','gcat'].filter(proto);
    if(kinds.length){
      const count=Math.max(14,kinds.length*4);
      for(let q=0;q<count;q++){
        const f=.07+(q+.45+rnd()*.25)/count*.86,side=q%2?1:-1;
        groundClone(kinds[q%kinds.length],f,side,hw+8+rnd()*9);
      }
    }

    /* Astronauts at four small roadside work areas. groundAt now knows the\n       scenic corridor, so they cannot walk in mid-air. */
    if(proto('astro'))for(const f of [.18,.33,.62,.78,.87]){
      const side=f<.5?1:-1,p=spot(f,side,hw+10+rnd()*6),a={...proto('astro'),scenic:true};
      a.cx=p.x;a.cz=p.z;a.px=p.x;a.py=p.y;a.pz=p.z;
      a.r=2.5+rnd()*3.5;a.w=(rnd()<.5?-1:1)*(.055+rnd()*.06);a.ph=rnd()*6.28318;a.walk=true;
      w.actors.push(a);addedActors++;
    }

    if(proto('drone'))for(const f of [.14,.40,.58,.82]){
      const p=spot(f,f>.5?-1:1,15),a={...proto('drone'),scenic:true};
      a.cx=p.x;a.cz=p.z;a.gy=p.y;a.px=p.x;a.py=p.y+28;a.pz=p.z;
      a.r=22+rnd()*34;a.alt=18+rnd()*24;a.ph=rnd()*6.28318;a.w=(rnd()<.5?-1:1)*(.12+rnd()*.12);
      w.actors.push(a);addedActors++;
    }

    /* Several visible flocks along the route, not just one distant bird. */
    const bird=protoWhere('gbird',a=>a.pinAlt===undefined)||proto('gbird');
    if(bird)for(const f of [.10,.22,.36,.49,.64,.76,.90]){
      const p=spot(f,rnd()<.5?-1:1,9+rnd()*8),flock=2+(rnd()<.55?1:0);
      for(let b=0;b<flock;b++){
        const a={...bird,scenic:true};
        a.cx=p.x+(rnd()*2-1)*5;a.cz=p.z+(rnd()*2-1)*5;a.R=13+rnd()*23;
        a.circ=rnd()*6.28318;a.w=(rnd()<.5?-1:1)*(.075+rnd()*.075);
        a.baseY=p.y+9+rnd()*12;a.px=a.cx;a.py=a.baseY;a.pz=a.cz;
        delete a.pinAlt;delete a.noGlide;a.flap=true;a.flapT=.7+rnd()*2;a.gph=rnd()*6.28318;
        w.actors.push(a);addedActors++;
      }
    }

    if(proto('shuttle'))for(const f of [.29,.72]){
      const p=spot(f,1,0),a={...proto('shuttle'),scenic:true},side=rnd()<.5?-1:1;
      a.dx=-p.tz*side;a.dz=p.tx*side;a.sx=p.x-a.dx*800;a.sz=p.z-a.dz*800;
      a.len=1700;a.s0=rnd()*800;a.alt=130+rnd()*130;a.spd=45+rnd()*28;
      w.actors.push(a);addedActors++;
    }
    if(proto('station')){
      const a={...proto('station'),scenic:true};a.ph=rnd()*6.28318;a.r=950+rnd()*260;a.alt=580+rnd()*120;a.w=(rnd()<.5?-1:1)*.013;
      w.actors.push(a);addedActors++;
    }

    /* Static research stops and crystal groups. Keep the structures small and\n       close to the flattened scenic corridor; a thick foundation hides any\n       residual local slope instead of letting a building float. */
    let propVertices=0,propTriangles=0;
    if(w.props&&w.props.pos&&w.props.nrm&&w.props.col&&w.props.idx){
      const P=[],N=[],C=[],I=[],kit=scene.kit||{},bio=scene.bio||{};
      const cHull=hx(kit.hull||'#bfc6d0'),cDark=hx(kit.dark||'#30343a');
      const cGlow=hx(kit.glow||bio.glow||'#8fd8ff'),cCrystal=hx(bio.glow||'#b9dfff');
      const V=(x,y,z,nx,ny,nz,c,e=0)=>{const i=P.length/3;P.push(x,y,z);N.push(nx,ny,nz);C.push(c[0],c[1],c[2],e);return i;};
      function box(x,y,z,sx,sy,sz,c,e=0){
        const x0=x-sx/2,x1=x+sx/2,y0=y,y1=y+sy,z0=z-sz/2,z1=z+sz/2;
        const F=[[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],[[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]],[[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]]];
        for(const f of F){const b=P.length/3;for(let q=0;q<4;q++)V(f[q][0],f[q][1],f[q][2],f[4][0],f[4][1],f[4][2],c,e);I.push(b,b+1,b+2,b,b+2,b+3);}
      }
      function crystal(x,y,z,r,h){
        const top=V(x,y+h,z,0,1,0,cCrystal,.65),ring=[];
        for(let k=0;k<5;k++){const a=k/5*6.28318;ring.push(V(x+Math.cos(a)*r,y,z+Math.sin(a)*r,Math.cos(a),.25,Math.sin(a),cCrystal,.5));}
        for(let k=0;k<5;k++)I.push(top,ring[k],ring[(k+1)%5]);
      }
      for(const [f,side] of [[.27,1],[.68,-1]]){
        const p=spot(f,side,18),y=p.y-.65;
        box(p.x,y,p.z,11,1.4,7,cDark);                    // buried foundation
        box(p.x,y+1.25,p.z,9,4.2,5.8,cHull);
        box(p.x-2.5,y+5.3,p.z,.45,8,.45,cHull);
        box(p.x-2.5,y+12.8,p.z,4.4,.30,.42,cGlow,.75);
        box(p.x-2.5,y+12.8,p.z,.42,.30,4.4,cGlow,.75);
      }
      for(let q=0;q<34;q++){
        const f=.06+rnd()*.88,side=rnd()<.5?-1:1,p=spot(f,side,hw+7+rnd()*13);
        crystal(p.x,p.y,p.z,.5+rnd()*.9,1.8+rnd()*3.8);
      }
      if(I.length){
        const off=w.props.pos.length/3;
        w.props={...w.props,pos:concatF(w.props.pos,new Float32Array(P)),nrm:concatF(w.props.nrm,new Float32Array(N)),col:concatF(w.props.col,new Float32Array(C)),idx:concatU(w.props.idx,new Uint32Array(I),off)};
        propVertices=P.length/3;propTriangles=I.length/3;
      }
    }

    try{window.__scenicLife={actors:addedActors,props:propVertices,triangles:propTriangles,routeKm:+(w.cutLen/1000).toFixed(2)};}catch(e){}
    return w;
  }
  buildWorld=function(scene,onProgress){return populate(baseBuildWorld(scene,onProgress),scene);};
})();
