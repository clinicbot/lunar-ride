"use strict";

/* ==========================================================================
   5. Rider state and cycling physics  (unchanged from the flat version)
   ========================================================================== */

const state={
  running:false, scene:null,
  s:0, seg:'m', dir:1, choice:'straight', playerX:0, speed:0,
  power:0, cad:0, hr:0,
  dist:0, elapsed:0, elev:0, alt:0,
  pwrSum:0, pwrN:0, maxPwr:0, kj:0, lap:1,
  samples:[], sampleT:0,
  demoTarget:170, demoPhase:0,
  startedAt:null, camMode:0
};
const cfg={rider:78,bike:8,ftp:230,moonG:false,auto:true,difficulty:0.5,
           autoConnect:true, steady:false, steadyGrade:4, descentKeep:0.5,
           sound:true, vol:0.7, riders:6};

function readSetup(){
  cfg.rider=clamp(parseFloat($('inWeight').value)||78,35,180);
  cfg.bike =clamp(parseFloat($('inBike').value)||8,4,25);
  cfg.ftp  =clamp(parseFloat($('inFtp').value)||230,60,600);
  cfg.moonG=$('inMoonG').checked;
  cfg.auto =$('inAuto').checked;
  cfg.autoConnect=$('inReconn').checked;
  cfg.steady=$('inSteadyOn').checked;
  cfg.sound =$('inSound').checked;
  cfg.difficulty =clamp((parseFloat($('inDiff').value)||0)/100,0,1);
  cfg.steadyGrade=clamp(parseFloat($('inSteadyLv').value)||0,0,15);
  cfg.descentKeep=clamp((parseFloat($('inDescent').value)||0)/100,0,1);
  cfg.vol        =clamp((parseFloat($('inVol').value)||0)/100,0,1);
  cfg.riders     =clamp(Math.round(parseFloat($('inRiders').value)||0),0,24);
  const pct=Math.round(cfg.difficulty*100)+'%';
  const lvl=cfg.steadyGrade.toFixed(1)+'%';
  $('diffVal').textContent=pct;
  $('steadyVal').textContent=lvl;
  $('descentVal').textContent=Math.round(cfg.descentKeep*100)+'%';
  $('volVal').textContent=Math.round(cfg.vol*100)+'%';
  $('cMode').textContent=cfg.steady?'Steady':'Sim';
  $('cDiff').textContent=cfg.steady?lvl:pct;
  $('cSound').textContent=cfg.sound?'Sound':'Muted';
  try{localStorage.setItem('lunarride',JSON.stringify(cfg));}catch(e){}
}
function loadSetup(){
  try{
    const s=JSON.parse(localStorage.getItem('lunarride')||'{}');
    if(s.rider)$('inWeight').value=s.rider;
    if(s.bike) $('inBike').value=s.bike;
    if(s.ftp)  $('inFtp').value=s.ftp;
    if(s.difficulty!==undefined)  $('inDiff').value=Math.round(s.difficulty*100);
    if(s.steadyGrade!==undefined) $('inSteadyLv').value=s.steadyGrade;
    if(s.descentKeep!==undefined) $('inDescent').value=Math.round(s.descentKeep*100);
    if(s.vol!==undefined)         $('inVol').value=Math.round(s.vol*100);
    if(s.riders!==undefined)      $('inRiders').value=s.riders;
    $('inMoonG').checked=!!s.moonG;
    $('inAuto').checked=s.auto!==false;
    $('inReconn').checked=s.autoConnect!==false;
    $('inSteadyOn').checked=!!s.steady;
    $('inSound').checked=s.sound!==false;
  }catch(e){}
  readSetup();
}

/* --- resistance, adjustable without leaving the ride --- */
function bumpResist(dir){
  if(cfg.steady) $('inSteadyLv').value=clamp(cfg.steadyGrade+dir*0.5,0,15);
  else           $('inDiff').value=clamp(Math.round(cfg.difficulty*100)+dir*5,0,100);
  readSetup(); gradeSent=999; pushGrade(true);
}
function toggleSteady(){
  $('inSteadyOn').checked=!$('inSteadyOn').checked;
  readSetup(); gradeSent=999; pushGrade(true);
}
function toggleSound(){
  $('inSound').checked=!$('inSound').checked;
  readSetup();
  if(cfg.sound) audioStart();
}

/* --- how much of the HUD is on screen: full -> compact -> metrics only --- */
const HUD_MODES=['','compact','bare'];
let hudMode=0, hintTimer=0;
function setHud(m){
  hudMode=((m%3)+3)%3;
  const h=$('hud');
  h.classList.remove('compact','bare');
  if(HUD_MODES[hudMode]) h.classList.add(HUD_MODES[hudMode]);
  $('cPanels').textContent=['Panels','Fewer','Bare'][hudMode];
  try{localStorage.setItem('lr.hud',hudMode);}catch(e){}
}

/* --- every panel can be dragged anywhere, and stays put --- */
const PANELS=[['topbar','tb'],['left','lf'],['right','rt'],['metrics','mt'],['ctrl','ct']];
function placePanel(el,x,y){
  const w=el.offsetWidth,h=el.offsetHeight;
  el.style.transform='none';
  el.style.left=clamp(x,0,Math.max(0,innerWidth-w))+'px';
  el.style.top =clamp(y,0,Math.max(0,innerHeight-h))+'px';
  el.style.right='auto'; el.style.bottom='auto';
}
function makeDraggable(id,key){
  const el=$(id);
  el.classList.add('drag');
  let down=false,sx=0,sy=0,ox=0,oy=0;
  el.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,select')) return;
    const r=el.getBoundingClientRect();
    placePanel(el,r.left,r.top);
    down=true; sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top;
    try{el.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  });
  el.addEventListener('pointermove',e=>{
    if(!down) return;
    placePanel(el,ox+(e.clientX-sx),oy+(e.clientY-sy));
  });
  const stop=()=>{
    if(!down) return; down=false;
    try{localStorage.setItem('lr.pos.'+key,el.style.left+','+el.style.top);}catch(_){}
  };
  el.addEventListener('pointerup',stop);
  el.addEventListener('pointercancel',stop);
}
function restorePanels(){
  for(const p of PANELS){
    let v=null;
    try{ v=localStorage.getItem('lr.pos.'+p[1]); }catch(e){}
    if(!v) continue;
    const parts=v.split(',');
    const el=$(p[0]);
    el.style.transform='none'; el.style.right='auto'; el.style.bottom='auto';
    el.style.left=parts[0]; el.style.top=parts[1];
  }
}
function resetPanels(){
  for(const p of PANELS){
    try{ localStorage.removeItem('lr.pos.'+p[1]); }catch(e){}
    const el=$(p[0]);
    el.style.left=el.style.top=el.style.right=el.style.bottom=el.style.transform='';
  }
  setHud(0);
  msg('Panels put back where they started.',true);
}

const keys={};
addEventListener('keydown',e=>{
  if(e.key==='Escape'){toggleMenu();e.preventDefault();return;}
  if(e.key==='c'||e.key==='C'){state.camMode=(state.camMode+1)%3;return;}
  if(e.key==='h'||e.key==='H'){setHud(hudMode+1);return;}
  if(e.key==='s'||e.key==='S'){toggleSound();return;}
  if(e.key==='u'||e.key==='U'){doUturn();return;}
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')
     && $('turnUI').style.display==='flex'){
    const side=$('turnUI').dataset.side;
    state.choice=((e.key==='ArrowLeft')===(side==='left'))?'turn':'straight';
    e.preventDefault(); return;
  }
  keys[e.key]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.key]=false;});

const MAX_MS=33;
/* ---- the road network: 'm' is the main loop, 'c' the shortcut ---- */
function segN(seg){return seg==='c'?world.nCut:world.nMain;}
function segBase(seg){return seg==='c'?world.nMain:0;}
function segIdx(seg,s){
  const n=segN(seg);
  let i=Math.floor(s/ROUTE_STEP);
  i=seg==='m'?((i%n)+n)%n:clamp(i,0,n-1);
  return segBase(seg)+i;
}
function segPoint(seg,s,off,out){
  const n=segN(seg), base=segBase(seg);
  let f=s/ROUTE_STEP;
  f=seg==='m'?((f%n)+n)%n:clamp(f,0,n-1.0001);
  const i0=Math.floor(f), t=f-i0;
  const i=base+i0, j=seg==='m'?base+((i0+1)%n):base+Math.min(i0+1,n-1);
  const nx=-world.tz[i], nz=world.tx[i];
  out[0]=lerp(world.rx[i],world.rx[j],t)+nx*off;
  out[1]=lerp(world.ry[i],world.ry[j],t);
  out[2]=lerp(world.rz[i],world.rz[j],t)+nz*off;
  return out;
}
/* where the player is, mapped onto the main loop (for the AI riders etc.) */
function playerMainS(){
  if(state.seg!=='c') return state.s;
  const f=clamp(state.s/world.cutLen,0,1);
  return lerp(world.jnA*ROUTE_STEP, world.jnB*ROUTE_STEP, f);
}
/* the junction the rider is approaching, when a choice is on offer there.
   The shortcut is joined at its aligned end: junction A riding forward,
   junction B riding backward after a U-turn. */
function junctionAhead(){
  if(!world||!world.nCut||state.seg!=='m') return null;
  const L=world.lapLen;
  const J=(state.dir>0?world.jnA:world.jnB)*ROUTE_STEP;
  const d=state.dir>0?(((J-state.s)%L)+L)%L:(((state.s-J)%L)+L)%L;
  if(d<3||d>170) return null;
  return {dist:d, side:state.dir>0?world.sideA:world.sideB};
}
/* walk dist metres the way the rider is facing, crossing junctions */
function walkPath(seg,s,dir,dist,choiceTurn){
  let lap=0, guard=0;
  while(dist>1e-6&&guard++<6){
    if(seg==='m'){
      const L=world.lapLen;
      const J=(dir>0?world.jnA:world.jnB)*ROUTE_STEP;
      let dJ=world.nCut?(dir>0?(((J-s)%L)+L)%L:(((s-J)%L)+L)%L):Infinity;
      if(dJ<1e-4) dJ=L;
      if(!choiceTurn||dist<dJ){
        const s2=s+dir*dist;
        if(dir>0&&s2>=L) lap++;
        s=((s2%L)+L)%L; dist=0;
      }else{
        dist-=dJ; seg='c'; s=dir>0?0:world.cutLen; choiceTurn=false;
      }
    }else{
      const s2=s+dir*dist;
      if(s2>=0&&s2<=world.cutLen){ s=s2; dist=0; }
      else if(s2>world.cutLen){ dist=s2-world.cutLen; seg='m'; s=world.jnB*ROUTE_STEP; }
      else { dist=-s2; seg='m'; s=world.jnA*ROUTE_STEP; }
    }
  }
  return {seg,s,dir,lap};
}
function pathAt(rel,off,out){
  if(rel>=0){
    const r=walkPath(state.seg,state.s,state.dir,rel,state.choice==='turn');
    return segPoint(r.seg,r.s,off,out);
  }
  return segPoint(state.seg,state.s+state.dir*rel,off,out);
}
function advancePlayer(d){
  const before=state.seg;
  const r=walkPath(state.seg,state.s,state.dir,d,state.choice==='turn');
  if(before==='m'&&r.seg==='c') state.choice='straight';   /* the turn was taken */
  state.lap+=r.lap;
  state.seg=r.seg; state.s=r.s;
}
function doUturn(){
  if(!state.scene||!world) return;
  state.dir*=-1; state.choice='straight'; state.playerX*=-1;
  gradeSent=999; pushGrade(true);
}
function gradeNow(){
  return world.grade[segIdx(state.seg,state.s)]*state.dir;
}
function physics(dt){
  const m=cfg.rider+cfg.bike;
  const g=cfg.moonG?1.62:9.81;
  const rho=cfg.moonG?0:1.226;
  const theta=Math.atan(gradeNow()/100);

  const v=Math.max(state.speed,0.6);
  const fProp=(state.power*0.975)/v;
  const fRoll=0.0045*m*g*Math.cos(theta);
  const fAir =0.5*rho*0.325*state.speed*state.speed;
  const fGrav=m*g*Math.sin(theta);

  state.speed=Math.max(0,state.speed+((fProp-fRoll-fAir-fGrav)/m)*dt);
  if(state.power<=0 && state.speed<0.4) state.speed=0;
  state.speed=Math.min(state.speed,cfg.moonG?45:MAX_MS);

  advancePlayer(state.speed*dt);
  state.dist+=state.speed*dt;

  const alt=world.ry[segIdx(state.seg,state.s)];
  const d=alt-state.alt;
  if(d>0 && d<4) state.elev+=d;
  state.alt=alt;

  if(keys.ArrowLeft)  state.playerX-=dt*2.2;
  if(keys.ArrowRight) state.playerX+=dt*2.2;
  if(cfg.auto && !keys.ArrowLeft && !keys.ArrowRight)
    state.playerX=lerp(state.playerX,0,1-Math.pow(0.12,dt));
  const lim=state.scene.road.halfWidth-0.5;
  state.playerX=clamp(state.playerX,-lim,lim);

  state.elapsed+=dt;
  state.kj+=state.power*dt/1000;
  state.pwrSum+=state.power*dt; state.pwrN+=dt;
  if(state.power>state.maxPwr) state.maxPwr=state.power;

  state.sampleT+=dt;
  if(state.sampleT>=1){
    state.sampleT-=1;
    state.samples.push({t:state.elapsed,d:state.dist,a:state.alt,
      s:state.speed,p:Math.round(state.power),c:Math.round(state.cad),h:Math.round(state.hr)});
  }
}
function demoPower(dt){
  if(keys.ArrowUp)   state.demoTarget=clamp(state.demoTarget+140*dt,0,700);
  if(keys.ArrowDown) state.demoTarget=clamp(state.demoTarget-140*dt,0,700);
  state.demoPhase+=dt;
  const wob=Math.sin(state.demoPhase*3.1)*6+Math.sin(state.demoPhase*7.7)*3;
  state.power=lerp(state.power,Math.max(0,state.demoTarget+wob),1-Math.pow(0.02,dt));
  state.cad=state.power>5?lerp(state.cad,78+state.power/22,1-Math.pow(0.05,dt))
                         :lerp(state.cad,0,1-Math.pow(0.02,dt));
}

