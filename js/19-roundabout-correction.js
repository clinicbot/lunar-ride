"use strict";

/* ==========================================================================\n   Compact roundabout correction\n   --------------------------------------------------------------------------\n   Build 98 treated the network junction as the CENTER of the traffic circle.\n   It is actually the ENTRY point: the roads already meet there. Replace the\n   generated circles with smaller circles whose near edge is exactly the\n   junction coordinate. The second intersection with each outgoing road gives\n   a natural exit, so the circle lines up with the existing road geometry.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function')return;
  const baseBuildWorld=buildWorld,TAU=6.28318530718;
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};
  const mod=a=>{a%=TAU;if(a<0)a+=TAU;return a;};

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    const old=w&&w.roundabouts;if(!w||!old||!old.length)return w;

    /* Remove the build-98 roundabout mesh, which was appended last to road. */
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
      const jn=src.jn,Jx=w.rx[jn],Jz=w.rz[jn];
      let tx=w.tx[jn],tz=w.tz[jn],tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      let bx=src.bx,bz=src.bz,bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;
      const jm=(jn-2+w.nMain)%w.nMain,jp=(jn+2)%w.nMain;
      const slope=(w.ry[jp]-w.ry[jm])/(4*ROUTE_STEP);
      const R=Math.max(12,hw*4.0);
      const shift=src.which==='A'?R:-R;         // centre lies one radius beyond the entry
      const cx=Jx+tx*shift,cz=Jz+tz*shift,y=w.ry[jn]+slope*shift;
      const anchorX=(Jx-cx)/R,anchorZ=(Jz-cz)/R;
      const aa=Math.atan2(anchorZ,anchorX);

      /* The branch already starts at J. Intersect that outgoing ray with the\n         circle a second time; this makes the roundabout exit land exactly on\n         the existing branch rather than guessing an angle. */
      const dx=Jx-cx,dz=Jz-cz;
      let t2=-2*(dx*bx+dz*bz),ex,ez;
      if(t2>R*.28){ex=Jx+bx*t2;ez=Jz+bz*t2;}
      else{ex=cx+bx*R;ez=cz+bz*R;}
      const erx=(ex-cx)/R,erz=(ez-cz)/R,ab=Math.atan2(erz,erx);
      const ccw=mod(ab-aa),dir=ccw<=Math.PI?1:-1;
      const branchAng=ccw<=Math.PI?ccw:TAU-ccw;
      return {...src,cx,cz,y,R,inner:R-hw-.55,outer:R+hw+.55,tx,tz,bx,bz,slope,
        anchorAng:aa,branchAng:ab,dir,branchArc:branchAng*R,mainArc:Math.PI*R};
    }
    for(const r of old)rounds.push(buildRound(r));
    w.roundabouts=rounds;

    /* Erase underlying lane/shoulder paint only beneath the corrected compact\n       circle. The asphalt arm remains, so the existing road becomes a clean\n       radial entry beneath the new ring. */
    if(w.road.col.length>=w.nPts*10*4){
      for(let i=0;i<w.nPts;i++){
        let clean=0;
        for(const r of rounds){
          if(Math.abs(w.ry[i]-r.y)>8)continue;
          const d=Math.hypot(w.rx[i]-r.cx,w.rz[i]-r.cz);
          if(d<r.outer+9)clean=Math.max(clean,1-smoothstep(clamp((d-(r.outer+1))/8,0,1)));
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

    /* Clear low rails/posts around the corrected circle as well. */
    if(w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ax=pos[ia*3],ay=pos[ia*3+1],az=pos[ia*3+2];
        const bx0=pos[ib*3],by=pos[ib*3+1],bz0=pos[ib*3+2];
        const cx0=pos[ic*3],cy=pos[ic*3+1],cz0=pos[ic*3+2];
        const mx=(ax+bx0+cx0)/3,my=(ay+by+cy)/3,mz=(az+bz0+cz0)/3;
        let near=false;for(const r of rounds)if(Math.abs(my-r.y)<8&&Math.hypot(mx-r.cx,mz-r.cz)<r.outer+11){near=true;break;}
        let drop=false;
        if(near){const nr=w._dbg.roadNear(mx,mz);if(nr&&nr.d<hw+9){const ry=w.ry[nr.i],lo=Math.min(ay,by,cy),hi=Math.max(ay,by,cy);if(lo>ry-1&&hi<ry+2)drop=true;}}
        if(!drop)keep.push(ia,ib,ic);
      }
      w.props.idx=new Uint32Array(keep);
    }

    /* Clean one-lane ring: raised central island, white inner/outer borders,\n       no confusing centre stripe around the circle. */
    const P=[],N=[],C=[],I=[];
    const V=(x,y,z,c,e=0)=>{const id=P.length/3;P.push(x,y,z);N.push(0,1,0);C.push(c[0],c[1],c[2],e);return id;};
    const yAt=(r,x,z,lift=0)=>r.y+r.slope*((x-r.cx)*r.tx+(z-r.cz)*r.tz)+lift;
    function strip(r,r0,r1,c,lift){
      const S=72,b=P.length/3;
      for(let k=0;k<=S;k++){const a=k/S*TAU,ca=Math.cos(a),sa=Math.sin(a);for(const rr of [r0,r1]){const x=r.cx+ca*rr,z=r.cz+sa*rr;V(x,yAt(r,x,z,lift),z,c);}}
      for(let k=0;k<S;k++){const a=b+k*2,b0=a+1,c0=a+2,d=a+3;I.push(a,b0,c0,b0,d,c0);}
    }
    function disk(r,rad,c,lift){
      const S=72,b=P.length/3,cc=V(r.cx,yAt(r,r.cx,r.cz,lift),r.cz,c);
      for(let k=0;k<S;k++){const a=k/S*TAU,x=r.cx+Math.cos(a)*rad,z=r.cz+Math.sin(a)*rad;V(x,yAt(r,x,z,lift),z,c);}
      for(let k=0;k<S;k++)I.push(cc,b+1+k,b+1+((k+1)%S));
    }
    for(const r of rounds){
      const islandR=Math.max(5.3,r.inner-.55);
      disk(r,islandR,islandCol,.42);
      strip(r,islandR,r.inner,rumCol,.40);
      strip(r,r.inner,r.outer,roadCol,.37);
      strip(r,r.outer,r.outer+.58,rumCol,.40);
    }
    if(I.length){
      const off=w.road.pos.length/3;
      w.road={pos:concatF(w.road.pos,new Float32Array(P)),nrm:concatF(w.road.nrm,new Float32Array(N)),col:concatF(w.road.col,new Float32Array(C)),idx:concatU(w.road.idx,new Uint32Array(I),off)};
    }
    try{window.__roundaboutsV99=rounds.map(r=>({which:r.which,entry:[+w.rx[r.jn].toFixed(1),+w.rz[r.jn].toFixed(1)],centre:[+r.cx.toFixed(1),+r.cz.toFixed(1)],R:r.R}));}catch(e){}
    return w;
  };
})();
