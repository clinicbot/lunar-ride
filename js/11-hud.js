"use strict";

/* ==========================================================================
   8. HUD
   ========================================================================== */

const pcv=$('profile'), pctx=pcv.getContext('2d');
let profilePts=[];
function drawProfile(){
  const w=pcv.clientWidth||240,h=64;
  if(pcv.width!==w*2){pcv.width=w*2;pcv.height=h*2;}
  pctx.setTransform(2,0,0,2,0,0);
  pctx.clearRect(0,0,w,h);
  if(!profilePts.length) return;
  let lo=Infinity,hi=-Infinity;
  for(const y of profilePts){if(y<lo)lo=y;if(y>hi)hi=y;}
  const span=Math.max(hi-lo,12);
  const yy=v=>h-4-((v-lo)/span)*(h-12);
  pctx.beginPath(); pctx.moveTo(0,h);
  profilePts.forEach((v,i)=>pctx.lineTo(i/(profilePts.length-1)*w,yy(v)));
  pctx.lineTo(w,h); pctx.closePath();
  const g=pctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,'rgba(127,215,255,.42)'); g.addColorStop(1,'rgba(127,215,255,.04)');
  pctx.fillStyle=g; pctx.fill();
  pctx.strokeStyle='rgba(127,215,255,.85)'; pctx.lineWidth=1.4;
  pctx.beginPath();
  profilePts.forEach((v,i)=>{const px=i/(profilePts.length-1)*w;i?pctx.lineTo(px,yy(v)):pctx.moveTo(px,yy(v));});
  pctx.stroke();
  const t=playerMainS()/world.lapLen, px=t*w;
  const i=Math.min(profilePts.length-1,Math.floor(t*profilePts.length));
  pctx.fillStyle='#fff'; pctx.beginPath(); pctx.arc(px,yy(profilePts[i]),3.2,0,7); pctx.fill();
}
function zoneColour(p){
  const r=p/cfg.ftp;
  if(r<0.56) return '#9fb0c6';
  if(r<0.76) return '#6ee7a8';
  if(r<0.91) return '#8fd8ff';
  if(r<1.06) return '#ffd66e';
  if(r<1.21) return '#ffa04d';
  return '#ff6b6b';
}
/* ---- the route map: the whole lap at a glance, you as the arrow ---- */
const mcv=$('miniMap'), mctx=mcv.getContext('2d');
let mapWorld=null, mapPts=[], mapCut=[], mapB=[0,1,0,1], mapZoom=0, mapView=null;
function buildMap(){
  mapWorld=world;
  const st=Math.max(1,Math.floor(world.nMain/1400));
  mapPts=[];
  for(let i=0;i<world.nMain;i+=st)
    mapPts.push([world.rx[i],world.rz[i],Math.abs(world.grade[i])]);
  mapPts.push(mapPts[0]);
  mapCut=[];
  if(world.nCut>0){
    const st2=Math.max(1,Math.floor(world.nCut/240));
    for(let i=world.nMain;i<world.nPts;i+=st2) mapCut.push([world.rx[i],world.rz[i]]);
  }
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const p of mapPts){
    if(p[0]<x0)x0=p[0]; if(p[0]>x1)x1=p[0];
    if(p[1]<z0)z0=p[1]; if(p[1]>z1)z1=p[1];
  }
  mapB=[x0,x1,z0,z1];
}
function drawMap(){
  if(!world) return;
  if(mapWorld!==world){ buildMap(); mapZoom=0; }
  const w=mcv.clientWidth||188,h=w;
  if(mcv.width!==w*2){mcv.width=w*2;mcv.height=h*2;}
  mctx.setTransform(2,0,0,2,0,0);
  mctx.clearRect(0,0,w,h);
  const [x0,x1,z0,z1]=mapB;
  const fit=Math.min((w-14)/Math.max(x1-x0,1),(h-14)/Math.max(z1-z0,1));
  const sc=fit*([1,2.8,7][mapZoom]||1);
  const cx=mapZoom===0?(x0+x1)/2:riderPos[0];
  const cz=mapZoom===0?(z0+z1)/2:riderPos[2];
  const X=p=>w/2+(p[0]-cx)*sc, Y=p=>h/2+(p[1]-cz)*sc;
  mapView={cx,cz,sc,w,h};
  /* the shortcut first, faint, so the main line draws over the junctions */
  if(mapCut.length>1){
    mctx.strokeStyle='rgba(127,215,255,.65)'; mctx.lineWidth=2; mctx.lineCap='round';
    mctx.beginPath();
    mapCut.forEach((p,i)=>{i?mctx.lineTo(X(p),Y(p)):mctx.moveTo(X(p),Y(p));});
    mctx.stroke();
  }
  /* the route, coloured by gradient like a climb profile */
  mctx.lineWidth=3; mctx.lineCap='round';
  for(let i=1;i<mapPts.length;i++){
    const g=mapPts[i][2];
    mctx.strokeStyle=g>7?'#ff6b6b':(g>3.2?'#ffb45e':'rgba(236,241,248,.88)');
    mctx.beginPath();
    mctx.moveTo(X(mapPts[i-1]),Y(mapPts[i-1]));
    mctx.lineTo(X(mapPts[i]),Y(mapPts[i]));
    mctx.stroke();
  }
  /* start line */
  mctx.fillStyle='#6ee7a8';
  mctx.beginPath(); mctx.arc(X(mapPts[0]),Y(mapPts[0]),3.4,0,7); mctx.fill();
  /* the company: gold with you, blue against you */
  for(const a of world.actors){
    if(a.type!=='rider') continue;
    mctx.fillStyle=a.oncoming?'#8fd8ff':'#ffd66e';
    mctx.beginPath(); mctx.arc(X([a.px,a.pz]),Y([a.px,a.pz]),2.1,0,7); mctx.fill();
  }
  /* you: an arrow pointing your way */
  const ii=segIdx(state.seg,state.s);
  const hx2=world.tx[ii]*state.dir, hz2=world.tz[ii]*state.dir;
  const px=w/2+(riderPos[0]-cx)*sc, py=h/2+(riderPos[2]-cz)*sc;
  const an=Math.atan2(hz2,hx2);
  mctx.save(); mctx.translate(px,py); mctx.rotate(an);
  mctx.fillStyle='#ffffff';
  mctx.beginPath();
  mctx.moveTo(7,0); mctx.lineTo(-4.5,4.2); mctx.lineTo(-2.2,0); mctx.lineTo(-4.5,-4.2);
  mctx.closePath(); mctx.fill();
  mctx.restore();
}
$('mapZoomIn').onclick=()=>{ mapZoom=Math.min(2,mapZoom+1); };
$('mapZoomOut').onclick=()=>{ mapZoom=Math.max(0,mapZoom-1); };
mcv.addEventListener('wheel',e=>{
  e.preventDefault();
  mapZoom=clamp(mapZoom+(e.deltaY<0?1:-1),0,2);
},{passive:false});
/* double-click the map to jump there - a debugging teleport */
mcv.addEventListener('dblclick',e=>{
  if(!world||!mapView) return;
  const r=mcv.getBoundingClientRect();
  const wx=(e.clientX-r.left-mapView.w/2)/mapView.sc+mapView.cx;
  const wz=(e.clientY-r.top-mapView.h/2)/mapView.sc+mapView.cz;
  let bi=0,bd=1e18;
  for(let i=0;i<world.nMain;i+=2){
    const d=(world.rx[i]-wx)*(world.rx[i]-wx)+(world.rz[i]-wz)*(world.rz[i]-wz);
    if(d<bd){bd=d;bi=i;}
  }
  state.s=bi*ROUTE_STEP; state.seg='m';
  state.speed=Math.min(state.speed,3);
});

let hudLast=0;
function hudTick(t){
  if(t-hudLast<100) return; hudLast=t;
  if(world){
    drawMap();
    const L=world.lapLen, s=playerMainS();
    const done=state.dir>0?s:L-s;
    $('mapDone').textContent=(done/1000).toFixed(1)+' km';
    $('mapLeft').textContent=((L-done)/1000).toFixed(1)+' km';
    $('mapBar').style.width=(done/L*100).toFixed(1)+'%';
  }
  $('tTime').textContent=fmtTime(state.rideTime);
  {
    const el=$('tLeft');
    if(cfg.goalMin>0){
      const left=cfg.goalMin*60-state.rideTime;
      el.textContent=left>0?fmtTime(left):'\ud83c\udfc1 done';
    }else if(cfg.goalKm>0){
      const leftM=cfg.goalKm*1000-state.dist;
      if(leftM<=0) el.textContent='\ud83c\udfc1 done';
      else{
        const avg=state.rideTime>30?state.dist/state.rideTime:0;
        el.textContent=(leftM/1000).toFixed(1)+' km'+(avg>0.5?' \u00b7 ~'+fmtTime(leftM/avg):'');
      }
    }else el.textContent='\u2014';
  }
  $('tDist').textContent=(state.dist/1000).toFixed(2)+' km';
  $('tElev').textContent=Math.round(state.elev)+' m';
  $('pwrVal').textContent=Math.round(state.power);
  $('pwrVal').style.color=zoneColour(state.power);
  $('cadVal').textContent=Math.round(state.cad);
  $('spdVal').textContent=(state.speed*3.6).toFixed(1);
  $('hrVal').textContent=Math.round(state.hr);
  const ja=world?junctionAhead():null;
  const tu=$('turnUI');
  if(ja){
    tu.style.display='flex'; tu.dataset.side=ja.side;
    $('tuTurn').textContent=(ja.side==='left'?'\u2B05 TURN LEFT':'TURN RIGHT \u27A1');
    $('tuStraight').className='tuOpt'+(state.choice!=='turn'?' sel':'');
    $('tuTurn').className='tuOpt'+(state.choice==='turn'?' sel':'');
  }else tu.style.display='none';
  const gr=gradeNow();
  $('gradeVal').textContent=(gr>=0?'+':'')+gr.toFixed(1)+'%';
  $('gradeVal').style.color=gr>3?'#ff9f6e':(gr<-3?'#8fd8ff':'var(--txt)');
  const gb=$('gradeBar'),f=clamp(Math.abs(gr)/12,0,1)*50;
  gb.style.width=f+'%'; gb.style.left=gr>=0?'50%':(50-f)+'%';
  gb.style.background=gr>=0?'#ff9f6e':'#8fd8ff';
  $('progBar').style.width=(playerMainS()/world.lapLen*100)+'%';
  $('progTxt').textContent='lap '+state.lap+' · '+(world.lapLen/1000).toFixed(1)+' km';
  $('sAvg').textContent=Math.round(state.pwrN?state.pwrSum/state.pwrN:0)+' W';
  $('sMax').textContent=Math.round(state.maxPwr)+' W';
  $('sAvgSpd').textContent=(state.rideTime>0?(state.dist/state.rideTime*3.6):0).toFixed(1);
  $('sKj').textContent=Math.round(state.kj)+' kJ';
  $('sAlt').textContent=Math.round(state.alt)+' m';
  const live=!!BT.trainer&&(performance.now()-BT.last<4000);
  $('connDot').className=live?'live':'';
  $('sSrc').textContent=BT.trainer?(live?BT.kind:'no data'):'keyboard';
  const res=$('sRes'), ready=!!(BT.ctrl&&BT.ctrlReady);
  if(ready){
    res.textContent=cfg.steady
      ? 'steady '+gradeSent.toFixed(1)+'%'
      : (gradeSent>=0?'+':'')+gradeSent.toFixed(1)+'% @ '+Math.round(cfg.difficulty*100)+'%';
    res.style.color='var(--good)';
  }else{
    res.textContent=BT.trainer?'read-only':'—';
    res.style.color='';
  }
  $('cRes').className='grp'+(ready?'':' off');
  $('gradeLbl').textContent=cfg.steady?'Gradient · steady':'Gradient';
  drawProfile();
}

