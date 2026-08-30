"use strict";
const fs=require('fs');
const R=f=>fs.readFileSync(f,'utf8');
const v=R('js/36-verdant-wildlife-v125.js');
const loop=R('js/10-render-loop.js');
const loader=R('js/19-verdant-assets.js');
const lite=R('js/25-verdant-lite-richness.js');
const sw=R('sw.js');

for(const marker of ['stagHerds','catGroups','bearGroups','frogGroups','dragonflySwarms','birdFlocks','monkeyTroops','jellyGroups'])
  if(!v.includes(marker))throw new Error('v125 missing wildlife group marker '+marker);

if(!v.includes('rdx:p.rx,rdz:p.rz'))throw new Error('v125 land animals do not carry road reference for flee behavior');
if(!v.includes('(h===1||h===4||h===7)&&j<3'))throw new Error('road-crossing deer encounters missing');
if(!loop.includes('dist<32')||!loop.includes('a.flee=1')||!loop.includes('a.awayX')||!loop.includes('a.hx+=a.awayX*3.6*dt'))
  throw new Error('generic flee-off-road mechanism missing');

if(!v.includes('a.type==="frog"&&a.gcre==="vfrog"'))throw new Error('old frog retune missing');
if(!v.includes('a.k=.34+rr()*.12')||!v.includes('a.wr=.9+rr()*1.25')||!v.includes('a.pinY=ground+.24'))
  throw new Error('frog scale/motion retune missing');
if(!v.includes('addFloat("frog"')||!v.includes('.32+rr()*.16'))throw new Error('small moving frog patches missing');

if(!v.includes('[6.45,7.45,8.45,9.85,11.15,12.45,13.55]'))throw new Error('dragonfly swarm distribution missing');
if(!v.includes('[0.75,2.65,4.85,6.75,8.65,10.55,12.65,14.85,16.75,18.85,20.75,22.75,24.25]'))
  throw new Error('bird flock distribution missing');
if(!v.includes('const palm=')||!v.includes('stats.palms++'))throw new Error('lightweight jungle palm layer missing');

if(!loader.includes('36-verdant-wildlife-v125.js?b=125'))throw new Error('v125 wildlife script not wired');
if(!lite.includes("const RELEASE='125'"))throw new Error('v125 release label missing');
if(!sw.includes("lunar-ride-v125")||!sw.includes('js/36-verdant-wildlife-v125.js'))throw new Error('v125 service-worker cache wiring missing');

console.log('ok: v125 living herds, flee behavior, moving frogs, swarms/flocks and lightweight palms are wired');
