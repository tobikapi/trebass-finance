'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { Event, STATUS_LABELS, STATUS_COLORS, EventStatus, formatDateRange, CATEGORY_COLORS } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useRealtime } from '@/lib/use-realtime'

interface RawExpense { event_id: string; price: number; category: string; paid: boolean; deposit: number }
interface RawIncome  { event_id: string; amount: number }
interface ActivityItem { type: 'expense' | 'income' | 'lineup' | 'note'; event_id: string; icon: string; label: string; amount?: number; created_at: string }

const PIE_COLORS = ['#e05555','#f4978e','#f59e0b','#34d399','#60a5fa','#a78bfa','#f472b6','#fb923c','#4ade80','#38bdf8','#c084fc','#fbbf24','#2dd4bf','#f87171','#94a3b8','#e879f9']

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
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', boxShadow: 'var(--shadow)' }}>
      <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
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
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}>
      <div style={{ color: 'var(--text-primary)' }}>{payload[0].name}</div>
      <div style={{ color: '#f4978e', fontWeight: '600' }}>{Number(payload[0].value).toLocaleString('cs-CZ')} Kč</div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
      backgroundColor: active ? '#e05555' : 'var(--bg-badge)',
      color: active ? '#fff' : 'var(--text-muted)',
    }}>
      {label}
    </button>
  )
}

function StatCard({ label, value, sub, color, loading }: { label: string; value: string | number; sub?: string; color: string; loading: boolean }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: loading ? 'var(--text-faint)' : color }}>{loading ? '...' : value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'právě teď'
  if (mins < 60) return `před ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `před ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'včera'
  return `před ${days} dny`
}

function countdown(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const diff = new Date(y, m - 1, d).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'dnes'
  if (days === 1) return 'zítra'
  return `za ${days} dní`
}

export default function Dashboard() {
  const { can, loading: authLoading } = useUser()
  const router = useRouter()
  const [allEvents,   setAllEvents]   = useState<Event[]>([])
  const [allExpenses, setAllExpenses] = useState<RawExpense[]>([])
  const [allIncome,   setAllIncome]   = useState<RawIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [yearFilter,   setYearFilter]   = useState<string>('vse')
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'vse'>('vse')

  useEffect(() => {
    if (!authLoading && !can('viewDashboard')) router.replace('/akce')
  }, [authLoading, can, router])

  async function loadDashboard() {
    try {
      const [{ data: evts }, { data: exps }, { data: incs }, { data: actExps }, { data: actIncs }, { data: actLineup }, { data: actNotes }] = await Promise.all([
        supabase.from('events').select('*').order('date', { ascending: false }),
        supabase.from('expenses').select('price, event_id, category, paid, deposit'),
        supabase.from('income').select('amount, event_id'),
        supabase.from('expenses').select('event_id, category, item, price, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('income').select('event_id, source, amount, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('lineup').select('event_id, artist_name, fee, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('notes').select('event_id, author, content, created_at').order('created_at', { ascending: false }).limit(5),
      ])
      setAllEvents(evts || [])
      setAllExpenses(exps || [])
      setAllIncome(incs || [])

      const items: ActivityItem[] = [
        ...(actExps || []).map(e => ({ type: 'expense' as const, event_id: e.event_id, icon: '💸', label: `${e.item} (${e.category})`, amount: e.price, created_at: e.created_at })),
        ...(actIncs || []).map(i => ({ type: 'income' as const, event_id: i.event_id, icon: '💰', label: i.source, amount: i.amount, created_at: i.created_at })),
        ...(actLineup || []).map(l => ({ type: 'lineup' as const, event_id: l.event_id, icon: '🎧', label: l.artist_name, amount: l.fee || undefined, created_at: l.created_at })),
        ...(actNotes || []).map(n => ({ type: 'note' as const, event_id: n.event_id, icon: '📝', label: `${n.author}: ${n.content.slice(0, 40)}${n.content.length > 40 ? '…' : ''}`, created_at: n.created_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10)
      setActivity(items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading) loadDashboard()
  }, [authLoading])
  useRealtime(['events', 'expenses', 'income', 'lineup', 'notes'], loadDashboard)

  const availableYears = useMemo(() => {
    const years = new Set(allEvents.map(e => e.date ? new Date(e.date).getFullYear().toString() : null).filter(Boolean))
    return Array.from(years).sort((a, b) => Number(b) - Number(a)) as string[]
  }, [allEvents])

  const filteredEvents = useMemo(() => allEvents.filter(e => {
    const yearOk = yearFilter === 'vse' || (e.date && new Date(e.date).getFullYear().toString() === yearFilter)
    const statusOk = statusFilter === 'vse' || e.status === statusFilter
    return yearOk && statusOk
  }), [allEvents, yearFilter, statusFilter])

  const filteredIds = useMemo(() => new Set(filteredEvents.map(e => e.id)), [filteredEvents])
  const filteredExpenses = useMemo(() => allExpenses.filter(e => filteredIds.has(e.event_id)), [allExpenses, filteredIds])
  const filteredIncome   = useMemo(() => allIncome.filter(i => filteredIds.has(i.event_id)),   [allIncome, filteredIds])

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.price, 0)
  const totalIncome   = filteredIncome.reduce((s, i) => s + i.amount, 0)
  const balance       = totalIncome - totalExpenses
  const totalUnpaid   = filteredExpenses.filter(e => !e.paid).reduce((s, e) => s + Math.max(0, e.price - e.deposit), 0)
  const totalDeposits = filteredExpenses.reduce((s, e) => s + e.deposit, 0)
  const paidPct       = totalExpenses > 0 ? Math.round(((totalExpenses - totalUnpaid) / totalExpenses) * 100) : 0

  // Nadcházející akce
  const upcomingEvents = useMemo(() =>
    allEvents
      .filter(e => e.status === 'pripravuje_se' && e.date && countdown(e.date) !== null)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(0, 4),
  [allEvents])

  // Per-event souhrn pro event list
  const eventSummary = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; unpaid: number }> = {}
    for (const e of allExpenses) {
      if (!map[e.event_id]) map[e.event_id] = { income: 0, expenses: 0, unpaid: 0 }
      map[e.event_id].expenses += e.price
      if (!e.paid) map[e.event_id].unpaid += Math.max(0, e.price - e.deposit)
    }
    for (const i of allIncome) {
      if (!map[i.event_id]) map[i.event_id] = { income: 0, expenses: 0, unpaid: 0 }
      map[i.event_id].income += i.amount
    }
    return map
  }, [allExpenses, allIncome])

  const barData = useMemo(() => filteredEvents.filter(e => e.date).slice(0, 6).reverse().map(ev => ({
    name: ev.name.length > 14 ? ev.name.slice(0, 14) + '…' : ev.name,
    příjmy: filteredIncome.filter(i => i.event_id === ev.id).reduce((s, i) => s + i.amount, 0),
    výdaje: filteredExpenses.filter(e => e.event_id === ev.id).reduce((s, e) => s + e.price, 0),
  })), [filteredEvents, filteredIncome, filteredExpenses])

  const pieData = useMemo(() => {
    const catMap: Record<string, number> = {}
    filteredExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.price })
    return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredExpenses])

  const activeFiltersLabel = [
    yearFilter !== 'vse' ? yearFilter : null,
    statusFilter !== 'vse' ? STATUS_LABELS[statusFilter as EventStatus] : null,
  ].filter(Boolean).join(' · ')

  const fmt = (n: number) => n.toLocaleString('cs-CZ') + ' Kč'

  return (
    <div>
      {/* Header + quick action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            {activeFiltersLabel ? `Filtr: ${activeFiltersLabel}` : `${allEvents.length} akcí celkem · přehled financí`}
          </p>
        </div>
        <Link href="/akce/nova" style={{ padding: '9px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', fontFamily: 'var(--font-awakenning), sans-serif', letterSpacing: '0.05em' }}>
          + Nová akce
        </Link>
      </div>

      {/* Filtry */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', padding: '14px 20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>ROK</span>
          <FilterChip label="Vše" active={yearFilter === 'vse'} onClick={() => setYearFilter('vse')} />
          {availableYears.map(y => <FilterChip key={y} label={y} active={yearFilter === y} onClick={() => setYearFilter(y)} />)}
        </div>
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>STATUS</span>
          {STATUS_OPTS.map(opt => <FilterChip key={opt.value} label={opt.label} active={statusFilter === opt.value} onClick={() => setStatusFilter(opt.value)} />)}
        </div>
        {(yearFilter !== 'vse' || statusFilter !== 'vse') && (
          <button onClick={() => { setYearFilter('vse'); setStatusFilter('vse') }}
            style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ marginBottom: '16px' }}>
        <StatCard label="Celkové příjmy"    value={fmt(totalIncome)}   color="#34d399" loading={loading} />
        <StatCard label="Celkové výdaje"    value={fmt(totalExpenses)} color="#f87171" loading={loading} sub={`zálohy: ${fmt(totalDeposits)}`} />
        <StatCard label="Bilance"           value={(balance >= 0 ? '+' : '') + fmt(balance)} color={balance >= 0 ? '#34d399' : '#f87171'} loading={loading} />
        <StatCard label="Zbývá zaplatit"    value={fmt(totalUnpaid)}   color="#fbbf24" loading={loading} sub={`zaplaceno ${paidPct}%`} />
      </div>

      {/* Nadcházející akce */}
      {upcomingEvents.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.08em', margin: '0 0 10px 0', textTransform: 'uppercase' }}>Nadcházející akce</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {upcomingEvents.map(ev => {
              const cd = ev.date ? countdown(ev.date) : null
              const sum = eventSummary[ev.id]
              const evBalance = (sum?.income || 0) - (sum?.expenses || 0)
              return (
                <Link key={ev.id} href={`/akce/${ev.id}/prehled`} style={{ textDecoration: 'none' }}>
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.3 }}>{ev.name}</div>
                      {cd && <span style={{ fontSize: '11px', fontWeight: '700', color: '#e05555', backgroundColor: 'rgba(224,85,85,0.12)', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', marginLeft: '8px' }}>{cd}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {formatDateRange(ev.date, ev.date_end)} {ev.location && `· ${ev.location}`}
                    </div>
                    {sum && (
                      <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                        <span style={{ color: '#34d399' }}>↑ {fmt(sum.income)}</span>
                        <span style={{ color: '#f87171' }}>↓ {fmt(sum.expenses)}</span>
                        {sum.unpaid > 0 && <span style={{ color: '#fbbf24' }}>⏳ {fmt(sum.unpaid)}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts */}
      {!loading && barData.length > 0 && (
        <div className="chart-grid" style={{ marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Příjmy vs. výdaje</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v} width={36} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-badge)', opacity: 0.5 }} />
                <Bar dataKey="příjmy" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="výdaje" fill="#e05555" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {pieData.length > 0 && (
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Výdaje dle kategorie</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {pieData.map((entry, i) => {
                        const cc = CATEGORY_COLORS[entry.name]
                        return <Cell key={i} fill={cc ? cc.color : PIE_COLORS[i % PIE_COLORS.length]} />
                      })}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', overflow: 'hidden' }}>
                  {pieData.map((c, i) => {
                    const cc = CATEGORY_COLORS[c.name]
                    const color = cc ? cc.color : PIE_COLORS[i % PIE_COLORS.length]
                    const pct = totalExpenses > 0 ? Math.round((c.value / totalExpenses) * 100) : 0
                    return (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{pct}%</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600', minWidth: '60px', textAlign: 'right' }}>{c.value.toLocaleString('cs-CZ')}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event list — s finančním souhrnem */}
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Akce{activeFiltersLabel ? ` — ${activeFiltersLabel}` : ''}
          </h2>
          <Link href="/akce" style={{ fontSize: '13px', color: '#e05555', textDecoration: 'none' }}>Zobrazit vše →</Link>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Načítám...</div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Žádné akce pro zvolený filtr.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredEvents.slice(0, 8).map((event) => {
              const sum = eventSummary[event.id]
              const evBalance = (sum?.income || 0) - (sum?.expenses || 0)
              return (
                <Link key={event.id} href={`/akce/${event.id}/prehled`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                  {/* Název + datum */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.name}</div>
                    <div style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-muted)' }}>
                      {formatDateRange(event.date, event.date_end)}{event.location && ` · ${event.location}`}
                    </div>
                  </div>
                  {/* Financials */}
                  {sum && (
                    <div style={{ display: 'flex', gap: '16px', flexShrink: 0, fontSize: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>příjmy</div>
                        <div style={{ color: '#34d399', fontWeight: '600' }}>{(sum.income).toLocaleString('cs-CZ')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>výdaje</div>
                        <div style={{ color: '#f87171', fontWeight: '600' }}>{(sum.expenses).toLocaleString('cs-CZ')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-dim)', fontSize: '10px' }}>bilance</div>
                        <div style={{ color: evBalance >= 0 ? '#34d399' : '#f87171', fontWeight: '700' }}>
                          {evBalance >= 0 ? '+' : ''}{evBalance.toLocaleString('cs-CZ')}
                        </div>
                      </div>
                    </div>
                  )}
                  <span className={STATUS_COLORS[event.status]} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', flexShrink: 0 }}>
                    {STATUS_LABELS[event.status]}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Poslední aktivita */}
      {activity.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.08em', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Poslední aktivita</h2>
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {activity.map((item, i) => {
              const ev = allEvents.find(e => e.id === item.event_id)
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 16px',
                  borderBottom: i < activity.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, width: '24px', textAlign: 'center' }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    {ev && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.name}
                      </div>
                    )}
                  </div>
                  {item.amount != null && item.amount > 0 && (
                    <div style={{ fontSize: '13px', fontWeight: '600', color: item.type === 'income' ? '#34d399' : item.type === 'expense' ? '#f87171' : 'var(--text-secondary)', flexShrink: 0 }}>
                      {item.type === 'income' ? '+' : ''}{item.amount.toLocaleString('cs-CZ')} Kč
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0, minWidth: '70px', textAlign: 'right' }}>
                    {timeAgo(item.created_at)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Foto strip */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '10px', letterSpacing: '0.12em', fontFamily: 'var(--font-awakenning), sans-serif' }}>TŘEBASS 2025</div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {[1,2,3,4,5,6,7,8].map((n) => (
            <div key={n} style={{ position: 'relative', flexShrink: 0, width: '180px', height: '110px', borderRadius: '8px', overflow: 'hidden' }}>
              <Image src={`/photos/photo-${n}.jpg`} alt="" fill style={{ objectFit: 'cover', filter: 'brightness(0.8) saturate(0.9)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
