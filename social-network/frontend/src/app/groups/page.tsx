"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Sidebar from "@/components/Sidebar";

type Group = { id: number; creator_id: number; title: string; description: string; created_at: string; my_status: string; member_count: number };

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [tab, setTab] = useState<"all" | "create">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    api.getMe().then(setMe).catch(() => {});
    load();
  }, []);

  async function load() {
    try { setGroups((await api.listGroups()) || []); } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true); setError("");
    try {
      const res = await api.createGroup({ title, description });
      setTitle(""); setDescription("");
      setTab("all");
      load();
      router.push(`/groups/${res.group_id}`);
    } catch (err: any) { setError(err.message); }
    setSubmitting(false);
  }

  async function handleJoin(groupId: number) {
    try { await api.requestJoin(groupId); load(); } catch {}
  }

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>👥 Groups</h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <TabBtn active={tab === "all"} onClick={() => setTab("all")}>All Groups</TabBtn>
            <TabBtn active={tab === "create"} onClick={() => setTab("create")}>+ Create</TabBtn>
          </div>
        </div>

        {/* Create form */}
        {tab === "create" && (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "1.5rem", marginBottom: "1.25rem", boxShadow: "var(--shadow)",
          }}>
            <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Create a new group</h3>
            <form onSubmit={handleCreate}>
              <input
                placeholder="Group name *"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                style={{ marginBottom: "0.75rem" }}
              />
              <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ marginBottom: "0.75rem", resize: "none" }}
              />
              {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: "0.5rem" }}>{error}</p>}
              <button type="submit" disabled={submitting || !title.trim()} style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: "var(--radius)", padding: "0.6rem 1.5rem",
                fontWeight: 600, fontSize: 14, opacity: submitting ? .6 : 1,
              }}>
                {submitting ? "Creating…" : "Create Group"}
              </button>
            </form>
          </div>
        )}

        {/* Groups list */}
        {groups.length === 0 ? (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", padding: "3rem", textAlign: "center", color: "var(--text-muted)",
          }}>
            <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>👥</div>
            <p>No groups yet. Be the first to create one!</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {groups.map(g => (
              <GroupCard key={g.id} group={g} isOwner={me?.id === g.creator_id} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function GroupCard({ group, isOwner, onJoin }: { group: Group; isOwner: boolean; onJoin: (id: number) => void }) {
  const statusLabel: Record<string, string> = { accepted: "Member", pending: "Pending", invited: "Invited" };
  const isMember = group.my_status === "accepted";
  const isPending = group.my_status === "pending" || group.my_status === "invited";
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)",
    }}>
      {/* Color banner */}
      <div style={{ height: 60, background: `hsl(${(group.id * 47) % 360}, 55%, 55%)`, display: "flex", alignItems: "center", paddingLeft: "1rem" }}>
        <span style={{ fontSize: 28 }}>👥</span>
      </div>
      <div style={{ padding: "0.9rem 1rem 1rem" }}>
        <a href={`/groups/${group.id}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", textDecoration: "none", display: "block", marginBottom: "0.35rem" }}>
          {group.title}
        </a>
        {group.description && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: "0.75rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {group.description}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            👤 {group.member_count}
            {isOwner && <span style={{ marginLeft: "0.4rem", background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", fontSize: 11 }}>Owner</span>}
          </span>
          {isOwner ? (
            <a href={`/groups/${group.id}`} style={{
              background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "0.35rem 0.85rem", fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>Manage →</a>
          ) : isMember ? (
            <a href={`/groups/${group.id}`} style={{
              background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "0.35rem 0.85rem", fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>Open →</a>
          ) : isPending ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.35rem 0.85rem" }}>
              {statusLabel[group.my_status] ?? "Pending"}
            </span>
          ) : (
            <button onClick={() => onJoin(group.id)} style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: "var(--radius)", padding: "0.35rem 0.85rem", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.4rem 1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500,
      border: "1px solid var(--border)", cursor: "pointer",
      background: active ? "var(--accent)" : "var(--bg-card)",
      color: active ? "#fff" : "var(--text)",
    }}>
      {children}
    </button>
  );
}
