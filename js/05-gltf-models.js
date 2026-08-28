"use strict";

/* ==========================================================================
   The glTF rider: 'assets/models/rigged_cyclist.gltf' is parsed, its skeleton is posed by
   the same two-bone IK that drives the pedals, and 32 frames of the pedal
   stroke are baked to static meshes. If the file is missing or broken the
   procedural riders carry on unchanged. */
const GLTFR={ready:false,N:32,pos:[],nrm:[],col:[],limbB:null,idxB:null,count:0};
async function loadGLTFRider(){
  /* prefer his pro rider when the file exists; the old model is the fallback */
  let gjPro=null;
  try{
    const r=await fetch('assets/models/rider_pro.gltf');
    if(r.ok){ const j=await r.json(); if(j&&j.skins&&j.skins.length) gjPro=j; }
  }catch(e){}
  try{
    const PRO=!!gjPro;
    const gj=PRO?gjPro:await (await fetch('assets/models/rigged_cyclist.gltf')).json();
    const uri=gj.buffers[0].uri;
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const acc=i=>{
      const a=gj.accessors[i], bv=gj.bufferViews[a.bufferView];
      return new CT[a.componentType](bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);
    };
    const IBM=acc(gj.skins[0].inverseBindMatrices);
    const joints=gj.skins[0].joints;
    const byName={}; gj.nodes.forEach((n,i)=>byName[n.name]=i);
    const parent={}; gj.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
    let P2,N2,J2,W2,I2,HPOS,HNRM,HIDX,matOf=null;
    const faceCol={};
    if(PRO){
      /* every primitive carries a real material; no synthetic face needed */
      P2=[];N2=[];J2=[];W2=[];I2=[];matOf=[];
      for(const mesh of gj.meshes) for(const pr of mesh.primitives){
        const base=P2.length/3;
        const POSp=acc(pr.attributes.POSITION), NRMp=acc(pr.attributes.NORMAL);
        const Jp=acc(pr.attributes.JOINTS_0), Wp=acc(pr.attributes.WEIGHTS_0);
        const Ip=acc(pr.indices);
        for(let v=0;v<POSp.length;v++){ P2.push(POSp[v]); N2.push(NRMp[v]); }
        for(let v=0;v<Jp.length;v++){ J2.push(Jp[v]); W2.push(Wp[v]); }
        const mt=gj.materials[pr.material]||{};
        const mc=((mt.pbrMetallicRoughness||{}).baseColorFactor)||[0.6,0.6,0.6,1];
        const nverts=POSp.length/3;
        for(let v=0;v<nverts;v++) matOf.push({n:mt.name||'',c:mc});
        for(let v=0;v<Ip.length;v++) I2.push(base+Ip[v]);
      }
      HPOS=new Float32Array(0); HNRM=HPOS; HIDX=new Uint32Array(0);
    }else{
    const prim=gj.meshes[0].primitives[0];
    const POS=acc(prim.attributes.POSITION), NRM=acc(prim.attributes.NORMAL);
    const JNT=acc(prim.attributes.JOINTS_0), WGT=acc(prim.attributes.WEIGHTS_0);
    const IDX=acc(prim.indices);
    const hprim=gj.meshes[2].primitives[0];
    HPOS=acc(hprim.attributes.POSITION); HNRM=acc(hprim.attributes.NORMAL); HIDX=acc(hprim.indices);
    /* ---- the face the model never had: eyes, brows, nose, mouth as real
       geometry, weighted 100% to the Head bone so it skins with the head ---- */
    P2=Array.from(POS); N2=Array.from(NRM);
    J2=Array.from(JNT); W2=Array.from(WGT); I2=Array.from(IDX);
    const headK=gj.skins[0].joints.indexOf(byName.Head);
    const addEll=(cx,cy,cz,rx2,ry2,rz2,col)=>{
      const lon=6,lat=4,base=P2.length/3;
      for(let la=0;la<=lat;la++){
        const th=la/lat*Math.PI;
        for(let lo=0;lo<=lon;lo++){
          const ph2=lo/lon*6.283185;
          const nx=Math.sin(th)*Math.cos(ph2),ny=Math.cos(th),nz=Math.sin(th)*Math.sin(ph2);
          P2.push(cx+nx*rx2,cy+ny*ry2,cz+nz*rz2);
          const l2=Math.hypot(nx/rx2,ny/ry2,nz/rz2)||1;
          N2.push((nx/rx2)/l2,(ny/ry2)/l2,(nz/rz2)/l2);
          J2.push(headK,0,0,0); W2.push(1,0,0,0);
          if(col) faceCol[P2.length/3-1]=col;
        }
      }
      for(let la=0;la<lat;la++)for(let lo=0;lo<lon;lo++){
        const a2=base+la*(lon+1)+lo,b2=a2+lon+1;
        I2.push(a2,b2,a2+1, a2+1,b2,b2+1);
      }
    };
    const WHITE=[0.93,0.93,0.90],IRIS=[0.16,0.11,0.08],
          BROW=[0.24,0.16,0.09],LIP=[0.58,0.32,0.24];
    for(const sd of [-1,1]){
      addEll(sd*0.052,1.965,0.452,0.026,0.019,0.018,WHITE);  /* eye white */
      addEll(sd*0.052,1.965,0.468,0.012,0.011,0.008,IRIS);   /* iris */
      addEll(sd*0.056,2.008,0.448,0.034,0.008,0.013,BROW);   /* brow */
    }
    addEll(0,1.930,0.475,0.020,0.031,0.023,null);            /* nose, skin tone */
    addEll(0,1.885,0.460,0.030,0.0065,0.011,LIP);            /* mouth */
    }
    const NB=P2.length/3, NH=HPOS.length/3, NV=NB+NH;

    /* planar helpers: angle 0 = straight down, positive = toward +z */
    const angOf=(y,z)=>Math.atan2(z,-y);
    const yz=n=>{const t=gj.nodes[byName[n]].translation;return [t[1],t[2]];};
    const len2=v=>Math.hypot(v[0],v[1]);
    const two=(A1,A2,aB1,aB2,dy,dz,fwd)=>{      /* two-bone solve, returns local angles */
      let d=Math.hypot(dy,dz);
      const mx=A1+A2-0.006, mn=Math.abs(A1-A2)+0.006;
      if(d>mx){dy*=mx/d;dz*=mx/d;d=mx;} if(d<mn){dy*=mn/d;dz*=mn/d;d=mn;}
      const phi=angOf(dy,dz);
      const al=Math.acos(Math.max(-1,Math.min(1,(A1*A1+d*d-A2*A2)/(2*A1*d))));
      const d1=fwd?phi+al:phi-al;
      const th1=aB1-d1;
      const ky=-Math.cos(d1)*A1, kz=Math.sin(d1)*A1;
      const d2=angOf(dy-ky,dz-kz);
      const th2=(aB2-d2)-th1;
      return [th1,th2];
    };
    const rot={};                               /* extra rotation about x per node */
    for(const n of gj.nodes) rot[n.name]=0;
    if(PRO){
      /* the pro model is anatomically continuous: gentler angles keep the
         neck attached and the jersey smooth */
      rot.Pelvis=0.07; rot.Spine=0.30; rot.Chest=0.20; rot.Neck=-0.32; rot.Head=-0.15;
    }else{
      rot.Pelvis=0.10; rot.Spine=0.55; rot.Chest=0.38; rot.Neck=-0.60; rot.Head=-0.30;
    }
    const PELVIS=[0,0.93,-0.20];
    const world=()=>{                           /* pose pass: cum angle + position */
      const W={};
      const go=(i,cum,px,py,pz)=>{
        const n=gj.nodes[i], t=n.translation||[0,0,0];
        const c=Math.cos(cum),s2=Math.sin(cum);
        let x,y,z;
        if(n.name==='Pelvis'){x=PELVIS[0];y=PELVIS[1];z=PELVIS[2];}
        else{x=px+t[0];y=py+c*t[1]-s2*t[2];z=pz+s2*t[1]+c*t[2];}
        const cum2=cum+(rot[n.name]||0);
        W[n.name]={x,y,z,cum:cum2};
        for(const ch of (n.children||[])) go(ch,cum2,x,y,z);
      };
      go(byName.Pelvis,0,0,0,0);
      return W;
    };
    /* arms: bent numerically until each wrist lands on the handlebars.
       This works whatever the model's rest pose or sign conventions are. */
    {
      const HB={y:0.95,z:0.50};
      const wristErr=(sd)=>{
        const Wq=world(), Wp=Wq['Wrist_'+sd];
        const dy=Wp.y-HB.y, dz=Wp.z-HB.z;
        return dy*dy+dz*dz;
      };
      for(const sd of ['L','R']){
        rot['Shoulder_'+sd]=0; rot['Elbow_'+sd]=0.3;
        for(let it=0;it<40;it++){
          for(const jn of ['Shoulder_'+sd,'Elbow_'+sd]){
            const h=0.05;
            rot[jn]+=h; const e1=wristErr(sd);
            rot[jn]-=2*h; const e2=wristErr(sd);
            rot[jn]+=h;
            const g=(e1-e2)/(2*h);
            rot[jn]-=clamp(g*2.0,-0.2,0.2);
          }
        }
      }
    }
    /* bake each crank angle */
    const m4=(a,b)=>{const o=new Float32Array(16);
      for(let c2=0;c2<4;c2++)for(let r=0;r<4;r++){let v=0;
        for(let k=0;k<4;k++)v+=a[k*4+r]*b[c2*4+k]; o[c2*4+r]=v;} return o;};
    const idxAll=new Uint32Array(I2.length+HIDX.length);
    idxAll.set(I2,0);
    for(let i=0;i<HIDX.length;i++) idxAll[I2.length+i]=HIDX[i]+NB;
    const limb=new Float32Array(NV);
    const JMAP={Neck:5,Head:5,Shoulder_R:6,Elbow_R:6,Wrist_R:6};
    const domJoint=new Array(NB);
    for(let v=0;v<NB;v++){
      let bi=0,bw=-1;
      for(let k=0;k<4;k++) if(W2[v*4+k]>bw){bw=W2[v*4+k];bi=J2[v*4+k];}
      const nm=gj.nodes[joints[bi]].name;
      domJoint[v]=nm;
      limb[v]=JMAP[nm]||0;
    }
    for(let v=0;v<NH;v++) limb[NB+v]=5;
    for(let f=0;f<GLTFR.N;f++){
      const a2=f/GLTFR.N*6.283185;
      const W0=world();                          /* hips before legs move */
      for(const [sd,ph] of [['L',0],['R',Math.PI]]){
        const H=W0['Hip_'+sd];
        const k2=yz('Knee_'+sd), an=yz('Ankle_'+sd);
        const ty=0.28-0.195*Math.cos(a2+ph)+0.06, tz2=-0.04+0.195*Math.sin(a2+ph);
        const [t1,t2]=two(len2(k2),len2(an),angOf(k2[0],k2[1]),angOf(an[0],an[1]),
                          ty-H.y, tz2-H.z, true);
        rot['Hip_'+sd]=t1-H.cum; rot['Knee_'+sd]=t2;
        rot['Ankle_'+sd]=-0.7*(t1-H.cum+t2);
      }
      const W=world();
      const JM=joints.map((ji,k)=>{
        const w2=W[gj.nodes[ji].name];
        const c=Math.cos(w2.cum),s2=Math.sin(w2.cum);
        const WM=new Float32Array([1,0,0,0, 0,c,s2,0, 0,-s2,c,0, w2.x,w2.y,w2.z,1]);
        return m4(WM,IBM.subarray(k*16,k*16+16));
      });
      const fp=new Float32Array(NV*3), fn=new Float32Array(NV*3);
      for(let v=0;v<NB;v++){
        const px2=P2[v*3],py2=P2[v*3+1],pz2=P2[v*3+2];
        const nx=N2[v*3],ny=N2[v*3+1],nz=N2[v*3+2];
        let ox=0,oy=0,oz=0,mx2=0,my=0,mz=0;
        for(let k=0;k<4;k++){
          const w2=W2[v*4+k]; if(w2<1e-4) continue;
          const M=JM[J2[v*4+k]];
          ox+=w2*(M[0]*px2+M[4]*py2+M[8]*pz2+M[12]);
          oy+=w2*(M[1]*px2+M[5]*py2+M[9]*pz2+M[13]);
          oz+=w2*(M[2]*px2+M[6]*py2+M[10]*pz2+M[14]);
          mx2+=w2*(M[0]*nx+M[4]*ny+M[8]*nz);
          my+=w2*(M[1]*nx+M[5]*ny+M[9]*nz);
          mz+=w2*(M[2]*nx+M[6]*ny+M[10]*nz);
        }
        fp[v*3]=ox;fp[v*3+1]=oy;fp[v*3+2]=oz;
        const l2=Math.hypot(mx2,my,mz)||1;
        fn[v*3]=mx2/l2;fn[v*3+1]=my/l2;fn[v*3+2]=mz/l2;
      }
      const HW=W.Head, hc=Math.cos(HW.cum), hs=Math.sin(HW.cum);
      for(let v=0;v<NH;v++){
        const px2=HPOS[v*3],py2=HPOS[v*3+1],pz2=HPOS[v*3+2];
        fp[(NB+v)*3]  =HW.x+px2;
        fp[(NB+v)*3+1]=HW.y+hc*py2-hs*pz2;
        fp[(NB+v)*3+2]=HW.z+hs*py2+hc*pz2;
        const nx=HNRM[v*3],ny=HNRM[v*3+1],nz=HNRM[v*3+2];
        fn[(NB+v)*3]=nx; fn[(NB+v)*3+1]=hc*ny-hs*nz; fn[(NB+v)*3+2]=hs*ny+hc*nz;
      }
      const mk=d2=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
        gl.bufferData(gl.ARRAY_BUFFER,d2,gl.STATIC_DRAW);return b;};
      GLTFR.pos.push(mk(fp)); GLTFR.nrm.push(mk(fn));
    }
    /* kit colours: joint region decides jersey / bib / skin / shoes */
    for(let i=0;i<RIDER_KITS.length;i++){
      const kit=RIDER_KITS[i];
      const C={skin:hx('#c8996a'),dark:hx('#1d1f26'),
               jersey:hx(kit.jersey),jersey2:hx(kit.jersey2),helmet:hx(kit.helmet)};
      const REG={Pelvis:'dark',Hip_L:'dark',Hip_R:'dark',Spine:'jersey',Chest:'jersey',
                 Shoulder_L:'jersey',Shoulder_R:'jersey',Elbow_L:'jersey',Elbow_R:'jersey',
                 Wrist_L:'skin',Wrist_R:'skin',Neck:'skin',Head:'skin',
                 Knee_L:'skin',Knee_R:'skin',Ankle_L:'jersey2',Ankle_R:'jersey2'};
      const col=new Float32Array(NV*4);
      for(let v=0;v<NB;v++){
        let c;
        if(matOf){
          const m=matOf[v];
          c= m.n==='jersey'?C.jersey
           : m.n==='helmet'?C.helmet
           : m.n==='shorts'?C.dark
           : m.n==='skin'?C.skin
           : m.n==='shoe'?C.jersey2
           : m.n==='glove'?C.dark
           : m.c;
        } else c=faceCol[v]||C[REG[domJoint[v]]||'jersey'];
        col[v*4]=c[0];col[v*4+1]=c[1];col[v*4+2]=c[2];col[v*4+3]=0;
      }
      for(let v=0;v<NH;v++){
        col[(NB+v)*4]=C.helmet[0];col[(NB+v)*4+1]=C.helmet[1];
        col[(NB+v)*4+2]=C.helmet[2];col[(NB+v)*4+3]=0;
      }
      const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,col,gl.STATIC_DRAW);
      GLTFR.col.push(b);
    }
    let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,limb,gl.STATIC_DRAW); GLTFR.limbB=b;
    b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idxAll,gl.STATIC_DRAW); GLTFR.idxB=b;
    GLTFR.count=idxAll.length;
    GLTFR.ready=true;
    console.log('glTF rider baked:',GLTFR.N,'frames,',NV,'verts');
    updBuildTag();
  }catch(e){ console.warn('glTF rider unavailable:',e.message); }
}
function gltfFrameMesh(a){
  const N=GLTFR.N;
  const fi=((Math.round(((a.crank||0)%6.283185)/6.283185*N)%N)+N)%N;
  return {pos:GLTFR.pos[fi],nrm:GLTFR.nrm[fi],col:GLTFR.col[a.kit||0],
          limb:GLTFR.limbB,idx:GLTFR.idxB,count:GLTFR.count};
}

/* static glTF models — his AI-generated trees. Parsed once at start-up,
   then stamped into the props mesh wherever the flora system wants a tree.
   If a file is missing the old procedural trees fill in. */
const GLTREES={oak:null,pine:null};
async function loadGLTFStatic(key,file,norm){
  try{
    const gj=await (await fetch(file)).json();
    const uri=gj.buffers[0].uri;
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
    const acc=i=>{
      const a=gj.accessors[i], bv=gj.bufferViews[a.bufferView];
      return new CT[a.componentType](bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);
    };
    const prims=[];
    for(const mesh of gj.meshes) for(const pr of mesh.primitives){
      const col=(gj.materials[pr.material]||{}).pbrMetallicRoughness||{};
      const c=col.baseColorFactor||[0.5,0.5,0.5,1];
      const em2=((gj.materials[pr.material]||{}).name||'').indexOf('glow')===0?1.1:0.02;
      prims.push({pos:acc(pr.attributes.POSITION),idx:acc(pr.indices),col:[c[0],c[1],c[2]],em:em2});
    }
    GLTREES[key]={prims,norm:norm||1};
    console.log('glTF model ready:',file);
  }catch(e){ console.warn('glTF model unavailable:',file,e.message); }
}
function appendGLTF(mb,model){
  const f=model.norm;
  for(const pr of model.prims){
    const P=pr.pos, I=pr.idx, c=pr.col;
    for(let t=0;t<I.length;t+=3){
      const i0=I[t]*3,i1=I[t+1]*3,i2=I[t+2]*3;
      const A=mb.P(P[i0]*f,P[i0+1]*f,P[i0+2]*f);
      const B=mb.P(P[i1]*f,P[i1+1]*f,P[i1+2]*f);
      const C=mb.P(P[i2]*f,P[i2+1]*f,P[i2+2]*f);
      mb.tri(A,B,C,c,pr.em||0.02);
    }
  }
}

/* his glTF bikes: static models carved into frame / front wheel / rear
   wheel / crank by geometry, so the shader can spin the moving parts.
   Companion riders are dealt bikes from this pool at random. */
const GLBIKES={}, BIKE_KEYS=[];
async function loadGLTFBike(key,file,fit){
  try{
    const gj=await (await fetch(file)).json();
    const uri=gj.buffers[0].uri;
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
    const acc=i=>{
      const a=gj.accessors[i], bv=gj.bufferViews[a.bufferView];
      return new CT[a.componentType](bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);
    };
    const prims=[];
    for(const mesh of gj.meshes) for(const pr of mesh.primitives){
      const mat=gj.materials[pr.material]||{};
      const c=(mat.pbrMetallicRoughness||{}).baseColorFactor||[0.5,0.5,0.5,1];
      const name=(mat.name||'').toLowerCase();
      const P=acc(pr.attributes.POSITION);
      const N=pr.attributes.NORMAL!==undefined?acc(pr.attributes.NORMAL):null;
      const I=acc(pr.indices);
      const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
      for(let v=0;v<P.length;v+=3) for(let k2=0;k2<3;k2++){
        if(P[v+k2]<mn[k2])mn[k2]=P[v+k2];
        if(P[v+k2]>mx[k2])mx[k2]=P[v+k2];
      }
      let forceL=-1;
      if(name.indexOf('wheel_front')===0) forceL=9;
      else if(name.indexOf('wheel_rear')===0) forceL=8;
      else if(name.indexOf('crank')===0) forceL=7;
      prims.push({P,N,I,col:[c[0],c[1],c[2]],name,mn,mx,forceL,
        em:name.indexOf('glow')===0?1.1:(name.indexOf('accent')===0?0.55:0)});
    }
    /* models that follow the naming contract declare their own parts;
       otherwise, the two big round things are the wheels */
    const named=l=>prims.find(p2=>p2.forceL===l);
    const wheels=prims.filter(p=>{
      const h=p.mx[1]-p.mn[1], d=p.mx[2]-p.mn[2];
      return h>0.4&&Math.abs(h-d)<0.25*h;
    }).sort((a2,b2)=>((b2.mx[1]-b2.mn[1])-(a2.mx[1]-a2.mn[1]))).slice(0,2);
    const wf=named(9)||wheels.find(p=>(p.mn[2]+p.mx[2])>0),
          wr=named(8)||wheels.find(p=>(p.mn[2]+p.mx[2])<=0);
    if(!wf||!wr) throw new Error('could not find two wheels');
    const fy=(wf.mn[1]+wf.mx[1])/2, fz=(wf.mn[2]+wf.mx[2])/2;
    const ryy=(wr.mn[1]+wr.mx[1])/2, rz2=(wr.mn[2]+wr.mx[2])/2;
    const wR=(wf.mx[1]-wf.mn[1])/2;
    const STATIC=/fork|stanchion|frame|grip|seat|bar|stem|lever|cable/;
    const inWheel=(p,wy,wz)=>{
      if(STATIC.test(p.name)) return false;
      const R=wR*1.16;
      for(const yy of [p.mn[1],p.mx[1]]) for(const zz of [p.mn[2],p.mx[2]])
        if((yy-wy)*(yy-wy)+(zz-wz)*(zz-wz)>R*R) return false;
      return true;
    };
    /* the crank: named, or the widest low thing near the bottom bracket */
    let crank=named(7);
    if(!crank) for(const p of prims){
      if(STATIC.test(p.name)) continue;
      const w2=p.mx[0]-p.mn[0], zc=(p.mn[2]+p.mx[2])/2, yc=(p.mn[1]+p.mx[1])/2;
      if(w2>0.34&&yc<0.55&&zc>-0.3&&zc<0.15
         &&(!crank||w2>crank.mx[0]-crank.mn[0])) crank=p;
    }
    const cy=crank?(crank.mn[1]+crank.mx[1])/2:0.28;
    const cz=crank?(crank.mn[2]+crank.mx[2])/2:-0.02;
    const sc=(fit&&fit.scale)||1, dz=(fit&&fit.dz)||0;
    const pos=[],nrm=[],col=[],limb=[],idx=[];
    for(const p of prims){
      const L=p.forceL>=0?p.forceL
             :(p===crank?7:(inWheel(p,fy,fz)?9:(inWheel(p,ryy,rz2)?8:0)));
      const base=pos.length/3;
      for(let v=0;v<p.P.length;v+=3){
        pos.push(p.P[v]*sc,p.P[v+1]*sc,p.P[v+2]*sc+dz);
        if(p.N) nrm.push(p.N[v],p.N[v+1],p.N[v+2]); else nrm.push(0,1,0);
        col.push(p.col[0],p.col[1],p.col[2],p.em);
        limb.push(L);
      }
      for(let t=0;t<p.I.length;t++) idx.push(base+p.I[t]);
    }
    /* pedal phase: legs assume the pedal starts at the bottom; a crank
       modeled with horizontal arms starts a quarter turn ahead */
    const cph=crank&&((crank.mx[2]-crank.mn[2])>(crank.mx[1]-crank.mn[1])*1.15)?Math.PI/2:0;
    GLBIKES[key]={mesh:{pos:new Float32Array(pos),nrm:new Float32Array(nrm),
        col:new Float32Array(col),limb:new Float32Array(limb),idx:new Uint32Array(idx)},
      piv:{f:[fz*sc+dz,fy*sc],r:[rz2*sc+dz,ryy*sc],c:[cz*sc+dz,cy*sc]},
      phase:cph, gpu:null, ready:true};
    BIKE_KEYS.push(key);
    console.log('glTF bike ready:',file,'tris:',idx.length/3,
      'pivots F/R/C:',GLBIKES[key].piv.f,GLBIKES[key].piv.r,GLBIKES[key].piv.c);
  }catch(e){ console.warn('glTF bike unavailable:',file,e.message); }
}

/* his glTF creatures: one baker for all of them. Rigged models are posed
   per frame (walk cycle, wing flap) and baked to static meshes; unrigged
   ones become a single frame. Glow-named materials become emissive. */
const GLCRE={};
function updBuildTag(){
  const el=document.getElementById('buildTag'); if(!el) return;
  const st=(o)=>o&&o.ready?'ok':'--';
  el.textContent='v'+APP_STAMP+' - rider '+(GLTFR.ready?'ok':'--')
    +' - stag '+st(GLCRE.stag)+' - jelly '+st(GLCRE.jelly)+' - bird '+st(GLCRE.bird)
    +' - gull '+st(GLCRE.bird2)+' - cat '+st(GLCRE.cat)+' - dfly '+st(GLCRE.dfly);
}
async function loadGLTFCreature(key,file,opts){
  try{
    const gj=await (await fetch(file)).json();
    const uri=gj.buffers[0].uri;
    const bin=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
    const CT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const acc=i=>{
      const a=gj.accessors[i], bv=gj.bufferViews[a.bufferView];
      return new CT[a.componentType](bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*NC[a.type]);
    };
    /* gather every primitive: verts, colour (+glow), skin data */
    const P=[],Nn=[],J=[],W=[],I=[],CV=[];
    for(const mesh of gj.meshes) for(const pr of mesh.primitives){
      const base=P.length/3;
      const pos=acc(pr.attributes.POSITION), nrm=acc(pr.attributes.NORMAL);
      const jj=pr.attributes.JOINTS_0!==undefined?acc(pr.attributes.JOINTS_0):null;
      const ww=jj?acc(pr.attributes.WEIGHTS_0):null;
      const mat=gj.materials[pr.material]||{};
      const c=(mat.pbrMetallicRoughness||{}).baseColorFactor||[0.6,0.6,0.6,1];
      const em=(mat.name||'').indexOf('glow')===0?1.5:0.02;
      const nvp=pos.length/3;
      for(let v=0;v<nvp;v++){
        P.push(pos[v*3],pos[v*3+1],pos[v*3+2]);
        Nn.push(nrm[v*3],nrm[v*3+1],nrm[v*3+2]);
        if(jj){J.push(jj[v*4],jj[v*4+1],jj[v*4+2],jj[v*4+3]);
               W.push(ww[v*4],ww[v*4+1],ww[v*4+2],ww[v*4+3]);}
        else  {J.push(0,0,0,0); W.push(1,0,0,0);}
        CV.push(c[0],c[1],c[2],em);
      }
      const idx=acc(pr.indices);
      for(let t=0;t<idx.length;t++) I.push(idx[t]+base);
    }
    const NV=P.length/3;
    const skin=(gj.skins||[])[0];
    const N=skin&&opts.pose?opts.N||16:1;
    /* joint hierarchy: bind is translation-only; pose adds X and Z rotations */
    let joints=[],IBM=null,byName={},kids={},jset=new Set();
    if(skin){
      joints=skin.joints; IBM=acc(skin.inverseBindMatrices);
      gj.nodes.forEach((n,i)=>{byName[n.name]=i; kids[i]=n.children||[];});
      joints.forEach(j=>jset.add(j));
    }
    const limb=new Float32Array(NV);
    if(skin&&opts.head){
      const hset=new Set(opts.head.map(n=>joints.indexOf(byName[n])));
      for(let v=0;v<NV;v++){
        let bi=0,bw=-1;
        for(let k=0;k<4;k++) if(W[v*4+k]>bw){bw=W[v*4+k];bi=J[v*4+k];}
        if(hset.has(bi)) limb[v]=5;
      }
    }
    const frames=[];
    const mk=(d2,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);
      gl.bufferData(t||gl.ARRAY_BUFFER,d2,gl.STATIC_DRAW);return b;};
    for(let f=0;f<N;f++){
      let fp,fn;
      if(!skin||!opts.pose){ fp=new Float32Array(P); fn=new Float32Array(Nn); }
      else{
        const rot=opts.pose(f/N);            /* {JointName:[thetaX,thetaZ]} */
        const JW={};                          /* name -> {R(3x3 rows), pos} */
        const go=(ni,R,px,py,pz,rooted)=>{
          const n=gj.nodes[ni], t=n.translation||[0,0,0];
          const x=px+R[0]*t[0]+R[1]*t[1]+R[2]*t[2];
          const y=py+R[3]*t[0]+R[4]*t[1]+R[5]*t[2];
          const z=pz+R[6]*t[0]+R[7]*t[1]+R[8]*t[2];
          const rr=rot[n.name]||[0,0];
          const cx=Math.cos(rr[0]),sx=Math.sin(rr[0]);
          const cz=Math.cos(rr[1]),sz=Math.sin(rr[1]);
          /* R2 = R * Rx * Rz */
          const A=[1,0,0, 0,cx,-sx, 0,sx,cx];
          const B=[cz,-sz,0, sz,cz,0, 0,0,1];
          const mul=(a,b)=>{const o=new Array(9);
            for(let r=0;r<3;r++)for(let c2=0;c2<3;c2++){let v=0;
              for(let k=0;k<3;k++)v+=a[r*3+k]*b[k*3+c2]; o[r*3+c2]=v;} return o;};
          const R2=mul(mul(R,A),B);
          if(jset.has(ni)) JW[n.name]={R:R2,x,y,z};
          for(const ch of kids[ni]) go(ch,R2,x,y,z,true);
        };
        for(let ni=0;ni<gj.nodes.length;ni++){
          let isChild=false;
          for(const k in kids) if(kids[k].indexOf(ni)>=0) isChild=true;
          if(!isChild) go(ni,[1,0,0,0,1,0,0,0,1],0,0,0,false);
        }
        const JM=joints.map((ji,k)=>{
          const w2=JW[gj.nodes[ji].name];
          const M=[w2.R[0],w2.R[3],w2.R[6],0, w2.R[1],w2.R[4],w2.R[7],0,
                   w2.R[2],w2.R[5],w2.R[8],0, w2.x,w2.y,w2.z,1];
          const B2=IBM.subarray(k*16,k*16+16), o=new Float32Array(16);
          for(let c2=0;c2<4;c2++)for(let r=0;r<4;r++){let v=0;
            for(let kk=0;kk<4;kk++)v+=M[kk*4+r]*B2[c2*4+kk]; o[c2*4+r]=v;}
          return o;
        });
        fp=new Float32Array(NV*3); fn=new Float32Array(NV*3);
        for(let v=0;v<NV;v++){
          const px2=P[v*3],py2=P[v*3+1],pz2=P[v*3+2];
          const nx=Nn[v*3],ny=Nn[v*3+1],nz=Nn[v*3+2];
          let ox=0,oy=0,oz=0,mx2=0,my=0,mz=0;
          for(let k=0;k<4;k++){
            const w2=W[v*4+k]; if(w2<1e-4) continue;
            const M=JM[J[v*4+k]];
            ox+=w2*(M[0]*px2+M[4]*py2+M[8]*pz2+M[12]);
            oy+=w2*(M[1]*px2+M[5]*py2+M[9]*pz2+M[13]);
            oz+=w2*(M[2]*px2+M[6]*py2+M[10]*pz2+M[14]);
            mx2+=w2*(M[0]*nx+M[4]*ny+M[8]*nz);
            my+=w2*(M[1]*nx+M[5]*ny+M[9]*nz);
            mz+=w2*(M[2]*nx+M[6]*ny+M[10]*nz);
          }
          fp[v*3]=ox;fp[v*3+1]=oy;fp[v*3+2]=oz;
          const l2=Math.hypot(mx2,my,mz)||1;
          fn[v*3]=mx2/l2;fn[v*3+1]=my/l2;fn[v*3+2]=mz/l2;
        }
      }
      frames.push({pos:mk(fp),nrm:mk(fn)});
    }
    GLCRE[key]={ready:true,N,frames,
      col:mk(new Float32Array(CV)),
      limbB:mk(limb),
      idxB:mk(new Uint32Array(I),gl.ELEMENT_ARRAY_BUFFER),
      count:I.length};
    console.log('glTF creature baked:',file,N,'frames');
    updBuildTag();
  }catch(e){ console.warn('glTF creature unavailable:',file,e.message); updBuildTag(); }
}
function glCreFrame(a){
  const G=GLCRE[a.gcre];
  const fi=G.N>1?((Math.floor(((a.gph||0)%6.28318)/6.28318*G.N)%G.N)+G.N)%G.N:0;
  const F=G.frames[fi];
  return {pos:F.pos,nrm:F.nrm,col:G.col,limb:G.limbB,idx:G.idxB,count:G.count};
}
const stagPose=u=>{
  const ph=u*6.283185, o={};
  const sw=(off)=>[0.50*Math.sin(ph+off),0];
  const ft=(off)=>[0.42*Math.sin(ph+off+1.25),0];
  o.Hip_FL=sw(0);        o.Foot_FL=ft(0);
  o.Hip_BR=sw(0.4);      o.Foot_BR=ft(0.4);
  o.Hip_FR=sw(Math.PI);  o.Foot_FR=ft(Math.PI);
  o.Hip_BL=sw(Math.PI+0.4); o.Foot_BL=ft(Math.PI+0.4);
  o.Spine=[0.045*Math.sin(2*ph),0];
  o.Neck=[0.06*Math.sin(2*ph+0.8),0];
  return o;
};
const birdPose=u=>{
  const F=0.95*Math.sin(u*6.283185);
  return {Wing_L:[0,-F], Wing_R:[0,F], Tail:[0.16*Math.sin(u*6.283185+1.0),0]};
};

/* fullscreen post-processing: bright-extract for bloom, then composite */
const VS_POST=`
attribute vec2 aP; varying vec2 vUv;
void main(){ vUv=aP*0.5+0.5; gl_Position=vec4(aP,0.0,1.0); }`;

const FS_BLOOM=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene; uniform vec2 uPx;
void main(){
  vec3 acc=vec3(0.0);
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
    vec3 c=texture2D(uScene,vUv+vec2(float(i),float(j))*uPx*2.0).rgb;
    float l=max(max(c.r,c.g),c.b);
    acc+=c*smoothstep(0.72,1.0,l);
  }
  gl_FragColor=vec4(acc/9.0,1.0);
}`;

const FS_POST=`
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene,uBloomT;
uniform vec2 uPx;
uniform float uExposure,uBloomAmt;
vec3 aces(vec3 x){
  return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);
}
void main(){
  vec3 c=texture2D(uScene,vUv).rgb;
  vec3 b=texture2D(uBloomT,vUv).rgb;
  b+=texture2D(uBloomT,vUv+vec2(uPx.x*3.0,0.0)).rgb
    +texture2D(uBloomT,vUv-vec2(uPx.x*3.0,0.0)).rgb
    +texture2D(uBloomT,vUv+vec2(0.0,uPx.y*3.0)).rgb
    +texture2D(uBloomT,vUv-vec2(0.0,uPx.y*3.0)).rgb;
  b*=0.2;
  c=c*uExposure+b*uBloomAmt;
  c=aces(c);
  c=pow(c,vec3(0.92));
  gl_FragColor=vec4(c,1.0);
}`;

/* depth-only pass for the shadow map */
const FS_DEPTH=`
precision highp float;
varying vec3 vN; varying vec4 vC; varying vec3 vW; varying vec4 vSh;
void main(){}`;

const FS_MAIN=`
precision highp float;
varying vec3 vN; varying vec4 vC; varying vec3 vW; varying vec4 vSh;
uniform vec3 uSun,uSunCol,uAmb,uFogCol,uCam;
uniform float uFogDen,uGrid,uTime,uEmiss,uMat,uSnow,uShadowOn,uAlpha,uTexOn;
uniform sampler2D uShadowMap;
uniform sampler2D uTexGA,uTexGN,uTexRA,uTexRN,uTexAA,uTexAN;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float vno(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),
             mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return vno(p)*0.55+vno(p*2.31)*0.28+vno(p*5.17)*0.17;}
float shadowF(vec3 n){
  if(uShadowOn<0.5) return 1.0;
  vec3 sp=vSh.xyz/vSh.w;
  if(sp.x<0.01||sp.x>0.99||sp.y<0.01||sp.y>0.99||sp.z>0.999) return 1.0;
  float bias=max(0.0009, 0.0035*(1.0-dot(n,uSun)));
  float sum=0.0;
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
    float dp=texture2D(uShadowMap,sp.xy+vec2(float(i),float(j))/2048.0).r;
    sum+=(dp+bias>sp.z)?1.0:0.0;
  }
  return 0.25+0.75*(sum/9.0);   /* shadows soften, never go black */
}
void main(){
  vec3 n0=normalize(vN);
  vec3 n=n0;
  float em=vC.a;
  if(em>2.0){ em=0.74+0.26*sin(uTime*0.7+(em-2.0)*6.28318); }
  else if(em>1.0){ em=0.10+0.90*step(0.55,fract(uTime*0.6+(em-1.0))); }
  vec3 alb=vC.rgb;
  float dist=length(vW-uCam);
  /* texture detail fades with distance, so the tiles never shimmer far off */
  float df=clamp(1.0-dist/430.0,0.0,1.0)*uTexOn;
  if(uMat>0.5&&uMat<1.5){
    /* the ground: baked grass and rock textures with normal maps, blended by
       slope; meso noise breaks up the tiling; snow settles on the heights */
    /* steep faces sample sideways, not top-down: a cliff seen through the
       XZ projection smears every pattern into long diagonal stripes, so
       blend toward the facing side plane as the surface tips over */
    vec2 pSide=(abs(n0.x)>abs(n0.z))?vW.zy:vW.xy;
    float steep=clamp((0.62-n0.y)*2.8,0.0,1.0);
    vec2 P=mix(vW.xz,pSide,steep);
    float g1=fbm(P*0.045);
    alb*=(0.80+0.34*g1);
    float rock=clamp((0.74-n0.y)*3.4,0.0,1.0);
    vec2 uvg=P*0.31;
    vec2 uvr=mix(vW.xz*0.13+vec2(vW.y*0.05,0.0),pSide*0.13,steep);
    vec3 gA=texture2D(uTexGA,uvg).rgb*1.62;
    vec3 rA=texture2D(uTexRA,uvr).rgb*1.62;
    vec3 grass=alb*mix(vec3(1.0),gA,df)*(0.88+0.24*fbm(P*0.85)*(1.0-df));
    vec3 rockc=vec3(0.42,0.395,0.365)
               *(0.72+0.55*fbm(mix(vW.xz*0.35+vW.y*0.13,pSide*0.35,steep)))
               *mix(vec3(1.0),rA,df);
    alb=mix(grass,rockc,rock*0.92);
    /* vertex paint darker than any real terrain colour means deliberate
       darkness (bore interiors) - honour it even where rock colour rules */
    alb*=clamp((vC.r+vC.g+vC.b-0.05)*8.0,0.0,1.0);
    float snLine=uSnow+16.0*fbm(vW.xz*0.03)-8.0;      /* a ragged snowline */
    float sn=clamp((vW.y-snLine)/14.0,0.0,1.0)*clamp((n0.y-0.45)*3.0,0.0,1.0);
    sn*=0.55+0.65*fbm(vW.xz*0.07+3.1);                 /* patchy, rock showing through */
    sn=clamp(sn,0.0,1.0);
    alb=mix(alb,vec3(0.90,0.93,0.99)*(0.78+0.28*gA.g),sn);
    /* large-scale light and shade that survives at ANY distance, so far
       mountains never collapse into flat meringue */
    alb*=0.84+0.30*fbm(P*0.012+7.3);
    vec3 tn=mix(texture2D(uTexGN,uvg).rgb,texture2D(uTexRN,uvr).rgb,rock)*2.0-1.0;
    n=normalize(n0+vec3(tn.x,0.0,tn.z)*df*(1.0-sn*0.8)*(1.0-steep*0.6));
  }else if(uMat>1.5&&uMat<2.5){
    vec2 uva=vW.xz*0.22;
    vec3 aA=texture2D(uTexAA,uva).rgb;
    vec3 aB=texture2D(uTexAA,uva*0.537+vec2(0.418,0.131)).rgb;
    aA=mix(aA,aB,0.5)*1.62;
    alb*=mix(vec3(1.0),aA,df);
    vec3 tn=texture2D(uTexAN,uva).rgb*2.0-1.0;
    n=normalize(n0+vec3(tn.x,0.0,tn.z)*df*0.6);
  }
  float d=max(dot(n,uSun),0.0)*shadowF(n0);
  vec3 col=alb*(uAmb+uSunCol*d)+alb*em*1.7*uEmiss;
  if(uMat>2.5){
    /* still water: sky reflected at a grazing angle, ripples, sun glitter */
    vec2 wp2=vW.xz*0.10;
    float r1=fbm(wp2+vec2(uTime*0.050,uTime*0.033));
    float r2=fbm(wp2*2.3-vec2(uTime*0.041,uTime*0.027));
    vec3 vd=normalize(vW-uCam);
    float fres=pow(1.0-clamp(-vd.y,0.0,1.0),3.0);
    col=mix(col,uFogCol*1.25,0.22+0.55*fres);
    col+=vec3(0.05,0.07,0.08)*(r1+r2-1.0);
    float glint=pow(max(dot(reflect(vd,vec3(0.0,1.0,0.0)),uSun),0.0),90.0);
    col+=uSunCol*glint*0.6;
  }
  if(uGrid>0.5){
    vec2 g=abs(fract(vW.xz/24.0)-0.5);
    float line=1.0-smoothstep(0.0,0.035,min(g.x,g.y));
    float fade=1.0-smoothstep(120.0,900.0,dist);
    col+=vec3(0.0,0.42,0.60)*line*fade*0.75;
  }
  float f=1.0-exp(-pow(dist*uFogDen,2.0));
  gl_FragColor=vec4(mix(col,uFogCol,clamp(f,0.0,1.0)),uAlpha);
}`;

const VS_SKY=`
attribute vec2 aP; varying vec2 vN;
void main(){ vN=aP; gl_Position=vec4(aP,0.999,1.0); }`;

const FS_SKY=`
precision highp float;
varying vec2 vN;
uniform vec3 uFwd,uRight,uUp;
uniform float uTanHalf,uAspect;
uniform vec3 uTop,uHorizon,uFog;
uniform float uStars,uStarBright;
uniform float uCloud,uTimeS,uSkyOn;
uniform sampler2D uSkyTex;
uniform vec3 uCloudCol,uSunDirS,uSunColS;
float ch21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float cvno(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(ch21(i),ch21(i+vec2(1,0)),f.x),
             mix(ch21(i+vec2(0,1)),ch21(i+vec2(1,1)),f.x),f.y);}
float cfbm(vec2 p){return cvno(p)*0.5+cvno(p*2.17)*0.3+cvno(p*4.9)*0.2;}
uniform vec3 uEarthDir,uEarthR,uEarthU,uEarthLight;
uniform float uEarthSize;
float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
void main(){
  vec3 d=normalize(uFwd+uRight*(vN.x*uTanHalf*uAspect)+uUp*(vN.y*uTanHalf));
  if(uSkyOn>0.5){
    /* an AI-painted panorama wrapped onto the sky dome, slowly rotating */
    float uu=fract(atan(d.x,d.z)*0.31830988+uTimeS*0.0024);
    float vv=1.0-pow(clamp(d.y,0.0,1.0),0.62);
    vec3 pano=texture2D(uSkyTex,vec2(uu,vv)).rgb;
    pano=mix(pano,uFog,1.0-smoothstep(-0.02,0.10,d.y));
    float sg=max(dot(d,uSunDirS),0.0);
    pano+=uSunColS*pow(sg,600.0)*0.6;
    gl_FragColor=vec4(pano,1.0);
    return;
  }
  float t=clamp(d.y*1.5,0.0,1.0);
  vec3 col=mix(uHorizon,uTop,pow(t,0.7));
  col=mix(uFog,col,clamp(d.y*8.0,0.0,1.0));

  if(uStars>0.5 && d.y>-0.02){
    vec3 sp=d*72.0, cell=floor(sp), f=fract(sp);
    vec3 r=vec3(h3(cell),h3(cell+11.3),h3(cell+27.7));
    float dd=length(f-r);
    float star=smoothstep(0.13,0.0,dd)*step(0.93,h3(cell+3.1));
    col+=vec3(star)*uStarBright*clamp(d.y*4.0,0.0,1.0);
  }

  if(uCloud>0.001&&d.y>0.012){
    /* cumulus painted on the sky dome, drifting with time */
    vec2 cp=d.xz/(d.y+0.12);
    cp=cp*0.20+vec2(uTimeS*0.0045,uTimeS*0.0017);
    float cl=cfbm(cp)+0.45*cfbm(cp*2.9+13.7);
    float cov=smoothstep(1.28-uCloud*0.85,1.55-uCloud*0.85,cl)
             *clamp((d.y-0.012)*9.0,0.0,1.0);
    vec3 cc=uCloudCol*(0.70+0.45*cfbm(cp*4.3+4.1));
    /* the side facing the sun catches its colour */
    cc+=uSunColS*0.18*max(dot(d,uSunDirS),0.0);
    col=mix(col,cc,cov*0.94);
  }
  float sdd=max(dot(d,uSunDirS),0.0);
  col+=uSunColS*(pow(sdd,900.0)*1.7+pow(sdd,9.0)*0.10);

  if(uEarthSize>0.0){
    float ca=dot(d,uEarthDir);
    if(ca>0.0){
      float s=sin(uEarthSize);
      float px=dot(d,uEarthR)/s, py=dot(d,uEarthU)/s;
      float r2=px*px+py*py;
      if(r2<1.35){
        float edge=smoothstep(1.02,0.94,r2);
        float pz=sqrt(max(1.0-r2,0.0));
        vec3 n=normalize(uEarthR*px+uEarthU*py+uEarthDir*pz);
        float lit=clamp(dot(n,uEarthLight)*1.15+0.06,0.0,1.0);
        float m=sin(n.x*5.1)+sin(n.y*6.7+1.3)+sin(n.z*5.9+2.1)+0.6*sin(n.x*13.0+n.z*9.0);
        vec3 surf=mix(vec3(0.10,0.32,0.66),vec3(0.30,0.44,0.24),smoothstep(0.35,0.75,m));
        surf=mix(surf,vec3(0.86,0.89,0.94),smoothstep(1.55,2.2,m));
        col=mix(col,surf*lit,edge);
        col+=vec3(0.18,0.34,0.66)*smoothstep(1.30,1.0,r2)*(1.0-edge)*0.8;
      }
    }
  }
  gl_FragColor=vec4(col,1.0);
}`;

function makeProgram(vsSrc,fsSrc){
  const sh=(type,src)=>{
    const s=gl.createShader(type);
    gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s)+'\n'+src);
    return s;
  };
  const pr=gl.createProgram();
  gl.attachShader(pr,sh(gl.VERTEX_SHADER,vsSrc));
  gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fsSrc));
  gl.bindAttribLocation(pr,0,'aPos');
  gl.bindAttribLocation(pr,0,'aP');
  gl.bindAttribLocation(pr,0,'aCtr');
  gl.bindAttribLocation(pr,1,'aDat');
  gl.bindAttribLocation(pr,2,'aUv');
  gl.bindAttribLocation(pr,1,'aNrm');
  gl.bindAttribLocation(pr,2,'aCol');
  gl.bindAttribLocation(pr,3,'aLimb');
  gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  return pr;
}

