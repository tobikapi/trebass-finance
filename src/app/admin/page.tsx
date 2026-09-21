import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from('profiles').select('id, name, email, role_id').order('name'),
    supabase.from('roles').select('id, name, color, permissions, is_system').order('name'),
  ])

  return <AdminClient initialProfiles={profiles || []} initialRoles={roles || []} />
}
