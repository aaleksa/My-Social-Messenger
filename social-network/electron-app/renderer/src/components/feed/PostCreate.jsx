import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { apiForm, apiFetch } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function PostCreate({ onPost, groupId }) {
  const { tok, me } = useStore()
  const [content, setContent] = useState('')
  const [vis, setVis] = useState('public')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [followers, setFollowers] = useState([])
  const [allowed, setAllowed] = useState(new Set())
  const fileRef = useRef()

  useEffect(() => {
    if (vis === 'private' && me?.id) {
      apiFetch(tok, `/api/follow?user_id=${me.id}`)
        .then(d => setFollowers(d || []))
        .catch(() => {})
    }
  }, [vis, me?.id])

  function toggleAllowed(uid) {
    setAllowed(prev => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid); else next.add(uid)
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!content.trim() && !image) return
    setLoading(true)
    try {
      let imageUrl = ''
      if (image) {
        const fd = new FormData()
        fd.append('image', image)
        const up = await apiForm(tok, '/api/upload', fd)
        imageUrl = up?.url || ''
      }
      const body = {
        content,
        privacy: groupId ? 'public' : vis,
        image: imageUrl,
        ...(groupId ? { group_id: Number(groupId) } : {}),
        ...(vis === 'private' && allowed.size > 0 ? { allowed_users: [...allowed] } : {}),
      }
      const post = await apiFetch(tok, '/api/posts', { method: 'POST', body: JSON.stringify(body) })
      onPost?.(post)
      setContent(''); setImage(null); setAllowed(new Set())
    } catch (_) {}
    setLoading(false)
  }

  async function pickFile() {
    if (window.electronAPI) {
      const p = await window.electronAPI.pickFile()
      if (p) {
        const r = await fetch('file://' + p)
        const blob = await r.blob()
        setImage(new File([blob], p.split('/').pop(), { type: blob.type }))
      }
    } else {
      fileRef.current?.click()
    }
  }

  return (
    <form className="post-create" onSubmit={submit}>
      <div className="post-create-top">
        <Avatar user={me} size={38} className="pav" />
        <textarea
          className="post-inp"
          rows={3}
          placeholder="What's on your mind?"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </div>
      <div className="post-bar">
        <button type="button" className="pbar-btn" onClick={pickFile}>
          <i className="bi bi-image" /> Photo
        </button>
        {!groupId && (
          <select className="fg" style={{ padding: '5px 10px', fontSize: 12, background: 'var(--bg-mid)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8 }}
            value={vis} onChange={e => { setVis(e.target.value); setAllowed(new Set()) }}>
            <option value="public">🌍 Public</option>
            <option value="almost_private">👥 Followers</option>
            <option value="private">🔒 Private</option>
          </select>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading || (!content.trim() && !image)}>
          {loading ? <span className="spinner" /> : 'Post'}
        </button>
      </div>
      {image && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>📎 {image.name}</div>}
      {vis === 'private' && !groupId && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-mid)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>Choose who can see this post:</div>
          {followers.length === 0
            ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No followers yet — post will be visible to no one.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {followers.map(f => (
                  <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={allowed.has(f.id)} onChange={() => toggleAllowed(f.id)} />
                    <Avatar user={f} size={22} />
                    {f.first_name} {f.last_name}
                  </label>
                ))}
              </div>
          }
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => setImage(e.target.files[0])} />
    </form>
  )
}
