'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { EventEquipment, EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_COLORS, EquipmentCategory } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { callAction } from '@/lib/call-action'
import { useRealtime } from '@/lib/use-realtime'
import { supabase } from '@/lib/supabase'
import { useUndo } from '@/lib/undo-context'

interface Props {
  id: string
  initialEquipment: EventEquipment[]
  initialLocations: string[]
}

const NO_CATEGORY = '__no_category__'
const NO_LOCATION = '__no_location__'

const LOCATION_COLORS = [
  { color: '#38bdf8', bg: '#0a1e2e', border: '#0a3e5c' },
  { color: '#f472b6', bg: '#2d0a1e', border: '#5c0a3e' },
  { color: '#fbbf24', bg: '#2d2005', border: '#5c4000' },
  { color: '#4ade80', bg: '#052e16', border: '#14532d' },
  { color: '#a78bfa', bg: '#1a1035', border: '#3d2d6b' },
  { color: '#fb923c', bg: '#2d1505', border: '#5c2d00' },
  { color: '#22d3ee', bg: '#052a2e', border: '#0a4a52' },
  { color: '#f87171', bg: '#2d0a0a', border: '#5c1414' },
]
function locationColor(index: number) {
  return LOCATION_COLORS[index % LOCATION_COLORS.length]
}

function fmtKw(n: number) {
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} kW`
}

const emptyExtraForm = { name: '', quantity: '1', power_kw: '', category: '', location: '', note: '' }

const inputStyle: CSSProperties = {
  backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px',
  outline: 'none', fontSize: '13px', width: '100%',
}
const labelStyle: CSSProperties = {
  color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px',
}

export default function ElektrinaClient({ id, initialEquipment, initialLocations }: Props) {
  const { pushUndo } = useUndo()
  const [equipment, setEquipment] = useState<EventEquipment[]>(initialEquipment)
  const [locations, setLocations] = useState<string[]>(initialLocations)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [byCategory, setByCategory] = useState(true)
  const [byLocation, setByLocation] = useState(false)
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [editExtraId, setEditExtraId] = useState<string | null>(null)
  const [extraForm, setExtraForm] = useState(emptyExtraForm)
  const [savingExtra, setSavingExtra] = useState(false)

  const loadingRef = useRef(false)
  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const [{ data }, { data: ev }] = await Promise.all([
        supabase.from('event_equipment').select('*').eq('event_id', id).order('created_at'),
        supabase.from('events').select('equipment_locations').eq('id', id).single(),
      ])
      setEquipment(data || [])
      setLocations(ev?.equipment_locations || [])
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => { load() }, [id])

  const { live } = useRealtime(['event_equipment'], load, id)

  const itemTotalKw = (e: EventEquipment) => (e.power_kw || 0) * e.quantity
  const totalKw = equipment.reduce((s, e) => s + itemTotalKw(e), 0)
  const itemsWithPower = equipment.filter(e => e.power_kw > 0).length

  function openAddExtra() {
    setExtraForm(emptyExtraForm)
    setEditExtraId(null)
    setShowExtraForm(true)
  }

  function startEditExtra(eq: EventEquipment) {
    setExtraForm({
      name: eq.name, quantity: eq.quantity.toString(), power_kw: eq.power_kw ? eq.power_kw.toString() : '',
      category: eq.category || '', location: eq.location || '', note: eq.note || '',
    })
    setEditExtraId(eq.id)
    setShowExtraForm(true)
  }

  async function handleSaveExtra(e: React.FormEvent) {
    e.preventDefault()
    setSavingExtra(true)
    const base = {
      name: extraForm.name,
      note: extraForm.note || null,
      quantity: parseFloat(extraForm.quantity) || 1,
      unit_price: 0,
      total_price: 0,
      expense_id: null,
      category: extraForm.category || null,
      location: extraForm.location || null,
      power_kw: parseFloat(extraForm.power_kw) || 0,
    }
    const prev = editExtraId ? equipment.find(x => x.id === editExtraId) : null
    const result = editExtraId
      ? await callAction('updateEquipment', editExtraId, base)
      : await callAction('createEquipment', { event_id: id, ...base, elektrina_extra: true })
    if (result.error) { alert('Chyba: ' + result.error); setSavingExtra(false); return }
    if (editExtraId && prev) {
      const prevPayload = { name: prev.name, note: prev.note, quantity: prev.quantity, unit_price: 0, total_price: 0, expense_id: null, category: prev.category, location: prev.location, power_kw: prev.power_kw }
      pushUndo(`úprava „${prev.name}“`, async () => {
        const res = await callAction('updateEquipment', editExtraId, prevPayload)
        if (res.error) throw new Error(res.error)
        await load()
      })
    } else if (!editExtraId && result.data) {
      const newId = (result.data as EventEquipment).id
      pushUndo(`přidání „${base.name}“`, async () => {
        const res = await callAction('deleteEquipment', newId)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
    await load()
    setExtraForm(emptyExtraForm); setShowExtraForm(false); setEditExtraId(null); setSavingExtra(false)
  }

  async function handleDeleteExtra(eqId: string) {
    if (!confirm('Smazat tuto položku?')) return
    const row = equipment.find(e => e.id === eqId)
    await callAction('deleteEquipment', eqId); await load()
    if (row) {
      pushUndo(`smazání „${row.name}“`, async () => {
        const res = await callAction('restoreRow', 'event_equipment', row)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
  }

  type Color = { color: string; bg: string; border: string }
  type Group = { key: string; label: string; color: Color | null; items?: EventEquipment[]; children?: Group[] }

  function categoryGroups(items: EventEquipment[]): Group[] {
    return [
      ...EQUIPMENT_CATEGORIES.map(cat => ({ key: cat, label: cat, color: EQUIPMENT_CATEGORY_COLORS[cat as EquipmentCategory], items: items.filter(e => e.category === cat) })),
      { key: NO_CATEGORY, label: 'Bez kategorie', color: null, items: items.filter(e => !e.category) },
    ].filter(g => g.items.length > 0)
  }
  function locGroups(items: EventEquipment[]): Group[] {
    return [
      ...locations.map((loc, i) => ({ key: loc, label: loc, color: locationColor(i), items: items.filter(e => e.location === loc) })),
      { key: NO_LOCATION, label: 'Bez místa', color: null, items: items.filter(e => !e.location || !locations.includes(e.location)) },
    ].filter(g => g.items.length > 0)
  }
  function groupItems(g: Group): EventEquipment[] {
    return g.items ?? (g.children ?? []).flatMap(c => c.items ?? [])
  }

  const groups: Group[] = byCategory && byLocation
    ? categoryGroups(equipment)
        .map(g => ({ key: g.key, label: g.label, color: g.color, children: locGroups(g.items!) }))
        .filter(g => g.children.length > 0)
    : byLocation
      ? locGroups(equipment)
      : byCategory
        ? categoryGroups(equipment)
        : [{ key: 'all', label: 'Vše', color: null, items: equipment }]

  const rowGrid = '1fr 80px 110px 110px 110px'

  function renderItemRows(items: EventEquipment[]) {
    return items.map((eq, i) => (
      <div key={eq.id} style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '8px 16px', alignItems: 'center', borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{eq.name}</span>
          {eq.elektrina_extra && (
            <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f4978e', backgroundColor: '#2d1515', padding: '1px 6px', borderRadius: '4px', border: '1px solid #5c2d2d' }}>
              mimo techniku
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{eq.quantity}</div>
        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{eq.power_kw > 0 ? `${eq.power_kw} kW` : '—'}</div>
        <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', color: eq.power_kw > 0 ? 'var(--text-primary)' : 'var(--text-faint)' }}>{eq.power_kw > 0 ? fmtKw(itemTotalKw(eq)) : '—'}</div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {eq.elektrina_extra && (
            <>
              <button onClick={() => startEditExtra(eq)} style={{ fontSize: '12px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
              <button onClick={() => handleDeleteExtra(eq.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
            </>
          )}
        </div>
      </div>
    ))
  }

  return (
    <EventLayout eventId={id}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Celkový odběr</div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#fbbf24' }}>⚡ {fmtKw(totalKw)}</div>
          </div>
          <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Položek s odběrem</div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#38bdf8' }}>{itemsWithPower} / {equipment.length}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }} disabled={refreshing}
            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--bg-card)', color: refreshing ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: live ? '#34d399' : 'var(--text-faint)', display: 'inline-block' }} />
            {refreshing ? '...' : '↻'}
          </button>
          <button onClick={openAddExtra}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: '#e05555', color: '#fff', border: 'none', cursor: 'pointer' }}>
            + Přidat mimo techniku
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rozdělit podle (lze zaškrtnout obojí):</span>
        <button onClick={() => setByCategory(v => !v)}
          style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: byCategory ? '#e05555' : 'var(--bg-card)', color: byCategory ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          {byCategory ? '✓ ' : ''}Kategorie
        </button>
        <button onClick={() => setByLocation(v => !v)} disabled={locations.length === 0}
          style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: byLocation ? '#e05555' : 'var(--bg-card)', color: byLocation ? '#fff' : locations.length === 0 ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: locations.length === 0 ? 'not-allowed' : 'pointer' }}>
          {byLocation ? '✓ ' : ''}Místa
        </button>
        {locations.length === 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>(žádná místa nejsou zatím na Technice založená)</span>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '20px' }}>
        Odběr (kW/ks) se zadává u jednotlivých položek na stránce Technika. Zde se sčítá napříč pronajímateli.
        Věci, které nepatří do Techniky (např. food truck), přidej tlačítkem „+ Přidat mimo techniku“ — zůstanou jen tady.
      </p>

      {showExtraForm && (
        <form onSubmit={handleSaveExtra} style={{ marginBottom: '20px', padding: '18px 20px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid #e05555' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#f4978e', marginBottom: '14px' }}>
            {editExtraId ? 'Upravit položku' : 'Nová položka mimo techniku'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={labelStyle}>Název *</label>
              <input required value={extraForm.name} onChange={e => setExtraForm({ ...extraForm, name: e.target.value })} placeholder="např. Food truck" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Počet</label>
              <input type="number" value={extraForm.quantity} onChange={e => setExtraForm({ ...extraForm, quantity: e.target.value })} placeholder="1" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Odběr/ks (kW)</label>
              <input type="number" step="0.01" value={extraForm.power_kw} onChange={e => setExtraForm({ ...extraForm, power_kw: e.target.value })} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Kategorie</label>
              <select value={extraForm.category} onChange={e => setExtraForm({ ...extraForm, category: e.target.value })} style={inputStyle}>
                <option value="">—</option>
                {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Místo</label>
              <select value={extraForm.location} onChange={e => setExtraForm({ ...extraForm, location: e.target.value })} style={inputStyle}>
                <option value="">—</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / 4' }}>
              <label style={labelStyle}>Poznámka</label>
              <input value={extraForm.note} onChange={e => setExtraForm({ ...extraForm, note: e.target.value })} placeholder="Volitelná poznámka" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={savingExtra} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#e05555', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {savingExtra ? 'Ukládám...' : 'Uložit'}
            </button>
            <button type="button" onClick={() => { setShowExtraForm(false); setEditExtraId(null) }} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
              Zrušit
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
          Zatím žádná technika. Přidej položky na stránce Technika.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(g => {
            const groupTotal = groupItems(g).reduce((s, e) => s + itemTotalKw(e), 0)
            const isCollapsed = !!collapsed[g.key]
            const isLocationGroup = g.key !== NO_LOCATION && g.key !== NO_CATEGORY && locations.includes(g.key)
            return (
              <div key={g.key} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
                <div
                  onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: g.color?.bg || 'var(--bg-card-alt)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: g.color?.color || 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: g.color?.color || 'var(--text-primary)' }}>{isLocationGroup ? '📍 ' : ''}{g.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({groupItems(g).length})</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#fbbf24' }}>⚡ {fmtKw(groupTotal)}</span>
                </div>
                {!isCollapsed && (
                  g.items ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
                        {['Název', 'Počet', 'kW/ks', 'Celkem kW', ''].map((h, i) => (
                          <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
                        ))}
                      </div>
                      {renderItemRows(g.items)}
                    </>
                  ) : (
                    g.children!.map(child => {
                      const childTotal = (child.items || []).reduce((s, e) => s + itemTotalKw(e), 0)
                      return (
                        <div key={child.key} style={{ padding: '10px 16px 0' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: child.color?.color || 'var(--text-secondary)', backgroundColor: child.color?.bg || 'transparent', border: `1px solid ${child.color?.border || 'var(--border-subtle)'}`, borderRadius: '5px', padding: '2px 8px', marginBottom: '4px' }}>
                            {child.key !== NO_LOCATION ? '📍 ' : ''}{child.label} <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({(child.items || []).length}) · ⚡ {fmtKw(childTotal)}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
                            {['Název', 'Počet', 'kW/ks', 'Celkem kW', ''].map((h, i) => (
                              <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
                            ))}
                          </div>
                          {renderItemRows(child.items || [])}
                        </div>
                      )
                    })
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </EventLayout>
  )
}
