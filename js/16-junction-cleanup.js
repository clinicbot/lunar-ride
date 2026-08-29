"use strict";

/* ==========================================================================\n   16. Generic junction system\n   --------------------------------------------------------------------------\n   Junctions are a road-network property, not a list of special kilometre\n   marks. Detect same-level non-neighbouring road branches that come close\n   together and diverge in heading, cluster those contacts into junction\n   zones, then use the same zones for road paint, low furniture and ONE\n   unified paved surface. This works for future forks/merges/crossings too.\n\n   Ordinary bends are ignored because nearby samples belong to the same local\n   route run. The epic climb's shared ascent/descent is ignored because its\n   coincident centre lines are parallel/anti-parallel rather than diverging.\n   Bridges crossing above/below another road are ignored by the height test.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const buildWorldBase=buildWorld;

  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  function convexHull(points){
    if(points.length<3) return points.slice();
    const a=points.slice().sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
    const lo=[];
    for(const p of a){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
    const hi=[];
    for(let i=a.length-1;i>=0;i--){const p=a[i];while(hi.length>=2&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
    lo.pop();hi.pop();return lo.concat(hi);
  }
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};

  buildWorld=function(scene,onProgress){
    const w=buildWorldBase(scene,onProgress);
    if(!w||!scene||!w.road||w.nPts<3) return w;

    const hw=scene.road.halfWidth||5;
    const CELL=Math.max(20,hw*3.2);
    const JOIN_D=Math.max(16,hw*2+6);
    const JOIN_D2=JOIN_D*JOIN_D;
    const MAX_DY=3.0;
    const LOCAL_SKIP=Math.max(36,Math.round(150/ROUTE_STEP));
    const hash=new Map();
    const key=(x,z)=>Math.floor(x/CELL)+':'+Math.floor(z/CELL);

    for(let i=0;i<w.nPts;i++){
      const k=key(w.rx[i],w.rz[i]);
      if(!hash.has(k)) hash.set(k,[]);
      hash.get(k).push(i);
    }

    const locallyRelated=(i,j)=>{
      if(i<w.nMain&&j<w.nMain){
        const d=Math.abs(i-j);
        return Math.min(d,w.nMain-d)<LOCAL_SKIP;
      }
      if(i>=w.nMain&&j>=w.nMain) return Math.abs(i-j)<LOCAL_SKIP;
      return false;
    };

    /* Same-level, non-local road samples that physically meet and diverge. */
    const contacts=[];
    for(let i=0;i<w.nPts;i++){
      const gx=Math.floor(w.rx[i]/CELL),gz=Math.floor(w.rz[i]/CELL);
      for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
        const list=hash.get((gx+a)+':'+(gz+b));
        if(!list) continue;
        for(const j of list){
          if(j<=i||locallyRelated(i,j)) continue;
          const dx=w.rx[i]-w.rx[j],dz=w.rz[i]-w.rz[j];
          if(dx*dx+dz*dz>JOIN_D2) continue;
          if(Math.abs(w.ry[i]-w.ry[j])>MAX_DY) continue;
          const dot=w.tx[i]*w.tx[j]+w.tz[i]*w.tz[j];
          if(Math.abs(dot)>0.992) continue;
          contacts.push({x:(w.rx[i]+w.rx[j])*.5,z:(w.rz[i]+w.rz[j])*.5,
                         y:(w.ry[i]+w.ry[j])*.5,i,j});
        }
      }
    }

    /* Declared alternate-route ends are known topology, so seed them even if\n       a future fork is shallow enough to evade the heading test. */
    if(w.nCut>0){
      for(const i of [w.jnA,w.jnB]) if(i>=0&&i<w.nMain)
        contacts.push({x:w.rx[i],z:w.rz[i],y:w.ry[i],i,j:i});
    }

    let zones=[];
    const MERGE_R=72,MERGE_R2=MERGE_R*MERGE_R;
    for(const c of contacts){
      let best=null,bd=MERGE_R2;
      for(const z of zones){
        const dx=c.x-z.x,dz=c.z-z.z,d2=dx*dx+dz*dz;
        if(d2<bd&&Math.abs(c.y-z.y)<5){bd=d2;best=z;}
      }
      if(!best){zones.push({x:c.x,z:c.z,y:c.y,n:1,pts:[[c.x,c.z]],samples:new Set([c.i,c.j])});}
      else{
        const n=best.n+1;
        best.x=(best.x*best.n+c.x)/n;best.z=(best.z*best.n+c.z)/n;
        best.y=(best.y*best.n+c.y)/n;best.n=n;
        best.pts.push([c.x,c.z]);best.samples.add(c.i);best.samples.add(c.j);
      }
    }
    for(let changed=true;changed;){
      changed=false;
      outer:for(let a=0;a<zones.length;a++)for(let b=a+1;b<zones.length;b++){
        const A=zones[a],B=zones[b],dx=A.x-B.x,dz=A.z-B.z;
        if(dx*dx+dz*dz>(MERGE_R*1.25)*(MERGE_R*1.25)||Math.abs(A.y-B.y)>5)continue;
        const n=A.n+B.n;
        A.x=(A.x*A.n+B.x*B.n)/n;A.z=(A.z*A.n+B.z*B.n)/n;A.y=(A.y*A.n+B.y*B.n)/n;A.n=n;
        A.pts.push(...B.pts);for(const s of B.samples)A.samples.add(s);
        zones.splice(b,1);changed=true;break outer;
      }
    }
    zones=zones.map(z=>{
      let spread=0;for(const p of z.pts)spread=Math.max(spread,Math.hypot(p[0]-z.x,p[1]-z.z));
      z.core=clamp(spread+34,48,105);z.outer=z.core+48;return z;
    });

    const zoneWeight=(x,z,y)=>{
      let best=0,owner=null;
      for(const q of zones){
        if(Math.abs(y-q.y)>8)continue;
        const d=Math.hypot(x-q.x,z-q.z);if(d>=q.outer)continue;
        const u=clamp((d-q.core)/(q.outer-q.core),0,1),wgt=1-smoothstep(u);
        if(wgt>best){best=wgt;owner=q;}
      }
      return {w:best,z:owner};
    };

    /* Fade conflicting shoulders, but keep the lane separator. The central\n       unified patch below covers the tiny place where lane guides naturally\n       stop inside a real intersection. */
    const roadCol=hx(scene.col.road),laneCol=hx(scene.col.lane);
    const NL=10; /* both generated road ribbons use the same ten bands */
    const c0=4,c1=5;
    let cleanedSamples=0;
    if(zones.length&&w.road.col.length>=w.nPts*NL*4){
      for(let i=0;i<w.nPts;i++){
        const zw=zoneWeight(w.rx[i],w.rz[i],w.ry[i]).w;if(zw<=0)continue;
        cleanedSamples++;
        for(let j=0;j<NL;j++){
          const k=(i*NL+j)*4;
          if(j<=1||j>=NL-2){
            w.road.col[k]=lerp(w.road.col[k],roadCol[0],zw);
            w.road.col[k+1]=lerp(w.road.col[k+1],roadCol[1],zw);
            w.road.col[k+2]=lerp(w.road.col[k+2],roadCol[2],zw);
            w.road.col[k+3]*=(1-zw);
          }else if(j===c0||j===c1){
            w.road.col[k]=lerp(w.road.col[k],laneCol[0],zw);
            w.road.col[k+1]=lerp(w.road.col[k+1],laneCol[1],zw);
            w.road.col[k+2]=lerp(w.road.col[k+2],laneCol[2],zw);
          }
        }
      }
    }

    /* Low rails/posts that would slice across a junction disappear using the\n       same geometry-derived mask. Tall signs and buildings are untouched. */
    let removedTriangles=0;
    if(zones.length&&w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ax=pos[ia*3],ay=pos[ia*3+1],az=pos[ia*3+2];
        const bx=pos[ib*3],by=pos[ib*3+1],bz=pos[ib*3+2];
        const cx=pos[ic*3],cy=pos[ic*3+1],cz=pos[ic*3+2];
        const mx=(ax+bx+cx)/3,my=(ay+by+cy)/3,mz=(az+bz+cz)/3;
        const zw=zoneWeight(mx,mz,my).w;let drop=false;
        if(zw>.16){
          const nr=w._dbg.roadNear(mx,mz);
          if(nr&&nr.d<hw+8.5){
            const bottom=Math.min(ay,by,cy),top=Math.max(ay,by,cy),roadY=w.ry[nr.i];
            if(bottom>roadY-1&&top<roadY+1.9)drop=true;
          }
        }
        if(drop)removedTriangles++;else keep.push(ia,ib,ic);
      }
      if(removedTriangles)w.props.idx=new Uint32Array(keep);
    }

    /* TRUE junction geometry: make one asphalt polygon from the road edges\n       around every detected junction. It sits a few centimetres above the\n       component ribbons, hiding overlapping shoulders/paint and z-fighting. */
    const jp=[],jn=[],jc=[],ji=[];let patches=0;
    const roadYAt=(x,z,fallback)=>{
      if(w._dbg&&typeof w._dbg.roadNear==='function'){
        const q=w._dbg.roadNear(x,z);
        if(q&&q.i>=0&&q.i<w.nPts&&q.d<hw+16)return w.ry[q.i]+.19;
      }
      return fallback+.19;
    };
    for(const z of zones){
      const patchR=clamp(z.core*.70,30,55),edge=[];
      for(let i=0;i<w.nPts;i+=2){
        if(Math.abs(w.ry[i]-z.y)>5)continue;
        const dx=w.rx[i]-z.x,dz=w.rz[i]-z.z;if(dx*dx+dz*dz>patchR*patchR)continue;
        const nx=-w.tz[i],nz=w.tx[i],off=hw+1.35;
        edge.push([w.rx[i]+nx*off,w.rz[i]+nz*off]);
        edge.push([w.rx[i]-nx*off,w.rz[i]-nz*off]);
      }
      let H=convexHull(edge).filter(p=>Math.hypot(p[0]-z.x,p[1]-z.z)<=patchR+hw+3);
      if(H.length<3)continue;
      const base=jp.length/3,ys=[];let yc=0;
      for(const p of H){const y=roadYAt(p[0],p[1],z.y);ys.push(y);yc+=y;}yc/=H.length;
      jp.push(z.x,yc,z.z);jn.push(0,1,0);jc.push(roadCol[0],roadCol[1],roadCol[2],0);
      for(let k=0;k<H.length;k++){
        jp.push(H[k][0],ys[k],H[k][1]);jn.push(0,1,0);jc.push(roadCol[0],roadCol[1],roadCol[2],0);
      }
      for(let k=0;k<H.length;k++)ji.push(base,base+1+k,base+1+((k+1)%H.length));
      patches++;
    }
    if(ji.length){
      const oldV=w.road.pos.length/3;
      w.road={pos:concatF(w.road.pos,new Float32Array(jp)),
              nrm:concatF(w.road.nrm,new Float32Array(jn)),
              col:concatF(w.road.col,new Float32Array(jc)),
              idx:concatU(w.road.idx,new Uint32Array(ji),oldV)};
    }

    try{
      window.__junctions=zones.map((z,n)=>({n,centre:[+z.x.toFixed(1),+z.z.toFixed(1)],height:+z.y.toFixed(1),
        core:+z.core.toFixed(1),outer:+z.outer.toFixed(1),contacts:z.n,
        routeKm:[...z.samples].filter(i=>i<w.nMain).slice(0,8).map(i=>+(i*ROUTE_STEP/1000).toFixed(2))}));
      window.__junctionCleanup={zones:zones.length,contacts:contacts.length,cleanedSamples,removedTriangles,patches};
    }catch(e){}
    return w;
  };

  /* Interaction fixes are installed after the rest of the classic scripts\n     exist. They are generic for the one alternate segment supported by the\n     current movement engine. */
  addEventListener('DOMContentLoaded',()=>{
    try{
      const bt=document.getElementById('buildTag');if(bt)bt.textContent='build 97';
      const sn=document.getElementById('sceneName');
      if(sn){
        const fixStamp=()=>{if(/v96\b/.test(sn.textContent))sn.textContent=sn.textContent.replace(/v96\b/,'v97');};
        new MutationObserver(fixStamp).observe(sn,{childList:true,subtree:true,characterData:true});
        fixStamp();
      }
    }catch(e){}

    if(typeof junctionAhead==='function') junctionAhead=function(){
      if(!world||!world.nCut||state.seg!=='m')return null;
      const L=world.lapLen,J=(state.dir>0?world.jnA:world.jnB)*ROUTE_STEP;
      const d=state.dir>0?(((J-state.s)%L)+L)%L:(((state.s-J)%L)+L)%L;
      if(d>170)return null;
      return {dist:d,side:state.dir>0?world.sideA:world.sideB};
    };

    if(typeof walkPath==='function') walkPath=function(seg,s,dir,dist,choiceTurn){
      let lap=0,guard=0,crossedJn=false;
      while(dist>1e-6&&guard++<6){
        if(seg==='m'){
          const L=world.lapLen,J=(dir>0?world.jnA:world.jnB)*ROUTE_STEP;
          let dJ=world.nCut?(dir>0?(((J-s)%L)+L)%L:(((s-J)%L)+L)%L):Infinity;
          if(dJ<1e-4&&!choiceTurn)dJ=L;
          if(!choiceTurn||dist<dJ){
            if(dist>=dJ)crossedJn=true;
            const s2=s+dir*dist;if(dir>0&&s2>=L)lap++;
            s=((s2%L)+L)%L;dist=0;
          }else{dist-=dJ;seg='c';s=dir>0?0:world.cutLen;choiceTurn=false;}
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
      const r=map.getBoundingClientRect();
      const wx=(e.clientX-r.left-mapView.w/2)/mapView.sc+mapView.cx;
      const wz=(e.clientY-r.top-mapView.h/2)/mapView.sc+mapView.cz;
      let bestSeg='m',bestK=0,bd=Infinity;
      for(let i=0;i<world.nMain;i+=2){const dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='m';bestK=i;}}
      if(world.nCut>0)for(let k=0;k<world.nCut;k+=2){const i=world.nMain+k,dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='c';bestK=k;}}
      state.seg=bestSeg;state.s=bestK*ROUTE_STEP;state.choice='straight';state.cameVia=null;
      state.speed=Math.min(state.speed,3);state.alt=world.ry[segIdx(state.seg,state.s)];
      if(typeof resetMapPan==='function')resetMapPan();
      e.preventDefault();e.stopImmediatePropagation();
    },true);
  });
})();
