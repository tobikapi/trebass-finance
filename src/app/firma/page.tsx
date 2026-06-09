'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CompanyExpense, CompanyIncome,
  COMPANY_CATEGORIES, COMPANY_CATEGORY_COLORS, COMPANY_INCOME_SOURCES,
} from '@/lib/types'
import {
  createCompanyExpense, updateCompanyExpense, deleteCompanyExpense, toggleCompanyExpensePaid,
  createCompanyIncome, updateCompanyIncome, deleteCompanyIncome,
} from '@/app/actions'

const emptyExpForm = {
  category: COMPANY_CATEGORIES[0], item: '', note: '', amount: '', paid: false, date: '',
}
const emptyIncForm = {
  source: COMPANY_INCOME_SOURCES[0], amount: '', note: '', date: '',
}

const inputStyle = {
  backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px',
  outline: 'none', fontSize: '13px', width: '100%',
} as const

const labelStyle = {
  color: 'var(--text-secondary)', fontSize: '12px',
  display: 'block' as const, marginBottom: '4px',
}

function fmt(n: number) { return n.toLocaleString('cs-CZ') + ' Kč' }
function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('cs-CZ')
}

export default function FirmaPage() {
  const [expenses, setExpenses] = useState<CompanyExpense[]>([])
  const [income, setIncome] = useState<CompanyIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()))

  const [showExpForm, setShowExpForm] = useState(false)
  const [editExpId, setEditExpId] = useState<string | null>(null)
  const [expForm, setExpForm] = useState(emptyExpForm)
  const [savingExp, setSavingExp] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>(
    () => Object.fromEntries(COMPANY_CATEGORIES.map(c => [c, false]))
  )

  const [showIncForm, setShowIncForm] = useState(false)
  const [editIncId, setEditIncId] = useState<string | null>(null)
  const [incForm, setIncForm] = useState(emptyIncForm)
  const [savingInc, setSavingInc] = useState(false)

  async function load() {
    try {
      const [{ data: exp }, { data: inc }] = await Promise.all([
        supabase.from('company_expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('company_income').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      ])
      setExpenses(exp || [])
      setIncome(inc || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const availableYears = useMemo(() => {
    const years = new Set<string>([
      String(new Date().getFullYear()),
      ...expenses.map(e => e.date ? e.date.split('-')[0] : null).filter(Boolean) as string[],
      ...income.map(i => i.date ? i.date.split('-')[0] : null).filter(Boolean) as string[],
    ])
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [expenses, income])

  const filteredExp = useMemo(() =>
    yearFilter === 'vse' ? expenses : expenses.filter(e => !e.date || e.date.split('-')[0] === yearFilter),
    [expenses, yearFilter]
  )
  const filteredInc = useMemo(() =>
    yearFilter === 'vse' ? income : income.filter(i => !i.date || i.date.split('-')[0] === yearFilter),
    [income, yearFilter]
  )

  const totalExpenses = filteredExp.reduce((s, e) => s + e.amount, 0)
  const totalIncome   = filteredInc.reduce((s, i) => s + i.amount, 0)
  const balance       = totalIncome - totalExpenses
  const totalUnpaid   = filteredExp.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0)

  const groupedExp = useMemo(() =>
    COMPANY_CATEGORIES.reduce((acc, cat) => {
      const items = filteredExp.filter(e => e.category === cat)
      if (items.length > 0) acc[cat] = items
      return acc
    }, {} as Record<string, CompanyExpense[]>),
    [filteredExp]
  )

  const groupedInc = useMemo(() =>
    COMPANY_INCOME_SOURCES.reduce((acc, src) => {
      const items = filteredInc.filter(i => i.source === src)
      if (items.length > 0) acc[src] = items
      return acc
    }, {} as Record<string, CompanyIncome[]>),
    [filteredInc]
  )

  async function handleExpSave(e: React.FormEvent) {
    e.preventDefault()
    setSavingExp(true)
    const payload = {
      category: expForm.category, item: expForm.item,
      note: expForm.note || null, amount: parseFloat(expForm.amount) || 0,
      paid: expForm.paid, date: expForm.date || null,
    }
    const result = editExpId
      ? await updateCompanyExpense(editExpId, payload)
      : await createCompanyExpense(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSavingExp(false); return }
    await load()
    setExpForm(emptyExpForm); setShowExpForm(false); setEditExpId(null); setSavingExp(false)
  }

  async function handleExpDelete(id: string) {
    if (!confirm('Smazat tento výdaj?')) return
    await deleteCompanyExpense(id); await load()
  }

  async function handleToggleExpPaid(exp: CompanyExpense) {
    await toggleCompanyExpensePaid(exp.id, !exp.paid); await load()
  }

  function startEditExp(exp: CompanyExpense) {
    setExpForm({ category: exp.category, item: exp.item, note: exp.note || '', amount: exp.amount.toString(), paid: exp.paid, date: exp.date || '' })
    setEditExpId(exp.id); setShowExpForm(true)
  }

  async function handleIncSave(e: React.FormEvent) {
    e.preventDefault()
    setSavingInc(true)
    const payload = {
      source: incForm.source, amount: parseFloat(incForm.amount) || 0,
      note: incForm.note || null, date: incForm.date || null,
    }
    const result = editIncId
      ? await updateCompanyIncome(editIncId, payload)
      : await createCompanyIncome(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSavingInc(false); return }
    await load()
    setIncForm(emptyIncForm); setShowIncForm(false); setEditIncId(null); setSavingInc(false)
  }

  async function handleIncDelete(id: string) {
    if (!confirm('Smazat tento příjem?')) return
    await deleteCompanyIncome(id); await load()
  }

  function startEditInc(inc: CompanyIncome) {
    setIncForm({ source: inc.source, amount: inc.amount.toString(), note: inc.note || '', date: inc.date || '' })
    setEditIncId(inc.id); setShowIncForm(true)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Firma</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
          Firemní výdaje a příjmy mimo akce
        </p>
      </div>

      {/* Year filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '12px 20px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>ROK</span>
        {['vse', ...availableYears].map(y => (
          <button key={y} onClick={() => setYearFilter(y)} style={{
            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            backgroundColor: yearFilter === y ? '#e05555' : 'var(--bg-badge)',
            color: yearFilter === y ? '#fff' : 'var(--text-muted)',
          }}>
            {y === 'vse' ? 'Vše' : y}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="stat-grid" style={{ marginBottom: '32px' }}>
        {[
          { label: 'Celkové příjmy',  value: totalIncome,   color: '#34d399' },
          { label: 'Celkové výdaje',  value: totalExpenses, color: '#f87171' },
          { label: 'Bilance',         value: balance,       color: balance >= 0 ? '#34d399' : '#f87171', prefix: balance >= 0 ? '+' : '' },
          { label: 'Zbývá zaplatit',  value: totalUnpaid,   color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{s.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: loading ? 'var(--text-faint)' : s.color, marginTop: '4px' }}>
              {loading ? '...' : (s.prefix || '') + fmt(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>

        {/* ===== VÝDAJE ===== */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Výdaje firmy</h2>
            <button
              onClick={() => { setExpForm(emptyExpForm); setEditExpId(null); setShowExpForm(v => !v) }}
              style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              + Přidat výdaj
            </button>
          </div>

          {showExpForm && (
            <form onSubmit={handleExpSave} style={{ marginBottom: '16px', padding: '18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid #7c3aed' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#a78bfa', marginBottom: '14px' }}>
                {editExpId ? 'Upravit výdaj' : 'Nový firemní výdaj'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={labelStyle}>Kategorie</label>
                  <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} style={inputStyle}>
                    {COMPANY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Datum</label>
                  <input type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Položka *</label>
                  <input required value={expForm.item} onChange={e => setExpForm({ ...expForm, item: e.target.value })} placeholder="Název výdaje" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Poznámka</label>
                  <input value={expForm.note} onChange={e => setExpForm({ ...expForm, note: e.target.value })} placeholder="Volitelná poznámka" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Částka (Kč)</label>
                  <input type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} placeholder="0" style={inputStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={expForm.paid} onChange={e => setExpForm({ ...expForm, paid: e.target.checked })} />
                    Zaplaceno
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={savingExp} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {savingExp ? 'Ukládám...' : 'Uložit'}
                </button>
                <button type="button" onClick={() => { setShowExpForm(false); setEditExpId(null) }} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                  Zrušit
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Načítám...</div>
          ) : Object.keys(groupedExp).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
              Žádné výdaje. Přidej první firemní výdaj.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(groupedExp).map(([cat, items]) => {
                const cc = COMPANY_CATEGORY_COLORS[cat] || COMPANY_CATEGORY_COLORS['JINÉ']
                const catTotal = items.reduce((s, e) => s + e.amount, 0)
                const isCollapsed = !!collapsedCats[cat]
                return (
                  <div key={cat} style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${cc.border}` }}>
                    <div
                      onClick={() => setCollapsedCats(prev => ({ ...prev, [cat]: !prev[cat] }))}
                      style={{ backgroundColor: cc.bg, cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: cc.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: cc.color, letterSpacing: '0.06em' }}>{cat}</span>
                        {isCollapsed && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{items.length} pol.</span>}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: cc.color }}>{catTotal.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    {!isCollapsed && (
                      <div className="collapse-content">
                        {items.map(exp => (
                          <div key={exp.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{exp.item}</div>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                {exp.date && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{fmtDate(exp.date)}</span>}
                                {exp.note && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{exp.note}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: exp.paid ? '#34d399' : '#f87171' }}>
                                {exp.amount.toLocaleString('cs-CZ')} Kč
                              </span>
                              <button onClick={() => handleToggleExpPaid(exp)} style={{
                                backgroundColor: exp.paid ? '#14532d' : 'var(--bg-badge)',
                                color: exp.paid ? '#34d399' : '#f87171',
                                fontSize: '10px', fontWeight: '600', padding: '2px 7px',
                                borderRadius: '4px', border: 'none', cursor: 'pointer',
                              }}>
                                {exp.paid ? 'ANO' : 'NE'}
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                              <button onClick={() => startEditExp(exp)} style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                              <button onClick={() => handleExpDelete(exp.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', padding: '10px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Celkem: <strong style={{ color: 'var(--text-primary)' }}>{fmt(totalExpenses)}</strong>
                </span>
                {totalUnpaid > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Nezaplaceno: <strong style={{ color: '#f87171' }}>{fmt(totalUnpaid)}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== PŘÍJMY ===== */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Příjmy firmy</h2>
            <button
              onClick={() => { setIncForm(emptyIncForm); setEditIncId(null); setShowIncForm(v => !v) }}
              style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              + Přidat příjem
            </button>
          </div>

          {showIncForm && (
            <form onSubmit={handleIncSave} style={{ marginBottom: '16px', padding: '18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid #16a34a' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#34d399', marginBottom: '14px' }}>
                {editIncId ? 'Upravit příjem' : 'Nový firemní příjem'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={labelStyle}>Zdroj</label>
                  <select value={incForm.source} onChange={e => setIncForm({ ...incForm, source: e.target.value })} style={inputStyle}>
                    {COMPANY_INCOME_SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Datum</label>
                  <input type="date" value={incForm.date} onChange={e => setIncForm({ ...incForm, date: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Částka (Kč) *</label>
                  <input required type="number" value={incForm.amount} onChange={e => setIncForm({ ...incForm, amount: e.target.value })} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Poznámka</label>
                  <input value={incForm.note} onChange={e => setIncForm({ ...incForm, note: e.target.value })} placeholder="Volitelná poznámka" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={savingInc} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {savingInc ? 'Ukládám...' : 'Uložit'}
                </button>
                <button type="button" onClick={() => { setShowIncForm(false); setEditIncId(null) }} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                  Zrušit
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Načítám...</div>
          ) : Object.keys(groupedInc).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
              Žádné příjmy. Přidej první firemní příjem.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(groupedInc).map(([src, items]) => {
                const srcTotal = items.reduce((s, i) => s + i.amount, 0)
                return (
                  <div key={src} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(52,211,153,0.35)' }}>
                    <div style={{ backgroundColor: 'rgba(52,211,153,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#34d399', letterSpacing: '0.06em' }}>{src}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399' }}>{srcTotal.toLocaleString('cs-CZ')} Kč</span>
                    </div>
                    {items.map(inc => (
                      <div key={inc.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center' }}>
                        <div>
                          {inc.note && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{inc.note}</div>}
                          {inc.date && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>{fmtDate(inc.date)}</div>}
                          {!inc.note && !inc.date && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>—</div>}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#34d399', flexShrink: 0 }}>
                          {inc.amount.toLocaleString('cs-CZ')} Kč
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button onClick={() => startEditInc(inc)} style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                          <button onClick={() => handleIncDelete(inc.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Celkem: <strong style={{ color: '#34d399' }}>{fmt(totalIncome)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
