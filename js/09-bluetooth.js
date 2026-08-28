"use strict";

/* ==========================================================================
   6. Bluetooth
   ========================================================================== */

const BT={trainer:null,hr:null,kind:null,last:0,crank:null,
          ctrl:null,ctrlReady:false,ctrlBusy:false,ctrlNote:''};

/* --------------------------------------------------------------------------
   FTMS resistance control.
   The trainer is put into "indoor bike simulation" mode: we hand it the road
   gradient and it works out the resistance itself, exactly as Zwift does.
   -------------------------------------------------------------------------- */
async function cpWrite(bytes){
  if(!BT.ctrl||BT.ctrlBusy) return false;
  BT.ctrlBusy=true;
  try{
    if(BT.ctrl.writeValueWithResponse) await BT.ctrl.writeValueWithResponse(bytes);
    else await BT.ctrl.writeValue(bytes);
    return true;
  }catch(e){ BT.ctrlNote=e.message||String(e); return false; }
  finally{ BT.ctrlBusy=false; }
}

async function setupControl(fm){
  try{
    const cp=await fm.getCharacteristic('fitness_machine_control_point');
    await cp.startNotifications();
    cp.addEventListener('characteristicvaluechanged',e=>{
      const d=e.target.value;
      if(d.byteLength>=3 && d.getUint8(0)===0x80){
        const req=d.getUint8(1), res=d.getUint8(2);
        if(req===0x00) BT.ctrlReady=(res===0x01);
        if(res!==0x01) BT.ctrlNote='op 0x'+req.toString(16)+' returned '+res;
      }
    });
    BT.ctrl=cp;
    await cpWrite(new Uint8Array([0x00]));   /* request control */
    await cpWrite(new Uint8Array([0x07]));   /* start or resume */
    /* some trainers grant control silently, without an indication */
    setTimeout(()=>{ if(BT.ctrl && !BT.ctrlReady) BT.ctrlReady=true; },1200);
    return true;
  }catch(e){ BT.ctrl=null; BT.ctrlNote=e.message||String(e); return false; }
}

/* What the trainer is actually asked to feel.
   Sim   : the road, scaled by difficulty, with the descents optionally kept
           heavy so you can still put power down going downhill.
   Steady: one gradient of your choosing, whatever the road is doing.
   Neither changes the physics — the bike always rides the real road. */
function trainerGrade(){
  if(cfg.steady) return cfg.steadyGrade;
  const g=gradeNow()*cfg.difficulty;
  return g<0 ? lerp(g,0,cfg.descentKeep) : g;
}

let gradeSent=999, gradeSentAt=0;
function pushGrade(force){
  if(!BT.ctrl||!BT.ctrlReady||!world) return;
  const now=performance.now();
  if(now-gradeSentAt<450 && !force) return;
  const g=clamp((force===0?0:trainerGrade()),-25,25);
  if(Math.abs(g-gradeSent)<0.1 && now-gradeSentAt<3000 && !force) return;
  gradeSentAt=now; gradeSent=g;
  const b=new DataView(new ArrayBuffer(7));
  b.setUint8(0,0x11);                        /* set simulation parameters */
  b.setInt16(1,0,true);                      /* wind speed, 0.001 m/s */
  b.setInt16(3,Math.round(g*100),true);      /* gradient, 0.01 %       */
  b.setUint8(5,45);                          /* Crr  0.0045            */
  b.setUint8(6,20);                          /* Cw   0.20 kg/m         */
  cpWrite(new Uint8Array(b.buffer));
}
function releaseTrainer(){
  if(BT.ctrl&&BT.ctrlReady){ gradeSent=999; pushGrade(0); }
}
function msg(t,ok){$('msg').textContent=t||'';$('msg').style.color=ok?'#6ee7a8':'var(--warn)';}

/* --- remember which devices were used, so they can be picked up next time --- */
function savedDevices(){
  try{ return JSON.parse(localStorage.getItem('lr.dev')||'{}'); }catch(e){ return {}; }
}
function rememberDevice(kind,dev){
  try{
    const s=savedDevices();
    s[kind]={id:dev.id,name:dev.name||''};
    localStorage.setItem('lr.dev',JSON.stringify(s));
  }catch(e){}
}
function forgetDevices(){
  try{ localStorage.removeItem('lr.dev'); }catch(e){}
  msg('Saved devices cleared. The next connection will ask again.',true);
  updatePills();
}

async function wireTrainer(dev){
  const srv=await dev.gatt.connect();
  let ok=false;
  try{
    const fm=await srv.getPrimaryService('fitness_machine');
    const ch=await fm.getCharacteristic('indoor_bike_data');
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged',e=>parseIndoorBike(e.target.value));
    BT.kind='FTMS'; ok=true;
    await setupControl(fm);
  }catch(e){}
  if(!ok){
    const cp=await srv.getPrimaryService('cycling_power');
    const ch=await cp.getCharacteristic('cycling_power_measurement');
    await ch.startNotifications();
    ch.addEventListener('characteristicvaluechanged',e=>parseCyclingPower(e.target.value));
    BT.kind='Power';
  }
  BT.trainer=dev;
  rememberDevice('trainer',dev);
  dev.addEventListener('gattserverdisconnected',()=>{
    BT.trainer=null;BT.kind=null;BT.ctrl=null;BT.ctrlReady=false;
    updatePills();msg('Trainer disconnected.');
  });
  updatePills();
  setTimeout(()=>{
    updatePills();
    msg('Connected to '+(dev.name||'trainer')+' over '+BT.kind+
      (BT.ctrl?'. Resistance control is on — the trainer will load up on the climbs.'
              :'. Read-only: this trainer did not offer resistance control, so shift gears yourself.'),true);
  },1500);
}

async function connectTrainer(){
  if(!navigator.bluetooth){
    msg('This browser has no Web Bluetooth. Use Chrome or Edge, and open the page over http://localhost or https.');
    return;
  }
  try{
    msg('Look for the browser pop-up and pick your trainer...');
    const dev=await navigator.bluetooth.requestDevice({
      filters:[{services:['fitness_machine']},{services:['cycling_power']}],
      optionalServices:['fitness_machine','cycling_power','cycling_speed_and_cadence','battery_service']
    });
    await wireTrainer(dev);
  }catch(err){
    msg(err&&err.name==='NotFoundError'
      ? 'No trainer picked. If yours is not listed: pedal to wake it, and close Zwift or anything else holding the connection.'
      : 'Could not connect: '+(err&&err.message||err));
  }
}

async function wireHr(dev){
  const srv=await dev.gatt.connect();
  const ch=await (await srv.getPrimaryService('heart_rate'))
                 .getCharacteristic('heart_rate_measurement');
  await ch.startNotifications();
  ch.addEventListener('characteristicvaluechanged',e=>{
    const dv=e.target.value,f=dv.getUint8(0);
    state.hr=(f&1)?dv.getUint16(1,true):dv.getUint8(1);
    $('hrBox').style.display='';
  });
  BT.hr=dev;
  rememberDevice('hr',dev);
  dev.addEventListener('gattserverdisconnected',()=>{BT.hr=null;state.hr=0;updatePills();});
  updatePills();
  msg('Heart rate connected: '+(dev.name||'device')+'.',true);
}

async function connectHr(showAll){
  if(!navigator.bluetooth){msg('This browser has no Web Bluetooth.');return;}
  let dev=null;
  try{
    msg(showAll?'Every nearby Bluetooth device is listed — pick your watch.'
               :'Pick your strap or watch from the pop-up...');
    dev=await navigator.bluetooth.requestDevice(showAll
      ? {acceptAllDevices:true, optionalServices:['heart_rate','battery_service']}
      : {filters:[{services:['heart_rate']}], optionalServices:['heart_rate','battery_service']});
  }catch(err){
    msg(err&&err.name==='NotFoundError'
      ? 'Nothing picked. If your watch is not in the list, try "Show all devices" — and check the watch is actually broadcasting heart rate, not merely paired to your phone.'
      : 'Could not connect: '+(err&&err.message||err));
    return;
  }
  try{
    await wireHr(dev);
  }catch(e){
    try{dev.gatt.disconnect();}catch(_){}
    msg((dev.name||'That device')+' connected, but it does not offer the standard '+
        'Bluetooth heart-rate service, so nothing can read its pulse. A Galaxy Watch '+
        'does not broadcast by default: install a "BLE heart rate broadcaster" app from '+
        'the Play Store ON THE WATCH, start it, then press Connect heart rate again. '+
        'Garmin watches have it built in under Settings > Sensors > Broadcast Heart Rate.');
  }
}

/* --- pick the same devices up again on start-up, without any pop-up --- */
async function autoConnect(){
  if(!cfg.autoConnect||!navigator.bluetooth) return;
  const saved=savedDevices();
  if(!saved.trainer&&!saved.hr) return;
  if(!navigator.bluetooth.getDevices){
    msg('Your devices are remembered, but Chrome will not let a page reconnect on its own '+
        'until you switch a flag on: open chrome://flags, search for "bluetooth", enable '+
        '"Use the new permissions backend for Web Bluetooth", and restart Chrome. '+
        'Until then, one press of Connect trainer does it.');
    return;
  }
  let known=[];
  try{ known=await navigator.bluetooth.getDevices(); }catch(e){ return; }
  if(!known.length) return;
  const limit=(p,ms)=>Promise.race([p,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('timed out')),ms))]);
  const done=[];
  for(const job of [['trainer',wireTrainer,'trainer'],['hr',wireHr,'heart rate']]){
    const want=saved[job[0]]; if(!want) continue;
    const dev=known.find(d=>d.id===want.id); if(!dev) continue;
    msg('Reconnecting to '+(want.name||job[2])+'...');
    try{ await limit(job[1](dev),9000); done.push(job[2]); }catch(e){}
  }
  updatePills();
  if(done.length) setTimeout(()=>msg('Reconnected automatically: '+done.join(' and ')+'.',true),1700);
  else msg('Could not reconnect on its own. Wake the trainer by pedalling, then press Connect trainer.');
}
function parseIndoorBike(dv){
  try{
    const f=dv.getUint16(0,true); let o=2;
    const has=b=>(f&b)!==0;
    if(!has(0x0001)) o+=2;
    if(has(0x0002)) o+=2;
    if(has(0x0004)){state.cad=dv.getUint16(o,true)/2;o+=2;}
    if(has(0x0008)) o+=2;
    if(has(0x0010)) o+=3;
    if(has(0x0020)) o+=2;
    if(has(0x0040)){state.power=dv.getInt16(o,true);o+=2;}
    if(has(0x0080)) o+=2;
    if(has(0x0100)) o+=5;
    if(has(0x0200)&&o<dv.byteLength){state.hr=dv.getUint8(o);$('hrBox').style.display='';}
    BT.last=performance.now();
  }catch(e){}
}
function parseCyclingPower(dv){
  try{
    const f=dv.getUint16(0,true);
    state.power=dv.getInt16(2,true);
    let o=4;
    if(f&0x0001) o+=1;
    if(f&0x0004) o+=2;
    if(f&0x0010) o+=6;
    if((f&0x0020)&&o+3<dv.byteLength){
      const revs=dv.getUint16(o,true),tm=dv.getUint16(o+2,true);
      if(BT.crank){
        let dr=revs-BT.crank.r,dt=tm-BT.crank.t;
        if(dr<0)dr+=65536; if(dt<0)dt+=65536;
        if(dt>0) state.cad=clamp(dr*1024*60/dt,0,220);
      }
      BT.crank={r:revs,t:tm};
    }
    BT.last=performance.now();
  }catch(e){}
}
function updatePills(){
  const t=$('pillTrainer'),h=$('pillHr');
  t.textContent=BT.trainer
    ?((BT.trainer.name||'trainer')+' · '+BT.kind+(BT.ctrl?' · resistance':' · read-only'))
    :'no trainer';
  t.className='pill'+(BT.trainer?' live':'');
  h.textContent=BT.hr?(BT.hr.name||'HR strap'):'no HR';
  h.className='pill'+(BT.hr?' live':'');
  $('btnTrainer').textContent=BT.trainer?'Change trainer':'Connect trainer';
}

