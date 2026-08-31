"use strict";

/* Aqua Rift v146 — water-column distribution ------------------------------
   The v145 fish are now correctly sized and visible, but visual review showed
   that too many schools sit high above the rider.  This Aqua-only layer keeps
   the same 258 real Quaternius fish and hard fauna isolation while redistributing
   schools on BOTH sides of the route and throughout the water column: low,
   eye-level, mid and high.  No Verdant code or fauna is touched. */
(function(){
  const AQUA_ID='aqua',VERSION=146;
  const SCHOOL_SIZE=6;
  const ROAD_OFFSETS=[16,20,24,29];
  const HEIGHT_BANDS=[-1.5,1.0,4.0,8.0,12.0];
  const FLOOR_CLEARANCE=2.2;
  const SWIM_RADIUS_MIN=2.0,SWIM_RADIUS_MAX=5.0;

  const previousBuild=buildWorld;
  buildWorld=function(sc,onProgress){
    const w=previousBuild(sc,onProgress);
    if(!w||!sc||sc.id!==AQUA_ID||!Array.isArray(w.actors))return w;
    return distributeAquaFish(w);
  };

  function distributeAquaFish(w){
    const fish=w.actors.filter(a=>a&&a.aquaFish===true);
    const n=w.nMain||0;
    if(!fish.length||!n||!w.rx||!w.rz||!w.ry||!w.tx||!w.tz)return w;

    const groups=Math.ceil(fish.length/SCHOOL_SIZE);
    const stations=Math.ceil(groups/2);
    const byBand=new Array(HEIGHT_BANDS.length).fill(0);
    let left=0,right=0,minVisualY=1e9,maxVisualY=-1e9;

    for(let q=0;q<fish.length;q++){
      const a=fish[q],g=Math.floor(q/SCHOOL_SIZE),j=q%SCHOOL_SIZE;
      const station=Math.floor(g/2);
      const side=(g%2===0)?-1:1; // paired schools: left + right at each route station
      const i=Math.min(n-1,Math.floor((station+.5)*n/stations));
      const off=ROAD_OFFSETS[(station+j)%ROAD_OFFSETS.length]+(j-(SCHOOL_SIZE-1)/2)*.35;
      const cx=w.rx[i]-w.tz[i]*off*side;
      const cz=w.rz[i]+w.tx[i]*off*side;
      const floor=typeof w.groundAt==='function'?w.groundAt(cx,cz):w.ry[i]-4;
      const band=(station+j*2)%HEIGHT_BANDS.length;
      const desired=w.ry[i]+HEIGHT_BANDS[band]+((j%3)-1)*.45;
      const targetY=Math.max(floor+FLOOR_CLEARANCE,desired);

      /* drone update uses gy+alt plus a small sinusoidal bob.  Anchor gy at
         the desired absolute height and zero alt so the band really is low
         when requested rather than inheriting v144/v145's high altitude. */
      a.cx=cx; a.cz=cz; a.gy=targetY; a.alt=0;
      a.r=SWIM_RADIUS_MIN+((j+station)%7)/6*(SWIM_RADIUS_MAX-SWIM_RADIUS_MIN);
      a.ph=((a.ph||0)+j*.83+station*.37)%6.28318530718;
      a.px=a.cx+Math.cos(a.ph)*a.r;
      a.pz=a.cz+Math.sin(a.ph)*a.r;
      a.py=targetY;
      a.__aquaV146Band=band;
      a.__aquaV146Side=side;

      byBand[band]++;
      if(side<0)left++; else right++;
      if(targetY<minVisualY)minVisualY=targetY;
      if(targetY>maxVisualY)maxVisualY=targetY;
    }

    w.__aquaFishV146={version:VERSION,fish:fish.length,schools:groups,pairedStations:stations,
      schoolSize:SCHOOL_SIZE,roadOffsets:ROAD_OFFSETS.slice(),heightBands:HEIGHT_BANDS.slice(),
      floorClearance:FLOOR_CLEARANCE,swimRadius:[SWIM_RADIUS_MIN,SWIM_RADIUS_MAX],
      byBand,left,right,minVisualY,maxVisualY,bilateral:true,fullWaterColumn:true};
    if(w.__aquaFishV145)w.__aquaFishV145.correctedByV146=true;
    console.log('Aqua Rift v146 water-column fish distribution:',w.__aquaFishV146);
    return w;
  }

  globalThis.__aquaFishV146Spec={VERSION,SCHOOL_SIZE,ROAD_OFFSETS:ROAD_OFFSETS.slice(),
    HEIGHT_BANDS:HEIGHT_BANDS.slice(),FLOOR_CLEARANCE,SWIM_RADIUS_MIN,SWIM_RADIUS_MAX};
})();
