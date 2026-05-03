'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS, EventStatus } from '@/lib/types'

export default function AkcePage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<EventStatus | 'vse'>('vse')

  async function load() {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'vse' ? events : events.filter((e) => e.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>Akce</h1>
          <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>Všechny festivaly a události</p>
        </div>
        <Link
          href="/akce/nova"
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#7c3aed', color: '#fff' }}
        >
          + Nová akce
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {(['vse', 'pripravuje_se', 'probihá', 'dokonceno', 'archivovano'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{
              backgroundColor: filter === s ? '#7c3aed' : '#1e1e2e',
              color: filter === s ? '#fff' : '#9ca3af',
            }}
          >
            {s === 'vse' ? 'Vše' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#6b7280' }}>Načítám...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
          Žádné akce. <Link href="/akce/nova" style={{ color: '#a78bfa' }}>Vytvoř první →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((event) => (
            <Link
              key={event.id}
              href={`/akce/${event.id}/vydaje`}
              className="block p-5 rounded-xl transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>{event.name}</div>
                  <div className="flex gap-4 mt-1 text-sm" style={{ color: '#6b7280' }}>
                    {event.date && <span>📅 {new Date(event.date).toLocaleDateString('cs-CZ')}</span>}
                    {event.location && <span>📍 {event.location}</span>}
                    {event.type && <span>🎪 {event.type}</span>}
                  </div>
                  {event.description && (
                    <div className="mt-2 text-sm" style={{ color: '#9ca3af' }}>{event.description}</div>
                  )}
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                  {STATUS_LABELS[event.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
