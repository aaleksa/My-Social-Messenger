"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useWS } from "@/lib/WebSocketContext";
import Sidebar from "@/components/Sidebar";

type Group = { id: number; creator_id: number; title: string; description: string; created_at: string; my_status: string; member_count: number };
type GroupEvent = { id: number; group_id: number; creator_id: number; title: string; description: string; event_time: string; created_at: string; user_response?: string; going_count: number; not_going_count: number };
type Member = { user_id: number; status: string; first_name: string; last_name: string; avatar: string };
type User = { id: number; first_name: string; last_name: string; avatar: string };

export default function GroupPage() {
  const { id } = useParams();
  const gid = Number(id);
  const [group, setGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [me, setMe] = useState<any>(null);
  const [tab, setTab] = useState<"posts" | "events" | "members" | "chat">("posts");
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState("");
  const [eventForm, setEventForm] = useState({ title: "", description: "", event_time: "" });
  const [eventBusy, setEventBusy] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [myResponses, setMyResponses] = useState<Record<number, string>>({});
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteMsg, setInviteMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.getMe(),
      api.getGroup(gid),
      api.listPosts({ group_id: gid }),
      api.listEvents(gid),
      api.listGroupMembers(gid),
      api.listUsers(),
    ]).then(([u, g, p, ev, mem, users]) => {
      setMe(u);
      setGroup(g);
      setPosts(p || []);
      const evList: GroupEvent[] = ev || [];
      setEvents(evList);
      setMyResponses(Object.fromEntries(evList.map((e: GroupEvent) => [e.id, e.user_response || ''])));
      setMembers(mem || []);
      setAllUsers(users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [gid]);

  const { lastMessage } = useWS();
  const isOwner = me?.id === group?.creator_id;
  const isMember = isOwner || group?.my_status === "accepted";

  // Poll every 5s while request is pending so the page updates as soon as creator accepts
  useEffect(() => {
    if (group?.my_status !== "pending") return;
    const interval = setInterval(() => {
      api.getGroup(gid).then(g => { if (g) setGroup(g); }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [group?.my_status, gid]);

  // Load group chat when tab is selected + poll every 5s for new messages
  useEffect(() => {
    if (tab !== "chat" || !gid) return;
    const load = () => api.getGroupMessages(gid).then(m => { if (Array.isArray(m)) setChatMessages(m); }).catch(() => {});
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [tab, gid]);

  // Scroll to bottom when chat messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  // Receive real-time notifications via WebSocket (re-fetch members/group on membership change)
  useEffect(() => {
    if (!lastMessage) return;
    // Re-fetch group when membership changes (join accepted/declined)
    if (lastMessage.type === "notification") {
      api.getGroup(gid).then(g => setGroup(g)).catch(() => {});
      api.listGroupMembers(gid).then(m => setMembers(m || [])).catch(() => {});
    }
    // group_message is handled by polling — no append here to avoid duplicates
  }, [lastMessage]);

  async function sendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatText.trim() || chatBusy) return;
    const content = chatText.trim();
    setChatText("");
    setChatBusy(true);
    try {
      await api.sendGroupMessage(gid, content);
      setChatMessages(prev => [...prev, { sender_id: me?.id, group_id: gid, content, created_at: new Date().toISOString() }]);
    } catch {}
    setChatBusy(false);
  }

  async function reloadGroup() {
    const [g, mem] = await Promise.all([api.getGroup(gid), api.listGroupMembers(gid)]);
    setGroup(g);
    setMembers(mem || []);
  }

  async function handlePostImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPostImage(await api.uploadImage(file)); } catch {}
  }

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!postContent.trim() || postBusy) return;
    setPostBusy(true);
    try {
      await api.createPost({ content: postContent, image: postImage, privacy: "public", group_id: gid });
      setPostContent(""); setPostImage("");
      api.listPosts({ group_id: gid }).then(p => setPosts(p || []));
    } catch {}
    setPostBusy(false);
  }

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.event_time || eventBusy) return;
    setEventBusy(true);
    try {
      await api.createEvent({ ...eventForm, group_id: gid });
      setEventForm({ title: "", description: "", event_time: "" });
      api.listEvents(gid).then(ev => setEvents(ev || []));
    } catch {}
    setEventBusy(false);
  }

  async function respondEvent(eventId: number, response: string) {
    const prev = myResponses[eventId] || '';
    const next = prev === response ? '' : response; // toggle off if clicking active
    setMyResponses(r => ({ ...r, [eventId]: next }));
    // Optimistically update counts
    setEvents(evs => evs.map(ev => {
      if (ev.id !== eventId) return ev;
      let g = ev.going_count;
      let ng = ev.not_going_count;
      if (prev === 'going') g--;
      if (prev === 'not_going') ng--;
      if (next === 'going') g++;
      if (next === 'not_going') ng++;
      return { ...ev, going_count: g, not_going_count: ng };
    }));
    try {
      await api.respondToEvent({ event_id: eventId, response: next });
    } catch {
      // revert
      setMyResponses(r => ({ ...r, [eventId]: prev }));
      setEvents(evs => evs.map(ev => {
        if (ev.id !== eventId) return ev;
        let g = ev.going_count;
        let ng = ev.not_going_count;
        if (next === 'going') g--;
        if (next === 'not_going') ng--;
        if (prev === 'going') g++;
        if (prev === 'not_going') ng++;
        return { ...ev, going_count: g, not_going_count: ng };
      }));
    }
  }

  async function handleDeleteEvent(eventId: number) {
    if (!confirm('Delete this event?')) return;
    try {
      await api.deleteEvent(eventId);
      setEvents(evs => evs.filter(e => e.id !== eventId));
    } catch {}
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const uid = Number(inviteUserId);
    if (!uid) return;
    try {
      await api.inviteMember({ group_id: gid, user_id: uid });
      setInviteMsg("Invitation sent!");
      setInviteUserId("");
      reloadGroup();
    } catch (err: any) {
      setInviteMsg(err?.message || "Failed to invite");
    }
    setTimeout(() => setInviteMsg(""), 3000);
  }

  async function handleMemberAction(userId: number, accept: boolean) {
    try {
      await api.respondToMembership({ group_id: gid, user_id: userId, accept });
      reloadGroup();
    } catch {}
  }

  async function handleJoin() {
    try {
      await api.requestJoin(gid);
      reloadGroup();
    } catch {}
  }

  if (loading) return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <span style={{ color: "var(--text-muted)" }}>Loading...</span>
      </main>
    </div>
  );

  if (!group) return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Group not found</main>
    </div>
  );

  const memberUserIds = new Set(members.map(m => m.user_id));
  const nonMembers = allUsers.filter(u => !memberUserIds.has(u.id) && u.id !== me?.id);
  const pendingMembers = members.filter(m => m.status === "pending");
  const acceptedMembers = members.filter(m => m.status === "accepted");
  const invitedMembers = members.filter(m => m.status === "invited");
  const hue = (group.id * 47) % 360;

  return (
    <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", gap: "1.5rem" }}>
      <Sidebar />
      <main style={{ flex: 1 }}>

        {/* Header */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", marginBottom: "1.25rem", boxShadow: "var(--shadow)" }}>
          <div style={{ height: 100, background: `hsl(${hue},55%,55%)`, display: "flex", alignItems: "center", paddingLeft: "1.5rem" }}>
            <span style={{ fontSize: 48 }}>👥</span>
          </div>
          <div style={{ padding: "1rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: "0.25rem" }}>{group.title}</h2>
                {group.description && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{group.description}</p>}
                <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: "0.25rem" }}>
                  {group.member_count} member{group.member_count !== 1 ? "s" : ""} &middot; Created by{" "}
                  <strong>
                    {isOwner
                      ? "you"
                      : (() => {
                          const c = allUsers.find(u => u.id === group.creator_id);
                          return c ? `${c.first_name} ${c.last_name}`.trim() : `User #${group.creator_id}`;
                        })()}
                  </strong>
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 }}>
                {isOwner && (
                  <span style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, fontWeight: 600 }}>Owner</span>
                )}
                {!isOwner && group.my_status === "accepted" && (
                  <span style={{ background: "#e7f3ff", color: "var(--accent)", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, fontWeight: 600 }}>Member</span>
                )}
                {!isOwner && group.my_status === "pending" && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                    <span style={{ background: "var(--bg-input)", color: "var(--text-muted)", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13 }}>Request pending</span>
                    <button onClick={reloadGroup} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer", padding: 0 }}>↻ Check status</button>
                  </div>
                )}
                {!isOwner && group.my_status === "invited" && (
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={() => handleMemberAction(me.id, true)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Accept invite
                    </button>
                    <button onClick={() => handleMemberAction(me.id, false)} style={{ background: "transparent", color: "#fa3e3e", border: "1.5px solid #fa3e3e", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, cursor: "pointer" }}>
                      Decline
                    </button>
                  </div>
                )}
                {!isOwner && !group.my_status && (
                  <button onClick={handleJoin} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Request to join
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Non-member gate */}
        {!isMember ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>🔒</div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Members only</p>
            <p style={{ fontSize: 14 }}>Join this group to see posts, events and members.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {(["posts", "events", "members", "chat"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: "0.4rem 1.1rem", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 500,
                  border: "1px solid var(--border)", cursor: "pointer",
                  background: tab === t ? "var(--accent)" : "var(--bg-card)",
                  color: tab === t ? "#fff" : "var(--text)",
                }}>
                  {t === "posts" ? "Posts" : t === "events" ? "Events" : t === "chat" ? "💬 Chat" : "Members"}
                </button>
              ))}
            </div>

            {/* POSTS */}
            {tab === "posts" && (
              <>
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.25rem", boxShadow: "var(--shadow)" }}>
                  <form onSubmit={submitPost}>
                    <textarea value={postContent} onChange={e => setPostContent(e.target.value)} placeholder="Write something for this group..." rows={3} style={{ marginBottom: "0.75rem", resize: "none" }} />
                    {postImage && (
                      <div style={{ marginBottom: "0.5rem", position: "relative", display: "inline-block" }}>
                        <img src={postImage} alt="" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: "var(--radius)" }} />
                        <button type="button" onClick={() => setPostImage("")} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.5)", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, fontSize: 11 }}>✕</button>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <label style={{ fontSize: 13, color: "var(--accent)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        📷 Photo
                        <input type="file" accept="image/*,.gif" onChange={handlePostImage} style={{ display: "none" }} />
                      </label>
                      <button type="submit" disabled={!postContent.trim() || postBusy} style={{ marginLeft: "auto", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.5rem 1.25rem", fontWeight: 600, fontSize: 14, opacity: postBusy ? 0.6 : 1, cursor: postBusy ? "not-allowed" : "pointer" }}>
                        {postBusy ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </form>
                </div>
                {posts.length === 0 ? (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No posts yet. Be the first to post!
                  </div>
                ) : posts.map((p: any) => (
                  <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "0.75rem", boxShadow: "var(--shadow)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                        {p.author_avatar ? <img src={p.author_avatar} alt="" style={{ width: 32, height: 32, objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>👤</span>}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.author_first_name} {p.author_last_name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "0.5rem" }}>{new Date(p.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <p style={{ marginBottom: p.image ? "0.5rem" : 0 }}>{p.content}</p>
                    {p.image && <img src={p.image} alt="" style={{ maxWidth: "100%", borderRadius: "var(--radius)", marginTop: "0.25rem" }} />}
                  </div>
                ))}
              </>
            )}

            {/* EVENTS */}
            {tab === "events" && (
              <>
                {isOwner && (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.25rem", boxShadow: "var(--shadow)" }}>
                    <h4 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Create Event</h4>
                    <form onSubmit={submitEvent}>
                      <input placeholder="Event title *" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} required style={{ marginBottom: "0.75rem" }} />
                      <textarea placeholder="Description (optional)" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ marginBottom: "0.75rem", resize: "none" }} />
                      <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Date and Time *</label>
                      <input type="datetime-local" value={eventForm.event_time} onChange={e => setEventForm(f => ({ ...f, event_time: e.target.value }))} required style={{ marginBottom: "0.75rem" }} />
                      <button type="submit" disabled={!eventForm.title.trim() || !eventForm.event_time || eventBusy} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.5rem 1.25rem", fontWeight: 600, fontSize: 14, opacity: eventBusy ? 0.6 : 1, cursor: eventBusy ? "not-allowed" : "pointer" }}>
                        {eventBusy ? "Creating..." : "Create Event"}
                      </button>
                    </form>
                  </div>
                )}
                {events.length === 0 ? (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    {isOwner ? "No events yet. Create the first one!" : "No events yet."}
                  </div>
                ) : events.map((ev: GroupEvent) => {
                  const myResp = myResponses[ev.id];
                  const evTimeStr = ev.event_time ? ev.event_time.replace(" ", "T").replace(/(\d{2}:\d{2}:\d{2})$/, "$1Z") : "";
                  const evDate = evTimeStr ? new Date(evTimeStr) : null;
                  const isPast = evDate ? evDate < new Date() : false;
                  const canDelete = me?.id === ev.creator_id || isOwner;
                  return (
                    <div key={ev.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: isPast ? "3px solid #f59e0b" : "3px solid var(--accent)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "0.75rem", boxShadow: "var(--shadow)", opacity: isPast ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <h4 style={{ fontWeight: 600, margin: 0 }}>{ev.title}</h4>
                            {isPast && <span style={{ fontSize: 11, background: "#f59e0b22", color: "#b45309", border: "1px solid #f59e0b", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>⏰ Expired</span>}
                          </div>
                          {ev.description && <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: "0.5rem" }}>{ev.description}</p>}
                          <p style={{ fontSize: 13, color: isPast ? "var(--text-muted)" : "var(--accent)", fontWeight: 500, marginBottom: "0.4rem" }}>
                            📅 {evDate && !isNaN(evDate.getTime()) ? evDate.toLocaleString() : ev.event_time}
                          </p>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {ev.going_count > 0 && <span>✓ {ev.going_count} going</span>}
                            {ev.going_count > 0 && ev.not_going_count > 0 && <span style={{ margin: "0 0.4rem" }}>·</span>}
                            {ev.not_going_count > 0 && <span>✗ {ev.not_going_count} not going</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", flexShrink: 0 }}>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            {(["going", "not_going"] as const).map(s => (
                              <button key={s} onClick={() => respondEvent(ev.id, s)} style={{
                                border: `1.5px solid ${myResp === s ? "var(--accent)" : "var(--border)"}`,
                                borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, cursor: "pointer",
                                background: myResp === s ? "var(--accent)" : "var(--bg-input)",
                                color: myResp === s ? "#fff" : "var(--text)",
                                fontWeight: myResp === s ? 600 : 400,
                              }}>
                                {s === "going" ? "✓ Going" : "✗ Not going"}
                              </button>
                            ))}
                          </div>
                          {canDelete && (
                            <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: "transparent", color: "#fa3e3e", border: "1px solid #fa3e3e", borderRadius: "var(--radius)", padding: "0.2rem 0.6rem", fontSize: 12, cursor: "pointer" }}>🗑 Delete</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* MEMBERS */}
            {tab === "members" && (
              <>
                {isOwner && pendingMembers.length > 0 && (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.25rem", boxShadow: "var(--shadow)" }}>
                    <h4 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Join Requests ({pendingMembers.length})</h4>
                    {pendingMembers.map((m, i) => (
                      <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0", borderBottom: i < pendingMembers.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <UserRow m={m} />
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <button onClick={() => handleMemberAction(m.user_id, true)} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Accept</button>
                          <button onClick={() => handleMemberAction(m.user_id, false)} style={{ background: "transparent", color: "#fa3e3e", border: "1.5px solid #fa3e3e", borderRadius: "var(--radius)", padding: "0.3rem 0.75rem", fontSize: 13, cursor: "pointer" }}>Decline</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isOwner && (
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", marginBottom: "1.25rem", boxShadow: "var(--shadow)" }}>
                  <h4 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Invite someone</h4>
                  {nonMembers.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>All users are already members or have been invited.</p>
                  ) : (
                    <form onSubmit={handleInvite} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <select value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} style={{ flex: 1, padding: "0.5rem 0.75rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 14 }}>
                        <option value="">Select a user...</option>
                        {nonMembers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                      </select>
                      <button type="submit" disabled={!inviteUserId} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.5rem 1.25rem", fontWeight: 600, fontSize: 14, cursor: inviteUserId ? "pointer" : "not-allowed", opacity: inviteUserId ? 1 : 0.6 }}>Invite</button>
                    </form>
                  )}
                  {inviteMsg && <p style={{ fontSize: 13, color: "var(--accent)", marginTop: "0.5rem" }}>{inviteMsg}</p>}
                </div>
                )}

                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)" }}>
                  <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14 }}>
                    Members ({acceptedMembers.length})
                  </div>
                  {acceptedMembers.map((m, i) => (
                    <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: i < acceptedMembers.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <UserRow m={m} isOwner={m.user_id === group.creator_id} />
                      {m.user_id === me?.id && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>You</span>}
                    </div>
                  ))}
                </div>

                {invitedMembers.length > 0 && (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", boxShadow: "var(--shadow)", marginTop: "1rem" }}>
                    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 14, color: "var(--text-muted)" }}>
                      Invited – awaiting response ({invitedMembers.length})
                    </div>
                    {invitedMembers.map((m, i) => (
                      <div key={m.user_id} style={{ padding: "0.75rem 1rem", borderBottom: i < invitedMembers.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <UserRow m={m} muted />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* CHAT */}
            {tab === "chat" && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", height: 480 }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
                  {chatMessages.length === 0 && (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "3rem", fontSize: 14 }}>
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  {chatMessages.map((msg: any, i: number) => {
                    const isMine = msg.sender_id === me?.id;
                    const sender = members.find(m => m.user_id === msg.sender_id);
                    return (
                      <div key={msg.id || i} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                        {!isMine && (
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                            {sender?.avatar ? <img src={sender.avatar} alt="" style={{ width: 30, height: 30, objectFit: "cover" }} /> : <span style={{ fontSize: 14 }}>👤</span>}
                          </div>
                        )}
                        <div style={{ maxWidth: "65%", padding: "8px 12px", borderRadius: 14, background: isMine ? "var(--accent)" : "var(--bg-input)", color: isMine ? "#fff" : "var(--text)", fontSize: 14 }}>
                          {!isMine && sender && <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3, opacity: .75 }}>{sender.first_name} {sender.last_name}</div>}
                          {msg.content}
                          <div style={{ fontSize: 10, opacity: .6, marginTop: 3, textAlign: isMine ? "right" : "left" }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>
                {isMember ? (
                  <form onSubmit={sendChatMessage} style={{ display: "flex", gap: 8, padding: "0.75rem 1rem", borderTop: "1px solid var(--border)" }}>
                    <input
                      value={chatText}
                      onChange={e => setChatText(e.target.value)}
                      placeholder="Type a message…"
                      style={{ flex: 1, padding: "0.5rem 1rem", borderRadius: 20, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text)", fontSize: 14, outline: "none" }}
                    />
                    <button type="submit" disabled={!chatText.trim() || chatBusy} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius)", padding: "0.5rem 1.25rem", fontWeight: 600, fontSize: 14, cursor: chatText.trim() && !chatBusy ? "pointer" : "not-allowed", opacity: chatText.trim() && !chatBusy ? 1 : 0.6 }}>
                      Send
                    </button>
                  </form>
                ) : (
                  <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Join the group to send messages</div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function UserRow({ m, isOwner, muted }: { m: { user_id: number; first_name: string; last_name: string; avatar: string }; isOwner?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {m.avatar ? <img src={m.avatar} alt="" style={{ width: 38, height: 38, objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>👤</span>}
      </div>
      <div>
        <span style={{ fontWeight: 500, fontSize: 14, color: muted ? "var(--text-muted)" : "var(--text)" }}>
          {m.first_name} {m.last_name}
        </span>
        {isOwner && <span style={{ marginLeft: "0.4rem", background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", fontSize: 11 }}>Owner</span>}
      </div>
    </div>
  );
}
