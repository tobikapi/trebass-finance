'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'
import { formatDateRange } from '@/lib/types'
import { canAccessEvent, fetchEventAccessMap } from '@/lib/event-access'

interface EventRow {
  id: string; name: string; date: string | null; date_end: string | null
  time_start: string | null; time_end: string | null; location: string | null
  status: string; admin_access_mode: 'all' | 'selected'
}
interface TaskRow {
  id: string; title: string; status: string; priority: string
  due_date: string | null; assigned_to_members: string[]; event_id: string | null
}

const STATUS_LABELS: Record<string, string> = { todo: 'To Do', in_progress: 'Probíhá', done: 'Hotovo' }
const STATUS_COLORS: Record<string, string> = { todo: '#6b7280', in_progress: '#f4978e', done: '#34d399' }

// Dashboard pro lidi bez přístupu k penězům (Crew Member apod.) — žádné
// částky, žádné výdaje/příjmy. Jen co reálně potřebují: na jaké akce mají
// přístup a co mají udělat.
export default function MyDashboard() {
  const { user, role, profile } = useUser()
  const [events, setEvents] = useState<EventRow[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: evts }, { data: tsk }, accessMap] = await Promise.all([
        supabase.from('events').select('id, name, date, date_end, time_start, time_end, location, status, admin_access_mode'),
        supabase.from('tasks').select('id, title, status, priority, due_date, assigned_to_members, event_id'),
        fetchEventAccessMap(),
      ])
      const visible = (evts || []).filter(e => canAccessEvent(e, role, user?.id, accessMap, e.id))
      setEvents(visible)
      setTasks(tsk || [])
      setLoading(false)
    }
    load()
  }, [role, user?.id])

  const todayISO = new Date().toISOString().split('T')[0]
  const upcomingEvents = events
    .filter(e => e.date && e.date >= todayISO && e.status !== 'archivovano')
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .slice(0, 5)

  const myName = profile?.name || ''
  const myTasks = tasks.filter(t => (t.assigned_to_members || []).includes(myName))
  const myOpenTasks = myTasks.filter(t => t.status !== 'done')
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  const myDoneCount = myTasks.filter(t => t.status === 'done').length
  const isOverdue = (t: TaskRow) => !!t.due_date && t.status !== 'done' && t.due_date < todayISO

  const eventName = (id: string | null) => events.find(e => e.id === id)?.name

  if (loading) {
    return <div style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>Načítám...</div>
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Ahoj{myName ? `, ${myName.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: 0 }}>
          Přehled akcí a úkolů, ke kterým máš přístup
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Nadcházející akce</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>{upcomingEvents.length}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Otevřené úkoly</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#f4978e' }}>{myOpenTasks.length}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Dokončené úkoly</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#34d399' }}>{myDoneCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Nadcházející akce */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 12px' }}>Nadcházející akce</h2>
          {upcomingEvents.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', border: '1px dashed var(--border-subtle)', borderRadius: '10px' }}>
              Zatím žádné nadcházející akce.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingEvents.map(ev => (
                <Link key={ev.id} href={`/akce/${ev.id}/technika`} style={{ textDecoration: 'none' }}>
                  <div className="card-hover" style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{ev.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {ev.date && <span>📅 {formatDateRange(ev.date, ev.date_end, ev.time_start, ev.time_end)}</span>}
                      {ev.location && <span>📍 {ev.location}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Moje úkoly */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 12px' }}>Tvoje úkoly</h2>
          {myOpenTasks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', border: '1px dashed var(--border-subtle)', borderRadius: '10px' }}>
              Nemáš žádné otevřené úkoly.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myOpenTasks.slice(0, 6).map(t => (
                <div key={t.id} style={{
                  backgroundColor: 'var(--bg-card-alt)', borderRadius: '10px', padding: '12px 14px',
                  border: `1px solid ${isOverdue(t) ? '#4a1515' : 'var(--border-card)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{t.title}</span>
                    <span style={{ fontSize: '10px', color: STATUS_COLORS[t.status], backgroundColor: '#0c0c0c', padding: '2px 6px', borderRadius: '4px' }}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {t.event_id && eventName(t.event_id) && <span>🎪 {eventName(t.event_id)}</span>}
                    {t.due_date && (
                      <span style={{ color: isOverdue(t) ? '#e05555' : 'var(--text-muted)' }}>
                        {isOverdue(t) ? '⚠️' : '📅'} {new Date(t.due_date).toLocaleDateString('cs-CZ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/ukoly" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: '#f4978e', textDecoration: 'none' }}>
            Všechny úkoly →
          </Link>
        </div>
      </div>
    </div>
  )
}
