'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Event, STATUS_LABELS, STATUS_COLORS, EventStatus, formatDateRange } from '@/lib/types'

export default function AkceClient({ initialEvents }: { initialEvents: Event[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<EventStatus | 'vse'>('vse')

  const filtered = filter === 'vse' ? initialEvents : initialEvents.filter((e) => e.status === filter)
  const filters: { value: EventStatus | 'vse'; label: string }[] = [
    { value: 'vse', label: 'Vše' },
    { value: 'pripravuje_se', label: 'Připravuje se' },
    { value: 'probihá', label: 'Probíhá' },
    { value: 'dokonceno', label: 'Dokončeno' },
    { value: 'archivovano', label: 'Archivováno' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Akce</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Všechny festivaly a události</p>
        </div>
        <Link href="/akce/nova" style={{ padding: '10px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
          + Nová akce
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {filters.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{
            padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500',
            border: 'none', cursor: 'pointer',
            backgroundColor: filter === f.value ? '#e05555' : '#1e1e1e',
            color: filter === f.value ? '#fff' : '#9ca3af',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', color: '#6b7280' }}>
          Žádné akce. <Link href="/akce/nova" style={{ color: '#e05555' }}>Vytvoř první →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((event) => (
            <div key={event.id} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', overflow: 'hidden' }}>
              <Link href={`/akce/${event.id}/vydaje`} style={{ display: 'block', padding: '20px 24px', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9' }}>{event.name}</div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>
                      <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                      {event.type && <span>🎪 {event.type}</span>}
                    </div>
                    {event.description && <div style={{ marginTop: '8px', fontSize: '13px', color: '#9ca3af' }}>{event.description}</div>}
                  </div>
                  <span className={STATUS_COLORS[event.status]} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
                    {STATUS_LABELS[event.status]}
                  </span>
                </div>
              </Link>
              <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 24px', display: 'flex', gap: '8px' }}>
                <button onClick={() => router.push(`/akce/${event.id}/upravit`)} style={{ fontSize: '12px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  ✏️ Upravit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
