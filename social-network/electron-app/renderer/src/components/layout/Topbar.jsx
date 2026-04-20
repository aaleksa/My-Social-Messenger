import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function Topbar() {
  const { me, tok, setPage, page, notifCnt, resetNotif, wsOn, clearAuth, setSearchQuery, theme, toggleTheme } = useStore()
  const [q, setQ] = useState('')

  function doSearch(e) {
    const val = e.target.value
    setQ(val)
    setSearchQuery(val)
    if (val.trim()) setPage('people')
  }

  function navTo(pg, extra) {
    if (pg !== 'people') { setQ(''); setSearchQuery('') }
    setPage(pg, extra)
  }

  async function doLogout() {
    try { await apiFetch(tok, '/api/auth/logout', { method: 'POST' }) } catch (_) {}
    if (window.electronAPI) window.electronAPI.clearSession()
    clearAuth()
  }

  return (
    <div className='topbar'>
      <div className='brand'>Social<span>Net</span></div>
      <input
        className='tb-search'
        placeholder='Search people…'
        value={q}
        onChange={doSearch}
      />
      <nav className='tb-nav'>
        <button className={`tb-btn${page === 'feed' ? ' active' : ''}`} onClick={() => navTo('feed')} title='Feed'>
          <i className={`bi ${page === 'feed' ? 'bi-house-door-fill' : 'bi-house-door'}`} />
        </button>
        <button className={`tb-btn${page === 'people' ? ' active' : ''}`} onClick={() => navTo('people')} title='People'>
          <i className={`bi ${page === 'people' ? 'bi-people-fill' : 'bi-people'}`} />
        </button>
        <button className={`tb-btn${page === 'groups' ? ' active' : ''}`} onClick={() => navTo('groups')} title='Groups'>
          <i className={`bi ${page === 'groups' ? 'bi-grid-fill' : 'bi-grid'}`} />
        </button>
        <button className={`tb-btn${page === 'chat' ? ' active' : ''}`} onClick={() => navTo('chat')} title='Chat'>
          <i className={`bi ${page === 'chat' ? 'bi-chat-dots-fill' : 'bi-chat-dots'}`} />
        </button>
      </nav>
      <button className={`notif-btn${page === 'notifications' ? ' active' : ''}`} onClick={() => { resetNotif(); navTo('notifications') }} title='Notifications'>
        <i className={`bi ${page === 'notifications' ? 'bi-bell-fill' : 'bi-bell'}`} />
        {notifCnt > 0 && <span className='notif-badge'>{notifCnt}</span>}
      </button>
      <button
        className='notif-btn'
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleTheme}
        style={{ fontSize: 18 }}
      >
        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
      </button>
      <div className={`conn-dot ${wsOn ? 'on' : ''}`} title={wsOn ? 'Connected' : 'Disconnected'} />
      <div className='tb-user' onClick={() => navTo('profile')}>
        <Avatar user={me} size={30} />
        <span className='tb-uname'>{dname(me)}</span>
        <button className='tb-logout' onClick={e => { e.stopPropagation(); doLogout() }} title='Logout'>
          <i className='bi bi-box-arrow-right' />
        </button>
      </div>
    </div>
  )
}
