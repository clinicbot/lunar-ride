"use strict";

/* Verdant preview release label.  The main application stamp remains the
   conservative shared build stamp; this makes the experimental Verdant build
   obvious in screenshots without touching existing worlds. */
(function(){
  const label=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build 108';
  };
  label();
  addEventListener('load',()=>{
    label();
    if(typeof startRide!=='function')return;
    const oldStart=startRide;
    startRide=function(sc,resume){
      oldStart(sc,resume);
      if(sc&&sc.id==='verdant')setTimeout(()=>{
        const e=document.getElementById('sceneName');
        if(e)e.textContent=sc.name+' · v108';
      },180);
    };
  },{once:true});
})();
