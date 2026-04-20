import Topbar from './Topbar'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Topbar />
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
