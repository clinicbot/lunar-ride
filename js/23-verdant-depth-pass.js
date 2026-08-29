"use strict";

/* Verdant foreground/depth pass ------------------------------------------
   Lightweight version: extra scenery is built separately and then merged
   with the existing typed meshes.  This avoids Array.from() copies of the
   already-large world mesh and keeps browser world-build time predictable. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.props||!w.verdant) return w;

    const rnd=mulberry32(sc.seed+108731),N=w.nMain;
    const idxAt=km=>Math.max(0,Math.min(N-1,Math.floor(km*1000/ROUTE_STEP)));
    const posAt=(km,off)=>{
      const i=idxAt(km),side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      return {i,x,z,y:w.meshH(x,z)};
    };
    const merge=(base,extra)=>{
      if(!extra.idx.length)return base;
      const nv=(base.pos.length/3)|0;
      const pos=new Float32Array(base.pos.length+extra.pos.length);pos.set(base.pos);pos.set(extra.pos,base.pos.length);
      const nrm=new Float32Array(base.nrm.length+extra.nrm.length);nrm.set(base.nrm);nrm.set(extra.nrm,base.nrm.length);
      const col=new Float32Array(base.col.length+extra.col.length);col.set(base.col);col.set(extra.col,base.col.length);
      const idx=new Uint32Array(base.idx.length+extra.idx.length);idx.set(base.idx);
      for(let i=0;i<extra.idx.length;i++)idx[base.idx.length+i]=extra.idx[i]+nv;
      return {pos,nrm,col,idx};
    };

    const mb=new MeshB();
    const trunk=hx('#51422d'),leaf1=hx('#2f6e3c'),leaf2=hx('#568b4c');
    const bush=hx('#487d42'),rock=hx('#63675e'),rock2=hx('#7a7c70');
    /* Intentionally low-poly: enough silhouette/detail near the rider without
       baking thousands of vertices into every tree. */
    const tree=q=>{q.cyl(0,.02,0,.18,3.8,5,trunk);q.sph(0,3.75,0,1.05,6,3,leaf1);q.sph(.62,3.45,.12,.70,5,3,leaf2);q.sph(-.58,3.42,-.10,.66,5,3,leaf2);};
    const young=q=>{q.cyl(0,.02,0,.10,2.35,5,trunk);q.sph(0,2.30,0,.65,5,3,leaf1);};
    const shrub=q=>{q.sph(0,.42,0,.48,5,3,bush);q.sph(.28,.34,.10,.30,5,2,leaf2);};
    const boulder=q=>{q.sph(0,.42,0,.64,6,3,rnd()<.5?rock:rock2);};
    const stamp=(km,off,scale,fn)=>{const p=posAt(km,off);mb.setTF(p.x,p.y-.07,p.z,rnd()*6.28318,scale||1);fn(mb);mb.setTF(0,0,0,0,1);};

    /* Meadow: irregular groves, but moderate count. Existing v107 scenery
       stays in place; this pass supplies the missing foreground/midground. */
    for(let km=.14;km<3;km+=.16+rnd()*.07){
      const side=rnd()<.5?-1:1,base=8+rnd()*24,n=2+Math.floor(rnd()*3);
      for(let j=0;j<n;j++)stamp(km+(rnd()-.5)*.055,side*(base+j*(4+rnd()*5)+rnd()*4),.62+rnd()*.68,rnd()<.28?young:tree);
      if(rnd()<.75)stamp(km,-side*(5+rnd()*18),.50+rnd()*.45,shrub);
      if(rnd()<.28)stamp(km,side*(8+rnd()*28),.55+rnd()*.55,boulder);
    }
    /* Forest approach: closer and denser than meadow, still lightweight. */
    for(let km=3.0;km<6;km+=.13+rnd()*.06){
      const side=rnd()<.5?-1:1,base=6+rnd()*15,n=3+Math.floor(rnd()*3);
      for(let j=0;j<n;j++)stamp(km+(rnd()-.5)*.045,side*(base+j*(3+rnd()*4)+rnd()*3),.58+rnd()*.65,rnd()<.18?young:tree);
      if(rnd()<.82)stamp(km,-side*(5+rnd()*15),.46+rnd()*.46,shrub);
      if(rnd()<.25)stamp(km,side*(9+rnd()*22),.52+rnd()*.60,boulder);
    }
    /* Wetland transition: low vegetation only, preserving sight lines. */
    for(let km=5.8;km<9;km+=.16+rnd()*.10){
      const side=rnd()<.5?-1:1;
      stamp(km,side*(5+rnd()*14),.42+rnd()*.50,shrub);
      if(rnd()<.30)stamp(km,-side*(8+rnd()*18),.45+rnd()*.55,boulder);
    }
    w.props=merge(w.props,mb);

    /* Two small valley ponds. Build only the two discs here and merge them
       efficiently with the existing water mesh. */
    const wm=new MeshB(),waterC=hx('#3e9ca2');
    const addPond=(km,off,r)=>{
      const p=posAt(km,off),y=p.y-.50;
      wm.setTF(p.x,y,p.z,0,1);wm.disc(0,0,0,r,20,waterC,.18);wm.setTF(0,0,0,0,1);
      w.lakeSpots=w.lakeSpots||[];w.lakeSpots.push([p.x,p.z]);
      if(w.waterY==null||y<w.waterY)w.waterY=y;
    };
    addPond(1.18,32,10.5);addPond(2.32,-38,13.5);
    const empty={pos:new Float32Array(0),nrm:new Float32Array(0),col:new Float32Array(0),idx:new Uint32Array(0)};
    w.water=merge(w.water||empty,wm);

    const bearMeta={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};
    for(const [km,off] of [[1.55,-18],[2.72,24]]){
      const p=posAt(km,off),ph=rnd()*6.28318;
      w.actors.push({type:'bear',gcre:'vbear',meta:bearMeta,px:p.x,py:p.y,pz:p.z,hx:p.x,hz:p.z,wr:2.2,wander:ph,wspd:.045,alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,ph,yaw:rnd()*6.28,k:1.1+rnd()*.15,emiss:1});
    }
    w.__verdantDepth={ponds:2,earlyBears:2,extraPropTriangles:mb.idx.length/3,propTriangles:w.props.idx.length/3};
    return w;
  };
})();
