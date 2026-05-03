'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EventStatus } from '@/lib/types'

export default function NovaAkcePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    date: '',
    location: '',
    type: '',
    status: 'pripravuje_se' as EventStatus,
    description: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('events').insert([form]).select().single()
    if (!error && data) {
      router.push(`/akce/${data.id}/vydaje`)
    } else {
      alert('Chyba při vytváření akce: ' + error?.message)
      setLoading(false)
    }
  }

  const inputStyle = {
    backgroundColor: '#0a0a0f',
    border: '1px solid #2a2a3e',
    color: '#f1f5f9',
    borderRadius: '8px',
    padding: '10px 14px',
    width: '100%',
    outline: 'none',
    fontSize: '14px',
  }

  const labelStyle = { color: '#9ca3af', fontSize: '13px', fontWeight: '500', marginBottom: '6px', display: 'block' }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: '#f1f5f9' }}>Nová akce</h1>
        <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>Vytvoř nový festival nebo událost</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-5" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
        <div>
          <label style={labelStyle}>Název akce *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="např. TŘEBASS OPEN AIR 2026"
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Datum</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Místo konání</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="např. Paintball Areál Praha"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Typ akce</label>
            <input
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="např. Open Air, Club Night"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EventStatus })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="pripravuje_se">Připravuje se</option>
              <option value="probihá">Probíhá</option>
              <option value="dokonceno">Dokončeno</option>
              <option value="archivovano">Archivováno</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Poznámka</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Volitelný popis akce..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#7c3aed', color: '#fff', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Ukládám...' : 'Vytvořit akci'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#1e1e2e', color: '#9ca3af' }}
          >
            Zrušit
          </button>
        </div>
      </form>
    </div>
  )
}
