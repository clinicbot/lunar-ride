"use strict";

/* ==========================================================================\n   16. Generic junction cleanup\n   --------------------------------------------------------------------------\n   Junctions are a road-network property, not a list of special kilometre\n   marks. Detect same-level non-neighbouring road branches that come close\n   together and diverge in heading, cluster those contacts into junction\n   zones, then use one mask for road paint and low roadside furniture.\n\n   Ordinary bends are ignored because nearby samples belong to the same local\n   route run. The epic climb's shared ascent/descent is ignored because its\n   coincident centre lines are parallel/anti-parallel rather than diverging.\n   Bridges crossing above/below another road are ignored by the height test.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const buildWorldBase=buildWorld;

  buildWorld=function(scene,onProgress){
    const w=buildWorldBase(scene,onProgress);
    if(!w||!scene||!w.road||w.nPts<3) return w;

    const hw=scene.road.halfWidth||5;
    const CELL=Math.max(20,hw*3.2);
    const JOIN_D=Math.max(16,hw*2+6);       // centre lines close enough to form one paved throat
    const JOIN_D2=JOIN_D*JOIN_D;
    const MAX_DY=3.0;                       // over/under passes are not junctions
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
      return false;                           // main road vs appended branch can be a real fork
    };

    /* Raw contacts. A near-perfect parallel/anti-parallel pair is a shared\n       or neighbouring road, not a junction. Any meaningful divergence is. */
    const contacts=[];
    for(let i=0;i<w.nPts;i++){
      const gx=Math.floor(w.rx[i]/CELL), gz=Math.floor(w.rz[i]/CELL);
      for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
        const list=hash.get((gx+a)+':'+(gz+b));
        if(!list) continue;
        for(const j of list){
          if(j<=i||locallyRelated(i,j)) continue;
          const dx=w.rx[i]-w.rx[j], dz=w.rz[i]-w.rz[j];
          if(dx*dx+dz*dz>JOIN_D2) continue;
          if(Math.abs(w.ry[i]-w.ry[j])>MAX_DY) continue;
          const dot=w.tx[i]*w.tx[j]+w.tz[i]*w.tz[j];
          if(Math.abs(dot)>0.992) continue;      // shared/retraced/parallel ribbons
          contacts.push({
            x:(w.rx[i]+w.rx[j])*0.5,
            z:(w.rz[i]+w.rz[j])*0.5,
            y:(w.ry[i]+w.ry[j])*0.5,
            i,j
          });
        }
      }
    }

    /* Declared shortcut forks are topology we already know about. Seed them\n       as well, so a very shallow future fork is still guaranteed a clean zone. */
    if(w.nCut>0){
      for(const i of [w.jnA,w.jnB]) if(i>=0&&i<w.nMain)
        contacts.push({x:w.rx[i],z:w.rz[i],y:w.ry[i],i,j:i});
    }

    /* Cluster nearby contacts. Each cluster becomes one junction regardless\n       of how many pairs of branches generated detections inside it. */
    let zones=[];
    const MERGE_R=72, MERGE_R2=MERGE_R*MERGE_R;
    for(const c of contacts){
      let best=null,bd=MERGE_R2;
      for(const z of zones){
        const dx=c.x-z.x, dz=c.z-z.z, d2=dx*dx+dz*dz;
        if(d2<bd&&Math.abs(c.y-z.y)<5){bd=d2;best=z;}
      }
      if(!best){
        zones.push({x:c.x,z:c.z,y:c.y,n:1,pts:[[c.x,c.z]],samples:new Set([c.i,c.j])});
      }else{
        const n=best.n+1;
        best.x=(best.x*best.n+c.x)/n;
        best.z=(best.z*best.n+c.z)/n;
        best.y=(best.y*best.n+c.y)/n;
        best.n=n; best.pts.push([c.x,c.z]); best.samples.add(c.i); best.samples.add(c.j);
      }
    }

    /* A second merge pass joins chains whose contact cloud straddled the\n       first cluster radius. */
    for(let changed=true;changed;){
      changed=false;
      outer: for(let a=0;a<zones.length;a++) for(let b=a+1;b<zones.length;b++){
        const A=zones[a],B=zones[b],dx=A.x-B.x,dz=A.z-B.z;
        if(dx*dx+dz*dz>(MERGE_R*1.25)*(MERGE_R*1.25)||Math.abs(A.y-B.y)>5) continue;
        const n=A.n+B.n;
        A.x=(A.x*A.n+B.x*B.n)/n; A.z=(A.z*A.n+B.z*B.n)/n; A.y=(A.y*A.n+B.y*B.n)/n; A.n=n;
        A.pts.push(...B.pts); for(const s of B.samples) A.samples.add(s);
        zones.splice(b,1); changed=true; break outer;
      }
    }

    /* Radius follows the actual contact cloud, so a broad Y gets a broad\n       apron while a compact fork does not erase paint hundreds of metres away. */
    zones=zones.map(z=>{
      let spread=0;
      for(const p of z.pts) spread=Math.max(spread,Math.hypot(p[0]-z.x,p[1]-z.z));
      z.core=clamp(spread+34,48,105);
      z.outer=z.core+48;
      return z;
    });

    const zoneWeight=(x,z,y)=>{
      let best=0,owner=null;
      for(const q of zones){
        if(Math.abs(y-q.y)>8) continue;
        const d=Math.hypot(x-q.x,z-q.z);
        if(d>=q.outer) continue;
        const u=clamp((d-q.core)/(q.outer-q.core),0,1);
        const wgt=1-smoothstep(u);
        if(wgt>best){best=wgt;owner=q;}
      }
      return {w:best,z:owner};
    };

    /* Road paint. The generator currently lays ten cross-road colour bands:\n       two shoulder/rumble bands on each edge and two narrow centre-line bands.\n       Junctions lose ONLY the outer paint. The centre separator is preserved\n       and made continuous through the throat, so the two directions remain\n       visually obvious even where branches split. */
    const roadCol=hx(scene.col.road), laneCol=hx(scene.col.lane);
    const NL=Math.round(w.road.col.length/Math.max(1,w.nPts*4));
    const c0=Math.max(0,Math.floor(NL/2)-1), c1=Math.min(NL-1,Math.floor(NL/2));
    let cleanedSamples=0;
    if(zones.length&&NL>=6&&w.road.col.length>=w.nPts*NL*4){
      for(let i=0;i<w.nPts;i++){
        const zw=zoneWeight(w.rx[i],w.rz[i],w.ry[i]).w;
        if(zw<=0) continue;
        cleanedSamples++;
        for(let j=0;j<NL;j++){
          const k=(i*NL+j)*4;
          const shoulder=(j<=1||j>=NL-2);
          if(shoulder){
            w.road.col[k]  =lerp(w.road.col[k],  roadCol[0],zw);
            w.road.col[k+1]=lerp(w.road.col[k+1],roadCol[1],zw);
            w.road.col[k+2]=lerp(w.road.col[k+2],roadCol[2],zw);
            w.road.col[k+3]*=(1-zw);
          }else if(j===c0||j===c1){
            /* Continuous centre line in the core; blend back to the route's\n               normal dashed pattern outside the junction. */
            w.road.col[k]  =lerp(w.road.col[k],  laneCol[0],zw);
            w.road.col[k+1]=lerp(w.road.col[k+1],laneCol[1],zw);
            w.road.col[k+2]=lerp(w.road.col[k+2],laneCol[2],zw);
            if(scene.grid) w.road.col[k+3]=Math.max(w.road.col[k+3],zw);
          }
        }
      }
    }

    /* Low furniture uses exactly the same mask. This targets guard rails,\n       posts and low beams whose geometry cuts across a fork, while leaving\n       tall signs/buildings alone. */
    let removedTriangles=0;
    if(zones.length&&w.props&&w.props.idx&&w.props.pos&&w._dbg&&typeof w._dbg.roadNear==='function'){
      const pos=w.props.pos, idx=w.props.idx, keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const ax=pos[ia*3],ay=pos[ia*3+1],az=pos[ia*3+2];
        const bx=pos[ib*3],by=pos[ib*3+1],bz=pos[ib*3+2];
        const cx=pos[ic*3],cy=pos[ic*3+1],cz=pos[ic*3+2];
        const mx=(ax+bx+cx)/3,my=(ay+by+cy)/3,mz=(az+bz+cz)/3;
        const zw=zoneWeight(mx,mz,my).w;
        let drop=false;
        if(zw>0.20){
          const nr=w._dbg.roadNear(mx,mz);
          if(nr&&nr.d<hw+7.5){
            const bottom=Math.min(ay,by,cy), top=Math.max(ay,by,cy);
            const roadY=w.ry[nr.i];
            /* Whole triangle must live in the low roadside band. */
            if(bottom>roadY-1.0&&top<roadY+1.75) drop=true;
          }
        }
        if(drop) removedTriangles++; else keep.push(ia,ib,ic);
      }
      if(removedTriangles) w.props.idx=new Uint32Array(keep);
    }

    try{
      window.__junctions=zones.map((z,n)=>({
        n,centre:[+z.x.toFixed(1),+z.z.toFixed(1)],height:+z.y.toFixed(1),
        core:+z.core.toFixed(1),outer:+z.outer.toFixed(1),contacts:z.n,
        routeKm:[...z.samples].filter(i=>i<w.nMain).slice(0,8).map(i=>+(i*ROUTE_STEP/1000).toFixed(2))
      }));
      window.__junctionCleanup={zones:zones.length,contacts:contacts.length,cleanedSamples,removedTriangles};
    }catch(e){}

    return w;
  };
})();
