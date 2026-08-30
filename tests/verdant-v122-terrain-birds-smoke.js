'use strict';
const fs=require('fs'),vm=require('vm');

global.ROUTE_STEP=4;
global.mulberry32=a=>function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
global.TEX={gA:{},gN:{},rA:{},rN:{},aA:{},aN:{}};
global.loadImage=async()=>null;
global.conditionTile=()=>{throw new Error('should not condition missing mock images');};
global.glTexFromCanvas=()=>({});
global.glTexFromData=()=>({});
global.drawMesh=()=>{};

const n=7000,fill=v=>{const a=new Float32Array(n);a.fill(v);return a;};
global.buildWorld=()=>({
  lapLen:25000,nMain:n,rx:fill(0),rz:fill(0),ry:fill(10),tx:fill(1),tz:fill(0),actors:[]
});

vm.runInThisContext(fs.readFileSync('js/33-verdant-terrain-birds-v122.js','utf8'),
  {filename:'js/33-verdant-terrain-birds-v122.js'});
const w=buildWorld({id:'verdant',seed:9157});
const s=w.__verdantV122;
if(!s)throw new Error('v122 stats missing');
if(s.birds!==133)throw new Error('expected 133 v122 birds, got '+s.birds);
if(s.flocks!==19)throw new Error('expected 19 flocks, got '+s.flocks);
for(const [k,v] of [['finches',64],['gulls',24],['kestrels',30],['rays',15]])
  if(s[k]!==v)throw new Error('expected '+v+' '+k+', got '+s[k]);
const birds=w.actors.filter(a=>a.type==='gbird');
const kinds=new Set(birds.map(a=>a.gcre));
for(const k of ['bird','bird2','bird3','bird4'])if(!kinds.has(k))throw new Error('missing bird type '+k);
for(const [i,a] of birds.entries())for(const k of ['gcre','cx','cz','R','circ','w','baseY','px','py','pz','yaw','flap','flapT','gph','emiss','k'])
  if(a[k]===undefined||a[k]===null)throw new Error('bird '+i+' missing '+k);
for(const f of ['assets/models/Rocks_Diffuse.png','assets/models/Rocks_Desert_Diffuse.png','assets/models/PathRocks_Diffuse.png'])
  if(!fs.existsSync(f))throw new Error('missing terrain texture '+f);
if(!Array.isArray(s.textureAssets)||s.textureAssets.length!==3)throw new Error('texture telemetry missing');
console.log(JSON.stringify({ok:true,birds:s.birds,flocks:s.flocks,finches:s.finches,gulls:s.gulls,kestrels:s.kestrels,rays:s.rays,textures:s.textureAssets}));
