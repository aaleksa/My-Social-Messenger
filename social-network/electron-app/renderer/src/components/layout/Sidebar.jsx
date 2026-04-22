import { useStore } from '../../store'

const NAV = [
  { key: 'feed',          icon: 'bi-house',          label: 'Feed' },
  { key: 'profile',       icon: 'bi-person-circle',  label: 'Profile' },
  { key: 'people',        icon: 'bi-people',         label: 'People' },
  { key: 'groups',        icon: 'bi-grid',           label: 'Groups' },
  { key: 'chat',          icon: 'bi-chat-dots',      label: 'Chat' },
  { key: 'notifications', icon: 'bi-bell',           label: 'Notifications' },
]

export default function Sidebar() {
  const { page, setPage, unreadDM, unreadGroup, notifCnt, resetNotif } = useStore()

  const totalDM = Object.values(unreadDM).reduce((s, v) => s + v, 0)
  const totalGroup = Object.values(unreadGroup).reduce((s, v) => s + v, 0)

  const badges = {
    chat: totalDM,
    groups: totalGroup,
    notifications: notifCnt,
  }

  function navigate(key) {
    setPage(key)
    if (key === 'notifications') resetNotif()
  }

  return (
    <nav className="nav-sidebar">
      {NAV.map(n => {
        const badge = badges[n.key] || 0
        return (
          <div key={n.key} className={`ni ${page === n.key ? 'active' : ''}`} onClick={() => navigate(n.key)}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <i className={`bi ${n.icon} ni-icon`} />
              {badge > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  minWidth: 14, height: 14, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px', lineHeight: 1,
                }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </div>
            {n.label}
          </div>
        )
      })}
    </nav>
  )
}
