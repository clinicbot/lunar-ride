"use strict";

/* ==========================================================================
   15. Zoomed route-map panning
   --------------------------------------------------------------------------
   At zoom 1/2 the map follows the rider until the user drags it. Once
   dragged, the chosen map area stays fixed so another part of the route can
   be inspected. Zooming fully out resets to the whole-route view.
   ========================================================================== */

let mapPanActive=false, mapPanCx=0, mapPanCz=0;
let mapPanDrag=null, mapPanMoved=false, mapPanEndedAt=0;

function resetMapPan(){
  mapPanActive=false;
  mapPanDrag=null;
  mapPanMoved=false;
  mcv.classList.remove('panning');
}

function setMapZoom(z){
  const prev=mapZoom;
  mapZoom=clamp(z,0,2);
  if(mapZoom===0 || prev===0) resetMapPan();
  mcv.classList.toggle('pannable',mapZoom>0);
}

/* Replace only the map drawing routine; all existing map data and HUD logic
   stay unchanged. */
drawMap=function(){
  if(!world) return;
  if(mapWorld!==world){
    buildMap();
    mapZoom=0;
    resetMapPan();
  }
  const w=mcv.clientWidth||188,h=w;
  if(mcv.width!==w*2){mcv.width=w*2;mcv.height=h*2;}
  mctx.setTransform(2,0,0,2,0,0);
  mctx.clearRect(0,0,w,h);
  const [x0,x1,z0,z1]=mapB;
  const fit=Math.min((w-14)/Math.max(x1-x0,1),(h-14)/Math.max(z1-z0,1));
  const sc=fit*([1,2.8,7][mapZoom]||1);
  let cx,cz;
  if(mapZoom===0){
    cx=(x0+x1)/2; cz=(z0+z1)/2;
  }else if(mapPanActive){
    cx=mapPanCx; cz=mapPanCz;
  }else{
    cx=riderPos[0]; cz=riderPos[2];
  }
  const X=p=>w/2+(p[0]-cx)*sc, Y=p=>h/2+(p[1]-cz)*sc;
  mapView={cx,cz,sc,w,h};
  mcv.classList.toggle('pannable',mapZoom>0);

  if(mapCut.length>1){
    mctx.strokeStyle='rgba(127,215,255,.65)'; mctx.lineWidth=2; mctx.lineCap='round';
    mctx.beginPath();
    mapCut.forEach((p,i)=>{i?mctx.lineTo(X(p),Y(p)):mctx.moveTo(X(p),Y(p));});
    mctx.stroke();
  }
  mctx.lineWidth=3; mctx.lineCap='round';
  for(let i=1;i<mapPts.length;i++){
    const g=mapPts[i][2];
    mctx.strokeStyle=g>7?'#ff6b6b':(g>3.2?'#ffb45e':'rgba(236,241,248,.88)');
    mctx.beginPath();
    mctx.moveTo(X(mapPts[i-1]),Y(mapPts[i-1]));
    mctx.lineTo(X(mapPts[i]),Y(mapPts[i]));
    mctx.stroke();
  }
  mctx.fillStyle='#6ee7a8';
  mctx.beginPath(); mctx.arc(X(mapPts[0]),Y(mapPts[0]),3.4,0,7); mctx.fill();

  for(const a of world.actors){
    if(a.type!=='rider') continue;
    mctx.fillStyle=a.oncoming?'#8fd8ff':'#ffd66e';
    mctx.beginPath(); mctx.arc(X([a.px,a.pz]),Y([a.px,a.pz]),2.1,0,7); mctx.fill();
  }

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
};

/* Replace zoom-button behavior so zooming all the way out also recentres. */
$('mapZoomIn').onclick=()=>setMapZoom(mapZoom+1);
$('mapZoomOut').onclick=()=>setMapZoom(mapZoom-1);

/* The original wheel listener still changes mapZoom. This companion listener
   only keeps the pan state consistent with the resulting zoom level. */
mcv.addEventListener('wheel',()=>{
  if(mapZoom===0) resetMapPan();
  mcv.classList.toggle('pannable',mapZoom>0);
});

mcv.addEventListener('pointerdown',e=>{
  if(mapZoom===0||!mapView) return;
  mapPanActive=true;
  mapPanCx=mapView.cx; mapPanCz=mapView.cz;
  mapPanDrag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:mapPanCx,cz:mapPanCz,sc:mapView.sc};
  mapPanMoved=false;
  mcv.classList.add('panning');
  try{mcv.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
});

mcv.addEventListener('pointermove',e=>{
  if(!mapPanDrag||e.pointerId!==mapPanDrag.id) return;
  const dx=e.clientX-mapPanDrag.x, dy=e.clientY-mapPanDrag.y;
  if(Math.abs(dx)+Math.abs(dy)>3) mapPanMoved=true;
  mapPanCx=mapPanDrag.cx-dx/mapPanDrag.sc;
  mapPanCz=mapPanDrag.cz-dy/mapPanDrag.sc;
  drawMap();
  e.preventDefault();
});

function endMapPan(e){
  if(!mapPanDrag||e.pointerId!==mapPanDrag.id) return;
  if(mapPanMoved) mapPanEndedAt=performance.now();
  mapPanDrag=null;
  mcv.classList.remove('panning');
}
mcv.addEventListener('pointerup',endMapPan);
mcv.addEventListener('pointercancel',endMapPan);

/* A drag followed by the browser synthesising a double-click must not trigger
   the existing developer teleport. An intentional later double-click still
   works exactly as before. */
mcv.addEventListener('dblclick',e=>{
  if(performance.now()-mapPanEndedAt<450){
    e.preventDefault();
    e.stopImmediatePropagation();
  }
},true);
