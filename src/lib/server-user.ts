import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { Role } from '@/lib/permissions'
import type { Profile } from '@/lib/user-context'

export interface InitialUser {
  user: User | null
  profile: Profile | null
  realRole: Role | null
  allRoles: Role[]
  viewAsRoleId: string | null
}

const ROLE_COLUMNS = 'id, name, color, permissions, is_system'

// Uživatel, profil a role se načtou už na serveru (v root layoutu), aby první
// vykreslení v prohlížeči rovnou vědělo, kdo je přihlášený a co smí. Dřív se
// to dotahovalo až v prohlížeči řetězem session → profil → role (každý krok
// přes oceán do Supabase) a mezitím appka ukazovala omezený pohled bez jména.
export async function getInitialUser(): Promise<InitialUser> {
  const empty: InitialUser = { user: null, profile: null, realRole: null, allRoles: [], viewAsRoleId: null }
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
  if (!user) return empty

  const { data: profile } = await supabase.from('profiles')
    .select('id, name, email, role_id').eq('id', user.id).maybeSingle()

  let realRole: Role | null = null
  if (profile?.role_id) {
    const { data } = await supabase.from('roles').select(ROLE_COLUMNS).eq('id', profile.role_id).maybeSingle()
    realRole = data
  }

  const isAdmin = realRole?.permissions?.admin === true
  let allRoles: Role[] = []
  let viewAsRoleId: string | null = null
  if (isAdmin) {
    const { data } = await supabase.from('roles').select(ROLE_COLUMNS).order('name')
    allRoles = data || []
    const saved = cookieStore.get('trebass_view_as')?.value ?? null
    viewAsRoleId = saved && allRoles.some(r => r.id === saved) ? saved : null
  }

  return { user, profile: profile ?? null, realRole, allRoles, viewAsRoleId }
}
