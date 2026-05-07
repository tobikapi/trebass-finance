'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Event, STATUS_LABELS, STATUS_COLORS, formatDateRange } from '@/lib/types'
import { useUser } from '@/lib/user-context'

interface Props {
  eventId: string
  children: React.ReactNode
}

export default function EventLayout({ eventId, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const { can } = useUser()

  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => setEvent(data))
  }, [eventId])

  const allTabs = [
    { href: `/akce/${eventId}/vydaje`, label: '💸 Výdaje', permission: 'viewVydaje' as const },
    { href: `/akce/${eventId}/prijmy`, label: '💰 Příjmy', permission: 'viewPrijmy' as const },
    { href: `/akce/${eventId}/lineup`, label: '🎧 Lineup', permission: 'viewLineup' as const },
    { href: `/akce/${eventId}/tym`, label: '👥 Tým', permission: 'viewTym' as const },
    { href: `/akce/${eventId}/poznamky`, label: '📝 Poznámky', permission: 'viewPoznamky' as const },
    { href: `/akce/${eventId}/soubory`, label: '📎 Soubory', permission: 'viewSoubory' as const },
  ]

  const tabs = allTabs.filter(tab => can(tab.permission))

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/akce" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← Zpět na akce</Link>
        <div className="event-header-row" style={{ marginTop: '8px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>{event?.name || '...'}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
              {event?.date && <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>}
              {event?.location && <span>📍 {event.location}</span>}
            </div>
          </div>
          {event && (
            <div className="event-header-actions">
              <button
                onClick={() => router.push(`/akce/${eventId}/tisk`)}
                style={{ padding: '6px 14px', backgroundColor: '#1e1e1e', color: '#9ca3af', border: '1px solid #2d2d2d', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                🖨️ Tisk / PDF
              </button>
              <span className={`${STATUS_COLORS[event.status]}`} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs — horizontally scrollable on mobile */}
      <div className="event-tabs-wrap">
        <div className="event-tabs-inner">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '400',
                  backgroundColor: isActive ? '#e05555' : 'transparent',
                  color: isActive ? '#fff' : '#9ca3af',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {children}
    </div>
  )
}
