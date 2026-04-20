import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, avSrc, inits } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function People() {
  const { tok, me, users, setUsers } = useStore()
  const [search, setSearch] = useState('')
  const [followStates, setFollowStates] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(tok, '/api/users')
      .then(d => {
        const list = (d || []).filter(u => u.id !== me?.id)
        setUsers(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tok])

  const filtered = users.filter(u =>
    u.id !== me?.id && dname(u).toLowerCase().includes(search.toLowerCase())
  )

  async function toggleFollow(uid) {
    const isFollowing = followStates[uid]
    try {
      if (isFollowing) {
        await apiFetch(tok, `/api/unfollow/${uid}`, { method: 'POST' })
        setFollowStates(p => ({ ...p, [uid]: false }))
      } else {
        await apiFetch(tok, `/api/follow/${uid}`, { method: 'POST' })
        setFollowStates(p => ({ ...p, [uid]: true }))
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
            <Avatar user={u} size={52} className="people-av" />
            <div className="people-name">{dname(u)}</div>
            {u.nickname && <div className="people-nick">@{u.nickname}</div>}
            <button
              className={`btn btn-sm ${followStates[u.id] ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => toggleFollow(u.id)}
            >
              {followStates[u.id] ? 'Unfollow' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
      {!loading && filtered.length === 0 && <div className="empty"><div className="ei">👥</div>No users found</div>}
    </div>
  )
}
