"use strict";

/* Aqua Rift v153 — high-quality coral geometry --------------------------------
   v152 fixed visibility and jellyfish correctness, but its coral silhouettes were
   built mostly from spheres/cylinders. v153 keeps the same 2,800-placement reef
   budget and replaces the coral layer with recognizable lightweight reef models:

   - branching / staghorn colonies made from tapered 3-D branch tubes;
   - sea fans with visible radial lattice;
   - brain corals with ridged dome geometry;
   - layered wavy plate corals;
   - hollow tube sponges;
   - soft corals with curved tapered fingers.

   A hybrid LOD keeps performance controlled: 140 detailed hero groups sit in the
   closest band outside the glass; medium-detail models fill near/mid reef; far
   reef uses simplified silhouettes. Fish, v152 shared jellyfish, road, glass,
   tunnel logic and Verdant are not modified.
*/
(function(){
  const AQUA_ID='aqua',VERSION=153,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const HERO_EVERY=5,HERO_GROUPS=(REEF_STATIONS/HERO_EVERY)*2;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_BANDS=[[10.4,15.3],[13.0,24.0],[20.0,39.0],[35.0,78.0]];
  const COLOUR_BAG=[
    '#a95cff','#a95cff','#a95cff','#a95cff','#a95cff',
    '#ff639d','#ff639d','#ff639d','#ff639d',
    '#ff934d','#ff934d','#ff934d','#ff934d',
    '#4bd8d2','#4bd8d2','#4bd8d2',
    '#4f86ff','#4f86ff','#f3e4be','#f3e4be'
  ];

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID)return w;
    return rebuildAquaV153(w,sc);
  };

  function meshOf(m){return {pos:new Float32Array(m.pos),nrm:new Float32Array(m.nrm),
    col:new Float32Array(m.col),limb:new Float32Array(m.limb||[]),idx:new Uint32Array(m.idx)};}

  function helpers(w){
    const n=w.nMain||0,routeKm=(w.lapLen||n*ROUTE_STEP)/1000,
      galleries=[routeKm*.14,routeKm*.37,routeKm*.61,routeKm*.83];
    const kmDist=(a,b)=>{let d=Math.abs(a-b);return Math.min(d,routeKm-d);};
    const radiusAt=i=>{i=((i%n)+n)%n;const km=i*ROUTE_STEP/1000;let r=BASE_GLASS_R;
      for(const c of galleries){const d=kmDist(km,c),q=Math.max(0,1-d/(routeKm*.045));r+=6.4*q*q*(3-2*q);}return r;};
    const pose=(i,off)=>{i=((i%n)+n)%n;const side=off<0?-1:1,o=Math.abs(off);
      return {x:w.rx[i]-w.tz[i]*o*side,z:w.rz[i]+w.tx[i]*o*side,y:w.ry[i],i};};
    const ringPoint=(i,a,r)=>{i=((i%n)+n)%n;const nx=-w.tz[i],nz=w.tx[i],sa=Math.sin(a),ca=Math.cos(a);
      return [w.rx[i]+nx*sa*r,w.ry[i]+.12+ca*r,w.rz[i]+nz*sa*r];};
    return {n,routeKm,radiusAt,pose,ringPoint};
  }

  const sat=(x)=>Math.max(0,Math.min(1,x));
  const shade=(c,k)=>[sat(c[0]*k),sat(c[1]*k),sat(c[2]*k)];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

  function tube(m,a,b,r0,r1,seg,c0,c1,em){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1;
    const d=[dx/L,dy/L,dz/L];
    const ref=Math.abs(d[1])<.88?[0,1,0]:[1,0,0];
    let ux=d[1]*ref[2]-d[2]*ref[1],uy=d[2]*ref[0]-d[0]*ref[2],uz=d[0]*ref[1]-d[1]*ref[0];
    let ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    const vx=d[1]*uz-d[2]*uy,vy=d[2]*ux-d[0]*uz,vz=d[0]*uy-d[1]*ux;
    const R=(p,r,ang)=>m.P(p[0]+(ux*Math.cos(ang)+vx*Math.sin(ang))*r,
                           p[1]+(uy*Math.cos(ang)+vy*Math.sin(ang))*r,
                           p[2]+(uz*Math.cos(ang)+vz*Math.sin(ang))*r);
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      m.quad(R(a,r0,a0),R(a,r0,a1),R(b,r1,a1),R(b,r1,a0),mix(c0,c1,.45),em);
    }
  }

  function tip(m,p,r,c,em,lod){
    m.sph(p[0],p[1],p[2],r,lod>1?7:5,lod>1?3:2,c,em,false,.92);
  }

  function rockBase(m,c,lod){
    const rc=mix(c,[.08,.22,.23],.72);
    m.sph(0,.10,0,.68,lod>0?7:5,lod>0?3:2,rc,.015,false,.34);
    if(lod>1)m.sph(.38,.08,-.18,.34,6,2,shade(rc,1.12),.02,false,.42);
  }

  function branching(m,c,lod,v){
    rockBase(m,c,lod);
    const dark=shade(c,.72),hi=mix(c,[1,1,1],.22),seg=lod>1?7:(lod?6:5);
    const trunk=[[0,.12,0],[.03,.46,.01],[-.04,.82,.02],[.02,1.18,0]];
    for(let i=0;i<trunk.length-1;i++)tube(m,trunk[i],trunk[i+1],.15-i*.018,.135-i*.020,seg,dark,c,.07);
    const B=[
      [[.01,.42,0],[-.48,.70,.08],[-.64,.98,.13]],
      [[-.02,.58,.01],[.47,.82,-.05],[.62,1.10,-.12]],
      [[-.02,.79,.02],[-.35,1.03,-.16],[-.43,1.28,-.22]],
      [[.01,.91,0],[.34,1.13,.18],[.39,1.38,.26]]
    ];
    if(v>.5)B.push([[.02,.64,0],[.12,.91,.38],[.16,1.17,.50]]);
    const count=lod===0?2:(lod===1?4:B.length);
    for(let q=0;q<count;q++){
      const p=B[q];
      tube(m,p[0],p[1],.105,.080,seg,dark,c,.075);
      tube(m,p[1],p[2],.080,.045,seg,c,hi,.09);
      if(lod>0)tip(m,p[2],.075,hi,.12,lod);
      if(lod>1){
        const s=q&1?-1:1,mid=p[1],end=[p[2][0]+s*.22,p[2][1]-.01,p[2][2]+(q%2?.14:-.12)];
        tube(m,mid,end,.060,.032,5,c,hi,.10); tip(m,end,.055,hi,.13,lod);
      }
    }
    if(lod>0)tip(m,trunk[3],.085,hi,.12,lod);
  }

  function seaFan(m,c,lod,v){
    rockBase(m,c,lod);
    const edge=shade(c,.70),hi=mix(c,[1,.92,1],.18),seg=lod>1?6:5;
    const n=lod>1?9:(lod?7:5),top=[];
    for(let i=0;i<n;i++){
      const u=n===1?0:i/(n-1),x=(u*2-1)*.78,y=.35+Math.sqrt(Math.max(0,1-(x/.86)*(x/.86)))*1.05;
      const z=.05*Math.sin(i*1.7+v*TWO_PI);top.push([x,y,z]);
      tube(m,[0,.16,0],[x*.45,y*.62,z],[.055,.055][0],.035,seg,edge,c,.085);
      tube(m,[x*.45,y*.62,z],[x,y,z],.035,.025,seg,c,hi,.11);
    }
    for(let i=0;i<n-1;i++)tube(m,top[i],top[i+1],.026,.026,5,c,hi,.10);
    if(lod>0){
      for(const f of [.46,.68,.84]){
        for(let i=0;i<n-1;i++){
          const a=top[i],b=top[i+1],pa=[a[0]*f,.18+(a[1]-.18)*f,a[2]],pb=[b[0]*f,.18+(b[1]-.18)*f,b[2]];
          tube(m,pa,pb,.014,.014,4,shade(c,.92),hi,.075);
        }
      }
    }
  }

  function brain(m,c,lod,v){
    rockBase(m,c,lod);
    const sectors=lod>1?16:(lod?12:9),rings=lod>1?6:(lod?5:3),R=.78;
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI;
      const rr=R*rho*(1+.035*Math.sin(5*a+v*TWO_PI));
      const ridge=.055*Math.sin(a*6+rho*16+v*4);
      return m.P(Math.cos(a)*rr,.18+.78*Math.sqrt(Math.max(0,1-rho*rho))+ridge,Math.sin(a)*rr);
    };
    const center=m.P(0,.98,0),hi=mix(c,[1,1,.92],.22),lo=shade(c,.72);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),s%2?c:hi,.09);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const wave=Math.sin((s/sectors*TWO_PI)*6+(r/rings)*16+v*4),cc=wave>.15?hi:(wave<-.35?lo:c);
      m.quad(V(r,s),V(r+1,s),V(r+1,s+1),V(r,s+1),cc,.075);
    }
  }

  function wavyPlate(m,c,lod,y,r,phase){
    const sectors=lod>1?16:(lod?12:9),rings=lod>1?3:2,hi=mix(c,[1,1,1],.18),lo=shade(c,.75);
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI,rr=r*rho;
      const yy=y+.055*Math.sin(a*3+phase)*(rho*rho)+.06*(1-rho);
      return m.P(Math.cos(a)*rr,yy,Math.sin(a)*rr);
    };
    const center=m.P(0,y+.06,0);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),hi,.08);
    for(let ri=1;ri<rings;ri++)for(let s=0;s<sectors;s++)m.quad(V(ri,s),V(ri+1,s),V(ri+1,s+1),V(ri,s+1),ri&1?c:hi,.08);
    for(let s=0;s<sectors;s++){
      const a=V(rings,s),b=V(rings,s+1),a2=[a[0],a[1]-.045*m.tf.k,a[2]],b2=[b[0],b[1]-.045*m.tf.k,b[2]];
      m.quad(a,b,b2,a2,lo,.04);
    }
  }

  function plate(m,c,lod,v){
    rockBase(m,c,lod);
    tube(m,[0,.12,0],[0,.48,0],.13,.105,lod>0?7:5,shade(c,.72),c,.06);
    wavyPlate(m,c,lod,.48,.72,v*TWO_PI);
    if(lod>0){tube(m,[.06,.38,0],[.18,.76,.03],.08,.065,6,shade(c,.74),c,.07);wavyPlate(m,shade(c,1.05),lod,.78,.53,v*TWO_PI+1.5);}
    if(lod>1){tube(m,[-.08,.28,.02],[-.28,.64,-.08],.07,.055,6,shade(c,.72),c,.07);wavyPlate(m,mix(c,[1,.8,.9],.14),lod,.66,.40,v*TWO_PI+3.0);}
  }

  function hollowSponge(m,x,z,h,r,c,lod,lean){
    const seg=lod>1?10:(lod?8:6),top=[x+lean,h,z],base=[x,.12,z],dark=shade(c,.35),hi=mix(c,[1,1,.92],.18);
    tube(m,base,top,r*1.02,r*.78,seg,shade(c,.75),c,.07);
    const rin=r*.48;
    for(let i=0;i<seg;i++){
      const a0=i/seg*TWO_PI,a1=(i+1)/seg*TWO_PI;
      const O0=m.P(top[0]+Math.cos(a0)*r*.78,top[1],top[2]+Math.sin(a0)*r*.78);
      const O1=m.P(top[0]+Math.cos(a1)*r*.78,top[1],top[2]+Math.sin(a1)*r*.78);
      const I0=m.P(top[0]+Math.cos(a0)*rin,top[1]-.045,top[2]+Math.sin(a0)*rin);
      const I1=m.P(top[0]+Math.cos(a1)*rin,top[1]-.045,top[2]+Math.sin(a1)*rin);
      m.quad(O0,O1,I1,I0,hi,.11);
    }
    m.disc(top[0],top[1]-.055,top[2],rin,seg,dark,.01);
  }

  function sponge(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?6:(lod?4:3);
    const P=[[-.36,-.12,.74,.22],[.02,.06,1.02,.25],[.37,-.04,.64,.18],[-.15,.31,.60,.16],[.30,.29,.88,.17],[-.46,.25,.52,.14]];
    for(let i=0;i<n;i++){const p=P[i],cc=i%2?c:mix(c,[1,.72,.35],.12);hollowSponge(m,p[0],p[1],p[2],p[3],cc,lod,(i%3-1)*.06);}
  }

  function soft(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?8:(lod?6:4),seg=lod>1?6:5,hi=mix(c,[1,.86,1],.20),dark=shade(c,.68);
    for(let i=0;i<n;i++){
      const a=(i/n)*TWO_PI+v*.7,rad=.18+(i%3)*.08;
      const p0=[Math.cos(a)*rad,.13,Math.sin(a)*rad];
      const p1=[Math.cos(a)*(.28+(i%2)*.08),.48+(i%3)*.05,Math.sin(a)*(.28+(i%2)*.08)];
      const bend=a+(i&1?.32:-.28),p2=[Math.cos(bend)*(.42+(i%3)*.05),.88+(i%4)*.07,Math.sin(bend)*(.42+(i%3)*.05)];
      tube(m,p0,p1,.105,.073,seg,dark,c,.07);tube(m,p1,p2,.073,.035,seg,c,hi,.10);
      if(lod>0)tip(m,p2,.058,hi,.13,lod);
      if(lod>1&&i<5){
        const p3=[p2[0]+Math.cos(a+1.57)*.18,p2[1]-.02,p2[2]+Math.sin(a+1.57)*.18];
        tube(m,p1,p3,.050,.028,5,c,hi,.10);tip(m,p3,.047,hi,.13,lod);
      }
    }
  }

  const BUILDERS=[branching,seaFan,brain,plate,sponge,soft];

  function rebuildAquaV153(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+153153),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

    /* Preserve the established glass structural ribs exactly; only w.props reef
       geometry is rebuilt. Road, glass/water meshes and actor systems are separate. */
    for(let i=0;i<n;i+=RIB_EVERY){
      const j=(i+1)%n,r=H.radiusAt(i);
      for(let s=0;s<ARC_SEG;s++){
        const a0=-Math.PI/2+s/ARC_SEG*Math.PI,a1=-Math.PI/2+(s+1)/ARC_SEG*Math.PI;
        reef.quad(H.ringPoint(i,a0,r+.05),H.ringPoint(j,a0,r+.05),H.ringPoint(j,a1,r+.05),H.ringPoint(i,a1,r+.05),rib,.09);
      }
      const lp=H.pose(i,-r),rp=H.pose(i,r),yaw=Math.atan2(w.tx[i],w.tz[i]);
      reef.setTF(lp.x,lp.y+.02,lp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
      reef.setTF(rp.x,rp.y+.02,rp.z,yaw,1);reef.box(0,0,0,.20,.35,2.6,rail,.10);
    }

    const cols=COLOUR_BAG.map(hx);
    let nearGroups=0,midGroups=0,farGroups=0,heroGroups=0,mediumGroups=0,simpleGroups=0;
    const typeCounts={branching:0,fan:0,brain:0,plate:0,sponge:0,soft:0},names=Object.keys(typeCounts);

    /* Same exact 2,800 placement budget as v152. The nearest band gets a
       predictable 140 hero models (70 per side). Far reef is deliberately
       simpler, so the extra close-up quality is paid for by cheaper distance LOD. */
    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      for(const side of [-1,1])for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.35,band[0]),hi=Math.max(lo+2.5,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.08:.74)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          hero=k===0&&st%HERO_EVERY===(side>0?1:3),
          lod=hero?2:((k===0||k===1||(k===2&&st%3===0))?1:0),
          base=[1.08,1.34,1.58,1.82][k],spread=[.62,.90,1.04,1.24][k],
          s=(base+rnd()*spread)*(hero?1.18:1),
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],
          yaw=rnd()*TWO_PI,v=rnd(),kind=(st*3+k*5+(side>0?2:0))%BUILDERS.length;
        reef.setTF(p.x,y,p.z,yaw,s);
        BUILDERS[kind](reef,c,lod,v);
        typeCounts[names[kind]]++;
        if(hero)heroGroups++;
        if(lod===2){}else if(lod===1)mediumGroups++;else simpleGroups++;
        if(k===0)nearGroups++;else if(k<3)midGroups++;else farGroups++;
      }
    }
    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);

    const fishCount=(w.actors||[]).filter(a=>a&&a.aquaFish===true).length;
    const jelly=(w.actors||[]).filter(a=>a&&a.aquaJellyV152===true);
    w.__aquaV153={version:VERSION,hqCoral:true,coralGroups:CORAL_GROUPS,reefStations:REEF_STATIONS,
      groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,heroGroups,
      heroTarget:HERO_GROUPS,mediumGroups,simpleGroups,typeCounts,
      coralTypes:['branching','fan','brain','plate','sponge','soft'],
      hybridLOD:true,recognizableGeometry:true,closeHeroCorals:true,
      proceduralSphereClustersReplaced:true,triangles:Math.floor(reef.idx.length/3),
      jellyPreserved:jelly.length,properProjectJellyPreserved:jelly.length===60,
      fishPreserved:fishCount,actorsUnchanged:true,roadUnchanged:true,glassUnchanged:true,
      verdantUntouched:true};
    console.log('Aqua Rift v153 HQ coral geometry:',w.__aquaV153);
    return w;
  }
})();
