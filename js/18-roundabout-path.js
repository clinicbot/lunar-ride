"use strict";

/* ==========================================================================\n   Roundabout rider path + minimap + flat-level postprocess\n   --------------------------------------------------------------------------\n   The world builder creates the X/Z topology. This final pass makes each\n   roundabout one genuinely flat road surface even when its three source roads\n   arrive at different elevations, and removes old cross-height road/rail\n   remnants from the construction zone. The rider and minimap consume the same\n   generated arm/circle geometry.\n   ========================================================================== */
(function(){
  if(typeof segPoint!=='function')return;

  /* -----------------------------------------------------------------------
     Flat roundabout elevation pass.
     js/19 appends its generated vertices after the original road mesh in a
     deterministic order. We use that ordering to level only the replacement
     geometry, while deleting any surviving ORIGINAL triangles in the junction
     disc regardless of their previous Y height.
     ----------------------------------------------------------------------- */
  if(typeof buildWorld==='function'){
    const levelBaseBuildWorld=buildWorld;
    buildWorld=function(scene,onProgress){
      const w=levelBaseBuildWorld(scene,onProgress);
      if(!w||!w.roundabouts||!w.roundabouts.length||!w.road||!w.road.pos||!w.road.idx)return w;

      const STRIPES=10,RING_SEG=96;
      const DISK_VERTS=1+RING_SEG;
      const RING_VERTS=(RING_SEG+1)*2;
      const addedFor=r=>
        (r.arms.prev.points.length+r.arms.next.points.length+r.arms.cut.points.length)*STRIPES+
        DISK_VERTS+RING_VERTS*3;
      const totalVerts=w.road.pos.length/3;
      const addedVerts=w.roundabouts.reduce((s,r)=>s+addedFor(r),0);
      const originalVerts=Math.max(0,totalVerts-addedVerts);
      const pos=w.road.pos;

      /* Old road at another elevation must not survive through a roundabout.
         Keep all newly generated roundabout triangles, but remove ORIGINAL road
         triangles touching the construction disc based on X/Z only. */
      {
        const keep=[],idx=w.road.idx;
        for(let q=0;q<idx.length;q+=3){
          const ids=[idx[q],idx[q+1],idx[q+2]];
          let drop=false;
          if(ids.some(id=>id<originalVerts)){
            for(const r of w.roundabouts){
              const clearR=r.clipR+7;
              if(ids.some(id=>Math.hypot(pos[id*3]-r.cx,pos[id*3+2]-r.cz)<clearR)){
                drop=true;break;
              }
            }
          }
          if(!drop)keep.push(...ids);
        }
        w.road.idx=new Uint32Array(keep);
      }

      /* Rails/posts from the old high or low road were another source of the
         floating white pieces. Remove small prop triangles in the construction
         zone without using a Y-height test. Large vertical structures are kept. */
      if(w.props&&w.props.pos&&w.props.idx){
        const pp=w.props.pos,keep=[];
        for(let q=0;q<w.props.idx.length;q+=3){
          const ids=[w.props.idx[q],w.props.idx[q+1],w.props.idx[q+2]];
          let drop=false;
          const ys=ids.map(id=>pp[id*3+1]),vertical=Math.max(...ys)-Math.min(...ys);
          if(vertical<3.5){
            for(const r of w.roundabouts){
              const clearR=r.clipR+9;
              if(ids.some(id=>Math.hypot(pp[id*3]-r.cx,pp[id*3+2]-r.cz)<clearR)){
                drop=true;break;
              }
            }
          }
          if(!drop)keep.push(...ids);
        }
        w.props.idx=new Uint32Array(keep);
      }

      /* The circle's chosen level is the original main-road junction height
         (r.cy). All three replacement approaches are then brought to that
         exact level. A linear vertical interpolation minimises the peak grade;
         importantly there is no independent tilted circle or 0.40 m mesh step. */
      let cursor=originalVerts;
      const maxAllowed=(scene.road&&scene.road.maxGrade)||9;
      for(const r of w.roundabouts){
        const H=r.cy;
        r.flatY=H;
        r.armMaxGrade={};

        for(const nm of ['prev','next','cut']){
          const pts=r.arms[nm].points;
          const cum=[0];let L=0;
          for(let k=1;k<pts.length;k++){
            L+=Math.hypot(pts[k][0]-pts[k-1][0],pts[k][2]-pts[k-1][2]);
            cum.push(L);
          }
          const y0=pts[0][1],den=L||1;
          let mg=0;
          for(let k=0;k<pts.length;k++){
            const t=cum[k]/den;
            pts[k][1]=lerp(y0,H,t);
            if(k){
              const ds=cum[k]-cum[k-1],dy=pts[k][1]-pts[k-1][1];
              if(ds>1e-5)mg=Math.max(mg,Math.abs(dy/ds)*100);
            }
            /* each centreline sample owns ten road-strip vertices */
            for(let j=0;j<STRIPES;j++)pos[(cursor+k*STRIPES+j)*3+1]=pts[k][1];
          }
          cursor+=pts.length*STRIPES;
          r.armMaxGrade[nm]=mg;
        }

        /* island, inner curb, carriageway, outer curb: one common horizontal
           datum for the actual road, with only the island/curbs slightly raised. */
        for(let i=0;i<DISK_VERTS;i++)pos[(cursor+i)*3+1]=H+.34;
        cursor+=DISK_VERTS;
        for(let i=0;i<RING_VERTS;i++)pos[(cursor+i)*3+1]=H+.035;
        cursor+=RING_VERTS;
        for(let i=0;i<RING_VERTS;i++)pos[(cursor+i)*3+1]=H;
        cursor+=RING_VERTS;
        for(let i=0;i<RING_VERTS;i++)pos[(cursor+i)*3+1]=H+.035;
        cursor+=RING_VERTS;

        r.levelWarning=Math.max(r.armMaxGrade.prev,r.armMaxGrade.next,r.armMaxGrade.cut)>maxAllowed+.25;
      }
      w.roundaboutFlat=true;
      try{window.__roundaboutLevels=w.roundabouts.map(r=>({which:r.which,flatY:+r.flatY.toFixed(2),grades:Object.fromEntries(Object.entries(r.armMaxGrade).map(([k,v])=>[k,+v.toFixed(2)])),warning:r.levelWarning}));}catch(e){}
      return w;
    };
  }

  const baseSegPoint=segPoint,TAU=Math.PI*2;
  const mod=(x,m)=>((x%m)+m)%m;
  const signedMain=(s,J,L)=>mod(s-J+L/2,L)-L/2;
  const rawAt=(seg,s)=>{const q=[0,0,0];baseSegPoint(seg,s,0,q);return q;};
  const arcDist=(a,b,dir)=>dir>0?((b-a+TAU)%TAU):((a-b+TAU)%TAU);
  const circle=(r,a)=>[r.cx+Math.cos(a)*r.R,(r.flatY!==undefined?r.flatY:r.cy+.40),r.cz+Math.sin(a)*r.R];
  const polyLen=pts=>{let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]);return L;};
  const polyAt=(pts,t)=>{
    t=clamp(t,0,1);if(t<=0)return pts[0].slice();if(t>=1)return pts[pts.length-1].slice();
    const total=polyLen(pts),want=t*total;let acc=0;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],d=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
      if(acc+d>=want){const u=(want-acc)/(d||1);return [lerp(a[0],b[0],u),lerp(a[1],b[1],u),lerp(a[2],b[2],u)];}
      acc+=d;
    }
    return pts[pts.length-1].slice();
  };
  const arcAt=(r,a0,a1,dir,t)=>{const d=arcDist(a0,a1,dir),a=a0+dir*d*clamp(t,0,1);return circle(r,a);};
  function connArc(conn,r,a0,a1,dir,u){
    const Lc=polyLen(conn),La=arcDist(a0,a1,dir)*r.R,T=Lc+La,q=clamp(u,0,1)*T;
    if(q<=Lc)return polyAt(conn,q/(Lc||1));
    return arcAt(r,a0,a1,dir,(q-Lc)/(La||1));
  }
  function arcConn(r,a0,a1,dir,conn,u){
    const rev=conn.slice().reverse(),La=arcDist(a0,a1,dir)*r.R,Lc=polyLen(rev),T=La+Lc,q=clamp(u,0,1)*T;
    if(q<=La)return arcAt(r,a0,a1,dir,q/(La||1));
    return polyAt(rev,(q-La)/(Lc||1));
  }

  function centre(seg,s){
    if(world&&world.roundabouts){
      if(seg==='m')for(const r of world.roundabouts){
        const d=signedMain(s,r.J,world.lapLen);
        if(d>=-r.span&&d<=0)return connArc(r.arms.prev.points,r,r.prevAng,r.cutAng,r.dir,(d+r.span)/r.span);
        if(d>0&&d<=r.span)return arcConn(r,r.cutAng,r.nextAng,r.dir,r.arms.next.points,d/r.span);
      }
      if(seg==='c')for(const r of world.roundabouts){
        if(r.which==='A'&&s>=0&&s<=r.span)return polyAt(r.arms.cut.points,1-s/r.span);
        if(r.which==='B'){
          const back=world.cutLen-s;
          if(back>=0&&back<=r.span)return polyAt(r.arms.cut.points,1-back/r.span);
        }
      }
    }
    return rawAt(seg,s);
  }

  segPoint=function(seg,s,off,out){
    const p=centre(seg,s),eps=.75;
    let s0=s-eps,s1=s+eps;if(seg==='c'){s0=clamp(s0,0,world.cutLen);s1=clamp(s1,0,world.cutLen);}
    const a=centre(seg,s0),b=centre(seg,s1);let tx=b[0]-a[0],tz=b[2]-a[2],l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    out[0]=p[0]-tz*off;out[1]=p[1];out[2]=p[2]+tx*off;return out;
  };

  addEventListener('DOMContentLoaded',()=>{
    try{
      const bt=document.getElementById('buildTag');if(bt)bt.textContent='build 102';
      const sn=document.getElementById('sceneName');if(sn){
        const f=()=>{if(/v10[01]\b/.test(sn.textContent))sn.textContent=sn.textContent.replace(/v10[01]\b/,'v102');};
        new MutationObserver(f).observe(sn,{childList:true,subtree:true,characterData:true});f();
      }
    }catch(e){}
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
  });

  if(typeof drawMap==='function'){
    const baseDrawMap=drawMap;
    drawMap=function(){
      baseDrawMap();
      if(!world||!world.roundabouts||!mapView||!mctx)return;
      const w=mapView.w,h=mapView.h,sc=mapView.sc,X=x=>w/2+(x-mapView.cx)*sc,Y=z=>h/2+(z-mapView.cz)*sc;
      mctx.save();mctx.globalCompositeOperation='destination-out';
      for(const r of world.roundabouts){mctx.beginPath();mctx.arc(X(r.cx),Y(r.cz),Math.max(5,r.clipR*sc),0,TAU);mctx.fill();}
      mctx.restore();
      const drawPts=(pts,col,width=3)=>{mctx.strokeStyle=col;mctx.lineWidth=width;mctx.lineCap='round';mctx.lineJoin='round';mctx.beginPath();pts.forEach((p,i)=>i?mctx.lineTo(X(p[0]),Y(p[2])):mctx.moveTo(X(p[0]),Y(p[2])));mctx.stroke();};
      for(const r of world.roundabouts){
        drawPts(r.arms.prev.points,'rgba(236,241,248,.94)');
        drawPts(r.arms.next.points,'rgba(236,241,248,.94)');
        drawPts(r.arms.cut.points,world.cutColour||'rgba(255,206,0,.94)',3.1);
        mctx.strokeStyle='rgba(236,241,248,.98)';mctx.lineWidth=3.1;mctx.beginPath();mctx.arc(X(r.cx),Y(r.cz),Math.max(4,r.R*sc),0,TAU);mctx.stroke();
        mctx.fillStyle='rgba(63,68,66,.96)';mctx.beginPath();mctx.arc(X(r.cx),Y(r.cz),Math.max(2,r.inner*sc),0,TAU);mctx.fill();
      }
      const p=[0,0,0],a=[0,0,0],b=[0,0,0];segPoint(state.seg,state.s,state.playerX*state.dir,p);
      let s0=state.s-.8*state.dir,s1=state.s+.8*state.dir;if(state.seg==='c'){s0=clamp(s0,0,world.cutLen);s1=clamp(s1,0,world.cutLen);}
      segPoint(state.seg,s0,0,a);segPoint(state.seg,s1,0,b);const an=Math.atan2(b[2]-a[2],b[0]-a[0]);
      mctx.save();mctx.translate(X(p[0]),Y(p[2]));mctx.rotate(an);mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(7,0);mctx.lineTo(-4.5,4.2);mctx.lineTo(-2.2,0);mctx.lineTo(-4.5,-4.2);mctx.closePath();mctx.fill();mctx.restore();
    };
  }

  const map=document.getElementById('miniMap');
  if(map)map.addEventListener('dblclick',e=>{
    if(!world||!mapView)return;if(typeof mapPanEndedAt!=='undefined'&&performance.now()-mapPanEndedAt<450)return;
    const r=map.getBoundingClientRect(),wx=(e.clientX-r.left-mapView.w/2)/mapView.sc+mapView.cx,wz=(e.clientY-r.top-mapView.h/2)/mapView.sc+mapView.cz;
    let bestSeg='m',bestK=0,bd=Infinity;
    for(let i=0;i<world.nMain;i+=2){const dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='m';bestK=i;}}
    if(world.nCut>0)for(let k=0;k<world.nCut;k+=2){const i=world.nMain+k,dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;if(d<bd){bd=d;bestSeg='c';bestK=k;}}
    state.seg=bestSeg;state.s=bestK*ROUTE_STEP;state.choice='straight';state.cameVia=null;state.speed=Math.min(state.speed,3);state.alt=world.ry[segIdx(state.seg,state.s)];
    if(typeof resetMapPan==='function')resetMapPan();e.preventDefault();e.stopImmediatePropagation();
  },true);
})();