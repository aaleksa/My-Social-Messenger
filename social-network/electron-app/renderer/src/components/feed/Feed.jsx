import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch } from '../../lib/api'
import PostCreate from './PostCreate'
import PostCard from './PostCard'

export default function Feed() {
  const { tok } = useStore()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(tok, '/api/posts')
      .then(data => setPosts(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tok])

  function addPost(p) { setPosts(prev => [p, ...prev]) }
  function removePost(id) { setPosts(prev => prev.filter(p => p.id !== id)) }

  return (
    <div>
      <div className="page-title"><i className="bi bi-house" /> Feed</div>
      <PostCreate onPost={addPost} />
      {loading && <div className="loading"><span className="spinner" /> Loading posts…</div>}
      {!loading && posts.length === 0 && (
        <div className="empty"><div className="ei">📭</div>No posts yet. Follow some people!</div>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} onDelete={removePost} />)}
    </div>
  )
}
