async function loadProfile(uid){
  const id=uid||me.id;const isMe=id===me.id;
  try{
    const p=await api('/api/profile?user_id='+id);
    const u=p.user||p;
    document.getElementById('p-name').textContent=dname(u);
    document.getElementById('p-nick').textContent=u.nickname?'@'+u.nickname:'';
    document.getElementById('p-bio').textContent=u.about_me||'';
    setAv(document.getElementById('p-big-av'),u);
    document.getElementById('st-posts').textContent=p.posts_count||0;
    document.getElementById('st-followers').textContent=(p.followers||[]).length;
    document.getElementById('st-following').textContent=(p.following||[]).length;
    document.getElementById('edit-p-btn').classList.toggle('hidden',!isMe);
    document.getElementById('priv-btn').classList.toggle('hidden',!isMe);
    const postsEl=document.getElementById('tp-posts');
    postsEl.innerHTML='';
    (p.posts||[]).forEach(post=>postsEl.appendChild(mkPost(post)));
    if(!(p.posts||[]).length)postsEl.innerHTML='<div class="empty"><div class="ei">📝</div>No posts</div>';
    const flEl=document.getElementById('tp-followers');flEl.innerHTML='';
    (p.followers||[]).forEach(f=>{
      const fu=users.find(x=>x.id===f.follower_id)||{id:f.follower_id,first_name:'User',last_name:''};
      flEl.insertAdjacentHTML('beforeend',`<div class="card" style="padding:11px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openUserModal(${fu.id})"><div class="pav" style="width:34px;height:34px;font-size:12px">${inits(fu)}</div><div>${esc(dname(fu))}</div></div>`);
    });
    const fgEl=document.getElementById('tp-following');fgEl.innerHTML='';
    (p.following||[]).forEach(f=>{
      const fu=users.find(x=>x.id===f.followed_id)||{id:f.followed_id,first_name:'User',last_name:''};
      fgEl.insertAdjacentHTML('beforeend',`<div class="card" style="padding:11px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openUserModal(${fu.id})"><div class="pav" style="width:34px;height:34px;font-size:12px">${inits(fu)}</div><div>${esc(dname(fu))}</div></div>`);
    });
  }catch(e){toast('Profile error: '+e.message);}
}

// Profile event listeners
document.getElementById('edit-p-btn').addEventListener('click',()=>{
  document.getElementById('ep-fn').value=me.first_name||'';
  document.getElementById('ep-ln').value=me.last_name||'';
  document.getElementById('ep-nick').value=me.nickname||'';
  document.getElementById('ep-about').value=me.about_me||'';
  openM('m-edit-p');
});
document.getElementById('save-p-btn').addEventListener('click',async()=>{
  const btn=document.getElementById('save-p-btn');btn.disabled=true;btn.textContent='…';
  try{
    let av=null;
    const af=document.getElementById('ep-av-file').files[0];
    if(af){const fd=new FormData();fd.append('image',af);const r=await apiForm('/api/upload',fd);av=r.filename||r.url||null;}
    const body={first_name:document.getElementById('ep-fn').value.trim(),last_name:document.getElementById('ep-ln').value.trim(),nickname:document.getElementById('ep-nick').value.trim(),about_me:document.getElementById('ep-about').value.trim()};
    if(av)body.avatar=av;
    await api('/api/profile',{method:'PUT',body:JSON.stringify(body)});
    me=await api('/api/me');
    closeM('m-edit-p');toast('✅ Profile updated');
    setAv(document.getElementById('tb-av'),me);
    document.getElementById('tb-name').textContent=dname(me);
    loadProfile();
  }catch(e){toast(e.message);}
  finally{btn.disabled=false;btn.textContent='Save';}
});
document.getElementById('priv-btn').addEventListener('click',async()=>{
  try{await api('/api/profile/privacy',{method:'PUT'});me=await api('/api/me');toast('Privacy updated');loadProfile();}
  catch(e){toast(e.message);}
});
document.querySelectorAll('.tab[data-tp]').forEach(t=>{
  t.addEventListener('click',()=>{
    t.closest('.tabs').querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const id=t.dataset.tp;
    document.querySelectorAll('#page-profile .tab-panel').forEach(p=>p.classList.toggle('active',p.id===id));
  });
});
