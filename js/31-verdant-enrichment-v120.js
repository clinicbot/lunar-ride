"use strict";

/* Verdant Rift v120 — habitat + encounter enrichment ----------------------
   Adds visual depth on top of v119 without duplicating model geometry.
   Everything added here is either a compact GPU instance transform or a
   lightweight actor.  The route, terrain and trainer physics are untouched. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;

    const I=w.instNature,G=I.groups,M=I.models,n=w.nMain,L=I.routeKm||25;
    const rr=mulberry32(sc.seed+120031);
    const stats={trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,
                 bears:0,frogs:0,monkeys:0,insects:0,birds:0,ships:0,drones:0,totalPlants:0};
    const ranges={trees:1.72,bushes:1.02,ferns:.82,flowers:.66,mushrooms:.56,rocks:1.18};
    const available=keys=>keys.filter(k=>M[k]);
    const pick=keys=>{const a=available(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const group=(key,kind)=>{
      if(!G[key])G[key]={kind,range:ranges[kind]||1,instances:[]};
      G[key].kind=kind;G[key].range=Math.max(G[key].range||0,ranges[kind]||1);
      return G[key];
    };
    const addPlant=(km,off,key,scale,kind)=>{
      if(!key||!M[key]||!Number.isFinite(km)||!Number.isFinite(off))return false;
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      group(key,kind).instances.push(km,x,y,z,rr()*6.283185,scale);
      stats[kind]++;stats.totalPlants++;return true;
    };
    const lowKind=key=>key&&key.indexOf('rock')===0?'rocks':key&&key.indexOf('flower')===0?'flowers':
                         key&&key.indexOf('mushroom')===0?'mushrooms':'ferns';
    const biome=km=>{
      if(km<4)return{trees:['common5','common3','common1'],bush:['bush','bushFlowers'],low:['fern','flower4']};
      if(km<9)return{trees:['common5','common3','common1','twisted1','twisted3'],bush:['bush','bushFlowers'],low:['fern']};
      if(km<14)return{trees:['common5','twisted1','twisted3'],bush:['bushFlowers','bush'],low:['fern','flower4','mushroom']};
      if(km<19)return{trees:['dead2','twisted1','common5'],bush:['bush'],low:['rock1','rock2']};
      if(km<23)return{trees:['pine5','pine1','pine3'],bush:['bush','fern'],low:['fern','rock1']};
      return{trees:['common5','common3','pine5','twisted1'],bush:['bush','bushFlowers'],low:['fern','flower4']};
    };

    /* Background forest depth.  Prefer the lighter models in the larger
       clusters; these fill the horizon behind v119's foreground groves. */
    const forestBands=[
      [0.0,4.0,1.00],[4.0,9.0,1.18],[9.0,14.0,1.12],
      [14.0,19.0,.42],[19.0,23.0,1.25],[23.0,25.0,1.08]
    ];
    for(const [k0,k1,intensity] of forestBands){
      let km=k0+.03+rr()*.08;
      const step=.085/Math.max(.55,intensity);
      while(km<k1){
        const b=biome(km);
        for(const side of [-1,1]){
          if(rr()<.84*intensity){
            let pool=b.trees;
            if(km<14&&M.common5)pool=['common5','common5'].concat(pool);
            if(km>=19&&km<23&&M.pine5)pool=['pine5','pine5'].concat(pool);
            const count=1+(rr()<.72?1:0)+(rr()<.28?1:0);
            for(let q=0;q<count;q++){
              const off=side*(28+rr()*58);
              addPlant(km+(rr()-.5)*.075,off,pick(pool),.68+rr()*.58,'trees');
            }
          }
        }
        km+=step*(.72+rr()*.62);
      }
    }

    /* Irregular verge thickets.  Anchors are far apart, but each anchor grows
       a small local patch, so the trail feels lush without becoming a fence. */
    for(let km=.10;km<L;){
      const b=biome(km),rocky=km>=14&&km<19;
      if(rr()>(rocky?.48:.17)){
        const side=rr()<.5?-1:1;
        const centre=side*((rocky?7.5:5.0)+rr()*(rocky?14:12));
        const count=(rocky?2:4)+Math.floor(rr()*(rocky?4:7));
        for(let q=0;q<count;q++){
          const useLow=rr()<.62,key=useLow?pick(b.low):pick(b.bush);
          if(!key)continue;
          const off=centre+side*((rr()-.5)*(rocky?10:8));
          if(useLow){
            const kind=lowKind(key);
            const scale=kind==='rocks'?.30+rr()*.72:kind==='flowers'?.20+rr()*.38:
                        kind==='mushrooms'?.18+rr()*.34:.16+rr()*.32;
            addPlant(km+(rr()-.5)*.030,off,key,scale,kind);
          }else addPlant(km+(rr()-.5)*.030,off,key,.42+rr()*.65,'bushes');
        }
      }
      km+=.075+rr()*.105;
    }

    /* Signature pockets: intentionally denser scenes every few kilometres.
       These are short enough to feel like places rather than a global density
       increase. */
    const pockets=[
      {a:.75,b:1.45,tree:['common5','common3','common1'],low:['fern','flower4'],mul:1.0},
      {a:4.55,b:5.45,tree:['common5','common3','twisted1'],low:['fern'],mul:1.18},
      {a:9.45,b:10.55,tree:['twisted1','twisted3','common5'],low:['fern','flower4','mushroom'],mul:1.32},
      {a:12.05,b:13.10,tree:['twisted1','twisted3','common5'],low:['fern','mushroom'],mul:1.28},
      {a:19.35,b:20.45,tree:['pine5','pine1','pine3'],low:['fern','rock1'],mul:1.30},
      {a:23.55,b:24.45,tree:['common5','common3','pine5'],low:['fern','flower4'],mul:1.10}
    ];
    for(const p of pockets){
      for(let km=p.a+rr()*.025;km<p.b;km+=.040*(.72+rr()*.50)){
        for(const side of [-1,1]){
          if(rr()<.90){
            addPlant(km+(rr()-.5)*.025,side*(10+rr()*28),pick(p.tree),.85+rr()*.70,'trees');
            if(rr()<.55)addPlant(km+(rr()-.5)*.045,side*(24+rr()*36),pick(p.tree),.70+rr()*.60,'trees');
          }
          const lc=2+Math.floor(rr()*4*p.mul);
          for(let q=0;q<lc;q++){
            const key=pick(p.low);if(!key)continue;
            const kind=lowKind(key),scale=kind==='rocks'?.34+rr()*.68:kind==='flowers'?.20+rr()*.38:
              kind==='mushrooms'?.18+rr()*.34:.15+rr()*.31;
            addPlant(km+(rr()-.5)*.032,side*(4.5+rr()*19),key,scale,kind);
          }
        }
      }
    }

    /* Rocky outcrops in the exposed ridge. */
    for(let km=14.15;km<18.85;km+=.18+rr()*.20){
      const side=rr()<.5?-1:1,count=3+Math.floor(rr()*6);
      for(let q=0;q<count;q++)addPlant(km+(rr()-.5)*.075,side*(6+rr()*28),pick(['rock1','rock2']),.42+rr()*1.05,'rocks');
      if(rr()<.42)addPlant(km+(rr()-.5)*.055,-side*(10+rr()*24),pick(['dead2','twisted1']),.68+rr()*.48,'trees');
    }

    /* Wildlife helpers.  These initialize the full runtime state immediately;
       actors added here run after the v19 adapter, so relying on that adapter
       would recreate the v111 black-screen bug. */
    const META={
      bear:{float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      frog:{float:0,gait:4.3,turn:1.2,rest:0,eye:.46,hip:.16,sh:.33,headY:.42,headZ:.20},
      monkey:{float:.01,gait:2.5,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12},
      insect:{float:.01,gait:7.5,turn:1.5,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.05}
    };
    const addAnimal=(type,km,off,k,yadd)=>{
      if(!w.actors||!w.actorMeshes||!w.actorMeshes[type])return false;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off),x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const ph=rr()*6.283185,meta=META[type],py=w.meshH(x,z)+(yadd||0);
      const a={type,px:x,py,pz:z,yaw:rr()*6.283185,k:k||1,emiss:1,meta,ph,hx:x,hz:z,
        wr:type==='bear'?2.2:(type==='frog'?.35:(type==='monkey'?.22:.6)),wander:ph,
        wspd:(i&1?-1:1)*(type==='frog'?.35:(type==='insect'?.7:.05)),alert:0,
        headYaw:0,headPitch:0,swing:0,gph:ph};
      if(type==='monkey'||type==='insect')a.pinY=py;
      if(type==='bear')a.gcre='vbear';else if(type==='frog')a.gcre='vfrog';else if(type==='monkey')a.gcre='vmonkey';
      w.actors.push(a);stats[type==='bear'?'bears':type==='frog'?'frogs':type==='monkey'?'monkeys':'insects']++;return true;
    };

    /* Visible animal encounters, not distant map decoration. */
    [[3.45,-13,1.35],[5.62,12,1.42],[18.35,-14,1.38],[20.72,13,1.45]]
      .forEach(v=>addAnimal('bear',v[0],v[1],v[2],0));
    for(const base of [6.15,6.62,7.08,7.58,8.10,8.55]){
      for(let j=0;j<3;j++)addAnimal('frog',base+(j-1)*.025,(j%2?-1:1)*(4.5+rr()*4),1.35+rr()*.45,0);
    }
    for(let j=0;j<14;j++){
      const km=9.35+j*.26,side=j%2?-1:1;
      addAnimal('monkey',km,side*(5.5+rr()*7),1.15+rr()*.42,2.8+rr()*3.0);
    }
    for(let j=0;j<28;j++){
      const km=7.0+j*.19,side=j%2?-1:1;
      addAnimal('insect',km,side*(4+rr()*11),.85+rr()*.55,1.0+rr()*3.3);
    }

    /* Extra bird encounters distributed across the lap. */
    const birdKeys=['bird','bird2','bird3','bird4'].filter(k=>GLCRE[k]&&GLCRE[k].ready);
    const flock=(baseKm,count,seedOff)=>{
      if(!w.actors)return;
      for(let j=0;j<count;j++){
        const km=(baseKm+j*.045)%L,i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
        const g=birdKeys.length?birdKeys[(j+seedOff)%birdKeys.length]:'bird';
        w.actors.push({type:'gbird',gcre:g,cx:w.rx[i],cz:w.rz[i],R:16+j*6+rr()*8,
          circ:(j+seedOff)*1.31+rr(),w:(j&1?-1:1)*(.09+j*.010),baseY:w.ry[i]+11+j*1.6,
          px:w.rx[i],py:w.ry[i]+13,pz:w.rz[i],yaw:0,flap:true,flapT:1.2+rr()*1.2,
          gph:(j+seedOff)*.79,emiss:1,k:1.05+j*.04});stats.birds++;
      }
    };
    [2.25,5.75,8.75,12.55,15.55,18.30,22.10,24.15].forEach((km,i)=>flock(km,3+(i%3===0?1:0),i));

    /* Larger, lower fly-bys make the existing sky traffic noticeable. */
    if(w.actors){
      for(let j=0;j<4;j++){
        const a=rr()*6.283185;
        w.actors.push({type:'shuttle',gcre:'vship',dx:Math.cos(a),dz:Math.sin(a),
          sx:(rr()*2-1)*420,sz:(rr()*2-1)*420,ph:rr()*6.283185,spd:42+rr()*44,
          alt:85+rr()*145,len:5200,s0:rr()*5200,k:2.0+rr()*1.0});stats.ships++;
      }
      for(const km of [16.15,16.75,17.35,17.80]){
        const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
        w.actors.push({type:'drone',cx:w.rx[i],cz:w.rz[i],gy:w.ry[i],r:18+rr()*34,
          alt:12+rr()*24,ph:rr()*6.283185,w:(rr()<.5?-1:1)*(.11+rr()*.12),
          px:w.rx[i],py:w.ry[i]+22,pz:w.rz[i],yaw:0,k:1.5+rr()*.5});stats.drones++;
      }
    }

    if(I.stats){
      for(const k of ['trees','bushes','ferns','flowers','mushrooms','rocks'])I.stats[k]=(I.stats[k]||0)+stats[k];
      I.stats.total=(I.stats.total||0)+stats.totalPlants;
    }
    I.enrichmentV120=stats;
    w.__verdantV120=stats;
    console.log('Verdant v120 enrichment:',stats);
    return w;
  };
})();
