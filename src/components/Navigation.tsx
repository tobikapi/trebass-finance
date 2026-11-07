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
  const [sheetOpen, setSheetOpen] = useState(false)

  // Počet úkolů po termínu (červená tečka u Úkolů ve spodní liště)
  const [overdueCount, setOverdueCount] = useState(0)
  useEffect(() => {
    if (!orgId || !can('viewUkoly')) return
    const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).neq('status', 'done').lt('due_date', today)
      .then(({ count }) => setOverdueCount(count ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, pathname])

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
          <Link href="/" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label={`${brand.name} – přehled`}>
            {brand.logo ? (
              <Image src={brand.logo} alt={brand.name} width={96} height={36}
                style={{ objectFit: 'contain', height: '28px', width: 'auto', filter: isLight ? 'brightness(0.85)' : 'none' }} />
            ) : (
              <span className="org-wordmark" style={{ color: brand.accent, fontSize: '20px' }}>{brand.name}</span>
            )}
          </Link>
          {orgs.length > 1 && <OrgSwitcher compact />}
          <div style={{ flex: 1 }} />
          {nextEvent && cdParts && (
            <div className="num" title={`${nextEvent.name} — odpočet`} aria-label={`Do akce ${nextEvent.name}: ${cdParts.d} dní ${cdParts.h} hodin ${cdParts.m} minut`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', minHeight: '32px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', fontSize: '13px', flexShrink: 0 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{eventAbbr(nextEvent.name)}:</span>
              <span style={{ color: brand.accent, fontWeight: 700 }}>
                {(cdParts.d > 0 ? [cdParts.d, cdParts.h, cdParts.m] : [cdParts.h, cdParts.m, cdParts.s]).map(v => String(v).padStart(2, '0')).join(':')}
              </span>
            </div>
          )}
          {user && (
            <button onClick={() => setSheetOpen(true)} aria-label={`Účet: ${userName}`} aria-haspopup="dialog"
              style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>
                {initials}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>

    {/* Záložky sekcí (mobil/tablet) — text s podtržením, posuvné, přilepené nahoře */}
    <MobileTabs items={visibleNavItems} pathname={pathname} />

    {/* Spodní lišta jako u nativní appky + panel „Více“ */}
    <BottomBar items={visibleNavItems} pathname={pathname} overdue={overdueCount} onMore={() => setSheetOpen(true)} />
    {sheetOpen && (
      <MoreSheet
        items={visibleNavItems} pathname={pathname} userName={userName} initials={initials} avatarColor={avatarColor}
        isLight={isLight} onToggleTheme={toggleTheme} pending={isPending}
        onSignOut={() => startTransition(async () => { await signOut(); window.location.assign('/login') })}
        onClose={() => setSheetOpen(false)} />
    )}
    </>
  )
}

// „SALT & BASS - XMAS EDITION“ → „S&B“ (do kapsle s odpočtem)
function eventAbbr(name: string) {
  const parts = name.split(/\s+/).map(w => w === '&' ? '&' : (w.match(/[A-Za-zÁ-Žá-ž0-9]/)?.[0] ?? '')).filter(Boolean)
  return parts.join('').slice(0, 3).toUpperCase() || name.slice(0, 3).toUpperCase()
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
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-current="page"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  if (items.length === 0) return null
  return (
    <nav className="nav-m-tabs" aria-label="Sekce">
      <div ref={ref} className="nav-m-tabs-inner">
        {items.map(item => {
          const active = isActivePath(item.href, pathname)
          return (
            <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`nav-m-tab${active ? ' active' : ''}`}>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function isActivePath(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
}

// Ikony spodní lišty (jednoduché SVG, barva podle currentColor)
const ICONS: Record<string, React.ReactNode> = {
  '/': <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  '/akce': <><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M10 5v12" strokeDasharray="2 2" /></>,
  '/kalendar': <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  '/ukoly': <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 12l2 2 4-4" /></>,
  '/firma': <><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></>,
  '/kontakty': <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.6M18 20a5 5 0 0 0-2.5-4.3" /></>,
  '/archiv': <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  '/admin': <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
}
function Icon({ name }: { name: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] ?? ICONS.more}
    </svg>
  )
}

const BOTTOM_PRIORITY = ['/', '/akce', '/kalendar', '/ukoly', '/firma', '/kontakty']
const BOTTOM_LABEL: Record<string, string> = { '/': 'Přehled' }

function BottomBar({ items, pathname, overdue, onMore }: { items: { href: string; label: string }[]; pathname: string; overdue: number; onMore: () => void }) {
  const primary = BOTTOM_PRIORITY.map(h => items.find(i => i.href === h)).filter((i): i is { href: string; label: string } => !!i).slice(0, 4)
  return (
    <nav className="nav-bottom" aria-label="Rychlá navigace">
      {primary.map(item => {
        const active = isActivePath(item.href, pathname)
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`nav-bottom-item${active ? ' active' : ''}`}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon name={item.href} />
              {item.href === '/ukoly' && overdue > 0 && (
                <span aria-label={`${overdue} po termínu`} style={{ position: 'absolute', top: '-2px', right: '-4px', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#d15c49', border: '2px solid var(--bg-nav)' }} />
              )}
            </span>
            <span>{BOTTOM_LABEL[item.href] ?? item.label}</span>
          </Link>
        )
      })}
      <button type="button" onClick={onMore} className="nav-bottom-item">
        <Icon name="more" />
        <span>Více</span>
      </button>
    </nav>
  )
}

// Panel „Více“ (zespodu): ostatní sekce, firma, motiv, odhlášení
function MoreSheet({ items, pathname, userName, initials, avatarColor, isLight, onToggleTheme, onSignOut, pending, onClose }: {
  items: { href: string; label: string }[]; pathname: string; userName: string; initials: string; avatarColor: string
  isLight: boolean; onToggleTheme: () => void; onSignOut: () => void; pending: boolean; onClose: () => void
}) {
  const { orgs, orgId, switchOrg } = useUser()
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '14px', width: '100%', minHeight: '52px', padding: '0 14px', borderRadius: '12px', fontSize: '16px', color: 'var(--text-primary)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }
  return (
    <div role="dialog" aria-modal="true" aria-label="Více" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} className="sheet"
        style={{ width: '100%', maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--bg-nav)', borderTop: '1px solid var(--border)', borderRadius: '18px 18px 0 0', padding: '8px 12px calc(16px + env(safe-area-inset-bottom))' }}>
        <div style={{ width: '40px', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border)', margin: '4px auto 12px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 14px 14px' }}>
          <span style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: avatarColor, color: '#0c0c0c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700 }}>{initials}</span>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{userName}</span>
        </div>
        {orgs.length > 1 && (
          <div style={{ display: 'flex', gap: '8px', padding: '0 2px 12px' }}>
            {orgs.map(o => {
              const b = ORG_BRANDS[o.slug]; const active = o.id === orgId
              return (
                <button key={o.id} onClick={() => { if (!active) switchOrg(o.id) }} aria-pressed={active}
                  style={{ flex: 1, minHeight: '48px', borderRadius: '12px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.04em', cursor: active ? 'default' : 'pointer',
                    color: active ? b.accent : 'var(--text-secondary)', backgroundColor: active ? b.accentSoft : 'var(--bg-card)', border: `1px solid ${active ? b.accent + '88' : 'var(--border)'}` }}>
                  {o.name}
                </button>
              )
            })}
          </div>
        )}
        {items.map(item => (
          <Link key={item.href} href={item.href} onClick={onClose} style={{ ...row, color: isActivePath(item.href, pathname) ? 'var(--accent)' : 'var(--text-primary)' }}>
            <Icon name={item.href} />{item.label}
          </Link>
        ))}
        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '8px 0' }} />
        <button onClick={onToggleTheme} style={row}>
          <span style={{ width: '24px', textAlign: 'center' }}>{isLight ? '🌙' : '☀️'}</span>{isLight ? 'Tmavý režim' : 'Světlý režim'}
        </button>
        <button onClick={onSignOut} disabled={pending} style={{ ...row, color: '#d15c49' }}>
          <span style={{ width: '24px', textAlign: 'center' }}>⎋</span>{pending ? 'Odhlašuji…' : 'Odhlásit se'}
        </button>
      </div>
    </div>
  )
}
