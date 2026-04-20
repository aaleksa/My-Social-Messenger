const API_BASE = "";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export const api = {
  // Auth
  register: (data: object) => request("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: object) => request("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  // Profile
  getMe: () => request("/api/me"),
  listUsers: () => request("/api/users"),
  getProfile: (userId: number) => request(`/api/profile?user_id=${userId}`),
  updatePrivacy: (isPublic: boolean) =>
    request("/api/profile/privacy", { method: "PUT", body: JSON.stringify({ is_public: isPublic }) }),

  // Followers
  follow: (followingId: number) =>
    request("/api/follow", { method: "POST", body: JSON.stringify({ following_id: followingId }) }),
  unfollow: (followingId: number) => request(`/api/follow?following_id=${followingId}`, { method: "DELETE" }),
  respondToFollow: (followerId: number, accept: boolean) =>
    request("/api/follow/respond", { method: "POST", body: JSON.stringify({ follower_id: followerId, accept }) }),
  listFollowers: (userId: number) => request(`/api/follow?user_id=${userId}`),
  listFollowing: (userId: number) => request(`/api/follow/following?user_id=${userId}`),

  // Posts
  createPost: (data: object) => request("/api/posts", { method: "POST", body: JSON.stringify(data) }),
  listPosts: (params?: { user_id?: number; group_id?: number }) => {
    const q = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return request(`/api/posts${q}`);
  },
  createComment: (data: object) => request("/api/posts/comment", { method: "POST", body: JSON.stringify(data) }),
  listComments: (postId: number) => request(`/api/posts/comment?post_id=${postId}`),

  // Groups
  createGroup: (data: object) => request("/api/groups", { method: "POST", body: JSON.stringify(data) }),
  listGroups: () => request("/api/groups"),
  getGroup: (id: number) => request(`/api/groups/detail?id=${id}`),
  listGroupMembers: (groupId: number) => request(`/api/groups/members?group_id=${groupId}`),
  inviteMember: (data: object) => request("/api/groups/invite", { method: "POST", body: JSON.stringify(data) }),
  requestJoin: (groupId: number) =>
    request("/api/groups/join", { method: "POST", body: JSON.stringify({ group_id: groupId }) }),
  respondToMembership: (data: object) =>
    request("/api/groups/respond", { method: "POST", body: JSON.stringify(data) }),
  createEvent: (data: object) => request("/api/groups/events", { method: "POST", body: JSON.stringify(data) }),
  listEvents: (groupId: number) => request(`/api/groups/events?group_id=${groupId}`),
  respondToEvent: (data: object) =>
    request("/api/groups/events/respond", { method: "POST", body: JSON.stringify(data) }),

  // Notifications
  listNotifications: () => request("/api/notifications"),
  markNotificationRead: (id?: number, all?: boolean) =>
    request("/api/notifications", { method: "PUT", body: JSON.stringify(all ? { all: true } : { id }) }),

  // Chat
  getMessages: (recipientId: number) => request(`/api/messages?recipient_id=${recipientId}`),
  sendMessage: (recipientId: number, content: string) =>
    request("/api/messages", { method: "POST", body: JSON.stringify({ recipient_id: recipientId, content }) }),
  getGroupMessages: (groupId: number) => request(`/api/messages/group?group_id=${groupId}`),
  sendGroupMessage: (groupId: number, content: string) =>
    request("/api/messages/group", { method: "POST", body: JSON.stringify({ group_id: groupId, content }) }),

  // Upload
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/upload", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.url as string;
  },
};
