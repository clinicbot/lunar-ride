"use strict";

/* Verdant Rift v117 — GPU-instanced imported nature -----------------------
   One copy of each imported plant mesh is uploaded to the GPU.  Individual
   trees/plants are represented only by compact x/y/z/yaw/scale transforms.
   Visible transforms are streamed around the rider, so the full 25 km can be
   richly populated without baking thousands of duplicate meshes into props. */
(function(){
  const VS=`
attribute vec3 aPosI;
attribute vec3 aNrmI;
attribute vec3 aColI;
attribute vec3 aOffI;
attribute vec2 aYSI;
uniform mat4 uMVPI;
varying vec3 vNI;
varying vec3 vCI;
varying vec3 vWI;
void main(){
  float c=cos(aYSI.x),s=sin(aYSI.x),k=aYSI.y;
  vec3 p=aPosI*k;
  vec3 rp=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);
  vec3 n=normalize(vec3(aNrmI.x*c+aNrmI.z*s,aNrmI.y,-aNrmI.x*s+aNrmI.z*c));
  vec3 wp=rp+aOffI;
  vNI=n;vCI=aColI;vWI=wp;
  gl_Position=uMVPI*vec4(wp,1.0);
}`;
  const FS=`
precision mediump float;
varying vec3 vNI;
varying vec3 vCI;
varying vec3 vWI;
uniform vec3 uSunI,uSunColI,uAmbI,uFogColI,uCamI;
uniform float uFogDenI;
void main(){
  float nd=max(dot(normalize(vNI),normalize(uSunI)),0.0);
  vec3 lit=uAmbI*1.35+uSunColI*(0.22+0.78*nd);
  vec3 col=vCI*lit;
  float dist=length(vWI-uCamI);
  float f=1.0-exp(-pow(dist*uFogDenI,2.0));
  gl_FragColor=vec4(mix(col,uFogColI,clamp(f,0.0,1.0)),1.0);
}`;

  const R={prog:null,U:{},A:{},ext:null,supported:false,groups:{},routeKm:25,
           lastKm:1e9,lastRefresh:0,totalVisible:0,installed:false};

  const mkBuf=(data,usage)=>{
    const b=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,data,usage||gl.STATIC_DRAW);
    return b;
  };
  const freeBuf=b=>{if(b)try{gl.deleteBuffer(b);}catch(e){}};

  function initInstancing(){
    if(R.prog||!gl)return;
    R.ext=isGL2?null:gl.getExtension('ANGLE_instanced_arrays');
    R.supported=!!(isGL2||R.ext);
    if(!R.supported){
      console.warn('Verdant instancing unavailable: ANGLE_instanced_arrays missing');
      return;
    }
    R.prog=makeProgram(VS,FS);
    ['aPosI','aNrmI','aColI','aOffI','aYSI'].forEach(n=>R.A[n]=gl.getAttribLocation(R.prog,n));
    ['uMVPI','uSunI','uSunColI','uAmbI','uFogColI','uCamI','uFogDenI']
      .forEach(n=>R.U[n]=gl.getUniformLocation(R.prog,n));
  }

  const divisor=(loc,n)=>{
    if(loc<0)return;
    if(isGL2)gl.vertexAttribDivisor(loc,n);
    else R.ext.vertexAttribDivisorANGLE(loc,n);
  };
  const drawInst=(verts,count)=>{
    if(isGL2)gl.drawArraysInstanced(gl.TRIANGLES,0,verts,count);
    else R.ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,verts,count);
  };

  function clearGPU(){
    for(const k in R.groups){
      const g=R.groups[k];
      freeBuf(g.pos);freeBuf(g.nrm);freeBuf(g.col);freeBuf(g.inst);
    }
    R.groups={};R.totalVisible=0;R.lastKm=1e9;R.lastRefresh=0;
  }

  function uploadVerdantInstances(w){
    initInstancing();
    clearGPU();
    if(!R.supported||!w||!w.instNature||!w.instNature.ready)return;
    R.routeKm=w.instNature.routeKm||25;
    for(const key in w.instNature.groups){
      const src=w.instNature.groups[key],m=w.instNature.models[key];
      if(!m||!m.count||!src||!src.instances||!src.instances.length)continue;
      R.groups[key]={
        key,kind:src.kind,range:src.range||1.0,instances:src.instances,
        pos:mkBuf(m.pos),nrm:mkBuf(m.nrm),col:mkBuf(m.col),
        inst:mkBuf(new Float32Array(5),gl.DYNAMIC_DRAW),
        verts:m.count,visible:0
      };
    }
    R.lastKm=1e9;
    console.log('Verdant v117 GPU instance groups:',Object.keys(R.groups).length);
  }

  function circularKm(a,b,L){
    let d=Math.abs(a-b);
    if(L>0)d=Math.min(d,L-d);
    return d;
  }

  function refreshVisible(force){
    if(!world||!state.scene||state.scene.id!=='verdant')return;
    const now=(typeof performance!=='undefined'?performance.now():Date.now());
    let km=((state.s||0)/1000)%R.routeKm;if(km<0)km+=R.routeKm;
    if(!force&&circularKm(km,R.lastKm,R.routeKm)<.025&&now-R.lastRefresh<420)return;
    R.lastKm=km;R.lastRefresh=now;R.totalVisible=0;
    for(const key in R.groups){
      const g=R.groups[key],src=g.instances,out=[];
      for(let i=0;i+5<src.length;i+=6){
        if(circularKm(src[i],km,R.routeKm)>g.range)continue;
        out.push(src[i+1],src[i+2],src[i+3],src[i+4],src[i+5]);
      }
      const arr=new Float32Array(out);
      gl.bindBuffer(gl.ARRAY_BUFFER,g.inst);
      gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);
      g.visible=arr.length/5;R.totalVisible+=g.visible;
    }
  }

  function bindAttr(loc,buf,n,stride,off){
    if(loc<0)return;
    gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc,n,gl.FLOAT,false,stride||0,off||0);
  }

  function drawVerdantInstances(mvp,cam,sc){
    if(!R.supported||!R.prog||!world||!world.instNature||state.scene.id!=='verdant')return;
    refreshVisible(false);
    if(!R.totalVisible)return;
    gl.useProgram(R.prog);
    gl.uniformMatrix4fv(R.U.uMVPI,false,mvp);
    const sun=[Math.cos(sc.sun.el)*Math.sin(sc.sun.az),Math.sin(sc.sun.el),
               Math.cos(sc.sun.el)*Math.cos(sc.sun.az)];
    gl.uniform3fv(R.U.uSunI,sun);
    gl.uniform3fv(R.U.uSunColI,hx(sc.sun.col));
    gl.uniform3fv(R.U.uAmbI,hx(sc.sun.amb));
    gl.uniform3fv(R.U.uFogColI,hx(sc.sky.fog));
    gl.uniform3f(R.U.uCamI,cam[0],cam[1],cam[2]);
    gl.uniform1f(R.U.uFogDenI,sc.sky.fogDen);

    for(const key in R.groups){
      const g=R.groups[key];if(!g.visible)continue;
      bindAttr(R.A.aPosI,g.pos,3,0,0);
      bindAttr(R.A.aNrmI,g.nrm,3,0,0);
      bindAttr(R.A.aColI,g.col,3,0,0);
      bindAttr(R.A.aOffI,g.inst,3,20,0);
      bindAttr(R.A.aYSI,g.inst,2,20,12);
      divisor(R.A.aOffI,1);divisor(R.A.aYSI,1);
      drawInst(g.verts,g.visible);
      divisor(R.A.aOffI,0);divisor(R.A.aYSI,0);
    }
    for(const n of ['aPosI','aNrmI','aColI','aOffI','aYSI']){
      const loc=R.A[n];if(loc>=0)gl.disableVertexAttribArray(loc);
    }
    gl.useProgram(progMain);
  }

  /* Hook the normal world upload.  Verdant instance meshes live beside the
     existing GPU world; other worlds simply clear these buffers. */
  const baseUpload=uploadWorld;
  uploadWorld=function(w){const r=baseUpload(w);uploadVerdantInstances(w);return r;};

  /* Initialise the dedicated shader only after the base renderer exists. */
  const baseInit=initGL;
  initGL=function(){const r=baseInit();initInstancing();return r;};

  /* drawActors(430) is the main colour pass; drawActors(210) is the shadow
     pass.  Hook only the former so vegetation does not double the shadow cost. */
  function hookActors(){
    if(R.installed)return;
    if(typeof drawActors!=='function'){setTimeout(hookActors,0);return;}
    const base=drawActors;
    const hooked=function(maxDist){
      if(maxDist>=400&&typeof mMVP!=='undefined'&&typeof eye!=='undefined'&&state.scene)
        drawVerdantInstances(mMVP,eye,state.scene);
      return base.apply(this,arguments);
    };
    hooked.__verdantInstanced=true;
    drawActors=hooked;R.installed=true;
  }
  setTimeout(hookActors,0);

  window.__verdantInstancing={state:R,refresh:()=>refreshVisible(true)};
})();
