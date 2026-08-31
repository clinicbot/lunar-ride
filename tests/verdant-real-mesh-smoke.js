'use strict';
const fs=require('fs'),vm=require('vm');

/* Build Verdant with the REAL MeshB/model routines from js/02.  The older
   smoke test intentionally stubs those routines for fast geometry invariants;
   this test exists specifically to catch browser-like mesh explosions. */
const files=['js/02-core-geometry.js','js/17-verdant-rift.js','js/20-verdant-route-audit.js','js/21-verdant-terrain-polish.js'];
const prefix=`
var SCENES=[];
var ROUTE_STEP=4;
var cfg={riders:0};
var GLTREES={oak:null,pine:null,vfern:null};
var GLCRE={};
var buildWorld=function(){throw new Error('unexpected legacy world builder');};
var appendGLTF=function(){};
`;
const source=prefix+files.map(f=>'\n/* '+f+' */\n'+require('./_section')(f)).join('\n')+`
;globalThis.__REAL_SCENE=SCENES.find(s=>s.id==='verdant');
globalThis.__REAL_BUILD=buildWorld;
`;
vm.runInThisContext(source,{filename:'verdant-real-bundle.js'});
if(!global.__REAL_SCENE)throw new Error('Verdant scene missing');
const t0=Date.now();
const w=global.__REAL_BUILD(global.__REAL_SCENE);
const ms=Date.now()-t0;
const propTris=w.props&&w.props.idx?w.props.idx.length/3:0;
const terrainTris=w.terrain&&w.terrain.idx?w.terrain.idx.length/3:0;
const roadTris=w.road&&w.road.idx?w.road.idx.length/3:0;
const mem=process.memoryUsage();
console.log(JSON.stringify({ok:true,buildMs:ms,propTris,terrainTris,roadTris,rssMB:(mem.rss/1048576).toFixed(1),heapMB:(mem.heapUsed/1048576).toFixed(1),depth:w.__verdantDepth},null,2));
if(ms>25000)throw new Error('real Verdant build too slow: '+ms+' ms');
if(propTris>1500000)throw new Error('Verdant prop mesh too large: '+propTris+' triangles');
if(mem.rss>900*1048576)throw new Error('Verdant build memory too high: '+(mem.rss/1048576).toFixed(0)+' MB');
