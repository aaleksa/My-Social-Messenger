import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { apiFetch } from '../../lib/api'
import GroupDetail from './GroupDetail'
import Modal from '../ui/Modal'

export default function Groups() {
  const { tok } = useStore()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })

  useEffect(() => {
    apiFetch(tok, '/api/groups')
      .then(d => setGroups((d || []).filter(g => g.my_status === 'accepted')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tok])

  async function createGroup(e) {
    e.preventDefault()
    try {
      const g = await apiFetch(tok, '/api/groups', { method: 'POST', body: JSON.stringify(form) })
      setGroups(prev => [g, ...prev])
      setShowCreate(false)
      setForm({ title: '', description: '' })
    } catch (_) {}
  }

  if (selected) return <GroupDetail group={selected} onBack={() => setSelected(null)} />

  return (
    <div>
      <div className="sec-hdr">
        <div className="page-title"><i className="bi bi-grid" /> Groups</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Create Group</button>
      </div>
      {loading && <div className="loading"><span className="spinner" /> Loading…</div>}
      <div className="groups-grid">
        {groups.map(g => (
          <div key={g.id} className="group-card" onClick={() => setSelected(g)}>
            <div className="group-icon">👥</div>
            <div className="group-name">{g.title}</div>
            <div className="group-desc">{g.description}</div>
          </div>
        ))}
      </div>
      {!loading && groups.length === 0 && <div className="empty"><div className="ei">👥</div>No groups yet</div>}
      {showCreate && (
        <Modal title="Create Group" onClose={() => setShowCreate(false)}>
          <form onSubmit={createGroup}>
            <div className="fg"><label>Title</label><input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} required /></div>
            <div className="fg"><label>Description</label><textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} /></div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
