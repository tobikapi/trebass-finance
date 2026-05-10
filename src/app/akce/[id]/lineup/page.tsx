'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import { LineupArtist } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { createArtist, updateArtist, deleteArtist, toggleArtistPaid, updateEventStages } from '@/app/actions'
import { useRealtime } from '@/lib/use-realtime'

interface Props { params: Promise<{ id: string }> }
interface Contact { id: string; name: string; type: string; fee: number }

const emptyForm = { artist_name: '', fee: '', deposit: '', paid: false, date: '', set_time: '', stage: '', notes: '' }

const inputStyle = { backgroundColor: '#0c0c0c', border: '1px solid #2d1515', color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' } as const
const labelStyle = { color: 'var(--text-secondary)', fontSize: '12px', display: 'block' as const, marginBottom: '4px' }

// Palette for stages — cycles if more than 7 stages
const STAGE_PALETTE = [
  { main: '#a78bfa', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.35)' },
  { main: '#60a5fa', bg: 'rgba(96,165,250,0.07)',  border: 'rgba(96,165,250,0.35)'  },
  { main: '#34d399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.35)'  },
  { main: '#fbbf24', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.35)'  },
  { main: '#f87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.35)' },
  { main: '#22d3ee', bg: 'rgba(34,211,238,0.07)',  border: 'rgba(34,211,238,0.35)'  },
  { main: '#fb923c', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.35)'  },
]

// Palette for days within a stage
const DAY_PALETTE = [
  { label: '#f4978e', line: 'rgba(244,151,142,0.5)' },
  { label: '#60a5fa', line: 'rgba(96,165,250,0.5)'  },
  { label: '#34d399', line: 'rgba(52,211,153,0.5)'  },
  { label: '#fbbf24', line: 'rgba(251,191,36,0.5)'  },
  { label: '#c084fc', line: 'rgba(192,132,252,0.5)' },
]

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
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [activeDate, setActiveDate] = useState<string>('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

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
    setCollapsedStages(prev => {
      const next = { ...prev }
      for (const s of ev?.stages || []) { if (!(s in next)) next[s] = true }
      return next
    })
    setLoading(false)
  }

  function stageColor(stageName: string) {
    const idx = stages.indexOf(stageName)
    return STAGE_PALETTE[idx >= 0 ? idx % STAGE_PALETTE.length : 0]
  }

  async function addStage() {
    const name = newStage.trim()
    if (!name || stages.includes(name)) return
    const updated = [...stages, name]
    await updateEventStages(id, updated)
    setStages(updated)
    setCollapsedStages(prev => ({ ...prev, [name]: true }))
    setNewStage('')
  }

  async function removeStage(name: string) {
    const updated = stages.filter(s => s !== name)
    await updateEventStages(id, updated)
    setStages(updated)
  }

  useEffect(() => { load() }, [id])
  const { live } = useRealtime(['lineup', 'events'], load, id)

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

  const filteredArtists = search.trim()
    ? artists.filter(a => a.artist_name.toLowerCase().includes(search.toLowerCase()) || (a.notes || '').toLowerCase().includes(search.toLowerCase()))
    : artists

  function renderForm(stageName: string) {
    const sc = stageColor(stageName)
    const dayLabel = multiDay && form.date ? fmtDay(form.date) : null
    const title = editId
      ? 'Upravit artista'
      : dayLabel ? `+ Přidat do ${stageName} · ${dayLabel}` : `+ Přidat do ${stageName}`

    return (
      <form onSubmit={handleSave} style={{ margin: '0 0 14px 0', padding: '18px 20px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: `1px solid ${sc.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: sc.main }}>{title}</span>
          <button type="button" onClick={closeForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        {!editId && contacts.length > 0 && (
          <div style={{ marginBottom: '14px', padding: '10px 12px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <label style={{ ...labelStyle, color: sc.main }}>⚡ Vybrat z adresáře</label>
            <select defaultValue="" onChange={e => pickContact(e.target.value)} style={{ ...inputStyle }}>
              <option value="">— vybrat kontakt —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type}){c.fee > 0 ? ` — ${c.fee.toLocaleString('cs-CZ')} Kč` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-grid-lineup">
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
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
            style={{ padding: '8px 20px', backgroundColor: sc.main, color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
          <button type="button" onClick={closeForm}
            style={{ padding: '8px 20px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', borderRadius: '8px', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
            Zrušit
          </button>
        </div>
      </form>
    )
  }

  function renderTable(list: LineupArtist[], sc: typeof STAGE_PALETTE[0]) {
    if (list.length === 0) return (
      <div style={{ padding: '12px 0', fontSize: '13px', color: 'var(--text-faint)' }}>Zatím nikdo.</div>
    )
    const sorted = [...list].sort((a, b) =>
      partyMinutes(a.set_time) - partyMinutes(b.set_time) || a.artist_name.localeCompare(b.artist_name, 'cs')
    )
    return (
      <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${sc.border}`, marginBottom: '4px' }}>
        <div className="lineup-header" style={{ backgroundColor: sc.bg }}>
          {(['Artist', 'Set Time', 'Honorář', 'Záloha', 'Zbývá', 'Paid', 'Poznámky', ''] as const).map((h, i) => (
            <div key={h + i} style={{ fontSize: '11px', fontWeight: '600', color: sc.main, textAlign: i >= 2 && i <= 4 ? 'right' : 'left', opacity: 0.9 }}>{h}</div>
          ))}
        </div>
        {sorted.map(art => (
          <div key={art.id} className="lineup-row" style={{ borderLeft: `3px solid ${sc.border}` }}>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{art.artist_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{art.set_time || '—'}</div>
            <div style={{ textAlign: 'right', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{art.fee.toLocaleString('cs-CZ')} Kč</div>
            <div style={{ textAlign: 'right', color: art.deposit > 0 ? '#60a5fa' : 'var(--text-faint)', fontSize: '13px' }}>
              {art.deposit > 0 ? `${art.deposit.toLocaleString('cs-CZ')} Kč` : '—'}
            </div>
            <div style={{ textAlign: 'right', fontWeight: '500', fontSize: '13px', color: art.paid || art.fee - art.deposit <= 0 ? '#34d399' : '#f87171' }}>
              {art.paid ? '0 Kč' : `${(art.fee - art.deposit).toLocaleString('cs-CZ')} Kč`}
            </div>
            <div>
              <button onClick={() => handleTogglePaid(art)} style={{
                backgroundColor: art.paid ? '#052e16' : 'var(--bg-badge)',
                color: art.paid ? '#34d399' : '#f87171',
                fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              }}>
                {art.paid ? 'ANO' : 'NE'}
              </button>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {art.notes || '—'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => startEdit(art)} style={{ fontSize: '12px', color: sc.main, background: 'none', border: 'none', cursor: 'pointer' }}>Upravit</button>
              <button onClick={() => handleDelete(art.id)} style={{ fontSize: '12px', color: '#e05555', background: 'none', border: 'none', cursor: 'pointer' }}>Smazat</button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderDaySection(stageName: string, dayStr: string, dayIdx: number, sc: typeof STAGE_PALETTE[0]) {
    const dc = DAY_PALETTE[dayIdx % DAY_PALETTE.length]
    const dayArtists = filteredArtists.filter(a => a.stage === stageName && a.date === dayStr)
    const isDayFormOpen = activeStage === stageName && activeDate === dayStr
    const dayTotal = dayArtists.reduce((s, a) => s + a.fee, 0)
    const dayUnpaid = dayArtists.filter(a => !a.paid).reduce((s, a) => s + (a.fee - a.deposit), 0)

    return (
      <div key={dayStr} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '2px', backgroundColor: dc.line, borderRadius: '1px' }} />
            <span style={{ fontSize: '13px', color: dc.label, fontWeight: '600', letterSpacing: '0.03em' }}>{fmtDay(dayStr)}</span>
            {dayArtists.length > 0 && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>({dayArtists.length})</span>}
          </div>
          <button
            onClick={() => isDayFormOpen && !editId ? closeForm() : openForm(stageName, dayStr)}
            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: `1px solid ${isDayFormOpen && !editId ? 'var(--border)' : dc.line}`, cursor: 'pointer',
              backgroundColor: isDayFormOpen && !editId ? 'var(--bg-card-dark)' : 'transparent',
              color: isDayFormOpen && !editId ? 'var(--text-dim)' : dc.label }}>
            {isDayFormOpen && !editId ? '× Zrušit' : '+ Přidat'}
          </button>
        </div>
        {isDayFormOpen && renderForm(stageName)}
        {renderTable(dayArtists, sc)}
        {dayArtists.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', padding: '5px 14px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Celkem den: <strong style={{ color: dc.label }}>{dayTotal.toLocaleString('cs-CZ')} Kč</strong></span>
            {dayUnpaid > 0 && <span style={{ color: 'var(--text-dim)' }}>Zbývá zaplatit: <strong style={{ color: '#f87171' }}>{dayUnpaid.toLocaleString('cs-CZ')} Kč</strong></span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <EventLayout eventId={id}>
      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Artistů celkem', value: artists.length, color: '#a78bfa', suffix: '' },
            { label: 'Celkové honoráře', value: totalFees.toLocaleString('cs-CZ'), color: '#f87171', suffix: ' Kč' },
            { label: 'Zálohy', value: totalDeposits.toLocaleString('cs-CZ'), color: '#60a5fa', suffix: ' Kč' },
            { label: 'Nezaplacených', value: unpaid, color: '#fbbf24', suffix: '' },
          ].map((s) => (
            <div key={s.label} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: s.color }}>{s.value}{s.suffix}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCollapsedStages(Object.fromEntries(stages.map(s => [s, false])))}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Rozbalit vše
          </button>
          <button onClick={() => setCollapsedStages(Object.fromEntries(stages.map(s => [s, true])))}
            style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Zabalit vše
          </button>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hledat artista..."
            style={{ backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', outline: 'none', width: '160px' }}
          />
          <button onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }} disabled={refreshing}
            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--bg-badge)', color: refreshing ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: live ? '#34d399' : 'var(--text-faint)', flexShrink: 0 }} />
            {refreshing ? '...' : '↻'}
          </button>
        </div>
      </div>

      {/* Správa stages */}
      <div style={{ marginBottom: '28px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Stages:</span>
        {stages.map((s, idx) => {
          const sc = STAGE_PALETTE[idx % STAGE_PALETTE.length]
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '5px', backgroundColor: sc.bg, border: `1px solid ${sc.border}`, fontSize: '12px', color: sc.main, fontWeight: '600' }}>
              {s}
              <button onClick={() => removeStage(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sc.main, fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.6 }}>×</button>
            </span>
          )
        })}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <input
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStage())}
            placeholder="Přidat stage..."
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', outline: 'none', width: '140px' }}
          />
          <button onClick={addStage} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            + Přidat
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>Načítám...</div>
      ) : stages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Nejdřív přidej stages nahoře, pak sem přidávej artistry.
        </div>
      ) : (
        <div>
          {stages.map((stageName, stageIdx) => {
            const sc = STAGE_PALETTE[stageIdx % STAGE_PALETTE.length]
            const stageArtists = filteredArtists.filter(a => a.stage === stageName)
            const isStageFormOpen = !multiDay && activeStage === stageName
            const stageTotal = stageArtists.reduce((s, a) => s + a.fee, 0)
            const stageUnpaid = stageArtists.filter(a => !a.paid).reduce((s, a) => s + (a.fee - a.deposit), 0)
            const isCollapsed = !!collapsedStages[stageName]

            return (
              <div key={stageName} style={{ marginBottom: '36px' }}>
                {/* Stage header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: isCollapsed ? 0 : '14px', padding: '12px 16px',
                  borderRadius: '10px', backgroundColor: sc.bg,
                  border: `1px solid ${sc.border}`,
                  borderLeft: `4px solid ${sc.main}`,
                }}>
                  <div
                    onClick={() => setCollapsedStages(prev => ({ ...prev, [stageName]: !prev[stageName] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                  >
                    <span style={{ fontSize: '11px', color: sc.main, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▼</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: sc.main }}>{stageName}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
                      {stageArtists.length} {stageArtists.length === 1 ? 'artist' : 'artistů'}
                    </span>
                    {isCollapsed && stageTotal > 0 && (
                      <span style={{ fontSize: '13px', fontWeight: '700', color: sc.main, marginLeft: '4px' }}>{stageTotal.toLocaleString('cs-CZ')} Kč</span>
                    )}
                  </div>
                  {!multiDay && !isCollapsed && (
                    <button
                      onClick={() => isStageFormOpen && !editId ? closeForm() : openForm(stageName)}
                      style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: `1px solid ${sc.border}`, cursor: 'pointer',
                        backgroundColor: isStageFormOpen && !editId ? 'var(--bg-card-dark)' : sc.main,
                        color: isStageFormOpen && !editId ? 'var(--text-muted)' : '#fff' }}>
                      {isStageFormOpen && !editId ? '× Zrušit' : '+ Přidat artista'}
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="collapse-content" style={{ marginTop: '14px' }}>
                    {!multiDay ? (
                      <>
                        {isStageFormOpen && renderForm(stageName)}
                        {renderTable(stageArtists, sc)}
                      </>
                    ) : (
                      <div style={{ paddingLeft: '16px', borderLeft: `2px solid ${sc.border}` }}>
                        {eventDays.map((dayStr, dayIdx) => renderDaySection(stageName, dayStr, dayIdx, sc))}

                        {(() => {
                          const undated = stageArtists.filter(a => !a.date || !eventDays.includes(a.date))
                          if (undated.length === 0) return null
                          const isUndatedOpen = activeStage === stageName && (!activeDate || !eventDays.includes(activeDate))
                          return (
                            <div style={{ marginBottom: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div style={{ width: '28px', height: '2px', backgroundColor: 'var(--border-subtle)', borderRadius: '1px' }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-dim)', fontWeight: '500' }}>Bez dne</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>({undated.length})</span>
                              </div>
                              {isUndatedOpen && renderForm(stageName)}
                              {renderTable(undated, sc)}
                            </div>
                          )
                        })()}
                      </div>
                    )}

                    {stageArtists.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', padding: '8px 14px', borderRadius: '8px', backgroundColor: sc.bg, border: `1px solid ${sc.border}`, marginTop: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Celkem stage: <strong style={{ color: sc.main }}>{stageTotal.toLocaleString('cs-CZ')} Kč</strong></span>
                        {stageUnpaid > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Zbývá zaplatit: <strong style={{ color: '#f87171' }}>{stageUnpaid.toLocaleString('cs-CZ')} Kč</strong></span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Bez stage */}
          {unstagedArtists.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-dim)' }}>Bez stage</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{unstagedArtists.length} artistů</span>
              </div>
              {activeStage === '__unassigned__' && renderForm('Bez stage')}
              {renderTable(unstagedArtists, { main: 'var(--text-dim)', bg: 'var(--bg-card-alt)', border: 'var(--border-subtle)' } as typeof STAGE_PALETTE[0])}
            </div>
          )}
        </div>
      )}
    </EventLayout>
  )
}
