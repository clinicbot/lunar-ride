"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/48-verdant-mushroom-carpet-fix-v142.js','utf8');
for(const m of ['MUSHROOM_SCALE_FACTOR=.25','CARPET_MIN_FAR=170','for(const side of [-1,1])','SNOW_ZONE=7','flower4GreenHillsideBlanketV142'])
  if(!src.includes(m))throw new Error('missing v142 marker '+m);

function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const N=3000,rx=[],rz=[],tx=[],tz=[];for(let i=0;i<N;i++){rx.push(i*10);rz.push(0);tx.push(1);tz.push(0);}
const mk=(scales)=>{const a=[];for(let i=0;i<scales.length;i++)a.push(1,0,0,0,0,scales[i]);return a;};
const flower={count:12},mush={count:9},sentinel={count:3};
const world={nMain:N,lapLen:25000,rx,rz,tx,tz,meshH:(x,z)=>Math.abs(z)*.18,
  _dbg:{roadNear:(x,z)=>({i:Math.max(0,Math.min(N-1,Math.round(x/10))),d:Math.abs(z)})},
  verdant:{zoneAt:()=>0,widthAt:()=>3.35},
  __verdantExpansionV140:{final:{cats:40,dragonflies:50,stags:18,buildings:20}},
  __verdantMushroomV141:{ready:true},__verdantPurpleCarpetsV139:{totalPlaced:10},
  instNature:{ready:true,routeKm:25,models:{flower4:flower,flower4MegaCarpetV139:flower,mushroom:mush,mushroomHeroV141:mush,mushroomPatchV141:mush,sentinel},
    groups:{flower4MegaCarpetV139:{kind:'flowers',range:.95,instances:mk(Array(10).fill(.3))},
      mushroom:{kind:'mushrooms',range:.5,instances:mk([.4,.8])},mushroomHeroV141:{kind:'mushrooms',range:1,instances:mk([1,1.8])},
      mushroomPatchV141:{kind:'mushrooms',range:1,instances:mk([.35,.9])},sentinel:{kind:'trees',range:1,instances:mk([1])}},
    stats:{flowers:10,mushrooms:6,total:17}}};
const patches=[{km:2,side:1,count:100,span:.32,far:55},{km:8,side:-1,count:100,span:.36,far:60}];
const ctx={console,Math,ROUTE_STEP:10,mulberry32,buildWorld:()=>world,__verdantPurpleCarpetPatchesV139:patches};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);const out=ctx.buildWorld({id:'verdant',seed:9157});
const t=out.__verdantVisualFixV142;if(!t)throw new Error('v142 telemetry missing');
if(t.mushroomScaleFactor!==.25||t.mushroomInstances!==6)throw new Error('mushroom quarter-scale telemetry failed '+JSON.stringify(t));
const scales=[];for(const k of ['mushroom','mushroomHeroV141','mushroomPatchV141'])for(let i=5;i<out.instNature.groups[k].instances.length;i+=6)scales.push(out.instNature.groups[k].instances[i]);
const expected=[.1,.2,.25,.45,.0875,.225];for(let i=0;i<expected.length;i++)if(Math.abs(scales[i]-expected[i])>1e-9)throw new Error('mushroom scale mismatch '+scales+' expected '+expected);
if(out.instNature.groups.flower4MegaCarpetV139)throw new Error('one-sided v139 carpet group remains');
const g=out.instNature.groups.flower4GreenHillsideBlanketV142;if(!g||!g.instances.length)throw new Error('v142 bilateral carpet missing');
let pos=0,neg=0,maxOff=0;for(let i=0;i<g.instances.length;i+=6){const z=g.instances[i+3];if(z>0)pos++;if(z<0)neg++;maxOff=Math.max(maxOff,Math.abs(z));}
if(!pos||!neg)throw new Error('carpet not present on both sides: '+pos+'/'+neg);
if(maxOff<140)throw new Error('carpet does not reach hillside far enough: '+maxOff);
if(t.sidesPerPatch!==2||t.minFar!==170||!t.snowExcluded)throw new Error('bilateral hillside telemetry failed '+JSON.stringify(t));
if(out.instNature.groups.sentinel.instances[5]!==1)throw new Error('unrelated nature changed');
if(out.__verdantExpansionV140.final.cats!==40||out.__verdantExpansionV140.final.buildings!==20)throw new Error('wildlife/buildings changed');
console.log('ok: v142 quarters every mushroom and replaces one-sided carpets with bilateral green-hillside blankets while preserving unrelated world systems');
