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
