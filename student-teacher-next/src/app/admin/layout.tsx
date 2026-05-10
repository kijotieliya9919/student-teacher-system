'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { store } from '@/lib/store'
import type { User } from '@/lib/store'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<User | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const s = store.auth.session()
    if (!s || s.role !== 'admin') { router.push('/login'); return }
    setSession(s)
  }, [router])

  if (!session) return null

  const links = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/classes', label: 'Classes' },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <nav style={{ width: 260, background: 'rgba(10,54,34,0.8)', backdropFilter: 'blur(16px)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, paddingLeft: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #c9973c, #eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color: '#0a3622' }}>A</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Admin Panel</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{session.fullName}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {links.map(link => (
            <a key={link.href} href={link.href}
              className="nav-link"
              style={pathname === link.href ? { background: 'rgba(201,151,60,0.15)', color: '#eab308', borderLeft: '3px solid #c9973c' } : {}}>
              {link.label}
            </a>
          ))}
        </div>

        <a href="/" onClick={() => store.auth.logout()} className="nav-link" style={{ marginTop: 'auto', color: 'rgba(255,255,255,0.4)' }}>Logout</a>
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {children}
      </main>
    </div>
  )
}
