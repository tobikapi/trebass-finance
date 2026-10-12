'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Event, formatDateRange } from '@/lib/types'

export default function ArchivPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<string, { expenses: number; income: number }>>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .in('status', ['dokonceno', 'archivovano'])
        .order('date', { ascending: false })

      const evts = data || []
      setEvents(evts)

      // Dva dotazy pro všechny akce najednou místo dvou na každou akci —
      // každý dotaz z prohlížeče do Supabase stojí ~150 ms.
      const ids = evts.map(ev => ev.id)
      const [{ data: exp }, { data: inc }] = ids.length ? await Promise.all([
        supabase.from('expenses').select('event_id, price').in('event_id', ids),
        supabase.from('income').select('event_id, amount').in('event_id', ids),
      ]) : [{ data: [] }, { data: [] }]
      const statsMap: Record<string, { expenses: number; income: number }> = {}
      for (const id of ids) statsMap[id] = { expenses: 0, income: 0 }
      for (const e of exp || []) statsMap[e.event_id].expenses += e.price
      for (const i of inc || []) statsMap[i.event_id].income += i.amount
      setStats(statsMap)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Archiv</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Dokončené a archivované akce</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>Načítám...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Zatím žádné archivované akce.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {events.map((event) => {
            const s = stats[event.id] || { expenses: 0, income: 0 }
            const balance = s.income - s.expenses
            return (
              <Link
                key={event.id}
                href={`/akce/${event.id}/prehled`}
                className="block p-5 rounded-xl transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{event.name}{event.include_in_totals === false && (
                      <span title="Nezapočítává se do celkových přehledů" style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', verticalAlign: 'middle' }}>mimo součty</span>
                    )}</div>
                    <div className="flex gap-4 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>
                      {event.location && <span>📍 {event.location}</span>}
                    </div>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Výdaje</div>
                      <div className="font-semibold text-sm" style={{ color: '#f87171' }}>{s.expenses.toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Příjmy</div>
                      <div className="font-semibold text-sm" style={{ color: '#34d399' }}>{s.income.toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Bilance</div>
                      <div className="font-semibold text-sm" style={{ color: balance >= 0 ? '#34d399' : '#f87171' }}>
                        {balance >= 0 ? '+' : ''}{balance.toLocaleString('cs-CZ')} Kč
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
