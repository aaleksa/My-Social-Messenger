import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch, API, dname, avSrc, fmtD, inits } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function PostCard({ post, onDelete }) {
  const { tok, me, users, setPage } = useStore()
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(null)
  const [cin, setCin] = useState('')
  const [liked, setLiked] = useState(false)

  const author = users.find(u => u.id === post.user_id) || { id: post.user_id }

  async function loadComments() {
    if (comments !== null) { setShowComments(v => !v); return }
    try {
      const data = await apiFetch(tok, `/api/posts/${post.id}/comments`)
      setComments(data || [])
      setShowComments(true)
    } catch (_) {}
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!cin.trim()) return
    try {
      const c = await apiFetch(tok, `/api/posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: cin }),
      })
      setComments(prev => [...(prev || []), c])
      setCin('')
    } catch (_) {}
  }

  async function doDelete() {
    if (!confirm('Delete this post?')) return
    try {
      await apiFetch(tok, `/api/posts/${post.id}`, { method: 'DELETE' })
      onDelete?.(post.id)
    } catch (_) {}
  }

  return (
    <div className="post-card">
      <div className="post-head">
        <Avatar user={author} size={38} className="pav" />
        <div className="post-meta">
          <div className="post-author" onClick={() => setPage('profile')}>{dname(author)}</div>
          <div className="post-time">{fmtD(post.created_at)}</div>
        </div>
        {post.user_id === me?.id && (
          <button className="post-btn" onClick={doDelete}><i className="bi bi-trash" /></button>
        )}
      </div>
      {post.content && <div className="post-body">{post.content}</div>}
      {post.image && <img className="post-img" src={`${API}/uploads/${post.image}`} alt="" />}
      <div className="post-foot">
        <button className={`post-btn ${liked ? 'liked' : ''}`} onClick={() => setLiked(v => !v)}>
          <i className={`bi bi-heart${liked ? '-fill' : ''}`} /> {(post.likes || 0) + (liked ? 1 : 0)}
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
                  <div className="comment-text">{c.content}</div>
                </div>
              </div>
            )
          })}
          <form className="cin-row" onSubmit={submitComment}>
            <input className="cin" value={cin} onChange={e => setCin(e.target.value)} placeholder="Add a comment…" />
            <button className="btn btn-primary btn-sm" type="submit">Post</button>
          </form>
        </div>
      )}
    </div>
  )
}
