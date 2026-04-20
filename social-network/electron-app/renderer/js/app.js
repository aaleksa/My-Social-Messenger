function openM(id){document.getElementById(id).classList.remove('hidden');}
function closeM(id){document.getElementById(id).classList.add('hidden');}

function gotoPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.toggle('active',n.dataset.page===name));
  const pg=document.getElementById('page-'+name);if(pg)pg.classList.add('active');
  if(name==='feed')loadFeed();
  if(name==='profile')loadProfile();
  if(name==='people')loadPeople();
  if(name==='groups')loadGroups();
  if(name==='notifications')loadNotifs();
  if(name==='chat')reChatList();
}

async function startApp(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setAv(document.getElementById('tb-av'),me);
  document.getElementById('tb-name').textContent=dname(me);
  try{users=await api('/api/users');}catch(_){users=[];}
  buildChatLayout();reChatList();connectWS();
  gotoPage('feed');
  setInterval(async()=>{try{const u=await api('/api/users');if(u)users=u;reChatList();}catch(_){}},60000);
  setInterval(()=>{if(wsOn)refreshOnline();},30000);
}

// Nav
document.querySelectorAll('.ni').forEach(n=>n.addEventListener('click',()=>gotoPage(n.dataset.page)));

// Modals
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeM(b.dataset.close)));
document.querySelectorAll('.modal-backdrop').forEach(bd=>bd.addEventListener('click',e=>{if(e.target===bd)bd.classList.add('hidden');}));

// Boot listeners
document.getElementById('login-btn').addEventListener('click',doLogin);
document.getElementById('lpw').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('tog-pw').addEventListener('click',function(){
  const i=document.getElementById('lpw');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈';
});
document.getElementById('reg-btn').addEventListener('click',()=>{
  if(window.electronAPI)window.electronAPI.openRegister();else window.open('http://localhost:3000/register');
});
document.getElementById('logout-btn').addEventListener('click',doLogout);
document.getElementById('tb-user-btn').addEventListener('click',()=>gotoPage('profile'));
document.getElementById('tb-search').addEventListener('input',e=>{
  const q=e.target.value.trim();if(!q)return;
  gotoPage('people');document.getElementById('ppl-srch').value=q;renderPeople(q);
});

// Auto-login
(async()=>{
  try{const u=await api('/api/me');if(u&&u.id){me=u;await startApp();return;}}catch(_){}
  document.getElementById('login-screen').classList.remove('hidden');
})();
