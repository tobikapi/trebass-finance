// Výpočet vyrovnání mezi majiteli. Čistá funkce bez Reactu a databáze,
// ať se dá ověřit na příkladech (viz scripts/test-settlement.ts).
//
// Princip: majitelé mají do akce (nebo do firmy) vložit stejně. Kdo není
// majitel, má dostat zpět vše, co za firmu zaplatil. Peníze z účtu firmy
// patří všem majitelům stejně — výplata z účtu proto snižuje „spravedlivý
// díl" všech a dostane ji ten, kdo vložil nejvíc.

export type LedgerKind = 'vklad' | 'vyber' | 'vyrovnani'

export interface LedgerEntry {
  profile_id: string
  counterparty_id: string | null
  kind: LedgerKind
  amount: number
}

export interface PersonInfo {
  id: string
  name: string
  isOwner: boolean
}

export interface PersonBalance {
  id: string
  name: string
  isOwner: boolean
  deposited: number   // vklady
  withdrawn: number   // výběry
  settledOut: number  // poslal ostatním při vyrovnání
  settledIn: number   // dostal od ostatních při vyrovnání
  net: number         // čistě ve firmě = vklady − výběry + poslal − dostal
  target: number      // spravedlivý díl (po případné výplatě z účtu)
  diff: number        // net − target; + = dostane, − = má doplatit
}

export interface Transfer {
  from: string | 'firma'
  to: string
  amount: number
}

export interface SettlementResult {
  people: PersonBalance[]
  total: number              // součet čistých vkladů všech
  payout: number             // skutečně použito z účtu firmy
  suggestedPayout: number    // kolik z účtu stačí, aby si nikdo nic neposílal
  transfers: Transfer[]
}

const round = (n: number) => Math.round(n)

export function netOf(entries: LedgerEntry[], id: string) {
  let deposited = 0, withdrawn = 0, settledOut = 0, settledIn = 0
  for (const e of entries) {
    if (e.kind === 'vklad' && e.profile_id === id) deposited += e.amount
    if (e.kind === 'vyber' && e.profile_id === id) withdrawn += e.amount
    if (e.kind === 'vyrovnani' && e.profile_id === id) settledOut += e.amount
    if (e.kind === 'vyrovnani' && e.counterparty_id === id) settledIn += e.amount
  }
  return { deposited, withdrawn, settledOut, settledIn, net: deposited - withdrawn + settledOut - settledIn }
}

/**
 * @param people  všichni majitelé + kdokoli, kdo má v rozsahu nějaký pohyb
 * @param entries pohyby v rozsahu (jedna akce, nebo celá firma)
 * @param wantedPayout kolik chceme vzít z účtu firmy (0 = jen mezi sebou)
 * @param accountBalance zůstatek na účtu (strop výplaty), null = neomezeno
 */
export function computeSettlement(
  people: PersonInfo[], entries: LedgerEntry[], wantedPayout: number, accountBalance: number | null,
): SettlementResult {
  const ownersCount = people.filter(p => p.isOwner).length
  const base = people.map(p => ({ ...p, ...netOf(entries, p.id) }))
  const total = base.reduce((s, p) => s + p.net, 0)

  // Spravedlivý díl: majitelé nesou vše rovným dílem (včetně toho, co se
  // vrací nemajitelům), nemajitelé mají cíl 0 = dostanou zpět vše.
  // Součet cílů = total − payout, takže součet rozdílů = payout.
  //
  // Kolik z účtu stačí, aby si nikdo nemusel nic posílat: všichni majitelé
  // musí mít net ≥ (total − P) / počet → P ≥ total − počet × nejmenší net.
  const ownerNets = base.filter(p => p.isOwner).map(p => p.net)
  const suggestedPayout = ownersCount > 0
    ? round(Math.max(0, total - ownersCount * Math.min(...ownerNets)))
    : round(base.reduce((s, p) => s + Math.max(0, p.net), 0))

  // Výplata nesmí být záporná, vyšší než zůstatek ani vyšší než celkový vklad
  // (víc, než se vložilo, vrátit nejde).
  let payout = Math.max(0, wantedPayout)
  if (accountBalance !== null) payout = Math.min(payout, Math.max(0, accountBalance))
  payout = Math.min(payout, Math.max(0, total))

  const ownerTarget = ownersCount > 0 ? (total - payout) / ownersCount : 0

  const people2: PersonBalance[] = base.map(p => {
    const target = p.isOwner ? ownerTarget : 0
    return { ...p, target, diff: p.net - target }
  })

  // 1) Firma vyplatí z účtu: nejdřív nemajitelům (dluh firmy), pak majitelům
  //    s největším přebytkem — postupně je „sráží" na stejnou úroveň.
  const remaining = new Map(people2.map(p => [p.id, p.diff]))
  const transfers: Transfer[] = []
  let left = payout
  const payTo = (id: string, amount: number) => {
    if (amount <= 0.5) return
    transfers.push({ from: 'firma', to: id, amount: round(amount) })
    remaining.set(id, (remaining.get(id) || 0) - amount)
    left -= amount
  }
  for (const p of people2.filter(p => !p.isOwner && p.diff > 0).sort((a, b) => b.diff - a.diff)) {
    payTo(p.id, Math.min(p.diff, left))
  }
  for (const p of people2.filter(p => p.isOwner && (remaining.get(p.id) || 0) > 0).sort((a, b) => (remaining.get(b.id) || 0) - (remaining.get(a.id) || 0))) {
    payTo(p.id, Math.min(remaining.get(p.id) || 0, left))
  }

  // 2) Zbytek mezi lidmi: největší dlužník platí největšímu věřiteli —
  //    vychází co nejméně převodů.
  const creditors = [...remaining].filter(([, v]) => v > 0.5).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v)
  const debtors = [...remaining].filter(([, v]) => v < -0.5).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v)
  let ci = 0, di = 0
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].v, debtors[di].v)
    if (round(amount) > 0) transfers.push({ from: debtors[di].id, to: creditors[ci].id, amount: round(amount) })
    creditors[ci].v -= amount
    debtors[di].v -= amount
    if (creditors[ci].v <= 0.5) ci++
    if (debtors[di].v <= 0.5) di++
  }

  return { people: people2, total, payout: round(payout), suggestedPayout, transfers }
}
