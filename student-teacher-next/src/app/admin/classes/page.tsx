'use client'

import { useEffect, useState } from 'react'
import { store } from '@/lib/store'
import type { Class } from '@/lib/store'

export default function AdminClasses() {
  const [classes, setClasses] = useState<Class[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Class | null>(null)
  const [form, setForm] = useState({ name: '', code: '' })

  const load = () => setClasses(store.classes.all())
  useEffect(() => { load() }, [])

  function openNew() { setEditing(null); setForm({ name: '', code: '' }); setShowModal(true) }
  function openEdit(c: Class) { setEditing(c); setForm({ name: c.name, code: c.code }); setShowModal(true) }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (editing) store.classes.update(editing.id, form)
    else store.classes.create(form)
    setShowModal(false)
    load()
  }

  function handleDelete(id: number) {
    if (!confirm('Delete this class?')) return
    store.classes.delete(id)
    load()
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>Classes</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>{classes.length} total classes</p>
        </div>
        <button onClick={openNew} className="btn-primary" style={{ padding: '10px 24px' }}>+ Add Class</button>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {classes.map((c, i) => (
          <div key={c.id} className="card-3d" style={{ padding: 24, animation: `fadeInUp 0.3s ease ${i * 0.05}s forwards`, opacity: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{c.name}</h3>
                <span className="badge badge-gold">{c.code}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEdit(c)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>Edit</button>
                <button onClick={() => handleDelete(c.id)} className="btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>Del</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit Class' : 'Add Class'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Class Name" className="input-glass" />
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="Class Code (e.g. FOR101)" className="input-glass" />
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
