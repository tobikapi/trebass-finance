import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getActiveOrgId } from '@/lib/server-user'
import { orgPeople } from '@/lib/org-people'
import KontaktyClient from './KontaktyClient'

export const dynamic = 'force-dynamic'

export default async function KontaktyPage() {
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
  const [{ data: contacts }, profiles] = await Promise.all([
    supabase.from('contacts').select('*').eq('org_id', orgId ?? '').order('name'),
    orgPeople(supabase, orgId),
  ])

  return <KontaktyClient initialContacts={contacts || []} initialMembers={profiles || []} />
}
