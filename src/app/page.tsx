'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS, formatDateRange, CATEGORIES } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

interface EventFinance { id: string; name: string; date: string | null; příjmy: number; výdaje: number }
interface CategoryStat { name: string; value: number }

const PIE_COLORS = ['#e05555','#f4978e','#f59e0b','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c','#4ade80','#38bdf8','#c084fc','#e879f9','#fbbf24','#2dd4bf','#f87171','#94a3b8']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d1515', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ color: '#f1f5f9', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {Number(p.value).toLocaleString('cs-CZ')} Kč
        </div>
      ))}
    </div>
  )
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d1515', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: '#f1f5f9' }}>{payload[0].name}</div>
      <div style={{ color: '#f4978e', fontWeight: '600' }}>{Number(payload[0].value).toLocaleString('cs-CZ')} Kč</div>
    </div>
  )
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventFinances, setEventFinances] = useState<EventFinance[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [totals, setTotals] = useState({ events: 0, upcoming: 0, expenses: 0, income: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: allEvents }, { data: expenses }, { data: income }] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('price, event_id, category, paid'),
        supabase.from('income').select('amount, event_id'),
      ])

      const evts = allEvents || []
      const exps = expenses || []
      const incs = income || []

      setEvents(evts.slice(0, 5))
      setTotals({
        events: evts.length,
        upcoming: evts.filter(e => e.status === 'pripravuje_se').length,
        expenses: exps.reduce((s, e) => s + (e.price || 0), 0),
        income: incs.reduce((s, i) => s + (i.amount || 0), 0),
      })

      // Per-event bar chart data (last 6 events with dates)
      const dated = evts.filter(e => e.date).slice(0, 6).reverse()
      setEventFinances(dated.map(ev => ({
        id: ev.id,
        name: ev.name.split(' ').slice(0, 2).join(' '),
        date: ev.date,
        příjmy: incs.filter(i => i.event_id === ev.id).reduce((s, i) => s + i.amount, 0),
        výdaje: exps.filter(e => e.event_id === ev.id).reduce((s, e) => s + e.price, 0),
      })))

      // Category pie chart — all expenses
      const catMap: Record<string, number> = {}
      exps.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.price })
      setCategoryStats(
        Object.entries(catMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
      )

      setLoading(false)
    }
    load()
  }, [])

  const balance = totals.income - totals.expenses
  const statCards = [
    { label: 'Celkem akcí', value: totals.events, color: '#f4978e' },
    { label: 'V přípravě', value: totals.upcoming, color: '#f4978e' },
    { label: 'Celkové výdaje', value: totals.expenses.toLocaleString('cs-CZ') + ' Kč', color: '#e05555' },
    { label: 'Celkové příjmy', value: totals.income.toLocaleString('cs-CZ') + ' Kč', color: '#34d399' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280' }}>Přehled všech akcí a financí</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: card.color }}>{loading ? '...' : card.value}</div>
          </div>
        ))}
      </div>

      {/* Balance card */}
      {!loading && (totals.income > 0 || totals.expenses > 0) && (
        <div style={{ backgroundColor: '#161616', border: `1px solid ${balance >= 0 ? '#052e16' : '#4a1515'}`, borderRadius: '12px', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Celková bilance všech akcí</span>
          <span style={{ fontSize: '22px', fontWeight: '700', color: balance >= 0 ? '#34d399' : '#e05555' }}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      )}

      {/* Charts */}
      {!loading && eventFinances.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* Bar chart */}
          <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: '0 0 16px 0' }}>Příjmy vs. Výdaje po akcích</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={eventFinances} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                <Bar dataKey="příjmy" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="výdaje" fill="#e05555" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          {categoryStats.length > 0 && (
            <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: '0 0 16px 0' }}>Výdaje podle kategorie</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={categoryStats} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                      {categoryStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {categoryStats.map((c, i) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: '11px', color: '#9ca3af', flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: '11px', color: '#f1f5f9', fontWeight: '600' }}>{c.value.toLocaleString('cs-CZ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent events */}
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
                    {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}
                    {event.location && ` · ${event.location}`}
                  </div>
                </div>
                <span className={STATUS_COLORS[event.status]} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
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
