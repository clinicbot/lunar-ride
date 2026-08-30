"use strict";
const fs=require('fs');
const R=f=>fs.readFileSync(f,'utf8');
const fix=R('js/39-verdant-alpha-leaves-v133.js');
const loader=R('js/19-verdant-assets.js');
const lite=R('js/25-verdant-lite-richness.js');
const sw=R('sw.js');
for(const k of ['common1','common3','common5','twisted1','twisted3','pine1','pine3','pine5'])
  if(!fix.includes(k+':'))throw new Error('tree alpha-fix family missing: '+k);
for(const marker of ["alphaMode==='MASK'",'/leaf|leaves/i','mixV(a,b,.5)','leafSourceTriangles','leafOutputTriangles','preservesWildlife:true'])
  if(!fix.includes(marker))throw new Error('v133 alpha marker missing: '+marker);
if(!loader.includes('39-verdant-alpha-leaves-v133.js?b=133'))throw new Error('v133 alpha script not loaded');
if(loader.indexOf('39-verdant-alpha-leaves-v133.js?b=133')>loader.indexOf('28-verdant-instanced-renderer.js?b=133'))
  throw new Error('alpha correction must load before instanced renderer');
if(!lite.includes("const RELEASE='133'"))throw new Error('v133 release label missing');
if(!sw.includes("lunar-ride-v133")||!sw.includes('js/39-verdant-alpha-leaves-v133.js'))throw new Error('v133 cache wiring missing');
if(fs.existsSync('js/39-verdant-v132-expansion.js'))throw new Error('rejected v132 expansion returned');
console.log('ok: v133 alpha-aware leaves preserve v131 world and replace only tree geometry');
