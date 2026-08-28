"use strict";

/* ==========================================================================
   10. Menu and start-up
   ========================================================================== */

function cardPreview(cvs,sc){
  const c=cvs.getContext('2d'),w=cvs.width=540,h=cvs.height=228;
  const g=c.createLinearGradient(0,0,0,h*0.62);
  g.addColorStop(0,sc.sky.top); g.addColorStop(1,sc.sky.horizon);
  c.fillStyle=g; c.fillRect(0,0,w,h*0.62);
  const r=mulberry32(sc.seed);
  if(sc.sky.stars){
    c.fillStyle='#fff';
    for(let i=0;i<160;i++){c.globalAlpha=.15+r()*.7;c.fillRect(r()*w,r()*h*.55,r()*1.7+.4,r()*1.7+.4);}
    c.globalAlpha=1;
  }
  if(sc.sky.earth){
    const rr=26, ex=w*0.78, ey=h*0.24;
    const gg=c.createRadialGradient(ex-rr*.3,ey-rr*.3,rr*.1,ex,ey,rr);
    gg.addColorStop(0,'#5fa8e8'); gg.addColorStop(1,'#123f7d');
    c.fillStyle=gg; c.beginPath(); c.arc(ex,ey,rr,0,7); c.fill();
  }
  /* a hilly horizon and a road running away from you */
  const hy=h*0.62;
  c.fillStyle=sc.col.low;
  c.beginPath(); c.moveTo(0,hy);
  for(let i=0;i<=40;i++){
    const t=i/40;
    c.lineTo(t*w,hy-(12+Math.abs(Math.sin(t*7+sc.seed))*30+Math.sin(t*19)*8));
  }
  c.lineTo(w,hy); c.closePath(); c.fill();
  const gr=c.createLinearGradient(0,hy,0,h);
  gr.addColorStop(0,sc.col.low); gr.addColorStop(1,sc.col.high);
  c.fillStyle=gr; c.fillRect(0,hy,w,h-hy);
  c.fillStyle=sc.col.road;
  c.beginPath(); c.moveTo(w/2-7,hy); c.lineTo(w/2+7,hy);
  c.lineTo(w*0.82,h); c.lineTo(w*0.18,h); c.closePath(); c.fill();
  c.strokeStyle=sc.col.rumble; c.lineWidth=3;
  c.beginPath(); c.moveTo(w/2-7,hy); c.lineTo(w*0.18,h);
  c.moveTo(w/2+7,hy); c.lineTo(w*0.82,h); c.stroke();
  const fg=c.createLinearGradient(0,hy-26,0,hy+34);
  fg.addColorStop(0,sc.sky.fog); fg.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=fg; c.fillRect(0,hy-26,w,60);
}

function buildMenu(){
  const box=$('scenes'); box.innerHTML='';
  SCENES.forEach(sc=>{
    const d=document.createElement('div');
    d.className='card';
    d.innerHTML='<canvas></canvas><div class="body"><div class="nm"></div>'+
      '<div class="sub"></div><div class="tags"></div></div>';
    d.querySelector('.nm').textContent=sc.name;
    d.querySelector('.sub').textContent=sc.subtitle;
    const est=sc.road.lapKm?sc.road.lapKm.toFixed(1):(2*Math.PI*sc.road.loopR/1000).toFixed(1);
    [~~est+'–'+Math.ceil(est*1.15)+' km lap','up to '+sc.road.maxGrade+'%',
     sc.land.amp>70?'mountainous':(sc.land.amp>45?'rolling':'gentle')]
      .forEach(t=>{const e=document.createElement('span');e.className='tag';e.textContent=t;
        d.querySelector('.tags').appendChild(e);});
    cardPreview(d.querySelector('canvas'),sc);
    if(sc.art){                       /* his AI illustration replaces the sketch */
      const im=new Image();
      im.onload=()=>{const cv=d.querySelector('canvas'); if(cv) cv.replaceWith(im);};
      im.src=sc.art;
      im.style.cssText='display:block;width:100%;height:114px;object-fit:cover';
    }
    d.onclick=()=>startRide(sc);
    box.appendChild(d);
  });
}

function startRide(sc){
  readSetup();
  if(cfg.sound) audioStart();   /* a click is the gesture browsers demand */
  $('menu').classList.add('hide');
  $('loading').classList.add('on');
  $('loadBar').style.width='0%';
  /* let the browser paint the loading screen before we block it */
  setTimeout(()=>{
    try{
      world=buildWorld(sc,p=>{$('loadBar').style.width=(p*100)+'%';});
      uploadWorld(world);
    }catch(err){
      $('loading').classList.remove('on');
      $('menu').classList.remove('hide');
      msg('Could not build the world: '+(err&&err.message||err));
      return;
    }
    profilePts=[];
    const stepP=Math.max(1,Math.floor(world.nMain/240));
    for(let i=0;i<world.nMain;i+=stepP) profilePts.push(world.ry[i]);

    state.scene=sc;
    Object.assign(state,{s:0,seg:'m',dir:1,choice:'straight',playerX:0,speed:0,dist:0,elapsed:0,elev:0,
      alt:world.ry[0],pwrSum:0,pwrN:0,maxPwr:0,kj:0,lap:1,samples:[],sampleT:0,
      startedAt:new Date()});
    $('sceneName').textContent=sc.name+' \u00b7 v'+APP_STAMP;
    $('loading').classList.remove('on');
    $('hud').classList.add('on');
    $('hint').classList.remove('fade');
    clearTimeout(hintTimer);
    hintTimer=setTimeout(function(){$('hint').classList.add('fade');},15000);
    $('btnResume').style.display='';
    $('btnExport').style.display='';
    $('btnEnd').style.display='';
    state.running=true;
  },60);
}

function toggleMenu(){
  if(!state.scene) return;
  if(state.running){
    state.running=false; releaseTrainer();     /* unload the trainer while paused */
    $('menu').classList.remove('hide'); $('hud').classList.remove('on');
  }else{
    readSetup(); state.running=true; gradeSent=999;
    $('menu').classList.add('hide'); $('hud').classList.add('on');
  }
}

let last=0,acc=0;
const STEP_T=1/120;
function frame(t){
  requestAnimationFrame(frame);
  if(!last) last=t;
  let dt=Math.min((t-last)/1000,0.1); last=t;
  if(!state.running) return;
  const live=BT.trainer&&(performance.now()-BT.last<4000);
  if(!live){ if(BT.trainer){state.power=0;state.cad=0;} else demoPower(dt); }
  acc+=dt;
  let guard=0;
  while(acc>=STEP_T&&guard++<40){physics(STEP_T);acc-=STEP_T;}
  updateActors(dt);
  pushGrade();
  audioTick();
  render();
  hudTick(t);
}

/* ---- update check: a long-lived tab or installed app keeps running the
      code it loaded, however many deploys have happened since. Compare our
      cache stamp with the one the server hands out now, and offer a reload
      from the menu when they differ. ---- */
async function checkUpdate(){
  if(APP_STAMP==='?') return;
  try{
    const t=await (await fetch('index.html',{cache:'no-store'})).text();
    const m=t.match(/[?&]b=(\d+)/);
    if(!m||m[1]===APP_STAMP) return;
    let tried=null; try{ tried=sessionStorage.getItem('lr.upd'); }catch(e){}
    if(!state.running&&tried!==m[1]){
      try{ sessionStorage.setItem('lr.upd',m[1]); }catch(e){}
      location.reload();               /* idle at the menu: just take it */
      return;
    }
    $('update').classList.remove('hideU');   /* mid-ride: offer, not force */
  }catch(e){/* offline is fine - ride on */}
}
$('btnUpdate').onclick=()=>location.reload();
checkUpdate();
setInterval(checkUpdate, 5*60*1000);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible') checkUpdate();
});

$('btnTrainer').onclick=connectTrainer;
$('btnHr').onclick=function(){connectHr(false);};
$('btnHrAll').onclick=function(){connectHr(true);};
$('btnForget').onclick=forgetDevices;
$('btnResetPanels').onclick=resetPanels;
$('cMenu').onclick=function(){toggleMenu();};
$('cCam').onclick=function(){state.camMode=(state.camMode+1)%3;};
$('cPanels').onclick=function(){setHud(hudMode+1);};
$('cMode').onclick=toggleSteady;
$('cSound').onclick=toggleSound;
$('cUturn').onclick=doUturn;
$('tuStraight').onclick=function(){state.choice='straight';};
$('tuTurn').onclick=function(){state.choice='turn';};
$('cUp').onclick=function(){bumpResist(1);};
$('cDown').onclick=function(){bumpResist(-1);};
$('btnResume').onclick=()=>toggleMenu();
$('btnExport').onclick=exportTcx;
$('btnEnd').onclick=()=>{
  state.running=false; releaseTrainer(); state.scene=null; world=null;
  $('btnResume').style.display='none';
  $('btnExport').style.display='none';
  $('btnEnd').style.display='none';
  $('hud').classList.remove('on');
  gl&&gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  msg('Ride ended. Pick a world to start another.',true);
};
['inWeight','inBike','inFtp','inMoonG','inAuto','inDiff','inReconn','inSteadyOn',
 'inSteadyLv','inDescent','inSound','inVol','inRiders'].forEach(id=>$(id).onchange=readSetup);
['inDiff','inSteadyLv','inDescent','inVol'].forEach(id=>$(id).oninput=readSetup);

if(!gl){
  $('scenes').innerHTML='';
  msg('This browser cannot do WebGL, which the 3D worlds need. Try Chrome or Edge, '+
      'or open retro.html for the flat version.');
}else{
  initGL();
  loadSetup();
  buildMenu();
  updatePills();
  for(const p of PANELS) makeDraggable(p[0],p[1]);
  restorePanels();
  let hm=0; try{ hm=parseInt(localStorage.getItem('lr.hud')||'0',10)||0; }catch(e){}
  setHud(hm);
  requestAnimationFrame(frame);
  autoConnect();   /* pick the trainer and strap back up without asking */
}
