'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Event } from '@/lib/types'

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

      const statsMap: Record<string, { expenses: number; income: number }> = {}
      await Promise.all(
        evts.map(async (ev) => {
          const [{ data: exp }, { data: inc }] = await Promise.all([
            supabase.from('expenses').select('price').eq('event_id', ev.id),
            supabase.from('income').select('amount').eq('event_id', ev.id),
          ])
          statsMap[ev.id] = {
            expenses: exp?.reduce((s, e) => s + e.price, 0) || 0,
            income: inc?.reduce((s, i) => s + i.amount, 0) || 0,
          }
        })
      )
      setStats(statsMap)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>Archiv</h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>Dokončené a archivované akce</p>
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: '#6b7280' }}>Načítám...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
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
                    </div>
                  </div>
                  <div className="flex gap-4 text-right">
                    <div>
                      <div className="text-xs" style={{ color: '#6b7280' }}>Výdaje</div>
                      <div className="font-semibold text-sm" style={{ color: '#f87171' }}>{s.expenses.toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: '#6b7280' }}>Příjmy</div>
                      <div className="font-semibold text-sm" style={{ color: '#34d399' }}>{s.income.toLocaleString('cs-CZ')} Kč</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: '#6b7280' }}>Bilance</div>
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
