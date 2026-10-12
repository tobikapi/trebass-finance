'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import EventLayout from '@/components/EventLayout'
import Collapse from '@/components/Collapse'
import LedgerStyles from '@/components/LedgerStyles'
import { callAction } from '@/lib/call-action'
import { supabase } from '@/lib/supabase'
import { useUndo } from '@/lib/undo-context'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import { useEventPermissions } from '@/lib/event-permissions'
import { useRealtime } from '@/lib/use-realtime'
import { netOf } from '@/lib/settlement'
import {
  LEDGER_KIND_COLORS, LEDGER_KIND_HINTS, LEDGER_KIND_LABELS, LEDGER_SELECT, sortLedger, todayPrague, type LedgerPerson, type LedgerRow,
} from '@/lib/ledger'

// Záložka Tým = pohyby z Knihy majitelů pro tuhle akci (vklady, výběry,
// vyrovnání). Dřív samostatná tabulka team_contributions — převedeno do
// owner_ledger, ať se nic nezadává dvakrát. Výpočet „kdo komu kolik" je na
// stránce Firma → Vklady a vyrovnání.

type TymKind = 'vklad' | 'vyber' | 'dluh'
const TYM_KINDS: TymKind[] = ['vklad', 'vyber', 'dluh']
const emptyForm = { kind: 'vklad' as TymKind, profile_id: '', counterparty_id: '', amount: '', note: '', date: '' }

interface Props {
  id: string
  initialLedger: LedgerRow[]
  people: LedgerPerson[]
}

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'

export default function TymClient({ id, initialLedger, people }: Props) {
  // Tlačítka podle oprávnění v téhle akci (role NEBO výjimka). Vynucuje to
  // databáze — tady jde jen o to, aby čtenář neklikal na něco, co neprojde.
  const { canInEvent } = useEventPermissions(id)
  const canCreate = canInEvent('canCreate')
  const canEdit = canInEvent('canEdit')
  const canDelete = canInEvent('canDelete')
  const { can } = useUser()
  const { notify } = useDialog()
  const { pushUndo } = useUndo()
  const [rows, setRows] = useState<LedgerRow[]>(initialLedger)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadingRef = useRef(false)
  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data } = await supabase.from('owner_ledger').select(LEDGER_SELECT).eq('event_id', id)
      setRows((data || []) as LedgerRow[])
    } finally {
      loadingRef.current = false
    }
  }
  useRealtime(['owner_ledger'], load, id)

  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const nameOf = (pid: string | null) => (pid && personById.get(pid)?.name.split(' ')[0]) || '?'
  const sorted = useMemo(() => sortLedger(rows), [rows])

  // Souhrn po lidech: kolik kdo do akce vložil (vklady − výběry), včetně
  // uzavřené historie — tohle je přehled akce, ne vyrovnání. Kdo komu kolik
  // (jen otevřené pohyby) je ve Firmě → Vklady a vyrovnání.
  const moneyRows = useMemo(() => rows.filter(r => r.kind === 'vklad' || r.kind === 'vyber'), [rows])
  const summary = useMemo(() => {
    const ids = new Set(moneyRows.map(r => r.profile_id))
    return [...ids].map(pid => {
      const n = netOf(moneyRows, pid)
      return { id: pid, name: nameOf(pid), isOwner: personById.get(pid)?.is_owner === true, ...n }
    }).sort((a, b) => b.net - a.net)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moneyRows, personById])
  const total = summary.reduce((s, p) => s + p.net, 0)
  const maxNet = Math.max(0, ...summary.map(p => p.net))
  // Otevřené dluhy v akci (po splacení vyrovnáním mezi stejnými lidmi zmizí)
  const openDebts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (r.closing_id || !r.counterparty_id) continue
      if (r.kind === 'dluh') m.set(`${r.profile_id}>${r.counterparty_id}`, (m.get(`${r.profile_id}>${r.counterparty_id}`) || 0) + r.amount)
      if (r.kind === 'vyrovnani') m.set(`${r.profile_id}>${r.counterparty_id}`, (m.get(`${r.profile_id}>${r.counterparty_id}`) || 0) - r.amount)
    }
    return [...m].filter(([k, v]) => v > 0.5 && rows.some(r => r.kind === 'dluh' && `${r.profile_id}>${r.counterparty_id}` === k))
      .map(([k, v]) => ({ from: k.split('>')[0], to: k.split('>')[1], amount: v }))
  }, [rows])

  function openAdd(kind: TymKind = 'vklad') {
    setForm({ ...emptyForm, kind, date: todayPrague() })
    setEditId(null); setShowForm(true)
  }

  function startEdit(r: LedgerRow) {
    if (r.kind === 'vyrovnani') { notify('Vyrovnání se upravuje ve Firmě → Vklady a vyrovnání.'); return }
    setForm({ kind: r.kind, profile_id: r.profile_id, counterparty_id: r.counterparty_id || '', amount: String(r.amount), note: r.note || '', date: r.date || '' })
    setEditId(r.id); setShowForm(true)
  }

  const payloadOf = (f: typeof emptyForm) => ({
    kind: f.kind, profile_id: f.profile_id, counterparty_id: f.kind === 'dluh' ? f.counterparty_id || null : null, amount: parseFloat(f.amount),
    event_id: id, date: f.date || null, note: f.note.trim() || null,
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = payloadOf(form)
    const prev = editId ? rows.find(r => r.id === editId) : null
    const result = editId ? await callAction('updateLedgerEntry', editId, payload) : await callAction('createLedgerEntry', payload)
    setSaving(false)
    if (result.error) { notify('Chyba: ' + result.error); return }
    if (editId && prev && prev.kind !== 'vyrovnani') {
      const prevPayload = payloadOf({ kind: prev.kind, profile_id: prev.profile_id, counterparty_id: prev.counterparty_id || '', amount: String(prev.amount), note: prev.note || '', date: prev.date || '' })
      pushUndo(`úprava pohybu (${nameOf(prev.profile_id)})`, async () => {
        const res = await callAction('updateLedgerEntry', editId, prevPayload)
        if (res.error) throw new Error(res.error)
        await load()
      })
    } else if (!editId && result.data && typeof result.data === 'object' && 'id' in result.data) {
      const newId = (result.data as { id: string }).id
      pushUndo(`přidání pohybu (${nameOf(payload.profile_id)})`, async () => {
        const res = await callAction('deleteLedgerEntry', newId)
        if (res.error) throw new Error(res.error)
        await load()
      })
    }
    await load()
    setForm(emptyForm); setShowForm(false); setEditId(null)
  }

  async function handleDelete(r: LedgerRow) {
    if (!confirm(`Smazat ${LEDGER_KIND_LABELS[r.kind].toLowerCase()} ${fmt(r.amount)} (${nameOf(r.profile_id)})?`)) return
    const res = await callAction('deleteLedgerEntry', r.id)
    if (res.error) { notify('Chyba: ' + res.error); return }
    pushUndo(`smazání pohybu (${nameOf(r.profile_id)})`, async () => {
      const x = await callAction('restoreRow', 'owner_ledger', {
        id: r.id, profile_id: r.profile_id, counterparty_id: r.counterparty_id, kind: r.kind, amount: r.amount,
        event_id: r.event_id, date: r.date, note: r.note, source: r.source, closing_id: r.closing_id,
      })
      if (x.error) throw new Error(x.error)
      await load()
    })
    await load()
  }

  const inputStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 12px', outline: 'none', fontSize: '13px', width: '100%' } as const
  const labelStyle = { color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' } as const
  const owners = people.filter(p => p.is_owner)
  const others = people.filter(p => !p.is_owner)

  return (
    <EventLayout eventId={id}>
      <LedgerStyles />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Vloženo čistě celkem', value: fmt(total), color: '#34d399' },
            { label: 'Lidí', value: String(summary.length), color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {can('viewFirma') && (
            <Link href={`/firma/vklady?akce=${id}`} style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}>
              🧮 Kdo komu kolik →
            </Link>
          )}
          {canCreate && TYM_KINDS.map(k => (
            <button key={k} onClick={() => openAdd(k)} style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: `1px solid ${LEDGER_KIND_COLORS[k]}`, backgroundColor: 'transparent', color: LEDGER_KIND_COLORS[k], cursor: 'pointer' }}>
              + {LEDGER_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <Collapse open={showForm}>
        <form onSubmit={handleSave} style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid #7c3aed' }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {TYM_KINDS.map(k => (
              <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${LEDGER_KIND_COLORS[k]}`,
                backgroundColor: form.kind === k ? LEDGER_KIND_COLORS[k] : 'transparent',
                color: form.kind === k ? '#0c0c0c' : LEDGER_KIND_COLORS[k],
              }}>{LEDGER_KIND_LABELS[k]}</button>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px' }}>{LEDGER_KIND_HINTS[form.kind]}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>{{ vklad: 'Kdo vložil / zaplatil', vyber: 'Kdo si vybral', dluh: 'Kdo dluží' }[form.kind]} *</label>
              <select required value={form.profile_id} onChange={e => setForm({ ...form, profile_id: e.target.value })} style={inputStyle}>
                <option value="">— vyber —</option>
                <optgroup label="Majitelé">{owners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                <optgroup label="Ostatní">{others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              </select>
            </div>
            {form.kind === 'dluh' && (
              <div>
                <label style={labelStyle}>Komu dluží *</label>
                <select required value={form.counterparty_id} onChange={e => setForm({ ...form, counterparty_id: e.target.value })} style={inputStyle}>
                  <option value="">— vyber —</option>
                  {people.filter(p => p.id !== form.profile_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Částka (Kč) *</label>
              <input required inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Datum</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Poznámka</label>
            <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="např. Makro, ploty, vklad na účet…" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Ukládám…' : editId ? 'Uložit změny' : 'Přidat'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--bg-badge)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Zrušit</button>
          </div>
        </form>
      </Collapse>

      {openDebts.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.35)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>Otevřené dluhy v akci</div>
          {openDebts.map(d => (
            <div key={d.from + d.to} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-primary)', padding: '2px 0' }}>
              <span><strong>{nameOf(d.from)}</strong> dluží <strong>{nameOf(d.to)}</strong></span>
              <strong style={{ color: '#fbbf24' }}>{fmt(d.amount)}</strong>
            </div>
          ))}
        </div>
      )}

      {summary.length === 0 && rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          Zatím žádné vklady.{canCreate && ' Klikni + Přidat vklad.'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {summary.map(p => {
              const pct = maxNet > 0 ? Math.max(0, p.net) / maxNet * 100 : 0
              return (
                <div key={p.id} style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.name}{!p.isOwner && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 400 }}>není majitel</span>}
                    </span>
                    <span style={{ fontWeight: 700, color: '#34d399' }}>{fmt(p.net)}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--bg-badge)' }}>
                    <div style={{ height: '6px', borderRadius: '3px', width: `${pct}%`, backgroundColor: '#7c3aed', transition: 'width 0.3s' }} />
                  </div>
                  {(p.withdrawn > 0 || p.settledIn > 0 || p.settledOut > 0) && (
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      vloženo {fmt(p.deposited)}{p.withdrawn > 0 && ` · vybráno ${fmt(p.withdrawn)}`}
                      {p.settledOut > 0 && ` · poslal ${fmt(p.settledOut)}`}{p.settledIn > 0 && ` · dostal ${fmt(p.settledIn)}`}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 8px' }}>Pohyby ({sorted.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sorted.map(r => (
              <div key={r.id} className="vk-move">
                <div className="vk-move-main">
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: '#0c0c0c', backgroundColor: LEDGER_KIND_COLORS[r.kind], flexShrink: 0 }}>
                    {LEDGER_KIND_LABELS[r.kind]}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {nameOf(r.profile_id)}{r.kind === 'vyrovnani' && <> → {nameOf(r.counterparty_id)}</>}
                    {r.kind === 'dluh' && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> dluží {nameOf(r.counterparty_id)}</span>}
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: LEDGER_KIND_COLORS[r.kind], whiteSpace: 'nowrap' }}>
                    {r.kind === 'vyber' ? '−' : ''}{fmt(r.amount)}
                  </span>
                </div>
                <div className="vk-move-meta">
                  {r.date && <span>{r.date.split('-').reverse().map(Number).join('. ')}</span>}
                  {r.note && <span style={{ color: 'var(--text-secondary)' }}>· {r.note}</span>}
                  {r.closing_id && <span style={{ color: 'var(--text-faint)' }}>· 🔒 uzavřeno</span>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                    {canEdit && r.kind !== 'vyrovnani' && <button type="button" onClick={() => startEdit(r)} style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>}
                    {canDelete && <button type="button" onClick={() => handleDelete(r)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </EventLayout>
  )
}
