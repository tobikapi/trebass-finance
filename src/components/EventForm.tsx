'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { callAction } from '@/lib/call-action'
import { supabase } from '@/lib/supabase'
import { EventStatus, Event } from '@/lib/types'
import { useDialog } from '@/lib/dialog-context'

interface Props {
  existing?: Event
}

interface PersonOption { id: string; name: string | null; email: string | null }

const emptyForm = {
  name: '', date: '', date_end: '', time_start: '', time_end: '',
  location: '', type: '', status: 'pripravuje_se' as EventStatus, description: '',
}

export default function EventForm({ existing }: Props) {
  const { notify } = useDialog()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showTime, setShowTime] = useState(!!(existing?.time_start))
  const [form, setForm] = useState(existing ? {
    name: existing.name,
    date: existing.date || '',
    date_end: existing.date_end || '',
    time_start: existing.time_start || '',
    time_end: existing.time_end || '',
    location: existing.location || '',
    type: existing.type || '',
    status: existing.status,
    description: existing.description || '',
  } : emptyForm)

  // Kdo má k akci přístup. Admini s adminAccessMode='all' (default) vidí
  // akci všichni — jen když zaškrtneš „jen vybraní", vybíráš konkrétní lidi.
  // Crew Member musí být vybraný vždy, jinak akci vůbec neuvidí.
  const [admins, setAdmins] = useState<PersonOption[]>([])
  const [crew, setCrew] = useState<PersonOption[]>([])
  const [adminAccessMode, setAdminAccessMode] = useState<'all' | 'selected'>(existing?.admin_access_mode || 'all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: roles } = await supabase.from('roles').select('id, name')
      const adminRoleIds = new Set((roles || []).filter(r => r.name === 'Admin').map(r => r.id))
      const crewRoleIds = new Set((roles || []).filter(r => r.name !== 'Admin').map(r => r.id))

      const { data: profiles } = await supabase.from('profiles').select('id, name, email, role_id')
      setAdmins((profiles || []).filter(p => p.role_id && adminRoleIds.has(p.role_id)))
      setCrew((profiles || []).filter(p => p.role_id && crewRoleIds.has(p.role_id)))

      if (existing) {
        const { data: access } = await supabase.from('event_access').select('profile_id').eq('event_id', existing.id)
        setSelectedIds(new Set((access || []).map(a => a.profile_id)))
      }
    }
    load()
  }, [existing])

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const f = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      time_start: showTime ? form.time_start : '', time_end: showTime ? form.time_end : '',
      admin_access_mode: adminAccessMode,
      access_profile_ids: Array.from(selectedIds),
    }
    const result = existing
      ? await callAction('updateEvent', existing.id, payload)
      : await callAction('createEvent', payload)
    if (result.error) { notify('Chyba: ' + result.error); setLoading(false); return }
    if (!existing && 'data' in result && result.data && typeof result.data === 'object' && 'id' in result.data) {
      router.push(`/akce/${result.data.id}/vydaje`)
    } else {
      router.push('/akce')
    }
  }

  const inputStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px' }
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' as const, marginBottom: '6px', display: 'block' as const }

  return (
    <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>Název akce *</label>
        <input required value={form.name} onChange={f('name')} placeholder="např. TŘEBASS OPEN AIR 2026" style={inputStyle} />
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Datum od</label>
          <input type="date" value={form.date} onChange={f('date')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Datum do</label>
          <input type="date" value={form.date_end} min={form.date} onChange={f('date_end')} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Místo konání</label>
          <input value={form.location} onChange={f('location')} placeholder="např. Paintball Areál Praha" style={inputStyle} />
        </div>
      </div>

      {/* Time toggle */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
          <div
            onClick={() => setShowTime(v => !v)}
            style={{
              width: '36px', height: '20px', borderRadius: '10px', position: 'relative', flexShrink: 0,
              backgroundColor: showTime ? '#e05555' : 'var(--bg-card-dark)',
              transition: 'background-color 0.2s',
              cursor: 'pointer',
            }}
          >
            <div style={{
              position: 'absolute', top: '3px', left: showTime ? '19px' : '3px',
              width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fff',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Přidat čas</span>
        </label>

        {showTime && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
            <div>
              <label style={labelStyle}>Čas od</label>
              <input type="time" value={form.time_start} onChange={f('time_start')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Čas do</label>
              <input type="time" value={form.time_end} onChange={f('time_end')} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      {/* Type + status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Typ akce</label>
          <input value={form.type} onChange={f('type')} placeholder="např. Open Air, Club Night" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={f('status')} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="pripravuje_se">Připravuje se</option>
            <option value="probihá">Probíhá</option>
            <option value="dokonceno">Dokončeno</option>
            <option value="archivovano">Archivováno</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Obecné info (kontext, dress code...)</label>
        <textarea value={form.description} onChange={f('description')} placeholder="Např. dress code, kontext akce, důležité info pro tým..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {/* Kdo má přístup */}
      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '20px' }}>
        <label style={labelStyle}>Kdo má k akci přístup</label>

        <div style={{ display: 'flex', gap: '16px', marginBottom: admins.length > 0 || crew.length > 0 ? '14px' : 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="radio" checked={adminAccessMode === 'all'} onChange={() => setAdminAccessMode('all')} />
            Všichni administrátoři
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="radio" checked={adminAccessMode === 'selected'} onChange={() => setAdminAccessMode('selected')} />
            Jen vybraní admini
          </label>
        </div>

        {adminAccessMode === 'selected' && admins.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            {admins.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                {p.name || p.email}
              </label>
            ))}
          </div>
        )}

        {crew.length > 0 && (
          <>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Crew members (vidí akci jen ti zaškrtnutí):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {crew.map(p => (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                  {p.name || p.email}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
        <button type="submit" disabled={loading} style={{ padding: '10px 24px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Ukládám...' : existing ? 'Uložit změny' : 'Vytvořit akci'}
        </button>
        <button type="button" onClick={() => router.back()} style={{ padding: '10px 24px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '14px', border: 'none', cursor: 'pointer' }}>
          Zrušit
        </button>
      </div>
    </form>
  )
}
