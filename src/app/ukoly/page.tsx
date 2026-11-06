import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getActiveOrgId } from '@/lib/server-user'
import { orgPeople } from '@/lib/org-people'
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

  const orgId = await getActiveOrgId()
  const [{ data: tasks }, { data: events }, profiles] = await Promise.all([
    supabase.from('tasks').select('*').eq('org_id', orgId ?? '').order('due_date', { ascending: true, nullsFirst: false }).order('created_at'),
    supabase.from('events').select('id, name, date, status').eq('org_id', orgId ?? '').order('date', { ascending: false }),
    orgPeople(supabase, orgId).then(p => p.map(({ id, name }) => ({ id, name }))),
  ])

  return <UkolyClient initialTasks={tasks || []} initialEvents={events || []} initialMembers={profiles || []} />
}
