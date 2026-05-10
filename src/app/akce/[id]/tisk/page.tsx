'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Event, Expense, Income, LineupArtist, TeamContribution, CATEGORIES, formatDateRange } from '@/lib/types'
import * as XLSX from 'xlsx'

interface Note { id: string; author: string; content: string; created_at: string }

const MEMBER_COLORS: Record<string, string> = {
  'Tobiáš': '#f4978e', 'Jakub': '#60a5fa', 'Metoděj': '#34d399', 'Artur': '#fbbf24',
}

export default function TiskPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [lineup, setLineup] = useState<LineupArtist[]>([])
  const [team, setTeam] = useState<TeamContribution[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: ex }, { data: inc }, { data: lin }, { data: tm }, { data: nt }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('expenses').select('*').eq('event_id', id).order('category'),
        supabase.from('income').select('*').eq('event_id', id),
        supabase.from('lineup').select('*').eq('event_id', id).order('set_time'),
        supabase.from('team_contributions').select('*').eq('event_id', id),
        supabase.from('notes').select('*').eq('event_id', id).order('created_at', { ascending: false }),
      ])
      setEvent(ev); setExpenses(ex || []); setIncome(inc || [])
      setLineup(lin || []); setTeam(tm || []); setNotes(nt || [])
      setLoading(false)
    }
    load()
  }, [id])

  function exportExcel() {
    if (!event) return
    const wb = XLSX.utils.book_new()

    const summary = [
      ['Akce', event.name],
      ['Datum', formatDateRange(event.date, event.date_end, event.time_start, event.time_end)],
      ['Místo', event.location || ''],
      [],
      ['Celkové příjmy (Kč)', income.reduce((s, i) => s + i.amount, 0)],
      ['Celkové výdaje (Kč)', expenses.reduce((s, e) => s + e.price, 0)],
      ['Bilance (Kč)', income.reduce((s, i) => s + i.amount, 0) - expenses.reduce((s, e) => s + e.price, 0)],
      ['Uhrazeno výdajů (Kč)', expenses.reduce((s, e) => s + (e.paid ? e.price : 0), 0)],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Shrnutí')

    const expRows: (string | number)[][] = [['Kategorie', 'Položka', 'Poznámka', 'Platba', 'Cena (Kč)', 'Záloha (Kč)', 'Zbývá (Kč)', 'Zaplaceno']]
    for (const e of expenses) {
      expRows.push([e.category, e.item, e.note || '', e.payment_timing || '', e.price, e.deposit, e.paid ? 0 : e.price - e.deposit, e.paid ? 'ANO' : 'NE'])
    }
    expRows.push([])
    expRows.push(['', '', '', 'CELKEM', expenses.reduce((s, e) => s + e.price, 0), expenses.reduce((s, e) => s + e.deposit, 0), '', ''])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Výdaje')

    const incRows: (string | number)[][] = [['Zdroj', 'Částka (Kč)', 'Poznámka']]
    for (const i of income) incRows.push([i.source, i.amount, i.note || ''])
    incRows.push([])
    incRows.push(['CELKEM', income.reduce((s, i) => s + i.amount, 0), ''])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'Příjmy')

    if (lineup.length > 0) {
      const linRows: (string | number)[][] = [['Artist', 'Stage', 'Datum', 'Set time', 'Honorář (Kč)', 'Záloha (Kč)', 'Zbývá (Kč)', 'Zaplaceno', 'Poznámky']]
      for (const a of lineup) {
        linRows.push([a.artist_name, a.stage || '', a.date || '', a.set_time || '', a.fee, a.deposit, a.paid ? 0 : a.fee - a.deposit, a.paid ? 'ANO' : 'NE', a.notes || ''])
      }
      linRows.push([])
      linRows.push(['CELKEM', '', '', '', lineup.reduce((s, a) => s + a.fee, 0), lineup.reduce((s, a) => s + a.deposit, 0), '', '', ''])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linRows), 'Lineup')
    }

    if (notes.length > 0) {
      const noteRows: (string)[][] = [['Autor', 'Datum', 'Obsah']]
      for (const n of notes) {
        noteRows.push([n.author, new Date(n.created_at).toLocaleDateString('cs-CZ'), n.content])
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(noteRows), 'Poznámky')
    }

    const fileName = `${event.name.replace(/[^a-zA-Z0-9áčďéěíňóřšťůúýžÁČĎÉĚÍŇÓŘŠŤŮÚÝŽ ]/g, '_')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  if (loading) return <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>Načítám...</div>
  if (!event) return <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>Akce nenalezena.</div>

  const totalExpenses = expenses.reduce((s, e) => s + e.price, 0)
  const totalPaid = expenses.reduce((s, e) => s + (e.paid ? e.price : 0), 0)
  const totalDeposits = expenses.reduce((s, e) => s + e.deposit, 0)
  const totalRemaining = expenses.reduce((s, e) => s + (e.paid ? 0 : e.price - e.deposit), 0)
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const balance = totalIncome - totalExpenses
  const lineupTotal = lineup.reduce((s, a) => s + a.fee, 0)
  const lineupDeposits = lineup.reduce((s, a) => s + a.deposit, 0)
  const lineupPaid = lineup.reduce((s, a) => s + (a.paid ? a.fee : 0), 0)
  const lineupRemaining = lineup.reduce((s, a) => s + (a.paid ? 0 : a.fee - a.deposit), 0)

  const expensesByCategory = CATEGORIES.map(cat => ({
    cat,
    items: expenses.filter(e => e.category === cat),
  })).filter(g => g.items.length > 0)

  function fmt(n: number) { return n.toLocaleString('cs-CZ') + ' Kč' }
  function fmtDate(ts: string) {
    const d = new Date(ts)
    return d.toLocaleDateString('cs-CZ') + ' ' + d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Controls */}
      <div className="no-print" style={{
        display: 'flex', gap: '10px', marginBottom: '32px', alignItems: 'center',
        flexWrap: 'wrap', padding: '16px 20px',
        backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)',
        borderRadius: '12px',
      }}>
        <button onClick={() => window.print()} style={{
          padding: '10px 22px', backgroundColor: '#e05555', color: '#fff',
          borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          🖨️ Vytisknout / PDF
        </button>
        <button onClick={exportExcel} style={{
          padding: '10px 22px', backgroundColor: '#16a34a', color: '#fff',
          borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          📊 Export Excel
        </button>
        <button onClick={() => router.back()} style={{
          padding: '10px 18px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)',
          borderRadius: '8px', fontSize: '14px', border: '1px solid var(--border)', cursor: 'pointer',
        }}>
          ← Zpět
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', marginLeft: '4px' }}>
          Pro PDF: v dialogu tisku zvol „Uložit jako PDF"
        </span>
      </div>

      {/* ===== TISKNUTELNÝ OBSAH ===== */}
      <div className="print-page">

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #e05555', paddingBottom: '16px', marginBottom: '0' }}>
            <div>
              <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#e05555', marginBottom: '4px', fontWeight: '700' }}>
                TŘEBASS FINANCE
              </div>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#111', lineHeight: 1.1 }}>{event.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#666' }}>
                {event.date && <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>}
                {event.location && <span>📍 {event.location}</span>}
                {event.type && <span>🎪 {event.type}</span>}
              </div>
              {event.description && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#888', fontStyle: 'italic' }}>{event.description}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#aaa', flexShrink: 0, marginLeft: '16px' }}>
              <div style={{ fontWeight: '700', color: '#555', fontSize: '11px' }}>Vygenerováno</div>
              <div>{new Date().toLocaleDateString('cs-CZ')}</div>
            </div>
          </div>
        </div>

        {/* Finanční shrnutí */}
        <div style={{ marginBottom: '28px' }}>
          {/* Bilance — big box */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: '0', border: '2px solid ' + (balance >= 0 ? '#16a34a' : '#dc2626'),
            borderRadius: '10px', overflow: 'hidden', marginBottom: '10px',
          }}>
            <div style={{ padding: '14px 18px', borderRight: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Celkové příjmy</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a' }}>{fmt(totalIncome)}</div>
            </div>
            <div style={{ padding: '14px 18px', borderRight: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Celkové výdaje</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>{fmt(totalExpenses)}</div>
            </div>
            <div style={{ padding: '14px 18px', backgroundColor: balance >= 0 ? '#f0fdf4' : '#fef2f2' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Bilance</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: balance >= 0 ? '#16a34a' : '#dc2626' }}>
                {balance >= 0 ? '+' : ''}{fmt(balance)}
              </div>
            </div>
          </div>

          {/* Platby */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { label: 'Uhrazeno výdajů', value: totalPaid, color: '#555' },
              { label: 'Zálohy uhrazeny', value: totalDeposits, color: '#555' },
              { label: 'Zbývá doplatit', value: totalRemaining, color: totalRemaining > 0 ? '#dc2626' : '#16a34a' },
            ].map(c => (
              <div key={c.label} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{c.label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: c.color }}>{fmt(c.value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Výdaje */}
        {expensesByCategory.length > 0 && (
          <section style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
            <SectionHeader color="#e05555" icon="💸" title="Výdaje" />
            {expensesByCategory.map(({ cat, items }) => {
              const catTotal = items.reduce((s, e) => s + e.price, 0)
              return (
                <div key={cat} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '700', color: '#e05555', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 0', borderBottom: '1px dashed #f9d0d0' }}>
                    <span>{cat}</span>
                    <span>{fmt(catTotal)}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb' }}>
                        <th style={th}>Položka</th>
                        <th style={th}>Poznámka</th>
                        <th style={{ ...th, textAlign: 'right' }}>Záloha</th>
                        <th style={{ ...th, textAlign: 'right' }}>Cena</th>
                        <th style={{ ...th, textAlign: 'center' }}>Uhrazeno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((e, i) => (
                        <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={td}>{e.item}</td>
                          <td style={{ ...td, color: '#888' }}>{e.note || '—'}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{e.deposit ? fmt(e.deposit) : '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: '600' }}>{fmt(e.price)}</td>
                          <td style={{ ...td, textAlign: 'center', color: e.paid ? '#16a34a' : '#dc2626', fontWeight: '700' }}>{e.paid ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
            <TotalRow label="Celkem výdaje" items={[
              { label: 'Celkem', value: fmt(totalExpenses) },
              { label: 'Zálohy', value: fmt(totalDeposits) },
              { label: 'Uhrazeno', value: fmt(totalPaid) },
              { label: 'Zbývá', value: fmt(totalRemaining), highlight: totalRemaining > 0 },
            ]} />
          </section>
        )}

        {/* Příjmy */}
        {income.length > 0 && (
          <section style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
            <SectionHeader color="#16a34a" icon="💰" title="Příjmy" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={th}>Zdroj</th>
                  <th style={th}>Poznámka</th>
                  <th style={{ ...th, textAlign: 'right' }}>Částka</th>
                </tr>
              </thead>
              <tbody>
                {income.map((i, idx) => (
                  <tr key={i.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ ...td, fontWeight: '500' }}>{i.source}</td>
                    <td style={{ ...td, color: '#888' }}>{i.note || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>{fmt(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRow label="Celkem příjmy" items={[{ label: 'Celkem', value: fmt(totalIncome) }]} />
          </section>
        )}

        {/* Lineup */}
        {lineup.length > 0 && (
          <section style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
            <SectionHeader color="#7c3aed" icon="🎧" title="Lineup" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={th}>Umělec</th>
                  <th style={th}>Set time</th>
                  <th style={{ ...th, textAlign: 'right' }}>Záloha</th>
                  <th style={{ ...th, textAlign: 'right' }}>Honorář</th>
                  <th style={{ ...th, textAlign: 'center' }}>Uhrazeno</th>
                  <th style={th}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map((a, i) => (
                  <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ ...td, fontWeight: '600' }}>{a.artist_name}</td>
                    <td style={td}>{a.set_time || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{a.deposit ? fmt(a.deposit) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: '600' }}>{fmt(a.fee)}</td>
                    <td style={{ ...td, textAlign: 'center', color: a.paid ? '#16a34a' : '#dc2626', fontWeight: '700' }}>{a.paid ? '✓' : '✗'}</td>
                    <td style={{ ...td, color: '#888' }}>{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRow label="Celkem lineup" items={[
              { label: 'Celkem', value: fmt(lineupTotal) },
              { label: 'Zálohy', value: fmt(lineupDeposits) },
              { label: 'Uhrazeno', value: fmt(lineupPaid) },
              { label: 'Zbývá', value: fmt(lineupRemaining), highlight: lineupRemaining > 0 },
            ]} />
          </section>
        )}

        {/* Tým */}
        {team.length > 0 && (
          <section style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
            <SectionHeader color="#0891b2" icon="👥" title="Tým — příspěvky" />
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={th}>Člen</th>
                  <th style={{ ...th, textAlign: 'right' }}>Částka</th>
                  <th style={th}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {team.map((t, i) => (
                  <tr key={t.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ ...td, fontWeight: '600', color: MEMBER_COLORS[t.name] || '#111' }}>{t.name}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: '600' }}>{fmt(t.amount)}</td>
                    <td style={{ ...td, color: '#888' }}>{t.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TotalRow label="Celkem tým" items={[{ label: 'Celkem', value: fmt(team.reduce((s, t) => s + t.amount, 0)) }]} />
          </section>
        )}

        {/* Poznámky */}
        {notes.length > 0 && (
          <section style={{ marginBottom: '28px', pageBreakInside: 'avoid' }}>
            <SectionHeader color="#d97706" icon="📝" title="Poznámky" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notes.map(note => (
                <div key={note.id} style={{ border: '1px solid #e5e7eb', borderRadius: '7px', padding: '10px 14px', backgroundColor: '#fafafa' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '5px', fontSize: '11px' }}>
                    <span style={{ fontWeight: '700', color: MEMBER_COLORS[note.author] || '#555' }}>{note.author}</span>
                    <span style={{ color: '#aaa' }}>{fmtDate(note.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{note.content}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#bbb' }}>
          <span>Třebass Finance System</span>
          <span>Vygenerováno {new Date().toLocaleDateString('cs-CZ')} | {event.name}</span>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ color, icon, title }: { color: string; icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `2px solid ${color}`, paddingBottom: '7px', marginBottom: '12px' }}>
      <span style={{ fontSize: '15px' }}>{icon}</span>
      <span style={{ fontSize: '15px', fontWeight: '700', color: '#111', letterSpacing: '0.02em' }}>{title}</span>
    </div>
  )
}

function TotalRow({ items }: { label: string; items: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', paddingTop: '8px', borderTop: '2px solid #111', fontSize: '12px', fontWeight: '700', color: '#111' }}>
      {items.map(item => (
        <span key={item.label} style={{ color: item.highlight ? '#dc2626' : '#111' }}>
          {item.label}: {item.value}
        </span>
      ))}
    </div>
  )
}

const th: React.CSSProperties = { padding: '7px 10px', textAlign: 'left', fontWeight: '600', color: '#555', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td: React.CSSProperties = { padding: '7px 10px', color: '#222', borderBottom: '1px solid #f0f0f0' }
