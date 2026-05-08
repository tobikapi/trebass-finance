'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, Income } from '@/lib/types'
import EventLayout from '@/components/EventLayout'

interface Props { params: Promise<{ id: string }> }

function fmt(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#1e1e1e', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

export default function PrehledPage({ params }: Props) {
  const { id } = use(params)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('expenses').select('*').eq('event_id', id),
      supabase.from('income').select('*').eq('event_id', id),
    ]).then(([{ data: exp }, { data: inc }]) => {
      setExpenses(exp || [])
      setIncome(inc || [])
      setLoading(false)
    })
  }, [id])

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.price, 0)
  const totalPaid = expenses.reduce((s, e) => s + (e.paid ? e.price : 0), 0)
  const totalDeposited = expenses.reduce((s, e) => s + e.deposit, 0)
  const balance = totalIncome - totalExpenses

  // Group expenses by category
  const byCategory: Record<string, { total: number; paid: number; count: number }> = {}
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = { total: 0, paid: 0, count: 0 }
    byCategory[e.category].total += e.price
    byCategory[e.category].paid += e.paid ? e.price : 0
    byCategory[e.category].count++
  }
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)

  // Group income by source
  const bySource: Record<string, number> = {}
  for (const i of income) {
    bySource[i.source] = (bySource[i.source] || 0) + i.amount
  }
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1])

  if (loading) return (
    <EventLayout eventId={id}>
      <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>Načítám...</div>
    </EventLayout>
  )

  return (
    <EventLayout eventId={id}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#0d1f0d', border: '1px solid #14532d' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Celkové příjmy</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#34d399' }}>{fmt(totalIncome)}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#1a0a0a', border: '1px solid #450a0a' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Celkové výdaje</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#f87171' }}>{fmt(totalExpenses)}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: balance >= 0 ? '#0d1f0d' : '#1a0a0a', border: `1px solid ${balance >= 0 ? '#14532d' : '#450a0a'}` }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Bilance</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: balance >= 0 ? '#34d399' : '#f87171' }}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </div>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #2d1515' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Zaplaceno výdajů</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#f1f5f9' }}>{fmt(totalPaid)}</div>
          <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>zálohy: {fmt(totalDeposited)}</div>
        </div>
      </div>

      {/* Visual income vs expenses bar */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div style={{ marginBottom: '32px', padding: '20px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #2d1515' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', marginBottom: '14px' }}>Příjmy vs. Výdaje</div>
          {(() => {
            const max = Math.max(totalIncome, totalExpenses)
            const incPct = max > 0 ? (totalIncome / max) * 100 : 0
            const expPct = max > 0 ? (totalExpenses / max) * 100 : 0
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', width: '70px', flexShrink: 0 }}>Příjmy</span>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${incPct}%`, backgroundColor: '#34d399', borderRadius: '5px', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#34d399', width: '110px', textAlign: 'right', flexShrink: 0 }}>{fmt(totalIncome)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#f87171', width: '70px', flexShrink: 0 }}>Výdaje</span>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: '#1e1e1e', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${expPct}%`, backgroundColor: '#f87171', borderRadius: '5px', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#f87171', width: '110px', textAlign: 'right', flexShrink: 0 }}>{fmt(totalExpenses)}</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: expenses.length > 0 && income.length > 0 ? '1fr 1fr' : '1fr', gap: '24px' }}>
        {/* Výdaje po kategoriích */}
        {expenses.length > 0 && (
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', marginBottom: '14px', margin: '0 0 14px 0' }}>
              Výdaje podle kategorií
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categoryRows.map(([cat, data]) => (
                <div key={cat} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: '#161616', border: '1px solid #2d1515' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{cat}</span>
                      <span style={{ fontSize: '11px', color: '#374151' }}>{data.count} pol.</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#f87171' }}>{fmt(data.total)}</span>
                      <span style={{ fontSize: '11px', color: '#4b5563', marginLeft: '6px' }}>
                        {totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bar value={data.total} max={totalExpenses} color="#f87171" />
                  </div>
                  {data.paid > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#4b5563', display: 'flex', gap: '12px' }}>
                      <span style={{ color: '#34d399' }}>zaplaceno: {fmt(data.paid)}</span>
                      {data.total - data.paid > 0 && <span style={{ color: '#f87171' }}>zbývá: {fmt(data.total - data.paid)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Příjmy podle zdrojů */}
        {income.length > 0 && (
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', marginBottom: '14px', margin: '0 0 14px 0' }}>
              Příjmy podle zdrojů
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sourceRows.map(([source, amount]) => (
                <div key={source} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: '#161616', border: '1px solid #1a3320' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{source}</span>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#34d399' }}>{fmt(amount)}</span>
                      <span style={{ fontSize: '11px', color: '#4b5563', marginLeft: '6px' }}>
                        {totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                  <Bar value={amount} max={totalIncome} color="#34d399" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {expenses.length === 0 && income.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #2d1515', color: '#6b7280' }}>
          Žádná data. Přidej výdaje nebo příjmy k této akci.
        </div>
      )}
    </EventLayout>
  )
}
