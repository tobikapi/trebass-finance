'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, Income, Event, CATEGORIES, CATEGORY_COLORS } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { updateEventBudgets } from '@/app/actions'
import { useRealtime } from '@/lib/use-realtime'

interface Props { params: Promise<{ id: string }> }

function fmt(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--bg-card-dark)', overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget <= 0) return null
  const pct = Math.min((spent / budget) * 100, 100)
  const over = spent > budget
  const color = over ? '#f87171' : pct > 80 ? '#fbbf24' : '#34d399'
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ height: '5px', borderRadius: '3px', backgroundColor: 'var(--bg-card-dark)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '3px', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px', color: 'var(--text-dim)' }}>
        <span style={{ color: over ? '#f87171' : 'var(--text-muted)' }}>
          {over ? `překročeno o ${fmt(spent - budget)}` : `zbývá ${fmt(budget - spent)}`}
        </span>
        <span>rozpočet: {fmt(budget)}</span>
      </div>
    </div>
  )
}

export default function PrehledPage({ params }: Props) {
  const { id } = use(params)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome] = useState<Income[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetEdit, setBudgetEdit] = useState(false)
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: exp }, { data: inc }, { data: ev }] = await Promise.all([
      supabase.from('expenses').select('*').eq('event_id', id),
      supabase.from('income').select('*').eq('event_id', id),
      supabase.from('events').select('*').eq('id', id).single(),
    ])
    setExpenses(exp || [])
    setIncome(inc || [])
    setEvent(ev)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])
  useRealtime(['expenses', 'income', 'events'], load, id)

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.price, 0)
  const totalPaid = expenses.reduce((s, e) => s + (e.paid ? e.price : 0), 0)
  const totalDeposited = expenses.reduce((s, e) => s + e.deposit, 0)
  const balance = totalIncome - totalExpenses

  const byCategory: Record<string, { total: number; paid: number; count: number }> = {}
  for (const e of expenses) {
    if (!byCategory[e.category]) byCategory[e.category] = { total: 0, paid: 0, count: 0 }
    byCategory[e.category].total += e.price
    byCategory[e.category].paid += e.paid ? e.price : 0
    byCategory[e.category].count++
  }
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total)

  const bySource: Record<string, number> = {}
  for (const i of income) {
    bySource[i.source] = (bySource[i.source] || 0) + i.amount
  }
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1])

  const budgets: Record<string, number> = event?.budgets || {}
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0)
  const activeCategoriesWithBudget = CATEGORIES.filter(c => (budgets[c] || 0) > 0 || byCategory[c])

  function openBudgetEdit() {
    const inputs: Record<string, string> = {}
    for (const cat of CATEGORIES) {
      inputs[cat] = budgets[cat] ? budgets[cat].toString() : ''
    }
    setBudgetInputs(inputs)
    setBudgetEdit(true)
  }

  async function saveBudgets() {
    setSaving(true)
    const parsed: Record<string, number> = {}
    for (const [cat, val] of Object.entries(budgetInputs)) {
      const n = parseFloat(val)
      if (n > 0) parsed[cat] = n
    }
    const result = await updateEventBudgets(id, parsed)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    setEvent(prev => prev ? { ...prev, budgets: parsed } : prev)
    setBudgetEdit(false)
    setSaving(false)
  }

  if (loading) return (
    <EventLayout eventId={id}>
      <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>Načítám...</div>
    </EventLayout>
  )

  return (
    <EventLayout eventId={id}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Celkové příjmy</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#34d399' }}>{fmt(totalIncome)}</div>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Celkové výdaje</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#f87171' }}>{fmt(totalExpenses)}</div>
          {totalBudget > 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              celk. rozpočet: {fmt(totalBudget)}
            </div>
          )}
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: balance >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${balance >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Bilance</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: balance >= 0 ? '#34d399' : '#f87171' }}>
            {balance >= 0 ? '+' : ''}{fmt(balance)}
          </div>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Zaplaceno výdajů</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(totalPaid)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>zálohy: {fmt(totalDeposited)}</div>
        </div>
      </div>

      {/* Income vs expenses bar */}
      {(totalIncome > 0 || totalExpenses > 0) && (
        <div style={{ marginBottom: '32px', padding: '20px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '14px' }}>Příjmy vs. Výdaje</div>
          {(() => {
            const max = Math.max(totalIncome, totalExpenses, totalBudget)
            const incPct = max > 0 ? (totalIncome / max) * 100 : 0
            const expPct = max > 0 ? (totalExpenses / max) * 100 : 0
            const budPct = max > 0 ? (totalBudget / max) * 100 : 0
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', minWidth: '70px', flexShrink: 0 }}>Příjmy</span>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: 'var(--bg-card-dark)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${incPct}%`, backgroundColor: '#34d399', borderRadius: '5px', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#34d399', minWidth: '90px', textAlign: 'right', flexShrink: 0 }}>{fmt(totalIncome)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#f87171', minWidth: '70px', flexShrink: 0 }}>Výdaje</span>
                  <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: 'var(--bg-card-dark)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${expPct}%`, backgroundColor: '#f87171', borderRadius: '5px', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#f87171', minWidth: '90px', textAlign: 'right', flexShrink: 0 }}>{fmt(totalExpenses)}</span>
                </div>
                {totalBudget > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#a78bfa', minWidth: '70px', flexShrink: 0 }}>Rozpočet</span>
                    <div style={{ flex: 1, height: '10px', borderRadius: '5px', backgroundColor: 'var(--bg-card-dark)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${budPct}%`, backgroundColor: '#a78bfa', borderRadius: '5px', transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: '12px', color: '#a78bfa', minWidth: '90px', textAlign: 'right', flexShrink: 0 }}>{fmt(totalBudget)}</span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Budget edit modal */}
      {budgetEdit && (
        <div style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid #7c3aed' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#a78bfa' }}>Plánovaný rozpočet podle kategorií</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveBudgets} disabled={saving}
                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button onClick={() => setBudgetEdit(false)}
                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                Zrušit
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {CATEGORIES.map(cat => {
              const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS['JINÉ']
              return (
                <div key={cat} style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: cc.bg, border: `1px solid ${cc.border}` }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: cc.color, marginBottom: '6px' }}>{cat}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      value={budgetInputs[cat] || ''}
                      onChange={e => setBudgetInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                      placeholder="0"
                      style={{ flex: 1, backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '4px', padding: '5px 8px', fontSize: '12px', outline: 'none', minWidth: 0 }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', flexShrink: 0 }}>Kč</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="prehled-bottom-grid" style={{ gridTemplateColumns: expenses.length > 0 && income.length > 0 ? '1fr 1fr' : '1fr' }}>
        {/* Výdaje po kategoriích */}
        {expenses.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Výdaje podle kategorií
              </h2>
              {!budgetEdit && (
                <button onClick={openBudgetEdit}
                  style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11px', backgroundColor: '#1e1035', color: '#a78bfa', border: '1px solid #3d2d6b', cursor: 'pointer' }}>
                  Nastavit rozpočet
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categoryRows.map(([cat, data]) => {
                const budget = budgets[cat] || 0
                const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS['JINÉ']
                return (
                  <div key={cat} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: cc.bg, border: `1px solid ${cc.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: budget > 0 ? '4px' : '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: cc.color }}>{cat}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{data.count} pol.</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: budget > 0 && data.total > budget ? '#f87171' : cc.color }}>{fmt(data.total)}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '6px' }}>
                          {totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    {budget > 0 ? (
                      <BudgetBar spent={data.total} budget={budget} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bar value={data.total} max={totalExpenses} color={cc.color} />
                      </div>
                    )}
                    {data.paid > 0 && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-dim)', display: 'flex', gap: '12px' }}>
                        <span style={{ color: '#34d399' }}>zaplaceno: {fmt(data.paid)}</span>
                        {data.total - data.paid > 0 && <span style={{ color: '#f87171' }}>zbývá: {fmt(data.total - data.paid)}</span>}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Categories with budget but no expenses */}
              {activeCategoriesWithBudget
                .filter(cat => !byCategory[cat] && (budgets[cat] || 0) > 0)
                .map(cat => {
                  const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS['JINÉ']
                  const budget = budgets[cat]
                  return (
                    <div key={cat} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: cc.bg, border: `1px solid ${cc.border}`, opacity: 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: cc.color }}>{cat}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>0 / {fmt(budget)}</span>
                      </div>
                      <BudgetBar spent={0} budget={budget} />
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Příjmy podle zdrojů */}
        {income.length > 0 && (
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', margin: '0 0 14px 0' }}>
              Příjmy podle zdrojů
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sourceRows.map(([source, amount]) => (
                <div key={source} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{source}</span>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#34d399' }}>{fmt(amount)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '6px' }}>
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
        <div>
          <div style={{ textAlign: 'center', padding: '64px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Žádná data. Přidej výdaje nebo příjmy k této akci.
          </div>
          {!budgetEdit && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={openBudgetEdit}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', backgroundColor: '#1e1035', color: '#a78bfa', border: '1px solid #3d2d6b', cursor: 'pointer' }}>
                Nastavit plánovaný rozpočet
              </button>
            </div>
          )}
        </div>
      )}
    </EventLayout>
  )
}
