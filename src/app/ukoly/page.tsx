'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { createTask, updateTask, updateTaskStatus, deleteTask } from '@/app/actions'

const MEMBERS = ['Tobiáš', 'Jakub', 'Metoděj', 'Artur']
const STATUSES = [
  { value: 'todo', label: 'To Do', color: '#6b7280', bg: '#1e1e1e' },
  { value: 'in_progress', label: 'In Progress', color: '#f4978e', bg: '#2d1515' },
  { value: 'done', label: 'Hotovo', color: '#34d399', bg: '#052e16' },
]
const PRIORITIES = [
  { value: 'low', label: 'Nízká', color: '#6b7280' },
  { value: 'medium', label: 'Střední', color: '#f4978e' },
  { value: 'high', label: 'Vysoká', color: '#e05555' },
]

interface Task {
  id: string; title: string; description: string | null
  assigned_to: string | null; assigned_to_members: string[]
  status: string; priority: string; due_date: string | null; event_id: string | null; created_at: string
}
interface Event { id: string; name: string }

const emptyForm = { title: '', description: '', assigned_to_members: [] as string[], status: 'todo', priority: 'medium', due_date: '', event_id: '' }

export default function UkolyPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterUser, setFilterUser] = useState('vse')
  const [filterStatus, setFilterStatus] = useState('vse')

  async function load() {
    const [{ data: t }, { data: e }] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at'),
      supabase.from('events').select('id, name').order('date', { ascending: false }),
    ])
    setTasks(t || []); setEvents(e || []); setLoading(false)
  }

  useEffect(() => { load() }, [])

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
    const result = editId ? await updateTask(editId, payload) : await createTask(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Smazat tento úkol?')) return
    await deleteTask(id); await load()
  }

  async function handleStatusChange(task: Task, newStatus: string) {
    await updateTaskStatus(task.id, newStatus); await load()
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
    if (filterStatus !== 'vse' && t.status !== filterStatus) return false
    return true
  })

  const grouped = {
    todo: filtered.filter((t) => t.status === 'todo'),
    in_progress: filtered.filter((t) => t.status === 'in_progress'),
    done: filtered.filter((t) => t.status === 'done'),
  }

  const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' }
  const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

  const getPriorityColor = (p: string) => PRIORITIES.find((x) => x.value === p)?.color || '#6b7280'
  const getStatusInfo = (s: string) => STATUSES.find((x) => x.value === s) || STATUSES[0]

  const isOverdue = (task: Task) => task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Úkoly</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Task management pro celý tým</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true) }} style={{ padding: '10px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
          + Nový úkol
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>Člen:</span>
          {['vse', ...MEMBERS].map((m) => (
            <button key={m} onClick={() => setFilterUser(m)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: filterUser === m ? '#e05555' : '#1e1e1e', color: filterUser === m ? '#fff' : '#9ca3af' }}>
              {m === 'vse' ? 'Vše' : m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', marginRight: '4px' }}>Status:</span>
          {[{ value: 'vse', label: 'Vše' }, ...STATUSES].map((s) => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', border: 'none', cursor: 'pointer', backgroundColor: filterStatus === s.value ? '#e05555' : '#1e1e1e', color: filterStatus === s.value ? '#fff' : '#9ca3af' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#161616', border: '1px solid #e05555', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#f4978e' }}>{editId ? 'Upravit úkol' : 'Nový úkol'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Název *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Co je potřeba udělat..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Přiřadit (více lidí)</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
                {MEMBERS.map(m => {
                  const selected = form.assigned_to_members.includes(m)
                  return (
                    <button key={m} type="button" onClick={() => toggleMember(m)} style={{
                      padding: '6px 13px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                      border: '1px solid', transition: 'all 0.15s',
                      backgroundColor: selected ? '#2d1515' : '#0c0c0c',
                      borderColor: selected ? '#e05555' : '#2d1515',
                      color: selected ? '#f4978e' : '#6b7280',
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
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
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
            <button type="submit" disabled={saving} style={{ padding: '8px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '8px 20px', backgroundColor: '#1e1e1e', color: '#9ca3af', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>Načítám...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {STATUSES.map((col) => {
            const colTasks = grouped[col.value as keyof typeof grouped]
            return (
              <div key={col.value}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: col.color }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#4b5563', backgroundColor: '#1e1e1e', padding: '2px 8px', borderRadius: '10px' }}>{colTasks.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {colTasks.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#4b5563', fontSize: '12px', border: '1px dashed #2d2d2d', borderRadius: '8px' }}>
                      Žádné úkoly
                    </div>
                  )}
                  {colTasks.map((task) => {
                    const overdue = isOverdue(task)
                    return (
                      <div key={task.id} className="card-hover" style={{ backgroundColor: '#161616', border: `1px solid ${overdue ? '#4a1515' : '#2d1515'}`, borderRadius: '10px', padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#f1f5f9', flex: 1, marginRight: '8px' }}>{task.title}</span>
                          <span style={{ fontSize: '11px', color: getPriorityColor(task.priority), backgroundColor: '#0c0c0c', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                            {PRIORITIES.find((p) => p.value === task.priority)?.label}
                          </span>
                        </div>

                        {task.description && (
                          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px 0' }}>{task.description}</p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          {(task.assigned_to_members || []).map(m => (
                            <span key={m} style={{ fontSize: '11px', backgroundColor: '#2d1515', color: '#f4978e', padding: '2px 8px', borderRadius: '10px' }}>
                              {m}
                            </span>
                          ))}
                          {task.due_date && (
                            <span style={{ fontSize: '11px', color: overdue ? '#e05555' : '#6b7280' }}>
                              {overdue ? '⚠️' : '📅'} {new Date(task.due_date).toLocaleDateString('cs-CZ')}
                            </span>
                          )}
                          {task.event_id && (
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>
                              🎪 {events.find((e) => e.id === task.event_id)?.name?.split(' ').slice(0, 2).join(' ')}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            style={{ fontSize: '11px', backgroundColor: getStatusInfo(task.status).bg, color: getStatusInfo(task.status).color, border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', outline: 'none' }}
                          >
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => startEdit(task)} style={{ fontSize: '11px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                            <button onClick={() => handleDelete(task.id)} style={{ fontSize: '11px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
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
      )}
    </div>
  )
}
