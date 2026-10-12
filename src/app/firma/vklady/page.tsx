import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import VkladyClient from './VkladyClient'
import { LEDGER_SELECT } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

export default async function VkladyPage({ searchParams }: { searchParams: Promise<{ akce?: string }> }) {
  const { akce } = await searchParams
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const [{ data: ledger }, { data: people }, { data: events }, { data: balance }, { data: expenses }, { data: income }] = await Promise.all([
    supabase.from('owner_ledger').select(LEDGER_SELECT),
    supabase.from('profiles').select('id, name, is_owner').order('name'),
    supabase.from('events').select('id, name, date').order('date', { ascending: false }),
    supabase.from('company_balance').select('id, amount, as_of, note').order('as_of', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    // Hospodaření akcí jen jako kontext ke kalkulačce (příjmy − výdaje)
    supabase.from('expenses').select('event_id, price'),
    supabase.from('income').select('event_id, amount'),
  ])

  const result: Record<string, number> = {}
  for (const e of expenses || []) result[e.event_id] = (result[e.event_id] || 0) - (e.price || 0)
  for (const i of income || []) result[i.event_id] = (result[i.event_id] || 0) + (i.amount || 0)

  return (
    <VkladyClient
      initialLedger={ledger || []}
      people={(people || []).map(p => ({ id: p.id, name: p.name || '(bez jména)', is_owner: p.is_owner === true }))}
      events={events || []}
      initialBalance={balance?.[0] ?? null}
      eventResults={result}
      initialScope={akce || null}
    />
  )
}
