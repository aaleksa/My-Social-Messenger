import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function Topbar() {
  const { me, tok, setPage, notifCnt, resetNotif, wsOn, clearAuth, setSearchQuery } = useStore()
  const [q, setQ] = useState('')

  function doSearch(e) {
    if (e.key === 'Enter' && q.trim()) {
      setSearchQuery(q.trim())
      setPage('people')
    }
  }

  async function doLogout() {
    try { await apiFetch(tok, '/api/auth/logout', { method: 'POST' }) } catch (_) {}
    if (window.electronAPI) window.electronAPI.clearSession()
    clearAuth()
  }

  return (
    <div className="topbar">
      <div className="brand">Social<span>Net</span></div>
      <input className="tb-search" placeholder="Search people…" value={q}
        onChange={e => setQ(e.target.value)}
        onKeyDown={doSearch}
      />
      <div style={{ flex: 1 }} />
      <button className="notif-btn" onClick={() => { setPage('notifications'); resetNotif() }}>
        <i className="bi bi-bell" />
        {notifCnt > 0 && <span className="notif-badge">{notifCnt}</span>}
      </button>
      <div className={`conn-dot ${wsOn ? 'on' : ''}`} title={wsOn ? 'Connected' : 'Disconnected'} />
      <div className="tb-user" onClick={() => setPage('profile')}>
        <Avatar user={me} size={28} className="tb-av" />
        <span className="tb-name">{dname(me)}</span>
      </div>
      <button className="logout-btn" onClick={doLogout}>
        <i className="bi bi-box-arrow-right" /> Logout
      </button>
    </div>
  )
}
