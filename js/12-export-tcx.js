"use strict";

/* ==========================================================================
   9. Saving the ride as .tcx
   ========================================================================== */

function exportTcx(){
  if(state.samples.length<5){msg('Not enough ride recorded yet.');return;}
  const t0=state.startedAt||new Date();
  const iso=s=>new Date(t0.getTime()+s*1000).toISOString().replace(/\.\d+Z$/,'Z');
  let maxS=0; state.samples.forEach(s=>{if(s.s>maxS)maxS=s.s;});
  const pts=state.samples.map(s=>
    '   <Trackpoint>\n'+
    '    <Time>'+iso(s.t)+'</Time>\n'+
    '    <AltitudeMeters>'+(Math.abs(s.a)<0.05?0:s.a).toFixed(1)+'</AltitudeMeters>\n'+
    '    <DistanceMeters>'+s.d.toFixed(1)+'</DistanceMeters>\n'+
    (s.c>0?'    <Cadence>'+Math.min(254,s.c)+'</Cadence>\n':'')+
    (s.h>0?'    <HeartRateBpm><Value>'+s.h+'</Value></HeartRateBpm>\n':'')+
    '    <Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">'+
    '<Speed>'+s.s.toFixed(2)+'</Speed><Watts>'+Math.max(0,s.p)+'</Watts></TPX></Extensions>\n'+
    '   </Trackpoint>').join('\n');
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">\n'+
  ' <Activities>\n  <Activity Sport="Biking">\n'+
  '   <Id>'+iso(0)+'</Id>\n   <Lap StartTime="'+iso(0)+'">\n'+
  '    <TotalTimeSeconds>'+state.elapsed.toFixed(0)+'</TotalTimeSeconds>\n'+
  '    <DistanceMeters>'+state.dist.toFixed(1)+'</DistanceMeters>\n'+
  '    <MaximumSpeed>'+maxS.toFixed(2)+'</MaximumSpeed>\n'+
  '    <Calories>'+Math.round(state.kj/0.24)+'</Calories>\n'+
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

