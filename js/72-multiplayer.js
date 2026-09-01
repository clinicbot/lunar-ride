"use strict";

/* ==========================================================================
   72. Shared riding — riders online in the same world see each other.
   --------------------------------------------------------------------------
   Transport: Firebase Realtime Database (config in js/73-firebase-config.js).
   Each rider publishes {name, s, speed, dir} a few times per second under
   mp/<sceneId>/<uid>, with onDisconnect cleanup. Every other rider in the
   same world becomes a normal 'rider' actor (a.net=true), so it gets the
   full animation pipeline — glTF bike, pedalling, leg IK, greetings — for
   free. Between packets the actor dead-reckons at its last known speed and
   is steered smoothly toward the freshest network position.
   Without a config or offline, everything here stays dormant.
   ========================================================================== */
(function(){
  const CFGKEY='lr.mp';
  let mp={on:false,name:''};
  try{ Object.assign(mp,JSON.parse(localStorage.getItem(CFGKEY)||'{}')); }catch(e){}
  const uid=(()=>{ try{
      let u=localStorage.getItem('lr.mpUid');
      if(!u){ u='r'+Math.random().toString(36).slice(2,10); localStorage.setItem('lr.mpUid',u); }
      return u;
    }catch(e){ return 'r'+Math.random().toString(36).slice(2,10); } })();
  const kitOf=id=>{ let h=0; for(let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))|0;
    return Math.abs(h)%RIDER_KITS.length; };

  /* ---- settings UI, injected so the core files stay untouched ---- */
  function injectUI(){
    const host=document.getElementById('inRiders');
    if(!host||document.getElementById('inMpOn')) return;
    const row=host.closest('.field');
    const f1=document.createElement('div'); f1.className='field';
    f1.innerHTML='<label class="lbl" title="Ride together online: riders in the same world see each other.">Shared ride</label>'
      +'<input id="inMpOn" type="checkbox" style="width:22px;height:22px;margin-top:6px">';
    const f2=document.createElement('div'); f2.className='field';
    f2.innerHTML='<label class="lbl" title="The name other riders see next to you.">Rider name</label>'
      +'<input id="inMpName" type="text" maxlength="14" placeholder="name">';
    row.parentNode.insertBefore(f1,row.nextSibling);
    row.parentNode.insertBefore(f2,f1.nextSibling);
    const cb=document.getElementById('inMpOn'), nm=document.getElementById('inMpName');
    cb.checked=!!mp.on; nm.value=mp.name||'';
    const save=()=>{ mp.on=cb.checked; mp.name=nm.value.trim();
      try{ localStorage.setItem(CFGKEY,JSON.stringify(mp)); }catch(e){} };
    cb.addEventListener('change',save); nm.addEventListener('change',save);
  }

  /* ---- the who's-riding list on the HUD ---- */
  let listEl=null;
  function listUI(){
    if(listEl) return;
    listEl=document.createElement('div');
    listEl.id='mpList';
    listEl.style.cssText='position:fixed;top:64px;right:12px;z-index:30;display:none;'
      +'background:rgba(10,14,22,.72);border:1px solid rgba(255,255,255,.12);'
      +'border-radius:10px;padding:8px 12px;font:12px/1.7 system-ui;color:#dfe6ef;'
      +'min-width:130px;pointer-events:none';
    document.body.appendChild(listEl);
  }
  function fmtGap(m){
    const a=Math.abs(m);
    const d=a>=1000?(a/1000).toFixed(1)+'km':Math.round(a)+'m';
    return (m>=0?'+':'−')+d;
  }
  function renderList(){
    if(!listEl) return;
    const on=mp.on&&roomScene&&state&&state.riding;
    if(!on||!remote.size){ listEl.style.display='none'; return; }
    const L=world?world.lapLen:0;
    const rows=[];
    remote.forEach(r=>{
      let gap='';
      if(world&&typeof state.s==='number'){
        let g=r.a.s-state.s;
        if(L){ g=((g%L)+L)%L; if(g>L/2)g-=L; }
        gap=' <span style="opacity:.65">'+fmtGap(g)+'</span>';
      }
      rows.push('<div>🚴 '+(r.n||'rider')+gap+'</div>');
    });
    listEl.innerHTML='<div style="opacity:.6;margin-bottom:2px">riding with you</div>'+rows.join('');
    listEl.style.display='block';
  }

  /* ---- firebase plumbing ---- */
  let db=null, roomRef=null, myRef=null, roomScene=null, pubTimer=null;
  const remote=new Map();          /* uid -> {n, a(actor), seen} */
  function fbReady(){
    return typeof firebase!=='undefined'&&window.LR_FIREBASE&&window.LR_FIREBASE.apiKey;
  }
  function init(){
    if(db) return true;
    if(!fbReady()) return false;
    try{ firebase.initializeApp(window.LR_FIREBASE); db=firebase.database(); }
    catch(e){ console.warn('shared ride: init failed',e); return false; }
    return true;
  }

  function spawnActor(d,id){
    const k=kitOf(id);
    const a={type:'rider', net:true, netId:id,
      kit:k, mesh:'rider'+k, meta:RIDER_META,
      s:d.s||0, v:d.v||0, netS:d.s||0, netV:d.v||0, netDir:d.d||1, netAt:performance.now(),
      laneAbs:(world?world.scene.road.halfWidth:5)*0.42,
      fac:1, mass:75, varF:0.02, ph:Math.random()*6.28318,
      headYaw:0, headPitch:0, swing:0, emiss:1, k:1};
    world.actors.push(a);
    return a;
  }
  function dropActor(a){
    if(!world) return;
    const i=world.actors.indexOf(a);
    if(i>=0) world.actors.splice(i,1);
  }

  function join(sceneId){
    if(!init()) return;
    if(roomScene===sceneId) return;
    leave();
    roomScene=sceneId;
    roomRef=db.ref('mp/'+sceneId);
    myRef=roomRef.child(uid);
    myRef.onDisconnect().remove();
    roomRef.on('value',snap=>{
      const v=snap.val()||{};
      const now=Date.now();
      for(const id in v){
        if(id===uid) continue;
        const d=v[id];
        if(!d||typeof d.s!=='number') continue;
        if(d.t&&now-d.t>25000) continue;          /* stale ghost */
        let r=remote.get(id);
        if(!r){ r={n:d.n||'rider', a:spawnActor(d,id)}; remote.set(id,r); }
        r.n=d.n||'rider'; r.seen=now;
        r.a.netS=d.s; r.a.netV=d.v||0; r.a.netDir=d.d||1; r.a.netAt=performance.now();
        r.a.oncoming=((d.d||1)!==state.dir);       /* base dsg then equals THEIR direction */
      }
      remote.forEach((r,id)=>{
        if(!(id in v)){ dropActor(r.a); remote.delete(id); }
      });
      renderList();
    });
    pubTimer=setInterval(publish,400);
  }
  function leave(){
    if(pubTimer){ clearInterval(pubTimer); pubTimer=null; }
    if(roomRef){ roomRef.off(); }
    if(myRef){ try{ myRef.remove(); }catch(e){} }
    remote.forEach(r=>dropActor(r.a));
    remote.clear();
    roomRef=myRef=roomScene=null;
    renderList();
  }
  function publish(){
    if(!myRef||!state||!state.riding) return;
    myRef.set({ n:(mp.name||'rider').slice(0,14),
      s:Math.round(state.s*10)/10, v:Math.round(state.speed*100)/100,
      d:state.dir, w:Math.round(state.power||0),
      t:firebase.database.ServerValue.TIMESTAMP });
  }

  /* ---- the per-frame drive for a network rider (called from js/10) ---- */
  window.MP_netDrive=function(a,dt){
    if(!world) return;
    const L=world.lapLen;
    a.s+=(a.netDir||1)*a.v*dt;                    /* dead reckoning */
    const age=Math.min((performance.now()-(a.netAt||0))/1000,3);
    let tgt=(a.netS||0)+(a.netDir||1)*(a.netV||0)*age;
    tgt=((tgt%L)+L)%L; a.s=((a.s%L)+L)%L;
    let err=tgt-a.s; if(err>L/2)err-=L; if(err<-L/2)err+=L;
    if(Math.abs(err)>60) a.s=tgt;                 /* way off: snap once */
    else a.s+=err*Math.min(1,dt*2.5);
    a.s=((a.s%L)+L)%L;
    a.v+=((a.netV||0)-a.v)*Math.min(1,dt*2);
  };

  /* ---- lifecycle: follow the app without editing its core ---- */
  let lastRiding=false, lastScene=null, listTick=0;
  function tick(){
    requestAnimationFrame(tick);
    if(typeof state==='undefined') return;
    const riding=!!(state.riding&&world&&state.scene);
    if(mp.on&&riding){
      if(state.scene.id!==lastScene){ lastScene=state.scene.id; join(lastScene); }
    }else if(lastRiding||roomScene){
      lastScene=null; leave();
    }
    lastRiding=riding;
    if(++listTick>=30){ listTick=0; renderList(); }
  }
  window.addEventListener('load',()=>{ injectUI(); listUI(); tick(); });
  window.addEventListener('beforeunload',()=>{ try{ if(myRef) myRef.remove(); }catch(e){} });
})();
