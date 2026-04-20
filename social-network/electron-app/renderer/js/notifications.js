async function loadNotifs(){
  const el=document.getElementById('notif-list');
  el.innerHTML='<div class="loading"><span class="spinner"></span></div>';
  notifCnt=0;updBadge();
  try{
    const ns=await api('/api/notifications');
    el.innerHTML='';
    if(!ns||!ns.length){el.innerHTML='<div class="empty"><div class="ei">🔔</div>No notifications</div>';return;}
    ns.forEach(n=>{
      const icon=n.type==='follow_request'?'👤':n.type==='follow_accepted'?'✅':n.type==='group_invite'?'🏛️':n.type==='event'?'📅':'🔔';
      const div=document.createElement('div');div.className='notif-item '+(n.is_read?'':'unread');
      div.innerHTML=`<div class="notif-icon-big">${icon}</div><div class="notif-text">${esc(n.content||n.message||'')}<div class="notif-time">${fmtD(n.created_at)}</div></div>${!n.is_read?`<button class="btn btn-secondary btn-sm mr-btn" data-id="${n.id}">✓</button>`:''}${n.type==='follow_request'?`<button class="btn btn-primary btn-sm acc-fl" data-uid="${n.actor_id||n.from_user_id}">Accept</button><button class="btn btn-danger btn-sm rej-fl" data-uid="${n.actor_id||n.from_user_id}">Decline</button>`:''}`;
      div.querySelectorAll('.mr-btn').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/notifications',{method:'PUT',body:JSON.stringify({id:Number(b.dataset.id)})});loadNotifs();}catch(e){toast(e.message);}}));
      div.querySelectorAll('.acc-fl').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/follow/respond',{method:'POST',body:JSON.stringify({follower_id:Number(b.dataset.uid),accept:true})});toast('Accepted');loadNotifs();}catch(e){toast(e.message);}}));
      div.querySelectorAll('.rej-fl').forEach(b=>b.addEventListener('click',async()=>{try{await api('/api/follow/respond',{method:'POST',body:JSON.stringify({follower_id:Number(b.dataset.uid),accept:false})});toast('Declined');loadNotifs();}catch(e){toast(e.message);}}));
      el.appendChild(div);
    });
  }catch(e){el.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}
document.getElementById('mark-all-btn').addEventListener('click',async()=>{
  try{await api('/api/notifications',{method:'PUT',body:JSON.stringify({all:true})});loadNotifs();}catch(e){toast(e.message);}
});
document.getElementById('notif-btn').addEventListener('click',()=>gotoPage('notifications'));
function updBadge(){
  const b=document.getElementById('notif-badge');
  if(notifCnt>0){b.textContent=notifCnt>9?'9+':notifCnt;b.style.display='block';}else b.style.display='none';
}
