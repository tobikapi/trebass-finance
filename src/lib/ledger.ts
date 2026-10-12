import type { LedgerKind } from '@/lib/settlement'

export interface LedgerRow {
  id: string
  profile_id: string
  counterparty_id: string | null
  kind: LedgerKind
  amount: number
  event_id: string | null
  date: string | null
  note: string | null
  source: 'rucne' | 'tym' | 'firma' | 'kalkulacka' | 'vypis'
  created_at: string
}

export interface LedgerPerson {
  id: string
  name: string
  is_owner: boolean
}

export interface CompanyBalanceRow {
  id: string
  amount: number
  as_of: string
  note: string | null
}

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  vklad: 'Vklad', vyber: 'Výběr', vyrovnani: 'Vyrovnání',
}

export const LEDGER_KIND_COLORS: Record<LedgerKind, string> = {
  vklad: '#34d399', vyber: '#f87171', vyrovnani: '#60a5fa',
}

export const LEDGER_SOURCE_LABELS: Record<LedgerRow['source'], string> = {
  rucne: 'ručně', tym: 'ze záložky Tým', firma: 'z Firmy', kalkulacka: 'z kalkulačky', vypis: 'z výpisu',
}

export const LEDGER_SELECT = 'id, profile_id, counterparty_id, kind, amount, event_id, date, note, source, created_at'

// Řazení: nejnovější nahoře; bez data podle toho, kdy se zapsal.
export function sortLedger(rows: LedgerRow[]) {
  return [...rows].sort((a, b) =>
    (b.date || b.created_at.slice(0, 10)).localeCompare(a.date || a.created_at.slice(0, 10))
    || b.created_at.localeCompare(a.created_at))
}

// Pro stránku Firma: vklady (+) a výběry (−) majitelů z Knihy, s názvem akce.
// Vyrovnání mezi lidmi se nepočítá — peníze firmou neprošly.
export interface ContributionRow {
  id: string
  name: string
  amount: number
  note: string | null
  event_name: string
  year: string
}

export function toContributionRows(
  ledger: Pick<LedgerRow, 'id' | 'profile_id' | 'kind' | 'amount' | 'event_id' | 'date' | 'note' | 'created_at'>[],
  people: { id: string; name: string | null }[],
  events: { id: string; name: string; date: string | null }[],
): ContributionRow[] {
  const nameById = new Map(people.map(p => [p.id, (p.name || '?').split(' ')[0]]))
  const eventById = new Map(events.map(e => [e.id, e]))
  return ledger.filter(r => r.kind !== 'vyrovnani').map(r => {
    const ev = r.event_id ? eventById.get(r.event_id) : null
    return {
      id: r.id,
      name: nameById.get(r.profile_id) || '?',
      amount: r.kind === 'vyber' ? -r.amount : r.amount,
      note: r.kind === 'vyber' ? `výběr${r.note ? ' · ' + r.note : ''}` : r.note,
      event_name: r.event_id ? (ev?.name || 'Neznámá akce') : 'Firma obecně',
      year: (ev?.date || r.date || r.created_at).split('-')[0],
    }
  })
}
