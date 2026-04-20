import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, fmt } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function ChatWindow() {
  const { tok, me, users, activeChatID, ws, cachedMsgs, setCachedMsgs, pushMsg, onlineIDs } = useStore()
  const [text, setText] = useState('')
  const msgsRef = useRef()

  const partner = users.find(u => u.id === activeChatID)
  const msgs = cachedMsgs[activeChatID] || []

  useEffect(() => {
    if (!activeChatID) return
    if (cachedMsgs[activeChatID]) return
    apiFetch(tok, `/api/messages?recipient_id=${activeChatID}`)
      .then(data => setCachedMsgs(activeChatID, data || []))
      .catch(() => {})
  }, [activeChatID])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  function send() {
    if (!text.trim() || !ws || ws.readyState !== WebSocket.OPEN) return
    const msg = { type: 'chat_message', receiver_id: activeChatID, content: text }
    ws.send(JSON.stringify(msg))
    pushMsg(activeChatID, { ...msg, sender_id: me.id, created_at: new Date().toISOString() })
    setText('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!activeChatID) {
    return (
      <div className="chat-win">
        <div className="chat-no">
          <i className="bi bi-chat-dots" style={{ fontSize: 50 }} />
          <p>Select a conversation</p>
        </div>
      </div>
    )
  }

  const isOnline = onlineIDs.has(activeChatID)

  return (
    <div className="chat-win">
      <div className="cwh">
        <Avatar user={partner} size={35} className="cwp-av" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{dname(partner)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{isOnline ? '🟢 Online' : 'Offline'}</div>
        </div>
      </div>
      <div className="msgs" ref={msgsRef}>
        {msgs.map((m, i) => {
          const mine = m.sender_id === me?.id
          return (
            <div key={i} className={`mr ${mine ? 'mine' : 'theirs'}`}>
              <div>
                <div className="mb">{m.content}</div>
                <div className="mt">{fmt(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="chat-inp-bar">
        <textarea
          className="chat-ta"
          rows={1}
          placeholder="Type a message…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="chat-send" onClick={send} disabled={!text.trim()}>
          <i className="bi bi-send" />
        </button>
      </div>
    </div>
  )
}
