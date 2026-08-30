"use strict";
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('js/42-verdant-twisted-tree-mix-v137.js','utf8');
for(const k of [
  "const FILES={twisted1:'TwistedTree_1.gltf',twisted3:'TwistedTree_3.gltf'}",
  'const DARK_RATIO=.50','v133ExactTwistedAlpha:true','exactV133AlphaOnDarkHalf:true',
  'preservesV136CommonTrees:true','preservesWildlife:true','preservesOtherTreeFamilies:true'
])if(!code.includes(k))throw new Error('missing v137 marker: '+k);
if(/FILES=\{[^}]*common/i.test(code)||/FILES=\{[^}]*pine/i.test(code))
  throw new Error('v137 corrected-model FILES must target TwistedTree only');

const ctx={console:{log(){},warn(){}},Float32Array,Uint8Array,Math,Promise,URL,
  fetch:async()=>({ok:false,status:404}),buildWorld:()=>({})};
vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'v137'});
const split=ctx.__verdantSplitTwistedHalfV137;
if(typeof split!=='function')throw new Error('v137 split helper not exposed');
const instances=[];for(let i=0;i<10;i++)instances.push(i*.1,i,0,-i,i*.2,.8);
const before=instances.slice(),r=split(instances,12345);
if(r.total!==10||r.darkCount!==5||r.light.length/6!==5||r.dark.length/6!==5)
  throw new Error('TwistedTree split is not exact 50/50 for 10 instances');
if(instances.length!==before.length||instances.some((v,i)=>v!==before[i]))
  throw new Error('v137 split mutated original instance list');
console.log('ok: v137 targets only TwistedTree_1/3 and deterministically splits them 50/50');
