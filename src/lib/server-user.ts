import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { Role } from '@/lib/permissions'
import type { Profile } from '@/lib/user-context'
import { ACTIVE_ORG_COOKIE, pickActiveOrg, slugOf, type OrgMembership } from '@/lib/orgs'

export interface InitialUser {
  user: User | null
  profile: Profile | null
  realRole: Role | null
  allRoles: Role[]
  viewAsRoleId: string | null
  orgs: OrgMembership[]      // firmy, ve kterých člověk je (přepínač)
  activeOrgId: string | null
  isOwner: boolean           // majitel v aktivní firmě
}

const ROLE_COLUMNS = 'id, name, color, permissions, is_system'

interface MembershipRow {
  org_id: string
  role_id: string | null
  is_owner: boolean
  organizations: { id: string; slug: string; name: string } | null
  roles: Role | null
}

// Aktivní firma z cookie. Proxy (src/proxy.ts) ji při každém požadavku
// ověří proti členství, takže stránky jí můžou věřit; databáze by cizí
// firmu stejně nevydala.
export async function getActiveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null
}

// Uživatel, profil a role se načtou už na serveru (v root layoutu), aby první
// vykreslení v prohlížeči rovnou vědělo, kdo je přihlášený a co smí. Dřív se
// to dotahovalo až v prohlížeči řetězem session → profil → role (každý krok
// přes oceán do Supabase) a mezitím appka ukazovala omezený pohled bez jména.
export async function getInitialUser(): Promise<InitialUser> {
  const empty: InitialUser = {
    user: null, profile: null, realRole: null, allRoles: [], viewAsRoleId: null,
    orgs: [], activeOrgId: null, isOwner: false,
  }
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

  const [{ data: profileRow }, { data: memberRows }] = await Promise.all([
    supabase.from('profiles').select('id, name, email').eq('id', user.id).maybeSingle(),
    supabase.from('org_members')
      .select(`org_id, role_id, is_owner, organizations(id, slug, name), roles(${ROLE_COLUMNS})`)
      .eq('profile_id', user.id),
  ])

  const memberships = ((memberRows || []) as unknown as MembershipRow[])
  const orgs: OrgMembership[] = memberships
    .filter(m => m.organizations && slugOf(m.org_id))
    .map(m => ({ id: m.org_id, slug: slugOf(m.org_id)!, name: m.organizations!.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))

  const activeOrgId = pickActiveOrg(orgs.map(o => o.id), cookieStore.get(ACTIVE_ORG_COOKIE)?.value)
  const active = memberships.find(m => m.org_id === activeOrgId) ?? null
  const realRole = active?.roles ?? null

  const isAdmin = realRole?.permissions?.admin === true
  let allRoles: Role[] = []
  let viewAsRoleId: string | null = null
  if (isAdmin && activeOrgId) {
    const { data } = await supabase.from('roles').select(ROLE_COLUMNS).eq('org_id', activeOrgId).order('name')
    allRoles = data || []
    const saved = cookieStore.get('trebass_view_as')?.value ?? null
    viewAsRoleId = saved && allRoles.some(r => r.id === saved) ? saved : null
  }

  const profile: Profile | null = profileRow
    ? { ...profileRow, role_id: active?.role_id ?? null }
    : null

  return {
    user, profile, realRole, allRoles, viewAsRoleId,
    orgs, activeOrgId, isOwner: active?.is_owner === true,
  }
}
