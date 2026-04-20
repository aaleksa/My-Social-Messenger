async function loadPeople(filter=''){
  const g=document.getElementById('people-grid');
  g.innerHTML='<div class="loading"><span class="spinner"></span></div>';
  try{users=await api('/api/users');renderPeople(filter);}
  catch(e){g.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}
function renderPeople(filter=''){
  const g=document.getElementById('people-grid');
  const q=filter.toLowerCase();
  const list=users.filter(u=>u.id!==me.id&&dname(u).toLowerCase().includes(q));
  g.innerHTML='';
  if(!list.length){g.innerHTML='<div class="empty"><div class="ei">🔍</div>No users found</div>';return;}
  list.forEach(u=>{
    const s=avSrc(u);const avHtml=s?`<img src="${s}" alt=""/>`:(inits(u));
    const on=onlineIDs.has(u.id);
    const fl=u.follow_status==='accepted'?'Following':u.follow_status==='pending'?'Pending':'Follow';
    const fc=u.follow_status==='accepted'?'btn-secondary':u.follow_status==='pending'?'btn-secondary':'btn-primary';
    const card=document.createElement('div');card.className='people-card';
    card.innerHTML=`
      <div class="people-av">${avHtml}</div>
      <div class="people-name">${esc(dname(u))}</div>
      <div class="people-nick">${u.nickname?'@'+esc(u.nickname):''}</div>
      <div style="margin-bottom:10px"><span class="tag ${on?'accepted':''}">${on?'Online':'Offline'}</span></div>
      <div style="display:flex;gap:6px;justify-content:center">
        <button class="btn btn-secondary btn-sm view-btn">View</button>
        <button class="btn ${fc} btn-sm fl-btn" data-status="${u.follow_status||''}">${esc(fl)}</button>
      </div>`;
    card.querySelector('.view-btn').addEventListener('click',()=>openUserModal(u.id));
    card.querySelector('.fl-btn').addEventListener('click',async function(){
      const st=this.dataset.status;this.disabled=true;
      try{
        if(st==='accepted'){await api('/api/follow?followed_id='+u.id,{method:'DELETE'});toast('Unfollowed');}
        else if(!st||st==='rejected'){await api('/api/follow',{method:'POST',body:JSON.stringify({followed_id:u.id})});toast('Request sent');}
        loadPeople(document.getElementById('ppl-srch').value);
      }catch(e){toast(e.message);this.disabled=false;}
    });
    g.appendChild(card);
  });
}
document.getElementById('ppl-srch').addEventListener('input',e=>renderPeople(e.target.value));

async function openUserModal(uid){
  const el=document.getElementById('m-user-body');
  el.innerHTML='<div class="loading"><span class="spinner"></span></div>';
  openM('m-user');
  try{
    const p=await api('/api/profile?user_id='+uid);
    const u=p.user||p;
    const s=avSrc(u);
    el.innerHTML=`
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:15px">
        <div class="people-av" style="width:58px;height:58px;font-size:21px">${s?`<img src="${s}" alt=""/>`:(inits(u))}</div>
        <div>
          <div style="font-size:18px;font-weight:800">${esc(dname(u))}</div>
          <div style="color:var(--text-dim);font-size:13px">${u.nickname?'@'+esc(u.nickname):''}</div>
        </div>
      </div>
      ${u.about_me?`<div style="font-size:13px;color:var(--text-dim);margin-bottom:13px">${esc(u.about_me)}</div>`:''}
      <div style="display:flex;gap:18px;margin-bottom:15px">
        <div class="p-stat"><div class="p-stat-num">${p.posts_count||0}</div><div class="p-stat-lbl">Posts</div></div>
        <div class="p-stat"><div class="p-stat-num">${(p.followers||[]).length}</div><div class="p-stat-lbl">Followers</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="um-msg">💬 Message</button>
      </div>
      <div style="margin-top:15px;font-weight:700;font-size:13px">Recent Posts</div>
      <div id="um-posts" style="margin-top:9px"></div>`;
    document.getElementById('um-msg').addEventListener('click',()=>{
      closeM('m-user');gotoPage('chat');
      const t=users.find(x=>x.id===uid);if(t)openDM(t);
    });
    const pe=document.getElementById('um-posts');
    (p.posts||[]).slice(0,4).forEach(post=>pe.appendChild(mkPost(post)));
    if(!(p.posts||[]).length)pe.innerHTML='<div style="color:var(--text-dim);font-size:13px">No posts</div>';
  }catch(e){el.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}
