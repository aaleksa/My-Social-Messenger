import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch } from '../../lib/api'
import { connectWS } from '../../lib/ws'

export default function Login() {
  const store = useStore
  const { setMe, setTok } = useStore()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const data = await apiFetch(null, '/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      })
      if (data && data.token && data.user) {
        setTok(data.token)
        setMe(data.user)
        if (window.electronAPI) window.electronAPI.saveSession({ token: data.token })
        connectWS(store)
      } else {
        setErr('Invalid response from server')
      }
    } catch (ex) {
      setErr(ex.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>💬 Social Messenger</h1>
        <p className="sub">Sign in to your account</p>
        <form onSubmit={doLogin}>
          <div className="fg">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="fg">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={pass}
                onChange={e => setPass(e.target.value)}
                required
                style={{ paddingRight: 38 }}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(v => !v)}>
                <i className={`bi bi-eye${showPw ? '-slash' : ''}`} />
              </button>
            </div>
          </div>
          {err && <p className="login-err">{err}</p>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
