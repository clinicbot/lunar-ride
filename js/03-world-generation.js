"use strict";

/* ==========================================================================
   3. Building a world
   --------------------------------------------------------------------------
   The whole landscape is generated once when you pick a scene, then it never
   changes. That means no stutter while riding: the GPU just draws the same
   three meshes (terrain, road, rocks) every frame.
   ========================================================================== */

const WORLD=3200, HALF=WORLD/2;   // the world is 3.2 km square
const STEP=9;                     // terrain grid spacing, metres
const NG=Math.round(WORLD/STEP);  // grid cells per side
const ROUTE_STEP=4;               // road sample spacing, metres

let world=null;   // everything generated for the current scene

function buildWorld(scene,onProgress){
  const rnd=mulberry32(scene.seed);
  const n1=makeNoise(scene.seed), n2=makeNoise(scene.seed+77);
  const L=scene.land;

  /* --- craters, scattered over the map --- */
  const craters=[];
  for(let i=0;i<L.craters;i++){
    const r=(30+Math.pow(rnd(),2.4)*(L.craterMax-30));
    craters.push({x:(rnd()*2-1)*HALF*.94, z:(rnd()*2-1)*HALF*.94,
                  r:r, d:r*(0.16+rnd()*0.12)});
  }
  /* bucket them by x so a lookup only tests nearby ones */
  const CB=200, cbuckets=new Map();
  craters.forEach((c,i)=>{
    const a=Math.floor((c.x-c.r*1.3+HALF)/CB), b=Math.floor((c.x+c.r*1.3+HALF)/CB);
    for(let k=a;k<=b;k++){ if(!cbuckets.has(k))cbuckets.set(k,[]); cbuckets.get(k).push(i); }
  });

  /* --- the bare landscape, before the road is cut into it --- */
  function landAt(x,z){
    let h=n1(x/L.scale,z/L.scale)*L.amp;
    h+=n1(x/(L.scale*.41)+31,z/(L.scale*.41)-17)*L.amp*0.42*L.rough;
    h+=n2(x/(L.scale*.17)-11,z/(L.scale*.17)+23)*L.amp*0.16*L.rough;

    /* mountains ringing the basin, so you never see the edge of the world */
    const e=Math.max(Math.abs(x),Math.abs(z))/HALF;
    if(e>0.70){
      const t=(e-0.70)/0.30;
      h+=t*t*L.rimAmp + n2(x/220,z/220)*t*L.rimAmp*0.35;
    }

    /* craters */
    const list=cbuckets.get(Math.floor((x+HALF)/CB));
    if(list) for(let i=0;i<list.length;i++){
      const c=craters[list[i]];
      const dx=x-c.x, dz=z-c.z;
      const d=Math.sqrt(dx*dx+dz*dz)/c.r;
      if(d<1.3){
        if(d<0.86) h-=c.d*(1-(d/0.86)*(d/0.86));
        else h+=c.d*0.5*Math.exp(-Math.pow((d-1.0)/0.17,2));
      }
    }
    return h;
  }

  onProgress&&onProgress(0.1);

  /* --- the lap: a wobbly closed loop --- */
  const R=scene.road.loopR, tw=scene.road.twist;
  const ph=[rnd()*6.28,rnd()*6.28,rnd()*6.28];
  const rAt=th=>R*(1 + 0.13*tw*Math.sin(2*th+ph[0])
                     + 0.09*tw*Math.sin(3*th+ph[1])
                     + 0.05*tw*Math.sin(5*th+ph[2]));

  /* walk it finely, then resample at an even 4 m spacing */
  const fine=[];
  const FN=6000;
  for(let i=0;i<=FN;i++){
    const th=i/FN*Math.PI*2, r=rAt(th);
    fine.push([Math.cos(th)*r, Math.sin(th)*r]);
  }
  let total=0; const cum=[0];
  for(let i=1;i<=FN;i++){
    total+=Math.hypot(fine[i][0]-fine[i-1][0], fine[i][1]-fine[i-1][1]);
    cum.push(total);
  }
  const nMain=Math.round(total/ROUTE_STEP);
  let nPts=nMain;
  const lapLen=nMain*ROUTE_STEP;
  let rx=new Float32Array(nPts), rz=new Float32Array(nPts);
  let fi=0;
  for(let i=0;i<nPts;i++){
    const target=i*ROUTE_STEP;
    while(fi<FN-1 && cum[fi+1]<target) fi++;
    const t=(target-cum[fi])/Math.max(cum[fi+1]-cum[fi],1e-6);
    rx[i]=lerp(fine[fi][0],fine[fi+1][0],t);
    rz[i]=lerp(fine[fi][1],fine[fi+1][1],t);
  }

  onProgress&&onProgress(0.2);

  /* road height: follow the land, but smoothed until it is ridable */
  let ry=new Float32Array(nPts);
  for(let i=0;i<nPts;i++) ry[i]=landAt(rx[i],rz[i]);
  const smoothLoop=(a,w)=>{
    const n=a.length,out=new Float32Array(n);
    let acc=0;
    for(let k=-w;k<=w;k++) acc+=a[((k%n)+n)%n];
    const d=2*w+1;
    for(let i=0;i<n;i++){ out[i]=acc/d; acc-=a[(((i-w)%n)+n)%n]; acc+=a[(i+w+1)%n]; }
    return out;
  };
  ry=smoothLoop(ry,28);
  ry=smoothLoop(ry,28);

  /* guarantee the promised maximum gradient by flattening the whole profile */
  let mean=0; for(let i=0;i<nPts;i++) mean+=ry[i]; mean/=nPts;
  let maxG=0;
  for(let i=0;i<nPts;i++){
    const g=Math.abs(ry[(i+1)%nPts]-ry[i])/ROUTE_STEP*100;
    if(g>maxG) maxG=g;
  }
  if(maxG>scene.road.maxGrade){
    const k=scene.road.maxGrade/maxG;
    for(let i=0;i<nPts;i++) ry[i]=mean+(ry[i]-mean)*k;
  }
  /* per-sample gradient, for the physics and the HUD */
  let grade=new Float32Array(nPts);
  for(let i=0;i<nPts;i++) grade[i]=(ry[(i+1)%nPts]-ry[i])/ROUTE_STEP*100;

  /* road direction and sideways vector at each sample */
  let tx=new Float32Array(nPts), tz=new Float32Array(nPts);
  for(let i=0;i<nPts;i++){
    const j=(i+1)%nPts;
    let dx=rx[j]-rx[i], dz=rz[j]-rz[i];
    const l=Math.hypot(dx,dz)||1; tx[i]=dx/l; tz[i]=dz/l;
  }

  /* --- the shortcut: a second road cutting across the loop -----------------
     A cubic Bezier from junction A to junction B, leaving and arriving along
     the main road's own direction, so both forks are gentle. Its samples are
     APPENDED to the same arrays: everything spatial downstream (the terrain
     carving, the ribbon, the clutter) then treats it as more road. Movement
     logic knows main is samples [0,nMain) and the cut is [nMain,nPts). --- */
  let nCut=0, cutLen=0, iA=0, iB=0, sideA='right', sideB='right';
  if(scene.road.shortcut){
    /* pick the pair of anchor points whose chord stays farthest from the
       rest of the loop, so the new road never collides with the old one */
    let bestScore=-1, bfA=0, bfB=0;
    const cand=[];
    for(let c=0;c<48;c++){
      const fa=0.05+rnd()*0.5;
      cand.push([fa, fa+0.22+rnd()*0.33]);
    }
    for(const [fa,fb] of cand){
      const a0=Math.floor(nMain*fa), b0=Math.floor(nMain*Math.min(fb,0.92));
      let clear=1e9;
      for(let t=1;t<10;t++){
        const mx=lerp(rx[a0],rx[b0],t/10), mz=lerp(rz[a0],rz[b0],t/10);
        for(let i=0;i<nMain;i+=6){
          const dA=Math.min(Math.abs(i-a0),nMain-Math.abs(i-a0));
          const dB=Math.min(Math.abs(i-b0),nMain-Math.abs(i-b0));
          if(dA<25||dB<25) continue;
          const d=Math.hypot(mx-rx[i],mz-rz[i]);
          if(d<clear) clear=d;
        }
      }
      /* a good cut is well clear of the loop, much shorter than staying on
         the main road - and both forks must sit on OPEN road: a junction
         inside a tunnel or on a bridge sends the rider through the hollow
         inside of a mountain */
      const openRoad=i0=>{
        for(let k=-18;k<=18;k+=3){
          const i=((i0+k)%nMain+nMain)%nMain;
          const dl=landAt(rx[i],rz[i])-ry[i];
          if(dl>11||dl<-7) return false;      /* would be tunnel / bridge */
        }
        return true;
      };
      const arc=(b0-a0)*ROUTE_STEP;
      const chord=Math.hypot(rx[b0]-rx[a0],rz[b0]-rz[a0]);
      const score=(clear>80&&openRoad(a0)&&openRoad(b0)?1:0.001)
                  *(arc/Math.max(chord,1));
      if(score>bestScore){bestScore=score;bfA=a0;bfB=b0;}
    }
    iA=bfA; iB=bfB;
    /* nowhere clean to fork? then this world simply has no shortcut —
       better an honest single loop than a junction inside a mountain */
    if(bestScore<0.01){ iA=0; iB=0; }
    if(iA!==iB){
    const P0=[rx[iA],rz[iA]], P3=[rx[iB],rz[iB]];
    const chord=Math.hypot(P3[0]-P0[0],P3[1]-P0[1]);
    const P1=[P0[0]+tx[iA]*chord*0.30, P0[1]+tz[iA]*chord*0.30];
    const P2=[P3[0]-tx[iB]*chord*0.30, P3[1]-tz[iB]*chord*0.30];
    /* sample the Bezier finely, then resample at ROUTE_STEP */
    const fineC=[]; const FC=800;
    for(let k=0;k<=FC;k++){
      const t=k/FC, u=1-t;
      fineC.push([u*u*u*P0[0]+3*u*u*t*P1[0]+3*u*t*t*P2[0]+t*t*t*P3[0],
                  u*u*u*P0[1]+3*u*u*t*P1[1]+3*u*t*t*P2[1]+t*t*t*P3[1]]);
    }
    let clen=0; const ccum=[0];
    for(let k=1;k<=FC;k++){
      clen+=Math.hypot(fineC[k][0]-fineC[k-1][0],fineC[k][1]-fineC[k-1][1]);
      ccum.push(clen);
    }
    nCut=Math.max(8,Math.round(clen/ROUTE_STEP));
    cutLen=nCut*ROUTE_STEP;
    const cx=new Float32Array(nCut), cz=new Float32Array(nCut), cy=new Float32Array(nCut);
    let fc=0;
    for(let k=0;k<nCut;k++){
      const target=k/(nCut-1)*clen;
      while(fc<FC-1&&ccum[fc+1]<target) fc++;
      const t=(target-ccum[fc])/Math.max(ccum[fc+1]-ccum[fc],1e-6);
      cx[k]=lerp(fineC[fc][0],fineC[fc+1][0],t);
      cz[k]=lerp(fineC[fc][1],fineC[fc+1][1],t);
    }
    /* heights: pinned to the junctions, gently following the land between,
       then smoothed and slope-limited until ridable */
    for(let k=0;k<nCut;k++){
      const t=k/(nCut-1);
      cy[k]=lerp(ry[iA],ry[iB],smoothstep(t))*0.65+landAt(cx[k],cz[k])*0.35;
    }
    const lim=scene.road.maxGrade/100*ROUTE_STEP;
    for(let pass=0;pass<80;pass++){
      cy[0]=ry[iA]; cy[nCut-1]=ry[iB];
      for(let k=1;k<nCut-1;k++) cy[k]=(cy[k-1]+cy[k]*2+cy[k+1])/4;
      cy[0]=ry[iA]; cy[nCut-1]=ry[iB];
      for(let k=0;k<nCut-1;k++){          /* forward march from the pinned A */
        const dh=cy[k+1]-cy[k];
        if(dh>lim) cy[k+1]=cy[k]+lim;
        else if(dh<-lim) cy[k+1]=cy[k]-lim;
      }
      cy[nCut-1]=ry[iB];
      for(let k=nCut-1;k>0;k--){          /* backward march from the pinned B */
        const dh=cy[k-1]-cy[k];
        if(dh>lim) cy[k-1]=cy[k]+lim;
        else if(dh<-lim) cy[k-1]=cy[k]-lim;
      }
    }
    cy[0]=ry[iA]; cy[nCut-1]=ry[iB];
    /* append to the world arrays */
    nPts=nMain+nCut;
    const grow=(old,fill)=>{const a=new Float32Array(nPts);a.set(old);return a;};
    rx=grow(rx); rz=grow(rz); ry=grow(ry); tx=grow(tx); tz=grow(tz); grade=grow(grade);
    for(let k=0;k<nCut;k++){
      rx[nMain+k]=cx[k]; rz[nMain+k]=cz[k]; ry[nMain+k]=cy[k];
      const k2=Math.min(k+1,nCut-1), k1=Math.max(k-1,k2-1);
      let dx=cx[k2]-cx[k1], dz=cz[k2]-cz[k1];
      const l=Math.hypot(dx,dz)||1;
      tx[nMain+k]=dx/l; tz[nMain+k]=dz/l;
      grade[nMain+k]=(cy[k2]-cy[Math.max(k2-1,0)])/ROUTE_STEP*100;
    }
    /* which way each fork turns, as the approaching rider sees it */
    const s0=tz[iA]*tx[nMain]-tx[iA]*tz[nMain];
    sideA=s0>0?'left':'right';
    const s1=tz[iB]*tx[nMain+nCut-1]-tx[iB]*tz[nMain+nCut-1];
    sideB=s1>0?'left':'right';
    }
  }

  onProgress&&onProgress(0.3);

  /* --- lookup: how far is (x,z) from the road, and how high is the road there? --- */
  const CELL=50, rbuckets=new Map();
  const rkey=(a,b)=>a*10000+b;
  for(let i=0;i<nPts;i++){
    const k=rkey(Math.floor(rx[i]/CELL),Math.floor(rz[i]/CELL));
    if(!rbuckets.has(k)) rbuckets.set(k,[]);
    rbuckets.get(k).push(i);
  }
  const CORRIDOR=16, BLEND=75;      // flat to 16 m, blended out to 75 m
  function roadNear(x,z){
    const gx=Math.floor(x/CELL), gz=Math.floor(z/CELL);
    let best=1e9, bi=-1;
    for(let a=-2;a<=2;a++) for(let b=-2;b<=2;b++){
      const list=rbuckets.get(rkey(gx+a,gz+b));
      if(!list) continue;
      for(let n=0;n<list.length;n++){
        const i=list[n];
        const d=(x-rx[i])*(x-rx[i])+(z-rz[i])*(z-rz[i]);
        if(d<best){best=d;bi=i;}
      }
    }
    return bi<0?null:{d:Math.sqrt(best), i:bi};
  }

  /* --- where the settlements go: level shelves set back from the road --- */
  const life=scene.life||{bases:0,walkers:0,rovers:0,ships:0,drones:0};
  const bases=[];
  for(let b=0;b<(life.bases||0);b++){
    const si=Math.floor(((b+0.5)/life.bases+rnd()*0.12)*nPts)%nPts;
    /* close enough to the road that you actually ride past them */
    const side=rnd()<.5?-1:1, off=50+rnd()*28;
    bases.push({i:si, x:rx[si]-tz[si]*off*side, z:rz[si]+tx[si]*off*side,
                y:ry[si]+(rnd()*2-1)*1.2, r:22+rnd()*7, yaw:rnd()*6.28318});
  }

  /* --- where the road needs engineering ---------------------------------
     The road height is a heavily smoothed version of the land, so in places
     the land closes over it (dig a tunnel) and in others the road hangs in
     mid-air (build a bridge). Find those runs and stop carving there, so the
     mountain stays whole and the gorge stays open. */
  const landY=new Float32Array(nPts);
  for(let i=0;i<nPts;i++) landY[i]=landAt(rx[i],rz[i]);
  const carve=new Float32Array(nPts).fill(1);
  const inTunnel=new Uint8Array(nPts), inBridge=new Uint8Array(nPts);
  const tunnels=[], bridges=[];
  const RD=scene.road;
  const findRuns=(test,minLen,limit)=>{
    const out=[];
    let i=0;
    while(i<nPts){
      if(!test(i)){i++;continue;}
      let j=i; while(j<nPts&&test(j)) j++;
      if((j-i)*ROUTE_STEP>=minLen) out.push([i,j-1,(j-i)]);
      i=j;
    }
    out.sort((a,b)=>b[2]-a[2]);
    return out.slice(0,limit);
  };
  const farFromJn=i=>{
    if(!nCut) return true;
    const dA=Math.min(Math.abs(i-iA),nMain-Math.abs(i-iA));
    const dB=Math.min(Math.abs(i-iB),nMain-Math.abs(i-iB));
    return Math.min(dA,dB)>25;
  };
  if(RD.tunnels)
    for(const r of findRuns(i=>i<nMain&&farFromJn(i)&&landY[i]-ry[i]>15,70,RD.tunnels)) tunnels.push(r);
  if(RD.bridges)
    for(const r of findRuns(i=>i<nMain&&farFromJn(i)&&ry[i]-landY[i]>9,45,RD.bridges)) bridges.push(r);

  const markRun=(r,flags,ramp)=>{
    for(let i=r[0];i<=r[1];i++){
      flags[i]=1;
      const dEnd=Math.min(i-r[0],r[1]-i);
      carve[i]=Math.min(carve[i], ramp>0?clamp(1-dEnd/ramp,0,1):0);
    }
  };
  /* two bores a few metres apart would give back-to-back portals — any real
     road would drive it as one tunnel, so merge runs closer than 60 m */
  const mergeRuns=list=>{
    list.sort((p,q)=>p[0]-q[0]);
    for(let i=list.length-2;i>=0;i--){
      if(list[i+1][0]-list[i][1]<=15){
        list[i][1]=list[i+1][1];
        list[i][2]=list[i][1]-list[i][0];
        list.splice(i+1,1);
      }
    }
  };
  mergeRuns(tunnels); mergeRuns(bridges);

  for(const r of tunnels) markRun(r,inTunnel,0);
  for(const r of bridges) markRun(r,inBridge,3);

  /* A heightfield cannot have a hole in it, so a tunnel cannot simply be left
     as solid mountain: wherever the surface has to come down to road level it
     passes straight through the bore, and that is the wall of ground you end
     up staring at through the portal. The answer is to cut a trench wider than
     the bore for the whole length of the tunnel, drop it below the roadway,
     and then roof the trench over with a separate lid that arcs above the
     tube. From inside you see tube; from outside you see hillside. */
  const TUN_SLOT=scene.road.halfWidth+8.2;

  /* --- the finished ground height: land, then base shelves, then the road --- */
  function groundAt(x,z){
    let h=landAt(x,z);
    for(let b=0;b<bases.length;b++){
      const q=bases[b];
      const d=Math.hypot(x-q.x,z-q.z);
      if(d<q.r*1.9) h=lerp(q.y,h,d<=q.r?0:smoothstep((d-q.r)/(q.r*0.9)));
    }
    const near=roadNear(x,z);
    if(!near) return h;
    if(inTunnel[near.i]){
      /* The trench needs SLOPED walls, wider than the 9 m terrain grid. A hard
         edge lands neighbouring grid points on opposite sides of it along a
         curved bore, and the triangles between them render as a row of green
         spikes marching through the tunnel. */
      if(near.d<TUN_SLOT) return ry[near.i]-2.5;
      const t=(near.d-TUN_SLOT)/22;
      if(t<1) return lerp(ry[near.i]-2.5, h, smoothstep(t));
      return h;
    }
    const w=carve[near.i];
    if(w<=0.001) return h;
    let road;
    if(near.d<=CORRIDOR) road=ry[near.i]-0.25;
    else if(near.d>=BLEND) return h;
    else road=lerp(ry[near.i]-0.25,h,smoothstep((near.d-CORRIDOR)/(BLEND-CORRIDOR)));
    return lerp(h,road,w);
  }

  /* --- terrain mesh --- */
  const NV=NG+1;
  const hgt=new Float32Array(NV*NV);
  for(let j=0;j<NV;j++){
    const z=-HALF+j*STEP;
    for(let i=0;i<NV;i++) hgt[j*NV+i]=groundAt(-HALF+i*STEP,z);
    if((j&31)===0) onProgress&&onProgress(0.3+0.45*j/NV);
  }

  const cHigh=hx(scene.col.high), cLow=hx(scene.col.low);
  const tPos=new Float32Array(NV*NV*3);
  const tNrm=new Float32Array(NV*NV*3);
  const tCol=new Float32Array(NV*NV*4);
  let lo=Infinity,hi=-Infinity;
  for(let k=0;k<hgt.length;k++){if(hgt[k]<lo)lo=hgt[k];if(hgt[k]>hi)hi=hgt[k];}

  for(let j=0;j<NV;j++){
    for(let i=0;i<NV;i++){
      const k=j*NV+i, x=-HALF+i*STEP, z=-HALF+j*STEP, y=hgt[k];
      tPos[k*3]=x; tPos[k*3+1]=y; tPos[k*3+2]=z;

      const hL=hgt[j*NV+Math.max(i-1,0)],      hR=hgt[j*NV+Math.min(i+1,NV-1)];
      const hD=hgt[Math.max(j-1,0)*NV+i],      hU=hgt[Math.min(j+1,NV-1)*NV+i];
      let nx=hL-hR, ny=2*STEP, nz=hD-hU;
      const nl=Math.hypot(nx,ny,nz)||1;
      tNrm[k*3]=nx/nl; tNrm[k*3+1]=ny/nl; tNrm[k*3+2]=nz/nl;

      /* cheap ambient occlusion: sit below your neighbours and you go darker */
      const avg=(hL+hR+hD+hU)/4;
      const ao=clamp(0.72+(y-avg)/7,0.42,1.08);
      /* higher ground catches more light and more dust */
      const t=clamp((y-lo)/Math.max(hi-lo,1),0,1);
      const spec=0.88+0.24*n2(x/23,z/23);
      for(let c=0;c<3;c++) tCol[k*4+c]=lerp(cLow[c],cHigh[c],smoothstep(t))*ao*spec;
      tCol[k*4+3]=0;
    }
  }
  onProgress&&onProgress(0.78);

  const tIdx=new Uint32Array(NG*NG*6);
  let p=0;
  for(let j=0;j<NG;j++) for(let i=0;i<NG;i++){
    const a=j*NV+i,b=a+1,c=a+NV,d=c+1;
    tIdx[p++]=a;tIdx[p++]=c;tIdx[p++]=b;
    tIdx[p++]=b;tIdx[p++]=c;tIdx[p++]=d;
  }

  /* --- road ribbon --- */
  const hw=scene.road.halfWidth;
  const cRoad=hx(scene.col.road), cRum=hx(scene.col.rumble), cLane=hx(scene.col.lane);
  /* Vertex colours blend across a quad, so every paint edge needs two vertices
     2 cm apart -- otherwise the white centre line bleeds over the whole road. */
  const stripes=[
    {o:-hw-1.3,c:'rum'}, {o:-hw-0.02,c:'rum'},
    {o:-hw,    c:'road'},{o:-0.26,   c:'road'},
    {o:-0.22,  c:'lane'},{o: 0.22,   c:'lane'},
    {o: 0.26,  c:'road'},{o: hw,     c:'road'},
    {o: hw+0.02,c:'rum'},{o: hw+1.3, c:'rum'}
  ];
  const offs=stripes.map(s=>s.o);
  const NL=offs.length;
  const rPos=new Float32Array(nPts*NL*3);
  const rNrm=new Float32Array(nPts*NL*3);
  const rCol=new Float32Array(nPts*NL*4);
  const glowRoad=scene.grid?1:0;
  for(let i=0;i<nPts;i++){
    const nxv=-tz[i], nzv=tx[i];              // sideways vector
    const dash=(Math.floor(i/3)%2)===0;       // dashed centre line
    for(let j=0;j<NL;j++){
      const k=(i*NL+j)*3, o=offs[j];
      rPos[k]=rx[i]+nxv*o; rPos[k+1]=ry[i]+0.10; rPos[k+2]=rz[i]+nzv*o;
      rNrm[k]=0; rNrm[k+1]=1; rNrm[k+2]=0;
      const m=(i*NL+j)*4;
      const kind=stripes[j].c;
      let c=cRoad, em=0;
      if(kind==='rum'){ c=cRum; em=glowRoad?1:(scene.beacons?0.35:0); }
      else if(kind==='lane' && dash){ c=cLane; em=glowRoad?1:0; }
      rCol[m]=c[0];rCol[m+1]=c[1];rCol[m+2]=c[2];rCol[m+3]=em;
    }
  }
  const rIdx=new Uint32Array((nMain+Math.max(0,nCut-1))*(NL-1)*6);
  p=0;
  for(let i=0;i<nPts;i++){
    if(i===nPts-1&&nCut>0) break;               /* the cut does not wrap */
    const i2=(i<nMain)?((i+1)%nMain):(i+1);
    for(let j=0;j<NL-1;j++){
      /* wound so the face points up: along-route and across-route are the
         opposite handedness to the terrain grid */
      const a=i*NL+j,b=a+1,c=i2*NL+j,d=c+1;
      rIdx[p++]=a;rIdx[p++]=b;rIdx[p++]=c;
      rIdx[p++]=b;rIdx[p++]=d;rIdx[p++]=c;
    }
  }
  onProgress&&onProgress(0.85);

  /* ---- lakes: still water filling the deep basins. The level is anchored
        below the lowest point of any road, so water can never flood tarmac
        (the lava lesson, applied twice). ---- */
  let waterY=null, waterMesh=null; const lakeSpots=[];
  if(scene.water){
    let rmin=Infinity;
    for(let i=0;i<nPts;i++) if(ry[i]<rmin) rmin=ry[i];
    const samp=[];
    for(let k=0;k<hgt.length;k+=11) samp.push(hgt[k]);
    samp.sort((a,b)=>a-b);
    waterY=Math.min(samp[Math.floor(samp.length*(scene.water.q||0.08))], rmin-2.5);
    if(waterY<samp[0]+0.5) waterY=null;
    else{
      const wm=new MeshB();
      const WC=hx(scene.water.col||'#2b6d86');
      let cells=0;
      for(let j=0;j<NG;j++)for(let i=0;i<NG;i++){
        if(hgt[j*NV+i]>=waterY||hgt[j*NV+i+1]>=waterY||
           hgt[(j+1)*NV+i]>=waterY||hgt[(j+1)*NV+i+1]>=waterY) continue;
        const x0=-HALF+i*STEP,z0=-HALF+j*STEP,x1=x0+STEP,z1=z0+STEP;
        wm.quad([x0,waterY,z0],[x1,waterY,z0],[x1,waterY,z1],[x0,waterY,z1],WC,0.05);
        cells++;
        if(hgt[j*NV+i]<waterY-2&&cells%17===0) lakeSpots.push([x0+STEP/2,z0+STEP/2]);
      }
      if(!cells){ waterY=null; }
      else waterMesh={pos:new Float32Array(wm.pos),nrm:new Float32Array(wm.nrm),
                      col:new Float32Array(wm.col),idx:new Uint32Array(wm.idx)};
    }
  }

  /* --- everything that stands on the ground, baked into one mesh --- */
  const mb=new MeshB();
  const gb=new MeshB();   /* translucent glass, drawn after everything */
  const K={}; for(const kk in (scene.kit||{})) K[kk]=hx(scene.kit[kk]);
  const pushTri=(a,b,c,cc,em)=>mb.tri(a,b,c,cc,em);
  const cRail=hx(scene.col.rumble);
  const cDark=[0.055,0.05,0.05];
  /* a point on the roadway: sample i, sideways offset o, height above the deck */
  const RP=(i,o,dy)=>[rx[i]-tz[i]*o, ry[i]+dy, rz[i]+tx[i]*o];
  const yawAt=i=>Math.atan2(tx[i],tz[i]);

  const tunPanels=[];   /* wall screens inside the bores, merged into world.screens */
  /* ---- tunnels: bore an arched tube through the untouched mountain ---- */
  const TW=hw+2.4, TH=2.9;          /* half width of the bore, wall height */
  const section=[];
  section.push([-TW,0]);
  for(let k=0;k<=9;k++){
    const th=Math.PI*(1-k/9);
    section.push([Math.cos(th)*TW, TH+Math.sin(th)*TW]);
  }
  section.push([TW,0]);
  for(const r of tunnels){
    /* the bore pokes a little way out of the rock face at each end */
    const a=Math.max(0,r[0]-2), b=Math.min(nPts-1,r[1]+2);
    const PIPES=[
      {lat:-(TW-0.30), h:1.95, w:0.095, col:[0.52,0.55,0.58], em:0},
      {lat:-(TW-0.30), h:2.34, w:0.070, col:[0.70,0.44,0.20], em:0},
      {lat: (TW-0.32), h:2.12, w:0.130, col:[0.34,0.37,0.42], em:0},
      {lat: (TW-0.26), h:1.62, w:0.045, col:[0.30,0.90,1.00], em:0.55}];
    let prev=null, pipePrev=null;
    for(let i=a;i<=b;i++){
      const row=section.map(sPt=>RP(i,sPt[0],sPt[1]));
      if(prev) for(let k=0;k<row.length-1;k++)
        mb.quad(prev[k],prev[k+1],row[k+1],row[k],cDark,0.07);
      prev=row;
      mb.setTF(rx[i],ry[i],rz[i],yawAt(i),1);
      if((i-a)%6===0)                        /* ceiling light */
        mb.box(0,TH+TW-0.45,0,1.9,0.24,0.6,K.glow,0.95);
      /* services along the walls: continuous pipes that follow the bore */
      mb.setTF(0,0,0,0,1);
      const pp=PIPES.map(q2=>RP(i,q2.lat,q2.h));
      if(pipePrev) for(let k2=0;k2<PIPES.length;k2++){
        const q2=PIPES[k2], A=pipePrev[k2], B=pp[k2], w2=q2.w;
        const nx2=-tz[i], nz2=tx[i];
        const A1=[A[0]-nx2*w2,A[1],A[2]-nz2*w2], A2=[A[0]+nx2*w2,A[1],A[2]+nz2*w2];
        const B2=[B[0]+nx2*w2,B[1],B[2]+nz2*w2], B1=[B[0]-nx2*w2,B[1],B[2]-nz2*w2];
        mb.quad(A1,A2,B2,B1,q2.col,q2.em); mb.quad(B1,B2,A2,A1,q2.col,q2.em);
        const A3=[A[0],A[1]-w2,A[2]], A4=[A[0],A[1]+w2,A[2]];
        const B4=[B[0],B[1]+w2,B[2]], B3=[B[0],B[1]-w2,B[2]];
        mb.quad(A3,A4,B4,B3,q2.col,q2.em); mb.quad(B3,B4,A4,A3,q2.col,q2.em);
      }
      pipePrev=pp;
      mb.setTF(rx[i],ry[i],rz[i],yawAt(i),1);
      if((i-a)%8===3){                       /* junction boxes with a live LED */
        const sd2=((i/8)|0)%2===0?-1:1;
        mb.box(sd2*(TW-0.30),1.42,0,0.5,0.62,0.44,[0.20,0.22,0.26],0);
        mb.box(sd2*(TW-0.55),1.58,0,0.10,0.10,0.10,[0.4,1,0.5],1.3);
      }
      mb.setTF(0,0,0,0,1);
    }
    /* roof the trench back over, so the hill still reads as solid from
       outside. Never allowed to dip below the top of the bore. */
    const gc=hx(scene.col.high);
    const lidCol=[gc[0]*0.82,gc[1]*0.82,gc[2]*0.82];
    const LAT=[-1,-0.55,0,0.55,1];
    const LID_W=TUN_SLOT+24;   /* reaches past the sloped trench walls */
    let lidPrev=null;
    for(let i=a;i<=b;i++){
      const nx=-tz[i], nz=tx[i];
      const row=LAT.map(function(t){
        const o=t*LID_W;
        const px=rx[i]+nx*o, pz=rz[i]+nz*o;
        /* the outer edge tucks just under the real ground to hide the seam */
        const edge=(Math.abs(t)>0.9)?1.2:0;
        return [px, Math.max(landAt(px,pz)-edge, ry[i]+TH+TW+1.6), pz];
      });
      if(lidPrev) for(let k=0;k<row.length-1;k++)
        mb.quad(lidPrev[k],lidPrev[k+1],row[k+1],row[k],lidCol,0);
      lidPrev=row;
    }

    const ART=['moon','mars','rider'];
    for(let i=a+8;i<=b-8;i+=13){              /* framed pictures on the walls */
      const side=(((i/13)|0)%2===0)?-1:1;
      const nx=-tz[i], nz=tx[i];
      const wx=rx[i]+nx*(TW-0.42)*side, wz=rz[i]+nz*(TW-0.42)*side;
      tunPanels.push({x:wx, y:ry[i], z:wz,
        rx:tx[i]*side, rz:tz[i]*side,
        w:3.1, by:0.85, em:0.95, tex:ART[((i/13)|0)%3]});
      mb.setTF(rx[i],ry[i],rz[i],yawAt(i),1);  /* thin frame behind the picture */
      mb.box(side*(TW-0.30),1.85,0,0.16,1.9,3.0,[0.16,0.17,0.20],0);
      mb.setTF(0,0,0,0,1);
    }
    for(const e of [a,b]){                    /* portal facade at each mouth */
      mb.setTF(rx[e],ry[e],rz[e],yawAt(e),1);
      mb.box(-(TW+0.9),0,0,1.7,TH+TW+2.2,3.4,K.trim,0);
      mb.box( (TW+0.9),0,0,1.7,TH+TW+2.2,3.4,K.trim,0);
      mb.box(0,TH+TW+0.5,0,2*(TW+1.75),1.9,3.4,K.trim,0);
      mb.box(-1.9,TH+TW+0.9,1.75,1.1,0.5,0.2,K.glow,1.2);
      mb.box( 1.9,TH+TW+0.9,1.75,1.1,0.5,0.2,K.glow,1.45);
      mb.setTF(0,0,0,0,1);
    }
  }

  /* ---- bridges: a deck slab on piers, with parapets and lamps ---- */
  const BW=hw+1.6;
  for(const r of bridges){
    for(let i=r[0];i<r[1];i++){
      const j=i+1;
      const tL=RP(i,-BW,-0.05), tR=RP(i,BW,-0.05);
      const bL=RP(i,-BW,-1.6),  bR=RP(i,BW,-1.6);
      const TL=RP(j,-BW,-0.05), TR=RP(j,BW,-0.05);
      const BL=RP(j,-BW,-1.6),  BR=RP(j,BW,-1.6);
      mb.quad(bL,bR,BR,BL,K.dark,0);                    /* underside */
      mb.quad(tL,bL,BL,TL,K.trim,0);                    /* outer faces */
      mb.quad(TR,BR,bR,tR,K.trim,0);
      for(const s of [-1,1]){                           /* parapet */
        const o=s*(BW-0.25), o2=o+s*0.05;
        const p0=RP(i,o,0.02), p1=RP(j,o,0.02);
        const q0=RP(i,o,1.0),  q1=RP(j,o,1.0);
        const P0=RP(i,o2,0.02), P1=RP(j,o2,0.02);
        const Q0=RP(i,o2,1.0),  Q1=RP(j,o2,1.0);
        mb.quad(p0,p1,q1,q0,cRail,0.05);
        mb.quad(Q0,Q1,P1,P0,cRail,0.05);
      }
      if((i-r[0])%7===0){                               /* pier down to the ground */
        const gy=landAt(rx[i],rz[i]), top=ry[i]-1.6;
        if(top-gy>2.5){
          mb.setTF(rx[i],gy,rz[i],yawAt(i),1);
          mb.box(0,0,0,3.4,top-gy,3.4,K.trim,0);
          mb.box(0,0,0,5.0,1.4,5.0,K.dark,0);
          mb.box(0,top-gy-1.0,0,2*BW-0.6,1.0,4.2,K.trim,0);
          mb.setTF(0,0,0,0,1);
        }
      }
      if((i-r[0])%10===5){                              /* lamp posts */
        for(const s of [-1,1]){
          mb.setTF(rx[i]-tz[i]*s*(BW-0.15),ry[i],rz[i]+tx[i]*s*(BW-0.15),yawAt(i),1);
          mb.cyl(0,0.9,0,0.09,3.2,5,K.trim,0);
          mb.box(0,4.0,0,0.7,0.28,0.7,K.glow,0.95);
          mb.setTF(0,0,0,0,1);
        }
      }
    }
  }

  /* ---- guard rails wherever the road runs along a drop ---- */
  for(let i=2;i<nPts-2;i+=2){
    if(inTunnel[i]||inBridge[i]) continue;
    if(ry[i]-landY[i]<3) continue;
    for(const s of [-1,1]){
      mb.setTF(rx[i]-tz[i]*s*(hw+1.15),ry[i],rz[i]+tx[i]*s*(hw+1.15),yawAt(i),1);
      mb.box(0,0,0,0.15,0.95,0.15,K.trim,0);
      mb.box(0,0.72,4,0.11,0.24,8.2,cRail,0.05);
      mb.setTF(0,0,0,0,1);
    }
  }

  /* ---- sign gantries spanning the road, for rhythm ---- */
  for(let i=90;i<nPts-40;i+=Math.floor(150+rnd()*110)){
    if(inTunnel[i]||inBridge[i]) continue;
    mb.setTF(rx[i],ry[i],rz[i],yawAt(i),1);
    mb.box(-(hw+1.7),0,0,0.62,6.4,0.62,K.trim,0);
    mb.box( (hw+1.7),0,0,0.62,6.4,0.62,K.trim,0);
    mb.box(0,6.4,0,2*(hw+2.3),0.75,1.1,K.trim,0);
    mb.box(-1.7,5.75,0.62,1.3,0.55,0.22,K.glow,1.2);
    mb.box( 1.7,5.75,0.62,1.3,0.55,0.22,K.glow,1.45);
    mb.setTF(0,0,0,0,1);
  }

  /* ---- junction arrow boards: what the rider sees before the fork ---- */
  if(nCut>0){
    const board=(iApp,flip,side)=>{
      mb.setTF(rx[iApp],ry[iApp],rz[iApp],
               Math.atan2(tx[iApp],tz[iApp])+(flip?Math.PI:0),1);
      mb.box(-(hw+1.5),0,0,0.55,6.2,0.55,K.trim,0);
      mb.box( (hw+1.5),0,0,0.55,6.2,0.55,K.trim,0);
      mb.box(0,6.2,0,2*(hw+1.9),0.5,0.9,K.trim,0);
      mb.box(0,3.55,0,4.8,2.3,0.26,K.dark,0);
      const arrow=(cx,cy,ang,col,em)=>{
        const R=(x,y)=>{const c=Math.cos(ang),s2=Math.sin(ang);
          return [cx+x*c-y*s2, cy+x*s2+y*c];};
        const Q=(x0,y0,x1,y1,x2,y2,x3,y3)=>{
          const A=R(x0,y0),B=R(x1,y1),C=R(x2,y2),D=R(x3,y3);
          const V=v=>mb.P(v[0],v[1],0.18);
          mb.quad(V(A),V(B),V(C),V(D),col,em);
          mb.quad(V(D),V(C),V(B),V(A),col,em);
        };
        Q(-0.13,-0.68, 0.13,-0.68, 0.13,0.10, -0.13,0.10);
        Q(-0.36,0.04, 0.36,0.04, 0.10,0.66, -0.10,0.66);
      };
      const sideX=side==='left'?1:-1;   /* local +x is the rider's left */
      arrow(-sideX*1.05,4.6,0,[0.50,0.84,1.0],0.9);
      arrow( sideX*1.05,4.6,sideX*0.85,[1.0,0.84,0.43],1.25);
      mb.setTF(0,0,0,0,1);
    };
    board(((iA-14)%nMain+nMain)%nMain,false,sideA);
    board((iB+14)%nMain,true,sideB);
  }

  /* ---- molten rock, flooding everything below a chosen level ---- */
  let lavaY=null;
  if(scene.lava){
    /* Anchor the surface to the LOWEST point of the road, not to the terrain:
       that guarantees the lava can never rise over the tarmac, and it only
       shows up in the gorges the bridges cross. */
    let rmin=Infinity;
    for(let i=0;i<nPts;i++) if(ry[i]<rmin) rmin=ry[i];
    lavaY=rmin-(scene.lava.depth||10);
    const LC=hx(scene.lava.col);
    const CC=hx(scene.lava.crust||'#1a0f0c');
    mb.setTF(0,0,0,0,1);
    for(let j=0;j<NG;j++) for(let i=0;i<NG;i++){
      if(hgt[j*NV+i]>=lavaY||hgt[j*NV+i+1]>=lavaY||
         hgt[(j+1)*NV+i]>=lavaY||hgt[(j+1)*NV+i+1]>=lavaY) continue;
      const x0=-HALF+i*STEP,z0=-HALF+j*STEP,x1=x0+STEP,z1=z0+STEP;
      /* cooled crust floating on the melt, with the glow coming up the cracks */
      const crust=n2(x0/150,z0/150)+0.45*n2(x0/47,z0/47);
      const a=[x0,lavaY,z0],b=[x1,lavaY,z0],c=[x1,lavaY,z1],d=[x0,lavaY,z1];
      if(crust>0.12){
        const k=clamp(0.6+crust*0.5,0.4,1.25);
        mb.quad(a,b,c,d,[CC[0]*k,CC[1]*k,CC[2]*k],0.03);
      }else{
        /* phase varies slowly across the lake so the pulse looks like heat,
           not like tiles */
        const ph=(0.5+0.5*Math.sin(x0/70+z0/95))*0.999;
        mb.quad(a,b,c,d,LC,2+ph);
      }
    }
  }
  const cRock=hx(scene.col.high);
  let placed=0, tries=0;
  while(placed<scene.rocks && tries<scene.rocks*40){
    tries++;
    const x=(rnd()*2-1)*HALF*.93, z=(rnd()*2-1)*HALF*.93;
    const near=roadNear(x,z);
    if(!near) continue;
    if(near.d<hw+3.5 || near.d>150) continue;      // beside the road, not on it
    if(inTunnel[near.i]&&near.d<TUN_SLOT+24) continue;  // never inside the bore or its walls
    const y=groundAt(x,z);
    if(waterY!==null&&y<waterY+0.3) continue;
    const s=(0.35+Math.pow(rnd(),2.4)*2.6)*(near.d<25?0.75:1.25);
    const shade=0.5+rnd()*0.45;
    const cc=[cRock[0]*shade,cRock[1]*shade,cRock[2]*shade];
    /* a lumpy boulder: a coarse sphere pushed around at random */
    const RS=6, RR=4, ring=[];
    for(let a=0;a<=RR;a++){
      const row=[]; const th=a/RR*Math.PI;
      for(let b=0;b<RS;b++){
        const ph2=b/RS*Math.PI*2, k=0.62+rnd()*0.76;
        row.push([x+Math.sin(th)*Math.cos(ph2)*s*k,
                  y+Math.cos(th)*s*k*0.85+s*0.42,
                  z+Math.sin(th)*Math.sin(ph2)*s*k]);
      }
      ring.push(row);
    }
    for(let a=0;a<RR;a++) for(let b=0;b<RS;b++){
      const b2=(b+1)%RS;
      pushTri(ring[a][b],ring[a+1][b],ring[a][b2],cc,0);
      pushTri(ring[a][b2],ring[a+1][b],ring[a+1][b2],cc,0);
    }
    placed++;
  }
  /* glowing beacons along the roadside for the dark worlds */
  if(scene.beacons){
    const cB=hx(scene.col.rumble);
    mb.setTF(0,0,0,0,1);
    for(let i=0;i<nPts;i+=28){
      const side=(i/28)%2?1:-1;
      mb.box(rx[i]-tz[i]*(hw+2.2)*side, ry[i], rz[i]+tx[i]*(hw+2.2)*side,
             0.44,1.9,0.44, cB, 1+((i/28)%5)/5);
    }
  }

  /* --- the settlements --- */
  for(let b=0;b<bases.length;b++){
    const q=bases[b];
    const c=Math.cos(q.yaw), s=Math.sin(q.yaw);
    /* place a model at a local offset within the base, keeping its heading */
    const at=(lx,lz,ly,k)=>{
      const X=q.x+lx*c+lz*s, Z=q.z-lx*s+lz*c;
      mb.setTF(X,q.y,Z,q.yaw+(ly||0),k||1);
      gb.setTF(X,q.y,Z,q.yaw+(ly||0),k||1);
    };
    if(life.spaceport && b===0){          /* one settlement is a launch facility */
      at(0,0,0);        mSpaceport(mb,K);
      at(-6,-46,0.4);   mDome(mb,K,6);
      at(20,-38,0.9);   mGreenhouse(mb,gb,K,4.8);
      at(12,-50,0);     mMast(mb,K,18);
      at(30,-30,0);     mCrates(mb,K,rnd);
      at(-30,-40,1.2);  mRover(mb,K);
      mb.setTF(0,0,0,0,1);
      continue;
    }
    at(0,0,0);          mDome(mb,K,7);
    at(-18,10,0.5);     mGreenhouse(mb,gb,K,5.4);
    at(16,-7,0.7);      mHab(mb,K);
    at(8,2,0.25);       mTube(mb,K,15);
    at(-16,-14,0.3);    mSolarFarm(mb,K);
    at(11,17,0);        mDish(mb,K);
    at(25,14,0);        mMast(mb,K,16);
    at(-4,32,0);        mPad(mb,K,12);
    at(-4,32,0.6);      mLander(mb,K);
    at(5,-15,0);        mCrates(mb,K,rnd);
    at(-10,-5,1.9);     mRover(mb,K);
    mb.setTF(0,0,0,0,1);
  }

  /* --- smaller equipment dotted along the whole lap, so there is always
         something to ride past --- */
  {
    const kinds=['mast','crates','solar','dish','rover','pad','crates'];
    for(let i=30;i<nPts-2;i+=Math.floor(34+rnd()*48)){
      if(inTunnel[i]||inBridge[i]) continue;
      const side=rnd()<.5?-1:1, off=15+rnd()*15;
      const x=rx[i]-tz[i]*off*side, z=rz[i]+tx[i]*off*side;
      const gey=groundAt(x,z);
      if(waterY!==null&&gey<waterY+0.3) continue;
      mb.setTF(x,gey-0.15,z,rnd()*6.28318,0.55+rnd()*0.5);
      const k=kinds[Math.floor(rnd()*kinds.length)];
      if(k==='mast')        mMast(mb,K,7+rnd()*7);
      else if(k==='crates') mCrates(mb,K,rnd);
      else if(k==='solar')  mSolar(mb,K);
      else if(k==='dish')   mDish(mb,K);
      else if(k==='rover')  mRover(mb,K);
      else                  mPad(mb,K,7);
    }
    mb.setTF(0,0,0,0,1);
  }

  /* --- roadside display screens showing his AI artwork: a big mission
         screen on the approach to every settlement, and smaller race
         posters of the cyclist dotted along the lap --- */
  const screens=[];
  for(const t2 of tunPanels) screens.push(t2);
  {
    const put=(i,side,w,tex)=>{
      i=((i%nPts)+nPts)%nPts;
      if(inTunnel[i]||inBridge[i]) return;
      const off=hw+(w>8?8.5:4.9);   /* posters stand inside the tree line */
      const x=rx[i]-tz[i]*off*side, z=rz[i]+tx[i]*off*side;
      const y=groundAt(x,z);
      if(waterY!==null&&y<waterY+0.3) return;
      screens.push({x,y,z,rx:-tz[i],rz:tx[i],w,tex});
      mb.setTF(0,0,0,0,1);
      mb.cyl(x,y-0.3,z,0.55,2.1,8,K.trim,0);            /* pedestal */
      mb.cyl(x,y+1.5,z,0.28,0.5,6,K.dark,0);            /* neck */
    };
    for(const q of bases){
      let bi=0,bd=1e9;
      for(let i2=0;i2<nPts;i2++){
        const dx=rx[i2]-q.x,dz=rz[i2]-q.z,d=dx*dx+dz*dz;
        if(d<bd){bd=d;bi=i2;}
      }
      put(bi-24,rnd()<.5?-1:1,10,scene.name==='Valles Marineris'?'mars':'moon');
    }
    for(let i=90;i<nPts-10;i+=Math.floor(210+rnd()*150))
      put(i,rnd()<.5?-1:1,6,'rider');
    mb.setTF(0,0,0,0,1);
  }

  /* --- flora: whatever grows here, thickest right beside the road --- */
  const BIO={}; for(const kk in (scene.bio||{})) BIO[kk]=hx(scene.bio[kk]);
  /* --- biome zones: the lap changes character as you ride it. Each zone
        reweights which flora grows and how dense the roadside grass is,
        so a meadow gives way to forest, then flower fields, then rock. --- */
  const ZONE_FLORA={
    meadow:{fans:3,tufts:4,pods:1,broad:1},
    forest:{pines:5,broad:3,spires:1,tufts:1},
    flower:{pods:5,tufts:3,fans:2},
    rocky:{crystals:4,tufts:1,pines:1},
    grove:{broad:4,fans:2,pods:1,spires:1}
  };
  const ZONE_BIAS={meadow:0.15,forest:0.35,flower:0.85,rocky:0.5,grove:0.62};
  const ZONE_GRASS={meadow:1.0,forest:0.45,flower:1.0,rocky:0.25,grove:0.7};
  const ZONE_TREES={meadow:0.22,forest:1.0,flower:0.15,rocky:0.08,grove:0.65};
  let zones=null;
  if(scene.zones){
    zones=[];
    let zt=0,zk=0;
    while(zt<1){
      const len=0.08+rnd()*0.13;
      zones.push({t0:zt,t1:Math.min(1,zt+len),k:scene.zones[zk%scene.zones.length]});
      zt+=len; zk++;
    }
  }
  const zoneOf=i=>{
    if(!zones) return null;
    const t=(Math.min(i,nMain-1)/nMain)%1;
    for(const z of zones) if(t>=z.t0&&t<z.t1) return z.k;
    return zones[0].k;
  };
  const zonePick=zk=>{
    const w=ZONE_FLORA[zk];
    let tot=0; for(const kk in w) tot+=w[kk];
    let r=rnd()*tot;
    for(const kk in w){ r-=w[kk]; if(r<=0) return kk; }
    return 'tufts';
  };

  if(scene.flora){
    const list=[];
    for(const kind in scene.flora)
      for(let i=0;i<scene.flora[kind];i++) list.push(kind);
    for(let n=0;n<list.length;n++){
      for(let attempt=0;attempt<20;attempt++){
        const i=Math.floor(rnd()*nPts), side=rnd()<.5?-1:1;
        const off=(hw+2.2)+Math.pow(rnd(),1.7)*75;
        const x=rx[i]-tz[i]*off*side, z=rz[i]+tx[i]*off*side;
        const near=roadNear(x,z);
        if(!near||near.d<hw+1.8) continue;
        if(inTunnel[near.i]&&near.d<TUN_SLOT+24) continue;   // no forests in the tunnel
        let clash=false;
        for(let b=0;b<bases.length;b++)
          if(Math.hypot(x-bases[b].x,z-bases[b].z)<bases[b].r*1.35) clash=true;
        if(clash) continue;
        const gfy=groundAt(x,z);
        if(waterY!==null&&gfy<waterY+0.3) continue;
        mb.setTF(x,gfy-0.06,z,rnd()*6.28318,0.7+rnd()*0.85);
        const zk=zoneOf(i);
        const k=zk?zonePick(zk):list[n];
        if(k==='spires')        mSpire(mb,BIO,rnd);
        else if(k==='fans')     mFan(mb,BIO,rnd);
        else if(k==='pods')     mPods(mb,BIO,rnd);
        else if(k==='crystals') mCrystal(mb,BIO,rnd);
        else if(k==='pines'){ if(GLTREES.pine) appendGLTF(mb,GLTREES.pine); else mPine(mb,BIO,rnd); }
        else if(k==='broad'){ if(GLTREES.oak)  appendGLTF(mb,GLTREES.oak);  else mBroad(mb,BIO,rnd); }
        else                    mTuft(mb,BIO,rnd);
        break;
      }
    }
    mb.setTF(0,0,0,0,1);
  }
  onProgress&&onProgress(0.93);

  /* --- the things that move: built in local space, drawn one by one --- */
  const mkMesh=fn=>{
    const q=new MeshB(); fn(q,K);
    return {pos:new Float32Array(q.pos),nrm:new Float32Array(q.nrm),
            col:new Float32Array(q.col),limb:new Float32Array(q.limb),
            idx:new Uint32Array(q.idx)};
  };
  const actorMeshes={astro:mkMesh(mAstro),rover:mkMesh(mRover),
                     shuttle:mkMesh(mShuttle),drone:mkMesh(mDrone)};
  if(life.station) actorMeshes.station=mkMesh(mStation);
  const fauna=scene.fauna||{};
  for(const kind in fauna) if(fauna[kind]>0)
    actorMeshes[kind]=mkMesh(q=>({strider:mStrider,grazer:mGrazer,
                                  hopper:mHopper,drifter:mDrifter})[kind](q,BIO));

  const actors=[];
  for(let i=0;i<(life.walkers||0);i++){
    let cx,cz;
    /* half of them work around a base, half are out on the road somewhere */
    if(bases.length && i%2===0){
      const q=bases[(i/2)%bases.length], a=rnd()*6.28318, d=9+rnd()*22;
      cx=q.x+Math.cos(a)*d; cz=q.z+Math.sin(a)*d;
    }else{
      const si=Math.floor(rnd()*nPts), side=rnd()<.5?-1:1, off=11+rnd()*26;
      cx=rx[si]-tz[si]*off*side; cz=rz[si]+tx[si]*off*side;
    }
    actors.push({type:'astro',cx:cx,cz:cz,r:2.5+rnd()*9,
      w:(rnd()<.5?-1:1)*(0.045+rnd()*0.085), ph:rnd()*6.28318, walk:rnd()<0.8});
  }
  for(let i=0;i<(life.rovers||0);i++)
    actors.push({type:'rover',s0:rnd()*lapLen,spd:4+rnd()*5,dir:rnd()<.5?-1:1,
      off:(rnd()<.5?-1:1)*(30+rnd()*45)});
  for(let i=0;i<(life.ships||0);i++){
    const a=rnd()*6.28318;
    actors.push({type:'shuttle',dx:Math.cos(a),dz:Math.sin(a),
      sx:(rnd()*2-1)*550, sz:(rnd()*2-1)*550, ph:rnd()*6.28318,
      spd:52+rnd()*45, alt:190+rnd()*240, len:5400, s0:rnd()*5400, k:1.7});
  }
  for(let i=0;i<(life.drones||0);i++){
    const q=bases.length?bases[i%bases.length]:null;
    const si=Math.floor(rnd()*nPts);
    const cx=q?q.x:rx[si], cz=q?q.z:rz[si];
    actors.push({type:'drone',cx:cx,cz:cz,gy:groundAt(cx,cz),
      r:35+rnd()*70, alt:24+rnd()*40, ph:rnd()*6.28318,
      w:(rnd()<.5?-1:1)*(0.11+rnd()*0.14), k:1.8});
  }
  /* the RENDERED terrain surface (bilinear over the height grid) - the mesh
     often sits well above or below the analytic ground, especially in the
     shaped road corridor, and buries anything placed underneath it. Both
     the vegetation and the animals stand on THIS. */
  const meshH=(x,z)=>{
    const fx=(x+HALF)/STEP, fz=(z+HALF)/STEP;
    const i0=clamp(Math.floor(fx),0,NG-1), j0=clamp(Math.floor(fz),0,NG-1);
    const u=fx-i0, v=fz-j0;
    const h00=hgt[j0*NV+i0], h10=hgt[j0*NV+i0+1];
    const h01=hgt[(j0+1)*NV+i0], h11=hgt[(j0+1)*NV+i0+1];
    return (h00*(1-u)+h10*u)*(1-v)+(h01*(1-u)+h11*u)*v;
  };
  /* --- vegetation billboards: grass thick beside the road, bushes beyond --- */
  let veg=null;
  if(scene.veg){
    const ctr=[],dat=[],uv=[],vidx=[];
    const plant=(x,z,y,size,kind,bias)=>{
      const b=ctr.length/3;
      const rndv=clamp((bias===undefined?0.5:bias)+(rnd()-0.5)*0.5,0,0.999);
      const u0=kind*0.25, u1=u0+0.25;
      for(const [ox,oy,uu,vv] of [[-1,0,u0,1],[1,0,u1,1],[1,1,u1,0],[-1,1,u0,0]]){
        ctr.push(x,y,z); dat.push(ox,oy,size,rndv); uv.push(uu,vv);
      }
      vidx.push(b,b+1,b+2,b,b+2,b+3);
    };
    const tryPlace=(kind,maxD)=>{
      const i=Math.floor(rnd()*nPts), side=rnd()<.5?-1:1;
      const off=(hw+1.2)+(kind>=2?4.5:0)+Math.pow(rnd(),1.4)*maxD;
      const x=rx[i]-tz[i]*off*side, z=rz[i]+tx[i]*off*side;
      const near=roadNear(x,z);
      if(!near||near.d<hw+1.0) return;
      if(inTunnel[near.i]&&near.d<TUN_SLOT+24) return;
      const y=meshH(x,z);
      if(waterY!==null&&y<waterY+0.3) return;
      /* the road corridor is flat by construction - only test steepness out
         in open country, where the coarse mesh can genuinely be a cliff */
      if(near.d>13&&Math.abs(meshH(x+2.5,z)-y)>2.6) return;
      const zk=zoneOf(i);
      if(zk&&kind===0&&rnd()>ZONE_GRASS[zk]) return;   /* forests thin the grass */
      if(zk&&kind>=2&&rnd()>(ZONE_TREES[zk]||0.3)) return; /* forests OWN the trees */
      const bias=zk?ZONE_BIAS[zk]:0.5;
      const size=kind===0?0.45+rnd()*0.40
                :kind===1?1.0+rnd()*1.1
                :kind===2?5.5+rnd()*2.6        /* oak: 9-13 m tall  */
                :4.5+rnd()*2.4;                /* pine: 7-11 m tall */
      plant(x,z,y+0.02,size,kind,bias);
    };
    for(let k=0;k<(scene.veg.grass||0);k++) tryPlace(0,26);
    for(let k=0;k<(scene.veg.bush||0);k++)  tryPlace(1,70);
    for(let k=0;k<(scene.veg.oaks||0);k++)  tryPlace(2,200);
    for(let k=0;k<(scene.veg.pines||0);k++) tryPlace(3,200);
    if(vidx.length)
      veg={ctr:new Float32Array(ctr),dat:new Float32Array(dat),
           uv:new Float32Array(uv),idx:new Uint32Array(vidx),
           count:vidx.length,
           tintA:hx(scene.veg.tintA||'#5f9c45'),
           tintB:hx(scene.veg.tintB||'#8fb659')};
  }

  /* --- the wildlife: each one wanders its own patch until you come past --- */
  for(const kind in fauna){
    const meta=CREATURE[kind];
    for(let i=0;i<fauna[kind]*2;i++){
      const idx=Math.floor(rnd()*nPts), side=rnd()<.5?-1:1;
      const off=(hw+7)+Math.pow(rnd(),1.5)*30;
      const hx0=rx[idx]-tz[idx]*off*side, hz0=rz[idx]+tx[idx]*off*side;
      actors.push({type:kind, meta:meta, hx:hx0, hz:hz0,
        px:hx0, py:0, pz:hz0, yaw:rnd()*6.28318,
        /* keep the wander circle clear of the tarmac */
        wr:Math.max(1.2,Math.min(2.5+rnd()*8, off-(hw+5.5))),
        wander:rnd()*6.28318,
        wr2:0, wspd:(rnd()<.5?-1:1)*(0.025+rnd()*0.055),
        gait:meta.gait*(0.85+rnd()*0.3), ph:rnd()*6.28318,
        alert:0, headYaw:0, headPitch:meta.rest, swing:0, emiss:1,
        k:0.85+rnd()*0.45});
    }
  }
  /* his glTF creatures live on every world: stags graze, jellies float,
     kestrels circle overhead */
  {
    /* find, near road index i0, a spot the rider can actually SEE:
       close to the tarmac and level with it. Searches outward along the
       road so a cluster is only dropped if a whole stretch is hopeless. */
    const levelSpot=(i0)=>{
      for(let d2=0;d2<50;d2++) for(const sg2 of (d2?[1,-1]:[1])){
        const i=(((i0+sg2*d2)%nPts)+nPts)%nPts;
        if(inTunnel[i]||inBridge[i]) continue;
        for(let tr=0;tr<7;tr++){
          const side=rnd()<.5?-1:1;
          const off=(hw+6)+Math.pow(rnd(),1.4)*16;
          const x=rx[i]-tz[i]*off*side, z=rz[i]+tx[i]*off*side;
          if(Math.abs(meshH(x,z)-ry[i])<3.0) return {x,z,off};
        }
      }
      return null;
    };
    const groundAtSpot=(type,gcre,sp,n,k0)=>{
      const meta=CREATURE[type];
      for(let m2=0;m2<n;m2++){
        const hx0=sp.x+(rnd()*2-1)*10, hz0=sp.z+(rnd()*2-1)*10;
        actors.push({type, meta, gcre, hx:hx0, hz:hz0,
          px:hx0, py:0, pz:hz0, yaw:rnd()*6.28318,
          wr:Math.max(1.2,Math.min(2.5+rnd()*7, sp.off-(hw+4.0))),
          wander:rnd()*6.28318, wr2:0,
          wspd:(rnd()<.5?-1:1)*(0.025+rnd()*0.055),
          gait:meta.gait*(0.85+rnd()*0.3), ph:rnd()*6.28318,
          alert:0, headYaw:0, headPitch:meta.rest, swing:0, emiss:1,
          gph:rnd()*6.28318, k:(k0||0.9)+rnd()*0.35});
      }
    };
    /* a herd or a jelly cluster every ~200 m, all the way round */
    let flip=0;
    for(let i2=25;i2<nPts-10;i2+=Math.floor(40+rnd()*22)){
      const sp=levelSpot(i2);
      if(!sp){
        if(inTunnel[i2]){
          const side=rnd()<.5?-1:1;
          const jx=rx[i2]-tz[i2]*2.2*side, jz=rz[i2]+tx[i2]*2.2*side;
          const meta=CREATURE.gjelly;
          actors.push({type:'gjelly', meta, gcre:'jelly', hx:jx, hz:jz,
            px:jx, py:ry[i2]+2.2, pz:jz, yaw:rnd()*6.28318,
            pinY:ry[i2]+2.2, wr:0.8, wander:rnd()*6.28318, wr2:0,
            wspd:(rnd()<.5?-1:1)*0.05, gait:0, ph:rnd()*6.28318,
            alert:0, headYaw:0, headPitch:0, swing:0, emiss:1,
            gph:0, k:0.75+rnd()*0.2});
          continue;
        }
        if(!inTunnel[i2]&&!inBridge[i2]){
          const side=rnd()<.5?-1:1, off=hw+7+rnd()*7;
          const jx=rx[i2]-tz[i2]*off*side, jz=rz[i2]+tx[i2]*off*side;
          const meta=CREATURE.gjelly;
          actors.push({type:'gjelly', meta, gcre:'jelly', hx:jx, hz:jz,
            px:jx, py:0, pz:jz, yaw:rnd()*6.28318, baseRoadY:ry[i2],
            wr:2+rnd()*3, wander:rnd()*6.28318, wr2:0,
            wspd:(rnd()<.5?-1:1)*0.04, gait:0, ph:rnd()*6.28318,
            alert:0, headYaw:0, headPitch:0, swing:0, emiss:1,
            gph:0, k:0.9+rnd()*0.35});
        }
        continue;
      }
      if(flip++%3===2) groundAtSpot('gjelly','jelly',sp,1+(rnd()<0.4?1:0),0.9);
      else            groundAtSpot('gstag','stag',sp,2+Math.floor(rnd()*3),0.9);
    }
    /* a welcoming party right after the start line, close to the tarmac,
       so the animals are impossible to miss */
    const nearSpawn=(type,gcre,idx,off,side)=>{
      let hx0=0, hz0=0;
      for(;idx<Math.min(nPts-2,idx+280);idx+=6){
        if(inTunnel[idx]||inBridge[idx]) continue;
        hx0=rx[idx]-tz[idx]*off*side; hz0=rz[idx]+tx[idx]*off*side;
        if(Math.abs(meshH(hx0,hz0)-ry[idx])<2.0) break;
      }
      const meta=CREATURE[type];
      actors.push({type, meta, gcre, hx:hx0, hz:hz0,
        px:hx0, py:0, pz:hz0, yaw:rnd()*6.28318,
        wr:1.5, wander:rnd()*6.28318, wr2:0,
        wspd:(rnd()<.5?-1:1)*0.05,
        gait:meta.gait, ph:rnd()*6.28318,
        alert:0, headYaw:0, headPitch:meta.rest, swing:0, emiss:1,
        gph:rnd()*6.28318, k:1.15});
    };
    nearSpawn('gstag','stag',18,10.5,-1);
    nearSpawn('gstag','stag',60,12,1);
    nearSpawn('gjelly','jelly',38,10,1);
    actors.push({type:'gbird', gcre:'bird', cx:rx[30], cz:rz[30],
      R:24, circ:rnd()*6.28318, w:0.10, baseY:ry[30]+9,
      px:rx[30], py:0, pz:rz[30], yaw:0,
      flap:true, flapT:1.5, gph:0, emiss:1, k:1.3});
    for(let i2=35;i2<nPts-10;i2+=Math.floor(32+rnd()*20)){
      if(inTunnel[i2]) continue;
      const side=rnd()<.5?-1:1, off=8+rnd()*26;
      const cx0=rx[i2]-tz[i2]*off*side, cz0=rz[i2]+tx[i2]*off*side;
      const flock=2+(rnd()<0.4?1:0);
      const R=22+rnd()*40, w2=(rnd()<.5?-1:1)*(0.08+rnd()*0.07);
      const bY=ry[i2]+8+rnd()*12;        /* above the ROAD here, not the map mean */
      for(let b2=0;b2<flock;b2++)
        actors.push({type:'gbird', gcre:'bird', cx:cx0, cz:cz0,
          R:R*(0.9+rnd()*0.2), circ:rnd()*6.28318, w:w2,
          baseY:bY+b2*2.5, px:cx0, py:0, pz:cz0, yaw:0,
          flap:true, flapT:1+rnd()*2, gph:rnd()*6.28318,
          emiss:1, k:0.9+rnd()*0.5});
    }
  }
  if(life.station)
    actors.push({type:'station', r:1500, alt:760+rnd()*160,
      w:0.011, ph:rnd()*6.28318, k:9+rnd()*4});

  /* --- other riders: real physics, powers spread around the player's FTP.
         A third are slower, a third stronger, and a third close enough that
         the lead trades hands with how the player's legs are going. --- */
  const nR=clamp(Math.round(cfg.riders||0),0,24);
  if(nR>0){
    for(let i=0;i<RIDER_KITS.length;i++){
      const kit=RIDER_KITS[i], pal={skin:hx('#c8996a'),bike:hx('#494d56'),dark:hx('#1d1f26')};
      for(const kk in kit) pal[kk]=(typeof kit[kk]==='string')?hx(kit[kk]):kit[kk];
      actorMeshes['rider'+i]=mkMesh(q=>mRider(q,pal));
    }
    actorMeshes.bike=mkMesh(q=>mRider(q,{bikeOnly:true,
      bike:hx('#494d56'),dark:hx('#1d1f26'),jersey2:hx('#dfe3e8')}));
    for(let i=0;i<nR;i++){
      /* fac is relative to the player's own rolling average power, so the
         field stays honest whatever kind of day the player is having:
         a third gently slower, a third clearly stronger, a third so close
         that the lead trades with every surge and every tired patch */
      const tier=i%3;
      const fac=tier===0?0.72+rnd()*0.14
               :tier===1?0.93+rnd()*0.14
                        :1.15+rnd()*0.25;
      actors.push({type:'rider', kit:(i%RIDER_KITS.length), mesh:'rider'+(i%RIDER_KITS.length), meta:RIDER_META,
        s:((rnd()*640-320)%lapLen+lapLen)%lapLen, v:4+rnd()*4,
        off:(rnd()<0.5?-1:1)*(0.7+rnd()*Math.max(0.4,hw-1.7)),
        fac:fac, mass:60+rnd()*32,
        varF:0.015+rnd()*0.05, ph:rnd()*6.28318,
        headYaw:0, headPitch:0, swing:0, emiss:1, k:1});
    }
  }
  if(waterY!==null&&lakeSpots.length){
    actorMeshes.fish=mkMesh(q=>mFish(q));
    const nF=Math.min(10,2+Math.floor(lakeSpots.length/5));
    for(let i=0;i<nF;i++)
      actors.push({type:'fish', tmr:rnd()*6, px:0, py:waterY-6, pz:0,
                   yaw:0, pitch:0, swing:0, emiss:1, k:0.9+rnd()*0.5});
  }

  onProgress&&onProgress(0.97);

  return {
    scene, nPts, nMain, nCut, cutLen, jnA:iA, jnB:iB, sideA, sideB,
    lapLen, rx, rz, ry, tx, tz, grade,
    meanY:mean, groundAt:groundAt, meshH:meshH, actors, actorMeshes, bases,
    water:waterMesh, waterY, lakeSpots, veg,
    glass: gb.idx.length?{pos:new Float32Array(gb.pos),nrm:new Float32Array(gb.nrm),
           col:new Float32Array(gb.col),idx:new Uint32Array(gb.idx)}:null,
    screens,
    tunnels, bridges, lavaY, inTunnel, inBridge,
    terrain:{pos:tPos,nrm:tNrm,col:tCol,idx:tIdx},
    road:{pos:rPos,nrm:rNrm,col:rCol,idx:rIdx},
    props:{pos:new Float32Array(mb.pos),nrm:new Float32Array(mb.nrm),
           col:new Float32Array(mb.col),idx:new Uint32Array(mb.idx)}
  };
}

