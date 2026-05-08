'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface CalEvent { id: string; name: string; date: string | null; date_end: string | null; location: string | null; status: string }
interface Task { id: string; title: string; assigned_to: string | null; assigned_to_members: string[] | null; status: string; priority: string; due_date: string | null }

const PRIORITY_COLOR: Record<string, string> = { low: '#6b7280', medium: '#f4978e', high: '#e05555' }
const STATUS_COLOR: Record<string, string> = { todo: '#9ca3af', in_progress: '#f4978e', done: '#34d399' }
const STATUS_LABEL: Record<string, string> = { todo: 'Čeká', in_progress: 'Probíhá', done: 'Hotovo' }

const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const MONTHS_GEN = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince']
const DAYS = ['Po','Út','St','Čt','Pá','So','Ne']

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function KalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const today = new Date()
  const todayNorm = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => {
    async function load() {
      const [{ data: e }, { data: t }] = await Promise.all([
        supabase.from('events').select('id, name, date, date_end, location, status').not('date', 'is', null),
        supabase.from('tasks').select('id, title, assigned_to, assigned_to_members, status, priority, due_date').not('due_date', 'is', null),
      ])
      setEvents(e || [])
      setTasks(t || [])
      setLoading(false)
    }
    load()
  }, [])

  function prevMonth() { setSelectedDay(null); if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { setSelectedDay(null); if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function getEventsForDay(day: number) {
    const cellDate = new Date(year, month, day)
    return events.filter(e => {
      if (!e.date) return false
      const start = parseLocal(e.date)
      const end = e.date_end ? parseLocal(e.date_end) : start
      return cellDate >= start && cellDate <= end
    })
  }

  function getTasksForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return tasks.filter(t => t.due_date && t.due_date.startsWith(dateStr))
  }

  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const upcomingEvents = events
    .filter(e => e.date && parseLocal(e.date) >= todayNorm)
    .sort((a, b) => parseLocal(a.date!).getTime() - parseLocal(b.date!).getTime())
    .slice(0, 5)

  const upcomingTasks = tasks
    .filter(t => t.due_date && t.status !== 'done' && parseLocal(t.due_date) >= todayNorm)
    .sort((a, b) => parseLocal(a.due_date!).getTime() - parseLocal(b.due_date!).getTime())
    .slice(0, 5)

  const overdueTasks = tasks.filter(t => t.due_date && t.status !== 'done' && parseLocal(t.due_date) < todayNorm)

  const selEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const selTasks = selectedDay ? getTasksForDay(selectedDay) : []

  function memberLabel(t: Task) {
    if (t.assigned_to_members && t.assigned_to_members.length > 0) return t.assigned_to_members.join(', ')
    return t.assigned_to || ''
  }

  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>Kalendář</h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: '#6b7280', marginBottom: 0 }}>Přehled akcí a termínů úkolů</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '24px', alignItems: 'start' }}>
        {/* Hlavní kalendář */}
        <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '24px' }}>
          {/* Navigace měsíce */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={prevMonth} style={{ padding: '6px 14px', backgroundColor: '#1e1e1e', color: '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>‹</button>
              <button onClick={nextMonth} style={{ padding: '6px 14px', backgroundColor: '#1e1e1e', color: '#9ca3af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}>›</button>
            </div>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#f1f5f9' }}>{MONTHS[month]} {year}</span>
            <button
              onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(null) }}
              style={{
                padding: '6px 14px',
                backgroundColor: isCurrentMonth ? '#2d1515' : '#1e1e1e',
                color: isCurrentMonth ? '#f4978e' : '#9ca3af',
                border: `1px solid ${isCurrentMonth ? '#e05555' : 'transparent'}`,
                borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
              }}
            >
              Dnes
            </button>
          </div>

          {/* Záhlaví dnů */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#4b5563', fontWeight: '600', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Buňky */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Načítám...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ height: '72px' }} />
                const dayEvents = getEventsForDay(day)
                const dayTasks = getTasksForDay(day)
                const tod = isToday(day)
                const isSel = selectedDay === day
                const hasContent = dayEvents.length > 0 || dayTasks.length > 0
                const total = dayEvents.length + dayTasks.length
                return (
                  <div
                    key={i}
                    onClick={() => hasContent && setSelectedDay(isSel ? null : day)}
                    style={{
                      height: '72px', padding: '6px 5px', borderRadius: '6px',
                      backgroundColor: isSel ? '#200e0e' : tod ? '#170c0c' : '#0c0c0c',
                      border: `1px solid ${isSel ? '#e05555' : tod ? '#4a1515' : '#1a1a1a'}`,
                      cursor: hasContent ? 'pointer' : 'default',
                      overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      transition: 'border-color 0.12s, background-color 0.12s',
                    }}
                  >
                    <div style={{
                      fontSize: '12px', fontWeight: tod ? '700' : '400',
                      color: tod ? '#f4978e' : '#6b7280',
                      marginBottom: '4px', flexShrink: 0,
                    }}>{day}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', flex: 1, alignContent: 'flex-start', overflow: 'hidden' }}>
                      {dayEvents.map(ev => (
                        <div key={ev.id} title={ev.name} style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#e05555', flexShrink: 0 }} />
                      ))}
                      {dayTasks.map(task => (
                        <div key={task.id} title={task.title} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[task.priority] || '#6b7280', flexShrink: 0 }} />
                      ))}
                    </div>
                    {dayEvents.length > 0 && (
                      <div style={{ fontSize: '9px', color: isSel ? '#f4978e' : '#a05555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}>
                        {dayEvents[0].name}{total > 1 ? ` +${total - 1}` : ''}
                      </div>
                    )}
                    {dayEvents.length === 0 && dayTasks.length > 0 && (
                      <div style={{ fontSize: '9px', color: '#4b5563', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}>
                        {dayTasks.length} úkol{dayTasks.length > 1 ? 'y' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Detail vybraného dne */}
          {selectedDay && (selEvents.length > 0 || selTasks.length > 0) && (
            <div className="collapse-content" style={{ marginTop: '12px', padding: '16px 20px', backgroundColor: '#0e0808', border: '1px solid #4a1515', borderRadius: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#f4978e', marginBottom: '14px' }}>
                {selectedDay}. {MONTHS_GEN[month]} {year}
              </div>
              {selEvents.length > 0 && (
                <div style={{ marginBottom: selTasks.length > 0 ? '14px' : 0 }}>
                  <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '8px' }}>AKCE</div>
                  {selEvents.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#e05555', flexShrink: 0, marginTop: '3px' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: '500' }}>{ev.name}</div>
                        {ev.location && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>📍 {ev.location}</div>}
                        {ev.date_end && ev.date !== ev.date_end && (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                            {parseLocal(ev.date!).toLocaleDateString('cs-CZ')} – {parseLocal(ev.date_end).toLocaleDateString('cs-CZ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {selTasks.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: '#4b5563', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '8px' }}>ÚKOLY</div>
                  {selTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[task.priority], flexShrink: 0, marginTop: '3px' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: '500' }}>{task.title}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'flex', gap: '6px' }}>
                          {memberLabel(task) && <span>{memberLabel(task)}</span>}
                          <span style={{ color: STATUS_COLOR[task.status] }}>{STATUS_LABEL[task.status] || task.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legenda */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#e05555', display: 'inline-block' }} />
              Akce
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f4978e', display: 'inline-block' }} />
              Úkol střední
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#e05555', display: 'inline-block' }} />
              Úkol vysoký
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6b7280' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6b7280', display: 'inline-block' }} />
              Úkol nízký
            </div>
          </div>
        </div>

        {/* Postranní panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {overdueTasks.length > 0 && (
            <div style={{ backgroundColor: '#161616', border: '1px solid #4a1515', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#e05555', marginBottom: '10px' }}>⚠️ Po termínu ({overdueTasks.length})</div>
              {overdueTasks.map(t => (
                <div key={t.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1e1e1e' }}>
                  <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{t.title}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {memberLabel(t) && <span>{memberLabel(t)} · </span>}
                    <span style={{ color: '#e05555' }}>{parseLocal(t.due_date!).toLocaleDateString('cs-CZ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ backgroundColor: '#161616', border: '1px solid #2d1515', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#f4978e', marginBottom: '10px' }}>Nadcházející akce</div>
            {upcomingEvents.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#4b5563' }}>Žádné plánované akce</div>
            ) : upcomingEvents.map(ev => (
              <div key={ev.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{ev.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  {ev.date_end
                    ? `${parseLocal(ev.date!).toLocaleDateString('cs-CZ')} – ${parseLocal(ev.date_end).toLocaleDateString('cs-CZ')}`
                    : parseLocal(ev.date!).toLocaleDateString('cs-CZ')}
                  {ev.location && <span> · {ev.location}</span>}
                </div>
              </div>
            ))}
          </div>

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
                  {memberLabel(t) && <span>{memberLabel(t)} · </span>}
                  {parseLocal(t.due_date!).toLocaleDateString('cs-CZ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
