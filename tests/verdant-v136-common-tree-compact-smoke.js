"use strict";
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('js/41-verdant-common-tree-compact-v136.js','utf8');
for(const k of [
  "const FILES={common1:'CommonTree_1.gltf',common3:'CommonTree_3.gltf',common5:'CommonTree_5.gltf'}",
  'const STRUCT_RATIO=.10',"mat.alphaMode==='MASK'",'isLeaf=masked&&/leaf|leaves/i.test',
  'emit(a,ab,ca','v133ExactCommonAlpha:true','usesExactV133CommonAlpha:true',
  'preservesV134DarkMix:true','preservesOtherTreeFamilies:true'
]) if(!code.includes(k))throw new Error('missing v136 marker: '+k);
const ctx={console:{log(){},warn(){}},buildWorld:()=>null,Float32Array,Uint8Array,Int8Array,Int16Array,Uint16Array,Uint32Array,Math,Map,Promise,URL};
vm.runInNewContext(code,ctx,{filename:'v136'});
const split=ctx.__verdantSplitForCompactV136;
if(typeof split!=='function')throw new Error('v136 split helper missing');
function instances(n,base){const a=[];for(let i=0;i<n;i++)a.push(i*.01,base+i,0,base-i,i*.1,.8);return a;}
const r=split(instances(75,10),instances(25,1000),0x12345678);
if(r.total!==100||r.nLight!==75||r.nDark!==25||r.target!==10)throw new Error('v136 did not target 10% of total CommonTree');
if(r.light.length/6!==65||r.compact.length/6!==10)throw new Error('v136 final population is not 65/25/10');
console.log('ok: v136 uses exact v133 alpha-aware CommonTree form on 10%, preserving 65/25/10 mix');
