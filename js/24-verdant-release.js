"use strict";

/* Verdant preview release label.  The shared application is deliberately
   left on its conservative stamp, while Verdant carries its own visible
   release number.  A MutationObserver makes the label reliable even when the
   normal app code rewrites sceneName after this parser-loaded module runs. */
(function(){
  const RELEASE='108';
  const apply=()=>{
    const b=document.getElementById('buildTag');
    if(b)b.textContent='build '+RELEASE;
    const e=document.getElementById('sceneName');
    if(e&&e.textContent&&e.textContent.indexOf('Verdant Rift')>=0){
      e.textContent=e.textContent.replace(/\s·\sv\d+\s*$/,'')+' · v'+RELEASE;
    }
  };

  apply();
  const install=()=>{
    apply();
    const e=document.getElementById('sceneName');
    if(e){
      new MutationObserver(()=>apply()).observe(e,{childList:true,characterData:true,subtree:true});
    }
    /* Ride startup is asynchronous, so also cover the first second explicitly. */
    [50,150,300,600,1000].forEach(ms=>setTimeout(apply,ms));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
