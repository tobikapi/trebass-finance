'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

interface Props {
  eventId: string
  children: React.ReactNode
}

export default function EventLayout({ eventId, children }: Props) {
  const pathname = usePathname()
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data }) => setEvent(data))
  }, [eventId])

  const tabs = [
    { href: `/akce/${eventId}/vydaje`, label: '💸 Výdaje' },
    { href: `/akce/${eventId}/prijmy`, label: '💰 Příjmy' },
    { href: `/akce/${eventId}/lineup`, label: '🎧 Lineup' },
    { href: `/akce/${eventId}/tym`, label: '👥 Tým' },
  ]

  return (
    <div>
      <div className="mb-6">
        <Link href="/akce" className="text-sm" style={{ color: '#6b7280' }}>← Zpět na akce</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>
              {event?.name || '...'}
            </h1>
            <div className="flex gap-3 mt-1 text-sm" style={{ color: '#6b7280' }}>
              {event?.date && <span>📅 {new Date(event.date).toLocaleDateString('cs-CZ')}</span>}
              {event?.location && <span>📍 {event.location}</span>}
            </div>
          </div>
          {event && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', display: 'inline-flex' }}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? '#7c3aed' : 'transparent',
                color: isActive ? '#fff' : '#9ca3af',
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
