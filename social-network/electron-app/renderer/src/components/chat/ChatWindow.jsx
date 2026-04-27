import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, apiForm, dname, fmt, API, apiEditMessage, apiDeleteMessage, apiEditGroupMessage, apiDeleteGroupMessage, apiReactMessage, apiUnreactMessage, apiReactGroupMessage, apiUnreactGroupMessage, apiGetMessageReactions, apiGetGroupMessageReactions } from '../../lib/api'
      const [forwardingMsg, setForwardingMsg] = useState(null)
      const [showForwardModal, setShowForwardModal] = useState(false)

      // Forward message logic
      function handleForwardMessage(msg) {
        setForwardingMsg(msg)
        setShowForwardModal(true)
      }


      // Reply-to logic
      const [replyingMsg, setReplyingMsg] = useState(null)
      function handleReplyMessage(msg) {
        setReplyingMsg(msg)
      }
      function cancelReply() {
        setReplyingMsg(null)
      }

      // Quote logic
      function handleQuoteMessage(msg) {
        let quote = msg.content ? msg.content : '[file]'
        // Format as blockquote (markdown style)
        quote = quote.split('\n').map(line => '> ' + line).join('\n') + '\n'
        setText(t => (t ? t + '\n' : '') + quote)
      }

      async function doForwardMessage(targetChatID) {
        if (!forwardingMsg) return
        let payload
        if (String(targetChatID).startsWith('g:')) {
          payload = { type: 'group_message', group_id: parseInt(String(targetChatID).slice(2)), content: forwardingMsg.content, image_url: forwardingMsg.image_url }
        } else {
          payload = { type: 'chat_message', receiver_id: targetChatID, content: forwardingMsg.content, image_url: forwardingMsg.image_url }
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        ws.send(JSON.stringify(payload))
        setShowForwardModal(false)
        setForwardingMsg(null)
      }
    const [reactions, setReactions] = useState({}) // { [msgId]: [{user_id, emoji}] }
    // Load reactions for current chat
    useEffect(() => {
      if (!msgs.length) return
      const fetchReactions = async () => {
        const all = {}
        for (const m of msgs) {
          try {
            let r
            if (isGroup) r = await apiGetGroupMessageReactions(tok, m.id)
            else r = await apiGetMessageReactions(tok, m.id)
            all[m.id] = r
          } catch {}
        }
        setReactions(all)
      }
      fetchReactions()
    }, [msgs, isGroup, tok])
    async function toggleReaction(msg, emoji) {
      const mine = msg.sender_id === me?.id
      const msgId = msg.id
      const userReacted = (reactions[msgId] || []).some(r => r.user_id === me?.id && r.emoji === emoji)
      try {
        if (isGroup) {
          if (userReacted) await apiUnreactGroupMessage(tok, msgId, emoji)
          else await apiReactGroupMessage(tok, msgId, emoji)
          const r = await apiGetGroupMessageReactions(tok, msgId)
          setReactions(x => ({ ...x, [msgId]: r }))
        } else {
          if (userReacted) await apiUnreactMessage(tok, msgId, emoji)
          else await apiReactMessage(tok, msgId, emoji)
          const r = await apiGetMessageReactions(tok, msgId)
          setReactions(x => ({ ...x, [msgId]: r }))
        }
      } catch (e) {
        setSendErr('Reaction failed: ' + e.message)
      }
    }
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editFile, setEditFile] = useState(null)
  const [deletingMsgId, setDeletingMsgId] = useState(null)
  async function handleEditMessage(msg) {
    setEditingMsgId(msg.id)
    setEditText(msg.content)
    setEditFile(null)
  }

  async function submitEditMessage(msg) {
    try {
      let image_url = msg.image_url
      if (editFile) {
        const fd = new FormData()
        fd.append('file', editFile)
        const res = await apiForm(tok, '/api/upload', fd)
        image_url = res?.url || ''
      }
      const data = { content: editText, image_url }
      if (isGroup) {
        await apiEditGroupMessage(tok, msg.id, data)
      } else {
        await apiEditMessage(tok, msg.id, data)
      }
      // Update local cache
      setCachedMsgs(activeChatID, msgs.map(m => m.id === msg.id ? { ...m, content: editText, image_url, edited_at: new Date().toISOString() } : m))
      setEditingMsgId(null)
      setEditText('')
      setEditFile(null)
    } catch (e) {
      setSendErr('Edit failed: ' + e.message)
    }
  }

  async function handleDeleteMessage(msg) {
    if (!window.confirm('Delete this message?')) return
    try {
      if (isGroup) {
        await apiDeleteGroupMessage(tok, msg.id)
      } else {
        await apiDeleteMessage(tok, msg.id)
      }
      setCachedMsgs(activeChatID, msgs.filter(m => m.id !== msg.id))
    } catch (e) {
      setSendErr('Delete failed: ' + e.message)
    }
  }
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
    // Add reply_to if replying
    if (replyingMsg) {
      msg.reply_to = replyingMsg.id
    }
    ws.send(JSON.stringify(msg))
    pushMsg(activeChatID, { ...msg, sender_id: me.id, created_at: new Date().toISOString() })
    if (content === undefined) setText('')
    setReplyingMsg(null)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function insertEmoji(em) {
    setText(t => t + em)
    setShowEmoji(false)
  }

  async function handleFileUpload(file) {
    if (!file) return
    if (!online) { setSendErr(OFFLINE_MSG); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await apiForm(tok, '/api/upload', fd)
      const fileURL = res?.url || ''
      if (fileURL) send('', fileURL)
    } catch (_) {
      setSendErr('File upload failed.')
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
          const isEditing = editingMsgId === m.id
          const msgReacts = reactions[m.id] || []
          const reactCounts = {}
          msgReacts.forEach(r => { reactCounts[r.emoji] = (reactCounts[r.emoji] || 0) + 1 })
          const myReacts = msgReacts.filter(r => r.user_id === me?.id).map(r => r.emoji)
          // Find replied message if any
          const repliedMsg = m.reply_to ? msgs.find(msg => msg.id === m.reply_to) : null
          return (
            <div key={i} className={`mr ${mine ? 'mine' : 'theirs'}`}>
              <div style={{ position: 'relative' }}>
                {isEditing ? (
                  <>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      style={{ width: '100%', resize: 'vertical', marginBottom: 4 }}
                    />
                    <input type="file" onChange={e => setEditFile(e.target.files[0])} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => submitEditMessage(m)}>Save</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingMsgId(null)}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Reply context */}
                    {repliedMsg && (
                      <div style={{
                        borderLeft: '3px solid var(--accent)',
                        background: 'var(--bg-light)',
                        padding: '4px 8px',
                        marginBottom: 4,
                        fontSize: 13,
                        color: 'var(--text-dim)'
                      }}>
                        <b>{repliedMsg.sender_id === me?.id ? 'You' : dname(users.find(u => u.id === repliedMsg.sender_id) || { name: 'User' })}</b>: {repliedMsg.content ? repliedMsg.content.slice(0, 80) : '[file]'}
                      </div>
                    )}
                    {m.content && <div className="mb">{m.content}</div>}
                    {m.image_url && (
                      m.image_url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
                        ? <img
                            src={m.image_url.startsWith('http') ? m.image_url : API + m.image_url}
                            alt="img"
                            style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block', marginTop: m.content ? 4 : 0, cursor: 'pointer' }}
                            onClick={() => window.open(m.image_url.startsWith('http') ? m.image_url : API + m.image_url, '_blank')}
                          />
                        : <a
                            href={m.image_url.startsWith('http') ? m.image_url : API + m.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-block', marginTop: m.content ? 4 : 0 }}
                          >📎 Download file</a>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {Object.entries(reactCounts).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          className={`btn btn-xs${myReacts.includes(emoji) ? ' btn-primary' : ''}`}
                          style={{ borderRadius: 12, padding: '2px 8px', fontSize: 15 }}
                          onClick={() => toggleReaction(m, emoji)}
                        >{emoji} {count > 1 ? count : ''}</button>
                      ))}
                      <button
                        className="btn btn-xs"
                        style={{ borderRadius: 12, padding: '2px 8px', fontSize: 15 }}
                        onClick={e => {
                          e.stopPropagation()
                          const em = prompt('Emoji to react:')
                          if (em) toggleReaction(m, em)
                        }}
                      >+</button>
                    </div>
                    <div className="mt">{fmt(m.created_at)}{m.edited_at && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}> (edited)</span>}</div>
                    <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 4 }}>
                      {mine && <button className="btn btn-xs" title="Edit" onClick={() => handleEditMessage(m)}><i className="bi bi-pencil" /></button>}
                      {mine && <button className="btn btn-xs" title="Delete" onClick={() => handleDeleteMessage(m)}><i className="bi bi-trash" /></button>}
                      <button className="btn btn-xs" title="Forward" onClick={() => handleForwardMessage(m)}><i className="bi bi-arrow-right" /></button>
                      <button className="btn btn-xs" title="Reply" onClick={() => handleReplyMessage(m)}><i className="bi bi-reply" /></button>
                      <button className="btn btn-xs" title="Quote" onClick={() => handleQuoteMessage(m)}><i className="bi bi-quote" /></button>
                    </div>
                        {/* Forward modal */}
                        {showForwardModal && (
                          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: '#fff', padding: 24, borderRadius: 10, minWidth: 320 }}>
                              <h3>Forward message</h3>
                              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                                <b>People</b>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                  {users.filter(u => u.id !== me?.id).map(u => (
                                    <li key={u.id} style={{ margin: '6px 0' }}>
                                      <button className="btn btn-sm" onClick={() => doForwardMessage(u.id)}>{dname(u)}</button>
                                    </li>
                                  ))}
                                </ul>
                                <b>Groups</b>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                  {groups.map(g => (
                                    <li key={g.id} style={{ margin: '6px 0' }}>
                                      <button className="btn btn-sm" onClick={() => doForwardMessage('g:' + g.id)}>{g.title}</button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <button className="btn btn-secondary" onClick={() => setShowForwardModal(false)}>Cancel</button>
                            </div>
                          </div>
                        )}
                  </>
                )}
              </div>
            </div>
          )
              {/* Reply context bar */}
              {replyingMsg && (
                <div style={{
                  background: 'var(--bg-light)',
                  borderLeft: '3px solid var(--accent)',
                  padding: '6px 10px',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ fontWeight: 500 }}>
                    Replying to {replyingMsg.sender_id === me?.id ? 'You' : dname(users.find(u => u.id === replyingMsg.sender_id) || { name: 'User' })}:
                  </span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 13, flex: 1 }}>
                    {replyingMsg.content ? replyingMsg.content.slice(0, 80) : '[file]'}
                  </span>
                  <button className="btn btn-xs btn-secondary" onClick={cancelReply}>Cancel</button>
                </div>
              )}
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
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
          <button
            className="chat-send"
            title="Send file"
            style={{ background: 'transparent', color: 'var(--text-dim)', flexShrink: 0 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <i className="bi bi-paperclip" />}
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
