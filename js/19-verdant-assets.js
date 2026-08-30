"use strict";

/* Verdant Rift asset adapter ----------------------------------------------
   Creature upgrades remain optional. Imported vegetation is handled by
   js/26 + js/28; the old baked fern fallback is intentionally gone because it
   copied the entire props mesh and defeated the instancing architecture. */
(function(){
  const oldInit=initGL;
  initGL=function(){
    const r=oldInit();
    loadGLTFCreature('vbear','assets/models/verdant_bear.gltf',{});
    loadGLTFCreature('vfrog','assets/models/verdant_frog.gltf',{});
    loadGLTFCreature('vmonkey','assets/models/verdant_monkey.gltf',{});
    loadGLTFCreature('vship','assets/models/verdant_ship.gltf',{});
    return r;
  };

  const oldBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=oldBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant') return w;

    const META={
      bear:{float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48},
      frog:{float:0,gait:4.3,turn:1.2,rest:0,eye:.46,hip:.16,sh:.33,headY:.42,headZ:.20},
      monkey:{float:.01,gait:2.5,turn:1.0,rest:0,eye:1.18,hip:.55,sh:.95,headY:1.04,headZ:.12},
      insect:{float:.01,gait:7.5,turn:1.5,rest:0,eye:.12,hip:.08,sh:.12,headY:.10,headZ:.05}
    };
    for(let i=0;i<w.actors.length;i++){
      const a=w.actors[i];
      if(META[a.type]){
        a.meta=META[a.type];
        if(a.ph===undefined) a.ph=(i*1.713)%6.28318;
        a.hx=a.px; a.hz=a.pz;
        a.wr=a.type==='bear'?2.2:(a.type==='frog'?.35:(a.type==='monkey'?.22:.6));
        a.wander=a.ph;
        a.wspd=(i&1?-1:1)*(a.type==='frog'?.35:(a.type==='insect'?.7:.05));
        a.alert=0; a.headYaw=0; a.headPitch=0; a.swing=0; a.gph=a.ph;
        if(a.type==='monkey'||a.type==='insect') a.pinY=a.py;
        if(a.type==='bear') a.gcre='vbear';
        else if(a.type==='frog') a.gcre='vfrog';
        else if(a.type==='monkey') a.gcre='vmonkey';
      }
      if(a.type==='shuttle') a.gcre='vship';
    }
    return w;
  };
})();

/* Stable route, v128 legacy mountain removal, then v129 global anti-dome
   shaping + final roadbed BEFORE nature placement. Nature/load enrichment and
   retained fauna follow. v129's final cleanup removes all legacy billboards,
   rejects road-intruding plants, adds dense herds, then GPU instancing draws
   the imported vegetation. */
if(typeof document!=='undefined'&&document.write){
  document.write('<script src="js/20-verdant-route-audit.js?b=129"></script>');
  document.write('<script src="js/21-verdant-terrain-polish.js?b=129"></script>');
  document.write('<script src="js/35-verdant-mountains-v123.js?b=129"></script>');
  document.write('<script src="js/37-verdant-mountains-v129.js?b=129"></script>');
  document.write('<script src="js/25-verdant-lite-richness.js?b=129"></script>');
  document.write('<script src="js/26-verdant-real-nature.js?b=129"></script>');
  document.write('<script src="js/30-verdant-natural-v119.js?b=129"></script>');
  document.write('<script src="js/31-verdant-enrichment-v120.js?b=129"></script>');
  document.write('<script src="js/32-verdant-fauna-buildings-v121.js?b=129"></script>');
  document.write('<script src="js/33-verdant-terrain-birds-v122.js?b=129"></script>');
  document.write('<script src="js/34-verdant-assets-gate-v123.js?b=129"></script>');
  document.write('<script src="js/36-verdant-wildlife-v125.js?b=129"></script>');
  document.write('<script src="js/38-verdant-world-cleanup-v129.js?b=129"></script>');
  document.write('<script src="js/27-verdant-billboard-cleanup.js?b=129"></script>');
  document.write('<script src="js/28-verdant-instanced-renderer.js?b=129"></script>');
}
