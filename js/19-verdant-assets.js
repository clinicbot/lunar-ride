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

/* Verdant remains v142. Aqua is a separate world: v143 builds the glass
   ocean, v144 imports the real Quaternius fish/reef, v145 corrects their
   imported node transform + hard-isolates fauna, v146 redistributes the fish
   throughout the water column, v147 replaces drone bobbing with sustained
   horizontal swimming, v148 bakes body/tail flex, v149 fixes horizontal tail
   motion + U-turn continuity, v150 adds readable geometric fish faces and a
   reef-only seafloor, v151 was the first coral/jelly enrichment, v152
   rebuilds that layer as visible reef walls using the project's real shared
   creature_jelly.gltf actors, v153 replaces low-detail coral blobs with six
   recognizable coral geometries plus close hero LOD groups, v154 turns the
   close reef into larger overlapping hero clusters on dark reef ledges, v155
   replaces the podium-like ledges with organic reef mounds and fuller close
   coral colonies, v156 imports the four user-provided water-creature meshes,
   v157 moves all 36 uploaded creatures close enough to the glass to read
   during normal riding, v158 matches and removes the full v155 mound/ledge
   box envelope, v159 removes those uploaded creature actors and overlays
   alternating CC0 Poly Haven sand shoulders for an A/B visual comparison,
   and v160 replaces the A/B sand with full-lap rocky/rubble shoulders and
   adds visible fish schools above the buried glass tunnel. */
if(typeof document!=='undefined'&&document.write){
  const b2=typeof APP_STAMP!=='undefined'?APP_STAMP:Date.now();
  document.write('<script src="js/70-verdant-world.js?b='+b2+'"><\/script>');
  document.write('<script src="js/71-aqua-world.js?b='+b2+'"><\/script>');
  document.write('<script src="js/28-verdant-instanced-renderer.js?b='+b2+'"><\/script>');
}
