async function loadGroups(){
  document.getElementById('g-list-view').classList.remove('hidden');
  document.getElementById('g-detail-view').classList.add('hidden');
  const all=document.getElementById('gg-all'),mine=document.getElementById('gg-mine');
  all.innerHTML='<div class="loading"><span class="spinner"></span></div>';mine.innerHTML='';
  try{
    const gs=await api('/api/groups');
    all.innerHTML='';mine.innerHTML='';
    if(!gs||!gs.length){all.innerHTML='<div class="empty"><div class="ei">🏛️</div>No groups</div>';return;}
    gs.forEach(g=>{
      const c=mkGroupCard(g);all.appendChild(c);
      if(g.is_member||g.creator_id===me.id){const c2=mkGroupCard(g);mine.appendChild(c2);}
    });
    if(!mine.children.length)mine.innerHTML='<div class="empty"><div class="ei">👤</div>Not a member of any group</div>';
  }catch(e){all.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}
function mkGroupCard(g){
  const div=document.createElement('div');div.className='group-card';
  div.innerHTML=`<div class="group-icon">🏛️</div><div class="group-name">${esc(g.title||g.name||'Group #'+g.id)}</div><div class="group-desc">${esc(g.description||'')}</div><div style="margin-top:9px;display:flex;gap:5px">${g.is_member?'<span class="tag member">Member</span>':''}${g.creator_id===me.id?'<span class="tag owner">Owner</span>':''}</div>`;
  div.addEventListener('click',()=>openGroup(g.id));
  return div;
}
async function openGroup(gid){
  document.getElementById('g-list-view').classList.add('hidden');
  document.getElementById('g-detail-view').classList.remove('hidden');
  const el=document.getElementById('g-detail-content');
  el.innerHTML='<div class="loading"><span class="spinner"></span> Loading…</div>';
  try{
    const [g,members,events]=await Promise.all([
      api('/api/groups/detail?group_id='+gid),
      api('/api/groups/members?group_id='+gid),
      api('/api/groups/events?group_id='+gid),
    ]);
    const title=g.title||g.name||'Group #'+gid;
    const isMember=(members||[]).some(m=>m.user_id===me.id&&m.status==='accepted');
    const isOwner=g.creator_id===me.id;
    el.innerHTML=`
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:18px;flex-wrap:wrap">
        <div class="g-big-icon">🏛️</div>
        <div style="flex:1">
          <div style="font-size:19px;font-weight:800">${esc(title)}</div>
          <div style="color:var(--text-dim);font-size:13px;margin-top:2px">${esc(g.description||'')}</div>
          <div style="margin-top:7px;display:flex;gap:6px">${isMember?'<span class="tag member">Member</span>':''}${isOwner?'<span class="tag owner">Owner</span>':''}</div>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${!isMember&&!isOwner?`<button class="btn btn-primary btn-sm" id="join-g-btn">Join</button>`:''}
          ${isMember||isOwner?`<button class="btn btn-secondary btn-sm" id="g-chat-btn">💬 Chat</button>`:''}
          ${isOwner?`<button class="btn btn-primary btn-sm" id="new-evt-btn">+ Event</button>`:''}
        </div>
      </div>
      <div class="tabs">
        <button class="tab active" data-gi="gi-events">Events</button>
        <button class="tab" data-gi="gi-members">Members</button>
        ${isOwner?'<button class="tab" data-gi="gi-invite">Invite</button>':''}
      </div>
      <div class="tab-panel active" id="gi-events"><div id="evts-list"></div></div>
      <div class="tab-panel" id="gi-members"><div id="mems-list"></div></div>
      ${isOwner?'<div class="tab-panel" id="gi-invite"><div id="inv-list"></div></div>':''}`;

    el.querySelectorAll('.tab[data-gi]').forEach(t=>{
      t.addEventListener('click',()=>{
        el.querySelectorAll('.tab[data-gi]').forEach(x=>x.classList.remove('active'));
        t.classList.add('active');
        el.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===t.dataset.gi));
      });
    });

    const evEl=document.getElementById('evts-list');
    if(!events||!events.length)evEl.innerHTML='<div class="empty"><div class="ei">📅</div>No events</div>';
    else events.forEach(ev=>{
      const myR=(ev.responses||[]).find(r=>r.user_id===me.id);
      evEl.insertAdjacentHTML('beforeend',`
        <div class="event-card">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-desc">${esc(ev.description||'')}</div>
          <div class="event-meta">📅 ${fmtD(ev.event_date||ev.date)}</div>
          ${isMember||isOwner?`<div class="event-rsvp">
            <button class="btn btn-sm ${myR&&myR.status==='going'?'btn-primary':'btn-secondary'} rsvp-btn" data-eid="${ev.id}" data-opt="going">✅ Going</button>
            <button class="btn btn-sm ${myR&&myR.status==='not_going'?'btn-danger':'btn-secondary'} rsvp-btn" data-eid="${ev.id}" data-opt="not_going">❌ Not Going</button>
            <span style="font-size:12px;color:var(--text-dim)">${(ev.responses||[]).filter(r=>r.status==='going').length} going</span>
          </div>`:''}
        </div>`);
    });
    evEl.querySelectorAll('.rsvp-btn').forEach(b=>b.addEventListener('click',async()=>{
      try{await api('/api/groups/events/respond',{method:'POST',body:JSON.stringify({event_id:Number(b.dataset.eid),status:b.dataset.opt})});toast('RSVP updated');openGroup(gid);}
      catch(e){toast(e.message);}
    }));

    const memEl=document.getElementById('mems-list');
    (members||[]).filter(m=>m.status==='accepted').forEach(m=>{
      const u=users.find(x=>x.id===m.user_id)||{id:m.user_id,first_name:'User',last_name:''};
      memEl.insertAdjacentHTML('beforeend',`<div style="display:flex;align-items:center;gap:9px;padding:9px;background:var(--bg-mid);border-radius:9px;margin-bottom:7px"><div class="pav" style="width:32px;height:32px;font-size:11px">${inits(u)}</div><div style="flex:1">${esc(dname(u))}</div>${m.user_id===g.creator_id?'<span class="tag owner">Owner</span>':''}</div>`);
    });
    if(isOwner){
      const pending=(members||[]).filter(m=>m.status==='pending');
      if(pending.length){
        memEl.insertAdjacentHTML('beforeend','<div style="margin-top:13px;font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px">Pending Requests</div>');
        pending.forEach(m=>{
          const u=users.find(x=>x.id===m.user_id)||{id:m.user_id,first_name:'User',last_name:''};
          memEl.insertAdjacentHTML('beforeend',`<div style="display:flex;align-items:center;gap:9px;padding:9px;background:var(--bg-mid);border-radius:9px;margin-top:7px"><div class="pav" style="width:32px;height:32px;font-size:11px">${inits(u)}</div><div style="flex:1">${esc(dname(u))}</div><button class="btn btn-primary btn-sm acc-m" data-uid="${m.user_id}">Accept</button><button class="btn btn-danger btn-sm rej-m" data-uid="${m.user_id}">Reject</button></div>`);
        });
        memEl.querySelectorAll('.acc-m').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/groups/respond',{method:'POST',body:JSON.stringify({group_id:gid,user_id:Number(b.dataset.uid),accept:true})});openGroup(gid);}catch(e){toast(e.message);}}));
        memEl.querySelectorAll('.rej-m').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/groups/respond',{method:'POST',body:JSON.stringify({group_id:gid,user_id:Number(b.dataset.uid),accept:false})});openGroup(gid);}catch(e){toast(e.message);}}));
      }
    }

    if(isOwner){
      const invEl=document.getElementById('inv-list');
      users.filter(u=>u.id!==me.id&&!(members||[]).some(m=>m.user_id===u.id&&m.status==='accepted')).forEach(u=>{
        invEl.insertAdjacentHTML('beforeend',`<div style="display:flex;align-items:center;gap:9px;padding:9px;background:var(--bg-mid);border-radius:9px;margin-bottom:7px"><div class="pav" style="width:32px;height:32px;font-size:11px">${inits(u)}</div><div style="flex:1">${esc(dname(u))}</div><button class="btn btn-primary btn-sm inv-btn" data-uid="${u.id}">Invite</button></div>`);
      });
      invEl.querySelectorAll('.inv-btn').forEach(b=>b.addEventListener('click',async()=>{
        try{await api('/api/groups/invite',{method:'POST',body:JSON.stringify({group_id:gid,user_id:Number(b.dataset.uid)})});b.textContent='Invited';b.disabled=true;toast('Invited!');}
        catch(e){toast(e.message);}
      }));
    }

    const jBtn=document.getElementById('join-g-btn');
    if(jBtn)jBtn.addEventListener('click',async()=>{try{await api('/api/groups/join',{method:'POST',body:JSON.stringify({group_id:gid})});toast('Request sent');openGroup(gid);}catch(e){toast(e.message);}});
    const gcBtn=document.getElementById('g-chat-btn');
    if(gcBtn)gcBtn.addEventListener('click',()=>{gotoPage('chat');openGroupChat(gid,title);});
    const neBtn=document.getElementById('new-evt-btn');
    if(neBtn)neBtn.addEventListener('click',()=>{document.getElementById('ce-gid').value=gid;document.getElementById('ce-title').value='';document.getElementById('ce-desc').value='';document.getElementById('ce-date').value='';openM('m-ce');});
  }catch(e){el.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}

// Groups event listeners
document.getElementById('new-grp-btn').addEventListener('click',()=>{document.getElementById('cg-name').value='';document.getElementById('cg-desc').value='';openM('m-cg');});
document.getElementById('cg-submit').addEventListener('click',async()=>{
  const n=document.getElementById('cg-name').value.trim(),d=document.getElementById('cg-desc').value.trim();
  if(!n){toast('Enter group name');return;}
  try{await api('/api/groups',{method:'POST',body:JSON.stringify({title:n,description:d})});closeM('m-cg');toast('✅ Group created');loadGroups();}
  catch(e){toast(e.message);}
});
document.getElementById('ce-submit').addEventListener('click',async()=>{
  const gid=Number(document.getElementById('ce-gid').value);
  const t=document.getElementById('ce-title').value.trim(),d=document.getElementById('ce-desc').value.trim(),dt=document.getElementById('ce-date').value;
  if(!t||!dt){toast('Fill title and date');return;}
  try{await api('/api/groups/events',{method:'POST',body:JSON.stringify({group_id:gid,title:t,description:d,event_date:dt})});closeM('m-ce');toast('✅ Event created');openGroup(gid);}
  catch(e){toast(e.message);}
});
document.querySelectorAll('.tab[data-gt]').forEach(t=>{
  t.addEventListener('click',()=>{
    t.closest('.tabs').querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.querySelectorAll('#g-list-view .tab-panel').forEach(p=>p.classList.toggle('active',p.id===t.dataset.gt));
  });
});
document.getElementById('back-grp-btn').addEventListener('click',loadGroups);
