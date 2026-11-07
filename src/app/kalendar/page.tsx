'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@/lib/user-context'

interface CalEvent { id: string; name: string; date: string | null; date_end: string | null; location: string | null; status: string }
interface Task { id: string; title: string; assigned_to: string | null; assigned_to_members: string[] | null; status: string; priority: string; due_date: string | null }

const PRIORITY_COLOR: Record<string, string> = { low: '#8b93a3', medium: '#e3b341', high: '#d15c49' }
const EVENT_COLOR = 'var(--accent)'
const fmtD = (iso: string) => { const [y, m, d] = iso.split('-'); return `${Number(d)}. ${Number(m)}. ${y}` }
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
  const { orgId } = useUser()
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
        supabase.from('events').select('id, name, date, date_end, location, status').eq('org_id', orgId ?? '').not('date', 'is', null),
        supabase.from('tasks').select('id, title, assigned_to, assigned_to_members, status, priority, due_date').eq('org_id', orgId ?? '').not('due_date', 'is', null),
      ])
      setEvents(e || [])
      setTasks(t || [])
      setLoading(false)
    }
    load()
  }, [orgId])

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
      <div className="kalendar-page-title" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '24px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Kalendář <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
          </h1>
          <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: 0 }}>Přehled akcí a termínů úkolů</p>
        </div>
        {overdueTasks.length > 0 && (
          <a href="#po-terminu" className="num" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '34px', padding: '0 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, color: '#d15c49', border: '1px solid rgba(209,92,73,0.55)', backgroundColor: 'rgba(209,92,73,0.10)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d15c49' }} />{overdueTasks.length} po termínu
          </a>
        )}
      </div>

      <div className="kalendar-grid">
        {/* Hlavní kalendář */}
        <div className="kalendar-card" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px' }}>
          {/* Navigace měsíce */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={prevMonth} aria-label="Předchozí měsíc" style={{ width: '44px', height: '44px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', fontSize: '20px' }}>‹</button>
              <button onClick={nextMonth} aria-label="Další měsíc" style={{ width: '44px', height: '44px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer', fontSize: '20px' }}>›</button>
            </div>
            <span className="kalendar-month-title" style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>{MONTHS[month]} {year}</span>
            <button
              onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(null) }}
              style={{
                minHeight: '40px', padding: '0 14px',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '700',
                opacity: isCurrentMonth ? 1 : 0.85,
              }}
            >
              Dnes
            </button>
          </div>

          {/* Záhlaví dnů */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
            ))}
          </div>

          {/* Buňky */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Načítám...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="kalendar-cell" />
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
                    className={`kalendar-cell${tod ? ' is-today' : ''}${isSel ? ' is-sel' : ''}`}
                    style={{
                      padding: '5px 4px', borderRadius: '10px',
                      backgroundColor: isSel ? 'rgba(209,92,73,0.18)' : tod ? 'var(--accent-soft)' : 'var(--bg-card-alt)',
                      border: `1px solid ${isSel ? '#d15c49' : tod ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      cursor: hasContent ? 'pointer' : 'default',
                      overflow: 'hidden', display: 'flex', flexDirection: 'column',
                      transition: 'border-color 0.12s, background-color 0.12s',
                    }}
                  >
                    <div className="kal-day num" style={{
                      fontSize: '13px', fontWeight: tod || isSel ? '700' : '500',
                      color: isSel ? '#f0a597' : tod ? 'var(--accent)' : 'var(--text-secondary)',
                      marginBottom: '4px', flexShrink: 0,
                    }}>{day}</div>
                    <div className="kal-dots" style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', flex: 1, alignContent: 'flex-start', overflow: 'hidden' }}>
                      {dayEvents.map(ev => (
                        <div key={ev.id} title={ev.name} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: EVENT_COLOR, flexShrink: 0 }} />
                      ))}
                      {dayTasks.map(task => (
                        <div key={task.id} title={task.title} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[task.priority] || '#8b93a3', flexShrink: 0 }} />
                      ))}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="kal-label" style={{ fontSize: '9px', color: 'var(--text-secondary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}>
                        {dayEvents[0].name}{total > 1 ? ` +${total - 1}` : ''}
                      </div>
                    )}
                    {dayEvents.length === 0 && dayTasks.length > 0 && (
                      <div className="kal-label" style={{ fontSize: '9px', color: 'var(--text-dim)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0 }}>
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
            <div className="collapse-content" style={{ marginTop: '12px', padding: '16px 20px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', borderRadius: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#d15c49', marginBottom: '14px' }}>
                {selectedDay}. {MONTHS_GEN[month]} {year}
              </div>
              {selEvents.length > 0 && (
                <div style={{ marginBottom: selTasks.length > 0 ? '14px' : 0 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '8px' }}>AKCE</div>
                  {selEvents.map(ev => (
                    <div key={ev.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#d15c49', flexShrink: 0, marginTop: '3px' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{ev.name}</div>
                        {ev.location && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>📍 {ev.location}</div>}
                        {ev.date_end && ev.date !== ev.date_end && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
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
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '700', letterSpacing: '0.1em', marginBottom: '8px' }}>ÚKOLY</div>
                  {selTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[task.priority], flexShrink: 0, marginTop: '3px' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{task.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px' }}>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            {[{ c: EVENT_COLOR, l: 'Akce' }, { c: PRIORITY_COLOR.high, l: 'Úkol vysoký' }, { c: PRIORITY_COLOR.medium, l: 'Úkol střední' }, { c: PRIORITY_COLOR.low, l: 'Úkol nízký' }].map(x => (
              <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: x.c, display: 'inline-block' }} />{x.l}
              </div>
            ))}
          </div>
        </div>

        {/* Postranní panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {overdueTasks.length > 0 && (
            <section id="po-terminu" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(209,92,73,0.45)', borderRadius: '16px', overflow: 'hidden', scrollMarginTop: '120px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: 'rgba(209,92,73,0.12)', borderBottom: '1px solid rgba(209,92,73,0.35)' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: '#d15c49' }}>⚠ PO TERMÍNU</span>
                <span className="num" style={{ fontSize: '12px', fontWeight: 700, color: '#d15c49', border: '1px solid rgba(209,92,73,0.55)', borderRadius: '999px', padding: '1px 9px' }}>{overdueTasks.length}</span>
              </div>
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {overdueTasks.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '8px 16px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#d15c49', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    <span className="num" style={{ fontSize: '13px', color: '#d15c49', flexShrink: 0 }}>{fmtD(t.due_date!)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--accent)' }}>NADCHÁZEJÍCÍ AKCE</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{upcomingEvents.length} {upcomingEvents.length === 1 ? 'akce' : upcomingEvents.length < 5 ? 'akce' : 'akcí'}</span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Žádné plánované akce</div>
            ) : upcomingEvents.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', marginBottom: '8px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                  {ev.location && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.location}</div>}
                </div>
                <span className="num" style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)', backgroundColor: 'var(--accent-soft)', borderRadius: '8px', padding: '5px 10px' }}>
                  {fmtD(ev.date!)}{ev.date_end && ev.date_end !== ev.date ? ` – ${fmtD(ev.date_end)}` : ''}
                </span>
              </div>
            ))}
          </section>

          <section style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>NADCHÁZEJÍCÍ ÚKOLY</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{upcomingTasks.length} {upcomingTasks.length === 1 ? 'úkol' : upcomingTasks.length < 5 ? 'úkoly' : 'úkolů'}</span>
            </div>
            {upcomingTasks.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Žádné blížící se termíny</div>
            ) : upcomingTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '8px 14px', marginBottom: '8px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  {memberLabel(t) && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{memberLabel(t)}</div>}
                </div>
                <span className="num" style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{fmtD(t.due_date!)}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
