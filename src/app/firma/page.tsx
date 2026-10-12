import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FirmaClient from './FirmaClient'
import { toContributionRows } from '@/lib/ledger'

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
    supabase.from('owner_ledger').select('id, profile_id, kind, amount, event_id, date, note, created_at'),
    supabase.from('events').select('id, name, date'),
    supabase.from('profiles').select('id, name'),
  ])

  const contributions = toContributionRows(ledger || [], people || [], events || [])

  return (
    <FirmaClient
      initialExpenses={expenses || []}
      initialIncome={income || []}
      initialContributions={contributions}
    />
  )
}
