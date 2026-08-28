"use strict";

/* --------------------------------------------------------------------------
   Baked surface textures. Generated once at start-up as tileable images with
   matching normal maps - grass, rock, asphalt. These are the SLOTS that
   AI-generated photo textures can replace later: anything that fills the same
   bind points works.
   -------------------------------------------------------------------------- */
const TEX={ok:false};
function bakeTextures(){
  const S=512;
  const pnoise=(P,seed)=>{
    const rnd=mulberry32(seed);
    const g=new Float32Array(P*P);
    for(let i=0;i<P*P;i++) g[i]=rnd();
    return (x,y)=>{
      const xi=Math.floor(x),yi=Math.floor(y);
      const fx=x-xi,fy=y-yi;
      const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
      const X=((xi%P)+P)%P,Y=((yi%P)+P)%P,X1=(X+1)%P,Y1=(Y+1)%P;
      const a=g[Y*P+X],b=g[Y*P+X1],c=g[Y1*P+X],dd=g[Y1*P+X1];
      return a+(b-a)*u+(c-a)*v+(a-b-c+dd)*u*v;
    };
  };
  const build=(hFn,albFn,nAmp)=>{
    const h=new Float32Array(S*S);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++) h[y*S+x]=hFn(x/S,y/S);
    const alb=new Uint8Array(S*S*4), nrm=new Uint8Array(S*S*4);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      const i=y*S+x;
      const hx=h[y*S+((x+1)%S)]-h[y*S+((x-1+S)%S)];
      const hy=h[((y+1)%S)*S+x]-h[((y-1+S)%S)*S+x];
      let nx=-hx*nAmp,nz=-hy*nAmp;
      const l=Math.hypot(nx,1,nz);
      nrm[i*4]=Math.round((nx/l*0.5+0.5)*255);
      nrm[i*4+1]=Math.round((1/l*0.5+0.5)*255);
      nrm[i*4+2]=Math.round((nz/l*0.5+0.5)*255);
      nrm[i*4+3]=255;
      const c=albFn(h[i],x/S,y/S);
      alb[i*4]=clamp(Math.round(c[0]*255),0,255);
      alb[i*4+1]=clamp(Math.round(c[1]*255),0,255);
      alb[i*4+2]=clamp(Math.round(c[2]*255),0,255);
      alb[i*4+3]=255;
    }
    return {alb,nrm};
  };
  const up=data=>{
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    const ax=gl.getExtension('EXT_texture_filter_anisotropic');
    if(ax) gl.texParameterf(gl.TEXTURE_2D,ax.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8,gl.getParameter(ax.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  };
  try{
    const n16=pnoise(16,101),n64=pnoise(64,202),n128=pnoise(128,303),n256=pnoise(256,404);
    /* grass: soft clumps with fine blade stipple */
    const grass=build(
      (x,y)=>n16(x*16,y*16)*0.45+n64(x*64,y*64)*0.30+n256(x*256,y*256)*0.25,
      (h,x,y)=>{
        const blade=n256(x*256+31,y*256+7);
        const v=0.34+0.42*h+0.14*blade;
        return [v*1.00,v*1.06,v*0.86];
      },3.0);
    /* rock: ridged strata */
    const rock=build(
      (x,y)=>{
        const r1=1-Math.abs(2*n16(x*16+5,y*16+9)-1);
        const r2=1-Math.abs(2*n64(x*64+3,y*64+1)-1);
        return r1*0.55+r2*0.30+n128(x*128,y*128)*0.15;
      },
      (h,x,y)=>{ const v=0.30+0.55*h; return [v,v*0.985,v*0.955]; },5.0);
    /* asphalt: dense speckle over faint blotches */
    const asph=build(
      (x,y)=>n256(x*256+11,y*256+17)*0.62+n16(x*16+2,y*16+4)*0.38,
      (h,x,y)=>{ const v=0.40+0.36*h; return [v,v,v*1.02]; },1.4);
    /* the vegetation atlas: left half a grass tuft, right half a bush,
       drawn in grayscale + alpha and tinted per world in the shader */
    const cnv=document.createElement('canvas');
    cnv.width=1536; cnv.height=256;
    const c2=cnv.getContext('2d');
    c2.clearRect(0,0,1024,256);
    const rr=mulberry32(777);
    for(let i=0;i<340;i++){                     /* grass: thick overlapping blades */
      const bx=128+(rr()*2-1)*112, tip=bx+(rr()*2-1)*60;
      const h2=110+rr()*135, lum=105+rr()*140;
      c2.strokeStyle='rgba('+(lum|0)+','+(lum|0)+','+((lum*0.88)|0)+',1)';
      c2.lineWidth=2.6+rr()*4.2;
      c2.beginPath();
      c2.moveTo(bx,254);
      c2.quadraticCurveTo(bx+(tip-bx)*0.3,254-h2*0.6,tip,254-h2);
      c2.stroke();
    }
    for(let i=0;i<420;i++){                     /* bush foliage blobs */
      const a=rr()*6.28318, d=Math.pow(rr(),0.55);
      const bx2=384+Math.cos(a)*d*100, by=140+Math.sin(a)*d*85;
      const r2=8+rr()*16, lum=85+rr()*145;
      c2.fillStyle='rgba('+(lum|0)+','+((lum*1.03)|0)+','+((lum*0.82)|0)+',1)';
      c2.beginPath(); c2.arc(bx2,by,r2,0,7); c2.fill();
    }
    c2.fillStyle='rgba(120,110,95,0.95)';       /* bush stem */
    c2.fillRect(380,200,9,54);
    /* oak, painted like his illustration: broad trunk, cloud of leaf clusters
       in several greens, darker at the rim and lit on top */
    c2.strokeStyle='rgba(96,74,52,1)'; c2.lineWidth=15;
    c2.beginPath(); c2.moveTo(640,254); c2.quadraticCurveTo(636,190,628,150); c2.stroke();
    c2.lineWidth=8;
    c2.beginPath(); c2.moveTo(638,190); c2.quadraticCurveTo(600,160,585,135); c2.stroke();
    c2.beginPath(); c2.moveTo(636,175); c2.quadraticCurveTo(672,150,692,130); c2.stroke();
    for(let i=0;i<300;i++){
      const a=rr()*6.28318, d=Math.pow(rr(),0.5);
      const bx3=640+Math.cos(a)*d*105, by3=98+Math.sin(a)*d*72;
      if(by3>200) continue;
      const r3=9+rr()*15;
      const edge=d>0.75;
      const lum=edge?(65+rr()*45):(105+rr()*115);
      c2.fillStyle='rgba('+((lum*0.82)|0)+','+(lum|0)+','+((lum*0.55)|0)+',1)';
      c2.beginPath(); c2.arc(bx3,by3,r3,0,7); c2.fill();
    }
    for(let i=0;i<60;i++){                       /* sun-lit crown highlights */
      const a=rr()*3.14159, d=rr()*0.7;
      const bx3=640+Math.cos(a+3.14159)*d*90, by3=70+Math.sin(a+3.14159)*d*40;
      const lum=180+rr()*60;
      c2.fillStyle='rgba('+((lum*0.85)|0)+','+(lum|0)+','+((lum*0.5)|0)+',1)';
      c2.beginPath(); c2.arc(bx3,by3,6+rr()*9,0,7); c2.fill();
    }
    /* pine: layered dark skirts over a straight trunk */
    c2.strokeStyle='rgba(92,66,44,1)'; c2.lineWidth=11;
    c2.beginPath(); c2.moveTo(896,254); c2.lineTo(896,60); c2.stroke();
    for(let t=0;t<6;t++){
      const yTop=58+t*30, half=26+t*13;
      const lum=60+t*10+rr()*20;
      c2.fillStyle='rgba('+((lum*0.75)|0)+','+(lum|0)+','+((lum*0.6)|0)+',1)';
      c2.beginPath();
      c2.moveTo(896,yTop);
      c2.lineTo(896-half,yTop+42); c2.lineTo(896+half,yTop+42);
      c2.closePath(); c2.fill();
    }
    /* dry wisp: sparse arcing straw stalks with seed heads - the desert
       grass. Mostly air, so it never tints into a solid slab. */
    for(let i=0;i<70;i++){
      const bx=1152+(rr()*2-1)*100, lean=(rr()*2-1)*70;
      const h2=90+rr()*130, lum=150+rr()*70;
      c2.strokeStyle='rgba('+(lum|0)+','+((lum*0.82)|0)+','+((lum*0.45)|0)+',1)';
      c2.lineWidth=1.6+rr()*1.8;
      c2.beginPath();
      c2.moveTo(bx,254);
      c2.quadraticCurveTo(bx+lean*0.3,254-h2*0.7,bx+lean,254-h2);
      c2.stroke();
      c2.fillStyle='rgba('+((lum*0.9)|0)+','+((lum*0.7)|0)+','+((lum*0.38)|0)+',1)';
      c2.beginPath(); c2.arc(bx+lean,254-h2,2.4+rr()*2.6,0,7); c2.fill();
    }
    /* desert shrub: an open twiggy dome, branches with air between them */
    c2.strokeStyle='rgba(122,86,52,1)';
    for(let i=0;i<46;i++){
      const a=(-0.15-rr()*0.7)*Math.PI*(rr()<.5?1:-1)*0.5+(-Math.PI/2);
      const len=60+rr()*95;
      const x0=1408+(rr()*2-1)*26, y0=252;
      const x1=x0+Math.cos(a)*len*(rr()<.5?1:-1)*0.9, y1=y0+Math.sin(a)*len;
      c2.lineWidth=1.4+rr()*2.2;
      c2.beginPath();
      c2.moveTo(x0,y0);
      c2.quadraticCurveTo((x0+x1)/2+(rr()*2-1)*22,(y0+y1)/2,x1,y1);
      c2.stroke();
      if(rr()<0.6){                              /* dry leaf tufts on the twigs */
        const lum=120+rr()*80;
        c2.fillStyle='rgba('+(lum|0)+','+((lum*0.78)|0)+','+((lum*0.42)|0)+',1)';
        c2.beginPath(); c2.arc(x1,y1,3+rr()*4.5,0,7); c2.fill();
      }
    }
    TEX.veg=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,TEX.veg);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cnv);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    TEX.gA=up(grass.alb); TEX.gN=up(grass.nrm);
    TEX.rA=up(rock.alb);  TEX.rN=up(rock.nrm);
    TEX.aA=up(asph.alb);  TEX.aN=up(asph.nrm);
    TEX.ok=true;
  }catch(e){ TEX.ok=false; }
}

/* --------------------------------------------------------------------------
   AI photo textures. If image files sit beside index.html (served over
   localhost), they replace the procedural textures: conditioned at load -
   baked-in lighting flattened out, edges cross-faded so they tile, normal
   maps derived from the photo itself. Missing files = procedural fallback.
     tex_grass.jpg  tex_rock.jpg  tex_asphalt.jpg   (square, from above)
     sky_<worldid>.jpg                              (wide panorama)
   -------------------------------------------------------------------------- */
const AITEX={skies:{}};
function conditionTile(img,S,flatten,nAmp,satKeep,conKeep){
  const cv2=document.createElement('canvas');
  cv2.width=S; cv2.height=S;
  const c2=cv2.getContext('2d');
  const side=Math.min(img.width,img.height);
  c2.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,S,S);
  const id=c2.getImageData(0,0,S,S), d=id.data;
  if(flatten>0){
    /* remove baked-in lighting: divide by a heavily blurred copy */
    const bs=40, bc=document.createElement('canvas');
    bc.width=bs; bc.height=bs;
    const b2=bc.getContext('2d');
    b2.drawImage(cv2,0,0,bs,bs);
    const bu=document.createElement('canvas');
    bu.width=S; bu.height=S;
    const u2=bu.getContext('2d');
    u2.imageSmoothingEnabled=true;
    u2.drawImage(bc,0,0,S,S);
    const bd=u2.getImageData(0,0,S,S).data;
    for(let i=0;i<d.length;i+=4){
      const bl=(bd[i]+bd[i+1]+bd[i+2])/3+8;
      const k=1+flatten*(128/bl-1);
      d[i]=clamp(d[i]*k,0,255); d[i+1]=clamp(d[i+1]*k,0,255); d[i+2]=clamp(d[i+2]*k,0,255);
    }
  }
  /* cross-fade a 10% border with the wrapped far edge, so it tiles */
  const M=Math.floor(S*0.10), src=new Uint8ClampedArray(d);
  const px=(x,y)=>((y+S)%S*S+(x+S)%S)*4;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const fx=x<M?1-x/M:(x>=S-M?(x-(S-M))/M+1/M*0:0);
    const fy=y<M?1-y/M:(y>=S-M?(y-(S-M))/M:0);
    const f=Math.max(fx,fy)*0.5;
    if(f<=0) continue;
    const o=px(x,y), w=px(x<M?x+S-2*M:(x>=S-M?x-(S-2*M):x),
                         y<M?y+S-2*M:(y>=S-M?y-(S-2*M):y));
    for(let c=0;c<3;c++) d[o+c]=Math.round(src[o+c]*(1-f)+src[w+c]*f);
  }
  /* mean brightness normalised toward 0.6 so the shader's *1.62 lands right,
     then the photo's own colour and contrast are reined in: detail stays,
     but the WORLD's palette decides the colour and the harshness */
  let mean=0;
  for(let i=0;i<d.length;i+=16) mean+=(d[i]+d[i+1]+d[i+2])/3;
  mean/=d.length/16;
  const gain=clamp(153/Math.max(mean,20),0.5,2.2);
  const sk=satKeep===undefined?1:satKeep, ck=conKeep===undefined?1:conKeep;
  for(let i=0;i<d.length;i+=4){
    let r=d[i]*gain, g=d[i+1]*gain, b=d[i+2]*gain;
    const lum=(r+g+b)/3;
    r=lum+(r-lum)*sk; g=lum+(g-lum)*sk; b=lum+(b-lum)*sk;
    d[i]=clamp(153+(r-153)*ck,0,255);
    d[i+1]=clamp(153+(g-153)*ck,0,255);
    d[i+2]=clamp(153+(b-153)*ck,0,255);
  }
  /* normal map from luminance */
  const nrm=new Uint8Array(S*S*4);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const l=(xx,yy)=>{const o=px(xx,yy);return (d[o]+d[o+1]+d[o+2])/765;};
    const hx2=l(x+1,y)-l(x-1,y), hy2=l(x,y+1)-l(x,y-1);
    let nx=-hx2*nAmp, nz=-hy2*nAmp;
    const L=Math.hypot(nx,1,nz);
    const o=(y*S+x)*4;
    nrm[o]=Math.round((nx/L*0.5+0.5)*255);
    nrm[o+1]=Math.round((1/L*0.5+0.5)*255);
    nrm[o+2]=Math.round((nz/L*0.5+0.5)*255);
    nrm[o+3]=255;
  }
  c2.putImageData(id,0,0);
  return {albCanvas:cv2, nrm, S};
}
function glTexFromCanvas(cnv){
  const t=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cnv);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  const ax=gl.getExtension('EXT_texture_filter_anisotropic');
  if(ax) gl.texParameterf(gl.TEXTURE_2D,ax.TEXTURE_MAX_ANISOTROPY_EXT,
    Math.min(8,gl.getParameter(ax.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}
function glTexFromData(data,S){
  const t=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
function loadImage(name){
  return new Promise(res=>{
    const im=new Image();
    im.onload=()=>res(im);
    im.onerror=()=>res(null);
    im.src=name;
  });
}
async function loadAITextures(){
  try{
    const [g,r,a]=await Promise.all([
      loadImage('assets/images/tex_grass.jpg'),loadImage('assets/images/tex_rock.jpg'),loadImage('assets/images/tex_asphalt.jpg')]);
    const S=1024;
    TEX.src={grass:'procedural',rock:'procedural',asphalt:'procedural'};
    if(g){ const c=conditionTile(g,S,0.35,2.2,0.18,0.75);
      TEX.gA=glTexFromCanvas(c.albCanvas); TEX.gN=glTexFromData(c.nrm,S);
      TEX.src.grass='AI photo'; }
    if(r){ const c=conditionTile(r,S,0.55,4.0,0.40,0.80);
      TEX.rA=glTexFromCanvas(c.albCanvas); TEX.rN=glTexFromData(c.nrm,S);
      TEX.src.rock='AI photo'; }
    if(a){ const c=conditionTile(a,S,1.0,0.9,0.15,0.40);
      TEX.aA=glTexFromCanvas(c.albCanvas); TEX.aN=glTexFromData(c.nrm,S);
      TEX.src.asphalt='AI photo'; }
    if(g||r||a) TEX.ok=true;
    /* sky panoramas, per world */
    for(const sc of SCENES){
      if(!sc.skyImg) continue;
      const im=await loadImage(sc.skyImg);
      if(!im) continue;
      const W2=2048,H2=1024;
      const cv3=document.createElement('canvas');
      cv3.width=W2; cv3.height=H2;
      const c3=cv3.getContext('2d');
      c3.drawImage(im,0,0,W2,H2);
      /* blend the horizontal seam so the wrap is invisible */
      const id=c3.getImageData(0,0,W2,H2), dd=id.data;
      const MM=Math.floor(W2*0.05), src=new Uint8ClampedArray(dd);
      for(let y=0;y<H2;y++)for(let x=0;x<MM;x++){
        const f=0.5*(1-x/MM);
        const o=(y*W2+x)*4, w=(y*W2+(W2-1-x))*4;
        for(let c=0;c<3;c++){
          dd[o+c]=Math.round(src[o+c]*(1-f)+src[w+c]*f);
          dd[w+c]=Math.round(src[w+c]*(1-f)+src[o+c]*f);
        }
      }
      c3.putImageData(id,0,0);
      const t=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,cv3);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      AITEX.skies[sc.id]=t;
    }
  }catch(e){ /* any failure leaves the procedural look in place */ }
  const el=document.getElementById('texStatus');
  if(el){
    const q=k=>TEX.src&&TEX.src[k]==='AI photo'?'photo':'procedural';
    const sk=Object.keys(AITEX.skies);
    let st='Loaded: grass '+q('grass')+' | rock '+q('rock')+' | asphalt '+q('asphalt')
          +' | sky: '+(sk.length?sk.join(', '):'NONE');
    if(location.protocol==='file:')
      st='OPENED AS file:// - photo textures need http://localhost:8123. '+st;
    el.textContent=st;
  }
}

let progMain,progSky,progShadow,progBloom,progPost,progBill,skyQuad,
    U={},US={},UB={},UP={},UBL={},CU=null,A={};
const POST={on:false,w:0,h:0,msFB:null,rbC:null,rbD:null,
            resFB:null,resTex:null,blFB:null,blTex:null};
function buildPostFBOs(){
  if(!isGL2) return;
  for(const k of ['msFB','resFB','blFB']) if(POST[k]) gl.deleteFramebuffer(POST[k]);
  for(const k of ['rbC','rbD']) if(POST[k]) gl.deleteRenderbuffer(POST[k]);
  for(const k of ['resTex','blTex']) if(POST[k]) gl.deleteTexture(POST[k]);
  const smp=Math.min(4,gl.getParameter(gl.MAX_SAMPLES));
  POST.rbC=gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER,POST.rbC);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER,smp,gl.RGBA8,W,H);
  POST.rbD=gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER,POST.rbD);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER,smp,gl.DEPTH_COMPONENT24,W,H);
  POST.msFB=gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,POST.msFB);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,POST.rbC);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,POST.rbD);
  const okMs=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  const mkTexFB=(w,h)=>{
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const f=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
    const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    return ok?{f,t}:null;
  };
  const res=mkTexFB(W,H);
  const bl=mkTexFB(Math.max(1,W>>2),Math.max(1,H>>2));
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(okMs&&res&&bl){
    POST.resFB=res.f; POST.resTex=res.t;
    POST.blFB=bl.f; POST.blTex=bl.t;
    POST.w=W; POST.h=H; POST.on=true;
  }else POST.on=false;
}
let shTex=null,shFB=null,shadowsOK=false;
const SH=2048;
const mLight=new Float32Array(16),mLV=new Float32Array(16),mLP=new Float32Array(16);
function ortho(out,l,r,b,t,n,f){
  out.fill(0);
  out[0]=2/(r-l); out[5]=2/(t-b); out[10]=-2/(f-n);
  out[12]=-(r+l)/(r-l); out[13]=-(t+b)/(t-b); out[14]=-(f+n)/(f-n); out[15]=1;
  return out;
}
function initGL(){
  progMain=makeProgram(VS_MAIN,FS_MAIN);
  progSky =makeProgram(VS_SKY,FS_SKY);
  progShadow=makeProgram(VS_MAIN,FS_DEPTH);
  progBloom=makeProgram(VS_POST,FS_BLOOM);
  progPost =makeProgram(VS_POST,FS_POST);
  progBill =makeProgram(VS_BILL,FS_BILL);
  progScr  =makeProgram(VS_SCR,FS_SCR);
  ['uMVPS','uPosS','uRightS','uSizeS','uTexS','uCamS','uFogColS','uAmbS',
   'uSunColS','uFogDenS','uEmS'].forEach(n=>USC[n]=gl.getUniformLocation(progScr,n));
  scrQuad=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,scrQuad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  A.pos=0; A.nrm=1; A.col=2; A.limb=3; A.skyP=0;
  ['uMVP','uModel','uLimb','uHead','uWave','uSun','uSunCol','uAmb','uFogCol','uCam',
   'uFogDen','uGrid','uTime','uEmiss','uMat','uSnow','uShadowMat','uShadowMap',
   'uShadowOn','uAlpha','uTexOn','uTexGA','uTexGN','uTexRA','uTexRN','uTexAA','uTexAN',
   'uSpin','uLegL','uLegR','uPivF','uPivR','uPivC']
    .forEach(n=>U[n]=gl.getUniformLocation(progMain,n));
  bakeTextures();
  loadAITextures();
  loadScreenTextures();
  loadGLTFRider();
  loadGLTFStatic('oak','assets/models/tree_oak.gltf',0.62);
  loadGLTFStatic('pine','assets/models/tree_pine.gltf',0.60);
  loadGLTFCreature('stag','assets/models/creature_stag.gltf',{pose:stagPose,head:['Neck','Head'],N:16});
  loadGLTFCreature('jelly','assets/models/creature_jelly.gltf',{});
  loadGLTFCreature('bird','assets/models/bird_kestrel.gltf',{pose:birdPose,N:16});
  loadGLTFCreature('bird2','assets/models/bird_gull.gltf',{pose:birdPose,N:16});
  loadGLTFCreature('bird3','assets/models/bird_finch.gltf',{pose:birdPose,N:16});
  loadGLTFCreature('bird4','assets/models/bird_ray.gltf',{pose:birdPose,N:16});
  loadGLTFCreature('cat','assets/models/creature_cat.gltf',{pose:stagPose,head:['Neck','Head'],N:16});
  loadGLTFCreature('dfly','assets/models/creature_dragonfly.gltf',{pose:birdPose,N:12});
  loadGLTFStatic('crysA','assets/models/prop_crystal_a.gltf',1);
  loadGLTFStatic('crysB','assets/models/prop_crystal_b.gltf',1);
  loadGLTFStatic('rockA','assets/models/prop_rock_a.gltf',1);
  loadGLTFStatic('rockB','assets/models/prop_rock_b.gltf',1);
  loadGLTFStatic('frozen','assets/models/tree_frozen.gltf',1);
  loadGLTFStatic('ice','assets/models/prop_ice.gltf',1);
  loadGLTFStatic('arch','assets/models/prop_arch.gltf',1);
  loadGLTFStatic('stGate','assets/models/station_gate.gltf',1);
  loadGLTFStatic('stSide','assets/models/station_side.gltf',1);
  loadGLTFStatic('cTower','assets/models/city_tower.gltf',1);
  loadGLTFStatic('cDome','assets/models/city_dome.gltf',1);
  loadGLTFStatic('cArc','assets/models/city_arcology.gltf',1);
  loadGLTFStatic('cSpire','assets/models/city_spire_pair.gltf',1);
  loadGLTFStatic('cClu','assets/models/city_cluster.gltf',1);
  loadGLTFStatic('cGate','assets/models/city_gate.gltf',1);
  loadGLTFStatic('sRing','assets/models/station_ring.gltf',1);
  loadGLTFStatic('sRef','assets/models/station_refinery.gltf',1);
  loadGLTFStatic('sHang','assets/models/station_hangar.gltf',1);
  loadGLTFStatic('sAnt','assets/models/station_antenna.gltf',1);
  loadGLTFBike('mtb','assets/models/bike_mtb.gltf',{scale:0.94,dz:0.05});
  loadGLTFBike('race','assets/models/bike_race.gltf',{});
  ['uMVP','uModel','uLimb','uHead','uWave','uSpin','uLegL','uLegR','uShadowMat','uPivF','uPivR','uPivC']
    .forEach(n=>US[n]=gl.getUniformLocation(progShadow,n));
  ['uScene','uPx'].forEach(n=>UB[n]=gl.getUniformLocation(progBloom,n));
  ['uScene','uBloomT','uPx','uExposure','uBloomAmt']
    .forEach(n=>UP[n]=gl.getUniformLocation(progPost,n));
  ['uMVPB','uCamB','uTimeB','uAtlas','uTintA','uTintB','uSunColB','uAmbB',
   'uFogColB','uFogDenB']
    .forEach(n=>UBL[n]=gl.getUniformLocation(progBill,n));
  /* classic-bike spin pivots as the resting default, in both programs */
  for(const [pg,uu] of [[progMain,U],[progShadow,US]]){
    gl.useProgram(pg);
    gl.uniform2f(uu.uPivF,0.50,0.34);
    gl.uniform2f(uu.uPivR,-0.42,0.34);
    gl.uniform2f(uu.uPivC,-0.02,0.28);
  }
  gl.useProgram(progMain);
  CU=U;
  /* the shadow map: a depth texture rendered from the sun */
  try{
    if(isGL2){
      shTex=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,shTex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,SH,SH,0,
                    gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      shFB=gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER,shFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shTex,0);
      gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      shadowsOK=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
  }catch(e){ shadowsOK=false; }
  ['uFwd','uRight','uUp','uTanHalf','uAspect','uTop','uHorizon','uFog','uStars',
   'uStarBright','uEarthDir','uEarthR','uEarthU','uEarthLight','uEarthSize',
   'uCloud','uTimeS','uCloudCol','uSunDirS','uSunColS','uSkyOn','uSkyTex']
    .forEach(n=>U[n]=gl.getUniformLocation(progSky,n));
  A.skyP=gl.getAttribLocation(progSky,'aP');
  skyQuad=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,skyQuad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  /* no back-face culling: the rocks are built from random lumps and a few of
     their faces end up wound the wrong way. Drawing both sides costs little
     here and avoids holes. */
}

function uploadMesh(m){
  const mk=(data,type)=>{
    const b=gl.createBuffer();
    gl.bindBuffer(type,b); gl.bufferData(type,data,gl.STATIC_DRAW);
    return b;
  };
  return {
    pos:mk(m.pos,gl.ARRAY_BUFFER), nrm:mk(m.nrm,gl.ARRAY_BUFFER),
    col:mk(m.col,gl.ARRAY_BUFFER), idx:mk(m.idx,gl.ELEMENT_ARRAY_BUFFER),
    limb:(m.limb&&m.limb.length)?mk(m.limb,gl.ARRAY_BUFFER):null,
    count:m.idx.length
  };
}
function drawMesh(b){
  if(!b||!b.count) return;
  gl.bindBuffer(gl.ARRAY_BUFFER,b.pos); gl.enableVertexAttribArray(A.pos);
  gl.vertexAttribPointer(A.pos,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,b.nrm); gl.enableVertexAttribArray(A.nrm);
  gl.vertexAttribPointer(A.nrm,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,b.col); gl.enableVertexAttribArray(A.col);
  gl.vertexAttribPointer(A.col,4,gl.FLOAT,false,0,0);
  if(b.limb){
    gl.bindBuffer(gl.ARRAY_BUFFER,b.limb); gl.enableVertexAttribArray(A.limb);
    gl.vertexAttribPointer(A.limb,1,gl.FLOAT,false,0,0);
  }else{
    gl.disableVertexAttribArray(A.limb); gl.vertexAttrib1f(A.limb,0);
  }
  void CU;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.idx);
  gl.drawElements(gl.TRIANGLES,b.count,gl.UNSIGNED_INT,0);
}

const IDENT=new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const NOLIMB=new Float32Array([0,0.85,0,1.45]);
const NOHEAD=new Float32Array([0,0,0,0]);
/* translate + yaw + pitch + uniform scale, column-major */
function modelMat(out,x,y,z,yaw,k,pitch){
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const cp=Math.cos(pitch||0),sp=Math.sin(pitch||0);
  out[0]=c*k;      out[1]=0;      out[2]=-s*k;     out[3]=0;
  out[4]=sp*s*k;   out[5]=cp*k;   out[6]=sp*c*k;   out[7]=0;
  out[8]=cp*s*k;   out[9]=-sp*k;  out[10]=cp*c*k;  out[11]=0;
  out[12]=x;       out[13]=y;     out[14]=z;       out[15]=1;
  return out;
}

let gpu={terrain:null,road:null,props:null,actors:null,veg:null,water:null};
function uploadWorld(w){
  const free=b=>{
    if(!b) return;
    gl.deleteBuffer(b.pos);gl.deleteBuffer(b.nrm);
    gl.deleteBuffer(b.col);gl.deleteBuffer(b.idx);
    if(b.limb) gl.deleteBuffer(b.limb);
  };
  free(gpu.terrain); free(gpu.road); free(gpu.props); free(gpu.water); free(gpu.glass);
  if(gpu.actors) for(const k in gpu.actors) free(gpu.actors[k]);
  gpu.terrain=uploadMesh(w.terrain);
  gpu.road   =uploadMesh(w.road);
  gpu.props  =uploadMesh(w.props);
  gpu.water=w.water?uploadMesh(w.water):null;
  gpu.glass=w.glass?uploadMesh(w.glass):null;
  if(gpu.veg){
    gl.deleteBuffer(gpu.veg.ctr);gl.deleteBuffer(gpu.veg.dat);
    gl.deleteBuffer(gpu.veg.uv);gl.deleteBuffer(gpu.veg.idx);
  }
  gpu.veg=null;
  if(w.veg){
    const mk=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t,b);
      gl.bufferData(t,d,gl.STATIC_DRAW);return b;};
    gpu.veg={ctr:mk(w.veg.ctr,gl.ARRAY_BUFFER),dat:mk(w.veg.dat,gl.ARRAY_BUFFER),
             uv:mk(w.veg.uv,gl.ARRAY_BUFFER),
             idx:mk(w.veg.idx,gl.ELEMENT_ARRAY_BUFFER),
             count:w.veg.count,tintA:w.veg.tintA,tintB:w.veg.tintB};
  }
  gpu.actors={};
  for(const k in w.actorMeshes) gpu.actors[k]=uploadMesh(w.actorMeshes[k]);
}

