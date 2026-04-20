"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { useWS } from "@/lib/WebSocketContext";
import Sidebar from "@/components/Sidebar";

type Notif = {
  id: number;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  actor_id: number;
  reference_id: number;
  actor_first_name: string;
  actor_last_name: string;
  actor_avatar: string;
  group_title?: string;
};

const typeIcon: Record<string, string> = {
  follow:              "\uD83D\uDC64",
  follow_request:      "\uD83D\uDC64",
  follow_accept:       "\u2705",
  group_invite:        "\uD83D\uDC65",
  group_join_request:  "\uD83D\uDC65",
  group_join_accepted: "\uD83D\uDC65",
  group_event:         "\uD83D\uDCC5",
  post_comment:        "\uD83D\uDCAC",
  default:             "\uD83D\uDD14",
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const { lastMessage, clearNotifCount } = useWS();
  const loadedRef = useRef(false);

  useEffect(() => {
    api.getMe().then(setMe).catch(() => {});
    load();
    clearNotifCount();
  }, []);

  // Real-time: reload when new notification arrives
  useEffect(() => {
    if (lastMessage?.type === "notification" && loadedRef.current) {
      load();
    }
  }, [lastMessage]);

  async function load() {
    try {
      const data = await api.listNotifications();
      setNotifs(data || []);
      loadedRef.current = true;
    } catch {}
    finally { setLoading(false); }
  }

  async function markAll() {
    try {
      await api.markNotificationRead(undefined, true);
      setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    } catch {}
  }

  async function markOne(id: number) {
    try {
      await api.markNotificationRead(id);
      setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch {}
  }

  async function respondFollow(notif: Notif, accept: boolean) {
    setBusy(notif.id);
    setError(null);
    try {
      await api.respondToFollow(notif.actor_id, accept);
      try { await api.markNotificationRead(notif.id); } catch {}
      setNotifs(n => n.filter(x => x.id !== notif.id));
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setBusy(null);
  }

  async function respondGroupInvite(notif: Notif, accept: boolean) {
    setBusy(notif.id);
    setError(null);
    try {
      await api.respondToMembership({ group_id: notif.reference_id, user_id: me?.id, accept });
      try { await api.markNotificationRead(notif.id); } catch {}
      setNotifs(n => n.filter(x => x.id !== notif.id));
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setBusy(null);
  }

  async function respondGroupJoin(notif: Notif, accept: boolean) {
    setBusy(notif.id);
    setError(null);
    try {
      await api.respondToMembership({ group_id: notif.reference_id, user_id: notif.actor_id, accept });
      try { await api.markNotificationRead(notif.id); } catch {}
      setNotifs(n => n.filter(x => x.id !== notif.id));
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setBusy(null);
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;
  const actionTypes = ["follow_request", "group_invite", "group_join_request"];

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>🔔 Notifications</h2>
            {unreadCount > 0 && (
              <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 12, padding: "2px 9px", fontSize: 13, fontWeight: 600 }}>
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAll} style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "0.4rem 1rem",
              fontSize: 13, color: "var(--text-muted)", cursor: "pointer",
            }}>
              Mark all as read
            </button>
          )}
        </div>

        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #fa3e3e", borderRadius: "var(--radius)", padding: "0.6rem 1rem", marginBottom: "1rem", fontSize: 13, color: "#fa3e3e" }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem" }}>Loading…</div>
        ) : notifs.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "4rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>🔔</div>
            <p>No notifications yet</p>
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
            {notifs.map((n, i) => (
              <div
                key={n.id}
                onClick={() => !actionTypes.includes(n.type) && !n.is_read && markOne(n.id)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "0.9rem",
                  padding: "0.9rem 1.1rem",
                  borderBottom: i < notifs.length - 1 ? "1px solid var(--border)" : "none",
                  background: n.is_read ? "transparent" : "var(--bg-hover)",
                  cursor: (!actionTypes.includes(n.type) && !n.is_read) ? "pointer" : "default",
                  transition: "background .15s",
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: n.is_read ? "var(--bg-input)" : "#e7f3ff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 19, flexShrink: 0,
                }}>
                  {typeIcon[n.type] ?? typeIcon.default}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 600, color: "var(--text)", marginBottom: "0.2rem" }}>
                    {n.content || formatType(n.type, n.actor_id, n.reference_id, n.actor_first_name, n.actor_last_name, n.group_title)}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: actionTypes.includes(n.type) ? "0.6rem" : 0 }}>
                    {timeAgo(n.created_at)}
                  </p>

                  {n.type === "follow_request" && (
                    <ActionButtons
                      busy={busy === n.id}
                      onAccept={() => respondFollow(n, true)}
                      onDecline={() => respondFollow(n, false)}
                    />
                  )}
                  {n.type === "group_invite" && (
                    <ActionButtons
                      busy={busy === n.id}
                      onAccept={() => respondGroupInvite(n, true)}
                      onDecline={() => respondGroupInvite(n, false)}
                      acceptLabel="Join Group"
                      declineLabel="Decline"
                    />
                  )}
                  {n.type === "group_join_request" && (
                    <ActionButtons
                      busy={busy === n.id}
                      onAccept={() => respondGroupJoin(n, true)}
                      onDecline={() => respondGroupJoin(n, false)}
                      acceptLabel="Accept"
                      declineLabel="Decline"
                    />
                  )}
                </div>

                {!n.is_read && (
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ActionButtons({ busy, onAccept, onDecline, acceptLabel = "\u2713 Accept", declineLabel = "\u2715 Decline" }: {
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  acceptLabel?: string;
  declineLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button disabled={busy} onClick={e => { e.stopPropagation(); onAccept(); }}
        style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.35rem 1rem", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "…" : acceptLabel}
      </button>
      <button disabled={busy} onClick={e => { e.stopPropagation(); onDecline(); }}
        style={{ background: "transparent", color: "#fa3e3e", border: "1.5px solid #fa3e3e", borderRadius: "var(--radius)", padding: "0.35rem 1rem", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "…" : declineLabel}
      </button>
    </div>
  );
}

function formatType(type: string, actorId: number, refId: number, firstName: string, lastName: string, groupTitle?: string): string {
  const name = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : `User #${actorId}`;
  const group = groupTitle || `group #${refId}`;
  switch (type) {
    case "follow":               return `${name} started following you`;
    case "follow_request":       return `${name} sent you a follow request`;
    case "follow_accept":        return `${name} accepted your follow request`;
    case "group_invite":         return `You were invited to join "${group}"`;
    case "group_join_request":   return `${name} wants to join "${group}"`;
    case "group_join_accepted":  return `Your request to join "${group}" was accepted`;
    case "group_event":          return `New event in "${group}"`;
    case "post_comment":         return `${name} commented on your post`;
    default:                     return type.replace(/_/g, " ");
  }
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // Replace space separator with T (SQLite format)
  let s = dateStr.replace(" ", "T");
  // If no timezone info at all, assume UTC
  if (!/[Z+\-]\d*$/.test(s) && !/Z$/.test(s)) s += "Z";
  return new Date(s);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - parseDate(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return parseDate(dateStr).toLocaleDateString();
}
