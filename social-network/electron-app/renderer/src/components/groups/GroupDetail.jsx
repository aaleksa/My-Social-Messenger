import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, fmtD } from '../../lib/api'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'
import PostCreate from '../feed/PostCreate'

export default function GroupDetail({ group, onBack }) {
  const { tok, me, cachedMsgs, setCachedMsgs, pushMsg } = useStore()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [isMember, setIsMember] = useState(false)
  const [showEvent, setShowEvent] = useState(false)
  const [ev, setEv] = useState({ title: '', description: '', event_time: '' })
  const [chatInput, setChatInput] = useState('')
  const chatKey = `g:${group.id}`
  const chatMsgs = cachedMsgs[chatKey] || []
  const chatEndRef = useRef(null)

  useEffect(() => {
    apiFetch(tok, `/api/posts?group_id=${group.id}`).then(d => setPosts(d || [])).catch(() => {})
    apiFetch(tok, `/api/groups/members?group_id=${group.id}`).then(d => {
      const ms = d || []
      setMembers(ms)
      setIsMember(ms.some(m => m.id === me?.id))
    }).catch(() => {})
    apiFetch(tok, `/api/groups/events?group_id=${group.id}`).then(d => setEvents(d || [])).catch(() => {})
    // Load group chat messages
    if (!cachedMsgs[chatKey]) {
      apiFetch(tok, `/api/messages/group?group_id=${group.id}`)
        .then(d => setCachedMsgs(chatKey, (d || []).reverse()))
        .catch(() => {})
    }
  }, [group.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs.length])

  async function joinOrLeave() {
    try {
      if (isMember) {
        // leave = delete own membership via respond with accept:false as creator, or just local state
        await apiFetch(tok, '/api/groups/respond', { method: 'POST', body: JSON.stringify({ group_id: group.id, user_id: me.id, accept: false }) })
        setIsMember(false)
        setMembers(m => m.filter(u => u.id !== me.id))
      } else {
        await apiFetch(tok, '/api/groups/join', { method: 'POST', body: JSON.stringify({ group_id: group.id }) })
        setIsMember(true)
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
    try {
      await apiFetch(tok, '/api/groups/events/respond', {
        method: 'POST', body: JSON.stringify({ event_id: eventId, response: status }),
      })
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
      pushMsg(chatKey, msg || { id: Date.now(), sender_id: me.id, content, created_at: new Date().toISOString() })
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
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>{group.description}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{members.length} members</div>
        </div>
        {group.creator_id !== me?.id && (
          <button className={`btn ${isMember ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={joinOrLeave}>
            {isMember ? 'Leave Group' : 'Join Group'}
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
          {members.map(m => (
            <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={m} size={38} />
              <div>{dname(m)}</div>
              {m.id === group.creator_id && <span className="tag owner">Owner</span>}
            </div>
          ))}
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
                <button className="btn btn-primary btn-sm" onClick={() => rsvp(ev.id, 'going')}>Going</button>
                <button className="btn btn-secondary btn-sm" onClick={() => rsvp(ev.id, 'not_going')}>Not going</button>
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
              const sender = members.find(u => u.id === m.sender_id)
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
            <form onSubmit={sendGroupMsg} style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <input
                style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-mid)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontSize: 13, outline: 'none' }}
                placeholder="Type a message…"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
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
