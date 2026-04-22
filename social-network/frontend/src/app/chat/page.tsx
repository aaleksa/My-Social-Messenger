"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useWS } from "@/lib/WebSocketContext";
import Sidebar from "@/components/Sidebar";

type Message = {
  id?: number;
  sender_id: number;
  recipient_id?: number;
  group_id?: number;
  content: string;
  created_at: string;
};
type Contact = { id: number; type: "user" | "group"; name: string };

const EMOJIS = [
  "\uD83D\uDE00","\uD83D\uDE02","\uD83D\uDE04","\uD83D\uDE06","\uD83D\uDE09","\uD83D\uDE0D","\uD83D\uDE18","\uD83D\uDE1C",
  "\uD83D\uDE2D","\uD83D\uDE21","\uD83D\uDE31","\uD83E\uDD73","\uD83E\uDD14","\uD83D\uDC4D","\uD83D\uDC4E","\uD83D\uDC4F",
  "\uD83D\uDD25","\u2764\uFE0F","\uD83D\uDCA5","\uD83C\uDF89","\uD83C\uDF81","\uD83D\uDE80","\uD83C\uDF1F","\u2728",
  "\uD83D\uDC36","\uD83D\uDC31","\uD83D\uDC3C","\uD83D\uDC38","\uD83E\uDD8A","\uD83D\uDE4F","\uD83E\uDD1D","\uD83D\uDCF8",
];

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const [me, setMe] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams ? Number(searchParams.get("userId")) : 0;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef = useRef<Contact | null>(null);
  selectedRef.current = selected;

  const { lastMessage } = useWS();

  // Load contacts on mount
  useEffect(() => {
    api.getMe()
      .then(async (u) => {
        setMe(u);
        const [allUsers, groups] = await Promise.all([
          api.listUsers().catch(() => []),
          api.listGroups().catch(() => []),
        ]);
        const userContacts: Contact[] = (Array.isArray(allUsers) ? allUsers : [])
          .filter((user: any) => user.follow_status === "accepted" || user.following_me_status === "accepted")
          .map((user: any) => ({
            id: user.id,
            type: "user" as const,
            name: `${user.first_name} ${user.last_name}`.trim() || `User #${user.id}`,
          }));
        const groupContacts: Contact[] = (Array.isArray(groups) ? groups : [])
          .filter((g: any) => g.my_status === "accepted")
          .map((g: any) => ({ id: g.id, type: "group" as const, name: g.title || `Group #${g.id}` }));
        setContacts([...userContacts, ...groupContacts]);
        // auto-select contact from URL param
        if (preselectedUserId) {
          const target = userContacts.find(c => c.id === preselectedUserId);
          if (target) setSelected(target);
          else {
            // user not in contacts yet — add them and select
            const u = (Array.isArray(allUsers) ? allUsers : []).find((x: any) => x.id === preselectedUserId);
            if (u) {
              const c: Contact = { id: u.id, type: "user", name: `${u.first_name} ${u.last_name}`.trim() || `User #${u.id}` };
              setContacts(prev => [c, ...prev]);
              setSelected(c);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Reload messages when contact changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    const load = () => {
      if (selected.type === "user") {
        api.getMessages(selected.id).then(m => setMessages(Array.isArray(m) ? m : [])).catch(() => {});
      } else {
        api.getGroupMessages(selected.id).then(m => setMessages(Array.isArray(m) ? m : [])).catch(() => {});
      }
    };
    load();
    // Fallback poll every 10s
    pollRef.current = setInterval(load, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    const sel = selectedRef.current;
    if (!sel) return;
    if (
      lastMessage.type === "chat_message" &&
      sel.type === "user" &&
      (lastMessage.sender_id === sel.id || lastMessage.recipient_id === sel.id)
    ) {
      setMessages(prev => [...prev, {
        sender_id: lastMessage.sender_id ?? 0,
        recipient_id: lastMessage.recipient_id,
        content: lastMessage.content,
        created_at: lastMessage.created_at,
      }]);
    } else if (
      lastMessage.type === "group_message" &&
      sel.type === "group" &&
      lastMessage.group_id === sel.id
    ) {
      setMessages(prev => [...prev, {
        sender_id: lastMessage.sender_id ?? 0,
        group_id: lastMessage.group_id,
        content: lastMessage.content,
        created_at: lastMessage.created_at,
      }]);
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    const content = text.trim();
    setText("");
    setShowEmoji(false);
    try {
      if (selected.type === "user") {
        await api.sendMessage(selected.id, content);
        // Optimistic: append our own message (WS won't send to ourselves)
        setMessages(prev => [...prev, {
          sender_id: me?.id,
          recipient_id: selected.id,
          content,
          created_at: new Date().toISOString(),
        }]);
      } else {
        await api.sendGroupMessage(selected.id, content);
        setMessages(prev => [...prev, {
          sender_id: me?.id,
          group_id: selected.id,
          content,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to send message");
    }
  }

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: "1.25rem" }}>💬 Messages</h2>
        <div style={{
          display: "flex", gap: 0, background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", overflow: "visible",
          height: "75vh", minHeight: 480,
        }}>
          {/* Contacts list */}
          <div style={{
            width: 240, flexShrink: 0, borderRight: "1px solid var(--border)",
            overflowY: "auto", display: "flex", flexDirection: "column",
            borderRadius: "var(--radius) 0 0 var(--radius)",
          }}>
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14, color: "var(--text-muted)" }}>
              Conversations
            </div>
            {contacts.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                <a href="/people" style={{ color: "var(--accent)" }}>Find people</a> and follow them to start chatting
              </div>
            ) : contacts.map(c => (
              <div
                key={`${c.type}-${c.id}`}
                onClick={() => setSelected(c)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.65rem",
                  padding: "0.75rem 1rem", cursor: "pointer",
                  background: selected?.id === c.id && selected?.type === c.type ? "var(--bg-hover)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                  transition: "background .15s",
                }}
                onMouseEnter={e => { if (!(selected?.id === c.id && selected?.type === c.type)) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!(selected?.id === c.id && selected?.type === c.type)) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: c.type === "group" ? "#8b5cf6" : "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0,
                }}>
                  {c.type === "group" ? "👥" : c.name.trim()[0]?.toUpperCase() || "#"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.type === "group" ? "Group chat" : "Direct message"}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Chat area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", borderRadius: "0 var(--radius) var(--radius) 0", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 15, display: "flex", alignItems: "center", gap: "0.65rem", minHeight: 56 }}>
              {selected ? (
                <>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: selected.type === "group" ? "#8b5cf6" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14 }}>
                    {selected.type === "group" ? "👥" : "👤"}
                  </div>
                  {selected.name}
                </>
              ) : (
                <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>Select a conversation</span>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {!selected && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>💬</div>
                  <p>Select a conversation to start chatting</p>
                </div>
              )}
              {selected && messages.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, marginTop: "2rem" }}>No messages yet. Say hi! 👋</p>
              )}
              {messages.map((m, i) => {
                const isMine = me && m.sender_id === me.id;
                return (
                  <div key={m.id ?? i} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "65%", padding: "0.55rem 0.9rem",
                      borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isMine ? "var(--accent)" : "var(--bg-input)",
                      color: isMine ? "#fff" : "var(--text)",
                      fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                    }}>
                      {m.content}
                      <div style={{ fontSize: 10, opacity: .65, marginTop: "0.2rem", textAlign: "right" }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Emoji picker */}
            {showEmoji && (
              <div style={{
                position: "absolute", bottom: 68, right: 12,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "0.6rem",
                display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 4,
                zIndex: 10, boxShadow: "var(--shadow)",
              }}>
                {EMOJIS.map(em => (
                  <button key={em} onClick={() => setText(t => t + em)}
                    style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", borderRadius: 4, padding: "2px 4px", lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
                  >{em}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={send} style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem", alignItems: "center", background: "var(--bg-card)" }}>
              <button type="button" onClick={() => setShowEmoji(s => !s)}
                title="Emoji"
                style={{ background: "none", border: "none", fontSize: 22, cursor: selected ? "pointer" : "not-allowed", opacity: selected ? 1 : 0.4, flexShrink: 0 }}>
                😄
              </button>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e as any); } }}
                placeholder={selected ? "Write a message…" : "Select a conversation first…"}
                disabled={!selected}
                autoComplete="off"
                style={{
                  flex: 1, borderRadius: 20, padding: "0.6rem 1.1rem",
                  border: "1.5px solid var(--border)",
                  background: selected ? "var(--bg-input, var(--bg))" : "var(--bg)",
                  color: "var(--text)", fontSize: 14, outline: "none",
                  opacity: selected ? 1 : 0.5,
                }}
                onFocus={e => { if (selected) e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                type="submit"
                disabled={!text.trim() || !selected}
                title="Send"
                style={{
                  background: (text.trim() && selected) ? "var(--accent)" : "var(--border)",
                  color: "#fff", border: "none", borderRadius: "50%",
                  width: 40, height: 40, fontSize: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: (text.trim() && selected) ? "pointer" : "not-allowed",
                  flexShrink: 0, transition: "background .15s",
                }}
              >➤</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
