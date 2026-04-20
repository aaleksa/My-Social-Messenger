async function loadFeed(){
  const el=document.getElementById('feed-list');
  el.innerHTML='<div class="loading"><span class="spinner"></span> Loading…</div>';
  setAv(document.getElementById('feed-av'),me);
  try{
    const posts=await api('/api/posts');
    el.innerHTML='';
    if(!posts||!posts.length){el.innerHTML='<div class="empty"><div class="ei">📭</div>No posts yet</div>';return;}
    posts.forEach(p=>el.appendChild(mkPost(p)));
  }catch(e){el.innerHTML=`<div class="empty">Error: ${esc(e.message)}</div>`;}
}
function mkPost(p){
  const au=users.find(u=>u.id===p.user_id)||{id:p.user_id,first_name:'User',last_name:'#'+p.user_id};
  const s=avSrc(au);
  const avHtml=s?`<img src="${s}" style="width:38px;height:38px;border-radius:50%;object-fit:cover" alt=""/>`:`<div class="pav">${inits(au)}</div>`;
  const imgHtml=p.image?`<img class="post-img" src="${API}/uploads/${esc(p.image)}" alt=""/>`:'';
  const div=document.createElement('div');
  div.className='post-card';
  div.innerHTML=`
    <div class="post-head">${avHtml}
      <div class="post-meta">
        <div class="post-author" data-uid="${p.user_id}">${esc(dname(au))}</div>
        <div class="post-time">${fmtD(p.created_at)}</div>
      </div>
    </div>
    ${imgHtml}
    <div class="post-body">${esc(p.content||'')}</div>
    <div class="post-foot">
      <button class="post-btn tc-btn">💬 Comments</button>
      ${p.user_id===me.id?`<button class="post-btn del-post-btn" data-id="${p.id}" style="margin-left:auto;color:var(--offline)">🗑</button>`:''}
    </div>
    <div class="comments-sec hidden">
      <div class="comments-body"></div>
      <div class="cin-row">
        <input class="cin" type="text" placeholder="Write a comment…"/>
        <button class="btn btn-primary btn-sm send-c-btn">Send</button>
      </div>
    </div>`;
  div.querySelector('.post-author').addEventListener('click',()=>openUserModal(p.user_id));
  div.querySelector('.tc-btn').addEventListener('click',function(){
    const sec=div.querySelector('.comments-sec');
    const open=!sec.classList.contains('hidden');
    sec.classList.toggle('hidden',open);
    if(!open)loadComments(p.id,div.querySelector('.comments-body'));
  });
  div.querySelector('.send-c-btn').addEventListener('click',async()=>{
    const inp=div.querySelector('.cin');const txt=inp.value.trim();if(!txt)return;
    try{await api('/api/posts/comment',{method:'POST',body:JSON.stringify({post_id:p.id,content:txt})});inp.value='';loadComments(p.id,div.querySelector('.comments-body'));}
    catch(e){toast(e.message);}
  });
  div.querySelector('.cin').addEventListener('keydown',e=>{if(e.key==='Enter')div.querySelector('.send-c-btn').click();});
  const db=div.querySelector('.del-post-btn');
  if(db)db.addEventListener('click',async()=>{
    if(!confirm('Delete post?'))return;
    try{await api('/api/posts?id='+p.id,{method:'DELETE'});div.remove();toast('Deleted');}
    catch(e){toast(e.message);}
  });
  return div;
}
async function loadComments(postId,el){
  el.innerHTML='<div style="color:var(--text-dim);font-size:12px;padding:4px">Loading…</div>';
  try{
    const cs=await api('/api/posts/comment?post_id='+postId);
    el.innerHTML='';
    if(!cs||!cs.length){el.innerHTML='<div style="color:var(--text-dim);font-size:12px;padding:4px">No comments</div>';return;}
    cs.forEach(c=>{
      const u=users.find(x=>x.id===c.user_id)||{id:c.user_id,first_name:'User',last_name:''};
      el.insertAdjacentHTML('beforeend',`<div class="comment"><div class="comment-bubble"><div class="comment-author">${esc(dname(u))}</div><div class="comment-text">${esc(c.content)}</div></div></div>`);
    });
  }catch(_){}
}

// Feed event listeners
document.getElementById('post-submit').addEventListener('click',async()=>{
  const content=document.getElementById('post-inp').value.trim();
  const vis=document.getElementById('post-vis').value;
  const btn=document.getElementById('post-submit');
  if(!content&&!postFile){toast('Write something or attach photo');return;}
  btn.disabled=true;btn.textContent='…';
  try{
    let img=null;
    if(postFile){const fd=new FormData();fd.append('image',postFile);const r=await apiForm('/api/upload',fd);img=r.filename||r.url||null;}
    await api('/api/posts',{method:'POST',body:JSON.stringify({content,visibility:vis,image:img})});
    document.getElementById('post-inp').value='';
    postFile=null;
    document.getElementById('post-img-prev').classList.add('hidden');
    document.getElementById('prev-img').src='';
    document.getElementById('post-file').value='';
    toast('✅ Posted!');loadFeed();
  }catch(e){toast(e.message);}
  finally{btn.disabled=false;btn.textContent='Post';}
});
document.getElementById('attach-btn').addEventListener('click',()=>document.getElementById('post-file').click());
document.getElementById('post-file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  postFile=f;
  document.getElementById('prev-img').src=URL.createObjectURL(f);
  document.getElementById('post-img-prev').classList.remove('hidden');
});
document.getElementById('rm-img-btn').addEventListener('click',()=>{
  postFile=null;
  document.getElementById('post-img-prev').classList.add('hidden');
  document.getElementById('prev-img').src='';
  document.getElementById('post-file').value='';
});
