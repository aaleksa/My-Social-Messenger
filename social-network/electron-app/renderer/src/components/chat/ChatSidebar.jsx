import { useState } from 'react'
import { useStore } from '../../store'
import { dname } from '../../lib/api'
import Avatar from '../ui/Avatar'

export default function ChatSidebar() {
  const { users, onlineIDs, activeChatID, setActiveChatID, unreadDM, clearUnread } = useStore()
  const [search, setSearch] = useState('')

  const filtered = users.filter(u =>
    dname(u).toLowerCase().includes(search.toLowerCase())
  )

  function openChat(uid) {
    setActiveChatID(uid)
    clearUnread(uid)
  }

  return (
    <div className="chat-sb">
      <div className="chat-sb-head">Messages</div>
      <input
        className="chat-srch"
        placeholder="Search people…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="chat-list">
        {filtered.map(u => {
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
      </div>
    </div>
  )
}
