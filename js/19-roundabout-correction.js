"use strict";

/* ==========================================================================\n   True three-arm roundabout topology\n   --------------------------------------------------------------------------\n   A roundabout is road geometry, not a circle stamped over a Y-junction.\n   Remove the old road mesh in a compact junction disc, then rebuild three\n   separate approach ribbons that terminate on one circular carriageway.\n   The same generated arm/arc data is later used by the rider path and map.\n   ========================================================================== */
(function(){
  if(typeof buildWorld!=='function') return;
  const baseBuildWorld=buildWorld, TAU=Math.PI*2;
  const concatF=(a,b)=>{const q=new Float32Array(a.length+b.length);q.set(a);q.set(b,a.length);return q;};
  const concatU=(a,b,off)=>{const q=new Uint32Array(a.length+b.length);q.set(a);for(let i=0;i<b.length;i++)q[a.length+i]=b[i]+off;return q;};
  const wrap=(i,n)=>((i%n)+n)%n;
  const norm=(x,z)=>{const l=Math.hypot(x,z)||1;return [x/l,z/l];};
  const ang=(x,z)=>Math.atan2(z,x);
  const dArc=(a,b,dir)=>dir>0?((b-a+TAU)%TAU):((a-b+TAU)%TAU);

  buildWorld=function(scene,onProgress){
    const w=baseBuildWorld(scene,onProgress);
    if(!w||!w.nCut||w.nCut<5||!w.road) return w;

    const hw=scene.road.halfWidth||3.2;
    const span=Math.max(30,Math.round(34/ROUTE_STEP)*ROUTE_STEP);
    const ks=Math.max(3,Math.round(span/ROUTE_STEP));
    const R=Math.max(12.5,hw*3.9);
    const inner=Math.max(5.5,R-hw-.55), outer=R+hw+.55;
    const clipR=outer+8;

    const rounds=[];
    function makeRound(which,jn){
      const prevI=wrap(jn-ks,w.nMain), nextI=wrap(jn+ks,w.nMain);
      const cutK=which==='A'?Math.min(ks,w.nCut-2):Math.max(1,w.nCut-1-ks);
      const cutI=w.nMain+cutK;
      const cx=w.rx[jn],cz=w.rz[jn],cy=w.ry[jn]+.12;
      const [pvx,pvz]=norm(w.rx[prevI]-cx,w.rz[prevI]-cz);
      const [nvx,nvz]=norm(w.rx[nextI]-cx,w.rz[nextI]-cz);
      const [cvx,cvz]=norm(w.rx[cutI]-cx,w.rz[cutI]-cz);
      const prevAng=ang(pvx,pvz),nextAng=ang(nvx,nvz),cutAng=ang(cvx,cvz);
      const plus=dArc(prevAng,cutAng,1)+dArc(cutAng,nextAng,1);
      const minus=dArc(prevAng,cutAng,-1)+dArc(cutAng,nextAng,-1);
      const dir=plus<=minus?1:-1;
      const a1=dArc(prevAng,cutAng,dir),a2=dArc(cutAng,nextAng,dir);
      const r={which,jn,J:jn*ROUTE_STEP,cx,cz,cy,R,inner,outer,clipR,span,ks,
        prevI,nextI,cutI,cutK,prevAng,nextAng,cutAng,dir,a1,a2,arms:{}};
      const entry=(a)=>[cx+Math.cos(a)*R,cy,cz+Math.sin(a)*R];
      const bezier=(P0,P3)=>{
        const vx=P3[0]-P0[0],vz=P3[2]-P0[2],L=Math.hypot(vx,vz)||1;
        const [tx,tz]=norm(vx,vz),n=14,pts=[];
        const c=.34*L,P1=[P0[0]+tx*c,P0[1]+(P3[1]-P0[1])*.28,P0[2]+tz*c];
        const P2=[P3[0]-tx*c,P3[1]-(P3[1]-P0[1])*.28,P3[2]-tz*c];
        for(let k=0;k<=n;k++){
          const t=k/n,u=1-t;
          pts.push([
            u*u*u*P0[0]+3*u*u*t*P1[0]+3*u*t*t*P2[0]+t*t*t*P3[0],
            u*u*u*P0[1]+3*u*u*t*P1[1]+3*u*t*t*P2[1]+t*t*t*P3[1],
            u*u*u*P0[2]+3*u*u*t*P1[2]+3*u*t*t*P2[2]+t*t*t*P3[2]
          ]);
        }
        return pts;
      };
      const prev0=[w.rx[prevI],w.ry[prevI]+.11,w.rz[prevI]];
      const next0=[w.rx[nextI],w.ry[nextI]+.11,w.rz[nextI]];
      const cut0=[w.rx[cutI],w.ry[cutI]+.11,w.rz[cutI]];
      r.arms.prev={ang:prevAng,points:bezier(prev0,entry(prevAng))};
      r.arms.next={ang:nextAng,points:bezier(next0,entry(nextAng))};
      r.arms.cut ={ang:cutAng, points:bezier(cut0, entry(cutAng ))};
      return r;
    }
    rounds.push(makeRound('A',w.jnA),makeRound('B',w.jnB));

    {
      const pos=w.road.pos,idx=w.road.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const mx=(pos[ia*3]+pos[ib*3]+pos[ic*3])/3;
        const my=(pos[ia*3+1]+pos[ib*3+1]+pos[ic*3+1])/3;
        const mz=(pos[ia*3+2]+pos[ib*3+2]+pos[ic*3+2])/3;
        let cut=false;
        for(const r of rounds){
          const d=Math.hypot(mx-r.cx,mz-r.cz);
          if(d<r.clipR&&Math.abs(my-r.cy)<10){cut=true;break;}
        }
        if(!cut)keep.push(ia,ib,ic);
      }
      w.road.idx=new Uint32Array(keep);
    }

    if(w.props&&w.props.idx&&w.props.pos){
      const pos=w.props.pos,idx=w.props.idx,keep=[];
      for(let q=0;q<idx.length;q+=3){
        const ia=idx[q],ib=idx[q+1],ic=idx[q+2];
        const mx=(pos[ia*3]+pos[ib*3]+pos[ic*3])/3;
        const my=(pos[ia*3+1]+pos[ib*3+1]+pos[ic*3+1])/3;
        const mz=(pos[ia*3+2]+pos[ib*3+2]+pos[ic*3+2])/3;
        const lo=Math.min(pos[ia*3+1],pos[ib*3+1],pos[ic*3+1]);
        const hi=Math.max(pos[ia*3+1],pos[ib*3+1],pos[ic*3+1]);
        let drop=false;
        for(const r of rounds){
          if(Math.hypot(mx-r.cx,mz-r.cz)<r.clipR+5&&Math.abs(my-r.cy)<9&&lo>r.cy-2&&hi<r.cy+2.5){drop=true;break;}
        }
        if(!drop)keep.push(ia,ib,ic);
      }
      w.props.idx=new Uint32Array(keep);
    }

    const roadCol=hx(scene.col.road),rumCol=hx(scene.col.rumble),laneCol=hx(scene.col.lane);
    const islandCol=hx(scene.col.low||scene.col.high||'#4b4b49');
    const P=[],N=[],C=[],I=[];
    const V=(x,y,z,c,e=0)=>{const id=P.length/3;P.push(x,y,z);N.push(0,1,0);C.push(c[0],c[1],c[2],e);return id;};
    const stripes=[[-hw-1.1,'rum'],[-hw-.02,'rum'],[-hw,'road'],[-.26,'road'],[-.22,'lane'],[.22,'lane'],[.26,'road'],[hw,'road'],[hw+.02,'rum'],[hw+1.1,'rum']];
    function ribbon(points,fadeLane){
      const base=P.length/3,NL=stripes.length;
      for(let k=0;k<points.length;k++){
        const a=points[Math.max(0,k-1)],b=points[Math.min(points.length-1,k+1)];
        const [tx,tz]=norm(b[0]-a[0],b[2]-a[2]),nx=-tz,nz=tx;
        const laneOn=!(fadeLane&&k>points.length-4);
        for(const st of stripes){
          let c=roadCol,e=0;
          if(st[1]==='rum'){c=rumCol;e=scene.beacons?.3:0;}
          else if(st[1]==='lane'&&laneOn)c=laneCol;
          V(points[k][0]+nx*st[0],points[k][1],points[k][2]+nz*st[0],c,e);
        }
      }
      for(let k=0;k<points.length-1;k++)for(let j=0;j<stripes.length-1;j++){
        const a=base+k*stripes.length+j,b=a+1,c=base+(k+1)*stripes.length+j,d=c+1;
        I.push(a,b,c,b,d,c);
      }
    }
    const ringStrip=(r,r0,r1,c,lift)=>{
      const S=88,base=P.length/3;
      for(let k=0;k<=S;k++){
        const a=k/S*TAU,ca=Math.cos(a),sa=Math.sin(a);
        for(const rr of [r0,r1])V(r.cx+ca*rr,r.cy+lift,r.cz+sa*rr,c);
      }
      for(let k=0;k<S;k++){const a=base+k*2,b=a+1,c0=a+2,d=a+3;I.push(a,b,c0,b,d,c0);}
    };
    const disk=(r,rad,c,lift)=>{
      const S=88,base=P.length/3,cc=V(r.cx,r.cy+lift,r.cz,c);
      for(let k=0;k<S;k++){const a=k/S*TAU;V(r.cx+Math.cos(a)*rad,r.cy+lift,r.cz+Math.sin(a)*rad,c);}
      for(let k=0;k<S;k++)I.push(cc,base+1+k,base+1+((k+1)%S));
    };

    for(const r of rounds){
      ribbon(r.arms.prev.points,true);ribbon(r.arms.next.points,true);ribbon(r.arms.cut.points,true);
      disk(r,r.inner-.55,islandCol,.48);
      ringStrip(r,r.inner-.55,r.inner,rumCol,.44);
      ringStrip(r,r.inner,r.outer,roadCol,.40);
      ringStrip(r,r.outer,r.outer+.60,rumCol,.44);
    }
    if(I.length){
      const off=w.road.pos.length/3;
      w.road={pos:concatF(w.road.pos,new Float32Array(P)),nrm:concatF(w.road.nrm,new Float32Array(N)),
        col:concatF(w.road.col,new Float32Array(C)),idx:concatU(w.road.idx,new Uint32Array(I),off)};
    }

    if(w.terrain&&w.terrain.pos){
      const pos=w.terrain.pos,nrm=w.terrain.nrm;
      const nearPolyline=(x,z,pts)=>{let bd=Infinity;for(const p of pts){const d=(x-p[0])**2+(z-p[2])**2;if(d<bd)bd=d;}return Math.sqrt(bd);};
      for(let v=0;v<pos.length/3;v++){
        const x=pos[v*3],z=pos[v*3+2];
        for(const r of rounds){
          const d=Math.hypot(x-r.cx,z-r.cz);
          let target=null;
          if(d<r.outer+2.5)target=r.cy-.32;
          else{
            for(const nm of ['prev','next','cut'])if(nearPolyline(x,z,r.arms[nm].points)<hw+2.8){
              const pts=r.arms[nm].points;let bi=0,bd=Infinity;
              for(let k=0;k<pts.length;k++){const dd=(x-pts[k][0])**2+(z-pts[k][2])**2;if(dd<bd){bd=dd;bi=k;}}
              target=pts[bi][1]-.38;break;
            }
          }
          if(target!==null){pos[v*3+1]=Math.min(pos[v*3+1],target);break;}
        }
      }
      if(nrm&&nrm.length===pos.length){
        const NV=Math.round(Math.sqrt(pos.length/3));
        if(NV*NV===pos.length/3){
          const step=Math.hypot(pos[3]-pos[0],pos[5]-pos[2])||1;
          const Y=(i,j)=>pos[(j*NV+i)*3+1];
          for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){
            let nx=Y(Math.max(0,i-1),j)-Y(Math.min(NV-1,i+1),j),ny=2*step,nz=Y(i,Math.max(0,j-1))-Y(i,Math.min(NV-1,j+1));
            const l=Math.hypot(nx,ny,nz)||1,k=(j*NV+i)*3;nrm[k]=nx/l;nrm[k+1]=ny/l;nrm[k+2]=nz/l;
          }
        }
      }
    }

    w.roundabouts=rounds;
    try{window.__roundaboutV2=rounds.map(r=>({which:r.which,centre:[+r.cx.toFixed(1),+r.cz.toFixed(1)],R:r.R,
      armAngles:[r.prevAng,r.cutAng,r.nextAng].map(a=>+(a*180/Math.PI).toFixed(1))}));}catch(e){}
    return w;
  };
})();
