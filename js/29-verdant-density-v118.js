"use strict";

/* Verdant Rift v118 — dense clustered instance layer ----------------------
   Adds ONLY compact instance transforms on top of v117.  No imported model is
   duplicated into props.  The goal is visual mass: larger near-road trees,
   layered forest depth and dense low vegetation, with biome-specific species. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.ready)return w;

    const I=w.instNature,G=I.groups,M=I.models;
    const rr=mulberry32(sc.seed+118031),n=w.nMain,L=I.routeKm||25;
    const stats={trees:0,bushes:0,ferns:0,flowers:0,rocks:0,total:0};
    const range={trees:1.45,bushes:.92,ferns:.70,flowers:.60,rocks:1.08};
    const have=keys=>keys.filter(k=>M[k]);
    const pick=keys=>{const a=have(keys);return a.length?a[Math.floor(rr()*a.length)]:null;};
    const group=(key,kind)=>{
      if(!G[key])G[key]={kind,range:range[kind]||1,instances:[]};
      return G[key];
    };
    const add=(km,off,key,scale,kind)=>{
      if(!key||!M[key])return false;
      km=((km%L)+L)%L;
      const i=Math.max(0,Math.min(n-1,Math.floor(km*1000/ROUTE_STEP)));
      const side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      const y=w.meshH(x,z)-.06;
      group(key,kind).instances.push(km,x,y,z,rr()*6.283185,scale);
      stats[kind]++;stats.total++;return true;
    };
    const biome=km=>{
      if(km<4)return{
        trees:['common5','common3','common1'], bushes:['bush','bushFlowers'], low:['fern','flower4']};
      if(km<9)return{
        trees:['common5','common3','common1','twisted1'], bushes:['bush','bushFlowers'], low:['fern']};
      if(km<14)return{
        trees:['common5','twisted1','twisted3'], bushes:['bushFlowers','bush'], low:['fern','flower4']};
      if(km<19)return{
        trees:['dead2','twisted1','common5'], bushes:['bush'], low:['rock1','rock2']};
      if(km<23)return{
        trees:['pine5','pine1','pine3'], bushes:['bush','fern'], low:['fern','rock1']};
      return{
        trees:['common5','pine5','common3','twisted1'], bushes:['bush','bushFlowers'], low:['fern','flower4']};
    };

    /* Near-road rhythm.  These are deliberately larger and closer than v117;
       they are what makes the forest read from the rider camera. */
    for(let km=.02;km<L;km+=.045*(.82+rr()*.36)){
      const b=biome(km);
      for(const side of [-1,1]){
        if(rr()<.93){
          const key=pick(b.trees);
          add(km+(rr()-.5)*.018,side*(7.0+rr()*12.0),key,1.05+rr()*.48,'trees');
          if(rr()<.38)add(km+(rr()-.5)*.030,side*(15+rr()*12),pick(b.trees),.82+rr()*.42,'trees');
        }
      }
    }

    /* Mid/far clusters.  One anchor creates an irregular grove rather than a
       fence-like row.  Low-poly CommonTree_5/Pine_5 are preferred whenever
       present because these instances are numerous. */
    for(let km=.04;km<L;km+=.082*(.80+rr()*.42)){
      const b=biome(km);
      for(const side of [-1,1]){
        if(rr()>.88)continue;
        const count=1+(rr()<.70?1:0)+(rr()<.24?1:0);
        for(let q=0;q<count;q++){
          let pool=b.trees;
          if(km<14&&M.common5)pool=['common5','common5'].concat(pool);
          if(km>=19&&km<23&&M.pine5)pool=['pine5','pine5'].concat(pool);
          const off=side*(22+rr()*43);
          add(km+(rr()-.5)*.080,off,pick(pool),.78+rr()*.58,'trees');
        }
      }
    }

    /* Bush layer: much denser than v117 but cheap geometry. */
    for(let km=.01;km<L;km+=.018*(.82+rr()*.34)){
      const b=biome(km);
      for(const side of [-1,1]){
        if(rr()<.92)add(km+(rr()-.5)*.010,side*(4.8+rr()*24),pick(b.bushes),.62+rr()*.55,'bushes');
        if(rr()<.28)add(km+(rr()-.5)*.024,side*(18+rr()*28),pick(b.bushes),.55+rr()*.48,'bushes');
      }
    }

    /* Ground layer. Ferns are only 288 tris in the uploaded pack, so this is
       where instancing buys us the most richness. */
    for(let km=.006;km<L;km+=.012*(.84+rr()*.32)){
      const b=biome(km);
      for(const side of [-1,1]){
        if(rr()>.86)continue;
        const key=pick(b.low);
        if(!key)continue;
        const kind=key.indexOf('rock')===0?'rocks':key.indexOf('flower')===0?'flowers':'ferns';
        const sca=kind==='rocks'?.38+rr()*.58:kind==='flowers'?.24+rr()*.38:.18+rr()*.25;
        add(km+(rr()-.5)*.008,side*(4.3+rr()*20),key,sca,kind);
      }
    }

    I.densityV118=stats;
    if(I.stats){
      for(const k of ['trees','bushes','ferns','flowers','rocks'])I.stats[k]=(I.stats[k]||0)+stats[k];
      I.stats.total=(I.stats.total||0)+stats.total;
    }
    console.log('Verdant v118 dense instance layer:',stats);
    return w;
  };
})();
