'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { Income, INCOME_SOURCES } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createIncome, updateIncome, deleteIncome } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
const emptyForm = { source: INCOME_SOURCES[0], amount: '', note: '' }

export default function PrijmyPage({ params }: Props) {
  const { id } = use(params)
  const [income, setIncome] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<{ price: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: inc }, { data: exp }] = await Promise.all([
      supabase.from('income').select('*').eq('event_id', id).order('created_at'),
      supabase.from('expenses').select('price').eq('event_id', id),
    ])
    setIncome(inc || []); setExpenses(exp || []); setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { event_id: id, source: form.source, amount: parseFloat(form.amount) || 0, note: form.note || null }
    const result = editId ? await updateIncome(editId, payload) : await createIncome(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(incId: string) {
    if (!confirm('Smazat tento příjem?')) return
    await deleteIncome(incId); await load()
  }

  function startEdit(inc: Income) {
    setForm({ source: inc.source, amount: inc.amount.toString(), note: inc.note || '' })
    setEditId(inc.id); setShowForm(true)
  }

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.price, 0)
  const balance = totalIncome - totalExpenses

  const bySource = INCOME_SOURCES.reduce((acc, src) => {
    const items = income.filter((i) => i.source === src)
    if (items.length > 0) acc[src] = items
    return acc
  }, {} as Record<string, Income[]>)

  const inputStyle = { backgroundColor: '#0a0a0f', border: '1px solid #2a2a3e', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }

  return (
    <EventLayout eventId={id}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4">
          {[
            { label: 'Celkové příjmy', value: totalIncome, color: '#34d399' },
            { label: 'Celkové výdaje', value: totalExpenses, color: '#f87171' },
            { label: 'Bilance', value: balance, color: balance >= 0 ? '#34d399' : '#f87171' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <div className="text-xs" style={{ color: '#6b7280' }}>{s.label}</div>
              <div className="font-semibold text-sm" style={{ color: s.color }}>{s.value.toLocaleString('cs-CZ')} Kč</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
          + Přidat příjem
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 p-5 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #7c3aed' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#a78bfa' }}>{editId ? 'Upravit příjem' : 'Nový příjem'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label style={labelStyle}>Zdroj</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                {INCOME_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Částka (Kč) *</label>
              <input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Poznámka</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Volitelná poznámka" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="flex items-end gap-2">
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
      ) : income.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
          Zatím žádné příjmy. Klikni + Přidat příjem.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySource).map(([source, items]) => {
            const srcTotal = items.reduce((s, i) => s + i.amount, 0)
            return (
              <div key={source} className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a3e' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: '#1a1a2e' }}>
                  <span className="text-xs font-semibold tracking-wider" style={{ color: '#34d399' }}>{source}</span>
                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>{srcTotal.toLocaleString('cs-CZ')} Kč</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e1e2e' }}>
                      {['Poznámka', 'Částka', ''].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: '#4b5563' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((inc) => (
                      <tr key={inc.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                        <td className="px-4 py-2.5" style={{ color: '#9ca3af' }}>{inc.note || '—'}</td>
                        <td className="px-4 py-2.5 font-semibold" style={{ color: '#34d399' }}>{inc.amount.toLocaleString('cs-CZ')} Kč</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(inc)} className="text-xs" style={{ color: '#a78bfa' }}>Upravit</button>
                            <button onClick={() => handleDelete(inc.id)} className="text-xs" style={{ color: '#f87171' }}>Smazat</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </EventLayout>
  )
}
