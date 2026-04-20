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
  const { page, setPage } = useStore()
  return (
    <nav className="nav-sidebar">
      {NAV.map(n => (
        <div key={n.key} className={`ni ${page === n.key ? 'active' : ''}`} onClick={() => setPage(n.key)}>
          <i className={`bi ${n.icon} ni-icon`} />
          {n.label}
        </div>
      ))}
    </nav>
  )
}
