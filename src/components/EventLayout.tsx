'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS, formatDateRange } from '@/lib/types'

interface Props {
  eventId: string
  children: React.ReactNode
}

const TABS = (id: string) => [
  { href: `/akce/${id}/prehled`,  label: '📊 Přehled'  },
  { href: `/akce/${id}/vydaje`,   label: '💸 Výdaje'   },
  { href: `/akce/${id}/prijmy`,   label: '💰 Příjmy'   },
  { href: `/akce/${id}/lineup`,   label: '🎧 Lineup'   },
  { href: `/akce/${id}/tym`,      label: '👥 Tým'      },
  { href: `/akce/${id}/poznamky`, label: '📝 Poznámky' },
  { href: `/akce/${id}/soubory`,  label: '📎 Soubory'  },
]

export default function EventLayout({ eventId, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => setEvent(data))
  }, [eventId])

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/akce" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>← Zpět na akce</Link>
        <div className="event-header-row" style={{ marginTop: '8px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>{event?.name || '...'}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {event?.date && <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>}
              {event?.location && <span>📍 {event.location}</span>}
            </div>
          </div>
          {event && (
            <div className="event-header-actions">
              <button
                onClick={() => router.push(`/akce/${eventId}/tisk`)}
                style={{ padding: '6px 14px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
              >
                🖨️ Tisk / PDF
              </button>
              <span className={STATUS_COLORS[event.status]} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                {STATUS_LABELS[event.status]}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="event-tabs-wrap">
        <div className="event-tabs-inner">
          {TABS(eventId).map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link key={tab.href} href={tab.href} style={{
                padding: '8px 18px', borderRadius: '7px', fontSize: '13px',
                fontWeight: isActive ? '600' : '400',
                backgroundColor: isActive ? '#e05555' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                textDecoration: 'none', transition: 'all 0.15s',
              }}>
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
