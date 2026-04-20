"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useWS } from "@/lib/WebSocketContext";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span style={{
      position: "absolute", top: -4, right: -6,
      background: "#fa3e3e", color: "#fff",
      borderRadius: 10, padding: "1px 5px",
      fontSize: 10, fontWeight: 700, lineHeight: 1.4,
      minWidth: 16, textAlign: "center",
      pointerEvents: "none",
    }}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const { unreadNotifCount, unreadMsgCount, clearNotifCount, clearMsgCount, isConnected } = useWS();
  const [initNotif, setInitNotif] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      setDark(true);
    }
    api.listNotifications().then((notifs: any) => {
      if (Array.isArray(notifs)) setInitNotif(notifs.filter((n: any) => !n.is_read).length);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/notifications")) { setInitNotif(0); clearNotifCount(); }
    if (pathname.startsWith("/chat")) { clearMsgCount(); }
  }, [pathname, clearNotifCount, clearMsgCount]);

  const totalNotif = initNotif + unreadNotifCount;
  const totalMsg = unreadMsgCount;

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleLogout() {
    try { await api.logout(); } catch {}
    router.push("/login");
  }

  const isAuth = pathname !== "/login" && pathname !== "/register" && pathname !== "/";

  const navLinks = [
    { href: "/feed", label: "🏠 Feed", badge: 0 },
    { href: "/people", label: "🔍 People", badge: 0 },
    { href: "/groups", label: "👥 Groups", badge: 0 },
    { href: "/notifications", label: "🔔 Notifications", badge: totalNotif },
    { href: "/chat", label: "💬 Chat", badge: totalMsg },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "var(--navbar-h)",
      background: "var(--bg-card)", borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", padding: "0 1.25rem",
      justifyContent: "space-between", zIndex: 100, boxShadow: "var(--shadow)",
    }}>
      <a href={isAuth ? "/feed" : "/"} style={{ fontWeight: 700, fontSize: 22, color: "var(--accent)", textDecoration: "none" }}>
        SocialNet
      </a>

      {isAuth && (
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {navLinks.map(({ href, label, badge }) => (
            <a key={href} href={href} style={{
              position: "relative",
              padding: "0.4rem 0.85rem", borderRadius: "var(--radius)",
              fontWeight: pathname.startsWith(href) ? 600 : 400,
              background: pathname.startsWith(href) ? "var(--bg-hover)" : "transparent",
              color: pathname.startsWith(href) ? "var(--accent)" : "var(--text)",
              textDecoration: "none", fontSize: 14, transition: "background .15s",
              display: "inline-block",
            }}>
              {label}
              <Badge count={badge} />
            </a>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {isAuth && isConnected && (
          <span title="Real-time connected" style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>● LIVE</span>
        )}
        <button onClick={toggleTheme} title="Toggle theme" style={{
          background: "var(--bg-input)", border: "1px solid var(--border)",
          borderRadius: "50%", width: 36, height: 36, fontSize: 16, cursor: "pointer",
        }}>
          {dark ? "☀️" : "🌙"}
        </button>
        {isAuth && (
          <>
            <a href="/profile" style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none" }}>👤</a>
            <button onClick={handleLogout} style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "0.35rem 0.85rem",
              color: "var(--text-muted)", fontSize: 13, cursor: "pointer",
            }}>Logout</button>
          </>
        )}
      </div>
    </nav>
  );
}
