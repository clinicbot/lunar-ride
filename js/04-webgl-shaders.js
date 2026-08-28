"use strict";

/* ==========================================================================
   4. WebGL
   ========================================================================== */

const cv=$('view');
let gl=cv.getContext('webgl2',{antialias:true,alpha:false});
let isGL2=!!gl;
if(!gl){
  gl=cv.getContext('webgl',{antialias:true,alpha:false});
  if(gl && !gl.getExtension('OES_element_index_uint')) gl=null;
}

const VS_MAIN=`
attribute vec3 aPos; attribute vec3 aNrm; attribute vec4 aCol; attribute float aLimb;
uniform mat4 uMVP, uModel;
uniform vec4 uLimb;          /* x leg swing, y hip height, z arm swing, w shoulder */
uniform vec4 uHead;          /* x yaw, y pitch, z pivot height, w pivot forward   */
uniform vec3 uWave;          /* x angle, y shoulder height, z shoulder x offset   */
uniform vec2 uSpin;          /* x crank angle, y wheel angle                      */
uniform vec4 uLegL,uLegR;    /* IK legs: thigh angle, shin angle, knee offset z,y */
uniform mat4 uShadowMat;
varying vec3 vN; varying vec4 vC; varying vec3 vW; varying vec4 vSh;
void main(){
  vec3 p=aPos;
  if(aLimb>9.5){             /* IK legs: the knee really bends around the stroke */
    vec4 L=(aLimb<11.5)?uLegL:uLegR;
    bool shin=(aLimb>10.5&&aLimb<11.5)||(aLimb>12.5);
    if(shin){
      float c=cos(L.y),sn2=sin(L.y);
      float dz=p.z+0.16, dy=p.y-0.53;
      p.z=-0.16+dz*c-dy*sn2+L.z;
      p.y= 0.53+dz*sn2+dy*c+L.w;
    }else{
      float c=cos(L.x),sn2=sin(L.x);
      float dz=p.z+0.16, dy=p.y-0.93;
      p.z=-0.16+dz*c-dy*sn2;
      p.y= 0.93+dz*sn2+dy*c;
    }
  }
  else if(aLimb>6.5){        /* cranks and wheels: full rotation in the ride plane */
    float ang=aLimb>7.5?uSpin.y:uSpin.x;
    float py=aLimb>7.5?0.34:0.28;
    float pz=aLimb>8.5?0.50:(aLimb>7.5?-0.42:-0.02);
    float c=cos(ang),sn2=sin(ang);
    float dz=p.z-pz, dy=p.y-py;
    p.z=pz+dz*c-dy*sn2;
    p.y=py+dz*sn2+dy*c;
  }
  else if(aLimb>5.5){        /* a waving arm: lifts sideways off the bars */
    float c=cos(uWave.x),s=sin(uWave.x);
    float dx=p.x-uWave.z, dy=p.y-uWave.y;
    p.x=uWave.z+dx*c-dy*s;
    p.y=uWave.y+dx*s+dy*c;
  }
  else if(aLimb>4.5){        /* the head: turns to watch, and tilts up or down */
    vec3 d=p-vec3(0.0,uHead.z,uHead.w);
    float cy=cos(uHead.x),sy=sin(uHead.x);
    d=vec3(d.x*cy+d.z*sy, d.y, -d.x*sy+d.z*cy);
    float cp=cos(uHead.y),sp=sin(uHead.y);
    d=vec3(d.x, d.y*cp-d.z*sp, d.y*sp+d.z*cp);
    p=d+vec3(0.0,uHead.z,uHead.w);
  }
  else if(aLimb>0.5){        /* swing a limb about its pivot: the walk cycle */
    float ang=(aLimb<2.5)?(aLimb<1.5? uLimb.x:-uLimb.x)
                         :(aLimb<3.5?-uLimb.z: uLimb.z);
    float pv =(aLimb<2.5)? uLimb.y:uLimb.w;
    float c=cos(ang),s=sin(ang), dy=p.y-pv;
    float nz=p.z*c-dy*s, ny=p.z*s+dy*c;
    p.z=nz; p.y=pv+ny;
  }
  vec4 wp=uModel*vec4(p,1.0);
  vN=vec3(uModel*vec4(aNrm,0.0));
  vC=aCol; vW=wp.xyz;
  vSh=uShadowMat*wp;
  gl_Position=uMVP*wp;
}`;

/* camera-facing vegetation billboards: grass tufts and bushes. They rotate
   about their root to face the rider (cylindrical billboarding), the tops
   sway, and the sprite atlas is alpha-tested so no sorting is needed. */
const VS_BILL=`
attribute vec3 aCtr; attribute vec4 aDat; attribute vec2 aUv;
uniform mat4 uMVPB; uniform vec3 uCamB; uniform float uTimeB;
varying vec2 vUv; varying float vRnd; varying vec3 vWp;
void main(){
  vec3 dir=aCtr-uCamB;
  vec3 right=normalize(vec3(dir.z,0.0,-dir.x));
  float sway=sin(uTimeB*1.4+aDat.w*21.0)*0.10*aDat.y;
  vec3 wp=aCtr+right*(aDat.x+sway)*aDat.z
         +vec3(0.0,aDat.y*aDat.z*1.6,0.0);
  vUv=aUv; vRnd=fract(aDat.w); vWp=wp;
  gl_Position=uMVPB*vec4(wp,1.0);
}`;
const FS_BILL=`
precision highp float;
varying vec2 vUv; varying float vRnd; varying vec3 vWp;
uniform sampler2D uAtlas;
uniform vec3 uTintA,uTintB,uSunColB,uAmbB,uFogColB,uCamB;
uniform float uFogDenB;
void main(){
  vec4 t=texture2D(uAtlas,vUv);
  if(t.a*1.4<0.34) discard;
  vec3 tint=mix(uTintA,uTintB,vRnd);
  if(vUv.x>0.4999) tint=mix(vec3(1.0),tint,0.30);   /* tree cells: mostly own colour */
  vec3 col=t.rgb*tint*(uAmbB*1.6+uSunColB*0.85);
  float dist=length(vWp-uCamB);
  float f=1.0-exp(-pow(dist*uFogDenB,2.0));
  gl_FragColor=vec4(mix(col,uFogColB,clamp(f,0.0,1.0)),1.0);
}`;

/* roadside display screens: flat panels in the world showing his AI art */
const VS_SCR=`
attribute vec2 aP;
uniform mat4 uMVPS;
uniform vec3 uPosS,uRightS;
uniform vec2 uSizeS;
varying vec2 vUvS; varying vec3 vWS;
void main(){
  vec3 wp=uPosS+uRightS*(aP.x*uSizeS.x)+vec3(0.0,aP.y*uSizeS.y,0.0);
  vUvS=vec2(aP.x*0.5+0.5,1.0-(aP.y*0.5+0.5));
  vWS=wp;
  gl_Position=uMVPS*vec4(wp,1.0);
}`;
const FS_SCR=`
precision mediump float;
varying vec2 vUvS; varying vec3 vWS;
uniform sampler2D uTexS;
uniform vec3 uCamS,uFogColS,uAmbS,uSunColS;
uniform float uFogDenS;
uniform float uEmS;
void main(){
  vec3 t=texture2D(uTexS,vUvS).rgb;
  vec3 col=t*(uAmbS*1.5+uSunColS*0.55)+t*uEmS;   /* softly self-lit, like a display */
  float dist=length(vWS-uCamS);
  float f=1.0-exp(-pow(dist*uFogDenS,2.0));
  gl_FragColor=vec4(mix(col,uFogColS,clamp(f,0.0,1.0)),1.0);
}`;
let progScr=null, scrQuad=null; const USC={}, SCRTEX={};
function loadScreenTextures(){
  [['moon','assets/images/space stations moon.jfif'],
   ['mars','assets/images/space stations mars.jfif'],
   ['rider','assets/images/bike rider.jfif']].forEach(([k,f])=>{
    const im=new Image();
    im.onload=()=>{
      const tx=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,tx);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      SCRTEX[k]={tx,asp:im.naturalWidth/im.naturalHeight};
    };
    im.src=f;
  });
}

