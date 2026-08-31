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
   box envelope, and v159 removes those uploaded creature actors and overlays
   alternating CC0 Poly Haven sand shoulders for an A/B visual comparison. */
if(typeof document!=='undefined'&&document.write){
  document.write('<script src="js/20-verdant-route-audit.js?b=142"></script>');
  document.write('<script src="js/21-verdant-terrain-polish.js?b=142"></script>');
  document.write('<script src="js/35-verdant-mountains-v123.js?b=142"></script>');
  document.write('<script src="js/37-verdant-mountains-v129.js?b=142"></script>');
  document.write('<script src="js/25-verdant-lite-richness.js?b=142"></script>');
  document.write('<script src="js/26-verdant-real-nature.js?b=142"></script>');
  document.write('<script src="js/30-verdant-natural-v119.js?b=142"></script>');
  document.write('<script src="js/31-verdant-enrichment-v120.js?b=142"></script>');
  document.write('<script src="js/32-verdant-fauna-buildings-v121.js?b=142"></script>');
  document.write('<script src="js/33-verdant-terrain-birds-v122.js?b=142"></script>');
  document.write('<script src="js/34-verdant-assets-gate-v123.js?b=142"></script>');
  document.write('<script src="js/36-verdant-wildlife-v125.js?b=142"></script>');
  document.write('<script src="js/38-verdant-world-cleanup-v129.js?b=142"></script>');
  document.write('<script src="js/27-verdant-billboard-cleanup.js?b=142"></script>');
  document.write('<script src="js/39-verdant-common-tree-mix-v134.js?b=142"></script>');
  document.write('<script src="js/41-verdant-common-tree-compact-v136.js?b=142"></script>');
  document.write('<script src="js/42-verdant-twisted-tree-mix-v137.js?b=142"></script>');
  document.write('<script src="js/44-verdant-purple-flower-megacarpets-v139.js?b=142"></script>');
  document.write('<script src="js/46-verdant-uploaded-mushroom-model-v141.js?b=142"></script>');
  document.write('<script src="js/45-verdant-wildlife-buildings-mushrooms-v140.js?b=142"></script>');
  document.write('<script src="js/47-verdant-uploaded-mushroom-replace-v141.js?b=142"></script>');
  document.write('<script src="js/48-verdant-mushroom-carpet-fix-v142.js?b=142"></script>');
  document.write('<script src="js/49-aqua-rift-v143.js?b=158"></script>');
  document.write('<script src="js/50-aqua-real-fish-v144.js?b=158"></script>');
  document.write('<script src="js/51-aqua-fish-visibility-v145.js?b=158"></script>');
  document.write('<script src="js/52-aqua-depth-distribution-v146.js?b=158"></script>');
  document.write('<script src="js/53-aqua-swim-motion-v147.js?b=158"></script>');
  document.write('<script src="js/54-aqua-tail-animation-v148.js?b=158"></script>');
  document.write('<script src="js/55-aqua-uturn-continuity-v149.js?b=158"></script>');
  document.write('<script src="js/56-aqua-faces-reef-v150.js?b=158"></script>');
  document.write('<script src="js/57-aqua-coral-jelly-v151.js?b=158"></script>');
  document.write('<script src="js/58-aqua-proper-jelly-reef-v152.js?b=158"></script>');
  document.write('<script src="js/59-aqua-hq-coral-v153.js?b=158"></script>');
  document.write('<script src="js/60-aqua-hero-coral-v154.js?b=158"></script>');
  document.write('<script src="js/61-aqua-coral-colonies-v155.js?b=158"></script>');
  document.write('<script src="js/62a-aqua-v156-model-siren.js?b=158"></script>');
  document.write('<script src="js/62b-aqua-v156-model-crawler.js?b=158"></script>');
  document.write('<script src="js/62c-aqua-v156-model-eelbeast.js?b=158"></script>');
  document.write('<script src="js/62d-aqua-v156-model-leviathan.js?b=158"></script>');
  document.write('<script src="js/62-aqua-creatures-v156.js?b=158"></script>');
  document.write('<script src="js/63-aqua-visible-creatures-v157.js?b=158"></script>');
  document.write('<script src="js/64-aqua-no-podium-v158.js?b=158"></script>');
  document.write('<script src="js/65-aqua-sand-ab-v159.js?b=159"></script>');
  document.write('<script src="js/28-verdant-instanced-renderer.js?b=142"></script>');
}
