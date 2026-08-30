"use strict";
const fs=require('fs'),vm=require('vm');
const mix=fs.readFileSync('js/39-verdant-common-tree-mix-v134.js','utf8');
const structure=fs.readFileSync('js/40-verdant-common-tree-structure-v135.js','utf8');
for(const k of ["const COMMON_KEYS=['common1','common3','common5']","const STRUCT_RATIO=.10","preservesV134DarkMix:true","preservesWildlife:true","preservesOtherTreeFamilies:true"])
  if(!structure.includes(k))throw new Error('missing v135 marker: '+k);
if(/twisted1|twisted3|pine1|pine3|pine5/.test(structure))throw new Error('v135 structure mix must not target TwistedTree or Pine');

function model(){
  /* two triangle faces: green foliage + brown bark */
  return {pos:new Float32Array([
      -1,2,0, 1,2,0, 0,4,0,
      -.2,0,0, .2,0,0, 0,2,0
    ]),
    nrm:new Float32Array([
      0,0,1,0,0,1,0,0,1,
      0,0,1,0,0,1,0,0,1
    ]),
    col:new Float32Array([
      .18,.82,.16,.18,.82,.16,.18,.82,.16,
      .45,.25,.16,.45,.25,.16,.45,.25,.16
    ]),count:6,triangles:2,file:'fake.gltf'};
}
function instances(n,base){
  const a=[];for(let i=0;i<n;i++)a.push(i*.1,base+i,0,base-i,i*.2,.8);return a;
}
const original={
  common1:instances(20,10),common3:instances(20,40),common5:instances(20,70),twisted1:instances(20,100),pine1:instances(20,130)
};
const ctx={console:{log(){},warn(){}},Float32Array,Uint8Array,Math,
  buildWorld:(sc)=>({actors:[{type:'bear'},{type:'cat'}],instNature:{models:{common1:model(),common3:model(),common5:model(),twisted1:model(),pine1:model()},
    groups:{common1:{kind:'trees',range:1.45,instances:original.common1.slice()},common3:{kind:'trees',range:1.45,instances:original.common3.slice()},
      common5:{kind:'trees',range:1.45,instances:original.common5.slice()},twisted1:{kind:'trees',range:1.45,instances:original.twisted1.slice()},
      pine1:{kind:'trees',range:1.45,instances:original.pine1.slice()}}}})};
vm.runInNewContext(mix,ctx,{filename:'v134'});
vm.runInNewContext(structure,ctx,{filename:'v135'});
const w=ctx.buildWorld({id:'verdant'});
if(w.actors.length!==2||w.actors[0].type!=='bear'||w.actors[1].type!=='cat')throw new Error('wildlife changed');
let light=0,dark=0,compact=0;
for(const key of ['common1','common3','common5']){
  const dk=key+'DarkV134',sk=key+'StructureV135';
  const lg=w.instNature.groups[key],dg=w.instNature.groups[dk],sg=w.instNature.groups[sk];
  if(!dg||!sg||!w.instNature.models[dk]||!w.instNature.models[sk])throw new Error('missing variant '+key);
  const ln=lg.instances.length/6,dn=dg.instances.length/6,sn=sg.instances.length/6;
  if(ln!==13||dn!==5||sn!==2)throw new Error(key+' is not 65/25/10: '+ln+'/'+dn+'/'+sn);
  if(w.instNature.models[dk].pos!==w.instNature.models[key].pos)throw new Error(key+' v134 dark geometry changed');
  if(w.instNature.models[sk].pos===w.instNature.models[key].pos)throw new Error(key+' structure geometry did not change');
  if(w.instNature.models[sk].col!==w.instNature.models[key].col)throw new Error(key+' structure variant should retain original colour buffer');
  if(w.instNature.models[sk].pos[0]===w.instNature.models[key].pos[0]&&w.instNature.models[sk].pos[3]===w.instNature.models[key].pos[3])
    throw new Error(key+' foliage was not compacted');
  light+=ln;dark+=dn;compact+=sn;
}
if(light!==39||dark!==15||compact!==6)throw new Error('overall CommonTree mix is not 65/25/10');
if(w.instNature.groups.twisted1.instances.length!==original.twisted1.length||w.instNature.groups.pine1.instances.length!==original.pine1.length)
  throw new Error('other tree families changed');
if(w.instNature.groups.twisted1StructureV135||w.instNature.groups.pine1StructureV135)throw new Error('other tree family received structure variant');
if(Math.abs(w.__verdantCommonTreeMixV134.actualDarkRatio-.25)>1e-9)throw new Error('v134 dark ratio changed');
if(Math.abs(w.__verdantCommonTreeStructureV135.actualStructureRatio-.10)>1e-9)throw new Error('v135 structure ratio is not 0.10');
console.log('ok: v135 CommonTree mix is 65% original light / 25% dark / 10% compact structure');
