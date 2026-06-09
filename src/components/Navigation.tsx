'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useTransition } from 'react'
import { signOut } from '@/app/login/actions'
import { useUser } from '@/lib/user-context'
import { useTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/',          label: 'Dashboard' },
  { href: '/firma',     label: 'Firma'     },
  { href: '/akce',      label: 'Akce'      },
  { href: '/kalendar',  label: 'Kalendář'  },
  { href: '/ukoly',     label: 'Úkoly'     },
  { href: '/kontakty',  label: 'Kontakty'  },
  { href: '/archiv',    label: 'Archiv'    },
]

const MEMBER_COLORS: Record<string, string> = {
  'Tobiáš': '#f4978e', 'Jakub': '#60a5fa', 'Metoděj': '#34d399', 'Artur': '#fbbf24',
}

export default function Navigation() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { profile } = useUser()
  const { theme, toggleTheme } = useTheme()

  const userName = profile?.name || ''
  const avatarColor = MEMBER_COLORS[userName] || '#e05555'
  const initials = userName.slice(0, 2).toUpperCase()

  const [nextEvent, setNextEvent] = useState<{ name: string; date: string } | null>(null)
  const [cdParts, setCdParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    supabase.from('events').select('name, date')
      .eq('status', 'pripravuje_se').not('date', 'is', null)
      .order('date', { ascending: true }).limit(1).single()
      .then(({ data }) => setNextEvent(data ?? null))
  }, [refetchKey])

  useEffect(() => {
    if (!nextEvent?.date) return
    function tick() {
      const [y, mo, day] = nextEvent!.date.split('-').map(Number)
      const diff = new Date(y, mo - 1, day).getTime() - Date.now()
      if (diff <= 0) {
        setNextEvent(null); setCdParts(null); setRefetchKey(k => k + 1); return
      }
      setCdParts({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextEvent])

  const isLight = theme === 'light'

  return (
    <>
    <header style={{ backgroundColor: 'var(--bg-nav)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 50, transition: 'background-color 0.2s' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: '64px', gap: '32px' }}>

        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Image src="/logo.png" alt="Třebass" width={120} height={45}
            style={{ objectFit: 'contain', height: '36px', width: 'auto', filter: isLight ? 'brightness(0.85)' : 'none' }} />
        </Link>

        <nav className="nav-desktop">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                padding: '6px 16px', borderRadius: '6px', fontSize: '15px',
                fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
                color: isActive ? '#e05555' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(224,85,85,0.12)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
                borderBottom: isActive ? '2px solid #e05555' : '2px solid transparent',
              }}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {nextEvent && cdParts && (
          <div className="nav-user-desktop" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '3px', borderRight: '1px solid var(--border-subtle)', paddingRight: '20px', marginRight: '4px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {nextEvent.name.length > 24 ? nextEvent.name.slice(0, 24) + '…' : nextEvent.name}
            </div>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end' }}>
              {(cdParts.d > 0
                ? [{ v: cdParts.d, u: 'DNŮ' }, { v: cdParts.h, u: 'HOD' }, { v: cdParts.m, u: 'MIN' }, { v: cdParts.s, u: 'SEK' }]
                : [{ v: cdParts.h, u: 'HOD' }, { v: cdParts.m, u: 'MIN' }, { v: cdParts.s, u: 'SEK' }]
              ).map(({ v, u }, i, arr) => (
                <div key={u} style={{ display: 'flex', alignItems: 'flex-end', gap: '5px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#e05555', fontFamily: "'Courier New', monospace", lineHeight: 1, minWidth: '26px', letterSpacing: '-1px' }}>
                      {String(v).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '7px', color: 'var(--text-dim)', letterSpacing: '0.1em', marginTop: '1px' }}>{u}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dim)', lineHeight: 1, marginBottom: '10px' }}>:</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={toggleTheme} title={isLight ? 'Tmavý režim' : 'Světlý režim'}
          className="nav-user-desktop"
          style={{ width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0, backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', color: 'var(--text-secondary)' }}>
          {isLight ? '🌙' : '☀️'}
        </button>

        {userName && (
          <div className="nav-user-desktop">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                {initials}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em' }}>
                {userName}
              </span>
            </div>
            <button disabled={isPending} onClick={() => startTransition(() => signOut())}
              style={{ fontSize: '12px', color: '#e05555', background: 'none', border: '1px solid #3d1515', borderRadius: '6px', cursor: 'pointer', padding: '5px 14px', transition: 'all 0.15s' }}>
              Odhlásit
            </button>
          </div>
        )}

        <div className="nav-hamburger">
          <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', fontSize: '22px', color: menuOpen ? '#f4978e' : 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </header>

    {menuOpen && (
      <div className="nav-mobile-dropdown">
        <div style={{ padding: '8px 16px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                className={`nav-mobile-link${isActive ? ' active' : ''}`}>
                {item.label}
              </Link>
            )
          })}
        </div>

        {userName && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
                {initials}
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: '500', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.06em' }}>
                {userName}
              </div>
              <button onClick={toggleTheme}
                style={{ marginLeft: 'auto', width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isLight ? '🌙' : '☀️'}
              </button>
            </div>
            <button disabled={isPending} onClick={() => startTransition(() => signOut())}
              style={{ width: '100%', padding: '13px', backgroundColor: '#1a0808', color: '#e05555', border: '1px solid #3d1515', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.06em' }}>
              {isPending ? 'Odhlašuji...' : 'Odhlásit se'}
            </button>
            <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
          </div>
        )}
      </div>
    )}
    </>
  )
}
