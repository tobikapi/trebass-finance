'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { callAction } from '@/lib/call-action'
import { supabase } from '@/lib/supabase'
import { EventStatus, Event } from '@/lib/types'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import Collapse from '@/components/Collapse'
import {
  EVENT_EDIT_KEYS, EVENT_VIEW_KEYS, PERMISSION_LABELS, type PermissionKey, type Permissions,
} from '@/lib/permissions'

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
  const [includeInTotals, setIncludeInTotals] = useState<boolean>(existing?.include_in_totals ?? true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // Výjimky = oprávnění navíc k roli, jen v téhle akci (event_access.permissions).
  const [exceptions, setExceptions] = useState<Record<string, Permissions>>({})
  const [openExceptionsFor, setOpenExceptionsFor] = useState<string | null>(null)
  const { user, realRole } = useUser()
  // Kdo akci vidí a s jakými výjimkami, smí měnit jen admin nebo zakladatel
  // (stejně jako server a databáze). Editor přes výjimku tuhle sekci nevidí.
  const canManageAccess = !existing || realRole?.permissions?.admin === true || existing.created_by === user?.id

  useEffect(() => {
    async function load() {
      const { data: roles } = await supabase.from('roles').select('id, name')
      const adminRoleIds = new Set((roles || []).filter(r => r.name === 'Admin').map(r => r.id))
      const crewRoleIds = new Set((roles || []).filter(r => r.name !== 'Admin').map(r => r.id))

      const { data: profiles } = await supabase.from('profiles').select('id, name, email, role_id')
      setAdmins((profiles || []).filter(p => p.role_id && adminRoleIds.has(p.role_id)))
      setCrew((profiles || []).filter(p => p.role_id && crewRoleIds.has(p.role_id)))

      if (existing) {
        const { data: access } = await supabase.from('event_access').select('profile_id, permissions').eq('event_id', existing.id)
        setSelectedIds(new Set((access || []).map(a => a.profile_id)))
        setExceptions(Object.fromEntries((access || []).map(a => [a.profile_id, (a.permissions || {}) as Permissions])))
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

  function toggleException(profileId: string, key: PermissionKey) {
    setExceptions(prev => {
      const cur = { ...(prev[profileId] || {}) }
      if (cur[key]) delete cur[key]
      else cur[key] = true
      return { ...prev, [profileId]: cur }
    })
  }

  // Čtenář = jen vidí zaškrtnuté záložky, Editor = smí v nich i vytvářet
  // a upravovat. Mazání je samostatné zaškrtávátko.
  function setEditMode(profileId: string, editor: boolean) {
    setExceptions(prev => {
      const cur = { ...(prev[profileId] || {}) }
      for (const k of EVENT_EDIT_KEYS) {
        if (editor) cur[k] = true
        else delete cur[k]
      }
      return { ...prev, [profileId]: cur }
    })
  }

  function copyExceptionsToAll(fromId: string) {
    const source = exceptions[fromId] || {}
    setExceptions(prev => {
      const next = { ...prev }
      for (const p of crew) if (selectedIds.has(p.id)) next[p.id] = { ...source }
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
      access_exceptions: Object.fromEntries(Array.from(selectedIds).map(pid => [pid, exceptions[pid] || {}])),
      include_in_totals: includeInTotals,
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
      {canManageAccess && <>
      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeInTotals} onChange={e => setIncludeInTotals(e.target.checked)}
            style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0 }} />
          <span>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>Započítávat do celkových přehledů</span>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Vypni u akcí, které jsou jen tvoje kalkulačka a nemají nic společného s firemními penězi — nebudou se počítat do celkových součtů na Dashboardu.
            </span>
          </span>
        </label>
      </div>

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
              {crew.map(p => {
                const selected = selectedIds.has(p.id)
                const exc = exceptions[p.id] || {}
                const excCount = Object.values(exc).filter(Boolean).length
                const isEditor = EVENT_EDIT_KEYS.every(k => exc[k])
                const open = openExceptionsFor === p.id && selected
                return (
                  <div key={p.id} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleSelected(p.id)} />
                        {p.name || p.email}
                      </label>
                      {selected && (
                        <button type="button" onClick={() => setOpenExceptionsFor(open ? null : p.id)} style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '10px', cursor: 'pointer',
                          border: '1px solid var(--border-card)', background: 'none',
                          color: excCount > 0 ? '#fbbf24' : 'var(--text-muted)',
                        }}>
                          {open ? '▾' : '▸'} výjimky{excCount > 0 ? ` (${excCount})` : ''}
                        </button>
                      )}
                    </div>
                    <Collapse open={open}>
                      <div style={{ margin: '8px 0 10px 24px', padding: '12px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-card-dark)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Navíc k roli, jen v téhle akci — nikdy nic neubírá.
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginBottom: '10px' }}>
                          {EVENT_VIEW_KEYS.map(k => (
                            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', color: exc[k] ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                              <input type="checkbox" checked={exc[k] === true} onChange={() => toggleException(p.id, k)} />
                              {PERMISSION_LABELS[k]}
                            </label>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>V téhle akci:</span>
                          {([false, true] as const).map(editor => {
                            const active = isEditor === editor
                            return (
                              <button key={String(editor)} type="button" onClick={() => setEditMode(p.id, editor)} style={{
                                fontSize: '11px', padding: '3px 10px', borderRadius: '10px', cursor: 'pointer',
                                border: '1px solid var(--border-card)',
                                backgroundColor: active ? (editor ? '#e05555' : 'var(--text-secondary)') : 'transparent',
                                color: active ? (editor ? '#fff' : 'var(--bg-card-alt)') : 'var(--text-muted)',
                              }}>{editor ? 'Editor' : 'Čtenář'}</button>
                            )
                          })}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer', marginLeft: '6px', color: exc.canDelete ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                            <input type="checkbox" checked={exc.canDelete === true} onChange={() => toggleException(p.id, 'canDelete')} />
                            Mazat záznamy
                          </label>
                          <button type="button" onClick={() => copyExceptionsToAll(p.id)} style={{
                            marginLeft: 'auto', fontSize: '11px', padding: '3px 10px', borderRadius: '10px', cursor: 'pointer',
                            border: '1px solid var(--border-card)', background: 'none', color: 'var(--text-secondary)',
                          }}>Stejné pro všechny vybrané crew</button>
                        </div>
                      </div>
                    </Collapse>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      </>}

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
