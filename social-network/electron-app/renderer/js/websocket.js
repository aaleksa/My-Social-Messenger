function connectWS(){
  if(ws){try{ws.close();}catch(_){}}
  const url=`${WS_URL}?client=electron${tok?'&session_id='+encodeURIComponent(tok):''}`;
  ws=new WebSocket(url);
  ws.onopen=()=>{wsOn=true;setDot(true);refreshOnline();};
  ws.onclose=()=>{wsOn=false;setDot(false);if(me)setTimeout(()=>{if(!wsOn)connectWS();},5000);};
  ws.onerror=()=>ws.close();
  ws.onmessage=e=>{try{handleWS(JSON.parse(e.data));}catch(_){}};
}
function setDot(on){document.getElementById('conn-dot').className=on?'on':'';}
function handleWS(msg){
  if(msg.type==='presence_online'){onlineIDs.add(msg.sender_id);onlineTypes[msg.sender_id]=msg.client_type||'web';reChatList();}
  else if(msg.type==='presence_offline'){onlineIDs.delete(msg.sender_id);delete onlineTypes[msg.sender_id];reChatList();}
  else if(msg.type==='chat_message'){
    const pid=msg.sender_id;
    if(!cachedMsgs[pid])cachedMsgs[pid]=[];
    cachedMsgs[pid].push(msg);
    if(activeChatID===pid){appendMsg(msg,false);scrollMsgs();}
    else{unreadDM[pid]=(unreadDM[pid]||0)+1;reChatList();}
    const u=users.find(x=>x.id===pid);
    if(window.electronAPI)window.electronAPI.notify(dname(u||{id:pid}),msg.content);
  }
  else if(msg.type==='group_message'){
    const k='g:'+msg.group_id;
    if(!cachedMsgs[k])cachedMsgs[k]=[];
    cachedMsgs[k].push(msg);
    if(activeChatID===k){appendMsg(msg,false);scrollMsgs();}
  }
  else if(msg.type==='notification'){notifCnt++;updBadge();toast('🔔 '+(msg.content||'New notification'));}
}
async function refreshOnline(){
  try{
    const e=await api('/api/online-users');
    onlineIDs=new Set();onlineTypes={};
    (e||[]).forEach(x=>{const id=Number(x.id);onlineIDs.add(id);onlineTypes[id]=x.client_type||'web';});
    reChatList();
  }catch(_){}
}
