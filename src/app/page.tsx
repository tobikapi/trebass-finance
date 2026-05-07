'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Event, STATUS_LABELS, STATUS_COLORS, EventStatus, formatDateRange } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

interface RawExpense { event_id: string; price: number; category: string }
interface RawIncome  { event_id: string; amount: number }

const PIE_COLORS = ['#e05555','#f4978e','#f59e0b','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c','#4ade80','#38bdf8','#c084fc','#e879f9','#fbbf24','#2dd4bf','#f87171','#94a3b8']

const STATUS_OPTS: { value: EventStatus | 'vse'; label: string }[] = [
  { value: 'vse',           label: 'Vše' },
  { value: 'pripravuje_se', label: 'Připravuje se' },
  { value: 'probihá',       label: 'Probíhá' },
  { value: 'dokonceno',     label: 'Dokončeno' },
  { value: 'archivovano',   label: 'Archivováno' },
]

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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
      backgroundColor: active ? '#e05555' : '#1a1a1a',
      color: active ? '#fff' : '#6b7280',
    }}>
      {label}
    </button>
  )
}

export default function Dashboard() {
  const [allEvents,   setAllEvents]   = useState<Event[]>([])
  const [allExpenses, setAllExpenses] = useState<RawExpense[]>([])
  const [allIncome,   setAllIncome]   = useState<RawIncome[]>([])
  const [loading, setLoading] = useState(true)

  const [yearFilter,   setYearFilter]   = useState<string>('vse')
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'vse'>('vse')

  useEffect(() => {
    async function load() {
      const [{ data: evts }, { data: exps }, { data: incs }] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('price, event_id, category'),
        supabase.from('income').select('amount, event_id'),
      ])
      setAllEvents(evts || [])
      setAllExpenses(exps || [])
      setAllIncome(incs || [])
      setLoading(false)
    }
    load()
  }, [])

  // Dostupné roky z dat
  const availableYears = useMemo(() => {
    const years = new Set(allEvents.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))
    return Array.from(years).sort((a, b) => Number(b) - Number(a)) as string[]
  }, [allEvents])

  // Filtrované eventy
  const filteredEvents = useMemo(() => {
    return allEvents.filter(e => {
      const yearOk = yearFilter === 'vse' || (e.date && new Date(e.date).getFullYear().toString() === yearFilter)
      const statusOk = statusFilter === 'vse' || e.status === statusFilter
      return yearOk && statusOk
    })
  }, [allEvents, yearFilter, statusFilter])

  // Výdaje a příjmy jen pro filtrované eventy
  const filteredIds = useMemo(() => new Set(filteredEvents.map(e => e.id)), [filteredEvents])
  const filteredExpenses = useMemo(() => allExpenses.filter(e => filteredIds.has(e.event_id)), [allExpenses, filteredIds])
  const filteredIncome   = useMemo(() => allIncome.filter(i => filteredIds.has(i.event_id)),   [allIncome,   filteredIds])

  // Stat cards
  const totalEvents   = filteredEvents.length
  const totalUpcoming = filteredEvents.filter(e => e.status === 'pripravuje_se').length
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.price, 0)
  const totalIncome   = filteredIncome.reduce((s, i) => s + i.amount, 0)
  const balance       = totalIncome - totalExpenses

  // Bar chart — posledních 6 akcí z filtru
  const barData = useMemo(() => {
    return filteredEvents.filter(e => e.date).slice(0, 6).reverse().map(ev => ({
      name: ev.name.split(' ').slice(0, 2).join(' '),
      příjmy: filteredIncome.filter(i => i.event_id === ev.id).reduce((s, i) => s + i.amount, 0),
      výdaje: filteredExpenses.filter(e => e.event_id === ev.id).reduce((s, e) => s + e.price, 0),
    }))
  }, [filteredEvents, filteredIncome, filteredExpenses])

  // Pie chart — výdaje dle kategorie
  const pieData = useMemo(() => {
    const catMap: Record<string, number> = {}
    filteredExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.price })
    return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredExpenses])

  const statCards = [
    { label: 'Počet akcí',       value: totalEvents,                                         color: '#f4978e' },
    { label: 'V přípravě',       value: totalUpcoming,                                        color: '#60a5fa' },
    { label: 'Celkové výdaje',   value: totalExpenses.toLocaleString('cs-CZ') + ' Kč',        color: '#e05555' },
    { label: 'Celkové příjmy',   value: totalIncome.toLocaleString('cs-CZ') + ' Kč',          color: '#34d399' },
  ]

  const activeFiltersLabel = [
    yearFilter !== 'vse' ? yearFilter : null,
    statusFilter !== 'vse' ? STATUS_LABELS[statusFilter as EventStatus] : null,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Dashboard</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
          {activeFiltersLabel ? `Filtr: ${activeFiltersLabel}` : 'Přehled všech akcí a financí'}
        </p>
      </div>

      {/* Filtry */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', padding: '16px 20px', backgroundColor: '#111111', border: '1px solid #1e1e1e', borderRadius: '12px', alignItems: 'center' }}>

        {/* Rok */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#4b5563', letterSpacing: '0.08em' }}>ROK</span>
          <FilterChip label="Vše" active={yearFilter === 'vse'} onClick={() => setYearFilter('vse')} />
          {availableYears.map(y => (
            <FilterChip key={y} label={y} active={yearFilter === y} onClick={() => setYearFilter(y)} />
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', backgroundColor: '#1e1e1e', flexShrink: 0 }} />

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#4b5563', letterSpacing: '0.08em' }}>STATUS</span>
          {STATUS_OPTS.map(opt => (
            <FilterChip key={opt.value} label={opt.label} active={statusFilter === opt.value} onClick={() => setStatusFilter(opt.value)} />
          ))}
        </div>

        {/* Reset */}
        {(yearFilter !== 'vse' || statusFilter !== 'vse') && (
          <button onClick={() => { setYearFilter('vse'); setStatusFilter('vse') }}
            style={{ marginLeft: 'auto', fontSize: '12px', color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {statCards.map((card) => (
          <div key={card.label} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: card.color }}>{loading ? '...' : card.value}</div>
          </div>
        ))}
      </div>

      {/* Balance */}
      {!loading && (totalIncome > 0 || totalExpenses > 0) && (
        <div style={{ backgroundColor: '#161616', border: `1px solid ${balance >= 0 ? '#052e16' : '#4a1515'}`, borderRadius: '12px', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Celková bilance{activeFiltersLabel ? ` — ${activeFiltersLabel}` : ''}</span>
          <span style={{ fontSize: '22px', fontWeight: '700', color: balance >= 0 ? '#34d399' : '#e05555' }}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString('cs-CZ')} Kč
          </span>
        </div>
      )}

      {/* Charts */}
      {!loading && barData.length > 0 && (
        <div className="chart-grid">
          <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: '0 0 16px 0' }}>Příjmy vs. Výdaje po akcích</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                <Bar dataKey="příjmy" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="výdaje" fill="#e05555" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {pieData.length > 0 && (
            <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: '0 0 16px 0' }}>Výdaje podle kategorie</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {pieData.map((c, i) => (
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

      {/* Event list */}
      <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
            Akce{activeFiltersLabel ? ` — ${activeFiltersLabel}` : ' — poslední'}
          </h2>
          <Link href="/akce" style={{ fontSize: '13px', color: '#e05555', textDecoration: 'none' }}>Zobrazit vše →</Link>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>Načítám...</div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            Žádné akce pro zvolený filtr.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredEvents.slice(0, 6).map((event) => (
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

      {/* Foto strip */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ fontSize: '12px', color: '#374151', marginBottom: '12px', letterSpacing: '0.1em', fontFamily: 'Awakenning, sans-serif' }}>
          TŘEBASS 2025
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {[1,2,3,4,5,6,7].map((n) => (
            <div key={n} style={{ position: 'relative', flexShrink: 0, width: '200px', height: '130px', borderRadius: '10px', overflow: 'hidden' }}>
              <Image src={`/photos/photo-${n}.jpg`} alt="" fill style={{ objectFit: 'cover', filter: 'brightness(0.75) saturate(0.9)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,12,12,0.4) 0%, transparent 60%)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
