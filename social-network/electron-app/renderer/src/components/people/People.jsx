import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, avSrc, inits } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function People() {
  const { tok, me, users, setUsers, setPage, searchQuery, setSearchQuery } = useStore()
  const [search, setSearch] = useState(searchQuery || '')
  const [followStates, setFollowStates] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // clear store searchQuery after consuming it on mount
    if (searchQuery) setSearchQuery('')
  }, []) // eslint-disable-line

  useEffect(() => {
    apiFetch(tok, '/api/users')
      .then(d => {
        const list = (d || []).filter(u => u.id !== me?.id)
        setUsers(list)
        // init follow state from API response
        const states = {}
        list.forEach(u => {
          if (u.follow_status === 'following' || u.follow_status === 'accepted') states[u.id] = 'following'
          else if (u.follow_status === 'pending') states[u.id] = 'pending'
          else states[u.id] = 'none'
        })
        setFollowStates(states)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tok])

  const filtered = users.filter(u =>
    u.id !== me?.id && dname(u).toLowerCase().includes(search.toLowerCase())
  )

  async function toggleFollow(uid) {
    const status = followStates[uid] || 'none'
    try {
      if (status === 'following' || status === 'pending') {
        await apiFetch(tok, `/api/follow?following_id=${uid}`, { method: 'DELETE' })
        setFollowStates(p => ({ ...p, [uid]: 'none' }))
      } else {
        await apiFetch(tok, '/api/follow', { method: 'POST', body: JSON.stringify({ following_id: uid }) })
        const target = users.find(u => u.id === uid)
        const isPrivate = target?.privacy === 'private'
        setFollowStates(p => ({ ...p, [uid]: isPrivate ? 'pending' : 'following' }))
      }
    } catch (_) {}
  }

  return (
    <div>
      <div className="sec-hdr">
        <div className="page-title"><i className="bi bi-people" /> People</div>
        <input
          style={{ padding: '7px 13px', background: 'var(--bg-mid)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontSize: 13, outline: 'none' }}
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {loading && <div className="loading"><span className="spinner" /> Loading…</div>}
      <div className="people-grid">
        {filtered.map(u => (
          <div key={u.id} className="people-card">
            <div style={{ cursor: 'pointer' }} onClick={() => setPage('userprofile', { userId: u.id })}>
              <Avatar user={u} size={52} className="people-av" />
            </div>
            <div className="people-name" style={{ cursor: 'pointer' }} onClick={() => setPage('userprofile', { userId: u.id })}>{dname(u)}</div>
            {u.nickname && <div className="people-nick">@{u.nickname}</div>}
            <button
              className={`btn btn-sm ${
                followStates[u.id] === 'following' ? 'btn-secondary'
                : followStates[u.id] === 'pending' ? 'btn-warning'
                : 'btn-primary'
              }`}
              onClick={() => toggleFollow(u.id)}
            >
              {followStates[u.id] === 'following' ? '✓ Unfollow'
                : followStates[u.id] === 'pending' ? '⏳ Надіслано'
                : 'Follow'}
            </button>
          </div>
        ))}
      </div>
      {!loading && filtered.length === 0 && <div className="empty"><div className="ei">👥</div>No users found</div>}
    </div>
  )
}
