'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { EventEquipment, EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_COLORS } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { callAction } from '@/lib/call-action'
import { useRealtime } from '@/lib/use-realtime'
import { supabase } from '@/lib/supabase'

interface Props {
  id: string
  initialEquipment: EventEquipment[]
}

interface ExpenseOption { id: string; item: string }

const UNASSIGNED = '__unassigned__'

const emptyForm = { name: '', note: '', quantity: '1', unit_price: '', total_price: '', expense_id: '', category: '' }

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
  const [equipment, setEquipment] = useState<EventEquipment[]>(initialEquipment)
  const [expenseOptions, setExpenseOptions] = useState<ExpenseOption[]>([])
  const [showForm, setShowForm] = useState<string | false>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [savingVendor, setSavingVendor] = useState(false)

  const loadingRef = useRef(false)
  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const [{ data }, { data: exp }] = await Promise.all([
        supabase.from('event_equipment').select('*').eq('event_id', id).order('created_at'),
        supabase.from('expenses').select('id, item').eq('event_id', id).eq('category', 'TECHNIKA').order('item'),
      ])
      setEquipment(data || [])
      setExpenseOptions(exp || [])
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
    }
    const result = editId
      ? await callAction('updateEquipment', editId, base)
      : await callAction('createEquipment', { event_id: id, ...base })
    if (result.error) { alert('Chyba: ' + result.error); setSaving(false); return }
    await load()
    setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false)
  }

  async function handleDelete(eqId: string) {
    if (!confirm('Smazat tuto položku techniky?')) return
    await callAction('deleteEquipment', eqId); await load()
  }

  function startEdit(eq: EventEquipment) {
    setForm({
      name: eq.name, note: eq.note || '', quantity: eq.quantity.toString(),
      unit_price: eq.unit_price.toString(), total_price: eq.total_price.toString(),
      expense_id: eq.expense_id || '', category: eq.category || '',
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
    const result = await callAction('createExpense', {
      event_id: id, category: 'TECHNIKA', item: vendorName.trim(),
      note: null, payment_timing: null, price: 0, deposit: 0, paid: false,
    })
    if (result.error) { alert('Chyba: ' + result.error); setSavingVendor(false); return }
    await load()
    setVendorName(''); setShowVendorForm(false); setSavingVendor(false)
  }

  const totalPrice = equipment.reduce((s, e) => s + e.total_price, 0)

  const bubbles: { key: string; label: string; items: EventEquipment[] }[] = [
    ...expenseOptions.map(opt => ({ key: opt.id, label: opt.item, items: equipment.filter(e => e.expense_id === opt.id) })),
    { key: UNASSIGNED, label: 'Bez pronajímatele', items: equipment.filter(e => !e.expense_id || !expenseOptions.some(o => o.id === e.expense_id)) },
  ]

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
          <button onClick={() => { setVendorName(''); setShowVendorForm(v => !v) }}
            style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
            + Nový pronajímatel
          </button>
        </div>
      </div>

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
        return (
          <div key={bubble.key} style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
            <div
              onClick={() => setCollapsed(c => ({ ...c, [bubble.key]: !c[bubble.key] }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: 'var(--bg-card-alt)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bubble.key === UNASSIGNED ? '📦' : '🔧'} {bubble.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({bubble.items.length})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>{bubbleTotal.toLocaleString('cs-CZ')} Kč</span>
                <button onClick={(e) => { e.stopPropagation(); openAddForm(bubble.key) }}
                  style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', backgroundColor: '#0369a1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  + Přidat techniku
                </button>
              </div>
            </div>

            {showForm === bubble.key && <div style={{ padding: '0 12px' }}>{renderForm(bubble.key)}</div>}

            {!isCollapsed && (
              bubble.items.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', backgroundColor: 'var(--bg-card)' }}>
                  Zatím žádná technika v této bublině.
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
                    {['Název / Poznámka', 'Poznámka', 'Počet', 'Cena/ks', 'Celkem', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i >= 2 && i <= 4 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {bubble.items.map((eq, i) => {
                    const catColors = eq.category ? EQUIPMENT_CATEGORY_COLORS[eq.category] : null
                    return (
                      <div key={eq.id} style={{ display: 'grid', gridTemplateColumns: rowGrid, padding: '10px 16px', alignItems: 'center', borderBottom: i < bubble.items.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}>
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
            )}
          </div>
        )
      })}
    </EventLayout>
  )
}
