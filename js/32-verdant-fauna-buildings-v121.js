"use strict";

/* Verdant Rift v121 — fauna + settlements ----------------------------------
   Uses the static glTF buildings already loaded into GLTREES and the remaining
   creature library already baked into GLCRE.  Buildings are sparse, baked once
   into the world props mesh, and sit on automatic foundations.  Animals are
   lightweight actors with their full runtime state initialized immediately. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant')return w;

    const rr=mulberry32(sc.seed+121031),n=w.nMain,L=(w.lapLen||25000)/1000;
    const stats={buildings:0,buildingTris:0,skippedBuildings:[],stags:0,cats:0,
      jellies:0,dragonflies:0,rays:0,walkers:0,rovers:0,drones:0};
    const mb=new MeshB();
    const MAX_BUILDING_TRIS=450000;
    const foundationCol=hx('#343d3c');

    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      return {i,x,z,yaw:Math.atan2(w.tx[i],w.tz[i])};
    };

    const bounds=model=>{
      if(model.__v121Bounds)return model.__v121Bounds;
      const f=model.norm||1,mn=[1e20,1e20,1e20],mx=[-1e20,-1e20,-1e20];
      let tris=0;
      for(const pr of model.prims||[]){
        const P=pr.pos||[];tris+=Math.floor((pr.idx||[]).length/3);
        for(let v=0;v+2<P.length;v+=3){
          const x=P[v]*f,y=P[v+1]*f,z=P[v+2]*f;
          if(x<mn[0])mn[0]=x;if(y<mn[1])mn[1]=y;if(z<mn[2])mn[2]=z;
          if(x>mx[0])mx[0]=x;if(y>mx[1])mx[1]=y;if(z>mx[2])mx[2]=z;
        }
      }
      model.__v121Bounds={mn,mx,w:Math.max(.01,mx[0]-mn[0]),h:Math.max(.01,mx[1]-mn[1]),
        d:Math.max(.01,mx[2]-mn[2]),cx:(mn[0]+mx[0])*.5,cz:(mn[2]+mx[2])*.5,tris};
      return model.__v121Bounds;
    };

    const stampBuilding=(key,km,off,targetH,yawOff,label)=>{
      const model=GLTREES&&GLTREES[key];
      if(!model||!model.prims||!model.prims.length){stats.skippedBuildings.push(label||key);return false;}
      const b=bounds(model);
      if(stats.buildingTris+b.tris>MAX_BUILDING_TRIS){stats.skippedBuildings.push((label||key)+'(budget)');return false;}
      const p=routePose(km,off),scale=targetH/b.h,yaw=p.yaw+(yawOff||0);
      const fw=b.w*scale,fd=b.d*scale;
      const r=Math.min(22,Math.max(4,Math.max(fw,fd)*.40));
      const samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]];
      let minG=1e20,maxG=-1e20;
      for(const q of samples){const gy=w.meshH(p.x+q[0],p.z+q[1]);if(gy<minG)minG=gy;if(gy>maxG)maxG=gy;}
      if(!Number.isFinite(minG)||!Number.isFinite(maxG)){minG=maxG=w.meshH(p.x,p.z);}

      /* deep enough to hide uneven terrain under a large footprint */
      const fh=Math.max(1.0,(maxG-minG)+1.0);
      mb.setTF(p.x,minG-.55,p.z,yaw,1);
      mb.box(0,0,0,fw+3.5,fh,fd+3.5,foundationCol,.02);

      mb.setTF(p.x,maxG+.10,p.z,yaw,scale);
      const f=model.norm||1;
      for(const pr of model.prims){
        const P=pr.pos,I=pr.idx,c=pr.col||[.5,.5,.5],em=pr.em||.02;
        for(let t=0;t+2<I.length;t+=3){
          const at=ii=>{
            const j=I[ii]*3;
            return mb.P(P[j]*f-b.cx,P[j+1]*f-b.mn[1],P[j+2]*f-b.cz);
          };
          mb.tri(at(t),at(t+1),at(t+2),c,em);
        }
      }
      stats.buildings++;stats.buildingTris+=b.tris;return true;
    };

    /* Three recognizable settlements rather than a random scatter. */
    const settlement=[
      /* 5–6 km: forest research / ranger outpost */
      ['stSide',5.42,-30,12,.20,'station_side'],
      ['sHang', 5.60, 42,18,-.35,'station_hangar'],
      ['sAnt',  5.76, 55,25,.15,'station_antenna'],
      ['stGate',5.92,-38,14,1.57,'station_gate'],
      ['sRef',  6.05, 62,22,.45,'station_refinery'],

      /* 16–18 km: the main sky-port city */
      ['cGate', 16.02,-34,24,1.57,'city_gate'],
      ['cDome', 16.25, 58,34,.25,'city_dome'],
      ['cTower',16.48,-74,72,-.12,'city_tower'],
      ['cArc',  16.72, 88,58,.30,'city_arcology'],
      ['cSpire',16.98,-96,66,-.28,'city_spire_pair'],
      ['cClu',  17.22, 82,52,.18,'city_cluster'],
      ['sRing', 17.48,-62,38,.38,'station_ring'],

      /* 21–22 km: summit relay */
      ['sAnt',  21.10,-35,28,-.20,'station_antenna_summit'],
      ['sRing', 21.32, 45,28,.30,'station_ring_summit'],
      ['stSide',21.52,-42,13,-.25,'station_side_summit'],
      ['stGate',21.70, 36,13,1.57,'station_gate_summit']
    ];
    for(const s of settlement)stampBuilding(...s);

    if(mb.idx.length&&w.props){
      const base=w.props.pos.length/3;
      const pos=new Float32Array(w.props.pos.length+mb.pos.length);pos.set(w.props.pos);pos.set(mb.pos,w.props.pos.length);
      const nrm=new Float32Array(w.props.nrm.length+mb.nrm.length);nrm.set(w.props.nrm);nrm.set(mb.nrm,w.props.nrm.length);
      const col=new Float32Array(w.props.col.length+mb.col.length);col.set(w.props.col);col.set(mb.col,w.props.col.length);
      const idx=new Uint32Array(w.props.idx.length+mb.idx.length);idx.set(w.props.idx);
      for(let i=0;i<mb.idx.length;i++)idx[w.props.idx.length+i]=base+mb.idx[i];
      w.props={pos,nrm,col,idx};
    }

    /* ---- the rest of the creature library -------------------------------- */
    const META={
      stag:{float:0,gait:3.3,turn:.95,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.4,turn:1.15,rest:.05,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      jelly:{float:3.0,gait:0,turn:0,rest:0,eye:.85,hip:.48,sh:.75,headY:.82,headZ:0},
      dfly:{float:1.25,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02}
    };
    const addCreature=(kind,gcre,km,off,k,yadd)=>{
      if(!w.actors||!GLCRE||!GLCRE[gcre]||!GLCRE[gcre].ready)return false;
      const p=routePose(km,off),meta=META[kind],ph=rr()*6.283185,py=w.meshH(p.x,p.z)+(yadd||0);
      const a={type:'v121_'+kind, gcre, px:p.x,py,pz:p.z,yaw:rr()*6.283185,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr:kind==='stag'?2.6:(kind==='cat'?.9:(kind==='jelly'?1.4:.7)),
        wander:ph,wspd:(rr()<.5?-1:1)*(kind==='stag'?.045:(kind==='cat'?.09:(kind==='dfly'?.55:.08))),
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,gait:meta.gait,rdx:p.x,rdz:p.z};
      if(meta.float)a.pinY=py;
      w.actors.push(a);
      if(kind==='stag')stats.stags++;else if(kind==='cat')stats.cats++;
      else if(kind==='jelly')stats.jellies++;else stats.dragonflies++;
      return true;
    };

    /* deer where the forest opens, including a few close enough to notice */
    [[1.35,-13],[2.15,16],[3.35,-18],[4.35,12],[5.05,-15],[19.25,15],[19.90,-12],[20.45,17],[23.45,-14],[24.20,16]]
      .forEach(v=>addCreature('stag','stag',v[0],v[1],.90+rr()*.22,0));

    /* cats live around the three settlements */
    [[5.46,-8],[5.82,10],[6.02,-11],[16.18,9],[16.66,-12],[17.12,10],[21.18,-8],[21.56,9]]
      .forEach(v=>addCreature('cat','cat',v[0],v[1],.95+rr()*.18,0));

    /* floating jellies over wetland / jungle pools */
    [[6.35,-14,5],[6.78,16,7],[7.20,-18,6],[7.72,13,8],[8.18,-15,5],[8.62,17,7],
     [10.25,-18,6],[10.82,16,8],[11.35,-14,7],[12.10,18,6]]
      .forEach(v=>addCreature('jelly','jelly',v[0],v[1],.80+rr()*.35,v[2]));

    /* dragonflies remain low and close to the trail in the wet sections */
    for(let j=0;j<24;j++){
      const km=6.05+j*.115+(rr()-.5)*.035,side=j%2?-1:1;
      addCreature('dfly','dfly',km,side*(4.5+rr()*9),.85+rr()*.35,1.1+rr()*1.8);
    }

    /* make the ray-birds unmistakable rather than relying only on random bird rotation */
    if(w.actors&&GLCRE.bird4&&GLCRE.bird4.ready){
      for(let j=0;j<7;j++){
        const km=12.2+j*.07,p=routePose(km,0);
        w.actors.push({type:'gbird',gcre:'bird4',cx:p.x,cz:p.z,R:24+j*7,circ:j*.82,
          w:(j&1?-1:1)*(.065+j*.006),baseY:w.ry[p.i]+18+j*2,px:p.x,py:w.ry[p.i]+20,pz:p.z,
          yaw:0,flap:true,flapT:1.6,gph:j*.7,emiss:1,k:1.25+j*.06});stats.rays++;
      }
    }

    /* Extra human/robot activity around the new structures, using the meshes
       already present in the base Verdant actor set. */
    const putExisting=(type,km,off,k)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes[type])return false;
      const p=routePose(km,off),ph=rr()*6.283185;
      if(type==='astro'){
        w.actors.push({type:'astro',cx:p.x,cz:p.z,r:2+rr()*5,w:(rr()<.5?-1:1)*.07,ph,walk:true,
          px:p.x,py:w.meshH(p.x,p.z),pz:p.z,yaw:0,k:k||1});stats.walkers++;
      }else if(type==='rover'){
        w.actors.push({type:'rover',cx:p.x,cz:p.z,r:5+rr()*12,w:(rr()<.5?-1:1)*.05,ph,
          px:p.x,py:w.meshH(p.x,p.z),pz:p.z,yaw:0,k:k||1});stats.rovers++;
      }else if(type==='drone'){
        w.actors.push({type:'drone',cx:p.x,cz:p.z,gy:w.meshH(p.x,p.z),r:18+rr()*28,alt:14+rr()*24,
          ph,w:(rr()<.5?-1:1)*(.10+rr()*.12),px:p.x,py:w.meshH(p.x,p.z)+20,pz:p.z,yaw:0,k:k||1});stats.drones++;
      }
      return true;
    };
    for(const km of [5.45,5.68,5.92,16.15,16.38,16.65,16.90,17.18,17.42,21.18,21.48])
      putExisting('astro',km,(rr()<.5?-1:1)*(8+rr()*12),1);
    for(const km of [5.70,16.48,17.08,21.38])putExisting('rover',km,(rr()<.5?-1:1)*(14+rr()*16),1.1);
    for(const km of [5.58,16.28,16.82,17.35,21.25])putExisting('drone',km,(rr()<.5?-1:1)*(20+rr()*18),1.3);

    stats.allBuildingKeys=['stSide','sHang','sAnt','stGate','sRef','cGate','cDome','cTower','cArc','cSpire','cClu','sRing'];
    stats.allCreatureKeys=['bear','frog','monkey','insect','stag','cat','jelly','dfly','bird','bird2','bird3','bird4'];
    w.__verdantV121=stats;
    console.log('Verdant v121 fauna + settlements:',stats);
    return w;
  };
})();
