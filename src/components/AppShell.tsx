'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'
import IdleTimer from './IdleTimer'
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <>
      {/* Background foto s overlayem */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: "url('/photos/photo-7.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }} />
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--overlay)', transition: 'background-color 0.2s' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <IdleTimer />
        <Navigation />
        <main className="page-main">
          {children}
        </main>
      </div>
    </>
  )
}
