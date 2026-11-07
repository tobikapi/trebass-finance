'use client'

import { usePathname } from 'next/navigation'
import Navigation from './Navigation'
import IdleTimer from './IdleTimer'
import EmberParticles from './EmberParticles'
import ViewAsBanner from './ViewAsBanner'
import { useUser } from '@/lib/user-context'
import { defaultBg } from '@/lib/orgs'
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { orgId, orgLook } = useUser()
  // Pozadí si nastavuje admin světa (Role → Vzhled světa). Bez vlastního:
  // Třebass má fotku pódia, ostatní nic. Na telefonu jen když to admin zapne.
  const bgUrl = orgLook.bgUrl ?? defaultBg(orgId)
  const showPhoto = !!bgUrl
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

  return (
    <>
      {/* Background foto s overlayem */}
      <div className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        {showPhoto && <div className={orgLook.bgMobile ? undefined : 'app-bg-photo'} style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${bgUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
        }} />}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--overlay)', opacity: showPhoto ? orgLook.bgDim / 82 : 1, transition: 'background-color 0.2s' }} />
      </div>

      <EmberParticles />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ViewAsBanner />
        <IdleTimer />
        <Navigation />
        <main className="page-main">
          {children}
        </main>
      </div>
    </>
  )
}
