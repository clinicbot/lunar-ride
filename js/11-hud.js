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
let hudLast=0;
function hudTick(t){
  if(t-hudLast<100) return; hudLast=t;
  $('tTime').textContent=fmtTime(state.elapsed);
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
  $('sAvgSpd').textContent=(state.elapsed>0?(state.dist/state.elapsed*3.6):0).toFixed(1);
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

