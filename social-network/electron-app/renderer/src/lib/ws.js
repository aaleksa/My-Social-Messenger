import { WS_URL, dname } from './api.js'

export function connectWS(store) {
  const tok = store.getState().tok
  const url = `${WS_URL}?client=electron${tok ? '&session_id=' + encodeURIComponent(tok) : ''}`
  const ws  = new WebSocket(url)

  ws.onopen  = () => store.getState().setWsOn(true)
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
      if (s.activeChatID !== msg.sender_id) s.addUnread(msg.sender_id)
      if (window.electronAPI) {
        const sender = s.users.find(u => u.id === msg.sender_id)
        window.electronAPI.notify(dname(sender || {}), msg.content)
      }
      break
    }
    case 'group_message':
      s.pushMsg('g:' + msg.group_id, msg)
      break
    case 'notification':
      s.incNotif()
      s.showToast('🔔 ' + (msg.content || 'New notification'))
      break
    default:
      break
  }
}
