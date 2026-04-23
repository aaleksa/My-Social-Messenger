import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, fmtD } from '../../lib/api'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'
import PostCreate from '../feed/PostCreate'

const EMOJIS = [
  '😀','😂','😍','🥰','😎','🤔','😅','😭','😡','🥳',
  '👍','👎','👏','🙌','🤝','🫶','❤️','🔥','✅','⭐',
  '🎉','🎊','💯','😜','🤣','😢','😤','🙄','😴','🤯',
  '🐶','🐱','🌟','🍕','🎮','💻','📱','🚀','🌈','💀',
]

export default function GroupDetail({ group, onBack }) {
  const { tok, me, users, cachedMsgs, setCachedMsgs, pushMsg, notifCnt } = useStore()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [myStatus, setMyStatus] = useState(group.my_status || '')
  const [responses, setResponses] = useState({})
  const [showEvent, setShowEvent] = useState(false)
  const [ev, setEv] = useState({ title: '', description: '', event_time: '' })
  const [showInvite, setShowInvite] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviting, setInviting] = useState({})
  const [chatInput, setChatInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const chatKey = `g:${group.id}`
  const chatMsgs = cachedMsgs[chatKey] || []
  const chatEndRef = useRef(null)

  useEffect(() => {
    apiFetch(tok, `/api/posts?group_id=${group.id}`).then(d => setPosts(d || [])).catch(() => {})
    apiFetch(tok, `/api/groups/members?group_id=${group.id}`).then(d => {
      const ms = d || []
      setMembers(ms)
    }).catch(() => {})
    apiFetch(tok, `/api/groups/detail?id=${group.id}`).then(d => {
      if (d?.my_status !== undefined) setMyStatus(d.my_status)
    }).catch(() => {})
    apiFetch(tok, `/api/groups/events?group_id=${group.id}`).then(d => {
      const evts = d || []
      setEvents(evts)
      setResponses(Object.fromEntries(evts.map(e => [e.id, e.user_response || ''])))
    }).catch(() => {})
    // Load group chat messages initially
    apiFetch(tok, `/api/messages/group?group_id=${group.id}`)
      .then(d => setCachedMsgs(chatKey, d || []))
      .catch(() => {})
    // Poll chat every 4s for new messages
    const pollChat = setInterval(() => {
      apiFetch(tok, `/api/messages/group?group_id=${group.id}`)
        .then(d => { if (d) setCachedMsgs(chatKey, d) })
        .catch(() => {})
    }, 4000)
    return () => clearInterval(pollChat)
  }, [group.id])

  // Re-fetch membership status when a notification arrives (e.g. group_join_accepted)
  useEffect(() => {
    if (!notifCnt) return
    apiFetch(tok, `/api/groups/detail?id=${group.id}`).then(d => {
      if (d?.my_status !== undefined) setMyStatus(d.my_status)
    }).catch(() => {})
    apiFetch(tok, `/api/groups/members?group_id=${group.id}`).then(d => setMembers(d || [])).catch(() => {})
  }, [notifCnt])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs.length])

  async function joinOrLeave() {
    try {
      if (myStatus === 'accepted') {
        await apiFetch(tok, '/api/groups/respond', { method: 'POST', body: JSON.stringify({ group_id: group.id, user_id: me.id, accept: false }) })
        setMyStatus('')
        setMembers(m => m.filter(u => u.user_id !== me.id))
      } else if (myStatus === '' || myStatus === null) {
        await apiFetch(tok, '/api/groups/join', { method: 'POST', body: JSON.stringify({ group_id: group.id }) })
        setMyStatus('pending')
      }
    } catch (_) {}
  }

  async function createEvent(e) {
    e.preventDefault()
    try {
      const evt = await apiFetch(tok, '/api/groups/events', {
        method: 'POST', body: JSON.stringify({ ...ev, group_id: group.id }),
      })
      setEvents(prev => [evt, ...prev])
      setShowEvent(false)
      setEv({ title: '', description: '', event_time: '' })
    } catch (_) {}
  }

  async function rsvp(eventId, status) {
    setResponses(prev => ({ ...prev, [eventId]: status }))
    try {
      await apiFetch(tok, '/api/groups/events/respond', {
        method: 'POST', body: JSON.stringify({ event_id: eventId, response: status }),
      })
    } catch (_) {
      setResponses(prev => ({ ...prev, [eventId]: '' }))
    }
  }

  async function inviteUser(userId) {
    setInviting(prev => ({ ...prev, [userId]: 'loading' }))
    try {
      await apiFetch(tok, '/api/groups/invite', {
        method: 'POST',
        body: JSON.stringify({ group_id: group.id, user_id: userId }),
      })
      setInviting(prev => ({ ...prev, [userId]: 'done' }))
    } catch (_) {
      setInviting(prev => ({ ...prev, [userId]: 'error' }))
    }
  }

  const isMember = group.creator_id === me?.id || myStatus === 'accepted'
  const memberIds = new Set(members.map(m => m.user_id))
  const invitablePeople = users.filter(u =>
    u.id !== me?.id &&
    !memberIds.has(u.id) &&
    (inviteSearch === '' ||
      dname(u).toLowerCase().includes(inviteSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(inviteSearch.toLowerCase())
    )
  )

  async function respondMember(userId, accept) {
    try {
      await apiFetch(tok, '/api/groups/respond', {
        method: 'POST',
        body: JSON.stringify({ group_id: group.id, user_id: userId, accept }),
      })
      // refresh members
      apiFetch(tok, `/api/groups/members?group_id=${group.id}`).then(d => setMembers(d || [])).catch(() => {})
    } catch (_) {}
  }

  async function sendGroupMsg(e) {
    e.preventDefault()
    if (!chatInput.trim()) return
    const content = chatInput.trim()
    setChatInput('')
    try {
      const msg = await apiFetch(tok, '/api/messages/group', {
        method: 'POST',
        body: JSON.stringify({ group_id: group.id, content }),
      })
      pushMsg(chatKey, { id: msg?.id || Date.now(), sender_id: me.id, content, created_at: new Date().toISOString() })
    } catch (_) {}
  }

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 14 }} onClick={onBack}>
        ← Back to Groups
      </button>
      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <div className="g-big-icon">👥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{group.title}</div>
          {group.description && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{group.description}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {members.filter(m => m.status === 'accepted').length} members
            {(() => {
              const creator = users.find(u => u.id === group.creator_id)
              if (creator) return <span> · Created by <strong>{dname(creator)}</strong></span>
              if (group.creator_id === me?.id) return <span> · Created by <strong>you</strong></span>
              return null
            })()}
          </div>
        </div>
        {group.creator_id !== me?.id && (
          myStatus === 'pending'
            ? <button className="btn btn-secondary btn-sm" disabled>Request pending</button>
            : <button className={`btn ${myStatus === 'accepted' ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={joinOrLeave}>
                {myStatus === 'accepted' ? 'Leave Group' : 'Join Group'}
              </button>
        )}
        {isMember && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEvent(true)}>
            + Event
          </button>
        )}
      </div>

      <div className="tabs">
        {['posts', 'members', 'events', 'chat'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'chat' ? '💬 Chat' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div>
          {isMember && <PostCreate groupId={group.id} onPost={p => p && setPosts(prev => [p, ...prev])} />}
          {posts.length === 0 && <div className="empty"><div className="ei">📭</div>No posts yet</div>}
          {posts.map(p => (
            <div key={p.id} className="card">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{p.user?.first_name}</div>
              <div style={{ fontSize: 14 }}>{p.content}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div>
          {/* Pending requests — visible only to group creator */}
          {group.creator_id === me?.id && members.filter(m => m.status === 'pending').length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Join Requests</div>
              {members.filter(m => m.status === 'pending').map(m => (
                <div key={m.user_id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Avatar user={m} size={38} />
                  <div style={{ flex: 1 }}>{dname(m)}</div>
                  <button className="btn btn-primary btn-sm" onClick={() => respondMember(m.user_id, true)}>Accept</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => respondMember(m.user_id, false)}>Decline</button>
                </div>
              ))}
            </div>
          )}
          {/* Invite button — only for creator */}
          {group.creator_id === me?.id && (
            <div style={{ marginBottom: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowInvite(true); setInviteSearch(''); setInviting({}) }}>
                <i className="bi bi-person-plus" /> Invite People
              </button>
            </div>
          )}
          {members.filter(m => m.status === 'accepted').length === 0 && <div className="empty"><div className="ei">👥</div>No members yet</div>}
          {members.filter(m => m.status === 'accepted').map(m => (
            <div key={m.user_id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={m} size={38} />
              <div style={{ flex: 1 }}>{dname(m)}</div>
              {m.user_id === group.creator_id && <span className="tag owner" style={{ background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Owner</span>}
            </div>
          ))}

          {showInvite && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
              <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: 24, width: 380, maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Invite People</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowInvite(false)}>✕</button>
                </div>
                <input
                  className="input"
                  placeholder="Search by name or email…"
                  value={inviteSearch}
                  onChange={e => setInviteSearch(e.target.value)}
                  autoFocus
                />
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invitablePeople.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>No people found</div>
                  )}
                  {invitablePeople.map(u => {
                    const state = inviting[u.id]
                    return (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                        <Avatar user={u} size={36} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{dname(u)}</div>
                          {u.email && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.email}</div>}
                        </div>
                        <button
                          className={`btn btn-sm ${state === 'done' ? 'btn-secondary' : 'btn-primary'}`}
                          disabled={state === 'loading' || state === 'done'}
                          onClick={() => inviteUser(u.id)}
                        >
                          {state === 'loading' ? '…' : state === 'done' ? '✓ Invited' : 'Invite'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'events' && (
        <div>
          {events.length === 0 && <div className="empty"><div className="ei">📅</div>No events yet</div>}
          {events.map(ev => (
            <div key={ev.id} className="event-card">
              <div className="event-title">{ev.title}</div>
              <div className="event-desc">{ev.description}</div>
              <div className="event-meta">📅 {fmtD(ev.event_time)}</div>
              <div className="event-rsvp">
                <button
                  className={`btn btn-sm ${responses[ev.id] === 'going' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => rsvp(ev.id, 'going')}
                >✓ Going</button>
                <button
                  className={`btn btn-sm ${responses[ev.id] === 'not_going' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => rsvp(ev.id, 'not_going')}
                >✗ Not going</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0' }}>
            {chatMsgs.length === 0 && <div className="empty"><div className="ei">💬</div>No messages yet</div>}
            {chatMsgs.map((m, i) => {
              const isMine = m.sender_id === me?.id
              const sender = members.find(u => u.user_id === m.sender_id)
              return (
                <div key={m.id || i} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
                  {!isMine && <Avatar user={sender} size={28} />}
                  <div style={{
                    maxWidth: '65%', padding: '8px 12px', borderRadius: 14,
                    background: isMine ? 'var(--accent)' : 'var(--bg-mid)',
                    color: isMine ? '#fff' : 'var(--text)',
                    fontSize: 13,
                  }}>
                    {!isMine && sender && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, opacity: .75 }}>{dname(sender)}</div>}
                    {m.content}
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
          {isMember && (
            <form onSubmit={sendGroupMsg} style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)', position: 'relative' }}>
              <button type="button" onClick={e => { e.stopPropagation(); setShowEmoji(v => !v) }}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '0 4px', color: 'var(--text-dim)' }}
              >😊</button>
              {showEmoji && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: 'absolute', bottom: 52, left: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 8,
                  display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4,
                  zIndex: 20, boxShadow: '0 4px 20px rgba(0,0,0,.3)',
                }}>
                  {EMOJIS.map(em => (
                    <button key={em} type="button"
                      onClick={() => { setChatInput(v => v + em); setShowEmoji(false) }}
                      style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', borderRadius: 4, padding: '2px 4px' }}
                    >{em}</button>
                  ))}
                </div>
              )}
              <input
                style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-mid)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontSize: 13, outline: 'none' }}
                placeholder="Type a message…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onClick={() => setShowEmoji(false)}
              />
              <button className="btn btn-primary btn-sm" type="submit">Send</button>
            </form>
          )}
          {!isMember && <div style={{ textAlign: 'center', padding: 12, fontSize: 13, color: 'var(--text-dim)' }}>Join the group to send messages</div>}
        </div>
      )}

      {showEvent && (
        <Modal title="Create Event" onClose={() => setShowEvent(false)}>
          <form onSubmit={createEvent}>
            <div className="fg"><label>Title</label><input value={ev.title} onChange={e => setEv(p => ({...p, title: e.target.value}))} required /></div>
            <div className="fg"><label>Description</label><textarea value={ev.description} onChange={e => setEv(p => ({...p, description: e.target.value}))} /></div>
            <div className="fg"><label>Date & Time</label><input type="datetime-local" value={ev.event_time} onChange={e => setEv(p => ({...p, event_time: e.target.value}))} required /></div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create Event</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
