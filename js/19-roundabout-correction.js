"use strict";

/* ==========================================================================\n   True compact roundabout geometry\n   --------------------------------------------------------------------------\n   The network junction is the centre of the roundabout. The three roads are\n   separate radial approaches; their paint is suppressed inside the circle and\n   the raised island hides the old crossing underneath. js/18 clips the same\n   approaches on the minimap, so map, rider path and 3-D geometry agree.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function')return;
  const baseBuildWorld=buildWorld,TAU=6.28318530718;
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};
  const mod=a=>{a%=TAU;if(a<0)a+=TAU;return a;};

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    const old=w&&w.roundabouts;if(!w||!old||!old.length)return w;

    /* Remove the preliminary ring appended by js/16. */
    const vertsPerRound=73+4*146,idxPerRound=72*3+4*72*6;
    const rmV=vertsPerRound*old.length,rmI=idxPerRound*old.length;
    if(w.road.pos.length/3>=rmV&&w.road.idx.length>=rmI){
      const keepV=w.road.pos.length/3-rmV;
      w.road.pos=w.road.pos.slice(0,keepV*3);
      w.road.nrm=w.road.nrm.slice(0,keepV*3);
      w.road.col=w.road.col.slice(0,keepV*4);
      w.road.idx=w.road.idx.slice(0,w.road.idx.length-rmI);
    }

    const hw=scene.road.halfWidth||3;
    const roadCol=hx(scene.col.road),rumCol=hx(scene.col.rumble);
    const islandCol=hx(scene.col.low||scene.col.high||'#4b4b49');
    const rounds=[];

    function buildRound(src){
      const jn=src.jn,cx=w.rx[jn],cz=w.rz[jn];
      let tx=w.tx[jn],tz=w.tz[jn],tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      let bx=src.bx,bz=src.bz,bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;
      const jm=(jn-2+w.nMain)%w.nMain,jp=(jn+2)%w.nMain;
      const slope=(w.ry[jp]-w.ry[jm])/(4*ROUTE_STEP);
      const R=Math.max(14,hw*4.25);

      /* A is approached while main s increases; B while main s decreases. */
      const ax=src.which==='A'?-tx:tx,az=src.which==='A'?-tz:tz;
      const aa=Math.atan2(az,ax),ab=Math.atan2(bz,bx),ccw=mod(ab-aa);
      const dir=ccw<=Math.PI?1:-1;
      const branchAngle=ccw<=Math.PI?ccw:TAU-ccw;
      return {...src,cx,cz,y:w.ry[jn],R,inner:R-hw-.55,outer:R+hw+.55,
        tx,tz,bx,bz,slope,anchorAng:aa,branchAng:ab,dir,
        branchArc:branchAngle*R,mainArc:Math.PI*R};
    }
    for(const r of old)rounds.push(buildRound(r));
    w.roundabouts=rounds;

    /* Remove all lane/shoulder paint underneath the roundabout. Asphalt can\n       remain as radial approach arms; the raised island covers their centre. */
    if(w.road.col.length>=w.nPts*10*4){
      for(let i=0;i<w.nPts;i++){
        let clean=0;
        for(const r of rounds){
          if(Math.abs(w.ry[i]-r.y)>8)continue;
          const d=Math.hypot(w.rx[i]-r.cx,w.rz[i]-r.cz);
          const r0=r.outer-1,r1=r.outer+10;
          if(d<r1)clean=Math.max(clean,1-smoothstep(clamp((d-r0)/(r1-r0),0,1)));
        }
        if(clean<=0)continue;
        for(let j=0;j<10;j++){
          const k=(i*10+j)*4;if(k+3>=w.road.col.length)break;
          w.road.col[k]=lerp(w.road.col[k],roadCol[0],clean);
          w.road.col[k+1]=lerp(w.road.col[k+1],roadCol[1],clean);
          w.road.col[k+2]=lerp(w.road.col[k+2],roadCol[2],clean);
          w.road.col[k+3]*=(1-clean);
        }
      }
    }

    /* Clear low rails/posts immediately around the circle. */
    if(w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ax=pos[ia*3],ay=pos[ia*3+1],az=pos[ia*3+2];
        const bx0=pos[ib*3],by=pos[ib*3+1],bz0=pos[ib*3+2];
        const cx0=pos[ic*3],cy=pos[ic*3+1],cz0=pos[ic*3+2];
        const mx=(ax+bx0+cx0)/3,my=(ay+by+cy)/3,mz=(az+bz0+cz0)/3;
        let near=false;for(const r of rounds)if(Math.abs(my-r.y)<8&&Math.hypot(mx-r.cx,mz-r.cz)<r.outer+10){near=true;break;}
        let drop=false;
        if(near){const nr=w._dbg.roadNear(mx,mz);if(nr&&nr.d<hw+9){const ry=w.ry[nr.i],lo=Math.min(ay,by,cy),hi=Math.max(ay,by,cy);if(lo>ry-1&&hi<ry+2)drop=true;}}
        if(!drop)keep.push(ia,ib,ic);
      }
      w.props.idx=new Uint32Array(keep);
    }

    /* A simple one-lane circular roadway around a visibly raised island. */
    const P=[],N=[],C=[],I=[];
    const V=(x,y,z,c,e=0)=>{const id=P.length/3;P.push(x,y,z);N.push(0,1,0);C.push(c[0],c[1],c[2],e);return id;};
    const yAt=(r,x,z,lift=0)=>r.y+r.slope*((x-r.cx)*r.tx+(z-r.cz)*r.tz)+lift;
    function strip(r,r0,r1,c,lift){
      const S=80,b=P.length/3;
      for(let k=0;k<=S;k++){const a=k/S*TAU,ca=Math.cos(a),sa=Math.sin(a);for(const rr of [r0,r1]){const x=r.cx+ca*rr,z=r.cz+sa*rr;V(x,yAt(r,x,z,lift),z,c);}}
      for(let k=0;k<S;k++){const a=b+k*2,b0=a+1,c0=a+2,d=a+3;I.push(a,b0,c0,b0,d,c0);}
    }
    function disk(r,rad,c,lift){
      const S=80,b=P.length/3,cc=V(r.cx,yAt(r,r.cx,r.cz,lift),r.cz,c);
      for(let k=0;k<S;k++){const a=k/S*TAU,x=r.cx+Math.cos(a)*rad,z=r.cz+Math.sin(a)*rad;V(x,yAt(r,x,z,lift),z,c);}
      for(let k=0;k<S;k++)I.push(cc,b+1+k,b+1+((k+1)%S));
    }
    for(const r of rounds){
      const islandR=Math.max(6.0,r.inner-.50);
      disk(r,islandR,islandCol,.48);
      strip(r,islandR,r.inner,rumCol,.45);
      strip(r,r.inner,r.outer,roadCol,.41);
      strip(r,r.outer,r.outer+.62,rumCol,.44);
    }
    if(I.length){
      const off=w.road.pos.length/3;
      w.road={pos:concatF(w.road.pos,new Float32Array(P)),nrm:concatF(w.road.nrm,new Float32Array(N)),col:concatF(w.road.col,new Float32Array(C)),idx:concatU(w.road.idx,new Uint32Array(I),off)};
    }
    try{window.__roundaboutsV100=rounds.map(r=>({which:r.which,centre:[+r.cx.toFixed(1),+r.cz.toFixed(1)],R:+r.R.toFixed(1),outer:+r.outer.toFixed(1)}));}catch(e){}
    return w;
  };
})();
