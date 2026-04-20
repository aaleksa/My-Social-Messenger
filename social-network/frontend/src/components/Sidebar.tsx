"use client";
import { usePathname } from "next/navigation";

const links = [
  { href: "/feed",          icon: "🏠", label: "Feed" },
  { href: "/profile",       icon: "👤", label: "Profile" },
  { href: "/people",        icon: "🔍", label: "People" },
  { href: "/groups",        icon: "👥", label: "Groups" },
  { href: "/notifications", icon: "🔔", label: "Notifications" },
  { href: "/chat",          icon: "💬", label: "Messages" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{
      position: "sticky", top: "calc(var(--navbar-h) + 1rem)",
      width: 220, flexShrink: 0,
    }}>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {links.map(({ href, icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <a key={href} href={href} style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              padding: "0.6rem 0.85rem", borderRadius: "var(--radius)",
              background: active ? "var(--bg-hover)" : "transparent",
              color: active ? "var(--accent)" : "var(--text)",
              fontWeight: active ? 600 : 400,
              fontSize: 15, textDecoration: "none",
              transition: "background .15s",
            }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
              {label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
