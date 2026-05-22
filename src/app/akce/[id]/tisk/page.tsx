import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import TiskClient from './TiskClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function TiskPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\s/g, ''),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.replace(/\s/g, ''),
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )

  const [{ data: ev }, { data: ex }, { data: inc }, { data: lin }, { data: tm }, { data: nt }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).single(),
    supabase.from('expenses').select('*').eq('event_id', id).order('category'),
    supabase.from('income').select('*').eq('event_id', id),
    supabase.from('lineup').select('*').eq('event_id', id).order('set_time'),
    supabase.from('team_contributions').select('*').eq('event_id', id),
    supabase.from('notes').select('*').eq('event_id', id).order('created_at', { ascending: false }),
  ])

  return (
    <TiskClient
      id={id}
      event={ev}
      expenses={ex || []}
      income={inc || []}
      lineup={lin || []}
      team={tm || []}
      notes={nt || []}
    />
  )
}
