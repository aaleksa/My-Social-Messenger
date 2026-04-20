"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import RightPanel from "@/components/RightPanel";

type Post = {
  id: number; user_id: number; content: string; image: string;
  privacy: string; created_at: string;
  author_first_name: string; author_last_name: string; author_avatar: string;
};
type UserMin = { id: number; first_name: string; last_name: string; avatar: string };

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [followers, setFollowers] = useState<UserMin[]>([]);
  const [allowedUsers, setAllowedUsers] = useState<Set<number>>(new Set());

  async function load() {
    try { setPosts((await api.listPosts()) || []); } catch {}
  }

  useEffect(() => {
    load();
    api.getMe().then((me: any) => setMeId(me?.id ?? null)).catch(() => {});
  }, []);

  async function handlePrivacyChange(val: string) {
    setPrivacy(val);
    setAllowedUsers(new Set());
    if (val === "private" && meId) {
      try {
        const f = (await api.listFollowers(meId)) || [];
        setFollowers(f);
      } catch {}
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setImage(await api.uploadImage(file)); } catch (err: any) { setError(err.message); }
  }

  function toggleAllowed(uid: number) {
    setAllowedUsers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: any = { content, privacy, image };
      if (privacy === "private") payload.allowed_users = Array.from(allowedUsers);
      await api.createPost(payload);
      setContent(""); setImage(""); setAllowedUsers(new Set());
      load();
    } catch (err: any) {
      setError(err.message);
    } finally { setSubmitting(false); }
  }

  return (
    <div style={{
      maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem",
      display: "flex", gap: "1.5rem", alignItems: "flex-start",
    }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Create post card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "1rem",
          boxShadow: "var(--shadow)", marginBottom: "1.25rem",
        }}>
          <form onSubmit={createPost}>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              style={{ marginBottom: "0.75rem", resize: "none" }}
            />
            {image && (
              <div style={{ marginBottom: "0.75rem", position: "relative", display: "inline-block" }}>
                <img src={image} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: "var(--radius)" }} />
                <button type="button" onClick={() => setImage("")} style={{
                  position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.5)",
                  color: "#fff", border: "none", borderRadius: "50%", width: 24, height: 24, fontSize: 12,
                }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                📷 Photo
                <input type="file" accept="image/*,.gif" onChange={handleImage} style={{ display: "none" }} />
              </label>
              <select value={privacy} onChange={e => handlePrivacyChange(e.target.value)}
                style={{ width: "auto", padding: "0.4rem 0.75rem", fontSize: 13 }}>
                <option value="public">🌍 Public</option>
                <option value="almost_private">👥 Followers only</option>
                <option value="private">🔒 Selected followers</option>
              </select>
              <button type="submit" disabled={submitting || !content.trim()} style={{
                marginLeft: "auto", background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: "var(--radius)", padding: "0.5rem 1.5rem",
                fontWeight: 600, fontSize: 14, opacity: submitting || !content.trim() ? .6 : 1,
              }}>
                {submitting ? "Posting…" : "Post"}
              </button>
            </div>

            {/* Follower selector for "private" posts */}
            {privacy === "private" && (
              <div style={{
                marginTop: "0.75rem", padding: "0.75rem",
                background: "var(--bg-input)", borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-muted)" }}>
                  Choose who can see this post:
                </p>
                {followers.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No followers yet. Post will be visible to no one.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: 180, overflowY: "auto" }}>
                    {followers.map((f: UserMin) => (
                      <label key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: 14 }}>
                        <input type="checkbox" checked={allowedUsers.has(f.id)} onChange={() => toggleAllowed(f.id)} />
                        {f.avatar
                          ? <img src={f.avatar} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
                          : <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{f.first_name?.[0]?.toUpperCase() || "?"}</span>
                        }
                        {f.first_name} {f.last_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p style={{ color: "var(--danger)", marginTop: "0.5rem", fontSize: 13 }}>{error}</p>}
          </form>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem 0" }}>
            <div style={{ fontSize: 48, marginBottom: "0.5rem" }}>📭</div>
            <p>No posts yet. Be the first to post!</p>
          </div>
        ) : posts.map(p => <PostCard key={p.id} post={p} />)}
      </main>

      <RightPanel />
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState("");

  async function loadComments() {
    try { setComments((await api.listComments(post.id)) || []); } catch {}
  }

  async function toggleComments() {
    if (!showComments) await loadComments();
    setShowComments(v => !v);
  }

  async function handleCommentImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setCommentImage(await api.uploadImage(file)); } catch {}
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;
    try {
      await api.createComment({ post_id: post.id, content: commentText, image: commentImage });
      setCommentText(""); setCommentImage("");
      loadComments();
    } catch {}
  }

  const privacyLabel: Record<string, string> = { public: "🌍", almost_private: "👥", private: "🔒" };

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", marginBottom: "1rem", boxShadow: "var(--shadow)",
      overflow: "hidden",
    }}>
      {/* Post header */}
      <div style={{ padding: "0.9rem 1rem 0.5rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: "var(--bg-input)",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          flexShrink: 0,
        }}>
          {post.author_avatar
            ? <img src={post.author_avatar} alt="" style={{ width: 40, height: 40, objectFit: "cover" }} />
            : <span style={{ fontWeight: 700, color: "var(--accent)" }}>{(post.author_first_name?.[0] || post.user_id).toString().toUpperCase()}</span>
          }
        </div>
        <div>
          <a href={`/profile/${post.user_id}`} style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", textDecoration: "none" }}>
            {post.author_first_name || post.author_last_name
              ? `${post.author_first_name} ${post.author_last_name}`.trim()
              : `User #${post.user_id}`}
          </a>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {new Date(post.created_at).toLocaleString()} · {privacyLabel[post.privacy] ?? ""}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "0.25rem 1rem 0.75rem", fontSize: 15 }}>{post.content}</div>

      {post.image && (
        <img src={post.image} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "cover" }} />
      )}

      {/* Actions */}
      <div style={{ borderTop: "1px solid var(--border)", display: "flex" }}>
        <button onClick={toggleComments} style={{
          flex: 1, padding: "0.6rem", background: "none", border: "none",
          color: "var(--text-muted)", fontSize: 14, fontWeight: 500,
          transition: "background .15s",
        }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
        >
          💬 Comment
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "0.75rem 1rem" }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "var(--bg-input)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
              }}>👤</div>
              <div style={{ background: "var(--bg-input)", borderRadius: "var(--radius)", padding: "0.4rem 0.75rem", fontSize: 14 }}>
                {c.content}
                {c.image && <img src={c.image} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: 200, marginTop: "0.4rem", borderRadius: "var(--radius)" }} />}
              </div>
            </div>
          ))}

          <form onSubmit={submitComment} style={{ marginTop: "0.5rem" }}>
            {commentImage && (
              <div style={{ marginBottom: "0.4rem", position: "relative", display: "inline-block" }}>
                <img src={commentImage} alt="" style={{ maxWidth: "100%", maxHeight: 120, borderRadius: "var(--radius)" }} />
                <button type="button" onClick={() => setCommentImage("")} style={{
                  position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.5)",
                  color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11,
                }}>✕</button>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontSize: 18, cursor: "pointer", color: "var(--accent)", flexShrink: 0 }} title="Add image">
                📷
                <input type="file" accept="image/*,.gif" onChange={handleCommentImage} style={{ display: "none" }} />
              </label>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                style={{ fontSize: 14, padding: "0.5rem 0.75rem", flex: 1 }}
              />
              <button type="submit" disabled={!commentText.trim() && !commentImage} style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: "var(--radius)", padding: "0.5rem 1rem", fontSize: 14, fontWeight: 600,
                flexShrink: 0, opacity: !commentText.trim() && !commentImage ? 0.5 : 1,
              }}>Send</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
