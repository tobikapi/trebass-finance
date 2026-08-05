'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { EventEquipment, EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_COLORS } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { callAction } from '@/lib/call-action'
import { useRealtime } from '@/lib/use-realtime'
import { supabase } from '@/lib/supabase'
import { useUndo } from '@/lib/undo-context'

interface Props {
  id: string
  initialEquipment: EventEquipment[]
}

interface ExpenseOption { id: string; item: string; category: string; note: string | null; payment_timing: string | null; price: number; deposit: number; paid: boolean }

const UNASSIGNED = '__unassigned__'
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

const emptyForm = { name: '', note: '', quantity: '1', unit_price: '', total_price: '', expense_id: '', category: '', location: '' }

const inputStyle: CSSProperties = {
  backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px',
  outline: 'none', fontSize: '13px', width: '100%',
}

const labelStyle: CSSProperties = {
  color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px',
}

const rowGrid = '1fr 180px 60px 90px 90px 90px'

export default function TechnikaClient({ id, initialEquipment }: Props) {
  const { pushUndo } = useUndo()
  const [equipment, setEquipment] = useState<EventEquipment[]>(initialEquipment)
  const [expenseOptions, setExpenseOptions] = useState<ExpenseOption[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [showForm, setShowForm] = useState<string | false>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [savingVendor, setSavingVendor] = useState(false)
  const [newLocation, setNewLocation] = useState('')
  const [showSummary, setShowSummary] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [editVendorId, setEditVendorId] = useState<string | null>(null)
  const [editVendorName, setEditVendorName] = useState('')
  const [savingVendorEdit, setSavingVendorEdit] = useState(false)

  const loadingRef = useRef(false)
  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const [{ data }, { data: exp }, { data: ev }] = await Promise.all([
        supabase.from('event_equipment').select('*').eq('event_id', id).order('created_at'),
        supabase.from('expenses').select('*').eq('event_id', id).eq('category', 'TECHNIKA').order('item'),
        supabase.from('events').select('equipment_locations').eq('id', id).single(),
      ])
      setEquipment(data || [])
      setExpenseOptions(exp || [])
      setLocations(ev?.equipment_locations || [])
    } finally {
      loadingRef.current = false
    }
  }

  useEffect(() => { load() }, [id])

  const { live } = useRealtime(['event_equipment', 'expenses'], load, id)

  function handleQtyOrPrice(field: 'quantity' | 'unit_price' | 'total_price', value: string) {
    if (field === 'total_price') {
      setForm(f => ({ ...f, total_price: value }))
      return
    }
    setForm(f => {
      const qty = field === 'quantity' ? value : f.quantity
      const up  = field === 'unit_price' ? value : f.unit_price
      const q = parseFloat(qty) || 0
      const u = parseFloat(up) || 0
      const total = q > 0 && u > 0 ? String(q * u) : f.total_price
      return { ...f, [field]: value, total_price: total }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const base = {
      name: form.name,
      note: form.note || null,
      quantity: parseFloat(form.quantity) || 1,
      unit_price: parseFloat(form.unit_price) || 0,
      total_price: parseFloat(form.total_price) || 0,
      expense_id: form.expense_id || null,
      category: form.category || null,
      location: form.location || null,
    }
    const prev = editId ? equipment.find(x => x.id === editId) : null
    const result = editId
      ? await callAction('updateEquipment', editId, base)
      : await callAction('createEquipment', { event_id: id, ...base })
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    if (editId && prev) {
      const prevPayload = { name: prev.name, note: prev.note, quantity: prev.quantity, unit_price: prev.unit_price, total_price: prev.total_price, expense_id: prev.expense_id, category: prev.category, location: prev.location }
      pushUndo(`úprava techniky „${prev.name}“`, async () => {
        const res = await callAction('updateEquipment', editId, prevPayload)
        if (res.error) throw new Error(res.error)
        await load()
      })
    } else if (!editId && result.data) {
      const newId = (result.data as EventEquipment).id
      pushUndo(`přidání techniky „${base.name}“`, async () => {
        const res = await callAction('deleteEquipment', newId)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
    await load()
    setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(eqId: string) {
    if (!confirm('Smazat tuto položku techniky?')) return
    const row = equipment.find(e => e.id === eqId)
    await callAction('deleteEquipment', eqId); await load()
    if (row) {
      pushUndo(`smazání techniky „${row.name}“`, async () => {
        const res = await callAction('restoreRow', 'event_equipment', row)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
  }

  function startEdit(eq: EventEquipment) {
    setForm({
      name: eq.name, note: eq.note || '', quantity: eq.quantity.toString(),
      unit_price: eq.unit_price.toString(), total_price: eq.total_price.toString(),
      expense_id: eq.expense_id || '', category: eq.category || '', location: eq.location || '',
    })
    setEditId(eq.id)
    setShowForm(eq.expense_id && expenseOptions.some(o => o.id === eq.expense_id) ? eq.expense_id : UNASSIGNED)
  }

  function openAddForm(bubbleKey: string) {
    setForm({ ...emptyForm, expense_id: bubbleKey === UNASSIGNED ? '' : bubbleKey })
    setEditId(null)
    setShowForm(bubbleKey)
  }

  async function handleCreateVendor(e: React.FormEvent) {
    e.preventDefault()
    if (!vendorName.trim()) return
    setSavingVendor(true)
    const vendorLabel = vendorName.trim()
    const result = await callAction('createExpense', {
      event_id: id, category: 'TECHNIKA', item: vendorLabel,
      note: null, payment_timing: null, price: 0, deposit: 0, paid: false,
    })
    if (result.error) { alert('Chyba: ' + result.error); setSavingVendor(false); return }
    if (result.data) {
      const newId = (result.data as { id: string }).id
      pushUndo(`přidání pronajímatele „${vendorLabel}“`, async () => {
        const res = await callAction('deleteExpense', newId)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
    await load()
    setVendorName(''); setShowVendorForm(false); setSavingVendor(false)
  }

  function startEditVendor(vendor: ExpenseOption) {
    setEditVendorId(vendor.id)
    setEditVendorName(vendor.item)
  }

  async function saveVendorEdit(vendor: ExpenseOption) {
    const newName = editVendorName.trim()
    if (!newName || newName === vendor.item) { setEditVendorId(null); return }
    setSavingVendorEdit(true)
    const prevName = vendor.item
    const res = await callAction('renameExpenseItem', vendor.id, newName)
    if (res.error) { alert('Chyba: ' + res.error); setSavingVendorEdit(false); return }
    await load()
    setEditVendorId(null); setSavingVendorEdit(false)
    pushUndo(`přejmenování pronajímatele „${prevName}“`, async () => {
      const r = await callAction('renameExpenseItem', vendor.id, prevName)
      if (r.error) throw new Error(r.error)
      await load()
    })
  }

  async function handleDeleteVendor(vendor: ExpenseOption) {
    const linkedItems = equipment.filter(e => e.expense_id === vendor.id)
    const msg = linkedItems.length > 0
      ? `Smazat pronajímatele „${vendor.item}“? ${linkedItems.length} položek techniky zůstane zachováno a přesune se do „Bez pronajímatele“.`
      : `Smazat pronajímatele „${vendor.item}“?`
    if (!confirm(msg)) return
    if (linkedItems.length > 0) {
      const res = await callAction('unassignEquipmentByExpense', vendor.id)
      if (res.error) { alert('Chyba: ' + res.error); return }
    }
    const res = await callAction('deleteExpense', vendor.id)
    if (res.error) { alert('Chyba: ' + res.error); return }
    await load()
    pushUndo(`smazání pronajímatele „${vendor.item}“`, async () => {
      const r1 = await callAction('restoreRow', 'expenses', vendor)
      if (r1.error) throw new Error(r1.error)
      for (const item of linkedItems) {
        const r2 = await callAction('updateEquipment', item.id, {
          name: item.name, note: item.note, quantity: item.quantity, unit_price: item.unit_price,
          total_price: item.total_price, expense_id: vendor.id, category: item.category, location: item.location,
        })
        if (r2.error) throw new Error(r2.error)
      }
      await load()
    })
  }

  async function addLocation() {
    const name = newLocation.trim()
    if (!name || locations.includes(name)) return
    const prevLocations = locations
    const updated = [...locations, name]
    await callAction('updateEventEquipmentLocations', id, updated)
    setLocations(updated)
    setNewLocation('')
    pushUndo(`přidání místa „${name}“`, async () => {
      const res = await callAction('updateEventEquipmentLocations', id, prevLocations)
      if (res.error) throw new Error(res.error)
      await load()
    })
  }

  async function removeLocation(name: string) {
    if (!confirm(`Smazat místo „${name}“?`)) return
    const prevLocations = locations
    const updated = locations.filter(l => l !== name)
    await callAction('updateEventEquipmentLocations', id, updated)
    setLocations(updated)
    pushUndo(`odebrání místa „${name}“`, async () => {
      const res = await callAction('updateEventEquipmentLocations', id, prevLocations)
      if (res.error) throw new Error(res.error)
      await load()
    })
  }

  const visibleEquipment = selectedLocation ? equipment.filter(e => e.location === selectedLocation) : equipment
  const totalPrice = visibleEquipment.reduce((s, e) => s + e.total_price, 0)

  const bubbles: { key: string; label: string; items: EventEquipment[] }[] = [
    ...expenseOptions.map(opt => ({ key: opt.id, label: opt.item, items: visibleEquipment.filter(e => e.expense_id === opt.id) })),
    { key: UNASSIGNED, label: 'Bez pronajímatele', items: visibleEquipment.filter(e => !e.expense_id || !expenseOptions.some(o => o.id === e.expense_id)) },
  ]

  function aggregateByName(items: EventEquipment[]) {
    return Object.values(
      items.reduce((acc, e) => {
        const normalized = e.name.replace(/\s+/g, ' ').trim()
        const key = normalized.toLowerCase()
        if (!acc[key]) acc[key] = { name: normalized, quantity: 0, total_price: 0 }
        acc[key].quantity += e.quantity
        acc[key].total_price += e.total_price
        return acc
      }, {} as Record<string, { name: string; quantity: number; total_price: number }>)
    ).sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  }

  const summaryByVendor = bubbles
    .map(b => ({ key: b.key, label: b.label, rows: aggregateByName(b.items), total: b.items.reduce((s, e) => s + e.total_price, 0) }))
    .filter(b => b.rows.length > 0)

  function renderForm(bubbleKey: string) {
    return (
      <form onSubmit={handleSave} style={{ marginTop: '10px', marginBottom: '10px', padding: '18px 20px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid #0369a1' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', marginBottom: '14px' }}>
          {editId ? 'Upravit položku' : 'Nová technika'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Název *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="např. GrandMa3 compact" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Počet</label>
            <input type="number" value={form.quantity} onChange={e => handleQtyOrPrice('quantity', e.target.value)} placeholder="1" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cena/ks (Kč)</label>
            <input type="number" value={form.unit_price} onChange={e => handleQtyOrPrice('unit_price', e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Celkem (Kč)</label>
            <input type="number" value={form.total_price} onChange={e => handleQtyOrPrice('total_price', e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / 3' }}>
            <label style={labelStyle}>Poznámka</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Volitelná poznámka" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              <option value="">—</option>
              {EQUIPMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Místo</label>
            <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={inputStyle}>
              <option value="">—</option>
              {locations.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit" disabled={saving} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
          <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
            Zrušit
          </button>
        </div>
      </form>
    )
  }

  function renderItemsTable(items: EventEquipment[]) {
    if (items.length === 0) return null
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
          {['Název / Poznámka', 'Poznámka', 'Počet', 'Cena/ks', 'Celkem', ''].map((h, i) => (
            <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {items.map((eq, i) => {
          const catColors = eq.category ? EQUIPMENT_CATEGORY_COLORS[eq.category] : null
          return (
            <div key={eq.id} style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '10px 16px', alignItems: 'center', borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}>
              <div>
                <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px' }}>{eq.name}</div>
                {catColors && (
                  <span style={{ fontSize: '10px', color: catColors.color, backgroundColor: catColors.bg, padding: '1px 6px', borderRadius: '4px', border: `1px solid ${catColors.border}` }}>
                    {eq.category}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.note || '—'}</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>{eq.quantity}</div>
              <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>{eq.unit_price > 0 ? `${eq.unit_price.toLocaleString('cs-CZ')} Kč` : '—'}</div>
              <div style={{ textAlign: 'right', fontWeight: '600', color: eq.total_price > 0 ? 'var(--text-primary)' : 'var(--text-faint)', fontSize: '13px' }}>{eq.total_price > 0 ? `${eq.total_price.toLocaleString('cs-CZ')} Kč` : '—'}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => startEdit(eq)} style={{ fontSize: '12px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                <button onClick={() => handleDelete(eq.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <EventLayout eventId={id}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Položek</div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#38bdf8' }}>{equipment.length}</div>
          </div>
          <div style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Celková cena</div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#f87171' }}>{totalPrice.toLocaleString('cs-CZ')} Kč</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }} disabled={refreshing}
            style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--bg-card)', color: refreshing ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: live ? '#34d399' : 'var(--text-faint)', display: 'inline-block' }} />
            {refreshing ? '...' : '↻'}
          </button>
          <button onClick={() => setShowSummary(v => !v)}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: showSummary ? '#0369a1' : 'var(--bg-card)', color: showSummary ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            Σ Souhrn
          </button>
          <button onClick={() => { setVendorName(''); setShowVendorForm(v => !v) }}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            + Nový pronajímatel
          </button>
        </div>
      </div>

      {/* Místa */}
      <div style={{ marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Místa {selectedLocation ? '(klikni pro zrušení filtru):' : '(klikni pro filtr):'}</span>
        {locations.map((l, i) => {
          const c = locationColor(i)
          const active = selectedLocation === l
          return (
            <span key={l}
              onClick={() => setSelectedLocation(active ? null : l)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '5px', cursor: 'pointer',
                backgroundColor: active ? c.color : c.bg, border: `1px solid ${c.color}`,
                fontSize: '12px', color: active ? '#0c0c0c' : c.color, fontWeight: '700',
              }}>
              {l}
              <button onClick={(e) => { e.stopPropagation(); removeLocation(l) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px', lineHeight: 1, padding: 0, opacity: 0.6 }}>×</button>
            </span>
          )
        })}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <input
            value={newLocation} onChange={e => setNewLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLocation())}
            placeholder="Přidat místo, např. MAIN STAGE..."
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', outline: 'none', width: '180px' }}
          />
          <button onClick={addLocation} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            + Přidat
          </button>
        </div>
      </div>

      {/* Souhrn */}
      {showSummary && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {summaryByVendor.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
              {selectedLocation ? `Žádná technika na místě „${selectedLocation}“.` : 'Žádná technika.'}
            </div>
          ) : summaryByVendor.map(v => (
            <div key={v.key} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'var(--bg-card-alt)' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{v.key === UNASSIGNED ? '📦' : '🔧'} {v.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>{v.total.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
                {['Název', 'Celkem ks', 'Celkem Kč'].map((h, i) => (
                  <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>
              {v.rows.map((s, i) => (
                <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px', padding: '8px 16px', borderBottom: i < v.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{s.quantity}</div>
                  <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{s.total_price.toLocaleString('cs-CZ')} Kč</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showVendorForm && (
        <form onSubmit={handleCreateVendor} style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '14px 18px', borderRadius: '10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <input autoFocus value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Název pronajímatele, např. AudioLighty s.r.o." style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" disabled={savingVendor} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
            {savingVendor ? 'Ukládám...' : 'Vytvořit'}
          </button>
          <button type="button" onClick={() => setShowVendorForm(false)} style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '13px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
            Zrušit
          </button>
        </form>
      )}

      {/* Bubliny pronajímatelů */}
      {bubbles.map(bubble => {
        const isCollapsed = !!collapsed[bubble.key]
        const bubbleTotal = bubble.items.reduce((s, e) => s + e.total_price, 0)
        const byLocation = locations.length === 0 ? null : [
          ...locations.map(loc => ({ key: loc, label: loc, rows: bubble.items.filter(e => e.location === loc) })),
          { key: NO_LOCATION, label: 'Bez místa', rows: bubble.items.filter(e => !e.location || !locations.includes(e.location)) },
        ]
        const vendor = expenseOptions.find(o => o.id === bubble.key)
        const isEditingVendor = editVendorId === bubble.key
        return (
          <div key={bubble.key} style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
            <div
              onClick={() => !isEditingVendor && setCollapsed(c => ({ ...c, [bubble.key]: !c[bubble.key] }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'var(--bg-card-alt)', cursor: isEditingVendor ? 'default' : 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                {isEditingVendor ? (
                  <input
                    autoFocus value={editVendorName} onChange={e => setEditVendorName(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveVendorEdit(vendor!) } if (e.key === 'Escape') setEditVendorId(null) }}
                    style={{ ...inputStyle, width: '220px', padding: '4px 8px', fontSize: '13px' }}
                  />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bubble.key === UNASSIGNED ? '📦' : '🔧'} {bubble.label}</span>
                )}
                {!isEditingVendor && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({bubble.items.length})</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {isEditingVendor ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); saveVendorEdit(vendor!) }} disabled={savingVendorEdit}
                      style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      {savingVendorEdit ? '...' : 'Uložit'}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditVendorId(null) }}
                      style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                      Zrušit
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>{bubbleTotal.toLocaleString('cs-CZ')} Kč</span>
                    {vendor && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); startEditVendor(vendor) }} style={{ fontSize: '12px', color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteVendor(vendor) }} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); openAddForm(bubble.key) }}
                      style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      + Přidat techniku
                    </button>
                  </>
                )}
              </div>
            </div>

            {showForm === bubble.key && <div style={{ padding: '0 12px' }}>{renderForm(bubble.key)}</div>}

            {!isCollapsed && (
              bubble.items.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', backgroundColor: 'var(--bg-card)' }}>
                  Zatím žádná technika v této bublině.
                </div>
              ) : !byLocation ? (
                renderItemsTable(bubble.items)
              ) : (
                <div>
                  {byLocation.filter(loc => loc.rows.length > 0).map(loc => {
                    const locIdx = locations.indexOf(loc.key)
                    const c = locIdx >= 0 ? locationColor(locIdx) : { color: 'var(--text-secondary)', bg: 'transparent', border: 'transparent' }
                    return (
                    <div key={loc.key} style={{ padding: '10px 16px 0' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: '5px', padding: '2px 8px', marginBottom: '4px' }}>
                        📍 {loc.label} <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({loc.rows.length})</span>
                      </div>
                      {renderItemsTable(loc.rows)}
                    </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        )
      })}
    </EventLayout>
  )
}
