import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, fmtD } from '../../lib/api'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'

export default function GroupDetail({ group, onBack }) {
  const { tok, me } = useStore()
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [isMember, setIsMember] = useState(false)
  const [showEvent, setShowEvent] = useState(false)
  const [ev, setEv] = useState({ title: '', description: '', event_time: '' })

  useEffect(() => {
    apiFetch(tok, `/api/groups/${group.id}/posts`).then(d => setPosts(d || [])).catch(() => {})
    apiFetch(tok, `/api/groups/${group.id}/members`).then(d => {
      const ms = d || []
      setMembers(ms)
      setIsMember(ms.some(m => m.id === me?.id))
    }).catch(() => {})
    apiFetch(tok, `/api/groups/${group.id}/events`).then(d => setEvents(d || [])).catch(() => {})
  }, [group.id])

  async function joinOrLeave() {
    try {
      if (isMember) {
        await apiFetch(tok, `/api/groups/${group.id}/leave`, { method: 'POST' })
        setIsMember(false)
        setMembers(m => m.filter(u => u.id !== me.id))
      } else {
        await apiFetch(tok, `/api/groups/${group.id}/join`, { method: 'POST' })
        setIsMember(true)
      }
    } catch (_) {}
  }

  async function createEvent(e) {
    e.preventDefault()
    try {
      const evt = await apiFetch(tok, `/api/groups/${group.id}/events`, {
        method: 'POST', body: JSON.stringify(ev),
      })
      setEvents(prev => [evt, ...prev])
      setShowEvent(false)
      setEv({ title: '', description: '', event_time: '' })
    } catch (_) {}
  }

  async function rsvp(eventId, status) {
    try {
      await apiFetch(tok, `/api/groups/${group.id}/events/${eventId}/rsvp`, {
        method: 'POST', body: JSON.stringify({ status }),
      })
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
        {['posts', 'members', 'events'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div>
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
