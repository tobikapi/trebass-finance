'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LineupArtist } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createArtist, updateArtist, deleteArtist, toggleArtistPaid } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
interface Contact { id: string; name: string; type: string; fee: number }

const STAGES = ['Main Stage', 'Stage 2', 'Chill Stage', 'Spodní stage']

const emptyForm = { artist_name: '', fee: '', deposit: '', paid: false, set_time: '', stage: '', notes: '' }

export default function LineupPage({ params }: Props) {
  const { id } = use(params)
  const [artists, setArtists] = useState<LineupArtist[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: lineup }, { data: ctc }] = await Promise.all([
      supabase.from('lineup').select('*').eq('event_id', id).order('set_time').order('artist_name'),
      supabase.from('contacts').select('id, name, type, fee').in('type', ['DJ', 'MC', 'Stage manager', 'Technik', 'Produkce', 'Bednák', 'Security']).order('name'),
    ])
    setArtists(lineup || [])
    setContacts(ctc || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function pickContact(contactId: string) {
    if (!contactId) return
    const c = contacts.find(c => c.id === contactId)
    if (!c) return
    setForm(f => ({ ...f, artist_name: c.name, fee: c.fee > 0 ? String(c.fee) : f.fee }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { event_id: id, artist_name: form.artist_name, fee: parseFloat(form.fee) || 0, deposit: parseFloat(form.deposit) || 0, paid: form.paid, set_time: form.set_time || null, stage: form.stage || null, notes: form.notes || null }
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
    setForm({ artist_name: art.artist_name, fee: art.fee.toString(), deposit: art.deposit.toString(), paid: art.paid, set_time: art.set_time || '', stage: art.stage || '', notes: art.notes || '' })
    setEditId(art.id); setShowForm(true)
  }

  const totalFees = artists.reduce((s, a) => s + a.fee, 0)
  const totalDeposits = artists.reduce((s, a) => s + a.deposit, 0)
  const unpaid = artists.filter((a) => !a.paid).length

  const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

  return (
    <EventLayout eventId={id}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Artistů celkem', value: artists.length, color: '#a78bfa', suffix: '' },
            { label: 'Celkové honoráře', value: totalFees.toLocaleString('cs-CZ'), color: '#f87171', suffix: ' Kč' },
            { label: 'Zálohy', value: totalDeposits.toLocaleString('cs-CZ'), color: '#60a5fa', suffix: ' Kč' },
            { label: 'Nezaplacených', value: unpaid, color: '#fbbf24', suffix: '' },
          ].map((s) => (
            <div key={s.label} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#161616', border: '1px solid #2d1515' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: s.color }}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}
          style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: '#e05555', color: '#fff', border: 'none', cursor: 'pointer' }}>
          + Přidat artista
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #e05555' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#f4978e' }}>
            {editId ? 'Upravit artista' : 'Nový artista'}
          </h3>

          {/* Vybrat z adresáře */}
          {!editId && contacts.length > 0 && (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#0c0c0c', borderRadius: '8px', border: '1px solid #2d1515' }}>
              <label style={{ ...labelStyle, color: '#f4978e' }}>⚡ Vybrat z adresáře kontaktů</label>
              <select
                defaultValue=""
                onChange={e => pickContact(e.target.value)}
                style={{ ...inputStyle, color: '#f1f5f9' }}
              >
                <option value="">— vybrat kontakt —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type}){c.fee > 0 ? ` — ${c.fee.toLocaleString('cs-CZ')} Kč` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Jméno / pseudonym *</label>
              <input required value={form.artist_name} onChange={e => setForm({ ...form, artist_name: e.target.value })} placeholder="např. Ripplednb" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={inputStyle}>
                <option value="">—</option>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Set time</label>
              <input value={form.set_time} onChange={e => setForm({ ...form, set_time: e.target.value })} placeholder="22:00" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Honorář (Kč)</label>
              <input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Záloha (Kč)</label>
              <input type="number" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} placeholder="0" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#9ca3af' }}>
                <input type="checkbox" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} />
                Zaplaceno
              </label>
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Poznámky</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Rider, technické požadavky, kontakt..." style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ padding: '8px 20px', backgroundColor: '#1e1e1e', color: '#9ca3af', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>Načítám...</div>
      ) : artists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #2d1515', color: '#6b7280' }}>
          Zatím žádní artisté. Klikni + Přidat artista.
        </div>
      ) : (
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #2d1515' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#161616', borderBottom: '1px solid #2d1515' }}>
                {['Artist', 'Stage', 'Set Time', 'Honorář', 'Záloha', 'Zbývá', 'Zaplaceno', 'Poznámky', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artists.map(art => (
                <tr key={art.id} style={{ borderBottom: '1px solid #1e1e1e' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#f1f5f9' }}>{art.artist_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {art.stage
                      ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#1a1a2e', color: '#a78bfa', fontWeight: '500' }}>{art.stage}</span>
                      : <span style={{ color: '#374151' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af' }}>{art.set_time || '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#f1f5f9' }}>{art.fee.toLocaleString('cs-CZ')} Kč</td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa' }}>{art.deposit > 0 ? art.deposit.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: art.fee - art.deposit > 0 ? '#f87171' : '#34d399' }}>
                    {(art.fee - art.deposit).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => handleTogglePaid(art)}
                      style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer',
                        backgroundColor: art.paid ? '#052e16' : '#2d0a0a', color: art.paid ? '#34d399' : '#f87171' }}>
                      {art.paid ? 'ANO' : 'NE'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#6b7280', maxWidth: '200px' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.notes || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => startEdit(art)} style={{ fontSize: '12px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer' }}>Upravit</button>
                      <button onClick={() => handleDelete(art.id)} style={{ fontSize: '12px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer' }}>Smazat</button>
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
