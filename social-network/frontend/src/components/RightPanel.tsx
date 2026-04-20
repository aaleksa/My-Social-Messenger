"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Notif = { id: number; content: string; is_read: boolean; created_at: string };

export default function RightPanel() {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    api.listNotifications()
      .then(data => setNotifs((data || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  const unread = notifs.filter(n => !n.is_read);

  return (
    <aside style={{
      position: "sticky", top: "calc(var(--navbar-h) + 1rem)",
      width: 260, flexShrink: 0,
    }}>
      {/* Notifications */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem", boxShadow: "var(--shadow)",
        marginBottom: "1rem",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h4 style={{ fontSize: 15, fontWeight: 600 }}>🔔 Notifications</h4>
          {unread.length > 0 && (
            <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 12 }}>
              {unread.length}
            </span>
          )}
        </div>
        {notifs.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No notifications</p>
        ) : notifs.map(n => (
          <div key={n.id} style={{
            padding: "0.5rem 0", borderBottom: "1px solid var(--border)",
            fontSize: 13, color: n.is_read ? "var(--text-muted)" : "var(--text)",
            fontWeight: n.is_read ? 400 : 500,
          }}>
            {n.content}
          </div>
        ))}
        {notifs.length > 0 && (
          <a href="/notifications" style={{ fontSize: 13, display: "block", marginTop: "0.5rem", color: "var(--accent)" }}>
            See all →
          </a>
        )}
      </div>

      {/* Quick links */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: "1rem", boxShadow: "var(--shadow)",
      }}>
        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: "0.75rem" }}>Quick Links</h4>
        {[
          { href: "/profile", label: "👤 My Profile" },
          { href: "/groups", label: "👥 My Groups" },
          { href: "/chat", label: "💬 Messages" },
        ].map(({ href, label }) => (
          <a key={href} href={href} style={{ display: "block", padding: "0.4rem 0", fontSize: 14, color: "var(--text)", textDecoration: "none" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--accent)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--text)"}
          >{label}</a>
        ))}
      </div>
    </aside>
  );
}
