import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PrijmyClient from './PrijmyClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function PrijmyPage({ params }: Props) {
  const { id } = await params
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

  const [{ data: income }, { data: expenses }] = await Promise.all([
    supabase.from('income').select('*').eq('event_id', id).order('created_at'),
    supabase.from('expenses').select('price, deposit').eq('event_id', id),
  ])

  return (
    <PrijmyClient
      id={id}
      initialIncome={income || []}
      initialExpenses={expenses || []}
    />
  )
}
