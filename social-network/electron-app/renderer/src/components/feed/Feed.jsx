import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch } from '../../lib/api'
import PostCreate from './PostCreate'
import PostCard from './PostCard'

const LIMIT = 20

export default function Feed() {
  const { tok } = useStore()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  async function loadPosts(off, append = false) {
    try {
      const data = await apiFetch(tok, `/api/posts?limit=${LIMIT}&offset=${off}`)
      const items = data || []
      if (append) setPosts(prev => [...prev, ...items])
      else setPosts(items)
      if (items.length < LIMIT) setHasMore(false)
      else setHasMore(true)
    } catch (_) {}
  }

  useEffect(() => {
    setLoading(true)
    loadPosts(0, false).finally(() => setLoading(false))
    setOffset(0)
  }, [tok])

  async function loadMore() {
    const next = offset + LIMIT
    setLoadingMore(true)
    await loadPosts(next, true)
    setOffset(next)
    setLoadingMore(false)
  }

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
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <button
            className="btn btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? <><span className="spinner" /> Loading…</> : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
