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

// Debounce: sends typing WS event at most once per 2.5s
function useTypingSend(ws, activeChatID, isGroup, groupID) {
  const  const   = us  const  con return function sendTyping() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    if (timerRef.current) return
    if (isGroup) {
      ws.send(JSON.stringify({ type: 'typing', group_id: groupID }))
    } else {
      ws.send(JSON.stringify({ type: 'typing', recipient_id: activeChatID }))
    }
    timerRef.current = setTimeout(() => { timerRef.current = null }, 2500)
  }
}

export default function ChatWindow() {
  const { t  const { t  const { t  const { t  const { t  dMsgs  const hedMsgs, pushMsg, onlineIDs, typingUsers } = useStore()
  const [text, setText] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [showE  const [showE  const [showE  const [showE  const [showE  const [showE  =  const [showE  const [showE  const [showE  const [showE  const [show)
                                                                         string' && activeChatID.startsWith('g:')
  const groupID  = isGroup ? parseInt(activeChatID.slice(2)) : null
  const group   const group   const group   const group   cID) : null
  const partner = !isGroup ? users.find(u => u.id === activeChatI  const partner = !isGroup ? usMsgs[activeChatID] ||  const partner = !isGroup ? users.find(u => u.id === activeChatI  groupID)
  const typingKey = isGroup ? ('g:' + groupID) : activeChatID
  const partnerTyping = typi  const partnerTyping = typi  const partnerTyping = typi  const partnerTyt partner  const partnerTyping = typi e || 'Grou  const partnerTyping = typi  const partnerTyping = typi  const partnerTyping = typi  const partnerTyt partner  const partn) return
    if (isGroup) {
      apiFetch      apiFetch      apiFetch      apiFetchpID      apiFetch      apiFetch      apiFetch      apiFetchpID      apiFetch      apiFetch      apiFetch      apiFetchpID      apiFetch      apiFetch      apiFpi      apiFetch      apiFetch      apiFetch      apiFetchpID      apiFetch      apiFetch      apiFetch      apiFe
    }
  }, [activeChatID])

  // Auto-scroll to bottom
  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(ur  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(ur  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(()  useEffect(ur  useEffect(()  useEffeer  useEffect(()  useEffect(()  useEffect(()  useEffect(()  uner('click', handler)
  }, [showEmoji])

  function send(content, imageURL) {
    const c = content !== undefined ? content : text
    const img = imageURL || ''
    if (!c.trim() && !img) return
    if (!online) { setSendErr(OFFLINE_MSG); return }
    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    ChatID,     if (!ws || ws.r: m    if (!ws || ws.readySte(    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyState !== WebSocket.OPEN) { set    if (!ws || ws.readyStateNE_MSG    if (!w}
    setUploading(true)
    try {
      const      const      const      const      const      c
                           Form(                           Form(nst imageURL = res?.url || ''
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
            fontWeight: 700, c            fontWeigze:       exS            fontWeight: 700, c            fontWeigze:       e)}</div>
        ) : (
          <Avatar user={partner} size={35} className="cwp-av" />
        )}
        <div>
          <div style={          <div s0, fontSize: 14 }}>{partnerName}</div>
          <div style={{ fontSize: 11, color: '          <div style={{ fontSize: 11, color: '                ? <span style={{ color: 'var(--accent)'          <div style={{ fontSizpa          <div style={{ fontn>
                                                                      Of                                     iv>
      </div>
       <div c   sName="msgs" ref={msgsRef}>
        {msgs.map((m, i) => {
          const mine           const mine  id
                               <di                   ={`mr ${mine ? 'mine' : 't                               <di                  nten                               <di                   ={`                                 <di                   ={                                    <di                   ={`mr ${mine ? 'mine' : 't                               <di                  { maxWidth: 220,                               <di                   ={`mr ${mim.          4            : 'pointer' }}
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
                                           alert" style={{
            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig            padd            padd            padd            ig     fl            padd            padd            padd            ig            padd            padd            padd                          padd                 p             onClick={e => e.stopPropagation()}
              style=              styl po              sty', bottom: '100%', left: 0,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius:                 borderRadius:              rid', gridTemplateColumns: 'repeat(10,1fr)',
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
            onChange={e => { setText(e.target.value); sendTyping() }}
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
