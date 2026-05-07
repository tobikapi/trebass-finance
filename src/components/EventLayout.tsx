'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Event, STATUS_LABELS, STATUS_COLORS, formatDateRange } from '@/lib/types'

interface Props {
  eventId: string
  children: React.ReactNode
}

export default function EventLayout({ eventId, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => setEvent(data))
  }, [eventId])

  const tabs = [
    { href: `/akce/${eventId}/vydaje`, label: '💸 Výdaje' },
    { href: `/akce/${eventId}/prijmy`, label: '💰 Příjmy' },
    { href: `/akce/${eventId}/lineup`, label: '🎧 Lineup' },
    { href: `/akce/${eventId}/tym`, label: '👥 Tým' },
    { href: `/akce/${eventId}/poznamky`, label: '📝 Poznámky' },
    { href: `/akce/${eventId}/soubory`, label: '📎 Soubory' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/akce" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← Zpět na akce</Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>{event?.name || '...'}</h1>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '13px', color: '#6b7280' }}>
              {event?.date && <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>}
              {event?.location && <span>📍 {event.location}</span>}
            </div>
          </div>
          {event && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '10px', marginBottom: '24px' }}>
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

      {children}
    </div>
  )
}
