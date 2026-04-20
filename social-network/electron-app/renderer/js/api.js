'use strict';
const API    = 'http://localhost:8081';
const WS_URL = 'ws://localhost:8081/api/ws';

let me = null, tok = localStorage.getItem('sn_tok')||'';
let ws = null, wsOn = false;
let onlineIDs = new Set(), onlineTypes = {};
let users = [], unreadDM = {}, cachedMsgs = {};
let activeChatID = null, postFile = null, notifCnt = 0;

const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const dname = u => u?(u.nickname||`${u.first_name||''} ${u.last_name||''}`.trim()||u.email||'User '+u.id):'Unknown';
const inits = u => dname(u).slice(0,2).toUpperCase();
const fmt  = ts => ts?new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
const fmtD = ts => ts?new Date(ts).toLocaleDateString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const avSrc= u => u&&u.avatar?`${API}/uploads/${u.avatar}`:null;

let _tt;
function toast(msg,dur=3000){
  const el=document.getElementById('toast');
  el.textContent=msg;el.classList.remove('hidden');el.style.opacity='1';
  clearTimeout(_tt);_tt=setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.classList.add('hidden'),300);},dur);
}
function setAv(el,u){
  const s=avSrc(u);
  if(s) el.innerHTML=`<img src="${s}" alt=""/>`;
  else el.textContent=inits(u);
}

function hdrs(x={}){const h={'Content-Type':'application/json',...x};if(tok)h['X-Session-ID']=tok;return h;}
function fo(o={}){return{credentials:'include',...o,headers:hdrs(o.headers)};}
async function api(p,o={}){
  const r=await fetch(API+p,fo(o));
  if(!r.ok){const t=await r.text();throw new Error(t||r.statusText);}
  const ct=r.headers.get('content-type')||'';
  return ct.includes('json')?r.json():r.text();
}
async function apiForm(p,fd){
  const h={};if(tok)h['X-Session-ID']=tok;
  const r=await fetch(API+p,{method:'POST',credentials:'include',headers:h,body:fd});
  if(!r.ok){const t=await r.text();throw new Error(t||r.statusText);}
  return r.json();
}
