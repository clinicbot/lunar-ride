"use strict";

/* ==========================================================================
   7. Camera and the draw loop
   ========================================================================== */

let W=1,H=1,DPR=1;
function resize(){
  DPR=Math.min(devicePixelRatio||1,1.5);
  W=Math.max(1,Math.round(innerWidth*DPR)); H=Math.max(1,Math.round(innerHeight*DPR));
  cv.width=W; cv.height=H; cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
}
addEventListener('resize',resize); resize();

const mProj=new Float32Array(16), mView=new Float32Array(16), mMVP=new Float32Array(16);
const FOVY=62*Math.PI/180;

/* position on the road at arc length s, offset sideways by off metres */
function roadPoint(s,off,out){
  const n=world.nMain;
  const f=(((s/ROUTE_STEP)%n)+n)%n, i=Math.floor(f), t=f-i, j=(i+1)%n;
  const nx=-world.tz[i], nz=world.tx[i];
  out[0]=lerp(world.rx[i],world.rx[j],t)+nx*off;
  out[1]=lerp(world.ry[i],world.ry[j],t);
  out[2]=lerp(world.rz[i],world.rz[j],t)+nz*off;
  return out;
}

const eye=[0,0,0], ctr=[0,0,0], up=[0,1,0];
const CAMS=[{back:0,  h:1.55, ahead:26, lookH:0.9},     // on the bike
            {back:7.5,h:2.6,  ahead:24, lookH:1.2},     // just behind
            {back:22, h:8.0,  ahead:20, lookH:0.0}];    // helicopter

function render(){
  const sc=state.scene;
  if(!world){
    gl.viewport(0,0,W,H);
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    return;
  }

  /* ---- pass 1: the world as the sun sees it, depth only ---- */
  const su=[Math.cos(sc.sun.el)*Math.sin(sc.sun.az),Math.sin(sc.sun.el),
            Math.cos(sc.sun.el)*Math.cos(sc.sun.az)];
  if(shadowsOK){
    const cx=riderPos[0],cy=riderPos[1],czp=riderPos[2];
    const lookC=[cx,cy,czp];
    const lEye=[cx+su[0]*300,cy+su[1]*300,czp+su[2]*300];
    lookAt(mLV,lEye,lookC,[0,1,0]);
    ortho(mLP,-190,190,-190,190,40,700);
    matMul(mLight,mLP,mLV);
    gl.bindFramebuffer(gl.FRAMEBUFFER,shFB);
    gl.viewport(0,0,SH,SH);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2,4);
    gl.useProgram(progShadow);
    CU=US;
    gl.uniformMatrix4fv(US.uMVP,false,mLight);
    gl.uniformMatrix4fv(US.uModel,false,IDENT);
    gl.uniform4fv(US.uLimb,NOLIMB);
    gl.uniform4fv(US.uHead,NOHEAD);
    gl.uniform3f(US.uWave,0,0,0);
    drawMesh(gpu.terrain);
    drawMesh(gpu.road);
    drawMesh(gpu.props);
    drawActors(210);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    CU=U;
  }

  if(isGL2&&(POST.w!==W||POST.h!==H)) buildPostFBOs();
  gl.bindFramebuffer(gl.FRAMEBUFFER,POST.on?POST.msFB:null);
  gl.viewport(0,0,W,H);
  gl.clearColor(0,0,0,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  const cam=CAMS[state.camMode];
  pathAt(-cam.back,state.playerX*state.dir,eye); eye[1]+=cam.h;
  pathAt(cam.ahead,state.playerX*state.dir*0.5,ctr); ctr[1]+=cam.lookH;

  perspective(mProj,FOVY,W/H,0.35,6000);
  lookAt(mView,eye,ctr,up);
  matMul(mMVP,mProj,mView);

  /* ---- sky ---- */
  let fx=ctr[0]-eye[0], fy=ctr[1]-eye[1], fz=ctr[2]-eye[2];
  let l=Math.hypot(fx,fy,fz)||1; fx/=l;fy/=l;fz/=l;
  /* right = normalize(cross(forward, worldUp)) */
  let rxv=-fz, ryv=0, rzv=fx;
  l=Math.hypot(rxv,ryv,rzv)||1; rxv/=l;ryv/=l;rzv/=l;
  /* up = cross(right, forward) */
  const uxv=ryv*fz-rzv*fy, uyv=rzv*fx-rxv*fz, uzv=rxv*fy-ryv*fx;

  gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
  gl.useProgram(progSky);
  gl.uniform3f(U.uFwd,fx,fy,fz);
  gl.uniform3f(U.uRight,rxv,ryv,rzv);
  gl.uniform3f(U.uUp,uxv,uyv,uzv);
  gl.uniform1f(U.uTanHalf,Math.tan(FOVY/2));
  gl.uniform1f(U.uAspect,W/H);
  gl.uniform3fv(U.uTop,hx(sc.sky.top));
  gl.uniform3fv(U.uHorizon,hx(sc.sky.horizon));
  gl.uniform3fv(U.uFog,hx(sc.sky.fog));
  gl.uniform1f(U.uStars,sc.sky.stars);
  gl.uniform1f(U.uStarBright,sc.sky.starBright);
  const skyT=AITEX.skies[sc.id];
  gl.uniform1f(U.uSkyOn,skyT?1:0);
  if(skyT){
    gl.activeTexture(gl.TEXTURE0+9);
    gl.bindTexture(gl.TEXTURE_2D,skyT);
    gl.uniform1i(U.uSkyTex,9);
    gl.activeTexture(gl.TEXTURE0);
  }
  gl.uniform1f(U.uCloud,sc.sky.cloud||0);
  gl.uniform1f(U.uTimeS,state.elapsed);
  gl.uniform3fv(U.uCloudCol,hx(sc.sky.cloudCol||'#f2eef2'));
  gl.uniform3f(U.uSunDirS,
    Math.cos(sc.sun.el)*Math.sin(sc.sun.az),Math.sin(sc.sun.el),
    Math.cos(sc.sun.el)*Math.cos(sc.sun.az));
  gl.uniform3fv(U.uSunColS,hx(sc.sun.col));
  if(sc.sky.earth){
    const e=sc.sky.earth;
    const ed=[Math.cos(e.el)*Math.sin(e.az),Math.sin(e.el),Math.cos(e.el)*Math.cos(e.az)];
    let er=[ed[2],0,-ed[0]];
    l=Math.hypot(er[0],er[1],er[2])||1; er=er.map(v=>v/l);
    const eu=[er[1]*ed[2]-er[2]*ed[1],er[2]*ed[0]-er[0]*ed[2],er[0]*ed[1]-er[1]*ed[0]];
    const su=[Math.cos(sc.sun.el)*Math.sin(sc.sun.az),Math.sin(sc.sun.el),Math.cos(sc.sun.el)*Math.cos(sc.sun.az)];
    gl.uniform3fv(U.uEarthDir,ed); gl.uniform3fv(U.uEarthR,er); gl.uniform3fv(U.uEarthU,eu);
    gl.uniform3fv(U.uEarthLight,su);
    gl.uniform1f(U.uEarthSize,e.size);
  } else gl.uniform1f(U.uEarthSize,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,skyQuad);
  gl.enableVertexAttribArray(A.skyP);
  gl.vertexAttribPointer(A.skyP,2,gl.FLOAT,false,0,0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.disableVertexAttribArray(A.skyP);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);

  /* ---- landscape ---- */
  gl.useProgram(progMain);
  gl.uniformMatrix4fv(U.uMVP,false,mMVP);
  gl.uniform3fv(U.uSun,su);
  gl.uniform3fv(U.uSunCol,hx(sc.sun.col));
  gl.uniform3fv(U.uAmb,hx(sc.sun.amb));
  gl.uniform3fv(U.uFogCol,hx(sc.sky.fog));
  gl.uniform3f(U.uCam,eye[0],eye[1],eye[2]);
  gl.uniform1f(U.uFogDen,sc.sky.fogDen);
  gl.uniform1f(U.uTime,state.elapsed);
  gl.uniformMatrix4fv(U.uModel,false,IDENT);
  gl.uniform4fv(U.uLimb,NOLIMB);
  gl.uniform4fv(U.uHead,NOHEAD);
  gl.uniform3f(U.uWave,0,0,0);
  gl.uniform2f(U.uSpin,0,0);
  gl.uniform1f(U.uEmiss,1);
  gl.uniform1f(U.uGrid,sc.grid?1:0);
  gl.uniform1f(U.uSnow,sc.snow!==undefined?sc.snow:1e9);
  /* shadow-space transform, biased into [0,1] texture coordinates */
  if(shadowsOK){
    const B=new Float32Array([0.5,0,0,0, 0,0.5,0,0, 0,0,0.5,0, 0.5,0.5,0.5,1]);
    const mB=new Float32Array(16);
    matMul(mB,B,mLight);
    gl.uniformMatrix4fv(U.uShadowMat,false,mB);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,shTex);
    gl.uniform1i(U.uShadowMap,1);
    gl.activeTexture(gl.TEXTURE0);
  }
  gl.uniform1f(U.uShadowOn,shadowsOK?1:0);
  gl.uniform1f(U.uAlpha,1);
  gl.uniform1f(U.uTexOn,TEX.ok?1:0);
  if(TEX.ok){
    const binds=[[2,TEX.gA,'uTexGA'],[3,TEX.gN,'uTexGN'],[4,TEX.rA,'uTexRA'],
                 [5,TEX.rN,'uTexRN'],[6,TEX.aA,'uTexAA'],[7,TEX.aN,'uTexAN']];
    for(const b of binds){
      gl.activeTexture(gl.TEXTURE0+b[0]);
      gl.bindTexture(gl.TEXTURE_2D,b[1]);
      gl.uniform1i(U[b[2]],b[0]);
    }
    gl.activeTexture(gl.TEXTURE0);
  }
  gl.uniform1f(U.uMat,1);
  drawMesh(gpu.terrain);
  gl.uniform1f(U.uMat,2);
  drawMesh(gpu.road);
  gl.uniform1f(U.uGrid,0);
  gl.uniform1f(U.uMat,0);
  drawMesh(gpu.props);
  drawActors(430);
  if(gpu.veg&&TEX.veg){
    gl.useProgram(progBill);
    gl.uniformMatrix4fv(UBL.uMVPB,false,mMVP);
    gl.uniform3f(UBL.uCamB,eye[0],eye[1],eye[2]);
    gl.uniform1f(UBL.uTimeB,state.elapsed);
    gl.activeTexture(gl.TEXTURE0+8);
    gl.bindTexture(gl.TEXTURE_2D,TEX.veg);
    gl.uniform1i(UBL.uAtlas,8);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform3fv(UBL.uTintA,gpu.veg.tintA);
    gl.uniform3fv(UBL.uTintB,gpu.veg.tintB);
    gl.uniform3fv(UBL.uSunColB,hx(sc.sun.col));
    gl.uniform3fv(UBL.uAmbB,hx(sc.sun.amb));
    gl.uniform3fv(UBL.uFogColB,hx(sc.sky.fog));
    gl.uniform1f(UBL.uFogDenB,sc.sky.fogDen);
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.veg.ctr);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.veg.dat);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,gpu.veg.uv);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,0,0);
    gl.disableVertexAttribArray(3); gl.vertexAttrib1f(3,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gpu.veg.idx);
    gl.drawElements(gl.TRIANGLES,gpu.veg.count,gl.UNSIGNED_INT,0);
    gl.useProgram(progMain);
  }
  if(world.screens&&world.screens.length&&progScr){
    gl.useProgram(progScr);
    gl.uniformMatrix4fv(USC.uMVPS,false,mMVP);
    gl.uniform3f(USC.uCamS,eye[0],eye[1],eye[2]);
    gl.uniform3fv(USC.uFogColS,hx(sc.sky.fog));
    gl.uniform1f(USC.uFogDenS,sc.sky.fogDen);
    gl.uniform3fv(USC.uAmbS,hx(sc.sun.amb));
    gl.uniform3fv(USC.uSunColS,hx(sc.sun.col));
    gl.activeTexture(gl.TEXTURE0+10);
    gl.uniform1i(USC.uTexS,10);
    gl.bindBuffer(gl.ARRAY_BUFFER,scrQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.disableVertexAttribArray(3); gl.vertexAttrib1f(3,0);
    for(const s2 of world.screens){
      const T=SCRTEX[s2.tex]; if(!T) continue;
      gl.bindTexture(gl.TEXTURE_2D,T.tx);
      const h2=s2.w/T.asp;
      gl.uniform1f(USC.uEmS,s2.em!==undefined?s2.em:0.20);
      gl.uniform3f(USC.uPosS,s2.x,s2.y+(s2.by!==undefined?s2.by:1.8)+h2/2,s2.z);
      gl.uniform3f(USC.uRightS,s2.rx,0,s2.rz);
      gl.uniform2f(USC.uSizeS,s2.w/2,h2/2);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(progMain);
  }
  if(gpu.water){
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(U.uMat,3);
    gl.uniform1f(U.uAlpha,0.80);
    drawMesh(gpu.water);
    gl.uniform1f(U.uAlpha,1);
    gl.uniform1f(U.uMat,0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  if(gpu.glass){
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(U.uAlpha,0.34);
    drawMesh(gpu.glass);
    gl.uniform1f(U.uAlpha,1);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /* ---- post: resolve the antialiased scene, pull out the glow, grade it ---- */
  if(POST.on){
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,POST.msFB);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,POST.resFB);
    gl.blitFramebuffer(0,0,W,H,0,0,W,H,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    const bw=Math.max(1,W>>2), bh=Math.max(1,H>>2);
    gl.bindFramebuffer(gl.FRAMEBUFFER,POST.blFB);
    gl.viewport(0,0,bw,bh);
    gl.useProgram(progBloom);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,POST.resTex);
    gl.uniform1i(UB.uScene,0);
    gl.uniform2f(UB.uPx,1/bw,1/bh);
    gl.bindBuffer(gl.ARRAY_BUFFER,skyQuad);
    gl.enableVertexAttribArray(A.skyP);
    gl.vertexAttribPointer(A.skyP,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,W,H);
    gl.useProgram(progPost);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,POST.resTex);
    gl.uniform1i(UP.uScene,0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,POST.blTex);
    gl.uniform1i(UP.uBloomT,1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(UP.uPx,1/bw,1/bh);
    gl.uniform1f(UP.uExposure,sc.exposure!==undefined?sc.exposure:1.30);
    gl.uniform1f(UP.uBloomAmt,sc.bloom!==undefined?sc.bloom:0.55);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.disableVertexAttribArray(A.skyP);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
}

const mModel=new Float32Array(16), vLimb=new Float32Array(4), vHead=new Float32Array(4);
const riderPos=[0,0,0], actTmp=[0,0,0];

/* you: the rider the third-person cameras look at. Not a world actor -
   position and cadence come straight from the ride state. */
const ME={type:'rider', me:true, kit:0, meta:RIDER_META, ph:0, emiss:1, k:1,
  swing:0, headYaw:0, headPitch:0, waveAng:0, crank:0, wheel:0,
  px:0, py:0, pz:0, yaw:0};

/* --------------------------------------------------------------------------
   Everything that moves gets its transform worked out here, once per frame.
   Creatures also decide whether they have noticed you.
   -------------------------------------------------------------------------- */
function updateActors(dt){
  if(!world) return;
  const t=state.elapsed, L=world.lapLen;
  segPoint(state.seg,state.s,state.playerX*state.dir,riderPos);
  const eyeY=riderPos[1]+1.35;
  /* rolling average of the player's power, ~45 s half-life: what the other
     riders pace themselves against */
  state.pwrEMA=lerp(state.pwrEMA||0,state.power,1-Math.pow(0.5,dt/45));

  for(let n=0;n<world.actors.length;n++){
    const a=world.actors[n];

    if(a.type==='astro'){
      const ang=a.ph+t*a.w;
      a.px=a.cx+Math.cos(ang)*a.r; a.pz=a.cz+Math.sin(ang)*a.r;
      a.py=world.groundAt(a.px,a.pz);
      a.yaw=Math.atan2(-Math.sin(ang)*a.w, Math.cos(ang)*a.w);
      a.swing=a.walk?Math.sin(t*3.2+a.ph)*0.5:0;
      if(a.walk) a.py+=Math.abs(Math.sin(t*3.2+a.ph))*0.05;

    }else if(a.type==='rover'){
      const s=(((a.s0+t*a.spd*a.dir)%L)+L)%L;
      const i=Math.floor(s/ROUTE_STEP)%world.nMain;
      a.px=world.rx[i]-world.tz[i]*a.off; a.pz=world.rz[i]+world.tx[i]*a.off;
      a.py=world.groundAt(a.px,a.pz);
      a.yaw=Math.atan2(world.tx[i]*a.dir, world.tz[i]*a.dir);

    }else if(a.type==='shuttle'){
      const u=((a.s0+t*a.spd)%a.len)-a.len/2;
      a.px=a.sx+a.dx*u; a.pz=a.sz+a.dz*u;
      a.py=world.meanY+a.alt+Math.sin(t*0.25+a.ph)*9;
      a.yaw=Math.atan2(a.dx,a.dz);

    }else if(a.type==='drone'){
      const ang=a.ph+t*a.w;
      a.px=a.cx+Math.cos(ang)*a.r; a.pz=a.cz+Math.sin(ang)*a.r;
      a.py=a.gy+a.alt+Math.sin(t*1.1+a.ph)*2.5;
      a.yaw=Math.atan2(-Math.sin(ang)*a.w, Math.cos(ang)*a.w);

    }else if(a.type==='station'){
      const ang=a.ph+t*a.w;
      a.px=Math.cos(ang)*a.r; a.pz=Math.sin(ang)*a.r;
      a.py=world.meanY+a.alt;
      a.yaw=Math.atan2(-Math.sin(ang),Math.cos(ang));

    }else if(a.type==='fish'){
      a.tmr-=dt;
      if(a.tmr<=0&&world.lakeSpots.length){
        const sp=world.lakeSpots[(Math.random()*world.lakeSpots.length)|0];
        a.px=sp[0]; a.pz=sp[1];
        a.yaw=Math.random()*6.28318;
        a.leap=0; a.dur=0.85+Math.random()*0.35;
        a.tmr=3+Math.random()*8;
      }
      if(a.leap!==undefined&&a.leap<=a.dur){
        const u=a.leap/a.dur;
        a.py=world.waterY-0.35+Math.sin(u*Math.PI)*1.6;
        a.pitch=(0.5-u)*2.0;
        a.px+=Math.sin(a.yaw)*dt*2.4;
        a.pz+=Math.cos(a.yaw)*dt*2.4;
        a.leap+=dt;
      }else{
        a.py=(world.waterY!==null?world.waterY:0)-6;
        a.pitch=0;
      }

    }else if(a.type==='gbird'){
      a.circ+=dt*a.w;
      const nx=a.cx+Math.cos(a.circ)*a.R, nz=a.cz+Math.sin(a.circ)*a.R;
      if(Math.hypot(nx-a.px,nz-a.pz)>1e-4) a.yaw=Math.atan2(nx-a.px,nz-a.pz);
      a.px=nx; a.pz=nz;
      const g=(world.meshH||world.groundAt)(a.px,a.pz);
      const wantY=a.pinAlt!==undefined ? a.pinAlt
        : Math.max(g+7, a.baseY!==undefined?a.baseY:world.meanY+(a.altBase||10));
      a.py=a.py?lerp(a.py,wantY,1-Math.pow(0.45,dt)):wantY;
      a.pitch=0;
      a.flapT-=dt;
      if(a.flapT<=0&&!a.noGlide){ a.flap=!a.flap;
        a.flapT=a.flap?1.4+Math.random()*1.6:2.0+Math.random()*3.0; }
      const fw=(a.flapHz||1.3)*6.28318;
      if(a.flap) a.gph+=dt*fw;
      else{ const m2=a.gph%6.28318;
        if(m2>0.06) a.gph+=Math.min(dt*fw, 6.28318-m2); }

    }else if(a.type==='rider'){
      /* the same physics the player rides, at this rider's own power. The
         power breathes slowly, so the near-parity riders surge and fade the
         way real company does. */
      const dsg=(a.oncoming?-1:1)*state.dir;   /* direction of travel */
      const i=Math.floor(a.s/ROUTE_STEP)%world.nMain;
      const th=Math.atan(dsg*world.grade[i]/100);
      const gr=cfg.moonG?1.62:9.81, rho=cfg.moonG?0:1.226;
      /* paced off the player's rolling average, not the player's FTP —
         nobody holds FTP for an hour, and the company should match the ride
         the player is actually having */
      const ref=Math.max(60, state.pwrEMA>30?state.pwrEMA:cfg.ftp*0.72);
      const P=ref*a.fac*(1+0.10*Math.sin(t*a.varF+a.ph)+0.05*Math.sin(t*0.011+a.ph*2.7));
      const v=Math.max(a.v,0.6);
      const acc=(P*0.975/v -0.0045*a.mass*gr*Math.cos(th)
                 -0.5*rho*0.32*a.v*a.v -a.mass*gr*Math.sin(th))/a.mass;
      a.v=clamp(a.v+acc*dt,0,MAX_MS);
      a.s+=dsg*a.v*dt;
      const L=world.lapLen;
      a.s=((a.s%L)+L)%L;
      /* keep the company near the player: anyone dropped or long gone off the
         front quietly rejoins the road ahead or behind with fresh legs */
      const pms=playerMainS();
      let gap=((a.s-pms)%L+L)%L; if(gap>L/2)gap-=L;
      let tGap=gap*state.dir;                 /* + means ahead of the player */
      if(a.oncoming){
        /* once it has swept past, it reappears far up the road and returns */
        if(tGap<-70||tGap>780){
          a.s=((pms+state.dir*(380+Math.random()*320))%L+L)%L;
          a.fac=0.8+Math.random()*0.4;
          a.v=Math.max(4,a.v);
          gap=((a.s-pms)%L+L)%L; if(gap>L/2)gap-=L;
          tGap=gap*state.dir;
        }
      }else if(Math.abs(tGap)>700){
        a.s=((pms+state.dir*(tGap>0?-1:1)*(340+Math.random()*160))%L+L)%L;
        a.fac*=0.94+Math.random()*0.12;
        a.v=Math.max(4,a.v);
        gap=((a.s-pms)%L+L)%L; if(gap>L/2)gap-=L;
        tGap=gap*state.dir;
      }
      roadPoint(a.s, dsg*(a.laneAbs||2.2)+Math.sin(t*0.6+a.ph)*0.12, actTmp);
      /* the drawn road surface sits 10 cm above the route line - stand on it */
      a.px=actTmp[0]; a.py=actTmp[1]+0.10; a.pz=actTmp[2];
      const j=Math.floor(a.s/ROUTE_STEP)%world.nMain;
      a.yaw=Math.atan2(dsg*world.tx[j],dsg*world.tz[j]);
      const cadHz=clamp(55+a.v*3.2,50,102)/60;
      a.crank=(a.crank||0)+cadHz*6.28318*dt;           /* one rev per pedal stroke */
      a.wheel=(a.wheel||0)-a.v/0.34*dt;                /* rolling, radius 34 cm */
      a.swing=Math.sin(a.crank+a.ph)*0.55;
      a.py+=Math.abs(Math.sin(a.crank+a.ph))*0.015;
      /* two-bone IK: hip fixed, foot on the pedal, knee bends forward */
      const ik=(a2)=>{
        const HY=0.93,HZ=-0.16,T=0.40,SH=0.42;
        let dz=(-0.02+0.195*Math.sin(a2))-HZ, dy=(0.28-0.195*Math.cos(a2))-HY;
        let d=Math.hypot(dz,dy); const mx=T+SH-0.012;
        if(d>mx){dz*=mx/d;dy*=mx/d;d=mx;}
        const phi=Math.atan2(dz,-dy);
        const al=Math.acos(Math.max(-1,Math.min(1,(T*T+d*d-SH*SH)/(2*T*d))));
        const th=phi+al;
        const kz=HZ+T*Math.sin(th), ky=HY-T*Math.cos(th);
        const ts=Math.atan2((HZ+dz)-kz,-((HY+dy)-ky));
        return [th,ts,kz-HZ,ky-0.53];
      };
      a.legL=ik(a.crank); a.legR=ik(a.crank+3.141593);
      /* ---- greetings: SOMETIMES, on a pass, a look and a wave ----
         The moment the lead changes hands within 25 m there is a 40% chance
         of a greeting — throttled so the same rider will not greet again for
         a minute or so however often you trade places. */
      a.greetCd=(a.greetCd||0)-dt;
      if(!a.oncoming){
        const sg=tGap>0.5?1:(tGap<-0.5?-1:0);
        if(sg!==0 && a.lastSide!==undefined && a.lastSide!==0 && sg!==a.lastSide
           && Math.abs(tGap)<25 && a.greetCd<=0 && Math.random()<0.4){
          a.greetT=2.4;
          a.greetCd=50+Math.random()*70;
        }
        if(sg!==0) a.lastSide=sg;
      }else if(tGap>0&&tGap<22&&a.greetCd<=0&&Math.random()<0.10*dt*60){
        /* an oncoming rider sometimes lifts a hand as you close */
        a.greetT=1.6; a.greetCd=40+Math.random()*60;
      }
      const greeting=(a.greetT||0)>0;
      if(greeting) a.greetT-=dt;
      /* the glance: always when alongside, held longer while greeting */
      const want=(greeting||Math.abs(gap)<9)
        ? clamp(wrapAng(Math.atan2(riderPos[0]-a.px,riderPos[2]-a.pz)-a.yaw),-0.95,0.95)
        : 0;
      a.headYaw=angLerp(a.headYaw,want,1-Math.pow(0.05,dt));
      /* the wave: the right hand comes off the bars and swings overhead */
      /* cyclists wave a hand out to the side, off the bars, not overhead */
      a.waveAng=lerp(a.waveAng||0,
        greeting?2.35+Math.sin(t*7.5)*0.50:0, 1-Math.pow(0.008,dt));

    }else{
      /* ---- an animal ---- */
      const M=a.meta;
      const dx=riderPos[0]-a.px, dz=riderPos[2]-a.pz;
      const dist=Math.hypot(dx,dz);

      /* how much it has noticed you: fully alert inside 40 m, oblivious past 110 */
      const notice=clamp(1-(dist-40)/70,0,1);
      a.alert=lerp(a.alert,notice,1-Math.pow(0.05,dt));

      /* -- flee: an animal may stray onto the tarmac, but not with a rider
            bearing down on it: it trots straight off the road, then turns
            to watch like the rest of the herd -- */
      if(!M.float&&a.rdx!==undefined&&!a.flee&&dist<32){
        /* measure against the road that is actually under its feet: the
           stretch near the rider, not the herd's remembered spawn point */
        const pIdx=segIdx(state.seg,state.s);
        let bd=1e9,bi=pIdx;
        for(let o2=-12;o2<=12;o2++){
          const i3=(((pIdx+o2)%world.nPts)+world.nPts)%world.nPts;
          const ddx=a.px-world.rx[i3], ddz=a.pz-world.rz[i3];
          const d3=ddx*ddx+ddz*ddz;
          if(d3<bd){bd=d3;bi=i3;}
        }
        if(Math.sqrt(bd)<(world.scene.road.halfWidth||5)+2.5){
          a.flee=1;
          a.rdx=world.rx[bi]; a.rdz=world.rz[bi];
          const adx=a.px-a.rdx, adz=a.pz-a.rdz, al=Math.hypot(adx,adz);
          if(al>0.3){ a.awayX=adx/al; a.awayZ=adz/al; }
        }
      }
      if(a.flee){
        a.hx+=a.awayX*3.6*dt; a.hz+=a.awayZ*3.6*dt;
        a.gph=(a.gph||0)+dt*(a.gait||3)*3.2;      /* legs at a run */
        a.px=a.hx+Math.cos(a.wander)*a.wr;
        a.pz=a.hz+Math.sin(a.wander)*a.wr;
        a.yaw=angLerp(a.yaw,Math.atan2(a.awayX,a.awayZ),1-Math.pow(0.02,dt));
        if(Math.hypot(a.px-a.rdx,a.pz-a.rdz)>(world.scene.road.halfWidth||5)+6||dist>50)
          a.flee=0;
      }

      /* -- grazing: between strolls it puts its head down in the grass -- */
      if(!M.float&&M.gait>0&&a.alert<0.35&&!a.flee){
        a.grzT=(a.grzT===undefined?Math.random()*6:a.grzT)-dt;
        if(a.grzT<=0){
          a.grazing=!a.grazing;
          a.grzT=a.grazing?2.5+Math.random()*3.5:4+Math.random()*5;
        }
      }else a.grazing=false;

      /* it stops moving as it becomes interested in you, or to graze */
      const move=a.flee?0:(1-a.alert)*(a.grazing?0:1);
      a.wander+=dt*a.wspd*move;
      if(!a.flee){
        a.px=a.hx+Math.cos(a.wander)*a.wr;
        a.pz=a.hz+Math.sin(a.wander)*a.wr;
      }

      const toRider=Math.atan2(dx,dz);
      if(a.flee){ /* heading handled above */ }
      else if(move>0.3){
        const wy=Math.atan2(-Math.sin(a.wander)*a.wspd, Math.cos(a.wander)*a.wspd);
        a.yaw=angLerp(a.yaw,wy,1-Math.pow(0.25,dt));
      }else if(a.alert>0.55 && Math.abs(wrapAng(toRider-a.yaw))>M.turn*0.75){
        /* you are too far round for it to just crane its neck: it turns to face you */
        a.yaw=angLerp(a.yaw,toRider,1-Math.pow(0.45,dt));
      }

      /* the gaze */
      const want=a.alert>0.12?clamp(wrapAng(toRider-a.yaw),-M.turn,M.turn):0;
      a.headYaw=angLerp(a.headYaw,want,1-Math.pow(0.015,dt));
      const pitchAt=-Math.atan2(eyeY-(a.py+M.eye*a.k),Math.max(dist,2));
      a.headPitch=lerp(a.headPitch,
        lerp(a.grazing?0.85:M.rest,clamp(pitchAt,-0.8,0.8),a.alert),
        1-Math.pow(0.04,dt));

      a.swing=Math.sin(t*a.gait+a.ph)*0.5*move;
      a.gph=(a.gph||0)+dt*(a.gait||3)*1.45*move;

      const surf=(world.meshH||world.groundAt);
      if(M.float){
        a.py=a.pinY!==undefined
          ? a.pinY+Math.sin(t*0.7+a.ph)*0.25
          : Math.max(surf(a.px,a.pz)+M.float*a.k,
                     a.baseRoadY!==undefined?a.baseRoadY+1.6:-1e9)
            +Math.sin(t*0.7+a.ph)*0.35+a.alert*1.8;
        a.emiss=1+a.alert*2.4;
        a.headYaw=0; a.headPitch=0; a.swing=0;
      }else{
        a.py=surf(a.px,a.pz);
        a.emiss=1;
      }
    }
  }

  /* ---- you ---- */
  if(state.scene){
    segPoint(state.seg,state.s,state.playerX*state.dir,actTmp);
    const mdx=actTmp[0]-ME.px, mdz=actTmp[2]-ME.pz;
    if(mdx*mdx+mdz*mdz>1e-6) ME.yaw=Math.atan2(mdx,mdz);
    ME.px=actTmp[0]; ME.py=actTmp[1]+0.10; ME.pz=actTmp[2];
    ME.crank+=(state.cad||0)/60*6.28318*dt;
    ME.wheel-=(state.speed||0)/0.34*dt;
    ME.py+=Math.abs(Math.sin(ME.crank))*0.015;
    const ik=(a2)=>{
      const HY=0.93,HZ=-0.16,T=0.40,SH=0.42;
      let dz2=(-0.02+0.195*Math.sin(a2))-HZ, dy=(0.28-0.195*Math.cos(a2))-HY;
      let d=Math.hypot(dz2,dy); const mx=T+SH-0.012;
      if(d>mx){dz2*=mx/d;dy*=mx/d;d=mx;}
      const phi=Math.atan2(dz2,-dy);
      const al=Math.acos(Math.max(-1,Math.min(1,(T*T+d*d-SH*SH)/(2*T*d))));
      const th=phi+al;
      const kz=HZ+T*Math.sin(th), ky=HY-T*Math.cos(th);
      const ts=Math.atan2((HZ+dz2)-kz,-((HY+dy)-ky));
      return [th,ts,kz-HZ,ky-0.53];
    };
    ME.legL=ik(ME.crank); ME.legR=ik(ME.crank+3.141593);
  }
}

function drawActors(maxD){
  if(!gpu.actors) return;
  const cx2=eye[0], cz2=eye[2], m2=(maxD||430)*(maxD||430);
  const NA=world.actors.length+(state.camMode>0?1:0);
  for(let n=0;n<NA;n++){
    const a=n<world.actors.length?world.actors[n]:ME, M=a.meta;
    if(a.type!=='station'&&a.type!=='shuttle'){
      const ddx=a.px-cx2, ddz=a.pz-cz2;
      if(ddx*ddx+ddz*ddz>m2) continue;
    }
    vLimb[0]=a.swing||0;
    vLimb[1]=M?M.hip:0.85;
    vLimb[2]=(a.swing||0)*(M?1:0.8);
    vLimb[3]=M?M.sh:1.45;
    vHead[0]=a.headYaw||0; vHead[1]=a.headPitch||0;
    vHead[2]=M?M.headY:0;  vHead[3]=M?M.headZ:0;
    gl.uniform3f(CU.uWave, a.waveAng||0, M&&M.wvY?M.wvY:0, M&&M.wvX?M.wvX:0);
    gl.uniform2f(CU.uSpin, a.crank||0, a.wheel||0);
    if(a.legL){gl.uniform4fv(CU.uLegL,a.legL);gl.uniform4fv(CU.uLegR,a.legR);}
    modelMat(mModel,a.px,a.py,a.pz,a.yaw,a.k||1,a.pitch||0);
    gl.uniformMatrix4fv(CU.uModel,false,mModel);
    gl.uniform4fv(CU.uLimb,vLimb);
    gl.uniform4fv(CU.uHead,vHead);
    gl.uniform1f(CU.uEmiss,a.emiss||1);
    if(a.type==='rider'&&GLTFR.ready&&gpu.actors.bike){
      let B=null;
      if(BIKE_KEYS.length){
        /* dealt once per rider, deterministic, classic bikes stay in the mix;
           you always get the race bike when one is loaded */
        if(a.me) a.bikeSel=BIKE_KEYS.indexOf('race');
        else if(a.bikeSel===undefined) a.bikeSel=(Math.floor(a.ph*97)%(BIKE_KEYS.length+1))-1;
        if(a.bikeSel>=0) B=GLBIKES[BIKE_KEYS[a.bikeSel%BIKE_KEYS.length]];
      }
      if(B){
        if(!B.gpu) B.gpu=uploadMesh(B.mesh);
        gl.uniform2f(CU.uPivF,B.piv.f[0],B.piv.f[1]);
        gl.uniform2f(CU.uPivR,B.piv.r[0],B.piv.r[1]);
        gl.uniform2f(CU.uPivC,B.piv.c[0],B.piv.c[1]);
        drawMesh(B.gpu);
        gl.uniform2f(CU.uPivF,0.50,0.34);
        gl.uniform2f(CU.uPivR,-0.42,0.34);
        gl.uniform2f(CU.uPivC,-0.02,0.28);
      }else drawMesh(gpu.actors.bike);
      drawMesh(gltfFrameMesh(a));
    }else if(a.gcre&&GLCRE[a.gcre]&&GLCRE[a.gcre].ready) drawMesh(glCreFrame(a));
    else drawMesh(gpu.actors[a.mesh||a.type]);
  }
  gl.uniformMatrix4fv(CU.uModel,false,IDENT);
  gl.uniform4fv(CU.uLimb,NOLIMB);
  gl.uniform4fv(CU.uHead,NOHEAD);
  gl.uniform3f(CU.uWave,0,0,0);
  gl.uniform2f(CU.uSpin,0,0);
  gl.uniform1f(CU.uEmiss,1);
}

