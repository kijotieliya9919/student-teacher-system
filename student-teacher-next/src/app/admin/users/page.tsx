'use client'

import { useEffect, useState } from 'react'
import { store } from '@/lib/store'
import type { User } from '@/lib/store'

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'student' as User['role'], classId: '' })
  const [classes, setClasses] = useState<{ id: number; name: string; code: string }[]>([])

  const load = () => { setUsers(store.users.all()); setClasses(store.classes.all()) }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ email: '', password: '', fullName: '', role: 'student', classId: '' })
    setShowModal(true)
  }

  function openEdit(u: User) {
    setEditing(u)
    setForm({ email: u.email, password: '', fullName: u.fullName, role: u.role, classId: u.classId?.toString() || '' })
    setShowModal(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      const changes: Partial<User> = { fullName: form.fullName, role: form.role }
      if (form.classId) changes.classId = Number(form.classId)
      else changes.classId = undefined
      store.users.update(editing.id, changes)
    } else {
      const result = store.auth.register({
        email: form.email,
        password: form.password || 'changeme',
        fullName: form.fullName,
        role: form.role === 'admin' ? 'student' : (form.role as 'student' | 'teacher'),
        classId: form.classId ? Number(form.classId) : undefined,
      })
      if (!result.ok) { alert(result.error); return }
      if (!result.user) { alert('Failed to create user'); return }
      if (form.role === 'admin') {
        store.users.update(result.user.id, { role: 'admin' })
      }
    }
    setShowModal(false)
    load()
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return
    store.users.delete(id)
    load()
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>Users</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>{users.length} total users</p>
        </div>
        <button onClick={openNew} className="btn-primary" style={{ padding: '10px 24px' }}>+ Add User</button>
      </div>

      <div className="card-3d" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="table-3d">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Class</th><th style={{ width: 120 }}>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color: '#fff', fontWeight: 600 }}>{u.fullName}</td>
                <td style={{ color: 'rgba(255,255,255,0.6)' }}>{u.email}</td>
                <td><span className={'badge ' + (u.role === 'admin' ? 'badge-red' : u.role === 'teacher' ? 'badge-green' : 'badge-gold')}>{u.role}</span></td>
                <td style={{ color: 'rgba(255,255,255,0.5)' }}>{u.classId ? store.classes.byId(u.classId)?.name || '-' : '-'}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(u)} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}>Edit</button>
                  <button onClick={() => handleDelete(u.id)} className="btn-danger" style={{ padding: '6px 14px', fontSize: 13 }}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit User' : 'Add User'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="text" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required placeholder="Full Name" className="input-glass" />
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="Email" className="input-glass" disabled={!!editing} />
              {!editing && <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Password" className="input-glass" />}
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as User['role'] })} className="input-glass">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
              {form.role === 'student' && (
                <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="input-glass">
                  <option value="">-- No class --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editing ? 'Save' : 'Create'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
