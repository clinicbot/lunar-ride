"use strict";
const fs=require('fs');
const R=f=>fs.readFileSync(f,'utf8');
const exp=R('js/39-verdant-v132-expansion.js');
const sky=R('assets/images/sky_verdant.svg');
const weather=R('js/18-verdant-weather.js');
const loader=R('js/19-verdant-assets.js');
const lite=R('js/25-verdant-lite-richness.js');
const sw=R('sw.js');
for(const marker of ['MAX_TREE_HEIGHT=9.5',"['twisted1','twisted3']",'cleanPropsNearRoad','mushroomTree',
  'bearHerds','catHerds','dragonflySwarms','deerHerds','extraSettlements','__verdantV132'])
  if(!exp.includes(marker))throw new Error('v132 expansion marker missing: '+marker);
if(!exp.includes('verdant_mushroom_tree_v132.b64.0'))throw new Error('v132 mushroom asset reference missing');
const asset=R('assets/models/verdant_mushroom_tree_v132.b64.0').trim();
const glb=Buffer.from(asset,'base64');
if(glb.readUInt32LE(0)!==0x46546c67||glb.readUInt32LE(4)!==2)throw new Error('v132 mushroom asset is not glTF 2 GLB');
const jl=glb.readUInt32LE(12),jt=glb.readUInt32LE(16);
if(jt!==0x4e4f534a)throw new Error('v132 mushroom JSON chunk missing');
const gj=JSON.parse(glb.subarray(20,20+jl).toString('utf8').replace(/\0+$/,'').trim());
const p=gj.meshes?.[0]?.primitives?.[0];
if(!p||p.attributes?.POSITION===undefined||p.attributes?.NORMAL===undefined||p.attributes?.COLOR_0===undefined||p.indices===undefined)
  throw new Error('v132 mushroom attributes incomplete');
const tris=gj.accessors[p.indices].count/3;
if(tris>3000)throw new Error('v132 mushroom triangle budget exceeded: '+tris);
if((sky.match(/<path /g)||[]).length!==0)throw new Error('sky must not restore painted landscape paths');
for(const marker of ['NO painted mountain','real 3-D terrain','ringed-planet','cloud-layer-high','cloud-layer-mid','cloud-layer-low'])
  if(!sky.includes(marker))throw new Error('v132 sky marker missing: '+marker);
if(!weather.includes('sky_verdant.svg?b=132'))throw new Error('v132 sky cache bust missing');
if(!loader.includes('39-verdant-v132-expansion.js?b=132'))throw new Error('v132 expansion loader missing');
if(!lite.includes("const RELEASE='132'"))throw new Error('v132 release label missing');
if(!sw.includes("lunar-ride-v132")||!sw.includes('verdant_mushroom_tree_v132.b64.0'))throw new Error('v132 service-worker wiring missing');
console.log('ok: Verdant v132 expansion, mushroom budget, giant-tree cleanup, wildlife/buildings and richer sky');
