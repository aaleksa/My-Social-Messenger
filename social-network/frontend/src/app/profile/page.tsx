"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type User = {
  id: number; email: string; first_name: string; last_name: string;
  date_of_birth: string; avatar: string; nickname: string; about_me: string;
  is_public: boolean; created_at: string;
};

type UserMin = { id: number; first_name: string; last_name: string; avatar: string };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followers, setFollowers] = useState<UserMin[]>([]);
  const [following, setFollowing] = useState<UserMin[]>([]);
  const [pending, setPending] = useState<UserMin[]>([]);
  const [tab, setTab] = useState<"posts" | "followers" | "following" | "requests">("posts");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.getMe().then(async (u: User) => {
      setUser(u);
      setIsPublic(u.is_public);
      const [p, fols, fowing, reqs] = await Promise.all([
        api.listPosts({ user_id: u.id }).catch(() => []),
        api.listFollowers(u.id).catch(() => []),
        api.listFollowing(u.id).catch(() => []),
        api.listFollowRequests().catch(() => []),
      ]);
      setPosts(p || []);
      setFollowers(fols || []);
      setFollowing(fowing || []);
      setPending(reqs || []);
    }).catch(() => {});
  }, []);

  async function togglePrivacy() {
    if (!user) return;
    setSaving(true);
    setMsg("");
    const next = !isPublic;
    try {
      await api.updatePrivacy(next);
      setIsPublic(next);
      setMsg(next ? "Profile is now public" : "Profile is now private");
    } catch { setMsg("Failed to update"); }
    setSaving(false);
  }

  if (!user) return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <span style={{ color: "var(--text-muted)" }}>Loading…</span>
      </main>
    </div>
  );

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1 }}>
        {/* Profile card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden",
          marginBottom: "1.25rem",
        }}>
          {/* Cover */}
          <div style={{ height: 130, background: "linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)" }} />
          {/* Avatar + info */}
          <div style={{ padding: "0 1.5rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem", marginTop: -40, marginBottom: "1rem" }}>
              {user.avatar ? (
                <img src={user.avatar} alt="" style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--bg-card)", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: "50%", background: "var(--accent)",
                  border: "3px solid var(--bg-card)", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, flexShrink: 0,
                }}>
                  {user.first_name[0]}{user.last_name[0]}
                </div>
              )}
              <div style={{ paddingBottom: 4 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{user.first_name} {user.last_name}</h2>
                {user.nickname && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>@{user.nickname}</p>}
              </div>
            </div>

            {user.about_me && <p style={{ marginBottom: "0.75rem", fontSize: 15 }}>{user.about_me}</p>}

            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)", marginBottom: "1rem" }}>
              <span>📧 {user.email}</span>
              <span>🎂 {user.date_of_birth}</span>
              <span>📅 Joined {new Date(user.created_at).toLocaleDateString()}</span>
            </div>

            {/* Privacy toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
              <button onClick={togglePrivacy} disabled={saving} style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.45rem 1rem", borderRadius: "var(--radius)",
                border: "1px solid var(--border)", background: isPublic ? "#e7f3ff" : "var(--bg-input)",
                color: isPublic ? "var(--accent)" : "var(--text-muted)",
                fontSize: 14, fontWeight: 500,
              }}>
                {isPublic ? "🌍 Public" : "🔒 Private"}
              </button>
              {msg && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{msg}</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
          {(["posts", "followers", "following", "requests"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "0.4rem 1.1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500,
              border: "1px solid var(--border)", cursor: "pointer",
              background: tab === t ? "var(--accent)" : "var(--bg-card)",
              color: tab === t ? "#fff" : "var(--text)",
            }}>
              {t === "posts" ? `Posts (${posts.length})`
                : t === "followers" ? `Followers (${followers.length})`
                : t === "following" ? `Following (${following.length})`
                : `Requests${pending.length > 0 ? ` (${pending.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Posts */}
        {tab === "posts" && (
        posts.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
            No posts yet
          </div>
        ) : posts.map((p: any) => <PostCard key={p.id} post={p} meId={user!.id} onDelete={id => setPosts(prev => prev.filter((x: any) => x.id !== id))} />)
        )}

        {/* Followers */}
        {tab === "followers" && (
          followers.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No followers yet</div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
              {followers.map((f, i) => <UserRow key={f.id} u={f} last={i === followers.length - 1} />)}
            </div>
          )
        )}

        {/* Following */}
        {tab === "following" && (
          following.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>Not following anyone yet</div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
              {following.map((f, i) => <UserRow key={f.id} u={f} last={i === following.length - 1} />)}
            </div>
          )
        )}

        {/* Follow Requests */}
        {tab === "requests" && (
          pending.length === 0 ? (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No pending follow requests</div>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
              {pending.map((u, i) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: i < pending.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                    {(u.first_name[0] || "") + (u.last_name[0] || "")}
                  </div>
                  <div style={{ flex: 1 }}><strong>{u.first_name} {u.last_name}</strong></div>
                  <button onClick={async () => {
                    await api.respondToFollow(u.id, true).catch(() => {});
                    setPending(p => p.filter(x => x.id !== u.id));
                    setFollowers(p => [...p, u]);
                  }} style={{ padding: "0.35rem 0.9rem", borderRadius: "var(--radius)", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Accept</button>
                  <button onClick={async () => {
                    await api.respondToFollow(u.id, false).catch(() => {});
                    setPending(p => p.filter(x => x.id !== u.id));
                  }} style={{ padding: "0.35rem 0.9rem", borderRadius: "var(--radius)", background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border)", fontWeight: 500, fontSize: 13, cursor: "pointer" }}>Decline</button>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}

function PostCard({ post, meId, onDelete }: { post: any; meId: number | null; onDelete?: (id: number) => void }) {
  const [liked, setLiked] = useState(post.liked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [likeLoading, setLikeLoading] = useState(false);

  async function handleLike() {
    if (likeLoading) return;
    setLikeLoading(true);
    try { const r: any = await api.toggleLike(post.id); setLiked(r.liked); setLikesCount(r.likes); } catch {}
    setLikeLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this post?")) return;
    try { await api.deletePost(post.id); onDelete?.(post.id); } catch {}
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: "0.75rem", boxShadow: "var(--shadow)", overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <small style={{ color: "var(--text-muted)" }}>{new Date(post.created_at).toLocaleString()}</small>
        {meId === post.user_id && (
          <button onClick={handleDelete} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fa3e3e")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
            🗑
          </button>
        )}
      </div>
      <div style={{ padding: "0 1rem 0.75rem", fontSize: 15 }}>{post.content}</div>
      {post.image && <img src={post.image} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "cover" }} />}
      <div style={{ borderTop: "1px solid var(--border)", display: "flex" }}>
        <button onClick={handleLike} disabled={likeLoading} style={{ flex: 1, padding: "0.6rem", background: "none", border: "none", color: liked ? "#e0245e" : "var(--text-muted)", fontSize: 14, fontWeight: liked ? 600 : 500, cursor: "pointer" }}>
          {liked ? "❤️" : "🤍"} {likesCount > 0 ? likesCount : ""} Like
        </button>
      </div>
    </div>
  );
}

function UserRow({ u, last }: { u: UserMin; last: boolean }) {
  return (
    <a href={`/profile/${u.id}`} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: last ? "none" : "1px solid var(--border)", textDecoration: "none", color: "var(--text)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
    >
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {u.avatar ? <img src={u.avatar} alt="" style={{ width: 38, height: 38, objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>👤</span>}
      </div>
      <span style={{ fontWeight: 500, fontSize: 14 }}>{u.first_name} {u.last_name}</span>
    </a>
  );
}
