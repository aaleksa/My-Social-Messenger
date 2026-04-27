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
type GroupMember = { user_id: number; first_name: string; last_name: string; avatar: string };

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
  // ...existing state...
  const [selected, setSelected] = useState<Contact | null>(null);
  // Pinned messages state
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [showPinned, setShowPinned] = useState(false);

  // Load pinned messages when selected changes
  useEffect(() => {
    if (!selected) return setPinnedIds([]);
    if (selected.type === "user") {
      api.listPinnedMessages(selected.id, undefined).then(setPinnedIds).catch(() => setPinnedIds([]));
    } else {
      api.listPinnedMessages(undefined, selected.id).then(setPinnedIds).catch(() => setPinnedIds([]));
    }
  }, [selected]);
  // Search state
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]|null>(null);
  const [searching, setSearching] = useState(false);

    // Search handler
    async function handleSearch(e: React.FormEvent) {
      e.preventDefault();
      if (!search.trim() || !selected) return;
      setSearching(true);
      try {
        let results: Message[] = [];
        if (selected.type === "user") {
          results = await api.searchMessages(selected.id, search.trim());
        } else {
          results = await api.searchGroupMessages(selected.id, search.trim());
        }
        setSearchResults(results);
      } catch (err: any) {
        alert(err?.message || "Search failed");
      }
      setSearching(false);
    }
  // ...existing state...
  const [forwardingMsg, setForwardingMsg] = useState<{id: number, isGroup: boolean}|null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  // ...existing state...
  const [reactions, setReactions] = useState<Record<number, { [emoji: string]: number; mine: string[] }>>({});
  const [me, setMe] = useState<any>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams ? Number(searchParams.get("userId")) : 0;
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMembers, setGroupMembers] = useState<Record<number, GroupMember>>({});
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<number|null>(null);
  const [editText, setEditText] = useState("");
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

  // Reload messages and reactions when contact changes
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    // Fetch group members for sender name display
    if (selected.type === "group") {
      api.listGroupMembers(selected.id).then((members: GroupMember[]) => {
        const map: Record<number, GroupMember> = {};
        (members || []).forEach((m: GroupMember) => { map[m.user_id] = m; });
        setGroupMembers(map);
      }).catch(() => {});
    } else {
      setGroupMembers({});
    }
    const load = async () => {
      let msgs = [];
      if (selected.type === "user") {
        msgs = await api.getMessages(selected.id).catch(() => []);
      } else {
        msgs = await api.getGroupMessages(selected.id).catch(() => []);
      }
      setMessages(Array.isArray(msgs) ? msgs : []);
      // Fetch reactions for all messages
      const reactMap: Record<number, { [emoji: string]: number; mine: string[] }> = {};
      for (const m of msgs) {
        if (!m.id) continue;
        let r: any = {};
        try {
          if (selected.type === "user") {
            r = await api.request(`/api/messages/${m.id}/reactions`);
          } else {
            r = await api.request(`/api/messages/group/${m.id}/reactions`);
          }
        } catch {}
        reactMap[m.id] = { ...r.counts, mine: r.mine || [] };
      }
      setReactions(reactMap);
    };
    load();
    pollRef.current = setInterval(load, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

  // Handle incoming WebSocket messages — only for non-group (DM) chats
  // Group chats are handled by polling to avoid duplicates
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
    }
  }, [lastMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if ((!text.trim() && !file) || !selected) return;
    const content = text.trim();
    setShowEmoji(false);
    let fileUrl: string | null = null;
    if (file) {
      setUploading(true);
      try {
        fileUrl = await api.uploadImage(file);
      } catch (err: any) {
        alert(err?.message || "File upload failed");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    setText("");
    setFile(null);
    try {
      if (selected.type === "user") {
        await api.sendMessage(selected.id, fileUrl ? `${content}\n${fileUrl}` : content);
        setMessages(prev => [...prev, {
          sender_id: me?.id,
          recipient_id: selected.id,
          content: fileUrl ? `${content}\n${fileUrl}` : content,
          created_at: new Date().toISOString(),
        }]);
      } else {
        await api.sendGroupMessage(selected.id, fileUrl ? `${content}\n${fileUrl}` : content);
        setMessages(prev => [...prev, {
          sender_id: me?.id,
          group_id: selected.id,
          content: fileUrl ? `${content}\n${fileUrl}` : content,
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
                        {/* Search bar and results */}
                        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 12, marginTop: 8 }}>
                          <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={selected ? "Пошук по чату..." : "Оберіть чат для пошуку"}
                            disabled={!selected}
                            style={{ flex: 1, borderRadius: 8, border: "1px solid #ccc", padding: "6px 12px", fontSize: 15 }}
                          />
                          <button type="submit" disabled={!search.trim() || !selected || searching} style={{ borderRadius: 8, padding: "6px 18px", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600 }}>
                            {searching ? "..." : "Пошук"}
                          </button>
                          {searchResults && (
                            <button type="button" onClick={() => setSearchResults(null)} style={{ marginLeft: 8, border: "none", background: "#eee", borderRadius: 8, padding: "6px 12px" }}>Очистити</button>
                          )}
                        </form>
                        {searchResults && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Результати пошуку ({searchResults.length}):</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {searchResults.length === 0 && <div style={{ color: "#888" }}>Нічого не знайдено</div>}
                              {searchResults.map((m, i) => (
                                <div key={m.id ?? i} style={{ background: "#f7f7f7", borderRadius: 8, padding: 10, fontSize: 15 }}>
                                  <div style={{ marginBottom: 2, color: "#555" }}>{new Date(m.created_at).toLocaleString()}</div>
                                  <div style={{ whiteSpace: "pre-line" }}>{m.content}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
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
              {/* Pinned messages bar */}
              {selected && pinnedIds.length > 0 && (
                <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>📌 Закріплені:</span>
                  <button style={{ fontSize: 13, border: 'none', background: 'var(--accent)', color: '#fff', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' }} onClick={() => setShowPinned(v => !v)}>
                    {showPinned ? 'Сховати' : 'Показати'}
                  </button>
                  <span style={{ fontSize: 13, color: '#888' }}>({pinnedIds.length})</span>
                </div>
              )}
              {/* Show pinned messages if toggled */}
              {showPinned && pinnedIds.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {messages.filter(m => m.id && pinnedIds.includes(m.id)).map(m => (
                    <div key={m.id} style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: '#b8860b', marginBottom: 2 }}>📌 {new Date(m.created_at).toLocaleString()}</div>
                      <div style={{ whiteSpace: 'pre-line' }}>{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
              {messages.map((m, i) => {
                const isMine = me && m.sender_id === me.id;
                const isGroup = selected?.type === "group";
                const sender = isGroup && !isMine ? groupMembers[m.sender_id] : null;
                return (
                  <div key={m.id ?? i} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, position: "relative" }}>
                    {isGroup && !isMine && (
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {sender ? (sender.first_name[0] || "?").toUpperCase() : "?"}
                      </div>
                    )}
                    <div style={{ maxWidth: "65%" }}>
                      {isGroup && !isMine && sender && (
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2, color: "var(--text-muted)", paddingLeft: 4 }}>
                          {sender.first_name} {sender.last_name}
                        </div>
                      )}
                      <div style={{
                        padding: "0.55rem 0.9rem",
                        borderRadius: isMine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: isMine ? "var(--accent)" : "var(--bg-input)",
                        color: isMine ? "#fff" : "var(--text)",
                        fontSize: 14, lineHeight: 1.45, wordBreak: "break-word",
                        position: "relative"
                      }}>
                        {editingId === m.id ? (
                          <form onSubmit={async e => {
                            e.preventDefault();
                            if (!editText.trim()) return;
                            try {
                              if (isGroup) {
                                await api.editGroupMessage(m.id!, editText);
                              } else {
                                await api.editMessage(m.id!, editText);
                              }
                              setMessages(msgs => msgs.map(msg => msg.id === m.id ? { ...msg, content: editText } : msg));
                              setEditingId(null);
                            } catch (err: any) {
                              alert(err?.message || "Failed to edit message");
                            }
                          }} style={{ display: "flex", gap: 4 }}>
                            <input value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, borderRadius: 6, border: "1px solid #ccc", padding: "2px 6px" }} autoFocus />
                            <button type="submit">💾</button>
                            <button type="button" onClick={() => setEditingId(null)}>✖</button>
                          </form>
                        ) : (
                          <>
                            {(() => {
                              // Render file links/images if present
                              const parts = (m.content || "").split(/\n/);
                              return parts.map((part, idx) => {
                                if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(part.trim())) {
                                  return <img key={idx} src={part.trim()} alt="file" style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8, margin: "4px 0" }} />;
                                } else if (/^https?:\/\//.test(part.trim())) {
                                  return <a key={idx} href={part.trim()} target="_blank" rel="noopener noreferrer" style={{ color: isMine ? "#fff" : "var(--accent)", wordBreak: "break-all" }}>{part.trim()}</a>;
                                } else if (part.trim().length > 0) {
                                  return <span key={idx}>{part}</span>;
                                } else {
                                  return <br key={idx} />;
                                }
                              });
                            })()}
                            <div style={{ fontSize: 10, opacity: .65, marginTop: "0.2rem", textAlign: isMine ? "right" : "left" }}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {/* Emoji reactions UI */}
                            <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                              {Object.entries(reactions[m.id!] || {}).filter(([k]) => k !== "mine").map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  style={{ border: "none", background: "#eee", borderRadius: 8, padding: "2px 7px", fontSize: 15, cursor: "pointer", opacity: (reactions[m.id!]?.mine || []).includes(emoji) ? 1 : 0.7 }}
                                  onClick={async () => {
                                    try {
                                      if ((reactions[m.id!]?.mine || []).includes(emoji)) {
                                        if (isGroup) await api.unreactGroupMessage(m.id!, emoji);
                                        else await api.unreactMessage(m.id!, emoji);
                                      } else {
                                        if (isGroup) await api.reactGroupMessage(m.id!, emoji);
                                        else await api.reactMessage(m.id!, emoji);
                                      }
                                      // reload reactions for this message
                                      let r: any = {};
                                      if (isGroup) r = await api.request(`/api/messages/group/${m.id}/reactions`);
                                      else r = await api.request(`/api/messages/${m.id}/reactions`);
                                      setReactions(prev => ({ ...prev, [m.id!]: { ...r.counts, mine: r.mine || [] } }));
                                    } catch {}
                                  }}
                                >{emoji} {count}</button>
                              ))}
                              <div style={{ position: "relative" }}>
                                <button style={{ border: "none", background: "#eee", borderRadius: 8, padding: "2px 7px", fontSize: 15, cursor: "pointer" }}
                                  title="Add reaction"
                                  onClick={e => {
                                    const menu = document.createElement("div");
                                    menu.style.position = "absolute";
                                    menu.style.zIndex = "1000";
                                    menu.style.background = "#fff";
                                    menu.style.border = "1px solid #ccc";
                                    menu.style.borderRadius = "8px";
                                    menu.style.padding = "4px";
                                    menu.style.display = "grid";
                                    menu.style.gridTemplateColumns = "repeat(8,1fr)";
                                    menu.style.gap = "2px";
                                    EMOJIS.forEach(em => {
                                      const btn = document.createElement("button");
                                      btn.textContent = em;
                                      btn.style.fontSize = "18px";
                                      btn.style.background = "none";
                                      btn.style.border = "none";
                                      btn.style.cursor = "pointer";
                                      btn.onclick = async () => {
                                        try {
                                          if (isGroup) await api.reactGroupMessage(m.id!, em);
                                          else await api.reactMessage(m.id!, em);
                                          let r: any = {};
                                          if (isGroup) r = await api.request(`/api/messages/group/${m.id}/reactions`);
                                          else r = await api.request(`/api/messages/${m.id}/reactions`);
                                          setReactions(prev => ({ ...prev, [m.id!]: { ...r.counts, mine: r.mine || [] } }));
                                        } catch {}
                                        document.body.removeChild(menu);
                                      };
                                      menu.appendChild(btn);
                                    });
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    menu.style.left = `${rect.left}px`;
                                    menu.style.top = `${rect.bottom + window.scrollY}px`;
                                    document.body.appendChild(menu);
                                    const remove = () => { if (document.body.contains(menu)) document.body.removeChild(menu); };
                                    setTimeout(() => {
                                      document.addEventListener("click", remove, { once: true });
                                    }, 50);
                                  }}
                                >➕</button>
                              </div>
                            </div>
                          </>
                        )}
                        <div style={{ position: "absolute", top: 2, right: 6, display: "flex", gap: 4 }}>
                          {/* Pin/unpin button */}
                          {selected && m.id && (
                            pinnedIds.includes(m.id) ? (
                              <button style={{ background: 'none', border: 'none', color: '#b8860b', cursor: 'pointer' }} title="Unpin" onClick={async () => {
                                try {
                                  if (selected.type === 'user') await api.unpinMessage(m.id!);
                                  else await api.unpinMessage(m.id!, selected.id);
                                  setPinnedIds(ids => ids.filter(id => id !== m.id));
                                } catch (err: any) { alert(err?.message || 'Failed to unpin'); }
                              }}>📌</button>
                            ) : (
                              <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }} title="Pin" onClick={async () => {
                                try {
                                  if (selected.type === 'user') await api.pinMessage(m.id!);
                                  else await api.pinMessage(m.id!, selected.id);
                                  setPinnedIds(ids => [...ids, m.id!]);
                                } catch (err: any) { alert(err?.message || 'Failed to pin'); }
                              }}>📌</button>
                            )
                          )}
                          {isMine && editingId !== m.id && (
                            <>
                              <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }} title="Edit" onClick={() => { setEditingId(m.id!); setEditText(m.content); }}>✏️</button>
                              <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }} title="Delete" onClick={async () => {
                                if (!window.confirm("Delete this message?")) return;
                                try {
                                  if (isGroup) {
                                    await api.deleteGroupMessage(m.id!);
                                  } else {
                                    await api.deleteMessage(m.id!);
                                  }
                                  setMessages(msgs => msgs.filter(msg => msg.id !== m.id));
                                } catch (err: any) {
                                  alert(err?.message || "Failed to delete message");
                                }
                              }}>🗑️</button>
                            </>
                          )}
                          <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }} title="Forward" onClick={() => { setForwardingMsg({id: m.id!, isGroup}); setShowForwardModal(true); }}>📤</button>
                        </div>
                            {/* Forward modal */}
                            {showForwardModal && forwardingMsg && (
                              <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.25)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ background: "#fff", borderRadius: 12, padding: 24, minWidth: 320, boxShadow: "0 2px 16px #0002" }}>
                                  <h3 style={{ margin: 0, marginBottom: 12 }}>Forward message</h3>
                                  <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
                                    {contacts.map(c => (
                                      <div key={c.type + c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span>{c.type === "group" ? "👥" : "👤"} {c.name}</span>
                                        <button style={{ marginLeft: "auto" }} onClick={async () => {
                                          try {
                                            if (forwardingMsg.isGroup && c.type === "group") {
                                              await api.forwardGroupMessage(forwardingMsg.id, c.id);
                                            } else if (!forwardingMsg.isGroup && c.type === "user") {
                                              await api.forwardMessage(forwardingMsg.id, c.id);
                                            } else return;
                                            setShowForwardModal(false);
                                            setForwardingMsg(null);
                                          } catch (err: any) {
                                            alert(err?.message || "Failed to forward");
                                          }
                                        }}>Forward</button>
                                      </div>
                                    ))}
                                  </div>
                                  <button onClick={() => { setShowForwardModal(false); setForwardingMsg(null); }} style={{ marginTop: 8 }}>Cancel</button>
                                </div>
                              </div>
                            )}
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
                disabled={!selected || uploading}
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
              <input
                type="file"
                disabled={!selected || uploading}
                onChange={e => setFile(e.target.files?.[0] || null)}
                style={{ flexShrink: 0 }}
              />
              {file && (
                <span style={{ fontSize: 12, marginLeft: 4 }}>
                  {file.name} <button type="button" onClick={() => setFile(null)} style={{ marginLeft: 2 }}>x</button>
                </span>
              )}
              <button
                type="submit"
                disabled={(!text.trim() && !file) || !selected || uploading}
                title="Send"
                style={{
                  background: ((text.trim() || file) && selected && !uploading) ? "var(--accent)" : "var(--border)",
                  color: "#fff", border: "none", borderRadius: "50%",
                  width: 40, height: 40, fontSize: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: ((text.trim() || file) && selected && !uploading) ? "pointer" : "not-allowed",
                  flexShrink: 0, transition: "background .15s",
                }}
              >{uploading ? "…" : "➤"}</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
