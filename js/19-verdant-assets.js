"use strict";

/* Verdant Rift asset adapter ----------------------------------------------
   New glTFs are optional upgrades over the procedural fallbacks built into
   js/17.  The world remains rideable if any model is missing or loads late.

   v110 SAFE-LOAD NOTE:
   The experimental foreground/depth pass and baked fern upgrade are disabled
   here.  Both were browser-only sources of extra geometry that the earlier
   headless tests did not represent faithfully.  First priority is to keep the
   proven route/terrain/visual stack loading reliably on the user's machine. */
(function(){
  const oldInit=initGL;
  initGL=function(){
    const r=oldInit();
    loadGLTFCreature('vbear','assets/models/verdant_bear.gltf',{});
    loadGLTFCreature('vfrog','assets/models/verdant_frog.gltf',{});
    loadGLTFCreature('vmonkey','assets/models/verdant_monkey.gltf',{});
    loadGLTFCreature('vship','assets/models/verdant_ship.gltf',{});
    loadGLTFStatic('vfern','assets/models/verdant_fern.gltf',2.5);
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

/* Verdant-only post-processing.  v110 deliberately stops after the proven
   route/terrain/visual passes.  The old js/23 depth pass stays in the repo as
   an experiment, but is NOT loaded by the live app. */
if(typeof document!=='undefined'&&document.write){
  document.write('<script src="js/20-verdant-route-audit.js?b=110"></script>');
  document.write('<script src="js/21-verdant-terrain-polish.js?b=110"></script>');
  document.write('<script src="js/22-verdant-visual-pass.js?b=110"></script>');
  document.write('<script src="js/24-verdant-release.js?b=110"></script>');
}
