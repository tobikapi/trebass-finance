'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

interface DashboardStats {
  totalEvents: number
  upcomingEvents: number
  totalExpenses: number
  totalIncome: number
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    upcomingEvents: 0,
    totalExpenses: 0,
    totalIncome: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false })
        .limit(5)

      const { data: allEvents } = await supabase.from('events').select('id, status')
      const { data: expenses } = await supabase.from('expenses').select('price')
      const { data: income } = await supabase.from('income').select('amount')

      setEvents(eventsData || [])
      setStats({
        totalEvents: allEvents?.length || 0,
        upcomingEvents: allEvents?.filter((e) => e.status === 'pripravuje_se').length || 0,
        totalExpenses: expenses?.reduce((s, e) => s + (e.price || 0), 0) || 0,
        totalIncome: income?.reduce((s, i) => s + (i.amount || 0), 0) || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: 'Celkem akcí', value: stats.totalEvents, color: '#a78bfa' },
    { label: 'V přípravě', value: stats.upcomingEvents, color: '#60a5fa' },
    { label: 'Celkové výdaje', value: stats.totalExpenses.toLocaleString('cs-CZ') + ' Kč', color: '#f87171' },
    { label: 'Celkové příjmy', value: stats.totalIncome.toLocaleString('cs-CZ') + ' Kč', color: '#34d399' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>Přehled všech akcí a financí</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl p-5" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
            <div className="text-sm mb-1" style={{ color: '#6b7280' }}>{card.label}</div>
            <div className="text-2xl font-bold" style={{ color: card.color }}>
              {loading ? '...' : card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl p-6" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: '#f1f5f9' }}>Poslední akce</h2>
          <Link href="/akce" className="text-sm" style={{ color: '#a78bfa' }}>Zobrazit vše →</Link>
        </div>

        {loading ? (
          <div className="text-center py-8" style={{ color: '#6b7280' }}>Načítám...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#6b7280' }}>
            Zatím žádné akce.{' '}
            <Link href="/akce/nova" style={{ color: '#a78bfa' }}>Vytvoř první akci →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/akce/${event.id}/vydaje`}
                className="flex items-center justify-between p-4 rounded-lg transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#0a0a0f', border: '1px solid #1e1e2e' }}
              >
                <div>
                  <div className="font-medium" style={{ color: '#f1f5f9' }}>{event.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                    {event.date ? new Date(event.date).toLocaleDateString('cs-CZ') : 'Datum neurčeno'}
                    {event.location && ` · ${event.location}`}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                  {STATUS_LABELS[event.status]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
