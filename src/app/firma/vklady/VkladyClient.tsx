'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { callAction } from '@/lib/call-action'
import { useRealtime } from '@/lib/use-realtime'
import { useUndo } from '@/lib/undo-context'
import { useDialog } from '@/lib/dialog-context'
import { useUser } from '@/lib/user-context'
import PermissionGuard from '@/components/PermissionGuard'
import Collapse from '@/components/Collapse'
import { computeSettlement, type LedgerKind } from '@/lib/settlement'
import {
  LEDGER_KIND_COLORS, LEDGER_KIND_LABELS, LEDGER_SELECT, LEDGER_SOURCE_LABELS, sortLedger,
  type CompanyBalanceRow, type LedgerPerson, type LedgerRow,
} from '@/lib/ledger'

interface EventOption { id: string; name: string; date: string | null }

interface Props {
  initialLedger: LedgerRow[]
  people: LedgerPerson[]
  events: EventOption[]
  initialBalance: CompanyBalanceRow | null
  eventResults: Record<string, number>
  initialScope: string | null
}

// 'all' = celá firma (všechny akce + Firma obecně), 'firma' = jen pohyby mimo akce
type Scope = 'all' | 'firma' | string

const fmt = (n: number) => Math.round(n).toLocaleString('cs-CZ') + ' Kč'
const signed = (n: number) => (Math.round(n) > 0 ? '+' : '') + fmt(n)
const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d: string | null) => {
  if (!d) return '—'
  const [y, m, day] = d.split('-').map(Number)
  return `${day}. ${m}. ${y}`
}

const emptyForm = { kind: 'vklad' as LedgerKind, profile_id: '', counterparty_id: '', amount: '', event_id: '', date: '', note: '' }

const card = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' } as const
const inputStyle = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '8px', padding: '9px 12px', outline: 'none', fontSize: '14px', width: '100%' } as const
const labelStyle = { color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' } as const

export default function VkladyClient({ initialLedger, people, events, initialBalance, eventResults, initialScope }: Props) {
  const { notify } = useDialog()
  const { pushUndo } = useUndo()
  const { can } = useUser()
  const canCreate = can('canCreate')
  const canEdit = can('canEdit')
  const canDelete = can('canDelete')

  const [ledger, setLedger] = useState<LedgerRow[]>(initialLedger)
  // Výchozí rozsah: akce z odkazu (?akce= ze záložky Tým), jinak celá firma
  const [scope, setScope] = useState<Scope>(() => initialScope && events.some(e => e.id === initialScope) ? initialScope : 'all')
  const [mode, setMode] = useState<'mezi' | 'ucet'>('mezi')
  const [balance, setBalance] = useState<CompanyBalanceRow | null>(initialBalance)
  const [balanceEdit, setBalanceEdit] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')
  const [payoutInput, setPayoutInput] = useState<string | null>(null) // null = navržená částka
  const [confirmSettle, setConfirmSettle] = useState(false)
  const [settling, setSettling] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)

  const loadingRef = useRef(false)
  async function load() {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const { data } = await supabase.from('owner_ledger').select(LEDGER_SELECT)
      setLedger((data || []) as LedgerRow[])
    } finally {
      loadingRef.current = false
    }
  }
  useRealtime(['owner_ledger'], load)

  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events])
  const nameOf = (id: string | null) => {
    if (!id) return '—'
    const full = personById.get(id)?.name || '?'
    return full.split(' ')[0]
  }
  const scopeLabel = (s: Scope) => s === 'all' ? 'Celá firma' : s === 'firma' ? 'Firma obecně (mimo akce)' : (eventById.get(s)?.name || 'Akce')
  const placeLabel = (eventId: string | null) => eventId ? (eventById.get(eventId)?.name || 'Akce') : 'Firma obecně'

  // Pohyby v rozsahu
  const scopeRows = useMemo(() => sortLedger(ledger.filter(r =>
    scope === 'all' ? true : scope === 'firma' ? r.event_id === null : r.event_id === scope)), [ledger, scope])

  // Akce, které v knize něco mají, nahoře v nabídce
  const eventsWithRows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of ledger) if (r.event_id) counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1)
    return { counts, sorted: [...events].sort((a, b) => (counts.has(b.id) ? 1 : 0) - (counts.has(a.id) ? 1 : 0)) }
  }, [ledger, events])
  const firmaCount = ledger.filter(r => r.event_id === null).length

  // Kdo vstupuje do výpočtu: všichni majitelé + kdokoli s pohybem v rozsahu
  const scopePeople = useMemo(() => {
    const ids = new Set(people.filter(p => p.is_owner).map(p => p.id))
    for (const r of scopeRows) { ids.add(r.profile_id); if (r.counterparty_id) ids.add(r.counterparty_id) }
    return [...ids].map(id => personById.get(id)).filter((p): p is LedgerPerson => !!p)
      .sort((a, b) => Number(b.is_owner) - Number(a.is_owner) || a.name.localeCompare(b.name, 'cs'))
      .map(p => ({ id: p.id, name: p.name, isOwner: p.is_owner }))
  }, [people, scopeRows, personById])

  const accountBalance = balance?.amount ?? 0
  const probe = computeSettlement(scopePeople, scopeRows, 0, null)
  const suggested = probe.suggestedPayout
  const defaultPayout = Math.min(Math.max(0, accountBalance), suggested)
  const wantedPayout = mode === 'ucet' ? (payoutInput === null ? defaultPayout : (parseFloat(payoutInput) || 0)) : 0
  const result = computeSettlement(scopePeople, scopeRows, wantedPayout, mode === 'ucet' ? accountBalance : null)
  const ownersCount = scopePeople.filter(p => p.isOwner).length

  const eventResult = scope !== 'all' && scope !== 'firma' ? eventResults[scope] ?? 0 : null

  // ---- Pohyby: přidat / upravit / smazat ----
  function openAdd() {
    setForm({ ...emptyForm, event_id: scope !== 'all' && scope !== 'firma' ? scope : '', date: today() })
    setEditId(null); setShowForm(true)
  }

  function startEdit(r: LedgerRow) {
    setForm({
      kind: r.kind, profile_id: r.profile_id, counterparty_id: r.counterparty_id || '', amount: String(r.amount),
      event_id: r.event_id || '', date: r.date || '', note: r.note || '',
    })
    setEditId(r.id); setShowForm(true)
  }

  function payloadOf(f: typeof emptyForm) {
    return {
      kind: f.kind, profile_id: f.profile_id, counterparty_id: f.kind === 'vyrovnani' ? f.counterparty_id || null : null,
      amount: parseFloat(f.amount), event_id: f.event_id || null, date: f.date || null, note: f.note.trim() || null,
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = payloadOf(form)
    const prev = editId ? ledger.find(r => r.id === editId) : null
    const res = editId ? await callAction('updateLedgerEntry', editId, payload) : await callAction('createLedgerEntry', payload)
    setSaving(false)
    if (res.error) { notify('Chyba: ' + res.error); return }
    if (prev && editId) {
      const prevPayload = payloadOf({
        kind: prev.kind, profile_id: prev.profile_id, counterparty_id: prev.counterparty_id || '', amount: String(prev.amount),
        event_id: prev.event_id || '', date: prev.date || '', note: prev.note || '',
      })
      pushUndo('úprava pohybu', async () => {
        const r = await callAction('updateLedgerEntry', editId, prevPayload)
        if (r.error) throw new Error(r.error)
        await load()
      })
    } else if (res.data && typeof res.data === 'object' && 'id' in res.data) {
      const newId = (res.data as { id: string }).id
      pushUndo('přidání pohybu', async () => {
        const r = await callAction('deleteLedgerEntry', newId)
        if (r.error) throw new Error(r.error)
        await load()
      })
    }
    setShowForm(false); setEditId(null); setForm(emptyForm)
    await load()
  }

  async function handleDelete(r: LedgerRow) {
    if (!confirm(`Smazat ${LEDGER_KIND_LABELS[r.kind].toLowerCase()} ${fmt(r.amount)} (${nameOf(r.profile_id)})?`)) return
    const res = await callAction('deleteLedgerEntry', r.id)
    if (res.error) { notify('Chyba: ' + res.error); return }
    pushUndo('smazání pohybu', async () => {
      const x = await callAction('restoreRow', 'owner_ledger', {
        id: r.id, profile_id: r.profile_id, counterparty_id: r.counterparty_id, kind: r.kind, amount: r.amount,
        event_id: r.event_id, date: r.date, note: r.note, source: r.source,
      })
      if (x.error) throw new Error(x.error)
      await load()
    })
    await load()
  }

  // ---- Zůstatek účtu ----
  async function saveBalance() {
    const amount = parseFloat(balanceInput.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(amount)) { notify('Zůstatek musí být číslo.'); return }
    const res = await callAction('setCompanyBalance', amount, today(), null)
    if (res.error) { notify('Chyba: ' + res.error); return }
    setBalance(res.data as CompanyBalanceRow)
    setBalanceEdit(false)
    setPayoutInput(null)
  }

  // ---- Zapsat vyrovnání ----
  async function recordSettlement() {
    setSettling(true)
    const eventId = scope !== 'all' && scope !== 'firma' ? scope : null
    const res = await callAction('recordSettlement', eventId, result.transfers, today(), `Vyrovnání – ${scopeLabel(scope)}`)
    setSettling(false)
    setConfirmSettle(false)
    if (res.error) { notify('Chyba: ' + res.error); return }
    const ids = (res.data as string[]) || []
    pushUndo('zapsání vyrovnání', async () => {
      for (const id of ids) {
        const r = await callAction('deleteLedgerEntry', id)
        if (r.error) throw new Error(r.error)
      }
      await load()
    })
    setPayoutInput(null)
    await load()
  }

  const owners = people.filter(p => p.is_owner)
  const others = people.filter(p => !p.is_owner)
  const visibleRows = showAllRows ? scopeRows : scopeRows.slice(0, 30)

  return (
    <div>
      <PermissionGuard permission="viewFirma" />

      <div style={{ marginBottom: '20px' }}>
        <Link href="/firma" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>← Zpět na Firmu</Link>
        <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '8px 0 4px' }}>🧮 Vklady a vyrovnání</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
          Kolik kdo vložil a vybral a kdo komu kolik pošle, aby do toho {ownersCount === 3 ? 'všichni tři majitelé' : 'všichni majitelé'} dali stejně.
          {' '}Majitelé: {owners.map(o => o.name.split(' ')[0]).join(', ') || '—'}.
        </p>
      </div>

      {/* Rozsah */}
      <div style={{ ...card, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Počítat za:</span>
        <select value={scope} onChange={e => { setScope(e.target.value); setPayoutInput(null); setConfirmSettle(false) }}
          style={{ ...inputStyle, width: 'auto', minWidth: '240px', maxWidth: '100%' }}>
          <option value="all">Celá firma (vše dohromady)</option>
          <option value="firma">Firma obecně (mimo akce){firmaCount ? ` · ${firmaCount}` : ''}</option>
          <optgroup label="Akce">
            {eventsWithRows.sorted.map(e => (
              <option key={e.id} value={e.id}>{e.name}{eventsWithRows.counts.get(e.id) ? ` · ${eventsWithRows.counts.get(e.id)}` : ''}</option>
            ))}
          </optgroup>
        </select>
        {eventResult !== null && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Hospodaření akce (příjmy − výdaje): <strong style={{ color: eventResult >= 0 ? '#34d399' : '#f87171' }}>{signed(eventResult)}</strong>
          </span>
        )}
      </div>

      {/* Kdo jak stojí */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Kdo jak stojí</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Čistě = vklady − výběry ± vyrovnání. Spravedlivý díl = celkem{mode === 'ucet' && result.payout > 0 ? ' (po výplatě z účtu)' : ''} ÷ {ownersCount || '?'} majitelé; kdo není majitel, dostane zpět vše.
        </p>
        <div className="vk-grid vk-head">
          <div>Kdo</div><div>Vloženo</div><div>Vybráno</div><div>Vyrovnání</div><div>Čistě</div><div>Spravedlivý díl</div><div>Rozdíl</div>
        </div>
        {result.people.map(p => {
          const settled = p.settledOut - p.settledIn
          const d = Math.round(p.diff)
          return (
            <div key={p.id} className="vk-grid vk-row">
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {p.name.split(' ')[0]}
                {!p.isOwner && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-dim)', fontWeight: 400 }}>není majitel</span>}
              </div>
              <div data-label="Vloženo">{fmt(p.deposited)}</div>
              <div data-label="Vybráno">{p.withdrawn ? fmt(p.withdrawn) : '—'}</div>
              <div data-label="Vyrovnání">{settled ? signed(settled) : '—'}</div>
              <div data-label="Čistě" style={{ fontWeight: 600 }}>{fmt(p.net)}</div>
              <div data-label="Spravedlivý díl" style={{ color: 'var(--text-muted)' }}>{p.isOwner ? fmt(p.target) : '0 Kč'}</div>
              <div data-label="Rozdíl" style={{ fontWeight: 700, color: d > 0 ? '#34d399' : d < 0 ? '#f87171' : 'var(--text-muted)' }}>
                {d === 0 ? 'vyrovnáno' : d > 0 ? `dostane ${fmt(d)}` : `doplatí ${fmt(-d)}`}
              </div>
            </div>
          )
        })}
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Celkem vloženo čistě: <strong style={{ color: 'var(--text-primary)' }}>{fmt(result.total)}</strong>
        </div>
      </div>

      {/* Jak vyrovnat */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>Jak vyrovnat</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {([['mezi', 'Jen mezi sebou'], ['ucet', 'Použít peníze z účtu firmy']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setConfirmSettle(false) }} style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)',
              backgroundColor: mode === m ? '#e05555' : 'transparent', color: mode === m ? '#fff' : 'var(--text-secondary)',
            }}>{label}</button>
          ))}
        </div>

        <Collapse open={mode === 'ucet'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Zůstatek na účtu firmy</label>
              {balanceEdit ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input autoFocus inputMode="decimal" value={balanceInput} onChange={e => setBalanceInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveBalance(); if (e.key === 'Escape') setBalanceEdit(false) }}
                    placeholder="např. 40000" style={inputStyle} />
                  <button type="button" onClick={saveBalance} style={{ padding: '0 14px', borderRadius: '8px', border: 'none', backgroundColor: '#e05555', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Uložit</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{balance ? fmt(balance.amount) : 'nezadáno'}</span>
                  {balance && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>k {fmtDate(balance.as_of)}</span>}
                  {canCreate && (
                    <button type="button" onClick={() => { setBalanceInput(balance ? String(balance.amount) : ''); setBalanceEdit(true) }}
                      style={{ fontSize: '12px', color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {balance ? 'Aktualizovat' : '+ Zadat z bankovnictví'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Použít z účtu</label>
              <input inputMode="decimal" value={payoutInput ?? String(defaultPayout)} onChange={e => setPayoutInput(e.target.value)} style={inputStyle} />
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                {suggested > 0
                  ? <>Stačí <button type="button" onClick={() => setPayoutInput(String(suggested))} style={{ color: '#f4978e', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '11px' }}>{fmt(suggested)}</button>, aby si nikdo nemusel nic posílat.</>
                  : 'Není co vyplácet — všichni jsou vyrovnaní.'}
                {suggested > accountBalance && accountBalance >= 0 && suggested > 0 && ' Na účtu tolik není, zbytek se doplatí mezi vámi.'}
              </div>
            </div>
          </div>
        </Collapse>

        {result.transfers.length === 0 ? (
          <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
            ✓ Vyrovnáno — nikdo nikomu nic neposílá.
          </div>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Návrh převodů (co nejméně plateb):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {result.transfers.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)' }}>
                  <span style={{ fontWeight: 600, color: t.from === 'firma' ? '#a78bfa' : 'var(--text-primary)' }}>{t.from === 'firma' ? '🏦 Firma' : nameOf(t.from)}</span>
                  <span style={{ color: 'var(--text-dim)' }}>→</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{nameOf(t.to)}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#fbbf24' }}>{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
            {canCreate && (confirmSettle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Opravdu se to už poslalo? Zapíše se {result.transfers.length} {result.transfers.length === 1 ? 'pohyb' : result.transfers.length < 5 ? 'pohyby' : 'pohybů'} s dnešním datem.</span>
                <button type="button" disabled={settling} onClick={recordSettlement} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#34d399', color: '#0c0c0c', fontWeight: 700, cursor: 'pointer' }}>
                  {settling ? 'Zapisuji…' : 'Ano, zapsat'}
                </button>
                <button type="button" onClick={() => setConfirmSettle(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Zrušit</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmSettle(true)} style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #34d399', backgroundColor: 'transparent', color: '#34d399', fontWeight: 600, cursor: 'pointer' }}>
                ✓ Zapsat jako provedené
              </button>
            ))}
          </>
        )}
      </div>

      {/* Pohyby */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Pohyby <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '13px' }}>· {scopeLabel(scope)} · {scopeRows.length}</span>
          </h2>
          {canCreate && (
            <button type="button" onClick={() => (showForm && !editId ? setShowForm(false) : openAdd())} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#e05555', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
              {showForm && !editId ? '× Zrušit' : '+ Přidat pohyb'}
            </button>
          )}
        </div>

        <Collapse open={showForm}>
          <form onSubmit={handleSave} style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-card)', marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['vklad', 'vyber', 'vyrovnani'] as const).map(k => (
                <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${LEDGER_KIND_COLORS[k]}`,
                  backgroundColor: form.kind === k ? LEDGER_KIND_COLORS[k] : 'transparent',
                  color: form.kind === k ? '#0c0c0c' : LEDGER_KIND_COLORS[k],
                }}>{LEDGER_KIND_LABELS[k]}</button>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px' }}>
              {form.kind === 'vklad' && 'Poslal peníze na účet firmy, nebo něco za firmu zaplatil ze svého.'}
              {form.kind === 'vyber' && 'Firma mu poslala peníze (vrácení vkladu, výplata zisku).'}
              {form.kind === 'vyrovnani' && 'Poslal peníze přímo jinému člověku, aby se vyrovnali.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>{form.kind === 'vyrovnani' ? 'Kdo poslal' : form.kind === 'vklad' ? 'Kdo vložil' : 'Kdo dostal'} *</label>
                <select required value={form.profile_id} onChange={e => setForm({ ...form, profile_id: e.target.value })} style={inputStyle}>
                  <option value="">— vyber —</option>
                  <optgroup label="Majitelé">{owners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                  <optgroup label="Ostatní">{others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                </select>
              </div>
              {form.kind === 'vyrovnani' && (
                <div>
                  <label style={labelStyle}>Komu *</label>
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
                <label style={labelStyle}>Kam</label>
                <select value={form.event_id} onChange={e => setForm({ ...form, event_id: e.target.value })} style={inputStyle}>
                  <option value="">Firma obecně (mimo akce)</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Datum</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Poznámka</label>
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="např. vklad z vlastních úspor, Makro, ploty…" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#e05555', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Ukládám…' : editId ? 'Uložit změny' : 'Přidat'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--bg-card-dark)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Zrušit</button>
            </div>
          </form>
        </Collapse>

        {scopeRows.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Zatím žádné pohyby.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {visibleRows.map(r => (
              <div key={r.id} className="vk-move">
                <div className="vk-move-main">
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', color: '#0c0c0c', backgroundColor: LEDGER_KIND_COLORS[r.kind], flexShrink: 0 }}>
                    {LEDGER_KIND_LABELS[r.kind]}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {nameOf(r.profile_id)}{r.kind === 'vyrovnani' && <> → {nameOf(r.counterparty_id)}</>}
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: LEDGER_KIND_COLORS[r.kind], whiteSpace: 'nowrap' }}>
                    {r.kind === 'vyber' ? '−' : ''}{fmt(r.amount)}
                  </span>
                </div>
                <div className="vk-move-meta">
                  <span>{fmtDate(r.date)}</span>
                  {scope === 'all' && <span>· {placeLabel(r.event_id)}</span>}
                  {r.note && <span style={{ color: 'var(--text-secondary)' }}>· {r.note}</span>}
                  <span style={{ color: 'var(--text-faint)' }}>· {LEDGER_SOURCE_LABELS[r.source]}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                    {canEdit && <button type="button" onClick={() => startEdit(r)} style={{ fontSize: '12px', color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Upravit</button>}
                    {canDelete && <button type="button" onClick={() => handleDelete(r)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Smazat</button>}
                  </span>
                </div>
              </div>
            ))}
            {scopeRows.length > visibleRows.length && (
              <button type="button" onClick={() => setShowAllRows(true)} style={{ marginTop: '6px', padding: '8px', borderRadius: '8px', border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Zobrazit všech {scopeRows.length}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
