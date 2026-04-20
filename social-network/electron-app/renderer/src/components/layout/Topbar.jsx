import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch, dname } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function Topbar() {
  const { me, tok, setPage, notifCnt, resetNotif, wsOn, clearAuth, setSearchQuery, theme, toggleTheme } = useStore()
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
      <input className='tb-search' placeholder='Search people…' v lue={q}
                         h}
      />
                                                cla                                     av                                              <i className='bi bi-bell' />
                                         'n                                         'n                                         'n                              '                               : 'Switch to dark mode'}
                                             { f                     >
                                     me === 'dark' ? 'bi-sun' : 'bi-moon-stars'}`} />
      </button>
      <div className={`conn-dot ${wsOn ? 'on' : ''}`} title={wsOn ? 'Connected' : 'Disconnected'} />
      <div className='tb-user' onClick={() => navTo('profile      <div className='tb-user' onClick={() => navTo('profile>
        <span classNa        <me        <span classNa      </        <span classNa        <me        <span classNa ogou        <span classNa        <me        <span classNa      </        <spa>
    </div>
  )
}
