'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef, useTransition } from 'react'
import { signOut } from '@/app/login/actions'
import { useUser } from '@/lib/user-context'
import type { PermissionKey } from '@/lib/permissions'
import { useTheme } from '@/lib/theme-context'
import { supabase } from '@/lib/supabase'
import { ORG_BRANDS } from '@/lib/orgs'

const NAV_ITEMS: { href: string; label: string; permission: PermissionKey }[] = [
  { href: '/',          label: 'Dashboard', permission: 'viewDashboard' },
  { href: '/firma',     label: 'Firma',     permission: 'viewFirma'     },
  { href: '/akce',      label: 'Akce',      permission: 'viewAkce'      },
  { href: '/kalendar',  label: 'Kalendář',  permission: 'viewKalendar'  },
  { href: '/ukoly',     label: 'Úkoly',     permission: 'viewUkoly'     },
  { href: '/kontakty',  label: 'Kontakty',  permission: 'viewKontakty'  },
  { href: '/archiv',    label: 'Archiv',    permission: 'viewArchiv'    },
  { href: '/admin',     label: 'Role',      permission: 'manageUsers'   },
]

const MEMBER_COLORS: Record<string, string> = {
  'Tobiáš': '#f4978e', 'Jakub': '#60a5fa', 'Metoděj': '#34d399', 'Artur': '#fbbf24',
}

export default function Navigation() {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const { user, profile, can, orgId, orgs, brand } = useUser()
  const { theme, toggleTheme } = useTheme()

  const visibleNavItems = NAV_ITEMS.filter(item => can(item.permission))

  // Zobrazované jméno může chybět (starý účet bez vyplněného Jména) — pak
  // se vezme aspoň přihlašovací jméno z e-mailu, ať odhlašovací tlačítko
  // nezmizí úplně jen kvůli prázdnému poli.
  const userName = profile?.name || profile?.email?.replace(/@trebass\.cz$/, '') || ''
  const avatarColor = MEMBER_COLORS[userName] || '#d15c49'
  const initials = userName.slice(0, 2).toUpperCase()

  const [nextEvent, setNextEvent] = useState<{ name: string; date: string; time_start: string | null } | null>(null)
  const [cdParts, setCdParts] = useState<{ d: number; h: number; m: number; s: number } | null>(null)
  const [refetchKey, setRefetchKey] = useState(0)

  useEffect(() => {
    if (!orgId) return
    supabase.from('events').select('name, date, time_start')
      .eq('org_id', orgId ?? '').eq('status', 'pripravuje_se').not('date', 'is', null)
      .order('date', { ascending: true }).limit(1).maybeSingle()
      .then(({ data }) => setNextEvent(data ?? null))
  }, [refetchKey, orgId])

  useEffect(() => {
    if (!nextEvent?.date) return
    function tick() {
      const [y, mo, day] = nextEvent!.date.split('-').map(Number)
      const [hh, mm] = (nextEvent!.time_start || '00:00').split(':').map(Number)
      const diff = new Date(y, mo - 1, day, hh || 0, mm || 0).getTime() - Date.now()
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
    <header className="site-header" style={{ backgroundColor: 'var(--bg-nav)', borderBottom: '1px solid var(--border-subtle)', position: 'sticky', top: 0, zIndex: 50, transition: 'background-color 0.2s',
      // iPhone v režimu appky: obsah nesmí pod výřez / status bar
      paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <div className="nav-bar-desktop" style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', height: '64px', gap: '32px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            {brand.logo ? (
              <Image src={brand.logo} alt={brand.name} width={120} height={45}
                style={{ objectFit: 'contain', height: '36px', width: 'auto', filter: isLight ? 'brightness(0.85)' : 'none' }} />
            ) : (
              <span className="org-wordmark" style={{ color: brand.accent }}>{brand.name}</span>
            )}
          </Link>
          {orgs.length > 1 && <OrgSwitcher />}
        </div>

        <nav className="nav-desktop">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{
                padding: '6px 16px', borderRadius: '6px', fontSize: '15px',
                fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
                color: isActive ? brand.accent : 'var(--text-secondary)',
                backgroundColor: isActive ? brand.accentSoft : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
                borderBottom: isActive ? `2px solid ${brand.accent}` : '2px solid transparent',
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
                    <div style={{ fontSize: '20px', fontWeight: '800', color: brand.accent, fontFamily: "'Courier New', monospace", lineHeight: 1, minWidth: '26px', letterSpacing: '-1px' }}>
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

        {user && (
          <div className="nav-user-desktop">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700' }}>
                {initials}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em' }}>
                {userName}
              </span>
            </div>
            <button disabled={isPending} onClick={() => startTransition(async () => { await signOut(); window.location.assign('/login') })}
              style={{ fontSize: '12px', color: '#d15c49', background: 'none', border: '1px solid #3d1515', borderRadius: '6px', cursor: 'pointer', padding: '5px 14px', transition: 'all 0.15s' }}>
              Odhlásit
            </button>
          </div>
        )}

      </div>

      {/* ===== Mobil a tablet (≤1100 px) — podle návrhu z iPhonu ===== */}
      <div className="nav-bar-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', minHeight: '56px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label={`${brand.name} – Dashboard`}>
            {brand.logo ? (
              <Image src={brand.logo} alt={brand.name} width={96} height={36}
                style={{ objectFit: 'contain', height: '30px', width: 'auto', filter: isLight ? 'brightness(0.85)' : 'none' }} />
            ) : (
              <span className="org-wordmark" style={{ color: brand.accent, fontSize: '21px' }}>{brand.name}</span>
            )}
          </Link>
          {orgs.length > 1 && <OrgSwitcher compact />}
          <div style={{ flex: 1 }} />
          <button onClick={toggleTheme} aria-label={isLight ? 'Tmavý režim' : 'Světlý režim'}
            style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0, backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isLight ? '🌙' : '☀️'}
          </button>
          {user && (
            <>
              <div title={userName} aria-label={userName} style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                {initials}
              </div>
              <button disabled={isPending} onClick={() => startTransition(async () => { await signOut(); window.location.assign('/login') })}
                style={{ minHeight: '44px', padding: '0 12px', fontSize: '13px', color: brand.accent, background: 'none', border: `1px solid ${brand.accent}55`, borderRadius: '10px', cursor: 'pointer', flexShrink: 0 }}>
                {isPending ? '…' : 'Odhlásit'}
              </button>
            </>
          )}
        </div>

        {nextEvent && cdParts && (
          <div style={{ padding: '0 14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nextEvent.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', flexShrink: 0, fontFamily: "'Courier New', monospace", fontWeight: 800, color: brand.accent, fontSize: '15px' }} aria-label="Odpočet do akce">
                {(cdParts.d > 0
                  ? [{ v: cdParts.d, u: 'd' }, { v: cdParts.h, u: 'h' }, { v: cdParts.m, u: 'm' }, { v: cdParts.s, u: 's' }]
                  : [{ v: cdParts.h, u: 'h' }, { v: cdParts.m, u: 'm' }, { v: cdParts.s, u: 's' }]
                ).map(({ v, u }, i, arr) => (
                  <span key={u} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '1px' }}>
                    {String(v).padStart(2, '0')}<span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: 600 }}>{u}</span>
                    {i < arr.length - 1 && <span style={{ color: 'var(--text-dim)', margin: '0 1px' }}>:</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>

    {/* Záložky sekcí — na mobilu místo hamburgeru, přilepené nahoře */}
    <MobileTabs items={visibleNavItems} pathname={pathname} />
    </>
  )
}

// Přepínač firmy (jen pro lidi ve více firmách). Přepnutí = plné načtení
// appky v nové firmě (seznamy, role, vzhled i undo patří k firmě).
function OrgSwitcher({ compact = false }: { compact?: boolean }) {
  const { orgs, orgId, brand, switchOrg } = useUser()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title="Přepnout firmu"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: compact ? '0 10px' : '5px 10px', borderRadius: '8px',
          minHeight: compact ? '36px' : undefined, textTransform: compact ? 'uppercase' : undefined,
          fontSize: compact ? '11px' : '12px', fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer',
          color: brand.accent, backgroundColor: brand.accentSoft, border: `1px solid ${brand.accent}55`,
        }}>
        {brand.name} <span style={{ fontSize: '10px', opacity: 0.8 }}>⇄</span>
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: '200px', zIndex: 60,
          backgroundColor: 'var(--bg-nav)', border: '1px solid var(--border)', borderRadius: '10px',
          boxShadow: 'var(--shadow)', padding: '6px',
        }}>
          {orgs.map(o => {
            const b = ORG_BRANDS[o.slug]
            const active = o.id === orgId
            return (
              <button key={o.id} role="menuitemradio" aria-checked={active}
                onClick={() => { setOpen(false); if (!active) switchOrg(o.id) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', minHeight: '44px',
                  borderRadius: '7px', border: 'none', cursor: active ? 'default' : 'pointer', textAlign: 'left',
                  fontSize: '14px', fontWeight: 600,
                  color: active ? b.accent : 'var(--text-primary)',
                  backgroundColor: active ? b.accentSoft : 'transparent',
                }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: b.accent, flexShrink: 0 }} />
                {o.name}
                {active && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Vodorovně posuvné záložky sekcí (mobil/tablet). Aktivní se po načtení
// posune do viditelné části, ať je vidět, kde člověk je.
function MobileTabs({ items, pathname }: { items: { href: string; label: string }[]; pathname: string }) {
  const { brand } = useUser()
  const ref = useRef<HTMLDivElement>(null)
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-current="page"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  if (items.length === 0) return null
  return (
    <nav className="nav-m-tabs" aria-label="Sekce">
      <div ref={ref} className="nav-m-tabs-inner">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', minHeight: '40px', padding: '0 14px', borderRadius: '10px',
                fontSize: '14px', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.08em',
                textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                color: active ? brand.accent : 'var(--text-secondary)',
                backgroundColor: active ? brand.accentSoft : 'transparent',
                border: `1px solid ${active ? brand.accent + '66' : 'transparent'}`,
              }}>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
