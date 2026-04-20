import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, fmtD, API } from '../../lib/api'

const ICONS = {
  follow: '👤', follow_request: '👤', follow_accepted: '✅',
  like: '❤️', comment: '💬',
  group_invite: '👥', group_join: '👥', group_join_request: '👥',
  group_join_accepted: '✅', group_event: '📅',
  event: '📅', message: '💬',
}

function notifText(n) {
  const actor = [n.actor_first_name, n.actor_last_name].filter(Boolean).join(' ') || 'Someone'
  const group = n.group_title || ''
  switch (n.type) {
    case 'follow':              return `${actor} started following you`
    case 'follow_request':      return `${actor} sent you a follow request`
    case 'follow_accepted':     return `${actor} accepted your follow request`
    case 'like':                return `${actor} liked your post`
    case 'comment':             return `${actor} commented on your post`
    case 'group_invite':        return `${actor} invited you to join the group "${group}"`
    case 'group_join_request':  return `${actor} wants to join your group "${group}"`
    case 'group_join':          return `${actor} joined the group "${group}"`
    case 'group_join_accepted': return `Your request to join "${group}" was accepted`
    case 'group_event':         return `New event in group "${group}"`
    case 'message':             return `New message from ${actor}`
    default:                    return n.content || `New notification from ${actor}`
  }
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
          <div className="notif-icon-big" style={{ position: 'relative', flexShrink: 0 }}>
            {n.actor_avatar
              ? <img src={`${API}/uploads/${n.actor_avatar}`} alt="" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#6c5ce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', fontWeight: 700 }}>
                  {[n.actor_first_name, n.actor_last_name].filter(Boolean).map(s => s[0]).join('') || '?'}
                </div>
            }
            <span style={{ position: 'absolute', bottom: -2, right: -4, fontSize: 16, lineHeight: 1 }}>{ICONS[n.type] || '🔔'}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="notif-text" style={{ fontWeight: !n.is_read ? 600 : 400 }}>{notifText(n)}</div>
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
