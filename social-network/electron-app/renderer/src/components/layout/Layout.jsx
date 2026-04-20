import Topbar from './Topbar'
import Sidebar from './Sidebar'
import { useOnline } from '../../hooks/useOnline'

const OFFLINE_MSG = 'You are offline. Check your internet connection.'

export default function Layout({ children }) {
  const online = useOnline()

  return (
    <div className="app-shell">
      {!online && (
        <div role="alert" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#b91c1c', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.5rem', padding: '0.55rem 1rem',
          fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
        }}>
          <i className="bi bi-wifi-off" style={{ fontSize: 16 }} />
          {OFFLINE_MSG}
        </div>
      )}
      <Topbar />
      <Sidebar />
      <main className="main-content" style={!online ? { paddingTop: '2.4rem' } : undefined}>
        {children}
      </main>
    </div>
  )
}
