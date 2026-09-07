'use client'

import { useState } from 'react'
import { Expense, Income, Event, CATEGORIES, CATEGORY_COLORS } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { callAction } from '@/lib/call-action'
import { useRealtime } from '@/lib/use-realtime'
import { supabase } from '@/lib/supabase'
import { useUndo } from '@/lib/undo-context'

function fmt(n: number) {
  return n.toLocaleString('cs-CZ') + ' Kč'
}

// Stejné zaokrouhlení jako roundMoney() v actions.ts. Cena pro klienta se tu
// počítá na klientovi, ale server ji ve stejné podobě ukládá do income.amount —
// bez zaokrouhlení na obou stranách by se zobrazená a uložená částka lišily.
function roundMoney(n: number) {
  return Math.round(n)
}

// Prázdné pole = bez marže. Marže smí být i nad 100 % (dvojnásobek ceny),
// záporná ne. Dřívější `parseFloat(x) || 0` tiše převedlo překlep na nulu.
// Vrací null = neplatný vstup.
function parseMargin(raw: string): number | null {
  if (!raw.trim()) return 0
  const n = parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

const MARGIN_ERROR = 'Marže musí být číslo větší nebo rovné nule.'

function sameBudgets(a: Record<string, number>, b: Record<string, number>) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k])
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

interface Props {
  id: string
  initialExpenses: Expense[]
  initialIncome: Income[]
  initialEvent: Event | null
}

export default function PrehledClient({ id, initialExpenses, initialIncome, initialEvent }: Props) {
  const { pushUndo } = useUndo()
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [income, setIncome] = useState<Income[]>(initialIncome)
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [budgetEdit, setBudgetEdit] = useState(false)
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [descEdit, setDescEdit] = useState(false)
  const [descInput, setDescInput] = useState('')
  const [savingDesc, setSavingDesc] = useState(false)
  const [marginEdit, setMarginEdit] = useState(false)
  const [marginInput, setMarginInput] = useState('')
  const [savingMargin, setSavingMargin] = useState(false)
  const [savingMarginToIncome, setSavingMarginToIncome] = useState(false)

  async function load() {
    const [{ data: exp }, { data: inc }, { data: ev }] = await Promise.all([
      supabase.from('expenses').select('*').eq('event_id', id),
      supabase.from('income').select('*').eq('event_id', id),
      supabase.from('events').select('*').eq('id', id).single(),
    ])
    setExpenses(exp || [])
    setIncome(inc || [])
    setEvent(ev)
  }

  useRealtime(['expenses', 'income'], load, id)

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

  const techCost = byCategory['TECHNIKA']?.total || 0
  const marginPercent = event?.margin_percent || 0
  const clientPrice = roundMoney(techCost * (1 + marginPercent / 100))
  const profit = clientPrice - techCost

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
    const prevBudgets = budgets
    const result = await callAction('updateEventBudgets', id, parsed)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    setEvent(prev => prev ? { ...prev, budgets: parsed } : prev)
    if (!sameBudgets(parsed, prevBudgets)) {
      pushUndo('úprava rozpočtů', async () => {
        const r = await callAction('updateEventBudgets', id, prevBudgets)
        if (r.error) throw new Error(r.error)
        await load()
      })
    }
    setBudgetEdit(false)
    setSaving(false)
  }

  function openDescEdit() {
    setDescInput(event?.description || '')
    setDescEdit(true)
  }

  async function saveDescription() {
    setSavingDesc(true)
    const value = descInput.trim()
    const prevValue = event?.description || ''
    const result = await callAction('updateEventDescription', id, value)
    if (result.error) { alert('Chyba: ' + result.error); setSavingDesc(false); return }
    setEvent(prev => prev ? { ...prev, description: value || null } : prev)
    if (value !== prevValue) {
      pushUndo('úprava poznámek k akci', async () => {
        const r = await callAction('updateEventDescription', id, prevValue)
        if (r.error) throw new Error(r.error)
        await load()
      })
    }
    setDescEdit(false)
    setSavingDesc(false)
  }

  function openMarginEdit() {
    setMarginInput(marginPercent ? String(marginPercent) : '')
    setMarginEdit(true)
  }

  async function saveMargin() {
    const n = parseMargin(marginInput)
    if (n === null) { alert(MARGIN_ERROR); return }
    setSavingMargin(true)
    const prevMargin = marginPercent
    const result = await callAction('updateEventMargin', id, n)
    if (result.error) { alert('Chyba: ' + result.error); setSavingMargin(false); return }
    setEvent(prev => prev ? { ...prev, margin_percent: n } : prev)
    if (n !== prevMargin) {
      pushUndo(`změna marže na ${n}%`, async () => {
        const r = await callAction('updateEventMargin', id, prevMargin)
        if (r.error) throw new Error(r.error)
        await load()
      })
    }
    setMarginEdit(false)
    setSavingMargin(false)
  }

  async function toggleMarginToIncome(enabled: boolean) {
    setSavingMarginToIncome(true)
    const result = await callAction('updateEventMarginToIncome', id, enabled)
    if (result.error) { alert('Chyba: ' + result.error); setSavingMarginToIncome(false); return }
    setEvent(prev => prev ? { ...prev, margin_to_income: enabled } : prev)
    pushUndo(enabled ? 'zapnutí zápisu marže do Příjmů' : 'vypnutí zápisu marže do Příjmů', async () => {
      const r = await callAction('updateEventMarginToIncome', id, !enabled)
      if (r.error) throw new Error(r.error)
      await load()
    })
    await load()
    setSavingMarginToIncome(false)
  }

  return (
    <EventLayout eventId={id}>
      {/* Poznámky k akci (obecné info) */}
      <div style={{ marginBottom: '24px', padding: '18px 20px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: descEdit || event?.description ? '10px' : 0 }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>📝 Poznámky k akci</span>
          {!descEdit && (
            <button onClick={openDescEdit}
              style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
              {event?.description ? 'Upravit' : '+ Přidat'}
            </button>
          )}
        </div>
        {descEdit ? (
          <div>
            <textarea
              value={descInput} onChange={e => setDescInput(e.target.value)} rows={3}
              placeholder="Kontext akce, dress code, důležité info pro tým..."
              style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '13px', resize: 'vertical', marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveDescription} disabled={savingDesc}
                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: '#e05555', color: '#fff', border: 'none', cursor: 'pointer' }}>
                {savingDesc ? 'Ukládám...' : 'Uložit'}
              </button>
              <button onClick={() => setDescEdit(false)}
                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                Zrušit
              </button>
            </div>
          </div>
        ) : event?.description ? (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{event.description}</p>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0, fontStyle: 'italic' }}>Zatím žádné obecné info k akci (kontext, dress code...).</p>
        )}
      </div>

      {/* Marže z pronájmu techniky */}
      <div style={{ marginBottom: '24px', padding: '18px 20px', borderRadius: '12px', backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa' }}>💹 Marže z pronájmu techniky</span>
          {!marginEdit && (
            <button onClick={openMarginEdit}
              style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', backgroundColor: '#1e1035', color: '#a78bfa', border: '1px solid #3d2d6b', cursor: 'pointer' }}>
              Nastavit marži
            </button>
          )}
        </div>
        {marginEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="number" min="0" value={marginInput} onChange={e => setMarginInput(e.target.value)} placeholder="0" autoFocus
              style={{ width: '100px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>%</span>
            <button onClick={saveMargin} disabled={savingMargin}
              style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {savingMargin ? 'Ukládám...' : 'Uložit'}
            </button>
            <button onClick={() => setMarginEdit(false)}
              style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
              Zrušit
            </button>
          </div>
        ) : marginPercent > 0 ? (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Náklady na techniku</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(techCost)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Marže</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#a78bfa' }}>{marginPercent}%</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cena pro klienta</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{fmt(clientPrice)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Zisk</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#34d399' }}>+{fmt(profit)}</div>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '12px', color: 'var(--text-secondary)', cursor: savingMarginToIncome ? 'default' : 'pointer' }}>
              <input type="checkbox" checked={!!event?.margin_to_income} disabled={savingMarginToIncome}
                onChange={e => toggleMarginToIncome(e.target.checked)} />
              Zapisovat cenu pro klienta do Příjmů
            </label>
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0, fontStyle: 'italic' }}>
            Marže není nastavená. Nastav procento, které si účtuješ navíc nad náklady na techniku ({fmt(techCost)}).
          </p>
        )}
      </div>

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

      {/* Budget edit */}
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
                        <span style={{ fontSize: '11px', color: budget > 0 && data.total > budget ? '#f87171' : 'var(--text-dim)', marginLeft: '6px' }}>
                          {budget > 0
                            ? `${Math.round((data.total / budget) * 100)}% rozpočtu`
                            : `${totalExpenses > 0 ? Math.round((data.total / totalExpenses) * 100) : 0}%`}
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
