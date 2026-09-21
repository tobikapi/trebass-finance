import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import UkolyClient from './UkolyClient'

export const dynamic = 'force-dynamic'

export default async function UkolyPage() {
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

  const [{ data: tasks }, { data: events }, { data: profiles }] = await Promise.all([
    supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }).order('created_at'),
    supabase.from('events').select('id, name, date, status').order('date', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  return <UkolyClient initialTasks={tasks || []} initialEvents={events || []} initialMembers={profiles || []} />
}
