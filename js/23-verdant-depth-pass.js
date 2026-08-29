"use strict";

/* Verdant foreground/depth pass ------------------------------------------
   Adds the missing middle-distance detail visible in the v107 screenshots.
   Route, elevation and trainer physics remain untouched. */
(function(){
  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!=='verdant'||!w.props||!w.verdant) return w;

    const rnd=mulberry32(sc.seed+108731), N=w.nMain;
    const idxAt=km=>Math.max(0,Math.min(N-1,Math.floor(km*1000/ROUTE_STEP)));
    const posAt=(km,off)=>{
      const i=idxAt(km),side=off<0?-1:1,o=Math.abs(off);
      const x=w.rx[i]-w.tz[i]*o*side,z=w.rz[i]+w.tx[i]*o*side;
      return {i,x,z,y:w.meshH(x,z)};
    };

    const mb=new MeshB();
    mb.pos=Array.from(w.props.pos||[]); mb.nrm=Array.from(w.props.nrm||[]);
    mb.col=Array.from(w.props.col||[]); mb.idx=Array.from(w.props.idx||[]); mb.limb=[];

    const trunk=hx('#51422d'), bark2=hx('#6b5436'), leaf1=hx('#2f6e3c'), leaf2=hx('#4d8547');
    const bush=hx('#487d42'), bush2=hx('#6d934e'), rock=hx('#63675e'), rock2=hx('#7a7c70');

    const lushTree=q=>{
      q.cyl(0,.02,0,.22,4.6,9,trunk);
      q.cyl(-.25,2.45,0,.09,1.7,7,bark2,0,'x');
      q.cyl(.18,2.95,.10,.08,1.45,7,bark2,0,'z');
      q.sph(0,4.15,0,1.25,11,7,leaf1);
      q.sph(.82,3.85,.16,.92,10,6,leaf2);
      q.sph(-.78,3.78,-.15,.95,10,6,leaf2);
      q.sph(.18,4.70,-.45,.88,10,6,leaf1);
      q.sph(-.22,4.55,.62,.82,10,6,leaf2);
    };
    const youngTree=q=>{
      q.cyl(0,.02,0,.12,2.6,7,trunk);
      q.sph(0,2.55,0,.72,9,5,leaf1);
      q.sph(.45,2.35,.05,.48,8,5,leaf2);
      q.sph(-.40,2.28,-.08,.46,8,5,leaf2);
    };
    const shrub=q=>{
      q.sph(0,.48,0,.48,8,5,bush);
      q.sph(.35,.38,.12,.34,8,4,bush2);
      q.sph(-.32,.36,-.12,.33,8,4,bush2);
    };
    const boulder=q=>{
      q.sph(0,.46,0,.72,9,5,rnd()<.5?rock:rock2);
      if(rnd()<.55)q.sph(.48,.24,.18,.34,8,4,rock);
    };
    const stamp=(km,off,scale,fn)=>{
      const p=posAt(km,off); mb.setTF(p.x,p.y-.08,p.z,rnd()*Math.PI*2,scale||1); fn(mb); mb.setTF(0,0,0,0,1);
    };

    /* Meadow 0-3 km: build actual groves with foreground, middle and distant
       layers.  This is intentionally irregular so the rider sees depth rather
       than evenly spaced roadside props. */
    for(let km=.10;km<3;km+=.095+rnd()*.055){
      const side=rnd()<.5?-1:1;
      const base=8+rnd()*22, trees=3+Math.floor(rnd()*5);
      for(let j=0;j<trees;j++){
        const off=side*(base+j*(2.5+rnd()*4)+rnd()*5);
        stamp(km+(rnd()-.5)*.045,off,.55+rnd()*.78,rnd()<.28?youngTree:lushTree);
      }
      if(rnd()<.86)stamp(km+(rnd()-.5)*.035,-side*(5+rnd()*18),.45+rnd()*.55,shrub);
      if(rnd()<.58)stamp(km+(rnd()-.5)*.03,side*(5+rnd()*24),.38+rnd()*.62,shrub);
      if(rnd()<.34)stamp(km,side*(7+rnd()*32),.45+rnd()*.75,boulder);
    }

    /* Forest 3-6 km: much denser edge, with some trees close enough to give a
       sense of speed but never intruding into the road ribbon. */
    for(let km=3.0;km<6;km+=.070+rnd()*.045){
      const side=rnd()<.5?-1:1, base=5.7+rnd()*14;
      const trees=4+Math.floor(rnd()*5);
      for(let j=0;j<trees;j++){
        const off=side*(base+j*(2.2+rnd()*3.4)+rnd()*3.5);
        if(rnd()<.52&&typeof mPine==='function') stamp(km+(rnd()-.5)*.035,off,.55+rnd()*.68,q=>mPine(q,{stem:trunk,leaf:leaf1,glow:leaf2,skin:bark2,dark:hx('#26342a'),accent:leaf2,eye:hx('#fff2aa')},rnd));
        else stamp(km+(rnd()-.5)*.035,off,.52+rnd()*.72,rnd()<.22?youngTree:lushTree);
      }
      if(rnd()<.9)stamp(km,-side*(4.8+rnd()*15),.42+rnd()*.52,shrub);
      if(rnd()<.35)stamp(km,side*(8+rnd()*24),.45+rnd()*.8,boulder);
    }

    /* Damp low vegetation around the wetland approach. */
    for(let km=5.65;km<9;km+=.085+rnd()*.07){
      const side=rnd()<.5?-1:1;
      if(typeof mFan==='function')stamp(km,side*(4+rnd()*15),.45+rnd()*.70,q=>mFan(q,{stem:trunk,leaf:leaf2,glow:hx('#8fd6a4'),skin:bark2,dark:hx('#29402d'),accent:leaf1,eye:hx('#fff3a0')},rnd));
      if(rnd()<.75)stamp(km,-side*(5+rnd()*18),.35+rnd()*.48,shrub);
    }

    w.props={pos:new Float32Array(mb.pos),nrm:new Float32Array(mb.nrm),col:new Float32Array(mb.col),idx:new Uint32Array(mb.idx)};

    /* Two small valley ponds visible early in the ride. */
    const wm=new MeshB();
    if(w.water){wm.pos=Array.from(w.water.pos||[]);wm.nrm=Array.from(w.water.nrm||[]);wm.col=Array.from(w.water.col||[]);wm.idx=Array.from(w.water.idx||[]);wm.limb=[];}
    const waterC=hx('#3e9ca2');
    const addPond=(km,off,r)=>{
      const p=posAt(km,off); const y=p.y-.55;
      wm.setTF(p.x,y,p.z,0,1); wm.disc(0,0,0,r,28,waterC,.18); wm.setTF(0,0,0,0,1);
      w.lakeSpots=w.lakeSpots||[];w.lakeSpots.push([p.x,p.z]);
      if(w.waterY==null||y<w.waterY)w.waterY=y;
      for(let a=0;a<10;a++) stamp(km,off+(a-5)*1.9,.38+rnd()*.42,boulder);
    };
    addPond(1.18,32,10.5); addPond(2.32,-38,13.5);
    if(wm.idx.length)w.water={pos:new Float32Array(wm.pos),nrm:new Float32Array(wm.nrm),col:new Float32Array(wm.col),idx:new Uint32Array(wm.idx)};

    /* A few visible early animals; they use the existing Verdant bear mesh
       and updater contract, so they are alive rather than decorative statues. */
    const bearMeta={float:0,gait:2.8,turn:.75,rest:0,eye:1.28,hip:.72,sh:1.12,headY:1.25,headZ:.48};
    for(const [km,off] of [[1.55,-18],[2.72,24]]){
      const p=posAt(km,off),ph=rnd()*6.28318;
      w.actors.push({type:'bear',gcre:'vbear',meta:bearMeta,px:p.x,py:p.y,pz:p.z,hx:p.x,hz:p.z,wr:2.2,wander:ph,wspd:.045,alert:0,headYaw:0,headPitch:0,swing:0,gph:ph,ph,yaw:rnd()*6.28,k:1.1+rnd()*.15,emiss:1});
    }

    w.__verdantDepth={ponds:2,earlyBears:2,propTriangles:w.props.idx.length/3};
    return w;
  };
})();
