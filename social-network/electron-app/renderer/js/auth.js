async function doLogin(){
  const email=document.getElementById('lei').value.trim();
  const pw=document.getElementById('lpw').value;
  const err=document.getElementById('login-err'),btn=document.getElementById('login-btn');
  err.textContent='';
  if(!email||!pw){err.textContent='Fill all fields.';return;}
  btn.disabled=true;btn.textContent='…';
  try{
    const d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password:pw})});
    if(d.session_id){tok=d.session_id;localStorage.setItem('sn_tok',tok);}
    me=await api('/api/me');
    if(window.electronAPI)await window.electronAPI.saveSession({userId:me.id,email:me.email});
    await startApp();
  }catch(e){err.textContent=e.message;}
  finally{btn.disabled=false;btn.textContent='Sign In';}
}
async function doLogout(){
  try{await api('/api/auth/logout',{method:'POST'});}catch(_){}
  tok='';localStorage.removeItem('sn_tok');
  if(window.electronAPI)await window.electronAPI.clearSession();
  me=null;if(ws){ws.close();ws=null;}
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('lei').value='';document.getElementById('lpw').value='';
}
