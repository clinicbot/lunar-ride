"use strict";

/* ==========================================================================
   2. Small helpers
   ========================================================================== */

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const smoothstep=t=>t*t*(3-2*t);
const $=id=>document.getElementById(id);

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function fmtTime(s){
  s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;
  return h?h+':'+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0')
          :m+':'+String(ss).padStart(2,'0');
}

/* '#rrggbb' -> [r,g,b] in 0..1 */
function hx(c){
  const n=parseInt(c.slice(1),16);
  return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

/* ---- 4x4 matrices, just enough for a camera ---- */
function perspective(out,fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2);
  out.fill(0);
  out[0]=f/aspect; out[5]=f; out[10]=(far+near)/(near-far);
  out[11]=-1; out[14]=2*far*near/(near-far);
  return out;
}
function lookAt(out,eye,ctr,up){
  let zx=eye[0]-ctr[0],zy=eye[1]-ctr[1],zz=eye[2]-ctr[2];
  let l=1/Math.hypot(zx,zy,zz)||1; zx*=l;zy*=l;zz*=l;
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz); if(l){l=1/l;xx*=l;xy*=l;xz*=l;}
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;
  out[4]=xy;out[5]=yy;out[6]=zy;out[7]=0;
  out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;
  out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
  out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
  out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
  out[15]=1;
  return out;
}
function matMul(out,a,b){
  for(let i=0;i<4;i++){
    const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
    out[i*4]  =a[0]*b0+a[4]*b1+a[8]*b2+a[12]*b3;
    out[i*4+1]=a[1]*b0+a[5]*b1+a[9]*b2+a[13]*b3;
    out[i*4+2]=a[2]*b0+a[6]*b1+a[10]*b2+a[14]*b3;
    out[i*4+3]=a[3]*b0+a[7]*b1+a[11]*b2+a[15]*b3;
  }
  return out;
}

/* ---- Perlin-style value noise, seeded ---- */
function makeNoise(seed){
  const rnd=mulberry32(seed);
  const perm=new Uint8Array(512);
  const p=[...Array(256).keys()];
  for(let i=255;i>0;i--){const j=(rnd()*(i+1))|0;const t=p[i];p[i]=p[j];p[j]=t;}
  for(let i=0;i<512;i++) perm[i]=p[i&255];
  const fade=t=>t*t*t*(t*(t*6-15)+10);
  const grad=(h,x,y)=>{
    switch(h&3){case 0:return x+y;case 1:return -x+y;case 2:return x-y;default:return -x-y;}
  };
  return function(x,y){
    const xi=Math.floor(x),yi=Math.floor(y);
    const X=xi&255,Y=yi&255;
    const fx=x-xi,fy=y-yi;
    const u=fade(fx),v=fade(fy);
    const A=perm[X]+Y,B=perm[X+1]+Y;
    return lerp(lerp(grad(perm[A],fx,fy),  grad(perm[B],fx-1,fy),  u),
                lerp(grad(perm[A+1],fx,fy-1),grad(perm[B+1],fx-1,fy-1),u), v);
  };
}

/* ==========================================================================
   2b. A tiny mesh kit  --  boxes, tubes and spheres, and the things built
       out of them: habitats, landers, rovers, astronauts, spacecraft.
   --------------------------------------------------------------------------
   Every builder works in its own local space (origin on the ground, facing
   +Z). setTF() stamps a copy into the world at a position, heading and scale,
   which is how the static scenery gets baked into one big mesh.
   ========================================================================== */

function MeshB(){
  this.pos=[];this.nrm=[];this.col=[];this.limb=[];this.idx=[];
  this.setTF(0,0,0,0,1);
}
MeshB.prototype.setTF=function(x,y,z,yaw,k){
  this.tf={x:x,y:y,z:z,c:Math.cos(yaw||0),s:Math.sin(yaw||0),k:(k===undefined?1:k)};
};
MeshB.prototype.P=function(x,y,z){
  const t=this.tf,X=x*t.k,Y=y*t.k,Z=z*t.k;
  return [t.x+X*t.c+Z*t.s, t.y+Y, t.z-X*t.s+Z*t.c];
};
MeshB.prototype.tri=function(a,b,c,col,em,limb){
  const ax=b[0]-a[0],ay=b[1]-a[1],az=b[2]-a[2];
  const bx=c[0]-a[0],by=c[1]-a[1],bz=c[2]-a[2];
  let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l;
  const L=limb||0,E=em||0;
  for(let i=0;i<3;i++){
    const v=i===0?a:(i===1?b:c);
    this.idx.push(this.pos.length/3);
    this.pos.push(v[0],v[1],v[2]);
    this.nrm.push(nx,ny,nz);
    this.col.push(col[0],col[1],col[2],E);
    this.limb.push(L);
  }
};
MeshB.prototype.quad=function(a,b,c,d,col,em,limb){
  this.tri(a,b,c,col,em,limb); this.tri(a,c,d,col,em,limb);
};
/* box: x/z centred, y is the base */
MeshB.prototype.box=function(x,y,z,w,h,d,col,em,limb){
  const P=(a,b,c)=>this.P(a,b,c);
  const x0=x-w/2,x1=x+w/2,y0=y,y1=y+h,z0=z-d/2,z1=z+d/2;
  const v=[P(x0,y0,z0),P(x1,y0,z0),P(x1,y0,z1),P(x0,y0,z1),
           P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)];
  this.quad(v[4],v[5],v[6],v[7],col,em,limb);
  this.quad(v[3],v[2],v[1],v[0],col,em,limb);
  this.quad(v[0],v[1],v[5],v[4],col,em,limb);
  this.quad(v[1],v[2],v[6],v[5],col,em,limb);
  this.quad(v[2],v[3],v[7],v[6],col,em,limb);
  this.quad(v[3],v[0],v[4],v[7],col,em,limb);
};
/* cylinder along an axis: 'y' stands up from the base, 'x'/'z' are centred */
MeshB.prototype.cyl=function(x,y,z,r,h,seg,col,em,axis,limb){
  const P=(a,b,c)=>this.P(a,b,c);
  const ax=axis||'y';
  const at=(u,v,e)=>ax==='y'?P(x+u,y+e,z+v):(ax==='x'?P(x+e,y+u,z+v):P(x+u,y+v,z+e));
  const e0=ax==='y'?0:-h/2, e1=ax==='y'?h:h/2;
  for(let i=0;i<seg;i++){
    const a0=i/seg*6.28318,a1=(i+1)/seg*6.28318;
    const u0=Math.cos(a0)*r,v0=Math.sin(a0)*r,u1=Math.cos(a1)*r,v1=Math.sin(a1)*r;
    this.quad(at(u0,v0,e0),at(u1,v1,e0),at(u1,v1,e1),at(u0,v0,e1),col,em,limb);
    this.tri(at(0,0,e1),at(u0,v0,e1),at(u1,v1,e1),col,em,limb);
    this.tri(at(0,0,e0),at(u1,v1,e0),at(u0,v0,e0),col,em,limb);
  }
};
/* sphere centred at (x,y,z); hemi=true makes a dome whose base sits at y */
MeshB.prototype.sph=function(x,y,z,r,seg,rings,col,em,hemi,ys,limb){
  const P=(a,b,c)=>this.P(a,b,c);
  ys=ys===undefined?1:ys;
  const span=hemi?Math.PI/2:Math.PI;
  for(let a=0;a<rings;a++){
    const t0=a/rings*span,t1=(a+1)/rings*span;
    for(let b=0;b<seg;b++){
      const p0=b/seg*6.28318,p1=(b+1)/seg*6.28318;
      const V=(t,p)=>P(x+Math.sin(t)*Math.cos(p)*r, y+Math.cos(t)*r*ys, z+Math.sin(t)*Math.sin(p)*r);
      this.quad(V(t0,p0),V(t0,p1),V(t1,p1),V(t1,p0),col,em,limb);
    }
  }
};
MeshB.prototype.cone=function(x,y,z,r,h,seg,col,em,flip){
  const P=(a,b,c)=>this.P(a,b,c);
  const apex=P(x,y+(flip?-h:h),z);
  for(let i=0;i<seg;i++){
    const a0=i/seg*6.28318,a1=(i+1)/seg*6.28318;
    const p0=P(x+Math.cos(a0)*r,y,z+Math.sin(a0)*r);
    const p1=P(x+Math.cos(a1)*r,y,z+Math.sin(a1)*r);
    this.tri(apex,p0,p1,col,em); this.tri(apex,p1,p0,col,em);
  }
};
MeshB.prototype.disc=function(x,y,z,r,seg,col,em){
  const P=(a,b,c)=>this.P(a,b,c);
  const c0=P(x,y,z);
  for(let i=0;i<seg;i++){
    const a0=i/seg*6.28318,a1=(i+1)/seg*6.28318;
    this.tri(c0,P(x+Math.cos(a0)*r,y,z+Math.sin(a0)*r),
                P(x+Math.cos(a1)*r,y,z+Math.sin(a1)*r),col,em);
  }
};

/* ---------------- the models ---------------- */

function mDome(m,p,r){                       /* pressurised habitat dome */
  m.sph(0,0,0,r,18,9,p.hull,0,true,0.70);
  m.cyl(0,-0.15,0,r*1.05,0.7,18,p.trim,0);
  m.cyl(0,r*0.42,0,r*0.80,0.26,18,p.trim,0);         /* belt line, like the art */
  m.sph(0,r*0.68,0,r*0.15,8,5,p.trim,0);             /* crown cupola */
  m.box(0,0,r*0.92,2.0,2.3,0.5,p.glow,0.9);          /* lit airlock */
  for(let i=0;i<7;i++){
    const a=i/7*6.28318+0.4;
    m.box(Math.cos(a)*r*0.80,r*0.30,Math.sin(a)*r*0.80,1.0,0.8,1.0,p.glow,0.7);
  }
}
function mGreenhouse(m,g,p,r){               /* glass crop dome, from his AI art */
  m.cyl(0,-0.15,0,r*1.05,1.0,18,p.trim,0);           /* base ring */
  m.disc(0,0.82,0,r*0.99,18,p.dark,0);               /* floor */
  const rows=Math.max(2,Math.round(r/2.4));
  for(let i2=0;i2<rows;i2++){                        /* planted beds in rows */
    const x=(i2-(rows-1)/2)*2.3;
    const half=Math.sqrt(Math.max(1.2,r*r*0.52-x*x));
    m.box(x,1.10,0,1.5,0.6,half*2.0,p.trim,0);
    m.box(x,1.55,0,1.25,0.4,half*1.9,[0.30,0.60,0.24],0.18);
    m.box(x,1.74,0,1.00,0.28,half*1.7,[0.42,0.74,0.30],0.22);
  }
  m.cyl(0,0.8,0,0.55,r*0.60,10,p.hull,0);            /* central column */
  m.cyl(0,1.5,r*0.92,1.25,2.6,10,p.trim,0,'z');      /* airlock tunnel */
  m.box(0,1.35,r*0.92+1.35,1.3,1.8,0.3,p.glow,0.85); /* lit door */
  for(const f of [0.30,0.58,0.80]){                  /* lattice rib rings */
    const ry=0.8+r*0.72*f, rr=r*Math.sqrt(1-f*f)*1.005;
    m.cyl(0,ry-0.10,0,rr,0.20,18,p.trim,0);
  }
  m.sph(0,0.8+r*0.72,0,r*0.13,8,5,p.trim,0);         /* crown cap */
  g.sph(0,0.8,0,r,18,9,[0.72,0.85,0.90],0.06,true,0.72);   /* the glass */
}
function mHab(m,p){                          /* habitat module on legs */
  m.cyl(0,3.2,0,2.5,13,16,p.hull,0,'z');
  m.sph(0,3.2,6.5,2.5,14,7,p.trim,0);
  m.sph(0,3.2,-6.5,2.5,14,7,p.trim,0);
  for(const z of [-4.6,-1.6,1.6,4.6]){
    m.cyl(-1.9,0,z,0.24,0.75,6,p.dark,0);
    m.cyl( 1.9,0,z,0.24,0.75,6,p.dark,0);
  }
  for(let i=0;i<5;i++) m.box(2.35,3.2,-4+i*2,0.4,0.9,0.9,p.glow,0.75);
  m.box(0,0,7.0,1.7,2.2,0.4,p.glow,0.9);
}
function mTube(m,p,len){                     /* connecting walkway */
  m.cyl(0,1.6,0,1.1,len,12,p.trim,0,'z');
  for(let i=0;i<len/3;i++) m.box(0,0,-len/2+i*3+1.5,2.6,0.35,0.4,p.dark,0);
  for(let z2=-len/2+1.2;z2<len/2-1.0;z2+=2.4)        /* corrugation rings */
    m.cyl(0,1.6,z2,1.18,0.34,12,p.dark,0,'z');
}
function mSolarFarm(m,p){                    /* rows of tilted arrays, like the art */
  for(let rz2=0;rz2<2;rz2++) for(let cx=0;cx<3;cx++){
    const bx=(cx-1)*7.4, bz=(rz2-0.5)*9.0;
    for(const lx of [-2.6,2.6]){
      m.cyl(bx+lx,0,bz-2.4,0.16,1.6,6,p.trim,0);
      m.cyl(bx+lx,0,bz+2.4,0.16,1.6,6,p.trim,0);
    }
    for(let sx2=0;sx2<3;sx2++)for(let sz2=0;sz2<2;sz2++){
      const x0=bx-3.1+sx2*2.07+0.07, x1=bx-3.1+(sx2+1)*2.07-0.07;
      const y0=1.2+(x0-(bx-3.1))/6.2*2.2, y1=1.2+(x1-(bx-3.1))/6.2*2.2;
      const z0=bz-3.4+sz2*3.4+0.08, z1=bz-3.4+(sz2+1)*3.4-0.08;
      const pc=(sx2+sz2)%2?p.panel:[p.panel[0]*1.30+0.02,p.panel[1]*1.30+0.02,p.panel[2]*1.18+0.02];
      const a=m.P(x0,y0,z0),b2=m.P(x1,y1,z0),c2=m.P(x1,y1,z1),d2=m.P(x0,y0,z1);
      m.quad(a,b2,c2,d2,pc,0.06); m.quad(d2,c2,b2,a,p.dark,0);
    }
  }
}
function mSolar(m,p){
  m.cyl(0,0,0,0.35,3.4,8,p.trim,0);
  for(const s of [-1,1]){
    const a=m.P(s*0.5,3.2,-3.2), b=m.P(s*6.2,4.6,-3.2);
    const c=m.P(s*6.2,4.6,3.2),  d=m.P(s*0.5,3.2,3.2);
    m.quad(a,b,c,d,p.panel,0.05); m.quad(d,c,b,a,p.dark,0);
  }
}
function mDish(m,p){
  m.cyl(0,0,0,0.55,2.6,10,p.trim,0);
  m.box(0,2.6,0,1.4,0.9,1.4,p.dark,0);
  const R=3.4,cy=3.5;
  for(let i=0;i<22;i++){
    const a0=i/22*6.28318,a1=(i+1)/22*6.28318;
    const c=m.P(0,cy,0);
    const e0=m.P(Math.cos(a0)*R,cy+1.5,Math.sin(a0)*R);
    const e1=m.P(Math.cos(a1)*R,cy+1.5,Math.sin(a1)*R);
    m.tri(c,e0,e1,p.hull,0); m.tri(c,e1,e0,p.trim,0);
  }
  m.cyl(0,cy,0,0.13,1.6,6,p.dark,0);
}
function mMast(m,p,h){
  h=h||16;
  for(let i=0;i<3;i++){
    const a=i/3*6.28318;
    m.cyl(Math.cos(a)*0.95,0,Math.sin(a)*0.95,0.13,h,5,p.trim,0);
  }
  for(let k=1;k<7;k++) m.box(0,h*k/7,0,2.1,0.13,2.1,p.trim,0);
  m.sph(0,h+0.5,0,0.45,8,5,[1,0.22,0.18],1.30,false,1);
}
function mPad(m,p,r){                        /* landing pad with edge lights */
  m.disc(0,0.10,0,r,28,p.dark,0);
  m.disc(0,0.13,0,r*0.5,22,p.trim,0);
  for(let i=0;i<12;i++){
    const a=i/12*6.28318;
    m.box(Math.cos(a)*r*0.93,0.12,Math.sin(a)*r*0.93,0.55,0.4,0.55,p.glow,1+i/12);
  }
}
function mLander(m,p){
  m.cyl(0,2.9,0,3.0,2.7,8,p.gold,0.06);      /* descent stage */
  m.cyl(0,5.6,0,2.1,2.3,8,p.hull,0);         /* ascent stage */
  m.sph(0,7.9,0,2.0,12,7,p.hull,0,true,0.8);
  m.cone(0,2.9,0,1.2,1.7,10,p.dark,0,true);  /* engine bell */
  for(let i=0;i<4;i++){
    const a=i/4*6.28318+0.785;
    m.box(Math.cos(a)*2.9,0,Math.sin(a)*2.9,0.28,3.0,0.28,p.trim,0);
    m.disc(Math.cos(a)*3.4,0.08,Math.sin(a)*3.4,0.95,10,p.trim,0);
  }
  m.box(0,2.4,3.1,1.3,1.9,0.35,p.glow,0.85);
  m.sph(0,10.1,0,0.3,6,4,[1,0.25,0.2],1.55,false,1);
}
function mCrates(m,p,rnd){
  for(let i=0;i<6;i++){
    const a=rnd()*6.28318,d=2+rnd()*7,s=0.8+rnd()*0.9;
    m.box(Math.cos(a)*d,0,Math.sin(a)*d,s,s*0.85,s,rnd()<.4?p.gold:p.trim,0);
  }
}
function mRover(m,p){                        /* faces +Z */
  m.box(0,0.72,0,2.0,0.75,3.4,p.hull,0);
  m.box(0,1.47,-0.5,1.8,0.12,2.0,p.panel,0.05);
  for(const s of [-1,1]) for(const z of [-1.2,0,1.2])
    m.cyl(s*1.12,0.55,z,0.55,0.36,10,p.dark,0,'x');
  m.cyl(0,1.47,-1.35,0.1,1.5,6,p.trim,0);
  m.sph(0,3.0,-1.35,0.5,8,5,p.trim,0,true,0.6);
  m.box(0,1.47,0.9,1.0,0.65,0.5,p.dark,0);
  for(const s of [-1,1]) m.sph(s*0.62,0.98,1.72,0.2,6,4,p.flame,0.95);
}
function mAstro(m,p){                        /* faces +Z, feet at y=0 */
  m.box(-0.17,0,0,0.25,0.86,0.29,p.suit,0,1);
  m.box( 0.17,0,0,0.25,0.86,0.29,p.suit,0,2);
  m.box(0,0.84,0,0.63,0.63,0.42,p.suit,0);
  m.box(0,0.92,-0.35,0.54,0.52,0.28,p.pack,0);
  m.box(-0.43,0.83,0,0.20,0.62,0.23,p.suit,0,3);
  m.box( 0.43,0.83,0,0.20,0.62,0.23,p.suit,0,4);
  m.sph(0,1.66,0,0.27,10,6,p.suit,0);
  m.sph(0,1.66,0.14,0.22,8,5,p.visor,0.22);
  m.box(0,1.28,0.08,0.5,0.11,0.34,p.stripe,0);
}
function mShuttle(m,p){                      /* faces +Z */
  m.cyl(0,0,0,1.5,13,14,p.hull,0,'z');
  m.sph(0,0,6.5,1.5,12,6,p.hull,0);
  m.sph(0,0,-6.5,1.5,12,6,p.trim,0);
  for(const s of [-1,1]){
    const a=m.P(s*1.2,-0.3,2.6), b=m.P(s*6.6,-0.5,-4.2);
    const c=m.P(s*6.6,-0.2,-5.8), d=m.P(s*1.2,0.2,-4.2);
    m.quad(a,b,c,d,p.hull,0); m.quad(d,c,b,a,p.trim,0);
    m.sph(s*6.1,-0.35,-5.0,0.32,6,4,s<0?[1,0.2,0.2]:[0.2,1,0.35],1.5+(s<0?0:0.25),false,1);
    m.cyl(s*0.95,-0.3,-7.1,0.62,1.5,10,p.dark,0,'z');
    m.sph(s*0.95,-0.3,-7.9,0.55,8,5,p.flame,1.0);
  }
  const f0=m.P(0,0.9,-4.4),f1=m.P(0,3.6,-5.9),f2=m.P(0,3.6,-6.9),f3=m.P(0,0.9,-6.9);
  m.quad(f0,f1,f2,f3,p.trim,0); m.quad(f3,f2,f1,f0,p.trim,0);
}
function mDrone(m,p){
  m.sph(0,0,0,0.85,10,6,p.hull,0);
  m.sph(0,0,0.6,0.45,8,5,p.visor,0.3);
  for(let i=0;i<4;i++){
    const a=i/4*6.28318+0.785;
    m.box(Math.cos(a)*1.1,-0.12,Math.sin(a)*1.1,0.32,0.22,0.32,p.trim,0);
    m.sph(Math.cos(a)*1.6,-0.18,Math.sin(a)*1.6,0.24,6,4,p.flame,1.0+i*0.25,false,1);
  }
}

/* ---------------- big structures ---------------- */

function mStation(m,p){          /* orbital station: ring, spine, solar wings */
  const P=(x,y,z)=>m.P(x,y,z);
  m.cyl(0,0,0,0.9,17,10,p.hull,0,'z');
  m.sph(0,0,6.5,1.7,12,8,p.hull,0);
  m.sph(0,0,-6.5,1.4,12,8,p.trim,0);
  const R=7.4,w=1.2,F=0.65;
  for(let i=0;i<26;i++){
    const a0=i/26*6.28318,a1=(i+1)/26*6.28318;
    const c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
    const O0=[c0*R,s0*R],O1=[c1*R,s1*R],I0=[c0*(R-w),s0*(R-w)],I1=[c1*(R-w),s1*(R-w)];
    m.quad(P(O0[0],O0[1],F),P(O1[0],O1[1],F),P(I1[0],I1[1],F),P(I0[0],I0[1],F),p.hull,0);
    m.quad(P(I0[0],I0[1],-F),P(I1[0],I1[1],-F),P(O1[0],O1[1],-F),P(O0[0],O0[1],-F),p.hull,0);
    m.quad(P(O0[0],O0[1],-F),P(O1[0],O1[1],-F),P(O1[0],O1[1],F),P(O0[0],O0[1],F),p.trim,0);
    m.quad(P(I0[0],I0[1],F),P(I1[0],I1[1],F),P(I1[0],I1[1],-F),P(I0[0],I0[1],-F),p.dark,0);
    if(i%2===0){
      const mx=c0*(R-w*0.5),my=s0*(R-w*0.5);
      m.sph(mx,my,F+0.05,0.18,5,4,p.glow,0.9);
    }
  }
  for(let i=0;i<4;i++){                     /* spokes */
    const a=i/4*6.28318,c=Math.cos(a),s=Math.sin(a),nx=-s*0.36,ny=c*0.36;
    const A=P(nx,ny,0.3),B=P(c*R+nx,s*R+ny,0.3),C=P(c*R-nx,s*R-ny,0.3),D=P(-nx,-ny,0.3);
    m.quad(A,B,C,D,p.trim,0); m.quad(D,C,B,A,p.trim,0);
  }
  for(const s of [-1,1]){                   /* solar wings */
    const A=P(s*2.0,0,-9.5),B=P(s*15.0,0,-9.5),C=P(s*15.0,0,-2.5),D=P(s*2.0,0,-2.5);
    m.quad(A,B,C,D,p.panel,0.05); m.quad(D,C,B,A,p.dark,0);
  }
  m.sph(0,0,9.2,0.4,6,4,[1,0.25,0.2],1.4,false,1);
}

function mSpaceport(m,p){        /* a proper launch facility */
  const P=(x,y,z)=>m.P(x,y,z);
  const R=9,L=34;
  for(let i=0;i<18;i++){         /* arched hangar */
    const a0=Math.PI*i/18,a1=Math.PI*(i+1)/18;
    const x0=Math.cos(a0)*R,y0=Math.sin(a0)*R,x1=Math.cos(a1)*R,y1=Math.sin(a1)*R;
    m.quad(P(x0,y0,-L/2),P(x1,y1,-L/2),P(x1,y1,L/2),P(x0,y0,L/2),p.hull,0);
    m.quad(P(x0,y0,L/2),P(x1,y1,L/2),P(x1,y1,-L/2),P(x0,y0,-L/2),p.dark,0);
    if(i%4===0) m.box(Math.cos(a0)*(R-0.4),Math.sin(a0)*(R-0.4)-0.2,L/2-2,0.5,0.4,0.5,p.glow,0.8);
  }
  m.box(0,0,-L/2-0.3,R*2,R*0.95,0.6,p.trim,0);       /* back wall */
  m.box(0,0,L/2+0.3,R*2,1.2,0.6,p.trim,0);
  m.box(0,1.2,L/2+0.35,12,8,0.5,p.glow,0.45);        /* the open door */
  m.cyl(17,0,-9,1.7,15,10,p.trim,0);                 /* control tower */
  m.cyl(17,15,-9,3.6,3.2,10,p.hull,0);
  m.sph(17,18.2,-9,3.4,12,6,p.glow,0.5,true,0.45);
  m.sph(17,22.2,-9,0.35,6,4,[1,0.25,0.2],1.15,false,1);
  m.cyl(-24,0,12,2.5,30,12,p.hull,0);                /* the rocket on the pad */
  m.cone(-24,30,12,2.5,7.5,12,p.hull,0);
  m.cone(-24,1.5,12,2.7,3.2,12,p.dark,0,true);
  for(let i=0;i<4;i++){
    const a=i/4*6.28318+0.785;
    m.box(-24+Math.cos(a)*2.6,0,12+Math.sin(a)*2.6,0.5,4.5,0.5,p.trim,0);
  }
  for(let k=0;k<6;k++) m.box(-19.5,2+k*4.6,12,3.5,0.5,3.5,p.trim,0);  /* gantry */
  m.cyl(-18,0,12,0.5,28,6,p.trim,0);
  for(let i=0;i<3;i++){                               /* fuel tanks */
    m.cyl(7+i*6.5,0,-22,2.5,7,10,p.trim,0);
    m.sph(7+i*6.5,7,-22,2.5,10,5,p.trim,0,true,0.55);
  }
  for(const f of [[-9,22],[11,22],[-9,-25],[24,6]]){  /* floodlight masts */
    m.cyl(f[0],0,f[1],0.28,10,6,p.trim,0);
    m.box(f[0],10,f[1],1.4,0.6,0.8,p.glow,0.95);
  }
}

/* ---------------- flora ---------------- */
/* Fronds are strips of quads, drawn on both sides so they read from anywhere. */

function frond(m,p,x,y,z,dx,dz,segs,len,rise,wid,col,back,em){
  for(let k=0;k<segs;k++){
    const t=k/segs, t2=(k+1)/segs;
    const nx=x+dx*len*(0.45+t), nz=z+dz*len*(0.45+t);
    const ny=y+rise(t2)-rise(t);
    const w0=wid(t), w1=wid(t2);
    const a0=m.P(x-dz*w0,y,z+dx*w0), b0=m.P(x+dz*w0,y,z-dx*w0);
    const a1=m.P(nx-dz*w1,ny,nz+dx*w1), b1=m.P(nx+dz*w1,ny,nz-dx*w1);
    m.quad(a0,b0,b1,a1,col,em||0.02);
    m.quad(a1,b1,b0,a0,back,0);
    x=nx; y=ny; z=nz;
  }
  return [x,y,z];
}

function mSpire(m,p,rnd){        /* tall tree with drooping glowing fronds */
  const h=4+rnd()*5.5;
  m.cyl(0,0,0,0.26,h*0.55,7,p.stem,0);
  m.cyl(0,h*0.55,0,0.17,h*0.47,6,p.stem,0);
  const n=6+Math.floor(rnd()*4);
  for(let i=0;i<n;i++){
    const a=i/n*6.28318+rnd()*0.35, dx=Math.cos(a), dz=Math.sin(a);
    const drop=0.9+rnd()*0.6;
    const end=frond(m,p,0,h,0,dx,dz,4,0.95+rnd()*0.4,
      t=>-drop*t*t*2.2, t=>0.42*(1-t*0.75)+0.05, p.leaf,p.stem,0.03);
    m.sph(end[0],end[1]-0.12,end[2],0.15+rnd()*0.09,7,5,p.glow,0.9);
  }
}
function mFan(m,p,rnd){          /* low rosette of broad fronds */
  const n=5+Math.floor(rnd()*5), H=1.0+rnd()*1.6;
  m.sph(0,0,0,0.34,8,5,p.stem,0,true,0.6);
  for(let i=0;i<n;i++){
    const a=i/n*6.28318+rnd()*0.4, dx=Math.cos(a), dz=Math.sin(a);
    frond(m,p,0,0.28,0,dx,dz,5,0.42+rnd()*0.22,
      t=>H*Math.sin(t*2.0)*0.75, t=>0.30*Math.sin((t+0.12)*Math.PI)+0.06, p.leaf,p.stem,0.03);
  }
}
function mPods(m,p,rnd){         /* bulbs on stalks */
  const n=3+Math.floor(rnd()*4);
  for(let i=0;i<n;i++){
    const a=rnd()*6.28318,d=rnd()*0.55,h=0.5+rnd()*1.5;
    const x=Math.cos(a)*d,z=Math.sin(a)*d;
    m.cyl(x,0,z,0.065,h,5,p.stem,0);
    m.sph(x,h+0.2,z,0.17+rnd()*0.17,9,6,p.glow,0.85);
  }
}
function mCrystal(m,p,rnd){      /* mineral growth, for the airless worlds */
  const n=3+Math.floor(rnd()*5);
  for(let i=0;i<n;i++){
    const a=rnd()*6.28318,d=rnd()*0.75,h=0.5+rnd()*2.7,r=0.12+rnd()*0.3;
    const x=Math.cos(a)*d,z=Math.sin(a)*d;
    const top=m.P(x+(rnd()-0.5)*0.35,h,z+(rnd()-0.5)*0.35);
    for(let k=0;k<5;k++){
      const a0=k/5*6.28318,a1=(k+1)/5*6.28318;
      const q0=m.P(x+Math.cos(a0)*r,0,z+Math.sin(a0)*r);
      const q1=m.P(x+Math.cos(a1)*r,0,z+Math.sin(a1)*r);
      m.tri(q0,q1,top,p.leaf,0.12); m.tri(q1,q0,top,p.leaf,0.12);
    }
  }
}
function mTuft(m,p,rnd){         /* ground cover */
  const n=7+Math.floor(rnd()*9);
  for(let i=0;i<n;i++){
    const a=rnd()*6.28318,d=rnd()*0.5,h=0.25+rnd()*0.7;
    const x=Math.cos(a)*d,z=Math.sin(a)*d;
    const la=rnd()*6.28318,lean=0.2+rnd()*0.45;
    const b0=m.P(x-0.05,0,z),b1=m.P(x+0.05,0,z);
    const tp=m.P(x+Math.cos(la)*lean,h,z+Math.sin(la)*lean);
    m.tri(b0,b1,tp,p.leaf,0.02); m.tri(b1,b0,tp,p.leaf,0.02);
  }
}

/* ---------------- fauna ----------------
   Limb 1 and 2 are legs in antiphase, 3 and 4 forelimbs, 5 is the head.
   The head pivot is given per species in CREATURE below.            */

function mStrider(m,p){          /* tall four-legged browser, ~4.5 m */
  const legs=[[-0.58,1.1,1],[0.58,1.1,2],[-0.62,-1.15,2],[0.62,-1.15,1]];
  for(let i=0;i<4;i++){
    const lx=legs[i][0],lz=legs[i][1],id=legs[i][2];
    m.box(lx,0.15,lz,0.17,1.35,0.19,p.dark,0,id);
    m.box(lx,1.45,lz,0.24,1.15,0.26,p.skin,0,id);
    m.box(lx,0,lz+0.06,0.27,0.17,0.4,p.dark,0,id);
  }
  m.sph(0,3.05,0,1.05,13,8,p.skin,0,false,0.60);
  m.sph(0,3.10,-1.15,0.66,10,6,p.skin,0,false,0.68);
  for(let i=0;i<5;i++) m.box(0,3.45,-1.0+i*0.52,0.11,0.26+i*0.06,0.3,p.accent,0);
  m.box(0,3.0,-2.0,0.15,0.15,1.3,p.dark,0);
  m.box(0,3.25,1.0,0.30,1.15,0.32,p.skin,0,5);
  m.sph(0,4.5,1.32,0.43,11,7,p.skin,0,false,0.85,5);
  m.sph(-0.23,4.58,1.62,0.155,7,5,p.eye,0.95,false,1,5);
  m.sph( 0.23,4.58,1.62,0.155,7,5,p.eye,0.95,false,1,5);
  m.box(-0.16,4.85,1.2,0.07,0.42,0.1,p.accent,0,5);
  m.box( 0.16,4.85,1.2,0.07,0.42,0.1,p.accent,0,5);
}
function mGrazer(m,p){           /* low six-legged armoured grazer, ~1.6 m */
  for(let s=-1;s<=1;s+=2) for(let i=0;i<3;i++){
    const lz=1.0-i*1.0, id=((i%2)===0)?(s<0?1:2):(s<0?2:1);
    m.box(s*0.88,0,lz,0.2,0.66,0.2,p.dark,0,id);
    m.box(s*0.8,0.6,lz,0.26,0.34,0.28,p.skin,0,id);
  }
  m.sph(0,0.92,0,1.5,15,8,p.skin,0,false,0.40);
  m.sph(0,0.98,-0.1,1.24,13,7,p.accent,0,true,0.52);
  for(let i=0;i<5;i++) m.box(0,1.3,-1.0+i*0.52,0.55,0.15,0.32,p.dark,0);
  m.box(0,0.8,1.5,0.44,0.44,0.62,p.skin,0,5);
  m.sph(0,1.02,1.9,0.35,11,7,p.skin,0,false,0.8,5);
  m.sph(-0.2,1.12,2.12,0.115,6,4,p.eye,0.95,false,1,5);
  m.sph( 0.2,1.12,2.12,0.115,6,4,p.eye,0.95,false,1,5);
  m.box(0,1.32,1.75,0.42,0.12,0.3,p.accent,0,5);
}
function mHopper(m,p){           /* small biped, big hind legs, ~1.9 m */
  m.box(-0.3,0,-0.18,0.31,0.88,0.5,p.skin,0,1);
  m.box( 0.3,0,-0.18,0.31,0.88,0.5,p.skin,0,2);
  m.box(-0.3,0,0.2,0.28,0.16,0.55,p.dark,0,1);
  m.box( 0.3,0,0.2,0.28,0.16,0.55,p.dark,0,2);
  m.sph(0,1.2,0,0.52,11,7,p.skin,0,false,0.92);
  m.box(-0.44,1.02,0.24,0.15,0.44,0.15,p.skin,0,3);
  m.box( 0.44,1.02,0.24,0.15,0.44,0.15,p.skin,0,4);
  m.box(0,1.02,-0.85,0.17,0.17,1.35,p.dark,0);
  m.box(0,0.96,-1.7,0.11,0.11,0.75,p.accent,0);
  m.box(0,1.45,0.12,0.29,0.38,0.32,p.skin,0,5);
  m.sph(0,1.82,0.3,0.33,11,7,p.skin,0,false,0.85,5);
  m.sph(-0.17,1.88,0.55,0.125,6,4,p.eye,0.95,false,1,5);
  m.sph( 0.17,1.88,0.55,0.125,6,4,p.eye,0.95,false,1,5);
  m.box(-0.15,2.08,0.18,0.08,0.42,0.16,p.accent,0,5);
  m.box( 0.15,2.08,0.18,0.08,0.42,0.16,p.accent,0,5);
}
function mDrifter(m,p){          /* floats; reacts by rising and brightening */
  m.sph(0,0,0,1.15,15,8,p.skin,0.22,true,0.82);
  m.sph(0,0.3,0,0.6,11,6,p.glow,0.55,true,0.7);
  for(let i=0;i<15;i++){
    const a=i/15*6.28318;
    m.sph(Math.cos(a)*1.09,0.02,Math.sin(a)*1.09,0.09,5,4,p.glow,1.0);
  }
  for(let i=0;i<7;i++){
    const a=i/7*6.28318, r=0.5+(i%2)*0.3;
    for(let k=0;k<4;k++)
      m.box(Math.cos(a)*r,-0.42-k*0.52,Math.sin(a)*r,0.07,0.52,0.07,
            p.accent,k===3?0.55:0);
  }
}

function mRider(m,p){             /* cyclist on a bike, faces +Z, wheels at y=0 */
  /* a thin two-sided cross of strips reads as a round tube from any angle —
     this is what lets the frame have real racing geometry instead of boxes */
  const tube=(ax,ay,az,bx,by,bz,w,col,limb)=>{
    let A=m.P(ax-w,ay,az),B=m.P(ax+w,ay,az),C=m.P(bx+w,by,bz),D=m.P(bx-w,by,bz);
    m.quad(A,B,C,D,col,0,limb); m.quad(D,C,B,A,col,0,limb);
    A=m.P(ax,ay-w,az);B=m.P(ax,ay+w,az);C=m.P(bx,by+w,bz);D=m.P(bx,by-w,bz);
    m.quad(A,B,C,D,col,0,limb); m.quad(D,C,B,A,col,0,limb);
  };
  /* ---- the bike: real race geometry, wheels that really spin ---- */
  for(const z of [-0.42,0.50]){
    const wl=z<0?8:9;                                 /* limb: rear 8, front 9 */
    m.cyl(0,0.34,z,0.335,0.030,14,p.dark,0,'x',wl);
    m.cyl(0,0.34,z,0.345,0.012,14,p.bike,0,'x',wl);
    m.cyl(0,0.34,z,0.055,0.05,6,p.bike,0,'x',wl);
    for(let sp2=0;sp2<3;sp2++){                        /* spokes show the spin */
      const a2=sp2/3*Math.PI;
      const dz2=Math.cos(a2)*0.30, dy2=Math.sin(a2)*0.30;
      m.setTF(0,0,0,0,1);
      const A=m.P(-0.012,0.34-dy2,z-dz2),B=m.P(0.012,0.34-dy2,z-dz2);
      const C=m.P(0.012,0.34+dy2,z+dz2),D=m.P(-0.012,0.34+dy2,z+dz2);
      m.quad(A,B,C,D,p.bike,0.05,wl); m.quad(D,C,B,A,p.bike,0.05,wl);
    }
  }
  /* cranks and pedals, limb 7: a full circle with the cadence */
  m.box(-0.115,0.10,-0.02,0.045,0.19,0.045,p.dark,0,7);
  m.box( 0.115,0.28,-0.02,0.045,0.19,0.045,p.dark,0,7);
  m.box(-0.145,0.085,-0.02,0.10,0.03,0.13,p.dark,0,7);
  m.box( 0.145,0.475,-0.02,0.10,0.03,0.13,p.dark,0,7);
  tube(0,0.62,0.40,  0,0.28,-0.02, 0.030,p.bike);     /* down tube */
  tube(0,0.28,-0.02, 0,0.96,-0.20, 0.028,p.bike);     /* seat tube + post */
  tube(0,0.93,0.36,  0,0.96,-0.18, 0.024,p.bike);     /* top tube */
  tube(0,0.28,-0.02, 0,0.34,-0.42, 0.020,p.bike);     /* chain stays */
  tube(0,0.94,-0.19, 0,0.34,-0.42, 0.018,p.bike);     /* seat stays */
  tube(0,0.95,0.38,  0,0.34,0.50,  0.024,p.bike);     /* head tube + fork */
  tube(0,0.97,0.40,  0,0.99,0.48,  0.020,p.bike);     /* stem */
  m.box(0,0.985,0.48,0.40,0.030,0.05,p.dark,0);       /* bar top */
  m.box(-0.19,0.90,0.51,0.035,0.10,0.05,p.dark,0);    /* drops */
  m.box( 0.19,0.90,0.51,0.035,0.10,0.05,p.dark,0);
  m.box(0,0.97,-0.22,0.13,0.04,0.27,p.dark,0);        /* saddle */
  m.cyl(0,0.28,-0.02,0.09,0.04,8,p.dark,0,'x');       /* chainring */
  m.cyl(0,0.42,0.16,0.045,0.17,6,p.jersey2,0);        /* bottle on the down tube */
  if(p.bikeOnly) return;                              /* the glTF body replaces the rest */
  /* ---- the rider: IK legs (thigh 10/12, shin 11/13), bind pose straight
         down — hip y .93, knee .53, ankle .11, all at z -.16 ---- */
  for(const sd of [-1,1]){
    const x=sd*0.095, tl=sd<0?10:12, sl=sd<0?11:13;
    m.sph(x,0.91,-0.16,0.098,8,5,p.dark,0,false,1,tl);      /* hip */
    m.cyl(x,0.55,-0.16,0.080,0.37,8,p.dark,0,'y',tl);       /* thigh in the bib */
    m.sph(x,0.54,-0.16,0.064,8,5,p.skin,0,false,1,tl);      /* knee */
    m.cyl(x,0.12,-0.16,0.050,0.42,8,p.skin,0,'y',sl);       /* shin */
    m.sph(x,0.45,-0.185,0.056,7,4,p.skin,0,false,1,sl);     /* calf */
    m.cyl(x,0.15,-0.16,0.054,0.10,8,p.jersey2,0,'y',sl);    /* sock */
    m.box(x,0.095,-0.05,0.085,0.065,0.24,p.jersey2,0,sl);   /* shoe */
  }
  /* the body: a curve of spheres from the hips up over the bars */
  m.sph(0,0.96,-0.14,0.175,10,6,p.dark,0);                  /* hips, bib shorts */
  m.sph(0,1.04, 0.00,0.185,10,6,p.jersey,0);
  m.sph(0,1.11, 0.13,0.180,10,6,p.jersey,0);
  m.sph(0,1.16, 0.24,0.165,10,6,p.jersey,0);
  m.sph(0,1.09,-0.075,0.095,8,5,p.jersey2,0);               /* back pockets */
  /* left arm: shoulder to elbow to the drops, always on the bars */
  tube(-0.20,1.24,0.30, -0.225,1.06,0.38, 0.042,p.jersey);
  tube(-0.225,1.06,0.38, -0.185,0.965,0.475, 0.038,p.skin);
  /* right arm is limb 6: it can leave the bars and wave */
  tube( 0.20,1.24,0.30,  0.225,1.06,0.38, 0.052,p.jersey,6);
  tube( 0.225,1.06,0.38,  0.185,0.965,0.475, 0.048,p.skin,6);
  m.box( 0.185,0.92,0.475,0.13,0.11,0.13,p.jersey2,0,6); /* gloved waving hand */
  m.sph(-0.165,1.19,0.26,0.088,8,5,p.jersey,0);            /* shoulders */
  m.sph( 0.165,1.19,0.26,0.088,8,5,p.jersey,0,false,1,6);
  m.sph(-0.225,1.06,0.38,0.055,7,4,p.jersey,0);            /* elbows */
  m.sph( 0.225,1.06,0.38,0.058,7,4,p.jersey,0,false,1,6);
  m.box(-0.185,0.93,0.485,0.10,0.09,0.12,p.jersey2,0);     /* left hand on the bars */
  /* head down in the riding position, limb 5 so it can look across at you */
  m.sph(0,1.335,0.335,0.115,10,6,p.skin,0,false,1,5);
  m.sph(0,1.385,0.30,0.135,10,5,p.helmet,0,true,0.8,5);
  m.box(0,1.40,0.19,0.10,0.06,0.14,p.helmet,0,5);     /* helmet tail */
  m.box(0,1.30,0.44,0.14,0.045,0.03,p.dark,0,5);      /* sunglasses */
  m.cyl(0,1.15,0.29,0.058,0.14,7,p.skin,0,'y',5);     /* neck */
  m.box(0,1.335,0.435,0.15,0.022,0.10,p.helmet,0,5);  /* visor brim */
  for(const vz of [0.22,0.29,0.36])
    m.box(0,1.475,vz,0.095,0.028,0.045,p.dark,0,5);   /* helmet vents */
  if(p.pony){                                          /* ponytail, moving with the head */
    m.sph(0,1.36,0.16,0.075,7,5,p.hair,0,false,1,5);
    m.sph(0,1.27,0.06,0.06,6,4,p.hair,0,false,1,5);
    m.sph(0,1.17,-0.02,0.05,6,4,p.hair,0,false,1,5);
  }
}
function mPine(m,p,rnd){          /* conical evergreen, stacked skirts */
  const h=3.5+rnd()*4.5;
  m.cyl(0,0,0,0.16+h*0.02,h*0.30,6,p.stem,0);
  const tiers=3+Math.floor(rnd()*2);
  for(let t=0;t<tiers;t++){
    const f=t/tiers;
    const sh=0.68+f*0.45+rnd()*0.10;               /* dark skirts, lit tip */
    const vg=[p.leaf[0]*sh,p.leaf[1]*sh,p.leaf[2]*sh];
    m.cone(0,h*(0.22+f*0.62),0,(1.35-f*0.85)*(0.8+h*0.10),
           h*(0.34-f*0.05),7,vg,0.02);
  }
}
function mBroad(m,p,rnd){         /* broadleaf: trunk and a cloud of crowns */
  const h=2.6+rnd()*2.8;
  m.cyl(0,0,0,0.15+h*0.025,h*0.55,6,p.stem,0);
  const crowns=4+Math.floor(rnd()*3);
  for(let c=0;c<crowns;c++){
    const a=rnd()*6.28318, d=rnd()*h*0.22;
    const sh=0.72+rnd()*0.55;                       /* each cluster its own green */
    const vg=[p.leaf[0]*sh*(0.85+rnd()*0.45),p.leaf[1]*sh,p.leaf[2]*sh*(0.7+rnd()*0.5)];
    m.sph(Math.cos(a)*d,h*(0.62+rnd()*0.25),Math.sin(a)*d,
          h*(0.24+rnd()*0.14),8,5,vg,0.02);
  }
}

function mFish(m){
  const body=[0.55,0.62,0.68], fin=[0.78,0.52,0.36];
  m.sph(0,0,0.14,0.11,8,5,body,0.08);
  m.cyl(0,0,-0.02,0.095,0.34,8,body,0.08,'z');
  m.sph(0,0,-0.20,0.075,7,4,body,0.08);
  const A=m.P(0,0.13,-0.44),B=m.P(0,-0.11,-0.46),C=m.P(0,0,-0.24);
  m.tri(A,B,C,fin,0.1); m.tri(C,B,A,fin,0.1);      /* tail */
  const D=m.P(0,0.15,0.02),E=m.P(0,0.05,-0.10),F=m.P(0,0.05,0.12);
  m.tri(D,E,F,fin,0.1); m.tri(F,E,D,fin,0.1);      /* dorsal fin */
}

const RIDER_KITS=[
  {jersey:'#c9372c',jersey2:'#f0e8dc',helmet:'#e8e4da'},
  {jersey:'#2c72c9',jersey2:'#dce8f0',helmet:'#25313d'},
  {jersey:'#e8b53a',jersey2:'#2c2c30',helmet:'#c9372c'},
  {jersey:'#3aa06a',jersey2:'#e8e8e0',helmet:'#e8e4da'},
  {jersey:'#2e3f6e',jersey2:'#e07b2c',helmet:'#d8c93a',pony:true,hair:'#5a3a22'}
];
const RIDER_META={hip:0.90,sh:0.62,headY:1.32,headZ:0.32,turn:1.1,rest:0,eye:1.35,float:0,
                  wvX:0.20,wvY:1.22};

/* head pivot, gait speed, how far the head can turn, and the resting head tilt */
const CREATURE={
  strider:{headY:3.25,headZ:1.00,gait:1.7,turn:1.55,rest:0.22,eye:4.6,float:0,hip:2.60,sh:2.60},
  grazer :{headY:0.80,headZ:1.50,gait:3.0,turn:1.35,rest:0.62,eye:1.1,float:0,hip:0.94,sh:0.94},
  hopper :{headY:1.45,headZ:0.12,gait:4.2,turn:2.10,rest:0.10,eye:1.9,float:0,hip:0.88,sh:1.46},
  drifter:{headY:0,   headZ:0,   gait:0,  turn:0,   rest:0,   eye:2.6,float:2.4,hip:0,sh:0},
  gstag  :{headY:1.38,headZ:0.42,gait:3.4,turn:1.90,rest:-0.05,eye:1.85,float:0,hip:0,sh:0},
  gjelly :{headY:0,   headZ:0,   gait:0,  turn:0,   rest:0,   eye:0.6,float:2.0,hip:0,sh:0}
};

const wrapAng=x=>((x+Math.PI)%6.28318+6.28318)%6.28318-Math.PI;
const angLerp=(a,b,t)=>a+wrapAng(b-a)*t;

