import { WS_URL, API, dname, apiFetch } from './api.js'

export function connectWS(store) {
  const tok = store.getState().tok
  const url = `${WS_URL}?client=electron${tok ? '&session_id=' + encodeURIComponent(tok) : ''}`
  const ws  = new WebSocket(url)

  ws.onopen  = () => {
    store.getState().setWsOn(true)
    // Fetch current online users immediately so we don't miss already-connected users
    fetchOnlineUsers(store)
  }
  ws.onclose = () => {
    store.getState().setWsOn(false)
    if (store.getState().me) setTimeout(() => connectWS(store), 5000)
  }
  ws.onerror = () => ws.close()
  ws.onmessage = e => {
    try { handleMsg(JSON.parse(e.data), store) } catch (_) {}
  }

  store.getState().setWs(ws)
}

function handleMsg(msg, store) {
  const s = store.getState()
  switch (msg.type) {
    case 'presence_online':
      s.addOnline(msg.sender_id)
      break
    case 'presence_offline':
      s.removeOnline(msg.sender_id)
      break
    case 'chat_message': {
      s.pushMsg(msg.sender_id, msg)
      if (s.activeChatID !== msg.sender_id) {
        s.addUnread(msg.sender_id)
        const sender = s.users.find(u => u.id === msg.sender_id)
        const preview = msg.content?.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content
        s.showToast(`💬 ${dname(sender || {})} — ${preview}`)
        if (window.electronAPI) window.electronAPI.notify(dname(sender || {}), msg.content)
      }
      break
    }
    case 'group_message': {
      const gkey = 'g:' + msg.group_id
      s.pushMsg(gkey, msg)
      if (s.activeChatID !== gkey) {
        s.addUnreadGroup(gkey)
        const preview = (msg.content || '').length > 60 ? msg.content.slice(0, 60) + '…' : (msg.content || '')
        const grp = s.groups.find(g => g.id === msg.group_id)
        s.showToast(`💬 [${grp ? grp.title : 'Group'}] — ${preview}`)
      }
      break
    }
    case 'notification':
      s.incNotif()
      s.showToast('🔔 ' + (msg.content || 'New notification'))
      s.bumpFeed()
      break
    case 'typing': {
      const tkey = msg.group_id ? ('g:' + msg.group_id) : msg.sender_id
      s.setTyping(tkey)
      setTimeout(() => s.clearTyping(tkey), 3000)
      break
    }
    default:
      break
  }
}

async function fetchOnlineUsers(store) {
  try {
    const tok = store.getState().tok
    const list = await apiFetch(tok, '/api/online-users')
    if (Array.isArray(list)) {
      store.getState().setOnlineIDs(list.map(u => u.id))
    }
  } catch (_) {}
}
