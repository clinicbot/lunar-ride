"use strict";
const fs=require('fs'),vm=require('vm');
const code=require('./_section')('js/39-verdant-common-tree-mix-v134.js');
for(const k of ["const COMMON_KEYS=['common1','common3','common5']","const DARK_RATIO=.25","geometryUnchanged:true","positionsUnchanged:true","wildlifeUnchanged:true"])
  if(!code.includes(k))throw new Error('missing v134 marker: '+k);
if(/twisted1|twisted3|pine1|pine3|pine5/.test(code))throw new Error('v134 mix must not target TwistedTree or Pine');

function model(){
  return {pos:new Float32Array([0,0,0,1,0,0,0,1,0]),nrm:new Float32Array([0,1,0,0,1,0,0,1,0]),
    col:new Float32Array([.25,.9,.2,.45,.25,.18,.18,.7,.16]),count:3,triangles:1,file:'fake.gltf'};
}
function instances(n,base){
  const a=[];for(let i=0;i<n;i++)a.push(i*.1,base+i,0,base-i,i*.2,.8);return a;
}
const original={
  common1:instances(8,10),common3:instances(8,30),common5:instances(8,50),twisted1:instances(8,70)
};
const ctx={console:{log(){},warn(){}},Float32Array,Uint8Array,Math,
  buildWorld:(sc)=>({actors:[{type:'bear'}],instNature:{models:{common1:model(),common3:model(),common5:model(),twisted1:model()},
    groups:{common1:{kind:'trees',range:1.45,instances:original.common1.slice()},common3:{kind:'trees',range:1.45,instances:original.common3.slice()},
      common5:{kind:'trees',range:1.45,instances:original.common5.slice()},twisted1:{kind:'trees',range:1.45,instances:original.twisted1.slice()}}}})};
vm.runInNewContext(code,ctx,{filename:'v134'});
const w=ctx.buildWorld({id:'verdant'});
if(w.actors.length!==1||w.actors[0].type!=='bear')throw new Error('wildlife changed');
let light=0,dark=0;
for(const key of ['common1','common3','common5']){
  const dk=key+'DarkV134',lg=w.instNature.groups[key],dg=w.instNature.groups[dk];
  if(!dg||!w.instNature.models[dk])throw new Error('missing dark variant '+key);
  if(lg.instances.length/6!==6||dg.instances.length/6!==2)throw new Error(key+' is not 75/25');
  if(w.instNature.models[dk].pos!==w.instNature.models[key].pos||w.instNature.models[dk].nrm!==w.instNature.models[key].nrm)
    throw new Error(key+' geometry was copied/changed instead of shared');
  if(w.instNature.models[dk].col===w.instNature.models[key].col)throw new Error(key+' dark colour buffer missing');
  light+=lg.instances.length/6;dark+=dg.instances.length/6;
}
if(w.instNature.groups.twisted1.instances.length!==original.twisted1.length)throw new Error('TwistedTree instances changed');
if(w.instNature.groups.twisted1DarkV134)throw new Error('TwistedTree received dark variant');
if(light!==18||dark!==6)throw new Error('overall mix is not 75/25');
if(w.__verdantCommonTreeMixV134.actualDarkRatio!==.25)throw new Error('telemetry ratio is not 0.25');
console.log('ok: v134 preserves v131 geometry/world and mixes CommonTree 75% light / 25% dark');
