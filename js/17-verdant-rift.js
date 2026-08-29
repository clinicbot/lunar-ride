"use strict";

/* Verdant Rift -------------------------------------------------------------
   A deliberately separate world builder.  Existing worlds continue through
   the proven buildWorld() implementation unchanged.  Verdant gets one closed
   25 km route inspired by the user's hand-drawn double-lobed course, with no
   branches or junction choices anywhere on the lap. */

SCENES.push({
  id:'verdant',
  name:'Verdant Rift — Monsoon Grand Tour',
  art:'assets/images/verdant_rift_card.svg',
  subtitle:'25 km of changing terrain: lakes, pine forest, geothermal wetlands, jungle single-track, crystal country, a sky-port, alpine snow and a long descent. One continuous route — no junctions.',
  customWorld:'verdant',
  road:{maxGrade:8,halfWidth:3.2,lapKm:25},
  land:{amp:92,scale:580,rough:.52,craters:0,craterMax:0,rimAmp:300},
  sun:{az:2.35,el:.58,col:'#fff2cf',amb:'#3d5360'},
  col:{high:'#71905a',low:'#294f3b',road:'#3f4241',rumble:'#ded5b8',lane:'#f5e8be'},
  sky:{top:'#254f71',horizon:'#b9d6d2',fog:'#8faeaa',fogDen:.00028,stars:0,starBright:0,
       cloud:.58,cloudCol:'#eef3ec',earth:{az:5.15,el:.30,size:.034}},
  life:{bases:3,walkers:12,rovers:3,ships:7,drones:5,station:true},
  audio:{wind:.55,birds:1},
  weather:true,
  seed:9157
});

const _lrBuildWorldBeforeVerdant=buildWorld;
buildWorld=function(scene,onProgress){
  if(!scene||scene.customWorld!=='verdant') return _lrBuildWorldBeforeVerdant(scene,onProgress);
  return buildVerdantRift(scene,onProgress);
};

function buildVerdantRift(scene,onProgress){
  const rnd=mulberry32(scene.seed), n1=makeNoise(scene.seed), n2=makeNoise(scene.seed+991);
  const TARGET=25000, W=5200, HALF=2600, STEP=16, NG=Math.round(W/STEP), NV=NG+1;
  const HW0=scene.road.halfWidth||3.2;
  onProgress&&onProgress(.04);

  /* Hand-designed control polygon.  Catmull-Rom rounds it into a clean,
     non-self-intersecting two-lobed course: much closer to the supplied
     sketch than the normal radial loop generator. */
  const CP=[
    [-1.20,-.75],[-.85,-1.00],[-.35,-.98],[ .05,-.80],[ .28,-.58],
    [ .46,-.45],[ .72,-.58],[1.05,-.50],[1.18,-.18],[1.16, .22],[1.02, .58],
    [ .75, .82],[ .48, .88],[ .33, .70],[ .38, .48],[ .55, .30],[ .60, .05],
    [ .48,-.12],[ .28,-.08],[ .08, .12],[-.10, .30],[-.28, .42],[-.45, .30],
    [-.52, .08],[-.40,-.12],[-.22,-.30],[-.28,-.50],[-.52,-.62],[-.78,-.56],
    [-.95,-.35],[-1.12,-.12],[-1.30, .12],[-1.34, .40],[-1.25, .68],[-1.05, .90],
    [-.75,1.02],[-.42, .96],[-.22, .78],[-.10, .55],[ .08, .48],[ .20, .65],
    [ .10, .88],[-.12,1.05],[-.55,1.16],[-.95,1.12],[-1.25, .92],[-1.42, .62],
    [-1.46, .22],[-1.40,-.22],[-1.32,-.52]
  ];
  const cat=(p0,p1,p2,p3,t)=>{
    const t2=t*t,t3=t2*t;
    return [
      .5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
      .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
    ];
  };
  let unit=[];
  for(let i=0;i<CP.length;i++) for(let k=0;k<28;k++)
    unit.push(cat(CP[(i-1+CP.length)%CP.length],CP[i],CP[(i+1)%CP.length],CP[(i+2)%CP.length],k/28));
  unit.push(unit[0]);
  let uLen=0; for(let i=1;i<unit.length;i++) uLen+=Math.hypot(unit[i][0]-unit[i-1][0],unit[i][1]-unit[i-1][1]);
  const S=TARGET/uLen;
  const fine=unit.map(q=>[q[0]*S,q[1]*S]);
  const cum=[0]; let total=0;
  for(let i=1;i<fine.length;i++){total+=Math.hypot(fine[i][0]-fine[i-1][0],fine[i][1]-fine[i-1][1]);cum.push(total);}
  const nMain=Math.round(total/ROUTE_STEP), nPts=nMain, lapLen=nMain*ROUTE_STEP;
  const rx=new Float32Array(nPts),rz=new Float32Array(nPts),ry=new Float32Array(nPts);
  let fi=0;
  for(let i=0;i<nPts;i++){
    const d=i*ROUTE_STEP;
    while(fi<fine.length-2&&cum[fi+1]<d) fi++;
    const f=(d-cum[fi])/Math.max(cum[fi+1]-cum[fi],1e-6);
    rx[i]=lerp(fine[fi][0],fine[fi+1][0],f); rz[i]=lerp(fine[fi][1],fine[fi+1][1],f);
  }

  function bareLand(x,z){
    let h=n1(x/650,z/650)*62+n2(x/230+17,z/230-11)*22;
    const r=Math.hypot(x,z)/HALF;
    if(r>.72){const q=(r-.72)/.28; h+=q*q*185;}
    /* a dramatic mountain mass in the alpine quarter */
    const dx=x-1050,dz=z-760; h+=235*Math.exp(-(dx*dx+dz*dz)/(950*950));
    return h;
  }
  const keys=[[0,0],[.08,18],[.16,72],[.25,42],[.34,5],[.46,48],[.56,92],[.72,285],[.80,310],[.86,280],[.93,135],[1,0]];
  const profile=t=>{
    for(let k=0;k<keys.length-1;k++) if(t>=keys[k][0]&&t<=keys[k+1][0]){
      let f=(t-keys[k][0])/(keys[k+1][0]-keys[k][0]); f=smoothstep(f);
      return lerp(keys[k][1],keys[k+1][1],f);
    }
    return 0;
  };
  for(let i=0;i<nPts;i++) ry[i]=profile(i/nPts)+bareLand(rx[i],rz[i])*.16;
  /* circular smoothing, then a strict 8% slope clamp */
  for(let pass=0;pass<18;pass++){
    const old=new Float32Array(ry);
    for(let i=0;i<nPts;i++) ry[i]=(old[(i-1+nPts)%nPts]+old[i]*4+old[(i+1)%nPts])/6;
  }
  const LIM=(scene.road.maxGrade||8)/100*ROUTE_STEP;
  for(let pass=0;pass<18;pass++){
    for(let i=0;i<nPts;i++){const j=(i+1)%nPts,dh=ry[j]-ry[i];if(dh>LIM)ry[j]=ry[i]+LIM;else if(dh<-LIM)ry[j]=ry[i]-LIM;}
    for(let i=nPts-1;i>=0;i--){const j=(i-1+nPts)%nPts,dh=ry[j]-ry[i];if(dh>LIM)ry[j]=ry[i]+LIM;else if(dh<-LIM)ry[j]=ry[i]-LIM;}
  }
  const tx=new Float32Array(nPts),tz=new Float32Array(nPts),grade=new Float32Array(nPts);
  for(let i=0;i<nPts;i++){
    const j=(i+1)%nPts,dx=rx[j]-rx[i],dz=rz[j]-rz[i],l=Math.hypot(dx,dz)||1;
    tx[i]=dx/l;tz[i]=dz/l;grade[i]=(ry[j]-ry[i])/ROUTE_STEP*100;
  }
  let mean=0;for(const y of ry)mean+=y;mean/=nPts;
  onProgress&&onProgress(.16);

  /* Fixed kilometre zones make the ride deliberately change character. */
  const zOf=i=>{
    const km=(i*ROUTE_STEP/1000)%25;
    if(km<3) return 0;       // valley asphalt
    if(km<6) return 1;       // forest gravel
    if(km<9) return 2;       // geothermal boardwalk
    if(km<13) return 3;      // jungle single-track
    if(km<16) return 4;      // crystal trail
    if(km<18) return 5;      // sky-port asphalt
    if(km<21) return 6;      // alpine road
    if(km<22.5) return 7;    // summit snow
    return 8;                // descent road
  };
  const width=[3.2,2.55,2.05,1.35,1.85,3.35,2.85,2.45,3.05];
  const surf=['#3f4544','#655d4d','#805f3d','#59442d','#62594a','#353d42','#4b5050','#646867','#424746'].map(hx);
  const zoneGround=['#4c7b48','#315d3c','#536b3d','#214d31','#4d6044','#52704c','#53624d','#d7ddd8','#4c7047'].map(hx);

  /* nearest-road lookup */
  const CELL=56,buckets=new Map(),key=(a,b)=>a*100000+b;
  for(let i=0;i<nPts;i++){const k=key(Math.floor(rx[i]/CELL),Math.floor(rz[i]/CELL));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);}
  function roadNear(x,z){
    const gx=Math.floor(x/CELL),gz=Math.floor(z/CELL);let bd=1e18,bi=-1;
    for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
      const L=buckets.get(key(gx+a,gz+b));if(!L)continue;
      for(const i of L){const dx=x-rx[i],dz=z-rz[i],d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i;}}
    }
    return bi<0?null:{d:Math.sqrt(bd),i:bi};
  }

  /* terrain, with a narrower carved corridor than the road worlds */
  const hgt=new Float32Array(NV*NV),landY=new Float32Array(nPts);
  for(let i=0;i<nPts;i++)landY[i]=bareLand(rx[i],rz[i]);
  for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
    const x=-HALF+i*STEP,z=-HALF+j*STEP,nr=roadNear(x,z);let h=bareLand(x,z);
    if(nr){const w=width[zOf(nr.i)],flat=w+1.2,blend=w+28;
      if(nr.d<blend){const f=nr.d<=flat?1:1-smoothstep((nr.d-flat)/(blend-flat));h=lerp(h,ry[nr.i]-.22,f);}}
    hgt[j*NV+i]=h;
  }
  const meshH=(x,z)=>{
    const fx=clamp((x+HALF)/STEP,0,NG-.001),fz=clamp((z+HALF)/STEP,0,NG-.001);
    const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
    const a=hgt[j*NV+i],b=hgt[j*NV+i+1],c=hgt[(j+1)*NV+i],d=hgt[(j+1)*NV+i+1];
    return lerp(lerp(a,b,u),lerp(c,d,u),v);
  };
  const groundAt=meshH;
  const tPos=new Float32Array(NV*NV*3),tNrm=new Float32Array(NV*NV*3),tCol=new Float32Array(NV*NV*4);
  for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
    const k=j*NV+i,x=-HALF+i*STEP,z=-HALF+j*STEP,y=hgt[k];
    tPos[k*3]=x;tPos[k*3+1]=y;tPos[k*3+2]=z;
    const hL=hgt[j*NV+Math.max(0,i-1)],hR=hgt[j*NV+Math.min(NG,i+1)],hD=hgt[Math.max(0,j-1)*NV+i],hU=hgt[Math.min(NG,j+1)*NV+i];
    let nx=hL-hR,ny=2*STEP,nz=hD-hU,l=Math.hypot(nx,ny,nz)||1;tNrm[k*3]=nx/l;tNrm[k*3+1]=ny/l;tNrm[k*3+2]=nz/l;
    const nr=roadNear(x,z),zz=nr&&nr.d<260?zOf(nr.i):(y>210?7:(n1(x/500,z/500)>.1?1:0));
    const c=zoneGround[zz],m=.82+.18*(n2(x/38,z/38)*.5+.5);tCol[k*4]=c[0]*m;tCol[k*4+1]=c[1]*m;tCol[k*4+2]=c[2]*m;tCol[k*4+3]=0;
  }
  const tIdx=new Uint32Array(NG*NG*6);let ip=0;
  for(let j=0;j<NG;j++)for(let i=0;i<NG;i++){const a=j*NV+i,b=a+1,c=a+NV,d=c+1;tIdx[ip++]=a;tIdx[ip++]=c;tIdx[ip++]=b;tIdx[ip++]=b;tIdx[ip++]=c;tIdx[ip++]=d;}
  onProgress&&onProgress(.48);

  /* variable-width trail ribbon */
  const rm=new MeshB(),lane=hx('#f2dfaa'),edge=hx('#d7d3bd'),wood=hx('#8a6843');
  const P=(i,o,y)=>[rx[i]-tz[i]*o,ry[i]+y,rz[i]+tx[i]*o];
  for(let i=0;i<nPts;i++){
    const j=(i+1)%nPts,za=zOf(i),zb=zOf(j),wa=width[za],wb=width[zb],c=surf[za];
    rm.quad(P(i,-wa,.08),P(j,-wb,.08),P(j,wb,.08),P(i,wa,.08),c,0);
    if((za===0||za===5||za===6||za===8)&&((i/10|0)%2===0))
      rm.quad(P(i,-.09,.095),P(j,-.09,.095),P(j,.09,.095),P(i,.09,.095),lane,0);
    if(za===0||za===5||za===6||za===7||za===8){
      rm.quad(P(i,-wa-.08,.09),P(j,-wb-.08,.09),P(j,-wa+.12,.09),P(i,-wa+.12,.09),edge,0);
      rm.quad(P(i, wa-.12,.09),P(j, wb-.12,.09),P(j, wb+.08,.09),P(i, wa+.08,.09),edge,0);
    }
    if(za===2&&i%3===0){ /* boardwalk plank seams */
      const a=P(i,-wa,.105),b=P(i,wa,.105),q=P((i+1)%nPts,wa,.105),r=P((i+1)%nPts,-wa,.105);
      rm.quad(a,r,q,b,(i%6===0)?edge:wood,0);
    }
  }

  /* water / geothermal pools, all around the wetland section */
  const wm=new MeshB(),waterC=hx('#42b7bb'),lakeSpots=[];
  const wet0=Math.floor(nPts*6/25),wet1=Math.floor(nPts*9/25);
  let waterY=Infinity;
  for(let q=0;q<9;q++){
    const i=Math.floor(lerp(wet0,wet1,(q+.5)/9)),side=q%2?-1:1,off=13+q%3*8;
    const x=rx[i]-tz[i]*off*side,z=rz[i]+tx[i]*off*side,y=ry[i]-1.1; waterY=Math.min(waterY,y);
    const rad=7+(q%4)*3;
    wm.setTF(x,y,z,0,1);wm.disc(0,0,0,rad,18,waterC,.22);wm.setTF(0,0,0,0,1);lakeSpots.push([x,z]);
  }
  if(!isFinite(waterY))waterY=null;

  /* static scenery */
  const mb=new MeshB(),BIO={stem:hx('#52633b'),leaf:hx('#3d8247'),glow:hx('#93ffd0'),skin:hx('#8a7250'),dark:hx('#27372e'),accent:hx('#e16f49'),eye:hx('#fff19b')};
  const KIT={hull:hx('#d7ded8'),trim:hx('#7f918c'),dark:hx('#24302d'),glow:hx('#8efbe4'),panel:hx('#244966'),gold:hx('#d0aa58'),suit:hx('#eef2ee'),visor:hx('#d5a950'),pack:hx('#aeb9b4'),stripe:hx('#39a87a'),flame:hx('#baffef')};
  const stamp=(i,off,fn,k)=>{const side=off<0?-1:1,o=Math.abs(off),x=rx[i]-tz[i]*o*side,z=rz[i]+tx[i]*o*side,y=meshH(x,z);mb.setTF(x,y-.1,z,rnd()*6.28318,k||1);fn();mb.setTF(0,0,0,0,1);};
  /* geothermal stones and alien flora */
  for(let i=wet0;i<wet1;i+=38){stamp(i,8+(rnd()*18)*(rnd()<.5?-1:1),()=>mCrystal(mb,BIO,rnd),.65+rnd()*.5);}
  /* jungle: real geometry near the track, billboard forest farther back */
  const j0=Math.floor(nPts*9/25),j1=Math.floor(nPts*13/25);
  for(let i=j0;i<j1;i+=28){
    stamp(i,(5+rnd()*8)*(rnd()<.5?-1:1),()=>{if(GLTREES.oak)appendGLTF(mb,GLTREES.oak);else mBroad(mb,BIO,rnd);},.75+rnd()*.45);
    if(i%56===0) stamp(i,(8+rnd()*10)*(rnd()<.5?-1:1),()=>mFan(mb,BIO,rnd),1.1+rnd()*.7);
  }
  /* crystal country */
  const c0=Math.floor(nPts*13/25),c1=Math.floor(nPts*16/25);
  for(let i=c0;i<c1;i+=22) stamp(i,(7+rnd()*24)*(rnd()<.5?-1:1),()=>mCrystal(mb,BIO,rnd),.8+rnd()*.9);
  /* sky-port / settlement */
  const s0=Math.floor(nPts*16.3/25),s1=Math.floor(nPts*17.7/25),bases=[];
  for(let b=0;b<3;b++){
    const i=Math.floor(lerp(s0,s1,(b+.5)/3)),side=b%2?-1:1,off=48+b*9,x=rx[i]-tz[i]*off*side,z=rz[i]+tx[i]*off*side,y=meshH(x,z);
    bases.push({i,x,z,y,r:28,yaw:rnd()*6.28});mb.setTF(x,y-.2,z,rnd()*6.28,.75);
    mDome(mb,KIT,7);mDish(mb,KIT);mMast(mb,KIT,16);mSolarFarm(mb,KIT);mb.setTF(0,0,0,0,1);
  }
  /* alpine pines and summit crystals */
  const a0=Math.floor(nPts*18/25),a1=Math.floor(nPts*22.5/25);
  for(let i=a0;i<a1;i+=36) stamp(i,(7+rnd()*24)*(rnd()<.5?-1:1),()=>{if(GLTREES.pine)appendGLTF(mb,GLTREES.pine);else mPine(mb,BIO,rnd);},.7+rnd()*.55);
  onProgress&&onProgress(.67);

  /* dense vegetation billboard field */
  const ctr=[],dat=[],uv=[],vidx=[];
  const plant=(x,z,y,size,kind,bias)=>{const b=ctr.length/3,u0=kind/6,u1=u0+1/6,rv=clamp(bias+(rnd()-.5)*.4,0,.999);
    for(const q of [[-1,0,u0,1],[1,0,u1,1],[1,1,u1,0],[-1,1,u0,0]]){ctr.push(x,y,z);dat.push(q[0],q[1],size,rv);uv.push(q[2],q[3]);}
    vidx.push(b,b+1,b+2,b,b+2,b+3);
  };
  const count=26000;
  for(let k=0;k<count;k++){
    const i=(rnd()*nPts)|0,z=zOf(i),side=rnd()<.5?-1:1;
    let maxD=z===3?135:(z===1||z===6?180:80),off=width[z]+2+Math.pow(rnd(),1.55)*maxD;
    const x=rx[i]-tz[i]*off*side,zz=rz[i]+tx[i]*off*side,y=meshH(x,zz);
    let kind=0,size=.5+rnd()*.5,bias=.45;
    if(z===1||z===6||z===7){if(rnd()<.64){kind=3;size=4.5+rnd()*3.2;}else if(rnd()<.5){kind=2;size=5+rnd()*3;}}
    else if(z===3){if(rnd()<.58){kind=2;size=5.5+rnd()*3.8;}else if(rnd()<.35){kind=1;size=1.2+rnd()*1.5;}bias=.25+rnd()*.4;}
    else if(z===2){kind=rnd()<.55?0:1;size=kind?1.1+rnd()*1.3:.45+rnd()*.55;bias=.75;}
    else if(z===4){kind=rnd()<.3?1:0;bias=.65;}
    plant(x,zz,y+.02,size,kind,bias);
  }
  const veg={ctr:new Float32Array(ctr),dat:new Float32Array(dat),uv:new Float32Array(uv),idx:new Uint32Array(vidx),count:vidx.length,tintA:hx('#2e733e'),tintB:hx('#b4a849')};

  /* animated / visible life ------------------------------------------------ */
  const mkMesh=fn=>{const q=new MeshB();fn(q);return{pos:new Float32Array(q.pos),nrm:new Float32Array(q.nrm),col:new Float32Array(q.col),limb:new Float32Array(q.limb),idx:new Uint32Array(q.idx)};};
  const bearMesh=mkMesh(q=>{const C=hx('#4e3c2e'),D=hx('#2a211b');q.sph(0,.8,0,.75,10,6,C,0,false,.72);q.sph(0,1.28,.58,.44,10,6,C);q.sph(-.29,1.55,.62,.14,8,4,D);q.sph(.29,1.55,.62,.14,8,4,D);for(const x of [-.45,.45])for(const z of [-.35,.35])q.cyl(x,.05,z,.15,.7,7,D,0,'y');});
  const frogMesh=mkMesh(q=>{const G=hx('#4f9a45'),L=hx('#8ad562'),E=hx('#111811');q.sph(0,.22,0,.40,10,5,G,0,false,.55);q.sph(-.22,.48,.20,.15,8,4,L);q.sph(.22,.48,.20,.15,8,4,L);q.sph(-.22,.53,.30,.055,7,4,E);q.sph(.22,.53,.30,.055,7,4,E);q.box(-.42,.03,-.05,.42,.09,.18,G);q.box(.42,.03,-.05,.42,.09,.18,G);});
  const monkeyMesh=mkMesh(q=>{const B=hx('#6c5135'),F=hx('#b99068'),D=hx('#2c2119');q.sph(0,.78,0,.30,9,5,B);q.sph(0,1.16,.07,.27,9,5,F);q.sph(0,1.18,.24,.15,8,4,F);q.cyl(-.34,.52,0,.08,.8,7,B,0,'x');q.cyl(.34,.52,0,.08,.8,7,B,0,'x');q.cyl(-.17,.05,0,.08,.62,7,D);q.cyl(.17,.05,0,.08,.62,7,D);q.cyl(.24,.58,-.15,.055,1.05,8,B,0,'z');});
  const insectMesh=mkMesh(q=>{const D=hx('#20251d'),G=hx('#72ffd1');q.sph(0,.08,0,.08,7,4,D);q.quad([-0.22,.10,0],[0,.07,0],[0,.07,.28],[-.22,.10,.18],G,.65);q.quad([.22,.10,0],[0,.07,0],[0,.07,.28],[.22,.10,.18],G,.65);});
  const actorMeshes={astro:mkMesh(q=>mAstro(q,KIT)),rover:mkMesh(q=>mRover(q,KIT)),shuttle:mkMesh(q=>mShuttle(q,KIT)),drone:mkMesh(q=>mDrone(q,KIT)),bear:bearMesh,frog:frogMesh,monkey:monkeyMesh,insect:insectMesh};
  const actors=[];
  const putStatic=(type,km,off,k,yadd)=>{const i=Math.floor((km/25)*nPts),side=off<0?-1:1,o=Math.abs(off),x=rx[i]-tz[i]*o*side,z=rz[i]+tx[i]*o*side;actors.push({type,px:x,py:meshH(x,z)+(yadd||0),pz:z,yaw:rnd()*6.28,k:k||1,emiss:1});};
  /* bears in forest/alpine */
  [4.0,5.2,18.7,20.2].forEach((km,j)=>putStatic('bear',km,j%2?18:-22,1.25+rnd()*.25,0));
  /* frogs around geothermal pools */
  for(let j=0;j<12;j++)putStatic('frog',6.2+j*.20,(j%2?1:-1)*(5+rnd()*6),1.2+rnd()*.35,0);
  /* monkeys hang / sit visibly above the jungle floor */
  for(let j=0;j<14;j++)putStatic('monkey',9.2+j*.24,(j%2?1:-1)*(7+rnd()*10),1.0+rnd()*.3,3.5+rnd()*4.5);
  /* glowing insect clouds */
  for(let j=0;j<36;j++)putStatic('insect',7+j*.22,(j%2?1:-1)*(4+rnd()*14),.8+rnd()*.5,1+rnd()*3);
  /* birds use the existing glTF bird family when available */
  for(let j=0;j<22;j++){
    const km=.8+j*1.05,i=Math.floor(km/25*nPts),BK=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready),g=BK.length?BK[j%BK.length]:'bird';
    actors.push({type:'gbird',gcre:g,cx:rx[i],cz:rz[i],R:28+rnd()*45,circ:rnd()*6.28,w:(j%2?1:-1)*(.07+rnd()*.08),baseY:ry[i]+10+rnd()*18,px:rx[i],py:ry[i]+12,pz:rz[i],yaw:0,flap:true,flapT:1+rnd()*2,gph:rnd()*6.28,emiss:1,k:.9+rnd()*.5});
  }
  /* lots of sky traffic */
  for(let j=0;j<9;j++){const a=rnd()*6.28;actors.push({type:'shuttle',dx:Math.cos(a),dz:Math.sin(a),sx:(rnd()*2-1)*600,sz:(rnd()*2-1)*600,ph:rnd()*6.28,spd:45+rnd()*70,alt:120+rnd()*330,len:5200,s0:rnd()*5200,k:1.4+rnd()*.8});}
  for(let j=0;j<6;j++){const i=(rnd()*nPts)|0;actors.push({type:'drone',cx:rx[i],cz:rz[i],gy:ry[i],r:25+rnd()*70,alt:15+rnd()*45,ph:rnd()*6.28,w:(j%2?1:-1)*(.10+rnd()*.14),px:rx[i],py:ry[i]+30,pz:rz[i],yaw:0,k:1.4});}
  /* walkers near the port */
  for(let j=0;j<10;j++){const i=s0+(rnd()*(s1-s0)|0),side=j%2?-1:1,o=9+rnd()*20,x=rx[i]-tz[i]*o*side,z=rz[i]+tx[i]*o*side;actors.push({type:'astro',cx:x,cz:z,r:2+rnd()*6,w:(j%2?1:-1)*.07,ph:rnd()*6.28,walk:true,px:x,py:meshH(x,z),pz:z,yaw:0,k:1});}

  /* companion cyclists */
  const nR=clamp(Math.round(cfg.riders||0),0,24);
  if(nR){
    for(let i=0;i<RIDER_KITS.length;i++){const kit=RIDER_KITS[i],pal={skin:hx('#c8996a'),bike:hx('#494d56'),dark:hx('#1d1f26')};for(const k in kit)pal[k]=typeof kit[k]==='string'?hx(kit[k]):kit[k];actorMeshes['rider'+i]=mkMesh(q=>mRider(q,pal));}
    actorMeshes.bike=mkMesh(q=>mRider(q,{bikeOnly:true,bike:hx('#494d56'),dark:hx('#1d1f26'),jersey2:hx('#dfe3e8')}));
    for(let i=0;i<nR;i++)actors.push({type:'rider',kit:i%RIDER_KITS.length,mesh:'rider'+(i%RIDER_KITS.length),meta:RIDER_META,s:rnd()*lapLen,v:4+rnd()*4,laneAbs:Math.min(1.0,width[zOf(0)]*.30),fac:.78+rnd()*.5,mass:60+rnd()*30,varF:.02+rnd()*.04,ph:rnd()*6.28,headYaw:0,headPitch:0,swing:0,emiss:1,k:1});
  }

  const inTunnel=new Uint8Array(nPts),inBridge=new Uint8Array(nPts);
  onProgress&&onProgress(.96);
  const emptyGlass=null,screens=[];
  const roadMesh={pos:new Float32Array(rm.pos),nrm:new Float32Array(rm.nrm),col:new Float32Array(rm.col),idx:new Uint32Array(rm.idx)};
  const propMesh={pos:new Float32Array(mb.pos),nrm:new Float32Array(mb.nrm),col:new Float32Array(mb.col),idx:new Uint32Array(mb.idx)};
  const waterMesh=wm.idx.length?{pos:new Float32Array(wm.pos),nrm:new Float32Array(wm.nrm),col:new Float32Array(wm.col),idx:new Uint32Array(wm.idx)}:null;
  onProgress&&onProgress(1);
  return {
    scene,nPts,nMain,nCut:0,cutLen:0,jnA:0,jnB:0,sideA:'right',sideB:'right',lapLen,rx,rz,ry,tx,tz,grade,meanY:mean,
    _dbg:{roadNear,landAt:bareLand,landY,carve:()=>0,troughAt:()=>null,troughs:[],tunEnd:()=>false},
    groundAt,meshH,actors,actorMeshes,bases,water:waterMesh,waterY,lakeSpots,veg,glass:emptyGlass,screens,
    tunnels:[],bridges:[],lavaY:null,inTunnel,inBridge,
    terrain:{pos:tPos,nrm:tNrm,col:tCol,idx:tIdx},road:roadMesh,props:propMesh,
    verdant:{zoneAt:zOf,widthAt:i=>width[zOf(i)],surfaceAt:zOf}
  };
}
