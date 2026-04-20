import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, fmt } from '../../lib/api'
import Avatar from '../ui/Avatar'
import { useOnline } from '../../hooks/useOnline'

const OFFLINE_MSG = 'You are offline. Check your internet connection.'

export default function ChatWindow() {
  const { tok, me, users, groups, activeChatID, ws, cachedMsgs, setCachedMsgs, pushMsg, onlineIDs } = useStore()
  const [text, setText] = useState('')
  const [sendErr, setSendErr] = useState('')
  const msgsRef = useRef()
  const online = useOnline()

  const isGroup = typeof activeChatID === 'string' && activeChatID.startsWith('g:')
  const groupID  = isGroup ? parseInt(activeChatID.slice(2)) : null
  const group   = isGroup ? groups.find(g => g.id === groupID) : null
  const partner = !isGroup ? users.find(u => u.id === activeChatID) : null
  const msgs = cachedMsgs[activeChatID] || []

  useEffect(() => {
    if (!activeChatID) return
    if (cachedMsgs[activeChatID]) return
    if (isGroup) {
      apiFetch(tok, `/api/messages/group?group_id=${groupID}`)
        .then(data => setCachedMsgs(activeChatID, (data || []).reverse()))
        .catch(() => {})
    } else {
      apiFetch(tok, `/api/messages?recipient_id=${activeChatID}`)
        .then(data => setCachedMsgs(activeChatID, data || []))
        .catch(() => {})
    }
  }, [activeChatID])

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight
  }, [msgs])

  function send() {
    if (!text.trim()) return
    if (!online) { setSendErr(OFFLINE_MSG); return }
    if (!ws || ws.readyState !== WebSocket.OPEN) { setSendErr(OFFLINE_MSG); return }
    setSendErr('')
    let msg
    if (isGroup) {
      msg = { type: 'group_message', group_id: groupID, content: text }
    } else {
      msg = { type: 'chat_message', receiver_id: activeChatID, content: text }
    }
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

  const isOnline = !isGroup && onlineIDs.has(activeChatID)

  return (
    <div className="chat-win">
      <div className="cwh">
        {isGroup ? (
          <div style={{
            width: 35, height: 35, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: 14, flexShrink: 0,
          }}>{(group?.title || 'G')[0].toUpperCase()}</div>
        ) : (
          <Avatar user={partner} size={35} className="cwp-av" />
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{isGroup ? (group?.title || 'Group') : dname(partner)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{isGroup ? 'Group chat' : (isOnline ? '🟢 Online' : 'Offline')}</div>
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
      <div className="chat-inp-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {sendErr && (
          <div role="alert" style={{
            padding: '0.35rem 0.75rem', fontSize: 12, fontWeight: 600,
            color: '#fff', background: '#b91c1c',
            borderRadius: '6px 6px 0 0',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <i className="bi bi-wifi-off" /> {sendErr}
          </div>
        )}
        <div style={{ display: 'flex', gap: 0 }}>
          <textarea
            className="chat-ta"
            rows={1}
            placeholder={online ? 'Type a message…' : 'You are offline…'}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="chat-send" onClick={send} disabled={!text.trim()}>
            <i className="bi bi-send" />
          </button>
        </div>
      </div>
    </div>
  )
}
