'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Event { id: string; name: string; date: string | null; date_end: string | null; location: string | null; status: string }
interface Task { id: string; title: string; assigned_to: string | null; status: string; priority: string; due_date: string | null }

const PRIORITY_COLOR: Record<string, string> = { low: '#6b7280', medium: '#f4978e', high: '#e05555' }
const STATUS_COLOR: Record<string, string> = { todo: '#6b7280', in_progress: '#f4978e', done: '#34d399' }

const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const DAYS = ['Po','Út','St','Čt','Pá','So','Ne']

export default function KalendarPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => {
    async function load() {
      const [{ data: e }, { data: t }] = await Promise.all([
        supabase.from('events').select('id, name, date, date_end, location, status').not('date', 'is', null),
        supabase.from('tasks').select('id, title, assigned_to, status, priority, due_date').not('due_date', 'is', null),
      ])
      setEvents(e || [])
      setTasks(t || [])
      setLoading(false)
    }
    load()
  }, [])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday=0
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function getEventsForDay(day: number) {
    const cellDate = new Date(year, month, day)
    return events.filter(e => {
      if (!e.date) return false
      const start = new Date(e.date)
      const end = e.date_end ? new Date(e.date_end) : start
      return cellDate >= start && cellDate <= end
    })
  }

  function getTasksForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr))
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const upcomingEvents = events
    .filter(e => e.date && new Date(e.date) >= today)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
    .slice(0, 5)

  const upcomingTasks = tasks
    .filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) >= today)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5)

  const overdueTasks = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Kalendář</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Přehled akcí a termínů úkolů</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
        {/* Calendar */}
        <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={prevMonth} style={{ padding: '6px 14px', backgroundColor: '#1e1e1e', color: '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>‹</button>
              <button onClick={nextMonth} style={{ padding: '6px 14px', backgroundColor: '#1e1e1e', color: '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>›</button>
            </div>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9' }}>{MONTHS[month]} {year}</span>
            <button
              onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }}
              style={{ padding: '6px 14px', backgroundColor: month === today.getMonth() && year === today.getFullYear() ? '#2d1515' : '#1e1e1e', color: month === today.getMonth() && year === today.getFullYear() ? '#f4978e' : '#9ca3af', border: `1px solid ${month === today.getMonth() && year === today.getFullYear() ? '#e05555' : 'transparent'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
            >
              Dnes
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#4b5563', fontWeight: '600', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Načítám...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ minHeight: '80px' }} />
                const dayEvents = getEventsForDay(day)
                const dayTasks = getTasksForDay(day)
                const today_ = isToday(day)
                return (
                  <div key={i} style={{
                    minHeight: '80px', padding: '6px', borderRadius: '6px',
                    backgroundColor: today_ ? '#2d1515' : '#0c0c0c',
                    border: `1px solid ${today_ ? '#e05555' : '#1e1e1e'}`,
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: today_ ? '700' : '400', color: today_ ? '#f4978e' : '#6b7280', marginBottom: '4px' }}>{day}</div>
                    {dayEvents.map(ev => (
                      <div key={ev.id} title={ev.name} style={{ fontSize: '10px', backgroundColor: '#e05555', color: '#fff', borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        🎪 {ev.name.split(' ').slice(0, 3).join(' ')}
                      </div>
                    ))}
                    {dayTasks.map(task => (
                      <div key={task.id} title={task.title} style={{ fontSize: '10px', backgroundColor: '#1e1e1e', color: STATUS_COLOR[task.status] || '#6b7280', borderLeft: `2px solid ${PRIORITY_COLOR[task.priority] || '#6b7280'}`, borderRadius: '2px', padding: '1px 4px', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {task.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#e05555', display: 'inline-block' }} />
              Akce
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#1e1e1e', borderLeft: '3px solid #f4978e', display: 'inline-block' }} />
              Úkol
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <div style={{ backgroundColor: '#161616', border: '1px solid #4a1515', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e05555', marginBottom: '10px' }}>⚠️ Po termínu ({overdueTasks.length})</div>
              {overdueTasks.map(t => (
                <div key={t.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1e1e1e' }}>
                  <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {t.assigned_to && <span>{t.assigned_to} · </span>}
                    <span style={{ color: '#e05555' }}>{new Date(t.due_date!).toLocaleDateString('cs-CZ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming events */}
          <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#f4978e', marginBottom: '10px' }}>Nadcházející akce</div>
            {upcomingEvents.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#4b5563' }}>Žádné plánované akce</div>
            ) : upcomingEvents.map(ev => (
              <div key={ev.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{ev.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  {ev.date_end
                    ? `${new Date(ev.date!).toLocaleDateString('cs-CZ')} – ${new Date(ev.date_end).toLocaleDateString('cs-CZ')}`
                    : ev.date && new Date(ev.date).toLocaleDateString('cs-CZ')}
                  {ev.location && <span> · {ev.location}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming tasks */}
          <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#f4978e', marginBottom: '10px' }}>Nadcházející úkoly</div>
            {upcomingTasks.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#4b5563' }}>Žádné blížící se termíny</div>
            ) : upcomingTasks.map(t => (
              <div key={t.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1e1e1e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[t.priority], flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', color: '#f1f5f9' }}>{t.title}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', paddingLeft: '12px' }}>
                  {t.assigned_to && <span>{t.assigned_to} · </span>}
                  {new Date(t.due_date!).toLocaleDateString('cs-CZ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
