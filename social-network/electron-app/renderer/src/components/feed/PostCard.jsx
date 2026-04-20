import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { apiFetch, apiForm, API, dname, avSrc, fmtD, inits } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function PostCard({ post, onDelete }) {
  const { tok, me, users, setPage } = useStore()
  const postId = post.id || post.post_id   // normalize both shapes
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(null)
  const [cin, setCin] = useState('')
  const [cinImage, setCinImage] = useState(null)   // { file, url } or null
  const cinFileRef = useRef()
  const [liked, setLiked] = useState(post.liked || false)
  const [likesCount, setLikesCount] = useState(post.likes || 0)
  const [likeLoading, setLikeLoading] = useState(false)

  const author = users.find(u => u.id === post.user_id) || { id: post.user_id }

  async function loadComments() {
    if (comments !== null) { setShowComments(v => !v); return }
    try {
      const data = await apiFetch(tok, `/api/posts/comment?post_id=${postId}`)
      setComments(data || [])
      setShowComments(true)
    } catch (_) {}
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!cin.trim() && !cinImage) return
    try {
      let imageUrl = ''
      if (cinImage) {
        const fd = new FormData()
        fd.append('image', cinImage.file)
        const up = await apiForm(tok, '/api/upload', fd)
        imageUrl = (up?.url || '').replace('/uploads/', '')
      }
      const c = await apiFetch(tok, '/api/posts/comment', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, content: cin, image: imageUrl }),
      })
      setComments(prev => [...(prev || []), c])
      setCin('')
      setCinImage(null)
    } catch (_) {}
  }

  async function pickCommentFile() {
    if (window.electronAPI) {
      const p = await window.electronAPI.pickFile()
      if (p) {
        const r = await fetch('file://' + p)
        const blob = await r.blob()
        const file = new File([blob], p.split('/').pop(), { type: blob.type })
        setCinImage({ file, url: URL.createObjectURL(blob) })
      }
    } else {
      cinFileRef.current?.click()
    }
  }

  async function doLike() {
    if (likeLoading) return
    setLikeLoading(true)
    try {
      const res = await apiFetch(tok, '/api/posts/like', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId }),
      })
      setLiked(res.liked)
      setLikesCount(res.likes)
    } catch (_) {
      // optimistic fallback
      setLiked(v => !v)
      setLikesCount(c => liked ? c - 1 : c + 1)
    }
    setLikeLoading(false)
  }

  async function doDelete() {
    if (!confirm('Delete this post?')) return
    try {
      await apiFetch(tok, `/api/posts?id=${postId}`, { method: 'DELETE' })
      onDelete?.(postId)
    } catch (_) {}
  }

  return (
    <div className="post-card">
      <div className="post-head">
        <Avatar user={author} size={38} className="pav" />
        <div className="post-meta">
          <div className="post-author" style={{ cursor: 'pointer' }} onClick={() =>
            post.user_id === me?.id
              ? setPage('profile')
              : setPage('userprofile', { userId: post.user_id })
          }>{dname(author)}</div>
          <div className="post-time">{fmtD(post.created_at)}</div>
        </div>
        {post.user_id === me?.id && (
          <button className="post-btn" onClick={doDelete}><i className="bi bi-trash" /></button>
        )}
      </div>
      {post.content && <div className="post-body">{post.content}</div>}
      {post.image && <img className="post-img" src={`${API}/uploads/${post.image}`} alt="" />}
      <div className="post-foot">
        <button className={`post-btn ${liked ? 'liked' : ''}`} onClick={doLike} disabled={likeLoading}>
          <i className={`bi bi-heart${liked ? '-fill' : ''}`} /> {likesCount || 0}
        </button>
        <button className="post-btn" onClick={loadComments}>
          <i className="bi bi-chat" /> Comments
        </button>
      </div>
      {showComments && (
        <div className="comments-sec">
          {(comments || []).map(c => {
            const cu = users.find(u => u.id === c.user_id) || { id: c.user_id }
            return (
              <div key={c.id} className="comment">
                <Avatar user={cu} size={28} />
                <div className="comment-bubble">
                  <div className="comment-author">{dname(cu)}</div>
                  {c.content && <div className="comment-text">{c.content}</div>}
                  {c.image && (
                    <img
                      src={`${API}/uploads/${c.image}`}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginTop: 4, display: 'block' }}
                    />
                  )}
                </div>
              </div>
            )
          })}
          <form className="cin-row" onSubmit={submitComment}>
            {cinImage && (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
                <img src={cinImage.url} alt="" style={{ maxHeight: 100, borderRadius: 8 }} />
                <button
                  type="button"
                  onClick={() => setCinImage(null)}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', lineHeight: 1 }}
                >✕</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                className="post-btn"
                title="Attach image"
                onClick={pickCommentFile}
              ><i className="bi bi-image" /></button>
              <input
                className="cin"
                value={cin}
                onChange={e => setCin(e.target.value)}
                placeholder="Add a comment…"
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={!cin.trim() && !cinImage}>Post</button>
            </div>
            <input ref={cinFileRef} type="file" accept="image/*" hidden
              onChange={e => {
                const f = e.target.files[0]
                if (f) setCinImage({ file: f, url: URL.createObjectURL(f) })
                e.target.value = ''
              }}
            />
          </form>
        </div>
      )}
    </div>
  )
}
