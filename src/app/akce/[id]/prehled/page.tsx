import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PrehledClient from './PrehledClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function PrehledPage({ params }: Props) {
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

  const [{ data: expenses }, { data: income }, { data: event }] = await Promise.all([
    supabase.from('expenses').select('*').eq('event_id', id),
    supabase.from('income').select('*').eq('event_id', id),
    supabase.from('events').select('*').eq('id', id).single(),
  ])

  return (
    <PrehledClient
      id={id}
      initialExpenses={expenses || []}
      initialIncome={income || []}
      initialEvent={event}
    />
  )
}
