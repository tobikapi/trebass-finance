'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent } from '@/app/actions'
import { EventStatus } from '@/lib/types'

export default function NovaAkcePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', date_end: '', location: '', type: '', status: 'pripravuje_se' as EventStatus, description: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const result = await createEvent(form)
    if (result.error) { alert('Chyba při vytváření akce: ' + result.error); setLoading(false) }
    else if (result.data) router.push(`/akce/${result.data.id}/vydaje`)
  }

  const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '8px', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px' }
  const labelStyle = { color: '#9ca3af', fontSize: '13px', fontWeight: '500' as const, marginBottom: '6px', display: 'block' as const }

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Nová akce</h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Vytvoř nový festival nebo událost</p>
      </div>

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Název akce *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="např. TŘEBASS OPEN AIR 2026" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Datum od</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Datum do</label>
            <input type="date" value={form.date_end} min={form.date} onChange={(e) => setForm({ ...form, date_end: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Místo konání</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="např. Paintball Areál Praha" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Typ akce</label>
            <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="např. Open Air, Club Night" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="pripravuje_se">Připravuje se</option>
              <option value="probihá">Probíhá</option>
              <option value="dokonceno">Dokončeno</option>
              <option value="archivovano">Archivováno</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Poznámka</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Volitelný popis akce..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Ukládám...' : 'Vytvořit akci'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ padding: '10px 24px', backgroundColor: '#1e1e1e', color: '#9ca3af', borderRadius: '8px', fontSize: '14px', border: 'none', cursor: 'pointer' }}>
            Zrušit
          </button>
        </div>
      </form>
    </div>
  )
}
