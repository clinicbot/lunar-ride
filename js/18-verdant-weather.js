"use strict";

/* Verdant Rift weather -----------------------------------------------------
   Screen-space rain + route-aware mist. The richer v132 cloud layers and
   ringed planet live in sky_verdant.svg; weather only modulates mist/rain. */
(function(){
  const sc=SCENES.find(s=>s.id==='verdant');
  if(sc){sc.skyImg='assets/images/sky_verdant.svg?b=132';sc._clearFogDen=sc.sky.fogDen;}

  const cv=document.createElement('canvas');
  cv.id='verdantWeatherFx';
  cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;display:none';
  document.body.appendChild(cv);
  const c=cv.getContext('2d');
  let W=0,H=0,drops=[];
  function size(){
    const d=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(innerWidth*d)),h=Math.max(1,Math.round(innerHeight*d));
    if(w===W&&h===H)return;W=cv.width=w;H=cv.height=h;drops=[];
    for(let i=0;i<520;i++)drops.push({x:Math.random()*W,y:Math.random()*H,l:8+Math.random()*28,v:700+Math.random()*1100,a:.15+Math.random()*.45});
  }
  addEventListener('resize',size);size();

  let last=performance.now();
  function loop(now){
    requestAnimationFrame(loop);
    const dt=Math.min(.05,(now-last)/1000);last=now;
    const active=typeof state!=='undefined'&&state.scene&&state.scene.id==='verdant';
    if(!sc||!active){
      cv.style.display='none';c.clearRect(0,0,W,H);
      if(sc&&sc._clearFogDen)sc.sky.fogDen=sc._clearFogDen;
      return;
    }
    cv.style.display='block';size();
    const km=((state.s||0)/1000)%25,t=state.elapsed||0;
    let wet=0;
    if(km>=6&&km<9) wet=.72;
    else if(km>=9&&km<13) wet=.88;
    else if(km>=18&&km<22.5) wet=.22;
    else wet=.08;
    const pulse=.5+.5*Math.sin(t/72+km*.83+1.4);
    const shower=Math.max(0,Math.sin(t/115+km*.31)-.42)*.55;
    let rain=clamp(wet*(.35+.65*pulse)+shower,0,1);
    if(km>=21&&km<22.5) rain*=.28;
    let mist=(km>=6&&km<13?.55:0)+(km>=18&&km<22.5?.58:0)+rain*.36;
    mist=clamp(mist*(.72+.28*Math.sin(t/95+2.1)),0,1);
    sc.sky.fogDen=(sc._clearFogDen||.00028)*(1+mist*2.9+rain*.65);

    c.clearRect(0,0,W,H);
    if(mist>.05){
      const g=c.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'rgba(205,225,218,'+(mist*.035)+')');
      g.addColorStop(.55,'rgba(195,218,210,'+(mist*.10)+')');
      g.addColorStop(1,'rgba(180,205,196,'+(mist*.16)+')');
      c.fillStyle=g;c.fillRect(0,0,W,H);
    }
    if(rain>.035){
      c.lineWidth=Math.max(1,W/1600);c.lineCap='round';
      const n=Math.floor(drops.length*rain);
      for(let i=0;i<n;i++){
        const d=drops[i];d.y+=d.v*dt*(.55+.7*rain);d.x-=d.v*dt*.16;
        if(d.y>H+40||d.x<-40){d.y=-30-Math.random()*H*.2;d.x=Math.random()*W*1.15;}
        c.strokeStyle='rgba(210,235,240,'+(d.a*(.28+.60*rain))+')';
        c.beginPath();c.moveTo(d.x,d.y);c.lineTo(d.x-d.l*.18,d.y+d.l);c.stroke();
      }
      if(rain>.72){c.fillStyle='rgba(90,125,130,'+((rain-.72)*.10)+')';c.fillRect(0,0,W,H);}
    }
    const flash=rain>.78&&Math.sin(t*.115+3.7)>.997;
    if(flash){c.fillStyle='rgba(225,240,245,.10)';c.fillRect(0,0,W,H);}
  }
  requestAnimationFrame(loop);
})();
