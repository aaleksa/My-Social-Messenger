import { useEffect } from 'react'
import { useStore } from './store'
import { apiFetch } from './lib/api'
import { connectWS } from './lib/ws'
import Toast from './components/ui/Toast'
import Login from './components/auth/Login'
import Layout from './components/layout/Layout'
import Feed from './components/feed/Feed'
import Chat from './components/chat/Chat'
import Groups from './components/groups/Groups'
import Profile from './components/profile/Profile'
import UserProfile from './components/profile/UserProfile'
import People from './components/people/People'
import Notifications from './components/notifications/Notifications'

const PAGES = { feed: Feed, profile: Profile, userprofile: UserProfile, people: People, groups: Groups, chat: Chat, notifications: Notifications }

export default function App() {
  const store = useStore
  const { me, tok, setMe, setTok, setUsers, page } = useStore()

  // Restore session on mount
  useEffect(() => {
    async function init() {
      let savedTok = tok
      if (!savedTok && window.electronAPI) {
        const s = await window.electronAPI.loadSession()
        if (s?.token) { setTok(s.token); savedTok = s.token }
      }
      if (!savedTok) return
      try {
        const u = await apiFetch(savedTok, '/api/me')
        if (u?.id) {
          setMe(u)
          connectWS(store)
          // Load users list so Chat sidebar has contacts
          apiFetch(savedTok, '/api/users').then(list => { if (Array.isArray(list)) setUsers(list) }).catch(() => {})
        }
      } catch (_) {}
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!me) return <><Toast /><Login /></>

  const Page = PAGES[page] || Feed
  return (
    <>
      <Toast />
      <Layout>
        <Page />
      </Layout>
    </>
  )
}
