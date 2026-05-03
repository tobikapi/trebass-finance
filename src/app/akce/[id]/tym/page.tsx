'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { TeamContribution } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createContribution, updateContribution, deleteContribution } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
const emptyForm = { name: '', amount: '', note: '' }

export default function TymPage({ params }: Props) {
  const { id } = use(params)
  const [contributions, setContributions] = useState<TeamContribution[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('team_contributions').select('*').eq('event_id', id).order('amount', { ascending: false })
    setContributions(data || []); setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { event_id: id, name: form.name, amount: parseFloat(form.amount) || 0, note: form.note || null }
    const result = editId ? await updateContribution(editId, payload) : await createContribution(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(contId: string) {
    if (!confirm('Smazat tento příspěvek?')) return
    await deleteContribution(contId); await load()
  }

  function startEdit(c: TeamContribution) {
    setForm({ name: c.name, amount: c.amount.toString(), note: c.note || '' })
    setEditId(c.id); setShowForm(true)
  }

  const total = contributions.reduce((s, c) => s + c.amount, 0)
  const avg = contributions.length > 0 ? total / contributions.length : 0
  const maxContrib = contributions.length > 0 ? Math.max(...contributions.map((c) => c.amount)) : 0

  const inputStyle = { backgroundColor: '#0a0a0f', border: '1px solid #2a2a3e', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }

  return (
    <EventLayout eventId={id}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4">
          {[
            { label: 'Členů týmu', value: contributions.length, color: '#a78bfa', suffix: '' },
            { label: 'Celkem vloženo', value: total.toLocaleString('cs-CZ'), color: '#34d399', suffix: ' Kč' },
            { label: 'Průměr na člena', value: Math.round(avg).toLocaleString('cs-CZ'), color: '#60a5fa', suffix: ' Kč' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <div className="text-xs" style={{ color: '#6b7280' }}>{s.label}</div>
              <div className="font-semibold text-sm" style={{ color: s.color }}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
          + Přidat příspěvek
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 p-5 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #7c3aed' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#a78bfa' }}>{editId ? 'Upravit příspěvek' : 'Nový příspěvek'}</h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label style={labelStyle}>Jméno *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="např. Jakub" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Částka (Kč) *</label>
              <input required type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Poznámka</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Co to zahrnovalo..." style={{ ...inputStyle, width: '100%' }} />
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
      ) : contributions.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
          Zatím žádné příspěvky. Klikni + Přidat příspěvek.
        </div>
      ) : (
        <div className="space-y-3">
          {contributions.map((c) => {
            const pct = maxContrib > 0 ? (c.amount / maxContrib) * 100 : 0
            return (
              <div key={c.id} className="p-4 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold" style={{ color: '#f1f5f9' }}>{c.name}</span>
                    {c.note && <span className="ml-2 text-xs" style={{ color: '#6b7280' }}>{c.note}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg" style={{ color: '#34d399' }}>{c.amount.toLocaleString('cs-CZ')} Kč</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(c)} className="text-xs" style={{ color: '#a78bfa' }}>Upravit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs" style={{ color: '#f87171' }}>Smazat</button>
                    </div>
                  </div>
                </div>
                <div className="h-2 rounded-full" style={{ backgroundColor: '#1e1e2e' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#7c3aed' }} />
                </div>
                <div className="flex justify-between mt-1 text-xs" style={{ color: '#4b5563' }}>
                  <span>{Math.round(pct)}% z maxima</span>
                  <span>{total > 0 ? Math.round((c.amount / total) * 100) : 0}% z celku</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </EventLayout>
  )
}
