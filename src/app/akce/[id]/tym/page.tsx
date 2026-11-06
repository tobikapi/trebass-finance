import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import TymClient from './TymClient'
import { orgPeople } from '@/lib/org-people'
import { LEDGER_SELECT } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function TymPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  // Lidé a majitelé firmy, do které akce patří
  const [{ data: ledger }, { data: ev }] = await Promise.all([
    supabase.from('owner_ledger').select(LEDGER_SELECT).eq('event_id', id),
    supabase.from('events').select('org_id').eq('id', id).maybeSingle(),
  ])
  const people = await orgPeople(supabase, ev?.org_id ?? null)

  return (
    <TymClient
      id={id}
      initialLedger={ledger || []}
      people={(people || []).map(p => ({ id: p.id, name: p.name || '(bez jména)', is_owner: p.is_owner === true }))}
    />
  )
}
