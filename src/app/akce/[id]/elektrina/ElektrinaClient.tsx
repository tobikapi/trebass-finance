'use client'

import { useEffect, useRef, useState } from 'react'
import { EventEquipment, EQUIPMENT_CATEGORIES, EQUIPMENT_CATEGORY_COLORS, EquipmentCategory } from '@/lib/types'
import EventLayout from '@/components/EventLayout'
import { useRealtime } from '@/lib/use-realtime'
import { supabase } from '@/lib/supabase'

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

export default function ElektrinaClient({ id, initialEquipment, initialLocations }: Props) {
  const [equipment, setEquipment] = useState<EventEquipment[]>(initialEquipment)
  const [locations, setLocations] = useState<string[]>(initialLocations)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [groupBy, setGroupBy] = useState<'category' | 'location'>('category')

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

  type Group = { key: string; label: string; items: EventEquipment[]; color: { color: string; bg: string; border: string } | null }

  const groups: Group[] = groupBy === 'location'
    ? [
        ...locations.map((loc, i) => ({ key: loc, label: loc, items: equipment.filter(e => e.location === loc), color: locationColor(i) })),
        { key: NO_LOCATION, label: 'Bez místa', items: equipment.filter(e => !e.location || !locations.includes(e.location)), color: null },
      ].filter(g => g.items.length > 0)
    : [
        ...EQUIPMENT_CATEGORIES.map(cat => ({ key: cat, label: cat, items: equipment.filter(e => e.category === cat), color: EQUIPMENT_CATEGORY_COLORS[cat as EquipmentCategory] })),
        { key: NO_CATEGORY, label: 'Bez kategorie', items: equipment.filter(e => !e.category), color: null },
      ].filter(g => g.items.length > 0)

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
        <button onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }} disabled={refreshing}
          style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', backgroundColor: 'var(--bg-card)', color: refreshing ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: live ? '#34d399' : 'var(--text-faint)', display: 'inline-block' }} />
          {refreshing ? '...' : '↻'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rozdělit podle:</span>
        <button onClick={() => setGroupBy('category')}
          style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: groupBy === 'category' ? '#e05555' : 'var(--bg-card)', color: groupBy === 'category' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          Kategorie
        </button>
        <button onClick={() => setGroupBy('location')} disabled={locations.length === 0}
          style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', backgroundColor: groupBy === 'location' ? '#e05555' : 'var(--bg-card)', color: groupBy === 'location' ? '#fff' : locations.length === 0 ? 'var(--text-dim)' : 'var(--text-secondary)', border: '1px solid var(--border)', cursor: locations.length === 0 ? 'not-allowed' : 'pointer' }}>
          Místa
        </button>
        {locations.length === 0 && groupBy !== 'location' && (
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>(žádná místa nejsou zatím na Technice založená)</span>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '20px' }}>
        Odběr (kW/ks) se zadává u jednotlivých položek na stránce Technika. Zde se sčítá napříč pronajímateli{groupBy === 'category' ? ' a místy' : ' a kategoriemi'}.
      </p>

      {groups.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-card)' }}>
          Zatím žádná technika. Přidej položky na stránce Technika.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(g => {
            const groupTotal = g.items.reduce((s, e) => s + itemTotalKw(e), 0)
            const isCollapsed = !!collapsed[g.key]
            return (
              <div key={g.key} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-card)' }}>
                <div
                  onClick={() => setCollapsed(c => ({ ...c, [g.key]: !c[g.key] }))}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: g.color?.bg || 'var(--bg-card-alt)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: g.color?.color || 'var(--text-dim)' }}>{isCollapsed ? '▸' : '▾'}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: g.color?.color || 'var(--text-primary)' }}>{groupBy === 'location' && g.key !== NO_LOCATION ? '📍 ' : ''}{g.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({g.items.length})</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#fbbf24' }}>⚡ {fmtKw(groupTotal)}</span>
                </div>
                {!isCollapsed && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px', padding: '8px 16px', backgroundColor: 'var(--bg-card-alt)', borderTop: '1px solid var(--border-card)', borderBottom: '1px solid var(--border-card)' }}>
                      {['Název', 'Počet', 'kW/ks', 'Celkem kW'].map((h, i) => (
                        <div key={i} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                      ))}
                    </div>
                    {g.items.map((eq, i) => (
                      <div key={eq.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 110px', padding: '8px 16px', alignItems: 'center', borderBottom: i < g.items.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{eq.name}</div>
                        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{eq.quantity}</div>
                        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>{eq.power_kw > 0 ? `${eq.power_kw} kW` : '—'}</div>
                        <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', color: eq.power_kw > 0 ? 'var(--text-primary)' : 'var(--text-faint)' }}>{eq.power_kw > 0 ? fmtKw(itemTotalKw(eq)) : '—'}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </EventLayout>
  )
}
