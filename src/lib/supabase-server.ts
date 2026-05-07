import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Role } from './permissions'

export async function getServerUserRole(): Promise<{ userId: string; role: Role } | null> {
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return { userId: user.id, role: (data?.role as Role) ?? 'host' }
}
