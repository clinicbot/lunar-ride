"use strict";

/* Verdant Rift v140 — wildlife, settlements + mushroom expansion -----------
   A deliberately isolated layer on top of the approved v139 world. It counts
   the animals/buildings that actually survived all older layers, then grows
   those populations to the user-requested multipliers. Existing trees, flower
   mega-carpets, terrain and sky are not changed. */
(function(){
  const TAU=6.283185307179586;
  const CAT_MULT=10, DFLY_MULT=10, STAG_MULT=3, BUILDING_MULT=5;
  const GIANT_CAT_FRACTION=.5;
  const GIANT_MUSHROOM_TARGET=240, SMALL_MUSHROOM_TARGET=2400;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.actors)return w;

    const rr=mulberry32(sc.seed+140031),L=(w.lapLen||25000)/1000,n=w.nMain;
    const ready=k=>typeof GLCRE!=="undefined"&&GLCRE&&GLCRE[k]&&GLCRE[k].ready;
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {km,i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,
        rx:w.rx[i],rz:w.rz[i],yaw:Math.atan2(w.tx[i],w.tz[i])};
    };

    const countGcre=key=>w.actors.reduce((s,a)=>s+(a&&a.gcre===key?1:0),0);
    const baseCats=countGcre("cat");
    const baseDflies=countGcre("dfly");
    const baseStags=countGcre("stag");
    const targetCats=Math.round(baseCats*CAT_MULT);
    const targetDflies=Math.round(baseDflies*DFLY_MULT);
    const targetStags=Math.round(baseStags*STAG_MULT);
    const needCats=Math.max(0,targetCats-baseCats);
    const needDflies=Math.max(0,targetDflies-baseDflies);
    const needStags=Math.max(0,targetStags-baseStags);
    /* All pre-v140 cats are normal-sized. Add enough giant cats that exactly
       half of the final population is the requested 2x-scale variant. */
    const giantCatTarget=Math.min(needCats,Math.round(targetCats*GIANT_CAT_FRACTION));

    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      dfly:{float:1.20,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02}
    };
    const added={cats:0,giantCats:0,dragonflies:0,stags:0};

    const addLand=(kind,gcre,km,off,k,wr,wspd)=>{
      if(!ready(gcre))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind],py=w.meshH(p.x,p.z);
      w.actors.push({type:"v140_"+kind,gcre,px:p.x,py,pz:p.z,yaw:rr()*TAU,k,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz});
      return true;
    };
    const addFloat=(km,off,k)=>{
      if(!ready("dfly"))return false;
      const p=routePose(km,off),ph=rr()*TAU,py=w.meshH(p.x,p.z)+1.0+rr()*2.8;
      w.actors.push({type:"v140_dfly",gcre:"dfly",px:p.x,py,pz:p.z,yaw:rr()*TAU,k,emiss:1,
        meta:META.dfly,ph,hx:p.x,hz:p.z,wr:2.1+rr()*3.2,wander:ph,
        wspd:(rr()<.5?-1:1)*(.75+rr()*.65),alert:0,headYaw:0,headPitch:0,swing:0,
        gph:ph,pinY:py,rdx:p.rx,rdz:p.rz});
      return true;
    };

    /* Cats: clustered encounters throughout the whole lap. Giant flags are
       quota-spread instead of creating a separate giant-only district. */
    for(let i=0;i<needCats;i++){
      const group=Math.floor(i/9),base=(.30+group*.39)%L;
      const giant=Math.floor((i+1)*giantCatTarget/Math.max(1,needCats))>
                  Math.floor(i*giantCatTarget/Math.max(1,needCats));
      const side=group%2?-1:1,normalScale=.76+rr()*.25;
      if(addLand("cat","cat",base+(rr()-.5)*.12,side*(5.8+rr()*13.5),
          normalScale*(giant?2:1),1.7+rr()*2.8,.24+rr()*.20)){
        added.cats++;if(giant)added.giantCats++;
      }
    }

    /* Deer: keep them as recognizable herds, not a uniform single-file scatter. */
    for(let i=0;i<needStags;i++){
      const group=Math.floor(i/12),base=(.55+group*.62)%L,side=group%2?-1:1;
      if(addLand("stag","stag",base+(rr()-.5)*.16,side*(8+rr()*21),
          .82+rr()*.28,2.0+rr()*3.4,.11+rr()*.11))added.stags++;
    }

    /* Robot dragonflies: many low swarms along the route. */
    for(let i=0;i<needDflies;i++){
      const group=Math.floor(i/15),base=(.42+group*.44)%L,side=i%2?-1:1;
      if(addFloat(base+(rr()-.5)*.14,side*(3.0+rr()*12),.55+rr()*.32))added.dragonflies++;
    }

    /* ---- Buildings: total current settlement count x5 ------------------- */
    const baseBuildings=(w.__verdantV121&&Number.isFinite(w.__verdantV121.buildings))?
      w.__verdantV121.buildings:16;
    const targetBuildings=Math.round(baseBuildings*BUILDING_MULT);
    const needBuildings=Math.max(0,targetBuildings-baseBuildings);
    const bstats={base:baseBuildings,target:targetBuildings,added:0,pairedRoadSites:0,
      trisAdded:0,skipped:[]};

    const mb=typeof MeshB!=="undefined"?new MeshB():null;
    const foundationCol=typeof hx==="function"?hx("#343d3c"):[.20,.24,.24];
    const bounds=model=>{
      if(model.__v140Bounds)return model.__v140Bounds;
      if(model.__v121Bounds){model.__v140Bounds=model.__v121Bounds;return model.__v140Bounds;}
      const f=model.norm||1,mn=[1e20,1e20,1e20],mx=[-1e20,-1e20,-1e20];let tris=0;
      for(const pr of model.prims||[]){
        const P=pr.pos||[];tris+=Math.floor((pr.idx||[]).length/3);
        for(let v=0;v+2<P.length;v+=3){
          const x=P[v]*f,y=P[v+1]*f,z=P[v+2]*f;
          if(x<mn[0])mn[0]=x;if(y<mn[1])mn[1]=y;if(z<mn[2])mn[2]=z;
          if(x>mx[0])mx[0]=x;if(y>mx[1])mx[1]=y;if(z>mx[2])mx[2]=z;
        }
      }
      return model.__v140Bounds={mn,mx,w:Math.max(.01,mx[0]-mn[0]),h:Math.max(.01,mx[1]-mn[1]),
        d:Math.max(.01,mx[2]-mn[2]),cx:(mn[0]+mx[0])*.5,cz:(mn[2]+mx[2])*.5,tris};
    };
    const buildingCandidates=["stSide","stGate","sHang","sAnt","sRef","sRing",
      "cGate","cDome","cTower","cArc","cSpire","cClu"];
    const availableBuildings=(typeof GLTREES!=="undefined"&&GLTREES)?
      buildingCandidates.filter(k=>GLTREES[k]&&GLTREES[k].prims&&GLTREES[k].prims.length):[];
    /* Prefer the lighter models for this fivefold expansion while retaining
       enough families for visual variety. */
    availableBuildings.sort((a,b)=>bounds(GLTREES[a]).tris-bounds(GLTREES[b]).tris);
    const buildPool=availableBuildings.slice(0,Math.min(9,availableBuildings.length));

    const stampAt=(key,km,off,targetH,yawOff,label)=>{
      if(!mb||!GLTREES||!GLTREES[key])return false;
      const model=GLTREES[key],b=bounds(model),p=routePose(km,off);
      const scale=targetH/b.h,yaw=p.yaw+(yawOff||0),fw=b.w*scale,fd=b.d*scale;
      const r=Math.min(22,Math.max(4,Math.max(fw,fd)*.40));
      const samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]];
      let minG=1e20,maxG=-1e20;
      for(const q of samples){const gy=w.meshH(p.x+q[0],p.z+q[1]);if(gy<minG)minG=gy;if(gy>maxG)maxG=gy;}
      if(!Number.isFinite(minG)||!Number.isFinite(maxG))minG=maxG=w.meshH(p.x,p.z);
      const fh=Math.max(1,(maxG-minG)+1);
      mb.setTF(p.x,minG-.55,p.z,yaw,1);mb.box(0,0,0,fw+3.5,fh,fd+3.5,foundationCol,.02);
      mb.setTF(p.x,maxG+.10,p.z,yaw,scale);
      const f=model.norm||1;
      for(const pr of model.prims){
        const P=pr.pos,I=pr.idx,c=pr.col||[.5,.5,.5],em=pr.em||.02;
        for(let t=0;t+2<I.length;t+=3){
          const at=ii=>{const j=I[ii]*3;return mb.P(P[j]*f-b.cx,P[j+1]*f-b.mn[1],P[j+2]*f-b.cz);};
          mb.tri(at(t),at(t+1),at(t+2),c,em);
        }
      }
      bstats.added++;bstats.trisAdded+=b.tris;return true;
    };
    const stampRoadPair=(km,key,targetH)=>{
      if(!GLTREES||!GLTREES[key])return 0;
      const b=bounds(GLTREES[key]),scale=targetH/b.h,yawOff=Math.PI*.5;
      /* Facing the road rotates model depth into the lateral direction. Leave
         a small but safe pedestrian strip beyond the asphalt edge. */
      const lateralHalf=b.d*scale*.5+1.75,p0=routePose(km,0);
      const roadHalf=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(p0.i):3.35;
      const off=roadHalf+2.4+lateralHalf;
      let c=0;
      if(bstats.added<needBuildings&&stampAt(key,km,-off,targetH,-yawOff,"pairL"))c++;
      if(bstats.added<needBuildings&&stampAt(key,km, off,targetH, yawOff,"pairR"))c++;
      if(c===2)bstats.pairedRoadSites++;
      return c;
    };

    if(buildPool.length&&needBuildings>0){
      const pairKm=[.85,2.15,3.55,4.85,6.25,7.65,9.05,10.45,11.85,13.25,14.65,16.05,18.15,20.05,22.15,24.05];
      for(let i=0;i<pairKm.length&&bstats.added<needBuildings;i++)
        stampRoadPair(pairKm[i],buildPool[i%buildPool.length],12+rr()*18);

      /* Remaining buildings form many small settlements farther from the road. */
      let tries=0;
      while(bstats.added<needBuildings&&tries<needBuildings*8){
        const i=tries++,key=buildPool[(i*5+2)%buildPool.length],km=(.25+i*.37)%L;
        const side=i%2?-1:1,off=side*(30+rr()*72),h=12+rr()*36;
        stampAt(key,km,off,h,(rr()-.5)*1.2,"cluster");
      }
    }

    if(mb&&mb.idx&&mb.idx.length&&w.props){
      const base=w.props.pos.length/3;
      const pos=new Float32Array(w.props.pos.length+mb.pos.length);pos.set(w.props.pos);pos.set(mb.pos,w.props.pos.length);
      const nrm=new Float32Array(w.props.nrm.length+mb.nrm.length);nrm.set(w.props.nrm);nrm.set(mb.nrm,w.props.nrm.length);
      const col=new Float32Array(w.props.col.length+mb.col.length);col.set(w.props.col);col.set(mb.col,w.props.col.length);
      const idx=new Uint32Array(w.props.idx.length+mb.idx.length);idx.set(w.props.idx);
      for(let i=0;i<mb.idx.length;i++)idx[w.props.idx.length+i]=base+mb.idx[i];
      w.props={pos,nrm,col,idx};
    }

    /* ---- Mushrooms: visible giant groves + dense low patches ------------- */
    const mstats={giantTarget:GIANT_MUSHROOM_TARGET,giants:0,smallTarget:SMALL_MUSHROOM_TARGET,small:0};
    if(w.instNature&&w.instNature.ready&&w.instNature.models&&w.instNature.models.mushroom&&w.instNature.groups){
      const near=w._dbg&&typeof w._dbg.roadNear==="function"?w._dbg.roadNear:null;
      const giant=[],small=[];
      const canPlace=(q,scale,giantMode)=>{
        if(!near)return true;
        const r=near(q.x,q.z);if(!r||r.i<0||r.i>=n)return true;
        const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(r.i):3.35;
        const capRadius=giantMode?.46*scale:.38;
        return r.d>=ww+capRadius+(giantMode?.8:.35);
      };
      const addM=(arr,km,off,scale,giantMode)=>{
        const q=routePose(km,off);if(!canPlace(q,scale,giantMode))return false;
        arr.push(q.km,q.x,w.meshH(q.x,q.z)-.04,q.z,rr()*TAU,scale);return true;
      };
      let tries=0;
      while(mstats.giants<GIANT_MUSHROOM_TARGET&&tries<GIANT_MUSHROOM_TARGET*12){
        const i=tries++,grove=Math.floor(i/18),base=(.55+grove*1.18)%L,side=grove%2?-1:1;
        if(addM(giant,base+(rr()-.5)*.20,side*(10+rr()*30),8.8+rr()*8.5,true))mstats.giants++;
      }
      tries=0;
      while(mstats.small<SMALL_MUSHROOM_TARGET&&tries<SMALL_MUSHROOM_TARGET*8){
        const i=tries++,grove=Math.floor(i/110),base=(.35+grove*.86)%L,side=grove%2?-1:1;
        if(addM(small,base+(rr()-.5)*.24,side*(4+rr()*25),.35+rr()*.55,false))mstats.small++;
      }
      w.instNature.models.mushroomGiantV140=w.instNature.models.mushroom;
      w.instNature.models.mushroomPatchV140=w.instNature.models.mushroom;
      w.instNature.groups.mushroomGiantV140={kind:"mushrooms",range:1.35,instances:giant};
      w.instNature.groups.mushroomPatchV140={kind:"mushrooms",range:1.05,instances:small};
      if(w.instNature.stats){
        const add=mstats.giants+mstats.small;
        w.instNature.stats.mushrooms=(w.instNature.stats.mushrooms||0)+add;
        w.instNature.stats.total=(w.instNature.stats.total||0)+add;
      }
    }

    w.__verdantExpansionV140={
      base:{cats:baseCats,dragonflies:baseDflies,stags:baseStags,buildings:baseBuildings},
      target:{cats:targetCats,dragonflies:targetDflies,stags:targetStags,buildings:targetBuildings},
      added,buildings:bstats,mushrooms:mstats,
      final:{cats:baseCats+added.cats,dragonflies:baseDflies+added.dragonflies,
        stags:baseStags+added.stags,buildings:baseBuildings+bstats.added}
    };
    console.log("Verdant v140 wildlife/buildings/mushrooms:",w.__verdantExpansionV140);
    return w;
  };

  if(typeof globalThis!=="undefined")globalThis.__verdantV140Spec={
    CAT_MULT,DFLY_MULT,STAG_MULT,BUILDING_MULT,GIANT_CAT_FRACTION,
    GIANT_MUSHROOM_TARGET,SMALL_MUSHROOM_TARGET
  };
})();
