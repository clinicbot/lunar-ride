"use strict";

/* Verdant Rift v125 — living herds + sampled-palm hero vegetation ----------
   More life, but not more statues. Land animals use the engine's existing
   awareness/grazing/flee state; road-side deer therefore run off the road when
   the rider closes to ~32 m. Frogs are deliberately small and hop/bob through
   compact wetland patches. The uploaded photogrammetry GLB was a ~293k-triangle
   tropical palm: far too heavy for a web ride as-is, so this pass uses its
   proportions/palette as a lightweight procedural hero palm instead. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=="verdant"||!w.actors)return w;

    const rr=mulberry32(sc.seed+125031),n=w.nMain,L=(w.lapLen||25000)/1000;
    const TAU=6.283185307179586;
    const stats={stagHerds:0,stags:0,catGroups:0,cats:0,bearGroups:0,bears:0,
      frogGroups:0,frogs:0,dragonflySwarms:0,dragonflies:0,birdFlocks:0,birds:0,
      monkeyTroops:0,monkeys:0,jellyGroups:0,jellies:0,retunedFrogs:0,palms:0};

    const META={
      stag:{float:0,gait:3.55,turn:.98,rest:.08,eye:1.55,hip:.92,sh:1.28,headY:1.45,headZ:.34},
      cat:{float:0,gait:4.8,turn:1.20,rest:.04,eye:.40,hip:.24,sh:.34,headY:.40,headZ:.20},
      bear:{float:0,gait:2.9,turn:.78,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      frog:{float:.001,gait:4.6,turn:1.20,rest:0,eye:.46,hip:.16,sh:.33,headY:.42,headZ:.20},
      dfly:{float:1.20,gait:0,turn:0,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.02},
      monkey:{float:.01,gait:2.7,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12},
      jelly:{float:2.8,gait:0,turn:0,rest:0,eye:.85,hip:.48,sh:.75,headY:.82,headZ:0}
    };
    const GCRE={stag:"stag",cat:"cat",bear:"vbear",frog:"vfrog",dfly:"dfly",monkey:"vmonkey",jelly:"jelly"};

    const routePose=(km,off)=>{
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      return {i,x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,
        rx:w.rx[i],rz:w.rz[i],yaw:Math.atan2(w.tx[i],w.tz[i])};
    };
    const ready=k=>GLCRE&&GLCRE[k]&&GLCRE[k].ready;

    const addLand=(kind,km,off,k,wr,wspd)=>{
      const g=GCRE[kind]; if(!ready(g))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind],py=w.meshH(p.x,p.z);
      const a={type:"v125_"+kind,gcre:g,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,rdx:p.rx,rdz:p.rz};
      w.actors.push(a);stats[kind+"s"]++;return true;
    };
    const addFloat=(kind,km,off,k,wr,wspd,yadd)=>{
      const g=GCRE[kind]; if(!ready(g))return false;
      const p=routePose(km,off),ph=rr()*TAU,meta=META[kind];
      const ground=w.meshH(p.x,p.z),py=ground+(yadd||0);
      w.actors.push({type:"v125_"+kind,gcre:g,px:p.x,py,pz:p.z,yaw:rr()*TAU,k:k||1,emiss:1,
        meta,ph,hx:p.x,hz:p.z,wr,wander:ph,wspd:(rr()<.5?-1:1)*wspd,
        alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,pinY:py,rdx:p.rx,rdz:p.rz});
      const sk=kind==="dfly"?"dragonflies":kind==="jelly"?"jellies":kind+"s";
      stats[sk]++;return true;
    };

    /* Retune every frog that older enrichment layers already created.  This
       removes the large statue-like frogs from v120 instead of merely adding
       nicer frogs beside them.  A tiny float flag gives a gentle hop/bob while
       the larger wander radius makes the patch visibly alive. */
    for(const a of w.actors){
      if(a&&a.type==="frog"&&a.gcre==="vfrog"){
        const ground=w.meshH(a.px,a.pz),ph=a.ph===undefined?rr()*TAU:a.ph;
        a.k=.34+rr()*.12;a.meta=META.frog;a.ph=ph;a.hx=a.px;a.hz=a.pz;
        a.wr=.9+rr()*1.25;a.wander=ph;a.wspd=(rr()<.5?-1:1)*(.55+rr()*.35);
        a.alert=0;a.headYaw=0;a.headPitch=0;a.swing=0;a.gph=ph;
        a.pinY=ground+.24;a.py=a.pinY;a.flee=0;
        stats.retunedFrogs++;
      }
    }

    /* Deer herds. Two or three animals in selected herds deliberately start
       on/at the road edge; the existing generic animal flee code owns the
       reaction when the rider approaches, so this stays consistent with the
       original Lunar Ride stag behaviour. */
    const deerHerds=[1.55,3.85,5.15,10.65,13.35,15.15,19.55,20.35,23.55,24.35];
    deerHerds.forEach((base,h)=>{
      const count=5+Math.floor(rr()*4),side=h%2?-1:1;stats.stagHerds++;
      for(let j=0;j<count;j++){
        let off;
        if((h===1||h===4||h===7)&&j<3)off=(j-1)*2.1;
        else off=side*(7+rr()*18)+(rr()-.5)*4;
        addLand("stag",base+(rr()-.5)*.13,off,.82+rr()*.24,1.8+rr()*3.0,.11+rr()*.10);
      }
    });

    const catGroups=[[5.55,-1],[6.00,1],[16.25,-1],[16.85,1],[17.40,-1],[21.25,1],[21.70,-1],[23.95,1]];
    catGroups.forEach(([base,side])=>{
      const count=4+Math.floor(rr()*4);stats.catGroups++;
      for(let j=0;j<count;j++)addLand("cat",base+(rr()-.5)*.085,
        side*(5.0+rr()*12),.72+rr()*.22,1.6+rr()*2.4,.24+rr()*.20);
    });

    [[2.85,-1],[8.95,1],[12.85,-1],[18.45,1],[22.75,-1]].forEach(([base,side])=>{
      const count=3+Math.floor(rr()*3);stats.bearGroups++;
      for(let j=0;j<count;j++)addLand("bear",base+(rr()-.5)*.11,
        side*(11+rr()*18),1.00+rr()*.25,3.0+rr()*3.5,.055+rr()*.055);
    });

    const frogPatches=[6.25,6.75,7.25,7.85,8.35,10.15,10.75,11.45,12.15];
    frogPatches.forEach((base,g)=>{
      const count=5+Math.floor(rr()*4);stats.frogGroups++;
      for(let j=0;j<count;j++){
        const side=j%2?-1:1,off=side*(3.8+rr()*7.5);
        addFloat("frog",base+(rr()-.5)*.075,off,.32+rr()*.16,
          .8+rr()*1.3,.55+rr()*.35,.24);
      }
    });

    [6.45,7.45,8.45,9.85,11.15,12.45,13.55].forEach((base,g)=>{
      const count=8+Math.floor(rr()*6);stats.dragonflySwarms++;
      for(let j=0;j<count;j++){
        const side=j%2?-1:1;
        addFloat("dfly",base+(rr()-.5)*.12,side*(3+rr()*10),.55+rr()*.30,
          2.2+rr()*3.0,.75+rr()*.65,1.0+rr()*2.5);
      }
    });

    [[9.45,-1],[10.85,1],[12.25,-1],[13.05,1]].forEach(([base,side])=>{
      stats.monkeyTroops++;
      for(let j=0;j<4+Math.floor(rr()*3);j++)addFloat("monkey",base+(rr()-.5)*.10,
        side*(5+rr()*10),.90+rr()*.25,1.2+rr()*1.4,.10+rr()*.10,2.6+rr()*2.4);
    });
    [[7.15,-1],[8.15,1],[10.35,-1],[11.75,1]].forEach(([base,side])=>{
      stats.jellyGroups++;
      for(let j=0;j<3+Math.floor(rr()*3);j++)addFloat("jelly",base+(rr()-.5)*.10,
        side*(8+rr()*12),.70+rr()*.28,2.0+rr()*2.0,.10+rr()*.08,4.5+rr()*3.0);
    });

    const birdKeys=["bird","bird2","bird3","bird4"].filter(ready);
    const flock=(base,count,seedOff)=>{
      if(!birdKeys.length)return;stats.birdFlocks++;
      for(let j=0;j<count;j++){
        const km=(base+(rr()-.5)*.22+L)%L,p=routePose(km,0),g=birdKeys[(j+seedOff)%birdKeys.length];
        w.actors.push({type:"gbird",gcre:g,cx:p.x,cz:p.z,R:18+rr()*55,circ:rr()*TAU,
          w:(rr()<.5?-1:1)*(.07+rr()*.10),baseY:w.ry[p.i]+12+rr()*32,
          px:p.x,py:w.ry[p.i]+16,pz:p.z,yaw:0,flap:true,flapT:1.0+rr()*1.6,
          gph:rr()*TAU,emiss:1,k:.85+rr()*.55});stats.birds++;
      }
    };
    [0.75,2.65,4.85,6.75,8.65,10.55,12.65,14.85,16.75,18.85,20.75,22.75,24.25]
      .forEach((km,i)=>flock(km,7+Math.floor(rr()*6),i));

    /* The uploaded scan is excellent visual reference but too heavy raw for
       the phone build. This lightweight palm follows its silhouette/palette. */
    if(w.props){
      const pm=new MeshB(),trunk=hx("#5b4938"),leafA=hx("#2f6650"),leafB=hx("#52785a");
      const palm=(km,off,H)=>{
        const p=routePose(km,off),gy=w.meshH(p.x,p.z),yaw=rr()*TAU;
        pm.setTF(p.x,gy,p.z,yaw,1);
        const th=H*.54,seg=th/5,leanX=(rr()-.5)*H*.035,leanZ=(rr()-.5)*H*.035;
        for(let s=0;s<5;s++){
          const f=s/5,cx=leanX*f,cz=leanZ*f,w0=H*(.040-.010*f);
          pm.box(cx,seg*(s+.5),cz,w0,seg*1.04,w0,trunk,.01);
        }
        const top=[leanX,th,leanZ],fronds=11;
        for(let q=0;q<fronds;q++){
          const a=q/fronds*TAU+(rr()-.5)*.18,ca=Math.cos(a),sa=Math.sin(a);
          const len=H*(.31+rr()*.13),wid=H*(.030+rr()*.012),drop=H*(.045+rr()*.055);
          const p0=pm.P(top[0],top[1],top[2]);
          const p1=pm.P(top[0]+ca*len*.40-sa*wid,top[1]+H*.035,top[2]+sa*len*.40+ca*wid);
          const p2=pm.P(top[0]+ca*len*.40+sa*wid,top[1]+H*.035,top[2]+sa*len*.40-ca*wid);
          const tip=pm.P(top[0]+ca*len,top[1]-drop,top[2]+sa*len);
          pm.tri(p0,p1,p2,q&1?leafA:leafB,.01);
          pm.tri(p1,tip,p2,q&1?leafA:leafB,.01);
        }
        stats.palms++;
      };
      [9.35,9.75,10.15,10.65,11.05,11.55,12.05,12.55,13.00,13.45].forEach((km,i)=>{
        palm(km,(i%2?-1:1)*(11+rr()*20),8.5+rr()*4.5);
        if(i%3===0)palm(km+.035,(i%2?1:-1)*(18+rr()*18),7.5+rr()*3.5);
      });
      if(pm.idx.length){
        const base=w.props.pos.length/3;
        const pos=new Float32Array(w.props.pos.length+pm.pos.length);pos.set(w.props.pos);pos.set(pm.pos,w.props.pos.length);
        const nrm=new Float32Array(w.props.nrm.length+pm.nrm.length);nrm.set(w.props.nrm);nrm.set(pm.nrm,w.props.nrm.length);
        const col=new Float32Array(w.props.col.length+pm.col.length);col.set(w.props.col);col.set(pm.col,w.props.col.length);
        const idx=new Uint32Array(w.props.idx.length+pm.idx.length);idx.set(w.props.idx);
        for(let i=0;i<pm.idx.length;i++)idx[w.props.idx.length+i]=base+pm.idx[i];
        w.props={pos,nrm,col,idx};
      }
    }

    w.__verdantWildlifeV125=stats;
    console.log("Verdant v125 living wildlife:",stats);
    return w;
  };
})();
