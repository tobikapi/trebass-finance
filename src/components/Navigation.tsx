'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/app/login/actions'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/akce', label: 'Akce' },
  { href: '/kalendar', label: 'Kalendář' },
  { href: '/ukoly', label: 'Úkoly' },
  { href: '/kontakty', label: 'Kontakty' },
  { href: '/archiv', label: 'Archiv' },
]

const MEMBER_COLORS: Record<string, string> = {
  'Tobiáš': '#f4978e', 'Jakub': '#60a5fa', 'Metoděj': '#34d399', 'Artur': '#fbbf24',
}

export default function Navigation() {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string>('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.name || user.email?.split('@')[0] || ''
        setUserName(name)
      }
    })
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const avatarColor = MEMBER_COLORS[userName] || '#e05555'
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <header style={{ backgroundColor: '#111111', borderBottom: '1px solid #2d1515', position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Top row */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: '64px', gap: '32px' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Image src="/logo.png" alt="Třebass" width={120} height={45}
            style={{ objectFit: 'contain', height: '36px', width: 'auto' }} />
        </Link>

        {/* Desktop nav */}
        <nav className="nav-desktop">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                padding: '6px 16px', borderRadius: '6px', fontSize: '15px',
                fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.08em',
                color: isActive ? '#f4978e' : '#9ca3af',
                backgroundColor: isActive ? '#2d1515' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
                borderBottom: isActive ? '2px solid #e05555' : '2px solid transparent',
              }}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Desktop user + logout */}
        {userName && (
          <div className="nav-user-desktop">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%',
                backgroundColor: avatarColor, color: '#0c0c0c',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700',
              }}>{initials}</div>
              <span style={{ fontSize: '13px', color: '#9ca3af', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.08em' }}>
                {userName}
              </span>
            </div>
            <button disabled={isPending} onClick={() => startTransition(() => signOut())}
              style={{ fontSize: '12px', color: '#4b5563', background: 'none', border: '1px solid #2d2d2d', borderRadius: '6px', cursor: 'pointer', padding: '4px 12px' }}>
              Odhlásit
            </button>
          </div>
        )}

        {/* Mobile hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="nav-mobile-dropdown">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className={`nav-mobile-link${isActive ? ' active' : ''}`}>
                {item.label}
              </Link>
            )
          })}

          {userName && (
            <>
              <div className="nav-mobile-divider" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    backgroundColor: avatarColor, color: '#0c0c0c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: '700',
                  }}>{initials}</div>
                  <span style={{ fontSize: '14px', color: '#9ca3af' }}>{userName}</span>
                </div>
                <button disabled={isPending} onClick={() => startTransition(() => signOut())}
                  style={{ fontSize: '13px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                  Odhlásit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  )
}
