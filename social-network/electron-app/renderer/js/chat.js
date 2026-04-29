function buildChatLayout(){
  const p=document.getElementById('page-chat');
  p.innerHTML=`
    <div class="chat-sb">
      <div class="chat-sb-head">Conversations</div>
      <input class="chat-srch" id="chat-srch" type="text" placeholder="🔍 Search…" autocomplete="off"/>
      <div class="chat-list" id="chat-list"></div>
    </div>
    <div class="chat-win" id="chat-win">
      <div class="chat-no" id="chat-no"><div class="bi">💬</div><div>Select a contact</div></div>
      <div id="chat-active" class="hidden" style="display:flex;flex-direction:column;height:100%">
        <div class="cwh">
          <div id="cwp-av">?</div>
          <div><div id="cwp-name">…</div><div id="cwp-status">…</div></div>
        </div>
        <div id="msgs"></div>
        <div class="chat-inp-bar">
          <textarea id="chat-ta" placeholder="Type a message…" rows="1"></textarea>
          <button id="chat-send">➤</button>
        </div>
      </div>
    </div>`;
  document.getElementById('chat-srch').addEventListener('input',e=>reChatList(e.target.value));
  document.getElementById('chat-send').addEventListener('click',sendMsg);
  document.getElementById('chat-ta').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}});
  document.getElementById('chat-ta').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,110)+'px';});
}
function reChatList(filter=''){
  const el=document.getElementById('chat-list');if(!el)return;
  const q=filter.toLowerCase();
  el.innerHTML='';
  users.filter(u=>u.id!==me.id&&dname(u).toLowerCase().includes(q)).forEach(u=>{
    const on=onlineIDs.has(u.id),unread=unreadDM[u.id]||0;
    const item=document.createElement('div');
    item.className='chat-item'+(activeChatID===u.id?' active':'');
    const s=avSrc(u);
    item.innerHTML=`<div class="ci-av">${s?`<img src="${s}" alt=""/>`:inits(u)}<span class="pdot ${on?'on':''}" data-uid="${u.id}"></span></div><div class="ci-info"><div class="ci-name">${esc(dname(u))}</div><div class="ci-last">${on?'🟢 Online':'⚫ Offline'}</div></div>${unread?`<span class="ubadge">${unread}</span>`:''}`;
    item.addEventListener('click',()=>openDM(u));
    el.appendChild(item);
  });
}
async function openDM(partner){
  activeChatID=partner.id;unreadDM[partner.id]=0;
  reChatList(document.getElementById('chat-srch')?.value||'');
  showChatWin();
  const s=avSrc(partner);
  const av=document.getElementById('cwp-av');
  if(s)av.innerHTML=`<img src="${s}" alt=""/>`;else av.textContent=inits(partner);
  document.getElementById('cwp-name').textContent=dname(partner);
  document.getElementById('cwp-status').textContent=onlineIDs.has(partner.id)?'🟢 Online':'⚫ Offline';
  const msgEl=document.getElementById('msgs');
  msgEl.innerHTML='<div style="color:var(--text-dim);text-align:center;font-size:13px;padding:18px">Loading…</div>';
  try{const ms=await api('/api/messages?recipient_id='+partner.id);cachedMsgs[partner.id]=ms||[];}catch(_){}
  msgEl.innerHTML='';
  const ms=cachedMsgs[partner.id]||[];
  if(!ms.length)msgEl.innerHTML='<div style="color:var(--text-dim);text-align:center;font-size:13px;padding:18px">No messages yet 👋</div>';
  else ms.forEach(m=>appendMsg(m,false));
  scrollMsgs();
}
function openGroupChat(gid,groupName){
  activeChatID='g:'+gid;
  showChatWin();
  const av=document.getElementById('cwp-av');av.textContent='🏛️';
  document.getElementById('cwp-name').textContent=groupName;
  document.getElementById('cwp-status').textContent='Group Chat';
  const msgEl=document.getElementById('msgs');
  msgEl.innerHTML='<div style="color:var(--text-dim);text-align:center;font-size:13px;padding:18px">Loading…</div>';
  api('/api/messages/group?group_id='+gid).then(ms=>{
    cachedMsgs['g:'+gid]=ms||[];msgEl.innerHTML='';
    if(!ms||!ms.length)msgEl.innerHTML='<div style="color:var(--text-dim);text-align:center;font-size:13px;padding:18px">No messages yet</div>';
    else ms.forEach(m=>appendMsg(m,false));scrollMsgs();
  }).catch(_=>{msgEl.innerHTML='';});
}
function showChatWin(){
  document.getElementById('chat-no').classList.add('hidden');
  const a=document.getElementById('chat-active');a.classList.remove('hidden');a.style.display='flex';
}
function appendMsg(msg,scroll=true){
  const area=document.getElementById('msgs');if(!area)return;
  const isMine=msg.sender_id===me.id;
  const au=isMine?null:users.find(u=>u.id===msg.sender_id);

  // --- Emoji reactions ---
  const EMOJIS = ["👍","❤️","😂","😮","😢","👎","😀","😍","😆","😡","🎉","🙏","🔥","👏","😱","😅"];
  const reactDiv = document.createElement('div');
  reactDiv.className = 'msg-reactions';
  reactDiv.style.display = 'flex';
  reactDiv.style.gap = '4px';
  reactDiv.style.marginTop = '2px';
  // Render reactions
  const reactions = msg.reactions || {};
  EMOJIS.forEach(emoji => {
    const count = reactions[emoji] || 0;
    if (count > 0 || (msg.my_reaction === emoji)) {
      const btn = document.createElement('button');
      btn.textContent = emoji + (count > 0 ? ' ' + count : '');
      btn.style.border = 'none';
      btn.style.background = '#eee';
      btn.style.borderRadius = '8px';
      btn.style.padding = '2px 7px';
      btn.style.fontSize = '15px';
      btn.style.cursor = 'pointer';
      btn.style.opacity = (msg.my_reaction === emoji) ? '1' : '0.7';
      btn.onclick = async (e) => {
        e.stopPropagation();
        // Show popup with users for this emoji
        const popup = document.createElement('div');
        popup.style.position = 'absolute';
        popup.style.background = '#fff';
        popup.style.border = '1px solid #ccc';
        popup.style.borderRadius = '8px';
        popup.style.padding = '8px';
        popup.style.zIndex = '9999';
        popup.style.fontSize = '14px';
        popup.textContent = 'Loading...';
        document.body.appendChild(popup);
        const rect = btn.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + window.scrollY) + 'px';
        try {
          const users = await api(`/api/messages/${msg.id}/reactions?emoji=${encodeURIComponent(emoji)}`);
          popup.innerHTML = `<b>${emoji}</b> reacted:<br>` + users.map(u => esc(dname(u))).join('<br>');
        } catch { popup.textContent = 'Failed to load'; }
        setTimeout(() => {
          document.addEventListener('click', function handler(ev){
            if (!popup.contains(ev.target)) { popup.remove(); document.removeEventListener('click', handler); }
          });
        }, 50);
      };
      reactDiv.appendChild(btn);
    }
  });
  // Add + button for new reaction
  const addBtn = document.createElement('button');
  addBtn.textContent = '➕';
  addBtn.style.border = 'none';
  addBtn.style.background = '#eee';
  addBtn.style.borderRadius = '8px';
  addBtn.style.padding = '2px 7px';
  addBtn.style.fontSize = '15px';
  addBtn.style.cursor = 'pointer';
  addBtn.onclick = (e) => {
    e.stopPropagation();
    const menu = document.createElement('div');
    menu.style.position = 'absolute';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.borderRadius = '8px';
    menu.style.padding = '4px';
    menu.style.zIndex = '9999';
    menu.style.display = 'grid';
    menu.style.gridTemplateColumns = 'repeat(8,1fr)';
    menu.style.gap = '2px';
    EMOJIS.forEach(em => {
      const btn2 = document.createElement('button');
      btn2.textContent = em;
      btn2.style.fontSize = '18px';
      btn2.style.background = 'none';
      btn2.style.border = 'none';
      btn2.style.cursor = 'pointer';
      btn2.onclick = async () => {
        try {
          await api(`/api/messages/${msg.id}/react`, {method:'POST', body:JSON.stringify({emoji: em})});
          // Optionally reload message reactions here
        } catch {}
        document.body.removeChild(menu);
      };
      menu.appendChild(btn2);
    });
    const rect = addBtn.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + window.scrollY) + 'px';
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', function handler(ev){
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', handler); }
      });
    }, 50);
  };
  reactDiv.appendChild(addBtn);

  const row=document.createElement('div');row.className='mr '+(isMine?'mine':'theirs');
  row.innerHTML=`<div>${(!isMine&&au)?`<div style="font-size:11px;color:var(--text-dim);margin-bottom:1px">${esc(dname(au))}</div>`:''}<div class="mb">${esc(msg.content)}</div><div class="mt">${fmt(msg.created_at)}</div></div>`;
  row.appendChild(reactDiv);
  area.appendChild(row);if(scroll)scrollMsgs();
}
function scrollMsgs(){const el=document.getElementById('msgs');if(el)el.scrollTop=el.scrollHeight;}
async function sendMsg(){
  const ta=document.getElementById('chat-ta');
  const content=ta.value.trim();if(!content||!activeChatID)return;
  const btn=document.getElementById('chat-send');btn.disabled=true;
  ta.value='';ta.style.height='auto';
  appendMsg({sender_id:me.id,content,created_at:new Date().toISOString()},true);
  try{
    if(typeof activeChatID==='string'&&activeChatID.startsWith('g:')){
      await api('/api/messages/group',{method:'POST',body:JSON.stringify({group_id:Number(activeChatID.slice(2)),content})});
    }else{
      await api('/api/messages',{method:'POST',body:JSON.stringify({recipient_id:activeChatID,content})});
    }
  }catch(e){toast('Failed: '+e.message);}
  finally{btn.disabled=false;}
}
