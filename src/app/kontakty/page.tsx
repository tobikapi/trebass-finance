'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createContact, updateContact, deleteContact } from '@/app/actions'

const TYPES = ['DJ', 'MC', 'live act', 'stage manager', 'technik zvuku', 'technik světel', 'produkce', 'security', 'dodavatel', 'venue', 'jiné']
const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  'DJ':               { color: '#f4978e', bg: '#2d1515' },
  'MC':               { color: '#f4978e', bg: '#2d1515' },
  'live act':         { color: '#fb923c', bg: '#2d1a05' },
  'stage manager':    { color: '#a78bfa', bg: '#1e1535' },
  'technik zvuku':    { color: '#60a5fa', bg: '#1e2d3d' },
  'technik světel':   { color: '#38bdf8', bg: '#0c2233' },
  'produkce':         { color: '#34d399', bg: '#052e16' },
  'security':         { color: '#fbbf24', bg: '#2d2005' },
  'dodavatel':        { color: '#c084fc', bg: '#1e1535' },
  'venue':            { color: '#4ade80', bg: '#052e16' },
  'jiné':             { color: '#9ca3af', bg: '#1e1e1e' },
}

interface Contact {
  id: string; name: string; type: string; fee: number
  email: string | null; phone: string | null; note: string | null; created_at: string
}

const emptyForm = { name: '', type: 'DJ', email: '', phone: '', note: '', fee: '' }

export default function KontaktyPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('vse')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = {
      name: form.name, type: form.type,
      email: form.email || null, phone: form.phone || null, note: form.note || null,
      fee: parseInt(form.fee) || 0,
    }
    const result = editId ? await updateContact(editId, payload) : await createContact(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  function startEdit(c: Contact) {
    setForm({ name: c.name, type: c.type, email: c.email || '', phone: c.phone || '', note: c.note || '', fee: c.fee ? String(c.fee) : '' })
    setEditId(c.id); setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat kontakt?')) return
    await deleteContact(id); await load()
  }

  const filtered = contacts.filter(c => {
    if (filterType !== 'vse' && c.type !== filterType) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !(c.email || '').toLowerCase().includes(search.toLowerCase()) &&
        !(c.note || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Kontakty</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Adresář umělců, dodavatelů a partnerů</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }}
          style={{ padding: '10px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
          + Přidat kontakt
        </button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat jméno, email, poznámku..."
          style={{ ...inputStyle, width: '260px' }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['vse', ...TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer',
                backgroundColor: filterType === t ? '#e05555' : '#1e1e1e',
                color: filterType === t ? '#fff' : '#9ca3af' }}>
              {t === 'vse' ? 'Vše' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#161616', border: '1px solid #e05555', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#f4978e' }}>
            {editId ? 'Upravit kontakt' : 'Nový kontakt'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Jméno / název *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jméno nebo firma" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Typ</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inputStyle}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Honorář / cena (Kč)</label>
              <input type="number" min="0" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+420 ..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@..." style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Poznámka</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Rider, požadavky, technické nároky..." style={inputStyle} />
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

      {/* Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>Načítám...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#161616', border: '1px dashed #2d2d2d', borderRadius: '12px', color: '#4b5563' }}>
          {search || filterType !== 'vse' ? 'Žádné výsledky.' : 'Zatím žádné kontakty. Přidej první →'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {filtered.map(c => {
            const tc = TYPE_COLORS[c.type] || TYPE_COLORS.jiné
            return (
              <div key={c.id} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f5f9' }}>{c.name}</div>
                    <span style={{ fontSize: '11px', color: tc.color, backgroundColor: tc.bg, padding: '2px 8px', borderRadius: '10px', marginTop: '4px', display: 'inline-block' }}>
                      {c.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => startEdit(c)} style={{ fontSize: '11px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                    <button onClick={() => handleDelete(c.id)} style={{ fontSize: '11px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
                  </div>
                </div>

                {c.fee > 0 && (
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#f4978e', marginBottom: '8px' }}>
                    {c.fee.toLocaleString('cs-CZ')} Kč
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📞</span> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>✉️</span> {c.email}
                    </a>
                  )}
                  {c.note && (
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>{c.note}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
