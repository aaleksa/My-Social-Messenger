import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, apiForm, dname, fmt, API } from '../../lib/api'
import Avatar from '../ui/Avatar'
import { useOnline } from '../../hooks/useOnline'

const OFFLINE_MSG = 'You are offline. Check your internet connection.'

const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😅','😭','😡','🥳',
  '👍','👎','👏','🙌','🤝','🫶','❤️','🔥','✅','⭐',
  '🎉','🎊','💯','😜','🤣','😢','😤','🙄','😴','🤯',
  '🐶','🐱','🌟','🍕','🎮','💻','📱','🚀','🌈','💀',
]

export default function ChatWindow() {
  const { tok, me, users, groups, activeChatID, ws, cachedMsgs, setCachedMsgs, pushMsg, onlineIDs, typingUsers } = useStore()
  const [text, setText] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const msgsRef = useRef()
  const fileRef = useRef()
  const typingTimer = useRef(null)
  const online = useOnline()

  const isGroup = typeof activeChatID === 'string' && activeChatID.startsWith('g:')
  const groupID  = isGroup ? parseInt(activeChatID.slice(2)) : null
  const group    = isGroup ? groups.find(g => g.id === groupID) : null
  const partner  = !isGroup ? users.find(u => u.id === activeChatID) : null
  const msgs     = cachedMsgs[activeChatID] || []

  const typingKey     = isGroup ? ('g:' + groupID) : activeChatID
  const partnerTyping = typingUsers[typingKey] && (Date.now() - typingUsers[typingKey] < 3000)
  const partnerName   = isGroup ? (group?.title || 'Group') : dname(partner)

  function sendTypingEvent() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    if (typingTimer.current) return
    if (isGroup) {
      ws.send(JSON.stringify({ type: 'typing', group_id: groupID }))
    } else {
      ws.send(JSON.stringify({ type: 'typing', recipient_id: activeChatID }))
    }
    typingTimer.current = setTimeout(() => { typingTimer.current = null }, 2500)
  }

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

  useEffect(() => {
    if (!showEmoji) return
    const handler = () => setShowEmoji(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showEmoji])

  function send(content, imageURL) {
    const c = content !== undefined ? content : text
    const img = imageURL || ''
    if (!c.trim() && !img) return
    if (!online) { setSendErr(OFFLINE_MSG); return }
    if (!ws || ws.readyState !== WebSocket.OPEN) { setSendErr(OFFLINE_MSG); return }
    setSendErr('')
    let msg
    if (isGroup) {
      msg = { type: 'group_message', group_id: groupID, content: c, image_url: img }
    } else {
      msg = { type: 'chat_message', receiver_id: activeChatID, content: c, image_url: img }
    }
    ws.send(JSON.stringify(msg))
    pushMsg(activeChatID, { ...msg, sender_id: me.id, created_at: new Date().toISOString() })
    if (content === undefined) setText('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function insertEmoji(em) {
    setText(t => t + em)
    setShowEmoji(false)
  }

  async function handleImageFile(file) {
    if (!file) return
    if (!online) { setSendErr(OFFLINE_MSG); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await apiForm(tok, '/api/upload', fd)
      const imageURL = res?.url || ''
      if (imageURL) send('', imageURL)
    } catch (_) {
      setSendErr('Image upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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
          <div style={{ fontWeight: 700, fontSize: 14 }}>{partnerName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {partnerTyping
              ? <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>💬 {partnerName} is typing…</span>
              : isGroup ? 'Group chat' : (isOnline ? '🟢 Online' : 'Offline')}
          </div>
        </div>
      </div>

      <div className="msgs" ref={msgsRef}>
        {msgs.map((m, i) => {
          const mine = m.sender_id === me?.id
          return (
            <div key={i} className={`mr ${mine ? 'mine' : 'theirs'}`}>
              <div>
                {m.content && <div className="mb">{m.content}</div>}
                {m.image_url && (
                  <img
                    src={m.image_url.startsWith('http') ? m.image_url : API + m.image_url}
                    alt="img"
                    style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block', marginTop: m.content ? 4 : 0, cursor: 'pointer' }}
                    onClick={() => window.open(m.image_url.startsWith('http') ? m.image_url : API + m.image_url, '_blank')}
                  />
                )}
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
        <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
          <button
            className="chat-send"
            title="Emoji"
            style={{ background: 'transparent', color: 'var(--text-dim)', fontSize: 18, flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); setShowEmoji(v => !v) }}
          >😊</button>
          {showEmoji && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: '100%', left: 0,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 8,
                display: 'grid', gridTemplateColumns: 'repeat(10,1fr)',
                gap: 2, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,.25)',
              }}
            >
              {EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => insertEmoji(em)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: '2px 4px', lineHeight: 1 }}
                >{em}</button>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageFile(e.target.files[0])} />
          <button
            className="chat-send"
            title="Send image"
            style={{ background: 'transparent', color: 'var(--text-dim)', flexShrink: 0 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="bi bi-image" />}
          </button>
          <textarea
            className="chat-ta"
            rows={1}
            placeholder={online ? 'Type a message…' : 'You are offline…'}
            value={text}
            onChange={e => { setText(e.target.value); sendTypingEvent() }}
            onKeyDown={onKeyDown}
          />
          <button className="chat-send" onClick={() => send()} disabled={!text.trim()}>
            <i className="bi bi-send" />
          </button>
        </div>
      </div>
    </div>
  )
}
