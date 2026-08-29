"use strict";

/* ==========================================================================\n   18. Roundabout ride path\n   --------------------------------------------------------------------------\n   The road mesh contains the traffic circle; this layer bends segPoint around\n   that same circle. Physics/grade still use the original route samples, so no\n   trainer logic changes, but rider, camera and steering no longer cross the\n   centre island.\n   ========================================================================== */
(function(){
  if(typeof segPoint!=='function')return;
  const baseSegPoint=segPoint;
  const TAU=6.28318530718,PRE=38,POST=70;
  const tmp0=[0,0,0],tmp1=[0,0,0];
  const mod=(x,m)=>((x%m)+m)%m;
  const signedMain=(s,J,L)=>{let d=mod(s-J+L/2,L)-L/2;return d;};
  const sm=t=>smoothstep(clamp(t,0,1));
  const mixP=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
  const baseAt=(seg,s)=>{const q=[0,0,0];baseSegPoint(seg,s,0,q);return q;};

  function circleP(r,ang){
    const x=r.cx+Math.cos(ang)*r.R,z=r.cz+Math.sin(ang)*r.R;
    const y=r.y+r.slope*((x-r.cx)*r.tx+(z-r.cz)*r.tz)+.30;
    return [x,y,z];
  }
  const anchorP=r=>circleP(r,r.anchorAng);
  const oppositeP=r=>circleP(r,r.anchorAng+r.dir*Math.PI);
  const branchExitP=r=>circleP(r,r.anchorAng+r.dir*(r.branchArc/r.R));

  function mainAtRound(r,s){
    const L=world.lapLen,d=signedMain(s,r.J,L),arc=r.mainArc;
    if(r.which==='A'){
      if(d>=-PRE&&d<0){const a=baseAt('m',r.J-PRE),b=anchorP(r);return mixP(a,b,sm((d+PRE)/PRE));}
      if(d>=0&&d<=arc)return circleP(r,r.anchorAng+r.dir*d/r.R);
      if(d>arc&&d<=arc+POST){const a=oppositeP(r),b=baseAt('m',r.J+arc+POST);return mixP(a,b,sm((d-arc)/POST));}
    }else{
      if(d>=-(arc+POST)&&d<-arc){const a=baseAt('m',r.J-arc-POST),b=oppositeP(r);return mixP(a,b,sm((d+arc+POST)/POST));}
      if(d>=-arc&&d<=0)return circleP(r,r.anchorAng+r.dir*(-d)/r.R);
      if(d>0&&d<=PRE){const a=anchorP(r),b=baseAt('m',r.J+PRE);return mixP(a,b,sm(d/PRE));}
    }
    return null;
  }

  function cutAtRound(r,s){
    const arc=r.branchArc;
    if(r.which==='A'){
      if(s>=0&&s<=arc)return circleP(r,r.anchorAng+r.dir*s/r.R);
      if(s>arc&&s<=arc+POST){const a=branchExitP(r),b=baseAt('c',arc+POST);return mixP(a,b,sm((s-arc)/POST));}
    }else{
      const back=world.cutLen-s;
      if(back>=0&&back<=arc)return circleP(r,r.anchorAng+r.dir*back/r.R);
      if(back>arc&&back<=arc+POST){const a=branchExitP(r),b=baseAt('c',world.cutLen-(arc+POST));return mixP(a,b,sm((back-arc)/POST));}
    }
    return null;
  }

  function centre(seg,s){
    if(world&&world.roundabouts&&world.roundabouts.length){
      if(seg==='m')for(const r of world.roundabouts){const p=mainAtRound(r,s);if(p)return p;}
      else if(seg==='c')for(const r of world.roundabouts){const p=cutAtRound(r,s);if(p)return p;}
    }
    return baseAt(seg,s);
  }

  segPoint=function(seg,s,off,out){
    const p=centre(seg,s),eps=.7;
    let s0=s-eps,s1=s+eps;
    if(seg==='c'){s0=clamp(s0,0,world.cutLen);s1=clamp(s1,0,world.cutLen);}
    const a=centre(seg,s0),b=centre(seg,s1);
    let tx=b[0]-a[0],tz=b[2]-a[2],l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
    out[0]=p[0]-tz*off;out[1]=p[1];out[2]=p[2]+tx*off;return out;
  };

  /* Draw the roundabouts on top of the route map, including when the panning\n     module is active. */
  if(typeof drawMap==='function'){
    const baseDrawMap=drawMap;
    drawMap=function(){
      baseDrawMap();
      if(!world||!world.roundabouts||!mapView||!mctx)return;
      const w=mapView.w,h=mapView.h,sc=mapView.sc;
      for(const r of world.roundabouts){
        const x=w/2+(r.cx-mapView.cx)*sc,y=h/2+(r.cz-mapView.cz)*sc,rr=r.R*sc;
        if(rr<1.2)continue;
        mctx.strokeStyle='rgba(236,241,248,.95)';mctx.lineWidth=Math.max(1.3,2.2*sc/(sc+0.002));
        mctx.beginPath();mctx.arc(x,y,rr,0,TAU);mctx.stroke();
        mctx.fillStyle='rgba(70,74,72,.85)';mctx.beginPath();mctx.arc(x,y,Math.max(1,rr*.52),0,TAU);mctx.fill();
      }
    };
  }
})();
