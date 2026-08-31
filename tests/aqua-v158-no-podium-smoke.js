"use strict";
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/64-aqua-no-podium-v158.js','utf8');
for(const marker of ['VERSION=158','completeV155PodiumEnvelopeSuppression:true','matchedHeightMax:.50','preservesV157CreaturePlacement:true']){
  if(!src.includes(marker))throw new Error('missing v158 marker '+marker);
}

class MeshB{
  constructor(){this.calls=[];}
  box(){this.calls.push(Array.from(arguments));}
}

let lastMesh=null;
function baseBuild(sc){
  const m=new MeshB();
  // Exact v155-style mound block: this escaped v157 because h=.28 > .14.
  m.box(.15,.078,-.12,.72,.28,.60,[.12,.16,.18],.010);
  // Exact v155 hero ledge envelope.
  m.box(0,.04,.74,1.95,.11,.46,[.08,.14,.16],.008);
  // Structural tunnel/road-like box: wider than the podium envelope, must stay.
  m.box(0,.50,0,4.0,.35,.50,[.1,.2,.2],.010);
  // Tall decorative geometry: must stay.
  m.box(0,.30,0,.80,.80,.60,[.2,.3,.3],.010);
  lastMesh=m;
  return {actors:[],__aquaV157:{creaturesMovedNearGlass:true,visibleCreatureCount:36,
    smallCreatureGlassGap:[2.2,7.5],leviathanGlassGap:[8,15],coralGroups:2800}};
}

const ctx={console,MeshB,buildWorld:baseBuild,globalThis:null};ctx.globalThis=ctx;
vm.createContext(ctx);vm.runInContext(src,ctx);
const aqua=ctx.buildWorld({id:'aqua'},()=>{});
if(lastMesh.calls.length!==2)throw new Error('expected only two non-podium boxes to survive, got '+lastMesh.calls.length);
if(!aqua.__aquaV158||aqua.__aquaV158.version!==158)throw new Error('v158 telemetry missing');
if(aqua.__aquaV158.podiumBoxesSuppressed!==2)throw new Error('expected two podium boxes suppressed');
if(!aqua.__aquaV158.creaturesRemainNearGlass||aqua.__aquaV158.visibleCreatureCount!==36)throw new Error('v157 creature placement was not preserved');

ctx.buildWorld({id:'verdant'},()=>{});
if(lastMesh.calls.length!==4)throw new Error('non-Aqua boxes were modified');

const v155=fs.readFileSync('js/61-aqua-coral-colonies-v155.js','utf8');
if(!v155.includes('m.box(x,sy*.28,z,sx,sy,sz,col,.010)'))throw new Error('expected v155 mound root-cause box signature changed; review v158 matcher');
if(!v155.includes('heroLevel===2?.28:.22'))throw new Error('expected v155 mound height range changed; review v158 matcher');
console.log('ok: Aqua v158 suppresses the full v155 mound/ledge box envelope while preserving structural boxes, v157 creatures and non-Aqua worlds');
