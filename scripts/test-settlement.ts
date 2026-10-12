// Ověření výpočtu vyrovnání na příkladech. Spuštění: node scripts/test-settlement.ts
import { computeSettlement, type LedgerEntry, type PersonInfo } from '../src/lib/settlement.ts'

const J = 'jakub', T = 'tobias', M = 'metodej', A = 'artur'
const people: PersonInfo[] = [
  { id: J, name: 'Jakub', isOwner: true }, { id: T, name: 'Tobiáš', isOwner: true },
  { id: M, name: 'Metoděj', isOwner: true }, { id: A, name: 'Artur', isOwner: false },
]
const v = (id: string, amount: number): LedgerEntry => ({ profile_id: id, counterparty_id: null, kind: 'vklad', amount })
let fails = 0
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n   dostal: ${JSON.stringify(got)}\n   čekal:  ${JSON.stringify(want)}`}`)
}
const tx = (r: ReturnType<typeof computeSettlement>) => r.transfers.map(t => `${t.from}→${t.to} ${t.amount}`).sort()

// 1) Příklad z zadání: Jakub 110k, Tobiáš 70k, Metoděj 70k — jen mezi sebou
const base = [v(J, 110000), v(T, 70000), v(M, 70000)]
let r = computeSettlement(people, base, 0, null)
check('mezi sebou: převody', tx(r), ['metodej→jakub 13333', 'tobias→jakub 13333'])
check('mezi sebou: navržená výplata z účtu', r.suggestedPayout, 40000)

// 2) Z účtu 40k (zůstatek 40k) — nikdo nikomu nic
r = computeSettlement(people, base, 40000, 40000)
check('z účtu 40k: převody', tx(r), ['firma→jakub 40000'])

// 3) Z účtu jen 26 667 — zbytek mezi sebou
r = computeSettlement(people, base, 26667, 100000)
check('z účtu 26 667: převody', tx(r), ['firma→jakub 26667', 'metodej→jakub 4444', 'tobias→jakub 4444'])

// 4) Výplata omezená zůstatkem
r = computeSettlement(people, base, 999999, 10000)
check('strop zůstatkem', r.payout, 10000)

// 5) Artur (nemajitel) zaplatil 2 700 — dostane zpět vše, nese to majitelé
const withA = [...base, v(A, 2700)]
r = computeSettlement(people, withA, 0, null)
// po provedení převodů musí mít každý majitel vloženo stejně a Artur 0
{
  const after = new Map(people.map(p => [p.id, r.people.find(x => x.id === p.id)!.net]))
  for (const t of r.transfers) { after.set(t.from, after.get(t.from)! + t.amount); after.set(t.to, after.get(t.to)! - t.amount) }
  check('nemajitel mezi sebou: všichni majitelé stejně, Artur 0',
    [J, T, M, A].map(id => Math.round(after.get(id)!)), [84234, 84233, 84233, 0])
  check('nemajitel mezi sebou: nejvýš 3 převody', r.transfers.length <= 3, true)
}
const sumToArtur = r.transfers.filter(t => t.to === A).reduce((s, t) => s + t.amount, 0)
check('nemajitel dostane celých 2 700', sumToArtur, 2700)
check('nemajitel: navržená výplata', r.suggestedPayout, 42700)
r = computeSettlement(people, withA, 42700, 50000)
check('nemajitel z účtu: převody', tx(r), ['firma→artur 2700', 'firma→jakub 40000'])

// 6) Po zapsaném vyrovnání je vše na nule
const settled: LedgerEntry[] = [...base,
  { profile_id: T, counterparty_id: J, kind: 'vyrovnani', amount: 13333.33 },
  { profile_id: M, counterparty_id: J, kind: 'vyrovnani', amount: 13333.33 }]
r = computeSettlement(people, settled, 0, null)
check('po vyrovnání žádné převody', tx(r), [])

// 6b) Vyrovnání zapsané zaokrouhleně na koruny — nesmí vzniknout další převod
r = computeSettlement(people, [...base,
  { profile_id: T, counterparty_id: J, kind: 'vyrovnani', amount: 13333 },
  { profile_id: M, counterparty_id: J, kind: 'vyrovnani', amount: 13333 }], 0, null)
check('zaokrouhlené vyrovnání bez dalších převodů', tx(r), [])

// 7) Výběr z firmy po výplatě z účtu → vyrovnáno
r = computeSettlement(people, [...base, { profile_id: J, counterparty_id: null, kind: 'vyber', amount: 40000 }], 0, null)
check('po výběru 40k Jakubem vyrovnáno', tx(r), [])

// 8) Někdo vybral víc, než vložil (zisk rozdělen nerovně)
r = computeSettlement(people, [{ profile_id: J, counterparty_id: null, kind: 'vyber', amount: 30000 }], 0, null)
check('nerovný výběr zisku', tx(r), ['jakub→metodej 10000', 'jakub→tobias 10000'])

// 9) Po uzávěrce (vše na nule): Artur a Metoděj dluží Jakubovi za Spring Edition
const d = (from: string, to: string, amount: number): LedgerEntry => ({ profile_id: from, counterparty_id: to, kind: 'dluh', amount })
r = computeSettlement(people, [d(A, J, 15000), d(M, J, 8000)], 0, null)
check('dluhy: převody', tx(r), ['artur→jakub 15000', 'metodej→jakub 8000'])
// ...a po splacení vyrovnáním je vše na nule
r = computeSettlement(people, [d(A, J, 15000), d(M, J, 8000),
  { profile_id: A, counterparty_id: J, kind: 'vyrovnani', amount: 15000 },
  { profile_id: M, counterparty_id: J, kind: 'vyrovnani', amount: 8000 }], 0, null)
check('dluhy splacené', tx(r), [])
// dluh se nesmí míchat s výplatou z účtu: firma dluh nesplácí
r = computeSettlement(people, [d(A, J, 15000)], computeSettlement(people, [d(A, J, 15000)], 0, null).suggestedPayout, 99999)
check('dluh + účet: firma nic nevyplácí', tx(r), ['artur→jakub 15000'])

// 10) Tobiáš si vybral 60 000 — Jakub a Metoděj mají nárok na stejně
const vy = (id: string, amount: number): LedgerEntry => ({ profile_id: id, counterparty_id: null, kind: 'vyber', amount })
r = computeSettlement(people, [vy(T, 60000)], 0, null)
check('výběr 60k mezi sebou', tx(r), ['tobias→jakub 20000', 'tobias→metodej 20000'])
check('výběr 60k: z účtu stačí', r.suggestedPayout, 120000)
r = computeSettlement(people, [vy(T, 60000)], 120000, 200000)
check('výběr 60k z účtu', tx(r), ['firma→jakub 60000', 'firma→metodej 60000'])

console.log(fails ? `\n${fails} chyb` : '\nVše sedí.')
process.exit(fails ? 1 : 0)
