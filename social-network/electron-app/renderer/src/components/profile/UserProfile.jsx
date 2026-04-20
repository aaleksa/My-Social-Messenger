import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname, avSrc } from '../../lib/api'
import Avatar from '../ui/Avatar'
import PostCard from '../feed/PostCard'

export default function UserProfile() {
  const { tok, me, viewUserId, setPage } = useStore()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [tab, setTab] = useState('posts')
  const [followStatus, setFollowStatus] = useState('none')

  useEffect(() => {
    if (!viewUserId) return
    apiFetch(tok, `/api/profile?user_id=${viewUserId}`).then(d => setUser(d)).catch(() => {})
    apiFetch(tok, `/api/posts?user_id=${viewUserId}`).then(d => setPosts(d || [])).catch(() => {})
    apiFetch(tok, `/api/follow?user_id=${viewUserId}`).then(d => setFollowers(d?.followers || [])).catch(() => {})
    apiFetch(tok, `/api/follow/following?user_id=${viewUserId}`).then(d => setFollowing(d?.following || [])).catch(() => {})
    // check if current user follows this user
    apiFetch(tok, '/api/users').then(d => {
      const u = (d || []).find(x => x.id === viewUserId)
      if (u) {
          const s = u.follow_status
          setFollowStatus(s === 'accepted' || s === 'following' ? 'following' : s === 'pending' ? 'pending' : 'none')
        }
    }).catch(() => {})
  }, [viewUserId])

  async function toggleFollow() {
    try {
      if (followStatus === 'following' || followStatus === 'pending') {
        await apiFetch(tok, `/api/follow?following_id=${viewUserId}`, { method: 'DELETE' })
        setFollowStatus('none')
      } else {
        await apiFetch(tok, '/api/follow', { method: 'POST', body: JSON.stringify({ following_id: viewUserId }) })
        setFollowStatus(user?.privacy === 'private' ? 'pending' : 'following')
      }
    } catch (_) {}
  }

  if (!user) return <div className="loading"><span className="spinner" /> Loading profile…</div>

  const isPrivate = user.privacy === 'private' && followStatus !== 'following' && user.id !== me?.id
  const avUrl = avSrc(user)

  return (
    <div>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: 14 }} onClick={() => setPage('people')}>
        ← Back to People
      </button>
      <div className="profile-cover" />
      <div className="profile-card">
        <div className="p-info">
          <div className="p-big-av">
            {avUrl
              ? <img src={avUrl} alt="" />
              : <span style={{ fontSize: 26 }}>{dname(user).slice(0,2).toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div className="p-name">{dname(user)}</div>
            {user.nickname && <div className="p-nick">@{user.nickname}</div>}
            {!isPrivate && user.about_me && <div className="p-bio">{user.about_me}</div>}
            {isPrivate && <div className="p-bio" style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>🔒 This profile is private</div>}
          </div>
          <button
            className={`btn btn-sm ${
              followStatus === 'following' ? 'btn-secondary'
              : followStatus === 'pending' ? 'btn-warning'
              : 'btn-primary'
            }`}
            onClick={toggleFollow}
          >
            {followStatus === 'following' ? 'Unfollow' : followStatus === 'pending' ? 'Requested' : 'Follow'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            useStore.getState().setPage('chat')
            useStore.getState().setActiveChatID(viewUserId)
          }}>
            💬 Message
          </button>
        </div>
        <div className="p-stats">
          <div><div className="p-stat-num">{posts.length}</div><div className="p-stat-lbl">Posts</div></div>
          <div><div className="p-stat-num">{followers.length}</div><div className="p-stat-lbl">Followers</div></div>
          <div><div className="p-stat-num">{following.length}</div><div className="p-stat-lbl">Following</div></div>
        </div>
      </div>

      {!isPrivate && (
        <>
          <div className="tabs">
            {['posts', 'followers', 'following'].map(t => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {tab === 'posts' && (
            posts.length === 0
              ? <div className="empty"><div className="ei">📭</div>No posts yet</div>
              : posts.map(p => <PostCard key={p.id} post={p} />)
          )}
          {tab === 'followers' && followers.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={u} size={38} />
              <div>{dname(u)}</div>
            </div>
          ))}
          {tab === 'following' && following.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar user={u} size={38} />
              <div>{dname(u)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
