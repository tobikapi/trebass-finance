import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FirmaClient from './FirmaClient'

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

  const [{ data: expenses }, { data: income }, { data: contrib }, { data: events }] = await Promise.all([
    supabase.from('company_expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('company_income').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('team_contributions').select('*'),
    supabase.from('events').select('id, name, date'),
  ])

  const eventsById = new Map((events || []).map(e => [e.id, e]))
  const contributions = (contrib || []).map(c => {
    const ev = eventsById.get(c.event_id)
    return {
      id: c.id, name: c.name, amount: c.amount, note: c.note,
      event_name: ev?.name || 'Neznámá akce',
      year: ev?.date ? ev.date.split('-')[0] : c.created_at.split('-')[0],
    }
  })

  return (
    <FirmaClient
      initialExpenses={expenses || []}
      initialIncome={income || []}
      initialContributions={contributions}
    />
  )
}
