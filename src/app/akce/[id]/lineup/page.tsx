'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LineupArtist } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createArtist, updateArtist, deleteArtist, toggleArtistPaid, updateEventStages } from '@/app/actions'

interface Props { params: Promise<{ id: string }> }
interface Contact { id: string; name: string; type: string; fee: number }

const emptyForm = { artist_name: '', fee: '', deposit: '', paid: false, date: '', set_time: '', stage: '', notes: '' }

const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' } as const
const labelStyle = { color: '#9ca3af', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

function getDays(start: string | null, end: string | null): string[] {
  if (!start) return []
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const last = end ? new Date(end + 'T12:00:00') : new Date(start + 'T12:00:00')
  while (d <= last) {
    days.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return days
}

function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

// Times 00:00–11:59 are treated as "after midnight" → sorted after 23:59
function partyMinutes(time: string | null | undefined): number {
  if (!time) return 9999
  const [h, m] = time.split(':').map(Number)
  const mins = h * 60 + (m || 0)
  return h < 12 ? mins + 1440 : mins
}

export default function LineupPage({ params }: Props) {
  const { id } = use(params)
  const [artists, setArtists] = useState<LineupArtist[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [eventDates, setEventDates] = useState<{ date: string | null; date_end: string | null }>({ date: null, date_end: null })
  const [newStage, setNewStage] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [activeDate, setActiveDate] = useState<string>('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    const [{ data: lineup }, { data: ctc }, { data: ev }] = await Promise.all([
      supabase.from('lineup').select('*').eq('event_id', id).order('set_time').order('artist_name'),
      supabase.from('contacts').select('id, name, type, fee').in('type', ['DJ', 'MC', 'Stage manager', 'Technik', 'Produkce', 'Bednák', 'Security']).order('name'),
      supabase.from('events').select('stages, date, date_end').eq('id', id).single(),
    ])
    setArtists(lineup || [])
    setContacts(ctc || [])
    setStages(ev?.stages || [])
    setEventDates({ date: ev?.date || null, date_end: ev?.date_end || null })
    setLoading(false)
  }

  async function addStage() {
    const name = newStage.trim()
    if (!name || stages.includes(name)) return
    const updated = [...stages, name]
    await updateEventStages(id, updated)
    setStages(updated)
    setNewStage('')
  }

  async function removeStage(name: string) {
    const updated = stages.filter(s => s !== name)
    await updateEventStages(id, updated)
    setStages(updated)
  }

  useEffect(() => { load() }, [id])

  function pickContact(contactId: string) {
    if (!contactId) return
    const c = contacts.find(c => c.id === contactId)
    if (!c) return
    setForm(f => ({ ...f, artist_name: c.name, fee: c.fee > 0 ? String(c.fee) : f.fee }))
  }

  function openForm(stageName: string, dateStr: string = '') {
    setForm({ ...emptyForm, stage: stageName, date: dateStr })
    setEditId(null)
    setActiveStage(stageName)
    setActiveDate(dateStr)
  }

  function startEdit(art: LineupArtist) {
    // Fix: if artist's stage is no longer in stages[], fall back to __unassigned__
    const stageKey = art.stage && stages.includes(art.stage) ? art.stage : '__unassigned__'
    setForm({ artist_name: art.artist_name, fee: art.fee.toString(), deposit: art.deposit.toString(), paid: art.paid, date: art.date || '', set_time: art.set_time || '', stage: art.stage || '', notes: art.notes || '' })
    setEditId(art.id)
    setActiveStage(stageKey)
    setActiveDate(art.date || '')
  }

  function closeForm() {
    setActiveStage(null)
    setActiveDate('')
    setEditId(null)
    setForm(emptyForm)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { event_id: id, artist_name: form.artist_name, fee: parseFloat(form.fee) || 0, deposit: parseFloat(form.deposit) || 0, paid: form.paid, date: form.date || null, set_time: form.set_time || null, stage: form.stage || null, notes: form.notes || null }
    const result = editId ? await updateArtist(editId, payload) : await createArtist(payload)
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load(); closeForm(); setSaving(false)
  }

  async function handleDelete(artId: string) {
    if (!confirm('Smazat tohoto artista?')) return
    await deleteArtist(artId); await load()
  }

  async function handleTogglePaid(art: LineupArtist) {
    await toggleArtistPaid(art.id, !art.paid); await load()
  }

  const eventDays = getDays(eventDates.date, eventDates.date_end)
  const multiDay = eventDays.length > 1

  const totalFees = artists.reduce((s, a) => s + a.fee, 0)
  const totalDeposits = artists.reduce((s, a) => s + a.deposit, 0)
  const unpaid = artists.filter((a) => !a.paid).length
  const unstagedArtists = artists.filter(a => !a.stage || !stages.includes(a.stage))

  function renderForm(stageName: string) {
    const dayLabel = multiDay && form.date ? fmtDay(form.date) : null
    const title = editId
      ? 'Upravit artista'
      : dayLabel ? `+ Přidat do ${stageName} · ${dayLabel}` : `+ Přidat do ${stageName}`

    return (
      <form onSubmit={handleSave} style={{ margin: '0 0 14px 0', padding: '18px 20px', borderRadius: '10px', backgroundColor: '#0f0f0f', border: '1px solid #e05555' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#f4978e' }}>{title}</span>
          <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        {!editId && contacts.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: '#0c0c0c', borderRadius: '8px', border: '1px solid #2d1515' }}>
            <label style={{ ...labelStyle, color: '#f4978e' }}>⚡ Vybrat z adresáře</label>
            <select defaultValue="" onChange={e => pickContact(e.target.value)} style={{ ...inputStyle, color: '#f1f5f9' }}>
              <option value="">— vybrat kontakt —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type}){c.fee > 0 ? ` — ${c.fee.toLocaleString('cs-CZ')} Kč` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Jméno / pseudonym *</label>
            <input required value={form.artist_name} onChange={e => setForm({ ...form, artist_name: e.target.value })} placeholder="např. Ripplednb" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Datum</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Set time</label>
            <input value={form.set_time} onChange={e => setForm({ ...form, set_time: e.target.value })} placeholder="22:00" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Honorář (Kč)</label>
            <input type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Záloha (Kč)</label>
            <input type="number" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#9ca3af' }}>
              <input type="checkbox" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} />
              Zaplaceno
            </label>
          </div>
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={labelStyle}>Poznámky</label>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Rider, technické požadavky, kontakt..." style={inputStyle} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={saving}
            style={{ padding: '8px 20px', backgroundColor: '#e05555', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
          <button type="button" onClick={closeForm}
            style={{ padding: '8px 20px', backgroundColor: '#1e1e1e', color: '#9ca3af', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
            Zrušit
          </button>
        </div>
      </form>
    )
  }

  function renderTable(list: LineupArtist[]) {
    if (list.length === 0) return (
      <div style={{ padding: '12px 0', fontSize: '13px', color: '#2d2d2d' }}>Zatím nikdo.</div>
    )
    const sorted = [...list].sort((a, b) =>
      partyMinutes(a.set_time) - partyMinutes(b.set_time) || a.artist_name.localeCompare(b.artist_name, 'cs')
    )
    return (
      <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #1e1e1e', marginBottom: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#111', borderBottom: '1px solid #1e1e1e' }}>
              {['Artist', 'Set Time', 'Honorář', 'Záloha', 'Zbývá', 'Zaplaceno', 'Poznámky', ''].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#4b5563' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(art => (
              <tr key={art.id} style={{ borderBottom: '1px solid #111' }}>
                <td style={{ padding: '11px 14px', fontWeight: '600', color: '#f1f5f9' }}>{art.artist_name}</td>
                <td style={{ padding: '11px 14px', color: '#9ca3af' }}>{art.set_time || '—'}</td>
                <td style={{ padding: '11px 14px', fontWeight: '600', color: '#f1f5f9' }}>{art.fee.toLocaleString('cs-CZ')} Kč</td>
                <td style={{ padding: '11px 14px', color: '#60a5fa' }}>{art.deposit > 0 ? art.deposit.toLocaleString('cs-CZ') + ' Kč' : '—'}</td>
                <td style={{ padding: '11px 14px', fontWeight: '600', color: art.fee - art.deposit > 0 ? '#f87171' : '#34d399' }}>
                  {(art.fee - art.deposit).toLocaleString('cs-CZ')} Kč
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <button onClick={() => handleTogglePaid(art)}
                    style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer',
                      backgroundColor: art.paid ? '#052e16' : '#2d0a0a', color: art.paid ? '#34d399' : '#f87171' }}>
                    {art.paid ? 'ANO' : 'NE'}
                  </button>
                </td>
                <td style={{ padding: '11px 14px', fontSize: '12px', color: '#6b7280', maxWidth: '180px' }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.notes || '—'}</span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => startEdit(art)} style={{ fontSize: '12px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer' }}>Upravit</button>
                    <button onClick={() => handleDelete(art.id)} style={{ fontSize: '12px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer' }}>Smazat</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderDaySection(stageName: string, dayStr: string) {
    const dayArtists = artists.filter(a => a.stage === stageName && a.date === dayStr)
    const isDayFormOpen = activeStage === stageName && activeDate === dayStr

    return (
      <div key={dayStr} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '24px', height: '1px', backgroundColor: '#2d2d2d' }} />
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>{fmtDay(dayStr)}</span>
            {dayArtists.length > 0 && <span style={{ fontSize: '11px', color: '#374151' }}>({dayArtists.length})</span>}
          </div>
          <button
            onClick={() => isDayFormOpen && !editId ? closeForm() : openForm(stageName, dayStr)}
            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer',
              backgroundColor: isDayFormOpen && !editId ? '#1a1a1a' : '#1a0a0a',
              color: isDayFormOpen && !editId ? '#4b5563' : '#f4978e' }}>
            {isDayFormOpen && !editId ? '× Zrušit' : '+ Přidat'}
          </button>
        </div>
        {isDayFormOpen && renderForm(stageName)}
        {renderTable(dayArtists)}
      </div>
    )
  }

  return (
    <EventLayout eventId={id}>
      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Artistů celkem', value: artists.length, color: '#a78bfa', suffix: '' },
            { label: 'Celkové honoráře', value: totalFees.toLocaleString('cs-CZ'), color: '#f87171', suffix: ' Kč' },
            { label: 'Zálohy', value: totalDeposits.toLocaleString('cs-CZ'), color: '#60a5fa', suffix: ' Kč' },
            { label: 'Nezaplacených', value: unpaid, color: '#fbbf24', suffix: '' },
          ].map((s) => (
            <div key={s.label} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#161616', border: '1px solid #2d1515' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: s.color }}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>
        <button onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }} disabled={refreshing}
          style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: '#1e1e2e', color: refreshing ? '#4b5563' : '#9ca3af', border: '1px solid #2a2a3e', cursor: 'pointer' }}>
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      {/* Správa stages */}
      <div style={{ marginBottom: '28px', padding: '14px 18px', borderRadius: '10px', backgroundColor: '#111118', border: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>Stages:</span>
        {stages.map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '5px', backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e', fontSize: '12px', color: '#a78bfa' }}>
            {s}
            <button onClick={() => removeStage(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
          </span>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <input
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStage())}
            placeholder="Přidat stage..."
            style={{ backgroundColor: '#0a0a0f', border: '1px solid #2a2a3e', color: '#f1f5f9', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', outline: 'none', width: '140px' }}
          />
          <button onClick={addStage} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: '#1a1a2e', color: '#a78bfa', border: '1px solid #2a2a3e', cursor: 'pointer' }}>
            + Přidat
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#6b7280' }}>Načítám...</div>
      ) : stages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', borderRadius: '12px', backgroundColor: '#161616', border: '1px solid #2d1515', color: '#6b7280' }}>
          Nejdřív přidej stages nahoře, pak sem přidávej artistry.
        </div>
      ) : (
        <div>
          {stages.map(stageName => {
            const stageArtists = artists.filter(a => a.stage === stageName)
            const isStageFormOpen = !multiDay && activeStage === stageName

            return (
              <div key={stageName} style={{ marginBottom: '36px' }}>
                {/* Stage header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#a78bfa' }}>{stageName}</h3>
                    <span style={{ fontSize: '12px', color: '#374151' }}>
                      {stageArtists.length} {stageArtists.length === 1 ? 'artist' : 'artistů'}
                    </span>
                  </div>
                  {!multiDay && (
                    <button
                      onClick={() => isStageFormOpen && !editId ? closeForm() : openForm(stageName)}
                      style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer',
                        backgroundColor: isStageFormOpen && !editId ? '#1e1e1e' : '#e05555',
                        color: isStageFormOpen && !editId ? '#6b7280' : '#fff' }}>
                      {isStageFormOpen && !editId ? '× Zrušit' : '+ Přidat artista'}
                    </button>
                  )}
                </div>

                {!multiDay ? (
                  <>
                    {isStageFormOpen && renderForm(stageName)}
                    {renderTable(stageArtists)}
                  </>
                ) : (
                  <div style={{ paddingLeft: '16px', borderLeft: '2px solid #1e1e1e' }}>
                    {eventDays.map(dayStr => renderDaySection(stageName, dayStr))}

                    {/* Artists with no date or date outside event range */}
                    {(() => {
                      const undated = stageArtists.filter(a => !a.date || !eventDays.includes(a.date))
                      if (undated.length === 0) return null
                      const isUndatedOpen = activeStage === stageName && (!activeDate || !eventDays.includes(activeDate))
                      return (
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <div style={{ width: '24px', height: '1px', backgroundColor: '#2d2d2d' }} />
                            <span style={{ fontSize: '13px', color: '#4b5563', fontWeight: '500' }}>Bez dne</span>
                            <span style={{ fontSize: '11px', color: '#374151' }}>({undated.length})</span>
                          </div>
                          {isUndatedOpen && renderForm(stageName)}
                          {renderTable(undated)}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}

          {/* Bez stage */}
          {unstagedArtists.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#4b5563' }}>Bez stage</h3>
                <span style={{ fontSize: '12px', color: '#374151' }}>{unstagedArtists.length} artistů</span>
              </div>
              {activeStage === '__unassigned__' && renderForm('Bez stage')}
              {renderTable(unstagedArtists)}
            </div>
          )}
        </div>
      )}
    </EventLayout>
  )
}
