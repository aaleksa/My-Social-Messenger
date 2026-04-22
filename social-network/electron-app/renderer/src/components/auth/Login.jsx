import { useState } from 'react'
import { useStore } from '../../store'
import { apiFetch } from '../../lib/api'
import { connectWS } from '../../lib/ws'

export default function Login() {
  const store = useStore
  const { setMe, setTok, setUsers } = useStore()
  const [tab, setTab] = useState('login') // 'login' | 'register'

  // Login state
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Register state
  const [reg, setReg] = useState({
    email: '', password: '', first_name: '', last_name: '',
    date_of_birth: '', nickname: '', about_me: '',
  })
  const [showRegPw, setShowRegPw] = useState(false)

  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function finishAuth(data) {
    if (data && data.session_id) {
      const tok = data.session_id
      setTok(tok)
      if (window.electronAPI) window.electronAPI.saveSession({ token: tok })
      try {
        const user = await apiFetch(tok, '/api/me')
        setMe(user)
        connectWS(store)
        // Load users list so Chat sidebar has contacts immediately
        apiFetch(tok, '/api/users').then(list => { if (Array.isArray(list)) setUsers(list) }).catch(() => {})
      } catch (ex) {
        setErr('Logged in but failed to load profile: ' + ex.message)
      }
    } else {
      setErr('Invalid response from server')
    }
  }

  async function doLogin(e) {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      const data = await apiFetch(null, '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      })
      finishAuth(data)
    } catch (ex) {
      setErr(ex.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function validateReg() {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(reg.email)) return 'Please enter a valid email address.'
    if (!reg.date_of_birth) return 'Date of birth is required.'
    const age = (Date.now() - new Date(reg.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)
    if (age < 13) return 'You must be at least 13 years old to register.'
    if ((reg.password || '').length < 6) return 'Password must be at least 6 characters.'
    return null
  }

  async function doRegister(e) {
    e.preventDefault()
    const validErr = validateReg()
    if (validErr) { setErr(validErr); return }
    setErr(''); setLoading(true)
    try {
      const data = await apiFetch(null, '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(reg),
      })
      finishAuth(data)
    } catch (ex) {
      setErr(ex.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  function setR(field) {
    return e => setReg(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>💬 Social Messenger</h1>

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setErr('') }}>Sign In</button>
          <button className={`tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => { setTab('register'); setErr('') }}>Sign Up</button>
        </div>

        {tab === 'login' && (
          <form onSubmit={doLogin}>
            <div className="fg">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={pass}
                  onChange={e => setPass(e.target.value)} required style={{ paddingRight: 38 }} />
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
        )}

        {tab === 'register' && (
          <form onSubmit={doRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div className="fg">
                <label>First Name *</label>
                <input value={reg.first_name} onChange={setR('first_name')} required />
              </div>
              <div className="fg">
                <label>Last Name *</label>
                <input value={reg.last_name} onChange={setR('last_name')} required />
              </div>
            </div>
            <div className="fg">
              <label>Email *</label>
              <input type="email" value={reg.email} onChange={setR('email')} required />
            </div>
            <div className="fg">
              <label>Date of Birth *</label>
              <input type="date" value={reg.date_of_birth} onChange={setR('date_of_birth')} required />
            </div>
            <div className="fg">
              <label>Password *</label>
              <div style={{ position: 'relative' }}>
                <input type={showRegPw ? 'text' : 'password'} value={reg.password}
                  onChange={setR('password')} required style={{ paddingRight: 38 }} />
                <button type="button" className="toggle-pw" onClick={() => setShowRegPw(v => !v)}>
                  <i className={`bi bi-eye${showRegPw ? '-slash' : ''}`} />
                </button>
              </div>
            </div>
            <div className="fg">
              <label>Nickname <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <input value={reg.nickname} onChange={setR('nickname')} />
            </div>
            <div className="fg">
              <label>About Me <span style={{ opacity: 0.5 }}>(optional)</span></label>
              <textarea rows={3} value={reg.about_me} onChange={setR('about_me')}
                style={{ resize: 'vertical' }} />
            </div>
            {err && <p className="login-err">{err}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
