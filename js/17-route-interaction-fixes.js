"use strict";

/* ==========================================================================\n   17. Alternate-route interaction fixes\n   --------------------------------------------------------------------------\n   The original one-branch movement model was written for a shortcut that the\n   rider always approached from the road. Hand-drawn routes expose two edge\n   cases: starting exactly on a junction and teleporting directly onto a\n   branch. Keep the model, fix those interactions generically.\n   ========================================================================== */

/* A junction at exactly 0 m is still a junction. This matters after a debug\n   start/teleport onto its centre: the rider must still be able to choose TURN. */
junctionAhead=function(){
  if(!world||!world.nCut||state.seg!=='m') return null;
  const L=world.lapLen;
  const J=(state.dir>0?world.jnA:world.jnB)*ROUTE_STEP;
  const d=state.dir>0?(((J-state.s)%L)+L)%L:(((state.s-J)%L)+L)%L;
  if(d>170) return null;
  return {dist:d,side:state.dir>0?world.sideA:world.sideB};
};

/* Same route walker as the core version, except zero-distance junctions are\n   allowed to enter the alternate road when TURN is selected. When riding\n   straight, zero still means "this junction is behind me" so we do not loop. */
walkPath=function(seg,s,dir,dist,choiceTurn){
  let lap=0,guard=0,crossedJn=false;
  while(dist>1e-6&&guard++<6){
    if(seg==='m'){
      const L=world.lapLen;
      const J=(dir>0?world.jnA:world.jnB)*ROUTE_STEP;
      let dJ=world.nCut?(dir>0?(((J-s)%L)+L)%L:(((s-J)%L)+L)%L):Infinity;
      if(dJ<1e-4&&!choiceTurn) dJ=L;
      if(!choiceTurn||dist<dJ){
        if(dist>=dJ) crossedJn=true;
        const s2=s+dir*dist;
        if(dir>0&&s2>=L) lap++;
        s=((s2%L)+L)%L;dist=0;
      }else{
        dist-=dJ;seg='c';s=dir>0?0:world.cutLen;choiceTurn=false;
      }
    }else{
      const s2=s+dir*dist;
      if(s2>=0&&s2<=world.cutLen){s=s2;dist=0;}
      else if(s2>world.cutLen){dist=s2-world.cutLen;seg='m';s=world.jnB*ROUTE_STEP;}
      else{dist=-s2;seg='m';s=world.jnA*ROUTE_STEP;}
    }
  }
  return {seg,s,dir,lap,crossedJn};
};

/* The old developer double-click searches only [0,nMain), so an alternate\n   route can never be selected. Capture the event first and snap to the nearest\n   sample in the ENTIRE rideable network. */
mcv.addEventListener('dblclick',e=>{
  if(!world||!mapView) return;
  /* A real map drag is handled by the pan module and must never teleport. */
  if(typeof mapPanEndedAt!=='undefined'&&performance.now()-mapPanEndedAt<450) return;

  const r=mcv.getBoundingClientRect();
  const wx=(e.clientX-r.left-mapView.w/2)/mapView.sc+mapView.cx;
  const wz=(e.clientY-r.top-mapView.h/2)/mapView.sc+mapView.cz;

  let bestSeg='m',bestK=0,bd=Infinity;
  for(let i=0;i<world.nMain;i+=2){
    const dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;
    if(d<bd){bd=d;bestSeg='m';bestK=i;}
  }
  if(world.nCut>0){
    for(let k=0;k<world.nCut;k+=2){
      const i=world.nMain+k;
      const dx=world.rx[i]-wx,dz=world.rz[i]-wz,d=dx*dx+dz*dz;
      if(d<bd){bd=d;bestSeg='c';bestK=k;}
    }
  }

  state.seg=bestSeg;
  state.s=bestK*ROUTE_STEP;
  state.choice='straight';
  state.cameVia=null;
  state.speed=Math.min(state.speed,3);
  const ii=segIdx(state.seg,state.s);
  state.alt=world.ry[ii];
  if(typeof resetMapPan==='function') resetMapPan();

  e.preventDefault();
  e.stopImmediatePropagation();
},true);
