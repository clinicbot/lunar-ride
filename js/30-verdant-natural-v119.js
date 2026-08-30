"use strict";

/* Verdant Rift v119 — natural clustered forest ----------------------------
   Replaces the evenly spaced v117/v118 placement with irregular groves,
   clearings, hero trees and layered undergrowth.  All geometry remains GPU
   instanced: this file only creates compact transform records. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;

    const I=w.instNature,G=I.groups,M=I.models,n=w.nMain,L=I.routeKm||25;
    const rr=mulberry32(sc.seed+119031);
    const stats={groves:0,heroTrees:0,trees:0,bushes:0,ferns:0,flowers:0,mushrooms:0,rocks:0,total:0};
    const ranges={trees:1.65,bushes:.95,ferns:.76,flowers:.62,mushrooms:.50,rocks:1.12};

    /* v119 owns the imported-nature transform plan.  Keep the parsed models,
       but remove the older regular placement from v117. */
    for(const k in G)if(G[k]&&G[k].instances)G[k].instances.length=0;

    const available=keys=>keys.filter(k=>M[k]);
    const pick=keys=>{const a=available(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const tri=()=>((rr()+rr()+rr())/3-.5)*2; // centre-biased -1..1
    const group=(key,kind)=>{
      if(!G[key])G[key]={kind,range:ranges[kind]||1,instances:[]};
      G[key].kind=kind;G[key].range=Math.max(G[key].range||0,ranges[kind]||1);
      return G[key];
    };
    const add=(km,off,key,scale,kind)=>{
      if(!key||!M[key]||!Number.isFinite(km)||!Number.isFinite(off))return false;
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      group(key,kind).instances.push(km,x,y,z,rr()*6.283185,scale);
      stats[kind]++;stats.total++;return true;
    };

    const sections=[
      {k0:0,k1:4, gap:.20,open:.16,intensity:1.00,
       trees:['common5','common3','common1'],bushes:['bush','bushFlowers'],low:['fern','flower4']},
      {k0:4,k1:9, gap:.16,open:.05,intensity:1.20,
       trees:['common5','common3','common1','twisted1','twisted3'],bushes:['bush','bushFlowers'],low:['fern']},
      {k0:9,k1:14,gap:.145,open:.04,intensity:1.27,
       trees:['common5','twisted1','twisted3'],bushes:['bushFlowers','bush'],low:['fern','flower4','mushroom']},
      {k0:14,k1:19,gap:.255,open:.26,intensity:.62,
       trees:['dead2','twisted1','common5'],bushes:['bush'],low:['rock1','rock2']},
      {k0:19,k1:23,gap:.145,open:.04,intensity:1.30,
       trees:['pine5','pine1','pine3'],bushes:['bush','fern'],low:['fern','rock1']},
      {k0:23,k1:25,gap:.17,open:.08,intensity:1.12,
       trees:['common5','common3','pine5','twisted1'],bushes:['bush','bushFlowers'],low:['fern','flower4']}
    ];

    const addLow=(km,off,key,scale)=>{
      if(!key)return;
      const kind=key.indexOf('rock')===0?'rocks':key.indexOf('flower')===0?'flowers':
                 key.indexOf('mushroom')===0?'mushrooms':'ferns';
      add(km,off,key,scale,kind);
    };

    const grove=(sec,km,side)=>{
      const intensity=sec.intensity*(.78+rr()*.46);
      const centreOff=side*(14+rr()*45);
      const longR=.035+rr()*.065;      // 35-100 m along route
      const latR=7+rr()*17;
      const treeCount=Math.max(3,Math.round((6+rr()*8)*intensity));
      stats.groves++;

      /* Trees form an irregular oval, with a few outliers. */
      for(let q=0;q<treeCount;q++){
        const near=q<2&&Math.abs(centreOff)<30;
        const k=km+tri()*longR*(q%5===0?1.45:1);
        let off=centreOff+tri()*latR;
        if(Math.abs(off)<6.8)off=(off<0?-1:1)*(6.8+rr()*5);
        const key=pick(sec.trees);
        const sca=(near?1.02:0.70)+rr()*(near?.55:.58);
        add(k,off,key,sca,'trees');
      }

      /* Bushes and low plants are concentrated under and around the grove,
         rather than sprinkled uniformly across the whole map. */
      const bushCount=Math.round((8+rr()*11)*intensity);
      for(let q=0;q<bushCount;q++){
        const k=km+tri()*longR*1.18;
        let off=centreOff+tri()*(latR+7);
        if(Math.abs(off)<4.8)off=(off<0?-1:1)*(4.8+rr()*5);
        add(k,off,pick(sec.bushes),.45+rr()*.68,'bushes');
      }
      const lowCount=Math.round((10+rr()*16)*intensity);
      for(let q=0;q<lowCount;q++){
        const k=km+tri()*longR*1.25;
        let off=centreOff+tri()*(latR+9);
        if(Math.abs(off)<4.2)off=(off<0?-1:1)*(4.2+rr()*4.5);
        const key=pick(sec.low);if(!key)continue;
        const sca=key.indexOf('rock')===0?.34+rr()*.70:key.indexOf('flower')===0?.20+rr()*.38:
                  key.indexOf('mushroom')===0?.20+rr()*.35:.15+rr()*.30;
        addLow(k,off,key,sca);
      }
    };

    for(const sec of sections){
      let km=sec.k0+rr()*sec.gap;
      while(km<sec.k1){
        /* A clearing removes an entire grove, producing the open/closed rhythm
           seen in real woodland instead of a continuous roadside fence. */
        if(rr()>=sec.open){
          const r=rr();
          if(r<.18)grove(sec,km,rr()<.5?-1:1);
          else{
            grove(sec,km,-1);
            if(r>.32)grove(sec,km+(rr()-.5)*.045,1);
          }
        }
        km+=sec.gap*(.68+rr()*.76);
      }

      /* Hero trees: sparse, larger foreground objects with deliberately
         irregular spacing.  They anchor the rider's near view. */
      let hk=sec.k0+.08+rr()*.16;
      while(hk<sec.k1){
        if(rr()>.16&&sec.intensity>.7){
          const sides=rr()<.20?[-1,1]:[rr()<.5?-1:1];
          for(const side of sides){
            add(hk+(rr()-.5)*.025,side*(7.2+rr()*10.5),pick(sec.trees),1.25+rr()*.52,'trees');
            stats.heroTrees++;
          }
        }
        hk+=(.24+rr()*.24)/Math.max(.85,sec.intensity);
      }

      /* Verge layer: subtle low growth close to the trail.  It deliberately
         skips many samples so it never becomes another regular line. */
      let vk=sec.k0+rr()*.025;
      const vergeStep=sec.intensity>1.2?.020:sec.intensity<.7?.052:.030;
      while(vk<sec.k1){
        if(rr()<.68){
          const side=rr()<.5?-1:1;
          const key=rr()<.55?pick(sec.low):pick(sec.bushes);
          if(key){
            if(sec.low.indexOf(key)>=0){
              const sca=key.indexOf('rock')===0?.28+rr()*.46:key.indexOf('flower')===0?.18+rr()*.28:
                        key.indexOf('mushroom')===0?.17+rr()*.26:.13+rr()*.22;
              addLow(vk+(rr()-.5)*.010,side*(4.4+rr()*9),key,sca);
            }else add(vk+(rr()-.5)*.010,side*(5.0+rr()*12),key,.36+rr()*.48,'bushes');
          }
        }
        vk+=vergeStep*(.70+rr()*.75);
      }
    }

    I.stats={trees:stats.trees,bushes:stats.bushes,ferns:stats.ferns,flowers:stats.flowers,
             mushrooms:stats.mushrooms,rocks:stats.rocks,total:stats.total};
    I.naturalV119=stats;
    w.__realNature={ready:true,mode:'gpu-instanced-natural-v119',stats};
    console.log('Verdant v119 natural forest:',stats);
    return w;
  };
})();
