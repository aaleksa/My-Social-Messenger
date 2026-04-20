"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type User = {
  id: number;
  first_name: string;
  last_name: string;
  avatar: string;
  is_public: boolean;
  follow_status: "" | "accepted" | "pending";
};

export default function PeoplePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  function load() {
    api.listUsers()
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleFollow(u: User) {
    setBusy(u.id);
    try {
      if (u.follow_status === "accepted" || u.follow_status === "pending") {
        await api.unfollow(u.id);
      } else {
        await api.follow(u.id);
      }
      load();
    } catch {}
    setBusy(null);
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q);
  });

  function btnLabel(u: User) {
    if (busy === u.id) return "…";
    if (u.follow_status === "accepted") return "✓ Following";
    if (u.follow_status === "pending") return "⏳ Pending";
    return u.is_public ? "Follow" : "Request";
  }

  function btnStyle(u: User): React.CSSProperties {
    if (u.follow_status === "accepted") return {
      padding: "0.4rem 1rem", borderRadius: "var(--radius)", fontWeight: 500, fontSize: 13,
      border: "1.5px solid var(--border)", background: "transparent", color: "var(--text-muted)",
      cursor: busy === u.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all .15s",
    };
    if (u.follow_status === "pending") return {
      padding: "0.4rem 1rem", borderRadius: "var(--radius)", fontWeight: 500, fontSize: 13,
      border: "1.5px solid #d97706", background: "rgba(217,119,6,.12)", color: "#d97706",
      cursor: busy === u.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all .15s",
    };
    return {
      padding: "0.4rem 1rem", borderRadius: "var(--radius)", fontWeight: 500, fontSize: 13,
      border: "none", background: "var(--accent)", color: "#fff",
      cursor: busy === u.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all .15s",
    };
  }

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>People</h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{ width: 240, padding: "0.5rem 1rem", borderRadius: 20, fontSize: 14 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>
            <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>👤</div>
            <p>{search ? "Нікого не знайдено" : "Поки немає інших користувачів"}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
            {filtered.map(u => (
              <div key={u.id} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", boxShadow: "var(--shadow)",
                padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem",
              }}>
                {/* Avatar */}
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  background: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 20,
                  overflow: "hidden",
                }}>
                  {u.avatar
                    ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.toUpperCase() || "👤"
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`/profile/${u.id}`} style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}
                  >
                    {u.first_name} {u.last_name}
                  </a>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {u.is_public ? "🌍 Public" : "🔒 Private"}
                  </div>
                </div>

                {/* Follow button */}
                <button onClick={() => handleFollow(u)} disabled={busy === u.id} style={btnStyle(u)}>
                  {btnLabel(u)}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
