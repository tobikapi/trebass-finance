import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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

  const [{ data: contacts }, { data: profiles }] = await Promise.all([
    supabase.from('contacts').select('*').order('name'),
    supabase.from('profiles').select('id, name, email, phone, roles(name, color)').order('name'),
  ])

  return <KontaktyClient initialContacts={contacts || []} initialMembers={profiles || []} />
}
