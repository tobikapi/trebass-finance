'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Event, STATUS_LABELS, STATUS_COLORS, EventStatus, formatDateRange } from '@/lib/types'
import { deleteEvent } from '@/app/actions'

export default function AkceClient({ initialEvents }: { initialEvents: Event[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<EventStatus | 'vse'>('vse')
  const [sort, setSort] = useState<'desc' | 'asc'>('desc')
  const [events, setEvents] = useState(initialEvents)

  async function handleDelete(event: Event) {
    if (!confirm(`Smazat akci "${event.name}"? Smažou se i všechny výdaje, příjmy a lineup.`)) return
    const result = await deleteEvent(event.id)
    if (result.error) { alert('Chyba: ' + result.error); return }
    setEvents(prev => prev.filter(e => e.id !== event.id))
  }

  const filtered = (filter === 'vse' ? events : events.filter((e) => e.status === filter))
    .slice()
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return sort === 'desc' ? db - da : da - db
    })
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
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Akce</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: 0 }}>Všechny festivaly a události</p>
        </div>
        <Link href="/akce/nova" style={{ padding: '10px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
          + Nová akce
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filters.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '500',
              border: 'none', cursor: 'pointer',
              backgroundColor: filter === f.value ? '#e05555' : 'var(--bg-card-dark)',
              color: filter === f.value ? '#fff' : 'var(--text-secondary)',
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['desc', 'asc'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} style={{
              padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
              border: 'none', cursor: 'pointer',
              backgroundColor: sort === s ? 'var(--bg-badge)' : 'transparent',
              color: sort === s ? '#a78bfa' : 'var(--text-dim)',
            }}>
              {s === 'desc' ? '↓ Nejnovější' : '↑ Nejstarší'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          Žádné akce. <Link href="/akce/nova" style={{ color: '#e05555' }}>Vytvoř první →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((event) => (
            <div key={event.id} className="card-hover" style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', overflow: 'hidden' }}>
              <Link href={`/akce/${event.id}/vydaje`} style={{ display: 'block', padding: '20px 24px', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{event.name}</div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                      {event.type && <span>🎪 {event.type}</span>}
                    </div>
                    {event.description && <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{event.description}</div>}
                  </div>
                  <span className={STATUS_COLORS[event.status]} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', flexShrink: 0 }}>
                    {STATUS_LABELS[event.status]}
                  </span>
                </div>
              </Link>
              <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 24px', display: 'flex', gap: '16px' }}>
                <button onClick={() => router.push(`/akce/${event.id}/upravit`)} style={{ fontSize: '12px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  ✏️ Upravit
                </button>
                <button onClick={() => handleDelete(event)} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}>
                  🗑 Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
