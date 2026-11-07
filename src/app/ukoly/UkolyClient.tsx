'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { callAction } from '@/lib/call-action'
import { useUndo } from '@/lib/undo-context'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'

const STATUSES = [
  { value: 'todo', label: 'To Do', color: '#d15c49', bg: 'var(--bg-card-dark)' },
  { value: 'in_progress', label: 'In Progress', color: '#e3b341', bg: 'var(--bg-card-dark)' },
  { value: 'done', label: 'Hotovo', color: '#34d399', bg: 'var(--bg-card-dark)' },
]
const PRIORITIES = [
  { value: 'low', label: 'Nízká', color: '#8b93a3' },
  { value: 'medium', label: 'Střední', color: '#e3b341' },
  { value: 'high', label: 'Vysoká', color: '#d15c49' },
]

interface Task {
  id: string; title: string; description: string | null
  assigned_to: string | null; assigned_to_members: string[]
  status: string; priority: string; due_date: string | null; event_id: string | null; created_at: string
}
interface Event { id: string; name: string; date: string | null; status: string }
interface Member { id: string; name: string | null }

const emptyForm = { title: '', description: '', assigned_to_members: [] as string[], status: 'todo', priority: 'medium', due_date: '', event_id: '' }

interface Props {
  initialTasks: Task[]
  initialEvents: Event[]
  initialMembers: Member[]
}

export default function UkolyClient({ initialTasks, initialEvents, initialMembers }: Props) {
  // Tlačítka podle role. Vynucuje to server a databáze — tady jde jen o to,
  // aby člověk neklikal na něco, co neprojde.
  const { can, orgId } = useUser()
  const canCreate = can('canCreate')
  const canEdit = can('canEdit')
  const canDelete = can('canDelete')
  const { notify } = useDialog()
  const { pushUndo } = useUndo()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const members = initialMembers.map(m => m.name).filter((n): n is string => !!n)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterUser, setFilterUser] = useState('vse')
  const [filterStatus, setFilterStatus] = useState('vse')
  const [filterEvent, setFilterEvent] = useState('vse')
  const [filterPriority, setFilterPriority] = useState('vse')
  // Na mobilu se ukazuje jeden sloupec (přepínač To Do / In Progress / Hotovo)
  const [mobileCol, setMobileCol] = useState('todo')

  async function load() {
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase.from('tasks').select('*').eq('org_id', orgId ?? '').order('due_date', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('events').select('id, name, date, status').eq('org_id', orgId ?? '').order('date', { ascending: false }),
    ])
    setTasks(t || []); setEvents(e || [])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = {
      title: form.title,
      description: form.description || null,
      assigned_to_members: form.assigned_to_members,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      event_id: form.event_id || null,
    }
    const prev = editId ? tasks.find(x => x.id === editId) : null
    const result = editId ? await callAction('updateTask', editId, payload) : await callAction('createTask', payload)
    if (result.error) { notify('Chyba: ' + result.error); setSaving(false); return }
    if (editId && prev) {
      const prevPayload = { title: prev.title, description: prev.description, assigned_to_members: prev.assigned_to_members, status: prev.status, priority: prev.priority, due_date: prev.due_date, event_id: prev.event_id }
      pushUndo(`úprava úkolu „${prev.title}“`, async () => {
        const res = await callAction('updateTask', editId, prevPayload)
        if (res.error) throw new Error(res.error)
        await load()
      })
    } else if (!editId && result.data) {
      const newId = (result.data as Task).id
      pushUndo(`přidání úkolu „${payload.title}“`, async () => {
        const res = await callAction('deleteTask', newId)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat tento úkol?')) return
    const row = tasks.find(t => t.id === id)
    await callAction('deleteTask', id); await load()
    if (row) {
      pushUndo(`smazání úkolu „${row.title}“`, async () => {
        const res = await callAction('restoreRow', 'tasks', row)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
  }

  async function handleStatusChange(task: Task, newStatus: string) {
    const prevStatus = task.status
    await callAction('updateTaskStatus', task.id, newStatus); await load()
    pushUndo(`změna statusu „${task.title}“`, async () => {
      const res = await callAction('updateTaskStatus', task.id, prevStatus)
      if (res.error) throw new Error(res.error)
      await load()
    })
  }

  function startEdit(task: Task) {
    setForm({
      title: task.title, description: task.description || '',
      assigned_to_members: task.assigned_to_members || [],
      status: task.status, priority: task.priority, due_date: task.due_date || '', event_id: task.event_id || '',
    })
    setEditId(task.id); setShowForm(true)
  }

  function toggleMember(name: string) {
    setForm(f => ({
      ...f,
      assigned_to_members: f.assigned_to_members.includes(name)
        ? f.assigned_to_members.filter(x => x !== name)
        : [...f.assigned_to_members, name],
    }))
  }

  const filtered = tasks.filter((t) => {
    if (filterUser !== 'vse' && !(t.assigned_to_members || []).includes(filterUser)) return false
    if (filterPriority !== 'vse' && t.priority !== filterPriority) return false
    if (filterStatus !== 'vse' && t.status !== filterStatus) return false
    if (filterEvent === 'bez_akce' && t.event_id) return false
    if (filterEvent !== 'vse' && filterEvent !== 'bez_akce' && t.event_id !== filterEvent) return false
    return true
  })

  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const byPriority = (list: Task[]) => [...list].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])

  const grouped = {
    todo: byPriority(filtered.filter((t) => t.status === 'todo')),
    in_progress: byPriority(filtered.filter((t) => t.status === 'in_progress')),
    done: byPriority(filtered.filter((t) => t.status === 'done')),
  }

  const inputStyle = { backgroundColor: 'var(--bg-base)', border: '1px solid #2d1515', color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' }
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

  const getStatusInfo = (s: string) => STATUSES.find((x) => x.value === s) || STATUSES[0]

  const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const isOverdue = (task: Task) => !!task.due_date && task.status !== 'done' && task.due_date < todayISO()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Úkoly</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: 0 }}>Task management pro celý tým</p>
        </div>
        {canCreate && (<button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} style={{ flexShrink: 0, whiteSpace: 'nowrap', minHeight: '44px', padding: '0 18px', backgroundColor: '#d15c49', color: '#fff', borderRadius: '10px', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
          + Nový úkol
        </button>)}
      </div>

      {/* Filters */}
      <div className="ukoly-filters" style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="chip-row" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Člen:</span>
          {['vse', ...members].map((m) => (
            <button key={m} className="chip" onClick={() => setFilterUser(m)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: filterUser === m ? '#d15c49' : 'var(--bg-card-dark)', color: filterUser === m ? '#fff' : 'var(--text-secondary)' }}>
              {m === 'vse' ? 'Vše' : m}
            </button>
          ))}
        </div>
        <div className="m-hide" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Status:</span>
          {[{ value: 'vse', label: 'Vše' }, ...STATUSES].map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: filterStatus === s.value ? '#d15c49' : 'var(--bg-card-dark)', color: filterStatus === s.value ? '#fff' : 'var(--text-secondary)' }}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="ukoly-selects" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="select-pill">
            <span>Akce:</span>
            <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
              <option value="vse">Všechny akce</option>
              <option value="bez_akce">Bez akce</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
            </select>
          </label>
          <label className="select-pill">
            <span>Priorita:</span>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="vse">Vše</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Přepínač sloupců — jen na mobilu */}
      <div className="ukoly-seg" role="tablist" aria-label="Stav úkolů">
        {STATUSES.map(st => {
          const n = grouped[st.value as keyof typeof grouped].length
          const active = mobileCol === st.value
          return (
            <button key={st.value} role="tab" aria-selected={active} onClick={() => setMobileCol(st.value)}
              className={`ukoly-seg-btn${active ? ' active' : ''}`} style={{ ['--seg' as string]: st.color }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: st.color, flexShrink: 0 }} />
              <span>{st.label}</span>
              <span className="num ukoly-seg-count">{n}</span>
            </button>
          )
        })}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '24px', padding: '20px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid #d15c49', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#f4978e' }}>{editId ? 'Upravit úkol' : 'Nový úkol'}</h3>
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Název *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Co je potřeba udělat..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Přiřadit (více lidí)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                {members.map(m => {
                  const selected = form.assigned_to_members.includes(m)
                  return (
                    <button key={m} type="button" onClick={() => toggleMember(m)} style={{
                      padding: '6px 13px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                      border: '1px solid', transition: 'all 0.15s',
                      backgroundColor: selected ? '#2d1515' : '#0c0c0c',
                      borderColor: selected ? '#d15c49' : '#2d1515',
                      color: selected ? '#f4978e' : 'var(--text-muted)',
                      fontWeight: selected ? '600' : '400',
                    }}>{m}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Priorita</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={inputStyle}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Termín</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Poznámka</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Podrobnosti, poznámky..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Akce (volitelné)</label>
              <select value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })} style={inputStyle}>
                <option value="">— žádná —</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', backgroundColor: '#d15c49', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '8px 20px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {STATUSES.map((col) => {
          const colTasks = grouped[col.value as keyof typeof grouped]
          return (
            <div key={col.value} className={`ukoly-col${mobileCol === col.value ? ' is-active' : ''}`}>
              <div className="ukoly-col-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color, display: 'inline-block' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: col.color }}>{col.label}</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)', backgroundColor: 'var(--bg-card-dark)', padding: '2px 8px', borderRadius: '10px' }}>{colTasks.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {colTasks.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', border: '1px dashed var(--border-subtle)', borderRadius: '8px' }}>
                    Žádné úkoly
                  </div>
                )}
                {colTasks.map((task) => {
                  const overdue = isOverdue(task)
                  return (
                    <div key={task.id} className="card-hover task-card" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${overdue ? 'rgba(209,92,73,0.45)' : 'var(--border)'}`, borderRadius: '14px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700, color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none', lineHeight: 1.3, minWidth: 0 }}>{task.title}</span>
                        {(() => {
                          const pr = PRIORITIES.find((p) => p.value === task.priority)
                          const done = task.status === 'done'
                          const c = done ? '#34d399' : (pr?.color || '#8b93a3')
                          return (
                            <span className="num" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c, border: `1px solid ${c}66`, backgroundColor: `${c}14`, padding: '3px 8px', borderRadius: '6px', flexShrink: 0 }}>
                              {done ? 'Hotovo' : pr?.label}
                            </span>
                          )
                        })()}
                      </div>

                      {task.description && (
                        <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.description}</p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {task.due_date && (
                          <span className="num" style={{ fontSize: '13px', fontWeight: 600, color: task.status === 'done' ? '#34d399' : overdue ? '#d15c49' : 'var(--text-secondary)' }}>
                            {task.status === 'done' ? '✓' : overdue ? '⚠' : '📅'} {(() => { const [y, m, d] = task.due_date!.split('-'); return `${Number(d)}. ${Number(m)}. ${y}` })()}
                          </span>
                        )}
                        {task.event_id && (
                          <span style={{ fontSize: '12px', color: 'var(--accent)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card-alt)', padding: '3px 8px', borderRadius: '6px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {events.find((e) => e.id === task.event_id)?.name}
                          </span>
                        )}
                        {(task.assigned_to_members || []).map(m => (
                          <span key={m} style={{ fontSize: '12px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: '10px' }}>
                            {m}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value)} disabled={!canEdit}
                          aria-label="Stav úkolu"
                          style={{ fontSize: '14px', minHeight: '40px', backgroundColor: 'var(--bg-input)', color: getStatusInfo(task.status).color, border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px', cursor: 'pointer', outline: 'none', minWidth: '120px' }}
                        >
                          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {canEdit && (<button onClick={() => startEdit(task)} style={{ fontSize: '14px', minHeight: '40px', padding: '0 10px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Upravit</button>)}
                          {canEdit && canDelete && <span style={{ color: 'var(--border)' }}>|</span>}
                          {canDelete && (<button onClick={() => handleDelete(task.id)} style={{ fontSize: '14px', minHeight: '40px', padding: '0 10px', color: '#d15c49', background: 'none', border: 'none', cursor: 'pointer' }}>Smazat</button>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
