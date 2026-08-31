"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/52-aqua-depth-distribution-v146.js','utf8');
for(const m of ['VERSION=146','HEIGHT_BANDS=[-1.5,1.0,4.0,8.0,12.0]','bilateral:true','fullWaterColumn:true','__aquaFishV146'])
  if(!src.includes(m))throw new Error('missing Aqua v146 marker '+m);

const N=240,rx=[],rz=[],ry=[],tx=[],tz=[];
for(let i=0;i<N;i++){rx.push(i*3);rz.push(0);ry.push(2);tx.push(1);tz.push(0);}
const fish=[];
for(let i=0;i<60;i++)fish.push({type:'drone',aquaFish:true,gcre:'aqFishA',ph:i*.17,r:5,alt:20,gy:0,px:0,py:0,pz:0});
const rider={type:'rider'};
const world={nMain:N,rx,rz,ry,tx,tz,groundAt:()=>-5,actors:[...fish,rider],__aquaFishV145:{version:145}};
const ctx={console,Math,buildWorld:()=>world};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const out=ctx.buildWorld({id:'aqua'}),t=out.__aquaFishV146;
if(!t||t.version!==146||t.fish!==60||!t.bilateral||!t.fullWaterColumn)throw new Error('bad telemetry '+JSON.stringify(t));
if(t.left===0||t.right===0||Math.abs(t.left-t.right)>6)throw new Error('fish not bilateral '+JSON.stringify(t));
if(t.byBand.some(v=>v===0))throw new Error('not all height bands populated '+t.byBand);
if(!fish.some(a=>a.__aquaV146Band===0)||!fish.some(a=>a.__aquaV146Band>=3))throw new Error('low/high bands missing');
if(!fish.some(a=>a.py<2.5))throw new Error('no eye-level/low fish created');
if(!fish.some(a=>a.py>9))throw new Error('no high fish retained');
for(const a of fish){
  if(a.alt!==0)throw new Error('old altitude leaked into v146');
  if(a.r<2||a.r>5)throw new Error('swim radius out of range '+a.r);
  if(Math.abs(a.cz)<13)throw new Error('fish school too close to tube '+a.cz);
  if(a.py<-2.8)throw new Error('fish below safe floor clearance '+a.py);
}
if(out.actors[out.actors.length-1]!==rider)throw new Error('non-fish actors changed');
if(!out.__aquaFishV145.correctedByV146)throw new Error('v145 link missing');
if(!src.includes("sc.id!==AQUA_ID"))throw new Error('Aqua-only guard missing');
console.log('ok: Aqua v146 distributes real fish bilaterally from low/eye-level through high water while retaining prior actors unchanged');