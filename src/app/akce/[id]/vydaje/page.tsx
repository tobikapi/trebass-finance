'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, CATEGORIES, PaymentTiming } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createExpense, updateExpense, deleteExpense, toggleExpensePaid } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }

const TIMINGS: PaymentTiming[] = ['PŘED AKCÍ', 'BĚHEM AKCE', 'PO AKCI']
const emptyForm = { category: CATEGORIES[0], item: '', note: '', payment_timing: '' as PaymentTiming | '', price: '', deposit: '', paid: false }

export default function VydajePage({ params }: Props) {
  const { id } = use(params)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('expenses').select('*').eq('event_id', id).order('category').order('created_at')
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      event_id: id, category: form.category, item: form.item,
      note: form.note || null, payment_timing: form.payment_timing || null,
      price: parseFloat(form.price) || 0, deposit: parseFloat(form.deposit) || 0, paid: form.paid,
    }
    const result = editId ? await updateExpense(editId, payload) : await createExpense(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load()
    setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(expId: string) {
    if (!confirm('Smazat tento výdaj?')) return
    await deleteExpense(expId)
    await load()
  }

  async function handleTogglePaid(exp: Expense) {
    await toggleExpensePaid(exp.id, !exp.paid)
    await load()
  }

  function startEdit(exp: Expense) {
    setForm({ category: exp.category, item: exp.item, note: exp.note || '', payment_timing: exp.payment_timing || '', price: exp.price.toString(), deposit: exp.deposit.toString(), paid: exp.paid })
    setEditId(exp.id); setShowForm(true)
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = expenses.filter((e) => e.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<string, Expense[]>)

  const totalPrice = expenses.reduce((s, e) => s + e.price, 0)
  const totalDeposit = expenses.reduce((s, e) => s + e.deposit, 0)
  const totalWithoutDeposit = totalPrice - totalDeposit
  const totalUnpaid = expenses.filter((e) => !e.paid).reduce((s, e) => s + (e.price - e.deposit), 0)

  const inputStyle = { backgroundColor: '#0a0a0f', border: '1px solid #2a2a3e', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }

  return (
    <EventLayout eventId={id}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4">
          {[
            { label: 'Celkem', value: totalPrice, color: '#f1f5f9' },
            { label: 'Zálohy', value: totalDeposit, color: '#60a5fa' },
            { label: 'Bez zálohy', value: totalWithoutDeposit, color: '#f87171' },
            { label: 'Zbývá zaplatit', value: totalUnpaid, color: '#fbbf24' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <div className="text-xs" style={{ color: '#6b7280' }}>{s.label}</div>
              <div className="font-semibold text-sm" style={{ color: s.color }}>{s.value.toLocaleString('cs-CZ')} Kč</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
          + Přidat výdaj
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 p-5 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #7c3aed' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#a78bfa' }}>{editId ? 'Upravit výdaj' : 'Nový výdaj'}</h3>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1">
              <label style={labelStyle}>Kategorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label style={labelStyle}>Položka *</label>
              <input required value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Název položky" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="col-span-3">
              <label style={labelStyle}>Poznámka</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Volitelná poznámka" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="col-span-1">
              <label style={labelStyle}>Platba</label>
              <select value={form.payment_timing} onChange={(e) => setForm({ ...form, payment_timing: e.target.value as PaymentTiming })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">—</option>
                {TIMINGS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label style={labelStyle}>Cena (Kč)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="col-span-1">
              <label style={labelStyle}>Záloha (Kč)</label>
              <input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="col-span-1 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#9ca3af', fontSize: '13px' }}>
                <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
                Zaplaceno
              </label>
            </div>
            <div className="col-span-2 flex items-end gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: '#1e1e2e', color: '#9ca3af' }}>
                Zrušit
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-16" style={{ color: '#6b7280' }}>Načítám...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
          Zatím žádné výdaje. Klikni + Přidat výdaj.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => {
            const catTotal = items.reduce((s, e) => s + e.price, 0)
            return (
              <div key={category} className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a3e' }}>
                {/* Hlavička kategorie */}
                <div className="px-5 py-2.5 flex items-center justify-between" style={{ backgroundColor: '#1a1a2e' }}>
                  <span className="text-xs font-semibold tracking-wider" style={{ color: '#a78bfa' }}>{category}</span>
                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{catTotal.toLocaleString('cs-CZ')} Kč</span>
                </div>
                {/* Záhlaví sloupců */}
                <div className="grid px-5 py-1.5" style={{
                  gridTemplateColumns: '1fr 100px 90px 90px 90px 60px 70px',
                  borderBottom: '1px solid #1e1e2e',
                }}>
                  {['Položka / Poznámka', 'Platba', 'Cena', 'Záloha', 'Zbývá', 'Paid', ''].map((h, i) => (
                    <div key={h + i} className="text-xs font-medium" style={{ color: '#4b5563', textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {/* Řádky */}
                {items.map((exp) => (
                  <div key={exp.id} className="grid px-5 py-3 items-center" style={{
                    gridTemplateColumns: '1fr 100px 90px 90px 90px 60px 70px',
                    borderBottom: '1px solid #111118',
                  }}>
                    {/* Název + poznámka */}
                    <div>
                      <div style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: '500' }}>{exp.item}</div>
                      {exp.note && <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{exp.note}</div>}
                    </div>
                    {/* Platba */}
                    <div>
                      {exp.payment_timing
                        ? <span style={{ backgroundColor: '#1e1e2e', color: '#9ca3af', fontSize: '11px', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{exp.payment_timing}</span>
                        : <span style={{ color: '#374151', fontSize: '12px' }}>—</span>}
                    </div>
                    {/* Cena */}
                    <div style={{ textAlign: 'right', color: '#f1f5f9', fontSize: '13px', fontWeight: '500' }}>
                      {exp.price.toLocaleString('cs-CZ')} Kč
                    </div>
                    {/* Záloha */}
                    <div style={{ textAlign: 'right', color: exp.deposit > 0 ? '#60a5fa' : '#374151', fontSize: '13px' }}>
                      {exp.deposit > 0 ? `${exp.deposit.toLocaleString('cs-CZ')} Kč` : '—'}
                    </div>
                    {/* Zbývá */}
                    <div style={{ textAlign: 'right', fontWeight: '500', fontSize: '13px', color: exp.paid || exp.price - exp.deposit <= 0 ? '#34d399' : '#f87171' }}>
                      {exp.paid ? '0 Kč' : `${(exp.price - exp.deposit).toLocaleString('cs-CZ')} Kč`}
                    </div>
                    {/* Paid toggle */}
                    <div>
                      <button onClick={() => handleTogglePaid(exp)} style={{
                        backgroundColor: exp.paid ? '#14532d' : '#1e1e2e',
                        color: exp.paid ? '#34d399' : '#f87171',
                        fontSize: '11px', fontWeight: '600',
                        padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      }}>
                        {exp.paid ? 'ANO' : 'NE'}
                      </button>
                    </div>
                    {/* Akce */}
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => startEdit(exp)} style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                      <button onClick={() => handleDelete(exp.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </EventLayout>
  )
}
