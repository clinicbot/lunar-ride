"use strict";

/* Verdant Rift v132 — living world + alien grove + final visual cleanup ----
   Removes oversized imported broadleaf outliers, clears baked props from the
   asphalt corridor, adds a lightweight alien mushroom-tree grove, expands
   animal herds/swarms and adds four new settlement clusters. */
(function(){
  const ASSET='assets/models/verdant_mushroom_tree_v132.b64.0';
  const TAU=6.283185307179586,MAX_TREE_HEIGHT=9.5;
  const A={started:false,settled:false,ready:false,failed:false,model:null,promise:null};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};

  function parseGLB(text){
    const raw=atob(text.trim()),u=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);
    const b=u.buffer,dv=new DataView(b);
    if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw new Error('invalid glTF 2 GLB');
    const jsonLen=dv.getUint32(12,true),jsonType=dv.getUint32(16,true);
    if(jsonType!==0x4e4f534a)throw new Error('GLB JSON chunk missing');
    const jsonText=new TextDecoder().decode(new Uint8Array(b,20,jsonLen)).replace(/\0+$/,'').trim();
    const g=JSON.parse(jsonText),binHead=20+jsonLen;
    const binType=dv.getUint32(binHead+4,true);
    if(binType!==0x004e4942)throw new Error('GLB BIN chunk missing');
    const binStart=binHead+8;
    const readComp=(view,o,ct)=>ct===5120?view.getInt8(o):ct===5121?view.getUint8(o):ct===5122?view.getInt16(o,true):ct===5123?view.getUint16(o,true):ct===5125?view.getUint32(o,true):view.getFloat32(o,true);
    const norm=(v,ct)=>ct===5120?Math.max(v/127,-1):ct===5121?v/255:ct===5122?Math.max(v/32767,-1):ct===5123?v/65535:v;
    const accessor=i=>{
      const a=g.accessors[i],bv=g.bufferViews[a.bufferView],Ctor=CT[a.componentType],nc=NC[a.type],bytes=Ctor.BYTES_PER_ELEMENT;
      const off=binStart+(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||nc*bytes;
      if(!a.normalized&&stride===nc*bytes)return{data:new Ctor(b,off,a.count*nc),nc};
      const out=new Float32Array(a.count*nc),view=new DataView(b);
      for(let n=0;n<a.count;n++)for(let c=0;c<nc;c++){
        let v=readComp(view,off+n*stride+c*bytes,a.componentType);if(a.normalized)v=norm(v,a.componentType);out[n*nc+c]=v;
      }
      return{data:out,nc};
    };
    const p=g.meshes&&g.meshes[0]&&g.meshes[0].primitives&&g.meshes[0].primitives[0];
    if(!p||p.attributes.POSITION===undefined||p.indices===undefined)throw new Error('mushroom mesh missing');
    const P=accessor(p.attributes.POSITION),N=p.attributes.NORMAL!==undefined?accessor(p.attributes.NORMAL):null;
    const C=p.attributes.COLOR_0!==undefined?accessor(p.attributes.COLOR_0):null,I=accessor(p.indices).data;
    const pos=new Float32Array(I.length*3),nrm=new Float32Array(I.length*3),col=new Float32Array(I.length*3);let q=0;
    for(let t=0;t<I.length;t++){
      const vi=I[t],pp=vi*P.nc,nn=N?vi*N.nc:0,cc=C?vi*C.nc:0;
      pos[q]=P.data[pp];nrm[q]=N?N.data[nn]:0;col[q++]=C?C.data[cc]:.56;
      pos[q]=P.data[pp+1];nrm[q]=N?N.data[nn+1]:1;col[q++]=C?C.data[cc+1]:.68;
      pos[q]=P.data[pp+2];nrm[q]=N?N.data[nn+2]:0;col[q++]=C?C.data[cc+2]:.60;
    }
    let minY=1e20,maxY=-1e20;for(let i=1;i<pos.length;i+=3){if(pos[i]<minY)minY=pos[i];if(pos[i]>maxY)maxY=pos[i];}
    return{pos,nrm,col,count:I.length,triangles:I.length/3,height:Math.max(.01,maxY-minY),file:ASSET};
  }
  function startLoad(){
    if(A.started)return A.promise;A.started=true;
    A.promise=fetch(ASSET).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
      .then(t=>{A.model=parseGLB(t);A.ready=true;return A.model;})
      .catch(e=>{A.failed=true;console.warn('Verdant v132 mushroom asset unavailable:',e&&e.message||e);return null;})
      .finally(()=>{A.settled=true;});
    return A.promise;
  }
  if(typeof fetch==='function')startLoad();

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w._dbg||typeof w._dbg.roadNear!=='function')return w;
    const near=w._dbg.roadNear,L=(w.lapLen||25000)/1000,n=w.nMain,rr=mulberry32(sc.seed+132031);
    const stats={removedTwistedGroups:0,removedOversizeTrees:0,roadPropTrianglesRemoved:0,mushroomTrees:0,
      bearHerds:0,bears:0,catHerds:0,cats:0,dragonflySwarms:0,dragonflies:0,deerHerds:0,deer:0,
      extraBuildings:0,extraBuildingTris:0,skippedBuildings:[]};
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);return{i,km,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,yaw:Math.atan2(w.tx[i],w.tz[i])};
    };

    /* The giant green broadleaf objects in v131 were TwistedTree assets: their
       source geometry is ~16.5 m high before instance scale. Remove that family
       entirely, then enforce a hard world-height cap on every other imported tree. */
    if(w.instNature&&w.instNature.ready&&w.instNature.groups){
      for(const key of ['twisted1','twisted3']){
        if(w.instNature.groups[key]){delete w.instNature.groups[key];stats.removedTwistedGroups++;}
        if(w.instNature.models)delete w.instNature.models[key];
      }
      for(const key in w.instNature.groups){
        const g=w.instNature.groups[key],m=w.instNature.models&&w.instNature.models[key];
        if(!g||g.kind!=='trees'||!m||!m.pos||!g.instances)continue;
        let lo=1e20,hi=-1e20;for(let p=1;p<m.pos.length;p+=3){if(m.pos[p]<lo)lo=m.pos[p];if(m.pos[p]>hi)hi=m.pos[p];}
        const h=Math.max(.01,hi-lo),out=[];
        for(let p=0;p+5<g.instances.length;p+=6){
          const scale=g.instances[p+5];if(h*scale>MAX_TREE_HEIGHT){stats.removedOversizeTrees++;continue;}
          for(let k=0;k<6;k++)out.push(g.instances[p+k]);
        }
        g.instances=out;
      }
    }

    /* Alien mushroom-tree groves: one tiny indexed GLB is expanded once and
       reused through the existing GPU-instancing renderer. */
    if(A.ready&&A.model&&w.instNature&&w.instNature.ready){
      const I=w.instNature,G=I.groups,M=I.models;M.mushroomTree=A.model;
      G.mushroomTree={kind:'trees',range:.95,instances:[]};
      const addM=(km,off,targetH)=>{
        for(let retry=0;retry<4;retry++){
          const side=off<0?-1:1,p=routePose(km+retry*.006,off+side*retry*7),q=near(p.x,p.z);
          const ww=q&&q.i>=0&&q.i<n&&w.verdant&&w.verdant.widthAt?w.verdant.widthAt(q.i):3.35;
          if(q&&q.d<ww+14)continue;
          G.mushroomTree.instances.push(p.km,p.x,w.meshH(p.x,p.z)-.02,p.z,rr()*TAU,targetH/A.model.height);
          stats.mushroomTrees++;return true;
        }
        return false;
      };
      const groves=[9.15,9.65,10.25,10.85,11.45,12.05,12.65,13.25,13.85];
      groves.forEach((base,g)=>{
        const side=g%2?-1:1;
        addM(base,side*(18+rr()*10),5.4+rr()*2.8);
        addM(base+(rr()-.5)*.10,-side*(28+rr()*24),4.2+rr()*2.5);
        if(g%3===0)addM(base+.06,side*(44+rr()*22),3.8+rr()*2.2);
      });
      if(I.stats){I.stats.trees=(I.stats.trees||0)+stats.mushroomTrees;I.stats.total=(I.stats.total||0)+stats.mushroomTrees;}
    }

    const META={
      bear:{float:0,gait:2.9,turn:.78,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      cat:{float:0,gait:4.8,turn:1.2,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      dfly:{float:1.25,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02}
    };
    const ready=k=>typeof GLCRE!=='undefined'&&GLCRE[k]&&GLCRE[k].ready;
    const addLand=(kind,gcre,km,off,k,wr,wspd)=>{
      if(!w.actors||!ready(gcre))return false;const p=routePose(km,off),ph=rr()*TAU,py=w.meshH(p.x,p.z);
      w.actors.push({type:'v132_'+kind,gcre,px:p.x,py,pz:p.z,yaw:rr()*TAU,k,emiss:1,meta:META[kind],ph,
        hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:w.rx[p.i],rdz:w.rz[p.i]});
      stats[kind==='stag'?'deer':kind+'s']++;return true;
    };
    const bearHerds=[[.95,-1],[3.75,1],[8.25,-1],[12.85,1],[18.35,-1],[22.75,1]];
    bearHerds.forEach(([base,side])=>{stats.bearHerds++;for(let j=0;j<4+Math.floor(rr()*3);j++)addLand('bear','vbear',base+(rr()-.5)*.12,side*(14+rr()*18),.95+rr()*.28,3+rr()*3,.06+rr()*.06);});
    const catHerds=[[1.70,1],[4.25,-1],[6.75,1],[9.45,-1],[11.15,1],[14.75,-1],[17.55,1],[20.15,-1],[23.45,1],[24.45,-1]];
    catHerds.forEach(([base,side])=>{stats.catHerds++;for(let j=0;j<6+Math.floor(rr()*4);j++)addLand('cat','cat',base+(rr()-.5)*.10,side*(8+rr()*13),.78+rr()*.27,1.8+rr()*2.4,.23+rr()*.20);});
    const deerHerds=[[1.95,-1],[4.95,1],[7.05,-1],[10.55,1],[13.55,-1],[15.15,1],[19.65,-1],[23.95,1]];
    deerHerds.forEach(([base,side])=>{stats.deerHerds++;for(let j=0;j<7+Math.floor(rr()*4);j++)addLand('stag','stag',base+(rr()-.5)*.14,side*(8+rr()*15),.90+rr()*.30,2+rr()*3,.12+rr()*.11);});
    const dragonflySwarms=[6.25,6.85,7.45,8.05,9.25,10.35,11.45,12.55,13.35,18.75,20.15,22.25];
    dragonflySwarms.forEach((base,s)=>{
      stats.dragonflySwarms++;if(!w.actors||!ready('dfly'))return;
      for(let j=0;j<8+Math.floor(rr()*5);j++){
        const side=(j&1)?-1:1,p=routePose(base+(rr()-.5)*.13,side*(5+rr()*12)),ph=rr()*TAU,py=w.meshH(p.x,p.z)+1.0+rr()*2.4;
        w.actors.push({type:'v132_dfly',gcre:'dfly',px:p.x,py,pz:p.z,yaw:rr()*TAU,k:.80+rr()*.40,emiss:1,meta:META.dfly,
          ph,hx:p.x,hz:p.z,wr:.7,wander:ph,wspd:(rr()<.5?-1:1)*(.45+rr()*.35),alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,pinY:py,rdx:w.rx[p.i],rdz:w.rz[p.i]});
        stats.dragonflies++;
      }
    });

    /* Four additional settlements, deliberately between the existing v121
       outpost/city/relay clusters. Geometry budget keeps phones safe. */
    const mb=new MeshB(),foundationCol=hx('#343d3c'),MAX_EXTRA_BUILDING_TRIS=300000;
    const bounds=model=>{
      if(model.__v132Bounds)return model.__v132Bounds;if(model.__v121Bounds)return model.__v121Bounds;
      const f=model.norm||1,mn=[1e20,1e20,1e20],mx=[-1e20,-1e20,-1e20];let tris=0;
      for(const pr of model.prims||[]){const P=pr.pos||[];tris+=Math.floor((pr.idx||[]).length/3);for(let v=0;v+2<P.length;v+=3){const x=P[v]*f,y=P[v+1]*f,z=P[v+2]*f;mn[0]=Math.min(mn[0],x);mn[1]=Math.min(mn[1],y);mn[2]=Math.min(mn[2],z);mx[0]=Math.max(mx[0],x);mx[1]=Math.max(mx[1],y);mx[2]=Math.max(mx[2],z);}}
      return model.__v132Bounds={mn,mx,w:Math.max(.01,mx[0]-mn[0]),h:Math.max(.01,mx[1]-mn[1]),d:Math.max(.01,mx[2]-mn[2]),cx:(mn[0]+mx[0])*.5,cz:(mn[2]+mx[2])*.5,tris};
    };
    const stampBuilding=(key,km,off,targetH,yawOff,label)=>{
      const model=typeof GLTREES!=='undefined'&&GLTREES[key];if(!model||!model.prims||!model.prims.length){stats.skippedBuildings.push(label||key);return false;}
      const b=bounds(model);if(stats.extraBuildingTris+b.tris>MAX_EXTRA_BUILDING_TRIS){stats.skippedBuildings.push((label||key)+'(budget)');return false;}
      const p=routePose(km,off),scale=targetH/b.h,yaw=p.yaw+(yawOff||0),fw=b.w*scale,fd=b.d*scale,r=Math.min(20,Math.max(4,Math.max(fw,fd)*.38));
      const samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r]];let minG=1e20,maxG=-1e20;
      for(const q of samples){const gy=w.meshH(p.x+q[0],p.z+q[1]);minG=Math.min(minG,gy);maxG=Math.max(maxG,gy);}
      if(!Number.isFinite(minG)||!Number.isFinite(maxG))minG=maxG=w.meshH(p.x,p.z);
      mb.setTF(p.x,minG-.5,p.z,yaw,1);mb.box(0,0,0,fw+3,Math.max(1,(maxG-minG)+1),fd+3,foundationCol,.02);
      mb.setTF(p.x,maxG+.08,p.z,yaw,scale);const f=model.norm||1;
      for(const pr of model.prims){const P=pr.pos,I=pr.idx,c=pr.col||[.5,.5,.5],em=pr.em||.02;for(let t=0;t+2<I.length;t+=3){const at=ii=>{const j=I[ii]*3;return mb.P(P[j]*f-b.cx,P[j+1]*f-b.mn[1],P[j+2]*f-b.cz);};mb.tri(at(t),at(t+1),at(t+2),c,em);}}
      stats.extraBuildings++;stats.extraBuildingTris+=b.tris;return true;
    };
    const extraSettlements=[
      ['stSide',2.72,-42,13,.10,'field_lab'],['sAnt',2.90,56,24,-.15,'field_antenna'],['stGate',3.08,-48,14,1.57,'field_gate'],['sHang',3.24,68,18,-.25,'field_hangar'],
      ['sRef',8.48,-58,20,.20,'wetland_refinery'],['stSide',8.68,42,13,-.10,'wetland_lab'],['sAnt',8.86,68,25,.12,'wetland_antenna'],['stGate',9.04,-46,14,1.57,'wetland_gate'],
      ['cDome',13.82,66,30,.15,'grove_dome'],['cGate',14.02,-46,22,1.57,'grove_gate'],['cClu',14.22,82,42,-.12,'grove_cluster'],['sRing',14.42,-60,32,.25,'grove_ring'],
      ['sAnt',23.08,-48,26,-.15,'far_antenna'],['stSide',23.28,44,14,.12,'far_lab'],['sRing',23.50,58,30,-.20,'far_ring'],['stGate',23.72,-42,14,1.57,'far_gate']
    ];
    for(const s of extraSettlements)stampBuilding(...s);
    if(mb.idx.length&&w.props){const base=w.props.pos.length/3,pos=new Float32Array(w.props.pos.length+mb.pos.length);pos.set(w.props.pos);pos.set(mb.pos,w.props.pos.length);const nrm=new Float32Array(w.props.nrm.length+mb.nrm.length);nrm.set(w.props.nrm);nrm.set(mb.nrm,w.props.nrm.length);const col=new Float32Array(w.props.col.length+mb.col.length);col.set(w.props.col);col.set(mb.col,w.props.col.length);const idx=new Uint32Array(w.props.idx.length+mb.idx.length);idx.set(w.props.idx);for(let i=0;i<mb.idx.length;i++)idx[w.props.idx.length+i]=base+mb.idx[i];w.props={pos,nrm,col,idx};}

    /* Final catch-all: imported-nature filtering does not see baked props.
       Remove any baked prop triangle whose X/Z centroid lies in the asphalt
       corridor. This catches the thin green spear/plant seen in v131. */
    function cleanPropsNearRoad(){
      if(!w.props||!w.props.idx||!w.props.pos)return;const P=w.props.pos,I=w.props.idx,out=[];
      for(let t=0;t+2<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,cx=(P[a]+P[b]+P[c])/3,cz=(P[a+2]+P[b+2]+P[c+2])/3,q=near(cx,cz);let reject=false;
        if(q&&q.i>=0&&q.i<n){const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(q.i):3.35;if(q.d<ww+2.4)reject=true;}
        if(reject)stats.roadPropTrianglesRemoved++;else out.push(I[t],I[t+1],I[t+2]);
      }
      w.props.idx=new Uint32Array(out);
    }
    cleanPropsNearRoad();
    w.__verdantV132=stats;
    console.log('Verdant v132 living world:',stats);
    return w;
  };

  function installGate(){
    if(typeof startRide!=='function'||startRide.__verdantV132Gate)return;const prior=startRide;
    startRide=function(sc,resume){
      if(!sc||sc.id!=='verdant'||A.settled)return prior(sc,resume);
      const l=document.getElementById('loading'),t=document.getElementById('loadTxt');if(l)l.classList.add('on');if(t)t.textContent='Loading alien grove';
      startLoad().then(()=>prior(sc,resume));
    };
    startRide.__verdantV132Gate=true;
  }
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGate,{once:true});else setTimeout(installGate,0);
  }
  if(typeof window!=='undefined')window.__verdantV132Assets={state:A,wait:startLoad};
})();
