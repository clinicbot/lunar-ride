"use strict";

/* ==========================================================================
   16. Scenic routes drawn on the minimap
   --------------------------------------------------------------------------
   A scenic route is stored as points normalised to the main-route map bounds
   (0..1 in x and z). The first/last points are only hints: at build time they
   snap to the nearest existing road samples. The middle points preserve the
   shape drawn on the minimap. The result becomes the existing 'c' alternate
   segment, so all normal riding, U-turn, save/resume and junction logic works.

   This first route was traced from the yellow line drawn over Copernicus Rim.
   Future hand-drawn routes can use the same data-driven mechanism.
   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;

  const ROUTES={
    copernicus:{
      name:'Interior Scenic Route',
      colour:'rgba(255,206,0,.92)',
      /* [map-x, map-z], sampled along the user's yellow sketch */
      points:[
        [0.798,0.064],[0.670,0.136],[0.727,0.275],[0.699,0.388],
        [0.580,0.377],[0.665,0.293],[0.550,0.207],[0.452,0.303],
        [0.457,0.410],[0.587,0.489],[0.706,0.579],[0.617,0.627],
        [0.524,0.527],[0.399,0.596]
      ]
    }
  };

  const baseBuildWorld=buildWorld;

  const growF=(old,n)=>{const a=new Float32Array(n);a.set(old);return a;};
  const growU8=(old,n)=>{const a=new Uint8Array(n);if(old)a.set(old);return a;};
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{
    const q=new Uint32Array(a.length+b.length);q.set(a);
    for(let i=0;i<b.length;i++) q[a.length+i]=b[i]+off;
    return q;
  };

  function chaikin(points,passes){
    let a=points.map(p=>[p[0],p[1]]);
    for(let pass=0;pass<passes;pass++){
      const b=[a[0]];
      for(let i=0;i<a.length-1;i++){
        const p=a[i],q=a[i+1];
        b.push([p[0]*0.75+q[0]*0.25,p[1]*0.75+q[1]*0.25]);
        b.push([p[0]*0.25+q[0]*0.75,p[1]*0.25+q[1]*0.75]);
      }
      b.push(a[a.length-1]);
      a=b;
    }
    return a;
  }

  function resample(points,step){
    const cum=[0];
    for(let i=1;i<points.length;i++)
      cum.push(cum[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    const len=cum[cum.length-1];
    const n=Math.max(8,Math.floor(len/step)+1), out=[];
    let fi=0;
    for(let k=0;k<n;k++){
      const target=k/(n-1)*len;
      while(fi<points.length-2&&cum[fi+1]<target) fi++;
      const den=Math.max(cum[fi+1]-cum[fi],1e-6);
      const t=(target-cum[fi])/den;
      out.push([lerp(points[fi][0],points[fi+1][0],t),lerp(points[fi][1],points[fi+1][1],t)]);
    }
    return {points:out,len};
  }

  function addScenicRoute(w,scene,spec){
    /* The current road-network movement model supports one alternate segment.
       Do not silently replace a world's existing shortcut. */
    if(!w||w.nCut>0||!spec||!spec.points||spec.points.length<4) return w;

    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let i=0;i<w.nMain;i++){
      x0=Math.min(x0,w.rx[i]);x1=Math.max(x1,w.rx[i]);
      z0=Math.min(z0,w.rz[i]);z1=Math.max(z1,w.rz[i]);
    }
    const mapPt=p=>[lerp(x0,x1,p[0]),lerp(z0,z1,p[1])];
    let norm=spec.points.map(p=>[p[0],p[1]]);

    const nearestMain=p=>{
      let bi=0,bd=Infinity;
      for(let i=0;i<w.nMain;i++){
        const dx=w.rx[i]-p[0],dz=w.rz[i]-p[1],d=dx*dx+dz*dz;
        if(d<bd){bd=d;bi=i;}
      }
      return bi;
    };

    let iA=nearestMain(mapPt(norm[0]));
    let iB=nearestMain(mapPt(norm[norm.length-1]));
    if(iA===iB) return w;

    /* Keep A before B in route-index space. The physical route is unchanged
       if the sketch is reversed, and this makes progress mapping monotonic. */
    if(iA>iB){
      const t=iA;iA=iB;iB=t;
      norm=norm.reverse();
    }

    const P0=[w.rx[iA],w.rz[iA]], PN=[w.rx[iB],w.rz[iB]];
    const chord=Math.hypot(PN[0]-P0[0],PN[1]-P0[1]);
    const handle=clamp(chord*0.045,55,105);
    const H0=[P0[0]+w.tx[iA]*handle,P0[1]+w.tz[iA]*handle];
    const H1=[PN[0]-w.tx[iB]*handle,PN[1]-w.tz[iB]*handle];

    const control=[P0,H0];
    for(let i=1;i<norm.length-1;i++) control.push(mapPt(norm[i]));
    control.push(H1,PN);

    /* Repeated corner cutting gives a smooth, non-overshooting road while
       retaining the hand-drawn character much better than one giant Bezier. */
    const smooth=chaikin(control,4);
    smooth[0]=P0;smooth[smooth.length-1]=PN;
    const rr=resample(smooth,ROUTE_STEP);
    const pts=rr.points,nCut=pts.length,cutLen=(nCut-1)*ROUTE_STEP;

    const bx=new Float32Array(nCut),bz=new Float32Array(nCut),by=new Float32Array(nCut);
    const btx=new Float32Array(nCut),btz=new Float32Array(nCut),bg=new Float32Array(nCut);
    for(let k=0;k<nCut;k++){bx[k]=pts[k][0];bz[k]=pts[k][1];}

    /* Open-road elevation profile: follow the local landscape somewhat, but
       keep a strong long-wave connection between the two junction heights. */
    const landAt=w._dbg&&w._dbg.landAt;
    for(let k=0;k<nCut;k++){
      const t=k/(nCut-1),base=lerp(w.ry[iA],w.ry[iB],smoothstep(t));
      const land=landAt?landAt(bx[k],bz[k]):base;
      by[k]=lerp(base,land,0.42);
    }
    const yA=w.ry[iA],yB=w.ry[iB],lim=scene.road.maxGrade/100*ROUTE_STEP;
    for(let pass=0;pass<90;pass++){
      by[0]=yA;by[nCut-1]=yB;
      for(let k=1;k<nCut-1;k++) by[k]=(by[k-1]+2*by[k]+by[k+1])/4;
      by[0]=yA;by[nCut-1]=yB;
      for(let k=0;k<nCut-1;k++){
        const dh=by[k+1]-by[k];
        if(dh>lim)by[k+1]=by[k]+lim;else if(dh<-lim)by[k+1]=by[k]-lim;
      }
      by[nCut-1]=yB;
      for(let k=nCut-1;k>0;k--){
        const dh=by[k-1]-by[k];
        if(dh>lim)by[k-1]=by[k]+lim;else if(dh<-lim)by[k-1]=by[k]-lim;
      }
    }
    by[0]=yA;by[nCut-1]=yB;
    for(let k=0;k<nCut;k++){
      const k0=Math.max(0,k-1),k1=Math.min(nCut-1,k+1);
      let dx=bx[k1]-bx[k0],dz=bz[k1]-bz[k0],l=Math.hypot(dx,dz)||1;
      btx[k]=dx/l;btz[k]=dz/l;
      if(k<nCut-1)bg[k]=(by[k+1]-by[k])/ROUTE_STEP*100;
      else bg[k]=bg[k-1]||0;
    }

    /* Append the alternate segment to the arrays expected by the existing
       movement model. */
    const oldN=w.nPts,newN=oldN+nCut;
    w.rx=growF(w.rx,newN);w.rz=growF(w.rz,newN);w.ry=growF(w.ry,newN);
    w.tx=growF(w.tx,newN);w.tz=growF(w.tz,newN);w.grade=growF(w.grade,newN);
    for(let k=0;k<nCut;k++){
      const i=oldN+k;
      w.rx[i]=bx[k];w.rz[i]=bz[k];w.ry[i]=by[k];
      w.tx[i]=btx[k];w.tz[i]=btz[k];w.grade[i]=bg[k];
    }
    w.inTunnel=growU8(w.inTunnel,newN);w.inBridge=growU8(w.inBridge,newN);
    w.nPts=newN;w.nCut=nCut;w.cutLen=cutLen;w.jnA=iA;w.jnB=iB;
    const s0=w.tz[iA]*btx[0]-w.tx[iA]*btz[0];
    const s1=w.tz[iB]*btx[nCut-1]-w.tx[iB]*btz[nCut-1];
    w.sideA=s0>0?'left':'right';w.sideB=s1>0?'left':'right';
    w.cutName=spec.name||'Scenic route';w.cutColour=spec.colour||'rgba(255,206,0,.9)';

    /* Add the actual road ribbon. The main-world generator uses ten bands:
       outer rumble, asphalt, centre line, asphalt, outer rumble. */
    const hw=scene.road.halfWidth;
    const cRoad=hx(scene.col.road),cRum=hx(scene.col.rumble),cLane=hx(scene.col.lane);
    const stripes=[
      {o:-hw-1.3,c:'rum'},{o:-hw-0.02,c:'rum'},
      {o:-hw,c:'road'},{o:-0.26,c:'road'},{o:-0.22,c:'lane'},
      {o:0.22,c:'lane'},{o:0.26,c:'road'},{o:hw,c:'road'},
      {o:hw+0.02,c:'rum'},{o:hw+1.3,c:'rum'}
    ];
    const NL=stripes.length,rp=[],rn=[],rc=[],ri=[];
    const pushV=(x,y,z,c,em)=>{
      const id=rp.length/3;rp.push(x,y,z);rn.push(0,1,0);rc.push(c[0],c[1],c[2],em||0);return id;
    };
    for(let k=0;k<nCut;k++){
      const nx=-btz[k],nz=btx[k],dash=(Math.floor(k/3)%2)===0;
      for(const st of stripes){
        let c=cRoad,em=0;
        if(st.c==='rum'){c=cRum;em=scene.beacons?0.35:0;}
        else if(st.c==='lane'&&dash)c=cLane;
        pushV(bx[k]+nx*st.o,by[k]+0.11,bz[k]+nz*st.o,c,em);
      }
    }
    for(let k=0;k<nCut-1;k++) for(let j=0;j<NL-1;j++){
      const a=k*NL+j,b=a+1,c=(k+1)*NL+j,d=c+1;
      ri.push(a,b,c,b,d,c);
    }

    /* Asphalt aprons fill the small wedge where each branch peels away from
       the main road. The generic junction cleaner later removes conflicting
       outer paint while preserving the centre separator. */
    const AK=Math.min(18,nCut-1);
    const apron=(mainAt,cutAt)=>{
      const kk=Math.min(10,AK),mi=mainAt(kk),ci=cutAt(kk);
      const nx=-w.tz[mi],nz=w.tx[mi];
      const sn=((w.rx[ci]-w.rx[mi])*nx+(w.rz[ci]-w.rz[mi])*nz)>0?1:-1;
      const rows=[];
      for(let k=0;k<=AK;k++){
        const m=mainAt(k),c=cutAt(k);
        const vm=pushV(w.rx[m]-w.tz[m]*(sn*hw),w.ry[m]+0.095,w.rz[m]+w.tx[m]*(sn*hw),cRoad,0);
        const vc=pushV(w.rx[c]-w.tz[c]*(-sn*hw),w.ry[c]+0.095,w.rz[c]+w.tx[c]*(-sn*hw),cRoad,0);
        rows.push([vm,vc]);
      }
      for(let k=0;k<AK;k++){
        const a=rows[k][0],b=rows[k][1],c=rows[k+1][0],d=rows[k+1][1];
        ri.push(a,b,c,b,d,c);
      }
    };
    const base=oldN;
    apron(k=>(iA+k)%w.nMain,k=>base+k);
    apron(k=>((iB-k)%w.nMain+w.nMain)%w.nMain,k=>base+nCut-1-k);

    const oldV=w.road.pos.length/3;
    w.road={
      pos:concatF(w.road.pos,new Float32Array(rp)),
      nrm:concatF(w.road.nrm,new Float32Array(rn)),
      col:concatF(w.road.col,new Float32Array(rc)),
      idx:concatU(w.road.idx,new Uint32Array(ri),oldV)
    };

    /* The original world was already built, so carve/fill the terrain under
       this added road now. A spatial hash keeps this linear in terrain size. */
    const oldRoadNear=w._dbg&&w._dbg.roadNear;
    const HC=64,hmap=new Map(),hkey=(x,z)=>Math.floor(x/HC)+':'+Math.floor(z/HC);
    for(let k=0;k<nCut;k++){
      const key=hkey(bx[k],bz[k]);if(!hmap.has(key))hmap.set(key,[]);hmap.get(key).push(k);
    }
    const scenicNear=(x,z)=>{
      const gx=Math.floor(x/HC),gz=Math.floor(z/HC);let bi=-1,bd=Infinity;
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
        const ls=hmap.get((gx+a)+':'+(gz+b));if(!ls)continue;
        for(const k of ls){const dx=x-bx[k],dz=z-bz[k],d=dx*dx+dz*dz;if(d<bd){bd=d;bi=k;}}
      }
      return bi<0?null:{d:Math.sqrt(bd),k:bi,i:base+bi};
    };

    if(w.terrain&&w.terrain.pos&&typeof NG!=='undefined'){
      const pos=w.terrain.pos,nrm=w.terrain.nrm,NV=NG+1;
      const flatR=hw+STEP*1.55,blendR=82;
      for(let v=0;v<pos.length/3;v++){
        const x=pos[v*3],z=pos[v*3+2],sn=scenicNear(x,z);
        if(!sn||sn.d>=blendR)continue;
        const old=oldRoadNear?oldRoadNear(x,z):null;
        /* Existing road owns its own immediate corridor at the two junctions. */
        if(old&&old.d<hw+STEP*1.55&&sn.d>hw+1.5)continue;
        const target=by[sn.k]-0.30;
        const wt=sn.d<=flatR?1:(1-smoothstep((sn.d-flatR)/(blendR-flatR)));
        pos[v*3+1]=lerp(pos[v*3+1],target,wt);
      }
      /* Recompute terrain normals after the corridor deformation. */
      if(nrm&&nrm.length===pos.length&&pos.length/3===NV*NV){
        const Y=(i,j)=>pos[(j*NV+i)*3+1];
        for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
          let nx=Y(Math.max(i-1,0),j)-Y(Math.min(i+1,NV-1),j);
          let ny=2*STEP;
          let nz=Y(i,Math.max(j-1,0))-Y(i,Math.min(j+1,NV-1));
          const l=Math.hypot(nx,ny,nz)||1,k=(j*NV+i)*3;
          nrm[k]=nx/l;nrm[k+1]=ny/l;nrm[k+2]=nz/l;
        }
      }
    }

    /* Expose a road lookup that knows both the old network and the new branch.
       The later generic junction cleaner can therefore treat both uniformly. */
    if(w._dbg){
      w._dbg.roadNear=function(x,z){
        const a=oldRoadNear?oldRoadNear(x,z):null,b=scenicNear(x,z);
        if(!b)return a;
        if(!a||b.d<a.d)return {d:b.d,i:b.i};
        return a;
      };
    }

    /* Remove vegetation quads whose centres would sit on the new asphalt. */
    if(w.veg&&w.veg.idx&&w.veg.ctr){
      const keep=[];
      for(let q=0;q<w.veg.idx.length;q+=6){
        const vi=w.veg.idx[q],x=w.veg.ctr[vi*3],z=w.veg.ctr[vi*3+2];
        const sn=scenicNear(x,z);
        if(!sn||sn.d>hw+3.5)for(let j=0;j<6&&q+j<w.veg.idx.length;j++)keep.push(w.veg.idx[q+j]);
      }
      w.veg.idx=new Uint32Array(keep);w.veg.count=keep.length;
    }

    let maxGrade=0,maxTurn=0,minSelf=Infinity;
    for(let k=0;k<nCut;k++)maxGrade=Math.max(maxGrade,Math.abs(bg[k]));
    for(let k=1;k<nCut-1;k++){
      const dot=clamp(btx[k-1]*btx[k+1]+btz[k-1]*btz[k+1],-1,1);
      maxTurn=Math.max(maxTurn,Math.acos(dot)*180/Math.PI);
    }
    /* coarse self-clearance audit, ignoring neighbouring samples */
    for(let a=0;a<nCut;a+=6)for(let b=a+30;b<nCut;b+=6)
      minSelf=Math.min(minSelf,Math.hypot(bx[a]-bx[b],bz[a]-bz[b]));

    try{window.__scenicRoute={
      name:w.cutName,fromKm:+(iA*ROUTE_STEP/1000).toFixed(2),toKm:+(iB*ROUTE_STEP/1000).toFixed(2),
      lengthKm:+(cutLen/1000).toFixed(2),points:nCut,maxGrade:+maxGrade.toFixed(2),
      maxTurnDeg:+maxTurn.toFixed(2),minSelfClear:+minSelf.toFixed(1)
    };}catch(e){}
    return w;
  }

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    const spec=ROUTES[scene&&scene.id];
    return spec?addScenicRoute(w,scene,spec):w;
  };
})();
