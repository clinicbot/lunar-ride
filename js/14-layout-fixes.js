"use strict";

/* Keep user-positioned HUD panels visible when the viewport changes.
   This is intentionally separate from ride physics: it only corrects layout. */
(function(){
  let raf=0;
  function clampPlacedPanels(){
    if(typeof PANELS==='undefined'||typeof placePanel!=='function') return;
    for(const p of PANELS){
      const el=$(p[0]);
      if(!el) continue;
      const x=parseFloat(el.style.left), y=parseFloat(el.style.top);
      if(!Number.isFinite(x)||!Number.isFinite(y)) continue;
      placePanel(el,x,y);
      try{localStorage.setItem('lr.pos.'+p[1],el.style.left+','+el.style.top);}catch(e){}
    }
  }
  function queueClamp(){
    if(raf) cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{raf=0;clampPlacedPanels();});
  }
  queueClamp();
  addEventListener('resize',queueClamp);
  if(window.visualViewport) window.visualViewport.addEventListener('resize',queueClamp);
})();
