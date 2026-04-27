
// Add reaction to a message
export async function apiReactMessage(tok, message_id, emoji) {
  return apiFetch(tok, '/api/messages/react', { method: 'POST', body: JSON.stringify({ message_id, emoji }) })
}
// Remove reaction from a message
export async function apiUnreactMessage(tok, message_id, emoji) {
  return apiFetch(tok, '/api/messages/react', { method: 'DELETE', body: JSON.stringify({ message_id, emoji }) })
}
// Add reaction to a group message
export async function apiReactGroupMessage(tok, group_message_id, emoji) {
  return apiFetch(tok, '/api/messages/group/react', { method: 'POST', body: JSON.stringify({ group_message_id, emoji }) })
}
// Remove reaction from a group message
export async function apiUnreactGroupMessage(tok, group_message_id, emoji) {
  return apiFetch(tok, '/api/messages/group/react', { method: 'DELETE', body: JSON.stringify({ group_message_id, emoji }) })
}
// Get reactions for a message
export async function apiGetMessageReactions(tok, message_id) {
  return apiFetch(tok, `/api/messages/reactions?message_id=${message_id}`)
}
// Get reactions for a group message
export async function apiGetGroupMessageReactions(tok, group_message_id) {
  return apiFetch(tok, `/api/messages/group/reactions?group_message_id=${group_message_id}`)
}

// Edit a personal message
export async function apiEditMessage(tok, id, data) {
  return apiFetch(tok, `/api/messages/edit?id=${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// Delete a personal message
export async function apiDeleteMessage(tok, id) {
  return apiFetch(tok, `/api/messages/edit?id=${id}`, { method: 'DELETE' })
}

// Edit a group message
export async function apiEditGroupMessage(tok, id, data) {
  return apiFetch(tok, `/api/messages/group/edit?id=${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

// Delete a group message
export async function apiDeleteGroupMessage(tok, id) {
  return apiFetch(tok, `/api/messages/group/edit?id=${id}`, { method: 'DELETE' })
}
export const API    = 'http://localhost:8080'
export const WS_URL = 'ws://localhost:8080/api/ws'

// ── Helpers ────────────────────────────────────────────────────
export const dname = u => u
  ? (u.nickname || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'User ' + u.id)
  : 'Unknown'
export const inits  = u  => dname(u).slice(0, 2).toUpperCase()
export const fmt    = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
export const fmtD   = ts => ts ? new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
export const avSrc  = u  => u?.avatar ? `${API}/uploads/${u.avatar}` : null

// ── Fetch wrappers ─────────────────────────────────────────────
function hdrs(tok, extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  if (tok) h['X-Session-ID'] = tok
  return h
}

export async function apiFetch(tok, path, opts = {}) {
  const r = await fetch(API + path, {
    credentials: 'include',
    ...opts,
    headers: hdrs(tok, opts.headers),
  })
  if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText) }
  const ct = r.headers.get('content-type') || ''
  return ct.includes('json') ? r.json() : r.text()
}

export async function apiForm(tok, path, fd) {
  const h = {}
  if (tok) h['X-Session-ID'] = tok
  const r = await fetch(API + path, { method: 'POST', credentials: 'include', headers: h, body: fd })
  if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText) }
  return r.json()
}
