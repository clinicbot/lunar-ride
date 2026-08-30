"use strict";

/* Verdant Rift v129 — hard legacy cleanup, road-safe plants, dense wildlife -
   This is the final world-construction pass.  It permanently removes the old
   billboard field, filters every imported nature instance against the NEAREST
   route leg (not merely the leg that spawned it), and adds frequent visible
   animal herds throughout the lap. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w._dbg||typeof w._dbg.roadNear!=='function')return w;

    const near=w._dbg.roadNear;
    const oldBillboardCount=w.veg&&w.veg.count?w.veg.count:0;
    /* Hard disable: never fall back to the old triangular billboard forest,
       even if an imported model failed. Sparse real geometry is preferable to
       the legacy green triangles. */
    w.veg=null;

    let checked=0,rejectedRoad=0,kept=0;
    const rejectedByKind={};
    if(w.instNature&&w.instNature.ready&&w.instNature.groups){
      const margin={trees:5.0,bushes:3.6,ferns:2.8,flowers:2.8,mushrooms:2.6,rocks:2.5};
      const scalePad={trees:1.45,bushes:1.25,ferns:.75,flowers:.70,mushrooms:.65,rocks:.75};
      for(const key in w.instNature.groups){
        const g=w.instNature.groups[key];
        if(!g||!g.instances||!g.instances.length)continue;
        const src=g.instances,out=[],kind=g.kind||'bushes';
        for(let p=0;p+5<src.length;p+=6){
          const km=src[p],x=src[p+1],y=src[p+2],z=src[p+3],yaw=src[p+4],scale=src[p+5];
          checked++;
          const q=near(x,z);
          if(q&&q.i>=0&&q.i<w.nMain){
            const ww=w.verdant&&w.verdant.widthAt?w.verdant.widthAt(q.i):3.35;
            const need=ww+(margin[kind]||3.0)+(scalePad[kind]||.8)*Math.max(.2,scale||1);
            if(q.d<need){rejectedRoad++;rejectedByKind[kind]=(rejectedByKind[kind]||0)+1;continue;}
          }
          out.push(km,x,y,z,yaw,scale);kept++;
        }
        g.instances=out;
      }
    }

    const rr=mulberry32(sc.seed+129381),L=(w.lapLen||25000)/1000,n=w.nMain,TAU=6.283185307179586;
    const ready=k=>typeof GLCRE!=='undefined'&&GLCRE[k]&&GLCRE[k].ready;
    const stats={extraStagHerds:0,stags:0,extraCatGroups:0,cats:0,extraBearGroups:0,bears:0,
      extraMonkeyTroops:0,monkeys:0,extraBirdFlocks:0,birds:0,totalAdded:0};
    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      bear:{float:0,gait:2.9,turn:.78,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      monkey:{float:.01,gait:2.7,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12}
    };
    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,rx:w.rx[i],rz:w.rz[i]};
    };
    const addLand=(kind,gcre,km,off,k,wr,wspd)=>{
      if(!ready(gcre)||!w.actors)return false;
      const p=routePose(km,off),ph=rr()*TAU,py=w.meshH(p.x,p.z);
      w.actors.push({type:'v129_'+kind,gcre,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta:META[kind],ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz});
      stats[kind+'s']++;stats.totalAdded++;return true;
    };

    /* Interleave these with v125's ten herds. The result is roughly one deer
       encounter per kilometre, with 7-11 animals in each new herd and most
       animals close enough to the road to be obvious from the saddle. */
    const extraHerds=[.55,2.45,3.15,4.55,6.05,7.55,8.95,9.85,11.55,12.45,14.15,18.95,21.35,22.15];
    extraHerds.forEach((base,h)=>{
      const count=7+Math.floor(rr()*5),side=h%2?-1:1;stats.extraStagHerds++;
      for(let j=0;j<count;j++){
        const off=side*(7+rr()*14)+(rr()-.5)*3.5;
        addLand('stag','stag',base+(rr()-.5)*.12,off,.96+rr()*.28,2.0+rr()*3.2,.12+rr()*.11);
      }
    });

    [[1.15,-1],[4.95,1],[6.55,-1],[15.55,1],[16.05,-1],[17.85,1],[20.95,-1],[24.65,1]]
      .forEach(([base,side])=>{
        stats.extraCatGroups++;
        for(let j=0;j<5+Math.floor(rr()*4);j++)
          addLand('cat','cat',base+(rr()-.5)*.08,side*(6+rr()*10),.78+rr()*.24,1.8+rr()*2.4,.25+rr()*.20);
      });

    [[2.10,1],[10.10,-1],[13.80,1],[23.10,-1]].forEach(([base,side])=>{
      stats.extraBearGroups++;
      for(let j=0;j<3+Math.floor(rr()*3);j++)
        addLand('bear','vbear',base+(rr()-.5)*.11,side*(12+rr()*15),1.05+rr()*.25,3+rr()*3.4,.06+rr()*.05);
    });

    [[9.15,-1],[10.25,1],[11.85,-1],[12.95,1],[13.65,-1]].forEach(([base,side])=>{
      stats.extraMonkeyTroops++;
      for(let j=0;j<5+Math.floor(rr()*4);j++)
        addLand('monkey','vmonkey',base+(rr()-.5)*.10,side*(7+rr()*10),.95+rr()*.24,1.4+rr()*1.5,.11+rr()*.10);
    });

    const birdKeys=['bird','bird2','bird3','bird4'].filter(ready);
    if(w.actors&&birdKeys.length){
      const flockBases=[1.35,3.45,5.95,7.95,10.05,12.05,14.05,16.15,18.25,20.25,22.45,24.55];
      flockBases.forEach((base,f)=>{
        stats.extraBirdFlocks++;
        const count=6+Math.floor(rr()*4);
        for(let j=0;j<count;j++){
          const p=routePose(base+(rr()-.5)*.18,0),g=birdKeys[(j+f)%birdKeys.length];
          w.actors.push({type:'gbird',gcre:g,cx:p.x,cz:p.z,R:16+rr()*48,circ:rr()*TAU,
            w:(rr()<.5?-1:1)*(.07+rr()*.11),baseY:w.ry[p.i]+10+rr()*28,
            px:p.x,py:w.ry[p.i]+14,pz:p.z,yaw:0,flap:true,flapT:1+rr()*1.6,
            gph:rr()*TAU,emiss:1,k:.90+rr()*.55});
          stats.birds++;stats.totalAdded++;
        }
      });
    }

    w.__verdantRoadPlantCleanupV129={oldBillboardCount,legacyBillboardsDisabled:true,
      checked,rejectedRoad,kept,rejectedByKind};
    w.__verdantWildlifeV129=stats;
    console.log('Verdant v129 world cleanup:',w.__verdantRoadPlantCleanupV129,w.__verdantWildlifeV129);
    return w;
  };
})();
