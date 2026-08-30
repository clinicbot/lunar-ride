"use strict";

/* Verdant Rift v134 — 75/25 light/dark CommonTree mix ----------------------
   Keep the proven v131 CommonTree geometry, placement, scale and density.
   Only create a second foliage-colour variant and deterministically move
   exactly ~25% of CommonTree instances into that dark variant.  No alpha
   rebuild, no tree-family removal and no wildlife/terrain/sky changes. */
(function(){
  const COMMON_KEYS=['common1','common3','common5'];
  const DARK_RATIO=.25;

  function darkVariant(model){
    if(!model||!model.col)return null;
    const src=model.col,dst=new Float32Array(src.length);
    for(let i=0;i+2<src.length;i+=3){
      const r=src[i],g=src[i+1],b=src[i+2];
      const greenish=g>Math.max(r,b)*1.08&&g>.16;
      if(greenish){
        /* Darken foliage only; preserve bark/branches and exact geometry. */
        dst[i]=r*.42;
        dst[i+1]=g*.58;
        dst[i+2]=b*.44;
      }else{
        dst[i]=r;dst[i+1]=g;dst[i+2]=b;
      }
    }
    return {pos:model.pos,nrm:model.nrm,col:dst,count:model.count,
      triangles:model.triangles,file:model.file,v134DarkCommon:true};
  }

  function scoreInstance(src,o,keySalt){
    /* Stable 32-bit mix using km/x/z plus key salt, only for visual selection. */
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*31)^
      Math.floor((src[o+3]||0)*17)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }

  function splitGroup(instances,keySalt){
    const n=Math.floor((instances&&instances.length||0)/6);
    if(!n)return {light:instances||[],dark:[],total:0,darkCount:0};
    const ranked=[];
    for(let j=0;j<n;j++)ranked.push({j,score:scoreInstance(instances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const target=Math.round(n*DARK_RATIO),isDark=new Uint8Array(n);
    for(let j=0;j<target;j++)isDark[ranked[j].j]=1;
    const light=[],dark=[];
    for(let j=0;j<n;j++){
      const o=j*6,out=isDark[j]?dark:light;
      for(let k=0;k<6;k++)out.push(instances[o+k]);
    }
    return {light,dark,total:n,darkCount:target};
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;

    let total=0,darkTotal=0,groups=0;
    for(let ki=0;ki<COMMON_KEYS.length;ki++){
      const key=COMMON_KEYS[ki],g=w.instNature.groups[key],m=w.instNature.models[key];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const dm=darkVariant(m);if(!dm)continue;
      const part=splitGroup(g.instances,0x9e3779b9^(ki*0x45d9f3b));
      const darkKey=key+'DarkV134';
      g.instances=part.light;
      w.instNature.models[darkKey]=dm;
      w.instNature.groups[darkKey]={kind:g.kind,range:g.range,instances:part.dark};
      total+=part.total;darkTotal+=part.darkCount;groups++;
    }

    w.__verdantCommonTreeMixV134={groupsProcessed:groups,totalCommonTrees:total,
      lightCommonTrees:total-darkTotal,darkCommonTrees:darkTotal,
      requestedDarkRatio:DARK_RATIO,actualDarkRatio:total?darkTotal/total:0,
      geometryUnchanged:true,positionsUnchanged:true,wildlifeUnchanged:true};
    console.log('Verdant v134 CommonTree mix:',w.__verdantCommonTreeMixV134);
    return w;
  };
})();
