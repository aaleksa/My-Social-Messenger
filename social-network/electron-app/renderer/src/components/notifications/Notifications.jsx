import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, fmtD } from '../../lib/api'

const ICONS = {
  follow: '👤', follow_request: '👤', like: '❤️', comment: '💬',
  group_invite: '👥', group_join: '👥', event: '📅', message: '💬',
}

export default function Notifications() {
  const { tok } = useStore()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(tok, '/api/notifications')
      .then(d => setNotifs(d || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tok])

  async function markRead(id) {
    try {
      await apiFetch(tok, '/api/notifications', { method: 'PUT', body: JSON.stringify({ id }) })
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch (_) {}
  }

  async function markAllRead() {
    try {
      await apiFetch(tok, '/api/notifications', { method: 'PUT', body: JSON.stringify({ all: true }) })
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (_) {}
  }

  async function respond(notif, action) {
    try {
      await apiFetch(tok, '/api/follow/respond', {
        method: 'POST',
        body: JSON.stringify({ follower_id: notif.actor_id, accept: action === 'accept' }),
      })
      await apiFetch(tok, '/api/notifications', { method: 'PUT', body: JSON.stringify({ id: notif.id }) })
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    } catch (_) {}
  }

  async function respondGroup(notif, action) {
    try {
      await apiFetch(tok, '/api/groups/respond', {
        method: 'POST',
        body: JSON.stringify({ group_id: notif.reference_id, user_id: notif.actor_id || notif.user_id, accept: action === 'accept' }),
      })
      await apiFetch(tok, '/api/notifications', { method: 'PUT', body: JSON.stringify({ id: notif.id }) })
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    } catch (_) {}
  }

  return (
    <div>
      <div className="page-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span><i className="bi bi-bell" /> Notifications</span>
        {notifs.some(n => !n.is_read) && (
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            <i className="bi bi-check2-all" /> Mark all as read
          </button>
        )}
      </div>
      {loading && <div className="loading"><span className="spinner" /> Loading…</div>}
      {!loading && notifs.length === 0 && (
        <div className="empty"><div className="ei">🔔</div>No notifications</div>
      )}
      {notifs.map(n => (
        <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`} onClick={() => !n.is_read && markRead(n.id)}>
          <div className="notif-icon-big">{ICONS[n.type] || '🔔'}</div>
          <div style={{ flex: 1 }}>
            <div className="notif-text">{n.content}</div>
            <div className="notif-time">{fmtD(n.created_at)}</div>
            {(n.type === 'follow_request') && !n.is_read && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); respond(n, 'accept') }}>Accept</button>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); respond(n, 'decline') }}>Decline</button>
              </div>
            )}
            {(n.type === 'group_invite') && !n.is_read && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); respondGroup(n, 'accept') }}>Join Group</button>
                <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); respondGroup(n, 'decline') }}>Decline</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
