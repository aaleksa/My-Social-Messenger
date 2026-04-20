import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { dname, apiFetch } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function ChatSidebar() {
  const { tok, users, groups, setGroups, onlineIDs, activeChatID, setActiveChatID, unreadDM, clearUnread, unreadGroup, clearUnreadGroup } = useStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('dm')

  useEffect(() => {
    if (!tok || groups.length > 0) return
    apiFetch(tok, '/api/groups').then(d => setGroups(d || [])).catch(() => {})
  }, [tok])

  const filtered = users.filter(u =>
    dname(u).toLowerCase().includes(search.toLowerCase())
  )

  function openChat(uid) {
    setActiveChatID(uid)
    clearUnread(uid)
  }

  function openGroup(gid) {
    const key = 'g:' + gid
    setActiveChatID(key)
    clearUnreadGroup(key)
  }

  const filteredGroups = groups.filter(g =>
    (g.title || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="chat-sb">
      <div className="chat-sb-head">Messages</div>
      <div style={{ display: 'flex', gap: 4, padding: '0 8px 8px' }}>
        <button
          className={`btn btn-sm ${tab === 'dm' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => setTab('dm')}
        >DMs</button>
        <button
          className={`btn btn-sm ${tab === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => setTab('groups')}
        >Groups</button>
      </div>
      <input
        className="chat-srch"
        placeholder={tab === 'dm' ? 'Search people…' : 'Search groups…'}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="chat-list">
        {tab === 'dm' && filtered.map(u => {
          const online = onlineIDs.has(u.id)
          const unread = unreadDM[u.id] || 0
          return (
            <div
              key={u.id}
              className={`chat-item ${activeChatID === u.id ? 'active' : ''}`}
              onClick={() => openChat(u.id)}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar user={u} size={35} />
                <span className={`pdot ${online ? 'on' : ''}`} />
              </div>
              <div className="ci-info">
                <div className="ci-name">{dname(u)}</div>
                <div className="ci-last">{online ? 'Online' : 'Offline'}</div>
              </div>
              {unread > 0 && <span className="ubadge">{unread}</span>}
            </div>
          )
        })}
        {tab === 'groups' && filteredGroups.map(g => {
          const key = 'g:' + g.id
          const unread = unreadGroup[key] || 0
          return (
            <div
              key={g.id}
              className={`chat-item ${activeChatID === key ? 'active' : ''}`}
              onClick={() => openGroup(g.id)}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 35, height: 35, borderRadius: '50%',
                  background: 'var(--accent)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: '#fff', fontSize: 14,
                }}>{(g.title || 'G')[0].toUpperCase()}</div>
              </div>
              <div className="ci-info">
                <div className="ci-name">{g.title}</div>
                <div className="ci-last">Group chat</div>
              </div>
              {unread > 0 && <span className="ubadge">{unread}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
