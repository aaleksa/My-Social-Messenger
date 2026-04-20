import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { apiForm } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function PostCreate({ onPost, groupId }) {
  const { tok, me } = useStore()
  const [content, setContent] = useState('')
  const [vis, setVis] = useState('public')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  async function submit(e) {
    e.preventDefault()
    if (!content.trim() && !image) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('content', content)
      fd.append('privacy', groupId ? 'group' : vis)
      if (groupId) fd.append('group_id', groupId)
      if (image) fd.append('image', image)
      const post = await apiForm(tok, '/api/posts', fd)
      onPost?.(post)
      setContent(''); setImage(null)
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
            value={vis} onChange={e => setVis(e.target.value)}>
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
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => setImage(e.target.files[0])} />
    </form>
  )
}
