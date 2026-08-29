"use strict";

/* ==========================================================================\n   16. Generic junction / roundabout system\n   --------------------------------------------------------------------------\n   Detect road contacts for diagnostics, but treat declared alternate-route\n   junctions as topology: each gets a compact roundabout instead of a broad\n   overlapping asphalt patch. The circle covers the old crossing ribbons,\n   stops lane/shoulder paint before the entry, clears low furniture, and stores\n   geometry used later to bend the rider/camera path around the circle.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const buildWorldBase=buildWorld;
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};
  const mod2=a=>{a%=6.28318530718;if(a<0)a+=6.28318530718;return a;};

  buildWorld=function(scene,onProgress){
    const w=buildWorldBase(scene,onProgress);
    if(!w||!scene||!w.road||w.nPts<3)return w;

    const hw=scene.road.halfWidth||3;

    /* --- diagnostic geometric junction detector ------------------------- */
    const CELL=Math.max(20,hw*3.2),JOIN_D=Math.max(16,hw*2+6),JOIN_D2=JOIN_D*JOIN_D;
    const LOCAL_SKIP=Math.max(36,Math.round(150/ROUTE_STEP)),hash=new Map();
    const key=(x,z)=>Math.floor(x/CELL)+':'+Math.floor(z/CELL);
    for(let i=0;i<w.nPts;i++){const k=key(w.rx[i],w.rz[i]);if(!hash.has(k))hash.set(k,[]);hash.get(k).push(i);}
    const local=(i,j)=>{
      if(i<w.nMain&&j<w.nMain){const d=Math.abs(i-j);return Math.min(d,w.nMain-d)<LOCAL_SKIP;}
      if(i>=w.nMain&&j>=w.nMain)return Math.abs(i-j)<LOCAL_SKIP;
      return false;
    };
    const contacts=[];
    for(let i=0;i<w.nPts;i++){
      const gx=Math.floor(w.rx[i]/CELL),gz=Math.floor(w.rz[i]/CELL);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
        const list=hash.get((gx+a)+':'+(gz+b));if(!list)continue;
        for(const j of list){
          if(j<=i||local(i,j))continue;
          const dx=w.rx[i]-w.rx[j],dz=w.rz[i]-w.rz[j];if(dx*dx+dz*dz>JOIN_D2)continue;
          if(Math.abs(w.ry[i]-w.ry[j])>3)continue;
          const dot=w.tx[i]*w.tx[j]+w.tz[i]*w.tz[j];if(Math.abs(dot)>.992)continue;
          contacts.push({i,j,x:(w.rx[i]+w.rx[j])*.5,z:(w.rz[i]+w.rz[j])*.5});
        }
      }
    }

    /* --- topology roundabouts: currently the two ends of one alternate --- */
    const rounds=[];
    if(w.nCut>1){
      const mkRound=(which,jn,bidx,bSign)=>{
        const jm=(jn-2+w.nMain)%w.nMain,jp=(jn+2)%w.nMain;
        let tx=w.tx[jn],tz=w.tz[jn],tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
        let bx=w.tx[bidx]*bSign,bz=w.tz[bidx]*bSign,bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;
        const slope=(w.ry[jp]-w.ry[jm])/(4*ROUTE_STEP);
        const R=Math.max(18,hw*5.4),anchorX=which==='A'?-tx:tx,anchorZ=which==='A'?-tz:tz;
        const aa=Math.atan2(anchorZ,anchorX),ab=Math.atan2(bz,bx),ccw=mod2(ab-aa);
        const dir=ccw<=Math.PI?1:-1,branchAng=ccw<=Math.PI?ccw:(6.28318530718-ccw);
        return {which,jn,J:jn*ROUTE_STEP,cx:w.rx[jn],cz:w.rz[jn],y:w.ry[jn],R,
          inner:R-hw-.7,outer:R+hw+.7,tx,tz,bx,bz,slope,
          anchorAng:aa,branchAng:ab,dir,branchArc:branchAng*R,mainArc:Math.PI*R};
      };
      rounds.push(mkRound('A',w.jnA,w.nMain,1));
      rounds.push(mkRound('B',w.jnB,w.nMain+w.nCut-1,-1));
    }
    w.roundabouts=rounds;

    const roadCol=hx(scene.col.road),laneCol=hx(scene.col.lane),rumCol=hx(scene.col.rumble);
    const islandCol=hx(scene.col.low||scene.col.high||'#4b4b49');

    /* Stop ordinary paint shortly before a roundabout. The old road remains\n       underneath as the radial entry arm; the new ring/island covers its\n       continuation through the middle. */
    let cleanedSamples=0;
    if(rounds.length&&w.road.col.length>=w.nPts*10*4){
      for(let i=0;i<w.nPts;i++){
        let clean=0;
        for(const r of rounds){
          if(Math.abs(w.ry[i]-r.y)>7)continue;
          const d=Math.hypot(w.rx[i]-r.cx,w.rz[i]-r.cz),r0=r.outer+3,r1=r.outer+12;
          if(d<r1)clean=Math.max(clean,1-smoothstep(clamp((d-r0)/(r1-r0),0,1)));
        }
        if(clean<=0)continue;cleanedSamples++;
        for(let j=0;j<10;j++){
          const k=(i*10+j)*4;if(k+3>=w.road.col.length)break;
          w.road.col[k]=lerp(w.road.col[k],roadCol[0],clean);
          w.road.col[k+1]=lerp(w.road.col[k+1],roadCol[1],clean);
          w.road.col[k+2]=lerp(w.road.col[k+2],roadCol[2],clean);
          w.road.col[k+3]*=(1-clean);
        }
      }
    }

    /* Clear rails/posts only around the compact circle, not a huge junction\n       cloud. This prevents the gray-plaza effect seen in build 97. */
    let removedTriangles=0;
    if(rounds.length&&w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ax=pos[ia*3],ay=pos[ia*3+1],az=pos[ia*3+2];
        const bx=pos[ib*3],by=pos[ib*3+1],bz=pos[ib*3+2];
        const cx=pos[ic*3],cy=pos[ic*3+1],cz=pos[ic*3+2];
        const mx=(ax+bx+cx)/3,my=(ay+by+cy)/3,mz=(az+bz+cz)/3;
        let near=false;
        for(const r of rounds)if(Math.abs(my-r.y)<8&&Math.hypot(mx-r.cx,mz-r.cz)<r.outer+15){near=true;break;}
        let drop=false;
        if(near){
          const nr=w._dbg.roadNear(mx,mz);
          if(nr&&nr.d<hw+9){const roadY=w.ry[nr.i],bot=Math.min(ay,by,cy),top=Math.max(ay,by,cy);if(bot>roadY-1&&top<roadY+2)drop=true;}
        }
        if(drop)removedTriangles++;else keep.push(ia,ib,ic);
      }
      if(removedTriangles)w.props.idx=new Uint32Array(keep);
    }

    /* Roundabout mesh: tilted with the local road grade, so it never becomes\n       a floating horizontal plate on a climb. */
    const P=[],N=[],C=[],I=[];
    const V=(x,y,z,c,e=0)=>{const id=P.length/3;P.push(x,y,z);N.push(0,1,0);C.push(c[0],c[1],c[2],e);return id;};
    const yAt=(r,x,z,lift=0)=>r.y+r.slope*((x-r.cx)*r.tx+(z-r.cz)*r.tz)+lift;
    function strip(r,r0,r1,c,lift){
      const S=72,base=P.length/3;
      for(let k=0;k<=S;k++){
        const a=k/S*6.28318530718,ca=Math.cos(a),sa=Math.sin(a);
        for(const rr of [r0,r1]){const x=r.cx+ca*rr,z=r.cz+sa*rr;V(x,yAt(r,x,z,lift),z,c);}
      }
      for(let k=0;k<S;k++){const a=base+k*2,b=a+1,c0=a+2,d=a+3;I.push(a,b,c0,b,d,c0);}
    }
    function disk(r,rad,c,lift){
      const S=72,base=P.length/3,cc=V(r.cx,yAt(r,r.cx,r.cz,lift),r.cz,c);
      for(let k=0;k<S;k++){const a=k/S*6.28318530718,x=r.cx+Math.cos(a)*rad,z=r.cz+Math.sin(a)*rad;V(x,yAt(r,x,z,lift),z,c);}
      for(let k=0;k<S;k++)I.push(cc,base+1+k,base+1+((k+1)%S));
    }
    for(const r of rounds){
      const islandR=Math.max(7,r.inner-.65);
      disk(r,islandR,islandCol,.31);
      strip(r,islandR,r.inner,rumCol,.30);
      strip(r,r.inner,r.outer,roadCol,.29);
      strip(r,r.R-.16,r.R+.16,laneCol,.315);       // two-way centre guide around the circle
      strip(r,r.outer,r.outer+.72,rumCol,.30);
    }
    if(I.length){
      const off=w.road.pos.length/3;
      w.road={pos:concatF(w.road.pos,new Float32Array(P)),nrm:concatF(w.road.nrm,new Float32Array(N)),
        col:concatF(w.road.col,new Float32Array(C)),idx:concatU(w.road.idx,new Uint32Array(I),off)};
    }

    try{
      window.__roundabouts=rounds.map(r=>({which:r.which,km:+(r.J/1000).toFixed(2),centre:[+r.cx.toFixed(1),+r.cz.toFixed(1)],R:+r.R.toFixed(1)}));
      window.__junctionCleanup={contacts:contacts.length,roundabouts:rounds.length,cleanedSamples,removedTriangles};
    }catch(e){}
    return w;
  };

  /* Existing route-choice and full-network map teleport fixes. */
  addEventListener('DOMContentLoaded',()=>{
    if(typeof junctionAhead==='function')junctionAhead=function(){
      if(!world||!world.nCut||state.seg!=='m')return null;
      const L=world.lapLen,J=(state.dir>0?world.jnA:world.jnB)*ROUTE_STEP;
      const d=state.dir>0?(((J-state.s)%L)+L)%L:(((state.s-J)%L)+L)%L;
      if(d>170)return null;return {dist:d,side:state.dir>0?world.sideA:world.sideB};
    };
    if(typeof walkPath==='function')walkPath=function(seg,s,dir,dist,choiceTurn){
      let lap=0,guard=0,crossedJn=false;
      while(dist>1e-6&&guard++<6){
        if(seg==='m'){
          const L=world.lapLen,J=(dir>0?world.jnA:world.jnB)*ROUTE_STEP;
          let dJ=world.nCut?(dir>0?(((J-s)%L)+L)%L:(((s-J)%L)+L)%L):Infinity;
          if(dJ<1e-4&&!choiceTurn)dJ=L;
          if(!choiceTurn||dist<dJ){if(dist>=dJ)crossedJn=true;const s2=s+dir*dist;if(dir>0&&s2>=L)lap++;s=((s2%L)+L)%L;dist=0;}
          else{dist-=dJ;seg='c';s=dir>0?0:world.cutLen;choiceTurn=false;}
        }else{
          const s2=s+dir*dist;
          if(s2>=0&&s2<=world.cutLen){s=s2;dist=0;}
          else if(s2>world.cutLen){dist=s2-world.cutLen;seg='m';s=world.jnB*ROUTE_STEP;}
          else{dist=-s2;seg='m';s=world.jnA*ROUTE_STEP;}
        }
      }
      return {seg,s,dir,lap,crossedJn};
    };
    const map=document.getElementById('miniMap');
    if(map)map.addEventListener('dblclick',e=>{
      if(!world||typeof mapView==='undefined'||!mapView)return;
      if(typeof mapPanEndedAt!=='undefined'&&performance.now()-mapPanEndedAt<450)return;
      const r=map.getBoundingClientRect(),wx=(e.clientX-r.left-mapView.w/2)/mapView.sc+mapView.cx,wz=(e.clientY-r.top-mapView.h/2)/mapView.sc+mapView.cz;
      let bestSeg='m',bestK=0,bd=Infinity;
      for(let i=0;i<world.nMain;i+=2){const dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='m';bestK=i;}}
      if(world.nCut>0)for(let k=0;k<world.nCut;k+=2){const i=world.nMain+k,dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='c';bestK=k;}}
      state.seg=bestSeg;state.s=bestK*ROUTE_STEP;state.choice='straight';state.cameVia=null;state.speed=Math.min(state.speed,3);state.alt=world.ry[segIdx(state.seg,state.s)];
      if(typeof resetMapPan==='function')resetMapPan();e.preventDefault();e.stopImmediatePropagation();
    },true);
  });
})();
