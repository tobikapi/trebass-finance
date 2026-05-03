'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LineupArtist } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createArtist, updateArtist, deleteArtist, toggleArtistPaid } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
const emptyForm = { artist_name: '', fee: '', deposit: '', paid: false, set_time: '', notes: '' }

export default function LineupPage({ params }: Props) {
  const { id } = use(params)
  const [artists, setArtists] = useState<LineupArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('lineup').select('*').eq('event_id', id).order('set_time').order('artist_name')
    setArtists(data || []); setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { event_id: id, artist_name: form.artist_name, fee: parseFloat(form.fee) || 0, deposit: parseFloat(form.deposit) || 0, paid: form.paid, set_time: form.set_time || null, notes: form.notes || null }
    const result = editId ? await updateArtist(editId, payload) : await createArtist(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(artId: string) {
    if (!confirm('Smazat tohoto artista?')) return
    await deleteArtist(artId); await load()
  }

  async function handleTogglePaid(art: LineupArtist) {
    await toggleArtistPaid(art.id, !art.paid); await load()
  }

  function startEdit(art: LineupArtist) {
    setForm({ artist_name: art.artist_name, fee: art.fee.toString(), deposit: art.deposit.toString(), paid: art.paid, set_time: art.set_time || '', notes: art.notes || '' })
    setEditId(art.id); setShowForm(true)
  }

  const totalFees = artists.reduce((s, a) => s + a.fee, 0)
  const totalDeposits = artists.reduce((s, a) => s + a.deposit, 0)
  const unpaid = artists.filter((a) => !a.paid).length

  const inputStyle = { backgroundColor: '#0a0a0f', border: '1px solid #2a2a3e', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block', marginBottom: '4px' }

  return (
    <EventLayout eventId={id}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4">
          {[
            { label: 'Artistů celkem', value: artists.length, color: '#a78bfa', suffix: '' },
            { label: 'Celkové honoráře', value: totalFees.toLocaleString('cs-CZ'), color: '#f87171', suffix: ' Kč' },
            { label: 'Zálohy vyplaceny', value: totalDeposits.toLocaleString('cs-CZ'), color: '#60a5fa', suffix: ' Kč' },
            { label: 'Nezaplacených', value: unpaid, color: '#fbbf24', suffix: '' },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <div className="text-xs" style={{ color: '#6b7280' }}>{s.label}</div>
              <div className="font-semibold text-sm" style={{ color: s.color }}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#7c3aed', color: '#fff' }}>
          + Přidat artista
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mb-6 p-5 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #7c3aed' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#a78bfa' }}>{editId ? 'Upravit artista' : 'Nový artista'}</h3>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-2">
              <label style={labelStyle}>Jméno / pseudonym *</label>
              <input required value={form.artist_name} onChange={(e) => setForm({ ...form, artist_name: e.target.value })} placeholder="např. Ripplednb" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Set time</label>
              <input value={form.set_time} onChange={(e) => setForm({ ...form, set_time: e.target.value })} placeholder="např. 22:00" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Honorář (Kč)</label>
              <input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Záloha (Kč)</label>
              <input type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%' }} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: '#9ca3af', fontSize: '13px' }}>
                <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} />
                Zaplaceno
              </label>
            </div>
            <div className="col-span-4">
              <label style={labelStyle}>Poznámky</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Rider, technické požadavky, kontakt..." style={{ ...inputStyle, width: '100%' }} />
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
      ) : artists.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e', color: '#6b7280' }}>
          Zatím žádní artisté. Klikni + Přidat artista.
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a3e' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#1a1a2e', borderBottom: '1px solid #2a2a3e' }}>
                {['Artist', 'Set Time', 'Honorář', 'Záloha', 'Zbývá', 'Zaplaceno', 'Poznámky', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#4b5563' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artists.map((art) => (
                <tr key={art.id} style={{ borderBottom: '1px solid #1a1a2e' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#f1f5f9' }}>{art.artist_name}</td>
                  <td className="px-4 py-3" style={{ color: '#9ca3af' }}>{art.set_time || '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#f1f5f9' }}>{art.fee.toLocaleString('cs-CZ')} Kč</td>
                  <td className="px-4 py-3" style={{ color: '#60a5fa' }}>{art.deposit > 0 ? art.deposit.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: art.fee - art.deposit > 0 ? '#f87171' : '#34d399' }}>{(art.fee - art.deposit).toLocaleString('cs-CZ')} Kč</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleTogglePaid(art)} className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: art.paid ? '#14532d' : '#1e1e2e', color: art.paid ? '#34d399' : '#f87171' }}>
                      {art.paid ? 'ANO' : 'NE'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: '#6b7280' }}>{art.notes || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(art)} className="text-xs" style={{ color: '#a78bfa' }}>Upravit</button>
                      <button onClick={() => handleDelete(art.id)} className="text-xs" style={{ color: '#f87171' }}>Smazat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </EventLayout>
  )
}
