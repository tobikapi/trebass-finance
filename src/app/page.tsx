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
  const [stats, setStats] = useState<DashboardStats>({ totalEvents: 0, upcomingEvents: 0, totalExpenses: 0, totalIncome: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: eventsData } = await supabase.from('events').select('*').order('date', { ascending: false }).limit(5)
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
    { label: 'Celkem akcí', value: stats.totalEvents, color: '#f4978e' },
    { label: 'V přípravě', value: stats.upcomingEvents, color: '#f4978e' },
    { label: 'Celkové výdaje', value: stats.totalExpenses.toLocaleString('cs-CZ') + ' Kč', color: '#e05555' },
    { label: 'Celkové příjmy', value: stats.totalIncome.toLocaleString('cs-CZ') + ' Kč', color: '#34d399' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280' }}>Přehled všech akcí a financí</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: card.color }}>{loading ? '...' : card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>Poslední akce</h2>
          <Link href="/akce" style={{ fontSize: '13px', color: '#e05555', textDecoration: 'none' }}>Zobrazit vše →</Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>Načítám...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            Zatím žádné akce.{' '}
            <Link href="/akce/nova" style={{ color: '#e05555' }}>Vytvoř první akci →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {events.map((event) => (
              <Link key={event.id} href={`/akce/${event.id}/vydaje`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '8px', backgroundColor: '#0c0c0c', border: '1px solid #1e1e1e', textDecoration: 'none' }}>
                <div>
                  <div style={{ fontWeight: '500', color: '#f1f5f9', fontSize: '14px' }}>{event.name}</div>
                  <div style={{ fontSize: '12px', marginTop: '2px', color: '#6b7280' }}>
                    {event.date ? new Date(event.date).toLocaleDateString('cs-CZ') : 'Datum neurčeno'}
                    {event.location && ` · ${event.location}`}
                  </div>
                </div>
                <span className={`${STATUS_COLORS[event.status]}`} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
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
