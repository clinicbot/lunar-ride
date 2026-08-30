"use strict";

/* Verdant Rift v135 — 10% compact CommonTree structure variant ------------
   Layered on top of the approved v134 75/25 light/dark mix.  Only
   CommonTree_1/3/5 are affected.  v135 moves 10% of the TOTAL CommonTree
   population out of the remaining light group into a compact structural
   variant while keeping the v134 25% dark group untouched.  Result target:
   65% original light + 25% original-geometry dark + 10% compact structure.
   No wildlife, terrain, road, sky, TwistedTree or Pine changes. */
(function(){
  const COMMON_KEYS=['common1','common3','common5'];
  const STRUCT_RATIO=.10;

  function isFoliage(col,i){
    const r=col[i],g=col[i+1],b=col[i+2];
    return g>Math.max(r,b)*1.08&&g>.16;
  }

  function compactVariant(model){
    if(!model||!model.pos||!model.col)return null;
    const srcP=model.pos,srcC=model.col;
    const dstP=new Float32Array(srcP),dstN=new Float32Array(model.nrm||srcP.length);
    const verts=Math.floor(srcP.length/3);
    let cx=0,cy=0,cz=0,n=0,minY=Infinity,maxY=-Infinity;
    for(let v=0;v<verts;v++){
      const i=v*3;
      if(!isFoliage(srcC,i))continue;
      cx+=srcP[i];cy+=srcP[i+1];cz+=srcP[i+2];n++;
      if(srcP[i+1]<minY)minY=srcP[i+1];
      if(srcP[i+1]>maxY)maxY=srcP[i+1];
    }
    if(!n)return null;
    cx/=n;cy/=n;cz/=n;
    const h=Math.max(.001,maxY-minY);
    for(let v=0;v<verts;v++){
      const i=v*3;if(!isFoliage(srcC,i))continue;
      const t=Math.max(0,Math.min(1,(srcP[i+1]-minY)/h));
      /* Slightly tighter at crown/base and a little fuller in the middle. */
      const radial=.73+.10*Math.sin(Math.PI*t);
      dstP[i]=cx+(srcP[i]-cx)*radial;
      dstP[i+2]=cz+(srcP[i+2]-cz)*radial;
      dstP[i+1]=cy+(srcP[i+1]-cy)*1.07+h*.018;
    }
    /* Recompute per-face normals because this model is triangle soup. */
    for(let i=0;i+8<dstP.length;i+=9){
      const ax=dstP[i+3]-dstP[i],ay=dstP[i+4]-dstP[i+1],az=dstP[i+5]-dstP[i+2];
      const bx=dstP[i+6]-dstP[i],by=dstP[i+7]-dstP[i+1],bz=dstP[i+8]-dstP[i+2];
      let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
      const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
      for(let k=0;k<9;k+=3){dstN[i+k]=nx;dstN[i+k+1]=ny;dstN[i+k+2]=nz;}
    }
    return {pos:dstP,nrm:dstN,col:model.col,count:model.count,triangles:model.triangles,
      file:model.file,v135CompactCommon:true};
  }

  function scoreInstance(src,o,keySalt){
    let x=(Math.floor((src[o]||0)*10000)^Math.floor((src[o+1]||0)*37)^
      Math.floor((src[o+3]||0)*23)^keySalt)>>>0;
    x=Math.imul(x^(x>>>16),2246822519)>>>0;
    x=Math.imul(x^(x>>>13),3266489917)>>>0;
    return (x^(x>>>16))>>>0;
  }

  function splitForStructure(lightInstances,darkInstances,keySalt){
    const nLight=Math.floor((lightInstances&&lightInstances.length||0)/6);
    const nDark=Math.floor((darkInstances&&darkInstances.length||0)/6);
    const total=nLight+nDark;
    const target=Math.min(nLight,Math.round(total*STRUCT_RATIO));
    if(!nLight||!target)return {light:lightInstances||[],structure:[],total,nLight,nDark,target:0};
    const ranked=[];
    for(let j=0;j<nLight;j++)ranked.push({j,score:scoreInstance(lightInstances,j*6,keySalt)});
    ranked.sort((a,b)=>a.score-b.score);
    const picked=new Uint8Array(nLight);
    for(let j=0;j<target;j++)picked[ranked[j].j]=1;
    const light=[],structure=[];
    for(let j=0;j<nLight;j++){
      const o=j*6,out=picked[j]?structure:light;
      for(let k=0;k<6;k++)out.push(lightInstances[o+k]);
    }
    return {light,structure,total,nLight,nDark,target};
  }

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.instNature||!w.instNature.models||!w.instNature.groups)return w;

    let total=0,lightTotal=0,darkTotal=0,structureTotal=0,groups=0;
    for(let ki=0;ki<COMMON_KEYS.length;ki++){
      const key=COMMON_KEYS[ki],g=w.instNature.groups[key],m=w.instNature.models[key];
      const darkKey=key+'DarkV134',dg=w.instNature.groups[darkKey];
      if(!g||!m||!g.instances||!g.instances.length)continue;
      const sm=compactVariant(m);if(!sm)continue;
      const part=splitForStructure(g.instances,dg&&dg.instances,0x7f4a7c15^(ki*0x9e3779b9));
      const structKey=key+'StructureV135';
      g.instances=part.light;
      w.instNature.models[structKey]=sm;
      w.instNature.groups[structKey]={kind:g.kind,range:g.range,instances:part.structure};
      total+=part.total;lightTotal+=part.light.length/6;darkTotal+=part.nDark;
      structureTotal+=part.target;groups++;
    }

    w.__verdantCommonTreeStructureV135={groupsProcessed:groups,totalCommonTrees:total,
      lightCommonTrees:lightTotal,darkCommonTrees:darkTotal,structureCommonTrees:structureTotal,
      requestedStructureRatio:STRUCT_RATIO,actualStructureRatio:total?structureTotal/total:0,
      preservesV134DarkMix:true,preservesWildlife:true,preservesOtherTreeFamilies:true};
    console.log('Verdant v135 CommonTree structure mix:',w.__verdantCommonTreeStructureV135);
    return w;
  };
})();
