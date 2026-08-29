"use strict";

/* ==========================================================================
   9. Saving the ride as .tcx
   ========================================================================== */

function exportTcx(){
  if(state.samples.length<5){msg('Not enough ride recorded yet.');return;}
  const t0=state.startedAt||new Date();
  const iso=s=>new Date(t0.getTime()+s*1000).toISOString().replace(/\.\d+Z$/,'Z');

  /* The workout clock pauses while the bike is stopped. Physics still samples
     once per second, so stationary periods can contain repeated moving-time
     timestamps. TCX readers expect time to move forward: keep only points with
     a strictly newer workout timestamp. */
  const clean=[];
  let lastT=-Infinity;
  for(const s of state.samples){
    if(!Number.isFinite(s.t)||s.t<=lastT+1e-6) continue;
    clean.push(s); lastT=s.t;
  }
  if(clean.length<5){msg('Not enough moving ride recorded yet.');return;}

  let maxS=0; clean.forEach(s=>{if(s.s>maxS)maxS=s.s;});
  const pts=clean.map(s=>
    '   <Trackpoint>\n'+
    '    <Time>'+iso(s.t)+'</Time>\n'+
    '    <AltitudeMeters>'+(Math.abs(s.a)<0.05?0:s.a).toFixed(1)+'</AltitudeMeters>\n'+
    '    <DistanceMeters>'+s.d.toFixed(1)+'</DistanceMeters>\n'+
    (s.c>0?'    <Cadence>'+Math.min(254,s.c)+'</Cadence>\n':'')+
    (s.h>0?'    <HeartRateBpm><Value>'+s.h+'</Value></HeartRateBpm>\n':'')+
    '    <Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">'+
    '<Speed>'+s.s.toFixed(2)+'</Speed><Watts>'+Math.max(0,s.p)+'</Watts></TPX></Extensions>\n'+
    '   </Trackpoint>').join('\n');

  /* Mechanical work (kJ) -> metabolic kcal using 24% gross efficiency.
     1 kcal = 4.184 kJ, so cycling kcal are numerically close to kJ but not
     kJ/0.24 (which would still be kJ and overstate Calories about 4.2x). */
  const calories=Math.max(0,Math.round(state.kj/(0.24*4.184)));
  const totalTime=Math.max(0,state.rideTime||0);

  const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n'+
  ' <Activities>\n  <Activity Sport="Biking">\n'+
  '   <Id>'+iso(0)+'</Id>\n   <Lap StartTime="'+iso(0)+'">\n'+
  '    <TotalTimeSeconds>'+totalTime.toFixed(0)+'</TotalTimeSeconds>\n'+
  '    <DistanceMeters>'+state.dist.toFixed(1)+'</DistanceMeters>\n'+
  '    <MaximumSpeed>'+maxS.toFixed(2)+'</MaximumSpeed>\n'+
  '    <Calories>'+calories+'</Calories>\n'+
  '    <Intensity>Active</Intensity>\n    <TriggerMethod>Manual</TriggerMethod>\n'+
  '    <Track>\n'+pts+'\n    </Track>\n   </Lap>\n'+
  '   <Notes>Lunar Ride - '+state.scene.name+'</Notes>\n'+
  '  </Activity>\n </Activities>\n</TrainingCenterDatabase>\n';
  const url=URL.createObjectURL(new Blob([xml],{type:'application/vnd.garmin.tcx+xml'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='lunarride-'+state.scene.id+'-'+iso(0).slice(0,16).replace(/[:T]/g,'')+'.tcx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
  msg('Saved. Upload the .tcx to Strava, Garmin Connect or TrainingPeaks.',true);
}

