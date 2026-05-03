'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/akce', label: 'Akce' },
  { href: '/kalendar', label: 'Kalendář' },
  { href: '/ukoly', label: 'Úkoly' },
  { href: '/kontakty', label: 'Kontakty' },
  { href: '/archiv', label: 'Archiv' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <header style={{ backgroundColor: '#111111', borderBottom: '1px solid #2d1515', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', height: '64px', gap: '48px' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Image
            src="/logo.png"
            alt="Třebass"
            width={120}
            height={45}
            style={{ objectFit: 'contain', height: '36px', width: 'auto' }}
          />
        </Link>

        {/* Nav items */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  fontSize: '15px',
                  fontFamily: 'Awakenning, sans-serif',
                  letterSpacing: '0.08em',
                  fontWeight: '400',
                  color: isActive ? '#f4978e' : '#9ca3af',
                  backgroundColor: isActive ? '#2d1515' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  borderBottom: isActive ? '2px solid #e05555' : '2px solid transparent',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right side label */}
        <div style={{ fontSize: '13px', color: '#4b5563', fontFamily: 'Awakenning, sans-serif', letterSpacing: '0.1em' }}>Finance System</div>
      </div>
    </header>
  )
}
