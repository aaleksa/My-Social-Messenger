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
  const { tok, me, users, cachedMsgs, setCachedMsgs, pushMsg, notifCnt, showToast } = useStore()
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
    if (!tok) { alert('Not logged in (no session token)'); return }
    if (!ev.title.trim()) { alert('Title is required'); return }
    if (!ev.event_time) { alert('Date & Time is required'); return }
    const payload = { title: ev.title.trim(), description: ev.description || '', event_time: ev.event_time, group_id: group.id }
    try {
      const res = await fetch('http://localhost:8080/api/groups/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': tok },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text()
        alert(`Error ${res.status}: ${txt}`)
        return
      }
      setShowEvent(false)
      setEv({ title: '', description: '', event_time: '' })
      const updated = await apiFetch(tok, `/api/groups/events?group_id=${group.id}`)
      setEvents(Array.isArray(updated) ? updated : [])
    } catch (err) {
      alert('Network error: ' + (err.message || err))
    }
  }

  async function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return
    try {
      await apiFetch(tok, `/api/groups/events?id=${eventId}`, { method: 'DELETE' })
      setEvents(evs => evs.filter(e => e.id !== eventId))
      showToast('Event deleted')
    } catch (_) {}
  }

  async function rsvp(eventId, status) {
    const prev = responses[eventId] || ''
    // Toggle off if clicking the already-active button
    const next = prev === status ? '' : status
    setResponses(r => ({ ...r, [eventId]: next }))
    // Optimistically update counts
    setEvents(evs => evs.map(ev => {
      if (ev.id !== eventId) return ev
      let g = ev.going_count
      let ng = ev.not_going_count
      if (prev === 'going') g--
      if (prev === 'not_going') ng--
      if (next === 'going') g++
      if (next === 'not_going') ng++
      return { ...ev, going_count: g, not_going_count: ng }
    }))
    try {
      await apiFetch(tok, '/api/groups/events/respond', {
        method: 'POST', body: JSON.stringify({ event_id: eventId, response: next }),
      })
      if (next === 'going') showToast('✓ Marked as going')
      else if (next === 'not_going') showToast('✗ Marked as not going')
      else showToast('Response removed')
    } catch (_) {
      // Revert on error
      setResponses(r => ({ ...r, [eventId]: prev }))
      setEvents(evs => evs.map(ev => {
        if (ev.id !== eventId) return ev
        let g = ev.going_count
        let ng = ev.not_going_count
        if (next === 'going') g--
        if (next === 'not_going') ng--
        if (prev === 'going') g++
        if (prev === 'not_going') ng++
        return { ...ev, going_count: g, not_going_count: ng }
      }))
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
        {isMember && group.creator_id === me?.id && (
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
          {events.map(ev => {
            const isPast = ev.event_time && new Date(ev.event_time.replace(' ', 'T').replace(/(\d{2}:\d{2}:\d{2})$/, '$1Z')) < new Date()
            const canDelete = me?.id === ev.creator_id || me?.id === group.creator_id
            return (
            <div key={ev.id} className="event-card" style={isPast ? { opacity: 0.6 } : {}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div className="event-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {ev.title}
                    {isPast && <span style={{ fontSize: 10, background: 'var(--bg-mid)', color: 'var(--text-dim)', borderRadius: 4, padding: '1px 5px', fontWeight: 400 }}>Past</span>}
                  </div>
                  <div className="event-desc">{ev.description}</div>
                  <div className="event-meta">📅 {fmtD(ev.event_time)}</div>
                  {(ev.going_count > 0 || ev.not_going_count > 0) && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {ev.going_count > 0 && <span>✓ {ev.going_count} going</span>}
                      {ev.going_count > 0 && ev.not_going_count > 0 && <span style={{ margin: '0 5px' }}>·</span>}
                      {ev.not_going_count > 0 && <span>✗ {ev.not_going_count} not going</span>}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button className="btn btn-sm" style={{ color: '#fa3e3e', border: '1px solid #fa3e3e', background: 'none', padding: '2px 8px', fontSize: 11 }}
                    onClick={() => deleteEvent(ev.id)}>🗑</button>
                )}
              </div>
              <div className="event-rsvp">
                <button
                  className={`btn btn-sm ${responses[ev.id] === 'going' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => rsvp(ev.id, 'going')}
                >✓ Going{ev.going_count > 0 ? ` (${ev.going_count})` : ''}</button>
                <button
                  className={`btn btn-sm ${responses[ev.id] === 'not_going' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => rsvp(ev.id, 'not_going')}
                >✗ Not going{ev.not_going_count > 0 ? ` (${ev.not_going_count})` : ''}</button>
              </div>
            </div>
            )
          })}
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
