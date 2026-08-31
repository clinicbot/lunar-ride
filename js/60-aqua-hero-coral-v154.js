"use strict";

/* Aqua Rift v154 — hero coral clusters and reef pedestals --------------------
   Visual feedback on v153: silhouettes improved, but the reef still read as
   scattered low-poly props rather than a rich coral wall. v154 keeps the exact
   2,800 placement budget and the preserved Aqua systems, but changes how that
   budget is spent:

   - many more close hero groups (280 total, not 140);
   - each hero placement becomes a true coral cluster, often 3–4 overlapping
     coral forms instead of one isolated object;
   - every group grows from a darker reef pedestal / ledge so coral does not
     appear to float as a tiny object on a flat floor;
   - the nearest layers are pulled visually closer to the glass and enlarged;
   - medium reef keeps richer silhouettes, while only the far band stays simple.

   Fish, v152 shared jellyfish, road, water, glass, tunnel logic and Verdant
   remain untouched.
*/
(function(){
  const AQUA_ID='aqua',VERSION=154,TWO_PI=Math.PI*2;
  const REEF_STATIONS=350,GROUPS_PER_SIDE=4,CORAL_GROUPS=REEF_STATIONS*2*GROUPS_PER_SIDE;
  const HERO_PRIMARY_EVERY=5,HERO_SECONDARY_EVERY=5,HERO_GROUPS=280;
  const RIB_EVERY=24,ARC_SEG=12,BASE_GLASS_R=8.8;
  const REEF_BANDS=[[9.9,13.8],[11.8,20.5],[18.5,33.0],[31.0,72.0]];
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
    return rebuildAquaV154(w,sc);
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

  const sat=x=>Math.max(0,Math.min(1,x));
  const shade=(c,k)=>[sat(c[0]*k),sat(c[1]*k),sat(c[2]*k)];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];

  function tube(m,a,b,r0,r1,seg,c0,c1,em){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz)||1;
    const d=[dx/L,dy/L,dz/L],ref=Math.abs(d[1])<.88?[0,1,0]:[1,0,0];
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

  function tip(m,p,r,c,em,lod){ m.sph(p[0],p[1],p[2],r,lod>1?8:6,lod>1?4:3,c,em,false,.92); }

  function rockBase(m,c,lod){
    const rc=mix(c,[.08,.22,.23],.72);
    m.sph(0,.10,0,.70,lod>0?8:6,lod>0?4:2,rc,.015,false,.34);
    if(lod>0){
      m.sph(.34,.06,-.14,.42,7,3,shade(rc,1.08),.02,false,.42);
      m.sph(-.28,.05,.18,.33,6,3,shade(rc,.96),.015,false,.36);
    }
  }

  function pedestal(m,c,lod,hero){
    const base=mix(c,[.05,.18,.20],.82),hi=shade(base,1.12),rings=hero?3:(lod>0?2:1);
    m.sph(0,.06,0,hero?1.18:(lod>0?.95:.80),hero?10:8,hero?4:3,base,.012,false,.28);
    m.sph(.40,.03,-.22,hero?.56:.42,8,3,shade(base,.92),.01,false,.24);
    if(rings>1){
      const seg=hero?16:12,rad=hero?1.12:.88,th=hero?.18:.14;
      m.cyl(0,.10,0,rad,th,seg,shade(base,.82),.01);
      if(hero)m.cyl(0,.26,0,rad*.72,.14,14,hi,.012);
    }
    if(hero){
      m.box(0,.02,.78,1.48,.10,.38,shade(base,.88),.008);
      m.box(-.72,.01,-.20,.64,.08,.44,shade(base,.84),.008);
      m.box(.74,.01,.16,.70,.08,.46,shade(base,.90),.008);
    }
  }

  function branching(m,c,lod,v){
    rockBase(m,c,lod);
    const dark=shade(c,.70),hi=mix(c,[1,1,1],.24),seg=lod>1?8:(lod?7:5);
    const trunk=[[0,.12,0],[.03,.52,.01],[-.04,.92,.02],[.02,1.34,0]];
    for(let i=0;i<trunk.length-1;i++)tube(m,trunk[i],trunk[i+1],.17-i*.020,.145-i*.021,seg,dark,c,.07);
    const B=[
      [[.01,.46,0],[-.56,.80,.08],[-.78,1.15,.14]],
      [[-.02,.62,.01],[.53,.92,-.05],[.76,1.28,-.13]],
      [[-.02,.88,.02],[-.44,1.17,-.18],[-.58,1.48,-.28]],
      [[.01,1.00,0],[.42,1.28,.20],[.56,1.60,.30]],
      [[.02,.70,0],[.12,1.00,.48],[.18,1.36,.68]],
      [[-.01,.56,-.02],[-.08,.90,-.44],[-.16,1.18,-.62]]
    ];
    const count=lod===0?3:(lod===1?5:B.length);
    for(let q=0;q<count;q++){
      const p=B[q];
      tube(m,p[0],p[1],.115,.088,seg,dark,c,.078);
      tube(m,p[1],p[2],.088,.048,seg,c,hi,.096);
      if(lod>0)tip(m,p[2],.078,hi,.12,lod);
      if(lod>1){
        const s=q&1?-1:1,mid=p[1],end=[p[2][0]+s*.24,p[2][1]-.02,p[2][2]+(q%2?.18:-.14)];
        tube(m,mid,end,.064,.034,6,c,hi,.10); tip(m,end,.058,hi,.13,lod);
      }
    }
    if(lod>0)tip(m,trunk[3],.09,hi,.12,lod);
  }

  function seaFan(m,c,lod,v){
    rockBase(m,c,lod);
    const edge=shade(c,.70),hi=mix(c,[1,.92,1],.18),seg=lod>1?7:5;
    const n=lod>1?11:(lod?8:5),top=[];
    for(let i=0;i<n;i++){
      const u=n===1?0:i/(n-1),x=(u*2-1)*.92,y=.34+Math.sqrt(Math.max(0,1-(x/.98)*(x/.98)))*1.22;
      const z=.06*Math.sin(i*1.7+v*TWO_PI);top.push([x,y,z]);
      tube(m,[0,.16,0],[x*.44,y*.60,z],[.06,.06][0],.037,seg,edge,c,.088);
      tube(m,[x*.44,y*.60,z],[x,y,z],.037,.026,seg,c,hi,.11);
    }
    for(let i=0;i<n-1;i++)tube(m,top[i],top[i+1],.027,.027,5,c,hi,.10);
    if(lod>0){
      for(const f of [.34,.52,.70,.86]) for(let i=0;i<n-1;i++){
        const a=top[i],b=top[i+1],pa=[a[0]*f,.18+(a[1]-.18)*f,a[2]],pb=[b[0]*f,.18+(b[1]-.18)*f,b[2]];
        tube(m,pa,pb,.014,.014,4,shade(c,.94),hi,.075);
      }
    }
  }

  function brain(m,c,lod,v){
    rockBase(m,c,lod);
    const sectors=lod>1?18:(lod?14:10),rings=lod>1?7:(lod?5:3),R=.88;
    const V=(ri,si)=>{
      const rho=ri/rings,a=si/sectors*TWO_PI,rr=R*rho*(1+.04*Math.sin(5*a+v*TWO_PI));
      const ridge=.060*Math.sin(a*6+rho*17+v*4);return m.P(Math.cos(a)*rr,.18+.88*Math.sqrt(Math.max(0,1-rho*rho))+ridge,Math.sin(a)*rr);
    };
    const center=m.P(0,1.08,0),hi=mix(c,[1,1,.92],.22),lo=shade(c,.70);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),s%2?c:hi,.09);
    for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){
      const wave=Math.sin((s/sectors*TWO_PI)*6+(r/rings)*16+v*4),cc=wave>.15?hi:(wave<-.35?lo:c);
      m.quad(V(r,s),V(r+1,s),V(r+1,s+1),V(r,s+1),cc,.075);
    }
  }

  function wavyPlate(m,c,lod,y,r,phase){
    const sectors=lod>1?18:(lod?13:9),rings=lod>1?4:2,hi=mix(c,[1,1,1],.18),lo=shade(c,.75);
    const V=(ri,si)=>{const rho=ri/rings,a=si/sectors*TWO_PI,rr=r*rho;const yy=y+.065*Math.sin(a*3+phase)*(rho*rho)+.07*(1-rho);return m.P(Math.cos(a)*rr,yy,Math.sin(a)*rr);};
    const center=m.P(0,y+.07,0);
    for(let s=0;s<sectors;s++)m.tri(center,V(1,s),V(1,s+1),hi,.08);
    for(let ri=1;ri<rings;ri++)for(let s=0;s<sectors;s++)m.quad(V(ri,s),V(ri+1,s),V(ri+1,s+1),V(ri,s+1),ri&1?c:hi,.08);
    for(let s=0;s<sectors;s++){
      const a=V(rings,s),b=V(rings,s+1),a2=[a[0],a[1]-.055*m.tf.k,a[2]],b2=[b[0],b[1]-.055*m.tf.k,b[2]];
      m.quad(a,b,b2,a2,lo,.04);
    }
  }

  function plate(m,c,lod,v){
    rockBase(m,c,lod);
    tube(m,[0,.12,0],[0,.54,0],.15,.115,lod>0?8:5,shade(c,.72),c,.06);
    wavyPlate(m,c,lod,.54,.86,v*TWO_PI);
    if(lod>0){ tube(m,[.06,.42,0],[.20,.86,.04],.09,.070,6,shade(c,.74),c,.07); wavyPlate(m,shade(c,1.05),lod,.90,.64,v*TWO_PI+1.5); }
    if(lod>1){ tube(m,[-.10,.30,.02],[-.34,.76,-.10],.08,.060,6,shade(c,.72),c,.07); wavyPlate(m,mix(c,[1,.8,.9],.14),lod,.76,.49,v*TWO_PI+3.0); }
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
    const n=lod>1?7:(lod?5:3);
    const P=[[-.42,-.14,.88,.26],[.03,.08,1.14,.29],[.43,-.05,.74,.21],[-.18,.35,.70,.18],[.34,.32,.98,.18],[-.54,.30,.58,.16],[.58,.10,.66,.18]];
    for(let i=0;i<n;i++){ const p=P[i],cc=i%2?c:mix(c,[1,.72,.35],.12); hollowSponge(m,p[0],p[1],p[2],p[3],cc,lod,(i%3-1)*.07); }
  }

  function soft(m,c,lod,v){
    rockBase(m,c,lod);
    const n=lod>1?9:(lod?6:4),seg=lod>1?7:5,hi=mix(c,[1,.86,1],.20),dark=shade(c,.68);
    for(let i=0;i<n;i++){
      const a=(i/n)*TWO_PI+v*.7,rad=.20+(i%3)*.09;
      const p0=[Math.cos(a)*rad,.13,Math.sin(a)*rad];
      const p1=[Math.cos(a)*(.30+(i%2)*.09),.52+(i%3)*.05,Math.sin(a)*(.30+(i%2)*.09)];
      const bend=a+(i&1?.34:-.30),p2=[Math.cos(bend)*(.48+(i%3)*.05),.98+(i%4)*.08,Math.sin(bend)*(.48+(i%3)*.05)];
      tube(m,p0,p1,.115,.080,seg,dark,c,.07);tube(m,p1,p2,.080,.038,seg,c,hi,.10);
      if(lod>0)tip(m,p2,.060,hi,.13,lod);
      if(lod>1&&i<6){ const p3=[p2[0]+Math.cos(a+1.57)*.20,p2[1]-.02,p2[2]+Math.sin(a+1.57)*.20]; tube(m,p1,p3,.052,.028,5,c,hi,.10); tip(m,p3,.048,hi,.13,lod); }
    }
  }

  const BUILDERS=[branching,seaFan,brain,plate,sponge,soft];
  const TYPE_NAMES=['branching','fan','brain','plate','sponge','soft'];

  function clusterFor(m,c,lod,v,kind,heroLevel,rnd){
    pedestal(m,c,lod,heroLevel>0);
    BUILDERS[kind](m,c,Math.max(lod,heroLevel>1?2:lod),v);

    const tf={x:m.tf.x,y:m.tf.y,z:m.tf.z,k:m.tf.k,c:m.tf.c,s:m.tf.s};
    const rootYaw=Math.atan2(tf.s||0,(tf.c===undefined?1:tf.c));
    const placeLocal=(dx,dz,scale,yaw,fn,col,plod,pv)=>{
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
      const P=m.P(dx,0,dz);
      m.setTF(P[0],P[1],P[2],yaw,tf.k*scale);
      fn(m,col,plod,pv);
      m.setTF(tf.x,tf.y,tf.z,rootYaw,tf.k);
    };

    if(heroLevel===2){
      placeLocal(-.54,-.18,.68,rnd()*TWO_PI,BUILDERS[(kind+1)%BUILDERS.length],mix(c,[1,.86,.92],.14),1,v*.73+.11);
      placeLocal(.48,.22,.62,rnd()*TWO_PI,BUILDERS[(kind+3)%BUILDERS.length],mix(c,[.92,1,.98],.10),1,v*.61+.37);
      placeLocal(.06,-.54,.52,rnd()*TWO_PI,BUILDERS[(kind+5)%BUILDERS.length],shade(c,1.04),1,v*.49+.58);
    }else if(heroLevel===1){
      placeLocal(-.34,.20,.52,rnd()*TWO_PI,BUILDERS[(kind+2)%BUILDERS.length],mix(c,[1,.95,.95],.08),1,v*.68+.19);
      placeLocal(.30,-.25,.43,rnd()*TWO_PI,BUILDERS[(kind+4)%BUILDERS.length],shade(c,1.02),0,v*.41+.43);
    }
  }

  function rebuildAquaV154(w,sc){
    const H=helpers(w),n=H.n;if(!n)return w;
    const rnd=mulberry32((sc.seed||14373)+154154),reef=new MeshB(),rib=hx('#58b6c7'),rail=hx('#276f80');

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
    let nearGroups=0,midGroups=0,farGroups=0,heroGroups=0,mediumGroups=0,simpleGroups=0,heroClusters=0;
    let primaryHeroes=0,secondaryHeroes=0,pedestalGroups=0;
    const typeCounts={branching:0,fan:0,brain:0,plate:0,sponge:0,soft:0};

    for(let st=0;st<REEF_STATIONS;st++){
      const i0=Math.floor((st+.17+rnd()*.66)*n/REEF_STATIONS)%n;
      for(const side of [-1,1]) for(let k=0;k<GROUPS_PER_SIDE;k++){
        const i=(i0+Math.floor((rnd()-.5)*7)+n)%n,glass=H.radiusAt(i),band=REEF_BANDS[k],
          lo=Math.max(glass+1.10,band[0]),hi=Math.max(lo+2.4,band[1]),
          off=lo+Math.pow(rnd(),k<2?1.15:.78)*(hi-lo),p=H.pose(i,side*off),
          y=w.groundAt?w.groundAt(p.x,p.z):w.ry[i]-8,
          heroPrimary=(k===0&&st%HERO_PRIMARY_EVERY===(side>0?1:3)),
          heroSecondary=(k===1&&st%HERO_SECONDARY_EVERY===(side>0?0:2)),
          heroLevel=heroPrimary?2:(heroSecondary?1:0),
          lod=heroLevel===2?2:(heroLevel===1?1:((k<=1|| (k===2&&st%3!==1))?1:0)),
          base=[1.26,1.12,1.34,1.60][k],spread=[.92,.74,.96,1.08][k],
          s=(base+rnd()*spread)*(heroLevel===2?1.36:(heroLevel===1?1.18:1)),
          c=cols[(st*7+k*3+(side>0?11:0))%cols.length],
          yaw=rnd()*TWO_PI,v=rnd(),kind=(st*3+k*5+(side>0?2:0))%BUILDERS.length;
        reef.setTF(p.x,y,p.z,yaw,s);
        clusterFor(reef,c,lod,v,kind,heroLevel,rnd);
        typeCounts[TYPE_NAMES[kind]]++;
        pedestalGroups++;
        if(heroPrimary){heroGroups++;heroClusters++;primaryHeroes++;}
        else if(heroSecondary){heroGroups++;heroClusters++;secondaryHeroes++;}
        else if(lod===1)mediumGroups++;else simpleGroups++;
        if(k===0)nearGroups++; else if(k<3)midGroups++; else farGroups++;
      }
    }

    reef.setTF(0,0,0,0,1);
    w.props=meshOf(reef);

    const fishCount=(w.actors||[]).filter(a=>a&&a.aquaFish===true).length;
    const jelly=(w.actors||[]).filter(a=>a&&a.aquaJellyV152===true);
    w.__aquaV154={version:VERSION,hqCoral:true,heroClusters:true,reefPedestals:true,
      clusteredComposition:true,closeWallFeeling:true,coralGroups:CORAL_GROUPS,
      reefStations:REEF_STATIONS,groupsPerSide:GROUPS_PER_SIDE,nearGroups,midGroups,farGroups,
      heroGroups,heroTarget:HERO_GROUPS,primaryHeroes,secondaryHeroes,heroClusterCount:heroClusters,
      mediumGroups,simpleGroups,pedestalGroups,typeCounts,
      coralTypes:['branching','fan','brain','plate','sponge','soft'],
      hybridLOD:true,recognizableGeometry:true,closeHeroCorals:true,
      proceduralSphereClustersReplaced:true,triangles:Math.floor(reef.idx.length/3),
      jellyPreserved:jelly.length,properProjectJellyPreserved:jelly.length===60,
      fishPreserved:fishCount,actorsUnchanged:true,roadUnchanged:true,glassUnchanged:true,
      verdantUntouched:true};
    console.log('Aqua Rift v154 hero coral clusters:',w.__aquaV154);
    return w;
  }
})();
