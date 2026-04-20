"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type User = {
  id: number; first_name: string; last_name: string;
  avatar: string; nickname: string; about_me: string;
  date_of_birth: string;
  is_public: boolean; created_at: string;
  restricted?: boolean;
  email?: string;
};

type UserMin = { id: number; first_name: string; last_name: string; avatar: string };

export default function UserProfilePage() {
  const { id } = useParams();
  const uid = Number(id);
  const [user, setUser] = useState<User | null>(null);
  const [me, setMe] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [followers, setFollowers] = useState<UserMin[]>([]);
  const [following, setFollowing] = useState<UserMin[]>([]);
  const [followStatus, setFollowStatus] = useState<"none" | "pending" | "following">("none");
  const [tab, setTab] = useState<"posts" | "followers" | "following">("posts");
  const [loading, setLoading] = useState(true);
  const [privacyBusy, setPrivacyBusy] = useState(false);

  async function load() {
    if (!uid) return;
    try {
      const [u, meData, fols, fowing] = await Promise.all([
        api.getProfile(uid),
        api.getMe().catch(() => null),
        api.listFollowers(uid),
        api.listFollowing(uid),
      ]);
      setUser(u);
      setMe(meData);
      setFollowers(fols || []);
      setFollowing(fowing || []);
      if (meData) {
        const allFols = fols || [];
        const isFollowing = allFols.some((f: any) => f.id === meData.id);
        const isPending = false; // need separate check
        // check pending in full follower list
        const rawFols = await api.listFollowers(uid).catch(() => []);
        // rawFols are accepted, check pending via follow status on people endpoint
        setFollowStatus(isFollowing ? "following" : "none");
        // Actually check pending by calling listUsers
        const users = await api.listUsers().catch(() => []);
        const uRecord = (users || []).find((x: any) => x.id === uid);
        if (uRecord) {
          if (uRecord.follow_status === "accepted") setFollowStatus("following");
          else if (uRecord.follow_status === "pending") setFollowStatus("pending");
          else setFollowStatus("none");
        }
      }
      if (!u.restricted) {
        const p = await api.listPosts({ user_id: uid }).catch(() => []);
        setPosts(p || []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [uid]);

  async function handleFollow() {
    if (followStatus === "following") {
      await api.unfollow(uid).catch(() => {});
      setFollowStatus("none");
    } else if (followStatus === "none") {
      await api.follow(uid).catch(() => {});
      setFollowStatus(user?.is_public ? "following" : "pending");
    }
  }

  async function togglePrivacy() {
    if (!user || !me || user.id !== me.id) return;
    setPrivacyBusy(true);
    try {
      await api.updatePrivacy(!user.is_public);
      setUser(u => u ? { ...u, is_public: !u.is_public } : u);
    } catch {}
    setPrivacyBusy(false);
  }

  const isOwnProfile = me && user && me.id === user.id;

  if (loading) return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <span style={{ color: "var(--text-muted)" }}>Loading...</span>
      </main>
    </div>
  );

  if (!user) return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>User not found</main>
    </div>
  );

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1 }}>

        {/* Profile card */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden", marginBottom: "1.25rem" }}>
          <div style={{ height: 130, background: "linear-gradient(135deg, #8b5cf6 0%, var(--accent) 100%)" }} />
          <div style={{ padding: "0 1.5rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -40, marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem" }}>
                {user.avatar ? (
                  <img src={user.avatar} alt="" style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--bg-card)", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--accent)", border: "3px solid var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, flexShrink: 0 }}>
                    {user.first_name?.[0]}{user.last_name?.[0]}
                  </div>
                )}
                <div style={{ paddingBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700 }}>{user.first_name} {user.last_name}</h2>
                  {user.nickname && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>@{user.nickname}</p>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: 44 }}>
                {isOwnProfile ? (
                  <button onClick={togglePrivacy} disabled={privacyBusy} style={{ padding: "0.5rem 1.1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", cursor: "pointer", opacity: privacyBusy ? 0.6 : 1 }}>
                    {user.is_public ? "🌍 Set Private" : "🔒 Set Public"}
                  </button>
                ) : (
                  <>
                    <button onClick={handleFollow} style={{
                      padding: "0.5rem 1.25rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                      border: followStatus === "pending" ? "1.5px solid #d97706" : "none",
                      background: followStatus === "following" ? "var(--bg-input)" : followStatus === "pending" ? "rgba(217,119,6,.12)" : "var(--accent)",
                      color: followStatus === "following" ? "var(--text)" : followStatus === "pending" ? "#d97706" : "#fff",
                    }}>
                      {followStatus === "following" ? "✓ Following" : followStatus === "pending" ? "⏳ Pending" : "+ Follow"}
                    </button>
                    <a href={`/chat?userId=${user.id}`} style={{
                      padding: "0.5rem 1.1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600,
                      border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text)",
                      textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    }}>
                      💬 Message
                    </a>
                  </>
                )}
              </div>
            </div>

            {user.about_me && <p style={{ marginBottom: "0.5rem" }}>{user.about_me}</p>}
            <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <span>{user.is_public ? "🌍 Public" : "🔒 Private"}</span>
              {user.date_of_birth && <span>🎂 {user.date_of_birth}</span>}
              <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
              <span>{followers.length} followers · {following.length} following</span>
            </div>
          </div>
        </div>

        {/* Restricted */}
        {user.restricted ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: "0.75rem" }}>🔒</div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>This profile is private</p>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Follow this user to see their posts</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {(["posts", "followers", "following"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "0.4rem 1.1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500,
                  border: "1px solid var(--border)", cursor: "pointer",
                  background: tab === t ? "var(--accent)" : "var(--bg-card)",
                  color: tab === t ? "#fff" : "var(--text)",
                }}>
                  {t === "posts" ? `Posts (${posts.length})` : t === "followers" ? `Followers (${followers.length})` : `Following (${following.length})`}
                </button>
              ))}
            </div>

            {/* Posts */}
            {tab === "posts" && (
              posts.length === 0 ? (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No posts yet</div>
              ) : posts.map((p: any) => <PostCard key={p.id} post={p} meId={me?.id ?? null} onDelete={id => setPosts(prev => prev.filter((x: any) => x.id !== id))} />)
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
          </>
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
