'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⚡' },
  { href: '/akce', label: 'Akce', icon: '🎪' },
  { href: '/archiv', label: 'Archiv', icon: '📦' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col"
      style={{ backgroundColor: '#111118', borderRight: '1px solid #2a2a3e' }}
    >
      <div className="p-6 border-b" style={{ borderColor: '#2a2a3e' }}>
        <div className="text-xl font-bold" style={{ color: '#a78bfa' }}>
          TŘEBASS
        </div>
        <div className="text-xs mt-1" style={{ color: '#6b7280' }}>
          Finance System
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? '#1e1b4b' : 'transparent',
                color: isActive ? '#a78bfa' : '#9ca3af',
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 text-xs" style={{ color: '#4b5563', borderTop: '1px solid #2a2a3e' }}>
        Třebass Finance v1.0
      </div>
    </aside>
  )
}
