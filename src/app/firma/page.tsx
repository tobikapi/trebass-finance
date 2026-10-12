import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FirmaClient from './FirmaClient'
import { toContributionRows } from '@/lib/ledger'
import { computeSettlement } from '@/lib/settlement'

export const dynamic = 'force-dynamic'

export default async function FirmaPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const [{ data: expenses }, { data: income }, { data: ledger }, { data: events }, { data: people }] = await Promise.all([
    supabase.from('company_expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('company_income').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('owner_ledger').select('id, profile_id, counterparty_id, kind, amount, event_id, date, note, closing_id, created_at'),
    supabase.from('events').select('id, name, date'),
    supabase.from('profiles').select('id, name, is_owner'),
  ])

  const contributions = toContributionRows(ledger || [], people || [], events || [])

  // Aktuální stav vyrovnání (jen otevřené pohyby, celá firma, mezi sebou) —
  // ukazuje se na kartě „Vklady a vyrovnání", ať je hned vidět, jestli je
  // potřeba něco řešit.
  const open = (ledger || []).filter(r => !r.closing_id)
  const ids = new Set((people || []).filter(p => p.is_owner).map(p => p.id))
  for (const r of open) { ids.add(r.profile_id); if (r.counterparty_id) ids.add(r.counterparty_id) }
  const firstName = (id: string) => ((people || []).find(p => p.id === id)?.name || '?').split(' ')[0]
  const settlement = computeSettlement(
    [...ids].map(id => ({ id, name: firstName(id), isOwner: (people || []).find(p => p.id === id)?.is_owner === true })),
    open, 0, null,
  )
  const ledgerStatus = {
    openCount: open.length,
    transfers: settlement.transfers.map(t => ({ from: firstName(t.from), to: firstName(t.to), amount: t.amount })),
  }

  return (
    <FirmaClient
      initialExpenses={expenses || []}
      initialIncome={income || []}
      initialContributions={contributions}
      ledgerStatus={ledgerStatus}
    />
  )
}
