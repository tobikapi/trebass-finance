'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Event, Expense, Income, LineupArtist, TeamContribution, CATEGORIES, formatDateRange } from '@/lib/types'
import * as XLSX from 'xlsx'

export default function TiskPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [lineup, setLineup] = useState<LineupArtist[]>([])
  const [team, setTeam] = useState<TeamContribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: ev }, { data: ex }, { data: inc }, { data: lin }, { data: tm }] = await Promise.all([
        supabase.from('events').select('*').eq('id', id).single(),
        supabase.from('expenses').select('*').eq('event_id', id).order('category'),
        supabase.from('income').select('*').eq('event_id', id),
        supabase.from('lineup').select('*').eq('event_id', id).order('set_time'),
        supabase.from('team_contributions').select('*').eq('event_id', id),
      ])
      setEvent(ev); setExpenses(ex || []); setIncome(inc || [])
      setLineup(lin || []); setTeam(tm || [])
      setLoading(false)
    }
    load()
  }, [id])

  function exportExcel() {
    if (!event) return
    const wb = XLSX.utils.book_new()

    // List 1: Shrnutí
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

    // List 2: Výdaje
    const expRows: (string | number)[][] = [['Kategorie', 'Položka', 'Poznámka', 'Platba', 'Cena (Kč)', 'Záloha (Kč)', 'Zbývá (Kč)', 'Zaplaceno']]
    for (const e of expenses) {
      expRows.push([e.category, e.item, e.note || '', e.payment_timing || '', e.price, e.deposit, e.paid ? 0 : e.price - e.deposit, e.paid ? 'ANO' : 'NE'])
    }
    expRows.push([])
    expRows.push(['', '', '', 'CELKEM', expenses.reduce((s, e) => s + e.price, 0), expenses.reduce((s, e) => s + e.deposit, 0), '', ''])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Výdaje')

    // List 3: Příjmy
    const incRows: (string | number)[][] = [['Zdroj', 'Částka (Kč)', 'Poznámka']]
    for (const i of income) incRows.push([i.source, i.amount, i.note || ''])
    incRows.push([])
    incRows.push(['CELKEM', income.reduce((s, i) => s + i.amount, 0), ''])
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'Příjmy')

    // List 4: Lineup
    if (lineup.length > 0) {
      const linRows: (string | number)[][] = [['Artist', 'Stage', 'Datum', 'Set time', 'Honorář (Kč)', 'Záloha (Kč)', 'Zbývá (Kč)', 'Zaplaceno', 'Poznámky']]
      for (const a of lineup) {
        linRows.push([a.artist_name, a.stage || '', a.date || '', a.set_time || '', a.fee, a.deposit, a.paid ? 0 : a.fee - a.deposit, a.paid ? 'ANO' : 'NE', a.notes || ''])
      }
      linRows.push([])
      linRows.push(['CELKEM', '', '', '', lineup.reduce((s, a) => s + a.fee, 0), lineup.reduce((s, a) => s + a.deposit, 0), '', '', ''])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linRows), 'Lineup')
    }

    const fileName = `${event.name.replace(/[^a-zA-Z0-9áčďéěíňóřšťůúýžÁČĎÉĚÍŇÓŘŠŤŮÚÝŽ ]/g, '_')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  if (loading) return <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>Načítám...</div>
  if (!event) return <div style={{ padding: '64px', textAlign: 'center', color: '#6b7280' }}>Akce nenalezena.</div>

  const totalExpenses = expenses.reduce((s, e) => s + e.price, 0)
  const totalPaid = expenses.reduce((s, e) => s + (e.paid ? e.price : 0), 0)
  const totalDeposits = expenses.reduce((s, e) => s + e.deposit, 0)
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const balance = totalIncome - totalExpenses

  const expensesByCategory = CATEGORIES.map(cat => ({
    cat,
    items: expenses.filter(e => e.category === cat),
  })).filter(g => g.items.length > 0)

  const lineupTotal = lineup.reduce((s, a) => s + a.fee, 0)
  const lineupPaid = lineup.reduce((s, a) => s + (a.paid ? a.fee : 0), 0)

  return (
    <div>
      {/* Print controls - hidden when printing */}
      <div className="no-print" style={{ display: 'flex', gap: '12px', marginBottom: '32px', alignItems: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '10px 24px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
        >
          🖨️ Vytisknout / Uložit PDF
        </button>
        <button
          onClick={exportExcel}
          style={{ padding: '10px 24px', backgroundColor: '#16a34a', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
        >
          📊 Export Excel
        </button>
        <button
          onClick={() => router.back()}
          style={{ padding: '10px 20px', backgroundColor: '#1e1e1e', color: '#9ca3af', borderRadius: '8px', fontSize: '14px', border: 'none', cursor: 'pointer' }}
        >
          ← Zpět
        </button>
        <span style={{ fontSize: '12px', color: '#4b5563' }}>Pro PDF: v dialogu tisku zvol "Uložit jako PDF"</span>
      </div>

      {/* Printable content */}
      <div className="print-page">
        {/* Header */}
        <div style={{ borderBottom: '3px solid #e05555', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#111' }}>{event.name}</div>
          <div style={{ display: 'flex', gap: '24px', marginTop: '6px', fontSize: '13px', color: '#555' }}>
            <span>📅 {formatDateRange(event.date, event.date_end, event.time_start, event.time_end)}</span>
            {event.location && <span>📍 {event.location}</span>}
            {event.type && <span>🎪 {event.type}</span>}
          </div>
          {event.description && <div style={{ marginTop: '6px', fontSize: '13px', color: '#777' }}>{event.description}</div>}
        </div>

        {/* Financial summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Celkové příjmy', value: totalIncome, color: '#16a34a' },
            { label: 'Celkové výdaje', value: totalExpenses, color: '#dc2626' },
            { label: 'Bilance', value: balance, color: balance >= 0 ? '#16a34a' : '#dc2626' },
            { label: 'Uhrazeno výdajů', value: totalPaid, color: '#555' },
          ].map(c => (
            <div key={c.label} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{c.label}</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: c.color }}>
                {c.value >= 0 ? '' : ''}{Math.abs(c.value).toLocaleString('cs-CZ')} Kč
              </div>
            </div>
          ))}
        </div>

        {/* Expenses */}
        {expensesByCategory.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111', borderBottom: '2px solid #e05555', paddingBottom: '6px', marginBottom: '12px' }}>
              💸 Výdaje
            </div>
            {expensesByCategory.map(({ cat, items }) => {
              const catTotal = items.reduce((s, e) => s + e.price, 0)
              return (
                <div key={cat} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#e05555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span>{cat}</span>
                    <span>{catTotal.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f5f5' }}>
                        <th style={th}>Položka</th>
                        <th style={th}>Poznámka</th>
                        <th style={th}>Záloha</th>
                        <th style={th}>Cena</th>
                        <th style={th}>Uhrazeno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={td}>{e.item}</td>
                          <td style={{ ...td, color: '#888' }}>{e.note || '—'}</td>
                          <td style={td}>{e.deposit ? e.deposit.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                          <td style={{ ...td, fontWeight: '600' }}>{e.price.toLocaleString('cs-CZ')} Kč</td>
                          <td style={{ ...td, color: e.paid ? '#16a34a' : '#dc2626' }}>{e.paid ? '✓' : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#111', paddingTop: '8px', borderTop: '2px solid #111' }}>
              Celkem výdaje: {totalExpenses.toLocaleString('cs-CZ')} Kč &nbsp;|&nbsp; Zálohy: {totalDeposits.toLocaleString('cs-CZ')} Kč &nbsp;|&nbsp; Uhrazeno: {totalPaid.toLocaleString('cs-CZ')} Kč
            </div>
          </section>
        )}

        {/* Income */}
        {income.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111', borderBottom: '2px solid #16a34a', paddingBottom: '6px', marginBottom: '12px' }}>
              💰 Příjmy
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={th}>Zdroj</th>
                  <th style={th}>Poznámka</th>
                  <th style={th}>Částka</th>
                </tr>
              </thead>
              <tbody>
                {income.map(i => (
                  <tr key={i.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={td}>{i.source}</td>
                    <td style={{ ...td, color: '#888' }}>{i.note || '—'}</td>
                    <td style={{ ...td, fontWeight: '600', color: '#16a34a' }}>{i.amount.toLocaleString('cs-CZ')} Kč</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#111', paddingTop: '8px', borderTop: '2px solid #111' }}>
              Celkem příjmy: {totalIncome.toLocaleString('cs-CZ')} Kč
            </div>
          </section>
        )}

        {/* Lineup */}
        {lineup.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111', borderBottom: '2px solid #7c3aed', paddingBottom: '6px', marginBottom: '12px' }}>
              🎧 Lineup
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={th}>Umělec</th>
                  <th style={th}>Set time</th>
                  <th style={th}>Záloha</th>
                  <th style={th}>Honorář</th>
                  <th style={th}>Uhrazeno</th>
                  <th style={th}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {lineup.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ ...td, fontWeight: '600' }}>{a.artist_name}</td>
                    <td style={td}>{a.set_time || '—'}</td>
                    <td style={td}>{a.deposit ? a.deposit.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                    <td style={{ ...td, fontWeight: '600' }}>{a.fee.toLocaleString('cs-CZ')} Kč</td>
                    <td style={{ ...td, color: a.paid ? '#16a34a' : '#dc2626' }}>{a.paid ? '✓' : '✗'}</td>
                    <td style={{ ...td, color: '#888' }}>{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#111', paddingTop: '8px', borderTop: '2px solid #111' }}>
              Celkem lineup: {lineupTotal.toLocaleString('cs-CZ')} Kč &nbsp;|&nbsp; Uhrazeno: {lineupPaid.toLocaleString('cs-CZ')} Kč
            </div>
          </section>
        )}

        {/* Team */}
        {team.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#111', borderBottom: '2px solid #0891b2', paddingBottom: '6px', marginBottom: '12px' }}>
              👥 Tým — příspěvky
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={th}>Člen</th>
                  <th style={th}>Částka</th>
                  <th style={th}>Poznámka</th>
                </tr>
              </thead>
              <tbody>
                {team.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ ...td, fontWeight: '600' }}>{t.name}</td>
                    <td style={td}>{t.amount.toLocaleString('cs-CZ')} Kč</td>
                    <td style={{ ...td, color: '#888' }}>{t.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '12px', fontSize: '11px', color: '#aaa', textAlign: 'right' }}>
          Vygenerováno: {new Date().toLocaleDateString('cs-CZ')} | Třebass Finance System
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#444', borderBottom: '1px solid #ddd' }
const td: React.CSSProperties = { padding: '6px 8px', color: '#222' }
