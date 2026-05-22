import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import VydajeClient from './VydajeClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function VydajePage({ params }: Props) {
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

  const [{ data: expenses }, { data: event }] = await Promise.all([
    supabase.from('expenses').select('*').eq('event_id', id).order('category').order('created_at'),
    supabase.from('events').select('budgets').eq('id', id).single(),
  ])

  return (
    <VydajeClient
      id={id}
      initialExpenses={expenses || []}
      initialBudgets={event?.budgets || {}}
    />
  )
}
