import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch, apiForm, dname, avSrc, API } from '../../lib/api'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'
import PostCard from '../feed/PostCard'

export default function Profile() {
  const { tok, me, setMe } = useStore()
  const [posts, setPosts] = useState([])
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [tab, setTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({})
  const [avatarFile, setAvatarFile] = useState(null)

  const [pending, setPending] = useState([])

  useEffect(() => {
    if (!me) return
    apiFetch(tok, `/api/posts?user_id=${me.id}`).then(d => setPosts(d || [])).catch(() => {})
    apiFetch(tok, `/api/follow?user_id=${me.id}`).then(d => setFollowers(Array.isArray(d) ? d : [])).catch(() => {})
    apiFetch(tok, `/api/follow/following?user_id=${me.id}`).then(d => setFollowing(Array.isArray(d) ? d : [])).catch(() => {})
    apiFetch(tok, `/api/follow/requests`).then(d => setPending(Array.isArray(d) ? d : [])).catch(() => {})
    setForm({
      first_name: me.first_name || '',
      last_name: me.last_name || '',
      nickname: me.nickname || '',
      about_me: me.about_me || '',
      privacy: me.is_public === false ? 'private' : 'public',
    })
  }, [me?.id])

  async function saveProfile(e) {
    e.preventDefault()
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (avatarFile) fd.append('avatar', avatarFile)
      const u = await apiForm(tok, '/api/profile', fd)
      setMe({ ...me, ...u })
      setShowEdit(false)
    } catch (_) {}
  }

  if (!me) return null
  const avUrl = avSrc(me)

  return (
    <div>
      <div className="profile-cover" />
      <div className="profile-card">
        <div className="p-info">
          <div className="p-big-av">
            {avUrl ? <img src={avUrl} alt="" /> : <span style={{ fontSize: 26 }}>{dname(me).slice(0,2).toUpperCase()}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div className="p-name">{dname(me)}</div>
            {me.nickname && <div className="p-nick">@{me.nickname}</div>}
            {me.about_me && <div className="p-bio">{me.about_me}</div>}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
            <i className="bi bi-pencil" /> Edit Profile
          </button>
        </div>
        <div className="p-stats">
          <div><div className="p-stat-num">{posts.length}</div><div className="p-stat-lbl">Posts</div></div>
          <div><div className="p-stat-num">{followers.length}</div><div className="p-stat-lbl">Followers</div></div>
          <div><div className="p-stat-num">{following.length}</div><div className="p-stat-lbl">Following</div></div>
        </div>
      </div>

      <div className="tabs">
        {['posts', 'followers', 'following', 'requests'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'requests'
              ? `Requests${pending.length > 0 ? ` (${pending.length})` : ''}`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'posts' && posts.map(p => <PostCard key={p.id} post={p} onDelete={id => setPosts(pp => pp.filter(x => x.id !== id))} />)}
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
      {tab === 'requests' && (
        pending.length === 0
          ? <div className="empty"><div className="ei">🤝</div>No pending requests</div>
          : pending.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar user={u} size={38} />
              <div style={{ flex: 1 }}>{dname(u)}</div>
              <button className="btn btn-primary btn-sm" onClick={async () => {
                await apiFetch(tok, '/api/follow/respond', { method: 'POST', body: JSON.stringify({ follower_id: u.id, accept: true }) }).catch(() => {})
                setPending(p => p.filter(x => x.id !== u.id))
                setFollowers(p => [...p, u])
              }}>Accept</button>
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                await apiFetch(tok, '/api/follow/respond', { method: 'POST', body: JSON.stringify({ follower_id: u.id, accept: false }) }).catch(() => {})
                setPending(p => p.filter(x => x.id !== u.id))
              }}>Decline</button>
            </div>
          ))
      )}

      {showEdit && (
        <Modal title="Edit Profile" onClose={() => setShowEdit(false)}>
          <form onSubmit={saveProfile}>
            <div className="fg"><label>First Name</label><input value={form.first_name} onChange={e => setForm(p => ({...p, first_name: e.target.value}))} /></div>
            <div className="fg"><label>Last Name</label><input value={form.last_name} onChange={e => setForm(p => ({...p, last_name: e.target.value}))} /></div>
            <div className="fg"><label>Nickname</label><input value={form.nickname} onChange={e => setForm(p => ({...p, nickname: e.target.value}))} /></div>
            <div className="fg"><label>About Me</label><textarea value={form.about_me} onChange={e => setForm(p => ({...p, about_me: e.target.value}))} /></div>
            <div className="fg"><label>Privacy</label>
              <select value={form.privacy} onChange={e => setForm(p => ({...p, privacy: e.target.value}))}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="fg"><label>Avatar</label><input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} /></div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Save</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
